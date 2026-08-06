// Agonia Engine - Event Manager
// Handles event creation, editing, and management on maps

class EventManager {
    constructor(projectController, databaseManager) {
        this.projectController = projectController;
        this.databaseManager = databaseManager;
        this.currentMap = null;
        this.selectedEvent = null;
        this.clipboard = null; // For cut/copy/paste
        this.eventMode = false; // Whether event editing mode is active
        this.eventSprites = new Map(); // Map of event ID to sprite
        this.eventContainer = null; // Pixi container for event sprites
        this.contextMenu = null;
        this.findDialog = null;
        this.currentSearchResults = [];
        this.currentSearchIndex = 0;
        this.hoverHighlight = null; // Graphics for hover highlighting
        this.selectionHighlight = null; // Graphics for selection highlighting (stays on clicked tile)
        this.selectedTileX = null; // Currently selected tile X
        this.selectedTileY = null; // Currently selected tile Y
        this.isDragging = false; // Whether we're currently dragging an event
        this.draggedEvent = null; // The event being dragged
        this.dragOffset = { x: 0, y: 0 }; // Offset from event position to mouse position
        this.snapGrid = 48; // Grid snap for event placement (shared with MapEditor)
        this.eventViewMode = 'game'; // 'game' | 'minimal'
        this._sheetCache = {};
        this._tilesetNamesCache = null;
        this._dragStartX = 0; // Axis-lock: drag start position
        this._dragStartY = 0;
        this._dragAxisLock = null; // null | 'x' | 'y' (set when Shift held)
        this.startingPositionContainer = null; // Container for starting position markers
        this.contextMenuCloseHandler = null; // Context menu close handler reference
        this.tilesetPaletteViewer = null; // Reference to tileset palette viewer for tile selection
        this.sidebarResizer = null; // Reference to sidebar resizer for updating handle visibility
        this._eventInteractionContainer = null;
        this._eventContextMenuCanvas = null;
        this._eventContextMenuHandler = null;
        this._lastMapClickTime = 0;
        this._lastMapClickX = null;
        this._lastMapClickY = null;

        // Undo/Redo system
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50; // Maximum number of undo steps to store

        // Event editor
        this.eventEditor = null; // Will be initialized when needed

        // Callbacks
        this.onCoordinatesChange = null; // Callback for when mouse coordinates change
        this.onUndoStateChange = null; // Callback for when undo/redo availability changes

        // Setup event editor modal close button
        this.setupEventEditorModal();
    }

    // Set tileset palette viewer reference
    setTilesetPaletteViewer(viewer) {
        this.tilesetPaletteViewer = viewer;
    }

    // Set sidebar resizer reference
    setSidebarResizer(resizer) {
        this.sidebarResizer = resizer;
    }

    // Undo/Redo system methods
    saveState() {
        if (!this.currentMap) return;

        // Save a deep copy of the current events array
        const eventsData = JSON.parse(JSON.stringify(this.currentMap.events || []));
        this.undoStack.push(eventsData);

        // Clear redo stack on new action
        this.redoStack = [];

        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }

        // Notify about undo state change
        this.notifyUndoStateChange();
    }

    undo() {
        if (this.undoStack.length === 0) return;

        // Save current state to redo stack
        const currentData = JSON.parse(JSON.stringify(this.currentMap.events || []));
        this.redoStack.push(currentData);

        // Restore previous state
        const previousData = this.undoStack.pop();
        this.currentMap.events = previousData;

        // Clear selection if the selected event no longer exists
        if (this.selectedEvent) {
            const eventStillExists = this.currentMap.events.find(e => e && e.id === this.selectedEvent.id);
            if (!eventStillExists) {
                this.selectedEvent = null;
                this.selectedTileX = null;
                this.selectedTileY = null;
            }
        }

        // Re-render events
        this.renderEvents();

        // Notify about undo state change
        this.notifyUndoStateChange();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        // Save current state to undo stack
        const currentData = JSON.parse(JSON.stringify(this.currentMap.events || []));
        this.undoStack.push(currentData);

        // Restore next state
        const nextData = this.redoStack.pop();
        this.currentMap.events = nextData;

        // Clear selection if the selected event no longer exists
        if (this.selectedEvent) {
            const eventStillExists = this.currentMap.events.find(e => e && e.id === this.selectedEvent.id);
            if (!eventStillExists) {
                this.selectedEvent = null;
                this.selectedTileX = null;
                this.selectedTileY = null;
            }
        }

        // Re-render events
        this.renderEvents();

        // Notify about undo state change
        this.notifyUndoStateChange();
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    clearUndoHistory() {
        this.undoStack = [];
        this.redoStack = [];
        this.notifyUndoStateChange();
    }

    notifyUndoStateChange() {
        if (this.onUndoStateChange) {
            this.onUndoStateChange(this.canUndo(), this.canRedo());
        }
    }

    // Initialize event layer and container
    initializeEventLayer(tilemapManager) {
        if (!tilemapManager || !tilemapManager.container) {
            console.warn('Cannot initialize event layer: tilemap manager not ready');
            return;
        }

        // Remove old containers if they exist and parent has changed
        if (this.eventContainer && this.eventContainer.parent !== tilemapManager.container) {
            if (this.eventContainer.parent) {
                this.eventContainer.parent.removeChild(this.eventContainer);
            }
            this.eventContainer = null;
        }

        if (this.hoverHighlight && this.hoverHighlight.parent !== tilemapManager.container) {
            if (this.hoverHighlight.parent) {
                this.hoverHighlight.parent.removeChild(this.hoverHighlight);
            }
            this.hoverHighlight = null;
        }

        if (this.selectionHighlight && this.selectionHighlight.parent !== tilemapManager.container) {
            if (this.selectionHighlight.parent) {
                this.selectionHighlight.parent.removeChild(this.selectionHighlight);
            }
            this.selectionHighlight = null;
        }

        if (this.startingPositionContainer && this.startingPositionContainer.parent !== tilemapManager.container) {
            if (this.startingPositionContainer.parent) {
                this.startingPositionContainer.parent.removeChild(this.startingPositionContainer);
            }
            this.startingPositionContainer = null;
        }

        // Create event container if it doesn't exist
        if (!this.eventContainer) {
            this.eventContainer = new PIXI.Container();
            this.eventContainer.label = 'events';
            tilemapManager.container.addChild(this.eventContainer);
            console.log('Event container created');
        }

        // Create hover highlight graphics (not used in event mode)
        if (!this.hoverHighlight) {
            this.hoverHighlight = new PIXI.Graphics();
            this.hoverHighlight.visible = false;
            tilemapManager.container.addChild(this.hoverHighlight);
        }

        // Create selection highlight graphics (stays on selected tile)
        if (!this.selectionHighlight) {
            this.selectionHighlight = new PIXI.Graphics();
            this.selectionHighlight.visible = false;
            tilemapManager.container.addChild(this.selectionHighlight);
        }

        // Create starting position container
        if (!this.startingPositionContainer) {
            this.startingPositionContainer = new PIXI.Container();
            this.startingPositionContainer.label = 'startingPositions';
            tilemapManager.container.addChild(this.startingPositionContainer);
        }

        this.tilemapManager = tilemapManager;
    }

    // Set the current map
    setCurrentMap(mapData) {
        this.currentMap = mapData;
        this.selectedEvent = null;
        this._sheetCache = {};
        this._tilesetNamesCache = null;

        // Re-initialize event layer for the new map
        if (this.tilemapManager) {
            this.initializeEventLayer(this.tilemapManager);
        }

        this.renderEvents();

        // Re-establish event interaction if event mode is active
        if (this.eventMode) {
            this.setupEventInteraction();
            this.renderStartingPositions();
        }
    }

    // Enable/disable event mode
    setEventMode(enabled) {
        this.eventMode = enabled;
        console.log(`Event mode: ${enabled ? 'enabled' : 'disabled'}`);

        if (enabled) {
            this.setupEventInteraction();
            this.renderStartingPositions(); // Show starting positions when entering event mode
            if (this.startingPositionContainer) {
                this.startingPositionContainer.visible = true;
            }
            // Set cursor for event mode
            if (this.tilemapManager && this.tilemapManager.container) {
                this.tilemapManager.container.cursor = 'default';
            }
        } else {
            this.removeEventInteraction();
            // Hide starting positions when leaving event mode
            if (this.startingPositionContainer) {
                this.startingPositionContainer.visible = false;
            }
            // Restore cursor for tile editing mode
            if (this.tilemapManager && this.tilemapManager.container) {
                this.tilemapManager.container.cursor = 'crosshair';
            }
            // Hide coordinate display when leaving event mode
            if (this.onCoordinatesChange) {
                this.onCoordinatesChange(null, null);
            }
        }
    }

    // Set up right-click context menu and event interaction
    setupEventInteraction() {
        if (!this.tilemapManager || !this.tilemapManager.container) {
            console.warn('Cannot setup event interaction: tilemap manager not ready');
            return;
        }

        const container = this.tilemapManager.container;
        if (this._eventInteractionContainer === container) return;
        if (this._eventInteractionContainer) this.removeEventInteraction();
        this._eventInteractionContainer = container;
        this._eventPointerHandlers = {};
        const on = (eventName, handler) => {
            this._eventPointerHandlers[eventName] = handler;
            container.on(eventName, handler);
        };

        // Make container interactive
        container.interactive = true;
        container.cursor = 'default';

        // Disable browser context menu on the canvas
        const canvasElement = container.view || document.querySelector('canvas');
        if (canvasElement && this._eventContextMenuCanvas !== canvasElement) {
            if (this._eventContextMenuCanvas && this._eventContextMenuHandler) {
                this._eventContextMenuCanvas.removeEventListener('contextmenu', this._eventContextMenuHandler);
            }
            this._eventContextMenuHandler = (e) => {
                e.preventDefault();
                return false;
            };
            this._eventContextMenuCanvas = canvasElement;
            canvasElement.addEventListener('contextmenu', this._eventContextMenuHandler);
        }

        // Mouse move handler - not needed in event mode, selection stays on clicked tile
        // (hover highlighting is only for tileset mode)

        // Mouse leave handler
        on('pointerleave', () => {
            // Selection highlight stays visible even when mouse leaves
        });

        // Right-click handler
        on('rightdown', (event) => {
            event.stopPropagation();
            event.data.originalEvent.preventDefault();
            this.resetMapClickTracking();

            // Suppress the native browser/NW.js context menu that follows this pointerdown
            const suppressContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); };
            document.addEventListener('contextmenu', suppressContextMenu, { capture: true, once: true });

            // Cancel any ongoing drag
            if (this.isDragging) {
        this.isDragging = false;
        this.draggedEvent = null;
        this._dragAxisLock = null;
        this._clearDragGuides();
                this.dragOffset = { x: 0, y: 0 };
                if (this.tilemapManager.container) {
                    this.tilemapManager.container.cursor = 'default';
                }
            }

            const pos = event.data.getLocalPosition(container);
            const ts = this.tilemapManager.TILE_WIDTH;
            const px = pos.x / ts;
            const py = pos.y / ts;
            const tileX = Math.floor(px);
            const tileY = Math.floor(py);

            // Update selection to this tile
            this.selectTile(tileX, tileY);

            // Check if there's an event at this position (use fractional for hitbox)
            const eventAtPos = this.getEventAt(px, py);

            // Use the original mouse event position for context menu
            const mouseX = event.data.originalEvent.clientX;
            const mouseY = event.data.originalEvent.clientY;

            this.showContextMenu(mouseX, mouseY, tileX, tileY, eventAtPos);
        });

        on('pointerdown', (event) => {
            this.handleMapPointerDown(event, container);
        });

        // Mouse move handler for dragging
        on('pointermove', (event) => {
            if (this.isDragging && this.draggedEvent) {
                this.updateDrag(event);
            }
        });

        // Mouse up handler for finishing drag
        on('pointerup', (event) => {
            if (this.isDragging) {
                this.finishDragging(event);
            }
        });

        on('pointerupoutside', (event) => {
            if (this.isDragging) {
                this.finishDragging(event);
            }
        });
    }

    // Remove event interaction
    removeEventInteraction() {
        const container = this._eventInteractionContainer;
        if (container) {
            for (const [eventName, handler] of Object.entries(this._eventPointerHandlers || {})) {
                container.off(eventName, handler);
            }
        }
        this._eventPointerHandlers = null;
        this._eventInteractionContainer = null;
        this.resetMapClickTracking();

        if (this._eventContextMenuCanvas && this._eventContextMenuHandler) {
            this._eventContextMenuCanvas.removeEventListener('contextmenu', this._eventContextMenuHandler);
            this._eventContextMenuCanvas = null;
            this._eventContextMenuHandler = null;
        }

        // Hide selection highlight when leaving event mode
        if (this.selectionHighlight) {
            this.selectionHighlight.visible = false;
        }

        // Clear selected tile
        this.selectedTileX = null;
        this.selectedTileY = null;

        // Cancel any ongoing drag
        this.isDragging = false;
        this.draggedEvent = null;
    }

    resetMapClickTracking() {
        this._lastMapClickTime = 0;
        this._lastMapClickX = null;
        this._lastMapClickY = null;
    }

    handleMapPointerDown(event, container = this.tilemapManager?.container) {
        if (!this.eventMode || !this.currentMap || !container ||
            event.data.button !== 0 || event.data.originalEvent?.shiftKey) {
            this.resetMapClickTracking();
            return;
        }

        const pos = event.data.getLocalPosition(container);
        const ctrl = event.data.originalEvent?.ctrlKey;
        const snap = ctrl ? 0 : (this.snapGrid || 0);
        const ts = this.tilemapManager.TILE_WIDTH;
        const evX = snap > 0 ? Math.floor(pos.x / snap) * snap / ts : pos.x / ts;
        const evY = snap > 0 ? Math.floor(pos.y / snap) * snap / ts : pos.y / ts;
        const tileX = Math.floor(evX);
        const tileY = Math.floor(evY);
        if (tileX < 0 || tileX >= this.currentMap.width || tileY < 0 || tileY >= this.currentMap.height) {
            this.resetMapClickTracking();
            return;
        }

        const currentTime = Date.now();
        const isDoubleClick = currentTime - this._lastMapClickTime < 300 &&
            this._lastMapClickX === tileX && this._lastMapClickY === tileY;

        if (isDoubleClick) {
            this.resetMapClickTracking();
            const eventAtPos = this.getEventAt(evX, evY);
            if (eventAtPos) this.editEvent(eventAtPos);
            else this.createNewEvent(evX, evY);
            return;
        }

        this._lastMapClickTime = currentTime;
        this._lastMapClickX = tileX;
        this._lastMapClickY = tileY;
        this.selectTile(tileX, tileY);

        const eventAtPos = this.getEventAt(evX, evY);
        if (!eventAtPos && this.tilesetPaletteViewer) {
            const selectedTiles = this.tilesetPaletteViewer.getSelectedTiles();
            if (selectedTiles && selectedTiles.length > 0) {
                const tile = selectedTiles[0];
                const tileId = this.convertToTileId(tile.layer, tile.x, tile.y);
                if (tileId > 0) {
                    this.createNewEventWithTileset(evX, evY, tileId);
                    this.tilesetPaletteViewer.clearSelection();
                    return;
                }
            }
        }

        this.selectEvent(eventAtPos);
        if (eventAtPos) this.startDragging(eventAtPos, event);
    }

    // Select a tile (shows persistent highlight)
    selectTile(tileX, tileY) {
        if (!this.currentMap) return;

        // Check if tile is within map bounds (use floor for fractional coords)
        const bx = Math.floor(tileX), by = Math.floor(tileY);
        if (bx < 0 || bx >= this.currentMap.width || by < 0 || by >= this.currentMap.height) {
            return;
        }

        // Update selected tile position
        this.selectedTileX = tileX;
        this.selectedTileY = tileY;

        // Update the selection highlight
        this.updateSelectionHighlight();

        // Update coordinate display in event mode
        if (this.eventMode && this.onCoordinatesChange) {
            this.onCoordinatesChange(tileX, tileY);
        }
    }

    // Update selection highlight (stays on selected tile)
    updateSelectionHighlight() {
        if (!this.selectionHighlight || !this.currentMap) return;

        if (this.selectedTileX === null || this.selectedTileY === null) {
            this.selectionHighlight.visible = false;
            return;
        }

        // Clear and redraw highlight
        this.selectionHighlight.clear();

        const tileWidth = this.tilemapManager.TILE_WIDTH;
        const tileHeight = this.tilemapManager.TILE_HEIGHT;

        // Check if there's an event at this position
        const eventAtPos = this.getEventAt(this.selectedTileX, this.selectedTileY);

        // Draw gold highlight for tiles with events, cyan for empty tiles
        const color = eventAtPos ? 0xFFD700 : 0x00ffff;
        const alpha = eventAtPos ? 0.35 : 0.3;

        // PIXI v8 API - draw filled rectangle
        this.selectionHighlight.rect(
            this.selectedTileX * tileWidth,
            this.selectedTileY * tileHeight,
            tileWidth,
            tileHeight
        );
        this.selectionHighlight.fill({ color: color, alpha: alpha });

        // Border (thicker for selection) - PIXI v8 API
        this.selectionHighlight.rect(
            this.selectedTileX * tileWidth,
            this.selectedTileY * tileHeight,
            tileWidth,
            tileHeight
        );
        this.selectionHighlight.stroke({ color: color, width: 3, alpha: 1.0 });

        this.selectionHighlight.visible = true;
    }

    // Show context menu
    showContextMenu(x, y, tileX, tileY, eventAtPos) {
        // Remove existing context menu if any
        this.hideContextMenu();

        // Create context menu
        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'event-context-menu';
        this.contextMenu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background-color: var(--color-bg-menubar);
            border: 1px solid var(--color-border);
            border-radius: 4px;
            padding: 4px 0;
            z-index: 10001;
            min-width: 200px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        `;

        // Check if tiles are selected from palette for creating tileset events
        const createEventAction = () => {
            console.log('createEventAction called!');
            console.log('tilesetPaletteViewer exists?', !!this.tilesetPaletteViewer);

            // Check if tiles are selected from palette
            if (this.tilesetPaletteViewer) {
                const selectedTiles = this.tilesetPaletteViewer.getSelectedTiles();
                console.log('Context menu - Selected tiles from palette:', selectedTiles);
                if (selectedTiles && selectedTiles.length > 0) {
                    const tile = selectedTiles[0];
                    console.log('Context menu - First selected tile:', tile);
                    const tileId = this.convertToTileId(tile.layer, tile.x, tile.y);
                    console.log('Context menu - Converted tileId:', tileId);
                    if (tileId > 0) {
                        this.createNewEventWithTileset(tileX, tileY, tileId);
                        // Clear selection after creating event to prevent creating multiple
                        this.tilesetPaletteViewer.clearSelection();
                        return;
                    }
                }
            }
            // Fall back to regular event creation
            this.createNewEvent(tileX, tileY);
        };

        // Menu items
        const menuItems = [
            { label: this._t('eventCtx.newEvent'), action: createEventAction, enabled: !eventAtPos },
            { label: this._t('eventCtx.editEvent'), action: () => this.editEvent(eventAtPos), enabled: !!eventAtPos },
            { separator: true },
            { label: this._t('eventCtx.cutEvent'), action: () => this.cutEvent(eventAtPos), enabled: !!eventAtPos },
            { label: this._t('eventCtx.copyEvent'), action: () => this.copyEvent(eventAtPos), enabled: !!eventAtPos },
            { label: this._t('eventCtx.pasteEvent'), action: () => this.pasteEvent(tileX, tileY), enabled: true },
            { label: this._t('eventCtx.deleteEvent'), action: () => this.deleteEvent(eventAtPos), enabled: !!eventAtPos },
            { separator: true },
            { label: this._t('eventCtx.findEvent'), action: () => this.showFindDialog(), enabled: true },
            { label: this._t('eventCtx.findNext'), action: () => this.findNext(), enabled: this.currentSearchResults.length > 0 },
            { label: this._t('eventCtx.findPrev'), action: () => this.findPrevious(), enabled: this.currentSearchResults.length > 0 },
            { separator: true },
            { label: this._t('eventCtx.setStart'), submenu: [
                { label: this._t('eventCtx.player'), action: () => this.setStartingPosition(tileX, tileY, 'player') },
                { label: this._t('eventCtx.boat'), action: () => this.setStartingPosition(tileX, tileY, 'boat') },
                { label: this._t('eventCtx.ship'), action: () => this.setStartingPosition(tileX, tileY, 'ship') },
                { label: this._t('eventCtx.airship'), action: () => this.setStartingPosition(tileX, tileY, 'airship') }
            ] }
        ];

        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: var(--color-border); margin: 4px 0;';
                this.contextMenu.appendChild(separator);
            } else if (item.submenu) {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                menuItem.textContent = item.label + ' ▶';
                menuItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 13px;
                    color: var(--color-text);
                    position: relative;
                `;

                // Create submenu
                const submenu = document.createElement('div');
                submenu.style.cssText = `
                    position: absolute;
                    left: 100%;
                    top: 0;
                    background-color: var(--color-bg-menubar);
                    border: 1px solid var(--color-border);
                    border-radius: 4px;
                    padding: 4px 0;
                    min-width: 150px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                    display: none;
                `;

                item.submenu.forEach(subItem => {
                    const subMenuItem = document.createElement('div');
                    subMenuItem.className = 'context-menu-item';
                    subMenuItem.textContent = subItem.label;
                    subMenuItem.style.cssText = `
                        padding: 8px 16px;
                        cursor: pointer;
                        font-size: 13px;
                        color: var(--color-text);
                    `;

                    subMenuItem.addEventListener('click', () => {
                        subItem.action();
                        this.hideContextMenu();
                    });

                    subMenuItem.addEventListener('mouseenter', () => {
                        subMenuItem.style.backgroundColor = 'var(--color-accent-tint-25)';
                    });

                    subMenuItem.addEventListener('mouseleave', () => {
                        subMenuItem.style.backgroundColor = 'transparent';
                    });

                    submenu.appendChild(subMenuItem);
                });

                menuItem.appendChild(submenu);

                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.backgroundColor = 'var(--color-accent-tint-25)';
                    submenu.style.display = 'block';
                });

                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.backgroundColor = 'transparent';
                    submenu.style.display = 'none';
                });

                this.contextMenu.appendChild(menuItem);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                menuItem.textContent = item.label;
                menuItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: ${item.enabled ? 'pointer' : 'not-allowed'};
                    font-size: 13px;
                    color: ${item.enabled ? 'var(--color-text)' : 'var(--color-text-dim)'};
                `;

                if (item.enabled) {
                    menuItem.addEventListener('click', () => {
                        item.action();
                        this.hideContextMenu();
                    });

                    menuItem.addEventListener('mouseenter', () => {
                        menuItem.style.backgroundColor = 'var(--color-accent-tint-25)';
                    });

                    menuItem.addEventListener('mouseleave', () => {
                        menuItem.style.backgroundColor = 'transparent';
                    });
                }

                this.contextMenu.appendChild(menuItem);
            }
        });

        document.body.appendChild(this.contextMenu);

        // Adjust position if menu overflows the viewport
        const menuRect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (menuRect.bottom > viewportHeight) {
            this.contextMenu.style.top = Math.max(0, viewportHeight - menuRect.height) + 'px';
        }
        if (menuRect.right > viewportWidth) {
            this.contextMenu.style.left = Math.max(0, viewportWidth - menuRect.width) + 'px';
        }

        // Close context menu when clicking elsewhere
        const closeHandler = (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', closeHandler);
            }
        };

        // Store the close handler so we can remove it later
        this.contextMenuCloseHandler = closeHandler;

        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 10);
    }

    // Hide context menu
    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }

        // Remove the close handler if it exists
        if (this.contextMenuCloseHandler) {
            document.removeEventListener('click', this.contextMenuCloseHandler);
            this.contextMenuCloseHandler = null;
        }
    }

    // Get event at position
    getEventAt(x, y) {
        if (!this.currentMap || !this.currentMap.events) return null;
        return this.currentMap.events.find(event =>
            event && event.x <= x && x < event.x + 1 && event.y <= y && y < event.y + 1
        );
    }

    // Select an event
    selectEvent(event) {
        const previousEvent = this.selectedEvent;
        this.selectedEvent = event;
        this.notifyEventSelected(event);

        if (event) {
            this.selectedTileX = event.x;
            this.selectedTileY = event.y;
        }

        // Hide tile-cell highlight when an event is selected — the sprite
        // border is the selection visual now.
        if (this.selectionHighlight) this.selectionHighlight.visible = false;

        // Update only the border color on affected sprites instead of full re-render
        if (previousEvent && previousEvent.id !== (event && event.id)) {
            this.updateEventSpriteBorder(previousEvent.id, false);
        }
        if (event) {
            this.updateEventSpriteBorder(event.id, true);
        }

        this.updateEventListSelection(); // Update sidebar list selection
    }

    // Update just the border color on an event sprite (green=selected, white=normal)
    updateEventSpriteBorder(eventId, isSelected) {
        const sprite = this.eventSprites.get(eventId);
        if (!sprite || !sprite.children || sprite.children.length === 0) return;

        // The first child is the Graphics object with background + border
        const graphics = sprite.children[0];
        if (!(graphics instanceof PIXI.Graphics)) return;

        const tileWidth = this.tilemapManager.TILE_WIDTH;
        const tileHeight = this.tilemapManager.TILE_HEIGHT;
        const borderColor = isSelected ? 0x00ff00 : 0xffffff;
        const borderWidth = isSelected ? 2 : 1;

        // Rebuild graphics (background + border)
        graphics.clear();
        graphics.rect(0, 0, tileWidth, tileHeight);
        graphics.fill({ color: 0x000000, alpha: 0.75 });
        graphics.rect(0, 0, tileWidth, tileHeight);
        graphics.stroke({ width: borderWidth, color: borderColor, alpha: 1.0 });
    }

    // Select an event by ID
    /**
     * Announce the current selection.
     *
     * Announced rather than pushed at the 3D viewport directly: selection is
     * driven from the map, the events panel and the editor itself, and each of
     * those already funnels through `selectEvent`.
     */
    notifyEventSelected(event) {
        if (typeof document === 'undefined' || typeof CustomEvent !== 'function') return;
        document.dispatchEvent(new CustomEvent('rr-event-selected', {
            detail: { eventId: event ? event.id : null }
        }));
    }

    selectEventById(eventId) {
        if (!this.currentMap || !this.currentMap.events) return;

        const event = this.currentMap.events.find(e => e && e.id === eventId);
        if (event) {
            this.selectEvent(event);
        }
    }

    // Start dragging an event
    startDragging(event, pointerEvent) {
        this._dragStateSaved = false;
        this.isDragging = true;
        this.draggedEvent = event;
        this._dragStartX = event.x;
        this._dragStartY = event.y;
        this._dragAxisLock = null;

        const pos = pointerEvent.data.getLocalPosition(this.tilemapManager.container);
        const eventPixelX = event.x * this.tilemapManager.TILE_WIDTH;
        const eventPixelY = event.y * this.tilemapManager.TILE_HEIGHT;
        this.dragOffset.x = pos.x - eventPixelX;
        this.dragOffset.y = pos.y - eventPixelY;

        if (this.tilemapManager.container) {
            this.tilemapManager.container.cursor = 'grabbing';
        }
    }

    // Update drag position
    updateDrag(pointerEvent) {
        if (!this.isDragging || !this.draggedEvent) return;

        const pos = pointerEvent.data.getLocalPosition(this.tilemapManager.container);
        const shift = pointerEvent.data.originalEvent?.shiftKey;
        const ctrl = pointerEvent.data.originalEvent?.ctrlKey;
        const ts = this.tilemapManager.TILE_WIDTH;
        const snap = ctrl ? 0 : (this.snapGrid || 0);

        let newPixelX = pos.x - this.dragOffset.x;
        let newPixelY = pos.y - this.dragOffset.y;

        // Shift = axis lock: determine dominant axis on first significant move
        if (shift) {
            if (!this._dragAxisLock) {
                const dx = Math.abs(newPixelX - this._dragStartX * ts);
                const dy = Math.abs(newPixelY - this._dragStartY * ts);
                if (dx > 3 || dy > 3) {
                    this._dragAxisLock = dx >= dy ? 'x' : 'y';
                }
            }
            if (this._dragAxisLock === 'x') {
                newPixelY = this._dragStartY * ts;
            } else if (this._dragAxisLock === 'y') {
                newPixelX = this._dragStartX * ts;
            }
        } else {
            this._dragAxisLock = null;
        }

        // Snap to grid (or free if snap=0/Ctrl)
        let newX = snap > 0 ? Math.floor(newPixelX / snap) * snap / ts : newPixelX / ts;
        let newY = snap > 0 ? Math.floor(newPixelY / snap) * snap / ts : newPixelY / ts;

        // Magnetic alignment in free mode (snap=0, no Ctrl)
        if (snap === 0 && !ctrl) {
            const anchors = this._collectDragAnchors();
            const threshold = 8;
            let bestX = null, bestXDist = threshold;
            let bestY = null, bestYDist = threshold;
            let guideX = null, guideY = null;
            const px = newX * ts, py = newY * ts;
            const xCands = [px, px + ts / 2, px + ts];
            const yCands = [py, py + ts / 2, py + ts];
            for (const a of anchors) {
                if (a.axis === 'x') {
                    for (let i = 0; i < xCands.length; i++) {
                        const d = Math.abs(xCands[i] - a.pos);
                        if (d < bestXDist) { bestXDist = d; bestX = a.pos - i * (ts / 2); guideX = a.pos; }
                    }
                } else {
                    for (let i = 0; i < yCands.length; i++) {
                        const d = Math.abs(yCands[i] - a.pos);
                        if (d < bestYDist) { bestYDist = d; bestY = a.pos - i * (ts / 2); guideY = a.pos; }
                    }
                }
            }
            if (bestX !== null) newX = bestX / ts;
            if (bestY !== null) newY = bestY / ts;
            this._drawDragGuides(guideX, guideY);
        } else {
            this._clearDragGuides();
        }

        if (newX !== this.draggedEvent.x || newY !== this.draggedEvent.y) {
            if (newX >= 0 && newX < this.currentMap.width &&
                newY >= 0 && newY < this.currentMap.height) {

                if (!this._dragStateSaved) {
                    this._dragStateSaved = true;
                    this.resetMapClickTracking();
                    this.saveState();
                }
                this.draggedEvent.x = newX;
                this.draggedEvent.y = newY;

                const sprite = this.eventSprites.get(this.draggedEvent.id);
                if (sprite) {
                    sprite.x = newX * ts;
                    sprite.y = newY * ts;
                    this.updateSelectionHighlight();
                } else {
                    this.renderEvents();
                }
            }
        }
    }

    // Draw alignment guide lines during event drag
    _drawDragGuides(guideX, guideY) {
        if (!this.tilemapManager || !this.tilemapManager.container || !this.tilemapManager.currentMap) return;
        if (!this._dragGuideGraphics) {
            this._dragGuideGraphics = new PIXI.Graphics();
            this.tilemapManager.container.addChild(this._dragGuideGraphics);
        }
        const g = this._dragGuideGraphics;
        g.clear();
        const ts = this.tilemapManager.TILE_WIDTH;
        const mapW = this.tilemapManager.currentMap.width * ts;
        const mapH = this.tilemapManager.currentMap.height * ts;
        if (guideX !== null) {
            g.moveTo(guideX, 0).lineTo(guideX, mapH)
                .stroke({ width: 1, color: 0x00ffff, alpha: 0.7 });
        }
        if (guideY !== null) {
            g.moveTo(0, guideY).lineTo(mapW, guideY)
                .stroke({ width: 1, color: 0x00ffff, alpha: 0.7 });
        }
    }

    _clearDragGuides() {
        if (this._dragGuideGraphics) {
            this._dragGuideGraphics.clear();
        }
    }

    // Collect alignment anchors from all events + stamps (except the dragged one)
    _collectDragAnchors() {
        const anchors = [];
        const ts = this.tilemapManager.TILE_WIDTH;
        const map = this.currentMap;
        if (!map) return anchors;

        const events = map.events || [];
        for (const ev of events) {
            if (!ev || ev === this.draggedEvent) continue;
            const px = ev.x * ts, py = ev.y * ts;
            anchors.push({ axis: 'x', pos: px }, { axis: 'x', pos: px + ts / 2 }, { axis: 'x', pos: px + ts });
            anchors.push({ axis: 'y', pos: py }, { axis: 'y', pos: py + ts / 2 }, { axis: 'y', pos: py + ts });
        }

        const stamps = map.stampTiles || [];
        for (const s of stamps) {
            if (!s || typeof s.x !== 'number') continue;
            anchors.push({ axis: 'x', pos: s.x - ts / 2 }, { axis: 'x', pos: s.x }, { axis: 'x', pos: s.x + ts / 2 });
            anchors.push({ axis: 'y', pos: s.y - ts / 2 }, { axis: 'y', pos: s.y }, { axis: 'y', pos: s.y + ts / 2 });
        }

        return anchors;
    }

    // Finish dragging
    finishDragging(pointerEvent) {
        if (!this.isDragging || !this.draggedEvent) return;

        console.log(`Finished dragging event ${this.draggedEvent.name} to (${this.draggedEvent.x}, ${this.draggedEvent.y})`);

        // Reset cursor
        if (this.tilemapManager.container) {
            this.tilemapManager.container.cursor = 'default';
        }

        this.isDragging = false;
        this.draggedEvent = null;
        this.dragOffset = { x: 0, y: 0 };

        // Final render to update appearance
        this.renderEvents();
    }

    // Nudge selected event with arrow keys
    nudgeSelectedEvent(dx, dy) {
        if (!this.selectedEvent || !this.currentMap) return;

        const ev = this.selectedEvent;
        const ts = this.tilemapManager.TILE_WIDTH;
        const newX = ev.x + dx;
        const newY = ev.y + dy;

        if (newX < 0 || newX >= this.currentMap.width ||
            newY < 0 || newY >= this.currentMap.height) return;

        // Lazy save state (first nudge in a sequence)
        if (!this._nudgeStateSaved) {
            this._nudgeStateSaved = true;
            this.saveState();
        }

        ev.x = newX;
        ev.y = newY;

        // Update sprite position
        const sprite = this.eventSprites.get(ev.id);
        if (sprite) {
            sprite.x = newX * ts;
            sprite.y = newY * ts;
        }
        this.selectedTileX = newX;
        this.selectedTileY = newY;
    }

    // Reset nudge undo tracking (call on keyup or selection change)
    resetNudgeTracking() {
        this._nudgeStateSaved = false;
    }

    // Convert layer, x, y to RPG Maker tileId
    convertToTileId(layer, x, y) {
        // RPG Maker MZ tile ID calculation:
        // B-E layers: tileId = y * 8 + x (starting from 0)
        // A5 layer: tileId = 1536 + (y * 8 + x)
        // A1-A4 (autotiles): tileId = 2048 + (kind * 48) where kind is the autotile index

        if (layer === 'A1' || layer === 'A2' || layer === 'A3' || layer === 'A4') {
            // Autotiles - each tile in the palette is a "kind"
            // A1: 16 kinds (0-15)
            // A2: 32 kinds (16-47)
            // A3: 32 kinds (48-79)
            // A4: 48 kinds (80-127)

            let kindOffset = 0;
            let kindsPerRow = 8; // 8 columns in the palette

            if (layer === 'A1') {
                kindOffset = 0;
            } else if (layer === 'A2') {
                kindOffset = 16;
            } else if (layer === 'A3') {
                kindOffset = 48;
            } else if (layer === 'A4') {
                kindOffset = 80;
            }

            const kind = y * kindsPerRow + x;
            return 2048 + ((kindOffset + kind) * 48);
        } else if (layer === 'A5') {
            // A5 tiles start at 1536
            return 1536 + (y * 8 + x);
        } else if (layer === 'B' || layer === 'C' || layer === 'D' || layer === 'E') {
            // B-E sheets are 8 tiles wide but the palette shows them as a
            // 16-wide split, handing back x in 0..15 for the right half.
            // Fold that back the way MapEditor.getBaseTileIdFromPalettePosition
            // does, or every right-half tile resolves to a different tile's id.
            if (x >= 8) {
                x -= 8;
                y += 16;
            }
            const tileIndex = y * 8 + x;

            if (layer === 'B') {
                return tileIndex;
            } else if (layer === 'C') {
                return 256 + tileIndex;
            } else if (layer === 'D') {
                return 512 + tileIndex;
            } else if (layer === 'E') {
                return 768 + tileIndex;
            }
        }

        return 0; // Invalid
    }

    // Create new event with tileset graphic
    getNextEventId() {
        const events = Array.isArray(this.currentMap?.events) ? this.currentMap.events : [];
        const occupiedIds = new Set(events.filter(Boolean).map(event => Number(event.id)));
        let nextId = 1;
        while (occupiedIds.has(nextId) || events[nextId]) nextId++;
        return nextId;
    }

    createNewEventWithTileset(x, y, tileId) {
        console.log(`createNewEventWithTileset called: position (${x}, ${y}), tileId: ${tileId}`);

        if (!this.currentMap) {
            console.warn('No map loaded');
            return null;
        }
        if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) {
            return null;
        }

        // Imported maps are not always indexed by event ID, so require both
        // the ID and its target storage slot to be free.
        const nextId = this.getNextEventId();

        // Create new event with tileset graphic
        const newEvent = {
            id: nextId,
            name: `EV${String(nextId).padStart(3, '0')}`,
            note: '',
            pages: [{
                conditions: {
                    actorId: 1,
                    actorValid: false,
                    itemId: 1,
                    itemValid: false,
                    selfSwitchCh: 'A',
                    selfSwitchValid: false,
                    switch1Id: 1,
                    switch1Valid: false,
                    switch2Id: 1,
                    switch2Valid: false,
                    variableId: 1,
                    variableValid: false,
                    variableValue: 0
                },
                directionFix: false,
                image: {
                    tileId: tileId, // Set tileset graphic
                    characterName: '',
                    direction: 2,
                    pattern: 0,
                    characterIndex: 0
                },
                moveFrequency: 3,
                moveRoute: {
                    list: [{ code: 0, indent: null, parameters: [] }],
                    repeat: true,
                    skippable: false,
                    wait: false
                },
                moveSpeed: 3,
                moveType: 0,
                priorityType: 1, // Same level as characters
                stepAnime: false,
                through: false,
                trigger: 0,
                walkAnime: false, // Tileset events don't animate
                list: [{ code: 0, indent: 0, parameters: [] }]
            }],
            x: x,
            y: y
        };

        console.log('Created event with image data:', JSON.stringify(newEvent.pages[0].image, null, 2));

        console.log(`Created new tileset event ${newEvent.name} at (${x}, ${y}) with tileId ${tileId}`);

        // Show edit dialog
        this.editEvent(newEvent, { isNew: true, map: this.currentMap });
        return newEvent;
    }

    // Create new event
    createNewEvent(x, y) {
        if (!this.currentMap) {
            console.warn('No map loaded');
            return null;
        }
        if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) {
            return null;
        }

        const nextId = this.getNextEventId();

        // Create new event with default structure
        const newEvent = {
            id: nextId,
            name: `EV${String(nextId).padStart(3, '0')}`,
            note: '',
            pages: [{
                conditions: {
                    actorId: 1,
                    actorValid: false,
                    itemId: 1,
                    itemValid: false,
                    selfSwitchCh: 'A',
                    selfSwitchValid: false,
                    switch1Id: 1,
                    switch1Valid: false,
                    switch2Id: 1,
                    switch2Valid: false,
                    variableId: 1,
                    variableValid: false,
                    variableValue: 0
                },
                directionFix: false,
                image: {
                    tileId: 0,
                    characterName: '',
                    direction: 2,
                    pattern: 0,
                    characterIndex: 0
                },
                moveFrequency: 3,
                moveRoute: {
                    list: [{ code: 0, indent: null, parameters: [] }],
                    repeat: true,
                    skippable: false,
                    wait: false
                },
                moveSpeed: 3,
                moveType: 0,
                priorityType: 1,
                stepAnime: false,
                through: false,
                trigger: 0,
                walkAnime: true,
                list: [{ code: 0, indent: 0, parameters: [] }]
            }],
            x: x,
            y: y
        };

        console.log(`Created new event ${newEvent.name} at (${x}, ${y})`);

        // Show edit dialog
        this.editEvent(newEvent, { isNew: true, map: this.currentMap });
        return newEvent;
    }

    // Setup event editor modal
    setupEventEditorModal() {
        const modal = document.getElementById('event-editor-modal');
        const closeBtn = document.getElementById('event-editor-close-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this.eventEditor) this.eventEditor.cancelChanges();
                else if (modal) modal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (this.eventEditor) this.eventEditor.cancelChanges();
                    else modal.style.display = 'none';
                }
            });
        }
    }

    // Edit event
    editEvent(event, session = {}) {
        if (!event) {
            console.warn('No event to edit');
            return;
        }

        // Initialize event editor if not already created
        if (!this.eventEditor) {
            this.eventEditor = new EventEditor(
                null, // mapManager (not needed for now)
                this.databaseManager,
                this.projectController // Pass the whole controller so we can access currentProject
            );
        }

        // Get the modal and content container
        const modal = document.getElementById('event-editor-modal');
        const content = document.getElementById('event-editor-content');

        if (!modal || !content) {
            console.error('Event editor modal not found');
            return;
        }

        // Clear previous content
        content.innerHTML = '';

        // Show the event editor
        const targetMap = session.map || this.currentMap;
        let isNew = session.isNew === true;
        this.eventEditor.showEventEditor(content, event, {
            onCommit: (sourceEvent, committedEvent) => {
                if (this.currentMap !== targetMap) return false;
                const events = targetMap.events || (targetMap.events = []);

                if (isNew) {
                    if (events[sourceEvent.id] || events.some(entry => entry && entry.id === sourceEvent.id)) {
                        return false;
                    }
                    this.saveState();
                    this._replaceEventData(sourceEvent, committedEvent);
                    events[sourceEvent.id] = sourceEvent;
                    isNew = false;
                } else {
                    if (JSON.stringify(sourceEvent) === JSON.stringify(committedEvent)) return true;
                    this.saveState();
                    this._replaceEventData(sourceEvent, committedEvent);
                }

                this.selectedEvent = sourceEvent;
                this.renderEvents();
                return true;
            },
            onCancel: sourceEvent => {
                if (isNew && this.selectedEvent === sourceEvent) this.selectedEvent = null;
            }
        });

        // Display the modal
        modal.style.display = 'flex';

        console.log('Event editor opened for:', event.name);
    }

    _replaceEventData(target, source) {
        for (const key of Object.keys(target)) delete target[key];
        Object.assign(target, JSON.parse(JSON.stringify(source)));
    }

    // Cut event
    cutEvent(event) {
        if (!event) return;

        this.clipboard = JSON.parse(JSON.stringify(event));
        this.clipboard.cut = true;
        if (typeof ReactorClipboard !== 'undefined') {
            ReactorClipboard.write('event', { event: this.clipboard, cut: true });
        }
        this.deleteEvent(event);
        console.log('Event cut to clipboard');
    }

    // Copy event
    copyEvent(event) {
        if (!event) return;

        this.clipboard = JSON.parse(JSON.stringify(event));
        this.clipboard.cut = false;
        if (typeof ReactorClipboard !== 'undefined') {
            ReactorClipboard.write('event', { event: this.clipboard, cut: false });
        }
        console.log('Event copied to clipboard');
    }

    // Paste event
    async pasteEvent(x, y) {
        const tt = (text) => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        if (!this.currentMap) return;
        const targetMap = this.currentMap;

        let eventData = null;
        if (typeof ReactorClipboard !== 'undefined') {
            const clipboardData = await ReactorClipboard.read('event');
            eventData = clipboardData?.payload?.event || null;
        } else {
            eventData = this.clipboard;
        }
        if (this.currentMap !== targetMap) return;

        if (!eventData) {
            alert(tt('No event in clipboard to paste.'));
            return;
        }

        // Check if there's already an event at this position
        if (this.getEventAt(x, y)) {
            alert(tt('There is already an event at this position.'));
            return;
        }

        // Save state for undo
        this.saveState();

        const nextId = this.getNextEventId();

        // Create new event from clipboard
        const newEvent = JSON.parse(JSON.stringify(eventData));
        delete newEvent.cut;
        newEvent.id = nextId;
        newEvent.x = x;
        newEvent.y = y;
        newEvent.name = `EV${String(nextId).padStart(3, '0')}`;

        // Add to map
        this.currentMap.events[nextId] = newEvent;

        // Clear clipboard if it was a cut operation
        if (this.clipboard && this.clipboard.cut) {
            this.clipboard = null;
        }

        this.renderEvents();
        console.log(`Event pasted at (${x}, ${y})`);
    }

    // Delete event
    deleteEvent(event) {
        if (!event || !this.currentMap) return;

        // No confirmation - just delete
        {
            // Save state for undo
            this.saveState();

            // Imported maps may contain compacted or otherwise mismatched
            // event arrays. Remove the actual object slot rather than assuming
            // its database ID is also the array index.
            const events = this.currentMap.events || [];
            let eventIndex = events.indexOf(event);
            if (eventIndex < 0) eventIndex = events.findIndex(entry => entry && entry.id === event.id);
            if (eventIndex >= 0) events[eventIndex] = null;

            if (this.selectedEvent === event) {
                this.selectedEvent = null;
            }

            this.renderEvents();
            console.log(`Event ${event.name} deleted`);
        }
    }

    // Show find dialog
    _t(key, params) {
        return window.I18n ? window.I18n.t(key, params) : key;
    }

    showFindDialog() {
        if (this.findDialog) {
            this.findDialog.remove();
        }

        this.findDialog = document.createElement('div');
        this.findDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--color-bg-menubar);
            border: 1px solid var(--color-border);
            border-radius: 8px;
            padding: 20px;
            z-index: 10002;
            min-width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        this.findDialog.innerHTML = `
            <h3 style="margin-top: 0; color: var(--color-text);" data-i18n="eventFind.title">Find Event</h3>
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: var(--color-text-muted); margin-bottom: 4px;" data-i18n="eventFind.searchBy">Search by name or ID:</label>
                <input type="text" id="event-search-input" style="
                    width: 100%;
                    background-color: var(--color-bg-surface);
                    border: 1px solid var(--color-border-input);
                    color: var(--color-text);
                    padding: 8px;
                    font-size: 13px;
                    border-radius: 3px;
                ">
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="event-search-cancel" class="rr-btn-secondary" data-i18n="common.cancel">Cancel</button>
                <button id="event-search-find" style="
                    background-color: var(--color-link);
                    border: none;
                    color: white;
                    padding: 8px 16px;
                    cursor: pointer;
                    border-radius: 3px;
                " data-i18n="eventFind.find">Find</button>
            </div>
        `;

        document.body.appendChild(this.findDialog);
        if (window.I18n && window.I18n.apply) window.I18n.apply(this.findDialog);

        const input = document.getElementById('event-search-input');
        const findBtn = document.getElementById('event-search-find');
        const cancelBtn = document.getElementById('event-search-cancel');

        input.focus();

        findBtn.addEventListener('click', () => {
            this.performSearch(input.value);
            this.findDialog.remove();
            this.findDialog = null;
        });

        cancelBtn.addEventListener('click', () => {
            this.findDialog.remove();
            this.findDialog = null;
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(input.value);
                this.findDialog.remove();
                this.findDialog = null;
            } else if (e.key === 'Escape') {
                this.findDialog.remove();
                this.findDialog = null;
            }
        });
    }

    // Perform search
    performSearch(query) {
        if (!this.currentMap || !query) return;

        const lowerQuery = query.toLowerCase();
        this.currentSearchResults = [];

        // Search through events
        if (this.currentMap.events) {
            this.currentMap.events.forEach(event => {
                if (!event) return;

                if (event.name.toLowerCase().includes(lowerQuery) ||
                    String(event.id).includes(query)) {
                    this.currentSearchResults.push(event);
                }
            });
        }

        this.currentSearchIndex = 0;

        if (this.currentSearchResults.length > 0) {
            this.selectEvent(this.currentSearchResults[0]);
            this.centerOnEvent(this.currentSearchResults[0]);
            console.log(`Found ${this.currentSearchResults.length} events matching "${query}"`);
        } else {
            const tt = (text) => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
            alert(`${tt('No events found matching')} "${query}"`);
        }
    }

    // Find next
    findNext() {
        if (this.currentSearchResults.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.currentSearchResults.length;
        const event = this.currentSearchResults[this.currentSearchIndex];
        this.selectEvent(event);
        this.centerOnEvent(event);
    }

    // Find previous
    findPrevious() {
        if (this.currentSearchResults.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex - 1 + this.currentSearchResults.length) % this.currentSearchResults.length;
        const event = this.currentSearchResults[this.currentSearchIndex];
        this.selectEvent(event);
        this.centerOnEvent(event);
    }

    // Center view on event
    centerOnEvent(event) {
        if (!event || !this.tilemapManager) return;

        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;

        const eventPixelX = event.x * this.tilemapManager.TILE_WIDTH;
        const eventPixelY = event.y * this.tilemapManager.TILE_HEIGHT;

        // Center the view on the event
        const centerX = canvasContainer.clientWidth / 2;
        const centerY = canvasContainer.clientHeight / 2;

        canvasContainer.scrollLeft = eventPixelX - centerX;
        canvasContainer.scrollTop = eventPixelY - centerY;

        // Update selection to this tile
        this.selectTile(event.x, event.y);
    }

    // Set starting position
    async setStartingPosition(x, y, type) {
        const tt = (text) => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        const currentProject = this.projectController.getCurrentProject();
        if (!currentProject) {
            console.warn('No project loaded');
            return;
        }

        // Get system data
        const systemData = this.databaseManager.getSystem();
        if (!systemData) {
            console.warn('System data not available');
            return;
        }

        // Get current map ID from the loaded map
        const mapId = this.currentMap ? (this.currentMap.id || 1) : 1;

        switch (type) {
            case 'player':
                systemData.startMapId = mapId;
                systemData.startX = x;
                systemData.startY = y;
                break;
            case 'boat':
                if (!systemData.boat) {
                    systemData.boat = {
                        bgm: { name: 'Ship1', pan: 0, pitch: 100, volume: 90 },
                        characterIndex: 0,
                        characterName: 'Vehicle',
                        startMapId: 0,
                        startX: 0,
                        startY: 0
                    };
                }
                systemData.boat.startMapId = mapId;
                systemData.boat.startX = x;
                systemData.boat.startY = y;
                break;
            case 'ship':
                if (!systemData.ship) {
                    systemData.ship = {
                        bgm: { name: 'Ship2', pan: 0, pitch: 100, volume: 90 },
                        characterIndex: 1,
                        characterName: 'Vehicle',
                        startMapId: 0,
                        startX: 0,
                        startY: 0
                    };
                }
                systemData.ship.startMapId = mapId;
                systemData.ship.startX = x;
                systemData.ship.startY = y;
                break;
            case 'airship':
                if (!systemData.airship) {
                    systemData.airship = {
                        bgm: { name: 'Ship3', pan: 0, pitch: 100, volume: 90 },
                        characterIndex: 3,
                        characterName: 'Vehicle',
                        startMapId: 0,
                        startX: 0,
                        startY: 0
                    };
                }
                systemData.airship.startMapId = mapId;
                systemData.airship.startX = x;
                systemData.airship.startY = y;
                break;
        }

        try {
            const projectPath = currentProject.path;
            await this.databaseManager.saveJSON(projectPath, 'System.json', systemData);
        } catch (error) {
            console.error('Error saving System.json:', error);
        }

        // Re-render starting position markers for the current map
        // This will show the new marker if on this map, or hide it if moved to another map
        this.renderStartingPositions();
    }

    // Render events on the map
    renderEvents() {
        if (!this.eventContainer || !this.currentMap) return;

        // Clear existing event sprites. Destroy them — removeChildren()
        // alone detaches, and each name label is a PIXI.Text that owns a
        // canvas texture which would leak per rebuild. Textures of plain
        // sprites are left alone (character sheets are shared).
        const removed = this.eventContainer.removeChildren();
        for (const child of removed) {
            child.destroy({ children: true });
        }
        this.eventSprites.clear();

        // Keep the data list available even if one malformed graphic fails to
        // construct a PIXI sprite.
        this.updateEventsList();

        // Render each event
        if (this.currentMap.events) {
            this.currentMap.events.forEach(event => {
                if (!event) return;

                try {
                    const sprite = this.createEventSprite(event);
                    this.eventContainer.addChild(sprite);
                    this.eventSprites.set(event.id, sprite);
                } catch (error) {
                    console.error(`Could not render event ${event.id}:`, error);
                }
            });
        }

        // Update selection highlight in case event status changed
        this.updateSelectionHighlight();

    }

    // Update the events list in the sidebar
    updateEventsList() {
        const tt = (text) => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        const eventsListEl = document.getElementById('events-list');
        const eventsSectionEl = document.getElementById('events-section');

        if (!eventsListEl || !eventsSectionEl) return;

        // Show the events section when a map is loaded (use 'flex' explicitly for reliable layout)
        eventsSectionEl.style.display = 'flex';

        // Reset scroll position to prevent hidden headers (NW.js overflow:hidden scroll bug)
        eventsSectionEl.scrollTop = 0;
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.scrollTop = 0;

        // Clear existing list, keeping the list's own scroll position so a
        // re-render doesn't jump back to the top of a long event list.
        const prevListScroll = eventsListEl.scrollTop;
        eventsListEl.innerHTML = '';

        const events = Array.isArray(this.currentMap?.events)
            ? this.currentMap.events.filter(Boolean)
            : [];
        if (events.length === 0) {
            eventsListEl.innerHTML = `<div class="tree-item" style="color: var(--color-text-muted); padding: 6px 8px;">${tt('No events on this map')}</div>`;
            return;
        }

        // Add each event to the list
        events.forEach(event => {
            const item = document.createElement('div');
            item.className = 'tree-item event-list-item';
            item.dataset.eventId = event.id;
            item.textContent = `${String(event.id).padStart(3, '0')}: ${event.name || tt('Unnamed Event')}`;
            item.style.padding = '6px 8px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '14px';
            item.style.borderRadius = '3px';
            item.style.margin = '2px 4px';

            // Click handler - select event on map
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectEventById(event.id);
            });

            // Double-click handler - open event editor
            item.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.selectEventById(event.id);
                this.editEvent(event);
            });

            // Right-click context menu
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectEventById(event.id);
                this.showContextMenu(e.clientX, e.clientY, event.x, event.y, event);
            });

            eventsListEl.appendChild(item);
        });

        // Update selection highlight after populating list
        this.updateEventListSelection();

        eventsListEl.scrollTop = prevListScroll;

        // Update resize handles visibility
        if (this.sidebarResizer) {
            this.sidebarResizer.refresh();
        }
    }

    // Highlight the selected event in the sidebar list
    updateEventListSelection() {
        const eventsListEl = document.getElementById('events-list');
        if (!eventsListEl) return;

        // Remove previous selection (only the one that was selected, not all items)
        const previouslySelected = eventsListEl.querySelector('.event-list-item.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
            previouslySelected.style.backgroundColor = '';
        }

        // Highlight current selection with gold color
        if (this.selectedEvent) {
            const selectedItem = eventsListEl.querySelector(`[data-event-id="${this.selectedEvent.id}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
                selectedItem.style.backgroundColor = 'var(--color-accent-tint-35)'; // Gold highlight

                // Scroll into view if needed
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }

    // Render starting position markers
    renderStartingPositions() {
        const tt = (text) => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        if (!this.startingPositionContainer || !this.currentMap) return;

        // Clear existing markers
        this.startingPositionContainer.removeChildren();

        const systemData = this.databaseManager.getSystem();
        if (!systemData) return;

        const mapId = this.currentMap.id;
        console.log(`Rendering starting positions for map ${mapId}`);
        console.log(`Player start is on map ${systemData.startMapId} at (${systemData.startX}, ${systemData.startY})`);

        // Render player starting position
        if (systemData.startMapId === mapId) {
            console.log(`Rendering player starting position marker at (${systemData.startX}, ${systemData.startY})`);
            this.createStartingPositionMarker(systemData.startX, systemData.startY, tt('Player'), 0x00ff00);
        }

        // Render boat starting position
        if (systemData.boat && systemData.boat.startMapId === mapId) {
            this.createStartingPositionMarker(systemData.boat.startX, systemData.boat.startY, tt('Boat'), 0x0088ff);
        }

        // Render ship starting position
        if (systemData.ship && systemData.ship.startMapId === mapId) {
            this.createStartingPositionMarker(systemData.ship.startX, systemData.ship.startY, tt('Ship'), 0xff8800);
        }

        // Render airship starting position
        if (systemData.airship && systemData.airship.startMapId === mapId) {
            this.createStartingPositionMarker(systemData.airship.startX, systemData.airship.startY, tt('Airship'), 0xff00ff);
        }

        // Make container visible
        this.startingPositionContainer.visible = true;
    }

    // Create a starting position marker
    createStartingPositionMarker(x, y, label, color) {
        const container = new PIXI.Container();
        container.x = x * this.tilemapManager.TILE_WIDTH;
        container.y = y * this.tilemapManager.TILE_HEIGHT;

        // Draw marker background - PIXI v8 API
        const graphics = new PIXI.Graphics();
        graphics.rect(0, 0, this.tilemapManager.TILE_WIDTH, this.tilemapManager.TILE_HEIGHT);
        graphics.fill({ color: color, alpha: 0.5 });

        // Draw marker border - PIXI v8 API
        graphics.rect(0, 0, this.tilemapManager.TILE_WIDTH, this.tilemapManager.TILE_HEIGHT);
        graphics.stroke({ color: color, width: 3, alpha: 1.0 });

        container.addChild(graphics);

        // Add label text
        const text = new PIXI.Text({
            text: label,
            style: {
                fontSize: 9,
                fill: 0xffffff,
                align: 'center',
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: 2 }
            }
        });
        text.x = this.tilemapManager.TILE_WIDTH / 2;
        text.y = this.tilemapManager.TILE_HEIGHT / 2;
        text.anchor.set(0.5);
        container.addChild(text);

        this.startingPositionContainer.addChild(container);
    }

    createEventSprite(event) {
        const container = new PIXI.Container();
        container.x = event.x * this.tilemapManager.TILE_WIDTH;
        container.y = event.y * this.tilemapManager.TILE_HEIGHT;

        const isDragging = this.isDragging && this.draggedEvent && this.draggedEvent.id === event.id;
        const isSelected = this.selectedEvent && this.selectedEvent.id === event.id;
        const tw = this.tilemapManager.TILE_WIDTH;
        const th = this.tilemapManager.TILE_HEIGHT;

        const tileId = event.pages && event.pages[0] && event.pages[0].image ? event.pages[0].image.tileId : 0;
        const image = event.pages && event.pages[0] ? event.pages[0].image : null;
        let hasGraphic = false;

        if (this.eventViewMode === 'game') {
            if (tileId > 0) {
                const tileSprite = this.createTileSprite(tileId);
                if (tileSprite) {
                    container.addChild(tileSprite);
                    hasGraphic = true;
                }
            }
            if (!hasGraphic && image && image.characterName) {
                const characterSprite = this.createCharacterSprite(image, true);
                if (characterSprite) {
                    container.addChild(characterSprite);
                    hasGraphic = true;
                }
            }
            if (!hasGraphic) {
                const g = new PIXI.Graphics();
                g.rect(2, 2, tw - 4, th - 4);
                g.fill({ color: 0x000000, alpha: 0.2 });
                g.stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
                container.addChild(g);
            }
            if (isSelected || isDragging) {
                const sel = new PIXI.Graphics();
                sel.rect(0, 0, tw, th);
                sel.stroke({ width: 2, color: 0x00ff00 });
                container.addChild(sel);
            }
            return container;
        }

        const graphics = new PIXI.Graphics();
        const bgAlpha = isDragging ? 0.9 : 0.75;
        graphics.rect(0, 0, tw, th);
        graphics.fill({ color: 0x000000, alpha: bgAlpha });

        const borderColor = isSelected ? 0x00ff00 : 0xffffff;
        graphics.rect(0, 0, tw, th);
        graphics.stroke({ width: 1, color: borderColor });

        container.addChild(graphics);

        if (tileId > 0) {
            const tileSprite = this.createTileSprite(tileId);
            if (tileSprite) {
                tileSprite.x = 2;
                tileSprite.y = 2;
                const maxSize = tw - 4;
                const scale = maxSize / 48;
                tileSprite.scale.set(scale);
                container.addChild(tileSprite);
                hasGraphic = true;
            }
        }

        if (!hasGraphic) {
            if (image && image.characterName) {
                const characterSprite = this.createCharacterSprite(image);
                if (characterSprite) {
                    characterSprite.x += 2;
                    characterSprite.y += 2;
                    container.addChild(characterSprite);
                    hasGraphic = true;
                }
            }
        }

        const text = new PIXI.Text({
            text: event.name,
            style: {
                fontSize: 8,
                fill: 0xffffff,
                align: 'center',
                stroke: { color: 0x000000, width: 2 }
            }
        });
        text.x = tw / 2;
        text.y = th - 6;
        text.anchor.set(0.5);
        container.addChild(text);

        return container;
    }

    _getTilesetNames() {
        if (this._tilesetNamesCache) return this._tilesetNamesCache;
        const currentProject = this.projectController?.getCurrentProject?.();
        if (!currentProject || !this.currentMap) return null;
        const path = require('path');
        const fs = require('fs');
        const tilesetsPath = path.join(currentProject.path, 'data', 'Tilesets.json');
        if (!fs.existsSync(tilesetsPath)) return null;
        const tilesets = JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'));
        const tilesetId = this.currentMap.tilesetId || 1;
        const tileset = tilesets[tilesetId];
        this._tilesetNamesCache = tileset?.tilesetNames || null;
        return this._tilesetNamesCache;
    }

    _getSheetTexture(layer) {
        const LAYER_INDEX = { 'A1': 0, 'A2': 1, 'A3': 2, 'A4': 3, 'A5': 4, 'B': 5, 'C': 6, 'D': 7, 'E': 8 };
        const idx = LAYER_INDEX[layer];
        if (idx == null) return null;

        if (this.tilesetPaletteViewer?.tilesetTextures?.[layer]) {
            return this.tilesetPaletteViewer.tilesetTextures[layer];
        }

        const names = this._getTilesetNames();
        if (!names || !names[idx]) return null;

        const currentProject = this.projectController?.getCurrentProject?.();
        if (!currentProject) return null;

        const path = require('path');
        const imgPath = path.join(currentProject.path, 'img', 'tilesets', names[idx] + '.png');
        const url = (typeof RRAssetFiles !== 'undefined' && RRAssetFiles.toUrl)
            ? RRAssetFiles.toUrl(imgPath)
            : 'file://' + imgPath.replace(/\\/g, '/');

        if (this._sheetCache[url]) {
            return this._sheetCache[url].loaded ? this._sheetCache[url].img : null;
        }

        const entry = { img: null, loaded: false };
        this._sheetCache[url] = entry;

        const htmlImg = new Image();
        htmlImg.onload = () => {
            entry.img = htmlImg;
            entry.loaded = true;
            this.renderEvents();
        };
        htmlImg.onerror = () => {
            console.error('Failed to load tileset sheet:', url);
        };
        htmlImg.src = url;
        return null;
    }

    createTileSprite(tileId) {
        const TILE_SIZE = 48;

        let layer = null;
        let tileX = 0;
        let tileY = 0;

        if (tileId >= 2048) {
            const kind = Math.floor((tileId - 2048) / 48);
            if (kind < 16) { layer = 'A1'; tileX = kind % 8; tileY = Math.floor(kind / 8); }
            else if (kind < 48) { layer = 'A2'; tileX = (kind-16) % 8; tileY = Math.floor((kind-16) / 8); }
            else if (kind < 80) { layer = 'A3'; tileX = (kind-48) % 8; tileY = Math.floor((kind-48) / 8); }
            else if (kind < 128) { layer = 'A4'; tileX = (kind-80) % 8; tileY = Math.floor((kind-80) / 8); }
        } else if (tileId >= 1536) {
            layer = 'A5';
            const localTileId = tileId - 1536;
            tileX = localTileId % 8;
            tileY = Math.floor(localTileId / 8);
        } else {
            let localTileId = tileId;
            if (tileId >= 768) { layer = 'E'; localTileId = tileId - 768; }
            else if (tileId >= 512) { layer = 'D'; localTileId = tileId - 512; }
            else if (tileId >= 256) { layer = 'C'; localTileId = tileId - 256; }
            else { layer = 'B'; }
            tileX = localTileId % 8;
            tileY = Math.floor(localTileId / 8);
            if (tileY >= 16) {
                tileX += 8;
                tileY -= 16;
            }
        }

        if (!layer) return null;

        const tex = this._getSheetTexture(layer);
        if (!tex) return null;

        let srcX = tileX * TILE_SIZE;
        let srcY = tileY * TILE_SIZE;

        if (tileId >= 2048) {
            srcX = tileX * TILE_SIZE * 2;
            if (layer === 'A1' || layer === 'A2') srcY = tileY * TILE_SIZE * 3;
            else if (layer === 'A3') srcY = tileY * TILE_SIZE * 2;
            else if (layer === 'A4') {
                srcY = 0;
                for (let r = 0; r < tileY; r++) {
                    srcY += (r % 2 === 0) ? TILE_SIZE * 3 : TILE_SIZE * 2;
                }
            }
        }

        const baseTex = PIXI.Texture.from(tex);
        const croppedTexture = new PIXI.Texture({
            source: baseTex.source,
            frame: new PIXI.Rectangle(srcX, srcY, TILE_SIZE, TILE_SIZE)
        });
        return new PIXI.Sprite(croppedTexture);
    }

    // Create a PIXI sprite from character image data
    createCharacterSprite(image, gameMode) {
        if (!image || !image.characterName) {
            return null;
        }

        const currentProject = this.projectController.getCurrentProject ? this.projectController.getCurrentProject() : this.projectController.currentProject;
        if (!currentProject) {
            return null;
        }

        const path = require('path');
        // Add .png extension if not already present (RPG Maker stores names without extension)
        const filename = image.characterName.endsWith('.png') ? image.characterName : image.characterName + '.png';
        const filePath = path.join(currentProject.path, 'img', 'characters', filename);
        const imgPath = window.RPGReactorAssetUrl
            ? window.RPGReactorAssetUrl(filePath)
            : 'file://' + filePath.replace(/\\/g, '/');

        try {
            // Load as HTML Image element first, then convert to PIXI texture
            // This is more reliable than PIXI.Texture.from() for file:// URLs
            const htmlImg = new Image();
            htmlImg.src = imgPath;

            // Check if already loaded (cached)
            if (!htmlImg.complete || !htmlImg.width || !htmlImg.height) {
                // Set up a one-time listener to re-render when the image loads
                htmlImg.onload = () => {
                    this.renderEvents();
                };
                return null;
            }

            // Create PIXI texture from the loaded HTML image
            const baseTexture = PIXI.Texture.from(htmlImg);
            if (!baseTexture || !baseTexture.source) {
                return null;
            }

            const img = baseTexture.source;

            const isBigCharacter = RRAssetFiles.isBigCharacter(image.characterName);

            let characterWidth, characterHeight, baseX, baseY;

            // Direction mapping: 2=down, 4=left, 6=right, 8=up
            const directionRow = { 2: 0, 4: 1, 6: 2, 8: 3 };
            const dirRow = directionRow[image.direction || 2] || 0;

            if (isBigCharacter) {
                // Big characters: 3 frames x 4 directions
                characterWidth = img.width / 3;
                characterHeight = img.height / 4;
                baseX = 0;
                baseY = dirRow * characterHeight;
            } else {
                // Normal sprites: 8 characters (4x2 grid), 3 frames x 4 directions each
                characterWidth = img.width / 12; // 3 frames * 4 columns
                characterHeight = img.height / 8; // 4 directions * 2 rows

                const charCol = (image.characterIndex || 0) % 4;
                const charRow = Math.floor((image.characterIndex || 0) / 4);

                baseX = charCol * 3 * characterWidth;
                baseY = (charRow * 4 + dirRow) * characterHeight;
            }

            // Get the frame to display (pattern 0, 1, or 2)
            const pattern = image.pattern != null ? image.pattern : 1;
            const sourceX = baseX + pattern * characterWidth;
            const sourceY = baseY;

            // Create cropped texture using PIXI v8 API
            const croppedTexture = new PIXI.Texture({
                source: img,
                frame: new PIXI.Rectangle(sourceX, sourceY, characterWidth, characterHeight)
            });

            const sprite = new PIXI.Sprite(croppedTexture);

            if (gameMode) {
                sprite.anchor.set(0.5, 1);
                sprite.x = this.tilemapManager.TILE_WIDTH / 2;
                sprite.y = this.tilemapManager.TILE_HEIGHT;
                return sprite;
            }

            const TILE_SIZE = 48;
            const maxSize = TILE_SIZE - 4; // Leave room for border
            const scale = Math.min(maxSize / characterWidth, maxSize / characterHeight);
            sprite.scale.set(scale);

            // Center in the available space (not including border)
            const scaledWidth = characterWidth * scale;
            const scaledHeight = characterHeight * scale;
            sprite.x = (maxSize - scaledWidth) / 2;
            sprite.y = (maxSize - scaledHeight) / 2;

            return sprite;
        } catch (error) {
            console.error('Error creating character sprite:', error);
            return null;
        }
    }

    // Clean up
    destroy() {
        this.removeEventInteraction();
        this.hideContextMenu();
        if (this.findDialog) {
            this.findDialog.remove();
        }
        if (this.eventContainer) {
            this.eventContainer.destroy({ children: true });
            this.eventContainer = null;
        }
        if (this.hoverHighlight) {
            this.hoverHighlight.destroy();
            this.hoverHighlight = null;
        }
        if (this.selectionHighlight) {
            this.selectionHighlight.destroy();
            this.selectionHighlight = null;
        }
        if (this.startingPositionContainer) {
            this.startingPositionContainer.destroy({ children: true });
            this.startingPositionContainer = null;
        }
        this.eventSprites.clear();
    }
}
