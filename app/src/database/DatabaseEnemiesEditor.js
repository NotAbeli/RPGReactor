/**
 * DatabaseEnemiesEditor - the enemy AI tab (S19 rewrite): inspector.
 *
 * Global settings render as an inspector panel on top; the enemy list is
 * master-detail: list left (match · HP · radii), one-enemy inspector right
 * with База / Сенсоры / Паника sections. Custom flag rules are a nested
 * DataTable (flag / conditions / hp / speed) expanding into a rule inspector.
 *
 * Data plumbing (MV codec, AgoniaEngine section `enemies`) unchanged
 * from S10; customRules remains a single JSON array of objects.
 */
class DatabaseEnemiesEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
    }

    _tt(text) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(text) : text;
    }

    getEnemies() {
        const data = this.databaseManager.data;
        if (!data.agonia) data.agonia = DatabaseManager.agoniaDefaults();
        if (!data.agonia.enemies) data.agonia.enemies = DatabaseManager.agoniaDefaults().enemies;
        return data.agonia.enemies;
    }

    static decodeCollection(raw) {
        let arr = [];
        try {
            const parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) arr = parsed;
        } catch (e) { /* fall through */ }
        return arr.map(item => {
            try { return typeof item === 'string' ? JSON.parse(item) : (item || {}); }
            catch (e) { return {}; }
        });
    }

    static encodeCollection(entries) {
        return JSON.stringify((entries || []).map(entry => JSON.stringify(entry || {})));
    }

    static blankEnemy() {
        return {
            id: 1, match: '<enemy>', hp: 40, scope: 0,
            attackRadius: 5, calmRadius: 8, calmTime: 180,
            hearingRadius: 7, hearingThreshold: 60,
            panicContactTime: 120, panicTotalTime: 600,
            customRules: '[]',
            // P2: шаблон врага — карточка разворачивается в 17-страничный автомат
            template: 'true', spriteName: 'Enemy 1', spriteIndex: 0,
            collider: "<circle cx='0.5' cy='0.7' r='0.25' />",
            tracerId: 1, meleeId: 2, dashName: 'РывокВрага',
            chaseThreshold: 2, cowerThreshold: 3,
            damageMeleeVar: 2, damageGunVar: 37, damageMelee: -100, damageFists: -20,
            damageSE: 'Damage2', sneakKill: 'true',
            // S52: поведенческий конструктор
            disposition: 'aggressive', canPanic: 'true', canFlee: 'true', rememberGun: 'true',
            speedCalm: 3, speedCombat: 4
        };
    }

    static blankRule() {
        return {
            flag: 'combat', conditions: '0',
            activationDelay: 0, holdTime: 0, moveSpeed: 3,
            hpMinPct: 0, hpMaxPct: 100,
            reqSwitch: 0, reqVarId: 0, reqVarVal: 0
        };
    }

    /**
     * Classic list-panel API (S27): the Бой tab's ИИ Врагов section drives
     * the classic list itself; globals render through the ⚙ list row.
     */
    classicApi() {
        const enemies = this.getEnemies();
        const K = DatabaseEnemiesEditor;
        return {
            entries: () => K.decodeCollection(enemies['EnemyDatabase']),
            persist: list => { enemies['EnemyDatabase'] = K.encodeCollection(list); },
            blank: () => K.blankEnemy(),
            label: (r, i) => '#' + (i + 1) + ' ' + (String(r.template) === 'true' ? '🏷 ' : '') + (r.match || '—') + ' · HP ' + (r.hp || '?'),
            search: r => [r.match, r.id, r.flag].join(' '),
            renderDetail: (wrapper, entry, idx, commit) =>
                this._renderEnemyInspector(wrapper, entry, idx, { changed: commit }),
            globals: wrapper => this._renderGlobals(wrapper, enemies)
        };
    }

    _renderGlobals(host, enemies) {
        const form = new InspectorForm();
        form.head(this._tt('Глобальные настройки'), this._tt('Общий движок ИИ всех врагов'));
        form.section(this._tt('Движок ИИ'));
        const engine = [
            ['TickRate', 'Обновление ИИ (раз в N кадров)', 'number'],
            ['VariableBaseId', 'Базовая переменная', 'number'],
            ['HearingVariable', 'Переменная шума', 'number'],
            ['NoCombatSwitch', 'Свитч «без боя»', 'number'],
            ['CombatCountVariable', 'Переменная счёта боя', 'number'],
            ['GlobalResetSwitch', 'Свитч глобального сброса', 'number']
        ];
        for (const [key, label, type] of engine) {
            form.field({ key, label: this._tt(label), type }, enemies, () => {});
        }
        form.section(this._tt('Условия оружия (JSON)'));
        for (const [key, label] of [['GunCondition', 'Условие стрельбы'], ['MeleeCondition', 'Условие ближнего боя']]) {
            form.field({
                key, label: this._tt(label), type: 'textarea',
                hint: 'switchId / variableId / variableValues — когда враг может стрелять или бить',
                placeholder: '{"switchId":0,"variableId":17,"variableValues":"37, 36"}'
            }, enemies, () => {});
        }
        form.mount(host);
    }

    _renderEnemyInspector(formCol, entry, idx, api) {
        const K = DatabaseEnemiesEditor;
        const form = new InspectorForm();
        form.head('#' + (idx + 1) + ' ' + (entry.match || '—'),
            'HP ' + (entry.hp || '?') + ' · правил: ' + K.decodeCollection(entry.customRules).length);

        form.section(this._tt('База'));
        form.fields([
            { key: 'match', label: 'match-тег', type: 'text', hint: 'тег в Note события — события с ним получают поведение' },
            { key: 'hp', label: 'HP', type: 'slider', min: 1, max: 999, step: 1 },
            { key: 'id', label: 'ID', type: 'number' },
            { key: 'template', label: 'Шаблон врага', type: 'check', hint: 'карточка разворачивается в полный автомат (17 страниц) на карте' }
        ], entry, { commit: () => api.changed() });

        // P2: шаблон — внешний вид, атаки, таблица урона
        const isTpl = String(entry.template) === 'true';
        if (isTpl) {
            form.section(this._tt('Характер'));
            form.field({ key: 'disposition', label: 'Поведение', type: 'select', hint: 'мирный никогда не атакует',
                options: [['aggressive', 'Злой — нападает'], ['peaceful', 'Мирный — paciфик']] }, entry, { commit: () => api.changed() });
            form.fields([
                { key: 'canPanic', label: 'Пугается', type: 'check' },
                { key: 'canFlee', label: 'Убегает', type: 'check' },
                { key: 'rememberGun', label: 'Помнит оружие', type: 'check' },
                { key: 'speedCalm', label: 'Скорость в покое', type: 'number', min: 1, max: 6 },
                { key: 'speedCombat', label: 'Скорость в бою', type: 'number', min: 1, max: 6 },
                { key: 'stepVolume', label: 'Громкость шагов %', type: 'number', min: 0, max: 150, hint: 'пишется в заглушку как <step_se:VOL>' }
            ], entry, { commit: () => api.changed() });

            form.section(this._tt('Внешний вид'));
            form.fields([
                { key: 'spriteName', label: 'Спрайт (файл)', type: 'text', hint: 'img/characters — показывается на карте и в редакторе' },
                { key: 'spriteIndex', label: 'Индекс персонажа', type: 'number', min: 0, max: 7 },
                { key: 'collider', label: 'Коллайдер (XML)', type: 'text', hint: "например <circle cx='0.5' cy='0.7' r='0.25' />" }
            ], entry, { commit: () => api.changed() });

            form.section(this._tt('Атаки'));
            form.fields([
                { key: 'tracerId', label: 'Трассер №', type: 'number', min: 0, hint: 'карточка из Бой → Трассеры; 0 = без выстрела' },
                { key: 'meleeId', label: 'Ближний бой №', type: 'number', min: 0, hint: 'карточка из Бой → Ближний бой' },
                { key: 'dashName', label: 'Имя рывка', type: 'text', hint: 'карточка из Бой → Рывки' },
                { key: 'chaseThreshold', label: 'Погоня от скольких врагов в бою', type: 'number', min: 1, hint: 'счётчик боя — переменная «Счётчик Боя»' },
                { key: 'cowerThreshold', label: 'Приседание от скольких врагов в бою', type: 'number', min: 1 }
            ], entry, { commit: () => api.changed() });

            form.section(this._tt('Урон по врагу'));
            form.fields([
                { key: 'damageFists', label: 'Урон без оружия', type: 'number', hint: 'кулаки, когда var ГГ не совпал ни с одним оружием Арсенала' },
                { key: 'damageSE', label: 'Звук урона', type: 'text' }
            ], entry, { commit: () => api.changed() });
        }

        form.section(this._tt('Сенсоры (тайлы)'));
        form.fields([
            { key: 'attackRadius', label: 'Радиус атаки', type: 'slider', min: 0, max: 15, step: 0.5, unit: 'т' },
            { key: 'calmRadius', label: 'Радиус спокойствия', type: 'slider', min: 0, max: 20, step: 0.5, unit: 'т' },
            { key: 'calmTime', label: 'Успокоение', type: 'slider', min: 0, max: 600, step: 10, unit: 'f' },
            { key: 'hearingRadius', label: 'Радиус слуха', type: 'slider', min: 0, max: 20, step: 0.5, unit: 'т' },
            { key: 'hearingThreshold', label: 'Порог шума', type: 'slider', min: 0, max: 100, step: 5 },
            { key: 'scope', label: 'Область видимости', type: 'slider', min: 0, max: 10, step: 1, unit: 'т' }
        ], entry, { commit: () => api.changed() });

        form.section(this._tt('Паника'));
        form.fields([
            { key: 'panicContactTime', label: 'Контакт → паника', type: 'slider', min: 0, max: 600, step: 10, unit: 'f' },
            { key: 'panicTotalTime', label: 'Полная паника', type: 'slider', min: 0, max: 600, step: 10, unit: 'f' }
        ], entry, { commit: () => api.changed() });

        form.mount(formCol);

        // P7: ряд из ПЯТИ карточек графики — первая секция карточки.
        // Основная/Тревога/Атака/Урон/Смерть; у незаданных — дефолтная
        // графика карточки с пометкой; клик по карточке = пикер состояния.
        if (String(entry.template) === 'true') {
            const spriter = this._spriterPicker();
            if (spriter && typeof spriter._renderPlayer === 'function') {
                spriter._players = (spriter._players || []).filter(p => p._tag !== 'spriterForm');
                const row = document.createElement('div');
                row.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-bottom:4px;';
                const cards = [
                    ['rest', this._tt('Основная'), this._tt('покой, ходьба, бой — если для состояния нет своей графики')],
                    ['alert', this._tt('Тревога'), this._tt('услышал шум игрока')],
                    ['attack', this._tt('Атака'), this._tt('рывок и удар / выстрел по игроку')],
                    ['hurt', this._tt('Урон'), this._tt('при получении удара или пули')],
                    ['death', this._tt('Смерть'), this._tt('когда HP на нуле')]
                ];
                let gfx = {};
                try { if (entry.stateGraphics) gfx = JSON.parse(entry.stateGraphics) || {}; } catch (e) { gfx = {}; }
                for (const [key, label, usage] of cards) {
                    const g = gfx[key];
                    const hasOwn = !!(g && g.name);
                    const card = document.createElement('div');
                    card.style.cssText = `
                        border: 1px solid ${hasOwn ? 'var(--color-accent-border-mid, #5a8ad4)' : 'var(--color-border)'};
                        border-radius: 6px; padding: 5px; cursor: pointer;
                        background-color: var(--color-bg-deep); text-align: center;
                    `;
                    card.title = this._tt('Клик — выбрать графику: ') + usage;
                    const live = {
                        get Visuals() {
                            const src = (hasOwn && gfx[key]) ? gfx[key] : entry;
                            return { CharacterName: src.spriteName || '', CharacterIndex: Number(src.spriteIndex) || 0 };
                        }
                    };
                    card.appendChild(spriter._renderPlayer(live, 'skins', { mini: true }));
                    const cap = document.createElement('div');
                    cap.style.cssText = 'font-size:10.5px;font-weight:700;color:var(--color-text-strong);margin-top:3px;';
                    cap.textContent = label;
                    card.appendChild(cap);
                    const use = document.createElement('div');
                    use.style.cssText = 'font-size:9px;color:var(--color-text-dim);line-height:1.25;margin-top:1px;';
                    use.textContent = hasOwn ? usage : (usage + ' · ' + this._tt('по умолчанию'));
                    card.appendChild(use);
                    card.addEventListener('click', () => {
                        spriter._showFilePicker('', (name, index) => {
                            let cur = {};
                            try { if (entry.stateGraphics) cur = JSON.parse(entry.stateGraphics) || {}; } catch (e) { cur = {}; }
                            cur[key] = { name: String(name), index: Number(index) || 0 };
                            entry.stateGraphics = JSON.stringify(cur);
                            api.changed();
                            // живое обновление карточки ряда: картинку перезагрузит
                            // снапшот-детектор плеера (геттер читает gfx[key]),
                            // рамку и подпись правим на месте
                            card.style.borderColor = 'var(--color-accent-border-mid, #5a8ad4)';
                            use.textContent = usage;
                        }, 'characters', { pickCharacterIndex: true });
                    });
                    row.appendChild(card);
                }
                formCol.insertBefore(row, formCol.firstChild);
            }
        }

        // P5: дружелюбные блоки шаблона — страх оружием, таблица урона,
        // состояния (графика+звук с превью) и превью основного спрайта.
        if (isTpl) {
            this._renderTplFriendlyBlocks(formCol, entry, () => api.changed());
        }

        // --- Rules: nested DataTable ---
        const rulesTitle = document.createElement('div');
        rulesTitle.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--color-text-dim);margin:16px 0 6px;';
        rulesTitle.textContent = this._tt('Кастомные правила (флаги поведения)');
        formCol.appendChild(rulesTitle);
        const rulesHost = document.createElement('div');
        formCol.appendChild(rulesHost);
        this._renderRules(rulesHost, entry, () => api.changed());
    }

    // ------------------------------------------------------------------
    // P5: дружелюбные блоки карточки шаблона (DOM-билдеры)
    // ------------------------------------------------------------------

    _getArsenal() {
        try {
            const agonia = this.databaseManager && this.databaseManager.data && this.databaseManager.data.agonia;
            const sec = agonia && agonia.enemies;
            if (!sec || !sec['Weapon List']) return [];
            return JSON.parse(sec['Weapon List'])
                .map(w => { try { return typeof w === 'string' ? JSON.parse(w) : w; } catch (e) { return null; } })
                .filter(Boolean);
        } catch (e) {
            return [];
        }
    }

    _spriterPicker() {
        if (!this._spriterPickerInstance && typeof DatabaseSpriterEditor !== 'undefined') {
            this._spriterPickerInstance = new DatabaseSpriterEditor(this.databaseManager, this.projectManager, null, null);
        }
        return this._spriterPickerInstance;
    }

    _sectionLabel(host, text) {
        const t = document.createElement('div');
        t.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--color-text-dim);margin:14px 0 6px;';
        t.textContent = this._tt(text);
        host.appendChild(t);
    }

    _renderTplFriendlyBlocks(host, entry, changed) {
        const weapons = this._getArsenal();

        // --- Боится оружия: чекбоксы Арсенала ---
        this._sectionLabel(host, 'Боится оружия');
        if (!weapons.length) {
            const n = document.createElement('div');
            n.style.cssText = 'font-size:11px;color:var(--color-text-muted);';
            n.textContent = this._tt('Арсенал пуст — добавьте оружия в Бой → Оружие. Пусто = глобальное условие оружия.');
            host.appendChild(n);
        } else {
            const box = document.createElement('div');
            box.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 12px;';
            const fearedSet = new Set(String(entry.fearedWeapons || '').split(',')
                .map(s => Number(s.trim())).filter(v => v > 0));
            for (const w of weapons) {
                const lbl = document.createElement('label');
                lbl.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;';
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.checked = fearedSet.has(Number(w.varValue));
                chk.addEventListener('change', () => {
                    if (chk.checked) fearedSet.add(Number(w.varValue));
                    else fearedSet.delete(Number(w.varValue));
                    entry.fearedWeapons = Array.from(fearedSet).sort((a, b) => a - b).join(',');
                    changed();
                });
                lbl.appendChild(chk);
                const sp = document.createElement('span');
                sp.textContent = (w.name || 'var ' + w.varValue) + ' (var ' + w.varValue + ')';
                lbl.appendChild(sp);
                box.appendChild(lbl);
            }
            host.appendChild(box);
        }

        // --- Таблица урона: Арсенал + оверрайды ---
        this._sectionLabel(host, 'Урон по оружию');
        let overrides = {};
        try { if (entry.damageOverrides) overrides = JSON.parse(entry.damageOverrides) || {}; } catch (e) { overrides = {}; }
        if (weapons.length) {
            const tbl = document.createElement('div');
            tbl.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) 90px;gap:2px 8px;align-items:center;';
            for (const w of weapons) {
                const v = String(w.varValue);
                const nm = document.createElement('span');
                nm.style.cssText = 'font-size:12px;color:var(--color-text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                nm.textContent = (w.name || 'var ' + v) + (String(w.sneakKill) === 'true' ? ' · скрытно' : '') + ' — базово ' + (w.damage || 0);
                tbl.appendChild(nm);
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.value = (overrides[v] !== undefined) ? overrides[v] : (w.damage !== undefined ? w.damage : '');
                inp.style.cssText = 'width:100%;min-width:52px;box-sizing:border-box;';
                inp.addEventListener('change', () => {
                    const val = Number(inp.value) || 0;
                    if (Number(w.damage) === val) delete overrides[v];
                    else overrides[v] = String(val);
                    entry.damageOverrides = JSON.stringify(overrides);
                    changed();
                });
                tbl.appendChild(inp);
            }
            host.appendChild(tbl);
        }
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:var(--color-text-muted);margin-top:2px;';
        hint.textContent = this._tt('Значение как в Арсенале = без оверрайда; измени — у этого врага свой урон.');
        host.appendChild(hint);

        // --- Состояния: графика + звук (+ превью) ---
        this._sectionLabel(host, 'Состояния (графика + звук)');
        let gfx = {}, snd = {};
        try { if (entry.stateGraphics) gfx = JSON.parse(entry.stateGraphics) || {}; } catch (e) { gfx = {}; }
        try { if (entry.stateSounds) snd = JSON.parse(entry.stateSounds) || {}; } catch (e) { snd = {}; }
        const states = [
            ['rest', 'Покой'], ['alert', 'Тревога'], ['combat', 'Бой'], ['panic', 'Паника'],
            ['flee', 'Бегство'], ['attack', 'Атака'], ['hurt', 'Урон'], ['death', 'Смерть']
        ];
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2px 14px;';
        for (const [key, label] of states) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0;margin:2px 0;';
            const lb = document.createElement('span');
            lb.style.cssText = 'flex:none;width:56px;font-size:11.5px;color:var(--color-text-dim);';
            lb.textContent = this._tt(label);
            row.appendChild(lb);
            // превью + имя графика + пикер
            const gbtn = document.createElement('button');
            gbtn.className = 'agonia-btn';
            gbtn.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:2px 6px;font-size:11px;text-align:left;';
            const g = gfx[key] || {};
            const img = document.createElement('img');
            img.style.cssText = 'flex:none;width:24px;height:32px;image-rendering:pixelated;object-fit:none;object-position:0 0;border:1px solid var(--color-border);display:' + (g.name ? 'block' : 'none') + ';';
            if (g.name) {
                img.src = this._charUrl(g.name, Number(g.index) || 0);
            }
            const gtxt = document.createElement('span');
            gtxt.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            gtxt.textContent = g.name ? (String(g.name) + ' #' + (Number(g.index) || 0)) : '—';
            gbtn.appendChild(img);
            gbtn.appendChild(gtxt);
            gbtn.addEventListener('click', () => {
                const picker = this._spriterPicker();
                if (!picker) return;
                picker._showFilePicker('', (name, index) => {
                    gfx[key] = { name: String(name), index: Number(index) || 0 };
                    entry.stateGraphics = JSON.stringify(gfx);
                    img.src = this._charUrl(name, Number(index) || 0);
                    img.style.display = 'block';
                    gtxt.textContent = String(name) + ' #' + (Number(index) || 0);
                    changed();
                }, 'characters', { pickCharacterIndex: true });
            });
            row.appendChild(gbtn);
            // SE
            const sinp = document.createElement('input');
            sinp.type = 'text';
            sinp.placeholder = 'SE';
            sinp.value = String(snd[key] || '');
            sinp.style.cssText = 'flex:none;width:88px;min-width:52px;box-sizing:border-box;font-size:11px;';
            sinp.addEventListener('change', () => {
                if (String(sinp.value || '').trim() === '') delete snd[key];
                else snd[key] = String(sinp.value).trim();
                entry.stateSounds = JSON.stringify(snd);
                changed();
            });
            row.appendChild(sinp);
            grid.appendChild(row);
        }
        host.appendChild(grid);
    }

    /** Мини-превью ячейки листа персонажа (24×32, сдвиг по индексу). */
    _charUrl(name, index) {
        try {
            if (typeof RRAssetFiles === 'undefined') return '';
            const proj = this.projectManager && this.projectManager.getCurrentProject
                ? this.projectManager.getCurrentProject() : null;
            if (!proj || !proj.path) return '';
            let path = null;
            try { path = (typeof require === 'function') ? require('path') : window.require('path'); } catch (e) { return ''; }
            return RRAssetFiles.toUrl(path.join(proj.path, 'img', 'characters', name + '.png'));
        } catch (e) {
            return '';
        }
    }

    _renderRules(host, entry, commitOuter) {
        const K = DatabaseEnemiesEditor;
        host.innerHTML = '';
        const rules = K.decodeCollection(entry.customRules);
        const persist = () => { entry.customRules = K.encodeCollection(rules); commitOuter(); };
        const rerender = () => this._renderRules(host, entry, commitOuter);

        const table = new DataTable({
            items: rules,
            countLabel: 'правил',
            columns: [
                { label: 'Флаг', key: 'flag', type: 'text', width: '16%' },
                { label: 'Условия (0 И / 1 ИЛИ)', key: 'conditions', type: 'text', width: '14%' },
                { label: 'HP %', get: r => (r.hpMinPct || 0) + '–' + (r.hpMaxPct || 100), align: 'right', width: '10%' },
                { label: 'Скорость', key: 'moveSpeed', type: 'number', align: 'right', width: '10%' },
                { label: 'Свитч', key: 'reqSwitch', type: 'number', align: 'right', width: '10%' },
                { label: 'Задержка', key: 'activationDelay', type: 'number', align: 'right', width: '10%' }
            ],
            expandable: (box, rule, rIdx, rApi) => {
                const f = new InspectorForm();
                f.fields([
                    { key: 'flag', label: 'Флаг', type: 'text' },
                    { key: 'conditions', label: 'Условия', type: 'text', hint: '0 = И, 1 = ИЛИ (для перечисленных требований)' },
                    { key: 'activationDelay', label: 'Задержка (кадры)', type: 'slider', min: 0, max: 600, step: 10, unit: 'f' },
                    { key: 'holdTime', label: 'Удержание (кадры)', type: 'slider', min: 0, max: 600, step: 10, unit: 'f' },
                    { key: 'moveSpeed', label: 'Скорость движения', type: 'slider', min: 0, max: 8, step: 0.5 },
                    { key: 'hpMinPct', label: 'HP мин %', type: 'number', min: 0, max: 100 },
                    { key: 'hpMaxPct', label: 'HP макс %', type: 'number', min: 0, max: 100 },
                    { key: 'reqSwitch', label: 'Требует свитч', type: 'number' },
                    { key: 'reqVarId', label: 'Требует переменную', type: 'number' },
                    { key: 'reqVarVal', label: 'Значение переменной', type: 'number' }
                ], rule, { commit: () => { persist(); rApi.refresh(); } });
                f.mount(box);
            },
            onAdd: () => { rules.push(K.blankRule()); persist(); rerender(); },
            addLabel: '+ Правило',
            onRemove: idx => { rules.splice(idx, 1); persist(); rerender(); },
            onReorder: (a, b) => {
                const [m] = rules.splice(a, 1);
                rules.splice(b, 0, m);
                persist(); rerender();
            },
            onChanged: persist
        });
        table.mount(host);
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseEnemiesEditor = DatabaseEnemiesEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseEnemiesEditor;
}
