/**
 * An event says which layer its animations play on.
 *
 * Where an animation belongs is a question about the scene, not about the
 * engine. A spell cast over a character should be in front of the furniture; a
 * glow on a console set into a table should be behind the table's own top. One
 * map will want both, so the answer cannot be a setting — it is written on the
 * event the animation is played on, which is the only thing that knows.
 *
 * Reported on Freelancers' map 342: three animations on a table whose top is
 * flagged "above characters". In 2D an animation is always at layer 8 and so
 * always over everything, which suited that table; the 3D view places it by its
 * host instead, which put it under the table top. Both are right for some
 * table, which is what makes it authored rather than chosen.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');

/** The reader, lifted out of the runtime and given a bare Spriteset_Base. */
function reader() {
    const source = fs.readFileSync(
        path.join(repoRoot, 'runtime', 'reactor_sprites.js'), 'utf8');
    const start = source.indexOf('Spriteset_Base.prototype.authoredAnimationZ = function');
    const end = source.indexOf('Spriteset_Base.prototype.isMVAnimation');
    assert.ok(start >= 0 && end > start, 'the reader is where the test expects it');

    const sandbox = { Spriteset_Base: function() {} };
    sandbox.Spriteset_Base.prototype = {};
    vm.runInNewContext(source.slice(start, end), sandbox);
    const spriteset = new sandbox.Spriteset_Base();
    return {
        read: targets => sandbox.Spriteset_Base.prototype.authoredAnimationZ.call(spriteset, targets),
        ANIMATION_Z: sandbox.Spriteset_Base.ANIMATION_Z
    };
}

/** An event target as the runtime sees one: state, with its data beside it. */
const event = note => ({ event: () => ({ note }) });

test('an event with nothing to say keeps the default', () => {
    // Which is the whole existing behaviour, in both views. Every project on
    // disk is in this state and none of them may move.
    const { read } = reader();
    assert.equal(read([event('')]), null);
    assert.equal(read([event('<3d>')]), null);
    assert.equal(read([]), null);
    assert.equal(read(null), null);
});

test('a stated layer is used exactly', () => {
    const { read } = reader();
    assert.equal(read([event('<animation z: 6>')]), 6);
    assert.equal(read([event('<animation z:0>')]), 0, 'the ground layer is a real answer');
    assert.equal(read([event('<animation z: 4.5>')]), 4.5, 'and so is a half, between two layers');
    assert.equal(read([event('<animation z: -1>')]), -1, 'even beneath the map');
});

test('the spelling is forgiving, because a note is typed by hand', () => {
    const { read } = reader();
    for (const note of [
        '<animation z: 6>', '<anim z: 6>', '<ANIMATION Z: 6>',
        '<  animation   z :  6  >', 'text before <animation z: 6> and after'
    ]) {
        assert.equal(read([event(note)]), 6, note);
    }
});

test('`over` is the shorthand for where RPG Maker puts one', () => {
    const { read, ANIMATION_Z } = reader();
    assert.equal(ANIMATION_Z, 8, 'above the tiles drawn over characters');
    assert.equal(read([event('<animation over>')]), 8);
    assert.equal(read([event('<anim over>')]), 8);
    // An exact layer wins over the shorthand when both are written.
    assert.equal(read([event('<animation over>\n<animation z: 2>')]), 2);
});

test('the first target that has asked is the one answered', () => {
    // An animation played on several targets is one sprite on one layer, so
    // there is a single answer to give. Taking the first stated one is at least
    // predictable, where averaging or refusing would be neither.
    const { read } = reader();
    assert.equal(read([event(''), event('<animation z: 5>'), event('<animation z: 9>')]), 5);
});

test('a target with no note of its own is not an error', () => {
    // The player, its followers and the vehicles carry no note — and never need
    // one: an animation on the player is on the thing the camera is following,
    // which is the case the default already suits.
    const { read } = reader();
    assert.equal(read([{}]), null, 'no event() at all');
    assert.equal(read([{ event: () => null }]), null, 'no data record');
    assert.equal(read([{ event: () => ({}) }]), null, 'a record with no note');
    assert.equal(read([null, undefined]), null);
});

test('a malformed layer is ignored rather than guessed at', () => {
    const { read } = reader();
    assert.equal(read([event('<animation z: over>')]), null);
    assert.equal(read([event('<animation z:>')]), null);
});

test('the note is read in both views, and the 3D rule yields to it', () => {
    const source = fs.readFileSync(
        path.join(repoRoot, 'runtime', 'reactor_sprites.js'), 'utf8');
    const block = source.slice(source.indexOf('const authored = this.authoredAnimationZ(targets);'));
    const body = block.slice(0, block.indexOf('this._animationSprites.push(sprite)'));

    // Read before the 3D branch and outside it, so 2D gets the same say.
    assert.match(body, /if \(authored !== null\) sprite\.z = authored;/);
    // And the 3D placement only applies where nothing was authored.
    assert.match(body, /if \(authored === null && this\._reactor3d && !this\.isScreenAnimation\(animation\)\)/);
    // The default is untouched: still the host's layer, a half in front.
    assert.match(body, /sprite\.z = hostZ === null \? 3 : hostZ \+ 0\.5;/);
    // And the sort runs whichever way the layer was decided.
    assert.match(body, /holder\._sortChildren\(\)/);
    assert.ok(body.indexOf('holder._sortChildren()') > body.indexOf('sprite.z = hostZ'),
        'after both paths have had their say');
});
