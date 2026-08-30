/**
 * P23: SuperDuperMovement_Addon — сквозная погоня через карты.
 * Проверяет: парсинг дверей (201, триггер 0/1, режим 0), BFS по графу
 * дверей, вход в транзит (снапшот селф-свитчей, лимит), мозг сквозной
 * погони (цель 'player' при игроке на другой карте -> путь к двери,
 * вход у двери), материализацию призрака на карте игрока (заглушка
 * телепортируется к двери прибытия, погоня реармится).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperMovement_Addon.js'), 'utf8');

class Game_Player {}
class Game_Event {}
class Game_Follower {}
class Game_Interpreter {}
class Game_Character {}
class Game_CharacterBase {}

const SEEKER_COLLIDER = {
    x: 0.5, y: 0.7, radius: 0.25,
    aabbox: { left: 0.25, top: 0.45, right: 0.75, bottom: 0.95 }
};

const ColliderMock = {
    intersect() { return false; },
    polygonsWithinColliderList() { return []; }
};

function makeEnv(pluginParams = {}, mapOpts = {}) {
    const ctx = {
        console: { log() { }, error() { }, warn() { } },
        PluginManager: { parameters: () => pluginParams, registerCommand() { } },
        Imported: {},
        Game_Player, Game_Event, Game_Follower, Game_Interpreter,
        Game_Character, Game_CharacterBase,
        $gamePlayer: null, $gameMap: null,
        $gameSystem: {},
        $gameSelfSwitches: {
            _s: {},
            value(k) { return !!this._s[k.join('|')]; },
            setValue(k, v) { if (v) this._s[k.join('|')] = true; else delete this._s[k.join('|')]; }
        },
        Collider: ColliderMock,
        Sprite: class { initialize(b) { this.bitmap = b; } },
        Bitmap: class { constructor(w, h) { this.width = w; this.height = h; } clear() { } fillRect() { } drawCircle() { } },
        Scene_Map: class { },
        Graphics: { width: 800, height: 600, frameCount: 0 }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperMovement_Addon.js' });
    vm.runInContext('Math.randomInt = function(n) { return Math.floor(Math.random() * n); };'
        + 'if (!Array.prototype.contains) Array.prototype.contains = function(e) { return this.indexOf(e) >= 0; };', ctx);
    const sda = ctx.__SDA_TEST;
    if (!sda) throw new Error('test seam __SDA_TEST missing');
    ctx.$gameMap = {
        mapId: () => (mapOpts.mapId || 1),
        width: () => mapOpts.w || 21,
        height: () => mapOpts.h || 21,
        isValid: (x, y) => x >= 0 && y >= 0 && x < (mapOpts.w || 21) && y < (mapOpts.h || 21),
        checkPassage: () => true,
        regionId: () => 0,
        canMoveOn: () => true,
        characters: () => mapOpts.characters || [],
        events: () => (mapOpts.characters || []).filter(c => c instanceof Game_Event),
        event: id => (mapOpts.characters || []).find(c => c && c._eventId === id) || null,
        collisionMesh: () => null
    };
    return { ctx, sda };
}

function makeSmartEnemy(ctx, opts = {}) {
    return Object.assign(Object.create(ctx.Game_CharacterBase.prototype), {
        _x: 0, _y: 0, _realX: 0, _realY: 0, _collisionType: 0,
        _eventId: 1,
        collider: () => SEEKER_COLLIDER, collidableWith: () => true,
        distancePerFrame: () => 0.0625, moveVector: function() {},
        isDirectionFixed: () => false, setDirection: function() {},
        _amsVelocityX: 0, _amsVelocityY: 0,
        _amsSmartTarget: { type: 'player' }, _amsSmartRefreshTimer: 0,
        _erased: false,
        erase: function() { this._erased = true; },
        event: () => ({ note: opts.note || '<biba>' })
    }, opts);
}

// Событие для живых координат двери в рантайме (graph = источник истины)
function makeDoorEvent(evId, x, y) {
    const ev = new Game_Event();
    ev._eventId = evId; ev._x = x; ev._y = y; ev._erased = false;
    return ev;
}

test('P23: xmapParseDoorList — триггер 0/1 и прямой режим, сюжетные и VAR-режим пропускаются', () => {
    const { sda } = makeEnv();
    const json = {
        events: [null,
            { id: 1, x: 5, y: 5, pages: [{ trigger: 0, list: [{ code: 201, parameters: [0, 7, 8, 9, 0, 0] }] }] },
            { id: 2, x: 1, y: 1, pages: [{ trigger: 3, list: [{ code: 201, parameters: [0, 9, 1, 1, 0, 0] }] }] },
            { id: 3, x: 2, y: 2, pages: [{ trigger: 1, list: [{ code: 201, parameters: [1, 4, 5, 6, 4, 2] }] }] }
        ]
    };
    const doors = sda.xmap.parseDoorList(json);
    assert.strictEqual(doors.length, 1, 'only the trigger-0 direct door counts');
    assert.deepStrictEqual(
        [doors[0].evId, doors[0].toMap, doors[0].toX, doors[0].toY],
        [1, 7, 8, 9], 'door destination parsed exactly');
});

test('P23: xmapRouteOnGraph — BFS через промежуточные карты, тупик -> null, та же карта -> []', () => {
    const { sda } = makeEnv();
    const graph = { edges: {
        1: [{ evId: 2, x: 5, y: 5, toMap: 2, toX: 1, toY: 1 }],
        2: [{ evId: 7, x: 3, y: 3, toMap: 3, toX: 4, toY: 4 }],
        3: []
    } };
    assert.strictEqual(sda.xmap.routeOnGraph(graph, 1, 1).length, 0, 'same map -> empty route');
    const route = sda.xmap.routeOnGraph(graph, 1, 3);
    assert.ok(route && route.length === 2, 'two hops');
    assert.strictEqual(route[0].toMap, 2, 'first hop to map 2');
    assert.strictEqual(route[1].toMap, 3, 'second hop to map 3');
    assert.strictEqual(sda.xmap.routeOnGraph(graph, 1, 99), null, 'unreachable');
});

test('P23: тик ведёт призрака к карте игрока через промежуточный хоп графа', () => {
    // призрак приехал на промежуточную карту 2, игрок (текущая карта) на 3
    const { sda, ctx } = makeEnv({}, { mapId: 3 });
    sda.xmap.setGraphCache({ edges: { 2: [{ evId: 5, x: 1, y: 1, toMap: 3, toX: 8, toY: 8 }] } });
    ctx.$gamePlayer = Object.assign(new Game_Player(), { _x: 8, _y: 8,
        collider: () => SEEKER_COLLIDER, collidableWith: () => true });
    const st = sda.xmap.state();
    st.ghosts = [{ key: 'p1', tag: 'biba', selfSwitches: {}, hp: null,
        leg: { toMap: 2, toX: 1, toY: 1 }, etaFrames: 0, interest: 100, waiting: false }];
    // карта 2 != карта 3: eta исчерпана -> тик перестраивает ногу по графу
    sda.xmap.tick();
    assert.strictEqual(st.ghosts[0].leg.toMap, 3, 'leg advanced toward the player map');
    assert.ok(st.ghosts[0].etaFrames > 0, 'fresh transit timer for the new leg');
    assert.ok(!st.ghosts[0].waiting, 'not waiting - route exists');
});

test('P23: xmapEnterTransit — снапшот селф-свитчей и лимит призраков', () => {
    const door = makeDoorEvent(9, 2, 0, 5, 1, 1);
    const { sda, ctx } = makeEnv({}, { mapId: 1, characters: [door] });
    sda.xmap.setGraphCache({ edges: { 1: [{ evId: 9, x: 2, y: 0, toMap: 5, toX: 1, toY: 1 }] } });
    ctx.$gameSelfSwitches.setValue([1, 1, 'A'], true);
    ctx.$gameSelfSwitches.setValue([1, 1, 'C'], true);
    const ev = makeSmartEnemy(ctx, { _x: 2, _y: 0 });
    assert.strictEqual(sda.xmap.enterTransit(ev, { toMap: 5, toX: 1, toY: 1 }, 10), true, 'enters');
    const st = sda.xmap.state();
    assert.strictEqual(st.ghosts.length, 1);
    const g0 = st.ghosts[0];
    assert.ok(g0.selfSwitches.A === true && g0.selfSwitches.C === true && g0.selfSwitches.B === undefined,
        'self-switch phase snapshotted');
    assert.ok(st.ghosts[0].etaFrames > 10, 'eta includes the extra walk frames');
    // лимит: ещё 4 — на пятом отказ
    for (let i = 0; i < 3; i++) st.ghosts.push({ key: 'x' + i });
    const ev2 = makeSmartEnemy(ctx, { _x: 2, _y: 0, _eventId: 2 });
    assert.strictEqual(sda.xmap.enterTransit(ev2, { toMap: 5, toX: 1, toY: 1 }, 0), false, 'limit of 4 ghosts');
    assert.ok(!ev2._erased, 'limit refused: event stays on the map');
});

test('P23: материализация — заглушка того же вида телепортируется к двери и реармит погоню', () => {
    const { sda, ctx } = makeEnv({}, { mapId: 7 });
    sda.xmap.setGraphCache({ edges: {} });
    ctx.$gamePlayer = Object.assign(new Game_Player(), { _x: 5, _y: 5, _mapId: 7,
        collider: () => SEEKER_COLLIDER, collidableWith: () => true });
    const stub = makeSmartEnemy(ctx, { _x: 20, _y: 20, _eventId: 5 });
    stub.locate = function(x, y) { this._x = x; this._y = y; this._located = [x, y]; };
    stub.smartMoveToPlayer = function() { this._chaseArmed = true; };
    stub.event = () => ({ note: '<biba>' });
    ctx.$gameMap.characters = () => [stub];
    ctx.$gameMap.events = () => [stub];
    const st = sda.xmap.state();
    st.ghosts = [{ key: 'p1', tag: 'biba', selfSwitches: { B: true }, hp: null,
        leg: { toMap: 7, toX: 3, toY: 4 }, etaFrames: 0, interest: 100, waiting: false }];
    sda.xmap.tick();
    assert.strictEqual(st.ghosts.length, 0, 'ghost consumed');
    assert.ok(stub._located && stub._located[0] === 3 && stub._located[1] === 4,
        'stub teleported to the arrival door');
    assert.ok(stub._chaseArmed, 'chase re-armed on arrival');
    assert.ok(ctx.$gameSelfSwitches.value([7, 5, 'B']), 'combat phase restored');
});

test('P23: интерес истёк — призрак снят с погони; недостижим дальше — ждёт у двери', () => {
    const { sda, ctx } = makeEnv();
    sda.xmap.setGraphCache({ edges: { 7: [] } }); // с карты 7 нет рёбер
    ctx.$gamePlayer = Object.assign(new Game_Player(), { _x: 0, _y: 0, _mapId: 99,
        collider: () => SEEKER_COLLIDER, collidableWith: () => true });
    const st = sda.xmap.state();
    // игрок ушёл дальше: призрак приехал на карту 7, маршрута нет -> ждёт
    st.ghosts = [{ key: 'p1', tag: 'biba', selfSwitches: {}, hp: null,
        leg: { toMap: 7, toX: 1, toY: 1 }, etaFrames: 0, interest: 50, waiting: false }];
    sda.xmap.tick();
    assert.strictEqual(st.ghosts.length, 1, 'ghost waits at the dead-end door');
    assert.ok(st.ghosts[0].waiting, 'flagged as waiting');
    // интерес истёк -> снят
    st.ghosts[0].interest = 1;
    sda.xmap.tick();
    assert.strictEqual(st.ghosts.length, 0, 'interest timeout removes the ghost');
});

test('P28: дверь анимируется при транзите — SE + последовательность паттернов', () => {
    const { sda, ctx } = makeEnv({}, { mapId: 1 });
    const playedSe = [];
    ctx.AudioManager = { playSe: s => playedSe.push(s) };
    const patterns = [];
    const doorEv = {
        _eventId: 7, _characterName: '!SF_Door1',
        setPattern: p => patterns.push(p)
    };
    ctx.$gameMap.event = id => (Number(id) === 7 ? doorEv : null);
    sda.xmap.doorFx(7);
    assert.ok(playedSe.length === 1 && playedSe[0].name === 'Door1', 'door SE plays');
    assert.strictEqual(sda.xmap.doorFxQueue().length, 1, 'animation queued');
    // прогоняем тиками (тик = 1 кадр)
    for (let i = 0; i < 40; i++) sda.xmap.tick();
    assert.deepStrictEqual(patterns, [1, 2, 1, 0, 0], 'pattern sequence 0->1->2->1->0 (close restore)');
    assert.strictEqual(sda.xmap.doorFxQueue().length, 0, 'queue drains');
});

test('P28: инжект врага несёт шаги карточки в note (громкость + пул звуков)', () => {
    const { sda, ctx } = makeEnv({}, { mapId: 3 });
    sda.xmap.setGraphCache({ edges: {} });
    ctx.$gamePlayer = Object.assign(new Game_Player(), { _x: 5, _y: 5,
        collider: () => SEEKER_COLLIDER, collidableWith: () => true });
    ctx.$dataMap = { events: [null] };
    ctx.$gameMap._events = [];
    ctx.SDE_API = {
        buildTemplatePages: () => [{ list: [{ code: 0 }] }],
        getTemplate: () => ({ stepVolume: '80', stepSounds: 'Growl1,Growl2' }),
        registerInjectedEvent: () => true,
        setEventDataHp: () => true
    };
    const st = sda.xmap.state();
    st.ghosts = [{ key: 'p1', tag: 'biba', selfSwitches: {}, hp: null,
        leg: { toMap: 3, toX: 1, toY: 1 }, etaFrames: 0, interest: 100, waiting: false }];
    sda.xmap.tick();
    assert.strictEqual(st.ghosts.length, 0, 'ghost consumed');
    const note = ctx.$dataMap.events[1].note;
    assert.ok(note.indexOf('<biba>') >= 0, 'tag in note');
    assert.ok(note.indexOf('<step_se:80>') >= 0, 'step volume carried');
    assert.ok(note.indexOf('<step_snds:Growl1,Growl2>') >= 0, 'personal step pool carried');
    assert.ok(ctx.$gameMap._events[1], 'Game_Event instance registered');
});
