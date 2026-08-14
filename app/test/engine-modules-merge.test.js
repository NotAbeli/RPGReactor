const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_managers.js');

function loadPluginManagerChunk() {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf('function PluginManager()');
    const end = source.indexOf('PluginManager.registerCommand');
    assert.ok(start > 0, 'PluginManager block not found in runtime');
    assert.ok(end > start, 'PluginManager block end marker not found');
    return source.slice(start, end);
}

const CHUNK = loadPluginManagerChunk();

function makePluginManager({ env = {}, cwd }) {
    const loadedScripts = [];
    const context = {
        console,
        document: {
            createElement: () => ({ type: '', src: '', async: false, defer: false, onerror: null, _url: '' }),
            body: { appendChild: script => loadedScripts.push(script) },
        },
        Utils: {
            encodeURI: value => encodeURI(value),
            extractFileName: name => name,
        },
        process: { env, cwd: () => cwd },
        require: name => {
            if (name === 'fs') return fs;
            if (name === 'path') return path;
            throw new Error('module not mocked: ' + name);
        },
    };
    vm.createContext(context);
    vm.runInContext(CHUNK, context);
    context.__loadedScripts = loadedScripts;
    return context;
}

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-modules-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

test('mergeEngineModules returns the input untouched without project.rpgreactor', () => {
    const projectDir = tempDir();
    try {
        const ctx = makePluginManager({ cwd: projectDir });
        const plugins = [{ name: 'SRD_GameUpgrade', status: true, parameters: {} }];
        const merged = ctx.PluginManager.mergeEngineModules(plugins);
        assert.strictEqual(merged.length, 1);
        assert.strictEqual(merged[0].name, 'SRD_GameUpgrade');
    } finally {
        cleanupTemp(projectDir);
    }
});

test('mergeEngineModules injects engine module after its orderBefore predecessors', () => {
    const projectDir = tempDir();
    try {
        fs.writeFileSync(path.join(projectDir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{
                name: 'SuperDuperInventory',
                parameters: { 'Sound Volume': '80' },
                orderBefore: ['SRD_GameUpgrade', 'SuperDuperCore', 'SuperDuperSpriter']
            }]
        }));
        const ctx = makePluginManager({ cwd: projectDir });
        const plugins = [
            { name: 'SRD_GameUpgrade', status: true, parameters: {} },
            { name: 'SuperDuperCore', status: true, parameters: {} },
            { name: 'SimpleCraftSystem', status: true, parameters: {} },
        ];
        const merged = ctx.PluginManager.mergeEngineModules(plugins);
        assert.strictEqual(merged.length, 4);
        const names = merged.map(p => p.name);
        // Injection lands right after the last present predecessor
        // (SuperDuperCore), keeping relative order to later plugins.
        assert.deepStrictEqual(names, [
            'SRD_GameUpgrade', 'SuperDuperCore', 'SuperDuperInventory', 'SimpleCraftSystem'
        ]);
        const injected = merged[2];
        assert.strictEqual(injected.status, true);
        assert.strictEqual(injected.parameters['Sound Volume'], '80');
    } finally {
        cleanupTemp(projectDir);
    }
});

test('mergeEngineModules injects at the front when no predecessor is present', () => {
    const projectDir = tempDir();
    try {
        fs.writeFileSync(path.join(projectDir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'SuperDuperInventory', parameters: {}, orderBefore: ['Whatever'] }]
        }));
        const ctx = makePluginManager({ cwd: projectDir });
        const merged = ctx.PluginManager.mergeEngineModules([{ name: 'OtherPlugin', status: true, parameters: {} }]);
        assert.strictEqual(merged[0].name, 'SuperDuperInventory');
    } finally {
        cleanupTemp(projectDir);
    }
});

test('mergeEngineModules skips names already present in the manifest', () => {
    const projectDir = tempDir();
    try {
        fs.writeFileSync(path.join(projectDir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'SuperDuperInventory', parameters: { x: '1' }, orderBefore: [] }]
        }));
        const ctx = makePluginManager({ cwd: projectDir });
        const plugins = [{ name: 'SuperDuperInventory', status: true, parameters: { x: '2' } }];
        const merged = ctx.PluginManager.mergeEngineModules(plugins);
        assert.strictEqual(merged.length, 1);
        assert.strictEqual(merged[0].parameters.x, '2', 'manifest entry wins, no duplicates');
    } finally {
        cleanupTemp(projectDir);
    }
});

test('setup loads engine module scripts with parameters', () => {
    const projectDir = tempDir();
    try {
        fs.writeFileSync(path.join(projectDir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'SuperDuperInventory', parameters: { Volume: '90' }, orderBefore: [] }]
        }));
        const ctx = makePluginManager({ cwd: projectDir });
        ctx.PluginManager.setup([{ name: 'OtherPlugin', status: true, parameters: {} }]);
        const srcs = ctx.__loadedScripts.map(s => s.src);
        assert.ok(srcs.some(src => String(src).includes('SuperDuperInventory')), 'engine module script is loaded');
        assert.deepEqual(ctx.PluginManager.parameters('SuperDuperInventory'), { Volume: '90' });
    } finally {
        cleanupTemp(projectDir);
    }
});

test('applyAgoniaEngineConfig overrides plugin parameters from the sidecar', () => {
    const projectDir = tempDir();
    try {
        fs.mkdirSync(path.join(projectDir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            stamina: {
                'Max Stamina': 150,
                'Drain Per Frame': 0.75,
                'Dash Blocking Switches': [21, 34]
            }
        }));
        const ctx = makePluginManager({ cwd: projectDir });
        const plugins = [
            { name: 'SuperDuperMovement', status: true, parameters: { 'Max Stamina': '100' } },
            { name: 'OtherPlugin', status: true, parameters: { Key: 'Value' } }
        ];
        ctx.PluginManager.setup(plugins);
        const movement = ctx.PluginManager.parameters('SuperDuperMovement');
        assert.strictEqual(movement['Max Stamina'], '150', 'sidecar number overrides manifest');
        assert.strictEqual(movement['Drain Per Frame'], '0.75', 'sidecar adds new tuning');
        assert.strictEqual(movement['Dash Blocking Switches'], '[21,34]', 'arrays are stringified');
        const other = ctx.PluginManager.parameters('OtherPlugin');
        assert.strictEqual(other.Key, 'Value', 'unrelated plugins untouched');
    } finally {
        cleanupTemp(projectDir);
    }
});

test('applyAgoniaEngineConfig is a no-op without the sidecar', () => {
    const projectDir = tempDir();
    try {
        const ctx = makePluginManager({ cwd: projectDir });
        const plugins = [
            { name: 'SuperDuperMovement', status: true, parameters: { 'Max Stamina': '120' } }
        ];
        ctx.PluginManager.setup(plugins);
        assert.strictEqual(ctx.PluginManager.parameters('SuperDuperMovement')['Max Stamina'], '120');
    } finally {
        cleanupTemp(projectDir);
    }
});
