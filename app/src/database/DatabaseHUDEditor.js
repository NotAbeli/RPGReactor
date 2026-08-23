/**
 * DatabaseHUDEditor (S39-S41) - live HUD + game-window editor inside
 * «Интерфейс», on one checkerboard stage, WITHOUT launching the game.
 *
 * Layers on the stage (bottom to top):
 *   1. windows canvas  - editable plugin-drawn UI mock-ups:
 *        craft (SimpleCraftSystem: slots/result/hint/preview anchors from
 *        the flat craft DB section) and inventory windows (SuperDuperInventory
 *        Visual Settings blob: player grid, chest, hotbar (Y-only - the
 *        plugin centers X), custom window). Dragging an anchor writes the
 *        section keys; the blob is seeded from plugin defaults on first
 *        touch and stored as an MV string.
 *   2. hud canvas      - data/MapHUD.json pieces (Picture / Image Numbers
 *        10-digit strip / Image Gauge honoring Style), selected+draggable.
 * Images: HUD pieces from img/SumRndmDde/hud/{pictures,numbers,
 * gauge_images,gauge_backs}; window images from img/pictures.
 * Conditions/values are JS expressions in a sandbox with mock
 * $gameSwitches/$gameVariables (the «Состояние игры» bar auto-collects
 * IDs; master toggle «Показывать все» bypasses conditions, ON by default).
 * Scale selector: «Вписать» (auto-fit) / 100% / 75% / 50% - the stage
 * scales via CSS transform; picking stays precise because pointer coords
 * normalize through getBoundingClientRect.
 * MapHUD saves to data/MapHUD.json with a timestamped backup (HUDMaker-
 * compatible fields only; HUDMaker stays the fallback). DB-section edits
 * flow through the regular agonia sidecar save pipeline.
 */
class DatabaseHUDEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
        this._pieces = null;
        this._selected = -1;        // HUD piece index
        this._selectedWindow = null; // window anchor id (string)
        this._images = {};
        this._game = { switches: new Map(), vars: new Map() };
        this._showAll = true;
        this._scaleMode = 'fit';
        this._scaleK = 1;
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
    // MapHUD.json data
    // ------------------------------------------------------------------

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

    _evalExpr(expr, fallback) {
        if (expr === undefined || expr === null || String(expr).trim() === '') return fallback;
        const $gameSwitches = { value: id => !!(this._game.switches.get(Number(id))) };
        const $gameVariables = { value: id => { const v = this._game.vars.get(Number(id)); return v === undefined ? 0 : v; } };
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
        if (this._showAll) return true;
        const c = p.Condition;
        if (c === undefined || c === null || String(c).trim() === '') return true;
        return !!this._evalExpr(c, true);
    }

    // ------------------------------------------------------------------
    // Images
    // ------------------------------------------------------------------

    /** HUDMaker image folders (SRD_HUDMaker 186-198). */
    static imgFolder(kind, slot) {
        if (kind === 'Picture') return 'pictures';
        if (kind === 'Image Numbers') return 'numbers';
        return slot === 'back' ? 'gauge_backs' : 'gauge_images';
    }

    _imgUrl(parts, name) {
        if (!name) return '';
        const path = this._req('path');
        const proj = this._projectPath();
        if (!path || !proj) return '';
        if (typeof RRAssetFiles === 'undefined') return '';
        try {
            return RRAssetFiles.toUrl(path.join.apply(path, [proj].concat(parts, [name + '.png'])));
        } catch (e) { return ''; }
    }

    _cachedImg(key, url) {
        if (!url) return null;
        if (this._images[key] !== undefined) return this._images[key];
        let entry = null;
        if (typeof Image !== 'undefined') {
            const img = new Image();
            // Cache BEFORE assigning src: a synchronous onload re-renders,
            // and an uncached lookup would recurse forever.
            this._images[key] = img;
            entry = img;
            img.onload = () => this._render();
            img.src = url;
        } else {
            this._images[key] = null;
        }
        return entry;
    }

    _hudImg(kind, name, slot) {
        if (!name) return null;
        const projParts = ['img', 'SumRndmDde', 'hud', DatabaseHUDEditor.imgFolder(kind, slot)];
        return this._cachedImg('hud/' + kind + '/' + slot + '/' + name, this._imgUrl(projParts, name));
    }

    _picImg(name) {
        if (!name) return null;
        return this._cachedImg('pic/' + name, this._imgUrl(['img', 'pictures'], name));
    }

    // ------------------------------------------------------------------
    // DB sections (craft / inventory) + Visual Settings blob
    // ------------------------------------------------------------------

    _agonia() {
        const data = this.databaseManager.data;
        if (!data) return null;
        if (!data.agonia) data.agonia = (typeof DatabaseManager !== 'undefined' && DatabaseManager.agoniaDefaults)
            ? DatabaseManager.agoniaDefaults() : {};
        return data.agonia;
    }

    _craft() {
        const a = this._agonia();
        if (!a) return {};
        if (!a.craft) a.craft = {};
        return a.craft;
    }

    /** SuperDuperInventory Visual Settings defaults (plugin annotation). */
    static get INV_VISUAL_DEFAULTS() {
        return {
            "Player Bg": "InvBackground", "Player Slot": "InvSlot",
            "Player Cols": "5", "Player Rows": "4", "Player X": "50", "Player Y": "50",
            "Player Spacing": "40", "Slot Offset X": "0", "Slot Offset Y": "0",
            "Icon Offset X": "0", "Icon Offset Y": "0",
            "Font Size": "14", "Font Bold": "true", "Font Outline": "true",
            "Inv Count X": "12", "Inv Count Y": "12",
            "Locked Slot": "InvSlotLocked", "Selection": "InvSelection",
            "Active Selection": "InvActive", "Hover Opacity": "255",
            "Chest Bg": "ChestBackground", "Chest Slot": "InvSlot",
            "Chest Cols": "5", "Chest Rows": "3", "Chest X": "400", "Chest Y": "50",
            "Chest Spacing": "40",
            "Hotbar Switch": "[\"0\"]", "Hotbar Fade Speed": "15",
            "Hotbar Y": "500", "Hotbar Spacing": "40", "Hotbar Scale": "1.2",
            "Hotbar Font Size": "14", "Hotbar Font Color": "#ffffff",
            "Hotbar Num X": "-10", "Hotbar Num Y": "10",
            "Hotbar Count X": "12", "Hotbar Count Y": "12",
            "Custom Window Img": "", "Custom Window X": "0", "Custom Window Y": "0",
            "Name X": "10", "Name Y": "10", "Name Align": "left", "Name Font Size": "22",
            "Desc X": "10", "Desc Y": "40", "Desc Width": "200", "Desc Font Size": "18",
            // S43: separated rows block (defaults resolve at runtime too)
            "Grid2 X": "", "Grid2 Y": "", "Grid2 Bg": ""
        };
    }

    /**
     * The inventory Visual Settings blob: prefer the sidecar value; seed
     * from the RETIRED SNAPSHOT in project.rpgreactor (the real tuning the
     * game runs on) on first touch; fall back to plugin-annotation
     * defaults only when no snapshot exists. Stored back as an MV string.
     */
    _invVisual() {
        const defaults = this._snapshotVisual() || DatabaseHUDEditor.INV_VISUAL_DEFAULTS;
        const a = this._agonia();
        if (!a) return { ...defaults };
        if (!a.inventory) a.inventory = {};
        const raw = a.inventory['Visual Settings'];
        if (raw === undefined || raw === null || raw === '') {
            const blob = { ...defaults };
            a.inventory['Visual Settings'] = JSON.stringify(blob);
            return blob;
        }
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (parsed && typeof parsed === 'object') ? parsed : { ...defaults };
        } catch (e) {
            return { ...defaults };
        }
    }

    /** Real tuning from project.rpgreactor retiredPlugins (S42). */
    _snapshotVisual() {
        const path = this._req('path');
        const fs = this._req('fs');
        const proj = this._projectPath();
        if (!path || !fs || !proj) return null;
        try {
            const file = path.join(proj, 'project.rpgreactor');
            if (!fs.existsSync(file)) return null;
            const projCfg = JSON.parse(fs.readFileSync(file, 'utf8'));
            const retired = (projCfg && Array.isArray(projCfg.retiredPlugins)) ? projCfg.retiredPlugins : [];
            const snap = retired.find(r => r && /SuperDuperInventory/.test(String(r.name)));
            const raw = snap && snap.parameters && snap.parameters['Visual Settings'];
            if (!raw) return null;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    _invVisualCommit(blob) {
        const a = this._agonia();
        if (a && a.inventory) a.inventory['Visual Settings'] = JSON.stringify(blob);
    }

    // ------------------------------------------------------------------
    // Editable window anchors (craft + inventory)
    // ------------------------------------------------------------------

    /**
     * Window anchors: {id, label, rect(), draw(ctx), apply(x,y), lockX?}
     * rect is in stage coords (top-left + size).
     */
    _windowDefs() {
        const defs = [];
        const craft = this._craft();
        const n = (k, d) => { const v = Number(craft[k]); return Number.isFinite(v) ? v : d; };
        const pctX = p => Math.round(this._screen.w * p / 100);
        const pctY = p => Math.round(this._screen.h * p / 100);
        const size = n('Slot Size', 40);
        const drawCraftSlot = (ctx, x, y, tag) => {
            const img = this._picImg(craft['Slot Bg Image']);
            ctx.save();
            if (img && img.naturalWidth) {
                ctx.drawImage(img, x, y, size, size);
            } else {
                ctx.strokeStyle = 'rgba(240,200,120,0.7)';
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
                ctx.setLineDash([]);
            }
            if (tag) {
                ctx.fillStyle = 'rgba(240,200,120,0.85)';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(tag, x + 4, y - 4);
            }
            ctx.restore();
        };

        // Craft: 3 input slots in a row (dragging slot 1 moves the block).
        // Plugin defaults (SimpleCraftSystem 387-391): pctX(23)/pctY(14),
        // spacing = pctX(5).
        const s1x = () => n('Slot 1 X', pctX(23)), s1y = () => n('Slot 1 Y', pctY(14));
        const spacing = () => n('Slot Spacing', pctX(5));
        const slotRect = (x, y) => ({ x, y, w: size, h: size });
        defs.push({
            id: 'craft.slots',
            label: this._tt('Крафт · слоты'),
            rect: () => slotRect(s1x(), s1y()),
            apply: (x, y) => { craft['Slot 1 X'] = String(Math.round(x)); craft['Slot 1 Y'] = String(Math.round(y)); },
            draw: ctx => {
                for (let i = 0; i < 3; i++) drawCraftSlot(ctx, s1x() + i * spacing(), s1y(), i === 0 ? 'крафт' : '');
            }
        });
        const rx = () => n('Result Slot X', pctX(43)), ry = () => n('Result Slot Y', pctY(14));
        defs.push({
            id: 'craft.result',
            label: this._tt('Крафт · результат'),
            rect: () => slotRect(rx(), ry()),
            apply: (x, y) => { craft['Result Slot X'] = String(Math.round(x)); craft['Result Slot Y'] = String(Math.round(y)); },
            draw: ctx => drawCraftSlot(ctx, rx(), ry(), '✦')
        });
        // Hint/Preview are FULL-WIDTH one-line text sprites in the plugin
        // (Bitmap(boxWidth, 40)) positioned at their X/Y.
        const lineH = 40;
        const drawTextLine = (ctx, r, text, accent) => {
            ctx.save();
            ctx.strokeStyle = accent;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(230,230,245,0.85)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(String(text).slice(0, 60), r.x + 6, r.y + r.h / 2 + 4);
            this._strokeSelected(ctx, r);
            ctx.restore();
        };
        const hx = () => n('Hint X', pctX(0)), hy = () => n('Hint Y', pctY(70));
        defs.push({
            id: 'craft.hint',
            label: this._tt('Крафт · подсказка'),
            rect: () => ({ x: hx(), y: hy(), w: this._screen.w - hx(), h: lineH }),
            apply: (x, y) => { craft['Hint X'] = String(Math.round(x)); craft['Hint Y'] = String(Math.round(y)); },
            draw: ctx => drawTextLine(ctx, { x: hx(), y: hy(), w: this._screen.w - hx(), h: lineH },
                craft['Hint Text'] || 'подсказка', 'rgba(240,200,120,0.55)')
        });
        const px = () => n('Preview X', pctX(0)), py = () => n('Preview Y', pctY(75));
        defs.push({
            id: 'craft.preview',
            label: this._tt('Крафт · превью'),
            rect: () => ({ x: px(), y: py(), w: this._screen.w - px(), h: lineH }),
            apply: (x, y) => { craft['Preview X'] = String(Math.round(x)); craft['Preview Y'] = String(Math.round(y)); },
            draw: ctx => drawTextLine(ctx, { x: px(), y: py(), w: this._screen.w - px(), h: lineH },
                'Создано: %1', 'rgba(240,200,120,0.55)')
        });

        // Inventory windows (Visual Settings blob; S42 exact plugin geometry)
        const vis = this._invVisual();
        const vn = (k, d) => { const v = Number(vis[k]); return Number.isFinite(v) ? v : d; };
        // Slot size follows the real slot image (InventorySlot_00 = 38)
        const slotImgFor = vis['Player Slot'];
        const slotNatural = () => {
            const img = slotImgFor ? this._picImg(slotImgFor) : null;
            return (img && img.naturalWidth) ? img.naturalWidth : 38;
        };
        const bgRect = (xKey, yKey, bgKey, colsKey, rowsKey, spKey, offKeyX, offKeyY, slotKey) => {
            const x = vn(xKey, 50), y = vn(yKey, 50);
            const bg = this._picImg(vis[bgKey]);
            const slot = slotKey ? this._picImg(vis[slotKey]) : null;
            const cell = (slot && slot.naturalWidth) ? slot.naturalWidth : slotNatural();
            const sp = vn(spKey, 40);
            const cols = vn(colsKey, 5), rows = vn(rowsKey, 4);
            const gridW = vn(offKeyX, 0) + (cols - 1) * sp + cell;
            const gridH = vn(offKeyY, 0) + (rows - 1) * sp + cell;
            const w = (bg && bg.naturalWidth) ? bg.naturalWidth : Math.max(gridW, cell);
            const h = (bg && bg.naturalHeight) ? bg.naturalHeight : Math.max(gridH, cell);
            return { x, y, w, h, cols, rows, sp, cell, bgImg: bg, slotImg: slot, offX: vn(offKeyX, 0), offY: vn(offKeyY, 0) };
        };
        const drawGridBox = (r) => {
            const ctx = this._winCtx;
            ctx.save();
            if (r.bgImg && r.bgImg.naturalWidth) {
                // S44: fold-slice support - sliceY/sliceH crop the bg image
                // so split blocks never duplicate the plate.
                if (r.sliceH !== undefined) {
                    ctx.drawImage(r.bgImg, 0, r.sliceY, r.bgImg.naturalWidth, r.sliceH,
                        r.x, r.y, r.w, r.h);
                } else {
                    ctx.drawImage(r.bgImg, r.x, r.y, r.w, r.h);
                }
            } else {
                ctx.strokeStyle = 'rgba(120,220,160,0.65)';
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
                ctx.setLineDash([]);
            }
            for (let row = 0; row < r.rows; row++) {
                for (let col = 0; col < r.cols; col++) {
                    const sx = r.x + r.offX + col * r.sp;
                    const sy = r.y + r.offY + row * r.sp;
                    if (r.slotImg && r.slotImg.naturalWidth) {
                        ctx.drawImage(r.slotImg, sx, sy, r.cell, r.cell);
                    } else {
                        ctx.strokeStyle = 'rgba(120,220,160,0.4)';
                        ctx.strokeRect(sx + 0.5, sy + 0.5, r.cell - 1, r.cell - 1);
                    }
                }
            }
            this._strokeSelected(ctx, r);
            ctx.restore();
        };
        // S43: seed the Grid2 keys (separated rows block) into the blob.
        // Empty-string placeholders from INV_VISUAL_DEFAULTS count as unset.
        // S44: Grid2 Bg stays EMPTY by default - the player background is
        // fold-sliced instead of duplicated.
        if (vis['Grid2 X'] === undefined || vis['Grid2 X'] === '') {
            vis['Grid2 X'] = String(vn('Player X', 50));
            vis['Grid2 Y'] = String(vn('Player Y', 50) + vn('Player Spacing', 40));
            vis['Grid2 Bg'] = vis['Grid2 Bg'] || '';
            this._invVisualCommit(vis); // persist the seeded keys immediately
        }
        // S47: detached background plates + z keys seed (stock layout).
        if (vis['Player Bg X'] === undefined) {
            vis['Player Bg X'] = String(vn('Player X', 50));
            vis['Player Bg Y'] = String(vn('Player Y', 50));
            vis['Chest Bg X'] = String(vn('Chest X', 400));
            vis['Chest Bg Y'] = String(vn('Chest Y', 50));
            vis['Z Player'] = '0';
            vis['Z Chest'] = '0';
            vis['Z Hotbar'] = '0';
            vis['Inventory Over HUD'] = 'false';
            this._invVisualCommit(vis);
        }
        // S47: the player background plate is its OWN draggable anchor
        // (Player Bg X/Y); the slot blocks carry no plate.
        const playerBgRect = () => {
            const x = vn('Player Bg X', vn('Player X', 50));
            const y = vn('Player Bg Y', vn('Player Y', 50));
            const bg = this._picImg(vis['Player Bg']);
            const w = (bg && bg.naturalWidth) ? bg.naturalWidth : 250;
            const h = (bg && bg.naturalHeight) ? bg.naturalHeight : 335;
            return { x, y, w, h, cols: 0, rows: 0, sp: 0, cell: 0, bgImg: bg, slotImg: null, offX: 0, offY: 0 };
        };
        defs.push({
            id: 'inv.bg',
            label: this._tt('Инвентарь · фон'),
            rect: playerBgRect,
            apply: (x, y) => { vis['Player Bg X'] = String(Math.round(x)); vis['Player Bg Y'] = String(Math.round(y)); this._invVisualCommit(vis); },
            draw: () => drawGridBox(playerBgRect())
        });
        // Row-1 block (hotbar row): BARE slots (the plate is inv.bg now).
        const playerRect = () => {
            const slot = this._picImg(vis['Player Slot']);
            const cell = (slot && slot.naturalWidth) ? slot.naturalWidth : slotNatural();
            const sp = vn('Player Spacing', 40);
            const cols = vn('Player Cols', 5);
            const x = vn('Player X', 50), y = vn('Player Y', 50);
            const gridW = vn('Slot Offset X', 0) + (cols - 1) * sp + cell;
            const gridH = vn('Slot Offset Y', 0) + cell;
            return { x, y, w: Math.max(gridW, cell), h: Math.max(gridH, cell), cols, rows: 1, sp, cell, bgImg: null, slotImg: slot, offX: vn('Slot Offset X', 0), offY: vn('Slot Offset Y', 0) };
        };
        defs.push({
            id: 'inv.player',
            label: this._tt('Инвентарь · ряд 1'),
            rect: playerRect,
            apply: (x, y) => { vis['Player X'] = String(Math.round(x)); vis['Player Y'] = String(Math.round(y)); this._invVisualCommit(vis); },
            draw: () => drawGridBox(playerRect())
        });
        // Rows 2-4 block: bare slots by default (the plate stays pinned to
        // row 1); a custom Grid2 Bg renders whole.
        const grid2Rect = () => {
            const x = vn('Grid2 X', vn('Player X', 50));
            const y = vn('Grid2 Y', vn('Player Y', 50) + vn('Player Spacing', 40));
            const slot = this._picImg(vis['Player Slot']);
            const cell = (slot && slot.naturalWidth) ? slot.naturalWidth : slotNatural();
            const sp = vn('Player Spacing', 40);
            const cols = vn('Player Cols', 5);
            const totalRows = vn('Player Rows', 4);
            const rows = Math.max(0, totalRows - 1);
            const custom = vis['Grid2 Bg'] ? this._picImg(vis['Grid2 Bg']) : null;
            if (custom && custom.naturalWidth) {
                return { x, y, w: custom.naturalWidth, h: custom.naturalHeight, cols, rows, sp, cell, bgImg: custom, slotImg: slot, offX: vn('Slot Offset X', 0), offY: vn('Slot Offset Y', 0) };
            }
            const gridW = vn('Slot Offset X', 0) + (cols - 1) * sp + cell;
            const gridH = vn('Slot Offset Y', 0) + (rows - 1) * sp + cell;
            return { x, y, w: Math.max(gridW, cell), h: Math.max(gridH, cell), cols, rows, sp, cell, bgImg: null, slotImg: slot, offX: vn('Slot Offset X', 0), offY: vn('Slot Offset Y', 0) };
        };
        defs.push({
            id: 'inv.grid2',
            label: this._tt('Инвентарь · ряды 2–4'),
            rect: grid2Rect,
            apply: (x, y) => { vis['Grid2 X'] = String(Math.round(x)); vis['Grid2 Y'] = String(Math.round(y)); this._invVisualCommit(vis); },
            draw: () => drawGridBox(grid2Rect())
        });
        // S47: chest background plate is its own anchor (Chest Bg X/Y).
        const chestBgRect = () => {
            const x = vn('Chest Bg X', vn('Chest X', 400));
            const y = vn('Chest Bg Y', vn('Chest Y', 50));
            const bg = this._picImg(vis['Chest Bg']);
            const w = (bg && bg.naturalWidth) ? bg.naturalWidth : 250;
            const h = (bg && bg.naturalHeight) ? bg.naturalHeight : 335;
            return { x, y, w, h, cols: 0, rows: 0, sp: 0, cell: 0, bgImg: bg, slotImg: null, offX: 0, offY: 0 };
        };
        defs.push({
            id: 'inv.chestBg',
            label: this._tt('Сундук · фон'),
            rect: chestBgRect,
            apply: (x, y) => { vis['Chest Bg X'] = String(Math.round(x)); vis['Chest Bg Y'] = String(Math.round(y)); this._invVisualCommit(vis); },
            draw: () => drawGridBox(chestBgRect())
        });
        // Chest slots: bare grid (the plate is inv.chestBg).
        const chestRect = () => {
            const slot = this._picImg(vis['Chest Slot'] || vis['Player Slot']);
            const cell = (slot && slot.naturalWidth) ? slot.naturalWidth : slotNatural();
            const sp = vn('Chest Spacing', 40);
            const cols = vn('Chest Cols', 5), rows = vn('Chest Rows', 3);
            const x = vn('Chest X', 400), y = vn('Chest Y', 50);
            const gridW = vn('Slot Offset X', 0) + (cols - 1) * sp + cell;
            const gridH = vn('Slot Offset Y', 0) + (rows - 1) * sp + cell;
            return { x, y, w: Math.max(gridW, cell), h: Math.max(gridH, cell), cols, rows, sp, cell, bgImg: null, slotImg: slot, offX: vn('Slot Offset X', 0), offY: vn('Slot Offset Y', 0) };
        };
        defs.push({
            id: 'inv.chest',
            label: this._tt('Инвентарь · сундук'),
            rect: chestRect,
            apply: (x, y) => { vis['Chest X'] = String(Math.round(x)); vis['Chest Y'] = String(Math.round(y)); this._invVisualCommit(vis); },
            draw: () => drawGridBox(chestRect())
        });
        // Hotbar: Sprite anchor 0.5 - X centered by the plugin, Y IS THE
        // CENTER; exactly 5 slots scaled by hbScale (runtime hardcodes 5).
        const hbCount = 5;
        const hotbarRect = () => {
            const sp = vn('Hotbar Spacing', 40) * vn('Hotbar Scale', 1.2);
            const cell = slotNatural() * vn('Hotbar Scale', 1.2);
            const w = hbCount * sp;
            const cy = vn('Hotbar Y', 500);
            const h = cell;
            return { x: (this._screen.w - w) / 2, y: cy - h / 2, w, h, cy };
        };
        defs.push({
            id: 'inv.hotbar',
            label: this._tt('Инвентарь · хотбар (только Y)'),
            rect: hotbarRect,
            lockX: true,
            // apply receives the desired TOP-LEFT; store the CENTER y.
            apply: (x, y) => {
                const r = hotbarRect();
                void x;
                vis['Hotbar Y'] = String(Math.round(y + r.h / 2));
                this._invVisualCommit(vis);
            },
            draw: () => {
                const ctx = this._winCtx;
                const r = hotbarRect();
                ctx.save();
                const cell = slotNatural() * vn('Hotbar Scale', 1.2);
                const sp = vn('Hotbar Spacing', 40) * vn('Hotbar Scale', 1.2);
                for (let i = 0; i < hbCount; i++) {
                    const sx = r.x + i * sp + (sp - cell) / 2;
                    const sy = r.y;
                    const img = this._picImg(vis['Player Slot']);
                    if (img && img.naturalWidth) {
                        ctx.drawImage(img, sx, sy, cell, cell);
                    } else {
                        ctx.strokeStyle = 'rgba(120,220,160,0.4)';
                        ctx.strokeRect(sx + 0.5, sy + 0.5, cell - 1, cell - 1);
                    }
                }
                this._strokeSelected(ctx, r);
                ctx.restore();
            }
        });
        const cwRect = () => {
            const x = vn('Custom Window X', 0), y = vn('Custom Window Y', 300);
            const img = this._picImg(vis['Custom Window Img']);
            const w = (img && img.naturalWidth) ? img.naturalWidth : 220;
            const h = (img && img.naturalHeight) ? img.naturalHeight : 140;
            return { x, y, w, h, img };
        };
        defs.push({
            id: 'inv.custom',
            label: this._tt('Инвентарь · кастомное окно'),
            rect: cwRect,
            apply: (x, y) => { vis['Custom Window X'] = String(Math.round(x)); vis['Custom Window Y'] = String(Math.round(y)); this._invVisualCommit(vis); },
            draw: () => {
                const ctx = this._winCtx;
                const r = cwRect();
                ctx.save();
                if (r.img && r.img.naturalWidth) {
                    ctx.drawImage(r.img, r.x, r.y, r.w, r.h);
                } else {
                    ctx.strokeStyle = 'rgba(120,220,160,0.65)';
                    ctx.setLineDash([5, 3]);
                    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
                    ctx.setLineDash([]);
                }
                // S43: the info-output region (name + description) lives
                // INSIDE the custom window and moves only with it.
                const nx = vn('Name X', 10), ny = vn('Name Y', 10);
                const dx = vn('Desc X', 10), dy = vn('Desc Y', 40);
                const dw = vn('Desc Width', 200);
                const region = {
                    x: r.x + Math.min(nx, dx),
                    y: r.y + Math.min(ny, dy),
                    w: Math.max(dw, 60),
                    h: Math.max(dy + 120, 140) - Math.min(ny, dy)
                };
                ctx.fillStyle = 'rgba(128,128,140,0.30)';
                ctx.fillRect(region.x, region.y, region.w, region.h);
                ctx.strokeStyle = 'rgba(160,160,180,0.7)';
                ctx.strokeRect(region.x + 0.5, region.y + 0.5, region.w - 1, region.h - 1);
                this._strokeSelected(ctx, r);
                ctx.restore();
            }
        });

        return defs;
    }

    /** Accent frame around the selected window rect (S42). */
    _strokeSelected(ctx, r) {
        if (!this._selectedWindow) return;
        const sel = this._windowDefsCache && this._windowDefsCache.find(d => d.id === this._selectedWindow);
        if (!sel) return;
        const sr = sel.rect();
        if (sr.x === r.x && sr.y === r.y) {
            ctx.strokeStyle = 'rgba(122,176,255,0.95)';
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
            ctx.lineWidth = 1;
        }
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

        // --- Middle: stage ---
        const mid = document.createElement('div');
        mid.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;';
        root.appendChild(mid);

        const stateBar = document.createElement('div');
        stateBar.style.cssText = 'padding:6px 10px;border-bottom:1px solid var(--color-border);font-size:12px;color:var(--color-text-dim);display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
        const stateLbl = document.createElement('span');
        stateLbl.textContent = this._tt('Состояние игры:');
        stateBar.appendChild(stateLbl);
        const stateHost = document.createElement('span');
        stateHost.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;';
        stateBar.appendChild(stateHost);
        const spacer = document.createElement('span');
        spacer.style.flex = '1';
        stateBar.appendChild(spacer);
        // Scale selector (S41)
        const scaleLbl = document.createElement('span');
        scaleLbl.textContent = this._tt('Масштаб:');
        stateBar.appendChild(scaleLbl);
        const scaleSel = document.createElement('select');
        scaleSel.className = 'agonia-select';
        scaleSel.style.cssText = 'padding:3px 6px;font-size:12px;';
        for (const [v, l] of [['fit', 'Вписать'], ['1', '100%'], ['0.75', '75%'], ['0.5', '50%']]) {
            const o = document.createElement('option');
            o.value = v;
            o.textContent = this._tt(l);
            scaleSel.appendChild(o);
        }
        scaleSel.value = this._scaleMode;
        scaleSel.addEventListener('change', () => {
            this._scaleMode = scaleSel.value;
            this._applyScale();
        });
        stateBar.appendChild(scaleSel);
        mid.appendChild(stateBar);

        const stageWrap = document.createElement('div');
        stageWrap.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:12px;background-color:var(--color-bg-deep);';
        mid.appendChild(stageWrap);

        const screen = this.getScreenSize();
        this._screen = screen;
        const scaler = document.createElement('div');
        scaler.style.cssText = 'flex:none;';
        stageWrap.appendChild(scaler);

        const stage = document.createElement('div');
        stage.style.cssText = `
            width:${screen.w}px; height:${screen.h}px; position:relative; flex:none;
            background: repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 0 0 / 32px 32px;
            box-shadow: 0 0 0 1px var(--color-border);
            image-rendering: pixelated; transform-origin: top left;
        `;
        scaler.appendChild(stage);

        // Layer 1: editable windows (craft + inventory) - below HUD pieces.
        const winCanvas = document.createElement('canvas');
        winCanvas.width = screen.w;
        winCanvas.height = screen.h;
        winCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
        stage.appendChild(winCanvas);

        // Layer 2: HUD pieces (interactive picking happens on the stage).
        const canvas = document.createElement('canvas');
        canvas.width = screen.w;
        canvas.height = screen.h;
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        stage.appendChild(canvas);
        const selBox = document.createElement('div');
        selBox.style.cssText = 'position:absolute;border:2px solid var(--color-accent-text,#7ab0ff);pointer-events:none;display:none;';
        stage.appendChild(selBox);
        // S44: HUDMaker-style snap guides (red full-screen lines).
        const snapV = document.createElement('div');
        snapV.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(255,60,60,0.8);pointer-events:none;display:none;z-index:5;';
        const snapH = document.createElement('div');
        snapH.style.cssText = 'position:absolute;left:0;right:0;height:1px;background:rgba(255,60,60,0.8);pointer-events:none;display:none;z-index:5;';
        stage.appendChild(snapV);
        stage.appendChild(snapH);

        // --- Right: inspector ---
        const right = document.createElement('div');
        right.style.cssText = 'flex:0 0 340px;border-left:1px solid var(--color-border);overflow-y:auto;padding:10px;';
        root.appendChild(right);

        this._dom = { root, count, listBox, stage, scaler, stageWrap, winCanvas, canvas, selBox, snapV, snapH, right, stateHost };
        this._ctx = canvas.getContext('2d');
        this._ctx.imageSmoothingEnabled = false;
        this._winCtx = winCanvas.getContext('2d');
        this._winCtx.imageSmoothingEnabled = false;

        this._bindStage();
        this._applyScale();
        this._refreshAll();
    }

    /** Scale the stage to fit the container (or the chosen fixed ratio). */
    _applyScale() {
        if (!this._dom || !this._dom.scaler) return;
        const wrap = this._dom.stageWrap;
        let k;
        if (this._scaleMode === 'fit') {
            const availW = Number(wrap.clientWidth) - 24;
            const availH = Number(wrap.clientHeight) - 24;
            k = (Number.isFinite(availW) && Number.isFinite(availH) && availW > 0 && availH > 0)
                ? Math.min(availW / this._screen.w, availH / this._screen.h, 1)
                : 1;
        } else {
            k = Number(this._scaleMode);
            if (!(k > 0)) k = 1;
        }
        this._scaleK = k;
        this._dom.scaler.style.width = Math.round(this._screen.w * k) + 'px';
        this._dom.scaler.style.height = Math.round(this._screen.h * k) + 'px';
        this._dom.stage.style.transform = 'scale(' + k + ')';
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
        const all = document.createElement('button');
        all.className = 'agonia-btn';
        const on = this._showAll;
        all.textContent = on ? '👁 ' + this._tt('Показывать все') : '⏻ ' + this._tt('Условия игры');
        all.style.fontWeight = '700';
        all.title = on
            ? this._tt('Все куски видны. Выключите, чтобы условия работали по состоянию игры')
            : this._tt('Видимость по условиям. Включите, чтобы показать все куски');
        all.addEventListener('click', () => {
            this._showAll = !this._showAll;
            this._render();
            this._refreshStatePanel();
            this._refreshList();
        });
        host.appendChild(all);
        if (this._showAll) {
            const note = document.createElement('span');
            note.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
            note.textContent = this._tt('условия отключены');
            host.appendChild(note);
            return;
        }
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
        ids.switches.forEach(id => {
            const b = document.createElement('button');
            b.className = 'agonia-btn';
            const on = !!this._game.switches.get(id);
            b.textContent = 'sw ' + id + (on ? ' ✓' : '');
            b.style.fontWeight = on ? '700' : '400';
            b.addEventListener('click', () => {
                this._game.switches.set(id, !on);
                this._render();
                this._refreshStatePanel();
            });
            host.appendChild(b);
        });
        ids.vars.forEach(id => {
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
        });
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
            vis.style.cssText = 'cursor:default;font-size:12px;width:16px;flex:none;color:var(--color-text-dim);';
            vis.textContent = this._pieceVisible(p) ? '●' : '○';
            vis.title = this._pieceVisible(p) ? this._tt('видим (условие истинно / показывать все)') : this._tt('скрыт (условие ложно)');
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
                this._selectedWindow = null;
                this._refreshAll();
            });
            box.appendChild(row);
        });
    }

    // ------------------------------------------------------------------
    // Inspector (HUD piece OR editable window)
    // ------------------------------------------------------------------

    _refreshInspector() {
        const right = this._dom.right;
        right.innerHTML = '';
        if (this._selectedWindow) {
            this._renderWindowInspector(right);
            return;
        }
        const p = this._pieces[this._selected];
        if (!p) {
            const ph = document.createElement('div');
            ph.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:40px 0;font-size:12px;';
            ph.textContent = this._tt('Выберите кусок или окно на сцене / в списке');
            right.appendChild(ph);
            return;
        }
        const form = new InspectorForm();
        form.head('#' + (p.id || '?') + ' ' + p.type, 'x ' + Math.round(p.x) + ' · y ' + Math.round(p.y) + ' · слой ' + (p.Layer || 0));
        form.section(this._tt('Кусок'));
        const commit = () => { this._persist(); this._render(); this._refreshList(); this._refreshInspector(); this._refreshStatePanel(); };
        form.row(this._tt('Слой'), this._numField(p, 'Layer', commit));
        form.row(this._tt('Условие (JS)'), this._textField(p, 'Condition', commit));
        const imgKey = p.type === 'Image Gauge' ? 'Main Image' : 'Image';
        form.row(this._tt(imgKey), this._textField(p, imgKey, commit));
        if (p.type === 'Image Gauge') {
            form.row(this._tt('Подложка'), this._textField(p, 'Back Image', commit));
            form.row(this._tt('Cur. Value (JS)'), this._textField(p, 'Cur. Value', commit));
            form.row(this._tt('Max Value (JS)'), this._textField(p, 'Max Value', commit));
        }
        if (p.type === 'Image Numbers') {
            form.row(this._tt('Value (JS)'), this._textField(p, 'Value', commit));
        }
        form.row(this._tt('Масштаб X'), this._textField(p, 'Scale X', commit));
        form.row(this._tt('Масштаб Y'), this._textField(p, 'Scale Y', commit));
        form.row(this._tt('Прозрачность'), this._textField(p, 'Opacity', commit));
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
        hint.textContent = this._tt('Куски и окна перетаскиваются мышью прямо на шахматке.');
        right.appendChild(hint);
    }

    _renderWindowInspector(right) {
        const def = this._windowDefs().find(d => d.id === this._selectedWindow);
        if (!def) { this._selectedWindow = null; this._refreshInspector(); return; }
        // S47: tight layout - the 340px panel cannot fit the wide default grid.
        const form = new InspectorForm({ tight: true });
        const r = def.rect();
        form.head(def.label, 'x ' + Math.round(r.x) + ' · y ' + Math.round(r.y));
        form.section(this._tt('Окно'));
        const rerender = () => { this._render(); this._refreshInspector(); };
        const vis = this._invVisual();
        const commit = () => { this._invVisualCommit(vis); rerender(); };
        const zRow = (key) => form.row(this._tt('Слой (z)'), this._numField(vis, key, commit));
        if (def.id === 'craft.slots') {
            const craft = this._craft();
            const ccommit = rerender;
            form.row('Slot 1 X', this._numField(craft, 'Slot 1 X', ccommit));
            form.row('Slot 1 Y', this._numField(craft, 'Slot 1 Y', ccommit));
            form.row(this._tt('Шаг'), this._numField(craft, 'Slot Spacing', ccommit));
            form.row(this._tt('Размер'), this._numField(craft, 'Slot Size', ccommit));
        } else if (def.id === 'inv.bg') {
            form.row('X', this._numField(vis, 'Player Bg X', commit));
            form.row('Y', this._numField(vis, 'Player Bg Y', commit));
            form.row(this._tt('Картинка'), this._textField(vis, 'Player Bg', commit));
            this._appearanceRows(form, vis, commit, true);
        } else if (def.id === 'inv.grid2') {
            form.row('X', this._numField(vis, 'Grid2 X', commit));
            form.row('Y', this._numField(vis, 'Grid2 Y', commit));
            form.row(this._tt('Фон'), this._textField(vis, 'Grid2 Bg', commit));
            form.row(this._tt('Колонок'), this._numField(vis, 'Player Cols', commit));
            form.row(this._tt('Строк'), this._numField(vis, 'Player Rows', commit));
            form.row(this._tt('Шаг'), this._numField(vis, 'Player Spacing', commit));
        } else if (def.id === 'inv.player') {
            form.row('X', this._numField(vis, 'Player X', commit));
            form.row('Y', this._numField(vis, 'Player Y', commit));
            form.row(this._tt('Колонок'), this._numField(vis, 'Player Cols', commit));
            form.row(this._tt('Строк'), this._numField(vis, 'Player Rows', commit));
            form.row(this._tt('Шаг'), this._numField(vis, 'Player Spacing', commit));
            form.row(this._tt('Отступ X'), this._numField(vis, 'Slot Offset X', commit));
            form.row(this._tt('Отступ Y'), this._numField(vis, 'Slot Offset Y', commit));
            zRow('Z Player');
        } else if (def.id === 'inv.chestBg') {
            form.row('X', this._numField(vis, 'Chest Bg X', commit));
            form.row('Y', this._numField(vis, 'Chest Bg Y', commit));
            form.row(this._tt('Картинка'), this._textField(vis, 'Chest Bg', commit));
        } else if (def.id === 'inv.chest') {
            form.row('X', this._numField(vis, 'Chest X', commit));
            form.row('Y', this._numField(vis, 'Chest Y', commit));
            form.row(this._tt('Колонок'), this._numField(vis, 'Chest Cols', commit));
            form.row(this._tt('Строк'), this._numField(vis, 'Chest Rows', commit));
            zRow('Z Chest');
        } else if (def.id === 'inv.hotbar') {
            form.row('Y', this._numField(vis, 'Hotbar Y', commit));
            form.row(this._tt('Шаг'), this._numField(vis, 'Hotbar Spacing', commit));
            form.row(this._tt('Масштаб'), this._numField(vis, 'Hotbar Scale', commit));
            form.row(this._tt('Слой (z)'), this._numField(vis, 'Z Hotbar', commit));
        } else if (def.id === 'inv.custom') {
            form.row('X', this._numField(vis, 'Custom Window X', commit));
            form.row('Y', this._numField(vis, 'Custom Window Y', commit));
            form.row(this._tt('Картинка'), this._textField(vis, 'Custom Window Img', commit));
        }
        form.mount(right);
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);line-height:1.4;padding:6px 2px;';
        hint.textContent = def.lockX
            ? this._tt('Хотбар центрируется по X автоматически — двигается только по вертикали.')
            : this._tt('Перетаскивайте окно мышью на шахматке; стрелки — по пикселю (Shift = 10).');
        right.appendChild(hint);
    }

    /** S47: shared inventory appearance controls - fade speed select+number,
     *  dimmer opacity, hover opacity, over-HUD toggle. */
    _appearanceRows(form, vis, commit, withZ) {
        void withZ;
        form.section(this._tt('Появление'));
        const fadeWrap = document.createElement('div');
        fadeWrap.style.cssText = 'display:flex;gap:6px;align-items:center;flex:1;min-width:0;';
        const sel = document.createElement('select');
        sel.className = 'agonia-select';
        sel.style.flex = '1';
        const presets = [[255, 'Мгновенно'], [60, 'Быстро'], [35, 'Средне'], [15, 'Медленно']];
        for (const [v, l] of presets) {
            const o = document.createElement('option');
            o.value = String(v);
            o.textContent = this._tt(l);
            sel.appendChild(o);
        }
        const cur = Number(vis['Fade Speed']);
        sel.value = presets.some(([v]) => v === cur) ? String(cur) : String(35);
        const num = this._numField(vis, 'Fade Speed', commit);
        num.style.flex = 'none';
        num.style.width = '64px';
        sel.addEventListener('change', () => {
            vis['Fade Speed'] = sel.value;
            num.value = sel.value;
            commit();
        });
        fadeWrap.appendChild(sel);
        fadeWrap.appendChild(num);
        form.row(this._tt('Скорость'), fadeWrap);
        form.row(this._tt('Затемнение'), this._numField(vis, 'Dimmer Opacity', commit));
        form.row(this._tt('Наведение'), this._numField(vis, 'Hover Opacity', commit));
        const overWrap = document.createElement('div');
        overWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.style.cursor = 'pointer';
        box.checked = String(vis['Inventory Over HUD']) === 'true';
        box.addEventListener('change', () => {
            vis['Inventory Over HUD'] = box.checked ? 'true' : 'false';
            commit();
        });
        overWrap.appendChild(box);
        form.row(this._tt('Инвентарь над HUD'), overWrap);
    }

    _numField(obj, key, commit) {
        const i = document.createElement('input');
        i.type = 'number';
        i.className = 'agonia-input';
        i.style.flex = 'none';
        i.style.width = '84px';
        const cur = Number(obj[key]);
        i.value = Number.isFinite(cur) ? cur : 0;
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
    // Stage rendering + interaction
    // ------------------------------------------------------------------

    _sorted() {
        return this._pieces
            .map((p, i) => [p, i])
            .sort((a, b) => (Number(a[0].Layer) || 0) - (Number(b[0].Layer) || 0));
    }

    _render() {
        if (!this._ctx) return;
        // windows layer
        if (this._winCtx) {
            this._winCtx.clearRect(0, 0, this._screen.w, this._screen.h);
            this._windowDefsCache = this._windowDefs();
            for (const def of this._windowDefsCache) {
                try { def.draw(this._winCtx); } catch (e) { /* keep editor alive */ }
            }
        }
        // HUD pieces layer
        const ctx = this._ctx;
        ctx.clearRect(0, 0, this._screen.w, this._screen.h);
        ctx.imageSmoothingEnabled = false;
        for (const [p] of this._sorted()) {
            if (!this._pieceVisible(p)) continue;
            try { this._drawPiece(ctx, p); } catch (e) { /* keep editor alive */ }
        }
        this._drawSelection();
    }

    _drawSelection() {
        const box = this._dom.selBox;
        if (this._selectedWindow) { box.style.display = 'none'; return; }
        const p = this._pieces[this._selected];
        if (!p) { box.style.display = 'none'; return; }
        const r = this._pieceRect(p);
        if (!r) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.style.left = (r.x - 2) + 'px';
        box.style.top = (r.y - 2) + 'px';
        box.style.width = (r.w + 4) + 'px';
        box.style.height = (r.h + 4) + 'px';
    }

    _pieceRect(p) {
        const sx = Number(p['Scale X']) || 1;
        const sy = Number(p['Scale Y']) || 1;
        if (p.type === 'Picture') {
            const img = this._hudImg('Picture', p.Image);
            if (img && img.naturalWidth) {
                const w = img.naturalWidth * sx, h = img.naturalHeight * sy;
                return { x: p.x - w / 2, y: p.y - h / 2, w, h };
            }
            const w = 96, h = 96;
            return { x: p.x - w / 2, y: p.y - h / 2, w, h };
        }
        if (p.type === 'Image Numbers') {
            const img = this._hudImg('Image Numbers', p.Image);
            const val = this._evalExpr(p.Value, 0);
            const len = Math.max(1, String(Math.round(Number(val) || 0)).length);
            const w0 = img && img.naturalWidth ? img.naturalWidth / 10 : 24;
            const h0 = img && img.naturalHeight ? img.naturalHeight : 32;
            const w = w0 * len * sx, h = h0 * sy;
            return { x: p.x - w / 2, y: p.y - h / 2, w, h };
        }
        if (p.type === 'Image Gauge') {
            const back = this._hudImg('Image Gauge', p['Back Image'], 'back');
            const main = this._hudImg('Image Gauge', p['Main Image'], 'main');
            const bw = back && back.naturalWidth ? back.naturalWidth : (main && main.naturalWidth ? main.naturalWidth : 200);
            const bh = back && back.naturalHeight ? back.naturalHeight : (main && main.naturalHeight ? main.naturalHeight : 24);
            const w = bw * sx, h = bh * sy;
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
            const img = this._hudImg('Picture', p.Image);
            if (img && img.naturalWidth) {
                const w = img.naturalWidth * sx, h = img.naturalHeight * sy;
                ctx.drawImage(img, p.x - w / 2, p.y - h / 2, w, h);
            } else {
                this._drawPlaceholder(ctx, p.x - 48, p.y - 48, 96, 96, p.Image);
            }
        } else if (p.type === 'Image Numbers') {
            const img = this._hudImg('Image Numbers', p.Image);
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
                    this._drawPlaceholder(cx, p.y - (h0 * sy) / 2, w0 * sx, h0 * sy, p.Image + ':' + ch);
                }
                cx += w0 * sx;
            }
        } else if (p.type === 'Image Gauge') {
            const back = this._hudImg('Image Gauge', p['Back Image'], 'back');
            const main = this._hudImg('Image Gauge', p['Main Image'], 'main');
            const cur = Number(this._evalExpr(p['Cur. Value'], 1)) || 0;
            const max = Number(this._evalExpr(p['Max Value'], 1)) || 1;
            const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : cur / max));
            const w = (back && back.naturalWidth ? back.naturalWidth : 200) * sx;
            const h = (back && back.naturalHeight ? back.naturalHeight : 24) * sy;
            const x0 = p.x - w / 2, y0 = p.y - h / 2;
            if (back && back.naturalWidth) {
                ctx.drawImage(back, x0, y0, w, h);
            } else {
                this._drawPlaceholder(x0, y0, w, h, p['Back Image']);
            }
            if (main && main.naturalWidth) {
                const style = String(p.Style || p.Direction || 'left');
                if (style === 'up' || style === 'down') {
                    const fh = h * ratio;
                    const fy = style === 'up' ? y0 + (h - fh) : y0;
                    ctx.drawImage(main,
                        0, main.naturalHeight * (1 - ratio), main.naturalWidth, main.naturalHeight * ratio,
                        x0, fy, w, fh);
                } else {
                    const fw = w * ratio;
                    const fx = style === 'right' ? x0 + (w - fw) : x0;
                    ctx.drawImage(main, fx, y0, fw, h);
                }
            }
        }
        ctx.restore();
    }

    _drawPlaceholder(x, y, w, h, label) {
        const ctx = this._ctx;
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

    /** Test/programmatic hook: move a window anchor to a new TOP-LEFT. */
    dragWindow(id, x, y) {
        const def = this._windowDefs().find(d => d.id === id);
        if (!def) return false;
        const r = def.rect();
        def.apply(def.lockX ? r.x : x, y);
        this._render();
        return true;
    }

    _bindStage() {
        const stage = this._dom.stage;
        const canvas = this._dom.canvas;
        let drag = null; // {kind:'piece'|'window', ...}
        const toStage = e => {
            const r = canvas.getBoundingClientRect();
            const kx = this._screen.w / (r.width || this._screen.w);
            const ky = this._screen.h / (r.height || this._screen.h);
            return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
        };
        const pickPiece = pt => {
            const sorted = this._sorted().reverse();
            for (const [p, i] of sorted) {
                if (!this._pieceVisible(p)) continue;
                const r = this._pieceRect(p);
                if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return { p, i };
            }
            return null;
        };
        const pickWindow = pt => {
            // topmost drawn last -> iterate reversed
            const defs = this._windowDefs().reverse();
            for (const def of defs) {
                const r = def.rect();
                if (r && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return def;
            }
            return null;
        };
        stage.addEventListener('mousedown', e => {
            const pt = toStage(e);
            const hit = pickPiece(pt);
            if (hit) {
                this._selected = hit.i;
                this._selectedWindow = null;
                drag = { kind: 'piece', idx: hit.i, dx: pt.x - hit.p.x, dy: pt.y - hit.p.y, moved: false };
            } else {
                const win = pickWindow(pt);
                if (win) {
                    this._selectedWindow = win.id;
                    this._selected = -1;
                    const r = win.rect();
                    drag = { kind: 'window', def: win, dx: pt.x - r.x, dy: pt.y - r.y, moved: false };
                } else {
                    this._selected = -1;
                    this._selectedWindow = null;
                }
            }
            this._refreshList();
            this._refreshInspector();
            this._render();
            e.preventDefault();
        });
        window.addEventListener('mousemove', e => {
            if (!drag) return;
            const pt = toStage(e);
            if (drag.kind === 'piece') {
                const p = this._pieces[drag.idx];
                if (!p) { drag = null; return; }
                p.x = Math.round(pt.x - drag.dx);
                p.y = Math.round(pt.y - drag.dy);
                // S44: snap the piece center/edges to other objects + stage center
                const r = this._pieceRect(p);
                const adj = this._snapAdjust(r, drag.idx, null);
                p.x += adj.dx;
                p.y += adj.dy;
                this._showSnapGuides(adj.guideX, adj.guideY);
            } else {
                const r = drag.def.rect();
                let x = drag.def.lockX ? r.x : (pt.x - drag.dx);
                let y = pt.y - drag.dy;
                if (!drag.def.lockX) {
                    const adj = this._snapAdjust({ x, y, w: r.w, h: r.h }, null, drag.def.id);
                    x += adj.dx;
                    y += adj.dy;
                    this._showSnapGuides(adj.guideX, adj.guideY);
                }
                drag.def.apply(x, y); // apply() takes the desired TOP-LEFT
            }
            drag.moved = true;
            this._render();
        });
        window.addEventListener('mouseup', () => {
            this._showSnapGuides(null, null);
            if (drag && drag.moved) {
                if (drag.kind === 'piece') this._persist();
                this._refreshInspector();
            }
            drag = null;
        });
        // S46: arrow keys nudge the selected piece/window by 1px
        // (Shift+Arrow - 10px); persists after the press.
        window.addEventListener('keydown', e => {
            if (!this._dom || !this._dom.stage) return;
            if (!document.getElementById || document.activeElement === null) { /* keep */ }
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            if (!(e.key in map)) return;
            const step = e.shiftKey ? 10 : 1;
            const [dx, dy] = map[e.key];
            if (this._selectedWindow) {
                const def = this._windowDefs().find(d => d.id === this._selectedWindow);
                if (!def) return;
                const r = def.rect();
                def.apply(def.lockX ? r.x : r.x + dx * step, r.y + dy * step);
                this._render();
                this._refreshInspector();
            } else if (this._selected >= 0 && this._pieces[this._selected]) {
                const p = this._pieces[this._selected];
                p.x += dx * step;
                p.y += dy * step;
                this._persist();
                this._render();
                this._refreshInspector();
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        });
    }

    /**
     * S44: HUDMaker-style snap. Candidates (stage coords): stage center
     * and the left/center/right + top/center/bottom edges of every other
     * piece and window. Threshold 12px. Returns {dx, dy, guideX, guideY}.
     */
    _snapAdjust(r, skipPieceIdx, skipWindowId) {
        const THRESH = 12;
        const xs = [this._screen.w / 2];
        const ys = [this._screen.h / 2];
        const addRect = (o) => {
            xs.push(o.x, o.x + o.w / 2, o.x + o.w);
            ys.push(o.y, o.y + o.h / 2, o.y + o.h);
        };
        this._pieces.forEach((p, i) => {
            if (i === skipPieceIdx || !this._pieceVisible(p)) return;
            const pr = this._pieceRect(p);
            if (pr) addRect(pr);
        });
        for (const def of this._windowDefs()) {
            if (def.id === skipWindowId) continue;
            addRect(def.rect());
        }
        const near = (a, list) => {
            let best = null;
            for (const v of list) {
                const d = v - a;
                if (Math.abs(d) <= THRESH && (best === null || Math.abs(d) < Math.abs(best.d))) best = { d, v };
            }
            return best;
        };
        const res = { dx: 0, dy: 0, guideX: null, guideY: null };
        const bestX = near(r.x + r.w / 2, xs) || near(r.x, xs) || near(r.x + r.w, xs);
        if (bestX) { res.dx = bestX.d; res.guideX = bestX.v; }
        const bestY = near(r.y + r.h / 2, ys) || near(r.y, ys) || near(r.y + r.h, ys);
        if (bestY) { res.dy = bestY.d; res.guideY = bestY.v; }
        return res;
    }

    /** Red full-screen guide lines during an active snap (S44). */
    _showSnapGuides(guideX, guideY) {
        const v = this._dom.snapV;
        const h = this._dom.snapH;
        if (guideX !== null && guideX !== undefined) {
            v.style.display = 'block';
            v.style.left = Math.round(guideX) + 'px';
        } else {
            v.style.display = 'none';
        }
        if (guideY !== null && guideY !== undefined) {
            h.style.display = 'block';
            h.style.top = Math.round(guideY) + 'px';
        } else {
            h.style.display = 'none';
        }
    }

    _refreshAll() {
        this._refreshStatePanel();
        this._refreshList();
        this._refreshInspector();
        this._render();
        this._applyScale();
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseHUDEditor = DatabaseHUDEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseHUDEditor;
}
