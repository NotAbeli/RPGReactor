/**
 * DatabaseBattleEditor - combat databases tab (below Spriter): melee,
 * projectile and tracer attack lists (SuperDuperBattle) plus the dash
 * skill database (SuperDuperMovement_Addon).
 *
 * Data lives in the Agonia sidecar sections `battle` and `dash`
 * (data/AgoniaEngine.json) as MV-format collection strings - arrays of
 * JSON-object strings - matching the plugins' safeParseArray exactly.
 * The bridge merges the sections into the system modules' parameters.
 *
 * Struct fields mirror the plugins' own @param structs:
 *   MeleeAttack:    ID, PID, Name, Source, Target, Shape, Range, Width,
 *                   Duration, Regions, Terrains, AnimID, ActionsEvent,
 *                   ActionsPlayer, ActionsShooter
 *   ProjectileAttack: ID, PID, Source, Target, Graphic, Speed, Distance,
 *                   Hitbox, Z, Regions, Terrains, AnimID, Actions*...
 *   TracerAttack:   ID, PID, Source, Target, MaxRange, Color, Regions,
 *                   Terrains, AnimID, Actions*...
 *   DashSettings:   Name, TargetMode, MaxCharges, SpeedMultiplier,
 *                   Duration, Decay, Cooldown, SE
 */
class DatabaseBattleEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;

        this.collectionKeys = [
            { section: 'battle', key: 'Melee List', label: 'Ближний бой', kind: 'melee',
                hint: 'Атаки взмахом (performMelee). Хитбокс: форма, радиус, ширина, длительность.' },
            { section: 'battle', key: 'Projectile List', label: 'Снаряды', kind: 'projectile',
                hint: 'Летящие атаки (performProjectile): графика, скорость, дистанция, хитбокс.' },
            { section: 'battle', key: 'Tracer List', label: 'Трассеры', kind: 'tracer',
                hint: 'Мгновенные трассирующие выстрелы (performTracer): дальность, цвет.' },
            { section: 'dash', key: 'Dash Database', label: 'Рывки', kind: 'dash',
                hint: 'Профили боевых рывков — имена видит натив 726 Dash.' }
        ];

        this._fieldDefs = {
            melee: [
                { key: 'ID', label: 'ID атаки', type: 'text', hint: 'Ключ для performMelee(id)' },
                { key: 'PID', label: 'PID', type: 'number' },
                { key: 'Name', label: 'Название', type: 'text' },
                { key: 'Source', label: 'Источник', type: 'number', hint: '0 = атакующий' },
                { key: 'Target', label: 'Цель', type: 'number', hint: 'Куда целиться (0 = мышь/направление)' },
                { key: 'Shape', label: 'Форма', type: 'select', options: [['arc', 'arc — дуга'], ['circle', 'circle — круг'], ['line', 'line — линия']] },
                { key: 'Range', label: 'Радиус (тайлы)', type: 'number', step: 0.1 },
                { key: 'Width', label: 'Ширина (px)', type: 'number' },
                { key: 'Duration', label: 'Длительность (кадры)', type: 'number' },
                { key: 'Regions', label: 'Регионы блокировки', type: 'text', hint: 'Через запятую; пусто = везде' },
                { key: 'Terrains', label: 'Террейны блокировки', type: 'text' },
                { key: 'AnimID', label: 'ID анимации', type: 'number', hint: '0 = без анимации' },
                { key: 'ActionsEvent', label: 'Событие при попадании', type: 'number', hint: 'ID общего события' },
                { key: 'ActionsPlayer', label: 'Событие на игрока', type: 'number' },
                { key: 'ActionsShooter', label: 'Событие на стрелке', type: 'number' }
            ],
            projectile: [
                { key: 'ID', label: 'ID снаряда', type: 'text' },
                { key: 'PID', label: 'PID', type: 'number' },
                { key: 'Source', label: 'Источник', type: 'number' },
                { key: 'Target', label: 'Цель', type: 'number' },
                { key: 'Graphic', label: 'Графика (img/animations)', type: 'text' },
                { key: 'Speed', label: 'Скорость (px/кадр)', type: 'number', step: 0.1 },
                { key: 'Distance', label: 'Дистанция (тайлы)', type: 'number', step: 0.1 },
                { key: 'Hitbox', label: 'Хитбокс (px)', type: 'number' },
                { key: 'Z', label: 'Z-слой', type: 'number' },
                { key: 'Regions', label: 'Регионы блокировки', type: 'text' },
                { key: 'Terrains', label: 'Террейны блокировки', type: 'text' },
                { key: 'AnimID', label: 'ID анимации', type: 'number' },
                { key: 'ActionsEvent', label: 'Событие при попадании', type: 'number' },
                { key: 'ActionsPlayer', label: 'Событие на игрока', type: 'number' },
                { key: 'ActionsShooter', label: 'Событие на стрелке', type: 'number' }
            ],
            tracer: [
                { key: 'ID', label: 'ID трассера', type: 'text' },
                { key: 'PID', label: 'PID', type: 'number' },
                { key: 'Source', label: 'Источник', type: 'number' },
                { key: 'Target', label: 'Цель', type: 'number' },
                { key: 'MaxRange', label: 'Дальность (тайлы)', type: 'number', step: 0.1 },
                { key: 'Color', label: 'Цвет линии', type: 'text', hint: '#rrggbb' },
                { key: 'Regions', label: 'Регионы блокировки', type: 'text' },
                { key: 'Terrains', label: 'Террейны блокировки', type: 'text' },
                { key: 'AnimID', label: 'ID анимации', type: 'number' },
                { key: 'ActionsEvent', label: 'Событие при попадании', type: 'number' },
                { key: 'ActionsPlayer', label: 'Событие на игрока', type: 'number' },
                { key: 'ActionsShooter', label: 'Событие на стрелке', type: 'number' }
            ],
            dash: [
                { key: 'Name', label: 'Название (ID)', type: 'text', hint: 'Имя для натива 726 Dash' },
                { key: 'TargetMode', label: 'Наведение', type: 'select', options: [['0', 'По направлению движения'], ['1', 'За курсором (игрок)'], ['2', 'К игроку (NPC)']] },
                { key: 'MaxCharges', label: 'Заряды', type: 'number', min: 1 },
                { key: 'SpeedMultiplier', label: 'Множитель скорости', type: 'number', step: 0.1 },
                { key: 'Duration', label: 'Длительность (кадры)', type: 'number' },
                { key: 'Decay', label: 'Затухание', type: 'number', step: 0.1, hint: '1.5 = плавно теряет скорость' },
                { key: 'Cooldown', label: 'Кулдаун (кадры)', type: 'number' },
                { key: 'SE', label: 'Звук (audio/se)', type: 'text' }
            ]
        };

        this._blankEntries = {
            melee: { ID: '1', PID: 1, Name: 'Новая атака', Source: 0, Target: 0, Shape: 'arc', Range: 1.5, Width: 96, Duration: 8, Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            projectile: { ID: '1', PID: 1, Source: 0, Target: 0, Graphic: '', Speed: 8, Distance: 12, Hitbox: 24, Z: 3, Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            tracer: { ID: '1', PID: 1, Source: 0, Target: 0, MaxRange: 10, Color: '#ffffff', Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
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

    /** Decode an MV collection string into plain entries (S7 codec rules:
     *  each item is a JSON-object string; nested structs are flat here). */
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
    // Main view
    // ------------------------------------------------------------------

    showBattleDetail(container) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

        const banner = document.createElement('div');
        banner.style.cssText = `background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
            padding: 14px 20px;
            border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600;
            color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px;
        `;
        banner.textContent = this._tt('Бой');
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
        sub.textContent = this._tt('Базы атак (ближний бой / снаряды / трассеры) и профили рывков');
        banner.appendChild(sub);
        wrapper.appendChild(banner);

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:8px;padding:10px 16px 0;border-bottom:1px solid var(--color-border);';
        wrapper.appendChild(tabsRow);

        const content = document.createElement('div');
        content.className = 'agonia-content';
        content.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px;';
        wrapper.appendChild(content);

        const cardsHost = document.createElement('div');
        cardsHost.className = 'agonia-cards';
        content.appendChild(cardsHost);

        let active = this.collectionKeys[0].kind;
        const render = () => {
            cardsHost.innerHTML = '';
            const meta = this.collectionKeys.find(c => c.kind === active);
            const section = this.getSection(meta.section);
            this._renderCollection(cardsHost, section, meta);
        };

        for (const col of this.collectionKeys) {
            const el = document.createElement('div');
            el.style.cssText = `
                padding: 8px 18px; font-size: 13px; font-weight: 600;
                color: var(--color-text); cursor: pointer; user-select: none;
                border: 1px solid var(--color-border); border-bottom: none;
                border-radius: 6px 6px 0 0;
                background-color: var(--color-bg-deep);
            `;
            el.textContent = this._tt(col.label);
            if (col.kind === active) {
                el.style.backgroundColor = 'var(--color-bg-panel)';
                el.style.color = 'var(--color-text-strong)';
                el.style.borderBottom = '2px solid var(--color-accent-border-mid)';
            }
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
            tabsRow.appendChild(el);
        }

        container.appendChild(wrapper);
        render();
    }

    _renderCollection(content, section, meta) {
        content.innerHTML = '';
        const entries = DatabaseBattleEditor.decodeCollection(section[meta.key]);

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 0 8px;flex-wrap:wrap;';
        const title = document.createElement('div');
        title.style.cssText = 'font-size:15px;font-weight:600;color:var(--color-text-strong);';
        title.textContent = this._tt(meta.label);
        header.appendChild(title);
        const count = document.createElement('span');
        count.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
        count.textContent = entries.length + ' · ' + this._tt(meta.hint);
        header.appendChild(count);
        header.appendChild(this._spacer());
        header.appendChild(this._button('Добавить', () => {
            entries.push(JSON.parse(JSON.stringify(this._blankEntries[meta.kind])));
            section[meta.key] = DatabaseBattleEditor.encodeCollection(entries);
            this._renderCollection(content, section, meta);
        }));
        content.appendChild(header);

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:40px 0;font-size:13px;';
            empty.textContent = this._tt('Записей нет — нажмите «Добавить»');
            content.appendChild(empty);
            return;
        }

        entries.forEach((entry, idx) => {
            content.appendChild(this._renderCard(entries, idx, section, meta, content));
        });
    }

    _headline(entry, kind) {
        if (kind === 'dash') return entry.Name || 'Рывок';
        return (entry.Name || entry.ID || '—') + (entry.ID !== undefined ? ' · id=' + entry.ID : '');
    }

    _summary(entry, kind) {
        if (kind === 'melee') return (entry.Shape || 'arc') + ' · R' + entry.Range + ' · ' + entry.Duration + 'f';
        if (kind === 'projectile') return 'v' + entry.Speed + ' · D' + entry.Distance + ' · hb' + entry.Hitbox;
        if (kind === 'tracer') return '≤' + entry.MaxRange + ' · ' + entry.Color;
        return '×' + entry.SpeedMultiplier + ' · ' + entry.Duration + 'f · cd' + entry.Cooldown;
    }

    _renderCard(entries, idx, section, meta, content) {
        const kind = meta.kind;
        const entry = entries[idx];
        const card = document.createElement('div');
        card.style.cssText = `
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border); border-radius: 6px;
            margin-bottom: 12px; display: flex; flex-direction: column;
        `;

        const head = document.createElement('div');
        head.style.cssText = `
            display:flex;align-items:center;gap:10px;padding:8px 12px;
            background-color: var(--color-bg-deep);
            border-radius:6px 6px 0 0;border-bottom:1px solid var(--color-border);
        `;
        const toggle = document.createElement('span');
        toggle.textContent = '▼';
        toggle.style.cssText = 'cursor:pointer;font-size:10px;color:var(--color-text-dim);';
        head.appendChild(toggle);
        const nameLbl = document.createElement('span');
        nameLbl.style.cssText = 'font-weight:600;font-size:13px;color:var(--color-text-strong);';
        nameLbl.textContent = (idx + 1) + '. ' + this._headline(entry, kind);
        head.appendChild(nameLbl);
        const sum = document.createElement('span');
        sum.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
        sum.textContent = this._summary(entry, kind);
        head.appendChild(sum);
        head.appendChild(this._spacer());
        head.appendChild(this._button('▲', () => {
            if (idx === 0) return;
            entries[idx - 1] = [entries[idx], entries[idx] = entries[idx - 1]][0];
            section[meta.key] = DatabaseBattleEditor.encodeCollection(entries);
            this._renderCollection(content, section, meta);
        }));
        head.appendChild(this._button('▼', () => {
            if (idx === entries.length - 1) return;
            entries[idx + 1] = [entries[idx], entries[idx] = entries[idx + 1]][0];
            section[meta.key] = DatabaseBattleEditor.encodeCollection(entries);
            this._renderCollection(content, section, meta);
        }));
        head.appendChild(this._button('Копия', () => {
            entries.splice(idx + 1, 0, JSON.parse(JSON.stringify(entry)));
            section[meta.key] = DatabaseBattleEditor.encodeCollection(entries);
            this._renderCollection(content, section, meta);
        }));
        head.appendChild(this._button('Удалить', () => {
            entries.splice(idx, 1);
            section[meta.key] = DatabaseBattleEditor.encodeCollection(entries);
            this._renderCollection(content, section, meta);
        }, 'danger'));

        const body = document.createElement('div');
        body.style.cssText = 'padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;';
        toggle.addEventListener('click', () => {
            const collapsed = body.style.display === 'none';
            body.style.display = collapsed ? 'grid' : 'none';
            toggle.textContent = collapsed ? '▼' : '▶';
        });

        for (const field of this._fieldDefs[kind]) {
            body.appendChild(this._renderField(entry, field));
        }

        card.appendChild(head);
        card.appendChild(body);
        return card;
    }

    _renderField(entry, field) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
        const label = document.createElement('label');
        label.style.cssText = 'font-size:11px;color:var(--color-text);font-weight:600;';
        label.textContent = this._tt(field.label);
        wrap.appendChild(label);
        if (field.hint) {
            const h = document.createElement('div');
            h.style.cssText = 'font-size:10px;color:var(--color-text-dim);line-height:1.3;';
            h.textContent = field.hint;
            wrap.appendChild(h);
        }

        if (field.type === 'select') {
            const sel = document.createElement('select');
            sel.style.cssText = this._inputCss();
            for (const [val, lbl] of field.options) {
                const o = document.createElement('option');
                o.value = val; o.textContent = this._tt(lbl);
                sel.appendChild(o);
            }
            sel.value = String(entry[field.key] !== undefined ? entry[field.key] : (field.options[0][0]));
            sel.addEventListener('change', () => { entry[field.key] = sel.value; });
            wrap.appendChild(sel);
            return wrap;
        }

        const input = document.createElement('input');
        input.type = field.type === 'number' ? 'number' : 'text';
        if (field.type === 'number') {
            if (field.min !== undefined) input.min = field.min;
            if (field.step) input.step = field.step;
        }
        input.value = entry[field.key] !== undefined ? entry[field.key] : '';
        input.style.cssText = this._inputCss() + (field.type === 'number' ? 'width:84px;' : '');
        input.addEventListener('input', () => {
            if (field.type === 'number') {
                const n = Number(input.value);
                if (!Number.isNaN(n)) entry[field.key] = n;
            } else {
                entry[field.key] = input.value;
            }
        });
        wrap.appendChild(input);
        return wrap;
    }

    _inputCss() {
        return `
            width:100%;padding:5px 8px;font-size:12px;box-sizing:border-box;
            background-color:var(--color-bg-deep);color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
    }

    _spacer() {
        const el = document.createElement('div');
        el.style.cssText = 'flex:1;';
        return el;
    }

    _button(text, onClick, kind = '') {
        const btn = document.createElement('button');
        btn.textContent = this._tt(text);
        btn.style.cssText = `
            padding:4px 12px;font-size:12px;cursor:pointer;
            background-color:${kind === 'danger' ? 'var(--color-danger, #b33)' : 'var(--color-bg-deep)'};
            color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
        btn.addEventListener('click', onClick);
        return btn;
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseBattleEditor = DatabaseBattleEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseBattleEditor;
}
