const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const optionsSource = fs.readFileSync(path.join(editorRoot, 'src', 'OptionsManager.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(editorRoot, 'css', 'styles.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');

/** The palette registry, read from the file that owns it. */
function palettes() {
    const at = optionsSource.indexOf('const THEME_PALETTES = [');
    assert.ok(at >= 0, 'the registry is present');
    const end = optionsSource.indexOf('\n];', at);
    // eslint-disable-next-line no-new-func
    const list = new Function(`${optionsSource.slice(at, end + 3)}\nreturn THEME_PALETTES;`)();
    assert.ok(list.length >= 2, `the registry is populated (${list.length})`);
    return list.map(entry => entry.id);
}

/** Mirrors OptionsManager._buildThemeKey without duplicating its rules. */
function themeKey(palette, mode) {
    const instance = vm.runInNewContext(
        `${optionsSource}\nObject.create(OptionsManager.prototype);`,
        { window: { addEventListener() {} }, document: { getElementById: () => null }, localStorage: null, console }
    );
    return instance._buildThemeKey(palette, mode);
}

const PALETTE_IDS = palettes();
const LIGHT_KEYS = PALETTE_IDS.map(id => themeKey(id, 'light'));

/** Every comma-joined `:root[data-theme=…]` group in the stylesheet. */
function lightSelectorGroups() {
    const groups = [];
    const pattern = /((?::root\[data-theme="[^"]+"\][^,{]*,\s*)+:root\[data-theme="[^"]+"\][^,{]*)\{/g;
    let match;
    while ((match = pattern.exec(cssSource)) !== null) {
        const keys = [...match[1].matchAll(/data-theme="([^"]+)"/g)].map(entry => entry[1]);
        if (!keys.some(key => key === 'light' || key.endsWith('-light'))) continue;
        groups.push({ keys, line: cssSource.slice(0, match.index).split('\n').length });
    }
    return groups;
}

test('the theme key rules round-trip through the registry', () => {
    assert.equal(themeKey('gold', 'dark'), 'dark', 'the default palette has no prefix');
    assert.equal(themeKey('gold', 'light'), 'light');
    assert.equal(themeKey('ocean', 'light'), 'ocean-light');
    assert.equal(new Set(LIGHT_KEYS).size, PALETTE_IDS.length, 'every palette gets a distinct light key');
});

test('every light-mode override lists every palette', () => {
    // Light overrides are written as one comma-joined group per rule. Adding a
    // palette to the registry without extending these groups leaves that
    // palette's light mode silently falling back to the dark styling.
    const groups = lightSelectorGroups();
    assert.ok(groups.length >= 3, `light override groups are found (${groups.length})`);

    const gaps = [];
    for (const group of groups) {
        const missing = LIGHT_KEYS.filter(key => !group.keys.includes(key));
        if (missing.length) {
            gaps.push(`styles.css:${group.line} omits ${missing.join(', ')}`);
        }
    }
    assert.deepEqual(gaps, [],
        `these light-mode rules do not cover every palette:\n${gaps.join('\n')}`);
});

test('no light rule targets a palette the registry does not define', () => {
    const known = new Set(LIGHT_KEYS);
    const strays = [];
    for (const group of lightSelectorGroups()) {
        for (const key of group.keys) {
            if (!known.has(key)) strays.push(`styles.css:${group.line} targets unknown theme "${key}"`);
        }
    }
    assert.deepEqual(strays, [], strays.join('\n'));
});

test('the palettes offered in the UI are the ones the stylesheet supports', () => {
    // A palette in the registry with no dark-mode variables would render as the
    // default; check each id actually appears in the stylesheet somewhere.
    const absent = PALETTE_IDS
        .filter(id => id !== 'gold')  // gold is the bare :root block
        .filter(id => !cssSource.includes(`data-theme="${id}-dark"`) && !cssSource.includes(`data-theme="${id}-light"`));
    assert.deepEqual(absent, [], `registered but unstyled: ${absent.join(', ')}`);
});

test('the stylesheet and the registry are both loaded by the editor', () => {
    assert.match(indexSource, /href="css\/styles\.css"/);
    assert.match(indexSource, /src="src\/OptionsManager\.js"/);
});
