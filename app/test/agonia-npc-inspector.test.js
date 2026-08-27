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
              damageMeleeVar: '2', damageGunVar: '37', damageMelee: '-100', damageFists: '-20',
              sneakKill: 'true' }
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

test('_dependencyLines: пороги, урон и скрытное убийство в блоке зависимостей', () => {
    const { eim } = makeEnv();
    const lines = eim._dependencyLines(eim.getTemplates().find(t => t.match === '<biba>')).join('\n');
    assert.ok(lines.includes('погоня при ≥ 2'), 'chase threshold');
    assert.ok(lines.includes('приседание при ≥ 3'), 'cower threshold');
    assert.ok(lines.includes('2 → урон -100'), 'melee weapon damage');
    assert.ok(lines.includes('37 → -100'), 'gun weapon damage');
    assert.ok(lines.includes('скрытное убийство'), 'sneak kill');
});

test('панель: рендерится без throw, несёт секции и шаблоны', () => {
    const { eim, biba } = makeEnv();
    eim.setNpcMode(true);
    assert.ok(eim.panelEl, 'panel mounted');
    let html = eim.panelEl.innerHTML;
    assert.ok(html.includes('Кликните по врагу'), 'empty-state hint before selection');
    eim.select(biba());
    html = eim.panelEl.innerHTML;
    for (const s of ['Карточка', 'Визуал', 'Поведение', 'Урон по врагу', 'От чего зависит', 'На карте', 'Поставить врага']) {
        assert.ok(html.includes(s), 'section missing: ' + s);
    }
    assert.ok(html.includes('biba'), 'tag shown');
    assert.ok(html.includes('Открыть в БД'), 'open-db button');
    assert.ok(html.includes('Счётчик боя'), 'dependency line rendered');
    // выход из режима прячет панель
    eim.setNpcMode(false);
    assert.strictEqual(eim.panelEl.style.display, 'none');
});

test('выбор по клику: заглушка выбирается, чужие события нет', () => {
    const { eim } = makeEnv();
    eim.setNpcMode(true);
    eim._handlePointerDown({ data: { button: 0, getLocalPosition: () => ({ x: 33.5 * 48, y: 17.5 * 48 }) } });
    assert.ok(eim.selectedEvent && eim.selectedEvent.id === 12, 'biba selected by tile click');
    eim._handlePointerDown({ data: { button: 0, getLocalPosition: () => ({ x: 5.5 * 48, y: 5.5 * 48 }) } });
    assert.strictEqual(eim.selectedEvent, null, 'chest click clears selection');
});
