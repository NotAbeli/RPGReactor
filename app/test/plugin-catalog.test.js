const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');
const CATALOG = path.join(PLUGINS_DIR, 'catalog.json');
const GENERATOR = path.join(__dirname, '..', 'build-scripts', 'generate-plugin-catalog.js');

function runGenerator() {
    const result = spawnSync(process.execPath, [GENERATOR], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /Catalog written: \d+ plugins/);
}

test('generator is deterministic: two runs produce identical bytes', () => {
    const before = fs.readFileSync(CATALOG, 'utf8');
    try {
        runGenerator();
        const first = fs.readFileSync(CATALOG, 'utf8');
        runGenerator();
        const second = fs.readFileSync(CATALOG, 'utf8');
        assert.strictEqual(first, second);
    } finally {
        fs.writeFileSync(CATALOG, before);
    }
});

test('regenerated catalog matches the committed one', () => {
    const before = fs.readFileSync(CATALOG, 'utf8');
    try {
        runGenerator();
        assert.strictEqual(fs.readFileSync(CATALOG, 'utf8'), before);
    } finally {
        fs.writeFileSync(CATALOG, before);
    }
});

test('catalog matches plugin sources on disk', () => {
    const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
    assert.strictEqual(catalog.engine, 'agonia');
    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js')).sort();
    assert.strictEqual(catalog.plugins.length, files.length);
    assert.deepStrictEqual(catalog.plugins.map(p => p.file), files);
    const names = catalog.plugins.map(p => p.name);
    assert.deepStrictEqual(names, [...names].sort());
    for (const entry of catalog.plugins) {
        assert.strictEqual(entry.name, entry.file.replace(/\.js$/, ''));
        assert.strictEqual(typeof entry.author, 'string');
        assert.strictEqual(typeof entry.description, 'string');
        assert.ok(fs.existsSync(path.join(PLUGINS_DIR, entry.file)));
    }
});
