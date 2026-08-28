// Agonia Engine - Main Entry Point (Refactored)
// This is the main orchestrator that coordinates all subsystems

class RPGReactor {
    constructor() {
        this.instanceBroker = typeof EditorInstanceBroker !== 'undefined'
            ? EditorInstanceBroker.startForCurrentApp()
            : null;

        // Core managers (data layer)
        this.projectManager = new ProjectManager();
        this.databaseManager = new DatabaseManager();

        // UI and Controller layer
        this.uiManager = null;
        this.projectController = null;
        this.audioPlayer = null;
        this.playtestManager = null;
        this.databaseEditorUI = null;
        this.sidebarResizer = null;
        this.buildManager = null;
        this.pluginManager = null;

        // Map editing subsystems
        this.tilemapManager = null;
        this.regionManager = null;
        this.mapEditor = null;
        this.tilesetEditor = null;
        this.tilesetPaletteViewer = null;
        this.eventManager = null;
        this.lightManager = null;
        this.layersPanel = null;

        // PERFORMANCE: Cache last displayed coordinates to avoid unnecessary DOM updates
        this.lastDisplayedCoords = { x: null, y: null };

        // Initialize
        this.init();
    }

    async init() {
        if (this.relaunchFramelessForWine()) return;

        this.centerWindowOnStartup();

        // Set application icon for taskbar/dock (important for Linux)
        this.setApplicationIcon();

        // Initialize performance profiler
        window.perfProfiler = new PerformanceProfiler();

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        this.applyCompatibilityWindowFixes();

        // Initialize Effekseer runtime for animation previews (delayed to ensure library is loaded)
        // Use setTimeout to allow Effekseer library to fully initialize
        setTimeout(() => this.initEffekseer(), 100);

        if (window.I18n) window.I18n.apply(document);

        // Initialize UI Manager with callbacks to this main app
        this.uiManager = new UIManager({
            newProject: () => this.projectController.newProject(),
            openProject: () => this.projectController.openProject(),
            closeProject: () => this.projectController.closeProject(),
            exit: () => this.projectController.requestApplicationClose(),
            saveProject: () => this.projectController.saveProject(),
            saveAll: () => this.projectController.saveAll(),
            playtest: () => this.playtest(),
            getGrid: () => (this.mapEditor ? this.mapEditor.snapGrid : 48),
            cycleGrid: () => this.cycleGrid(),
            isGridLockedTileset: () => (this.mapEditor ? this.mapEditor.isGridLockedTileset() : true),
            toggleHitboxes: () => this.toggleHitboxes(),
            toggleEventView: () => this.toggleEventView(),
            toggleLightPreview: () => this.toggleLightPreview(),
            openDatabase: (type) => this.openDatabase(type),
            showAudioPlayer: () => (this.audioStudio
                ? this.audioStudio.open()
                : this.audioPlayer.showAudioPlayer()),
            showOptions: () => this.optionsManager.show(),
            showForgeLauncher: () => this.forgeManager.showLauncher(),
            openForgeTool: (toolId) => this.forgeManager.openTool(toolId),
            showPluginManager: () => this.showPluginManager(),
            showAbout: () => this.showAbout(),
            getMapEditor: () => this.mapEditor,
            getEventManager: () => this.eventManager,
            toggleEventMode: () => this.toggleEventMode(),
            toggleLightMode: () => this.toggleLightMode(),
            toggleNpcMode: () => this.toggleNpcMode(),
            getEditingMode: () => (this.editingMode || 'tiles'),
            disableEventModeIfActive: () => this.disableEventModeIfActive(),
            installRuntime: () => this.projectController.installReactorRuntime(),
            migratePlugins: () => this.projectController.migratePluginsToEngineCatalog(),
            openBuildManager: () => this.buildManager.open(),
            openDistEditor: () => this.distEditorManager.open()
        });

        // Initialize Sidebar Resizer for resizable panels
        this.sidebarResizer = new SidebarResizer();
        this.sidebarResizer.initialize();

        // Keep sidebar layout correct on window resize and scale toolbar icons
        window.addEventListener('resize', () => {
            if (this.sidebarResizer) {
                this.sidebarResizer.refresh();
            }
            this.resetSidebarScroll();
            this.scaleToolbarIcons();
        });

        // Initialize Project Controller
        this.projectController = new ProjectController(
            this.projectManager,
            this.databaseManager,
            this.uiManager
        );

        if (typeof nw !== 'undefined') {
            const appWindow = nw.Window.get();
            appWindow.on('close', () => {
                if (this.projectController.allowApplicationClose) {
                    appWindow.close(true);
                    return;
                }
                this.projectController.requestApplicationClose();
            });
        }

        // Set up callback for when maps are loaded
        this.projectController.onMapLoaded = () => {
            this.showTilesetPalette();

            // Initialize or recreate map editor for tile painting
            if (!this.mapEditor && this.tilesetPaletteViewer) {
                this.mapEditor = new MapEditor(
                    this.projectController.getTilemapManager(),
                    this.tilesetPaletteViewer
                );

                // Give palette viewer reference to map editor for auto-toggling erase mode
                this.tilesetPaletteViewer.setMapEditor(this.mapEditor);

                // Set region manager reference
                this.mapEditor.setRegionManager(this.projectController.getRegionManager());

                // Set up coordinate tracking callback for tileset mode
                this.mapEditor.onCoordinatesChange = (x, y) => {
                    this.updateMapCoordinates(x, y);
                };

                // Set up undo/redo state change callback
                this.mapEditor.onUndoStateChange = (canUndo, canRedo) => {
                    this.uiManager.updateUndoRedoButtons(canUndo, canRedo);
                };

                // Register with project controller so it can update references when switching projects
                this.projectController.setMapEditor(this.mapEditor);

                // PERFORMANCE: Wrap MapEditor methods for profiling
                if (window.perfProfiler) {
                    perfProfiler.wrapMethod(this.mapEditor, 'paintTile', 'MapEditor');
                    perfProfiler.wrapMethod(this.mapEditor, 'updateTilePreview', 'MapEditor');
                    perfProfiler.wrapMethod(this.mapEditor, 'hideTilePreview', 'MapEditor');
                    perfProfiler.wrapMethod(this.mapEditor, 'toggleShadow', 'MapEditor');
                    perfProfiler.wrapMethod(this.mapEditor, 'paintRectangle', 'MapEditor');
                    perfProfiler.wrapMethod(this.mapEditor, 'paintCircle', 'MapEditor');
                    perfProfiler.wrapMethod(this.mapEditor, 'eraseTile', 'MapEditor');
                }
            } else if (this.mapEditor) {
                // Update MapEditor's references in case they changed (e.g., project switch)
                // This ensures it has the current TilemapManager
                this.mapEditor.tilemapManager = this.projectController.getTilemapManager();
                this.mapEditor.regionManager = this.projectController.getRegionManager();
            }

            // Re-setup map interaction for the new map (important when switching maps)
            if (this.mapEditor) {
                this.mapEditor.setupMapInteraction();

                // Clear undo history when loading a new map
                this.mapEditor.clearUndoHistory();
            }

            // Initialize event manager
            if (!this.eventManager) {
                this.eventManager = new EventManager(
                    this.projectController,
                    this.databaseManager
                );

                // Set sidebar resizer reference
                if (this.sidebarResizer) {
                    this.eventManager.setSidebarResizer(this.sidebarResizer);
                }

            }

            // Always reinitialize event layer with current TilemapManager
            // This is important when switching projects or maps
            this.eventManager.initializeEventLayer(this.projectController.getTilemapManager());
            this.projectController.eventManager = this.eventManager;

            // Set current map for event manager
            if (this.eventManager) {
                const currentMap = this.projectController.getTilemapManager().currentMap;
                this.eventManager.setCurrentMap(currentMap);

                // Set up coordinate tracking callback
                this.eventManager.onCoordinatesChange = (x, y) => {
                    this.updateMapCoordinates(x, y);
                };

                // Set up undo/redo state change callback
                this.eventManager.onUndoStateChange = (canUndo, canRedo) => {
                    this.uiManager.updateUndoRedoButtons(canUndo, canRedo);
                };

                // Clear undo history when loading a new map
                this.eventManager.clearUndoHistory();
            }

            // Light Manager: instantiate once, then re-init layer + map on every
            // load (TilemapManager is recreated on project switch).
            if (!this.lightManager) {
                this.lightManager = new LightManager(this.projectController, this.databaseManager);
                // Floating panel, mounted in the map workspace (top-right corner).
                this.lightManager.buildPanel();
            }
            this.lightManager.initializeLightLayer(this.projectController.getTilemapManager());
            const lmMap = this.projectController.getTilemapManager().currentMap;
            this.lightManager.setCurrentMap(lmMap);
            this.lightManager.onCoordinatesChange = (x, y) => this.updateMapCoordinates(x, y);

            // Enemy Inspector (S51): instantiate once, then re-init on every
            // map load; the floating panel mounts itself on first NPC-mode use.
            if (!this.enemyInspectorManager) {
                this.enemyInspectorManager = new EnemyInspectorManager(
                    this.projectController, this.databaseManager, this.eventManager);
            }
            this.enemyInspectorManager.setTilemapManager(this.projectController.getTilemapManager());
            this.enemyInspectorManager.setCurrentMap(lmMap);

            // Set up zoom change callback
            const tilemapManager = this.projectController.getTilemapManager();
            if (tilemapManager) {
                this.applyAutotileAnimationPreference(this.optionsManager.getAnimateAutotiles());
                tilemapManager.onZoomChange = () => {
                    this.updateMapZoom();
                    if (this.lightManager) this.lightManager.refresh();
                };
            }

            // Layers Panel: create/mount once, then load the manifest from the
            // current map. The manifest was already migrated by TilemapManager
            // during loadMap, so loadFromMap only renders + applies state.
            this.ensureLayersPanel();
            if (this.layersPanel && tilemapManager && tilemapManager.currentMap) {
                // Refresh references: TilemapManager is recreated on project switch.
                this.layersPanel.tilemapManager = tilemapManager;
                this.layersPanel.mapEditor = this.mapEditor;
                this.layersPanel.tilesetPaletteViewer = this.tilesetPaletteViewer;
                this.layersPanel.eventManager = this.eventManager;
                if (this.eventManager) {
                    this.eventManager._notifyLayersPanel = () => this.layersPanel && this.layersPanel.refresh();
                }
                this.layersPanel.loadFromMap(tilemapManager.currentMap);
            }

            // Restore the editing mode across the map reload (S51b): the
            // state machine owns tiles/events/light/npc; the light/NPC
            // managers re-bound above re-attach their layers, here we
            // re-apply the ON-state and the toolbar chrome.
            const restoreMode = this.editingMode || 'tiles';
            if (this.mapEditor) {
                this.mapEditor.setEnabled(restoreMode === 'tiles');
                if (restoreMode === 'tiles') this.mapEditor.setupMapInteraction();
            }
            if (restoreMode === 'events' && this.eventManager) {
                this.eventManager.setEventMode(true);
            } else if (restoreMode === 'light' && this.lightManager) {
                this.lightManager.setLightMode(true);
            } else if (restoreMode === 'npc' && this.enemyInspectorManager) {
                this.enemyInspectorManager.setNpcMode(true);
            }
            if (restoreMode !== 'tiles') this._syncModeChrome();

            // Update map info banner
            this.updateMapInfoBanner();
        };

        // Initialize Audio Player
        this.audioPlayer = new AudioPlayer();

        // Initialize Audio Studio (toolbar audio tool window)
        this.audioStudio = new AudioStudio({
            getCurrentProject: () => this.projectController ? this.projectController.getCurrentProject() : null,
            getDatabaseManager: () => this.databaseManager || null
        });

        // Initialize Options Manager (theme/preferences modal)
        this.optionsManager = new OptionsManager();
        window.addEventListener('rr-autotile-animation-changed', (event) => {
            this.applyAutotileAnimationPreference(event.detail.enabled);
        });
        document.getElementById('map-autotile-animation')?.addEventListener('change', (event) => {
            this.optionsManager.setAnimateAutotiles(event.currentTarget.checked);
        });
        this.applyAutotileAnimationPreference(this.optionsManager.getAnimateAutotiles());

        // 3D map viewport
        this.mapEditor3D = new MapEditor3D(this.projectController);
        this.projectController.mapEditor3D = this.mapEditor3D;
        // Double-clicking a cube opens the same editor the 2D map opens, so
        // events are editable from the 3D view rather than only visible in it.
        this.mapEditor3D.onEventActivated = (event) => {
            if (this.eventManager) this.eventManager.editEvent(event);
        };
        this.mapEditor3D.onEventSelected = (event) => {
            // Route it through the event manager so the events panel and the
            // 2D map highlight follow a pick made in 3D, the same way they
            // follow one made anywhere else.
            if (event && this.eventManager) this.eventManager.selectEventById(event.id);
            this.uiManager.updateStatus(event
                ? `${String(event.id).padStart(3, '0')}: ${event.name || ''}`
                : '');
        };
        this.mapEditor3D.onEventContextMenu = (event, clientX, clientY) => {
            if (this.eventManager) {
                this.eventManager.showContextMenu(clientX, clientY, event.x, event.y, event);
            }
        };
        window.addEventListener('rr-map-3d-view-changed', (event) => {
            this.applyMap3DViewPreference(event.detail.enabled);
        });
        document.getElementById('map-3d-view')?.addEventListener('change', (event) => {
            this.optionsManager.setMap3DView(event.currentTarget.checked);
        });
        // Reflect the stored preference in the checkbox, but do not build the
        // scene here: there is no map open yet, and three.js should not be
        // parsed until a viewport actually needs it.
        const map3DCheckbox = document.getElementById('map-3d-view');
        if (map3DCheckbox) map3DCheckbox.checked = this.optionsManager.getMap3DView();

        // Initialize Forge tool suite (character generator etc.)
        this.forgeManager = new ForgeManager(this.projectController);

        // Initialize Playtest Manager
        this.playtestManager = new PlaytestManager(this.projectManager);

        // Initialize Build Manager
        const web = window.RPGReactorHost?.mode === 'web';
        this.buildManager = web
            ? { open: () => window.RPGReactorHost.unsupported(window.I18n ? window.I18n.tText('Game deployment') : 'Game deployment') }
            : new BuildManager();

        // Initialize Editor Distribution Manager
        this.distEditorManager = web
            ? { open: () => window.RPGReactorHost.unsupported(window.I18n ? window.I18n.tText('Editor deployment') : 'Editor deployment') }
            : new DistEditorManager();

        // Initialize Plugin Manager
        this.pluginManager = new PluginManager(this.projectController);

        // Set up UI event handlers
        this.uiManager.setupEventHandlers();

        // Set up NW.js native menu
        this.uiManager.setupNativeMenu();

        // Set up keyboard shortcuts
        this.uiManager.setupKeyboardShortcuts();

        // Set up database navigation
        this.setupDatabaseNavigation();

        // PERFORMANCE: Wrap main.js methods for profiling
        if (window.perfProfiler) {
            perfProfiler.wrapMethod(this, 'updateMapCoordinates', 'Main');
        }

        // Start with welcome screen (Pixi will initialize when project loads)
        this.uiManager.showWelcomeScreen();

        // DevTools can be toggled via Help > Developer Tools or F12

        // Pixi is initialized in ProjectController, no RendererManager needed

        // Disable browser context menu on canvas and canvas container
        document.addEventListener('contextmenu', (e) => {
            if (e.target.tagName === 'CANVAS' || e.target.id === 'canvas-container') {
                e.preventDefault();
                return false;
            }
        });

        // Auto-load last opened project
        await this.projectController.checkAutoLoadProject();

        // Sync current project with audio player if a project was loaded
        if (this.projectController.isProjectLoaded()) {
            this.audioPlayer.setCurrentProject(this.projectController.getCurrentProject());
        }

        // Hide splash screen after 2 seconds
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.transition = 'opacity 0.5s';
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 500);
            }
        }, 2000);
    }

    applyAutotileAnimationPreference(enabled) {
        const next = enabled !== false;
        const tilemapManager = this.projectController?.getTilemapManager?.() || this.tilemapManager;
        if (tilemapManager?.setA1AnimationEnabled) {
            tilemapManager.setA1AnimationEnabled(next);
        }

        const checkbox = document.getElementById('map-autotile-animation');
        if (checkbox) checkbox.checked = next;
    }

    /**
     * Switch the map canvas between 2D and 3D.
     *
     * The checkbox is put back to whatever actually happened rather than what
     * was asked for: three.js or the runtime directory can be missing in a
     * partial install, and a ticked box over a 2D canvas would be a lie.
     */
    async applyMap3DViewPreference(enabled) {
        if (!this.mapEditor3D) return;
        const active = await this.mapEditor3D.setEnabled(enabled === true);

        const checkbox = document.getElementById('map-3d-view');
        if (checkbox) checkbox.checked = active;
        if (enabled && !active) {
            this.uiManager.updateStatus(
                this.mapEditor3D.lastError || (window.I18n ? window.I18n.tText('3D view unavailable') : '3D view unavailable'));
            this.optionsManager.settings.map3DView = false;
        }
    }

    // Playtest orchestration
    async playtest() {
        const project = this.projectController.getCurrentProject();
        if (!project) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.noProjectLoaded') : 'No project loaded');
            return;
        }

        // Best-effort repair — a failure here (e.g. unreadable System.json)
        // must not abort the playtest with an unhandled rejection.
        if (this.projectController.repairInvalidSystemMapReferences) {
            try {
                await this.projectController.repairInvalidSystemMapReferences();
            } catch (e) {
                console.warn('repairInvalidSystemMapReferences failed:', e);
            }
        }

        // Save the project (current map + database + MapInfos) before
        // launching, so the playtest process reads current data from disk.
        const saved = await this.projectController.saveAll();
        if (!saved) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.playtestSaveFailed') : 'Playtest cancelled: project could not be saved');
            return;
        }

        // Stop any audio playing in the editor before launching playtest
        if (this.audioPlayer) {
            this.audioPlayer.stopExternal();
        }
        if (this.audioStudio) {
            this.audioStudio.close();
        }

        const success = this.playtestManager.playtest(project.path);
        if (!success) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.playtestNotImplemented') : 'Playtest mode not yet implemented');
        }
    }

    // Show about dialog
    showAbout() {
        const modal = document.getElementById('about-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // Show plugin manager
    showPluginManager() {
        if (!this.projectController.isProjectLoaded()) {
            alert(window.I18n ? window.I18n.t('alert.loadProjectFirst') : 'Please load a project first.');
            return;
        }
        if (this.pluginManager) {
            this.pluginManager.show();
        }
    }

    // Toggle event mode
    toggleEventMode() {
        if (!this.eventManager) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.loadMapFirst') : 'Load a map first');
            return;
        }

        // Ensure event manager has reference to tileset palette viewer
        if (this.tilesetPaletteViewer) {
            this.eventManager.setTilesetPaletteViewer(this.tilesetPaletteViewer);
        }

        // The mode-toggle button flips between tiles and the events context
        // (whichever events sub-mode was last active re-opens as plain events).
        this.setEditingMode((this.editingMode && this.editingMode !== 'tiles') ? 'tiles' : 'events');
    }

    // =====================================================================
    // S51b: the authoritative editing-mode state machine.
    // 'tiles' | 'events' | 'light' | 'npc'. Light and NPC are SUB-MODES of
    // the events context: the toolbar keeps the events tool group (Свет/НПС),
    // the mode-toggle keeps the EV icon, and tile-editing side effects
    // (setupMapInteraction / grid refresh / pencil reselect) only fire when
    // actually crossing the tiles<->events border. Previously light/npc
    // entered through a full event-mode EXIT, which flipped the toolbar to
    // the drawing tools, hid the НПС button, corrupted the light-preview
    // tile dimming and left the mode icon lying about the current state.
    // =====================================================================

    setEditingMode(mode) {
        if (!['tiles', 'events', 'light', 'npc'].includes(mode)) return;
        const prev = this.editingMode || 'tiles';
        if (prev === mode) return;
        this.editingMode = mode;

        // --- teardown of the previous mode ---
        if (prev === 'light' && this.lightManager) {
            this.lightManager.setLightMode(false);
        }
        if (prev === 'npc' && this.enemyInspectorManager) {
            this.enemyInspectorManager.setNpcMode(false);
        }
        if (prev === 'events' && mode !== 'events') {
            this.eventManager.setEventMode(false);
        }

        // --- tile editor ---
        if (this.mapEditor) {
            if (mode === 'tiles') {
                this.mapEditor.setEnabled(true);
                this.mapEditor.setupMapInteraction();
            } else {
                this.mapEditor.setEnabled(false);
                if (this.mapEditor.shadowPenMode) {
                    this.mapEditor.setShadowPenMode(false);
                }
            }
        }

        // --- setup of the new mode ---
        if (mode === 'events') {
            if (this.tilesetPaletteViewer) {
                this.tilesetPaletteViewer.clearSelection();
                this.eventManager.setTilesetPaletteViewer(this.tilesetPaletteViewer);
            }
            this.eventManager.setEventMode(true);
        } else if (mode === 'light') {
            this.lightManager.setLightMode(true);
        } else if (mode === 'npc') {
            this.enemyInspectorManager.setNpcMode(true);
        } else {
            // tiles: restore the default tool
            if (this.mapEditor) this.mapEditor.setTool('pencil');
            document.querySelectorAll('.tool-draw-mode').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.tool === 'pencil') btn.classList.add('active');
            });
        }
        if (mode !== 'tiles' && mode !== 'events') {
            // light/npc: draw buttons stay inert inside the events context
            document.querySelectorAll('.tool-draw-mode').forEach(btn => btn.classList.remove('active'));
        }

        this._syncModeChrome();

        const statusKey = {
            tiles: 'status.eventModeDisabled',
            events: 'status.eventModeEnabled',
            light: 'status.lightModeEnabled',
            npc: 'status.npcModeEnabled'
        }[mode];
        this.uiManager.updateStatus(window.I18n ? window.I18n.t(statusKey) : statusKey);
    }

    /** Toolbar chrome for the current editing mode: tool groups, mode-toggle
     *  icon, sub-mode button states, undo/redo source, grid + layers dim. */
    _syncModeChrome() {
        const mode = this.editingMode || 'tiles';
        const eventsCtx = mode !== 'tiles';

        // Tool groups: tiles get the drawing tools, the events context gets
        // Свет/НПС (S51).
        document.querySelectorAll('.tiles-only').forEach(el => {
            el.style.display = eventsCtx ? 'none' : '';
        });
        document.querySelectorAll('.events-only').forEach(el => {
            el.style.display = eventsCtx ? '' : 'none';
        });

        // Mode toggle: active = Tiles, icon EV inside the events context
        const modeBtn = document.getElementById('mode-toggle-btn');
        if (modeBtn) {
            modeBtn.classList.toggle('active', !eventsCtx);
            const img = modeBtn.querySelector('img');
            if (img) {
                img.src = eventsCtx ? 'images/icon-event.png' : 'images/icon-single.png';
                img.onerror = function () {
                    this.style.display = 'none';
                    this.parentElement.innerHTML = eventsCtx ? 'EV' : 'TL';
                };
            }
            if (this.mapEditor) this.mapEditor.refreshBackgroundGrid();
            if (this.uiManager) this.uiManager.refreshGridButton();
        }

        // Sub-mode buttons reflect their mode
        const lb = document.getElementById('mode-light-btn');
        if (lb) lb.classList.toggle('active', mode === 'light');
        const nb = document.getElementById('mode-npc-btn');
        if (nb) nb.classList.toggle('active', mode === 'npc');

        // P6: в НПС-режиме спавн-палитра врагов заменяет палитру тайлсета
        // в левом сайдбаре; плееры палитры живут только внутри режима.
        const tilesetSection = document.getElementById('tileset-palette-section');
        const enemySection = document.getElementById('enemy-palette-section');
        const enemyContent = document.getElementById('enemy-palette-content');
        const enemyHeader = document.getElementById('enemy-palette-header');
        if (mode === 'npc') {
            if (tilesetSection) tilesetSection.style.display = 'none';
            if (enemySection) enemySection.style.display = 'flex';
            if (enemyHeader) enemyHeader.textContent = window.I18n ? window.I18n.tText('Враги (спавн)') : 'Враги (спавн)';
            if (enemyContent && this.enemyInspectorManager) {
                this.enemyInspectorManager.buildSidebarPalette(enemyContent);
            }
        } else {
            if (enemySection) enemySection.style.display = 'none';
            if (this.enemyInspectorManager) this.enemyInspectorManager.stopPalettePlayers();
            if (tilesetSection) tilesetSection.style.display = 'flex';
        }

        // Undo/redo source follows the context
        if (eventsCtx) {
            this.uiManager.updateUndoRedoButtons(
                this.eventManager.canUndo(),
                this.eventManager.canRedo()
            );
        } else if (this.mapEditor) {
            this.uiManager.updateUndoRedoButtons(
                this.mapEditor.canUndo(),
                this.mapEditor.canRedo()
            );
        }

        // Layers panel: plain events mode dims tile layers read-only (pre-S51
        // behavior); light/npc keep tiles at full brightness so the light
        // preview / enemy highlights read clearly.
        if (this.layersPanel) this.layersPanel.onEventModeChanged(mode === 'events');
    }

    // Toggle light mode (Освещение): show + edit SDLight sources on the map.
    // Lives INSIDE the events context: toggling off returns to plain events.
    toggleLightMode() {
        if (!this.lightManager || !this.lightManager.currentMap) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.loadMapFirst') : 'Load a map first');
            return;
        }
        this.setEditingMode(this.editingMode === 'light' ? 'events' : 'light');
    }

    // Toggle NPC mode (S51): inspect + edit enemy stubs on the map.
    // Lives INSIDE the events context: toggling off returns to plain events.
    toggleNpcMode() {
        if (!this.enemyInspectorManager || !this.enemyInspectorManager.currentMap) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.loadMapFirst') : 'Load a map first');
            return;
        }
        this.setEditingMode(this.editingMode === 'npc' ? 'events' : 'npc');
    }

    // Disable event mode if currently active (called when switching to tileset tools)
    disableEventModeIfActive() {
        if (!this.eventManager) return;
        // S51b: everything funnels through the state machine - tiles drops
        // any events-context mode (events / light / npc).
        this.setEditingMode('tiles');
    }

    // Create and mount the Layers Panel once; reuses the existing instance
    // across map loads. Idempotent.
    ensureLayersPanel() {
        if (this.layersPanel) return;
        const content = document.getElementById('layers-content');
        if (!content) return;
        this.layersPanel = new LayersPanel({
            tilemapManager: this.projectController.getTilemapManager(),
            mapEditor: this.mapEditor,
            tilesetPaletteViewer: this.tilesetPaletteViewer,
            eventManager: this.eventManager,
            callbacks: {
                disableEventModeIfActive: () => this.disableEventModeIfActive(),
                enterEventMode: () => this.ensureEventMode(),
                updateStatus: (msg) => this.uiManager && this.uiManager.updateStatus(msg)
            }
        });
        this.layersPanel.mount(content);

        // EventManager notifies the panel after event changes (create/delete/move)
        // so the priority-sublayer grouping + counts stay in sync.
        if (this.eventManager) {
            this.eventManager._notifyLayersPanel = () => this.layersPanel && this.layersPanel.refresh();
        }

        // Show the sidebar section and let the resizer pick up its handle.
        const section = document.getElementById('layers-section');
        if (section) section.style.display = 'flex';
        if (this.sidebarResizer) this.sidebarResizer.refresh();
    }

    // Enter event mode if not already active (used by the Layers panel when an
    // event layer is clicked). Does NOT toggle off. S51b: goes through the
    // state machine so light/npc sub-modes are torn down properly.
    ensureEventMode() {
        if (!this.eventManager) return;
        if (this.editingMode === 'events') return;
        this.setEditingMode('events');
    }

    // Show tileset palette viewer
    async showTilesetPalette() {
        const tilemapManager = this.projectController.getTilemapManager();
        if (!tilemapManager) {
            return;
        }

        // Get the tileset palette section and content container
        const paletteSection = document.getElementById('tileset-palette-section');
        const paletteContent = document.getElementById('tileset-palette-content');

        if (!paletteSection || !paletteContent) {
            return;
        }

        // Get current map data
        const mapData = tilemapManager.currentMap;
        if (!mapData) {
            paletteSection.style.display = 'none';
            return;
        }

        // Show the palette section (use 'flex' to ensure flex layout is active)
        paletteSection.style.display = 'flex';

        // Initialize tileset palette viewer if not already done
        if (!this.tilesetPaletteViewer) {
            const project = this.projectController.getCurrentProject();
            this.tilemapManager = this.projectController.getTilemapManager();
            this.tilesetPaletteViewer = new TilesetPaletteViewer(
                this.tilemapManager.app,
                project.path
            );
            this.projectController.setTilesetPaletteViewer(this.tilesetPaletteViewer);

            // Initialize the UI only once
            this.tilesetPaletteViewer.initializeUI(paletteContent);

            // Set up region tab callback
            this.tilesetPaletteViewer.onRegionTabSelected = () => {
                const regionContainer = document.getElementById('region-ui-container');
                const regionManager = this.projectController.getRegionManager();
                if (regionContainer && regionManager) {
                    regionManager.initializeUI(regionContainer);
                    regionManager.createRegionLayer();
                    regionManager.setVisible(true);
                }
            };

            // Set up tileset layer selection callback - disable event mode when switching to tileset mode
            this.tilesetPaletteViewer.onTilesetLayerSelected = () => {
                // Hide regions overlay when switching away from R tab
                const regionManager = this.projectController.getRegionManager();
                if (regionManager) {
                    regionManager.setVisible(false);
                }

                // If event mode is currently active, deactivate it
                if (this.eventManager && this.eventManager.eventMode) {
                    this.eventManager.setEventMode(false);

                    // Enable map editor
                    if (this.mapEditor) {
                        this.mapEditor.setEnabled(true);
                        // Re-setup map interaction when returning to tileset mode
                        this.mapEditor.setupMapInteraction();
                    }

                    // Update overlay mode button back to Tiles
                    const modeBtn = document.getElementById('mode-toggle-btn');
                    if (modeBtn) {
                        modeBtn.classList.remove('active');
                        const img = modeBtn.querySelector('img');
                        if (img) { img.src = 'images/icon-single.png'; img.onerror = function() { this.style.display='none'; this.parentElement.innerHTML='T'; }; }
                    }

                    // Update status
                    this.uiManager.updateStatus('Tileset mode enabled');
                }
            };

            // Set up layer changed callback to update layer highlights
            this.tilesetPaletteViewer.onLayerChanged = (layerName) => {
                const tilemapManager = this.projectController.getTilemapManager();
                if (tilemapManager && tilemapManager.renderLayerHighlights) {
                    tilemapManager.renderLayerHighlights();
                }
                if (this.mapEditor) this.mapEditor.refreshBackgroundGrid();
                if (this.uiManager && this.uiManager.refreshGridButton) {
                    this.uiManager.refreshGridButton();
                }
                // Layers Panel: selecting a palette tab (A/B/C/D...) makes the
                // matching tile layer active. Synced one-way here; the panel
                // guards against feedback loops when IT drives the palette.
                if (this.layersPanel) {
                    this.layersPanel.setActiveByPaletteTab(layerName);
                }
            };
        }

        // Always ensure event manager has reference to tileset palette viewer
        if (this.eventManager && this.tilesetPaletteViewer) {
            this.eventManager.setTilesetPaletteViewer(this.tilesetPaletteViewer);
        }

        // Load the tileset for the current map (wait for images to load)
        await this.tilesetPaletteViewer.loadTilesetForMap(mapData);

        // Update resize handles visibility and force layout recalculation
        if (this.sidebarResizer) {
            this.sidebarResizer.refresh();
        }

        // Fix for NW.js/Linux: when new content is created inside overflow:hidden containers,
        // the browser can silently set scrollTop, hiding the header/tabs at the top.
        // Reset all scroll positions to ensure the sidebar headers are visible.
        this.resetSidebarScroll();
    }

    // Reset scroll positions on the sidebar and all its sections.
    // When NW.js/Chromium creates content inside overflow:hidden containers,
    // it can silently set scrollTop, pushing headers out of view.
    resetSidebarScroll() {
        const resetAll = () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.scrollTop = 0;

            // Reset all resizable sections
            document.querySelectorAll('.resizable-section').forEach(section => {
                section.scrollTop = 0;
            });

            // Reset sidebar-content containers (except maps list which manages its own scroll)
            document.querySelectorAll('.sidebar-content').forEach(content => {
                if (content.id !== 'maps-list') {
                    content.scrollTop = 0;
                }
            });
        };

        // Reset immediately
        resetAll();
        // Reset after layout settles (next frame)
        requestAnimationFrame(resetAll);
        // Reset once more after a short delay for NW.js layout quirks
        setTimeout(resetAll, 50);
    }

    // Scale toolbar icons to fit available width.
    // At full size: 32px icons. Shrinks proportionally when the window is narrow.
    scaleToolbarIcons() {
        const toolbar = document.getElementById('toolbar');
        if (!toolbar || toolbar.style.display === 'none') return;

        const maxSize = 32;
        const minSize = 16;

        // Temporarily set to max size and allow overflow for accurate measurement
        toolbar.style.setProperty('--toolbar-icon-size', maxSize + 'px');
        toolbar.style.overflow = 'visible';

        // Force reflow to get accurate scrollWidth at full icon size
        const naturalWidth = toolbar.scrollWidth;
        const availableWidth = toolbar.clientWidth;

        // Restore overflow
        toolbar.style.overflow = '';

        if (naturalWidth <= availableWidth) {
            // Plenty of room, use full size
            return;
        }

        // Calculate how much space the icons occupy vs fixed elements (labels, separators, gaps, padding)
        const iconCount = toolbar.querySelectorAll('.tool-button img, .tool-button svg').length;
        const totalIconWidth = iconCount * maxSize;
        const fixedWidth = naturalWidth - totalIconWidth;

        // Solve for icon size: iconCount * newSize + fixedWidth <= availableWidth
        const newSize = Math.max(minSize, Math.min(maxSize, Math.floor((availableWidth - fixedWidth) / iconCount)));
        toolbar.style.setProperty('--toolbar-icon-size', newSize + 'px');
    }

    // ==========================================
    // DATABASE UI - Delegated to DatabaseEditorUI
    // ==========================================

    // Database UI is now handled by the DatabaseEditorUI class (see DatabaseEditorUI.js)
    // Methods are delegated through the databaseEditorUI instance

    setupDatabaseNavigation() {
        if (!this.databaseEditorUI) {
            this.databaseEditorUI = new DatabaseEditorUI(
                this.databaseManager,
                this.projectController.getCurrentProject(),
                {
                    updateStatus: (msg) => this.updateStatus(msg),
                    getRendererApp: () => this.tilemapManager?.app || null,
                    getTilemapManager: () => this.projectController.getTilemapManager(),
                    showTypesEditor: () => this.showTypesEditor(),
                    showTermsEditor: () => this.showTermsEditor()
                }
            );
        }
        this.databaseEditorUI.playtestManager = this.playtestManager;
        this.databaseEditorUI.setupDatabaseNavigation();
    }

    openDatabase(type) {
        if (!this.projectController.isProjectLoaded()) {
            alert(window.I18n ? window.I18n.t('alert.loadProjectFirst') : 'Please load a project first.');
            return;
        }

        // P5: opening the DB (e.g. from the NPC panel's «БД →») fully exits
        // NPC mode - the map returns to the normal view, the panel closes.
        if (this.enemyInspectorManager && this.enemyInspectorManager.npcMode) {
            this.setEditingMode('events');
        }

        if (!this.databaseEditorUI) {
            this.databaseEditorUI = new DatabaseEditorUI(
                this.databaseManager,
                this.projectController.getCurrentProject(),
                {
                    updateStatus: (msg) => this.updateStatus(msg),
                    getRendererApp: () => this.tilemapManager?.app || null,
                    getTilemapManager: () => this.projectController.getTilemapManager(),
                    showTypesEditor: () => this.showTypesEditor(),
                    showTermsEditor: () => this.showTermsEditor()
                }
            );
        }

        // Update project reference and playtest manager in case they changed
        this.databaseEditorUI.setCurrentProject(this.projectController.getCurrentProject());
        this.databaseEditorUI.playtestManager = this.playtestManager;

        // Delegate to DatabaseEditorUI
        this.databaseEditorUI.openDatabase(type);
    }

    showTypesEditor() {
        if (this.databaseEditorUI) {
            this.databaseEditorUI.showTypesEditor();
        }
    }

    showTermsEditor() {
        if (this.databaseEditorUI) {
            this.databaseEditorUI.showTermsEditor();
        }
    }

    cycleGrid() {
        if (this.mapEditor && !this.mapEditor.isGridLockedTileset()) {
            const cur = this.mapEditor.snapGrid;
            this.mapEditor.snapGrid = (cur === 48) ? 24 : (cur === 24) ? 0 : 48;
            if (this.eventManager) this.eventManager.snapGrid = this.mapEditor.snapGrid;
        }
        if (this.mapEditor) this.mapEditor.refreshBackgroundGrid();
        if (this.uiManager) this.uiManager.refreshGridButton();
    }

    toggleHitboxes() {
        const tm = (this.projectController && typeof this.projectController.getTilemapManager === 'function')
            ? this.projectController.getTilemapManager()
            : this.tilemapManager;
        if (!tm || typeof tm.setShowHitboxes !== 'function') return;
        const next = !tm.showHitboxes;
        tm.setShowHitboxes(next);
        const btn = document.getElementById('overlay-hb-btn');
        if (btn) btn.classList.toggle('active', next);
    }

    toggleEventView() {
        if (!this.eventManager) return;
        this.eventManager.eventViewMode = this.eventManager.eventViewMode === 'game' ? 'minimal' : 'game';
        this.eventManager.renderEvents();
        const btn = document.getElementById('overlay-ev-btn');
        if (btn) btn.classList.toggle('active', this.eventManager.eventViewMode === 'game');
    }

    // Toggle the playtest-style lighting preview overlay (the ☀ overlay button).
    toggleLightPreview() {
        if (!this.lightManager || !this.lightManager.currentMap) {
            this.uiManager.updateStatus(window.I18n ? window.I18n.t('status.loadMapFirst') : 'Load a map first');
            return;
        }
        const next = !this.lightManager.previewOn;
        this.lightManager.setPreview(next);
        this.uiManager.updateStatus(window.I18n
            ? window.I18n.t(next ? 'status.lightPreviewEnabled' : 'status.lightPreviewDisabled')
            : (next ? 'Lighting preview on' : 'Lighting preview off'));
    }

    async loadMap(mapId) {
        if (!this.tilemapManager) {
            return;
        }

        this.updateStatus(`Loading map ${mapId}...`);

        const success = await this.tilemapManager.loadMap(mapId);

        if (success) {
            this.updateStatus(`Map ${mapId} loaded`);

            // Highlight selected map in list
            document.querySelectorAll('[data-map-id]').forEach(item => {
                item.classList.remove('selected');
                if (parseInt(item.getAttribute('data-map-id')) === mapId) {
                    item.classList.add('selected');
                }
            });

            // Initialize and show tileset palette viewer
            this.showTilesetPalette();

            // Refresh grid button lock state (A/R tileset check)
            if (this.uiManager && this.uiManager.refreshGridButton) {
                this.uiManager.refreshGridButton();
            }

            // Initialize map editor for tile painting
            if (!this.mapEditor && this.tilesetPaletteViewer) {
                this.mapEditor = new MapEditor(this.tilemapManager, this.tilesetPaletteViewer);

                // Give palette viewer reference to map editor for auto-toggling erase mode
                this.tilesetPaletteViewer.setMapEditor(this.mapEditor);

                // Set region manager reference
                if (this.projectController) {
                    this.mapEditor.setRegionManager(this.projectController.getRegionManager());
                }

                this.mapEditor.setupMapInteraction();
            }
        } else {
            this.updateStatus(`Failed to load map ${mapId}`);
        }
    }

    updateStatus(message) {
        // Status bar removed - status updates handled by UIManager
    }

    // Update map info banner with current map information
    updateMapInfoBanner() {
        const tilemapManager = this.projectController.getTilemapManager();
        if (!tilemapManager || !tilemapManager.currentMap) {
            return;
        }

        const map = tilemapManager.currentMap;
        const mapInfoContent = document.getElementById('map-info-content');
        const mapIdEl = document.getElementById('map-id');
        const mapNameEl = document.getElementById('map-name');
        const mapDimensionsEl = document.getElementById('map-dimensions');

        if (mapInfoContent && mapIdEl && mapNameEl && mapDimensionsEl) {
            // Show the map info content
            mapInfoContent.style.display = 'block';

            // Format map ID with leading zeros (e.g., 001, 002, etc.)
            const mapIdStr = String(map.id).padStart(3, '0');
            mapIdEl.textContent = mapIdStr;

            // Display map name from MapInfos.json (the actual map name)
            // Fallback to displayName from Map file if MapInfos not available
            const mapInfos = this.projectController.getMapInfos();
            const mapInfo = mapInfos && mapInfos[map.id];
            const mapName = (mapInfo && mapInfo.name) ? mapInfo.name : (map.displayName || 'Unnamed Map');
            mapNameEl.textContent = mapName;

            // Display dimensions
            mapDimensionsEl.textContent = `${map.width} x ${map.height}`;
        }

        // Update zoom level
        this.updateMapZoom();
    }

    // Update zoom level display
    updateMapZoom() {
        const tilemapManager = this.projectController.getTilemapManager();
        if (!tilemapManager || !tilemapManager.container) {
            return;
        }

        const zoomEl = document.getElementById('map-zoom');
        if (zoomEl) {
            const scale = tilemapManager.container.scale.x;
            const zoomPercent = Math.round(scale * 100);
            zoomEl.textContent = `${zoomPercent}%`;
        }
    }

    // Update map coordinates display (called from EventManager and MapEditor)
    updateMapCoordinates(x, y) {
        // PERFORMANCE: Skip DOM update if coordinates haven't changed
        if (this.lastDisplayedCoords.x === x && this.lastDisplayedCoords.y === y) {
            return;
        }

        this.lastDisplayedCoords.x = x;
        this.lastDisplayedCoords.y = y;

        const coordsEl = document.getElementById('map-coordinates');

        if (coordsEl) {
            if (x !== null && y !== null) {
                coordsEl.textContent = `${x}, ${y}`;
            } else {
                coordsEl.textContent = '--,--';
            }
        }
    }

    // Initialize Effekseer runtime for animation previews
    initEffekseer() {
        if (typeof effekseer === 'undefined') {
            window._effekseerReady = false;
            return;
        }

        const onLoad = () => {
            window._effekseerReady = true;
        };

        const onError = (message) => {
            window._effekseerReady = false;
        };

        try {
            effekseer.initRuntime('libs/effekseer.wasm', onLoad, onError);
        } catch (e) {
            window._effekseerReady = false;
        }
    }

    setApplicationIcon() {
        // Set the window icon for taskbar/dock (critical for Linux)
        try {
            const win = nw.Window.get();
            const path = require('path');
            const fs = require('fs');
            const appRootCandidates = [
                typeof __dirname !== 'undefined' ? __dirname : null,
                path.join(process.cwd(), 'package.nw'),
                process.cwd(),
                typeof __dirname !== 'undefined' ? path.resolve(__dirname, '..') : null
            ].filter(Boolean);

            const findIcon = (fileName) => {
                for (const root of appRootCandidates) {
                    const candidate = path.join(root, 'images', fileName);
                    if (fs.existsSync(candidate)) return candidate;
                }
                return null;
            };

            const pngIconPath = findIcon('icon.png');
            const icoIconPath = findIcon('icon.ico');

            // Set the window icon - this is what fixes the taskbar icon issue
            win.setShowInTaskbar(true);

            // On Linux, we need to set the icon explicitly at runtime
            if (process.platform === 'linux') {
                // Try multiple approaches for Linux
                if (pngIconPath) win.setIcon(pngIconPath);

                // Also try setting it as a data URL for better compatibility
                if (pngIconPath) {
                    const iconData = fs.readFileSync(pngIconPath);
                    const base64Icon = iconData.toString('base64');
                    const dataUrl = `data:image/png;base64,${base64Icon}`;

                    // Try setting with data URL
                    setTimeout(() => {
                        try {
                            win.setIcon(dataUrl);
                        } catch (e) {
                            // File path method already applied
                        }
                    }, 100);
                }
            } else if (process.platform === 'win32') {
                const iconPath = icoIconPath || pngIconPath;
                if (iconPath) win.setIcon(iconPath);
            }
            // macOS uses .icns from package.json automatically
        } catch (error) {
            // Icon setting is non-critical, silently continue
        }
    }

    centerWindowOnStartup() {
        if (typeof nw === 'undefined') return;

        try {
            const win = nw.Window.get();
            if (typeof win.setPosition === 'function') {
                win.setPosition('center');
                return;
            }

            const width = win.width || 1280;
            const height = win.height || 720;
            const left = Math.max(0, Math.round(((window.screen.availWidth || window.screen.width) - width) / 2));
            const top = Math.max(0, Math.round(((window.screen.availHeight || window.screen.height) - height) / 2));
            win.moveTo(left, top);
        } catch (error) {
            // Centering is a startup nicety; never block app load.
        }
    }

    isWineRuntime() {
        if (typeof process === 'undefined' || process.platform !== 'win32') return false;

        const env = process.env || {};
        if (env.WINEPREFIX || env.WINEARCH || env.WINELOADERNOEXEC || env.WINESERVER || env.WINEDEBUG || env.WINEESYNC || env.WINEFSYNC ||
            env.STEAM_COMPAT_DATA_PATH || env.STEAM_COMPAT_CLIENT_INSTALL_PATH || env.PROTONPATH || env.PROTON_LOG || env.SteamGameId) {
            return true;
        }

        try {
            const fs = require('fs');
            if (fs.existsSync('Z:\\proc\\version') || fs.existsSync('Z:\\usr\\bin\\wine')) {
                return true;
            }
        } catch (error) {
            // Try the Wine registry keys below.
        }

        try {
            const { execFileSync } = require('child_process');
            const options = { stdio: 'ignore', windowsHide: true, timeout: 1000 };
            execFileSync('reg', ['query', 'HKCU\\Software\\Wine'], options);
            return true;
        } catch (error) {
            try {
                const { execFileSync } = require('child_process');
                execFileSync('reg', ['query', 'HKLM\\Software\\Wine'], { stdio: 'ignore', windowsHide: true, timeout: 1000 });
                return true;
            } catch (innerError) {
                return false;
            }
        }
    }

    isFramelessCompatibilityMode() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('rrFrameless') === '1' || params.get('rrWineFrame') === '0';
        } catch (error) {
            return false;
        }
    }

    applyCompatibilityWindowFixes() {
        if (typeof nw === 'undefined') return;

        const framelessCompatibility = this.isFramelessCompatibilityMode();
        const wineRuntime = this.isWineRuntime();
        if (!framelessCompatibility && !wineRuntime) return;

        try {
            if (wineRuntime) document.documentElement.classList.add('rr-wine-runtime');
            if (framelessCompatibility) {
                document.documentElement.classList.add('rr-frameless-runtime');
                this.installCompatibilityTitlebar();
            }
        } catch (error) {
            // Non-critical visual hint only.
        }

        try {
            const win = nw.Window.get();

            // Wine/Proton can expose an empty native menu band in NW.js Windows builds.
            // That shifts painting without shifting hit-testing, so mouse clicks
            // land one title/menu-bar height away from the visible controls.
            try { win.menu = null; } catch (error) {}
            try { win.setShowInTaskbar(true); } catch (error) {}
        } catch (error) {
            // Running under Wine should not prevent the app from loading.
        }
    }

    relaunchFramelessForWine() {
        if (!this.isWineRuntime() || typeof nw === 'undefined') return false;

        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('rrFrameless') === '1' || params.get('rrWineFrame') === '0') return false;

            params.set('rrWineFrame', '0');
            params.set('rrFrameless', '1');
            const url = new URL(window.location.href);
            url.search = params.toString();

            const current = nw.Window.get();
            const options = {
                frame: false,
                toolbar: false,
                show: true,
                width: current.width || 1280,
                height: current.height || 720,
                min_width: 1280,
                min_height: 720,
                position: 'center',
                resizable: true,
                icon: 'images/icon.png'
            };

            nw.Window.open(url.toString(), options, () => {
                try { current.close(true); } catch (error) {}
            });

            return true;
        } catch (error) {
            return false;
        }
    }

    installCompatibilityTitlebar() {
        if (document.getElementById('compat-titlebar')) return;

        const tt = text => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        const titlebar = document.createElement('div');
        titlebar.id = 'compat-titlebar';
        titlebar.innerHTML = `
            <div class="compat-titlebar-icon"><img src="images/icon.png" alt=""></div>
            <div class="compat-titlebar-title"></div>
            <div class="compat-titlebar-controls">
                <button type="button" data-window-action="minimize" title="${tt('Minimize')}">&minus;</button>
                <button type="button" data-window-action="maximize" title="${tt('Maximize')}">□</button>
                <button type="button" data-window-action="close" title="${tt('Close')}">×</button>
            </div>
        `;

        // Seed from the real title rather than a literal: this titlebar used to
        // ship the bundled demo's name and show it for every project, because
        // nothing ever wrote to it after construction.
        const label = titlebar.querySelector('.compat-titlebar-title');
        if (label) label.textContent = document.title || 'Agonia Engine';

        document.body.insertBefore(titlebar, document.body.firstChild);

        const win = nw.Window.get();
        titlebar.querySelector('[data-window-action="minimize"]').addEventListener('click', () => win.minimize());
        titlebar.querySelector('[data-window-action="maximize"]').addEventListener('click', () => {
            try {
                if (this.compatWindowRestoreBounds) {
                    const bounds = this.compatWindowRestoreBounds;
                    this.compatWindowRestoreBounds = null;
                    win.moveTo(bounds.x, bounds.y);
                    win.resizeTo(bounds.width, bounds.height);
                    return;
                }

                this.compatWindowRestoreBounds = {
                    x: win.x,
                    y: win.y,
                    width: win.width,
                    height: win.height
                };

                const screenLeft = typeof window.screen.availLeft === 'number' ? window.screen.availLeft : 0;
                const screenTop = typeof window.screen.availTop === 'number' ? window.screen.availTop : 0;
                win.moveTo(screenLeft, screenTop);
                win.resizeTo(window.screen.availWidth, window.screen.availHeight);
            } catch (error) {
                // Avoid native maximize under Proton; it can reintroduce a host titlebar.
            }
        });
        titlebar.querySelector('[data-window-action="close"]').addEventListener('click', () => {
            this.projectController.requestApplicationClose();
        });
    }
}

// Initialize the application
const reactor = new RPGReactor();

// Make reactor globally accessible for subsystems that need it
window.reactor = reactor;
