/**
 * DatabaseBattleEditor - the combat tab (S18 rewrite): master-detail.
 *
 * Sub-tabs (Melee / Projectiles / Tracers / Dashes) each render a
 * MasterDetailShell: the attack list on the left, a single-record form
 * on the right, in System1-style sections. Data plumbing (MV collection
 * codec, AgoniaEngine sections battle+dash) is unchanged from S10.
 *
 * AnimID is gone from the UI (animations were amputated in S13); the
 * value survives in the data untouched.
 */
class DatabaseBattleEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;

        this.collectionKeys = [
            { section: 'battle', key: 'Melee List', label: 'Ближний бой', kind: 'melee', addLabel: 'Добавить атаку' },
            { section: 'battle', key: 'Projectile List', label: 'Снаряды', kind: 'projectile', addLabel: 'Добавить снаряд' },
            { section: 'battle', key: 'Tracer List', label: 'Трассеры', kind: 'tracer', addLabel: 'Добавить трассер' },
            { section: 'dash', key: 'Dash Database', label: 'Рывки', kind: 'dash', addLabel: 'Добавить рывок' }
        ];

        this._fieldDefs = {
            melee: {
                id: [
                    { key: 'ID', label: 'ID атаки', type: 'text', hint: 'Ключ для performMelee(id)' },
                    { key: 'PID', label: 'PID', type: 'number' },
                    { key: 'Name', label: 'Название', type: 'text' }
                ],
                geometry: [
                    { key: 'Shape', label: 'Форма', type: 'select', options: [['arc', 'Дуга'], ['circle', 'Круг'], ['line', 'Линия']], def: 'arc' },
                    { key: 'Range', label: 'Радиус (тайлы)', type: 'number', step: 0.1 },
                    { key: 'Width', label: 'Ширина (px)', type: 'number' },
                    { key: 'Duration', label: 'Длительность (кадры)', type: 'number' }
                ],
                limits: [
                    { key: 'Regions', label: 'Регионы блокировки', type: 'text', hint: 'Через запятую; пусто = везде' },
                    { key: 'Terrains', label: 'Террейны блокировки', type: 'text' }
                ],
                reactions: [
                    { key: 'ActionsEvent', label: 'Попадание: общее событие №', type: 'number' },
                    { key: 'ActionsPlayer', label: 'Попадание в игрока: событие №', type: 'number' },
                    { key: 'ActionsShooter', label: 'По стрелку: событие №', type: 'number' }
                ]
            },
            projectile: {
                id: [
                    { key: 'ID', label: 'ID снаряда', type: 'text' },
                    { key: 'PID', label: 'PID', type: 'number' },
                    { key: 'Name', label: 'Название', type: 'text' }
                ],
                geometry: [
                    { key: 'Graphic', label: 'Графика (img/pictures)', type: 'text' },
                    { key: 'Speed', label: 'Скорость (px/кадр)', type: 'number', step: 0.1 },
                    { key: 'Distance', label: 'Дистанция (тайлы)', type: 'number', step: 0.1 },
                    { key: 'Hitbox', label: 'Хитбокс (px)', type: 'number' },
                    { key: 'Z', label: 'Слой (Z)', type: 'number' }
                ],
                limits: [
                    { key: 'Regions', label: 'Регионы блокировки', type: 'text' },
                    { key: 'Terrains', label: 'Террейны блокировки', type: 'text' }
                ],
                reactions: [
                    { key: 'ActionsEvent', label: 'Попадание: общее событие №', type: 'number' },
                    { key: 'ActionsPlayer', label: 'Попадание в игрока: событие №', type: 'number' },
                    { key: 'ActionsShooter', label: 'По стрелку: событие №', type: 'number' }
                ]
            },
            tracer: {
                id: [
                    { key: 'ID', label: 'ID трассера', type: 'text' },
                    { key: 'PID', label: 'PID', type: 'number' },
                    { key: 'Name', label: 'Название', type: 'text' }
                ],
                geometry: [
                    { key: 'MaxRange', label: 'Дальность (тайлы)', type: 'number', step: 0.1 },
                    { key: 'Color', label: 'Цвет линии', type: 'text', hint: '#rrggbb' }
                ],
                limits: [
                    { key: 'Regions', label: 'Регионы блокировки', type: 'text' },
                    { key: 'Terrains', label: 'Террейны блокировки', type: 'text' }
                ],
                reactions: [
                    { key: 'ActionsEvent', label: 'Попадание: общее событие №', type: 'number' },
                    { key: 'ActionsPlayer', label: 'Попадание в игрока: событие №', type: 'number' },
                    { key: 'ActionsShooter', label: 'По стрелку: событие №', type: 'number' }
                ]
            },
            dash: {
                id: [
                    { key: 'Name', label: 'Название (ID)', type: 'text', hint: 'Имя для натива 726 Dash' }
                ],
                geometry: [
                    { key: 'TargetMode', label: 'Наведение', type: 'select', options: [['0', 'По направлению движения'], ['1', 'За курсором (игрок)'], ['2', 'К игроку (NPC)']], def: '0' },
                    { key: 'SpeedMultiplier', label: 'Множитель скорости', type: 'number', step: 0.1 },
                    { key: 'Duration', label: 'Длительность (кадры)', type: 'number' },
                    { key: 'Decay', label: 'Затухание', type: 'number', step: 0.1, hint: '1.5 = плавно теряет скорость' },
                    { key: 'Cooldown', label: 'Кулдаун (кадры)', type: 'number' },
                    { key: 'MaxCharges', label: 'Заряды', type: 'number', min: 1 },
                    { key: 'SE', label: 'Звук (audio/se)', type: 'text' }
                ]
            }
        };

        this._blanks = {
            melee: { ID: '1', PID: 1, Name: 'Новая атака', Source: 0, Target: 0, Shape: 'arc', Range: 1.5, Width: 96, Duration: 8, Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            projectile: { ID: '1', PID: 1, Name: 'Новый снаряд', Source: 0, Target: 0, Graphic: '', Speed: 8, Distance: 12, Hitbox: 24, Z: 3, Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            tracer: { ID: '1', PID: 1, Name: 'Новый трассер', Source: 0, Target: 0, MaxRange: 10, Color: '#ffffff', Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            dash: { Name: 'Рывок', TargetMode: '0', MaxCharges: 1, SpeedMultiplier: 3.0, Duration: 15, Decay: 1.5, Cooldown: 20, SE: 'Wind7' }
        };
    }

    _tt(text) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(text) : text;
    }

    getSection(name) {
        const data = this.databaseManager.data;
        if (!data.agonia) data.agonia = DatabaseManager.agoniaDefaults();
        const defaults = DatabaseManager.agoniaDefaults();
        if (!data.agonia[name]) data.agonia[name] = defaults[name];
        return data.agonia[name];
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

    // ------------------------------------------------------------------
    // Tab
    // ------------------------------------------------------------------

    showBattleDetail(container) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
        wrapper.appendChild(this._stdBanner('Бой', 'Атаки, снаряды, трассеры и профили рывков'));

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:8px;padding:10px 16px 0;border-bottom:1px solid var(--color-border);';
        wrapper.appendChild(tabsRow);

        const content = document.createElement('div');
        content.className = 'agonia-content';
        content.style.cssText = 'flex:1;overflow:hidden;padding:0 16px 16px;';
        wrapper.appendChild(content);

        let active = this.collectionKeys[0].kind;
        const render = () => {
            content.innerHTML = '';
            const meta = this.collectionKeys.find(c => c.kind === active);
            this._renderShell(content, meta);
        };

        for (const col of this.collectionKeys) {
            const el = document.createElement('div');
            el.style.cssText = `
                padding: 8px 18px; font-size: 13px; font-weight: 600;
                color: var(--color-text); cursor: pointer; user-select: none;
                border: 1px solid var(--color-border); border-bottom: none;
                border-radius: 6px 6px 0 0; background-color: var(--color-bg-deep);
            `;
            el.textContent = this._tt(col.label);
            el.addEventListener('click', () => {
                active = col.kind;
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
            if (col.kind === active) setTimeout(() => el.click(), 0);
            tabsRow.appendChild(el);
        }

        container.appendChild(wrapper);
    }

    _stdBanner(title, subtitle) {
        const banner = document.createElement('div');
        banner.style.cssText = `
            background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
        `;
        banner.textContent = this._tt(title);
        if (subtitle) {
            const sub = document.createElement('span');
            sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
            sub.textContent = this._tt(subtitle);
            banner.appendChild(sub);
        }
        return banner;
    }

    _renderShell(content, meta) {
        const section = this.getSection(meta.section);
        const K = DatabaseBattleEditor;
        const shell = new MasterDetailShell({
            items: K.decodeCollection(section[meta.key]),
            searchText: r => [r.Name, r.ID].join(' '),
            addLabel: meta.addLabel,
            blank: () => JSON.parse(JSON.stringify(this._blanks[meta.kind])),
            onChanged: items => { section[meta.key] = K.encodeCollection(items); },
            title: (r, i) => meta.kind === 'dash'
                ? (r.Name || 'Рывок')
                : (i + 1) + '. ' + (r.Name || r.ID || '—'),
            summary: r => this._summary(r, meta.kind),
            renderForm: (formCol, record, idx, api) => this._renderForm(formCol, record, meta, api)
        });
        shell.mount(content);
    }

    _summary(r, kind) {
        if (kind === 'melee') return (r.Shape || 'arc') + ' · R' + r.Range + ' · ' + r.Duration + 'f';
        if (kind === 'projectile') return 'v' + r.Speed + ' · D' + r.Distance + ' · hb' + r.Hitbox;
        if (kind === 'tracer') return '≤' + r.MaxRange + ' · ' + r.Color;
        return '×' + r.SpeedMultiplier + ' · ' + r.Duration + 'f · cd' + r.Cooldown;
    }

    _renderForm(formCol, record, meta, api) {
        const defs = this._fieldDefs[meta.kind];
        const groups = [
            ['Идентификация', defs.id],
            ['Геометрия и попадание', defs.geometry],
            ['Ограничения', defs.limits],
            ['Реакции при попадании', defs.reactions]
        ].filter(([, fields]) => fields);

        for (const [title, fields] of groups) {
            const sec = ShellKit.section(this._tt(title));
            const grid = ShellKit.grid();
            for (const f of fields) {
                grid.appendChild(this._renderField(record, f, api));
            }
            sec.appendChild(grid);
            formCol.appendChild(sec);
        }
    }

    _renderField(record, f, api) {
        if (f.type === 'select') {
            const opts = f.options.map(([v, l]) => ({ value: v, label: this._tt(l) }));
            const cur = record[f.key] !== undefined && record[f.key] !== '' ? String(record[f.key]) : (f.def || f.options[0][0]);
            return ShellKit.field(f.label,
                ShellKit.select(opts, cur, v => { record[f.key] = v; api.changed(); }), f.hint);
        }
        if (f.type === 'number') {
            return ShellKit.field(f.label,
                ShellKit.number(record[f.key], v => { record[f.key] = v; api.changed(); },
                    { min: f.min, max: f.max, step: f.step }), f.hint);
        }
        return ShellKit.field(f.label,
            ShellKit.text(record[f.key], v => { record[f.key] = v; api.changed(); }), f.hint);
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseBattleEditor = DatabaseBattleEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseBattleEditor;
}
