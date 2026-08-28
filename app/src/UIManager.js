// Agonia Engine - UI Manager
// Handles UI initialization, menus, keyboard shortcuts, and UI state management

class UIManager {
    constructor(callbacks) {
        // Callbacks to main app
        this.callbacks = callbacks;
        this.projectLoaded = false;
    }

    setupEventHandlers() {
        // Welcome screen buttons
        const welcomeButtons = document.querySelectorAll('.welcome-button');
        welcomeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'new-project') {
                    this.callbacks.newProject();
                } else if (action === 'open-project') {
                    this.callbacks.openProject();
                }
            });
        });

        // Toolbar buttons
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                const tool = e.currentTarget.getAttribute('data-tool');

                if (action) {
                    this.handleToolbarAction(action);
                } else if (tool) {
                    this.setDrawTool(tool);
                }
                // Layer selection is handled by the Layers panel (sidebar).
            });
        });

        // Canvas overlay controls (Grid, HB)
        const ovGrid = document.getElementById('overlay-grid-btn');
        if (ovGrid) {
            ovGrid.addEventListener('click', () => {
                if (this.callbacks.cycleGrid) this.callbacks.cycleGrid();
            });
        }
        const ovHb = document.getElementById('overlay-hb-btn');
        if (ovHb) {
            ovHb.addEventListener('click', () => {
                if (this.callbacks.toggleHitboxes) this.callbacks.toggleHitboxes();
            });
        }
        const ovEv = document.getElementById('overlay-ev-btn');
        if (ovEv) {
            ovEv.addEventListener('click', () => {
                if (this.callbacks.toggleEventView) this.callbacks.toggleEventView();
            });
        }
        const ovLight = document.getElementById('overlay-light-btn');
        if (ovLight) {
            ovLight.addEventListener('click', () => {
                if (this.callbacks.toggleLightPreview) this.callbacks.toggleLightPreview();
            });
        }

        // Mode toggle is a toolbar button now (handled via data-action in handleToolbarAction)

        // Sidebar tree items - delegate event to handle dynamically added items
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tree-item')) {
                document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        });

        // HTML Menu Bar - Setup dropdown behavior
        const menuItems = document.querySelectorAll('.html-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const menuName = item.getAttribute('data-menu');
                const submenu = document.getElementById(`submenu-${menuName}`);

                // Close all other submenus
                document.querySelectorAll('.html-submenu').forEach(sub => {
                    if (sub !== submenu) {
                        sub.style.display = 'none';
                    }
                });

                // Toggle this submenu
                if (submenu) {
                    submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';
                }
            });
        });

        // Close submenus when clicking outside the menu bar
        // Uses pointerdown + capture to fire before anything can swallow the event
        document.addEventListener('pointerdown', (e) => {
            if (!e.target.closest('#html-menu-bar')) {
                document.querySelectorAll('.html-submenu').forEach(sub => {
                    sub.style.display = 'none';
                });
            }
        }, true);

        // HTML Menu Bar - Handle menu option clicks
        document.addEventListener('click', (e) => {
            const option = e.target.closest('.html-menu-option');
            if (option) {
                const action = option.getAttribute('data-action');
                const db = option.getAttribute('data-db');

                // Close all submenus
                document.querySelectorAll('.html-submenu').forEach(sub => {
                    sub.style.display = 'none';
                });

                if (action) {
                    this.handleHtmlMenuAction(action);
                } else if (db) {
                    this.callbacks.openDatabase(db);
                }
            }
        });

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a.external-link');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href) return;
            if (typeof nw !== 'undefined' && nw.Shell?.openExternal) {
                e.preventDefault();
                nw.Shell.openExternal(href);
            }
        });
    }

    handleHtmlMenuAction(action) {
        switch(action) {
            case 'new-project':
                this.callbacks.newProject();
                break;
            case 'open-project':
                this.callbacks.openProject();
                break;
            case 'save-project':
                this.callbacks.saveProject();
                break;
            case 'playtest':
                this.callbacks.playtest();
                break;
            case 'close-project':
                this.callbacks.closeProject();
                break;
            case 'exit':
                if (this.callbacks.exit) this.callbacks.exit();
                break;
            case 'options':
                if (this.callbacks.showOptions) {
                    this.callbacks.showOptions();
                }
                break;
            case 'forge-launcher':
                if (this.callbacks.showForgeLauncher) {
                    this.callbacks.showForgeLauncher();
                }
                break;
            case 'forge-character-generator':
                if (this.callbacks.openForgeTool) {
                    this.callbacks.openForgeTool('character-generator');
                }
                break;
            case 'forge-animation-generator':
                if (this.callbacks.openForgeTool) {
                    this.callbacks.openForgeTool('animation-generator');
                }
                break;
            case 'forge-sound-effect-generator':
                if (this.callbacks.openForgeTool) {
                    this.callbacks.openForgeTool('sound-effect-generator');
                }
                break;
            case 'forge-effekseer-generator':
                if (this.callbacks.openForgeTool) {
                    this.callbacks.openForgeTool('effekseer-generator');
                }
                break;
            case 'manage-plugins':
                if (this.callbacks.showPluginManager) {
                    this.callbacks.showPluginManager();
                }
                break;
            case 'audio-player':
                this.callbacks.showAudioPlayer();
                break;
            case 'mode-tiles':
                if (this.callbacks.disableEventModeIfActive) {
                    this.callbacks.disableEventModeIfActive();
                }
                break;
            case 'toggle-event-mode':
                if (this.callbacks.toggleEventMode) {
                    this.callbacks.toggleEventMode();
                }
                break;
            case 'toggle-light-mode':
                if (this.callbacks.toggleLightMode) {
                    this.callbacks.toggleLightMode();
                }
                break;
            case 'devtools':
                if (typeof nw !== 'undefined') {
                    const win = nw.Window.get();
                    if (typeof win.isDevToolsOpen === 'function' && win.isDevToolsOpen()) {
                        win.closeDevTools();
                    } else {
                        win.showDevTools();
                    }
                }
                break;
            case 'about':
                this.callbacks.showAbout();
                break;
            case 'install-runtime':
                if (this.callbacks.installRuntime) {
                    this.callbacks.installRuntime();
                }
                break;
            case 'migrate-plugins':
                if (this.callbacks.migratePlugins) {
                    this.callbacks.migratePlugins();
                }
                break;
            case 'build-deployment':
                if (this.callbacks.openBuildManager) {
                    this.callbacks.openBuildManager();
                }
                break;
            case 'dist-editor':
                if (this.callbacks.openDistEditor) {
                    this.callbacks.openDistEditor();
                }
                break;
        }
    }

    setupNativeMenu() {
        // Native menus are broken on Linux - using HTML menu bar instead
        return;

        /* DISABLED - Native menu doesn't work on Linux
        if (typeof nw === 'undefined') return;

        const menubar = new nw.Menu({ type: 'menubar' });

        // File menu
        const fileMenu = new nw.Menu();
        fileMenu.append(new nw.MenuItem({
            label: 'New Project',
            click: () => this.callbacks.newProject()
        }));
        fileMenu.append(new nw.MenuItem({
            label: 'Open Project',
            click: () => this.callbacks.openProject()
        }));
        fileMenu.append(new nw.MenuItem({ type: 'separator' }));
        fileMenu.append(new nw.MenuItem({
            label: 'Close Project',
            click: () => this.callbacks.closeProject()
        }));
        fileMenu.append(new nw.MenuItem({ type: 'separator' }));
        fileMenu.append(new nw.MenuItem({
            label: 'Exit',
            click: () => nw.App.quit()
        }));

        menubar.append(new nw.MenuItem({
            label: 'File',
            submenu: fileMenu
        }));

        // Edit menu (only shown when project loaded)
        const editMenu = new nw.Menu();
        editMenu.append(new nw.MenuItem({
            label: 'Undo',
            click: () => console.log('Undo')
        }));
        editMenu.append(new nw.MenuItem({
            label: 'Redo',
            click: () => console.log('Redo')
        }));

        menubar.append(new nw.MenuItem({
            label: 'Edit',
            submenu: editMenu
        }));

        // Database menu (S23: 8 tabs - Предметы+Инвентарь merged)
        const databaseMenu = new nw.Menu();
        databaseMenu.append(new nw.MenuItem({
            label: 'Спрайтер',
            click: () => this.callbacks.openDatabase('spriter')
        }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Бой',
            click: () => this.callbacks.openDatabase('battle')
        }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Инвентарь',
            click: () => this.callbacks.openDatabase('inventory')
        }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Мир',
            click: () => this.callbacks.openDatabase('world')
        }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Интерфейс',
            click: () => this.callbacks.openDatabase('uiStudio')
        }));
        databaseMenu.append(new nw.MenuItem({ type: 'separator' }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Тайлсеты',
            click: () => this.callbacks.openDatabase('tilesets')
        }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Общие события',
            click: () => this.callbacks.openDatabase('commonEvents')
        }));
        databaseMenu.append(new nw.MenuItem({
            label: 'Система',
            click: () => this.callbacks.openDatabase('system')
        }));

        menubar.append(new nw.MenuItem({
            label: 'Database',
            submenu: databaseMenu
        }));

        // Tools menu
        const toolsMenu = new nw.Menu();
        toolsMenu.append(new nw.MenuItem({
            label: '♪ Audio Player',
            click: () => this.callbacks.showAudioPlayer()
        }));

        menubar.append(new nw.MenuItem({
            label: 'Tools',
            submenu: toolsMenu
        }));

        // Help menu
        const helpMenu = new nw.Menu();
        helpMenu.append(new nw.MenuItem({
            label: 'Developer Tools',
            click: () => {
                const win = nw.Window.get();
                if (win.isDevToolsOpen()) {
                    win.closeDevTools();
                } else {
                    win.showDevTools();
                }
            }
        }));
        helpMenu.append(new nw.MenuItem({ type: 'separator' }));
        helpMenu.append(new nw.MenuItem({
            label: 'About Agonia Engine',
            click: () => this.callbacks.showAbout()
        }));

        menubar.append(new nw.MenuItem({
            label: 'Help',
            submenu: helpMenu
        }));

        // DEBUG MENU - Simple test menu
        const debugMenu = new nw.Menu();
        debugMenu.append(new nw.MenuItem({
            label: 'Test Alert',
            click: function() {
                alert('Debug menu item clicked!');
            }
        }));
        debugMenu.append(new nw.MenuItem({
            label: 'Test Console Log',
            click: function() {
                console.log('!!!!! DEBUG MENU CONSOLE LOG !!!!!');
            }
        }));
        debugMenu.append(new nw.MenuItem({
            label: 'Test Both',
            click: function() {
                console.log('!!!!! DEBUG BOTH TEST !!!!!');
                alert('Both console and alert!');
            }
        }));

        menubar.append(new nw.MenuItem({
            label: 'DEBUG',
            submenu: debugMenu
        }));

        nw.Window.get().menu = menubar;
        console.log('Menu setup complete - DEBUG menu should be visible');
        */
    }

    setupKeyboardShortcuts() {
        // Only the F5/F11/F12 branches below need NW.js. Returning early on
        // its absence also removed Ctrl+S, Ctrl+Z/Y, Ctrl+C/X/V and Delete,
        // which left the web editor with no keyboard shortcuts at all.
        const hasNw = typeof nw !== 'undefined';

        /**
         * S51b: are we inside the events context (events / light / npc)?
         * Keyboard shortcuts and edit menus must route to the EVENT manager
         * there - falling through to map actions (Delete → delete the selected
         * MAP!) is exactly the "UI lives its own life" bug class. Falls back
         * to the legacy eventMode flag when the state machine is not wired.
         */
        const eventsCtx = () => {
            if (this.callbacks.getEditingMode) {
                const mode = this.callbacks.getEditingMode();
                if (mode) return mode !== 'tiles';
            }
            const em = this.callbacks.getEventManager ? this.callbacks.getEventManager() : null;
            return !!(em && em.eventMode);
        };
        // Expose for the toolbar/menu handlers below.
        this._eventsContextActive = eventsCtx;

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            // F5 - Reload the editor without Chromium's cached application state.
            if ((e.keyCode === 116 || e.key === 'F5') &&
                !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (!e.repeat) this.confirmApplicationReload();
                return false;
            }

            // F11 - Toggle native NW.js fullscreen mode.
            if ((e.keyCode === 122 || e.key === 'F11') &&
                !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (!hasNw) return false;
                if (!e.repeat) nw.Window.get().toggleFullscreen();
                return false;
            }

            // F12 - Toggle developer tools
            if (e.keyCode === 123 || e.key === 'F12') { // 123 is keyCode for F12
                e.preventDefault();
                e.stopPropagation();
                if (!hasNw) return false;
                const win = nw.Window.get();
                try {
                    if (typeof win.isDevToolsOpen === 'function' && win.isDevToolsOpen()) {
                        win.closeDevTools();
                    } else {
                        win.showDevTools();
                    }
                } catch (err) {
                    // Fallback: just toggle dev tools
                    win.showDevTools();
                }
                return false;
            }

            const shortcut = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey
                ? {
                    KeyN: this.callbacks.newProject,
                    KeyO: this.callbacks.openProject,
                    KeyS: this.callbacks.saveProject,
                    KeyR: this.callbacks.playtest
                }[e.code]
                : null;
            if (shortcut) {
                e.preventDefault();
                e.stopPropagation();
                if (!e.repeat) shortcut();
                return;
            }

            // Database and modal editors own their shortcuts. Do not let map/event
            // shortcuts bleed into them from this global capture handler.
            if (this.isEditorModalOpenForGlobalShortcuts()) {
                return;
            }

            // Ctrl+Z - Undo (only when not in a text input)
            if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
                const activeElement = document.activeElement;
                const isTextInput = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                if (!isTextInput) {
                    e.preventDefault();

                    // Check if event mode is active
                    if (this.callbacks.getEventManager) {
                        const eventManager = this.callbacks.getEventManager();
                        if (eventManager && eventsCtx() && eventManager.canUndo()) {
                            eventManager.undo();
                            return;
                        }
                    }

                    // Otherwise use map editor undo
                    if (this.callbacks.getMapEditor) {
                        const mapEditor = this.callbacks.getMapEditor();
                        if (mapEditor && mapEditor.canUndo()) {
                            mapEditor.undo();
                        }
                    }
                }
            }

            // Ctrl+Y or Ctrl+Shift+Z - Redo (only when not in a text input)
            if ((e.ctrlKey && e.code === 'KeyY') || (e.ctrlKey && e.shiftKey && e.code === 'KeyZ')) {
                const activeElement = document.activeElement;
                const isTextInput = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                if (!isTextInput) {
                    e.preventDefault();

                    // Check if event mode is active
                    if (this.callbacks.getEventManager) {
                        const eventManager = this.callbacks.getEventManager();
                        if (eventManager && eventsCtx() && eventManager.canRedo()) {
                            eventManager.redo();
                            return;
                        }
                    }

                    // Otherwise use map editor redo
                    if (this.callbacks.getMapEditor) {
                        const mapEditor = this.callbacks.getMapEditor();
                        if (mapEditor && mapEditor.canRedo()) {
                            mapEditor.redo();
                        }
                    }
                }
            }

            // Ctrl+C - Copy event (only in event mode)
            if (e.ctrlKey && e.code === 'KeyC') {
                const activeElement = document.activeElement;
                const isTextInput = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                if (!isTextInput) {
                    const eventManager = this.callbacks.getEventManager ? this.callbacks.getEventManager() : null;
                    const selectedMap = document.querySelector('#maps-list .tree-item.selected[data-map-id]');
                    if (!eventsCtx() && selectedMap && window.reactor?.projectController?.copyMap) {
                        e.preventDefault();
                        window.reactor.projectController.copyMap(parseInt(selectedMap.getAttribute('data-map-id')));
                        return;
                    }
                }

                if (!isTextInput && this.callbacks.getEventManager) {
                    const eventManager = this.callbacks.getEventManager();
                    if (eventManager && eventsCtx() && eventManager.selectedEvent) {
                        e.preventDefault();
                        eventManager.copyEvent(eventManager.selectedEvent);
                    }
                }
            }

            // Ctrl+X - Cut event (only in event mode)
            if (e.ctrlKey && e.code === 'KeyX') {
                const activeElement = document.activeElement;
                const isTextInput = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                // Check if event editor is open (don't intercept Ctrl+X)
                const ctxModal = document.getElementById('event-editor-modal');
                const eventEditorOpen = ctxModal && ctxModal.style.display !== 'none';

                if (!isTextInput && !eventEditorOpen) {
                    const eventManager = this.callbacks.getEventManager ? this.callbacks.getEventManager() : null;
                    const selectedMap = document.querySelector('#maps-list .tree-item.selected[data-map-id]');
                    if (!eventsCtx() && selectedMap && window.reactor?.projectController?.copyMap) {
                        e.preventDefault();
                        window.reactor.projectController.copyMap(parseInt(selectedMap.getAttribute('data-map-id')));
                        return;
                    }
                }

                if (!isTextInput && !eventEditorOpen && this.callbacks.getEventManager) {
                    const eventManager = this.callbacks.getEventManager();
                    if (eventManager && eventsCtx() && eventManager.selectedEvent) {
                        e.preventDefault();
                        eventManager.cutEvent(eventManager.selectedEvent);
                    }
                }
            }

            // Ctrl+V - Paste event (only in event mode)
            if (e.ctrlKey && e.code === 'KeyV') {
                const activeElement = document.activeElement;
                const isTextInput = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                // Check if event editor is open (don't intercept Ctrl+V)
                const pasteModal = document.getElementById('event-editor-modal');
                const eventEditorOpenForPaste = pasteModal && pasteModal.style.display !== 'none';

                if (!isTextInput && !eventEditorOpenForPaste && this.callbacks.getEventManager) {
                    const eventManager = this.callbacks.getEventManager();
                    if (eventsCtx()) {
                        e.preventDefault();
                        // Paste at selected tile position or selected event position
                        const x = eventManager.selectedTileX !== null ? eventManager.selectedTileX :
                                  (eventManager.selectedEvent ? eventManager.selectedEvent.x : 0);
                        const y = eventManager.selectedTileY !== null ? eventManager.selectedTileY :
                                  (eventManager.selectedEvent ? eventManager.selectedEvent.y : 0);
                        eventManager.pasteEvent(x, y);
                        return;
                    }
                }

                if (!isTextInput && !eventEditorOpenForPaste && window.reactor?.projectController?.pasteMap) {
                    e.preventDefault();
                    window.reactor.projectController.pasteMap();
                }
            }

            // Delete - Delete event (only in event mode)
            if (e.key === 'Delete') {
                const activeElement = document.activeElement;
                const isTextInput = activeElement && (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                );

                // Check if event editor is open (don't intercept Delete key)
                const delModal = document.getElementById('event-editor-modal');
                const eventEditorOpen = delModal && delModal.style.display !== 'none';

                if (!isTextInput && !eventEditorOpen && this.callbacks.getEventManager) {
                    const eventManager = this.callbacks.getEventManager();
                    if (eventManager && eventsCtx() && eventManager.selectedEvent) {
                        e.preventDefault();
                        eventManager.deleteEvent(eventManager.selectedEvent);
                        return;
                    }

                    const selectedMap = document.querySelector('#maps-list .tree-item.selected[data-map-id], #quick-access-list .tree-item.selected[data-map-id]');
                    if (!eventsCtx() && selectedMap && window.reactor?.projectController?.deleteMap) {
                        e.preventDefault();
                        window.reactor.projectController.deleteMap(parseInt(selectedMap.getAttribute('data-map-id'), 10));
                    }
                } else if (!isTextInput && !eventEditorOpen) {
                    const selectedMap = document.querySelector('#maps-list .tree-item.selected[data-map-id], #quick-access-list .tree-item.selected[data-map-id]');
                    if (selectedMap && window.reactor?.projectController?.deleteMap) {
                        e.preventDefault();
                        window.reactor.projectController.deleteMap(parseInt(selectedMap.getAttribute('data-map-id'), 10));
                    }
                }
            }

            // Arrow keys — nudge selected event (event mode only)
            if (this.callbacks.getEventManager && !this.isEditorModalOpenForGlobalShortcuts()) {
                const em = this.callbacks.getEventManager();
                if (em && eventsCtx() && em.selectedEvent) {
                    const tag = document.activeElement?.tagName;
                    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                    const ctrl = e.ctrlKey || e.metaKey;
                    const ts = 48; // tile size in tile-coords units
                    const snap = em.snapGrid || 0;
                    const step = snap > 0 ? snap / ts : 0.02; // grid step or ~1px in tile coords
                    const mult = ctrl ? 10 : 1;
                    let handled = false;
                    if (e.key === 'ArrowLeft') { em.nudgeSelectedEvent(-step * mult, 0); handled = true; }
                    else if (e.key === 'ArrowRight') { em.nudgeSelectedEvent(step * mult, 0); handled = true; }
                    else if (e.key === 'ArrowUp') { em.nudgeSelectedEvent(0, -step * mult); handled = true; }
                    else if (e.key === 'ArrowDown') { em.nudgeSelectedEvent(0, step * mult); handled = true; }
                    if (handled) { e.preventDefault(); e.stopPropagation(); return; }
                }
            }
        }, true); // Use capture phase

        // Reset nudge undo tracking on keyup
        window.addEventListener('keyup', (e) => {
            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
                if (this.callbacks.getEventManager) {
                    const em = this.callbacks.getEventManager();
                    if (em && em.resetNudgeTracking) em.resetNudgeTracking();
                }
            }
        }, true);
    }

    isEditorModalOpenForGlobalShortcuts() {
        const databaseViewer = document.getElementById('database-viewer');
        if (databaseViewer && databaseViewer.classList.contains('active')) {
            return true;
        }

        const modalIds = [
            'map-properties-modal',
            'image-picker-modal',
            'audio-player-modal',
            'audio-studio-modal',
            'plugin-manager-modal'
        ];

        return modalIds.some(id => {
            const modal = document.getElementById(id);
            return modal && modal.style.display && modal.style.display !== 'none';
        });
    }

    confirmApplicationReload() {
        if (document.getElementById('rr-reload-confirm')) return false;
        const tt = text => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;

        const overlay = document.createElement('div');
        overlay.id = 'rr-reload-confirm';
        overlay.className = 'rr-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'rr-modal';
        modal.style.width = 'min(460px, 92vw)';
        modal.setAttribute('role', 'alertdialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'rr-reload-confirm-title');

        const header = document.createElement('div');
        header.className = 'rr-modal-header';
        const title = document.createElement('div');
        title.id = 'rr-reload-confirm-title';
        title.className = 'rr-modal-title';
        title.textContent = tt('Reload Application?');
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'rr-modal-close';
        closeButton.setAttribute('aria-label', tt('Cancel reload'));
        closeButton.textContent = '\u00d7';
        header.append(title, closeButton);

        const body = document.createElement('div');
        body.className = 'rr-modal-body';
        const message = document.createElement('p');
        message.style.cssText = 'margin:0;color:var(--color-text);line-height:1.5;';
        message.textContent = tt('Reload Agonia Engine and simulate a browser restart?');
        const warning = document.createElement('p');
        warning.style.cssText = 'margin:0;padding:9px 10px;background:var(--color-danger-bg-deep);border:1px solid var(--color-danger-border);border-radius:var(--radius-md);color:var(--color-danger-light);font-weight:600;line-height:1.4;';
        warning.textContent = tt('Any unsaved changes will be lost.');
        body.append(message, warning);

        const footer = document.createElement('div');
        footer.className = 'rr-modal-footer';
        const cancelButton = document.createElement('button');
        cancelButton.id = 'rr-reload-cancel';
        cancelButton.type = 'button';
        cancelButton.className = 'rr-btn-secondary';
        cancelButton.textContent = tt('Cancel');
        const reloadButton = document.createElement('button');
        reloadButton.id = 'rr-reload-accept';
        reloadButton.type = 'button';
        reloadButton.className = 'rr-button-primary';
        reloadButton.textContent = tt('Reload');
        footer.append(cancelButton, reloadButton);
        modal.append(header, body, footer);
        overlay.appendChild(modal);

        const close = () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            overlay.remove();
        };
        const reload = () => {
            close();
            this.reloadApplicationIgnoringCache();
        };
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
            }
        };
        closeButton.addEventListener('click', close);
        cancelButton.addEventListener('click', close);
        reloadButton.addEventListener('click', reload);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) close();
        });
        document.addEventListener('keydown', handleKeyDown, true);
        document.body.appendChild(overlay);
        cancelButton.focus();
        return true;
    }

    promptUnsavedChanges(subject) {
        if (this.unsavedChangesPrompt) return this.unsavedChangesPrompt;
        const tt = text => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        const previouslyFocused = document.activeElement;

        const overlay = document.createElement('div');
        overlay.id = 'rr-unsaved-confirm';
        overlay.className = 'rr-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'rr-modal';
        modal.style.width = 'min(500px, 92vw)';
        modal.setAttribute('role', 'alertdialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'rr-unsaved-confirm-title');

        const header = document.createElement('div');
        header.className = 'rr-modal-header';
        const title = document.createElement('div');
        title.id = 'rr-unsaved-confirm-title';
        title.className = 'rr-modal-title';
        title.textContent = tt('Unsaved Changes');
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'rr-modal-close';
        closeButton.setAttribute('aria-label', tt('Cancel'));
        closeButton.textContent = '\u00d7';
        header.append(title, closeButton);

        const body = document.createElement('div');
        body.className = 'rr-modal-body';
        const message = document.createElement('p');
        message.style.cssText = 'margin:0;color:var(--color-text);line-height:1.5;';
        message.textContent = `${tt('There are unsaved changes in')} ${subject}.`;
        const explanation = document.createElement('p');
        explanation.style.cssText = 'margin:0;color:var(--color-text-muted);line-height:1.5;';
        explanation.textContent = tt('Save your changes, discard them, or cancel this action.');
        body.append(message, explanation);

        const footer = document.createElement('div');
        footer.className = 'rr-modal-footer';
        const cancelButton = document.createElement('button');
        cancelButton.id = 'rr-unsaved-cancel';
        cancelButton.type = 'button';
        cancelButton.className = 'rr-btn-secondary';
        cancelButton.textContent = tt('Cancel');
        const discardButton = document.createElement('button');
        discardButton.id = 'rr-unsaved-discard';
        discardButton.type = 'button';
        discardButton.className = 'rr-button-danger';
        discardButton.textContent = tt('Discard Changes');
        const saveButton = document.createElement('button');
        saveButton.id = 'rr-unsaved-save';
        saveButton.type = 'button';
        saveButton.className = 'rr-button-primary';
        saveButton.textContent = tt('Save');
        footer.append(cancelButton, discardButton, saveButton);
        modal.append(header, body, footer);
        overlay.appendChild(modal);

        this.unsavedChangesPrompt = new Promise(resolve => {
            let settled = false;
            const finish = decision => {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', handleKeyDown, true);
                overlay.remove();
                this.unsavedChangesPrompt = null;
                if (previouslyFocused && previouslyFocused.isConnected !== false &&
                    typeof previouslyFocused.focus === 'function') {
                    previouslyFocused.focus();
                }
                resolve(decision);
            };
            const handleKeyDown = event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    finish('cancel');
                }
            };
            closeButton.addEventListener('click', () => finish('cancel'));
            cancelButton.addEventListener('click', () => finish('cancel'));
            discardButton.addEventListener('click', () => finish('discard'));
            saveButton.addEventListener('click', () => finish('save'));
            overlay.addEventListener('click', event => {
                if (event.target === overlay) finish('cancel');
            });
            document.addEventListener('keydown', handleKeyDown, true);
        });

        document.body.appendChild(overlay);
        cancelButton.focus();
        return this.unsavedChangesPrompt;
    }

    reloadApplicationIgnoringCache() {
        // F5 is offered in the browser build too, where nw is absent.
        const win = typeof nw !== 'undefined' ? nw.Window.get() : null;
        if (win && typeof win.reloadIgnoringCache === 'function') {
            win.reloadIgnoringCache();
        } else {
            window.location.reload();
        }
        return true;
    }

    handleToolbarAction(action) {
        switch(action) {
            case 'new-project':
                this.callbacks.newProject();
                break;
            case 'open-project':
                this.callbacks.openProject();
                break;
            case 'save':
                this.callbacks.saveProject();
                break;
            case 'undo':
                // Check if event mode is active
                if (this.callbacks.getEventManager) {
                    const eventManager = this.callbacks.getEventManager();
                    if (eventsCtx()) {
                        eventManager.undo();
                        break;
                    }
                }
                // Otherwise use map editor undo
                if (this.callbacks.getMapEditor) {
                    const mapEditor = this.callbacks.getMapEditor();
                    if (mapEditor) {
                        mapEditor.undo();
                    }
                }
                break;
            case 'redo':
                // Check if event mode is active
                if (this.callbacks.getEventManager) {
                    const eventManager = this.callbacks.getEventManager();
                    if (eventsCtx()) {
                        eventManager.redo();
                        break;
                    }
                }
                // Otherwise use map editor redo
                if (this.callbacks.getMapEditor) {
                    const mapEditor = this.callbacks.getMapEditor();
                    if (mapEditor) {
                        mapEditor.redo();
                    }
                }
                break;
            case 'playtest':
                this.callbacks.playtest();
                break;
            case 'open-database':
                // Open database with the Spriter tab as default (S14)
                this.callbacks.openDatabase('spriter');
                break;
            case 'open-plugins':
                // Open plugins manager
                if (this.callbacks.showPluginManager) {
                    this.callbacks.showPluginManager();
                }
                break;
            case 'audio-player':
                this.callbacks.showAudioPlayer();
                break;
            case 'forge-launcher':
                if (this.callbacks.showForgeLauncher) {
                    this.callbacks.showForgeLauncher();
                }
                break;
            case 'eraser':
                // Disable event mode if active (switching to tileset mode)
                if (this.callbacks.disableEventModeIfActive) {
                    this.callbacks.disableEventModeIfActive();
                }

                if (this.callbacks.getMapEditor) {
                    const mapEditor = this.callbacks.getMapEditor();
                    if (mapEditor) {
                        const isEraser = !mapEditor.eraserMode;

                        // Deactivate shadow pen when enabling eraser
                        if (isEraser && mapEditor.shadowPenMode) {
                            mapEditor.setShadowPenMode(false);
                        }

                        mapEditor.setEraserMode(isEraser);
                        // Update button visual state
                        const eraserBtn = document.querySelector('[data-action="eraser"]');
                        if (eraserBtn) {
                            if (isEraser) {
                                eraserBtn.classList.add('active');
                            } else {
                                eraserBtn.classList.remove('active');
                            }
                        }
                    }
                }
                break;
            case 'shadow-pen':
                if (this.callbacks.disableEventModeIfActive) {
                    this.callbacks.disableEventModeIfActive();
                }

                if (this.callbacks.getMapEditor) {
                    const mapEditor = this.callbacks.getMapEditor();
                    if (mapEditor) {
                        const isShadowPen = !mapEditor.shadowPenMode;
                        mapEditor.setShadowPenMode(isShadowPen);
                    }
                }
                break;
            case 'mode-tiles':
                if (this.callbacks.disableEventModeIfActive) {
                    this.callbacks.disableEventModeIfActive();
                }
                break;
            case 'toggle-event-mode':
                if (this.callbacks.toggleEventMode) {
                    this.callbacks.toggleEventMode();
                }
                break;
            case 'toggle-light-mode':
                if (this.callbacks.toggleLightMode) {
                    this.callbacks.toggleLightMode();
                }
                break;
            case 'toggle-npc-mode':
                if (this.callbacks.toggleNpcMode) {
                    this.callbacks.toggleNpcMode();
                }
                break;
            case 'toggle-event-tool':
                if (this.callbacks.toggleEventTool) {
                    this.callbacks.toggleEventTool();
                }
                break;
        }
    }

    setDrawTool(tool) {
        if (!this.callbacks.getMapEditor) return;

        // Disable event mode if active (switching to tileset mode)
        if (this.callbacks.disableEventModeIfActive) {
            this.callbacks.disableEventModeIfActive();
        }

        const mapEditor = this.callbacks.getMapEditor();
        if (!mapEditor) return;

        // Deactivate shadow pen when switching to a drawing tool
        if (mapEditor.shadowPenMode) {
            mapEditor.setShadowPenMode(false);
        }

        mapEditor.setTool(tool);

        // Update button visual states
        document.querySelectorAll('.tool-draw-mode').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    // Layer mode is now driven by the Layers panel; this stub kept for any
    // external callers, forwarded to MapEditor so behavior is preserved.
    setLayerMode(layer) {
        if (!this.callbacks.getMapEditor) return;
        const mapEditor = this.callbacks.getMapEditor();
        if (!mapEditor) return;
        const layerValue = layer === 'auto' ? 'auto' : parseInt(layer);
        if (mapEditor.setLayerMode) mapEditor.setLayerMode(layerValue);
    }

    updateUndoRedoButtons(canUndo, canRedo) {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');

        if (undoBtn) {
            undoBtn.disabled = !canUndo;
            undoBtn.style.opacity = canUndo ? '1.0' : '0.5';
        }

        if (redoBtn) {
            redoBtn.disabled = !canRedo;
            redoBtn.style.opacity = canRedo ? '1.0' : '0.5';
        }
    }

    showWelcomeScreen() {
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('editor-ui').style.display = 'none';
        document.getElementById('toolbar').style.display = 'none';
        this.projectLoaded = false;
    }

    showEditorUI() {
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('editor-ui').style.display = 'flex';
        document.getElementById('toolbar').style.display = 'flex';
        this.projectLoaded = true;

        this.refreshGridButton();

        // Scale toolbar icons after toolbar becomes visible
        requestAnimationFrame(() => {
            if (window.reactor) {
                window.reactor.scaleToolbarIcons();
            }
        });
    }

    setGrid(value, locked) {
        const btn = document.getElementById('overlay-grid-btn');
        if (!btn) return;
        const label = value === 0 ? 'Off' : String(value);
        btn.textContent = label;
        btn.classList.toggle('active', value !== 48);
        btn.style.opacity = locked ? '0.5' : '';
        btn.style.pointerEvents = locked ? 'none' : '';
    }

    refreshGridButton() {
        const locked = this.callbacks.isGridLockedTileset ? this.callbacks.isGridLockedTileset() : false;
        let value = this.callbacks.getGrid ? this.callbacks.getGrid() : 48;
        if (locked) value = 48;
        this.setGrid(value, locked);
    }

    updateStatus(message) {
        // Status bar removed - status updates are visual only
    }
}
