/**
 * S51: НПС-режим — EnemyInspectorManager.
 * Проверки: поиск заглушек врагов и их карточек, запись поля в карточку БД
 * (MV-строка round-trip + обновление ссылки), правка позиции события,
 * блок зависимостей, рендер панели без throw.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(tag) {
    const el = {
        tagName: tag, style: {}, children: [], dataset: {},
        _listeners: {}, _innerHTML: '', textContent: '', value: '', type: '', checked: false,
        className: '', title: '',
        appendChild(child) { child._parent = this; this.children.push(child); return child; },
        removeChild(c) { this.children = this.children.filter(x => x !== c); },
        addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
        removeEventListener() { },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        setAttribute() { }, getAttribute() { return null; },
        destroy() { this.children = []; this.parent = null; }
    };
    Object.defineProperty(el, 'innerHTML', {
        get() { return this._innerHTML; },
        set(v) { this._innerHTML = String(v); this.children = []; }
    });
    return el;
}

function loadManager() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'EnemyInspectorManager.js'), 'utf8');
    const ctx = {
        console: { log() { }, warn() { }, error() { } },
        document: { createElement: t => makeElement(t), createTextNode: t => ({ textContent: t }), getElementById: () => null, body: makeElement('body') },
        window: undefined
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src + '\nthis.EnemyInspectorManager = EnemyInspectorManager;', ctx, { filename: 'EnemyInspectorManager.js' });
    return ctx.EnemyInspectorManager;
}

const enc = cards => JSON.stringify(cards.map(c => JSON.stringify(c)));

function makeEnv() {
    const EIM = loadManager();
    const agonia = {
        enemies: { EnemyDatabase: enc([
            { id: '2', match: '<box>', hp: '50' },
            { id: '3', match: '<biba>', hp: '100', template: 'true', spriteName: 'Enemy 1', spriteIndex: '0',
              attackRadius: '2', hearingRadius: '3', hearingThreshold: '3',
              chaseThreshold: '2', cowerThreshold: '3',
              damageFists: '-20', damageSE: 'Damage2' }
        ]),
        'Weapon List': enc([
            { name: 'Лом', varValue: '2', type: 'melee', damage: '-20', sneakKill: 'true', se: 'Damage2' },
            { name: 'Ствол', varValue: '37', type: 'ranged', damage: '-100', sneakKill: 'false', se: '' }
        ]) },
        battle: { 'Tracer List': enc([{ id: '1', Name: 'Очередь' }]), 'Melee List': enc([{ id: '2', Name: 'Кувалда' }]) }
    };
    const dbm = {
        data: { agonia },
        saveAgonia: async () => true
    };
    const calls = { render: 0, del: 0 };
    const map = {
        id: 45, width: 40, height: 30,
        events: [null,
            { id: 1, name: 'chest', note: '', x: 5, y: 5 },
            { id: 12, name: 'ENEMY biba', note: '<biba> <step_se>', x: 33, y: 17 }
        ]
    };
    const emMock = {
        getEventAt: (x, y) => map.events.find(e => e && e.x === x && e.y === y) || null,
        createEnemyStub: (x, y, tpl) => { const ev = { id: 99, name: 'NEW', note: String(tpl.match), x, y, pages: [] }; map.events.push(ev); return ev; },
        saveState() { },
        renderEvents() { calls.render++; },
        deleteEvent(ev) { calls.del++; map.events[map.events.indexOf(ev)] = null; }
    };
    const eim = new EIM({ getCurrentProject: () => ({ path: 'X:/proj' }) }, dbm, emMock);
    eim.currentMap = map;
    eim.tilemapManager = { container: { cursor: '' }, TILE_WIDTH: 48 };
    return { eim, agonia, map, calls, biba: () => map.events.find(e => e && e.id === 12) };
}

test('getEnemyStubs/findTemplateFor: только заглушки с template-карточкой', () => {
    const { eim, map, biba } = makeEnv();
    const stubs = eim.getEnemyStubs();
    assert.strictEqual(stubs.length, 1, 'only the biba stub');
    assert.strictEqual(stubs[0].id, 12);
    assert.strictEqual(eim.findTemplateFor(map.events.find(e => e && e.id === 1)), null, 'chest is not an enemy');
    const tpl = eim.findTemplateFor(biba());
    assert.ok(tpl && tpl.match === '<biba>');
});

test('_attackLabel: резолвит имя карточки Боя по номеру', () => {
    const { eim } = makeEnv();
    assert.ok(eim._attackLabel('Tracer List', 1).includes('Очередь'));
    assert.ok(eim._attackLabel('Melee List', 2).includes('Кувалда'));
    assert.strictEqual(eim._attackLabel('Tracer List', 0), '—');
});

test('_saveCard: пишет в MV-строку БД и обновляет выбранную карточку', () => {
    const { eim, agonia, biba } = makeEnv();
    eim.select(biba());
    assert.ok(eim._saveCard('<biba>', 'hp', '250'));
    const arr = JSON.parse(agonia.enemies['EnemyDatabase']).map(e => JSON.parse(e));
    const card = arr.find(o => o.match === '<biba>');
    assert.strictEqual(card.hp, '250');
    assert.strictEqual(eim.selectedTemplate.hp, '250', 'live ref updated');
    assert.ok(eim._dirtyCard, 'dirty flag set');
    // не-шаблонная карточка не трогается
    const box = arr.find(o => o.match === '<box>');
    assert.strictEqual(box.hp, '50');
});

test('_saveEventField: X/Y двигают событие с ре-рендером, имя пишется', () => {
    const { eim, map, calls, biba } = makeEnv();
    eim.select(biba());
    eim._saveEventField('x', '10');
    eim._saveEventField('name', 'ENEMY biba v2');
    assert.strictEqual(biba().x, 10);
    assert.strictEqual(biba().name, 'ENEMY biba v2');
    assert.ok(calls.render >= 2, 'renderEvents called per edit');
    // за краями карты не двигает
    eim._saveEventField('x', '999');
    assert.strictEqual(biba().x, 10);
});

test('панель: рендерится без throw, несёт секции и шаблоны', () => {
    const { eim, biba } = makeEnv();
    eim.setNpcMode(true);
    assert.ok(eim.panelEl, 'panel mounted');
    let html = eim.panelEl.innerHTML;
    assert.ok(html.includes('Кликните по врагу'), 'empty-state hint before selection');
    eim.select(biba());
    html = eim.panelEl.innerHTML;
    for (const s of ['Визуал', 'Характер', 'Способности', 'Скорость', 'Поведение', 'Урон по врагу', 'Флаги ИИ', 'На карте', 'Состояния (графика + звук)']) {
        assert.ok(html.includes(s), 'section missing: ' + s);
    }
    // P3: мусор убран — секции «Карточка» и «От чего зависит» больше нет
    assert.ok(!html.includes('От чего зависит'), 'deps section removed');
    // P3: двухколоночная компоновка + нижняя полоса, без скролла.
    // Треки minmax(0,1fr) + ячейки min-width:0 — иначе grid-blowout
    // выдавливает вторую колонку за край панели (S37b/P3c).
    assert.ok(html.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)'), 'two-column grid with shrinkable tracks');
    assert.ok(html.includes('style="min-width:0;"'), 'column wrappers shrinkable');
    assert.ok(html.includes('grid-column:1 / -1'), 'full-width bottom strip');
    // P3b: спрайт без превью — пикер «…» вместо индекса
    assert.ok(html.includes('data-eim-act="pick-sprite"'), 'sprite picker button');
    assert.ok(!html.includes('data-eim-preview'), 'preview image removed');
    assert.ok(!html.includes('data-eim-card="spriteIndex"'), 'index input removed (picker sets it)');
    // P5: спавн-полоса сверху + состояния + громкость шагов
    const raw = eim.panelEl.innerHTML;
    const stripIdx = raw.indexOf('data-eim-place');
    assert.ok(stripIdx > 0, 'spawn strip present');
    assert.ok(stripIdx < raw.indexOf('display:grid;grid-template-columns:minmax'), 'spawn strip ABOVE the columns');
    assert.ok(raw.includes('Громкость шагов'), 'step volume field');
    assert.ok(raw.includes('Состояния (графика + звук)'), 'states section');
    assert.ok(raw.includes('data-eim-state-gfx="attack"') && raw.includes('data-eim-state-se="death"'), 'state rows');
    assert.ok(!raw.includes('Поставить врага</div>'), 'old bottom placement section gone');
    // S52: характер-селект пишет в карточку
    assert.ok(html.includes('aggressive') && html.includes('peaceful'), 'disposition select options');
    assert.ok(html.includes('canPanic') && html.includes('canFlee') && html.includes('rememberGun'), 'ability checkboxes');
    assert.ok(html.includes('zona') && html.includes('panic') && html.includes('remembergun'), 'flags reference chips');
    assert.ok(html.includes('biba'), 'tag shown');
    assert.ok(html.includes('БД →'), 'open-db button in header');
    // P3: Арсенал — страх и таблица урона
    assert.ok(html.includes('Боится оружия'), 'fear block');
    assert.ok(html.includes('Лом') && html.includes('Ствол'), 'arsenal weapons listed');
    assert.ok(html.includes('data-eim-feared="2"') && html.includes('data-eim-feared="37"'), 'fear checkboxes');
    assert.ok(html.includes('data-eim-override="2"') && html.includes('data-eim-override="37"'), 'damage override inputs');
    assert.ok(html.includes('Без оружия (кулаки)'), 'fists fallback row');
    // выход из режима прячет панель
    eim.setNpcMode(false);
    assert.strictEqual(eim.panelEl.style.display, 'none');
});

test('P3: getWeapons читает Арсенал, страх пишет fearedWeapons в карточку', () => {
    const { eim, agonia, biba } = makeEnv();
    assert.strictEqual(eim.getWeapons().length, 2, 'arsenal readable');
    eim.select(biba());
    eim._saveCard('<biba>', 'fearedWeapons', '37');
    const arr = JSON.parse(agonia.enemies['EnemyDatabase']).map(e => JSON.parse(e));
    assert.strictEqual(arr.find(o => o.match === '<biba>').fearedWeapons, '37');
    assert.strictEqual(eim.selectedTemplate.fearedWeapons, '37', 'live ref updated');
});

test('выбор по клику: заглушка выбирается, чужие события нет', () => {
    const { eim } = makeEnv();
    eim.setNpcMode(true);
    eim._handlePointerDown({ data: { button: 0, getLocalPosition: () => ({ x: 33.5 * 48, y: 17.5 * 48 }) } });
    assert.ok(eim.selectedEvent && eim.selectedEvent.id === 12, 'biba selected by tile click');
    eim._handlePointerDown({ data: { button: 0, getLocalPosition: () => ({ x: 5.5 * 48, y: 5.5 * 48 }) } });
    assert.strictEqual(eim.selectedEvent, null, 'chest click clears selection');
});
