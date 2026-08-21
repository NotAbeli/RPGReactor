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

    showSpriterDetail(container) {
        this._playerStop();

        const spriter = this.getSpriter();

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

        const banner = document.createElement('div');
        banner.style.cssText = `background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
        `;
        banner.textContent = this._tt('Спрайтер');
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
        sub.textContent = this._tt('Комбайн спрайтов: скины, позы и библиотека NPC главного движка');
        banner.appendChild(sub);
        wrapper.appendChild(banner);

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:8px;padding:10px 16px 0;border-bottom:1px solid var(--color-border);';
        wrapper.appendChild(tabsRow);

        const content = document.createElement('div');
        content.className = 'agonia-content';
        content.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px;';
        wrapper.appendChild(content);

        const tabs = [
            { id: '__hero__', label: 'Герой' },
            ...this.collectionKeys.map(c => ({ id: c.key, label: c.label })),
            { id: '__globals__', label: 'Глобальные' }
        ];
        let active = tabs[0].id;

        const render = () => {
            content.innerHTML = '';
            try {
                if (active === '__globals__') {
                    this._renderGlobals(content, spriter);
                } else if (active === '__hero__') {
                    this._renderHero(content);
                } else {
                    this._renderCollection(content, spriter, active);
                }
            } catch (e) {
                content.appendChild(this._errorBanner(e));
            }
        };

        for (const tab of tabs) {
            const el = document.createElement('div');
            el.style.cssText = `
                padding: 8px 18px; font-size: 13px; font-weight: 600;
                color: var(--color-text); cursor: pointer;
                border: 1px solid var(--color-border); border-bottom: none;
                border-radius: 6px 6px 0 0;
                background-color: var(--color-bg-deep);
                user-select: none;
            `;
            el.textContent = this._tt(tab.label);
            if (tab.id === active) {
                el.style.backgroundColor = 'var(--color-bg-panel)';
                el.style.color = 'var(--color-text-strong)';
                el.style.borderBottom = '2px solid var(--color-accent-border-mid)';
            }
            el.addEventListener('click', () => {
                active = tab.id;
                tabsRow.querySelectorAll('div').forEach(t => {
                    t.style.backgroundColor = 'var(--color-bg-deep)';
                    t.style.color = 'var(--color-text)';
                    t.style.borderBottom = '1px solid var(--color-border)';
                });
                el.style.backgroundColor = 'var(--color-bg-panel)';
                el.style.color = 'var(--color-text-strong)';
                el.style.borderBottom = '2px solid var(--color-accent-border-mid)';
                render();
            });
            tabsRow.appendChild(el);
        }

        container.appendChild(wrapper);
        render();
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

    // ------------------------------------------------------------------
    // Hero card (actor #1) - the Actors tab collapsed to the single
    // playable character (S14).
    // ------------------------------------------------------------------

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

    _renderHero(content) {
        this._playerStop();
        content.innerHTML = '';
        content.appendChild(this._sectionTitle('Главный герой'));
        const actors = (this.databaseManager.getActors ? this.databaseManager.getActors() : []) || [];
        const actor = actors[1];
        if (!actor) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);padding:40px 0;text-align:center;font-size:13px;';
            empty.textContent = this._tt('Актёр #1 не найден в базе');
            content.appendChild(empty);
            return;
        }

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;';

        // Left: fields
        const left = this._panel();
        left.style.width = '340px';

        const nameRow = this._fieldLabel('Имя');
        nameRow.appendChild(this._textField(actor.name, {}, v => { actor.name = v; }));
        left.appendChild(nameRow);

        const spriteRow = this._fieldLabel('Спрайт (img/characters)');
        const spriteLine = document.createElement('div');
        spriteLine.style.cssText = 'display:flex;gap:6px;';
        spriteLine.appendChild(this._textField(actor.characterName, { placeholder: 'имя файла без .png' }, v => { actor.characterName = v; }));
        spriteLine.appendChild(this._smallButton('Выбрать…', () => this._showFilePicker(actor.characterName, name => {
            actor.characterName = name;
            this._renderHero(content);
        })));
        spriteRow.appendChild(spriteLine);
        left.appendChild(spriteRow);

        const idxRow = this._fieldLabel('Индекс спрайта (0–7)');
        idxRow.appendChild(this._numberField(actor.characterIndex || 0, { min: 0, max: 7 }, v => { actor.characterIndex = v; }));
        left.appendChild(idxRow);

        const faceRow = this._fieldLabel('Лицо (img/faces)');
        const faceLine = document.createElement('div');
        faceLine.style.cssText = 'display:flex;gap:6px;';
        faceLine.appendChild(this._textField(actor.faceName, { placeholder: 'имя файла без .png' }, v => { actor.faceName = v; }));
        faceLine.appendChild(this._smallButton('Выбрать…', () => this._showFilePicker(actor.faceName, name => {
            actor.faceName = name;
            this._renderHero(content);
        }, 'faces')));
        faceRow.appendChild(faceLine);
        left.appendChild(faceRow);

        const faceIdxRow = this._fieldLabel('Индекс лица (0–7)');
        faceIdxRow.appendChild(this._numberField(actor.faceIndex || 0, { min: 0, max: 7 }, v => { actor.faceIndex = v; }));
        left.appendChild(faceIdxRow);

        const mkArea = (label, key, hint) => {
            const wrap = this._fieldLabel(label, hint);
            const area = document.createElement('textarea');
            area.value = actor[key] || '';
            area.rows = 3;
            area.style.cssText = `
                width:100%;box-sizing:border-box;padding:5px 8px;font-size:12px;resize:vertical;
                background-color:var(--color-bg-deep);color:var(--color-text-strong);
                border:1px solid var(--color-border);border-radius:4px;
            `;
            area.addEventListener('input', () => { actor[key] = area.value; });
            wrap.appendChild(area);
            return wrap;
        };
        left.appendChild(mkArea('Профиль', 'profile'));
        left.appendChild(mkArea('Заметки', 'note', 'Мета-теги плагинов, как в Note событий'));
        row.appendChild(left);

        // Right: live sprite player + face preview
        const right = this._panel();
        right.style.flex = '1';
        right.style.minWidth = '320px';
        const pvEntry = { Visuals: { CharacterName: actor.characterName, CharacterIndex: actor.characterIndex || 0, Frames: 3, Directions: 4, FPS: 8, Pattern: 0, Width: 0, Height: 0 } };
        right.appendChild(this._renderPlayer(pvEntry, 'hero'));

        const faceTitle = this._fieldLabel('Лицо (лист 4×2)');
        const faceImg = document.createElement('img');
        faceImg.src = this._imgUrlFrom('faces', actor.faceName);
        faceImg.style.cssText = 'image-rendering:pixelated;max-width:100%;max-height:220px;border:1px solid var(--color-border);border-radius:4px;background-color:var(--color-bg-deep);';
        if (!actor.faceName) faceImg.style.display = 'none';
        faceTitle.appendChild(faceImg);
        right.appendChild(faceTitle);
        row.appendChild(right);

        content.appendChild(row);
    }

    _renderCollection(content, spriter, kind) {
        this._playerStop();
        content.innerHTML = '';
        const meta = this.collectionKeys.find(c => c.key === kind);
        const entries = DatabaseSpriterEditor.decodeCollection(spriter[kind]);
        const persist = () => { spriter[kind] = DatabaseSpriterEditor.encodeCollection(entries); };
        const rerender = () => this._renderCollection(content, spriter, kind);

        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);padding:4px 0 8px;line-height:1.4;';
        hint.textContent = this._tt(meta.hint);
        content.appendChild(hint);

        const host = document.createElement('div');
        host.style.cssText = 'height:640px;';
        content.appendChild(host);

        const K = DatabaseSpriterEditor;
        new MasterDetailShell({
            items: entries,
            searchText: r => [r.Name, r.IdName, r.Priority].join(' '),
            addLabel: 'Добавить',
            blank: () => K.blankEntry(kind),
            onChanged: persist,
            title: (r, i) => (i + 1) + '. ' + this._entryHeadline(r, kind),
            summary: r => this._condSummary(r),
            thumb: r => {
                const vis = r.Visuals || {};
                const url = vis.CharacterName ? this._imgUrl(vis.CharacterName) : '';
                return url ? { url } : { letter: (r.Name || r.IdName || '·').slice(0, 1) };
            },
            renderForm: (formCol, entry, idx, api) => this._renderEntryInspector(formCol, entry, kind, api, entries, persist, rerender)
        }).mount(host);
    }

    _condSummary(entry) {
        const cond = entry.Conditions;
        if (!cond) return '';
        const parts = [];
        parts.push(cond.MainValue === -1 ? 'базовый (−1)' : 'var=' + cond.MainValue);
        for (const sw of [cond.SwitchId1, cond.SwitchId2]) if (Number(sw) > 0) parts.push('sw' + sw);
        if (Number(cond.ExtVarId) > 0) parts.push('доп.var' + cond.ExtVarId + this._opLabel(cond.ExtVarOp) + cond.ExtVarVal);
        return parts.join(' · ');
    }

    /** Red error banner instead of a silently empty tab (S21). */
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

    _entryHeadline(entry, kind) {
        if (kind === 'NPCMappings') return entry.IdName || 'NPC';
        return entry.Name || (kind === 'PoseMappings' ? 'Поза' : 'Скин');
    }

    _renderEntryInspector(formCol, entry, kind, api, entries, persist, rerender) {
        const changed = () => { persist(); api.refreshList && api.refreshList(); };
        const f = new InspectorForm();
        f.head((entries.indexOf(entry) + 1) + '. ' + this._entryHeadline(entry, kind), this._condSummary(entry));

        if (kind === 'NPCMappings') {
            const vis = this._ensure(entry, 'Visuals', {});
            f.section(this._tt('NPC'));
            f.row(this._tt('ID Название (тег)'),
                this._npcTagLine(entry, changed), this._tt('Писать в Note события: <sds:ЭтоИмя>'));
            f.mount(formCol);
            const vForm = new InspectorForm();
            vForm.section(this._tt('Графика'));
            vForm.mount(formCol);
            this._renderSpriteVisuals(formCol, entry, kind, changed);
            return;
        }

        f.section(this._tt('Запись'));
        f.row(this._tt('Название'), this._textField(entry.Name, {}, v => { entry.Name = v; changed(); }));
        f.row(this._tt('Приоритет'),
            this._numberField(entry.Priority, { min: 0 }, v => { entry.Priority = v; changed(); }),
            this._tt('При равных условиях побеждает запись с большим приоритетом'));
        f.mount(formCol);

        // Conditions inspector
        const cond = this._ensure(entry, 'Conditions', {});
        const cf = new InspectorForm();
        cf.section(this._tt('Условия'));
        cf.row(this._tt('Значение основной переменной'),
            this._numberField(cond.MainValue, { min: -1 }, v => { cond.MainValue = v; changed(); }),
            this._tt('−1 = базовый скин/поза для всех неперехваченных значений'));
        cf.row(this._tt('Свитч 1 (ВКЛ)'), this._numberField(cond.SwitchId1, { min: 0 }, v => { cond.SwitchId1 = v; changed(); }));
        cf.row(this._tt('Свитч 2 (ВКЛ)'), this._numberField(cond.SwitchId2, { min: 0 }, v => { cond.SwitchId2 = v; changed(); }));
        cf.row(this._tt('Свитч 3 (доигрывание)'), this._numberField(cond.SwitchId3, { min: 0 }, v => { cond.SwitchId3 = v; changed(); }),
            this._tt('Пока ВКЛ — поза удерживается даже после смены значения переменной'));
        const extLine = document.createElement('div');
        extLine.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
        extLine.appendChild(this._numberField(cond.ExtVarId, { min: 0 }, v => { cond.ExtVarId = v; changed(); }));
        extLine.appendChild(this._selectField(cond.ExtVarOp || 'equal', [
            { value: 'equal', label: '=' }, { value: 'greater', label: '>' },
            { value: 'less', label: '<' }, { value: 'notEqual', label: '≠' }
        ], v => { cond.ExtVarOp = v; changed(); }));
        const evv = this._numberField(cond.ExtVarVal, { min: 0 }, v => { cond.ExtVarVal = v; changed(); });
        evv.style.width = '84px';
        extLine.appendChild(evv);
        cf.row(this._tt('Доп. переменная'), extLine, this._tt('var id · операция · значение'));
        cf.mount(formCol);

        // Visuals (existing panels, now stacked in the form column)
        if (kind === 'PoseMappings') {
            const vf = new InspectorForm();
            vf.section(this._tt('Визуал позы'));
            vf.mount(formCol);
            this._renderPoseVisuals(formCol, entry, changed);
        } else {
            const vf = new InspectorForm();
            vf.section(this._tt('Визуал скина'));
            vf.mount(formCol);
            this._renderSpriteVisuals(formCol, entry, kind, changed);
        }
    }

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

    _renderSpriteVisuals(host, entry, kind, changed) {
        const vis = this._ensure(entry, 'Visuals', {});
        const isNPC = kind === 'NPCMappings';

        const fileRow = this._fieldLabel('Файл спрайта', 'img/characters/');
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:6px;';
        const fileInput = this._textField(vis.CharacterName, { placeholder: 'имя файла без .png' }, v => { vis.CharacterName = v; });
        line.appendChild(fileInput);
        const pickBtn = this._smallButton('Выбрать…', () => this._showFilePicker(vis.CharacterName, name => {
            vis.CharacterName = name;
            fileInput.value = name;
            this._refreshPreview();
        }));
        line.appendChild(pickBtn);
        fileRow.appendChild(line);
        host.appendChild(fileRow);

        if (!isNPC) {
            const idxRow = this._fieldLabel('Индекс персонажа (0–7)', 'Клик по ячейке в превью листа');
            idxRow.appendChild(this._numberField(vis.CharacterIndex, { min: 0, max: 7 }, v => { vis.CharacterIndex = v; this._refreshPreview(); }));
            host.appendChild(idxRow);
        }

        // Tile settings
        const tileRow = document.createElement('div');
        tileRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';
        const mk = (label, key, opts, hint) => {
            const f = this._fieldLabel(label, hint);
            f.appendChild(this._numberField(vis[key], opts, v => { vis[key] = v; this._refreshPreview(); }));
            return f;
        };
        tileRow.appendChild(mk('Кадров (в ряду)', 'Frames', { min: 3, step: 1 }));
        tileRow.appendChild(mk('Направления', 'Directions', { min: 1, max: 4, step: 1 }, '4 = крутится, 1 = фиксировано'));
        tileRow.appendChild(mk('FPS', 'FPS', { min: 0, step: 1 }, '0 = авто'));
        tileRow.appendChild(mk('Ширина (px)', 'Width', { min: 0, step: 1 }, '0 = авто'));
        tileRow.appendChild(mk('Высота (px)', 'Height', { min: 0, step: 1 }, '0 = авто'));
        tileRow.appendChild(mk('Idle индекс', 'IdleIndex', { min: -1, max: 7, step: 1 }, '−1 = выкл'));
        tileRow.appendChild(mk('Idle анимация', 'IdleAnimSpeed', { min: -1, step: 1 }, '0 = выкл, −1 = стандарт'));
        tileRow.appendChild(mk('Задержка (тики)', 'AnimationDelay', { min: 1, step: 1 }, 'для ручной смены индексов'));
        host.appendChild(tileRow);

        const selRow = document.createElement('div');
        selRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
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
        host.appendChild(selRow);

        if (!isNPC) {
            const animRow = this._fieldLabel('Ручная смена индексов', 'Массив индексов графики (0–7), меняются по кругу с задержкой выше');
            animRow.appendChild(this._textField(vis.AnimationIndices, { placeholder: 'например: 0,1,2,1' }, v => { vis.AnimationIndices = v; }));
            host.appendChild(animRow);
        }

        // Live preview player
        host.appendChild(this._renderPlayer(entry, kind));
    }

    _renderPoseVisuals(host, entry, changed) {
        const vis = this._ensure(entry, 'Visuals', { GridX: 0, GridY: 0, Width: 48, Height: 48 });

        const fileRow = this._fieldLabel('Файл спрайта', 'Пусто = вырезать позу из текущей графики героя');
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:6px;';
        const fileInput = this._textField(vis.CharacterName, { placeholder: 'имя файла без .png' }, v => { vis.CharacterName = v; });
        line.appendChild(fileInput);
        line.appendChild(this._smallButton('Выбрать…', () => this._showFilePicker(vis.CharacterName, name => {
            vis.CharacterName = name;
            fileInput.value = name;
        })));
        fileRow.appendChild(line);
        host.appendChild(fileRow);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';
        for (const [label, key] of [['Колонка (X)', 'GridX'], ['Ряд (Y)', 'GridY'], ['Ширина (px)', 'Width'], ['Высота (px)', 'Height']]) {
            const f = this._fieldLabel(label, key === 'GridX' ? 'Клик по ячейке в превью листа ставит X/Y' : undefined);
            f.appendChild(this._numberField(vis[key], { min: 0, step: 1 }, v => { vis[key] = v; }));
            grid.appendChild(f);
        }
        host.appendChild(grid);

        // Sheet picker with clickable grid
        host.appendChild(this._renderPoseGrid(entry));
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
            img.parentNode.appendChild(selBox);
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

    _showFilePicker(currentName, onSelect, sub) {
        sub = sub || 'characters';
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
            display: flex; justify-content: space-between; align-items: center;
        `;
        header.textContent = this._tt('Выбор файла (img/' + sub + ')');
        header.appendChild(this._smallButton('Закрыть', () => modal.remove()));
        win.appendChild(header);

        const grid = document.createElement('div');
        grid.style.cssText = 'flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;';

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
                onSelect(name);
                modal.remove();
            });
            grid.appendChild(cell);
        }
        if (!files.length) {
            grid.innerHTML = '<div style="color:var(--color-text-muted);padding:20px;">' +
                this._tt('В проекте нет файлов в img/' + sub) + '</div>';
        }
        win.appendChild(grid);
        modal.appendChild(win);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
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

    _registerPlayer(player) {
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

    _renderPlayer(entry, kind) {
        const wrap = this._panel();
        wrap.style.padding = '8px';

        const headRow = document.createElement('div');
        headRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const title = document.createElement('span');
        title.style.cssText = 'font-weight:600;font-size:12px;color:var(--color-text-strong);';
        title.textContent = this._tt('Живое превью');
        headRow.appendChild(title);

        const state = { playing: true, frame: 0, tick: 0, img: null, url: '' };
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
        wrap.appendChild(headRow);

        const stage = document.createElement('div');
        stage.style.cssText = `
            display: flex; align-items: center; justify-content: center;
            height: 140px; background-color: var(--color-bg-deep);
            border: 1px solid var(--color-border); border-radius: 4px;
        `;
        const canvas = document.createElement('canvas');
        canvas.width = 96; canvas.height = 128;
        canvas.style.cssText = 'image-rendering: pixelated; height: 128px;';
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
            frameLbl.textContent = '';
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
            const sy = (rowBase + direction) * cellH;

            // Fit the cell into the canvas, keep aspect.
            const scale = Math.min(canvas.width / cellW, canvas.height / cellH);
            const dw = Math.round(cellW * scale);
            const dh = Math.round(cellH * scale);
            const dx = Math.round((canvas.width - dw) / 2);
            const dy = Math.round((canvas.height - dh) / 2);
            ctx.drawImage(img, sx, sy, cellW, cellH, dx, dy, dw, dh);
            frameLbl.textContent = this._tt('кадр') + ' ' + frame + '/' + frames;
        };

        const fps = Math.max(1, Number(vis.FPS) || 8);
        const delay = Math.max(1, Math.round(60 / fps));
        let lastSnapshot = JSON.stringify(entry);

        this._registerPlayer({
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
                if (!state.playing || !state.img) return;
                state.tick++;
                if (state.tick >= delay) {
                    state.tick = 0;
                    state.frame++;
                    draw();
                }
            }
        });

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
