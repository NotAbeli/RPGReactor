/**
 * DatabaseSpriterEditor - Full editor for the SuperDuperSpriter subsystem,
 * rendered as its own "Spriter" database tab (right below Actors).
 *
 * Data lives in the Agonia sidecar section `spriter` (data/AgoniaEngine.json)
 * and merges into the live plugin parameters through the MV bridge's
 * applyAgoniaConfig (transitional mode, same as camera/inventory before
 * retirement).
 *
 * The three mapping collections are stored in MV plugin format: a string
 * holding a JSON array whose items are themselves JSON-object strings
 * ('["{\"Name\":...}"]'). The plugin's safeParseArray expects exactly that,
 * so this editor encodes/decodes on the boundary (decodeCollections /
 * encodeCollections) instead of using natural JSON arrays.
 *
 * Entry shape mirrors the plugin's own parse result:
 *   SpriteMappings items: { Name, Priority, Conditions:{MainValue,
 *     SwitchId1..3, ExtVarId, ExtVarOp, ExtVarVal},
 *     Visuals:{CharacterName, CharacterIndex, Frames, Directions, StepMode,
 *     Width, Height, FPS, Pattern, IdleIndex, IdleAnimSpeed,
 *     AnimationIndices, AnimationDelay} }
 *   PoseMappings items: same Conditions; Visuals:{CharacterName, GridX,
 *     GridY, Width, Height}
 *   NPCMappings items: { IdName, Visuals:{CharacterName, Frames,
 *     Directions, StepMode, Width, Height, FPS, Pattern, IdleIndex,
 *     IdleAnimSpeed} }
 */
class DatabaseSpriterEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;

        this.collectionKeys = [
            { key: 'SpriteMappings', label: 'Скины героя', hint: 'Правила смены внешности главного героя по переменной/свитчам' },
            { key: 'PoseMappings', label: 'Позы героя', hint: 'Статичные позы (рывки/действия) — перекрывают скины, когда активны' },
            { key: 'NPCMappings', label: 'Библиотека NPC', hint: 'Пресеты для событий: тег <sds:Имя> в Note события' }
        ];

        this._players = [];
        this._masterTimer = null;
        this._playerGeneration = 0;
    }

    _tt(text) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(text) : text;
    }

    _projectPath() {
        const project = this.projectManager && this.projectManager.getCurrentProject
            ? this.projectManager.getCurrentProject()
            : (this.projectManager && this.projectManager.currentProject);
        return project ? project.path : null;
    }

    // ------------------------------------------------------------------
    // Data access
    // ------------------------------------------------------------------

    getSpriter() {
        const data = this.databaseManager.data;
        if (!data.agonia) data.agonia = DatabaseManager.agoniaDefaults();
        if (!data.agonia.spriter) data.agonia.spriter = DatabaseManager.agoniaDefaults().spriter;
        return data.agonia.spriter;
    }

    /**
     * Decode the MV-encoded collection string into a plain entry array.
     * Each item is a JSON-object string; its Conditions/Visuals fields are
     * themselves JSON strings in the plugin format (the plugin reads them
     * with safeParse), so they are parsed here for editing.
     */
    static decodeCollection(raw) {
        let arr = [];
        try {
            const parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) arr = parsed;
        } catch (e) { /* fall through */ }
        const parseNested = v => {
            if (typeof v === 'string') {
                try { return JSON.parse(v); } catch (e) { return {}; }
            }
            return (v && typeof v === 'object') ? v : {};
        };
        return arr.map(item => {
            let entry;
            try {
                entry = typeof item === 'string' ? JSON.parse(item) : (item || {});
            } catch (e) {
                entry = {};
            }
            if (entry.Conditions !== undefined) entry.Conditions = parseNested(entry.Conditions);
            if (entry.Visuals !== undefined) entry.Visuals = parseNested(entry.Visuals);
            return entry;
        });
    }

    /**
     * Encode a plain entry array back into the MV plugin string format:
     * Conditions/Visuals become JSON strings again (the plugin's safeParse
     * would return {} for plain objects, losing all conditions).
     */
    static encodeCollection(entries) {
        return JSON.stringify((entries || []).map(entry => {
            const out = {};
            for (const key of Object.keys(entry || {})) {
                const v = entry[key];
                if ((key === 'Conditions' || key === 'Visuals') && v && typeof v === 'object') {
                    out[key] = JSON.stringify(v);
                } else {
                    out[key] = v;
                }
            }
            return JSON.stringify(out);
        }));
    }

    // ------------------------------------------------------------------
    // Entry defaults
    // ------------------------------------------------------------------

    static blankEntry(kind) {
        if (kind === 'PoseMappings') {
            return {
                Name: 'Поза',
                Priority: 0,
                Conditions: { MainValue: 0, SwitchId1: 0, SwitchId2: 0, SwitchId3: 0, ExtVarId: 0, ExtVarOp: 'equal', ExtVarVal: 0 },
                Visuals: { CharacterName: '', GridX: 0, GridY: 0, Width: 48, Height: 48 }
            };
        }
        if (kind === 'NPCMappings') {
            return {
                IdName: 'NPC1',
                Visuals: {
                    CharacterName: '', Frames: 3, Directions: 4, StepMode: 0,
                    Width: 0, Height: 0, FPS: 0, Pattern: 0, IdleIndex: -1, IdleAnimSpeed: 0
                }
            };
        }
        return {
            Name: 'Скин',
            Priority: 0,
            Conditions: { MainValue: 0, SwitchId1: 0, SwitchId2: 0, SwitchId3: 0, ExtVarId: 0, ExtVarOp: 'equal', ExtVarVal: 0 },
            Visuals: {
                CharacterName: '', CharacterIndex: 0, Frames: 3, Directions: 4,
                StepMode: 0, Width: 0, Height: 0, FPS: 0, Pattern: 0,
                IdleIndex: -1, IdleAnimSpeed: 0, AnimationIndices: '', AnimationDelay: 3
            }
        };
    }

    // ------------------------------------------------------------------
    // Layout helpers
    // ------------------------------------------------------------------

    _sectionTitle(text) {
        const el = document.createElement('div');
        el.className = 'agonia-section-header';
        el.style.cssText = 'padding:12px 8px 4px;';
        el.textContent = this._tt(text);
        return el;
    }

    _panel() {
        const el = document.createElement('div');
        el.className = 'agonia-section';
        return el;
    }

    _fieldLabel(text, hint) {
        const wrap = document.createElement('div');
        wrap.className = 'agonia-field';
        const label = document.createElement('label');
        label.title = this._tt(text);
        label.textContent = this._tt(text);
        wrap.appendChild(label);
        if (hint) {
            const h = document.createElement('div');
            h.className = 'agonia-hint';
            h.textContent = hint;
            wrap.appendChild(h);
        }
        return wrap;
    }

    _numberField(value, opts = {}, onChange) {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value === undefined || value === null || value === '' ? (opts.default !== undefined ? opts.default : 0) : value;
        if (opts.min !== undefined) input.min = opts.min;
        if (opts.max !== undefined) input.max = opts.max;
        if (opts.step !== undefined) input.step = opts.step;
        input.className = 'agonia-input';
        input.addEventListener('input', () => {
            const n = Number(input.value);
            if (!Number.isNaN(n)) onChange(n);
        });
        return input;
    }

    _textField(value, opts = {}, onChange) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value === undefined || value === null ? '' : String(value);
        if (opts.placeholder) input.placeholder = opts.placeholder;
        input.className = 'agonia-input';
        input.addEventListener('input', () => onChange(input.value));
        return input;
    }

    _selectField(value, options, onChange) {
        const select = document.createElement('select');
        select.className = 'agonia-select';
        for (const opt of options) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = this._tt(opt.label);
            select.appendChild(o);
        }
        select.value = String(value);
        select.addEventListener('change', () => onChange(select.value));
        return select;
    }

    _checkboxField(value, onChange) {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-text);cursor:pointer;';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = !!value;
        box.addEventListener('change', () => onChange(box.checked));
        label.appendChild(box);
        label.appendChild(document.createTextNode(this._tt('Включено')));
        return label;
    }

    _smallButton(text, onClick, kind = '') {
        const btn = document.createElement('button');
        btn.textContent = this._tt(text);
        btn.className = 'agonia-btn' + (kind === 'danger' ? ' danger' : '');
        btn.addEventListener('click', onClick);
        return btn;
    }

    // ------------------------------------------------------------------
    // Main view
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // S29: the Спрайтер tab drives the classic list panel itself; this
    // editor exposes hero/globals renderers plus a classicApi() per
    // collection. showSpriterTab(mode) in DatabaseEditorUI owns the
    // 5-button mode bar (Герой/Скины/Позы/NPC/Глобальные).
    // ------------------------------------------------------------------

    /**
     * S30: the collection view - a grid of live animated preview cards
     * (mini players) with the selected entry's form on the right. Order
     * matters (conditions match top-down), so the form head carries
     * ▲▼ reorder buttons plus ⧉ duplicate and ✕ delete.
     */
    renderCollectionGrid(host, kind) {
        const K = DatabaseSpriterEditor;
        const spriter = this.getSpriter();
        let entries = K.decodeCollection(spriter[kind]);
        const persist = () => { spriter[kind] = K.encodeCollection(entries); };
        // S35: per-kind selection memory - reopening the section restores
        // the last selected card, else the first.
        this._gridSelMemory = this._gridSelMemory || {};
        const remember = v => { this._gridSelMemory[kind] = v; };
        let selected;
        {
            const mem = this._gridSelMemory[kind];
            selected = (Number.isInteger(mem) && mem >= 0 && entries[mem]) ? mem
                : (entries.length ? 0 : -1);
        }

        host.innerHTML = '';
        const root = document.createElement('div');
        root.style.cssText = 'display:flex;gap:0;height:100%;min-height:0;align-items:stretch;';
        host.appendChild(root);

        // --- Left: toolbar + live card grid ---
        const left = document.createElement('div');
        left.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;';
        root.appendChild(left);

        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--color-border);';
        const count = document.createElement('span');
        count.style.cssText = 'font-size:12px;color:var(--color-text-dim);';
        bar.appendChild(count);
        bar.appendChild((() => { const s = document.createElement('div'); s.style.flex = '1'; return s; })());
        const add = document.createElement('button');
        add.className = 'agonia-btn';
        add.textContent = this._tt('+ Новый');
        add.addEventListener('click', () => {
            entries.push(K.blankEntry(kind));
            persist();
            selected = entries.length - 1;
            remember(selected);
            rebuild();
        });
        bar.appendChild(add);
        left.appendChild(bar);

        const gridScroll = document.createElement('div');
        gridScroll.style.cssText = 'flex:1;overflow-y:auto;padding:12px;';
        left.appendChild(gridScroll);

        // --- Right: the selected entry form ---
        const right = document.createElement('div');
        right.style.cssText = 'flex:0 0 460px;border-left:1px solid var(--color-border);display:flex;flex-direction:column;min-height:0;';
        root.appendChild(right);

        let gridRef = null; // the live card grid (for onMeta label refresh)

        const renderForm = () => {
            // Kill only the previous FORM players; grid cards keep living.
            this._players = (this._players || []).filter(p => p._tag !== 'spriterForm');
            right.innerHTML = '';
            const entry = entries[selected];
            if (!entry) {
                const ph = document.createElement('div');
                ph.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:60px 12px;font-size:12px;';
                ph.textContent = this._tt('Записей нет — нажмите «+ Новый»');
                right.appendChild(ph);
                return;
            }
            // S36: no header row - the card grid above already shows the
            // number/name; move/duplicate/delete live on the card's ПКМ.
            const formScroll = document.createElement('div');
            formScroll.style.cssText = 'flex:1;overflow-y:auto;padding:12px;';
            right.appendChild(formScroll);
            try {
                this._renderEntryDetail(formScroll, entry, selected, kind, persist, () => {
                    // live-refresh the selected card's caption (name/summary)
                    const card = gridRef && gridRef.children[selected];
                    if (card) {
                        if (card._labelEl) card._labelEl.textContent = (selected + 1) + '. ' + this._entryHeadline(entry, kind);
                        if (card._subEl) card._subEl.textContent = kind === 'NPCMappings'
                            ? ('<sds:' + (entry.IdName || '') + '>')
                            : this._condSummary(entry);
                    }
                });
            } catch (e) {
                formScroll.appendChild(this._errorBanner(e));
            }
        };

        const rebuild = () => {
            // Full rebuild: stops every player, grid re-registers theirs,
            // then the form adds its own (tagged) one.
            this._playerStop();
            count.textContent = entries.length + ' ' + this._tt(this._kindCountLabel(kind));
            gridScroll.innerHTML = '';
            if (!entries.length) {
                const empty = document.createElement('div');
                empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:40px 0;font-size:12px;';
                empty.textContent = this._tt('Записей нет — нажмите «+ Новый»');
                gridScroll.appendChild(empty);
            }
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;';
            gridRef = grid;
            entries.forEach((entry, idx) => {
                const card = document.createElement('div');
                card.style.cssText = `
                    border:2px solid ${idx === selected ? 'var(--color-accent-border-mid)' : 'var(--color-border)'};
                    border-radius:6px;padding:8px;cursor:pointer;text-align:center;
                    background-color:var(--color-bg-panel);
                    display:flex;flex-direction:column;gap:6px;
                `;
                try {
                    card.appendChild(this._renderPlayer(entry, kind, { mini: true }));
                } catch (e) { /* card stays without preview */ }
                const nm = document.createElement('div');
                nm.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                nm.textContent = (idx + 1) + '. ' + this._entryHeadline(entry, kind);
                card.appendChild(nm);
                const sub = document.createElement('div');
                sub.style.cssText = 'font-size:10px;color:var(--color-text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                sub.textContent = kind === 'NPCMappings'
                    ? ('<sds:' + (entry.IdName || '') + '>')
                    : this._condSummary(entry);
                card.appendChild(sub);
                card._labelEl = nm;
                card._subEl = sub;
                card.addEventListener('click', () => {
                    if (selected === idx) return;
                    selected = idx;
                    remember(idx);
                    // refresh card borders without re-creating players
                    grid.querySelectorAll(':scope > div').forEach((c, i) => {
                        c.style.borderColor = i === selected ? 'var(--color-accent-border-mid)' : 'var(--color-border)';
                    });
                    renderForm();
                });
                // S36: card tools moved from the form header to ПКМ.
                card.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    if (selected !== idx) {
                        selected = idx;
                        remember(idx);
                        grid.querySelectorAll(':scope > div').forEach((c, i) => {
                            c.style.borderColor = i === selected ? 'var(--color-accent-border-mid)' : 'var(--color-border)';
                        });
                        renderForm();
                    }
                    this._cardContextMenu(e.clientX, e.clientY, [
                        {
                            label: '▲ Выше', disabled: selected <= 0, fn: () => {
                                [entries[selected - 1], entries[selected]] = [entries[selected], entries[selected - 1]];
                                selected--;
                                remember(selected);
                                persist();
                                rebuild();
                            }
                        },
                        {
                            label: '▼ Ниже', disabled: selected >= entries.length - 1, fn: () => {
                                [entries[selected + 1], entries[selected]] = [entries[selected], entries[selected + 1]];
                                selected++;
                                remember(selected);
                                persist();
                                rebuild();
                            }
                        },
                        {
                            label: '⧉ Дублировать', fn: () => {
                                entries.splice(selected + 1, 0, JSON.parse(JSON.stringify(entries[selected])));
                                selected++;
                                remember(selected);
                                persist();
                                rebuild();
                            }
                        },
                        {
                            label: '✕ Удалить', danger: true, fn: () => {
                                if (!confirm(this._tt('Удалить запись?') + ' ' + this._entryHeadline(entries[selected], kind))) return;
                                entries.splice(selected, 1);
                                selected = Math.min(selected, entries.length - 1);
                                remember(selected);
                                persist();
                                rebuild();
                            }
                        }
                    ]);
                });
                grid.appendChild(card);
            });
            gridScroll.appendChild(grid);
            renderForm();
        };

        rebuild();
    }

    _kindCountLabel(kind) {
        if (kind === 'PoseMappings') return 'поз';
        if (kind === 'NPCMappings') return 'NPC';
        return 'скинов';
    }

    /** S36: card ПКМ menu - items: {label, disabled?, danger?, fn}. */
    _cardContextMenu(x, y, items) {
        const existing = document.getElementById('sds-card-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.id = 'sds-card-menu';
        menu.style.cssText = `
            position: fixed; left: ${x}px; top: ${y}px;
            background-color: var(--color-bg-menubar);
            border: 1px solid var(--color-border); border-radius: 4px;
            padding: 4px 0; z-index: 21001; min-width: 150px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        `;
        for (const item of items) {
            const row = document.createElement('div');
            row.textContent = this._tt(item.label);
            row.style.cssText = `
                padding: 7px 16px; font-size: 12px;
                cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                color: ${item.disabled ? 'var(--color-text-dim)'
                    : item.danger ? 'var(--color-danger, #b55)' : 'var(--color-text-strong)'};
            `;
            if (!item.disabled) {
                row.addEventListener('mouseenter', () => { row.style.background = 'var(--color-border)'; });
                row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
                row.addEventListener('click', () => {
                    menu.remove();
                    item.fn();
                });
            }
            menu.appendChild(row);
        }
        document.body.appendChild(menu);
        const close = () => { menu.remove(); document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 0);
    }

    /** One-entry detail form (S34): превью → файл → Название+Приоритет →
     *  ▸ Продвинутая анимация → ▸ Условия. Nothing renders above the
     *  preview; the preview panel is as wide as every other block.
     *  onMeta() re-renders the hosting grid card/header. */
    _renderEntryDetail(wrapper, entry, idx, kind, commit, onMeta) {
        const changed = () => commit();
        const retune = () => { if (onMeta) onMeta(); };

        // --- Preview (framed panel, full column width like every block) ---
        try {
            wrapper.appendChild(this._renderPlayer(entry, kind));
        } catch (e) { /* preview is optional */ }

        // --- File / sheet right under the preview ---
        if (kind === 'PoseMappings') {
            this._renderPoseVisuals(wrapper, entry, changed);
        } else {
            this._renderSpriteVisuals(wrapper, entry, kind, changed);
        }

        // --- Название + Приоритет ---
        const nf = new InspectorForm();
        if (kind === 'NPCMappings') {
            nf.row(this._tt('ID Название (тег)'), this._npcTagLine(entry, () => { changed(); retune(); }), this._tt('Писать в Note события: <sds:ЭтоИмя>'));
        } else {
            nf.row(this._tt('Название'), this._textField(entry.Name, {}, v => { entry.Name = v; changed(); retune(); }));
            nf.row(this._tt('Приоритет'),
                this._numberField(entry.Priority, { min: 0 }, v => { entry.Priority = v; changed(); }),
                this._tt('При равных условиях побеждает запись с большим приоритетом'));
        }
        nf.mount(wrapper);

        // --- ▸ Продвинутая анимация (skins/NPC; poses have none) ---
        if (kind !== 'PoseMappings') {
            wrapper.appendChild(this._renderAdvancedAnimation(entry, kind));
        }

        // --- ▸ Условия (collapsed, live summary in the caption) ---
        if (kind !== 'NPCMappings') {
            const cond = this._ensure(entry, 'Conditions', {});
            const det = document.createElement('details');
            det.style.cssText = 'margin-top:8px;border:1px solid var(--color-border);border-radius:4px;background-color:var(--color-bg-panel);padding:0 10px;';
            det.open = false;
            const sum = document.createElement('summary');
            sum.style.cssText = 'padding:8px 0;font-size:13px;font-weight:bold;color:var(--color-text-strong);cursor:pointer;user-select:none;';
            const refreshSum = () => {
                sum.textContent = '▸ Условия · ' + this._condSummary(entry);
            };
            refreshSum();

            const body = document.createElement('div');
            body.style.cssText = 'padding:0 0 10px;';
            const cf = new InspectorForm();
            cf.row(this._tt('Значение основной переменной'),
                this._numberField(cond.MainValue, { min: -1 }, v => { cond.MainValue = v; changed(); refreshSum(); retune(); }),
                this._tt('−1 = базовый скин/поза для всех неперехваченных значений'));
            cf.mount(body);
            body.appendChild(this._checksConstructor(cond, () => { changed(); refreshSum(); retune(); }));

            det.appendChild(sum);
            det.appendChild(body);
            wrapper.appendChild(det);
        }
    }

    /** S32: uniform checks list - [{type:'switch',id} | {type:'var',id,op,val}]
     *  Legacy SwitchId1..3/ExtVarId fields migrate in on read. */
    _condChecks(cond) {
        let checks = [];
        if (Array.isArray(cond.Checks)) {
            checks = cond.Checks.filter(c => c && (c.type === 'switch' || c.type === 'var'));
        } else if (typeof cond.Checks === 'string' && cond.Checks.trim()) {
            try { checks = (JSON.parse(cond.Checks) || []).filter(c => c && (c.type === 'switch' || c.type === 'var')); }
            catch (e) { checks = []; }
        }
        // legacy migrate (once the editor writes Checks, legacy slots clear)
        for (let s = 1; s <= 3; s++) {
            const id = Number(cond['SwitchId' + s] || 0);
            if (id > 0) { checks.push({ type: 'switch', id }); delete cond['SwitchId' + s]; }
        }
        const ev = Number(cond.ExtVarId || 0);
        if (ev > 0) {
            checks.push({ type: 'var', id: ev, op: String(cond.ExtVarOp || 'equal'), val: Number(cond.ExtVarVal || 0) });
            delete cond.ExtVarId; delete cond.ExtVarOp; delete cond.ExtVarVal;
        }
        cond.Checks = checks;
        return checks;
    }

    /** Rows of checks + "+ Условие". Every row: type · id · op · val · ✕. */
    _checksConstructor(cond, onChange) {
        const K = this;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin:2px 0 8px;';

        const rebuild = () => {
            wrap.innerHTML = '';
            const checks = K._condChecks(cond);
            for (const c of checks) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 0;';
                const typeSel = K._selectField(c.type, [
                    { value: 'switch', label: 'Свитч ВКЛ' },
                    { value: 'var', label: 'Переменная' }
                ], v => { c.type = v; if (v === 'switch') delete c.op; else { c.op = c.op || 'equal'; c.val = c.val || 0; } cond.Checks = checks; onChange(); rebuild(); });
                typeSel.style.flex = '0 0 130px';
                row.appendChild(typeSel);
                const idInp = K._numberField(c.id, { min: 1 }, v => { c.id = v; cond.Checks = checks; onChange(); });
                idInp.style.flex = '0 0 76px';
                row.appendChild(idInp);
                if (c.type === 'var') {
                    const opSel = K._selectField(c.op || 'equal', [
                        { value: 'equal', label: '=' }, { value: 'greater', label: '>' },
                        { value: 'less', label: '<' }, { value: 'notEqual', label: '≠' }
                    ], v => { c.op = v; cond.Checks = checks; onChange(); });
                    opSel.style.flex = '0 0 60px';
                    row.appendChild(opSel);
                    const valInp = K._numberField(c.val, {}, v => { c.val = v; cond.Checks = checks; onChange(); });
                    valInp.style.flex = '0 0 84px';
                    row.appendChild(valInp);
                }
                const del = document.createElement('button');
                del.className = 'agonia-btn danger';
                del.textContent = '✕';
                del.title = 'Удалить условие';
                del.addEventListener('click', () => {
                    const i = checks.indexOf(c);
                    if (i >= 0) checks.splice(i, 1);
                    cond.Checks = checks;
                    onChange();
                    rebuild();
                });
                row.appendChild(del);
                wrap.appendChild(row);
            }
            const add = document.createElement('button');
            add.className = 'agonia-btn';
            add.textContent = K._tt('+ Условие');
            add.title = 'Новая проверка (И)';
            add.addEventListener('click', () => {
                checks.push({ type: 'switch', id: 1 });
                cond.Checks = checks;
                onChange();
                rebuild();
            });
            wrap.appendChild(add);
        };
        rebuild();
        return wrap;
    }

    _condSummary(entry) {
        const cond = entry.Conditions;
        if (!cond) return '';
        const parts = [];
        parts.push(cond.MainValue === -1 ? 'базовый (−1)' : 'var=' + cond.MainValue);
        const checks = this._condChecks ? this._condChecks(cond) : (cond.Checks || []);
        for (const c of checks) {
            if (c.type === 'switch') parts.push('sw' + c.id);
            else parts.push('var' + c.id + this._opLabel(c.op) + c.val);
        }
        return parts.join(' · ');
    }

    _entryHeadline(entry, kind) {
        if (kind === 'NPCMappings') return entry.IdName || 'NPC';
        return entry.Name || (kind === 'PoseMappings' ? 'Поза' : 'Скин');
    }

    /** Red error banner instead of a silently empty tab. */
    _errorBanner(e) {
        const box = document.createElement('div');
        box.style.cssText = 'margin:12px 0;padding:10px 14px;border:1px solid var(--color-danger,#b33);border-radius:4px;color:var(--color-text-strong);background:rgba(179,51,51,.12);font-size:12px;line-height:1.5;';
        const t = document.createElement('div');
        t.style.fontWeight = '700';
        t.textContent = this._tt('Ошибка отрисовки вкладки:');
        box.appendChild(t);
        const d = document.createElement('div');
        d.style.cssText = 'font-family:var(--font-mono,monospace);white-space:pre-wrap;color:var(--color-text-dim);';
        d.textContent = (e && e.stack || String(e)).split('\n').slice(0, 4).join('\n');
        box.appendChild(d);
        return box;
    }

    _renderGlobals(content, spriter) {
        content.innerHTML = '';
        const f = new InspectorForm();
        f.section(this._tt('Основное'));
        f.row(this._tt('Основная переменная состояния'),
            this._numberField(spriter.VariableId, { min: 1 }, v => { spriter.VariableId = v; }),
            this._tt('Значение этой переменной выбирает активный скин/позу героя (в этом проекте — 17, «что в руке»)'));
        f.row(this._tt('Включить систему поз'),
            this._checkboxField(spriter.EnablePoses, v => { spriter.EnablePoses = v; }),
            this._tt('Если выключено — настройки поз полностью игнорируются (удобно, пока рисуются спрайты)'));
        f.row(this._tt('Обновлять лидера'),
            this._checkboxField(spriter.ApplyToActor, v => { spriter.ApplyToActor = v; }),
            this._tt('Менять иконку персонажа в меню вместе со скином'));
        f.row(this._tt('Debug Console'),
            this._checkboxField(spriter.Debug, v => { spriter.Debug = v; }),
            this._tt('Подробное логирование в консоль игры (F8)'));
        f.mount(content);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);line-height:1.5;padding:8px 2px;';
        hint.textContent = this._tt('Скины и позы героя подхватываются по значению основной переменной. Записи ниже в списках имеют меньший приоритет; условия проверяются от верхней записи вниз.');
        content.appendChild(hint);
    }

    _listImgFolder(sub) {
        if (typeof RRAssetFiles === 'undefined') return [];
        try {
            const proj = this._projectPath();
            if (!proj) return [];
            const dir = this._path().join(proj, 'img', sub);
            return RRAssetFiles.listUnique(dir, ['.png']) || [];
        } catch (e) {
            return [];
        }
    }

    _imgUrlFrom(sub, name) {
        const proj = this._projectPath();
        if (!proj || !name || typeof RRAssetFiles === 'undefined') return '';
        try {
            return RRAssetFiles.toUrl(this._path().join(proj, 'img', sub, name + '.png'));
        } catch (e) {
            return '';
        }
    }

    _opLabel(op) {
        return { equal: '=', greater: '>', less: '<', notEqual: '≠' }[op] || '=';
    }

    // ------------------------------------------------------------------
    // Entry bodies
    // ------------------------------------------------------------------

    _ensure(entry, key, fallback) {
        if (!entry[key] || typeof entry[key] !== 'object') entry[key] = fallback;
        return entry[key];
    }

    /** NPC tag line: name input + <sds:…> code with copy button. */
    _npcTagLine(entry, changed) {
        const tagLine = document.createElement('div');
        tagLine.style.cssText = 'display:flex;gap:6px;align-items:center;flex:1;';
        const tag = document.createElement('code');
        tag.style.cssText = `
            font-size: 12px; padding: 4px 8px; flex: 1;
            background-color: var(--color-bg-deep);
            border: 1px solid var(--color-border); border-radius: 4px;
            color: var(--color-accent-text, #7ab0ff);
        `;
        tag.textContent = '<sds:' + (entry.IdName || '') + '>';
        tagLine.appendChild(tag);
        tagLine.appendChild(this._smallButton('Копировать', () => {
            if (navigator.clipboard) navigator.clipboard.writeText(tag.textContent);
        }));
        const input = this._textField(entry.IdName, {}, v => { entry.IdName = v.trim(); tag.textContent = '<sds:' + v.trim() + '>'; changed(); });
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;';
        wrap.appendChild(input);
        wrap.appendChild(tagLine);
        return wrap;
    }

    _req(name) {
        try {
            if (typeof require === 'function') return require(name);
            if (typeof window !== 'undefined' && typeof window.require === 'function') return window.require(name);
        } catch (e) { /* not in NW/node */ }
        return null;
    }

    _charactersDir() {
        const projectPath = this._projectPath();
        if (!projectPath) return null;
        const path = this._req('path');
        return path ? path.join(projectPath, 'img', 'characters') : null;
    }

    /** Proven file-URL helper (encodes spaces/Cyrillic) - same one the
     *  CharacterGraphicPicker uses. */
    _imgUrl(fileName) {
        const dir = this._charactersDir();
        if (!dir || !fileName || typeof RRAssetFiles === 'undefined') return '';
        try {
            const path = this._req('path');
            return RRAssetFiles.toUrl(path.join(dir, fileName + '.png'));
        } catch (e) {
            return '';
        }
    }

    _listCharacterFiles() {
        if (typeof RRAssetFiles === 'undefined') return [];
        try {
            const dir = this._charactersDir();
            if (!dir) return [];
            // Relative extensionless names (subfolders kept, MV-style).
            return RRAssetFiles.listUnique(dir, ['.png']) || [];
        } catch (e) {
            return [];
        }
    }

    _renderSpriteVisuals(panel, entry, kind) {
        const vis = this._ensure(entry, 'Visuals', {});
        const isNPC = kind === 'NPCMappings';

        // S34: bare file line right under the preview - no caption noise,
        // the picker button is just «…» (title carries the explanation).
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:6px;';
        const fileInput = this._textField(vis.CharacterName, { placeholder: 'имя файла без .png' }, v => { vis.CharacterName = v; });
        fileInput.style.flex = '1';
        line.appendChild(fileInput);
        // S32: skins pick file AND character cell in the same two-step modal
        // (pickCharacterIndex); NPC picks the file only. No index field.
        const pickOpts = isNPC ? {} : { pickCharacterIndex: true };
        const pickBtn = this._smallButton('…', () => this._showFilePicker(vis.CharacterName, (name, index) => {
            vis.CharacterName = name;
            if (!isNPC && index !== undefined) vis.CharacterIndex = index;
            fileInput.value = name;
            this._refreshPreview();
        }, 'characters', pickOpts));
        pickBtn.title = isNPC ? this._tt('Выбрать файл спрайта') : this._tt('Выбрать файл и персонажа на листе');
        line.appendChild(pickBtn);
        panel.appendChild(line);
    }

    /** S34: the collapsed fine-tuning block, rendered AFTER Название/Приоритет. */
    _renderAdvancedAnimation(entry, kind) {
        const vis = this._ensure(entry, 'Visuals', {});
        const isNPC = kind === 'NPCMappings';

        // S31: fine animation tuning collapsed by default - most skins run
        // on sheet defaults (0 = авто). The player above shows the result.
        const det = document.createElement('details');
        det.style.cssText = 'margin-top:8px;border:1px solid var(--color-border);border-radius:4px;background-color:var(--color-bg-panel);padding:0 10px;';
        const sum = document.createElement('summary');
        sum.style.cssText = 'padding:8px 0;font-size:13px;font-weight:bold;color:var(--color-text-strong);cursor:pointer;user-select:none;';
        sum.textContent = this._tt('▸ Продвинутая анимация');
        det.appendChild(sum);
        det.open = false;

        // S37b: rows carry the kit's agonia-field-grid class so the cells
        // get the scoped min-width:0 (long select options were inflating
        // the 1fr tracks and smearing the form); inline columns override
        // the kit auto-fill. All tiny hint captions are cut (S37b).
        const mk = (label, key, opts) => {
            const f = this._fieldLabel(label);
            f.appendChild(this._numberField(vis[key], opts, v => { vis[key] = v; this._refreshPreview(); }));
            return f;
        };
        const mkSel = (label, key, options) => {
            const f = this._fieldLabel(label);
            const cur = Number(vis[key]);
            // keep an out-of-list current value visible instead of hiding it
            if (!options.some(o => Number(o.value) === cur)) {
                options = options.concat([{ value: cur, label: String(cur) }]);
            }
            f.appendChild(this._selectField(cur, options, v => { vis[key] = Number(v); this._refreshPreview(); }));
            return f;
        };
        const row = (cols, padTop) => {
            const r = document.createElement('div');
            r.className = 'agonia-field-grid';
            r.style.cssText = 'grid-template-columns:' + cols + ';gap:8px;padding:' + (padTop ? '4px' : '0') + ' 0 8px;';
            return r;
        };

        const row1 = row('repeat(3,1fr)', true);
        row1.appendChild(mkSel('Кадров (в ряду)', 'Frames', [
            { value: 3, label: '3' }, { value: 4, label: '4' },
            { value: 5, label: '5' }, { value: 6, label: '6' }
        ]));
        row1.appendChild(mkSel('Направления', 'Directions', [
            { value: 4, label: 'Крутится (4)' }, { value: 1, label: 'Фиксировано (1)' }
        ]));
        row1.appendChild(mk('FPS', 'FPS', { min: 0, step: 1 }));
        det.appendChild(row1);

        const sizeRow = row('repeat(2,1fr)', false);
        sizeRow.appendChild(mk('Ширина (px)', 'Width', { min: 0, step: 1 }));
        sizeRow.appendChild(mk('Высота (px)', 'Height', { min: 0, step: 1 }));
        det.appendChild(sizeRow);

        const row2 = row('repeat(3,1fr)', false);
        row2.appendChild(mkSel('Idle индекс', 'IdleIndex', [
            { value: -1, label: 'Выкл' }, { value: 0, label: '0' }, { value: 1, label: '1' },
            { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' },
            { value: 5, label: '5' }, { value: 6, label: '6' }, { value: 7, label: '7' }
        ]));
        row2.appendChild(mk('Idle анимация', 'IdleAnimSpeed', { min: -1, step: 1 }));
        row2.appendChild(mk('Задержка (тики)', 'AnimationDelay', { min: 1, step: 1 }));
        det.appendChild(row2);

        const selRow = row('repeat(2,1fr)', false);
        const step = this._fieldLabel('Режим покоя');
        step.appendChild(this._selectField(vis.StepMode, [
            { value: 0, label: 'Классика (движение = аним)' },
            { value: 1, label: 'Шаг на месте (всегда аним)' }
        ], v => { vis.StepMode = Number(v); }));
        selRow.appendChild(step);
        const pattern = this._fieldLabel('Режим анимации');
        pattern.appendChild(this._selectField(vis.Pattern, [
            { value: 0, label: 'Loop (0-1-2-3)' },
            { value: 1, label: 'PingPong (0-1-2-1)' },
            { value: 2, label: 'Ритмичный (0-1-3-2)' }
        ], v => { vis.Pattern = Number(v); }));
        selRow.appendChild(pattern);
        det.appendChild(selRow);

        if (!isNPC) {
            const animRow = this._fieldLabel('Ручная смена индексов');
            animRow.style.paddingBottom = '8px';
            animRow.appendChild(this._textField(vis.AnimationIndices, { placeholder: 'например: 0,1,2,1' }, v => { vis.AnimationIndices = v; }));
            det.appendChild(animRow);
        }
        return det;
    }

    _renderPoseVisuals(panel, entry) {
        const vis = this._ensure(entry, 'Visuals', { GridX: 0, GridY: 0, Width: 48, Height: 48 });

        // S34: bare file line - no caption noise, «…» button.
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:6px;';
        const fileInput = this._textField(vis.CharacterName, { placeholder: 'имя файла (пусто = поза из графики героя)' }, v => { vis.CharacterName = v; });
        fileInput.style.flex = '1';
        line.appendChild(fileInput);
        const pickBtn = this._smallButton('…', () => this._showFilePicker(vis.CharacterName, name => {
            vis.CharacterName = name;
            fileInput.value = name;
        }));
        pickBtn.title = this._tt('Выбрать файл спрайта');
        line.appendChild(pickBtn);
        panel.appendChild(line);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';
        for (const [label, key] of [['Колонка (X)', 'GridX'], ['Ряд (Y)', 'GridY'], ['Ширина (px)', 'Width'], ['Высота (px)', 'Height']]) {
            const f = this._fieldLabel(label, key === 'GridX' ? 'Клик по ячейке в превью листа ставит X/Y' : undefined);
            f.appendChild(this._numberField(vis[key], { min: 0, step: 1 }, v => { vis[key] = v; }));
            grid.appendChild(f);
        }
        panel.appendChild(grid);

        // Sheet picker with clickable grid
        panel.appendChild(this._renderPoseGrid(entry));
    }

    _renderPoseGrid(entry) {
        const vis = entry.Visuals;
        const wrap = this._fieldLabel('Превью листа — клик по ячейке = позиция позы');

        const box = document.createElement('div');
        box.style.cssText = `
            border: 1px solid var(--color-border); border-radius: 4px;
            background-color: var(--color-bg-deep);
            padding: 8px; overflow: auto; max-height: 320px;
        `;
        const img = document.createElement('img');
        const file = vis.CharacterName;
        img.src = file ? this._imgUrl(file) : '';
        img.style.cssText = 'image-rendering: pixelated; max-width: 100%; display: block; cursor: crosshair;';
        if (!file) {
            img.alt = this._tt('Выберите файл спрайта');
            img.style.minHeight = '60px';
        }

        const overlay = () => {
            // Redraw selection rectangle as a positioned div over the image
            selBox.parentNode && selBox.parentNode.removeChild(selBox);
            if (!img.naturalWidth || !file) return;
            const cols = Math.max(1, Math.floor(img.naturalWidth / Math.max(1, Number(vis.Width) || 48)));
            const rows = Math.max(1, Math.floor(img.naturalHeight / Math.max(1, Number(vis.Height) || 48)));
            const gx = Math.min(Number(vis.GridX) || 0, cols - 1);
            const gy = Math.min(Number(vis.GridY) || 0, rows - 1);
            selBox.style.left = (img.offsetLeft + gx * (Number(vis.Width) || 48)) + 'px';
            selBox.style.top = (img.offsetTop + gy * (Number(vis.Height) || 48)) + 'px';
            selBox.style.width = (Number(vis.Width) || 48) + 'px';
            selBox.style.height = (Number(vis.Height) || 48) + 'px';
            if (img.parentNode) img.parentNode.appendChild(selBox);
        };
        const selBox = document.createElement('div');
        selBox.style.cssText = `
            position: absolute;
            border: 2px solid var(--color-accent-text, #7ab0ff);
            box-shadow: 0 0 0 1000px rgba(0,0,0,0.45);
            pointer-events: none;
        `;

        const holder = document.createElement('div');
        holder.style.cssText = 'position:relative;display:inline-block;';
        holder.appendChild(img);
        holder.appendChild(selBox);
        box.appendChild(holder);
        img.addEventListener('load', overlay);
        setTimeout(overlay, 60);

        img.addEventListener('click', e => {
            if (!img.naturalWidth) return;
            const rect = img.getBoundingClientRect();
            const w = Math.max(1, Number(vis.Width) || 48);
            const h = Math.max(1, Number(vis.Height) || 48);
            vis.GridX = Math.max(0, Math.floor((e.clientX - rect.left) / w));
            vis.GridY = Math.max(0, Math.floor((e.clientY - rect.top) / h));
            this._renderPoseGridRefresh(entry, wrap);
        });

        wrap.appendChild(box);
        wrap._refresh = () => this._renderPoseGridRefresh(entry, wrap);
        this._poseGridHost = wrap;
        return wrap;
    }

    _renderPoseGridRefresh(entry, wrap) {
        const fresh = this._renderPoseGrid(entry);
        wrap.parentNode.replaceChild(fresh, wrap);
        this._poseGridHost = fresh;
    }

    _refreshPreview() {
        for (const p of (this._players || [])) {
            try { if (p.reload) p.reload(); } catch (e) { /* keep editor alive */ }
        }
    }

    // ------------------------------------------------------------------
    // File picker modal
    // ------------------------------------------------------------------

    /**
     * File picker modal. opts.pickCharacterIndex (S24b): two-step flow for
     * the hero - step 1 picks the sheet file, step 2 opens that sheet split
     * into 8 character cells (4x2; $-big sheets = one cell); clicking a cell
     * finishes with onSelect(name, index). Without the option a file click
     * finishes with onSelect(name) as before.
     */
    _showFilePicker(currentName, onSelect, sub, opts) {
        sub = sub || 'characters';
        const pickIndex = !!(opts && opts.pickCharacterIndex);
        const files = sub === 'characters' ? this._listCharacterFiles() : this._listImgFolder(sub);
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; inset: 0;
            background-color: rgba(0,0,0,0.8);
            display: flex; justify-content: center; align-items: center;
            z-index: 21000;
        `;
        const win = document.createElement('div');
        win.style.cssText = `
            background-color: var(--color-bg-surface);
            border: 1px solid var(--color-border); border-radius: 8px;
            width: 80%; max-width: 900px; height: 80%;
            display: flex; flex-direction: column;
        `;
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 16px; font-weight: 600; font-size: 14px;
            color: var(--color-text-strong);
            border-bottom: 1px solid var(--color-border);
            display: flex; justify-content: space-between; align-items: center; gap: 10px;
        `;
        const headLbl = document.createElement('span');
        header.appendChild(headLbl);
        header.appendChild(this._smallButton('Закрыть', () => modal.remove()));
        win.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow-y:auto;min-height:0;';
        win.appendChild(body);
        modal.appendChild(win);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);

        const setTitle = (text) => { headLbl.textContent = this._tt(text); };

        // --- Step 2: the chosen sheet, split into character cells ---
        const showSheet = (name) => {
            body.innerHTML = '';
            setTitle('Выбор персонажа — ' + name);
            body.appendChild(this._smallButton('‹ Назад к файлам', () => showFiles()));

            const big = (typeof RRAssetFiles !== 'undefined')
                ? RRAssetFiles.isBigCharacter(String(name || ''))
                : String(name || '').startsWith('$');

            const box = document.createElement('div');
            box.style.cssText = 'margin:12px;padding:8px;border:1px solid var(--color-border);border-radius:4px;background-color:var(--color-bg-deep);overflow:auto;';
            const img = document.createElement('img');
            img.src = this._imgUrl(name);
            img.style.cssText = 'image-rendering:pixelated;max-width:100%;display:block;cursor:pointer;';
            const selBox = document.createElement('div');
            selBox.style.cssText = `
                position: absolute;
                border: 2px solid var(--color-accent-text, #7ab0ff);
                box-shadow: 0 0 0 1000px rgba(0,0,0,0.45);
                pointer-events: none;
            `;
            const holder = document.createElement('div');
            holder.style.cssText = 'position:relative;display:inline-block;';
            holder.appendChild(img);
            holder.appendChild(selBox);
            box.appendChild(holder);
            body.appendChild(box);

            const drawFrame = () => {
                selBox.parentNode && selBox.parentNode.removeChild(selBox);
                if (!img.naturalWidth) return;
                const cellW = big ? img.naturalWidth : img.naturalWidth / 4;
                const cellH = big ? img.naturalHeight : img.naturalHeight / 2;
                selBox.style.left = (img.offsetLeft) + 'px';
                selBox.style.top = (img.offsetTop) + 'px';
                selBox.style.width = cellW + 'px';
                selBox.style.height = cellH + 'px';
                if (img.parentNode) img.parentNode.appendChild(selBox);
            };
            img.addEventListener('load', drawFrame);
            setTimeout(drawFrame, 60);

            if (big) {
                // Single character - one click picks it.
                img.addEventListener('click', () => {
                    onSelect(name, 0);
                    modal.remove();
                });
                return;
            }
            img.addEventListener('click', e => {
                if (!img.naturalWidth) return;
                const rect = img.getBoundingClientRect();
                const col = Math.max(0, Math.min(3, Math.floor((e.clientX - rect.left) / (rect.width / 4))));
                const rowI = Math.max(0, Math.min(1, Math.floor((e.clientY - rect.top) / (rect.height / 2))));
                onSelect(name, rowI * 4 + col);
                modal.remove();
            });
        };

        // --- Step 1: the file grid (as before) ---
        const showFiles = () => {
            body.innerHTML = '';
            setTitle('Выбор файла (img/' + sub + ')');
            const grid = document.createElement('div');
            grid.style.cssText = 'padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;';

            for (const record of files) {
                const name = record.name; // extensionless, subfolder-aware
                const cell = document.createElement('div');
                cell.style.cssText = `
                    border: 1px solid ${name === currentName ? 'var(--color-accent-text, #7ab0ff)' : 'var(--color-border)'};
                    border-radius: 6px; padding: 6px; cursor: pointer;
                    background-color: var(--color-bg-deep); text-align: center;
                `;
                const thumb = document.createElement('img');
                thumb.src = sub === 'characters' ? this._imgUrl(name) : this._imgUrlFrom(sub, name);
                thumb.style.cssText = 'image-rendering: pixelated; max-width: 100%; max-height: 90px;';
                const cap = document.createElement('div');
                cap.style.cssText = 'font-size: 10px; color: var(--color-text); margin-top: 4px; word-break: break-all;';
                cap.textContent = (typeof RRAssetFiles !== 'undefined' && RRAssetFiles.basename)
                    ? RRAssetFiles.basename(name) : name;
                cap.title = name;
                cell.appendChild(thumb);
                cell.appendChild(cap);
                cell.addEventListener('click', () => {
                    if (pickIndex) showSheet(name); // stay in the modal
                    else {
                        onSelect(name);
                        modal.remove();
                    }
                });
                grid.appendChild(cell);
            }
            if (!files.length) {
                grid.innerHTML = '<div style="color:var(--color-text-muted);padding:20px;">' +
                    this._tt('В проекте нет файлов в img/' + sub) + '</div>';
            }
            body.appendChild(grid);
        };

        showFiles();
    }

    // ------------------------------------------------------------------
    // Live preview player
    // ------------------------------------------------------------------

    _playerStop() {
        // Kill the shared master loop and drop every registered player
        // (each rendered card registers one).
        this._playerGeneration++;
        this._players = [];
        if (this._masterTimer) {
            clearInterval(this._masterTimer);
            this._masterTimer = null;
        }
    }

    _registerPlayer(player, tag) {
        if (tag) player._tag = tag;
        this._players = this._players || [];
        this._players.push(player);
        if (!this._masterTimer) {
            const gen = this._playerGeneration;
            this._masterTimer = setInterval(() => {
                if (gen !== this._playerGeneration) {
                    clearInterval(this._masterTimer);
                    this._masterTimer = null;
                    return;
                }
                for (const p of (this._players || [])) {
                    try { p.tick(); } catch (e) { /* keep editor alive */ }
                }
            }, 16);
        }
    }

    /** opts.mini: grid-card mode - no controls, small canvas (S30).
     *  Poses (Visuals.GridX) render ONE static cell and hide the playback
     *  controls - there is nothing to play (S31). S33: every non-mini
     *  preview renders in the SAME framed fixed-360px panel (skins, NPC,
     *  poses - identical window). */
    _renderPlayer(entry, kind, opts) {
        const mini = !!(opts && opts.mini);
        const still = !!(entry && entry.Visuals && entry.Visuals.GridX !== undefined);
        // S33: grid cards stay bare (the card IS the frame); every form
        // preview - animated or static pose - renders in the SAME framed
        // panel. S34: full column width, identical to the other blocks.
        const wrap = mini ? document.createElement('div') : this._panel();
        if (mini) {
            wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;';
        } else {
            wrap.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;';
        }

        let state = { playing: true, frame: 0, tick: 0, img: null, url: '' };
        if (!mini && !still) {
            const headRow = document.createElement('div');
            headRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
            const title = document.createElement('span');
            title.style.cssText = 'font-weight:600;font-size:12px;color:var(--color-text-strong);';
            title.textContent = this._tt('Живое превью');
            headRow.appendChild(title);

            const playBtn = this._smallButton('⏸', () => {
                state.playing = !state.playing;
                playBtn.textContent = state.playing ? '⏸' : '▶';
            });
            headRow.appendChild(playBtn);

            let direction = 0;
            const dirSel = document.createElement('select');
            dirSel.style.cssText = 'padding:3px 6px;font-size:11px;background-color:var(--color-bg-deep);border:1px solid var(--color-border);border-radius:4px;color:var(--color-text-strong);';
            for (const [lbl, val] of [['Вниз', 0], ['Влево', 1], ['Вправо', 2], ['Вверх', 3]]) {
                const o = document.createElement('option');
                o.value = val; o.textContent = this._tt(lbl);
                dirSel.appendChild(o);
            }
            dirSel.addEventListener('change', () => { direction = Number(dirSel.value); draw(); });
            headRow.appendChild(dirSel);
            headRow.appendChild(document.createElement('div')).style.cssText = 'flex:1;';

            const frameLbl = document.createElement('span');
            frameLbl.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
            headRow.appendChild(frameLbl);
            wrap._frameLbl = frameLbl;
            wrap.appendChild(headRow);
            wrap._direction = () => direction;
        }
        const dirOf = () => (wrap._direction ? wrap._direction() : 0);

        const stage = document.createElement('div');
        stage.style.cssText = mini
            ? `display:flex;align-items:center;justify-content:center;height:78px;width:100%;
               background-color:var(--color-bg-deep);border:1px solid var(--color-border);border-radius:4px;`
            : `
            display: flex; align-items: center; justify-content: center;
            height: 140px; width: 100%; box-sizing: border-box;
            background-color: var(--color-bg-deep);
            border: 1px solid var(--color-border); border-radius: 4px;
        `;
        const canvas = document.createElement('canvas');
        canvas.width = 96; canvas.height = 128;
        canvas.style.cssText = mini
            ? 'image-rendering:pixelated;height:72px;'
            : 'image-rendering: pixelated; height: 128px;';
        stage.appendChild(canvas);
        wrap.appendChild(stage);

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const vis = entry.Visuals || {};

        const reload = () => {
            const url = this._imgUrl(vis.CharacterName);
            state.img = null;
            state.url = url;
            if (!url) { draw(); return; }
            const img = new Image();
            img.onload = () => { if (state.url === url) { state.img = img; draw(); } };
            img.onerror = () => draw();
            img.src = url;
        };

        const frameSequence = () => {
            const frames = Math.max(3, Number(vis.Frames) || 3);
            const pattern = Number(vis.Pattern) || 0;
            const seq = [];
            if (pattern === 1) {
                for (let i = 0; i < frames; i++) seq.push(i);
                for (let i = frames - 2; i > 0; i--) seq.push(i);
            } else if (pattern === 2) {
                for (let i = 0; i < frames; i += 4) {
                    seq.push(i % frames, (i + 1) % frames, (i + 3) % frames, (i + 2) % frames);
                }
            } else {
                for (let i = 0; i < frames; i++) seq.push(i);
            }
            return seq.length ? seq : [0];
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (wrap._frameLbl) wrap._frameLbl.textContent = '';
            if (!state.img) {
                ctx.fillStyle = 'rgba(128,128,128,0.8)';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                const msg = vis.CharacterName
                    ? this._tt('Не удалось загрузить: ') + vis.CharacterName
                    : this._tt('Выберите файл спрайта');
                ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
                return;
            }
            const img = state.img;
            const iw = img.naturalWidth, ih = img.naturalHeight;
            if (!iw || !ih) return;

            // Pose (S31): a pose IS one static cell - draw GridX/GridY only,
            // never cycle frames.
            if (vis.GridX !== undefined) {
                let cellW = Math.max(1, Number(vis.Width) || 48);
                let cellH = Math.max(1, Number(vis.Height) || 48);
                const cols = Math.max(1, Math.floor(iw / cellW));
                const rows = Math.max(1, Math.floor(ih / cellH));
                const gx = Math.min(Number(vis.GridX) || 0, cols - 1);
                const gy = Math.min(Number(vis.GridY) || 0, rows - 1);
                const sx = gx * cellW;
                const sy = gy * cellH;
                cellW = Math.min(cellW, iw - sx);
                cellH = Math.min(cellH, ih - sy);
                if (cellW <= 0 || cellH <= 0) return;
                const scale = Math.min(canvas.width / cellW, canvas.height / cellH);
                const dw = Math.round(cellW * scale);
                const dh = Math.round(cellH * scale);
                ctx.drawImage(img, sx, sy, cellW, cellH,
                    Math.round((canvas.width - dw) / 2), Math.round((canvas.height - dh) / 2), dw, dh);
                return;
            }

            // Sheet layout: $-sheets are a single character (3 cols x 4
            // rows); standard sheets hold 8 characters (12 cols x 8 rows).
            // Cell size comes from the sheet itself, or the custom
            // Width/Height when set (> 0), matching the plugin.
            const big = (typeof RRAssetFiles !== 'undefined')
                ? RRAssetFiles.isBigCharacter(String(vis.CharacterName || ''))
                : String(vis.CharacterName || '').startsWith('$');
            const gridCols = big ? 3 : 12;
            const gridRows = big ? 4 : 8;
            let cellW = Number(vis.Width) > 0 ? Number(vis.Width) : Math.floor(iw / gridCols);
            let cellH = Number(vis.Height) > 0 ? Number(vis.Height) : Math.floor(ih / gridRows);
            if (cellW <= 0) cellW = 48;
            if (cellH <= 0) cellH = 48;

            const frames = Math.max(3, Number(vis.Frames) || 3);
            const seq = frameSequence();
            const frame = seq[state.frame % seq.length] || 0;

            let colBase = 0, rowBase = 0;
            if (!big) {
                const index = Math.min(7, Math.max(0, Number(vis.CharacterIndex) || 0));
                colBase = (index % 4) * 3;
                rowBase = Math.floor(index / 4) * 4;
            }
            const sx = (colBase + Math.min(frame, gridCols - 1)) * cellW;
            const sy = (rowBase + dirOf()) * cellH;

            // Fit the cell into the canvas, keep aspect.
            const scale = Math.min(canvas.width / cellW, canvas.height / cellH);
            const dw = Math.round(cellW * scale);
            const dh = Math.round(cellH * scale);
            const dx = Math.round((canvas.width - dw) / 2);
            const dy = Math.round((canvas.height - dh) / 2);
            ctx.drawImage(img, sx, sy, cellW, cellH, dx, dy, dw, dh);
            if (wrap._frameLbl) wrap._frameLbl.textContent = this._tt('кадр') + ' ' + frame + '/' + frames;
        };

        const fps = Math.max(1, Number(vis.FPS) || 8);
        const delay = Math.max(1, Math.round(60 / fps));
        let lastSnapshot = JSON.stringify(entry);

        const isPose = vis.GridX !== undefined;
        const player = {
            reload,
            tick: () => {
                // Fields changed elsewhere in the card (file/index/size):
                // rebind the image.
                const snap = JSON.stringify(entry);
                if (snap !== lastSnapshot) {
                    lastSnapshot = snap;
                    reload();
                    return;
                }
                if (isPose) return; // static cell - no frame cycling (S31)
                if (!state.playing || !state.img) return;
                state.tick++;
                if (state.tick >= delay) {
                    state.tick = 0;
                    state.frame++;
                    draw();
                }
            }
        };
        // Mini players (grid cards) live until a full rebuild; regular
        // players are tagged 'spriterForm' so re-rendering the form kills
        // only the previous form player.
        if (mini) this._registerPlayer(player);
        else this._registerPlayer(player, 'spriterForm');

        reload();
        return wrap;
    }
}

// Browser global (loaded as a plain script, like the other editors).
if (typeof window !== 'undefined') {
    window.DatabaseSpriterEditor = DatabaseSpriterEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseSpriterEditor;
}
