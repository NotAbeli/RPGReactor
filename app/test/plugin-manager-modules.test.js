const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PluginManager = require('../src/PluginManager.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-pm-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function makeManager() {
    const manager = new PluginManager(null);
    manager.fs = fs;
    manager.path = path;
    return manager;
}

test('pluginsFromEngineModules / engineModulesFromPlugins round-trip keeps order and toggles', () => {
    const config = {
        engineModules: [
            { name: 'SRD_GameUpgrade', parameters: { a: '1' }, orderBefore: [] },
            { name: 'WaitAsync', parameters: {}, orderBefore: ['SRD_GameUpgrade'] },
            { name: 'SDLight', parameters: { shadows: 'true' }, orderBefore: ['SRD_GameUpgrade', 'WaitAsync'] }
        ],
        disabledPlugins: [
            { name: 'SuperDuperAudio', parameters: { v: '50' } }
        ]
    };

    const list = PluginManager.pluginsFromEngineModules(config);
    assert.deepEqual(list.map(p => `${p.name}:${p.status ? 'on' : 'off'}`),
        ['SRD_GameUpgrade:on', 'WaitAsync:on', 'SDLight:on', 'SuperDuperAudio:off']);
    assert.strictEqual(list[2].parameters.shadows, 'true');

    // User reorders (WaitAsync after SDLight) and disables SDLight.
    const reordered = [list[0], list[2], list[1], list[3]];
    reordered[1].status = false;
    const state = PluginManager.engineModulesFromPlugins(reordered);
    assert.deepEqual(state.engineModules.map(m => m.name), ['SRD_GameUpgrade', 'WaitAsync']);
    // WaitAsync (2nd in the visible enabled list) anchors after the first.
    assert.deepEqual(state.engineModules[1].orderBefore, ['SRD_GameUpgrade']);
    assert.deepEqual(state.disabledPlugins.map(d => d.name), ['SDLight', 'SuperDuperAudio']);
    assert.strictEqual(state.disabledPlugins[0].parameters.shadows, 'true');

    // Round-trip: orderBefore recomputation must reproduce the visible order
    // through the runtime merge semantics (each module anchors after every
    // earlier enabled module -> dep-sort yields array order).
    const again = PluginManager.pluginsFromEngineModules(state);
    const enabledOrder = again.filter(p => p.status).map(p => p.name);
    assert.deepEqual(enabledOrder, ['SRD_GameUpgrade', 'WaitAsync']);
});

test('useEngineModulesMode: empty manifest + populated config -> true; non-empty manifest -> false', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        const manager = makeManager();

        // No manifest, config with modules -> modules mode.
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'WaitAsync', parameters: {}, orderBefore: [] }]
        }));
        assert.strictEqual(manager.useEngineModulesMode(dir), true);

        // Manifest present but empty (only separators) -> still modules mode.
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'),
            'var $plugins = [\n{"name":"--------------------------------------","status":false,"description":"","parameters":{}}\n];\n');
        assert.strictEqual(manager.useEngineModulesMode(dir), true);

        // Manifest with a real entry -> manifest wins (normal mode).
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'),
            'var $plugins = [{\n"name":"SRD_GameUpgrade","status":true,"description":"","parameters":{}\n}];\n');
        assert.strictEqual(manager.useEngineModulesMode(dir), false);

        // No config at all -> normal mode.
        fs.unlinkSync(path.join(dir, 'project.rpgreactor'));
        assert.strictEqual(manager.useEngineModulesMode(dir), false);
    } finally {
        cleanupTemp(dir);
    }
});

test('save/load through project.rpgreactor in modules mode (integration shape)', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            name: 't',
            enginePluginsDir: 'X:/catalog',
            engineModules: [
                { name: 'A', parameters: { k: 'v' }, orderBefore: [] },
                { name: 'B', parameters: {}, orderBefore: ['A'] }
            ],
            disabledPlugins: [{ name: 'C', parameters: {} }]
        }));
        const manager = makeManager();
        assert.strictEqual(manager.useEngineModulesMode(dir), true);

        // Simulate what loadPlugins builds in modules mode.
        const meta = manager.readProjectMeta(dir);
        manager.plugins = PluginManager.pluginsFromEngineModules(meta);
        assert.strictEqual(manager.plugins.length, 3);

        // Toggle B off; move the disabled C to the top of the list and enable it.
        manager.plugins[1].status = false;
        const c = manager.plugins.splice(2, 1)[0];
        c.status = true;
        c.parameters.z = '1';
        manager.plugins.unshift(c);
        const state = PluginManager.engineModulesFromPlugins(manager.plugins);
        let saved = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        saved.engineModules = state.engineModules;
        saved.disabledPlugins = state.disabledPlugins;
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify(saved, null, 2) + '\n', 'utf8');

        const after = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        assert.deepEqual(after.engineModules.map(m => m.name), ['C', 'A']);
        assert.deepEqual(after.engineModules[1].orderBefore, ['C']);
        assert.deepEqual(after.disabledPlugins.map(d => d.name), ['B']);
        assert.strictEqual(after.enginePluginsDir, 'X:/catalog', 'unrelated keys preserved');
    } finally {
        cleanupTemp(dir);
    }
});
