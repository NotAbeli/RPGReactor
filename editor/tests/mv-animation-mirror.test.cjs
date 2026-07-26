const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspaceRoot = path.resolve(__dirname, '..', '..');
const compatPath = path.join(workspaceRoot, 'runtime', 'reactor_mv_compat.js');
const spritesPath = path.join(workspaceRoot, 'runtime', 'reactor_sprites.js');

function installAnimationMirrorCompatibility(Spriteset_Base) {
    const compat = fs.readFileSync(compatPath, 'utf8');
    const start = compat.indexOf('    function installAnimationMirrorCompatibility() {');
    const end = compat.indexOf('\n    function installBattleFieldOffsetCompatibility()', start);
    assert.ok(start >= 0 && end > start, 'animation mirror section is locatable');
    const sandbox = { global: { Spriteset_Base }, Spriteset_Base, console };
    vm.runInNewContext(
        `${compat.slice(start, end)}\ninstallAnimationMirrorCompatibility();`,
        sandbox
    );
}

// The stock MZ rule, lifted from runtime/reactor_sprites.js.
function makeSpritesetBase() {
    function Spriteset_Base() {}
    Spriteset_Base.prototype.animationShouldMirror = function(target) {
        return target && target.isActor && target.isActor();
    };
    return Spriteset_Base;
}

const actor = { isActor: () => true };
const enemy = { isActor: () => false };

test('MZ mirrors animations on actors; MV games must not', () => {
    const Spriteset_Base = makeSpritesetBase();

    // Baseline: the stock MZ rule flips anything played on an actor.
    assert.equal(Spriteset_Base.prototype.animationShouldMirror(actor), true);

    installAnimationMirrorCompatibility(Spriteset_Base);

    assert.equal(Spriteset_Base.prototype.animationShouldMirror(actor), false,
        'an MV animation on an actor plays as authored, not reversed');
    assert.equal(Spriteset_Base.prototype.animationShouldMirror(enemy), false);
    assert.equal(Spriteset_Base.prototype.animationShouldMirror(null), false,
        'a missing target must not throw');
});

test('installing twice leaves one override', () => {
    const Spriteset_Base = makeSpritesetBase();
    installAnimationMirrorCompatibility(Spriteset_Base);
    const first = Spriteset_Base.prototype.animationShouldMirror;
    installAnimationMirrorCompatibility(Spriteset_Base);
    assert.equal(Spriteset_Base.prototype.animationShouldMirror, first,
        'the guard flag prevents re-wrapping');
});

test('MV corescript has no auto-mirror rule, and MZ still applies one', () => {
    // The premise of the fix: MZ invented animationShouldMirror; MV has no
    // equivalent, so MV content is authored for unmirrored playback.
    const mvCorescript = path.join(
        workspaceRoot, 'template', 'Star Shift Rebellion', 'js', 'MV Corescript', 'rpg_sprites.js');
    if (fs.existsSync(mvCorescript)) {
        assert.equal(/animationShouldMirror/.test(fs.readFileSync(mvCorescript, 'utf8')), false,
            'MV defines no animationShouldMirror');
    }

    const sprites = fs.readFileSync(spritesPath, 'utf8');
    assert.match(sprites, /animationShouldMirror\(targets\[0\]\)\)\s*\{\s*mirror = !mirror/,
        'MZ flips the mirror flag through animationShouldMirror');
    assert.match(sprites, /Spriteset_Base\.prototype\.animationShouldMirror = function\(target\) \{\s*return target && target\.isActor && target\.isActor\(\);/,
        'and the MZ rule is "every actor"');
});
