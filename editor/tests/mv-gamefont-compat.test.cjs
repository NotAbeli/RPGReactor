const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const compat = fs.readFileSync(
    path.join(repoRoot, 'runtime', 'reactor_mv_compat.js'), 'utf8');

function install(sandbox) {
    const start = compat.indexOf('    function installAudioFontCompatibility() {');
    const end = compat.indexOf('\n    function installPluginManagerCompatibility()', start);
    assert.ok(start >= 0 && end > start, 'the audio/font compatibility section is locatable');
    vm.runInNewContext(
        `${compat.slice(start, end)}\ninstallAudioFontCompatibility();`,
        sandbox
    );
}

test('MV gamefont.css families are registered through FontManager', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-mv-font-'));
    const fonts = path.join(root, 'fonts');
    fs.mkdirSync(fonts);
    fs.writeFileSync(path.join(fonts, 'gamefont.css'), [
        '@font-face {',
        '  font-family: "GameFont";',
        '  src: url("mplus-gamefont.woff") format("woff");',
        '}',
        '@font-face { font-family: MissingFont; src: url(missing.woff); }'
    ].join('\n'));
    fs.writeFileSync(path.join(fonts, 'mplus-gamefont.woff'), 'fixture');

    const loads = [];
    const FontManager = {
        load(family, filename) { loads.push({ family, filename }); }
    };
    const sandbox = {
        global: { FontManager },
        FontManager,
        require,
        process: {
            mainModule: { filename: path.join(root, 'index.html') },
            cwd: () => root
        },
        mvGameSemantics: true
    };

    try {
        install(sandbox);
        assert.deepEqual(loads, [{ family: 'GameFont', filename: 'mplus-gamefont.woff' }],
            'only a declared font that exists on disk is registered');

        FontManager.load('rmmz-mainfont', 'mplus-1m-regular.woff');
        assert.deepEqual(loads.at(-1), {
            family: 'rmmz-mainfont',
            filename: 'mplus-gamefont.woff'
        }, 'an editor-added MZ default falls back to the font the MV project ships');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('the browser fallback links gamefont.css when Node cannot inspect it', () => {
    const links = [];
    const document = {
        querySelector(selector) {
            return links.find(link => selector === `link[href="${link.href}"]`) || null;
        },
        createElement(tag) { return { tag }; },
        head: { appendChild(link) { links.push(link); } }
    };

    install({ global: {}, document, mvGameSemantics: true });

    assert.equal(links.length, 1);
    assert.deepEqual(links[0], {
        tag: 'link',
        rel: 'stylesheet',
        href: 'fonts/gamefont.css'
    });
});

test('an MZ browser game does not request an MV stylesheet it does not ship', () => {
    const links = [];
    const document = {
        querySelector() { return null; },
        createElement(tag) { return { tag }; },
        head: { appendChild(link) { links.push(link); } }
    };

    install({ global: {}, document, mvGameSemantics: false });

    assert.deepEqual(links, []);
});
