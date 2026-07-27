// RPG Reactor - Database Tileset Editor
// Provides an interface for creating and editing tilesets
// Unified version combining standalone and database integration functionality

class DatabaseTilesetEditor {
    // Tilesets.json is the largest database file — each tileset carries an
    // 8192-entry flags array — so a truncate-in-place write leaves the widest
    // window in which a crash destroys the previous good copy along with the
    // new one. Falls back to a plain write when the fs implementation has no
    // renameSync (test mocks, web host shims).
    _writeFileAtomic(fs, filePath, data, options) {
        const atomic = (typeof window !== 'undefined' && window.RRWriteFileAtomicSync) || null;
        if (atomic && fs && typeof fs.renameSync === 'function') {
            atomic(fs, filePath, data, options);
        } else {
            fs.writeFileSync(filePath, data, options);
        }
    }

    constructor(app, projectPath, databaseManager, projectManager, commonUI, parentEditor) {
        // Support both old signature (app, projectPath, databaseManager)
        // and new signature (databaseManager, projectManager, commonUI, parentEditor)

        // The renderer app is optional, so the string project path identifies the old signature.
        if (typeof projectPath === 'string') {
            // Old signature: (app, projectPath, databaseManager)
            this.app = app;
            this.projectPath = projectPath;
            this.databaseManager = databaseManager;
            this.projectManager = null;
            this.commonUI = null;
            this.parentEditor = null;
        } else {
            // New signature: (databaseManager, projectManager, commonUI, parentEditor)
            this.databaseManager = app; // First arg is actually databaseManager
            this.projectManager = projectPath; // Second arg is actually projectManager
            this.commonUI = databaseManager; // Third arg is actually commonUI
            this.parentEditor = projectManager; // Fourth arg is actually parentEditor
            this.app = null;
            this.projectPath = null;
        }

        this.fs = null;
        this.path = null;
        const host = typeof window !== 'undefined' ? window.RPGReactorHost : null;
        if (host?.fs && host?.path) {
            this.fs = host.fs;
            this.path = host.path;
        }
        this.currentTileset = null;
        this.tilesetList = [];
        this.selectedImageIndex = null;
        this.currentEditMode = null; // 'passage-o', 'passage-x', 'passage-4dir', 'ladder', 'bush', 'counter', 'damage', 'terrain'
        this.selectedDirection = null; // For 4-dir passage: 'down', 'left', 'right', 'up'
        this.selectedTerrain = 0; // For terrain tag: 0-7
        this.currentTab = 'A'; // Current layer tab: 'A', 'B', 'C', 'D', 'E', 'F', 'G'
        this.tileSize = 48;
        this.selectedTile = null; // Currently selected tile { x, y } for highlighting
        this.imageCache = new Map(); // Cache rendered tileset images to avoid redrawing
        this.currentCanvas = null; // Store current canvas to update without recreating
        this.tabCanvases = []; // Canvases of a multi-layer tab, for whole-view repaints

        // Tileset editor reference (for database wrapper functionality)
        this.tilesetEditor = null;
        this.onTilesetSaved = null;

        // Initialize Node.js modules if running in NW.js
        if (!this.fs && typeof nw !== 'undefined') {
            this.fs = require('fs');
            this.path = require('path');
        }
    }

    // Get the current project path (handles both old and new signatures)
    getProjectPath() {
        if (this.projectPath) {
            return this.projectPath; // Old signature
        }
        if (this.projectManager && this.projectManager.getCurrentProject) {
            const project = this.projectManager.getCurrentProject();
            return project ? project.path : null;
        }
        return null;
    }

    assetUrl(filePath) {
        if (!filePath || /^(file|https?):\/\//i.test(filePath)) return filePath;
        if (typeof window !== 'undefined' && window.RPGReactorAssetUrl) {
            return window.RPGReactorAssetUrl(filePath);
        }

        try {
            const { pathToFileURL } = require('url');
            if (pathToFileURL) return pathToFileURL(filePath).href;
        } catch (error) {
            // Fall through for restricted hosts without Node's URL module.
        }

        let normalized = String(filePath).replace(/\\/g, '/');
        if (/^[A-Za-z]:\//.test(normalized)) normalized = '/' + normalized;
        return 'file://' + encodeURI(normalized).replace(/#/g, '%23');
    }

    // Initialize the tileset editor UI
    async loadTilesets() {
        if (!this.fs) {
            console.error('File system not available');
            return;
        }

        try {
            const tilesetsPath = this.path.join(this.getProjectPath(), 'data', 'Tilesets.json');

            if (!this.fs.existsSync(tilesetsPath)) {
                console.warn('Tilesets.json not found, creating new file');
                this.tilesetList = [null]; // RPG Maker format starts with null at index 0
                this.saveTilesetsFile();
                return;
            }

            const data = JSON.parse(this.fs.readFileSync(tilesetsPath, 'utf8'));
            this.tilesetList = data;


            // Select first valid tileset
            for (let i = 1; i < this.tilesetList.length; i++) {
                if (this.tilesetList[i]) {
                    this.selectTileset(i);
                    break;
                }
            }
        } catch (error) {
            console.error('Error loading tilesets:', error);
        }
    }

    selectTileset(id) {
        this.currentTileset = this.tilesetList[id];
    }

    saveTileset() {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        if (!this.currentTileset) {
            alert(tt('No tileset selected'));
            return;
        }

        // Update name from input (check both old UI and compact UI)
        const nameInput = document.getElementById('compact-tileset-name-input');
        if (nameInput) {
            this.currentTileset.name = nameInput.value;
        }

        // Inside the Database modal, Save updates the transactional in-memory
        // database. The modal's OK/Save action owns persistence and Cancel can
        // still restore its snapshot.
        if (this.parentEditor?._activeDatabaseList?.type === 'tilesets') {
            this.notifyTilesetSaved();
            this.updateStatus(`${this.currentTileset.name} ${tt('updated')}`);
            return;
        }

        // Ensure the tilesetList is initialized and contains the current tileset
        if (!this.tilesetList || this.tilesetList.length === 0) {
            console.warn('TilesetList is empty, loading from file before saving...');
            this.loadTilesets();
            // Give it a moment to load
            setTimeout(() => {
                this.saveAfterLoad();
            }, 100);
            return;
        }

        // Update the current tileset in the list
        if (this.currentTileset.id) {
            this.tilesetList[this.currentTileset.id] = this.currentTileset;
        }

        // Save to file
        this.saveTilesetsFile();

        // Refresh list to show updated name
        this.notifyTilesetSaved();

        // Update status
        this.updateStatus(`${tt('Tileset saved:')} ${this.currentTileset.name}`);
        console.log('Tileset saved:', this.currentTileset.name);
    }

    saveAfterLoad() {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        console.log('saveAfterLoad - tilesetList length:', this.tilesetList.length);

        // Update the current tileset in the list
        if (this.currentTileset && this.currentTileset.id) {
            this.tilesetList[this.currentTileset.id] = this.currentTileset;
        }

        // Save to file
        this.saveTilesetsFile();

        // Refresh list to show updated name
        this.notifyTilesetSaved();

        // Update status
        this.updateStatus(`${tt('Tileset saved:')} ${this.currentTileset.name}`);
        console.log('Tileset saved:', this.currentTileset.name);
    }

    notifyTilesetSaved() {
        if (typeof this.onTilesetSaved === 'function') {
            this.onTilesetSaved(this.currentTileset);
        }
    }

    /** The 3D classification module, absent on hosts that never loaded it. */
    tileset3DClasses() {
        return (typeof window !== 'undefined' && window.RRTileset3DClass) || null;
    }

    /**
     * The live classification store.
     *
     * The database owns it when there is one, so the modal's OK/Cancel covers
     * 3D classes along with everything else. Standalone (the old constructor
     * signature, and tests) it is read from disk once and written by
     * `saveTilesetsFile`.
     */
    tileset3DStore() {
        const classes = this.tileset3DClasses();
        if (!classes) return null;
        if (this.databaseManager && typeof this.databaseManager.getTileset3D === 'function') {
            return this.databaseManager.getTileset3D();
        }
        if (!this._tileset3d) {
            this._tileset3d = classes.create();
            const filePath = this.tileset3DPath();
            if (filePath && this.fs && this.fs.existsSync(filePath)) {
                try {
                    this._tileset3d = classes.normalize(JSON.parse(this.fs.readFileSync(filePath, 'utf8')));
                } catch (error) {
                    // Starting empty would silently overwrite the author's work
                    // on the next save, so keep the failure loud and visible.
                    console.error(`Error loading ${classes.FILENAME}:`, error);
                }
            }
        }
        return this._tileset3d;
    }

    tileset3DPath() {
        const classes = this.tileset3DClasses();
        const projectPath = this.getProjectPath();
        if (!classes || !projectPath || !this.path) return null;
        return this.path.join(projectPath, 'data', classes.FILENAME);
    }

    /** Persist classification alongside Tilesets.json outside the modal. */
    saveTileset3DFile() {
        const classes = this.tileset3DClasses();
        if (!classes || !this.fs) return;
        const projectPath = this.getProjectPath();
        if (!projectPath) return;

        if (this.databaseManager && typeof this.databaseManager.saveTileset3D === 'function') {
            this.databaseManager.saveTileset3D(projectPath);
            return;
        }

        const filePath = this.tileset3DPath();
        const store = this._tileset3d;
        if (!filePath || !store) return;
        // A project that never classifies a tile gains no file.
        if (classes.isEmpty(store) && !this.fs.existsSync(filePath)) return;
        try {
            this._writeFileAtomic(this.fs, filePath, JSON.stringify(classes.normalize(store)));
        } catch (error) {
            console.error(`Error saving ${classes.FILENAME}:`, error);
        }
    }

    saveTilesetsFile() {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        if (!this.fs) {
            console.error('Cannot save: fs not available');
            return;
        }

        const projectPath = this.getProjectPath();
        if (!projectPath) {
            console.error('Cannot save: projectPath is null');
            alert(tt('Error: Project path not available. Cannot save tilesets.'));
            return;
        }

        console.log('Saving tilesets...');
        console.log('Project path:', projectPath);
        console.log('Tileset list length:', this.tilesetList.length);
        console.log('Current tileset:', this.currentTileset);

        try {
            const tilesetsPath = this.path.join(projectPath, 'data', 'Tilesets.json');
            console.log('Full path:', tilesetsPath);

            // Use RPG Maker's compact JSON format (each tileset on one line)
            // This keeps file size small by not pretty-printing the large flags arrays
            const jsonLines = ['['];
            for (let i = 0; i < this.tilesetList.length; i++) {
                const tileset = this.tilesetList[i];
                const line = (tileset === null) ? 'null' : JSON.stringify(tileset);
                const isLast = (i === this.tilesetList.length - 1);
                jsonLines.push(line + (isLast ? '' : ','));
            }
            jsonLines.push(']');
            const compactJson = jsonLines.join('\n');

            this._writeFileAtomic(this.fs, tilesetsPath, compactJson);
            this.saveTileset3DFile();
            console.log('Tilesets.json saved successfully');
        } catch (error) {
            console.error('Error saving Tilesets.json:', error);
            alert(`${tt('Error saving tilesets:')} ${error.message}`);
        }
    }

    initializeCompactUI(container, tileset) {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        // Load the full tilesets list from file
        this.loadTilesets();

        // Set the current tileset
        this.currentTileset = tileset;

        // Debug: Log initialization details
        console.log('=== Initializing Compact Tileset UI ===');
        console.log('Tileset:', tileset.name, '(ID:', tileset.id + ')');
        console.log('Project path:', this.getProjectPath());
        console.log('fs available:', !!this.fs);
        console.log('path available:', !!this.path);

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                <!-- Header with tileset name and save button -->
                <div style="padding: 8px 12px; border-bottom: 1px solid var(--color-border); background-color: var(--color-bg-menubar); flex-shrink: 0;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="font-size: 11px; color: var(--color-text-muted);">${tt('Name:')}</label>
                        <input type="text" id="compact-tileset-name-input" value="${rrEscapeHtml(tileset.name)}"
                               style="flex: 1; max-width: 250px; padding: 4px 8px; background-color: var(--color-bg-input-alt); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; font-size: 11px;"
                               placeholder="${tt('Tileset name')}" />
                        <button id="compact-save-tileset-btn" class="tool-button" style="font-size: 11px; padding: 4px 12px;">${tt('Save')}</button>
                    </div>
                </div>

                <!-- Main two-column layout -->
                <div style="display: flex; flex: 1; overflow: hidden;">
                    <!-- Left sidebar: Layer list (top) and flag editor (bottom) -->
                    <div style="width: 260px; border-right: 1px solid var(--color-border); display: flex; flex-direction: column; background-color: var(--color-bg-list-item);">
                        <!-- Top: Layer list. Sized to its eleven rows rather
                             than sharing the column half-and-half with Flags:
                             an equal split left the list scrolling while the
                             panel below it had room to spare. -->
                        <div style="flex: 0 0 auto; display: flex; flex-direction: column; border-bottom: 1px solid var(--color-border); overflow: hidden;">
                            <div style="padding: 8px; border-bottom: 1px solid var(--color-border); background-color: var(--color-bg-panel);">
                                <h3 style="margin: 0; font-size: 11px; font-weight: 600; color: var(--color-text);">${tt('Tileset Layers')}</h3>
                            </div>
                            <div style="flex: 0 0 auto; padding: 6px 8px;">
                                <div style="margin-bottom: 6px;">
                                    <h4 style="margin: 0 0 4px 0; font-size: 9px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${tt('Autotiles (A)')}</h4>
                                    ${this.createCompactLayerItem('A1', 0)}
                                    ${this.createCompactLayerItem('A2', 1)}
                                    ${this.createCompactLayerItem('A3', 2)}
                                    ${this.createCompactLayerItem('A4', 3)}
                                    ${this.createCompactLayerItem('A5', 4)}
                                </div>
                                <div>
                                    <h4 style="margin: 0 0 4px 0; font-size: 9px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">${tt('Normal (B-G)')}</h4>
                                    ${this.createCompactLayerItem('B', 5)}
                                    ${this.createCompactLayerItem('C', 6)}
                                    ${this.createCompactLayerItem('D', 7)}
                                    ${this.createCompactLayerItem('E', 8)}
                                    ${this.createCompactLayerItem('F', 9)}
                                    ${this.createCompactLayerItem('G', 10)}
                                </div>
                            </div>
                        </div>

                        <!-- Bottom: Flag editor -->
                        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                            <div style="padding: 8px; border-bottom: 1px solid var(--color-border); background-color: var(--color-bg-panel);">
                                <h4 style="margin: 0; font-size: 11px; font-weight: 600; color: var(--color-text);">${tt('Flags')}</h4>
                            </div>
                            <div style="flex: 1; overflow-y: auto; padding: 8px;">
                                <!-- Flag buttons as single column list -->
                                <button class="compact-flag-btn" id="flag-passability" data-mode="passability"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ${tt('Passability (O/X/★)')}
                                </button>
                                <button class="compact-flag-btn" id="flag-4dir" data-mode="4dir"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ↕↔ - ${tt('Passage (4 Dir)')}
                                </button>
                                <button class="compact-flag-btn" id="flag-ladder" data-mode="ladder"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ${tt('Ladder')}
                                </button>
                                <button class="compact-flag-btn" id="flag-bush" data-mode="bush"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ${tt('Bush')}
                                </button>
                                <button class="compact-flag-btn" id="flag-counter" data-mode="counter"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ${tt('Counter')}
                                </button>
                                <button class="compact-flag-btn" id="flag-damage" data-mode="damage"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ⚠ - ${tt('Damage Floor')}
                                </button>
                                <button class="compact-flag-btn" id="flag-terrain" data-mode="terrain"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ${tt('Terrain Tag (0-7)')}
                                </button>
                                <button class="compact-flag-btn" id="flag-tile3d" data-mode="tile3d"
                                        style="width: 100%; margin-bottom: 6px; font-size: 12px; padding: 10px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 6px; cursor: pointer; text-align: left;">
                                    ▁▲ - ${tt('3D Shape')}
                                </button>

                                <p style="font-size: 8px; color: var(--color-text-dim); margin: 8px 0 0 0; line-height: 1.3;">
                                    ${tt('Select flag, click layer, then click tiles')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Tabs + Preview -->
                    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background-color: var(--color-bg-base);">
                        <!-- Tab buttons -->
                        <div style="padding: 8px; border-bottom: 1px solid var(--color-border); background-color: var(--color-bg-list-item-alt); display: flex; gap: 6px;">
                            <button class="compact-layer-tab" data-tab="A" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-hover); border: 1px solid var(--color-accent-bright); color: var(--color-text-strong); border-radius: 3px; cursor: pointer; font-weight: 600;">${tt('A (Autotiles)')}</button>
                            <button class="compact-layer-tab" data-tab="B" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; cursor: pointer;">B</button>
                            <button class="compact-layer-tab" data-tab="C" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; cursor: pointer;">C</button>
                            <button class="compact-layer-tab" data-tab="D" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; cursor: pointer;">D</button>
                            <button class="compact-layer-tab" data-tab="E" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; cursor: pointer;">E</button>
                            <button class="compact-layer-tab" data-tab="F" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; cursor: pointer;">F</button>
                            <button class="compact-layer-tab" data-tab="G" style="flex: 1; padding: 8px; font-size: 11px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border-input); color: var(--color-text); border-radius: 3px; cursor: pointer;">G</button>
                        </div>

                        <!-- Preview area with canvas -->
                        <div style="flex: 1; overflow: auto; padding: 16px; display: flex; align-items: flex-start; justify-content: center;">
                            <div id="compact-tileset-canvas-container" style="max-width: 100%;">
                                <p style="color: var(--color-text-muted); font-size: 10px;">${tt('Click a layer on the left to view')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wait for DOM to be ready, then initialize
        setTimeout(() => {
            // Set up event listeners for the compact UI
            this.setupCompactEventListeners();

            // Load layer list thumbnails
            this.loadLayerListThumbnails();

            // Set up layer list click/double-click handlers (only once)
            this.setupLayerListHandlers();

            // Load initial tab (A by default)
            this.switchTab('A');
        }, 0);
    }

    // Create a compact layer item for the left sidebar
    createCompactLayerItem(label, index) {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        const fileName = this.currentTileset.tilesetNames[index] || '';
        return `
            <div class="compact-layer-item" data-index="${index}"
                 style="margin-bottom: 3px; padding: 3px 5px; background-color: var(--color-bg-panel); border: 1px solid var(--color-border); border-radius: 3px; cursor: pointer; transition: all 0.15s;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div class="layer-thumb-mini" style="width: 22px; height: 22px; background: var(--color-bg-surface); border: 1px solid var(--color-border-input); display: flex; align-items: center; justify-content: center; font-size: 8px; color: var(--color-text-dim); overflow: hidden; flex-shrink: 0;">
                        ${fileName ? '' : '-'}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <span style="font-weight: 600; color: var(--color-accent-bright);">${label}</span>
                            <span style="color: ${fileName ? 'var(--color-text-muted)' : 'var(--color-text-dim)'}; font-weight: normal; font-size: 9px;"> - ${rrEscapeHtml(fileName || tt('(None)'))}</span>
                        </div>
                    </div>
                    <button class="rr-choose-tileset-image" data-index="${index}"
                        title="${rrEscapeHtml(tt('Choose Image'))}"
                        style="flex-shrink: 0; padding: 1px 7px; font-size: 12px; line-height: 15px; background: var(--color-accent-tint-15); color: var(--color-accent-bright); border: 1px solid var(--color-accent-border-strong); border-radius: 3px; cursor: pointer;">+</button>
                </div>
            </div>
        `;
    }

    // Load thumbnails for layer items in left sidebar
    loadLayerListThumbnails() {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        document.querySelectorAll('.compact-layer-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const fileName = this.currentTileset.tilesetNames[index];

            // Update the filename text
            const fileNameSpan = item.querySelector('span:last-child');
            if (fileNameSpan) {
                fileNameSpan.textContent = ` - ${fileName || tt('(None)')}`;
                fileNameSpan.style.color = fileName ? 'var(--color-text-muted)' : 'var(--color-text-dim)';
            }

            // Update thumbnail
            const thumbContainer = item.querySelector('.layer-thumb-mini');
            if (fileName && this.path && this.getProjectPath()) {
                const fileNameWithExt = fileName.endsWith('.png') ? fileName : fileName + '.png';
                const imagePath = this.path.join(this.getProjectPath(), 'img', 'tilesets', fileNameWithExt);

                if (this.fs && this.fs.existsSync(imagePath)) {
                    const img = document.createElement('img');
                    img.src = this.assetUrl(imagePath);
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated;';
                    thumbContainer.innerHTML = '';
                    thumbContainer.appendChild(img);
                }
            } else {
                thumbContainer.innerHTML = '-';
            }
        });
    }

    // Set up event handlers for layer list items (call once during initialization)
    setupLayerListHandlers() {
        // The "+" on an unassigned row opens the picker for that slot directly.
        // It sits inside the row, so the click has to stop before the row's own
        // select/double-click handling sees it.
        document.querySelectorAll('.rr-choose-tileset-image').forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                event.preventDefault();
                const index = parseInt(button.dataset.index, 10);
                if (Number.isNaN(index)) return;
                this.selectedImageIndex = index;
                this.selectImageFileForLayer(index);
            });
            button.addEventListener('dblclick', event => event.stopPropagation());
        });

        document.querySelectorAll('.compact-layer-item').forEach(item => {
            const index = parseInt(item.dataset.index);

            // Set up click handler
            item.addEventListener('click', () => {
                const fileName = this.currentTileset.tilesetNames[index];

                // Update tab button to show correct tab (without full switchTab which highlights all layers in tab)
                const appropriateTab = this.getTabForLayerIndex(index);

                // Update tab button styles only
                document.querySelectorAll('.compact-layer-tab').forEach(btn => {
                    if (btn.dataset.tab === appropriateTab) {
                        btn.style.backgroundColor = 'var(--color-bg-hover)';
                        btn.style.borderColor = 'var(--color-accent-bright)';
                        btn.style.fontWeight = '600';
                    } else {
                        btn.style.backgroundColor = 'var(--color-bg-panel)';
                        btn.style.borderColor = 'var(--color-border-input)';
                        btn.style.fontWeight = 'normal';
                    }
                });

                // Highlight only this specific layer
                document.querySelectorAll('.compact-layer-item').forEach(i => {
                    i.style.backgroundColor = 'var(--color-bg-panel)';
                    i.style.borderColor = 'var(--color-border)';
                });
                item.style.backgroundColor = 'var(--color-bg-hover)';
                item.style.borderColor = 'var(--color-accent-bright)';

                this.selectedImageIndex = index;

                if (fileName) {
                    this.renderCompactTilesetCanvas(fileName, index);
                } else {
                    const tt = text => window.I18n ? window.I18n.tText(text) : text;
                    const container = document.getElementById('compact-tileset-canvas-container');
                    container.innerHTML = `<p style="color: var(--color-text-muted); font-size: 10px; text-align: center;">${tt('No image assigned to this layer')}</p>`;
                }
            });

            // Set up double-click handler for selecting new image
            item.addEventListener('dblclick', () => {
                this.selectImageFileForLayer(index);
            });
        });
    }

    // Open custom image picker modal for selecting a tileset image
    selectImageFileForLayer(index) {
        const layerNames = RRTilesetSheets.SHEET_KEYS;
        const layerName = layerNames[index];

        // Show custom image picker modal
        this.showTilesetImagePicker(index, layerName);
    }

    // Show custom tileset image picker modal with file list and preview
    showTilesetImagePicker(layerIndex, layerName) {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        const t = key => (window.I18n ? window.I18n.t(key) : key);

        const overlay = document.createElement('div');
        overlay.className = 'rr-modal-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'rr-modal';
        dialog.style.cssText = 'width: min(92vw, 1100px); height: min(88vh, 780px); display: flex; flex-direction: column;';

        const header = document.createElement('div');
        header.className = 'rr-modal-header';
        const title = document.createElement('div');
        title.className = 'rr-modal-title';
        title.textContent = `${tt('Select Tileset for')} ${layerName}`;
        const closeButton = document.createElement('button');
        closeButton.className = 'rr-modal-close';
        closeButton.type = 'button';
        closeButton.textContent = '×';
        closeButton.setAttribute('aria-label', t('common.cancel'));
        header.appendChild(title);
        header.appendChild(closeButton);

        const body = document.createElement('div');
        body.className = 'rr-modal-body';
        // `.rr-modal-body` is a padded, scrolling, gapped *column*. This one is
        // a flush two-pane row, so the direction and gap have to be overridden
        // explicitly: leaving the column direction made the list pane size to
        // its content height instead of the dialog's, so the browser's
        // `height: 100%` never resolved, nothing overflowed, and neither the
        // list nor the section rail could scroll.
        body.style.cssText = 'flex: 1; min-height: 0; display: flex; flex-direction: row; gap: 0; padding: 0; overflow: hidden;';

        // A column: a pinned "(None)" row above the searchable browser. The
        // browser sizes itself with height:100%, which cannot share a column
        // with anything else, so it is given an explicit flex basis and its own
        // height rule is cleared below.
        const listPane = document.createElement('div');
        listPane.style.cssText = 'width: 300px; flex-shrink: 0; border-right: 1px solid var(--color-border); display: flex; flex-direction: column; min-height: 0;';

        // A pinned "(None)" row, above the browser and outside it, so clearing a
        // slot stays reachable no matter what the search box is filtering to.
        const noneRow = document.createElement('div');
        noneRow.className = 'rr-picker-file-item rr-tileset-none-option';
        noneRow.tabIndex = 0;
        noneRow.setAttribute('role', 'option');
        noneRow.textContent = t('common.none');
        noneRow.style.cssText = 'flex: 0 0 auto; padding: 8px 10px; margin: 8px 8px 0 8px; cursor: pointer; border: 1px dashed var(--color-border-input); border-radius: 3px; font-size: 12px; color: var(--color-text-muted); font-style: italic; text-align: center;';

        const previewPane = document.createElement('div');
        previewPane.style.cssText = 'flex: 1; min-width: 0; background: var(--color-bg-deep); display: flex; align-items: center; justify-content: center; overflow: auto; padding: 16px;';
        const previewEmpty = () => {
            previewPane.innerHTML = '';
            const hint = document.createElement('p');
            hint.style.cssText = 'color: var(--color-text-dim); font-size: 13px;';
            hint.textContent = tt('Select a tileset to preview');
            previewPane.appendChild(hint);
        };
        previewEmpty();

        body.appendChild(listPane);
        body.appendChild(previewPane);

        const footer = document.createElement('div');
        footer.className = 'rr-modal-footer';
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'tool-button';
        cancelButton.textContent = t('common.cancel');
        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'tool-button';
        selectButton.textContent = tt('Select This Tileset');
        selectButton.disabled = true;
        selectButton.style.opacity = '0.5';
        footer.appendChild(cancelButton);
        footer.appendChild(selectButton);

        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);

        // null means nothing picked yet; '' is a real choice meaning clear the
        // slot, so the two cannot share a sentinel.
        let chosen = null;
        const markChosen = () => {
            selectButton.disabled = false;
            selectButton.style.opacity = '';
        };
        const close = () => {
            document.removeEventListener('keydown', onKeyDown);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        const confirm = () => {
            if (chosen === null) return;
            this.assignTilesetToLayer(layerIndex, chosen, layerName);
            close();
        };
        function onKeyDown(event) {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
        }

        listPane.appendChild(noneRow);

        const selectNone = () => {
            chosen = '';
            markChosen();
            noneRow.style.backgroundColor = 'var(--color-accent-tint-15)';
            noneRow.style.color = 'var(--color-accent-bright)';
            noneRow.style.borderColor = 'var(--color-accent-border-strong)';
            noneRow.style.borderStyle = 'solid';
            previewPane.innerHTML = '';
            const cleared = document.createElement('p');
            cleared.style.cssText = 'color: var(--color-text-dim); font-size: 13px;';
            cleared.textContent = t('common.none');
            previewPane.appendChild(cleared);
        };
        noneRow.addEventListener('click', selectNone);
        noneRow.addEventListener('dblclick', () => { selectNone(); confirm(); });
        noneRow.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            selectNone();
        });

        const tilesetsDir = this.path.join(this.getProjectPath(), 'img', 'tilesets');
        const files = this.fs.existsSync(tilesetsDir)
            ? RRAssetFiles.listUnique(tilesetsDir, ['.png'])
            : null;

        if (!files) {
            listPane.innerHTML = `<p style="color: var(--color-text-muted); padding: 16px; font-size: 12px;">${tt('Tilesets directory not found')}</p>`;
        } else {
            const byName = new Map(files.map(file => [file.name, file.absolutePath]));

            const showPreview = name => {
                const absolutePath = byName.get(name);
                previewPane.innerHTML = '';
                if (!absolutePath) { previewEmpty(); return; }
                const image = document.createElement('img');
                image.src = this.assetUrl(absolutePath);
                image.style.cssText = 'max-width: 100%; max-height: 100%; image-rendering: pixelated; display: block;';
                image.addEventListener('dblclick', confirm);
                previewPane.appendChild(image);
            };

            const browser = RRPickerIndex.createBrowser({
                files: files.map(file => file.name),
                selectedName: this.currentTileset?.tilesetNames?.[layerIndex] || '',
                searchPlaceholder: tt('Search files...'),
                emptyText: tt('No tileset images found in img/tilesets'),
                onSelect: name => {
                    chosen = name;
                    markChosen();
                    noneRow.style.backgroundColor = '';
                    noneRow.style.color = 'var(--color-text-muted)';
                    noneRow.style.borderColor = 'var(--color-border-input)';
                    noneRow.style.borderStyle = 'dashed';
                    showPreview(name);
                }
            });
            // Clear the component's own height:100% before handing it a flex
            // basis, or the two rules fight and the inner list stops scrolling.
            browser.element.style.height = 'auto';
            browser.element.style.flex = '1 1 0';
            browser.element.style.minHeight = '0';
            listPane.appendChild(browser.element);

            // Double-clicking a row assigns straight away, as it did before.
            browser.list.addEventListener('dblclick', event => {
                const item = event.target.closest('.rr-picker-file-item');
                if (item && item.dataset.fileName) {
                    chosen = item.dataset.fileName;
                    confirm();
                }
            });

            const current = this.currentTileset?.tilesetNames?.[layerIndex] || '';
            if (current && byName.has(current)) {
                chosen = current;
                markChosen();
                showPreview(current);
                browser.scrollTo(current);
            }
        }

        closeButton.addEventListener('click', close);
        cancelButton.addEventListener('click', close);
        selectButton.addEventListener('click', confirm);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) close();
        });
        document.addEventListener('keydown', onKeyDown);

        document.body.appendChild(overlay);
    }

    // Browse for external tileset file (copies to project)
    assignTilesetToLayer(layerIndex, baseName, layerName) {
        // Clear cache for old layer first (before overwriting)
        const oldFileName = this.currentTileset.tilesetNames[layerIndex];
        if (oldFileName) {
            const oldCacheKey = `${layerIndex}_${oldFileName.endsWith('.png') ? oldFileName : oldFileName + '.png'}`;
            this.imageCache.delete(oldCacheKey);
        }

        // Update tileset data. Slots past the end of a legacy nine-entry
        // array are filled rather than assigned directly, so no holes are
        // left behind for JSON.stringify to turn into nulls.
        RRTilesetSheets.setNameAt(this.currentTileset.tilesetNames, layerIndex, baseName);

        // Clear cache for new layer as well
        const newCacheKey = `${layerIndex}_${baseName}.png`;
        this.imageCache.delete(newCacheKey);

        // Switch to the tab that contains this layer
        const appropriateTab = this.getTabForLayerIndex(layerIndex);
        this.switchTab(appropriateTab);

        // Refresh UI - reload thumbnails
        this.loadLayerListThumbnails();

        const shown = baseName || (window.I18n ? window.I18n.t('common.none') : '(None)');
        console.log(`Tileset ${shown} assigned to ${layerName} (index ${layerIndex})`);
        this.updateStatus(`${layerName}: ${shown}`);
    }

    // Switch to a different layer tab (shows specific layers in preview)
    switchTab(tab) {
        this.currentTab = tab;
        this.currentCanvas = null; // Clear current canvas when switching tabs
        console.log('Switching to tab:', tab);

        // Update tab button styles
        document.querySelectorAll('.compact-layer-tab').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.style.backgroundColor = 'var(--color-bg-hover)';
                btn.style.borderColor = 'var(--color-accent-bright)';
                btn.style.fontWeight = '600';
            } else {
                btn.style.backgroundColor = 'var(--color-bg-panel)';
                btn.style.borderColor = 'var(--color-border-input)';
                btn.style.fontWeight = 'normal';
            }
        });

        // Update layer list highlighting to match the tab
        const layerIndices = this.getLayerIndicesForTab(tab);
        document.querySelectorAll('.compact-layer-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            if (layerIndices.includes(index)) {
                // Highlight layers in this tab
                item.style.backgroundColor = 'var(--color-bg-hover)';
                item.style.borderColor = 'var(--color-accent-bright)';
            } else {
                // Unhighlight other layers
                item.style.backgroundColor = 'var(--color-bg-panel)';
                item.style.borderColor = 'var(--color-border)';
            }
        });

        // Render the layers for this tab in the preview canvas
        this.renderTabPreview(tab);
    }

    // Render preview for a specific tab (shows all layers in that tab stacked)
    renderTabPreview(tab) {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        const container = document.getElementById('compact-tileset-canvas-container');
        const layerIndices = this.getLayerIndicesForTab(tab);

        // Both render paths below rebuild these; clearing here keeps a canvas
        // from a previously viewed tab from being repainted after it is gone.
        this.currentCanvas = null;
        this.tabCanvases = [];

        container.innerHTML = `<p style="color: var(--color-text-muted); font-size: 10px;">${tt('Loading layers...')}</p>`;

        // Collect images for this tab
        const images = [];
        for (const index of layerIndices) {
            const fileName = this.currentTileset.tilesetNames[index];
            if (fileName && this.path && this.getProjectPath()) {
                const fileNameWithExt = fileName.endsWith('.png') ? fileName : fileName + '.png';
                const imagePath = this.path.join(this.getProjectPath(), 'img', 'tilesets', fileNameWithExt);
                if (this.fs && this.fs.existsSync(imagePath)) {
                    images.push({ index, fileName: fileNameWithExt, imagePath });
                }
            }
        }

        if (images.length === 0) {
            // An unassigned tab used to be dead space, leaving double-clicking a
            // row in the left column as the only way in. Offer the same picker
            // here. B-G are single-slot tabs so they get one button; the A tab
            // covers A1-A5, so each sublayer gets its own rather than making the
            // button guess which one was meant.
            const perSlot = layerIndices.length > 1;
            const buttons = layerIndices.map(index => {
                const key = RRTilesetSheets.keyFromIndex(index) || '';
                const label = perSlot ? `${key} — ${tt('Choose Image')}` : tt('Choose Image');
                return `<button class="rr-choose-tileset-image tool-button" data-index="${index}"
                            style="font-size: 11px; padding: 6px 14px;">${rrEscapeHtml(label)}</button>`;
            }).join('');

            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px 12px;">
                    <p style="color: var(--color-text-muted); font-size: 10px; text-align: center; margin: 0;">${tt('No images assigned to this tab')}</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">${buttons}</div>
                </div>`;

            container.querySelectorAll('.rr-choose-tileset-image').forEach(button => {
                button.addEventListener('click', () => {
                    const index = parseInt(button.dataset.index, 10);
                    if (Number.isNaN(index)) return;
                    this.selectedImageIndex = index;
                    this.selectImageFileForLayer(index);
                });
            });
            return;
        }

        // For single-layer tabs (B, C, D, E), render with proper canvas handling
        if (images.length === 1) {
            this.renderCompactTilesetCanvas(images[0].fileName, images[0].index);
            return;
        }

        // For multi-layer tabs (A), create stacked canvases with proper rendering
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

        let loadedCount = 0;
        const totalImages = images.length;

        images.forEach(({ index, fileName, imagePath }) => {
            const img = new Image();
            img.onload = () => {
                const isSplitSheet = RRTilesetSheets.isNormalSheetIndex(index);

                // Create canvas for this layer
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;

                if (isSplitSheet) {
                    // B-E layers: Split in half vertically and stack
                    const halfWidth = img.width / 2;
                    const scale = 1;
                    canvas.width = halfWidth * scale;
                    canvas.height = img.height * 2 * scale;
                    canvas.style.border = '1px solid var(--color-border-input)';
                    canvas.style.imageRendering = 'pixelated';
                    canvas.style.display = 'block';

                    // Draw left half on top
                    ctx.drawImage(img, 0, 0, halfWidth, img.height, 0, 0, halfWidth * scale, img.height * scale);
                    // Draw right half on bottom
                    ctx.drawImage(img, halfWidth, 0, halfWidth, img.height, 0, img.height * scale, halfWidth * scale, img.height * scale);
                    // Draw grid
                    this.drawTilesetGrid(ctx, halfWidth, img.height * 2, scale);
                } else {
                    // A1-A5 layers
                    const layerNames = ['A1', 'A2', 'A3', 'A4', 'A5'];
                    const layerName = layerNames[index];

                    // Check if we have a cached base canvas
                    const cacheKey = `${index}_${fileName}`;
                    let baseCanvas = this.imageCache.get(cacheKey);

                    if (!baseCanvas) {
                        // For A1-A4 autotiles, show representative preview tiles only
                        if (index >= 0 && index <= 3) {
                            // A1-A4: Use autotile palette rendering
                            baseCanvas = document.createElement('canvas');
                            const baseCtx = baseCanvas.getContext('2d');
                            this.renderAutotilePalette(baseCtx, img, layerName);
                        } else {
                            // A5: Display as-is
                            const scale = 1;
                            baseCanvas = document.createElement('canvas');
                            baseCanvas.width = img.width * scale;
                            baseCanvas.height = img.height * scale;

                            const baseCtx = baseCanvas.getContext('2d');
                            baseCtx.imageSmoothingEnabled = false;
                            baseCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * scale, img.height * scale);
                            // Draw grid
                            this.drawTilesetGrid(baseCtx, img.width, img.height, scale);
                        }

                        // Cache the base canvas
                        this.imageCache.set(cacheKey, baseCanvas);
                    }

                    // Set canvas size and draw base
                    canvas.width = baseCanvas.width;
                    canvas.height = baseCanvas.height;
                    canvas.style.border = '1px solid var(--color-border-input)';
                    canvas.style.imageRendering = 'pixelated';
                    canvas.style.display = 'block';

                    ctx.drawImage(baseCanvas, 0, 0);
                }

                // Draw passage overlay
                this.drawCompactPassageOverlay(ctx, canvas.width, canvas.height, index, isSplitSheet);

                // Add click handler
                canvas.addEventListener('click', (e) => {
                    this.handleCompactCanvasClick(e, canvas, index, fileName, isSplitSheet);
                });

                this.tabCanvases.push({ canvas, imageIndex: index, isSplitSheet });
                wrapper.appendChild(canvas);

                loadedCount++;
                if (loadedCount === totalImages) {
                    console.log(`Tab ${tab}: Loaded ${loadedCount} layers`);
                    container.innerHTML = '';
                    container.appendChild(wrapper);
                }
            };

            img.onerror = () => {
                console.error(`Failed to load: ${fileName}`);
                loadedCount++;
                if (loadedCount === totalImages) {
                    container.innerHTML = '';
                    container.appendChild(wrapper);
                }
            };

            img.src = this.assetUrl(imagePath);
        });
    }

    // Get layer indices for a given tab
    getLayerIndicesForTab(tab) {
        switch(tab) {
            case 'A': return [0, 1, 2, 3, 4]; // A1-A5
            case 'B': return [5];               // B
            case 'C': return [6];               // C
            case 'D': return [7];               // D
            case 'E': return [8];               // E
            case 'F': return [9];               // F
            case 'G': return [10];              // G
            default: return [0, 1, 2, 3, 4];
        }
    }

    // Get tab for a given layer index (reverse mapping)
    getTabForLayerIndex(layerIndex) {
        if (layerIndex >= 0 && layerIndex <= 4) return 'A'; // A1-A5
        if (layerIndex === 5) return 'B';
        if (layerIndex === 6) return 'C';
        if (layerIndex === 7) return 'D';
        if (layerIndex === 8) return 'E';
        if (layerIndex === 9) return 'F';
        if (layerIndex === 10) return 'G';
        return 'A'; // Default
    }

    // Create a layer list item for the left sidebar
    setupCompactEventListeners() {
        // Tileset name input
        const nameInput = document.getElementById('compact-tileset-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                this.currentTileset.name = e.target.value;
            });
        }

        // Save button
        const saveBtn = document.getElementById('compact-save-tileset-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveTileset();
            });
        }

        // Tab buttons
        document.querySelectorAll('.compact-layer-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Flag buttons
        document.querySelectorAll('.compact-flag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;

                console.log('Flag button clicked:', mode);

                // Remove active state from all flag buttons
                document.querySelectorAll('.compact-flag-btn').forEach(b => {
                    b.style.backgroundColor = 'var(--color-bg-panel)';
                    b.style.borderColor = 'var(--color-border-input)';
                });

                // Highlight selected button
                btn.style.backgroundColor = 'var(--color-bg-hover)';
                btn.style.borderColor = 'var(--color-accent-bright)';

                // Set edit mode. Entering or leaving 3D classification swaps
                // what the overlay shows, not just what a click does, so the
                // canvases already on screen have to be repainted.
                const was3D = this.currentEditMode === 'tile3d';
                this.currentEditMode = mode;
                if (was3D !== (mode === 'tile3d')) this.refreshOverlays();
                console.log(`Edit mode: ${mode}`);
            });
        });
    }

    // Load thumbnails for all layer slots
    renderCompactTilesetCanvas(fileName, imageIndex) {
        const tt = text => window.I18n ? window.I18n.tText(text) : text;
        const container = document.getElementById('compact-tileset-canvas-container');
        if (!container) return;

        container.innerHTML = `<p style="color: var(--color-text-muted); font-size: 11px;">${tt('Loading tileset image...')}</p>`;

        // Add .png extension if not already present
        const fileNameWithExt = fileName.endsWith('.png') ? fileName : fileName + '.png';
        const imagePath = this.path.join(this.getProjectPath(), 'img', 'tilesets', fileNameWithExt);

        // Check if file exists
        if (!this.fs.existsSync(imagePath)) {
            container.innerHTML = `<p style="color: #f44; font-size: 11px;">${tt('Image file not found:')} ${rrEscapeHtml(fileName)}</p>`;
            return;
        }

        const img = new Image();
        img.onload = () => {
            // Determine if this is a B-E layer (indices 5-8)
            const isSplitSheet = RRTilesetSheets.isNormalSheetIndex(imageIndex);

            // Check if we have a cached base image
            const cacheKey = `${imageIndex}_${fileName}`;
            let baseCanvas = this.imageCache.get(cacheKey);

            if (!baseCanvas) {
                // Create and cache the base image
                if (isSplitSheet) {
                    // B-E layers: Split in half vertically and stack
                    const halfWidth = img.width / 2;
                    const scale = 1;

                    baseCanvas = document.createElement('canvas');
                    baseCanvas.width = halfWidth * scale;
                    baseCanvas.height = img.height * 2 * scale;

                    const baseCtx = baseCanvas.getContext('2d');
                    baseCtx.imageSmoothingEnabled = false;

                    // Draw left half on top
                    baseCtx.drawImage(img, 0, 0, halfWidth, img.height, 0, 0, halfWidth * scale, img.height * scale);
                    // Draw right half on bottom
                    baseCtx.drawImage(img, halfWidth, 0, halfWidth, img.height, 0, img.height * scale, halfWidth * scale, img.height * scale);
                    // Draw grid
                    this.drawTilesetGrid(baseCtx, halfWidth, img.height * 2, scale);
                } else {
                    // A1-A5 layers
                    const layerNames = ['A1', 'A2', 'A3', 'A4', 'A5'];
                    const layerName = layerNames[imageIndex];

                    // For A1-A4 autotiles, show representative preview tiles only
                    if (imageIndex >= 0 && imageIndex <= 3) {
                        // A1-A4: Use autotile palette rendering
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        this.renderAutotilePalette(tempCtx, img, layerName);

                        baseCanvas = tempCanvas;
                    } else {
                        // A5: Display as-is
                        const scale = 1;

                        baseCanvas = document.createElement('canvas');
                        baseCanvas.width = img.width * scale;
                        baseCanvas.height = img.height * scale;

                        const baseCtx = baseCanvas.getContext('2d');
                        baseCtx.imageSmoothingEnabled = false;

                        // Draw the tileset image
                        baseCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * scale, img.height * scale);
                        // Draw grid
                        this.drawTilesetGrid(baseCtx, img.width, img.height, scale);
                    }
                }

                // Cache the base canvas
                this.imageCache.set(cacheKey, baseCanvas);
            }

            // Create display canvas by copying base
            const canvas = document.createElement('canvas');
            canvas.width = baseCanvas.width;
            canvas.height = baseCanvas.height;
            canvas.style.border = '1px solid var(--color-border-input)';
            canvas.style.cursor = 'crosshair';
            canvas.style.imageRendering = 'pixelated';

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            // Copy base image
            ctx.drawImage(baseCanvas, 0, 0);

            // Draw the passage flags overlay
            this.drawCompactPassageOverlay(ctx, canvas.width, canvas.height, imageIndex, isSplitSheet);

            // Draw selection highlight if a tile is selected
            if (this.selectedTile) {
                this.drawSelectionHighlight(ctx, this.selectedTile.x, this.selectedTile.y, isSplitSheet);
            }

            // Set up click handler
            canvas.addEventListener('click', (e) => {
                this.handleCompactCanvasClick(e, canvas, imageIndex, fileName, isSplitSheet);
            });

            // Store current canvas info for updates
            this.currentCanvas = { canvas, ctx, imageIndex, isSplitSheet, baseCanvas };

            // Replace container content with canvas
            container.innerHTML = '';
            container.appendChild(canvas);
        };

        img.onerror = () => {
            container.innerHTML = `<p style="color: #f44; font-size: 11px;">${tt('Failed to load image:')} ${rrEscapeHtml(fileName)}</p>`;
        };

        img.src = this.assetUrl(imagePath);
    }

    // Redraw just the overlay without recreating the canvas (prevents flicker)
    redrawOverlay() {
        if (!this.currentCanvas) {
            console.warn('No current canvas to redraw');
            return;
        }

        const { canvas, ctx, imageIndex, isSplitSheet, baseCanvas } = this.currentCanvas;

        // Clear and redraw from base
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseCanvas, 0, 0);

        // Redraw passage overlay
        this.drawCompactPassageOverlay(ctx, canvas.width, canvas.height, imageIndex, isSplitSheet);

        // Redraw selection highlight if a tile is selected
        if (this.selectedTile) {
            this.drawSelectionHighlight(ctx, this.selectedTile.x, this.selectedTile.y, isSplitSheet);
        }
    }

    /** Repaint every canvas currently on screen, whichever view is showing. */
    refreshOverlays() {
        if (this.currentCanvas) {
            this.redrawOverlay();
            return;
        }
        for (const entry of this.tabCanvases || []) {
            this.redrawCanvasOverlay(entry.canvas, entry.imageIndex, entry.isSplitSheet);
        }
    }

    // Redraw overlay on a specific canvas (for tab view with multiple canvases)
    redrawCanvasOverlay(canvas, imageIndex, isSplitSheet) {
        const ctx = canvas.getContext('2d');

        // Get the cached base canvas for this layer
        const fileName = this.currentTileset.tilesetNames[imageIndex];
        // Normalize fileName to include .png extension (must match how it was cached)
        const fileNameWithExt = fileName && (fileName.endsWith('.png') ? fileName : fileName + '.png');
        const cacheKey = `${imageIndex}_${fileNameWithExt}`;

        console.log(`Attempting to redraw overlay for imageIndex ${imageIndex}, fileName: ${fileName}, cacheKey: ${cacheKey}`);

        const baseCanvas = this.imageCache.get(cacheKey);

        if (!baseCanvas) {
            console.warn(`No cached base canvas found for key: ${cacheKey}`);
            console.warn('Available cache keys:', Array.from(this.imageCache.keys()));
            return;
        }

        console.log('Found base canvas, redrawing overlay');

        // Clear and redraw from base
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseCanvas, 0, 0);

        // Redraw passage overlay
        this.drawCompactPassageOverlay(ctx, canvas.width, canvas.height, imageIndex, isSplitSheet);

        // Redraw selection highlight if a tile is selected
        if (this.selectedTile) {
            this.drawSelectionHighlight(ctx, this.selectedTile.x, this.selectedTile.y, isSplitSheet);
        }
    }

    // Draw 48x48 grid over tileset (like map editor)
    drawTilesetGrid(ctx, width, height, scale) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        const tileSize = 48 * scale; // RPG Maker uses 48px tiles

        // Draw vertical lines
        for (let x = 0; x <= width * scale; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height * scale);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= height * scale; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width * scale, y);
            ctx.stroke();
        }
    }

    // Render autotile palette showing representative tiles only (one per autotile kind)
    renderAutotilePalette(ctx, img, layer) {
        const canvas = ctx.canvas;
        const tileSize = 48; // Each preview tile is 48x48

        // Autotile palette layout:
        // A1: 16 kinds (8 cols × 2 rows - water types + waterfalls spread horizontally)
        // A2: 32 kinds (8 cols × 4 rows - ground autotiles)
        // A3: 32 kinds (8 cols × 4 rows - building/wall autotiles)
        // A4: 48 kinds (8 cols × 6 rows - wall and roof autotiles)

        let gridCols, gridRows;

        switch(layer) {
            case 'A1':
                gridCols = 8;
                gridRows = 2;
                break;
            case 'A2':
                gridCols = 8;
                gridRows = 4;
                break;
            case 'A3':
                gridCols = 8;
                gridRows = 4;
                break;
            case 'A4':
                gridCols = 8;
                gridRows = 6;
                break;
        }

        canvas.width = gridCols * tileSize;
        canvas.height = gridRows * tileSize;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        // Draw each autotile preview
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const destX = col * tileSize;
                const destY = row * tileSize;
                const kindIndex = row * gridCols + col;

                // Draw properly assembled autotile preview
                this.drawAutotilePreview(ctx, img, layer, kindIndex, destX, destY, tileSize);
            }
        }

        // Draw grid
        this.drawTilesetGrid(ctx, canvas.width, canvas.height, 1);
    }

    drawAutotilePreview(ctx, img, layer, kindIndex, destX, destY, tileSize) {
        // Each autotile "kind" is arranged in a 2x3 block (96px wide, 144px tall for A2-A4)
        // The top-left tile (48x48) is the preview tile used in the palette

        let srcX, srcY;

        if (layer === 'A1') {
            // A1: 8 cols × 2 rows layout
            const sourceRow = Math.floor(kindIndex / 4); // 0-3 (4 autotiles per source row)
            const blockInRow = kindIndex % 4; // Which of the 4 blocks (0,3,4,7)

            // Map to actual block positions: 0->block0, 1->block3, 2->block4, 3->block7
            const blockMap = [0, 3, 4, 7];
            const block = blockMap[blockInRow];

            srcX = block * tileSize * 2;  // Block position in pixels
            srcY = sourceRow * tileSize * 3;  // Source row in pixels
        } else if (layer === 'A2') {
            // A2: Ground autotiles (8 columns × 4 rows of 2x3 blocks)
            const col = kindIndex % 8;
            const row = Math.floor(kindIndex / 8);
            srcX = col * tileSize * 2;  // Each block is 2 tiles (96px) wide
            srcY = row * tileSize * 3;  // Each block is 3 tiles (144px) tall
        } else if (layer === 'A3') {
            // A3: Building/wall autotiles (8 columns × 4 rows of 2x2 blocks)
            const col = kindIndex % 8;
            const row = Math.floor(kindIndex / 8);
            srcX = col * tileSize * 2;  // Each block is 2 tiles (96px) wide
            srcY = row * tileSize * 2;  // Each block is 2 tiles (96px) tall for A3
        } else if (layer === 'A4') {
            // A4: Wall and roof autotiles (8 columns × 6 rows)
            const col = kindIndex % 8;
            const row = Math.floor(kindIndex / 8);
            srcX = col * tileSize * 2;  // Each block is 2 tiles (96px) wide

            // Calculate Y position: roofs are 3 tiles tall, walls are 2 tiles tall
            const pairIndex = Math.floor(row / 2);  // Which roof+wall pair (0, 1, or 2)
            const isWall = row % 2 === 1;
            srcY = pairIndex * tileSize * 5 + (isWall ? tileSize * 3 : 0);
        }

        // Extract just the top-left preview tile (48x48)
        ctx.drawImage(
            img,
            srcX, srcY,
            tileSize, tileSize,
            destX, destY,
            tileSize, tileSize
        );
    }

    // Get tile index in flags array for a given image and tile position
    // Based on RPG Maker MZ's tileset indexing system
    getTileIndexForImage(imageIndex, tileX, tileY, tilesPerRow) {
        // RPG Maker MZ tileset flag indices:
        // B-E tiles (imageIndex 5-8): Start at 0
        // A5 tiles (imageIndex 4): Start at 1536
        // A1 autotiles (imageIndex 0): Start at 2048
        // A2 autotiles (imageIndex 1): Start at 2816
        // A3 autotiles (imageIndex 2): Start at 4352
        // A4 autotiles (imageIndex 3): Start at 5888

        const tileOffset = tileY * tilesPerRow + tileX;

        switch(imageIndex) {
            // A1-A4 palettes show one cell per autotile KIND, and each kind
            // occupies 48 consecutive flag slots (one per shape). Indexing
            // by the raw cell offset landed every edit on a shape slot of
            // kind 0 — the runtime then read the untouched real slot, so
            // passability/ladder/terrain edits on autotiles never took
            // effect in game (and the editor overlay read back through the
            // same wrong slot, hiding it).
            case 0: // A1
                return 2048 + tileOffset * 48;
            case 1: // A2
                return 2816 + tileOffset * 48;
            case 2: // A3
                return 4352 + tileOffset * 48;
            case 3: // A4
                return 5888 + tileOffset * 48;
            case 4: // A5
                return 1536 + tileOffset;
            case 5: // B
                return 0 + tileOffset;
            case 6: // C
                return 256 + tileOffset; // B is 16x16 = 256 tiles
            case 7: // D
                return 512 + tileOffset;
            case 8: // E
                return 768 + tileOffset;
            // F and G occupy 1024-1535, the band MZ leaves unallocated between
            // E and A5. The 8192-entry flags array already covers it.
            case 9: // F
                return 1024 + tileOffset;
            case 10: // G
                return 1280 + tileOffset;
            default:
                return 0;
        }
    }

    // Draw passage overlay for compact UI
    /**
     * Draw a flag glyph with a dark outline behind it.
     *
     * The markers are painted straight onto the tileset art, so a light glyph
     * over light pixels (or a red X over red brickwork) disappeared entirely.
     * Stroking the same text underneath in near-black gives every marker an
     * edge regardless of what is behind it; `lineJoin: round` keeps the
     * corners of X and the star from spiking.
     */
    drawFlagGlyph(ctx, text, x, y, outlineWidth = 4) {
        const previous = {
            strokeStyle: ctx.strokeStyle,
            lineWidth: ctx.lineWidth,
            lineJoin: ctx.lineJoin
        };
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = outlineWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.strokeStyle = previous.strokeStyle;
        ctx.lineWidth = previous.lineWidth;
        ctx.lineJoin = previous.lineJoin;
    }

    /**
     * Filled dot with a dark rim.
     *
     * The markers sit directly on the tile art, so a soft drop shadow was not
     * enough separation against busy or same-hued pixels; each shape carries an
     * explicit edge instead.
     */
    drawFlagDot(ctx, x, y, radius, fill) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    /** Chevron drawn dark-and-wide first, then the colour on top. */
    drawFlagArrow(ctx, points, color) {
        const trace = () => {
            ctx.beginPath();
            ctx.moveTo(points[0], points[1]);
            ctx.lineTo(points[2], points[3]);
            ctx.lineTo(points[4], points[5]);
        };
        const previousCap = ctx.lineCap;
        const previousJoin = ctx.lineJoin;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        trace();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 5;
        ctx.stroke();
        trace();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.lineCap = previousCap;
        ctx.lineJoin = previousJoin;
    }

    /** Filled rectangle with a dark border. */
    drawFlagRect(ctx, x, y, w, h, fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    /**
     * Which tiles stand up in 3D.
     *
     * Drawn instead of the flag markers rather than alongside them: a tile
     * already carries up to seven flag glyphs, and classifying a building means
     * reading its shape in the art, which needs the sheet mostly uncovered.
     */
    drawTile3DOverlay(ctx, width, height, imageIndex) {
        const classes = this.tileset3DClasses();
        const store = this.tileset3DStore();
        if (!classes || !store || !this.currentTileset) return;

        const tilesetId = this.currentTileset.id;
        const tilesX = Math.floor(width / this.tileSize);
        const tilesY = Math.floor(height / this.tileSize);

        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tileIndex = this.getTileIndexForImage(imageIndex, x, y, tilesX);
                const value = classes.classOf(store, tilesetId, tileIndex);
                if (value === classes.AUTO) continue;

                const drawX = x * this.tileSize;
                const drawY = y * this.tileSize;
                const centerX = drawX + this.tileSize / 2;
                const centerY = drawY + this.tileSize / 2;
                const upright = value === classes.UPRIGHT;
                const scenery = value === classes.SCENERY;

                ctx.fillStyle = scenery
                    ? 'rgba(120, 230, 120, 0.20)'
                    : upright ? 'rgba(255, 170, 40, 0.22)' : 'rgba(70, 190, 255, 0.18)';
                ctx.fillRect(drawX, drawY, this.tileSize, this.tileSize);

                if (scenery) {
                    // A single standing tile: one chevron on its own base, in
                    // contrast to Upright's chevron on a full-width ground line.
                    this.drawFlagArrow(ctx, [
                        centerX - 7, centerY + 3,
                        centerX, centerY - 7,
                        centerX + 7, centerY + 3
                    ], 'rgba(150, 245, 150, 0.98)');
                    this.drawFlagRect(ctx, centerX - 7, drawY + this.tileSize - 13, 14, 4,
                        'rgba(150, 245, 150, 0.98)');
                } else if (upright) {
                    // A chevron rising from a ground line: this tile is part of
                    // something that stands where it is painted.
                    this.drawFlagArrow(ctx, [
                        centerX - 11, centerY + 5,
                        centerX, centerY - 9,
                        centerX + 11, centerY + 5
                    ], 'rgba(255, 196, 80, 0.98)');
                    this.drawFlagRect(ctx, drawX + 10, drawY + this.tileSize - 13, this.tileSize - 20, 4,
                        'rgba(255, 196, 80, 0.98)');
                } else {
                    this.drawFlagRect(ctx, drawX + 9, centerY - 2, this.tileSize - 18, 5,
                        'rgba(130, 220, 255, 0.98)');
                }
            }
        }
    }

    drawCompactPassageOverlay(ctx, width, height, imageIndex, isSplitSheet) {
        if (this.currentEditMode === 'tile3d') {
            this.drawTile3DOverlay(ctx, width, height, imageIndex);
            return;
        }

        const tilesX = Math.floor(width / this.tileSize);
        const tilesY = Math.floor(height / this.tileSize);

        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                // For B-E layers, flags are stored in 8-column split layout order
                // So we just use x,y directly (no remapping needed)
                const tileIndex = this.getTileIndexForImage(imageIndex, x, y, tilesX);
                const flag = this.currentTileset.flags[tileIndex] || 0;

                // Drawing coordinates (use actual canvas position x, y)
                const drawX = x * this.tileSize;
                const drawY = y * this.tileSize;
                const centerX = drawX + this.tileSize / 2;
                const centerY = drawY + this.tileSize / 2;

                const passageBits = flag & 0x0F; // Bits 0-3 for directions
                const aboveChar = flag & 0x10;   // Bit 4 for above characters

                // Draw O for fully passable tiles (bits 0-3 all clear, bit 4 also clear)
                if (passageBits === 0 && !aboveChar) {
                    ctx.fillStyle = 'rgba(120, 255, 120, 0.95)';
                    ctx.font = 'bold 28px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    this.drawFlagGlyph(ctx, 'O', centerX, centerY);
                }

                // Draw X for fully impassable tiles (all direction bits set: 0x0F)
                if (passageBits === 0x0F) {
                    ctx.fillStyle = 'rgba(255, 60, 60, 0.95)';
                    ctx.font = 'bold 32px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    this.drawFlagGlyph(ctx, 'X', centerX, centerY);
                }

                // Draw 4-dir passage indicators (arrows for passable, dots for blocked)
                // Don't show if we're displaying O, X, or ★
                const isO = passageBits === 0 && !aboveChar;
                const isX = passageBits === 0x0F;
                const isStar = aboveChar;

                if (!isO && !isX && !isStar) {
                    const margin = 8;
                    const arrowSize = 6;
                    const dotRadius = 3;

                    // Down: bit 0 (SET = blocked, CLEAR = passable)
                    if (flag & 0x01) {
                        // Blocked - show dot
                        this.drawFlagDot(ctx, centerX, drawY + this.tileSize - margin, dotRadius, 'rgba(255, 110, 110, 0.95)');
                    } else {
                        // Passable - show outward arrow
                        this.drawFlagArrow(ctx, [centerX - arrowSize, drawY + this.tileSize - margin - arrowSize, centerX, drawY + this.tileSize - margin, centerX + arrowSize, drawY + this.tileSize - margin - arrowSize], 'rgba(120, 255, 120, 0.95)');
                    }

                    // Left: bit 1
                    if (flag & 0x02) {
                        // Blocked - show dot
                        this.drawFlagDot(ctx, drawX + margin, centerY, dotRadius, 'rgba(255, 110, 110, 0.95)');
                    } else {
                        // Passable - show outward arrow
                        this.drawFlagArrow(ctx, [drawX + margin + arrowSize, centerY - arrowSize, drawX + margin, centerY, drawX + margin + arrowSize, centerY + arrowSize], 'rgba(120, 255, 120, 0.95)');
                    }

                    // Right: bit 2
                    if (flag & 0x04) {
                        // Blocked - show dot
                        this.drawFlagDot(ctx, drawX + this.tileSize - margin, centerY, dotRadius, 'rgba(255, 110, 110, 0.95)');
                    } else {
                        // Passable - show outward arrow
                        this.drawFlagArrow(ctx, [drawX + this.tileSize - margin - arrowSize, centerY - arrowSize, drawX + this.tileSize - margin, centerY, drawX + this.tileSize - margin - arrowSize, centerY + arrowSize], 'rgba(120, 255, 120, 0.95)');
                    }

                    // Up: bit 3
                    if (flag & 0x08) {
                        // Blocked - show dot
                        this.drawFlagDot(ctx, centerX, drawY + margin, dotRadius, 'rgba(255, 110, 110, 0.95)');
                    } else {
                        // Passable - show outward arrow
                        this.drawFlagArrow(ctx, [centerX - arrowSize, drawY + margin + arrowSize, centerX, drawY + margin, centerX + arrowSize, drawY + margin + arrowSize], 'rgba(120, 255, 120, 0.95)');
                    }
                }

                // Draw star for above characters (bit 4 set)
                if (flag & 0x10) {
                    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
                    ctx.font = `bold ${this.tileSize - 10}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    this.drawFlagGlyph(ctx, '★', centerX, centerY);
                }

                // Draw ladder icon (bit 5 set) - in top-left corner
                if (flag & 0x20) {
                    this.drawFlagRect(ctx, drawX + 4, drawY + 4, 8, 16, 'rgba(160, 210, 255, 0.95)');
                    // Rungs, drawn over the outlined stile
                    ctx.fillStyle = 'rgba(30, 30, 120, 0.95)';
                    ctx.fillRect(drawX + 3, drawY + 7, 10, 2);
                    ctx.fillRect(drawX + 3, drawY + 11, 10, 2);
                    ctx.fillRect(drawX + 3, drawY + 15, 10, 2);
                }

                // Draw bush icon (bit 6 set) - green circle in top-right corner
                if (flag & 0x40) {
                    this.drawFlagDot(ctx, drawX + this.tileSize - 8, drawY + 8, 6, 'rgba(60, 215, 60, 0.95)');
                    // Darker centre, inside the rim
                    ctx.fillStyle = 'rgba(15, 85, 15, 0.95)';
                    ctx.beginPath();
                    ctx.arc(drawX + this.tileSize - 8, drawY + 8, 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Draw counter icon (bit 7 set) - purple bar in bottom-left
                if (flag & 0x80) {
                    this.drawFlagRect(ctx, drawX + 4, drawY + this.tileSize - 8, 16, 4, 'rgba(210, 160, 255, 0.95)');
                }

                // Draw damage floor icon (bit 8 set) - warning symbol in bottom-right
                if (flag & 0x100) {
                    ctx.fillStyle = 'rgba(255, 100, 0, 0.95)';
                    ctx.font = `bold ${this.tileSize / 3}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    this.drawFlagGlyph(ctx, '⚠', drawX + this.tileSize - 12, drawY + this.tileSize - 12, 3);
                }

                // Draw terrain tag. Game_Map.terrainTag is `flags[tile] >> 12`
                // with no mask, so read it the same way — masking here would
                // show a plausible 0-15 for a flag the engine reads as garbage.
                const terrainTag = flag >>> 12;
                if (terrainTag > 0) {
                    ctx.font = `bold ${this.tileSize / 3}px Arial`;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'top';
                    // Draw black border
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 3;
                    ctx.strokeText(terrainTag.toString(), drawX + this.tileSize - 4, drawY + 2);
                    // Draw white fill
                    ctx.fillStyle = '#FFFFFF';
                    this.drawFlagGlyph(ctx, terrainTag.toString(), drawX + this.tileSize - 4, drawY + 2, 3);
                }
            }
        }
    }

    // Draw selection highlight overlay (like TilesetPaletteViewer)
    drawSelectionHighlight(ctx, tileX, tileY, isSplitSheet) {
        const scale = 1;
        const tileSize = 48 * scale;

        // Convert logical tile coordinates to canvas coordinates
        // For B-E layers, tiles in the right half (x >= 8) are drawn in the bottom half
        let canvasX = tileX;
        let canvasY = tileY;

        if (isSplitSheet && tileX >= 8) {
            // Right half of original image (x 8-15) displays in bottom half of canvas
            canvasX = tileX - 8;  // Map x 8-15 to canvas x 0-7
            canvasY = tileY + 16; // Offset down by image height (768px / 48px = 16 tiles)
        }

        // Draw selection rectangle
        ctx.strokeStyle = '#007acc';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            canvasX * tileSize,
            canvasY * tileSize,
            tileSize,
            tileSize
        );

        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 122, 204, 0.2)';
        ctx.fillRect(
            canvasX * tileSize,
            canvasY * tileSize,
            tileSize,
            tileSize
        );
    }

    // Handle canvas click for compact UI
    handleCompactCanvasClick(e, canvas, imageIndex, fileName, isSplitSheet) {
        if (!this.currentEditMode) {
            console.warn('No edit mode selected! Click a flag button first');
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.tileSize);
        const y = Math.floor((e.clientY - rect.top) / this.tileSize);

        const tilesX = Math.floor(canvas.width / this.tileSize);
        const tilesY = Math.floor(canvas.height / this.tileSize);

        // For B-E layers, flags are stored in 8-column split layout order
        // So we just use x,y directly (no remapping needed)
        const tileIndex = this.getTileIndexForImage(imageIndex, x, y, tilesX);

        const oldFlag = this.currentTileset.flags[tileIndex] || 0;
        let currentFlag = oldFlag;

        console.log(`Clicked canvas (${x}, ${y}) at index ${tileIndex}, current flag: ${oldFlag} (0x${oldFlag.toString(16)}), mode: ${this.currentEditMode}`);

        // Store selected tile for highlighting
        this.selectedTile = { x, y };

        // 3D classification is not a tileset flag — it lives in its own file —
        // so it is handled before the flag switch rather than inside it.
        if (this.currentEditMode === 'tile3d') {
            this.cycleTile3DClass(tileIndex);
            this.repaintClickedCanvas(canvas, imageIndex, isSplitSheet);
            return;
        }

        // Apply the selected edit mode
        switch (this.currentEditMode) {
            case 'passability':
                // Cycle through: O (passable) → X (impassable) → ★ (above) → O
                const passageBits = oldFlag & 0x1F; // Bits 0-4

                if (passageBits === 0) {
                    // Currently O → change to X (set all direction bits 0-3)
                    currentFlag = (oldFlag & ~0x1F) | 0x0F;
                } else if (passageBits === 0x0F) {
                    // Currently X → change to ★ (clear all, set bit 4)
                    currentFlag = (oldFlag & ~0x1F) | 0x10;
                } else {
                    // Currently ★ or something else → change to O (clear all)
                    currentFlag = oldFlag & ~0x1F;
                }
                break;

            case '4dir':
                // Detect which quadrant of the tile was clicked to toggle that direction
                // Get click position within the tile
                const tileOffsetX = (e.clientX - rect.left) - (x * this.tileSize);
                const tileOffsetY = (e.clientY - rect.top) - (y * this.tileSize);
                const halfTile = this.tileSize / 2;

                // Determine which direction was clicked based on quadrant
                let directionBit = 0;

                // Calculate distance from center to determine which edge is closest
                const distToTop = tileOffsetY;
                const distToBottom = this.tileSize - tileOffsetY;
                const distToLeft = tileOffsetX;
                const distToRight = this.tileSize - tileOffsetX;

                const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);

                if (minDist === distToTop) {
                    directionBit = 0x08; // Up (bit 3)
                } else if (minDist === distToBottom) {
                    directionBit = 0x01; // Down (bit 0)
                } else if (minDist === distToLeft) {
                    directionBit = 0x02; // Left (bit 1)
                } else {
                    directionBit = 0x04; // Right (bit 2)
                }

                // Toggle the clicked direction bit
                // Also clear bit 4 (above characters) as it's mutually exclusive with 4-dir
                currentFlag = (oldFlag & ~0x10) ^ directionBit;
                break;

            case 'ladder':
                // Toggle ladder bit (bit 5)
                currentFlag = oldFlag ^ 0x20;
                break;

            case 'bush':
                // Toggle bush bit (bit 6)
                currentFlag = oldFlag ^ 0x40;
                break;

            case 'counter':
                // Toggle counter bit (bit 7)
                currentFlag = oldFlag ^ 0x80;
                break;

            case 'damage':
                // Toggle damage floor bit (bit 8)
                currentFlag = oldFlag ^ 0x100;
                break;

            case 'terrain':
                // Cycle terrain tag (bits 12-15) from 0-7
                const currentTerrain = (oldFlag >>> 12) & 0x0F;
                const nextTerrain = (currentTerrain + 1) % 8; // Cycle 0→1→2→3→4→5→6→7→0
                // Clear everything from bit 12 up, not just bits 12-15. The
                // engine reads the tag as an unmasked `flag >> 12`, so leaving
                // higher bits set means the tag written here is not the tag the
                // game sees — third-party tools have been observed writing
                // 32-bit values into this array. Bits 0-11 carry every flag the
                // engine defines (passage 0x0f, star 0x10, ladder 0x20,
                // bush 0x40, counter 0x80, damage floor 0x100) and are kept.
                currentFlag = (oldFlag & 0x0FFF) | (nextTerrain << 12);
                break;
        }

        if (currentFlag !== oldFlag) {
            this.currentTileset.flags[tileIndex] = currentFlag;
            // Autotiles: mirror the flag to all 48 shape slots of the kind —
            // the runtime looks flags up by the FULL tile id (base + shape),
            // exactly as the MZ editor writes them.
            if (tileIndex >= 2048 && tileIndex < 8192) {
                for (let s = 1; s < 48; s++) {
                    this.currentTileset.flags[tileIndex + s] = currentFlag;
                }
            }
            console.log(`Flag changed: ${oldFlag} (0x${oldFlag.toString(16)}) -> ${currentFlag} (0x${currentFlag.toString(16)})`);
            this.repaintClickedCanvas(canvas, imageIndex, isSplitSheet);
        } else {
            console.log('Flag unchanged');
        }
    }

    /**
     * Repaint whichever canvas was clicked.
     *
     * The single-layer view keeps its canvas in `currentCanvas` with a cached
     * base; the A tab stacks several, so the clicked one is redrawn directly.
     */
    repaintClickedCanvas(canvas, imageIndex, isSplitSheet) {
        if (this.currentCanvas && this.currentCanvas.canvas === canvas) {
            this.redrawOverlay();
        } else {
            this.redrawCanvasOverlay(canvas, imageIndex, isSplitSheet);
        }
    }

    /**
     * Advance one tile through Auto -> Flat -> Upright.
     *
     * Autotile ids fold to their kind, so classifying a wall classifies every
     * shape of that wall — see `RRTileset3DClass.keyFor`.
     */
    cycleTile3DClass(tileIndex) {
        const classes = this.tileset3DClasses();
        const store = this.tileset3DStore();
        if (!classes || !store || !this.currentTileset) return;

        const tilesetId = this.currentTileset.id;
        const next = classes.cycle(classes.classOf(store, tilesetId, tileIndex));
        classes.setClass(store, tilesetId, tileIndex, next);
        const names = {
            [classes.AUTO]: 'auto', [classes.GROUND]: 'flat',
            [classes.UPRIGHT]: 'upright', [classes.SCENERY]: 'scenery'
        };
        console.log(`3D class for tile ${tileIndex}: ${names[next]}`);
    }

    // Render full tileset preview showing all layers stacked vertically (like RPG Maker)
    updateStatus(message) {
        if (this.parentEditor && this.parentEditor.updateStatus) {
            this.parentEditor.updateStatus(message);
        }
    }

    cleanupListKeyHandler() {
        if (this._tilesetListKeyHandler) {
            document.removeEventListener('keydown', this._tilesetListKeyHandler);
            this._tilesetListKeyHandler = null;
        }
    }

    /**
     * Show tileset detail view (for database modal)
     */
    showTilesetEditorDetail(container, tileset) {
        container.innerHTML = '';
        container.style.overflow = 'hidden';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        // Debug: Log current project state
        console.log('=== showTilesetEditorDetail ===');
        console.log('Current project:', this.projectManager ? this.projectManager.getCurrentProject() : 'NO PROJECT MANAGER');
        console.log('Current project path:', this.projectManager && this.projectManager.getCurrentProject() ? this.projectManager.getCurrentProject().path : 'NO PROJECT');

        // Create tileset editor container within the detail panel
        const editorContainer = document.createElement('div');
        editorContainer.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: hidden;';

        // Append to DOM FIRST so elements exist when we initialize
        container.appendChild(editorContainer);

        // Initialize tileset editor if not already done
        const currentProject = this.projectManager ? this.projectManager.getCurrentProject() : null;
        if (!this.tilesetEditor && currentProject) {
            console.log('Creating new DatabaseTilesetEditor with project path:', currentProject.path);
            this.tilesetEditor = new DatabaseTilesetEditor(
                this.databaseManager,
                this.projectManager,
                this.commonUI,
                this.parentEditor
            );
        } else {
            if (this.tilesetEditor) {
                console.log('Reusing existing DatabaseTilesetEditor, current projectPath:', this.tilesetEditor.projectPath);
            }
        }

        if (!this.tilesetEditor) {
            const tt = text => window.I18n ? window.I18n.tText(text) : text;
            container.innerHTML = `<p style="color: #f44; text-align: center; margin-top: 100px;">${tt('Failed to initialize tileset editor')}</p>`;
            return;
        }

        this.tilesetEditor.onTilesetSaved = (savedTileset) => {
            if (!savedTileset) return;
            this.databaseManager.updateTileset(savedTileset.id, savedTileset);
            // The map canvas and the tile palette each captured this tileset
            // when the map opened, so neither notices a sheet being assigned.
            // Announce the save rather than reaching into them from here.
            if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
                document.dispatchEvent(new CustomEvent('rr-tileset-saved', {
                    detail: { tilesetId: savedTileset.id }
                }));
            }
            if (this.parentEditor?._activeDatabaseList?.type === 'tilesets') {
                this.parentEditor._activeDatabaseList.mutationGeneration++;
                this.parentEditor._activeDatabaseList.refresh();
            } else if (typeof this._refreshTilesetDatabaseList === 'function') {
                this._refreshTilesetDatabaseList(savedTileset.id);
            }
        };

        // Initialize the compact UI for modal display (now that container is in DOM)
        this.tilesetEditor.initializeCompactUI(editorContainer, tileset);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseTilesetEditor;
}
