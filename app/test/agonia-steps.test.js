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
    const ctx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => pluginParams, registerCommand() {} },
        Imported: {},
        Game_Player, Game_Event, Game_CharacterBase,
        AudioManager: { playSe() {} },
        $gameMap: { terrainTag: () => 0 }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperSteps.js' });
    vm.runInContext('Math.randomInt = function(n) { return Math.floor(Math.random()*n); };', ctx);
    return { ctx };
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

test('P28: <step_snds> в note — персональный пул заменяет террейн', () => {
    const { ctx } = makeEnv({ Events: 'true' });
    const Galv = ctx.Galv;
    // террейн 0 без звуков — обычный путь молчит
    const plain = stubEvent('<biba> <step_se>');
    plain.setStepSe();
    assert.strictEqual(plain.getStepSound(0), null, 'no terrain pool -> silent without override');

    // с пресетом — 2 своих звука, работают без террейна
    const own = stubEvent('<biba> <step_se:80> <step_snds:StepA,StepB>');
    own.setStepSe();
    assert.ok(own._stepSeOn, 'step sounds armed');
    assert.strictEqual(own._stepSeVol, 0.8, 'volume multiplier parsed');
    assert.strictEqual(own._stepPoolOverride.length, 2, 'personal pool built');
    const s = own.getStepSound(0);
    assert.ok(s && (s.name === 'StepA' || s.name === 'StepB'), 'pool member returned');
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
