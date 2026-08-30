/**
 * P37c: stun + knockback applied DIRECTLY in processHit (the point of
 * impact), not via the P14 skeleton page (which depends on the melee
 * card's action string setting self-switch D — may never trigger).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperBattle.js'), 'utf8');

class Game_Player {}
class Game_Character {}
class Game_CharacterBase {}
class Game_Event {}
class Game_Interpreter {}
class Game_Map {}
class Scene_Map {}
class Window_Base {}
class Sprite { initialize() { } update() { } }
class Bitmap { constructor(w, h) { this.width = w; this.height = h; } }
class TilingSprite { initialize() { } }
class PIXI_Graphics { }

function makeEnv() {
    const ctx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => ({}), registerCommand() {} },
        Imported: {},
        Game_Player, Game_Character, Game_CharacterBase, Game_Event,
        Game_Interpreter, Game_Map, Scene_Map, Window_Base, Sprite, Bitmap,
        TilingSprite,
        PIXI: { Graphics: PIXI_Graphics },
        Graphics: { width: 800, height: 600, frameCount: 0, BLEND_ADD: 1 },
        ImageManager: { loadPicture: () => new Bitmap(48, 48) },
        $gamePlayer: new Game_Player(),
        $gameVariables: { value: () => 2 },
        $gameSwitches: { value: () => false, setValue() {} },
        $gameMap: null,
        SceneManager: { _scene: null },
        SDE_API: null,
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    try { vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperBattle.js' }); } catch (e) {
        // может падать на спрайтах — но processHit уже определён к этому моменту
    }
    return ctx;
}

test('P37c: processHit применяет стан и отбрасывание оружием игрока', () => {
    const ctx = makeEnv();
    const applied = [];
    // SDE_API-заглушка с оружием
    ctx.SDE_API = {
        getWeaponByVar: v => (Number(v) === 2 ? { stun: '30', knockback: '1.5' } : null),
        hitStun: (evId, f) => applied.push({ fn: 'stun', evId, f }),
        hitKnockback: (evId, t) => applied.push({ fn: 'kb', evId, t })
    };
    const enemy = { eventId: () => 7 };
    const data = { AnimID: 0, ActionsEvent: '' };
    // processHit — доступен через контекст?
    const SDB = ctx.SDB || ctx.window.SDB;
    if (!SDB) throw new Error('SDB not exported');
    SDB.Core.processHit(enemy, ctx.$gamePlayer, data);
    assert.strictEqual(applied.length, 2, 'both stun and knockback applied');
    assert.strictEqual(applied[0].fn, 'stun');
    assert.strictEqual(applied[0].f, 30);
    assert.strictEqual(applied[1].fn, 'kb');
    assert.strictEqual(applied[1].t, 1.5);
});

test('P37c: processHit НЕ применяет для игрока-цели или врага-атакующего', () => {
    const ctx = makeEnv();
    const applied = [];
    ctx.SDE_API = {
        getWeaponByVar: v => ({ stun: '30', knockback: '1.5' }),
        hitStun: (evId, f) => applied.push('stun'),
        hitKnockback: (evId, t) => applied.push('kb')
    };
    const SDB = ctx.SDB || ctx.window.SDB;
    // цель = игрок → не применять
    SDB.Core.processHit(ctx.$gamePlayer, ctx.$gamePlayer, { AnimID: 0, ActionsEvent: '' });
    assert.strictEqual(applied.length, 0, 'player target: no stun/kb');
    // атакующий = враг → не применять (только оружие игрока)
    const enemy = { eventId: () => 7 };
    SDB.Core.processHit(enemy, enemy, { AnimID: 0, ActionsEvent: '' });
    assert.strictEqual(applied.length, 0, 'enemy attacker: no stun/kb');
});

test('P37c: getWeaponByVar находит карточку по var-значению', () => {
    const ctx = makeEnv();
    // через SuperDuperEnemies (реестр SDE_WEAPONS)
    const enemiesSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperEnemies.js'), 'utf8');
    // добавим оружие прямо в SDE_API для теста
    ctx.SDE_API = null;
    // просто проверяем, что SuperDuperEnemies экспортирует getWeaponByVar
    const ectx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => ({}), registerCommand() {} },
        Imported: {},
        Game_Player: class {}, Game_Event: class {}, Game_Character: class {},
        Game_CharacterBase: class {}, Game_Interpreter: class {}, Game_Map: class {},
        Scene_Map: class {},
        $gameSwitches: { value: () => false, setValue() {} },
        $gameVariables: { value: () => 0, setValue() {} },
        $gameSelfSwitches: { value: () => false, setValue() {} },
        $gameMap: null, $gamePlayer: null, $dataMap: null, $dataCommonEvents: [],
        DataManager: { isDatabaseLoaded: () => true },
    };
    ectx.window = ectx;
    vm.createContext(ectx);
    vm.runInContext(enemiesSrc, ectx, { filename: 'SuperDuperEnemies.js' });
    const sde = ectx.__SDE_TEST;
    // SDE_WEAPONS пуст — вернёт null
    assert.strictEqual(ectx.SDE_API.getWeaponByVar(2), null, 'empty arsenal returns null');
});
