/**
 * DatabaseEnemiesEditor - the enemy AI tab (S18 rewrite): accordions.
 *
 * Global settings render as a compact panel on top; every enemy is an
 * accordion row whose head always shows the key metrics (match tag, HP,
 * attack/hearing radii); the body opens into Base / Sensors / Panic
 * sections. Custom flag rules nest as accordion rows of their own.
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
        content.className = 'agonia-content';
        content.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px;';
        wrapper.appendChild(content);
        container.appendChild(wrapper);

        // --- Globals ---
        const globalsSection = ShellKit.section(this._tt('Глобальные настройки'));
        const gWrap = document.createElement('div');
        gWrap.style.padding = '0 8px 8px;';
        globalsSection.appendChild(gWrap);
        content.appendChild(globalsSection);
        this._renderGlobals(gWrap, enemies);

        // --- Enemy list ---
        const enemiesTitle = ShellKit.section(this._tt('Враги (EnemyDatabase)'));
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:var(--color-text-dim);padding:0 8px 4px;line-height:1.4;';
        hint.textContent = this._tt('match — тег в Note события; сенсоры в тайлах. Клик по строке раскрывает настройку.');
        enemiesTitle.appendChild(hint);
        content.appendChild(enemiesTitle);

        const listHost = document.createElement('div');
        content.appendChild(listHost);
        this._renderEnemies(listHost, enemies);
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
        host.innerHTML = '';
        const grid = ShellKit.grid();
        const fields = [
            ['TickRate', 'Обновление ИИ (раз в N кадров)', 'number'],
            ['VariableBaseId', 'Базовая переменная', 'number', 'Враги пишут состояние в vars id*100+n'],
            ['HearingVariable', 'Переменная шума', 'number'],
            ['NoCombatSwitch', 'Свитч «без боя»', 'number'],
            ['CombatCountVariable', 'Переменная счёта боя', 'number'],
            ['GlobalResetSwitch', 'Свитч глобального сброса', 'number']
        ];
        for (const [key, label, type, hint] of fields) {
            grid.appendChild(ShellKit.field(this._tt(label),
                ShellKit.number(enemies[key], v => { enemies[key] = v; }, { min: 0 }), hint));
        }
        host.appendChild(grid);

        // Weapon conditions (JSON)
        const wgrid = ShellKit.grid();
        for (const key of ['GunCondition', 'MeleeCondition']) {
            const w = ShellKit.field(key === 'GunCondition' ? 'Условие стрельбы' : 'Условие ближнего боя',
                ShellKit.text(typeof enemies[key] === 'string' ? enemies[key] : JSON.stringify(enemies[key] || {}),
                    v => { enemies[key] = v; }, { placeholder: '{"switchId":0,"variableId":17,"variableValues":"37, 36"}' }),
                'JSON: switchId / variableId / variableValues — когда враг может стрелять или бить');
            wgrid.appendChild(w);
        }
        host.appendChild(wgrid);
    }

    _renderEnemies(host, enemies) {
        const K = DatabaseEnemiesEditor;
        const entries = K.decodeCollection(enemies['EnemyDatabase']);
        host.innerHTML = '';

        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;align-items:center;gap:12px;padding-bottom:8px;';
        const count = document.createElement('span');
        count.style.cssText = 'font-size:12px;color:var(--color-text-dim);';
        count.textContent = entries.length + ' ' + this._tt('записей');
        bar.appendChild(count);
        bar.appendChild((() => { const s = document.createElement('div'); s.style.flex = '1'; return s; })());
        const add = document.createElement('button');
        add.className = 'agonia-btn';
        add.textContent = 'Добавить врага';
        add.addEventListener('click', () => {
            entries.push(K.blankEnemy());
            enemies['EnemyDatabase'] = K.encodeCollection(entries);
            this._renderEnemies(host, enemies);
        });
        bar.appendChild(add);
        host.appendChild(bar);

        const acc = new AccordionList({
            items: entries,
            header: (e, i) => '#' + (i + 1) + ' ' + (e.match || '—') + ' · HP ' + (e.hp || '?'),
            sub: e => 'атака R' + (e.attackRadius || '?') + ' · слух R' + (e.hearingRadius || '?') +
                ' · правил: ' + (JSON.parse(e.customRules || '[]') || []).length,
            onRemove: idx => {
                entries.splice(idx, 1);
                enemies['EnemyDatabase'] = K.encodeCollection(entries);
                this._renderEnemies(host, enemies);
            },
            onReorder: (from, to) => {
                const [m] = entries.splice(from, 1);
                entries.splice(to, 0, m);
                enemies['EnemyDatabase'] = K.encodeCollection(entries);
                this._renderEnemies(host, enemies);
            },
            renderBody: (body, entry, idx, api) => this._renderEnemyBody(body, entry, api)
        });
        acc.mount(host);
    }

    _renderEnemyBody(body, entry, api) {
        // Base
        const base = ShellKit.section(this._tt('Базовое'));
        const bgrid = ShellKit.grid();
        bgrid.appendChild(ShellKit.field('match-тег (Note события)',
            ShellKit.text(entry.match, v => { entry.match = v; }), 'События с этим тегом получают поведение'));
        bgrid.appendChild(ShellKit.field('HP', ShellKit.number(entry.hp, v => { entry.hp = v; })));
        bgrid.appendChild(ShellKit.field('ID', ShellKit.number(entry.id, v => { entry.id = v; })));
        base.appendChild(bgrid);
        body.appendChild(base);

        // Sensors
        const sensors = ShellKit.section(this._tt('Сенсоры'));
        const sgrid = ShellKit.grid();
        const sFields = [
            ['attackRadius', 'Радиус атаки'], ['calmRadius', 'Радиус спокойствия'],
            ['calmTime', 'Успокоение (кадры)'], ['hearingRadius', 'Радиус слуха'],
            ['hearingThreshold', 'Порог шума'], ['scope', 'Область видимости']
        ];
        for (const [key, label] of sFields) {
            sgrid.appendChild(ShellKit.field(this._tt(label),
                ShellKit.number(entry[key], v => { entry[key] = v; })));
        }
        sensors.appendChild(sgrid);
        body.appendChild(sensors);

        // Panic
        const panic = ShellKit.section(this._tt('Паника'));
        const pgrid = ShellKit.grid();
        pgrid.appendChild(ShellKit.field('Контакт → паника (кадры)',
            ShellKit.number(entry.panicContactTime, v => { entry.panicContactTime = v; })));
        pgrid.appendChild(ShellKit.field('Полная паника (кадры)',
            ShellKit.number(entry.panicTotalTime, v => { entry.panicTotalTime = v; })));
        panic.appendChild(pgrid);
        body.appendChild(panic);

        // Rules
        body.appendChild(this._renderRules(entry));
    }

    _renderRules(entry) {
        const K = DatabaseEnemiesEditor;
        const wrap = document.createElement('div');
        const rules = K.decodeCollection(entry.customRules);

        const sec = ShellKit.section(this._tt('Кастомные правила (флаги поведения)'));
        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:0 8px 6px;';
        const note = document.createElement('span');
        note.style.cssText = 'font-size:10px;color:var(--color-text-dim);';
        note.textContent = this._tt('Смена флага при выполнении условия');
        bar.appendChild(note);
        bar.appendChild((() => { const s = document.createElement('div'); s.style.flex = '1'; return s; })());
        const add = document.createElement('button');
        add.className = 'agonia-btn';
        add.textContent = '+ Правило';
        add.addEventListener('click', () => {
            rules.push(K.blankRule());
            entry.customRules = K.encodeCollection(rules);
            wrap.replaceWith(this._renderRules(entry));
        });
        bar.appendChild(add);
        sec.appendChild(bar);

        const host = document.createElement('div');
        host.style.padding = '0 8px 8px;';
        sec.appendChild(host);

        if (!rules.length) {
            const none = document.createElement('div');
            none.style.cssText = 'font-size:11px;color:var(--color-text-dim);padding:4px 0;';
            none.textContent = this._tt('Нет правил — только базовые сенсоры');
            host.appendChild(none);
        } else {
            const acc = new AccordionList({
                items: rules,
                header: (r) => 'флаг ' + (r.flag || '?') + ' · ' + (r.conditions || '0') +
                    (Number(r.reqSwitch) > 0 ? ' · sw' + r.reqSwitch : ''),
                sub: r => 'hp ' + (r.hpMinPct || 0) + '–' + (r.hpMaxPct || 100) + '% · ск.' + (r.moveSpeed || 3),
                onRemove: idx => {
                    rules.splice(idx, 1);
                    entry.customRules = K.encodeCollection(rules);
                    wrap.replaceWith(this._renderRules(entry));
                },
                renderBody: (body, rule) => {
                    const grid = ShellKit.grid();
                    const mk = (label, key, type) => ShellKit.field(this._tt(label),
                        type === 'number'
                            ? ShellKit.number(rule[key], v => { rule[key] = v; })
                            : ShellKit.text(rule[key], v => { rule[key] = v; }));
                    grid.appendChild(mk('Флаг', 'flag', 'text'));
                    grid.appendChild(mk('Условие (0 И / 1 ИЛИ)', 'conditions', 'text'));
                    grid.appendChild(mk('Задержка (кадры)', 'activationDelay', 'number'));
                    grid.appendChild(mk('Удержание (кадры)', 'holdTime', 'number'));
                    grid.appendChild(mk('Скорость движения', 'moveSpeed', 'number'));
                    grid.appendChild(mk('HP мин %', 'hpMinPct', 'number'));
                    grid.appendChild(mk('HP макс %', 'hpMaxPct', 'number'));
                    grid.appendChild(mk('Требует свитч', 'reqSwitch', 'number'));
                    grid.appendChild(mk('Требует переменную', 'reqVarId', 'number'));
                    grid.appendChild(mk('Значение переменной', 'reqVarVal', 'number'));
                    body.appendChild(grid);
                }
            });
            acc.mount(host);
        }

        wrap.appendChild(sec);
        return wrap;
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseEnemiesEditor = DatabaseEnemiesEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseEnemiesEditor;
}
