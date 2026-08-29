/**
 * P24: YuryolStealth — вотчеры не роняют кадр после смены карты.
 * Раньше модульный список вотчеров не чистился при переносе героя:
 * $gameMap.event(id) со старой карты = undefined -> чтение _x роняло
 * Scene_Map.update каждый кадр (TypeError из живого лога).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'YuryolStealth.js'), 'utf8');

class Scene_Map { update() {} }
class Game_Character {}
class Game_Map { setup() {} }

function makeEnv() {
    const switches = {};
    const ctx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => ({ circle: 'false' }) },
        Scene_Map, Game_Character, Game_Map,
        $gameMap: null,
        $gamePlayer: { x: 10, y: 10 },
        $gameSelfSwitches: {
            setValue(k, v) { if (v) switches[k.join('|')] = true; else delete switches[k.join('|')]; },
            value(k) { return !!switches[k.join('|')]; }
        }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'YuryolStealth.js' });
    const scene = new Scene_Map();
    return { ctx, scene, switches };
}

function makeChar(id) {
    const c = new Game_Character();
    c._eventId = id;
    return c;
}

test('P24: вотчер с несуществующим событием не роняет update и вычищается', () => {
    const { ctx, scene } = makeEnv();
    // событие 5 зарегистрировано (например, со старой карты)
    makeChar(5).YurStealth(3);
    ctx.$gameMap = { mapId: () => 2, event: () => null };
    // раньше: TypeError "Cannot read properties of undefined (reading '_x')"
    assert.doesNotThrow(() => scene.update(), 'update survives a stale watcher');
    // после вычистки повторный апдейт тоже тих
    assert.doesNotThrow(() => scene.update(), 'stale watcher removed after first sweep');
});

test('P24: живой вотчер в радиусе и со спины к герою включает селф-свитч', () => {
    const { ctx, scene, switches } = makeEnv();
    makeChar(5).YurStealth(4);
    ctx.$gameMap = {
        mapId: () => 2,
        event: (id) => (id === 5 ? { _x: 12, _y: 10, direction: () => 4 } : null)
    };
    scene.update();
    assert.ok(switches['2|5|A'], 'self-switch A set when the enemy faces away (dir 4, hero to the right)');
});

test('P24: Game_Map.setup сбрасывает список вотчеров (перенос на новую карту)', () => {
    const { ctx, scene, switches } = makeEnv();
    makeChar(5).YurStealth(4);
    ctx.$gameMap = { mapId: () => 3, event: (id) => (id === 5 ? { _x: 10, _y: 10, direction: () => 4 } : null) };
    // перенос: setup чистит список ДО создания событий новой карты
    const map = new Game_Map();
    map.setup(3);
    scene.update();
    assert.ok(!switches['3|5|A'], 'watcher cleared by map setup - no stale trigger');
    // повторная регистрация работает как прежде
    makeChar(5).YurStealth(4);
    scene.update();
    assert.ok(switches['3|5|A'], 're-registered watcher works');
});

test('P24: перерегистрация того же id заменяет запись, а не дублирует', () => {
    const { ctx, scene, switches } = makeEnv();
    makeChar(5).YurStealth(4, 'B');
    makeChar(5).YurStealth(4, 'C'); // скелет перезапустил детектор
    ctx.$gameMap = {
        mapId: () => 2,
        event: (id) => (id === 5 ? { _x: 10, _y: 10, direction: () => 4 } : null)
    };
    scene.update();
    assert.ok(switches['2|5|C'], 'last registration wins');
    assert.ok(!switches['2|5|B'], 'stale registration replaced, not duplicated');
});
