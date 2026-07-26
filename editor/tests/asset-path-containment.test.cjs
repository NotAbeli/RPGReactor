const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const assetFilesPath = path.join(editorRoot, 'src', 'utils', 'AssetFiles.js');
const RRAssetFiles = require(assetFilesPath);
const source = fs.readFileSync(assetFilesPath, 'utf8');

/**
 * Asset names come from project data — a character sheet name, a battler, a BGM
 * — so an imported project controls them. The editor window has Node enabled,
 * so a name that resolves outside the project directory is a real escape.
 */
function sandbox() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-asset-containment-'));
    fs.mkdirSync(path.join(base, 'project', 'img', 'characters'), { recursive: true });
    fs.mkdirSync(path.join(base, 'outside'), { recursive: true });
    fs.writeFileSync(path.join(base, 'project', 'img', 'characters', 'Actor1.png'), 'inside');
    fs.writeFileSync(path.join(base, 'outside', 'secret.png'), 'outside');
    fs.writeFileSync(path.join(base, 'project', 'img', 'secret.png'), 'sibling');
    return { base, root: path.join(base, 'project', 'img', 'characters') };
}

test('an ordinary name resolves', () => {
    const { base, root } = sandbox();
    try {
        const found = RRAssetFiles.find(root, 'Actor1', ['.png']);
        assert.ok(found, 'the real asset is found');
        assert.equal(fs.readFileSync(found.absolutePath, 'utf8'), 'inside');
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('a name that climbs out of the asset root resolves to nothing', () => {
    const { base, root } = sandbox();
    try {
        for (const name of [
            '../secret',
            '../../outside/secret',
            './../../outside/secret',
            'sub/../../secret',
            '..\\..\\outside\\secret'
        ]) {
            const found = RRAssetFiles.find(root, name, ['.png']);
            assert.equal(found, null, `"${name}" must not resolve`);
        }
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('an absolute path is not honoured either', () => {
    const { base, root } = sandbox();
    try {
        const outside = path.join(base, 'outside', 'secret');
        assert.equal(RRAssetFiles.find(root, outside, ['.png']), null);
        assert.equal(RRAssetFiles.find(root, `/${outside}`, ['.png']), null);
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('containment holds even without the segment check, and vice versa', () => {
    // Two independent guards: the `..` segment rejection and the resolved-path
    // containment test. Each is written so that removing the other still blocks
    // the escape — this pins that defence in depth rather than assuming it.
    assert.match(source, /normalized\.split\('\/'\)\.includes\('\.\.'\)/, 'the segment guard exists');
    assert.match(source, /!absolutePath\.startsWith\(`\$\{resolvedRoot\}\$\{path\.sep\}`\)/,
        'the containment guard exists');

    const { base, root } = sandbox();
    try {
        for (const removal of [
            [/if \(!normalized \|\| normalized\.split\('\/'\)\.includes\('\.\.'\)\) return null;/, 'if (!normalized) return null;'],
            [/if \(absolutePath !== resolvedRoot && !absolutePath\.startsWith\(`\$\{resolvedRoot\}\$\{path\.sep\}`\)\) continue;/, '']
        ]) {
            const weakened = source.replace(removal[0], removal[1]);
            assert.notEqual(weakened, source, 'the guard text was located');
            const module = { exports: {} };
            // eslint-disable-next-line no-new-func
            new Function('module', 'require', 'globalThis', weakened)(module, require, {});
            const api = module.exports;
            assert.equal(api.find(root, '../../outside/secret', ['.png']), null,
                'the remaining guard still contains the lookup');
        }
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('a legitimate nested name below the root still works', () => {
    const { base, root } = sandbox();
    try {
        fs.mkdirSync(path.join(root, 'npcs'), { recursive: true });
        fs.writeFileSync(path.join(root, 'npcs', 'Villager.png'), 'nested');
        const found = RRAssetFiles.find(root, 'npcs/Villager', ['.png']);
        assert.ok(found, 'a subdirectory name resolves');
        assert.equal(found.name, 'npcs/Villager');
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});

test('the listing never reports a file outside the root', () => {
    const { base, root } = sandbox();
    try {
        const listed = RRAssetFiles.list(path.join(base, 'project'), ['.png']);
        for (const record of listed) {
            assert.ok(record.absolutePath.startsWith(path.join(base, 'project') + path.sep),
                `${record.absolutePath} escaped the root`);
        }
        assert.ok(listed.some(record => record.name === 'img/characters/Actor1'));
    } finally {
        fs.rmSync(base, { recursive: true, force: true });
    }
});
