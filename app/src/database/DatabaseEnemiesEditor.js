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
            customRules: '[]'
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

    showEnemiesDetail(container) {
        const enemies = this.getEnemies();

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
        wrapper.appendChild(this._stdBanner('ИИ врагов', 'База поведения: сенсоры, паника, кастомные правила'));

        const content = document.createElement('div');
        content.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px;';
        wrapper.appendChild(content);
        container.appendChild(wrapper);
        this.renderInto(content);
    }

    /** Content without the banner - embedded as the Battle tab's Враги (S21). */
    renderInto(container) {
        const enemies = this.getEnemies();
        container.innerHTML = '';

        // S20: two columns - enemy master-detail left, globals right (sticky).
        const layout = document.createElement('div');
        layout.style.cssText = 'display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;padding-top:8px;';
        container.appendChild(layout);

        const left = document.createElement('div');
        left.style.cssText = 'flex:1 1 560px;min-width:0;';
        layout.appendChild(left);

        const right = document.createElement('div');
        right.style.cssText = 'flex:0 0 360px;position:sticky;top:8px;';
        layout.appendChild(right);

        // --- Enemies (master-detail, left) ---
        const eTitle = document.createElement('div');
        eTitle.className = 'agonia-section-header';
        eTitle.style.cssText = 'padding:8px 0 2px;';
        eTitle.textContent = this._tt('Враги (EnemyDatabase)');
        left.appendChild(eTitle);
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);padding:0 0 8px;line-height:1.4;';
        hint.textContent = this._tt('match — тег в Note события; сенсоры в тайлах.');
        left.appendChild(hint);

        const host = document.createElement('div');
        host.style.cssText = 'height:640px;';
        left.appendChild(host);
        this._renderEnemies(host, enemies);

        // --- Globals (inspector, right) ---
        const gTitle = document.createElement('div');
        gTitle.className = 'agonia-section-header';
        gTitle.style.cssText = 'padding:8px 0 2px;';
        gTitle.textContent = this._tt('Глобальные настройки');
        right.appendChild(gTitle);
        this._renderGlobals(right, enemies);
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

    _renderGlobals(host, enemies) {
        const form = new InspectorForm();
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
    _renderEnemies(host, enemies) {
        const K = DatabaseEnemiesEditor;
        const entries = K.decodeCollection(enemies['EnemyDatabase']);
        host.innerHTML = '';

        const persist = () => { enemies['EnemyDatabase'] = K.encodeCollection(entries); };
        const rerender = () => this._renderEnemies(host, enemies);

        const shell = new MasterDetailShell({
            items: entries,
            searchText: r => [r.match, r.id, r.flag].join(' '),
            addLabel: 'Добавить врага',
            blank: () => K.blankEnemy(),
            onChanged: persist,
            title: (r, i) => '#' + (i + 1) + ' ' + (r.match || '—') + ' · HP ' + (r.hp || '?'),
            summary: r => 'атака R' + (r.attackRadius || '?') + ' · слух R' + (r.hearingRadius || '?') +
                ' · правил: ' + K.decodeCollection(r.customRules).length,
            renderForm: (formCol, entry, idx, api) => this._renderEnemyInspector(formCol, entry, idx, api)
        });
        shell.mount(host);
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
            { key: 'id', label: 'ID', type: 'number' }
        ], entry, { commit: () => api.changed() });

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

        // --- Rules: nested DataTable ---
        const rulesTitle = document.createElement('div');
        rulesTitle.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--color-text-dim);margin:16px 0 6px;';
        rulesTitle.textContent = this._tt('Кастомные правила (флаги поведения)');
        formCol.appendChild(rulesTitle);
        const rulesHost = document.createElement('div');
        formCol.appendChild(rulesHost);
        this._renderRules(rulesHost, entry, () => api.changed());
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
