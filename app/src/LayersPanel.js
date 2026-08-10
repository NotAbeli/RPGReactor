// Agonia Engine - Layers Panel
// A visual layer manager for the map editor.
//
// Layout (top → bottom of the panel):
//   ▼ Стены и пол   — tile layers with kind 'A' (autotiles: walls/floor/roof)
//   ▼ Объекты       — tile layers kind B/C/D + extended (z4+) sublayers  [+ add]
//   ▼ События       — 3 fixed sublayers by MZ priorityType (0=Под, 1=На уровне, 2=Над),
//                     each expandable to list its events. Drag an event onto a
//                     sublayer header to change its priority (all pages updated).
//
// Manifest lives on map.reactor.layers; MZ ignores the unknown key. Tile data
// for extended (z4+) sublayers lives on map.reactor.extraTileData[id].

class LayersPanel {
    constructor(opts = {}) {
        this.tilemapManager = opts.tilemapManager || null;
        this.mapEditor = opts.mapEditor || null;
        this.tilesetPaletteViewer = opts.tilesetPaletteViewer || null;
        this.eventManager = opts.eventManager || null;
        this.callbacks = opts.callbacks || {};

        this.manifest = null;          // map.reactor.layers (cached reference)
        this.containerEl = null;       // DOM host (#layers-section .sidebar-content)
        this.collapsed = false;        // whole-panel header collapse
        this.eventModeActive = false;  // mirrors EventManager.eventMode
        this._syncing = false;         // guard palette<->panel feedback loops
        this._collapsedGroups = new Set();      // 'walls' | 'objects' | 'events'
        this._collapsedEventSubs = new Set(['evp-0', 'evp-1', 'evp-2']); // event sublayers collapsed by default
        this._draggedEventId = null;   // event id being dragged onto a sublayer
    }

    static tt(text) {
        return (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
    }

    static DEFAULT_LAYERS() {
        return [
            { id: 'rr-l-a', name: 'A', kind: 'A', z: 0, visible: true, locked: false },
            { id: 'rr-l-o1', name: LayersPanel.tt('Object') + ' 1', kind: 'O', z: 1, visible: true, locked: false }
        ];
    }

    // Palette tabs are decoupled from object layers: any B-F tile paints onto
    // the active object layer. Only the A (walls) category is kept distinct —
    // see setActiveByPaletteTab for the category-level auto-switch.

    static PRIORITY_LABELS() {
        return { 0: LayersPanel.tt('Below'), 1: LayersPanel.tt('Same level'), 2: LayersPanel.tt('Above') };
    }

    // ---------- Manifest migration (idempotent) ----------
    // Delegates to TilemapManager.migrateLayerManifest when available — it is
    // the single source of truth (data-aware: reconciles object layers with
    // actual z1-z3 data, normalizes legacy kinds, ensures structure). The
    // fallback below covers code paths that touch the manifest without a
    // TilemapManager (e.g. a fresh map not yet loaded into one).
    migrateMapManifest(map) {
        if (!map) return null;
        if (this.tilemapManager && this.tilemapManager.currentMap === map
            && typeof this.tilemapManager.migrateLayerManifest === 'function') {
            return this.tilemapManager.migrateLayerManifest();
        }
        return LayersPanel._migrateManifestFallback(map);
    }

    static _migrateManifestFallback(map) {
        if (!map) return null;
        if (!map.reactor || typeof map.reactor !== 'object') map.reactor = {};
        let m = map.reactor.layers;
        if (!m || typeof m !== 'object' || !Array.isArray(m.tileLayers)) {
            m = { version: 1, tileLayers: LayersPanel.DEFAULT_LAYERS().map(l => ({ ...l })), activeTileLayer: 'rr-l-a' };
            map.reactor.layers = m;
        }
        const objName = LayersPanel.tt('Object');
        m.tileLayers.forEach(l => {
            if (l.kind === 'B' || l.kind === 'C' || l.kind === 'D') {
                if (l.name === l.kind) l.name = objName + ' ' + l.z;
                l.kind = 'O';
            } else if (l.kind === 'X') {
                l.kind = 'O';
            }
            if (l.visible === undefined) l.visible = true;
            if (l.locked === undefined) l.locked = false;
            if (l.z === undefined) l.z = 0;
            if (!l.kind) l.kind = (l.z === 0) ? 'A' : 'O';
        });
        if (!m.tileLayers.some(l => l.kind === 'A' || l.z === 0)) {
            m.tileLayers.unshift({ id: 'rr-l-a', name: 'A', kind: 'A', z: 0, visible: true, locked: false });
        }
        if (!m.tileLayers.some(l => l.kind === 'O')) {
            m.tileLayers.push({ id: 'rr-l-o1', name: objName + ' 1', kind: 'O', z: 1, visible: true, locked: false });
        }
        if (!m.tileLayers.find(l => l.id === m.activeTileLayer)) {
            m.activeTileLayer = m.tileLayers[0].id;
        }
        if (!Array.isArray(m.eventPriorityLayers) || m.eventPriorityLayers.length < 3) {
            m.eventPriorityLayers = [
                { priority: 0, visible: true },
                { priority: 1, visible: true },
                { priority: 2, visible: true }
            ];
        }
        m.eventPriorityLayers.forEach(l => { if (l.visible === undefined) l.visible = true; });
        if (m.activeEventPriority !== 0 && m.activeEventPriority !== 2) m.activeEventPriority = 1;
        if (m.editScope !== 'all' && m.editScope !== 'selected') m.editScope = 'selected';
        if (!map.reactor.extraTileData || typeof map.reactor.extraTileData !== 'object') {
            map.reactor.extraTileData = {};
        }
        const knownX = new Set(m.tileLayers.filter(l => l.z == null).map(l => l.id));
        for (const id of Object.keys(map.reactor.extraTileData)) {
            if (!knownX.has(id)) delete map.reactor.extraTileData[id];
        }
        m.version = 1;
        map.reactor.layers = m;
        return m;
    }

    // ---------- Mount ----------
    mount(containerEl) {
        this.containerEl = containerEl;
        if (!containerEl) return;
        containerEl.innerHTML = '';
        containerEl.style.overflowY = 'auto';
        containerEl.style.padding = '0';
        containerEl.style.minHeight = '0';
        this._wireHeader();
        this._applyCollapsed();
        this.render();
    }

    _wireHeader() {
        const header = document.querySelector('#layers-section .sidebar-header');
        if (header && !header.dataset.wired) {
            // Header = [title (collapse toggle)] + [edit-scope toggle button].
            header.style.cursor = 'pointer';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.gap = '6px';
            header.innerHTML = `<span class="rr-layers-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                <button class="rr-scope-toggle rr-btn-chip" title="${LayersPanel.tt('Edit scope: selected layer only / all layers')}" style="padding:2px 8px;font-size:10px;flex:0 0 auto;">${LayersPanel.tt('Selected')}</button>`;
            header.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // scope button handles its own click
                this.collapsed = !this.collapsed;
                this._applyCollapsed();
            });
            const scopeBtn = header.querySelector('.rr-scope-toggle');
            if (scopeBtn) {
                scopeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._toggleEditScope();
                });
            }
            header.dataset.wired = '1';
        }
        this._updateScopeButton();
        if (!this._langListenerWired) {
            window.addEventListener('rr-language-changed', () => {
                this._applyCollapsed();
                this._updateScopeButton();
                if (this.manifest) this.render();
            });
            this._langListenerWired = true;
        }
    }

    _editScope() {
        return (this.manifest && this.manifest.editScope === 'all') ? 'all' : 'selected';
    }

    _toggleEditScope() {
        if (!this.manifest) return;
        this.manifest.editScope = (this._editScope() === 'all') ? 'selected' : 'all';
        this._markDirty();
        this._syncEditScopeToMapEditor();
        this._updateScopeButton();
        if (this.callbacks.updateStatus) {
            this.callbacks.updateStatus(this._editScope() === 'all'
                ? LayersPanel.tt('Editing all layers')
                : LayersPanel.tt('Editing selected layer only'));
        }
    }

    _updateScopeButton() {
        const header = document.querySelector('#layers-section .sidebar-header');
        const btn = header && header.querySelector('.rr-scope-toggle');
        if (!btn) return;
        const all = this._editScope() === 'all';
        btn.textContent = all ? LayersPanel.tt('All') : LayersPanel.tt('Selected');
        btn.style.background = all ? 'var(--color-accent-bright)' : '';
        btn.style.color = all ? 'var(--color-bg-deep)' : '';
        btn.style.borderColor = all ? 'var(--color-accent-bright)' : '';
        btn.style.fontWeight = all ? '700' : '';
    }

    _syncEditScopeToMapEditor() {
        if (!this.mapEditor) return;
        const scope = this._editScope();
        if (typeof this.mapEditor.setEditScope === 'function') this.mapEditor.setEditScope(scope);
    }

    _applyCollapsed() {
        if (this.containerEl) this.containerEl.style.display = this.collapsed ? 'none' : '';
        const header = document.querySelector('#layers-section .sidebar-header');
        const titleEl = header && header.querySelector('.rr-layers-title');
        if (titleEl) {
            const glyph = this.collapsed ? '\u25B6' : '\u25BC';
            titleEl.textContent = `${glyph} ${LayersPanel.tt('Layers')}`;
        }
    }

    loadFromMap(map) {
        const m = this.migrateMapManifest(map);
        this.manifest = m;
        this._collapsedEventSubs = new Set(['evp-0', 'evp-1', 'evp-2']); // event sublayers collapsed by default
        this._pushToTilemap();
        this._syncActiveToMapEditor();
        this._syncEditScopeToMapEditor();
        this._syncLockedToMapEditor();
        this.render();
    }

    // Public refresh — EventManager calls this via _notifyLayersPanel.
    refresh() { this.render(); }

    // =====================================================================
    // Rendering
    // =====================================================================
    render() {
        if (!this.containerEl) return;
        if (!this.manifest) {
            this.containerEl.innerHTML = `<div style="padding:10px;font-size:11px;color:var(--color-text-muted);">${LayersPanel.tt('No map loaded')}</div>`;
            return;
        }
        const tt = LayersPanel.tt;

        const wallLayers = this.manifest.tileLayers.filter(l => l.kind === 'A');
        const objLayers = this.manifest.tileLayers.filter(l => l.kind !== 'A');

        // Display top = front → reverse each group.
        const wallRows = wallLayers.slice().reverse().map(l => this._tileRowHtml(l)).join('');
        const objRows = objLayers.slice().reverse().map(l => this._tileRowHtml(l)).join('');

        const eventsHtml = this._eventsSectionHtml();
        const statusLine = this._statusLineHtml();

        this.containerEl.innerHTML = `
            ${statusLine}
            ${this._groupHeaderHtml('walls', tt('Walls / floor'))}
            <div class="rr-grp-walls" style="display:${this._collapsedGroups.has('walls') ? 'none' : ''}">${wallRows}</div>
            ${this._groupHeaderHtml('objects', tt('Objects'), true)}
            <div class="rr-grp-objects" style="display:${this._collapsedGroups.has('objects') ? 'none' : ''}">${objRows}</div>
            ${this._groupHeaderHtml('events', tt('Events'))}
            <div class="rr-grp-events" style="display:${this._collapsedGroups.has('events') ? 'none' : ''}">${eventsHtml}</div>`;

        this._wireTileRows();
        this._wireGroupHeaders();
        this._wireEventsSection();
    }

    // One-line indicator of both paint targets (which tile layer is active +
    // which priority new events get), so it's always clear where things land.
    _statusLineHtml() {
        const tt = LayersPanel.tt;
        const active = this._activeEntry();
        const tileName = active ? active.name : '—';
        const labels = LayersPanel.PRIORITY_LABELS();
        const ap = (this.manifest.activeEventPriority === 0 || this.manifest.activeEventPriority === 2) ? this.manifest.activeEventPriority : 1;
        return `<div style="padding:6px 8px;font-size:10px;color:var(--color-text);background:var(--color-bg-deep);border-bottom:1px solid var(--color-border-subtle);display:flex;gap:14px;align-items:center;">
            <span title="${tt('Active tile layer')}"><span style="color:var(--color-accent-bright);">\u25B6</span> ${tt('Tile')}: <b>${LayersPanel._esc(tileName)}</b></span>
            <span title="${tt('Priority for new events')}"><span style="color:var(--color-accent-bright);">\u25B6</span> ${tt('Events')}: <b>${labels[ap]}</b></span>
        </div>`;
    }

    _groupHeaderHtml(key, label, withAdd) {
        const tt = LayersPanel.tt;
        const glyph = this._collapsedGroups.has(key) ? '\u25B6' : '\u25BC';
        const addBtn = withAdd
            ? `<button class="rr-layer-tile-add rr-btn-chip" data-grp="${key}" title="${tt('Add object sublayer (B-F tiles)')}" style="padding:1px 7px;font-size:12px;line-height:1;">+</button>`
            : '';
        return `<div class="rr-grp-header" data-grp="${key}"
            style="padding:6px 8px;font-size:9px;font-weight:700;color:var(--color-accent-bright);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--color-border-subtle);border-top:1px solid var(--color-border-subtle);display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">
            <span><span class="rr-grp-glyph">${glyph}</span> ${label}</span>${addBtn}</div>`;
    }

    _tileRowHtml(layer) {
        const tt = LayersPanel.tt;
        const isActive = layer.id === this.manifest.activeTileLayer;
        const dim = this.eventModeActive ? 0.5 : 1;
        const eye = this._eyeSvg(layer.visible);
        const lock = this._lockSvg(layer.locked);
        const isExtended = layer.z == null;
        const isObject = layer.kind === 'O';
        // Merge-down is available on object layers that have another object
        // layer rendered below them (lower array index among object layers).
        let canMergeDown = false;
        if (isObject) {
            const objArr = this.manifest.tileLayers.filter(l => l.kind === 'O');
            canMergeDown = objArr.findIndex(l => l.id === layer.id) > 0;
        }
        const delBtn = isExtended
            ? `<button class="rr-layer-del rr-btn-chip" data-id="${layer.id}" title="${tt('Delete sublayer')}" style="padding:1px 6px;">\u2715</button>`
            : '';
        const mergeBtn = canMergeDown
            ? `<button class="rr-layer-merge rr-btn-chip" data-id="${layer.id}" title="${tt('Merge into the layer below')}" style="padding:2px 5px;"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 3v9M7 9l5 4 5-4M4 19h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
            : '';
        const kindLabel = isObject ? '\u25C6' : LayersPanel._kindLabel(layer.kind); // ◆ for object layers, letter for walls
        const kindTitle = isObject ? tt('Object layer (any B-F tile)') : tt('Layer');
        const activeMark = isActive ? '<span title="active" style="color:var(--color-accent-bright);font-size:10px;flex:0 0 auto;">\u25CF</span>' : '';
        return `
            <div class="rr-layer-row" data-id="${layer.id}"
                 style="display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:grab;font-size:11px;color:var(--color-text);border-left:3px solid ${isActive ? 'var(--color-accent-bright)' : 'transparent'};border-bottom:1px solid var(--color-border-subtle);background:${isActive ? 'var(--color-bg-hover)' : 'transparent'};opacity:${layer.visible ? dim : 0.45};${this.eventModeActive && !isActive ? 'filter:grayscale(0.6);' : ''}">
                ${activeMark}
                <span class="rr-layer-kind" title="${kindTitle}" style="flex:0 0 auto;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--color-accent-bright);border:1px solid var(--color-border-input);border-radius:3px;">${kindLabel}</span>
                <span class="rr-layer-name" title="${tt('Double-click to rename')}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${LayersPanel._esc(layer.name)}</span>
                <button class="rr-layer-vis rr-btn-chip" data-id="${layer.id}" title="${tt('Show / hide layer')}" style="padding:2px 5px;">${eye}</button>
                <button class="rr-layer-lock rr-btn-chip" data-id="${layer.id}" title="${tt('Lock / unlock layer')}" style="padding:2px 5px;">${lock}</button>
                <button class="rr-layer-up rr-btn-chip" data-id="${layer.id}" title="${tt('Move up')}" style="padding:1px 6px;">\u25B2</button>
                    <button class="rr-layer-down rr-btn-chip" data-id="${layer.id}" title="${tt('Move down')}" style="padding:1px 6px;">\u25BC</button>
                    ${mergeBtn}
                    ${delBtn}
            </div>`;
    }

    // ---- Events section: 3 priority sublayers ----
    _eventsSectionHtml() {
        const tt = LayersPanel.tt;
        const labels = LayersPanel.PRIORITY_LABELS();
        const prioLayers = this.manifest.eventPriorityLayers || [];
        const byPrio = new Map(prioLayers.map(l => [l.priority, l]));
        const groups = this._eventsGroupedByPriority();

        const subs = [0, 1, 2].map(p => {
            const layer = byPrio.get(p) || { priority: p, visible: true };
            const evs = groups[p] || [];
            const collapsed = this._collapsedEventSubs.has('evp-' + p);
            const glyph = collapsed ? '\u25B6' : '\u25BC';
            const eye = this._eyeSvg(layer.visible !== false);
            const ap = (this.manifest.activeEventPriority === 0 || this.manifest.activeEventPriority === 2) ? this.manifest.activeEventPriority : 1;
            const isActivePrio = p === ap;
            const activeMark = isActivePrio ? `<span class="rr-ev-sub-active" title="${tt('new events land here')}" style="color:var(--color-accent-bright);font-size:10px;flex:0 0 auto;">\u25CF</span>` : '';
            const rows = evs.map(ev => this._eventRowHtml(ev, p)).join('');
            // Active sublayer mirrors the active tile-row style: gold left bar
            // (3px) + bg-hover + ●. Inactive headers render in a neutral grey.
            return `
                <div class="rr-ev-sub" data-prio="${p}" data-drop="1"
                     style="border-bottom:1px solid var(--color-border-subtle);border-left:3px solid ${isActivePrio ? 'var(--color-accent-bright)' : 'transparent'};">
                    <div class="rr-ev-sub-header" data-prio="${p}"
                         style="display:flex;align-items:center;gap:6px;padding:5px 8px;cursor:pointer;background:${isActivePrio ? 'var(--color-bg-hover)' : 'var(--color-bg-input)'};font-size:11px;color:var(--color-text);">
                        <span class="rr-ev-sub-glyph" data-prio="${p}" style="flex:0 0 auto;padding:0 2px;">${glyph}</span>
                        ${activeMark}
                        <span class="rr-ev-sub-label" data-prio="${p}" style="flex:1;font-weight:600;color:var(--color-accent-bright);">${labels[p]}</span>
                        <span title="${evs.length} ${tt('events')}" style="font-size:10px;color:var(--color-text-dim);background:var(--color-bg-input);border:1px solid var(--color-border-subtle);border-radius:8px;padding:0 6px;min-width:18px;text-align:center;">${evs.length}</span>
                        <button class="rr-ev-sub-vis rr-btn-chip" data-prio="${p}" title="${tt('Show / hide layer')}" style="padding:2px 5px;">${eye}</button>
                    </div>
                    <div class="rr-ev-sub-body" style="display:${collapsed ? 'none' : ''};">${rows}</div>
                </div>`;
        }).join('');

        const hint = this.eventModeActive
            ? `<div style="padding:6px 10px;font-size:10px;color:var(--color-accent-bright);">${tt('Drag an event onto a sublayer to change its priority.')}</div>`
            : `<div style="padding:6px 10px;font-size:10px;color:var(--color-text-muted);">${tt('Click a sublayer to target it for new events. Click an event to select.')}</div>`;
        return subs + hint;
    }

    _eventRowHtml(event, prio) {
        const tt = LayersPanel.tt;
        const selected = this.eventManager && this.eventManager.selectedEvent && this.eventManager.selectedEvent.id === event.id;
        let thumb = '';
        if (this.eventManager && typeof this.eventManager.getEventThumbnail === 'function') {
            const url = this.eventManager.getEventThumbnail(event, 24);
            if (url) {
                thumb = `<img src="${url}" width="24" height="24" style="flex:0 0 auto;width:24px;height:24px;image-rendering:pixelated;border:1px solid var(--color-border-subtle);border-radius:3px;background:var(--color-bg-deep);" alt="">`;
            }
        }
        return `<div class="rr-ev-row" data-id="${event.id}" draggable="true"
            style="display:flex;align-items:center;gap:6px;padding:5px 8px 5px 22px;cursor:grab;font-size:11px;color:var(--color-text);border-left:3px solid ${selected ? 'var(--color-accent-bright)' : 'transparent'};background:${selected ? 'var(--color-bg-hover)' : 'transparent'};">
            ${thumb}
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${String(event.id).padStart(3, '0')}: ${LayersPanel._esc(event.name || tt('Unnamed Event'))}</span>
        </div>`;
    }

    _eventsGroupedByPriority() {
        const out = { 0: [], 1: [], 2: [] };
        const em = this.eventManager;
        const events = em && em.currentMap && Array.isArray(em.currentMap.events) ? em.currentMap.events : [];
        for (const ev of events) {
            if (!ev) continue;
            const p = em ? em.getEventPriority(ev) : 1;
            if (out[p]) out[p].push(ev);
        }
        return out;
    }

    _eyeSvg(visible) {
        return visible
            ? '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A11 11 0 0 1 12 6c7 0 11 6 11 6a18 18 0 0 1-3.2 3.9M6.2 7.5A18 18 0 0 0 1 12s4 6 11 6a11 11 0 0 0 4.2-.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    }

    _lockSvg(locked) {
        return locked
            ? '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="10" width="14" height="9" rx="1.5" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
            : '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="10" width="14" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    }

    static _kindLabel(kind) { return kind || '?'; }
    static _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // =====================================================================
    // Wiring
    // =====================================================================
    _wireGroupHeaders() {
        const root = this.containerEl;
        if (!root) return;
        root.querySelectorAll('.rr-grp-header').forEach(h => {
            h.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const key = h.dataset.grp;
                if (this._collapsedGroups.has(key)) this._collapsedGroups.delete(key);
                else this._collapsedGroups.add(key);
                this.render();
            });
        });
        const addBtn = root.querySelector('.rr-layer-tile-add');
        if (addBtn) addBtn.addEventListener('click', () => this.addTileSublayer());
    }

    _wireTileRows() {
        const root = this.containerEl;
        if (!root) return;

        root.querySelectorAll('.rr-layer-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button,input,select,textarea')) return;
                this.setActiveById(row.dataset.id);
            });
            const nameEl = row.querySelector('.rr-layer-name');
            if (nameEl) {
                nameEl.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this._rename(row.dataset.id, nameEl);
                });
            }
        });
        root.querySelectorAll('.rr-layer-vis').forEach(btn =>
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleVisible(btn.dataset.id); }));
        root.querySelectorAll('.rr-layer-lock').forEach(btn =>
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleLock(btn.dataset.id); }));
        root.querySelectorAll('.rr-layer-up').forEach(btn =>
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.moveLayer(btn.dataset.id, +1); }));
        root.querySelectorAll('.rr-layer-down').forEach(btn =>
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.moveLayer(btn.dataset.id, -1); }));
        root.querySelectorAll('.rr-layer-del').forEach(btn =>
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteTileLayer(btn.dataset.id); }));
        root.querySelectorAll('.rr-layer-merge').forEach(btn =>
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.mergeLayerDown(btn.dataset.id); }));

        // Drag-to-reorder, scoped per group so walls and objects don't mix.
        this._enableListDnd(root.querySelector('.rr-grp-walls'), '.rr-layer-row', () => this._rebuildTileLayersFromDom());
        this._enableListDnd(root.querySelector('.rr-grp-objects'), '.rr-layer-row', () => this._rebuildTileLayersFromDom());
    }

    _wireEventsSection() {
        const root = this.containerEl;
        if (!root || !this.eventManager) return;

        // Sublayer header: collapse toggle + eye.
        // Sublayer glyph (▼) = collapse/expand; label = set active priority
        // (where new events land). Buttons handled separately.
        root.querySelectorAll('.rr-ev-sub-glyph').forEach(glyph => {
            glyph.addEventListener('click', (e) => {
                e.stopPropagation();
                const p = glyph.dataset.prio;
                const key = 'evp-' + p;
                if (this._collapsedEventSubs.has(key)) this._collapsedEventSubs.delete(key);
                else this._collapsedEventSubs.add(key);
                this.render();
            });
        });
        root.querySelectorAll('.rr-ev-sub-label').forEach(label => {
            label.addEventListener('click', (e) => {
                const p = parseInt(label.dataset.prio, 10);
                this._setActiveEventPriority(p);
            });
        });
        root.querySelectorAll('.rr-ev-sub-vis').forEach(btn =>
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleEventPriorityVisible(parseInt(btn.dataset.prio, 10));
            }));

        // Event rows: click = select + enter event mode; dblclick = edit.
        root.querySelectorAll('.rr-ev-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const id = parseInt(row.dataset.id, 10);
                if (this.eventManager && typeof this.eventManager.selectEventById === 'function') {
                    this.eventManager.selectEventById(id);
                }
                if (!this.eventModeActive && this.callbacks.enterEventMode) this.callbacks.enterEventMode();
            });
            row.addEventListener('dblclick', (e) => {
                const id = parseInt(row.dataset.id, 10);
                const ev = this.eventManager.currentMap && this.eventManager.currentMap.events[id];
                if (ev && typeof this.eventManager.editEvent === 'function') {
                    this.eventManager.selectEventById(id);
                    this.eventManager.editEvent(ev);
                }
            });
            // Drag an event onto another sublayer.
            row.addEventListener('dragstart', (e) => {
                this._draggedEventId = parseInt(row.dataset.id, 10);
                row.style.opacity = '0.35';
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', () => {
                row.style.opacity = '';
                this._draggedEventId = null;
                root.querySelectorAll('.rr-ev-sub').forEach(s => s.style.boxShadow = '');
            });
        });

        // Sublayer drop targets.
        root.querySelectorAll('.rr-ev-sub').forEach(sub => {
            sub.addEventListener('dragover', (e) => {
                if (this._draggedEventId == null) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                sub.style.boxShadow = 'inset 0 0 0 2px var(--color-accent-bright)';
            });
            sub.addEventListener('dragleave', () => { sub.style.boxShadow = ''; });
            sub.addEventListener('drop', (e) => {
                if (this._draggedEventId == null) return;
                e.preventDefault();
                sub.style.boxShadow = '';
                const p = parseInt(sub.dataset.prio, 10);
                if (this.eventManager && typeof this.eventManager.moveEventToPriority === 'function') {
                    this.eventManager.moveEventToPriority(this._draggedEventId, p);
                }
                this._draggedEventId = null;
            });
        });
    }

    _toggleEventPriorityVisible(priority) {
        const layer = (this.manifest.eventPriorityLayers || []).find(l => l.priority === priority);
        if (!layer) return;
        layer.visible = !(layer.visible !== false);
        this._markDirty();
        if (this.eventManager && typeof this.eventManager.applyEventLayerVisibility === 'function') {
            this.eventManager.applyEventLayerVisibility();
        }
        this.render();
    }

    // Selecting a priority sublayer makes it the target for newly-created
    // events (they inherit its priorityType on all pages).
    _setActiveEventPriority(priority) {
        if (priority !== 0 && priority !== 1 && priority !== 2) return;
        this.manifest.activeEventPriority = priority;
        if (this.eventManager && typeof this.eventManager.setActiveEventPriority === 'function') {
            this.eventManager.setActiveEventPriority(priority);
        }
        this._markDirty();
        this.render();
    }

    _enableListDnd(scopeEl, selector, rebuild) {
        if (!scopeEl) return;
        const rows = Array.from(scopeEl.querySelectorAll(selector));
        if (rows.length < 2) return;
        let dragged = null;
        rows.forEach(row => {
            row.setAttribute('draggable', 'true');
            row.addEventListener('dragstart', (e) => {
                if (e.target.closest('button,input,select,textarea')) { e.preventDefault(); return; }
                dragged = row;
                row.style.opacity = '0.35';
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', () => {
                if (dragged) dragged.style.opacity = '';
                dragged = null;
                rows.forEach(r => { r.style.boxShadow = ''; });
            });
            row.addEventListener('dragover', (e) => {
                if (!dragged || dragged === row) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                const rect = row.getBoundingClientRect();
                const above = e.clientY < rect.top + rect.height / 2;
                row.style.boxShadow = above
                    ? 'inset 0 2px 0 var(--color-accent-bright)'
                    : 'inset 0 -2px 0 var(--color-accent-bright)';
            });
            row.addEventListener('dragleave', () => { row.style.boxShadow = ''; });
            row.addEventListener('drop', (e) => {
                if (!dragged || dragged === row) return;
                e.preventDefault();
                row.style.boxShadow = '';
                const rect = row.getBoundingClientRect();
                const after = e.clientY >= rect.top + rect.height / 2;
                scopeEl.insertBefore(dragged, after ? row.nextSibling : row);
                rebuild();
                dragged = null;
            });
        });
    }

    _rebuildTileLayersFromDom() {
        if (!this.containerEl || !this.manifest) return;
        const domIds = Array.from(this.containerEl.querySelectorAll('.rr-layer-row')).map(r => r.dataset.id);
        const order = domIds.slice().reverse(); // array order (bottom→top)
        this.manifest.tileLayers.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        this._markDirty();
        this._pushToTilemap();
        this.render();
    }

    _rename(id, nameEl) {
        const layer = this.manifest.tileLayers.find(l => l.id === id);
        if (!layer || !nameEl) return;
        const current = layer.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.style.cssText = 'flex:1;min-width:0;font-size:11px;background:var(--color-bg-input);border:1px solid var(--color-accent-bright);color:var(--color-text);border-radius:3px;padding:1px 4px;';
        nameEl.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
            const v = (input.value || '').trim() || current;
            layer.name = v;
            this._markDirty();
            this.render();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            else if (e.key === 'Escape') { input.value = current; input.blur(); }
        });
    }

    // =====================================================================
    // Tile-layer mutators
    // =====================================================================
    _find(id) { return this.manifest && this.manifest.tileLayers.find(l => l.id === id); }
    _activeEntry() { return this.manifest ? this._find(this.manifest.activeTileLayer) : null; }

    setActiveById(id, opts = {}) {
        if (!this.manifest) return;
        const layer = this._find(id);
        if (!layer) return;
        // No dimming anymore — selecting the already-active layer is a no-op.
        if (this.manifest.activeTileLayer === id && !opts.force) return;
        this._syncing = true;
        this.manifest.activeTileLayer = id;
        this._syncActiveToMapEditor();
        if (!opts.fromPalette && this.tilesetPaletteViewer) {
            if (layer.kind === 'A') {
                // Selecting the walls layer → show autotiles (tab A).
                if (this.tilesetPaletteViewer.currentLayer !== 'A') this.tilesetPaletteViewer.selectLayer('A');
            } else {
                // Object layer (native z1-3 or extended): make sure we're on a
                // B-F tab so object tiles are visible. Don't force a specific
                // tab — the user picks whichever tileset they want to paint from.
                const cur = this.tilesetPaletteViewer.currentLayer;
                if (cur === 'A' || cur === 'R' || !cur) this.tilesetPaletteViewer.selectLayer('B');
            }
        }
        if (!opts.fromPalette && this.eventModeActive && this.callbacks.disableEventModeIfActive) {
            this.callbacks.disableEventModeIfActive();
        }
        this._pushToTilemap();
        this.render();
        this._syncing = false;
        if (this.callbacks.updateStatus) {
            this.callbacks.updateStatus(`${LayersPanel.tt('Active layer')}: ${layer.name}`);
        }
    }

    // Palette tab changed → keep the active layer's CATEGORY consistent with
    // the picked tile, but stay sticky WITHIN objects (B/C/D/E/F don't change
    // which object layer is active). This prevents painting a B-F tile onto
    // the walls layer (z0) and vice versa.
    setActiveByPaletteTab(tab) {
        if (this._syncing) return;
        if (!this.manifest || !tab || tab === 'R') return;
        const active = this._activeEntry();
        const activeKind = active && active.kind;
        if (tab === 'A') {
            // Picking an A (autotile/A5) tile → walls layer.
            if (activeKind === 'A') return;
            const walls = this.manifest.tileLayers.find(l => l.kind === 'A');
            if (walls) this.setActiveById(walls.id, { fromPalette: true });
        } else {
            // B/C/D/E/F/G → object layer. Sticky if already on one.
            if (activeKind === 'O') return;
            const obj = this.manifest.tileLayers.find(l => l.kind === 'O');
            if (obj) this.setActiveById(obj.id, { fromPalette: true });
        }
    }

    toggleVisible(id) {
        const layer = this._find(id);
        if (!layer) return;
        layer.visible = !layer.visible;
        this._markDirty();
        this._pushToTilemap();
        this.render();
    }

    toggleLock(id) {
        const layer = this._find(id);
        if (!layer) return;
        layer.locked = !layer.locked;
        this._markDirty();
        this._syncLockedToMapEditor();
        this.render();
    }

    moveLayer(id, dir) {
        if (!this.manifest) return;
        const arr = this.manifest.tileLayers;
        const i = arr.findIndex(l => l.id === id);
        if (i < 0) return;
        const j = i + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        this._markDirty();
        this._pushToTilemap();
        this.render();
    }

    _syncActiveToMapEditor() {
        if (!this.mapEditor) return;
        const active = this._activeEntry();
        if (!active) return;
        // Track the active layer's category so MapEditor can reject mismatched
        // tiles (e.g. a B-F tile on the walls layer).
        this.mapEditor.activeLayerKind = (active.kind === 'A') ? 'A' : 'O';
        if (active.z == null) {
            this.mapEditor.activeExtendedLayerId = active.id;
            this.mapEditor.layerMode = 'auto';
        } else {
            this.mapEditor.activeExtendedLayerId = null;
            if (typeof this.mapEditor.setLayerMode === 'function') this.mapEditor.setLayerMode(active.z);
        }
    }

    addTileSublayer() {
        if (!this.manifest) return;
        const map = this.tilemapManager && this.tilemapManager.currentMap;
        if (!map) return;
        // Next object layer: first free native z (1/2/3), else extended (null).
        const usedZ = new Set(this.manifest.tileLayers
            .filter(l => l.kind === 'O' && typeof l.z === 'number').map(l => l.z));
        let z = null;
        for (const cand of [1, 2, 3]) { if (!usedZ.has(cand)) { z = cand; break; } }
        const n = this.manifest.tileLayers.filter(l => l.kind === 'O').length + 1;
        const id = (z == null ? 'rr-l-x-' : 'rr-l-o-' + z + '-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const layer = { id, name: `${LayersPanel.tt('Object')} ${n}`, kind: 'O', z, visible: true, locked: false };
        this.manifest.tileLayers.push(layer);
        if (z == null) {
            const size = (map.width || 1) * (map.height || 1);
            if (!map.reactor.extraTileData) map.reactor.extraTileData = {};
            map.reactor.extraTileData[id] = new Array(size).fill(0);
        }
        this.manifest.activeTileLayer = id;
        this._markDirty();
        if (z == null && this.tilemapManager && typeof this.tilemapManager.rebuildExtraLayers === 'function') {
            this.tilemapManager.rebuildExtraLayers();
        }
        this._syncActiveToMapEditor();
        this._pushToTilemap();
        this.render();
    }

    deleteTileLayer(id) {
        if (!this.manifest) return;
        const arr = this.manifest.tileLayers;
        const idx = arr.findIndex(l => l.id === id);
        if (idx < 0 || arr[idx].z != null) return; // native layers can't be deleted here
        const map = this.tilemapManager && this.tilemapManager.currentMap;
        arr.splice(idx, 1);
        if (map && map.reactor && map.reactor.extraTileData) delete map.reactor.extraTileData[id];
        if (this.manifest.activeTileLayer === id) {
            this.manifest.activeTileLayer = arr[0].id;
        }
        this._markDirty();
        if (this.tilemapManager && typeof this.tilemapManager.rebuildExtraLayers === 'function') {
            this.tilemapManager.rebuildExtraLayers();
        }
        this._syncActiveToMapEditor();
        this._pushToTilemap();
        this.render();
    }

    // Merge a layer's tiles into the object layer rendered directly below it
    // (the next object layer at a lower array index). On a per-cell conflict
    // the source (upper) tile wins; empty target cells take the source tile.
    // Works across native z-slots and extended (extraTileData) layers alike.
    mergeLayerDown(id) {
        if (!this.manifest) return;
        const tm = this.tilemapManager;
        const map = tm && tm.currentMap;
        if (!map) return;
        const objArr = this.manifest.tileLayers.filter(l => l.kind === 'O');
        const srcIdx = objArr.findIndex(l => l.id === id);
        if (srcIdx <= 0) return; // nothing below to merge into
        const src = objArr[srcIdx];
        const tgt = objArr[srcIdx - 1];

        const ls = map.width * map.height;
        const extra = map.reactor.extraTileData || {};
        const readTile = (layer, pos) => (layer.z == null) ? (extra[layer.id] ? extra[layer.id][pos] : 0) : map.data[layer.z * ls + pos];
        const writeTile = (layer, pos, val) => {
            if (layer.z == null) {
                if (!extra[layer.id]) extra[layer.id] = new Array(ls).fill(0);
                extra[layer.id][pos] = val;
            } else {
                map.data[layer.z * ls + pos] = val;
            }
        };

        for (let pos = 0; pos < ls; pos++) {
            const sv = readTile(src, pos);
            if (sv) writeTile(tgt, pos, sv); // source wins (including conflicts)
            // clear source cell
            if (src.z == null) { if (extra[src.id]) extra[src.id][pos] = 0; }
            else map.data[src.z * ls + pos] = 0;
        }

        // Remove the source layer (and its extended data/container if any).
        const arr = this.manifest.tileLayers;
        const realIdx = arr.findIndex(l => l.id === id);
        if (realIdx >= 0) arr.splice(realIdx, 1);
        if (src.z == null && extra[src.id]) delete extra[src.id];
        if (this.manifest.activeTileLayer === id) this.manifest.activeTileLayer = tgt.id;

        this._markDirty();
        // Incremental visual refresh — update only the affected z-slots/cells
        // instead of a full renderMap(). Extended containers are rebuilt (their
        // data changed) when either side is extended.
        if (src.z == null || tgt.z == null) {
            if (typeof tm.rebuildExtraLayers === 'function') tm.rebuildExtraLayers();
        }
        if (typeof tm.updateTiles === 'function') {
            const ups = [];
            const zs = [];
            if (typeof src.z === 'number') zs.push(src.z);
            if (typeof tgt.z === 'number' && tgt.z !== src.z) zs.push(tgt.z);
            for (const z of zs) {
                for (let y = 0; y < map.height; y++) {
                    for (let x = 0; x < map.width; x++) ups.push({ x, y, layer: z });
                }
            }
            if (ups.length) tm.updateTiles(ups);
        }
        this._syncActiveToMapEditor();
        this._pushToTilemap();
        this.render();
        if (this.callbacks.updateStatus) {
            this.callbacks.updateStatus(`${LayersPanel.tt('Merged into')}: ${tgt.name}`);
        }
    }
    _pushToTilemap() {
        if (this.tilemapManager && typeof this.tilemapManager.setLayerManifest === 'function') {
            this.tilemapManager.setLayerManifest(this.manifest);
        }
        if (this.tilemapManager && typeof this.tilemapManager.applyLayerState === 'function') {
            this.tilemapManager.applyLayerState();
        }
        this._syncLockedToMapEditor();
    }

    _syncLockedToMapEditor() {
        if (!this.mapEditor || !this.manifest) return;
        if (typeof this.mapEditor.setLockedLayerZs !== 'function') return;
        const zs = this.manifest.tileLayers.filter(l => l.locked).map(l => l.z);
        this.mapEditor.setLockedLayerZs(zs);
    }

    onEventModeChanged(active) {
        this.eventModeActive = !!active;
        this.render();
    }

    _markDirty() {
        // Manifest is map.reactor.layers in-place; isMapDirty() detects changes
        // via JSON diff, so edits are saved with the map automatically.
        if (this.mapEditor && typeof this.mapEditor.markDirty === 'function') this.mapEditor.markDirty();
    }
}

if (typeof window !== 'undefined') {
    window.LayersPanel = LayersPanel;
}
