const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(editorRoot, 'src', 'database', 'DatabaseAnimationEditor.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function loadEditor() {
    return vm.runInNewContext(`${source}\nDatabaseAnimationEditor;`, {
        console, process, require, nw: {}, window: {},
        document: { createElement: () => ({ style: {} }), getElementById: () => null }
    });
}

const DatabaseAnimationEditor = loadEditor();

function docWith(values) {
    return { getElementById: id => (id in values ? { value: values[id] } : null) };
}

test('a silent SE keeps volume 0 instead of snapping back to the default', () => {
    // The slider is min="0" and 0 is a valid RPG Maker volume, so the old
    // `parseInt(...) || 90` turned "silent" into "almost full volume".
    const read = DatabaseAnimationEditor.readNumericInput(
        'timing-se-volume', 90, docWith({ 'timing-se-volume': '0' }));
    assert.equal(read, 0);
});

test('ordinary values are unchanged', () => {
    for (const [raw, expected] of [['1', 1], ['45', 45], ['100', 100]]) {
        assert.equal(
            DatabaseAnimationEditor.readNumericInput('timing-se-volume', 90, docWith({ 'timing-se-volume': raw })),
            expected
        );
    }
});

test('the fallback still applies when there is nothing to read', () => {
    assert.equal(DatabaseAnimationEditor.readNumericInput('timing-se-volume', 90, docWith({})), 90,
        'a missing element falls back');
    assert.equal(
        DatabaseAnimationEditor.readNumericInput('timing-se-volume', 90, docWith({ 'timing-se-volume': '' })), 90,
        'an empty field falls back');
    assert.equal(
        DatabaseAnimationEditor.readNumericInput('timing-se-volume', 90, docWith({ 'timing-se-volume': 'abc' })), 90,
        'an unparseable value falls back');
});

test('negative values are preserved rather than treated as absent', () => {
    // Not reachable from this slider, but the helper must not invent a value
    // for controls whose range includes negatives, such as pan.
    assert.equal(
        DatabaseAnimationEditor.readNumericInput('pan', 0, docWith({ pan: '-50' })), -50);
});

test('the SE volume read no longer uses a truthy default', () => {
    assert.doesNotMatch(source, /timing-se-volume'\)\.value\)\s*\|\|/,
        'a || default would discard a deliberate zero again');
    assert.match(source, /readNumericInput\('timing-se-volume', 90\)/);
});

test('the neighbouring reads are left alone, since zero is out of their range', () => {
    // timing-duration is min="1", timing-se-pitch is min="50": a || default
    // cannot discard a legitimate value there, so they were not churned.
    assert.match(source, /id="timing-duration" min="1"/);
    assert.match(source, /id="timing-se-pitch" min="50"/);
});
