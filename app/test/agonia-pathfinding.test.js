/**
 * P1: SuperDuperMovement_Addon — точный A* с хитбоксами.
 * Проверяет: octile-эвристика (admissible => оптимальный путь), MinHeap,
 * жёсткий блок статичных хитбоксов, мягкую цену движущихся, освобождение
 * цели, точные формы collision mesh, best-effort при недостижимости и
 * регресс при выключенном Hitbox Avoidance.
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

// Круг-коллайдер как у движка по умолчанию: центр (x+0.5, y+0.7), r 0.25
const SEEKER_COLLIDER = {
    x: 0.5, y: 0.7, radius: 0.25,
    aabbox: { left: 0.25, top: 0.45, right: 0.75, bottom: 0.95 }
};

// Мок Collider: intersect — круг-круг, polygonsWithinColliderList — все поли меша
const ColliderMock = {
    intersect(x1, y1, c1, x2, y2, c2) {
        const dx = (x1 + (c1.x || 0)) - (x2 + (c2.x || 0));
        const dy = (y1 + (c1.y || 0)) - (y2 + (c2.y || 0));
        const r1 = c1.radius !== undefined ? c1.radius : 0.5;
        const r2 = c2.radius !== undefined ? c2.radius : 0.5;
        return Math.hypot(dx, dy) < r1 + r2;
    },
    polygonsWithinColliderList(x, y, aabbox, ox, oy, mesh) {
        return mesh ? mesh.polys : [];
    }
};

function makeEnv(pluginParams = {}, mapOpts = {}) {
    const ctx = {
        console: { log() { }, error() { }, warn() { } },
        PluginManager: { parameters: () => pluginParams, registerCommand() { } },
        Imported: {},
        Game_Player, Game_Event, Game_Follower, Game_Interpreter,
        Game_Character, Game_CharacterBase,
        $gamePlayer: null,
        $gameMap: null,
        Collider: ColliderMock,
        window: undefined
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperMovement_Addon.js' });
    const sda = ctx.__SDA_TEST;
    if (!sda) throw new Error('test seam __SDA_TEST missing');
    ctx.$gameMap = {
        width: () => mapOpts.w || 21,
        height: () => mapOpts.h || 21,
        isValid: (x, y) => x >= 0 && y >= 0 && x < (mapOpts.w || 21) && y < (mapOpts.h || 21),
        checkPassage: (x, y) => !(mapOpts.walls || new Set()).has(x + ',' + y),
        regionId: () => 0,
        characters: () => mapOpts.characters || [],
        events: () => (mapOpts.characters || []).filter(c => c instanceof Game_Event),
        event: id => (mapOpts.characters || []).find(c => c._eventId === id) || null,
        collisionMesh: () => mapOpts.mesh || null
    };
    return { ctx, sda };
}

function makeSeeker(x, y, opts = {}) {
    return Object.assign({
        _x: x, _y: y, _realX: x, _realY: y,
        collider: () => SEEKER_COLLIDER,
        collidableWith: () => true,
        _collisionType: 0
    }, opts);
}

// Статичное событие: полный тайл-коллайдер
function makeStaticEvent(x, y) {
    const ev = new Game_Event();
    ev._x = x; ev._y = y;
    ev.collider = () => ({ x: 0.5, y: 0.5, radius: 0.5, aabbox: { left: 0, top: 0, right: 1, bottom: 1 } });
    return ev;
}

function makePlayer(x, y) {
    const p = new Game_Player();
    p._x = x; p._y = y;
    p.collider = () => ({ x: 0.5, y: 0.7, radius: 0.25, aabbox: { left: 0.25, top: 0.45, right: 0.75, bottom: 0.95 } });
    return p;
}

function pathCost(sx, sy, p) {
    let c = 0;
    let prev = { x: sx, y: sy };
    for (let i = 0; i < p.length; i++) {
        const dx = Math.abs(p[i].x - prev.x);
        const dy = Math.abs(p[i].y - prev.y);
        c += (dx === 1 && dy === 1) ? Math.SQRT2 : Math.max(dx, dy);
        prev = p[i];
    }
    return c;
}

test('octile admissible: путь на пустой карте ровно octile-дистанции (оптимум)', () => {
    const { sda } = makeEnv();
    // admissible: эвристика зажата между chebyshev и manhattan (истинная стоимость 8-связного пути)
    for (let i = 0; i < 200; i++) {
        const x1 = (Math.random() * 30) | 0, y1 = (Math.random() * 30) | 0;
        const x2 = (Math.random() * 30) | 0, y2 = (Math.random() * 30) | 0;
        const cheb = Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
        const manh = Math.abs(x1 - x2) + Math.abs(y1 - y2);
        assert.ok(sda.octile(x1, y1, x2, y2) >= cheb && sda.octile(x1, y1, x2, y2) <= manh,
            'octile must sit between chebyshev and manhattan');
    }
    const { sda: s2 } = makeEnv({}, {});
    const seek = makeSeeker(0, 0);
    const p = s2.AStar.findPath(seek, 7, 5, []);
    assert.ok(p, 'path found');
    assert.ok(Math.abs(pathCost(0, 0, p) - s2.octile(0, 0, 7, 5)) < 1e-9, 'path cost == octile, got ' + pathCost(0, 0, p));
});

test('MinHeap: pop в порядке f по возрастанию, при равенстве f — большее g первым', () => {
    const { sda } = makeEnv();
    const h = new sda.MinHeap();
    const nodes = [];
    for (let i = 0; i < 50; i++) nodes.push({ f: (Math.random() * 10) | 0, g: (Math.random() * 10) | 0, id: i });
    nodes.forEach(n => h.push(n));
    const out = [];
    while (h.size > 0) out.push(h.pop());
    for (let i = 1; i < out.length; i++) {
        const a = out[i - 1], b = out[i];
        assert.ok(a.f < b.f || (a.f === b.f && a.g >= b.g), `heap order broken at ${i}: f${a.f}/g${a.g} then f${b.f}/g${b.g}`);
    }
});

test('статичный хитбокс события жёстко блокирует клетки — путь обходит', () => {
    const wall = makeStaticEvent(4, 4);
    const { sda } = makeEnv({}, { characters: [wall] });
    const seek = makeSeeker(0, 4);
    const p = sda.AStar.findPath(seek, 8, 4, []);
    assert.ok(p, 'detour exists');
    const blocked = new Set(['3,3', '3,4', '4,3', '4,4']); // Минковски-инфляция полного тайла
    for (const wp of p) {
        assert.ok(!blocked.has(wp.x + ',' + wp.y), 'path goes through static hitbox at ' + wp.x + ',' + wp.y);
    }
    assert.strictEqual(p[p.length - 1].x, 8);
    assert.strictEqual(p[p.length - 1].y, 4);
});

test('мягкая цена: путь обходит движущийся объект, если обход дешевле', () => {
    const player = makePlayer(5, 1); // посреди прямой
    const { sda } = makeEnv({}, { w: 11, h: 3, characters: [player] });
    const seek = makeSeeker(0, 1);
    const p = sda.AStar.findPath(seek, 10, 1, []);
    assert.ok(p, 'path found');
    for (const wp of p) assert.ok(!(wp.x === 5 && wp.y === 1), 'must detour around the player, got cell 5,1');
});

test('мягкая цена не жёсткая: единственный коридор через объект остаётся проходимым', () => {
    const player = makePlayer(5, 1);
    const walls = new Set();
    for (let x = 0; x <= 10; x++) { if (x !== 5) walls.add(x + ',0'); walls.add(x + ',2'); }
    const { sda } = makeEnv({}, { w: 11, h: 3, characters: [player], walls });
    const seek = makeSeeker(0, 1);
    const p = sda.AStar.findPath(seek, 10, 1, []);
    assert.ok(p, 'path through the only corridor exists');
    assert.ok(p.some(wp => wp.x === 5 && wp.y === 1), 'soft obstacle must not hard-block the corridor');
    assert.strictEqual(p[p.length - 1].x, 10);
});

test('P16: цель погони — динамика exempt, мебель у цели остаётся стеной', () => {
    const goal = makePlayer(9, 1);
    // СТАТИЧНАЯ мебель в 1 клетке от цели — внутри Goal Exempt Radius.
    // P16: статик больше НЕ исключается радиусом — иначе путь строился
    // сквозь стул и враг буксовал рядом с ним.
    const chair = makeStaticEvent(8, 1);
    const { sda } = makeEnv({}, { w: 13, h: 5, characters: [chair, goal] });
    const seek = makeSeeker(0, 1);
    const pChair = sda.AStar.findPath(seek, 9, 1, [], goal);
    assert.ok(pChair, 'path around the chair exists');
    assert.ok(!pChair.some(wp => (wp.x === 7 || wp.x === 8) && wp.y === 1),
        'static furniture near the goal STAYS blocked');

    // ДИНАМИЧЕСКАЯ толпа (другой ИИ) у цели — exempt работает как раньше
    const dyn = makeStaticEvent(8, 1);
    dyn._amsSmartTarget = { type: 'player' }; // динамический движитель
    const { sda: sda2 } = makeEnv({}, { w: 13, h: 5, characters: [dyn, goal] });
    const pExempt = sda2.AStar.findPath(seek, 9, 1, [], goal);
    assert.ok(pExempt, 'path to the chase goal exists');
    assert.ok(pExempt.some(wp => wp.x === 8 && wp.y === 1),
        'dynamic crowd near the goal is still exempt (line stays open)');
    assert.strictEqual(pExempt[pExempt.length - 1].y, 1);
});

test('collision mesh: полукруглый полигон блокирует только перекрытые клетки', () => {
    // Меш-круг в (5.5, 5.5) r 0.4: коллайдер ищущего (r 0.25, центр y+0.7)
    // задевает только клетку (5,5) — тайл-флаги чисты
    const mesh = { polys: [{ x: 5.5, y: 5.5, radius: 0.4 }] };
    const { sda } = makeEnv({}, { w: 11, h: 11, mesh });
    const seek = makeSeeker(0, 5);
    const p = sda.AStar.findPath(seek, 10, 5, []);
    assert.ok(p, 'path found');
    assert.ok(!p.some(wp => wp.x === 5 && wp.y === 5), 'mesh polygon must block cell (5,5)');
    assert.strictEqual(p[p.length - 1].x, 10);
});

test('best-effort: недостижимая цель даёт путь к ближайшей точке, не null', () => {
    const walls = new Set(['5,4', '4,5', '6,5', '5,6']); // карман вокруг цели
    const { sda } = makeEnv({}, { w: 11, h: 11, walls });
    const seek = makeSeeker(0, 0);
    const p = sda.AStar.findPath(seek, 5, 5, []);
    assert.ok(p, 'best-effort path must not be null');
    const last = p[p.length - 1];
    const d = sda.octile(last.x, last.y, 5, 5);
    assert.ok(d > 0 && d <= 1.5, 'must stop adjacent to the pocket, dist=' + d);
});

test('нет прогресса вообще -> null (как раньше)', () => {
    const walls = new Set(['1,0', '0,1', '1,1']);
    const { sda } = makeEnv({}, { w: 9, h: 9, walls });
    const seek = makeSeeker(0, 0);
    const p = sda.AStar.findPath(seek, 3, 3, []);
    assert.strictEqual(p, null);
});

test('регресс: Hitbox Avoidance выключен — путь сквозь объекты как раньше', () => {
    const wall = makeStaticEvent(4, 4);
    const { sda } = makeEnv({ 'Hitbox Avoidance': 'false' }, { characters: [wall] });
    assert.strictEqual(sda.config.hitbox(), false);
    const seek = makeSeeker(0, 4);
    const p = sda.AStar.findPath(seek, 8, 4, []);
    assert.ok(p, 'path exists');
    assert.ok(p.some(wp => wp.x === 4 && wp.y === 4), 'old behavior: straight through the event cell');
    assert.ok(Math.abs(pathCost(0, 4, p) - 8) < 1e-9, 'straight line cost 8, got ' + pathCost(0, 4, p));
});

test('isDynamicMover классифицирует игрок/фолловер/ИИ/маршрут как динамику, прочее — статика', () => {
    const { sda } = makeEnv();
    assert.ok(sda.isDynamicMover(makePlayer(1, 1)), 'player is dynamic');
    const f = new Game_Follower();
    assert.ok(sda.isDynamicMover(f), 'follower is dynamic');
    const smart = makeStaticEvent(2, 2); smart._amsSmartTarget = { type: 'player' };
    assert.ok(sda.isDynamicMover(smart), 'smart AI event is dynamic');
    const route = makeStaticEvent(3, 3); route._moveRouteForcing = true;
    assert.ok(sda.isDynamicMover(route), 'forced move route is dynamic');
    const mover = makeStaticEvent(4, 4); mover._moveType = 2;
    assert.ok(sda.isDynamicMover(mover), 'moveType>0 is dynamic');
    assert.strictEqual(sda.isDynamicMover(makeStaticEvent(5, 5)), false, 'plain event is static');
});

test('P16: застревание — блэклист клетки + перпендикулярный пинок + одноразовость', () => {
    const { sda } = makeEnv({}, { w: 13, h: 5 });
    const seek = makeSeeker(0, 1);
    // взводим блэклист как это делает anti-stuck в updateSmartPathLogic
    seek._amsVelocityX = 1; seek._amsVelocityY = 0; // буксуем, двигаясь вправо
    seek._amsStuckBlacklist = { x: Math.round(seek._x + 1 * 2), y: Math.round(seek._y + 0 * 2) };
    const ctx = sda.buildPathContext(seek, null, []);
    // блэклист-клетка (2,1) обязана быть жёсткой в этом поиске
    let blocked = false;
    for (const ob of ctx.obstacles) {
        if (2 + ctx.sr > ob.x1 && 2 + ctx.sl < ob.x2 && 1 + ctx.sb > ob.y1 && 1 + ctx.st < ob.y2 && ob.hard) {
            blocked = true; break;
        }
    }
    assert.ok(blocked, 'blacklisted cell is hard-blocked for this search');

    // путь через блэклист обязан обойти клетку (2,1)
    const p = sda.AStar.findPath(seek, 8, 1, []);
    assert.ok(p, 'path exists');
    assert.ok(!p.some(wp => wp.x === 2 && wp.y === 1), 'path detours the blacklisted cell');
    // одноразовость: после поиска блэклист потреблён
    assert.strictEqual(seek._amsStuckBlacklist, null, 'blacklist consumed after the search');
    // следующий поиск — клетка снова свободна
    const p2 = sda.AStar.findPath(seek, 8, 1, []);
    assert.ok(p2.some(wp => wp.x === 2 && wp.y === 1), 'blacklist is one-shot');
});

test('P16: LOS-шаг 0.25 — семплы вдвое плотнее, узкий коллайдер ловится', () => {
    const { sda, ctx } = makeEnv({}, { w: 13, h: 13 });
    const seek = makeSeeker(0, 0);
    // canMoveOn-мок со счётчиком: LOS (0,0)->(6,6), дистанция 8.49
    // шаг 0.25 -> ~33 внутренних семпла (0.5 давал бы ~16)
    let calls = 0;
    ctx.$gameMap.canMoveOn = () => { calls++; return true; };
    sda.checkLineOfSight(seek, 0, 0, 6, 6, []);
    assert.ok(calls >= 30 && calls <= 40, '0.25 step produces ~33 samples, got ' + calls);
    // семпл внутри зоны стула реально блокирует: узкий стул в (3.5,3.5) r0.2
    // + тело ищущего r0.25 -> зона ~0.45; диагональ обязан пересечь её
    let blockedSample = false;
    ctx.$gameMap.canMoveOn = (ch, x, y) => {
        const dx = (x + 0.5) - 3.5, dy = (y + 0.7) - 3.5;
        if (Math.hypot(dx, dy) < 0.45) { blockedSample = true; return false; }
        return true;
    };
    sda.checkLineOfSight(seek, 0, 0, 6, 6, []);
    assert.ok(blockedSample, 'a diagonal sample lands inside the chair zone');
});

// ============================================================================
// P20: хитбоксы в дебаге + инвариант «путь не пересекает твёрдое»
// ============================================================================

test('P20: hardSegmentBlocked — сегмент против жёстких инфляционных AABB', () => {
    const { sda } = makeEnv();
    const ctx = {
        obstacles: [
            { hard: true, x1: 1.4, x2: 1.6, y1: -0.5, y2: 0.5 },
            { hard: false, x1: -5, x2: 5, y1: -5, y2: 5 } // софт не считается
        ],
        sl: 0.25, st: 0.45, sr: 0.75, sb: 0.95
    };
    const cells = [];
    assert.strictEqual(sda.hardSegmentBlocked(ctx, 0, 0, 3, 0, cells), true, 'wall between points blocks');
    assert.ok(cells.length > 0 && /^\d+,\d+$/.test(cells[0]), 'crossed cell recorded');
    // мягкие препятствия игнорируются
    const softOnly = { obstacles: [{ hard: false, x1: -5, x2: 5, y1: -5, y2: 5 }], sl: 0.25, st: 0.45, sr: 0.75, sb: 0.95 };
    assert.strictEqual(sda.hardSegmentBlocked(softOnly, 0, 0, 3, 0, []), false, 'soft does not block');
    // чистый сегмент
    const clearCtx = { obstacles: [{ hard: true, x1: 10, x2: 11, y1: 10, y2: 11 }], sl: 0.25, st: 0.45, sr: 0.75, sb: 0.95 };
    assert.strictEqual(sda.hardSegmentBlocked(clearCtx, 0, 0, 3, 0, []), false, 'clear segment passes');
});

test('P22: маленький высокий коллайдер блокирует СВОЮ клетку, а не клетку сверху', () => {
    // регресс юзера: стул с боксом во весь тайл по X, но верхней половине по Y
    // (top .45, bottom .75). Старая бокс-против-бокса проверка сдвигала
    // интервал: клетка стула была СВОБОДНА (вейпоинты в центре твёрдых
    // ивентов, враг долбился сквозь), а фантомно блокировалась клетка сверху.
    const chair = new Game_Event();
    chair._x = 3; chair._y = 3;
    chair.collider = () => ({ x: 0.5, y: 0.6, radius: 0.3, aabbox: { left: 0, top: 0.45, right: 1, bottom: 0.75 } });
    chair.collidableWith = () => true;
    const { sda } = makeEnv({}, { w: 9, h: 9, characters: [chair] });
    const seek = makeSeeker(0, 3);

    const ctx = sda.buildPathContext(seek, null, []);
    assert.strictEqual(ctx.obstacles.length, 1, 'chair is an obstacle');
    // Минковски-интервал центров: x [2.25, 3.75], y [3+0.45-0.95, 3+0.75-0.45] = [2.5, 3.3]
    const ob = ctx.obstacles[0];
    assert.ok(Math.abs(ob.x1 - 2.25) < 1e-9 && Math.abs(ob.x2 - 3.75) < 1e-9, 'inflated x interval');
    assert.ok(Math.abs(ob.y1 - 2.5) < 1e-9 && Math.abs(ob.y2 - 3.3) < 1e-9, 'inflated y interval');
    assert.strictEqual(sda.cellPenalty(ctx, 3, 3), Infinity, 'chair cell is hard-blocked');
    assert.strictEqual(sda.cellPenalty(ctx, 3, 2), 0, 'cell above the chair is free (no phantom block)');

    // путь (0,3)->(6,3) обязан обойти клетку стула
    const p = sda.AStar.findPath(seek, 6, 3, []);
    assert.ok(p, 'path exists');
    assert.ok(!p.some(wp => wp.x === 3 && wp.y === 3), 'no waypoint on the chair cell');
    assert.ok(p.length > 1, 'detour built');
});

test('P20: collectHitboxes — сырые AABB с классификацией статика/динамика', () => {
    const { sda } = makeEnv({}, { characters: [makeStaticEvent(2, 3), makePlayer(5, 5)] });
    const boxes = sda.collectHitboxes();
    assert.strictEqual(boxes.length, 2, 'both characters boxed');
    const hard = boxes.find(b => b.hard);
    const soft = boxes.find(b => !b.hard);
    assert.ok(hard, 'static event is hard');
    assert.ok(soft, 'player is dynamic');
    assert.ok(Math.abs(hard.x1 - 2) < 1e-9 && Math.abs(hard.x2 - 3) < 1e-9 &&
        Math.abs(hard.y1 - 3) < 1e-9 && Math.abs(hard.y2 - 4) < 1e-9, 'raw full-tile box (no inflation)');
    assert.ok(Math.abs(soft.x1 - 5.25) < 1e-9 && Math.abs(soft.x2 - 5.75) < 1e-9, 'raw player box');
});

test('P20: overlayDraw — хитбоксы рисуются с зум-трансформацией (статик красным, динамика синим)', () => {
    // окружение с заглушками Sprite/Bitmap/Scene_Map/Graphics — дебаг-блок
    // исполняется (Debug Mode true) и отдаёт overlayDraw
    const staticEv = makeStaticEvent(2, 3);
    const smart = makeSeeker(5, 5, { _amsSmartTarget: { type: 'wander', timer: 1 } });
    smart.collider = () => ({ x: 0.5, y: 0.5, radius: 0.2, aabbox: { left: 0.3, top: 0.3, right: 0.7, bottom: 0.7 } });
    const calls = [];
    class BitmapStub {
        constructor(w, h) { this.width = w; this.height = h; }
        clear() { }
        fillRect(x, y, w, h, c) { calls.push(['fillRect', x, y, w, h, c]); }
        drawCircle(x, y, r, c) { calls.push(['drawCircle', x, y, r, c]); }
    }
    const ctx = {
        console: { log() { }, error() { }, warn() { } },
        PluginManager: { parameters: () => ({ 'Debug Mode': 'true' }), registerCommand() { } },
        Imported: {},
        Game_Player, Game_Event, Game_Follower, Game_Interpreter, Game_Character, Game_CharacterBase,
        $gamePlayer: null, $gameMap: null, Collider: ColliderMock,
        Sprite: class { initialize(b) { this.bitmap = b; } },
        Bitmap: BitmapStub,
        Scene_Map: class { },
        Graphics: { width: 800, height: 600, frameCount: 0 }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperMovement_Addon.js' });
    const sda = ctx.__SDA_TEST;
    assert.strictEqual(typeof sda.overlayDraw, 'function', 'overlayDraw exposed when debug block ran');
    ctx.$gameMap = {
        width: () => 21, height: () => 21,
        isValid: () => true, checkPassage: () => true, regionId: () => 0,
        characters: () => [staticEv, smart],
        events: () => [], event: () => null, collisionMesh: () => null,
        adjustX: (x) => x, adjustY: (y) => y, tileWidth: () => 48, tileHeight: () => 48
    };
    // зум 1.5 со сдвигом — та же трансформация, что у вейпоинтов (P19).
    // Рамка = 4 fillRect по 1px (у MV Bitmap нет strokeRect).
    sda.overlayDraw(new BitmapStub(800, 600), { kx: 1.5, ky: 1.5, ox: -100, oy: -60 });
    const hardStroke = calls.find(c => c[0] === 'fillRect' && c[5] === '#ff4848');
    const hardFill = calls.find(c => c[0] === 'fillRect' && c[5] === 'rgba(255,72,72,0.20)');
    const softStroke = calls.find(c => c[0] === 'fillRect' && c[5] === '#4d9dff');
    assert.ok(hardStroke, 'hard box outlined red (fillRect frame)');
    assert.ok(hardFill, 'hard box filled translucent');
    assert.ok(softStroke, 'dynamic box outlined blue');
    // статик: raw [2..3]x[3..4] тайлы -> pre-zoom [96..144]x[144..192] ->
    // верхняя линия рамки: (44,156,72,1); 96*1.5-100=44, 144*1.5-60=156, w=72
    assert.deepStrictEqual([hardStroke[1], hardStroke[2], hardStroke[3], hardStroke[4]], [44, 156, 72, 1],
        'hard box frame at zoom-transformed position');
    // динамика: raw [5.3..5.7] — двойной round плагина: round(5.3*48)=254,
    // потом 254*1.5-100=281 (внутренний пиксельный round ДО скейла)
    assert.deepStrictEqual([softStroke[1], softStroke[2]],
        [Math.round(Math.round(5.3 * 48) * 1.5 - 100), Math.round(Math.round(5.3 * 48) * 1.5 - 60)],
        'dynamic box zoom-transformed');
});

// ============================================================================
// P21: LOS/steering видят коллайдеры событий (стул-ивент на прямой)
// ============================================================================

// MV-функции, отсутствующие в vanilla Math/Array vm-контекста
function patchVmMath(ctx) {
    vm.runInContext('Math.randomInt = function(n) { return Math.floor(Math.random() * n); };'
        + 'if (!Array.prototype.contains) Array.prototype.contains = function(e) { return this.indexOf(e) >= 0; };', ctx);
}

test('P21: LOS видит твёрдый хитбокс события на линии (canMoveOn слеп к событиям)', () => {
    const { sda, ctx } = makeEnv({}, { characters: [makeStaticEvent(3, 0)] });
    ctx.$gameMap.canMoveOn = () => true; // mesh «чист» — блокирует только слой-3
    const seek = makeSeeker(0, 0);
    const pathCtx = sda.buildPathContext(seek, null, []);
    assert.strictEqual(pathCtx.obstacles.length, 1, 'chair is an obstacle');
    // легаси-вызов (5 аргументов): mesh-чистая линия — «видна»
    assert.strictEqual(sda.checkLineOfSight(seek, 0, 0, 6, 0, []), true,
        'legacy LOS (mesh-only) is blind to the event collider');
    // P21: с препятствиями контекста — стул блокирует прямую
    assert.strictEqual(sda.checkLineOfSight(seek, 0, 0, 6, 0, [], pathCtx.obstacles, pathCtx), false,
        'LOS with hard obstacles sees the chair');
    // мягкая динамика LOS не блокирует
    const softCtx = { obstacles: [{ hard: false, x1: -5, x2: 5, y1: -5, y2: 5 }], sl: 0.25, st: 0.45, sr: 0.75, sb: 0.95 };
    assert.strictEqual(sda.checkLineOfSight(seek, 0, 0, 6, 0, [], softCtx.obstacles, softCtx), true,
        'soft movers do not block LOS');
});

test('P21: сенсоры steering отталкиваются от мебели (hardPointBlocked из контекста пути)', () => {
    const { sda, ctx } = makeEnv();
    ctx.$gameMap.canMoveOn = () => true;
    patchVmMath(ctx);
    function steerChar() {
        return Object.assign(Object.create(ctx.Game_CharacterBase.prototype), {
            _x: 0, _y: 0, _realX: 0, _realY: 0, _collisionType: 0,
            collider: () => SEEKER_COLLIDER, collidableWith: () => true,
            distancePerFrame: () => 0.0625, moveVector: function() {},
            isDirectionFixed: () => false, setDirection: function() {},
            _amsSteerTimer: 0,
            _amsVelocityX: 0, _amsVelocityY: 0
        });
    }
    // контроль: без контекста — сенсоры чисты, рулит прямо к цели (1,0)
    const plain = steerChar();
    plain.applyContextSteering(5, 0, [], false);
    assert.ok(Math.abs(plain._amsTargetSteerX - 1) < 1e-9 && Math.abs(plain._amsTargetSteerY) < 1e-9,
        'no ctx -> straight desire');
    // со стулом прямо по курсу и чуть выше — отворачивает ВНИЗ: интервал
    // центров накрывает прямой и верхне-диагональный сенсоры, нижний свободен
    // (старая формула «поворачивала» фантомной асимметрией — регресс-тест
    // честной геометрии)
    const blocked = steerChar();
    blocked._amsPathCtx = {
        obstacles: [{ hard: true, x1: 0.2, x2: 0.9, y1: -0.05, y2: 0.3 }],
        sl: 0.25, st: 0.45, sr: 0.75, sb: 0.95
    };
    blocked.applyContextSteering(5, 0, [], false);
    assert.ok(blocked._amsTargetSteerX < 0.99 || Math.abs(blocked._amsTargetSteerY) > 0.05,
        'steering turns away from the hard box ahead');
});

function makeSmartEnemy(ctx) {
    return Object.assign(Object.create(ctx.Game_CharacterBase.prototype), {
        _x: 0, _y: 2, _realX: 0, _realY: 2, _collisionType: 0,
        collider: () => SEEKER_COLLIDER, collidableWith: () => true,
        distancePerFrame: () => 0.0625, moveVector: function() {},
        isDirectionFixed: () => false, setDirection: function() {},
        _amsVelocityX: 0, _amsVelocityY: 0,
        _amsSmartTarget: { type: 'player' }, _amsSmartRefreshTimer: 0
    });
}

test('P21: прямая ветка погони строит обход, а не прямой путь через стул', () => {
    // враг (0,2) -> герой (6,2), стул (3,2) на прямой
    const player = makePlayer(6, 2);
    const { sda, ctx } = makeEnv({}, { w: 9, h: 5, characters: [makeStaticEvent(3, 2), player] });
    ctx.$gamePlayer = player;
    ctx.$gameMap.canMoveOn = () => true;
    patchVmMath(ctx);
    const enemy = makeSmartEnemy(ctx);
    enemy.updateSmartPathLogic();
    assert.ok(enemy._amsSmartPath && enemy._amsSmartPath.length > 1,
        'path is a detour, not the direct single waypoint');
    assert.ok(!enemy._amsSmartPath.some(wp => wp.x === 3 && wp.y === 2), 'no waypoint inside the chair cell');
    assert.ok(enemy._amsPathCtx, 'path context lives with the detour');

    // регресс-контраст: Hitbox Avoidance off -> прежнее поведение (прямой путь)
    const { sda: s2, ctx: c2 } = makeEnv({ 'Hitbox Avoidance': 'false' }, { w: 9, h: 5, characters: [makeStaticEvent(3, 2), player] });
    c2.$gamePlayer = player;
    c2.$gameMap.canMoveOn = () => true;
    patchVmMath(c2);
    const enemy2 = makeSmartEnemy(c2);
    enemy2.updateSmartPathLogic();
    assert.ok(enemy2._amsSmartPath && enemy2._amsSmartPath.length === 1,
        'legacy mode keeps the direct path (regression contract)');
});
