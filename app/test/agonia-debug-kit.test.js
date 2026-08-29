/**
 * P18: дебаг-инфраструктура — env-флаг RPGREACTOR_DEBUG.
 * Аддон поиска пути включает отрисовку маршрутов от env; дебаг-кит
 * спит при обычном запуске и просыпается от env/?debug.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROTO = () => ({ prototype: {} });

function addonEnv(extra = {}) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperMovement_Addon.js'), 'utf8');
    const ctx = {
        console: { log() { }, warn() { }, error() { } },
        PluginManager: { parameters: () => ({ 'Debug Mode': 'false' }), registerCommand() { } },
        Imported: {}, window: null, navigator: {},
        Game_Player: PROTO(), Game_Event: PROTO(), Game_Follower: PROTO(),
        Game_Character: PROTO(), Game_CharacterBase: PROTO(), Game_Map: PROTO(),
        Game_Interpreter: PROTO(), Game_Switches: PROTO(), Game_Variables: PROTO(),
        Game_SelfSwitches: PROTO(), Game_System: PROTO(), Game_Screen: PROTO(),
        Game_Action: PROTO(), Game_Battler: PROTO(), Game_Actor: PROTO(),
        DataManager: {}, SceneManager: {}, Input: {}, TouchInput: {},
        Scene_Map: PROTO(), Scene_Title: PROTO(), Scene_Base: PROTO(),
        setInterval: () => 1, clearInterval() { }, requestAnimationFrame() { },
        document: undefined,
        ...extra
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'SuperDuperMovement_Addon.js' });
    return { ctx, sda: ctx.__SDA_TEST };
}

test('P18: аддон включает отрисовку маршрутов от env RPGREACTOR_DEBUG=1', () => {
    // без env: параметр false -> кит спит (спрайт-блок не проверяем напрямую,
    // но __SDA_TEST присутствует и debugActive() возвращает false)
    const plain = addonEnv({ process: { env: {} } });
    assert.strictEqual(typeof plain.sda, 'object', 'module loads without env');
    assert.strictEqual(typeof plain.sda.debugActive, 'function', 'debugActive hook exposed');
    assert.strictEqual(plain.sda.debugActive(), false, 'param false + no env -> debug off');

    // с env: просыпается без правки параметров проекта
    const dbg = addonEnv({ process: { env: { RPGREACTOR_DEBUG: '1' } } });
    assert.strictEqual(dbg.sda.debugActive(), true, 'env flag turns debug on');
});

test('P18: AgoniaDebugKit спит без env и просыпается от env', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'AgoniaDebugKit.js'), 'utf8');
    const make = (env, search) => {
        const ctx = {
            console: { log() { }, warn() { }, error() { } },
            PluginManager: { parameters: () => ({ 'Force Chase Switch': '0' }) },
            Scene_Boot: PROTO(), Scene_Map: PROTO(), Scene_Title: PROTO(),
            DataManager: { isDatabaseLoaded() { return true; } },
            setTimeout: (f) => { try { f(); } catch (e) { /* autostart in vm */ } },
            setInterval: () => 1, clearInterval() { },
            document: undefined, window: null,
            process: { env }
        };
        ctx.window = search ? { location: { search } } : ctx;
        vm.createContext(ctx);
        vm.runInContext(src, ctx, { filename: 'AgoniaDebugKit.js' });
        return ctx;
    };
    // без env и ?debug: кит выходит сразу — маркер не ставит, сцены не алиасит
    const sleeping = make({});
    assert.strictEqual(sleeping.__DebugKitActive, undefined, 'kit sleeps without env');
    assert.strictEqual(sleeping.Scene_Boot.prototype._dkPatched, undefined, 'no autostart alias when asleep');
    // с env: кит активен — маркер и алиас на месте
    const awake = make({ RPGREACTOR_DEBUG: '1' });
    assert.strictEqual(awake.__DebugKitActive, true, 'env wakes the kit');
    assert.strictEqual(awake.Scene_Boot.prototype._dkPatched, true, 'autostart alias installed');
    // ?debug в URL тоже будит (window — отдельная заглушка с location)
    const viaUrl = make({}, '?debug');
    assert.strictEqual(viaUrl.window.__DebugKitActive, true, '?debug in URL wakes the kit');
});

test('P19: pathDebugXform — зум-трансформация спрайтсета для оверлея маршрутов', () => {
    const { sda } = addonEnv({ process: { env: {} } });
    const xf = sda.pathDebugXform;
    assert.strictEqual(typeof xf, 'function', 'xform helper exposed');
    // без спрайтсета — идентичность (по полям: объект из vm-рейлма)
    const id = xf(null);
    assert.strictEqual(id.kx, 1); assert.strictEqual(id.ky, 1);
    assert.strictEqual(id.ox, 0); assert.strictEqual(id.oy, 0);
    // Spriteset_Map-подобный объект: scale = zoomScale, сдвиг = -zoomX*(scale-1) + shake
    const spriteset = { scale: { x: 1.5, y: 1.5 }, x: -204, y: -112 };
    const t = xf(spriteset);
    assert.strictEqual(t.kx, 1.5, 'zoom X scale');
    assert.strictEqual(t.ky, 1.5, 'zoom Y scale');
    assert.strictEqual(t.ox, -204, 'origin X (zoom pan + shake)');
    assert.strictEqual(t.oy, -112, 'origin Y');
    // спрайтсет с нулевым scale не должен обнулять координаты (|| 1 fallback)
    const weird = { scale: { x: 0, y: 0 }, x: 10, y: 10 };
    const tw2 = xf(weird);
    assert.strictEqual(tw2.kx, 1, 'zero scale falls back to 1');
});
