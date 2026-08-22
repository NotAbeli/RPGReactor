/**
 * DatabaseHUDEditor (S39) - live HUD editor inside the «Интерфейс» tab.
 *
 * Renders data/MapHUD.json pieces on a checkerboard "transparency grid"
 * canvas at the game resolution WITHOUT launching the game:
 *   Picture      - image from img/SumRndmDde/hud/<type>/ + Scale/Opacity/Blend
 *   Image Numbers- 10-digit strip sliced per digit (HUDMaker: w = bw / 10)
 *   Image Gauge  - Back Image + Main Image partially filled by Cur/Max
 *                  ratio honoring Direction (left/right/up/down)
 * Conditions/values are JS expressions evaluated in a sandbox with mock
 * $gameSwitches/$gameVariables (the "Состояние игры" panel collects IDs
 * automatically). Selected piece drags -> x/y persist live. Saves back to
 * data/MapHUD.json (HUDMaker-compatible fields only) with a timestamped
 * backup. HUDMaker stays the compatible fallback.
 */
class DatabaseHUDEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
        this._pieces = null;
        this._selected = -1;
        this._images = {}; // name -> HTMLImageElement (loads async)
        this._game = { switches: new Map(), vars: new Map() };
    }

    _tt(t) { return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(t) : t; }

    _projectPath() {
        const p = this.projectManager && this.projectManager.getCurrentProject
            ? this.projectManager.getCurrentProject()
            : (this.projectManager && this.projectManager.currentProject);
        return p ? p.path : null;
    }

    _req(name) {
        try {
            if (typeof require === 'function') return require(name);
            if (typeof window !== 'undefined' && typeof window.require === 'function') return window.require(name);
        } catch (e) { /* not in NW/node */ }
        return null;
    }

    getScreenSize() {
        try {
            const agonia = this.databaseManager.data && this.databaseManager.data.agonia;
            if (agonia && agonia.screen) {
                const w = Number(agonia.screen['Screen Width']);
                const h = Number(agonia.screen['Screen Height']);
                if (w > 0 && h > 0) return { w, h };
            }
        } catch (e) { /* fall through */ }
        return { w: 1280, h: 720 };
    }

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------

    /** Load (once per mount) and parse MapHUD.json; never throws. */
    _load() {
        if (this._pieces) return this._pieces;
        this._pieces = [];
        const path = this._req('path');
        const fs = this._req('fs');
        const proj = this._projectPath();
        if (!path || !fs || !proj) return this._pieces;
        try {
            const file = path.join(proj, 'data', 'MapHUD.json');
            if (fs.existsSync(file)) {
                const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (Array.isArray(parsed)) this._pieces = parsed.filter(p => p && p.type);
            }
        } catch (e) {
            console.warn('MapHUD.json parse failed:', e);
        }
        return this._pieces;
    }

    /** Save pieces + a timestamped backup; returns {ok, file, backup}. */
    _persist() {
        const path = this._req('path');
        const fs = this._req('fs');
        const proj = this._projectPath();
        if (!path || !fs || !proj) return { ok: false, error: 'no fs' };
        try {
            const file = path.join(proj, 'data', 'MapHUD.json');
            let backup = null;
            if (fs.existsSync(file)) {
                const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                backup = path.join(proj, 'data', 'MapHUD.backup-' + stamp + '.json');
                fs.copyFileSync(file, backup);
            }
            fs.writeFileSync(file, JSON.stringify(this._pieces, null, 0), 'utf8');
            return { ok: true, file, backup };
        } catch (e) {
            return { ok: false, error: String(e && e.message || e) };
        }
    }

    // ------------------------------------------------------------------
    // Expression sandbox
    // ------------------------------------------------------------------

    static collectIds(exprs) {
        const switches = new Set();
        const vars = new Set();
        const re = /\$game(Switches|Variables)\.value\(\s*(\d+)\s*\)/g;
        let m;
        for (const e of exprs) {
            if (!e) continue;
            while ((m = re.exec(String(e)))) {
                (m[1] === 'Switches' ? switches : vars).add(Number(m[2]));
            }
        }
        return { switches: [...switches].sort((a, b) => a - b), vars: [...vars].sort((a, b) => a - b) };
    }

    /** Safe eval with mock game state; any error -> fallback. */
    _evalExpr(expr, fallback) {
        if (expr === undefined || expr === null || String(expr).trim() === '') return fallback;
        const $gameSwitches = {
            value: id => !!(this._game.switches.get(Number(id)))
        };
        const $gameVariables = {
            value: id => { const v = this._game.vars.get(Number(id)); return v === undefined ? 0 : v; }
        };
        const $gameParty = { gold: () => 0, actors: () => ({ size: () => 0 }) };
        const $gameSystem = {};
        const $gameActors = { actors: () => null };
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function('$gameSwitches', '$gameVariables', '$gameParty', '$gameSystem', '$gameActors',
                '"use strict"; return (' + String(expr) + ');');
            const v = fn($gameSwitches, $gameVariables, $gameParty, $gameSystem, $gameActors);
            return v === undefined ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    _pieceVisible(p) {
        const c = p.Condition;
        if (c === undefined || c === null || String(c).trim() === '') return true;
        return !!this._evalExpr(c, true);
    }

    // ------------------------------------------------------------------
    // Images
    // ------------------------------------------------------------------

    _imgUrl(kind, name) {
        if (!name) return '';
        const path = this._req('path');
        const proj = this._projectPath();
        if (!path || !proj) return '';
        if (typeof RRAssetFiles === 'undefined') return '';
        try {
            const sub = kind === 'Picture' ? 'hud/Picture'
                : kind === 'Image Numbers' ? 'hud/Image Numbers'
                : 'hud/Image Gauge';
            return RRAssetFiles.toUrl(path.join(proj, 'img', 'SumRndmDde', sub, name + '.png'));
        } catch (e) { return ''; }
    }

    _img(kind, name) {
        if (!name) return null;
        const key = kind + '/' + name;
        if (this._images[key] !== undefined) return this._images[key];
        const url = this._imgUrl(kind, name);
        let entry = null;
        if (url && typeof Image !== 'undefined') {
            const img = new Image();
            let loaded = false;
            img.onload = () => { loaded = true; this._render(); };
            img.src = url;
            entry = img;
            entry._hudLoaded = () => loaded;
        }
        this._images[key] = entry;
        return entry;
    }

    // ------------------------------------------------------------------
    // Mount / layout
    // ------------------------------------------------------------------

    mount(host) {
        this._load();
        host.innerHTML = '';
        const root = document.createElement('div');
        root.style.cssText = 'display:flex;height:100%;min-height:0;';
        host.appendChild(root);

        // --- Left: pieces list ---
        const left = document.createElement('div');
        left.style.cssText = 'flex:0 0 300px;border-right:1px solid var(--color-border);display:flex;flex-direction:column;min-height:0;';
        root.appendChild(left);

        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;gap:6px;padding:8px;border-bottom:1px solid var(--color-border);align-items:center;';
        const count = document.createElement('span');
        count.style.cssText = 'font-size:12px;color:var(--color-text-dim);flex:1;';
        bar.appendChild(count);
        const addBtn = document.createElement('button');
        addBtn.className = 'agonia-btn';
        addBtn.textContent = this._tt('+ Кусок');
        addBtn.title = this._tt('Новый Picture-кусок');
        addBtn.addEventListener('click', () => {
            const id = this._pieces.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
            this._pieces.push({
                type: 'Picture', Condition: '', Layer: '0', Image: '',
                'Scale X': '1', 'Scale Y': '1', Opacity: '255', Hue: '0', Blend: '0',
                animateInfo: this._blankAnimate(),
                id, x: Math.round(this._screen.w / 2), y: Math.round(this._screen.h / 2)
            });
            this._selected = this._pieces.length - 1;
            this._persist();
            this._refreshAll();
        });
        bar.appendChild(addBtn);
        left.appendChild(bar);

        const listBox = document.createElement('div');
        listBox.style.cssText = 'flex:1;overflow-y:auto;padding:6px;display:flex;flex-direction:column;gap:3px;';
        left.appendChild(listBox);

        // --- Middle: checkerboard stage ---
        const mid = document.createElement('div');
        mid.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;';
        root.appendChild(mid);

        const stateBar = document.createElement('div');
        stateBar.style.cssText = 'padding:6px 10px;border-bottom:1px solid var(--color-border);font-size:12px;color:var(--color-text-dim);display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
        const stateLbl = document.createElement('span');
        stateLbl.textContent = this._tt('Состояние игры:');
        stateBar.appendChild(stateLbl);
        const stateHost = document.createElement('span');
        stateHost.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
        stateBar.appendChild(stateHost);
        const stateHint = document.createElement('span');
        stateHint.style.cssText = 'color:var(--color-text-dim);';
        stateHint.textContent = this._tt('свитчи/переменные из условий кусков');
        stateBar.appendChild(stateHint);
        mid.appendChild(stateBar);

        const stageWrap = document.createElement('div');
        stageWrap.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:12px;background-color:var(--color-bg-deep);';
        mid.appendChild(stageWrap);

        const screen = this.getScreenSize();
        this._screen = screen;
        const stage = document.createElement('div');
        // Checkerboard "transparency grid" - grey/black 16px cells.
        stage.style.cssText = `
            width:${screen.w}px; height:${screen.h}px; position:relative; flex:none;
            background:
                repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 0 0 / 32px 32px;
            box-shadow: 0 0 0 1px var(--color-border);
            image-rendering: pixelated;
        `;
        stageWrap.appendChild(stage);
        const canvas = document.createElement('canvas');
        canvas.width = screen.w;
        canvas.height = screen.h;
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        stage.appendChild(canvas);
        const selBox = document.createElement('div');
        selBox.style.cssText = 'position:absolute;border:2px solid var(--color-accent-text,#7ab0ff);pointer-events:none;display:none;';
        stage.appendChild(selBox);

        // --- Right: inspector ---
        const right = document.createElement('div');
        right.style.cssText = 'flex:0 0 340px;border-left:1px solid var(--color-border);overflow-y:auto;padding:10px;';
        root.appendChild(right);

        this._dom = { root, count, listBox, stage, canvas, selBox, right, stateHost };
        this._ctx = canvas.getContext('2d');
        this._ctx.imageSmoothingEnabled = false;

        this._bindStage();
        this._refreshAll();
    }

    _blankAnimate() {
        const z = { spd: 0, loop: false, min: 0, max: 0 };
        return { x: Object.assign({}, z), y: Object.assign({}, z), s: Object.assign({}, { spd: 0, loop: false, min: 1, max: 1 }), r: Object.assign({}, z) };
    }

    // ------------------------------------------------------------------
    // State panel
    // ------------------------------------------------------------------

    _refreshStatePanel() {
        const host = this._dom.stateHost;
        host.innerHTML = '';
        const exprs = [];
        for (const p of this._pieces) {
            exprs.push(p.Condition);
            if (p.type === 'Image Numbers') exprs.push(p.Value);
            if (p.type === 'Image Gauge') { exprs.push(p['Cur. Value']); exprs.push(p['Max Value']); }
        }
        const ids = DatabaseHUDEditor.collectIds(exprs);
        if (!ids.switches.length && !ids.vars.length) {
            const none = document.createElement('span');
            none.style.cssText = 'color:var(--color-text-dim);';
            none.textContent = this._tt('нет условий с свитчами/переменными');
            host.appendChild(none);
            return;
        }
        const mkSwitch = id => {
            const b = document.createElement('button');
            b.className = 'agonia-btn';
            const on = !!this._game.switches.get(id);
            b.textContent = 'sw ' + id + (on ? ' ✓' : '');
            b.style.fontWeight = on ? '700' : '400';
            b.title = this._tt('Свитч') + ' ' + id;
            b.addEventListener('click', () => {
                this._game.switches.set(id, !on);
                this._render();
                this._refreshStatePanel();
            });
            host.appendChild(b);
        };
        const mkVar = id => {
            const wrap = document.createElement('span');
            wrap.style.cssText = 'display:inline-flex;align-items:center;gap:3px;';
            const lbl = document.createElement('span');
            lbl.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
            lbl.textContent = 'v' + id + '=';
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.className = 'agonia-input';
            inp.style.cssText = 'width:64px;padding:2px 6px;';
            inp.value = this._game.vars.get(id) || 0;
            inp.addEventListener('input', () => {
                const n = Number(inp.value);
                if (!Number.isNaN(n)) { this._game.vars.set(id, n); this._render(); }
            });
            wrap.appendChild(lbl);
            wrap.appendChild(inp);
            host.appendChild(wrap);
        };
        ids.switches.forEach(mkSwitch);
        ids.vars.forEach(mkVar);
    }

    // ------------------------------------------------------------------
    // Pieces list
    // ------------------------------------------------------------------

    _refreshList() {
        const box = this._dom.listBox;
        box.innerHTML = '';
        this._dom.count.textContent = this._pieces.length + ' ' + this._tt('кусков');
        this._pieces.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'agonia-md-item' + (i === this._selected ? ' active' : '');
            row.style.cssText = `
                padding:5px 8px;border-radius:3px;cursor:pointer;
                display:flex;align-items:center;gap:6px;
                border:1px solid ${i === this._selected ? 'var(--color-accent-border-mid)' : 'transparent'};
            `;
            const vis = document.createElement('span');
            vis.style.cssText = 'cursor:pointer;font-size:12px;width:16px;flex:none;color:var(--color-text-dim);';
            vis.textContent = this._pieceVisible(p) ? '●' : '○';
            vis.title = this._pieceVisible(p) ? this._tt('видим (условие истинно)') : this._tt('скрыт (условие ложно)');
            vis.addEventListener('click', e => {
                e.stopPropagation();
                // quick toggle: comment the condition with '!' wrapper? No -
                // HUDMaker has no per-piece visibility; hint via condition.
                // Instead: flip the game switches is out of scope here; nothing.
            });
            row.appendChild(vis);
            const name = document.createElement('span');
            name.style.cssText = 'flex:1;min-width:0;font-size:12px;color:var(--color-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            name.textContent = '#' + (p.id || '?') + ' ' + (p.Image || p['Main Image'] || p.type);
            row.appendChild(name);
            const sub = document.createElement('span');
            sub.style.cssText = 'font-size:10px;color:var(--color-text-dim);flex:none;';
            sub.textContent = p.type.replace('Image ', '') + ' · L' + (p.Layer || 0);
            row.appendChild(sub);
            row.addEventListener('click', () => {
                this._selected = i;
                this._refreshAll();
            });
            box.appendChild(row);
        });
    }

    // ------------------------------------------------------------------
    // Inspector
    // ------------------------------------------------------------------

    _refreshInspector() {
        const right = this._dom.right;
        right.innerHTML = '';
        const p = this._pieces[this._selected];
        if (!p) {
            const ph = document.createElement('div');
            ph.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:40px 0;font-size:12px;';
            ph.textContent = this._tt('Выберите кусок на сцене или в списке');
            right.appendChild(ph);
            return;
        }
        const form = new InspectorForm();
        form.head('#' + (p.id || '?') + ' ' + p.type, 'x ' + Math.round(p.x) + ' · y ' + Math.round(p.y) + ' · слой ' + (p.Layer || 0));
        form.section(this._tt('Кусок'));
        const commit = () => { this._persist(); this._render(); this._refreshList(); this._refreshInspector(); this._refreshStatePanel(); };
        form.row(this._tt('Слой'),
            this._numField(p, 'Layer', commit));
        form.row(this._tt('Условие (JS)'),
            this._textField(p, 'Condition', commit));
        const imgKey = p.type === 'Picture' ? 'Image' : p.type === 'Image Numbers' ? 'Image' : 'Main Image';
        form.row(this._tt(imgKey),
            this._textField(p, imgKey, commit));
        if (p.type === 'Image Gauge') {
            form.row(this._tt('Подложка'),
                this._textField(p, 'Back Image', commit));
            form.row(this._tt('Cur. Value (JS)'),
                this._textField(p, 'Cur. Value', commit));
            form.row(this._tt('Max Value (JS)'),
                this._textField(p, 'Max Value', commit));
        }
        if (p.type === 'Image Numbers') {
            form.row(this._tt('Value (JS)'),
                this._textField(p, 'Value', commit));
        }
        form.row(this._tt('Масштаб X'),
            this._textField(p, 'Scale X', commit));
        form.row(this._tt('Масштаб Y'),
            this._textField(p, 'Scale Y', commit));
        form.row(this._tt('Прозрачность'),
            this._textField(p, 'Opacity', commit));
        form.mount(right);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;padding:10px 2px;';
        const mkAct = (label, title, fn, danger) => {
            const b = document.createElement('button');
            b.className = 'agonia-btn' + (danger ? ' danger' : '');
            b.textContent = label;
            b.title = title;
            b.addEventListener('click', fn);
            actions.appendChild(b);
        };
        mkAct('⧉', this._tt('Дублировать'), () => {
            const clone = JSON.parse(JSON.stringify(p));
            clone.id = this._pieces.reduce((m, q) => Math.max(m, q.id || 0), 0) + 1;
            clone.x = (Number(clone.x) || 0) + 24;
            clone.y = (Number(clone.y) || 0) + 24;
            this._pieces.splice(this._selected + 1, 0, clone);
            this._selected++;
            this._persist();
            this._refreshAll();
        });
        mkAct('✕', this._tt('Удалить'), () => {
            if (!confirm(this._tt('Удалить кусок?') + ' #' + (p.id || '?'))) return;
            this._pieces.splice(this._selected, 1);
            this._selected = Math.min(this._selected, this._pieces.length - 1);
            this._persist();
            this._refreshAll();
        }, true);
        right.appendChild(actions);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);line-height:1.4;padding:0 2px;';
        hint.textContent = this._tt('Куски перетаскиваются мышью прямо на шахматке. Условия и значения — JS-выражения как в HUDMaker; состояние задаётся тумблерами сверху.');
        right.appendChild(hint);
    }

    _numField(obj, key, commit) {
        const i = document.createElement('input');
        i.type = 'number';
        i.className = 'agonia-input';
        i.style.flex = 'none';
        i.style.width = '84px';
        i.value = Number(obj[key]) || 0;
        i.addEventListener('input', () => {
            const n = Number(i.value);
            if (!Number.isNaN(n)) { obj[key] = String(n); commit(); }
        });
        return i;
    }

    _textField(obj, key, commit) {
        const i = document.createElement('input');
        i.type = 'text';
        i.className = 'agonia-input';
        i.style.flex = '1 1 200px';
        i.value = obj[key] === undefined || obj[key] === null ? '' : String(obj[key]);
        i.addEventListener('change', () => { obj[key] = i.value; commit(); });
        return i;
    }

    // ------------------------------------------------------------------
    // Stage: render + select + drag
    // ------------------------------------------------------------------

    _sorted() {
        return this._pieces
            .map((p, i) => [p, i])
            .sort((a, b) => (Number(a[0].Layer) || 0) - (Number(b[0].Layer) || 0));
    }

    _render() {
        if (!this._ctx) return;
        const ctx = this._ctx;
        ctx.clearRect(0, 0, this._screen.w, this._screen.h);
        ctx.imageSmoothingEnabled = false;
        for (const [p, i] of this._sorted()) {
            if (!this._pieceVisible(p)) continue;
            try { this._drawPiece(ctx, p); } catch (e) { /* keep editor alive */ }
        }
        this._drawSelection();
    }

    _drawSelection() {
        const p = this._pieces[this._selected];
        const box = this._dom.selBox;
        if (!p) { box.style.display = 'none'; return; }
        const r = this._pieceRect(p);
        if (!r) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.style.left = (r.x - 2) + 'px';
        box.style.top = (r.y - 2) + 'px';
        box.style.width = (r.w + 4) + 'px';
        box.style.height = (r.h + 4) + 'px';
    }

    /** Logical rect of a piece (centered anchor, like HUDMaker sprites). */
    _pieceRect(p) {
        const sx = Number(p['Scale X']) || 1;
        const sy = Number(p['Scale Y']) || 1;
        const opa = (Number(p.Opacity) === 0 ? 1 : Number(p.Opacity)) / 255;
        void opa;
        if (p.type === 'Picture') {
            const img = this._img('Picture', p.Image);
            if (!img || !img.naturalWidth) {
                const w = 96, h = 96;
                return { x: p.x - w / 2, y: p.y - h / 2, w, h };
            }
            const w = img.naturalWidth * sx, h = img.naturalHeight * sy;
            return { x: p.x - w / 2, y: p.y - h / 2, w, h };
        }
        if (p.type === 'Image Numbers') {
            const img = this._img('Image Numbers', p.Image);
            const val = this._evalExpr(p.Value, 0);
            const len = Math.max(1, String(Math.round(Number(val) || 0)).length);
            const w0 = img && img.naturalWidth ? img.naturalWidth / 10 : 24;
            const h0 = img && img.naturalHeight ? img.naturalHeight : 32;
            const w = w0 * len * sx, h = h0 * sy;
            return { x: p.x - w / 2, y: p.y - h / 2, w, h };
        }
        if (p.type === 'Image Gauge') {
            const back = this._img('Image Gauge', p['Back Image']);
            const w = (back && back.naturalWidth ? back.naturalWidth : 200) * sx;
            const h = (back && back.naturalHeight ? back.naturalHeight : 24) * sy;
            return { x: p.x - w / 2, y: p.y - h / 2, w, h };
        }
        return null;
    }

    _drawPiece(ctx, p) {
        const sx = Number(p['Scale X']) || 1;
        const sy = Number(p['Scale Y']) || 1;
        const opacity = Math.max(0, Math.min(255, Number(p.Opacity) || 255)) / 255;
        ctx.save();
        ctx.globalAlpha = opacity;
        if (p.type === 'Picture') {
            const img = this._img('Picture', p.Image);
            if (img && img.naturalWidth) {
                const w = img.naturalWidth * sx, h = img.naturalHeight * sy;
                ctx.drawImage(img, p.x - w / 2, p.y - h / 2, w, h);
            } else {
                this._drawPlaceholder(ctx, p, p.x - 48, p.y - 48, 96, 96, p.Image);
            }
        } else if (p.type === 'Image Numbers') {
            const img = this._img('Image Numbers', p.Image);
            const val = Math.round(Number(this._evalExpr(p.Value, 0)) || 0);
            const str = String(val);
            const w0 = img && img.naturalWidth ? img.naturalWidth / 10 : 24;
            const h0 = img && img.naturalHeight ? img.naturalHeight : 32;
            const totalW = w0 * str.length;
            let cx = p.x - (totalW * sx) / 2;
            for (const ch of str) {
                const d = Math.max(0, Math.min(9, Number(ch)));
                if (img && img.naturalWidth) {
                    ctx.drawImage(img, d * w0, 0, w0, h0, cx, p.y - (h0 * sy) / 2, w0 * sx, h0 * sy);
                } else {
                    this._drawPlaceholder(ctx, p, cx, p.y - (h0 * sy) / 2, w0 * sx, h0 * sy, p.Image + ':' + ch);
                }
                cx += w0 * sx;
            }
        } else if (p.type === 'Image Gauge') {
            const back = this._img('Image Gauge', p['Back Image']);
            const main = this._img('Image Gauge', p['Main Image']);
            const cur = Number(this._evalExpr(p['Cur. Value'], 1)) || 0;
            const max = Number(this._evalExpr(p['Max Value'], 1)) || 1;
            const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : cur / max));
            const w = (back && back.naturalWidth ? back.naturalWidth : 200) * sx;
            const h = (back && back.naturalHeight ? back.naturalHeight : 24) * sy;
            const x0 = p.x - w / 2, y0 = p.y - h / 2;
            if (back && back.naturalWidth) {
                ctx.drawImage(back, x0, y0, w, h);
            } else {
                this._drawPlaceholder(ctx, p, x0, y0, w, h, p['Back Image']);
            }
            if (main && main.naturalWidth) {
                const mw = main.naturalWidth * sx, mh = main.naturalHeight * sy;
                const dir = String(p.Direction || 'left');
                if (dir === 'up' || dir === 'down') {
                    const fh = mh * ratio;
                    const fy = dir === 'up' ? y0 + (h - fh) : y0;
                    // vertical fill inside the back rect bounds
                    ctx.drawImage(main, 0, main.naturalHeight - (main.naturalHeight * ratio), main.naturalWidth, main.naturalHeight * ratio,
                        x0, dir === 'up' ? y0 + (h - fh) : fy, w, fh);
                } else {
                    const fw = w * ratio;
                    const fx = dir === 'right' ? x0 + (w - fw) : x0;
                    ctx.drawImage(main, fx, y0, fw, h);
                }
            }
        }
        ctx.restore();
    }

    _drawPlaceholder(ctx, p, x, y, w, h, label) {
        ctx.save();
        ctx.strokeStyle = 'rgba(122,176,255,0.55)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(128,128,128,0.75)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const txt = label ? String(label).slice(0, 22) : '?';
        ctx.fillText(txt, x + w / 2, y + h / 2);
        ctx.restore();
    }

    _bindStage() {
        const stage = this._dom.stage;
        const canvas = this._dom.canvas;
        let drag = null; // {idx, dx, dy}
        const toStage = e => {
            const r = canvas.getBoundingClientRect();
            const kx = this._screen.w / r.width;
            const ky = this._screen.h / r.height;
            return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
        };
        const pick = pt => {
            // topmost by layer: iterate sorted descending
            const sorted = this._sorted().reverse();
            for (const [p, i] of sorted) {
                if (!this._pieceVisible(p)) continue;
                const r = this._pieceRect(p);
                if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return { p, i };
            }
            return null;
        };
        stage.addEventListener('mousedown', e => {
            const pt = toStage(e);
            const hit = pick(pt);
            if (!hit) { this._selected = -1; this._refreshList(); this._refreshInspector(); this._drawSelection(); return; }
            this._selected = hit.i;
            drag = { idx: hit.i, dx: pt.x - hit.p.x, dy: pt.y - hit.p.y, moved: false };
            this._refreshList();
            this._refreshInspector();
            this._drawSelection();
            e.preventDefault();
        });
        window.addEventListener('mousemove', e => {
            if (!drag) return;
            const pt = toStage(e);
            const p = this._pieces[drag.idx];
            if (!p) { drag = null; return; }
            p.x = Math.round(pt.x - drag.dx);
            p.y = Math.round(pt.y - drag.dy);
            drag.moved = true;
            this._render();
        });
        window.addEventListener('mouseup', () => {
            if (drag && drag.moved) {
                this._persist();
                this._refreshInspector(); // x/y in the head
            }
            drag = null;
        });
    }

    _refreshAll() {
        this._refreshStatePanel();
        this._refreshList();
        this._refreshInspector();
        this._render();
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseHUDEditor = DatabaseHUDEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseHUDEditor;
}
