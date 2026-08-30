/**
 * P38: Clean weapon effects system — applyWeaponEffects sets stun/knockback
 * directly on the target object when the player's weapon hits an enemy.
 * No SDE_API intermediary, no event lookup, no P14 dependency.
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
        $gameVariables: { value: () => 2 }, // var 17 = 2 (лом)
        $gameSwitches: { value: () => false, setValue() {} },
        $gameMap: null,
        SceneManager: { _scene: null },
        SDE_API: null,
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    try { vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperBattle.js' }); } catch (e) {
        // может падать на спрайтах — processHit уже определён
    }
    return ctx;
}

test('P38: applyWeaponEffects ставит стан и отбрасывание на цель', () => {
    const ctx = makeEnv();
    ctx.$gamePlayer._x = 0; ctx.$gamePlayer._y = 3;
    ctx.SDE_API = {
        getWeaponByVar: v => (Number(v) === 2 ? { stun: '30', knockback: '1.5' } : null),
        getTemplate: () => null // без карточки — без иммунитетов
    };
    const SDB = ctx.SDB || ctx.window.SDB;
    const enemy = { _eventId: 7, _x: 5, _y: 3, _erased: false,
        eventId: () => 7, event: () => ({ note: '' }) };
    SDB.Core.applyWeaponEffects(enemy, ctx.$gamePlayer);
    assert.strictEqual(enemy._sdeStunTimer, 30, 'stun timer set directly');
    assert.ok(enemy._sdeKnockback, 'knockback set directly');
    assert.strictEqual(enemy._sdeKnockback.remaining, 1.5, 'knockback distance');
    assert.ok(enemy._sdeKnockback.vx > 0, 'pushed away from player (0,3) to (5,3)');
});

test('P38: processHit вызывает applyWeaponEffects для игрок→враг', () => {
    const ctx = makeEnv();
    ctx.$gamePlayer._x = 0; ctx.$gamePlayer._y = 3;
    ctx.SDE_API = {
        getWeaponByVar: v => ({ stun: '30', knockback: '1.5' }),
        getTemplate: () => null
    };
    const SDB = ctx.SDB || ctx.window.SDB;
    const enemy = { _eventId: 7, _x: 5, _y: 3, _erased: false,
        eventId: () => 7, event: () => ({ note: '' }) };
    SDB.Core.processHit(enemy, ctx.$gamePlayer, { AnimID: 0, ActionsEvent: '' });
    assert.strictEqual(enemy._sdeStunTimer, 30, 'stun via processHit');
    assert.ok(enemy._sdeKnockback, 'knockback via processHit');
});

test('P38: НЕ применяется для игрока-цели или врага-атакующего', () => {
    const ctx = makeEnv();
    ctx.SDE_API = {
        getWeaponByVar: v => ({ stun: '30', knockback: '1.5' }),
        getTemplate: () => null
    };
    const SDB = ctx.SDB || ctx.window.SDB;
    // цель = игрок
    const player = ctx.$gamePlayer;
    player._erased = false;
    SDB.Core.applyWeaponEffects(player, ctx.$gamePlayer);
    assert.ok(!player._sdeStunTimer, 'player target: no stun');
    // атакующий = враг
    const enemy = { _eventId: 7, _x: 5, _y: 3, _erased: false,
        event: () => ({ note: '' }) };
    const enemy2 = { _eventId: 8, _x: 6, _y: 3, _erased: false,
        event: () => ({ note: '' }) };
    SDB.Core.applyWeaponEffects(enemy2, enemy);
    assert.ok(!enemy2._sdeStunTimer, 'enemy attacker: no stun on target');
});

test('P38: иммунитеты из карточки врага (ignoreStun/ignoreKnockback)', () => {
    const ctx = makeEnv();
    ctx.SDE_API = {
        getWeaponByVar: v => ({ stun: '30', knockback: '1.5' }),
        getTemplate: tag => (tag === 'biba' ? { ignoreStun: 'true', ignoreKnockback: 'true' } : null)
    };
    const SDB = ctx.SDB || ctx.window.SDB;
    const immune = { _eventId: 7, _x: 5, _y: 3, _erased: false,
        event: () => ({ note: '<biba> <step_se>' }) };
    SDB.Core.applyWeaponEffects(immune, ctx.$gamePlayer);
    assert.ok(!immune._sdeStunTimer, 'ignoreStun blocks stun');
    assert.ok(!immune._sdeKnockback, 'ignoreKnockback blocks knockback');
});
