// Agonia Engine - Light Manager
// Displays and edits SDLight light sources on the map inside the editor.
// Persists to <project>/data/SDE_LightEditor.json — the same file the runtime
// plugin (SDLight.js + SRD_LightEditor.js) reads via applyPatchMap().
//
// Modelled on EventManager (layer/interaction pattern). Two light kinds:
//   - 'event': bound to an RPG Maker event via a note-tag (light/fire/flashlight),
//               editable as an override in patch.sources[mapId][eventId].
//   - 'synthetic': a free-standing light placed on a tile, stored in
//               patch.syntheticLights[mapId] (array).

class LightManager {
    constructor(projectController, databaseManager) {
        this.projectController = projectController;
        this.databaseManager = databaseManager;
        this.currentMap = null;
        this.tilemapManager = null;

        this.lightMode = false;            // editing mode active
        this.previewOn = false;            // playtest-style lighting overlay
        this._previewCanvas = null;        // offscreen <canvas> for the mask
        this._previewSprite = null;        // PIXI sprite wrapping the mask (multiply blend)
        this.lightContainer = null;        // PIXI.Container holding all markers
        this.selectionHighlight = null;    // PIXI.Graphics for selected marker
        this.markers = [];                 // [{ uid, light, sprite }]
        this.selectedUid = null;

        this._patch = this._defaultPatch();  // parsed SDE_LightEditor.json (default until loadPatch)
        this._patchLoaded = false;
        this._lastPatchPath = null;          // tracks project-path changes for reload
        this._dirty = false;
        this._saveTimer = null;

        this._nextUid = 1;
        this._nextSid = 1000;              // synthetic-session ids (editor-local)

        this.fs = null;
        this.path = null;
        const host = typeof window !== 'undefined' ? window.RPGReactorHost : null;
        if (host?.fs && host?.path) {
            this.fs = host.fs;
            this.path = host.path;
        }
        if (!this.fs && typeof nw !== 'undefined') {
            try { this.fs = require('fs'); this.path = require('path'); } catch (e) { /* ignore */ }
        }
        if (!this.fs && typeof require === 'function') {
            try { this.fs = require('fs'); this.path = require('path'); } catch (e) { /* ignore */ }
        }

        // Interaction
        this._interactionContainer = null;
        this._pointerHandlers = null;
        this.isDragging = false;
        this.draggedUid = null;
        this._dragOffset = { x: 0, y: 0 };
        this._dragMoved = false;
        this._placementMode = false;  // when true, next empty-tile click places a synthetic

        // Region walls (SDLight blockedRegions) — loaded from plugin params
        this._blockedRegions = {};
        this._wallSoftness = 16;
        this._wallTileCache = new Map();  // key: "color_TBLR_ts" → offscreen canvas

        // Panel
        this.panelEl = null;

        this.onCoordinatesChange = null;
    }

    // =====================================================================
    // Persistence
    // =====================================================================

    _patchPath() {
        const proj = this.projectController?.getCurrentProject?.();
        if (!proj?.path) return null;
        return this.path.join(proj.path, 'data', 'SDE_LightEditor.json');
    }

    _defaultPatch() {
        return {
            version: 1, savedAt: 0,
            player: null, global: null,
            presets: {}, sources: {}, syntheticLights: {},
            movedPositions: {}, suppressedEvents: {}, library: []
        };
    }

    loadPatch() {
        if (!this.fs) return;
        const p = this._patchPath();
        if (!p) return;

        // Track project-path changes — force a reload when switching projects.
        if (this._lastPatchPath !== p) {
            this._patchLoaded = false;
            this._lastPatchPath = p;
        }
        // Idempotent: skip if already loaded for this exact path.
        if (this._patchLoaded) return;

        try {
            if (this.fs.existsSync(p)) {
                this._patch = Object.assign(this._defaultPatch(), JSON.parse(this.fs.readFileSync(p, 'utf-8')));
                // Ensure all section containers exist AND have the correct type
                // (a corrupt JSON could have e.g. sources: "string").
                if (typeof this._patch.sources !== 'object' || this._patch.sources === null) this._patch.sources = {};
                if (typeof this._patch.syntheticLights !== 'object' || this._patch.syntheticLights === null) this._patch.syntheticLights = {};
                if (typeof this._patch.movedPositions !== 'object' || this._patch.movedPositions === null) this._patch.movedPositions = {};
                if (typeof this._patch.suppressedEvents !== 'object' || this._patch.suppressedEvents === null) this._patch.suppressedEvents = {};
                if (typeof this._patch.presets !== 'object' || this._patch.presets === null) this._patch.presets = {};
                if (!Array.isArray(this._patch.library)) this._patch.library = [];
                this._patchLoaded = true;
            } else {
                // File doesn't exist yet — start fresh. _patchLoaded stays false
                // so savePatch knows it's OK to create the file.
                this._patch = this._defaultPatch();
            }
            // Load SDLight region-wall settings (blockedRegions) from plugins.js.
            this._loadBlockedRegions();
        } catch (e) {
            console.warn('[LightManager] loadPatch error:', e);
            this._patch = this._defaultPatch();
            this._patchLoaded = false;
        }
    }

    _scheduleSave() {
        if (!this.fs) return;
        // Don't schedule a save if we haven't loaded the patch yet — writing
        // a default/empty patch over an existing file destroys data.
        if (!this._patchLoaded) {
            // The project may have just become available — try loading now.
            this.loadPatch();
            if (!this._patchLoaded) return;
        }
        if (this._saveTimer) clearTimeout(this._saveTimer);
        const M = this;
        this._saveTimer = setTimeout(() => {
            M._saveTimer = null;
            try { if (M._dirty) M.savePatch(); } catch (e) { /* ignore */ }
        }, 500);
    }

    _markDirty() {
        this._dirty = true;
        this._scheduleSave();
    }

    savePatch() {
        if (!this.fs) return false;
        const p = this._patchPath();
        if (!p) return false;

        // ═══════════════════════════════════════════════════════════════════
        // CRITICAL GUARD: never write a default/empty patch over an existing
        // file.  If the file exists but we haven't loaded it (e.g. the project
        // path wasn't ready when loadPatch was first called), the in-memory
        // _patch is a default empty object — writing it would DESTROY all
        // synthetic lights, presets, and config (this exact bug already caused
        // data loss once).
        // ═══════════════════════════════════════════════════════════════════
        if (!this._patchLoaded) {
            // Retry load — the project may have become available.
            this.loadPatch();
            if (!this._patchLoaded && this.fs.existsSync(p)) {
                console.error('[LightManager] savePatch ABORTED — file exists but was not loaded. Refusing to overwrite.');
                this._setSaveStatus('⚠ сохранить не удалось (файл не загружен)', '#e74c3c');
                return false;
            }
        }

        try {
            let patch = this._patch || this._defaultPatch();

            // ═══════════════════════════════════════════════════════════════
            // MERGE-SAVE SAFETY: if the file exists on disk, read it and merge
            // any sections that our in-memory patch is missing or that have
            // more data.  This is a last-resort safety net to ensure we NEVER
            // lose data that's on disk but not in memory.
            // ═══════════════════════════════════════════════════════════════
            if (this.fs.existsSync(p)) {
                try {
                    const disk = JSON.parse(this.fs.readFileSync(p, 'utf-8'));
                    // Preserve player/global from disk if our in-memory copy is null
                    if (disk.player && !patch.player) patch.player = disk.player;
                    if (disk.global && !patch.global) patch.global = disk.global;
                    // Preserve presets from disk that we don't have in memory
                    if (disk.presets && typeof disk.presets === 'object') {
                        for (const k in disk.presets) {
                            if (disk.presets[k] && !patch.presets[k]) patch.presets[k] = disk.presets[k];
                        }
                    }
                    // Preserve other maps' data that we might not have touched
                    for (const mk in disk.sources) {
                        if (disk.sources[mk] && !patch.sources[mk]) patch.sources[mk] = disk.sources[mk];
                    }
                    for (const mk in disk.syntheticLights) {
                        if (disk.syntheticLights[mk] && !patch.syntheticLights[mk]) patch.syntheticLights[mk] = disk.syntheticLights[mk];
                    }
                    for (const mk in disk.movedPositions) {
                        if (disk.movedPositions[mk] && !patch.movedPositions[mk]) patch.movedPositions[mk] = disk.movedPositions[mk];
                    }
                    for (const mk in disk.suppressedEvents) {
                        if (disk.suppressedEvents[mk] && !patch.suppressedEvents[mk]) patch.suppressedEvents[mk] = disk.suppressedEvents[mk];
                    }
                    if (disk.library && disk.library.length && (!patch.library || !patch.library.length)) {
                        patch.library = disk.library;
                    }
                } catch (em) { /* merge failed — proceed with in-memory patch */ }
            }

            // Ensure section containers
            if (!patch.sources) patch.sources = {};
            if (!patch.syntheticLights) patch.syntheticLights = {};
            if (!patch.movedPositions) patch.movedPositions = {};
            if (!patch.suppressedEvents) patch.suppressedEvents = {};
            if (!patch.presets) patch.presets = {};
            if (!patch.library) patch.library = [];
            patch.savedAt = Date.now();

            // Backup
            try {
                if (this.fs.existsSync(p)) {
                    this.fs.writeFileSync(p + '.bak', this.fs.readFileSync(p, 'utf-8'));
                }
            } catch (eb) { /* ignore */ }

            this.fs.writeFileSync(p, JSON.stringify(patch));
            this._patch = patch;
            this._patchLoaded = true;
            this._dirty = false;
            this._setSaveStatus('✓ ' + new Date().toLocaleTimeString(), '#2ecc71');
            return true;
        } catch (e) {
            console.warn('[LightManager] savePatch error:', e);
            this._setSaveStatus('ошибка: ' + e.message, '#e74c3c');
            return false;
        }
    }

    _setSaveStatus(text, color) {
        if (!this.panelEl) return;
        const el = this.panelEl.querySelector('#lm-save-status');
        if (el) { el.textContent = text; if (color) el.style.color = color; }
    }

    // Load SDLight's Region Settings (blocked regions) from js/plugins.js.
    // Mirrors SDLight param() fallback: empty plugin param → PROJECT_DEFAULTS.
    _loadBlockedRegions() {
        this._blockedRegions = {};
        this._wallSoftness = 16;
        if (!this.fs) return;
        const proj = this.projectController?.getCurrentProject?.();
        if (!proj?.path) return;
        try {
            const pluginsPath = this.path.join(proj.path, 'js', 'plugins.js');
            if (!this.fs.existsSync(pluginsPath)) return;
            const content = this.fs.readFileSync(pluginsPath, 'utf-8');
            // plugins.js is `var $plugins = [ {...}, ... ];` — extract the array.
            const match = content.match(/\$plugins\s*=\s*(\[[\s\S]*\]);?/);
            if (!match) return;
            const plugins = JSON.parse(match[1]);
            // Prefer the enabled SDLight; fall back to SuperDuperLight.
            let entry = plugins.find(p => p && p.name === 'SDLight' && p.status !== false);
            if (!entry) entry = plugins.find(p => p && p.name === 'SDLight');
            if (!entry) return;
            const params = entry.parameters || {};

            const resolveParam = (key) => {
                const v = params[key];
                return (v === undefined || v === null || v === '')
                    ? LightManager.PROJECT_DEFAULTS[key]
                    : v;
            };

            // Region Settings → { regionId: colorHex }
            const raw = resolveParam('Region Settings') || '';
            if (raw) {
                for (const group of raw.split(',')) {
                    const pair = group.trim().split(/\s+/);
                    if (pair.length >= 2) {
                        const id = Number(pair[0]);
                        if (!isNaN(id)) this._blockedRegions[id] = this._ensureHash(pair[1]);
                    }
                }
            }

            // Wall Softness (px) — edge feathering width.
            const ws = resolveParam('Wall Softness');
            if (ws) this._wallSoftness = Math.min(Number(ws) || 16, 24);
        } catch (e) {
            console.warn('[LightManager] _loadBlockedRegions error:', e);
        }
    }

    // =====================================================================
    // Note-tag parsing (port of SDLight NoteParser.parse)
    // =====================================================================

    // Mirrors SDLight's HARDCODED_PRESETS fallback (SDLight.js lines 635-648).
    // These are always available at runtime even with empty plugin params;
    // the editor must match so the preview matches the game.
    static DEFAULT_PRESETS = {
        '1':       [{ pos: 0, alpha: 1.00 }, { pos: 1, alpha: 0 }],
        '2':       [{ pos: 0, alpha: 0.50 }, { pos: 0.20, alpha: 0.10 }, { pos: 1, alpha: 0 }],
        '3':       [{ pos: 0, alpha: 0.85 }, { pos: 1, alpha: 0 }],
        'global':  [{ pos: 0, alpha: 0.70 }, { pos: 0.01, alpha: 0.65 }, { pos: 0.02, alpha: 0.50 },
                     { pos: 0.03, alpha: 0.45 }, { pos: 0.05, alpha: 0.30 }, { pos: 1, alpha: 0 }],
        'global?': [{ pos: 0, alpha: 0.20 }, { pos: 1, alpha: 0 }],
        'global2': [{ pos: 0, alpha: 0.55 }, { pos: 1, alpha: 0 }],
        'spichka': [{ pos: 0, alpha: 0.90 }, { pos: 0.14, alpha: 0.70 }, { pos: 0.30, alpha: 0.20 },
                     { pos: 0.45, alpha: 0.10 }, { pos: 1, alpha: 0 }],
        'lamp':    [{ pos: 0, alpha: 0.80 }, { pos: 0.10, alpha: 0.65 }, { pos: 0.25, alpha: 0.45 },
                     { pos: 0.42, alpha: 0.30 }, { pos: 0.54, alpha: 0.20 }, { pos: 0.65, alpha: 0.10 },
                     { pos: 1, alpha: 0 }]
    };

    // Mirrors SDLight's PROJECT_DEFAULTS (SDLight.js line 421) — used when the
    // plugin parameter is empty/missing in js/plugins.js.
    static PROJECT_DEFAULTS = {
        'Region Settings': '8 #000000, 1 #000000, 11 #000000, 12 #000000, 13 #000000, 14 #000000,',
        'Wall Softness': '10'
    };

    _ensureHash(c) {
        if (c === undefined || c === null || c === '') return '#FFFFFF';
        c = String(c);
        if (c[0] !== '#') c = '#' + c;
        // Expand shorthand #abc → #aabbcc so <input type=color> accepts it.
        if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
        return c;
    }

    _hexToInt(hex) {
        if (typeof hex === 'number') return hex;
        if (!hex) return 0xFFFFFF;
        hex = String(hex);
        if (hex[0] === '#') hex = hex.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        return parseInt(hex, 16) || 0xFFFFFF;
    }

    _hexToRgb(hex) {
        if (!hex) return { r: 0, g: 0, b: 0 };
        hex = String(hex);
        if (hex[0] === '#') hex = hex.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const num = parseInt(hex, 16);
        return isNaN(num) ? { r: 0, g: 0, b: 0 }
            : { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    _getPreset(id) {
        if (id && this._patch?.presets?.[id]) return this._patch.presets[id];
        if (id && LightManager.DEFAULT_PRESETS[id]) return LightManager.DEFAULT_PRESETS[id];
        return null;
    }

    _presetKnown(name) {
        if (!name) return false;
        if (this._patch?.presets?.[name]) return true;
        if (LightManager.DEFAULT_PRESETS[name]) return true;
        return false;
    }

    // Parse a single note-tag line. Returns a partial light object or null.
    parseNote(noteText) {
        if (!noteText || typeof noteText !== 'string') return null;
        const lines = noteText.split(/\r?\n/);
        for (const line of lines) {
            const tokens = line.trim().split(/\s+/);
            const cmd = (tokens.shift() || '').toLowerCase();
            if (cmd !== 'light' && cmd !== 'fire' && cmd !== 'flashlight') continue;

            const type = (cmd === 'fire') ? 'Fire'
                : (cmd === 'flashlight') ? 'Flashlight'
                : 'Normal';

            const light = {
                type,
                radius: 100, radiusY: 100,
                color: '#FFFFFF',
                brightness: 1.0, falloff: 1.0,
                presetId: null, active: true,
                flashLength: 8, flashWidth: 12, direction: 0,
                cond: null
            };

            if (type === 'Flashlight') {
                light.flashLength = Number(tokens.shift()) || 8;
                light.flashWidth = Number(tokens.shift()) || 12;
            } else {
                const radTok = String(tokens.shift() || '');
                const radParts = radTok.split(':');
                light.radius = Number(radParts[0]) || 100;
                light.radiusY = (radParts.length > 1) ? (Number(radParts[1]) || light.radius) : light.radius;
            }

            const colorTok = tokens.shift();
            light.color = colorTok ? this._ensureHash(colorTok) : '#FFFFFF';

            // Pick out preset token, leave the rest
            const remaining = [];
            for (let i = 0; i < tokens.length; i++) {
                const t = tokens[i];
                if (this._presetKnown(t)) {
                    light.presetId = t;
                } else {
                    remaining.push(t);
                }
            }

            let idx = 0;
            const peek = () => remaining[idx];
            const next = () => remaining[idx++];
            const isNum = s => s !== undefined && !isNaN(Number(s));
            const isTagB = s => s && /^b\d+$/i.test(s);
            const isTagD = s => s && /^d\d+$/i.test(s);

            if (isNum(peek()) && !isTagB(peek())) next(); // optional vignetteMultiplier
            if (isTagB(peek())) {
                light.brightness = Number(next().substring(1)) / 100;
            } else if (isNum(peek())) {
                light.brightness = Number(next());
            }
            if (isNum(peek())) light.falloff = Number(next());
            while (idx < remaining.length) {
                const tok = next();
                if (isTagB(tok)) light.brightness = Number(tok.substring(1)) / 100;
                else if (isTagD(tok)) light.direction = Number(tok.substring(1));
                else if (isNum(tok)) {
                    if (type === 'Flashlight') light.direction = Number(tok);
                }
            }
            return light;
        }
        return null;
    }

    // =====================================================================
    // Collect lights for the current map
    // =====================================================================

    collectMapLights(mapId) {
        const patch = this._patch || this._defaultPatch();
        const mapKey = String(mapId);
        const out = [];

        // 1. Event-bound lights (parse note tags, apply overrides)
        const events = this.currentMap?.events;
        if (events) {
            const overrides = patch.sources[mapKey] || {};
            const moved = patch.movedPositions[mapKey] || {};
            const suppressed = patch.suppressedEvents[mapKey] || {};
            events.forEach(ev => {
                if (!ev) return;
                const base = this.parseNote(ev.note);
                const ov = overrides[String(ev.id)];
                if (!base && !ov) return; // no light at all
                const merged = Object.assign(
                    { type: 'Normal', radius: 100, radiusY: 100, color: '#FFFFFF',
                      brightness: 1, falloff: 1, presetId: null, active: true,
                      flashLength: 8, flashWidth: 12, direction: 0, cond: null },
                    base || {}, ov || {}
                );
                if (suppressed[String(ev.id)]) merged.active = false;
                let pos = moved[String(ev.id)] || { x: ev.x, y: ev.y };
                out.push({
                    uid: 'e' + ev.id,
                    kind: 'event',
                    eventId: ev.id,
                    sid: null,
                    x: pos.x, y: pos.y,
                    props: merged,
                    hasNote: !!base,
                    overridden: !!ov
                });
            });
        }

        // 2. Synthetic lights
        const syns = patch.syntheticLights[mapKey] || [];
        syns.forEach((s, i) => {
            if (!s) return;
            const props = Object.assign(
                { type: 'Normal', radius: 200, radiusY: 200, color: '#FFFFFF',
                  brightness: 1, falloff: 1, presetId: 'global', active: true,
                  flashLength: 8, flashWidth: 12, direction: 0, cond: null },
                s
            );
            out.push({
                uid: 's' + i,
                kind: 'synthetic',
                eventId: -1,
                sid: (s.sid !== undefined ? s.sid : null),
                x: s.x, y: s.y,
                props,
                synIndex: i,
                hasNote: false,
                overridden: false
            });
        });

        return out;
    }

    // =====================================================================
    // Layer setup
    // =====================================================================

    initializeLightLayer(tilemapManager) {
        if (!tilemapManager || !tilemapManager.container) {
            console.warn('[LightManager] cannot init layer: tilemap not ready');
            return;
        }

        if (this.lightContainer && this.lightContainer.parent !== tilemapManager.container) {
            // Clean up the preview sprite's texture before orphaning the old container.
            this._destroyPreviewSprite();
            if (this.lightContainer.parent) this.lightContainer.parent.removeChild(this.lightContainer);
            this.lightContainer.destroy({ children: true });
            this.lightContainer = null;
        }
        if (this.selectionHighlight && this.selectionHighlight.parent !== tilemapManager.container) {
            if (this.selectionHighlight.parent) this.selectionHighlight.parent.removeChild(this.selectionHighlight);
            this.selectionHighlight.destroy({ children: true });
            this.selectionHighlight = null;
        }

        if (!this.lightContainer) {
            this.lightContainer = new PIXI.Container();
            this.lightContainer.label = 'lights';
            // Preserve visibility across map switches: TilemapManager recreates
            // its container on every loadMap, which triggers this branch. Hard-
            // coding 'false' here would kill the preview/ edit mode.
            this.lightContainer.visible = this.lightMode || this.previewOn;
            this.lightContainer.zIndex = 955;
            tilemapManager.container.addChild(this.lightContainer);
        }
        if (!this.selectionHighlight) {
            this.selectionHighlight = new PIXI.Graphics();
            this.selectionHighlight.visible = false;
            // Above the mask so the selected-light outline stays visible.
            this.selectionHighlight.zIndex = 956;
            tilemapManager.container.addChild(this.selectionHighlight);
        }

        this.tilemapManager = tilemapManager;
    }

    setCurrentMap(map) {
        this.currentMap = map;
        // Always call loadPatch — it's idempotent (skips if already loaded for
        // this project path, reloads on project switch). This guarantees the
        // patch is loaded before any save can fire.
        this.loadPatch();
        this.selectedUid = null;
        // Canvas size changes per map → drop the stale preview sprite so it
        // rebuilds at the new dimensions.
        this._destroyPreviewSprite();
        // Wall-tile canvases are keyed by ts+softness — different maps may have
        // different sizes, so clear the cache to avoid stale mismatched tiles.
        this._wallTileCache.clear();
        this.renderLights();
        if (this.panelEl) this._refreshPanel();
    }

    // =====================================================================
    // Mode toggle
    // =====================================================================

    setLightMode(enabled) {
        this.lightMode = enabled;
        if (!enabled) this._placementMode = false;
        // Container is visible when EITHER editing or preview is on.
        if (this.lightContainer) this.lightContainer.visible = enabled || this.previewOn;
        if (enabled) {
            this.setupLightInteraction();
        } else {
            this.removeLightInteraction();
            if (this.selectionHighlight) this.selectionHighlight.visible = false;
            this.selectedUid = null;
        }
        this.renderLights();
        if (this.panelEl) this.panelEl.style.display = enabled ? '' : 'none';
        if (this.tilemapManager?.container) {
            this.tilemapManager.container.cursor = enabled ? 'default' : 'crosshair';
        }
    }

    // =====================================================================
    // Rendering
    // =====================================================================

    renderLights() {
        if (!this.lightContainer) return;
        // Destroy only marker sprites; keep the preview mask sprite intact.
        const toRemove = [];
        for (const child of this.lightContainer.children) {
            if (child !== this._previewSprite) toRemove.push(child);
        }
        for (const c of toRemove) {
            this.lightContainer.removeChild(c);
            c.destroy({ children: true });
        }
        this.markers = [];

        if (!this.currentMap) return;

        // Refresh the preview mask if active (edits must reflect in the overlay).
        if (this.previewOn) this.renderPreview();

        // Markers only render in edit mode (the preview overlay can show alone).
        if (!this.lightMode) return;

        const lights = this.collectMapLights(this.currentMap.id);
        const ts = this.tilemapManager ? this.tilemapManager.TILE_WIDTH : 48;

        for (const L of lights) {
            const sprite = this._createMarker(L, ts);
            sprite.x = L.x * ts + ts / 2;
            sprite.y = L.y * ts + ts / 2;
            sprite._lmUid = L.uid;
            sprite.eventMode = 'static';
            sprite.cursor = 'pointer';
            this.lightContainer.addChild(sprite);
            this.markers.push({ uid: L.uid, light: L, sprite });
        }

        this._updateSelectionHighlight();
    }

    // =====================================================================
    // Playtest-style preview overlay
    // =====================================================================

    setPreview(on) {
        this.previewOn = !!on;
        if (this.previewOn) {
            // Ensure the light container exists even if light MODE is off,
            // and is visible so the preview shows.
            if (this.lightContainer) this.lightContainer.visible = true;
            this.renderPreview();
        } else {
            this._destroyPreviewSprite();
            // If preview was the only reason the container was visible
            // (light mode off), hide it again.
            if (this.lightContainer && !this.lightMode) this.lightContainer.visible = false;
        }
        // Reflect toggle state on the overlay button, if present.
        const btn = document.getElementById('overlay-light-btn');
        if (btn) btn.classList.toggle('active', this.previewOn);
    }

    _masterAlpha() {
        // Formula from SDLight _updateMasterAlpha (line 1684).
        // patch.global.masterOpacity: 0 = full darkness, 100 = no mask.
        const mVal = this._patch?.global?.masterOpacity ?? 0;
        const progress = Math.max(0, Math.min(100, Number(mVal) || 0)) / 100;
        return Math.max(0, Math.min(1, 1.0 - Math.pow(progress, 2.5)));
    }

    renderPreview() {
        if (!this.previewOn || !this.lightContainer || !this.currentMap) return;
        if (typeof PIXI === 'undefined') return;

        const ts = this.tilemapManager ? this.tilemapManager.TILE_WIDTH : 48;
        const mapW = this.currentMap.width * ts;
        const mapH = this.currentMap.height * ts;
        if (mapW <= 0 || mapH <= 0) return;

        // (Re)create the offscreen canvas
        if (!this._previewCanvas) this._previewCanvas = document.createElement('canvas');
        const canvas = this._previewCanvas;
        canvas.width = mapW;
        canvas.height = mapH;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, mapW, mapH);

        // 1. Flat-fill with the tint color (vignette is player-centric; without a
        //    player we use a flat fill of the tint, matching SDLight's flat path).
        const tint = this._patch?.global?.tint || '#161616';
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, mapW, mapH);

        // 2. Additive colored lights (globalCompositeOperation='lighter').
        //    Event lights only add color (they do NOT cut holes — eventsClearVignette
        //    is hardcoded false in SDLight). There is no player light in the editor.
        const lights = this.collectMapLights(this.currentMap.id);
        ctx.globalCompositeOperation = 'lighter';
        for (const L of lights) {
            if (!L.props.active) continue;
            const cx = L.x * ts + ts / 2;
            const cy = L.y * ts + ts / 2;
            if (L.props.type === 'Flashlight') {
                this._flashlightFillOnCtx(ctx, {
                    x: cx, y: cy, color: L.props.color, direction: L.props.direction || 2,
                    length: L.props.flashLength, width: L.props.flashWidth,
                    brightness: L.props.brightness, ts
                });
            } else {
                this._radialFillOnCtx(ctx, {
                    x: cx, y: cy, outerR: L.props.radius, radiusY: L.props.radiusY,
                    color: L.props.color, brightness: L.props.brightness,
                    smoothness: L.props.falloff, presetId: L.props.presetId
                });
            }
        }
        ctx.globalCompositeOperation = 'source-over';

        // 3. Region-block walls — paint solid dark on region tiles (SDLight
        //    _renderRegionBlocks). Drawn AFTER lights (source-over) so walls
        //    are always dark regardless of nearby lights, exactly like the
        //    runtime. Includes edge softening for feathered transitions.
        this._renderRegionBlocksOnCtx(ctx, ts);

        // 4. Wrap into a PIXI sprite with MULTIPLY blend (darkens the scene;
        //    lit areas, being bright in the mask, don't darken).
        this._destroyPreviewSprite();
        const tex = PIXI.Texture.from(canvas);
        const sprite = new PIXI.Sprite(tex);
        sprite.blendMode = 'multiply';
        sprite.alpha = this._masterAlpha();
        sprite.label = 'lightPreview';
        sprite.eventMode = 'none';
        this._previewSprite = sprite;
        // Insert at index 0 so markers render above the mask.
        this.lightContainer.addChildAt(sprite, 0);
    }

    _destroyPreviewSprite() {
        if (this._previewSprite) {
            if (this._previewSprite.parent) this._previewSprite.parent.removeChild(this._previewSprite);
            // Destroy the texture too: PIXI.Texture.from() caches by source, and
            // the canvas is resized per map — a stale cache entry would return the
            // old (wrong-size) texture on the next map.
            try { this._previewSprite.destroy({ children: true, texture: true }); } catch (e) { /* ignore */ }
            this._previewSprite = null;
        }
    }

    // Port of SDLight radialFill (line 1357), adapted to a raw 2d context.
    _radialFillOnCtx(ctx, o) {
        const x = o.x, y = o.y;
        let outerR = o.outerR;
        if (!isFinite(x) || !isFinite(y) || !isFinite(outerR) || outerR < 0) return;

        const color = o.color || '#FFFFFF';
        const brightness = (o.brightness !== undefined) ? o.brightness : 1.0;
        const smoothness = (o.smoothness !== undefined) ? o.smoothness : 1.0;
        let radiusY = (o.radiusY !== undefined && o.radiusY > 0) ? o.radiusY : outerR;

        const isOval = (radiusY !== outerR);
        const alpha = Math.max(0, Math.min(1, brightness));
        const startFade = Math.max(0, 1 - smoothness);
        const fadeDist = 1 - startFade;

        try {
            ctx.save();
            if (isOval) {
                ctx.translate(x, y);
                ctx.scale(1, radiusY / outerR);
                ctx.translate(-x, -y);
            }
            const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, outerR));
            const rgb = this._hexToRgb(color);
            const baseStr = rgb.r + ',' + rgb.g + ',' + rgb.b;
            const startColor = 'rgba(' + baseStr + ',' + alpha + ')';
            grad.addColorStop(0, startColor);
            grad.addColorStop(startFade, startColor);

            const preset = this._getPreset(o.presetId);
            if (preset && preset.length > 0) {
                for (let s = 0; s < preset.length; s++) {
                    const step = preset[s];
                    const pos = startFade + fadeDist * step.pos;
                    const aVal = alpha * step.alpha;
                    grad.addColorStop(Math.max(0, Math.min(1, pos)), 'rgba(' + baseStr + ',' + aVal + ')');
                }
            } else {
                grad.addColorStop(1, 'rgba(' + baseStr + ',0)');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(x - outerR - 2, y - outerR - 2, outerR * 2 + 4, outerR * 2 + 4);
            ctx.restore();
        } catch (e) { /* bad gradient params — skip */ }
    }

    // Port of SDLight flashlightFill (line 1476).
    _flashlightFillOnCtx(ctx, o) {
        const x = o.x, y = o.y;
        if (!isFinite(x) || !isFinite(y)) return;
        const ts = o.ts || 48;
        const color = o.color || '#FFFFFF';
        const direction = o.direction || 2;
        const length = o.length || 8;
        const width = o.width || 12;
        const alpha = Math.max(0, Math.min(1, o.brightness !== undefined ? o.brightness : 1.0));

        const lenPx = length * ts;
        const widPx = width * ts;
        let bx1 = x, by1 = y, bx2 = x, by2 = y;
        switch (direction) {
            case 2: bx1 = x - widPx / 2; by1 = y; bx2 = x + widPx / 2; by2 = y + lenPx; break;
            case 8: bx1 = x - widPx / 2; by1 = y - lenPx; bx2 = x + widPx / 2; by2 = y; break;
            case 4: bx1 = x - lenPx; by1 = y - widPx / 2; bx2 = x; by2 = y + widPx / 2; break;
            case 6: bx1 = x; by1 = y - widPx / 2; bx2 = x + lenPx; by2 = y + widPx / 2; break;
        }
        try {
            ctx.save();
            const grad = ctx.createLinearGradient(x, y, (bx1 + bx2) / 2, (by1 + by2) / 2);
            const rgb = this._hexToRgb(color);
            const baseStr = rgb.r + ',' + rgb.g + ',' + rgb.b;
            grad.addColorStop(0, 'rgba(' + baseStr + ',' + alpha + ')');
            grad.addColorStop(0.3, 'rgba(' + baseStr + ',' + (alpha * 0.7) + ')');
            grad.addColorStop(1, 'rgba(' + baseStr + ',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x, y);
            if (direction === 2) { ctx.lineTo(x - widPx / 2, y); ctx.lineTo(x - widPx / 2, y + lenPx); ctx.lineTo(x + widPx / 2, y + lenPx); ctx.lineTo(x + widPx / 2, y); }
            else if (direction === 8) { ctx.lineTo(x - widPx / 2, y); ctx.lineTo(x - widPx / 2, y - lenPx); ctx.lineTo(x + widPx / 2, y - lenPx); ctx.lineTo(x + widPx / 2, y); }
            else if (direction === 4) { ctx.lineTo(x, y - widPx / 2); ctx.lineTo(x - lenPx, y - widPx / 2); ctx.lineTo(x - lenPx, y + widPx / 2); ctx.lineTo(x, y + widPx / 2); }
            else if (direction === 6) { ctx.lineTo(x, y - widPx / 2); ctx.lineTo(x + lenPx, y - widPx / 2); ctx.lineTo(x + lenPx, y + widPx / 2); ctx.lineTo(x, y + widPx / 2); }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } catch (e) { /* skip */ }
    }

    // Port of SDLight _renderRegionBlocks (line 1928): paint solid dark walls
    // for every tile whose region ID is in _blockedRegions. Drawn AFTER lights
    // with 'source-over' so walls are always dark regardless of nearby lights.
    //
    // Each wall tile is pre-rendered on a SEPARATE offscreen canvas (mirroring
    // SDLight's _getAutotileBitmap), then stamped onto the main mask via
    // drawImage(source-over). This is critical: applying destination-out
    // directly on the main mask would erase the tint underneath, punching
    // transparent holes that MULTIPLY turns into full-brightness leaks.
    _renderRegionBlocksOnCtx(ctx, ts) {
        const br = this._blockedRegions;
        if (!br || Object.keys(br).length === 0 || !this.currentMap) return;

        const map = this.currentMap;
        const w = map.width, h = map.height;
        const data = map.data;
        if (!data) return;
        const layerSize = w * h;

        const regionAt = (x, y) => {
            if (x < 0 || y < 0 || x >= w || y >= h) return -1;
            return data[5 * layerSize + y * w + x] || 0;
        };
        const isWall = (x, y) => !!br[regionAt(x, y)];

        const softness = Math.max(0, Math.min(this._wallSoftness || 0, ts / 2));

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const rid = regionAt(x, y);
                const color = br[rid];
                if (!color) continue;
                // 4-bit edge mask: which cardinal neighbours are NOT walls.
                const top    = !isWall(x, y - 1);
                const bottom = !isWall(x, y + 1);
                const left   = !isWall(x - 1, y);
                const right  = !isWall(x + 1, y);
                // Inner corners: two adjacent cardinals ARE walls but the
                // diagonal between them is NOT — needs radial rounding.
                const corners = {
                    tr: !top && !right && !isWall(x + 1, y - 1),
                    br: !bottom && !right && !isWall(x + 1, y + 1),
                    bl: !bottom && !left  && !isWall(x - 1, y + 1),
                    tl: !top   && !left  && !isWall(x - 1, y - 1)
                };
                const tile = this._getWallTileCanvas(color, { top, bottom, left, right }, corners, ts, softness);
                ctx.drawImage(tile, x * ts, y * ts);
            }
        }
        ctx.restore();
    }

    // Build (or fetch from cache) a single ts×ts wall tile with feathered edges.
    // The feathering uses destination-out ON THIS TILE CANVAS ONLY — so the
    // resulting semi-transparent edges blend correctly when stamped onto the
    // main mask via drawImage(source-over).
    _getWallTileCanvas(color, edges, corners, ts, softness) {
        const key = color + '_' +
            (edges.top ? 1 : 0) + (edges.bottom ? 1 : 0) +
            (edges.left ? 1 : 0) + (edges.right ? 1 : 0) +
            (corners.tr ? 1 : 0) + (corners.br ? 1 : 0) +
            (corners.bl ? 1 : 0) + (corners.tl ? 1 : 0) +
            '_' + ts + '_' + softness;
        const cached = this._wallTileCache.get(key);
        if (cached) return cached;

        const c = document.createElement('canvas');
        c.width = ts;
        c.height = ts;
        const tctx = c.getContext('2d');

        // 1. Solid fill the entire tile.
        tctx.fillStyle = color;
        tctx.fillRect(0, 0, ts, ts);

        if (softness > 0) {
            tctx.globalCompositeOperation = 'destination-out';
            const s = softness;

            // 2. Feather exposed cardinal edges (linear gradients).
            if (edges.top) {
                const g = tctx.createLinearGradient(0, 0, 0, s);
                g.addColorStop(0, 'rgba(0,0,0,1)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                tctx.fillStyle = g;
                tctx.fillRect(0, 0, ts, s);
            }
            if (edges.bottom) {
                const g = tctx.createLinearGradient(0, ts - s, 0, ts);
                g.addColorStop(0, 'rgba(0,0,0,0)');
                g.addColorStop(1, 'rgba(0,0,0,1)');
                tctx.fillStyle = g;
                tctx.fillRect(0, ts - s, ts, s);
            }
            if (edges.left) {
                const g = tctx.createLinearGradient(0, 0, s, 0);
                g.addColorStop(0, 'rgba(0,0,0,1)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                tctx.fillStyle = g;
                tctx.fillRect(0, 0, s, ts);
            }
            if (edges.right) {
                const g = tctx.createLinearGradient(ts - s, 0, ts, 0);
                g.addColorStop(0, 'rgba(0,0,0,0)');
                g.addColorStop(1, 'rgba(0,0,0,1)');
                tctx.fillStyle = g;
                tctx.fillRect(ts - s, 0, s, ts);
            }

            // 3. Inner corners (port of SDLight _getAutotileBitmap section 3,
            //    lines 2092-2133). Where two cardinal neighbours ARE walls but
            //    the diagonal is open, a radial gradient rounds the junction so
            //    the corner doesn't look like a sharp 90° angle.
            const HALF_PI = Math.PI / 2;
            const PI32 = Math.PI * 1.5;
            const mkCorner = (cx, cy, a1, a2, lineToX, lineToY) => {
                const g = tctx.createRadialGradient(cx, cy, 0, cx, cy, s);
                g.addColorStop(0, 'rgba(0,0,0,1)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                tctx.fillStyle = g;
                tctx.beginPath();
                tctx.moveTo(cx, cy);
                tctx.lineTo(lineToX, lineToY);
                tctx.arc(cx, cy, s, a1, a2);
                tctx.closePath();
                tctx.fill();
            };
            if (corners.tr) mkCorner(ts, 0,  HALF_PI, Math.PI, ts, s);       // top-right
            if (corners.br) mkCorner(ts, ts, Math.PI,  PI32,    ts - s, ts); // bottom-right
            if (corners.bl) mkCorner(0,  ts, PI32,     0,       0, ts - s);  // bottom-left
            if (corners.tl) mkCorner(0,  0,  0,        HALF_PI, s, 0);       // top-left

            tctx.globalCompositeOperation = 'source-over';
        }

        this._wallTileCache.set(key, c);
        return c;
    }

    _createMarker(L, ts) {
        const c = new PIXI.Container();
        const p = L.props;
        const colorInt = this._hexToInt(p.color);
        const alpha = p.active ? 0.22 : 0.08;
        const ringAlpha = p.active ? 0.85 : 0.35;

        // Falloff disc — radius in pixels (matches runtime: radius is screen px)
        const g = new PIXI.Graphics();
        const rx = p.radius || 100;
        const ry = p.radiusY || rx;
        if (p.type === 'Flashlight') {
            // Cone preview (triangle)
            const len = (p.flashLength || 8) * ts;
            const wid = (p.flashWidth || 12);
            const half = Math.max(0.2, wid / 40) * len * 0.5;
            g.poly([0, 0, len, -half, len, half]);
            g.fill({ color: colorInt, alpha });
            g.stroke({ width: 1.5, color: colorInt, alpha: ringAlpha });
        } else {
            g.ellipse(0, 0, Math.max(4, rx), Math.max(4, ry));
            g.fill({ color: colorInt, alpha });
            g.stroke({ width: 1.5, color: colorInt, alpha: ringAlpha });
        }
        c.addChild(g);

        // Center dot — tile-sized, sits on the anchor
        const dot = new PIXI.Graphics();
        const dotR = Math.max(6, ts * 0.28);
        dot.circle(0, 0, dotR);
        dot.fill({ color: colorInt, alpha: 0.9 });
        dot.stroke({ width: 2, color: L.kind === 'synthetic' ? 0x00e0ff : 0xffe000, alpha: 1 });
        c.addChild(dot);

        // Inactive cross
        if (!p.active) {
            const x = new PIXI.Graphics();
            x.moveTo(-dotR, -dotR).lineTo(dotR, dotR)
             .moveTo(dotR, -dotR).lineTo(-dotR, dotR);
            x.stroke({ width: 2, color: 0xff4040, alpha: 0.9 });
            c.addChild(x);
        }

        // Type label
        const lbl = new PIXI.Text({
            text: (L.kind === 'synthetic' ? '◍ ' : '') + p.type,
            style: { fontSize: 9, fill: 0xffffff, stroke: { color: 0x000000, width: 2 } }
        });
        lbl.anchor.set(0.5);
        lbl.y = -dotR - 8;
        c.addChild(lbl);

        return c;
    }

    _updateSelectionHighlight() {
        if (!this.selectionHighlight) return;
        this.selectionHighlight.clear();
        if (!this.selectedUid || !this.currentMap) {
            this.selectionHighlight.visible = false;
            return;
        }
        const m = this.markers.find(x => x.uid === this.selectedUid);
        if (!m) { this.selectionHighlight.visible = false; return; }
        const ts = this.tilemapManager ? this.tilemapManager.TILE_WIDTH : 48;
        const L = m.light;
        this.selectionHighlight.visible = true;
        this.selectionHighlight.rect(L.x * ts, L.y * ts, ts, ts);
        this.selectionHighlight.stroke({ width: 2, color: 0x00ff00, alpha: 0.9 });
    }

    // =====================================================================
    // Interaction
    // =====================================================================

    setupLightInteraction() {
        if (!this.tilemapManager || !this.tilemapManager.container) return;
        const container = this.tilemapManager.container;
        if (this._interactionContainer === container) return;
        if (this._interactionContainer) this.removeLightInteraction();
        this._interactionContainer = container;
        this._pointerHandlers = {};

        const on = (ev, h) => { this._pointerHandlers[ev] = h; container.on(ev, h); };
        container.interactive = true;

        on('pointerdown', (e) => this._handlePointerDown(e));
        on('pointermove', (e) => this._handlePointerMove(e));
        on('pointerup', (e) => this._handlePointerUp(e));
        on('pointerupoutside', (e) => this._handlePointerUp(e));
    }

    removeLightInteraction() {
        const container = this._interactionContainer;
        if (container && this._pointerHandlers) {
            for (const [ev, h] of Object.entries(this._pointerHandlers)) container.off(ev, h);
        }
        this._pointerHandlers = null;
        this._interactionContainer = null;
        this.isDragging = false;
        this.draggedUid = null;
    }

    _localTile(e) {
        const container = this.tilemapManager.container;
        const pos = e.data.getLocalPosition(container);
        const ts = this.tilemapManager.TILE_WIDTH;
        return { px: pos.x, py: pos.y, tx: Math.floor(pos.x / ts), ty: Math.floor(pos.y / ts), ts };
    }

    _markerAt(px, py) {
        // Hit-test center dots (tile-sized)
        const ts = this.tilemapManager.TILE_WIDTH;
        const hitR = Math.max(10, ts * 0.5);
        let best = null, bestD = hitR;
        for (const m of this.markers) {
            const cx = m.light.x * ts + ts / 2;
            const cy = m.light.y * ts + ts / 2;
            const d = Math.hypot(cx - px, cy - py);
            if (d < bestD) { bestD = d; best = m; }
        }
        return best;
    }

    // Enter placement mode: the next click on an empty tile creates a synthetic light.
    enterPlacement() {
        if (!this.lightMode || !this.currentMap) return;
        this._placementMode = true;
        if (this.tilemapManager?.container) this.tilemapManager.container.cursor = 'copy';
        this._setSaveStatus('кликните по карте, чтобы поставить источник', '#f1c40f');
    }

    _exitPlacement() {
        this._placementMode = false;
        if (this.tilemapManager?.container) this.tilemapManager.container.cursor = 'default';
        this._setSaveStatus('', '');
    }

    _handlePointerDown(e) {
        if (!this.lightMode || !this.currentMap) return;
        if (e.data.button !== 0) return;
        const { px, py, tx, ty } = this._localTile(e);
        if (tx < 0 || tx >= this.currentMap.width || ty < 0 || ty >= this.currentMap.height) return;

        // Placement mode: clicking anywhere drops a new synthetic light.
        // P9: клик по шаблону библиотеки взводит _pendingTemplate — его
        // свойства едут в новый источник поверх дефолтов.
        if (this._placementMode) {
            this._exitPlacement();
            this.addSynthetic(tx, ty, this._pendingTemplate || null);
            this._pendingTemplate = null;
            return;
        }

        const m = this._markerAt(px, py);
        if (m) {
            this._select(m.uid);
            // Begin drag
            this.isDragging = true;
            this.draggedUid = m.uid;
            this._dragMoved = false;
            const ts = this.tilemapManager.TILE_WIDTH;
            const cx = m.light.x * ts + ts / 2;
            const cy = m.light.y * ts + ts / 2;
            this._dragOffset = { x: px - cx, y: py - cy };
        } else {
            // Empty tile click: deselect (no auto-create to avoid accidents)
            this._select(null);
        }
        if (this.onCoordinatesChange) this.onCoordinatesChange(tx, ty);
    }

    _handlePointerMove(e) {
        if (!this.lightMode) return;
        const { px, py, tx, ty } = this._localTile(e);
        if (this.isDragging && this.draggedUid) {
            const ts = this.tilemapManager.TILE_WIDTH;
            const nx = Math.round((px - this._dragOffset.x - ts / 2) / ts);
            const ny = Math.round((py - this._dragOffset.y - ts / 2) / ts);
            if (nx < 0 || nx >= this.currentMap.width || ny < 0 || ny >= this.currentMap.height) return;
            const m = this.markers.find(x => x.uid === this.draggedUid);
            if (m && (m.light.x !== nx || m.light.y !== ny)) {
                m.light.x = nx; m.light.y = ny;
                m.sprite.x = nx * ts + ts / 2;
                m.sprite.y = ny * ts + ts / 2;
                this._dragMoved = true;
                this._updateSelectionHighlight();
            }
        }
        if (this.onCoordinatesChange) this.onCoordinatesChange(tx, ty);
    }

    _handlePointerUp(e) {
        if (!this.lightMode) return;
        if (this.isDragging && this.draggedUid && this._dragMoved) {
            this._commitPosition(this.draggedUid);
        }
        this.isDragging = false;
        this.draggedUid = null;
        this._dragMoved = false;
    }

    _select(uid) {
        this.selectedUid = uid;
        this._updateSelectionHighlight();
        // Restyle marker dots for selection
        this.renderLights();
        if (this.panelEl) this._refreshPanel();
    }

    _commitPosition(uid) {
        const m = this._findLightByUid(uid);
        if (!m) return;
        const mapKey = String(this.currentMap.id);
        const patch = this._patch;
        if (m.kind === 'synthetic') {
            const arr = patch.syntheticLights[mapKey] || (patch.syntheticLights[mapKey] = []);
            const s = arr[m.synIndex];
            if (s) { s.x = m.x; s.y = m.y; }
        } else {
            if (!patch.movedPositions[mapKey]) patch.movedPositions[mapKey] = {};
            patch.movedPositions[mapKey][String(m.eventId)] = { x: m.x, y: m.y };
        }
        this._markDirty();
    }

    // =====================================================================
    // Mutations
    // =====================================================================

    // Look up a light by uid directly from the patch (rendering-independent).
    _findLightByUid(uid) {
        if (!uid || !this.currentMap) return null;
        return this.collectMapLights(this.currentMap.id).find(l => l.uid === uid) || null;
    }

    _selectedMarker() {
        if (this.selectedUid && this.markers.length) {
            const m = this.markers.find(x => x.uid === this.selectedUid);
            if (m) return m;
        }
        // Fall back to patch-derived light when markers aren't built yet.
        const l = this._findLightByUid(this.selectedUid);
        return l ? { uid: this.selectedUid, light: l, sprite: null } : null;
    }

    setProp(key, value) {
        const m = this._selectedMarker();
        if (!m) return;
        const mapKey = String(this.currentMap.id);
        const patch = this._patch;
        if (m.light.kind === 'synthetic') {
            const arr = patch.syntheticLights[mapKey];
            const s = arr && arr[m.light.synIndex];
            if (s) s[key] = value;
        } else {
            if (!patch.sources[mapKey]) patch.sources[mapKey] = {};
            const eid = String(m.light.eventId);
            patch.sources[mapKey][eid] = Object.assign(patch.sources[mapKey][eid] || {}, { [key]: value });
        }
        this._markDirty();
        this.renderLights();
        // NOTE: do NOT call _refreshPanel() here — it rebuilds the panel DOM via
        // innerHTML, destroying the <input> the user is currently interacting
        // with. Range sliders break after one step; text fields lose focus after
        // one keystroke. Panel rebuild is reserved for structural changes only.
    }

    addSynthetic(tx, ty, propsOverride) {
        if (!this.currentMap) return;
        const mapKey = String(this.currentMap.id);
        const patch = this._patch;
        if (!patch.syntheticLights[mapKey]) patch.syntheticLights[mapKey] = [];
        const def = {
            sid: this._nextSid++, x: tx, y: ty,
            type: 'Normal', radius: 200, radiusY: 200, color: '#FFA07A',
            brightness: 1, falloff: 1, presetId: 'global', active: true,
            flashLength: 8, flashWidth: 12, direction: 0, cond: null
        };
        // P9: свойства шаблона библиотеки поверх дефолтов
        if (propsOverride && typeof propsOverride === 'object') {
            for (const k of ['type','radius','radiusY','color','brightness','falloff',
                    'presetId','active','flashLength','flashWidth','direction','cond']) {
                if (propsOverride[k] !== undefined) def[k] = propsOverride[k];
            }
        }
        patch.syntheticLights[mapKey].push(def);
        this._markDirty();
        const newUid = 's' + (patch.syntheticLights[mapKey].length - 1);
        this._select(newUid);
    }

    deleteSelected() {
        const m = this._selectedMarker();
        if (!m) return;
        const mapKey = String(this.currentMap.id);
        const patch = this._patch;
        if (m.light.kind === 'synthetic') {
            const arr = patch.syntheticLights[mapKey];
            if (arr) {
                arr.splice(m.light.synIndex, 1);
                if (arr.length === 0) delete patch.syntheticLights[mapKey];
            }
        } else {
            // Suppress the event-bound light and drop its override/move
            if (!patch.suppressedEvents[mapKey]) patch.suppressedEvents[mapKey] = {};
            patch.suppressedEvents[mapKey][String(m.light.eventId)] = true;
            if (patch.sources[mapKey]) delete patch.sources[mapKey][String(m.light.eventId)];
            if (patch.movedPositions[mapKey]) delete patch.movedPositions[mapKey][String(m.light.eventId)];
        }
        this.selectedUid = null;
        this._markDirty();
        this.renderLights();
        this._refreshPanel();
    }

    duplicateSelected() {
        const m = this._selectedMarker();
        if (!m) return;
        const p = m.light.props;
        // Clamp clone position to map bounds so it doesn't spawn off-screen.
        const cx = Math.min(m.light.x + 1, this.currentMap.width - 1);
        const cy = Math.min(m.light.y, this.currentMap.height - 1);
        this.addSynthetic(cx, cy);
        // Copy properties onto the freshly-created synthetic
        const sel = this._selectedMarker();
        if (sel) {
            for (const k of ['type','radius','radiusY','color','brightness','falloff','presetId','active','flashLength','flashWidth','direction','cond']) {
                this.setProp(k, p[k]);
            }
        }
    }

    resetEventOverride() {
        const m = this._selectedMarker();
        if (!m || m.light.kind !== 'event') return;
        const mapKey = String(this.currentMap.id);
        if (this._patch.sources[mapKey]) delete this._patch.sources[mapKey][String(m.light.eventId)];
        if (this._patch.suppressedEvents[mapKey]) delete this._patch.suppressedEvents[mapKey][String(m.light.eventId)];
        if (this._patch.movedPositions[mapKey]) delete this._patch.movedPositions[mapKey][String(m.light.eventId)];
        this._markDirty();
        this.renderLights();
        this._refreshPanel();
    }

    // =====================================================================
    // Presets
    // =====================================================================

    getPresets() {
        const out = {};
        for (const k in LightManager.DEFAULT_PRESETS) out[k] = LightManager.DEFAULT_PRESETS[k];
        if (this._patch?.presets) for (const k in this._patch.presets) out[k] = this._patch.presets[k];
        return out;
    }

    getPresetNames() { return Object.keys(this.getPresets()); }

    savePreset(name, points) {
        if (!name) return;
        if (!this._patch.presets) this._patch.presets = {};
        this._patch.presets[name] = points.map(p => ({ pos: +p.pos, alpha: +p.alpha }));
        this._markDirty();
    }

    deletePreset(name) {
        if (!this._patch.presets) return;
        if (LightManager.DEFAULT_PRESETS[name]) return; // can't delete built-in
        delete this._patch.presets[name];
        this._markDirty();
    }

    // =====================================================================
    // Library templates
    // =====================================================================

    getLibrary() { return this._patch?.library || []; }

    saveTemplate(name, props) {
        if (!name) return;
        if (!this._patch.library) this._patch.library = [];
        this._patch.library.push({
            name, type: props.type, radius: props.radius, radiusY: props.radiusY,
            color: props.color, brightness: props.brightness, falloff: props.falloff,
            presetId: props.presetId, active: props.active,
            flashLength: props.flashLength, flashWidth: props.flashWidth,
            direction: props.direction, cond: props.cond
        });
        this._markDirty();
    }

    deleteTemplate(idx) {
        if (!this._patch.library) return;
        this._patch.library.splice(idx, 1);
        this._markDirty();
    }

    applyTemplate(idx) {
        const t = this.getLibrary()[idx];
        const m = this._selectedMarker();
        if (!t || !m) return;
        for (const k of ['type','radius','radiusY','color','brightness','falloff','presetId','active','flashLength','flashWidth','direction','cond']) {
            if (t[k] !== undefined) this.setProp(k, t[k]);
        }
    }

    // =====================================================================
    // Panel UI (sidebar)
    // =====================================================================

    buildPanel(parentEl) {
        const wrap = document.createElement('div');
        wrap.id = 'lm-panel';
        wrap.className = 'lm-panel';
        // Floating panel in the top-right corner of the map workspace
        // (#canvas-container). right:48px leaves room for the 30px overlay
        // buttons (grid/HB/EV/light) that sit at right:16px.
        wrap.style.cssText = 'display:none;flex-direction:column;width:290px;max-height:calc(100% - 16px);position:absolute;top:8px;right:48px;z-index:9000;background:var(--color-bg-panel);border:1px solid var(--color-border);box-shadow:var(--shadow-popup, -2px 2px 8px rgba(0,0,0,0.3));overflow:hidden;';
        wrap.innerHTML = this._panelHtml();
        // Default mount target is the map workspace container.
        const host = parentEl || document.getElementById('canvas-container') || document.body;
        host.appendChild(wrap);
        this.panelEl = wrap;
        this._bindPanel();
    }

    _panelHtml() {
        return `
        <div style="padding:8px 10px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:6px;">
            <span style="font-weight:600;">${this._t('lightManager.title','Освещение')}</span>
            <span style="flex:1"></span>
            <span id="lm-save-status" style="font-size:10px;color:var(--color-text-muted);"></span>
        </div>
        <div style="padding:6px 8px;border-bottom:1px solid var(--color-border);display:flex;gap:4px;flex-wrap:wrap;">
            <button class="lm-btn" data-lm-act="add">${this._t('lightManager.add','+ Источник')}</button>
            <button class="lm-btn" data-lm-act="dup">${this._t('lightManager.duplicate','Дублировать')}</button>
            <button class="lm-btn lm-danger" data-lm-act="del">${this._t('lightManager.delete','Удалить')}</button>
            <button class="lm-btn" data-lm-act="reset">${this._t('lightManager.reset','Сбросить override')}</button>
            <button class="lm-btn" data-lm-act="save">${this._t('lightManager.save','💾 Сохранить')}</button>
        </div>
        <div id="lm-tabs" style="display:flex;border-bottom:1px solid var(--color-border);">
            <button class="lm-tab active" data-lm-tab="props">${this._t('lightManager.tabProps','Свойства')}</button>
            <button class="lm-tab" data-lm-tab="presets">${this._t('lightManager.tabPresets','Пресеты')}</button>
            <button class="lm-tab" data-lm-tab="lib">${this._t('lightManager.tabLib','Библиотека')}</button>
        </div>
        <div id="lm-body" style="flex:1;overflow:auto;padding:8px 10px;font-size:12px;"></div>
        `;
    }

    _t(key, fallback) {
        return (typeof window !== 'undefined' && window.I18n && window.I18n.t) ? (window.I18n.t(key) || fallback) : fallback;
    }

    _bindPanel() {
        const el = this.panelEl;
        el.querySelectorAll('[data-lm-act]').forEach(b => {
            b.addEventListener('click', () => {
                const a = b.dataset.lmAct;
                if (a === 'add' && this.currentMap) {
                    // Enter placement mode: next map click drops a new light.
                    this.enterPlacement();
                } else if (a === 'dup') this.duplicateSelected();
                else if (a === 'del') this.deleteSelected();
                else if (a === 'reset') this.resetEventOverride();
                else if (a === 'save') this.savePatch();
            });
        });
        el.querySelectorAll('[data-lm-tab]').forEach(b => {
            b.addEventListener('click', () => {
                el.querySelectorAll('[data-lm-tab]').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                this._activeTab = b.dataset.lmTab;
                this._refreshPanel();
            });
        });
        this._activeTab = 'props';

        // Inject styles once
        if (!document.getElementById('lm-styles')) {
            const s = document.createElement('style');
            s.id = 'lm-styles';
            s.textContent = `
                .lm-panel .lm-btn { font-size:11px; padding:3px 7px; border:1px solid var(--color-border); background:var(--color-bg); color:var(--color-text); border-radius:3px; cursor:pointer; }
                .lm-panel .lm-btn:hover { background:var(--color-bg-hover); }
                .lm-panel .lm-danger { color:#fff; background:#c0392b; border-color:#962d22; }
                .lm-panel .lm-tab { flex:1; padding:6px; font-size:11px; background:none; border:none; border-bottom:2px solid transparent; color:var(--color-text-muted); cursor:pointer; }
                .lm-panel .lm-tab.active { color:var(--color-text); border-bottom-color:var(--color-accent-bright); }
                .lm-panel .lm-row { margin-bottom:8px; }
                .lm-panel .lm-row label { display:block; font-size:10px; color:var(--color-text-muted); margin-bottom:2px; }
                .lm-panel .lm-row input[type=range] { width:100%; }
                .lm-panel .lm-row input[type=number], .lm-panel .lm-row input[type=text], .lm-panel .lm-row select, .lm-panel .lm-row input[type=color] { width:100%; box-sizing:border-box; background:var(--color-bg); color:var(--color-text); border:1px solid var(--color-border); padding:3px; border-radius:2px; font-size:11px; }
                .lm-panel .lm-presets-canvas { background:var(--color-bg); border:1px solid var(--color-border); border-radius:2px; display:block; margin-top:4px; }
                .lm-panel .lm-pt-row { display:flex; gap:4px; margin-bottom:3px; align-items:center; }
                .lm-panel .lm-pt-row input { width:50%; }
                .lm-panel hr { border:none; border-top:1px solid var(--color-border-subtle); margin:8px 0; }
            `;
            document.head.appendChild(s);
        }

        this._refreshPanel();
    }

    _refreshPanel() {
        const body = this.panelEl?.querySelector('#lm-body');
        if (!body) return;
        if (this._activeTab === 'props') body.innerHTML = this._propsHtml();
        else if (this._activeTab === 'presets') body.innerHTML = this._presetsHtml();
        else body.innerHTML = this._libraryHtml();
        this._bindBody(body);
    }

    _propsHtml() {
        const m = this._selectedMarker();
        if (!m) {
            return `<div style="color:var(--color-text-muted);text-align:center;padding:20px 8px;">${this._t('lightManager.noSelection','Кликните по источнику на карте, чтобы править его свойства.')}</div>`;
        }
        const p = m.light.props;
        const presetOpts = this.getPresetNames().map(n => `<option value="${n}" ${p.presetId === n ? 'selected' : ''}>${n}</option>`).join('');
        const typeOpts = ['Normal','Fire','Flashlight'].map(t => `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t}</option>`).join('');
        const r = (lbl, control) => `<div class="lm-row"><label>${lbl}</label>${control}</div>`;
        const rng = (lbl, key, min, max, step) =>
            r(lbl, `<input type="range" min="${min}" max="${max}" step="${step}" value="${p[key]}" data-lm-key="${key}"><span class="lm-val" data-lm-val="${key}">${p[key]}</span>`);
        const meta = m.light.kind === 'synthetic'
            ? `<div style="font-size:10px;color:#00e0ff;margin-bottom:6px;">◍ synthetic · (${m.light.x}, ${m.light.y})</div>`
            : `<div style="font-size:10px;color:#ffe000;margin-bottom:6px;">⬡ event #${m.light.eventId} · (${m.light.x}, ${m.light.y})${m.light.overridden ? ' · override' : ''}</div>`;
        return meta +
            r('Тип', `<select data-lm-key="type">${typeOpts}</select>`) +
            r('Активен', `<input type="checkbox" data-lm-key="active" ${p.active ? 'checked' : ''}>`) +
            (p.type === 'Flashlight'
                ? rng('Длина луча', 'flashLength', 1, 30, 1) + rng('Ширина луча', 'flashWidth', 1, 40, 1) +
                  r('Направление', `<select data-lm-key="direction"><option value="2" ${p.direction===2?'selected':''}>↓ Вниз</option><option value="4" ${p.direction===4?'selected':''}>← Влево</option><option value="6" ${p.direction===6?'selected':''}>→ Вправо</option><option value="8" ${p.direction===8?'selected':''}>↑ Вверх</option></select>`)
                : rng('Радиус X', 'radius', 10, 1000, 1) + rng('Радиус Y', 'radiusY', 10, 1000, 1)) +
            r('Цвет', `<input type="color" value="${p.color}" data-lm-key="color">`) +
            rng('Яркость', 'brightness', 0, 1, 0.01) +
            rng('Falloff', 'falloff', 0, 1, 0.01) +
            r('Пресет', `<select data-lm-key="presetId"><option value="">—</option>${presetOpts}</select>`) +
            r('Условие (cond)', `<input type="text" value="${p.cond || ''}" data-lm-key="cond" placeholder="напр. S5 && V12>=3 или L1">`);
    }

    _bindBody(body) {
        if (this._activeTab === 'props') {
            body.querySelectorAll('[data-lm-key]').forEach(inp => {
                const key = inp.dataset.lmKey;
                const handler = () => {
                    let v;
                    if (inp.type === 'checkbox') v = inp.checked;
                    else if (inp.type === 'number' || inp.type === 'range') v = Number(inp.value);
                    else if (inp.tagName === 'SELECT') v = isNaN(Number(inp.value)) ? inp.value : Number(inp.value);
                    else v = inp.value;
                    this.setProp(key, v);
                    const val = body.querySelector(`[data-lm-val="${key}"]`);
                    if (val) val.textContent = v;
                };
                // 'input' for continuous drag (range) and typing (text/number);
                // 'change' for discrete commits (checkbox, select, color picker).
                // Do NOT bind both — it double-fires and, combined with the old
                // _refreshPanel-in-setProp bug, destroyed inputs mid-interaction.
                if (inp.type === 'checkbox' || inp.tagName === 'SELECT' || inp.type === 'color') {
                    inp.addEventListener('change', handler);
                } else {
                    inp.addEventListener('input', handler);
                }
            });
        } else if (this._activeTab === 'presets') {
            this._bindPresets(body);
        } else {
            this._bindLibrary(body);
        }
    }

    // ---- Preset editor ----

    _presetsHtml() {
        const names = this.getPresetNames();
        const sel = this._presetEditing || names[0] || '';
        const opts = names.map(n => `<option value="${n}" ${sel === n ? 'selected' : ''}>${n}${LightManager.DEFAULT_PRESETS[n] ? ' (встр.)' : ''}</option>`).join('');
        const pts = sel ? (this.getPresets()[sel] || []) : [];
        const ptRows = pts.map((pt, i) => `
            <div class="lm-pt-row" data-lm-pt="${i}">
                <input type="number" min="0" max="1" step="0.01" value="${pt.pos}" data-lm-p="pos">
                <input type="number" min="0" max="1" step="0.01" value="${pt.alpha}" data-lm-p="alpha">
                <button class="lm-btn" data-lm-ptdel="${i}">✕</button>
            </div>`).join('');
        return `
            <div class="lm-row"><label>Пресет</label>
                <select id="lm-preset-sel">${opts}</select>
            </div>
            <canvas class="lm-presets-canvas" width="240" height="120" id="lm-preset-canvas"></canvas>
            <div style="margin:6px 0;font-size:10px;color:var(--color-text-muted);">Точки кривой (pos 0..1, alpha 0..1):</div>
            <div id="lm-preset-pts">${ptRows}</div>
            <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">
                <button class="lm-btn" data-lm-pre="addpt">+ Точка</button>
                <button class="lm-btn" data-lm-pre="save">💾 Сохранить пресет</button>
                <button class="lm-btn lm-danger" data-lm-pre="del">Удалить</button>
            </div>
            <div class="lm-row" style="margin-top:8px;"><label>Новое имя</label>
                <input type="text" id="lm-preset-newname" placeholder="напр. torch_soft">
            </div>
        `;
    }

    _bindPresets(body) {
        const sel = body.querySelector('#lm-preset-sel');
        if (sel) sel.addEventListener('change', () => {
            this._presetEditing = sel.value;
            this._pendingPresetPts = null;  // drop unsaved edits from previous preset
            this._refreshPanel();
        });
        const canvas = body.querySelector('#lm-preset-canvas');
        // Edit point inputs
        body.querySelectorAll('[data-lm-pt]').forEach(row => {
            const i = Number(row.dataset.lmPt);
            row.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('input', () => {
                    const name = this._presetEditing;
                    const pts = this._currentPresetPoints(body);
                    pts[i][inp.dataset.lmP] = Number(inp.value);
                    this._drawPresetCurve(canvas, name, pts);
                });
            });
        });
        body.querySelectorAll('[data-lm-ptdel]').forEach(b => {
            b.addEventListener('click', () => {
                const name = this._presetEditing;
                const pts = this._currentPresetPoints(body);
                pts.splice(Number(b.dataset.lmPtdel), 1);
                this._drawPresetCurve(canvas, name, pts);
                // reflect in DOM
                this._pendingPresetPts = pts;
                this._refreshPanel();
            });
        });
        const draw = () => this._drawPresetCurve(canvas, this._presetEditing, this._pendingPresetPts || this._currentPresetPoints(body));
        if (this._pendingPresetPts) { draw(); }
        else draw();

        body.querySelector('[data-lm-pre="addpt"]')?.addEventListener('click', () => {
            const pts = this._pendingPresetPts || this._currentPresetPoints(body);
            pts.push({ pos: 0.5, alpha: 0.5 });
            pts.sort((a, b) => a.pos - b.pos);
            this._pendingPresetPts = pts;
            this._refreshPanel();
        });
        body.querySelector('[data-lm-pre="save"]')?.addEventListener('click', () => {
            const name = (body.querySelector('#lm-preset-newname')?.value || this._presetEditing || '').trim();
            if (!name) { alert('Введите имя пресета'); return; }
            const pts = (this._pendingPresetPts || this._currentPresetPoints(body)).map(p => ({ pos: +p.pos, alpha: +p.alpha }));
            pts.sort((a, b) => a.pos - b.pos);
            this.savePreset(name, pts);
            this._presetEditing = name;
            this._pendingPresetPts = null;
            this._refreshPanel();
        });
        body.querySelector('[data-lm-pre="del"]')?.addEventListener('click', () => {
            if (this._presetEditing) this.deletePreset(this._presetEditing);
            this._presetEditing = null;
            this._refreshPanel();
        });

        // Click-on-canvas to add a point
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = 1 - (e.clientY - rect.top) / rect.height;
                const pts = this._pendingPresetPts || this._currentPresetPoints(body);
                pts.push({ pos: Math.max(0, Math.min(1, x)), alpha: Math.max(0, Math.min(1, y)) });
                pts.sort((a, b) => a.pos - b.pos);
                this._pendingPresetPts = pts;
                this._refreshPanel();
            });
        }
    }

    _currentPresetPoints(body) {
        if (this._pendingPresetPts) return this._pendingPresetPts;
        const name = this._presetEditing;
        if (!name) return [];
        return (this.getPresets()[name] || []).map(p => ({ pos: p.pos, alpha: p.alpha }));
    }

    _drawPresetCurve(canvas, name, pts) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        // grid
        ctx.strokeStyle = 'rgba(128,128,128,0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(0, (h / 4) * i); ctx.lineTo(w, (h / 4) * i);
            ctx.moveTo((w / 4) * i, 0); ctx.lineTo((w / 4) * i, h);
            ctx.stroke();
        }
        if (!pts || !pts.length) return;
        const sorted = pts.slice().sort((a, b) => a.pos - b.pos);
        // fill under curve
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (const p of sorted) ctx.lineTo(p.pos * w, (1 - p.alpha) * h);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,209,128,0.35)';
        ctx.fill();
        // curve line
        ctx.beginPath();
        ctx.moveTo(sorted[0].pos * w, (1 - sorted[0].alpha) * h);
        for (const p of sorted) ctx.lineTo(p.pos * w, (1 - p.alpha) * h);
        ctx.strokeStyle = '#ffd180';
        ctx.lineWidth = 2;
        ctx.stroke();
        // points
        for (const p of sorted) {
            ctx.beginPath();
            ctx.arc(p.pos * w, (1 - p.alpha) * h, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffe082';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }

    // ---- Library ----

    _libraryHtml() {
        const lib = this.getLibrary();
        if (!lib.length) {
            return `<div style="color:var(--color-text-muted);text-align:center;padding:20px 8px;">${this._t('lightManager.libEmpty','Библиотека пуста. Выберите источник и нажмите «Сохранить как шаблон».')}</div>`;
        }
        const rows = lib.map((t, i) => `
            <div class="lm-pt-row" style="border:1px solid var(--color-border);padding:4px;border-radius:2px;margin-bottom:4px;">
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${t.color};border:1px solid #000;"></span>
                        <strong>${t.name}</strong>
                    </div>
                    <div style="font-size:10px;color:var(--color-text-muted);">${t.type} · r${t.radius}${t.radiusY !== t.radius ? ':' + t.radiusY : ''}${t.presetId ? ' · ' + t.presetId : ''}</div>
                </div>
                <button class="lm-btn" data-lm-tplapply="${i}">Применить</button>
                <button class="lm-btn lm-danger" data-lm-tpldel="${i}">✕</button>
            </div>`).join('');
        const m = this._selectedMarker();
        const saveHtml = m ? `<hr><div class="lm-row"><label>Сохранить выбранный как шаблон</label>
            <input type="text" id="lm-tpl-name" placeholder="имя шаблона">
            <button class="lm-btn" data-lm-tplsave="" style="margin-top:4px;">💾 Сохранить</button></div>` : '';
        return rows + saveHtml;
    }

    _bindLibrary(body) {
        body.querySelectorAll('[data-lm-tpldel]').forEach(b => {
            b.addEventListener('click', () => { this.deleteTemplate(Number(b.dataset.lmtpldel)); this._refreshPanel(); });
        });
        body.querySelectorAll('[data-lm-tplapply]').forEach(b => {
            b.addEventListener('click', () => this.applyTemplate(Number(b.dataset.lmtplapply)));
        });
        body.querySelector('[data-lm-tplsave]')?.addEventListener('click', () => {
            const name = body.querySelector('#lm-tpl-name').value.trim();
            if (!name) { alert('Введите имя'); return; }
            const m = this._selectedMarker();
            if (m) this.saveTemplate(name, m.light.props);
            this._refreshPanel();
        });
    }

    // Rebuild markers after a zoom/scroll if needed (sprites use world coords,
    // so usually only selection highlight needs no refresh). Hook for safety.
    refresh() { this.renderLights(); }

    destroy() {
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        this.removeLightInteraction();
        this._destroyPreviewSprite();
        this._previewCanvas = null;
        this._wallTileCache.clear();
        if (this.lightContainer) { this.lightContainer.destroy({ children: true }); this.lightContainer = null; }
        if (this.selectionHighlight) { this.selectionHighlight.destroy({ children: true }); this.selectionHighlight = null; }
        if (this.panelEl) { this.panelEl.remove(); this.panelEl = null; }
    }
}

window.LightManager = LightManager;
