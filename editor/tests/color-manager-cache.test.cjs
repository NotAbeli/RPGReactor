const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspaceRoot = path.resolve(__dirname, '..', '..');

// Evaluates the real ColorManager colour block against a stub windowskin, so
// the caching contract is exercised rather than asserted as source text.
function loadColorManager() {
    const source = fs.readFileSync(path.join(workspaceRoot, 'runtime', 'reactor_managers.js'), 'utf8');
    const start = source.indexOf('ColorManager.loadWindowskin = function() {');
    const end = source.indexOf('ColorManager.normalColor = function()', start);
    assert.ok(start >= 0 && end > start, 'ColorManager colour section is locatable');

    const sandbox = { ColorManager: {}, ImageManager: { loadSystem: () => null }, console };
    vm.runInNewContext(source.slice(start, end), sandbox);
    return sandbox.ColorManager;
}

function makeWindowskin(ready = true) {
    return {
        reads: 0,
        isReady() { return ready; },
        getPixel(x, y) {
            this.reads++;
            return `#${x}${y}`;
        }
    };
}

test('a loaded windowskin is read once per colour index', () => {
    const ColorManager = loadColorManager();
    const skin = makeWindowskin();
    ColorManager._windowskin = skin;

    const first = ColorManager.textColor(0);
    assert.equal(skin.reads, 1);

    // The victory gauge count-up asks for the same handful of colours every
    // frame; none of those repeats should reach the bitmap again.
    for (let frame = 0; frame < 60; frame++) {
        for (const index of [0, 1, 16, 17]) ColorManager.textColor(index);
    }
    assert.equal(skin.reads, 4, 'one read per distinct colour index, not per call');
    assert.equal(ColorManager.textColor(0), first, 'the cached value matches the first read');
});

test('colours still resolve correctly per index', () => {
    const ColorManager = loadColorManager();
    ColorManager._windowskin = makeWindowskin();

    // px = 96 + (n % 8) * 12 + 6, py = 144 + floor(n / 8) * 12 + 6
    assert.equal(ColorManager.textColor(0), '#102150');
    assert.equal(ColorManager.textColor(1), '#114150');
    assert.equal(ColorManager.textColor(8), '#102162');
    assert.equal(ColorManager.readTextColor(0), '#102150', 'the uncached read is unchanged');
});

test('an unloaded windowskin is never cached', () => {
    const ColorManager = loadColorManager();
    const loading = makeWindowskin(false);
    ColorManager._windowskin = loading;

    ColorManager.textColor(0);
    ColorManager.textColor(0);
    assert.equal(loading.reads, 2, 'a placeholder colour must not become permanent');

    // Once it reports ready, caching engages.
    loading.isReady = () => true;
    ColorManager.textColor(0);
    ColorManager.textColor(0);
    assert.equal(loading.reads, 3);
});

test('swapping the windowskin invalidates the cache', () => {
    const ColorManager = loadColorManager();
    const original = makeWindowskin();
    ColorManager._windowskin = original;
    ColorManager.textColor(0);
    assert.equal(original.reads, 1);

    const replacement = makeWindowskin();
    replacement.getPixel = function() { this.reads++; return '#abcdef'; };
    ColorManager._windowskin = replacement;

    assert.equal(ColorManager.textColor(0), '#abcdef', 'the new skin is read, not the stale cache');
    assert.equal(replacement.reads, 1);

    ColorManager.clearTextColorCache();
    ColorManager.textColor(0);
    assert.equal(replacement.reads, 2, 'an explicit clear forces a re-read');
});

test('a missing windowskin does not throw before load', () => {
    const ColorManager = loadColorManager();
    ColorManager._windowskin = null;
    // Matched by name: the vm context has its own TypeError constructor, so an
    // instanceof check across realms would fail regardless of the throw.
    assert.throws(() => ColorManager.textColor(0), error => error.name === 'TypeError',
        'the uncached path still surfaces a missing skin exactly as before');
});
