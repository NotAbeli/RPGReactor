/**
 * DatabaseEnemiesEditor - enemy behaviour database tab: EnemyDatabase
 * cards (match tag, HP, sensors, custom flag rules) plus the flat global
 * settings of SuperDuperEnemies (tick rate, variables, weapon conditions).
 *
 * Data lives in the Agonia sidecar section `enemies` (data/AgoniaEngine.json);
 * EnemyDatabase is an MV-format collection string (array of JSON-object
 * strings) matching the plugin's parser.
 *
 * Struct fields mirror the plugin's @param structs:
 *   EnemyDef:    id, match, hp, scope, attackRadius, calmRadius, calmTime,
 *                hearingRadius, hearingThreshold, panicContactTime,
 *                panicTotalTime, customRules
 *   CustomFlagRule: flag, conditions, activationDelay, holdTime, moveSpeed,
 *                hpMinPct, hpMaxPct, reqSwitch, reqVarId, reqVarVal
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
        wrapper.className = 'agonia-content';
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow-y:auto;';

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
        banner.textContent = this._tt('Враги');
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
        sub.textContent = this._tt('База поведения врагов: сенсоры, паника, кастомные правила');
        banner.appendChild(sub);
        wrapper.appendChild(banner);

        // --- Globals ---
        wrapper.appendChild(this._sectionTitle('Глобальные настройки'));
        const globalsGrid = document.createElement('div');
        globalsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:4px 16px;';
        const globalFields = [
            { key: 'TickRate', label: 'Tick Rate', type: 'number', hint: 'Обновление ИИ раз в N кадров' },
            { key: 'VariableBaseId', label: 'Базовая переменная', type: 'number', hint: 'Враги пишут состояние в vars id*100+n' },
            { key: 'HearingVariable', label: 'Переменная шума', type: 'number' },
            { key: 'NoCombatSwitch', label: 'Свитч «без боя»', type: 'number' },
            { key: 'CombatCountVariable', label: 'Переменная счёта боя', type: 'number' },
            { key: 'GlobalResetSwitch', label: 'Свитч глобального сброса', type: 'number' }
        ];
        for (const f of globalFields) {
            globalsGrid.appendChild(this._numField(enemies, f));
        }
        const gun = enemies['GunCondition'];
        const melee = enemies['MeleeCondition'];
        const weaponCard = this._panel();
        const wTitle = document.createElement('div');
        wTitle.style.cssText = 'font-weight:600;font-size:13px;color:var(--color-text-strong);';
        wTitle.textContent = this._tt('Условия оружия (Gun/Melee Condition)');
        weaponCard.appendChild(wTitle);
        const wHint = document.createElement('div');
        wHint.style.cssText = 'font-size:10px;color:var(--color-text-dim);line-height:1.4;';
        wHint.textContent = this._tt('JSON вида {"switchId":0,"variableId":17,"variableValues":"37, 36"} — когда враг может стрелять / бить вблизи');
        weaponCard.appendChild(wHint);
        for (const key of ['GunCondition', 'MeleeCondition']) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
            const l = document.createElement('label');
            l.style.cssText = 'font-size:11px;font-weight:600;color:var(--color-text);';
            l.textContent = key === 'GunCondition' ? 'Gun Condition' : 'Melee Condition';
            wrap.appendChild(l);
            const input = document.createElement('input');
            input.type = 'text';
            input.value = typeof enemies[key] === 'string' ? enemies[key] : JSON.stringify(enemies[key] || {});
            input.style.cssText = this._inputCss() + 'font-family:monospace;font-size:11px;';
            input.addEventListener('input', () => { enemies[key] = input.value; });
            wrap.appendChild(input);
            weaponCard.appendChild(wrap);
        }
        globalsGrid.appendChild(weaponCard);
        wrapper.appendChild(globalsGrid);

        // --- Enemy cards ---
        wrapper.appendChild(this._sectionTitle('База врагов (EnemyDatabase)'));
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);padding:0 16px 8px;';
        hint.textContent = this._tt('match — тег в Note события (например <box>); сенсоры в тайлах; custom rules — правила смены флагов по условиям');
        wrapper.appendChild(hint);

        const cardsHost = document.createElement('div');
        cardsHost.className = 'agonia-cards';
        cardsHost.style.cssText = 'padding:0 16px 16px;';
        wrapper.appendChild(cardsHost);

        this._renderEnemies(cardsHost, enemies);
        container.appendChild(wrapper);
    }

    _renderEnemies(host, enemies) {
        const entries = DatabaseEnemiesEditor.decodeCollection(enemies['EnemyDatabase']);
        host.innerHTML = '';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;padding-bottom:10px;';
        const count = document.createElement('span');
        count.style.cssText = 'font-size:12px;color:var(--color-text-dim);';
        count.textContent = entries.length + ' ' + this._tt('записей');
        header.appendChild(count);
        header.appendChild(this._spacer());
        header.appendChild(this._button('Добавить', () => {
            entries.push(DatabaseEnemiesEditor.blankEnemy());
            enemies['EnemyDatabase'] = DatabaseEnemiesEditor.encodeCollection(entries);
            this._renderEnemies(host, enemies);
        }));
        host.appendChild(header);

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:30px 0;font-size:13px;';
            empty.textContent = this._tt('Записей нет — нажмите «Добавить»');
            host.appendChild(empty);
            return;
        }

        entries.forEach((entry, idx) => {
            host.appendChild(this._renderEnemyCard(entries, idx, enemies, host));
        });
    }

    _renderEnemyCard(entries, idx, enemies, host) {
        const entry = entries[idx];
        const card = this._panel();
        card.style.marginBottom = '12px';

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const name = document.createElement('span');
        name.style.cssText = 'font-weight:600;font-size:13px;color:var(--color-text-strong);';
        name.textContent = (idx + 1) + '. ' + (entry.match || '—') + ' · HP ' + (entry.hp || '?');
        head.appendChild(name);
        const sum = document.createElement('span');
        sum.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
        sum.textContent = 'atk R' + (entry.attackRadius || '?') + ' · hear R' + (entry.hearingRadius || '?');
        head.appendChild(sum);
        head.appendChild(this._spacer());
        head.appendChild(this._button('▲', () => {
            if (idx === 0) return;
            entries[idx - 1] = [entries[idx], entries[idx] = entries[idx - 1]][0];
            enemies['EnemyDatabase'] = DatabaseEnemiesEditor.encodeCollection(entries);
            this._renderEnemies(host, enemies);
        }));
        head.appendChild(this._button('▼', () => {
            if (idx === entries.length - 1) return;
            entries[idx + 1] = [entries[idx], entries[idx] = entries[idx + 1]][0];
            enemies['EnemyDatabase'] = DatabaseEnemiesEditor.encodeCollection(entries);
            this._renderEnemies(host, enemies);
        }));
        head.appendChild(this._button('Копия', () => {
            entries.splice(idx + 1, 0, JSON.parse(JSON.stringify(entry)));
            enemies['EnemyDatabase'] = DatabaseEnemiesEditor.encodeCollection(entries);
            this._renderEnemies(host, enemies);
        }));
        head.appendChild(this._button('Удалить', () => {
            entries.splice(idx, 1);
            enemies['EnemyDatabase'] = DatabaseEnemiesEditor.encodeCollection(entries);
            this._renderEnemies(host, enemies);
        }, 'danger'));
        card.appendChild(head);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;';
        const numFields = [
            ['id', 'ID'], ['hp', 'HP'],
            ['attackRadius', 'Радиус атаки'], ['calmRadius', 'Радиус спокойствия'],
            ['calmTime', 'Время успокоения (f)'], ['hearingRadius', 'Радиус слуха'],
            ['hearingThreshold', 'Порог шума'], ['panicContactTime', 'Контакт → паника (f)'],
            ['panicTotalTime', 'Полная паника (f)'], ['scope', 'Область видимости']
        ];
        for (const [key, label] of numFields) {
            grid.appendChild(this._enemyNumField(entry, key, label));
        }
        const matchWrap = document.createElement('div');
        matchWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
        const ml = document.createElement('label');
        ml.style.cssText = 'font-size:11px;font-weight:600;color:var(--color-text);';
        ml.textContent = this._tt('match-тег (Note события)');
        matchWrap.appendChild(ml);
        const mi = document.createElement('input');
        mi.type = 'text';
        mi.value = entry.match || '';
        mi.style.cssText = this._inputCss() + 'width:84px;';
        mi.addEventListener('input', () => { entry.match = mi.value; });
        matchWrap.appendChild(mi);
        grid.appendChild(matchWrap);
        card.appendChild(grid);

        // custom rules
        card.appendChild(this._renderRules(entry));
        return card;
    }

    _renderRules(entry) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const t = document.createElement('div');
        t.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text);';
        t.textContent = this._tt('Кастомные правила (флаги поведения)');
        titleRow.appendChild(t);
        titleRow.appendChild(this._spacer());
        titleRow.appendChild(this._button('+ правило', () => {
            const rules = DatabaseEnemiesEditor.decodeCollection(entry.customRules);
            rules.push(DatabaseEnemiesEditor.blankRule());
            entry.customRules = DatabaseEnemiesEditor.encodeCollection(rules);
            wrap.replaceWith(this._renderRules(entry));
        }));
        wrap.appendChild(titleRow);

        const rules = DatabaseEnemiesEditor.decodeCollection(entry.customRules);
        if (!rules.length) {
            const none = document.createElement('div');
            none.style.cssText = 'font-size:11px;color:var(--color-text-dim);';
            none.textContent = this._tt('Нет правил — только базовые сенсоры');
            wrap.appendChild(none);
            return wrap;
        }

        rules.forEach((rule, rIdx) => {
            const row = document.createElement('div');
            row.style.cssText = `
                display:grid;grid-template-columns:110px 70px 70px 70px 70px 70px 70px 70px 70px auto;
                gap:6px;align-items:end;padding:6px;border:1px solid var(--color-border);
                border-radius:4px;background-color:var(--color-bg-deep);
            `;
            const mk = (key, label) => {
                const w = document.createElement('div');
                w.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
                const l = document.createElement('label');
                l.style.cssText = 'font-size:10px;color:var(--color-text);';
                l.textContent = label;
                w.appendChild(l);
                const i = document.createElement('input');
                i.type = key === 'flag' || key === 'conditions' ? 'text' : 'number';
                i.value = rule[key] !== undefined ? rule[key] : '';
                i.style.cssText = 'width:100%;padding:3px 5px;font-size:11px;box-sizing:border-box;background-color:var(--color-bg-panel);color:var(--color-text-strong);border:1px solid var(--color-border);border-radius:3px;';
                i.addEventListener('input', () => {
                    if (i.type === 'number') {
                        const n = Number(i.value);
                        if (!Number.isNaN(n)) rule[key] = n;
                    } else rule[key] = i.value;
                });
                w.appendChild(i);
                return w;
            };
            row.appendChild(mk('flag', 'флаг'));
            row.appendChild(mk('conditions', 'условие'));
            row.appendChild(mk('activationDelay', 'задержка'));
            row.appendChild(mk('holdTime', 'удержание'));
            row.appendChild(mk('moveSpeed', 'скорость'));
            row.appendChild(mk('hpMinPct', 'HP мин %'));
            row.appendChild(mk('hpMaxPct', 'HP макс %'));
            row.appendChild(mk('reqSwitch', 'свитч'));
            row.appendChild(mk('reqVarId', 'var id'));
            row.appendChild(this._button('✕', () => {
                rules.splice(rIdx, 1);
                entry.customRules = DatabaseEnemiesEditor.encodeCollection(rules);
                wrap.replaceWith(this._renderRules(entry));
            }, 'danger'));
            wrap.appendChild(row);
        });
        return wrap;
    }

    // -- shared small helpers (same idioms as DatabaseBattleEditor) --

    _sectionTitle(text) {
        const el = document.createElement('div');
        el.style.cssText = 'padding:12px 16px 4px;font-size:15px;font-weight:600;color:var(--color-text-strong);';
        el.textContent = this._tt(text);
        return el;
    }

    _panel() {
        const el = document.createElement('div');
        el.style.cssText = `
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border); border-radius: 6px;
            padding: 12px; display: flex; flex-direction: column; gap: 10px;
        `;
        return el;
    }

    _numField(holder, f) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
        const l = document.createElement('label');
        l.style.cssText = 'font-size:11px;font-weight:600;color:var(--color-text);';
        l.textContent = this._tt(f.label);
        wrap.appendChild(l);
        if (f.hint) {
            const h = document.createElement('div');
            h.style.cssText = 'font-size:10px;color:var(--color-text-dim);';
            h.textContent = f.hint;
            wrap.appendChild(h);
        }
        const i = document.createElement('input');
        i.type = 'number';
        i.value = holder[f.key] !== undefined ? holder[f.key] : 0;
        i.style.cssText = this._inputCss();
        i.addEventListener('input', () => {
            const n = Number(i.value);
            if (!Number.isNaN(n)) holder[f.key] = n;
        });
        wrap.appendChild(i);
        return wrap;
    }

    _enemyNumField(entry, key, label) {
        return this._numField(entry, { key, label, type: 'number' });
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
    window.DatabaseEnemiesEditor = DatabaseEnemiesEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseEnemiesEditor;
}
