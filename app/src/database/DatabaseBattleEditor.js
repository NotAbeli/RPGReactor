/**
 * DatabaseBattleEditor - the combat collections (S27: classic list API).
 *
 * The Бой tab drives the classic list panel itself (DatabaseEditorUI.
 * _renderClassicCollectionTab); this editor exposes each MV collection
 * (Melee List / Projectile List / Tracer List / Dash Database) plus the
 * single-record inspector form via classicApi(kind).
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
            { section: 'battle', key: 'Melee List', kind: 'melee' },
            { section: 'battle', key: 'Projectile List', kind: 'projectile' },
            { section: 'battle', key: 'Tracer List', kind: 'tracer' },
            { section: 'dash', key: 'Dash Database', kind: 'dash' },
            // P3: Арсенал — справочник оружий ГГ (живёт в секции enemies,
            // мост доставляет её в SuperDuperEnemies целиком).
            { section: 'enemies', key: 'Weapon List', kind: 'weapons' }
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
                    { key: 'Range', label: 'Радиус (тайлы)', type: 'slider', min: 0, max: 6, step: 0.1, unit: 'т' },
                    { key: 'Width', label: 'Ширина (px)', type: 'slider', min: 0, max: 300, step: 4, unit: 'px' },
                    { key: 'Duration', label: 'Длительность (кадры)', type: 'slider', min: 1, max: 60, step: 1, unit: 'f' }
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
                    { key: 'Speed', label: 'Скорость (px/кадр)', type: 'slider', min: 0, max: 20, step: 0.1, unit: 'px/f' },
                    { key: 'Distance', label: 'Дистанция (тайлы)', type: 'slider', min: 0, max: 30, step: 0.5, unit: 'т' },
                    { key: 'Hitbox', label: 'Хитбокс (px)', type: 'slider', min: 4, max: 96, step: 2, unit: 'px' },
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
                    { key: 'MaxRange', label: 'Дальность (тайлы)', type: 'slider', min: 0, max: 30, step: 0.5, unit: 'т' },
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
                    { key: 'SpeedMultiplier', label: 'Множитель скорости', type: 'slider', min: 0, max: 10, step: 0.1, unit: '×' },
                    { key: 'Duration', label: 'Длительность (кадры)', type: 'slider', min: 1, max: 60, step: 1, unit: 'f' },
                    { key: 'Decay', label: 'Затухание', type: 'slider', min: 0, max: 5, step: 0.1, hint: '1.5 = плавно теряет скорость' },
                    { key: 'Cooldown', label: 'Кулдаун (кадры)', type: 'slider', min: 0, max: 300, step: 5, unit: 'f' },
                    { key: 'MaxCharges', label: 'Заряды', type: 'slider', min: 1, max: 10, step: 1 },
                    { key: 'SE', label: 'Звук (audio/se)', type: 'text' }
                ]
            },
            weapons: {
                id: [
                    { key: 'name', label: 'Название', type: 'text' },
                    { key: 'varValue', label: 'var ГГ (var 17)', type: 'number', hint: 'значение облика/оружия ГГ — связь со скином Спрайтера' },
                    { key: 'type', label: 'Тип', type: 'select', options: [['melee', 'Ближнее'], ['ranged', 'Дальнее'], ['tool', 'Инструмент'], ['light', 'Свет']], def: 'melee' }
                ],
                attack: [
                    { key: 'attackId', label: '№ атаки (БД Боя)', type: 'number', hint: 'performMelee/performProjectile ID' },
                    { key: 'dashName', label: 'Имя рывка', type: 'text', hint: 'из Dash Database; пусто = без рывка' },
                    { key: 'windup', label: 'Замах (кадры)', type: 'slider', min: 0, max: 60, step: 1, unit: 'f', hint: 'задержка перед ударом' },
                    { key: 'cooldown', label: 'Кулдаун (кадры)', type: 'slider', min: 0, max: 300, step: 1, unit: 'f' },
                    { key: 'staminaCost', label: 'Расход стамины', type: 'slider', min: 0, max: 100, step: 5 },
                    { key: 'attackSe', label: 'Звук атаки (audio/se)', type: 'text' },
                    { key: 'swingSwitch', label: 'Свитч анимации замаха', type: 'number', hint: 'switch для скина удара в Спрайтере' }
                ],
                effects: [
                    { key: 'damage', label: 'Урон по врагу', type: 'number', hint: 'отрицательное; одинаково для пули и удара' },
                    { key: 'stun', label: 'Время стана (кадры)', type: 'slider', min: 0, max: 300, step: 5, unit: 'f', hint: 'враг замирает после удара' },
                    { key: 'knockback', label: 'Отбрасывание (тайлы)', type: 'slider', min: 0, max: 5, step: 0.5, unit: 'т', hint: 'враг отлетает от игрока' },
                    { key: 'sneakKill', label: 'Скрытное убийство', type: 'check', hint: 'вне боя — насмерть' },
                    { key: 'noise', label: 'Шум (радиус слуха)', type: 'number', hint: 'справочно; применение — позже' },
                    { key: 'se', label: 'Звук попадания (audio/se)', type: 'text' },
                    { key: 'fireRadius', label: 'Эффект огня (радиус)', type: 'number', hint: '0 = нет; для пистолета 350' },
                    { key: 'fireColor', label: 'Цвет огня', type: 'text', hint: '#e97451 по умолчанию' },
                    { key: 'fireFrames', label: 'Длительность огня (кадры)', type: 'number', hint: 'сколько кадров горит эффект' }
                ]
            }
        };

        this._blanks = {
            melee: { ID: '1', PID: 1, Name: 'Новая атака', Source: 0, Target: 0, Shape: 'arc', Range: 1.5, Width: 96, Duration: 8, Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            projectile: { ID: '1', PID: 1, Name: 'Новый снаряд', Source: 0, Target: 0, Graphic: '', Speed: 8, Distance: 12, Hitbox: 24, Z: 3, Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            tracer: { ID: '1', PID: 1, Name: 'Новый трассер', Source: 0, Target: 0, MaxRange: 10, Color: '#ffffff', Regions: '', Terrains: '', AnimID: 0, ActionsEvent: 0, ActionsPlayer: 0, ActionsShooter: 0 },
            dash: { Name: 'Рывок', TargetMode: '0', MaxCharges: 1, SpeedMultiplier: 3.0, Duration: 15, Decay: 1.5, Cooldown: 20, SE: 'Wind7' },
            weapons: { name: 'Оружие', varValue: 0, type: 'melee', attackId: 1, dashName: '', windup: 4, cooldown: 3, staminaCost: 25, attackSe: '', swingSwitch: 15, damage: -20, stun: 0, knockback: 0, sneakKill: 'false', noise: 0, se: '', fireRadius: 0, fireColor: '#e97451', fireFrames: 6 }
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
    // Classic list-panel API for one collection kind (S27).
    // ------------------------------------------------------------------

    classicApi(kind) {
        const meta = this.collectionKeys.find(c => c.kind === kind) || this.collectionKeys[0];
        const section = this.getSection(meta.section);
        const K = DatabaseBattleEditor;
        return {
            entries: () => K.decodeCollection(section[meta.key]),
            persist: list => { section[meta.key] = K.encodeCollection(list); },
            blank: () => JSON.parse(JSON.stringify(this._blanks[meta.kind])),
            label: (r, i) => meta.kind === 'dash'
                ? (r.Name || 'Рывок')
                : meta.kind === 'weapons'
                    ? (r.name || 'Оружие')
                    : (i + 1) + '. ' + (r.Name || r.ID || '—'),
            search: r => [r.Name, r.ID, r.name, r.varValue].join(' '),
            renderDetail: (wrapper, record, idx, commit) => {
                const defs = this._fieldDefs[meta.kind];
                const groups = [
                    ['Идентификация', defs.id],
                    ['Геометрия и попадание', defs.geometry],
                    ['Ограничения', defs.limits],
                    ['Реакции при попадании', defs.reactions]
                ].filter(([, fields]) => fields);

                const head = meta.kind === 'dash'
                    ? (record.Name || 'Рывок')
                    : meta.kind === 'weapons'
                        ? (record.name || 'Оружие')
                        : ((idx + 1) + '. ' + (record.Name || record.ID || '—'));
                const form = new InspectorForm();
                form.head(this._tt(head), this._summary(record, meta.kind));
                for (const [title, fields] of groups) {
                    form.fields(fields, record, { section: this._tt(title), commit });
                }
                form.mount(wrapper);
            }
        };
    }

    _summary(r, kind) {
        if (kind === 'melee') return (r.Shape || 'arc') + ' · R' + r.Range + ' · ' + r.Duration + 'f';
        if (kind === 'projectile') return 'v' + r.Speed + ' · D' + r.Distance + ' · hb' + r.Hitbox;
        if (kind === 'tracer') return '≤' + r.MaxRange + ' · ' + r.Color;
        if (kind === 'weapons') return 'var ' + (r.varValue || 0) + ' · ' + (r.damage || 0) + (String(r.sneakKill) === 'true' ? ' · скрытно' : '');
        return '×' + r.SpeedMultiplier + ' · ' + r.Duration + 'f · cd' + r.Cooldown;
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseBattleEditor = DatabaseBattleEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseBattleEditor;
}
