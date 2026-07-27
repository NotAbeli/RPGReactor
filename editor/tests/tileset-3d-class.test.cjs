const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const editorRoot = path.resolve(__dirname, '..');
const C = require(path.join(editorRoot, 'src', 'utils', 'Tileset3DClass.js'));
const runtimeSource = fs.readFileSync(path.join(repoRoot, 'runtime', 'reactor_3d.js'), 'utf8');

test('the class values match the runtime that consumes them', () => {
    // The editor cannot load the runtime module, so the two hold the same
    // numbers by assertion rather than by sharing a definition.
    for (const [name, value] of [['AUTO', C.AUTO], ['GROUND', C.GROUND], ['UPRIGHT', C.UPRIGHT]]) {
        assert.match(runtimeSource, new RegExp(`Reactor3D\\.CLASS_${name} = ${value};`),
            `CLASS_${name} is ${value} in the runtime`);
    }
    assert.match(runtimeSource, new RegExp(`CLASSIFICATION_FILE = "${C.FILENAME}"`));
});

test('an unclassified tile falls through to the heuristic', () => {
    const data = C.create();
    assert.equal(C.classOf(data, 224, 2816), C.AUTO);
    assert.ok(C.isEmpty(data), 'and a fresh file classifies nothing');
});

test('classes round-trip through JSON', () => {
    let data = C.create();
    data = C.setClass(data, 224, 2816, C.UPRIGHT);
    data = C.setClass(data, 224, 1029, C.GROUND);
    const reloaded = C.normalize(JSON.parse(JSON.stringify(data)));
    assert.equal(C.classOf(reloaded, 224, 2816), C.UPRIGHT);
    assert.equal(C.classOf(reloaded, 224, 1029), C.GROUND);
    assert.equal(C.classOf(reloaded, 224, 999), C.AUTO);
});

test('clearing a tile leaves no husk behind', () => {
    // AUTO is the absence of an entry, so a cleared file must equal a fresh one
    // rather than carrying empty objects that grow with every edit.
    let data = C.setClass(C.create(), 224, 2816, C.UPRIGHT);
    data = C.setClass(data, 224, 2816, C.AUTO);
    assert.deepEqual(data, C.create());
    assert.ok(C.isEmpty(data));
});

test('a malformed file degrades instead of throwing', () => {
    for (const bad of [null, 'nope', 42, {}, { tilesets: 'no' }, { tilesets: { 1: 'no' } }]) {
        const data = C.normalize(bad);
        assert.ok(C.isEmpty(data), `${JSON.stringify(bad)} normalises to empty`);
    }
    // Unknown class values are dropped rather than stored.
    const data = C.normalize({ version: 1, tilesets: { 5: { 100: 7, 101: C.GROUND } } });
    assert.equal(C.classOf(data, 5, 100), C.AUTO);
    assert.equal(C.classOf(data, 5, 101), C.GROUND);
});

test('clicking cycles ground, upright, scenery, back to automatic', () => {
    assert.equal(C.cycle(C.AUTO), C.GROUND);
    assert.equal(C.cycle(C.GROUND), C.UPRIGHT);
    assert.equal(C.cycle(C.UPRIGHT), C.SCENERY);
    assert.equal(C.cycle(C.SCENERY), C.AUTO);
});

test('classified counts are per tileset', () => {
    let data = C.setClass(C.create(), 224, 1, C.GROUND);
    data = C.setClass(data, 224, 2, C.UPRIGHT);
    data = C.setClass(data, 225, 3, C.GROUND);
    assert.equal(C.countClassified(data, 224), 2);
    assert.equal(C.countClassified(data, 225), 1);
    assert.equal(C.countClassified(data, 999), 0);
});

test('the util is loaded by the editor', () => {
    const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
    assert.match(html, /src\/utils\/Tileset3DClass\.js/);
});
