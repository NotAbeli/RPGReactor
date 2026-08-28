/**
 * S50: стартовые маркеры (ГГ/транспорт) невидимы в редакторе.
 * Корень: MapEditor включает sortableChildren -> zIndex авторитетен,
 * applyLayerState даёт тайл-слоям z 10..90, events 950, но контейнеру
 * startingPositions никто не даёт zIndex (0 = похоронен под тайлами).
 * Фикс: initializeEventLayer назначает zIndex сам (applyLayerState на
 * загрузке карты выполняется ДО создания этих контейнеров) + label-проход
 * в applyLayerState страхует повторные вызовы из Layers Panel.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- PIXI-стабы (только то, что трогает EventManager) ---
class Container {
    constructor() {
        this.children = [];
        this.parent = null;
        this.label = '';
        this.visible = true;
        this.zIndex = 0;
    }
    addChild(c) { c.parent = this; this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter(x => x !== c); c.parent = null; }
    removeChildren() { const out = this.children; this.children = []; out.forEach(c => { c.parent = null; }); return out; }
    destroy() { this.children.forEach(c => { if (typeof c.destroy === 'function') c.destroy(); }); this.children = []; this.parent = null; }
}
class Graphics extends Container {
    constructor() { super(); this.ops = []; this.visible = true; }
    rect(...a) { this.ops.push(['rect', a]); return this; }
    fill(...a) { this.ops.push(['fill', a]); return this; }
    stroke(...a) { this.ops.push(['stroke', a]); return this; }
    clear() { this.ops.length = 0; return this; }
}
class Text extends Container {
    constructor(opts) {
        super();
        this.text = opts && opts.text;
        this.style = opts && opts.style;
        this.anchor = { set() { } };
    }
}

function loadEventManager() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'EventManager.js'), 'utf8');
    const ctx = {
        console: { log() { }, warn() { }, error() { } },
        document: { getElementById: () => null },
        PIXI: { Container, Graphics, Text },
        window: undefined
    };
    vm.createContext(ctx);
    // top-level class declarations live in the script's lexical scope,
    // not on the global object - re-export explicitly
    vm.runInContext(src + '\nthis.EventManager = EventManager;', ctx, { filename: 'EventManager.js' });
    if (!ctx.EventManager) throw new Error('EventManager did not load');
    return ctx.EventManager;
}

function makeTilemapManager() {
    return { container: new Container(), TILE_WIDTH: 48, TILE_HEIGHT: 48 };
}

test('initializeEventLayer: контейнеры получают zIndex над тайл-слоями (950/955/945)', () => {
    const EventManager = loadEventManager();
    const em = new EventManager({}, {});
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);

    assert.strictEqual(em.eventContainer.zIndex, 950, 'events z=950');
    assert.strictEqual(em.startingPositionContainer.zIndex, 955, 'startingPositions z=955 (S50)');
    assert.strictEqual(em.hoverHighlight.zIndex, 945, 'hover highlight z=945');
    assert.strictEqual(em.selectionHighlight.zIndex, 945, 'selection highlight z=945');
    // все живут в корневом контейнере карты
    assert.strictEqual(em.eventContainer.parent, tm.container);
    assert.strictEqual(em.startingPositionContainer.parent, tm.container);
});

test('renderStartingPositions: маркер игрока рисуется на своей карте и только на ней', () => {
    const EventManager = loadEventManager();
    const system = { startMapId: 45, startX: 3, startY: 4, boat: null, ship: null, airship: null };
    const em = new EventManager({}, { getSystem: () => system });
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45 };

    em.renderStartingPositions();
    assert.strictEqual(em.startingPositionContainer.children.length, 1, 'one player marker on map 45');
    const marker = em.startingPositionContainer.children[0];
    assert.strictEqual(marker.x, 3 * 48, 'marker at startX*48');
    assert.strictEqual(marker.y, 4 * 48, 'marker at startY*48');
    const label = marker.children.find(c => c instanceof Text);
    assert.ok(label && label.text === 'Player', 'marker carries the Player label');
    const box = marker.children.find(c => c instanceof Graphics);
    assert.ok(box && box.ops.some(o => o[0] === 'fill'), 'marker draws a filled rect');

    // стартовая точка на ДРУГОЙ карте — маркеров нет
    em.currentMap = { id: 7 };
    em.renderStartingPositions();
    assert.strictEqual(em.startingPositionContainer.children.length, 0, 'no markers on a foreign map');
});

test('setStartingPosition: пишет startMapId/X/Y и сразу рендерит маркер', async () => {
    const EventManager = loadEventManager();
    const system = { startMapId: 1, startX: 0, startY: 0 };
    const saved = [];
    const fakeController = { getCurrentProject: () => ({ path: 'X:/proj' }) };
    const em = new EventManager(fakeController, {
        getSystem: () => system,
        saveJSON: async (p, f, d) => saved.push({ p, f, d })
    });
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45 };

    await em.setStartingPosition(10, 12, 'player');
    assert.strictEqual(system.startMapId, 45, 'startMapId updated');
    assert.strictEqual(system.startX, 10);
    assert.strictEqual(system.startY, 12);
    assert.strictEqual(saved.length, 1, 'System.json saved once');
    assert.strictEqual(saved[0].f, 'System.json');
    assert.strictEqual(em.startingPositionContainer.children.length, 1, 'marker re-rendered immediately');
    assert.strictEqual(em.startingPositionContainer.children[0].x, 10 * 48);
});

test('P5: createEnemyStub наследует шаги-звуки карточки (<step_se> / <step_se:VOL>)', () => {
    const EventManager = loadEventManager();
    const em = new EventManager({}, {});
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45, width: 40, height: 30, events: [null] };

    const plain = em.createEnemyStub(3, 4, { match: '<biba>' });
    assert.ok(plain, 'stub created');
    assert.strictEqual(plain.note, '<biba> <step_se>', 'plain step tag without stepVolume');

    em.currentMap.events = [null];
    const loud = em.createEnemyStub(5, 6, { match: '<rat>', stepVolume: '80' });
    assert.strictEqual(loud.note, '<rat> <step_se:80>', 'volume tag from the card');
    assert.strictEqual(loud.pages[0].image.characterName, 'Enemy 1', 'default sprite');
    assert.ok(plain.pages[0].list.some(c => c.code === 108 && String(c.parameters[0]).includes('<collider>')),
        'stub page carries collider comments');
});

test('P7/P12: инструмент «Событие» — одиночный клик ставит тихо, редактор по двойному', () => {
    const EventManager = loadEventManager();
    const em = new EventManager({}, {});
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45, width: 40, height: 30, events: [null,
        { id: 7, name: 'chest', note: '', pages: [{ image: { characterName: '' } }], x: 5, y: 5 }
    ] };
    em.eventMode = true;
    let editorOpened = 0;
    em.editEvent = ev => { editorOpened++; };

    const click = (x, y) => em.handleMapPointerDown({
        data: { button: 0, originalEvent: {}, getLocalPosition: () => ({ x: (x + 0.5) * 48, y: (y + 0.5) * 48 }) }
    }, tm.container);

    // одиночный клик по пустой клетке — событие на карте, редактор НЕ открыт
    click(10, 10);
    assert.strictEqual(editorOpened, 0, 'no editor on single click');
    const placed = em.currentMap.events.filter(e => e && e.x === 10 && e.y === 10);
    assert.strictEqual(placed.length, 1, 'event placed silently');

    // клик по событию — выбор, ничего не создаётся
    const before = em.currentMap.events.filter(e => e).length;
    click(5, 5);
    assert.strictEqual(em.currentMap.events.filter(e => e).length, before, 'click on event does not create');
    assert.strictEqual(editorOpened, 0, 'still no editor');

    // инструмент выключен — клик по пустой не создаёт
    em.eventToolActive = false;
    click(20, 20);
    assert.strictEqual(em.currentMap.events.filter(e => e).length, before, 'tool off — no creation');

    // двойной клик по пустой — открывает редактор
    em.eventToolActive = true;
    const before2 = em.currentMap.events.filter(e => e).length;
    click(30, 28); // первый клик — тихая постановка
    click(30, 28); // второй сразу — двойной клик
    assert.strictEqual(em.currentMap.events.filter(e => e).length, before2 + 1, 'one event placed');
    assert.ok(editorOpened >= 1, 'double click opens the editor');
});

test('P8: взведённый вид врага — клик по пустой клетке в режиме событий ставит врага', () => {
    const EventManager = loadEventManager();
    const em = new EventManager({}, {});
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45, width: 40, height: 30, events: [null] };
    em.eventMode = true;
    let created = null;
    em.editEvent = ev => { created = ev; };
    const stubs = [];
    em.createEnemyStub = (x, y, tpl) => { const ev = { id: 50, name: 'ENEMY ' + tpl.match, note: tpl.match, x, y }; stubs.push(ev); return ev; };
    let armed = { match: '<biba>' };
    em._getArmedEnemyTemplate = () => armed;
    let disarmed = 0;
    em._disarmEnemyTemplate = () => { armed = null; disarmed++; };

    const click = (x, y) => em.handleMapPointerDown({
        data: { button: 0, originalEvent: {}, getLocalPosition: () => ({ x: (x + 0.5) * 48, y: (y + 0.5) * 48 }) }
    }, tm.container);

    click(12, 8);
    assert.strictEqual(created, null, 'no regular event created');
    assert.strictEqual(stubs.length, 1, 'enemy stub placed');
    assert.strictEqual(stubs[0].note, '<biba>', 'stub from the armed template');
    assert.strictEqual(disarmed, 1, 'placement disarmed after placing');
    assert.ok(armed === null, 'armed cleared');

    // после снятия — обычное поведение инструмента: тихая постановка
    armed = null;
    const evCountBefore = em.currentMap.events.filter(e => e).length;
    click(3, 3);
    assert.strictEqual(em.currentMap.events.filter(e => e).length, evCountBefore + 1, 'regular silent placement resumes');
    assert.strictEqual(created, null, 'editor still closed on single click');
    assert.strictEqual(stubs.length, 1, 'no extra stubs');
});

test('P10: взведённый шаблон события — клик по пустой клетке ставит копию', () => {
    const EventManager = loadEventManager();
    const em = new EventManager({}, {});
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45, width: 40, height: 30, events: [null] };
    em.eventMode = true;
    let created = null;
    em.editEvent = ev => { created = ev; };
    const placed = [];
    em.placeEventFromTemplate = (tpl, x, y) => {
        const ev = JSON.parse(JSON.stringify(tpl.event));
        ev.id = 60; ev.x = x; ev.y = y;
        placed.push(ev);
        return ev;
    };
    let armed = { name: 'Сундук', event: { id: 5, name: 'Сундук', pages: [{ list: [{ code: 101, parameters: ['текст'] }] }] } };
    em._getArmedEventTemplate = () => armed;
    let disarmed = 0;
    em._disarmEventTemplate = () => { armed = null; disarmed++; };

    const click = (x, y) => em.handleMapPointerDown({
        data: { button: 0, originalEvent: {}, getLocalPosition: () => ({ x: (x + 0.5) * 48, y: (y + 0.5) * 48 }) }
    }, tm.container);

    click(7, 4);
    assert.strictEqual(created, null, 'no regular event created');
    assert.strictEqual(placed.length, 1, 'template copy placed');
    assert.strictEqual(placed[0].name, 'Сундук', 'copy carries the template data');
    assert.ok(placed[0].pages[0].list[0].code === 101, 'pages deep-copied');
    assert.strictEqual(disarmed, 1, 'disarmed after placing');

    // после снятия — обычная тихая постановка
    armed = null;
    const evCount = em.currentMap.events.filter(e => e).length;
    click(9, 9);
    assert.strictEqual(em.currentMap.events.filter(e => e).length, evCount + 1, 'regular silent placement resumes');
    assert.strictEqual(created, null, 'editor closed on single click');
    assert.strictEqual(placed.length, 1, 'no extra template copies');
});

test('P10: placeEventFromTemplate — копия с новым id, saveEventAsTemplate через хук', () => {
    const EventManager = loadEventManager();
    const em = new EventManager({}, {});
    const tm = makeTilemapManager();
    em.initializeEventLayer(tm);
    em.currentMap = { id: 45, width: 40, height: 30, events: [null] };
    let savedTo = null;
    em._saveEventTemplate = ev => { savedTo = ev; return { name: ev.name, event: JSON.parse(JSON.stringify(ev)) }; };

    // ПКМ-экшн: сохранить событие как шаблон
    const rec = em.saveEventAsTemplate({ id: 3, name: 'Люк', x: 1, y: 1, pages: [] });
    assert.ok(savedTo && savedTo.name === 'Люк', 'hook received the event');
    assert.ok(rec && rec.name === 'Люк', 'record returned');

    // постановка: глубокая копия, id переназначен
    const placed = em.placeEventFromTemplate(rec, 8, 8);
    assert.ok(placed && placed.id !== 3, 'new id assigned');
    assert.strictEqual(placed.x, 8, 'position applied');
    assert.strictEqual(em.currentMap.events[placed.id], placed, 'added to the map');
});
