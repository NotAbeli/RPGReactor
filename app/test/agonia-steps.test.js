/**
 * P28: SuperDuperSteps — персональный пул звуков шагов врага.
 * <step_snds:A,B,C,D> в note события заменяет пул террейна (враги звучат
 * как герой — 4 звука — или своими пресетами); работает и на террейне
 * без своих звуков; громкость <step_se:VOL> и дистанционный фейд прежние.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperSteps.js'), 'utf8');

class Game_CharacterBase {}
class Game_Character extends Game_CharacterBase {}
class Game_Event extends Game_Character {}
class Game_Player extends Game_Character {}

function makeEnv(pluginParams = {}) {
    const played = [];
    const ctx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => pluginParams, registerCommand() {} },
        Imported: {},
        Game_Player, Game_Event, Game_CharacterBase,
        AudioManager: { playSe(se, aex) { played.push({ se: se, aex: aex }); } },
        $gameMap: { terrainTag: () => 0 },
        $gamePlayer: { x: 0, y: 0 }
    };
    ctx.window = ctx;
    
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperSteps.js' });
    vm.runInContext('Math.randomInt = function(n) { return Math.floor(Math.random()*n); };', ctx);
    return { ctx, played };
}

function stubEvent(note, pageComments) {
    return Object.assign(Object.create(Game_Event.prototype), {
        _characterName: 'Enemy1',
        _x: 0, _y: 0,
        event: () => ({ note: note || '' }),
        page: () => ({
            list: (pageComments || []).map(c => ({ code: 108, parameters: [c] }))
        })
    });
}

test('P28: <step_snds> в note — персональный пул как фоллбек поверхности', () => {
    const { ctx } = makeEnv({ Events: 'true' });
    const Galv = ctx.Galv;
    // террейн 0 без звуков — обычный путь молчит
    const plain = stubEvent('<biba> <step_se>');
    plain.setStepSe();
    assert.strictEqual(plain.getStepSound(0), null, 'no terrain pool, no preset -> silent');

    // P29: ПОВЕРХНОСТЬ ПРЕЖДЕ ВСЕГО — на террейне со своим пулом
    // пресет НЕ подменяет звук (враг звучит как герой)
    Galv.CFSTEP.terrainConfig[2] = { mode: 'random', sounds: [{ name: 'MetalStep', volume: 50, pitch: 100, pan: 0 }] };
    const own = stubEvent('<biba> <step_se:80> <step_snds:StepA,StepB>');
    own.setStepSe();
    assert.ok(own._stepSeOn, 'step sounds armed');
    assert.strictEqual(own._stepSeVol, 0.8, 'volume multiplier parsed');
    assert.strictEqual(own.getStepSound(2).name, 'MetalStep', 'terrain pool wins over the preset');
    // а на поверхности без пула — играет персональный пресет
    const s = own.getStepSound(0);
    assert.ok(s && (s.name === 'StepA' || s.name === 'StepB'), 'preset is the fallback on bare terrain');
    assert.strictEqual(s.volume, 90, 'pool default volume');
});

test('P28: <step_snds> в комментарии страницы работает как фоллбек', () => {
    const { ctx } = makeEnv({ Events: 'true' });
    const ev = stubEvent('', ['<step_se:120>', '<step_snds:Heavy1, Heavy2, Heavy3>']);
    ev._characterName = ''; // note-ветка требует графику — фоллбек в комментарии
    ev.setStepSe();
    assert.ok(ev._stepSeOn, 'armed via page comment');
    assert.strictEqual(ev._stepSeVol, 1.2, 'comment volume parsed');
    assert.strictEqual(ev._stepPoolOverride.length, 3, 'comment pool with spaces trimmed');
    const names = new Set();
    for (let i = 0; i < 30; i++) names.add(ev.getStepSound(0).name);
    assert.ok(names.has('Heavy1') && names.has('Heavy2'), 'random picks from the pool');
});

test('P28: пустой <step_snds:> не ломает пул террейна', () => {
    const { ctx } = makeEnv({ Events: 'true' });
    // террейн с пулом из конфига
    const Galv = ctx.Galv;
    Galv.CFSTEP.terrainConfig[2] = { mode: 'random', sounds: [{ name: 'T1', volume: 50, pitch: 100, pan: 0 }] };
    const ev = stubEvent('<biba> <step_snds:,>');
    ev.setStepSe();
    assert.strictEqual(ev._stepPoolOverride, null, 'garbage override ignored');
    const s = ev.getStepSound(2);
    assert.strictEqual(s.name, 'T1', 'terrain pool used');
});

test('P30: с OcRam шаги врага играют позиционно — playSe(se, aex) с привязкой к событию', () => {
    const { ctx, played } = makeEnv({ Events: 'true', 'Max Hearing Distance': 8 });
    ctx.Imported['OcRam_Audio_EX'] = true; // OcRam доступен
    const Galv = ctx.Galv;
    Galv.CFSTEP.terrainConfig[0] = { mode: 'random', sounds: [{ name: 'Concrete1', volume: 90, pitch: 100, pan: 0 }] };
    const ev = stubEvent('<biba> <step_se>');
    ev._eventId = 5;
    ev.setStepSe();
    ev.realMoveSpeed = () => 4;
    ev.playStepSE();
    assert.strictEqual(played.length, 1, 'one SE played');
    const p = played[0];
    assert.ok(p.aex, 'aex object passed to playSe (positional path)');
    assert.strictEqual(p.aex.eventId, ev._eventId, 'anchored to the enemy event');
    assert.strictEqual(p.aex.distance, 8, 'fade zone = max hearing distance');
    assert.strictEqual(p.aex.radius, 1, 'full volume bubble at the source');
    assert.strictEqual(p.aex.pan, true, 'stereo autopan on');
    assert.strictEqual(p.se.pan, 0, 'pan handled by AEX, not the SE buffer');
});

test('P30: без OcRam — прежний линейный фейд по дистанции (фоллбек)', () => {
    const { ctx, played } = makeEnv({ Events: 'true', 'Max Hearing Distance': 8 });
    const Galv = ctx.Galv;
    Galv.CFSTEP.terrainConfig[0] = { mode: 'random', sounds: [{ name: 'Concrete1', volume: 90, pitch: 100, pan: 0 }] };
    const ev = stubEvent('<biba> <step_se>');
    ev._eventId = 7; // событие (не герой)
    ev.setStepSe();
    ev.realMoveSpeed = () => 4;
    // враг в 4 тайлах (половина зоны) — линейный фейд ~50%
    ev._x = 4; ev._y = 0;
    ctx.$gamePlayer = { x: 0, y: 0 };
    ev.playStepSE();
    assert.strictEqual(played.length, 1, 'played');
    assert.strictEqual(played[0].aex, undefined, 'no aex without OcRam');
    assert.ok(played[0].se.volume < 90 && played[0].se.volume > 30,
        'distance fade applied, got ' + played[0].se.volume);
    // герой играет БЕЗ дистанционной обработки в обоих режимах
    const hero = stubEvent('');
    hero._eventId = undefined;
    hero.realMoveSpeed = () => 4;
    hero.playStepSE();
    assert.strictEqual(played[1].se.volume >= 80, true, 'hero steps at full volume');
});
