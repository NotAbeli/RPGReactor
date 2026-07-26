const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(editorRoot, 'src', 'database', 'DatabaseAnimationEditor.js');
const source = fs.readFileSync(sourcePath, 'utf8');

/**
 * Both numeric readers in this editor are closures inside click handlers, so
 * they are lifted out of the source rather than imported. Mutation testing
 * showed that rewriting either back to `parsed || fallback` — the exact defect
 * already fixed once for the SE volume slider — broke nothing in the suite.
 */
function liftFunction(signature, endMarker) {
    const at = source.indexOf(signature);
    assert.ok(at >= 0, `${signature} is present`);
    const end = source.indexOf(endMarker, at);
    assert.ok(end > at, `${signature} body is delimited`);
    return source.slice(at, end + endMarker.length);
}

function cellReader(values) {
    const body = liftFunction('const intOr = (id, fallback) => {', '};');
    const document = { getElementById: id => ({ value: id in values ? values[id] : '' }) };
    // eslint-disable-next-line no-new-func
    return new Function('document', `${body}\nreturn intOr;`)(document);
}

function effekseerClamp() {
    const body = liftFunction('const clampInput = (input, fallback, min, max) => {', '};');
    // eslint-disable-next-line no-new-func
    return new Function(`${body}\nreturn clampInput;`)();
}

test('an animation cell keeps a deliberate zero', () => {
    // Cell X, Y, rotation and blend of 0 are the common case — a centred,
    // unrotated, normal-blend cell. A truthy default would silently move every
    // such cell to the fallback on save.
    const intOr = cellReader({
        'cell-x': '0', 'cell-y': '0', 'cell-rotation': '0', 'cell-blend': '0', 'cell-pattern': '0'
    });
    for (const [id, fallback] of [['cell-x', 0], ['cell-y', 0], ['cell-rotation', 0],
        ['cell-blend', 0], ['cell-pattern', 0]]) {
        assert.equal(intOr(id, fallback), 0, id);
    }
    assert.equal(cellReader({ 'cell-opacity': '0' })('cell-opacity', 255), 0,
        'a fully transparent cell stays transparent');
    assert.equal(cellReader({ 'cell-scale': '0' })('cell-scale', 100), 0,
        'and the raw read is faithful before clamping');
});

test('an animation cell falls back only when there is no number', () => {
    for (const raw of ['', 'abc', '   ']) {
        assert.equal(cellReader({ 'cell-opacity': raw })('cell-opacity', 255), 255, `"${raw}"`);
    }
});

test('negative cell coordinates and rotations survive', () => {
    assert.equal(cellReader({ 'cell-x': '-120' })('cell-x', 0), -120);
    assert.equal(cellReader({ 'cell-rotation': '-360' })('cell-rotation', 0), -360);
});

test('the Effekseer controls keep a zero offset and rotation', () => {
    const clampInput = effekseerClamp();
    assert.equal(clampInput({ value: '0' }, 0, -360, 360), 0, 'zero rotation');
    assert.equal(clampInput({ value: '-90' }, 0, -360, 360), -90);
    assert.equal(clampInput({ value: '' }, 100, 1, 1000), 100, 'an empty field falls back');
    assert.equal(clampInput({ value: 'abc' }, 100, 1, 1000), 100);
    assert.equal(clampInput(undefined, 100, 1, 1000), 100, 'a missing control falls back');
});

test('the Effekseer clamp still bounds out-of-range input', () => {
    const clampInput = effekseerClamp();
    assert.equal(clampInput({ value: '99999' }, 100, 1, 1000), 1000);
    assert.equal(clampInput({ value: '-99999' }, 0, -360, 360), -360);
    const input = { value: '99999' };
    clampInput(input, 100, 1, 1000);
    assert.equal(input.value, '1000', 'and writes the clamped value back to the control');
});

test('no numeric read in this editor uses a truthy default', () => {
    // The SE volume slider shipped with `parseInt(...) || 90`, which turned a
    // deliberate silence into near-full volume. Keep the whole file clear of it.
    const offenders = [];
    source.split('\n').forEach((line, index) => {
        if (!/parseInt\([^)]*\)\s*\|\|\s*[1-9]/.test(line)) return;
        // Reads whose control cannot produce 0 are fine. Both of these are
        // min="50" / min="1" sliders, so a falsy parse means "not a number".
        if (/sePitchSlider|timing-se-pitch|timing-duration/.test(line)) return;
        offenders.push(`${index + 1}: ${line.trim()}`);
    });
    assert.deepEqual(offenders, [],
        `these discard a legitimate zero:\n${offenders.join('\n')}`);
});
