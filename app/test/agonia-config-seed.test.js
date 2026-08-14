const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_managers.js');
const PluginCommandMigration = require('../src/PluginCommandMigration.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-seed-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

/** Load a DatabaseManager-shaped sandbox (agonia methods only). */
function makeDbManager() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'DatabaseManager.js'), 'utf8');
    const start = source.indexOf('static get AGONIA_FILENAME');
    const end = source.indexOf('captureSavedState(dataKey = null)');
    assert.ok(start > 0 && end > start, 'agonia block not found');
    const chunk = source.slice(start, end);
    const context = { console };
    vm.createContext(context);
    vm.runInContext(`(function(){ class DatabaseManager {\n${chunk}\n} this.DatabaseManager = DatabaseManager; })()`, context);
    const manager = Object.create(context.DatabaseManager.prototype);
    manager.fs = fs;
    manager.path = path;
    return { manager, DatabaseManager: context.DatabaseManager };
}

test('agoniaSeedValues prefers engineModules parameters over the manifest', () => {
    const { manager } = makeDbManager();
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        // Tuned module parameters (post-migration reality).
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{
                name: 'SuperDuperMovement',
                parameters: {
                    'Max Stamina': '120',
                    'Dash Speed Level': '5.40',
                    'Drain Per Frame': '0.27',
                    'Recover Per Frame': '0.25',
                    'Dash Blocking Switches': '["18"]',
                    'Stamina Display Variable ID': '15',
                    'Max Stamina Variable ID': '34',
                    'Regen Variable ID': '35',
                    'Dash Control Switch ID': '38'
                },
                orderBefore: []
            }, {
                name: 'SDLight',
                parameters: {
                    'Player radius': '210',
                    'Use Real Shadows': 'true',
                    'MapSwitch Base': '500'
                },
                orderBefore: []
            }]
        }));
        // Manifest without the plugins (also post-migration reality).
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');

        const seeded = manager.agoniaSeedValues(dir);
        assert.strictEqual(seeded.stamina['Max Stamina'], 120);
        assert.strictEqual(seeded.stamina['Dash Speed Level'], 5.4);
        assert.strictEqual(seeded.stamina['Drain Per Frame'], 0.27);
        assert.deepEqual(seeded.stamina['Dash Blocking Switches'], [18]);
        assert.strictEqual(seeded.stamina['Stamina Display Variable ID'], 15);
        assert.strictEqual(seeded.stamina['Max Stamina Variable ID'], 34);
        assert.strictEqual(seeded.lighting['Player radius'], 210);
        assert.strictEqual(seeded.lighting['Use Real Shadows'], true);
        assert.strictEqual(seeded.lighting['MapSwitch Base'], 500);
    } finally {
        cleanupTemp(dir);
    }
});

test('agoniaSeedValues falls back to the manifest for pre-migration projects', () => {
    const { manager } = makeDbManager();
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'),
            'var $plugins = [' +
            JSON.stringify({ name: 'SuperDuperMovement', status: true, parameters: { 'Max Stamina': '90' } }) +
            '];\n');
        const seeded = manager.agoniaSeedValues(dir);
        assert.strictEqual(seeded.stamina['Max Stamina'], 90);
    } finally {
        cleanupTemp(dir);
    }
});

test('reseedAgoniaConfig rewrites the sidecar from engineModules and backs up', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            stamina: { 'Max Stamina': 1, 'Drain Per Frame': 9 }
        }));
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'SuperDuperMovement', parameters: { 'Max Stamina': '120', 'Drain Per Frame': '0.27' }, orderBefore: [] }]
        }));
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');

        const report = PluginCommandMigration.reseedAgoniaConfig({ fs, path, projectPath: dir });
        assert.strictEqual(report.ok, true, report.error);
        assert.strictEqual(report.seeded.stamina, 'engineModules');
        assert.ok(fs.existsSync(report.backup), 'old sidecar backed up');
        const seeded = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), 'utf8'));
        assert.strictEqual(seeded.stamina['Max Stamina'], 120);
        assert.strictEqual(seeded.stamina['Drain Per Frame'], 0.27);
    } finally {
        cleanupTemp(dir);
    }
});

function loadPluginManagerChunk() {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf('function PluginManager()');
    const end = source.indexOf('PluginManager.registerCommand');
    return source.slice(start, end);
}

function makePluginManager(cwd) {
    const loaded = [];
    const context = {
        console,
        document: {
            createElement: () => ({ type: '', src: '', async: false, defer: false, onerror: null, _url: '' }),
            body: { appendChild: s => loaded.push(s) },
        },
        Utils: { encodeURI: v => encodeURI(v), extractFileName: n => n },
        process: { env: {}, cwd: () => cwd },
        require: name => (name === 'fs' ? fs : name === 'path' ? path : null),
    };
    vm.createContext(context);
    vm.runInContext(loadPluginManagerChunk(), context);
    context.__loaded = loaded;
    return context;
}

test('mergeEngineModules preserves original load order against the pre-migration manifest', () => {
    // The full 49-plugin manifest order from the live project before any
    // migration (git checkpoint 36ed1ac parent shape), with the 13 migrated
    // families present, restored from the actual pre-migration state.
    const preMigrationOrder = [
        'SRD_GameUpgrade', 'SuperDuperCore', 'SRD_SuperToolsEngine', 'SRD_HUDMaker',
        'SRD_OptionsUpgrade', 'SRD_OptionsCreator', 'SimplePreloader', 'SuperDuperSpriter',
        'SuperDuperVariables', 'SuperDuperItemTags', 'SuperDuper_Keyboard', 'WaitAsync',
        'YEP_SaveEventLocations', 'AltimitMovementDebug', 'SuperDuperMovement',
        'SuperDuperMovement_Addon', 'SuperDuperScreen', 'SuperDuperSplash', 'SuperDuperCamera',
        'YuryolStealth', 'SuperDuperBattle', 'MOG_TreasurePopup', 'MOG_TitlePictureCom',
        'SuperDuperSave', 'SuperDuperSettings', 'SuperDuperInventory', 'SuperDuperDrop',
        'SuperDuperGifts', 'SimpleCraftSystem', 'SuperDuperLoot', 'SDLight',
        'SuperDuperMessage', 'SuperDuperChoices', 'SimpleCustomHints', 'N_HideIdleMouse',
        'SuperDuperSteps', 'PlayerSpeedMonitor', 'OcRam_Audio_EX', 'EventOpacityNote',
        'SingleEventTrigger', 'SuperDuperSamsara', 'SuperDuperNotification',
        'SuperDuperGameOver', 'SuperDuperEnemies', 'SuperDuperDamageFlash',
        'SRD_LightEditor', 'SuperDuperNpcPaths', 'DoorZLayer', 'ProfilingOverlay'
    ];
    // Post-migration manifest: everything except the 13 relocated families,
    // original relative order kept.
    const relocated = ['SuperDuperInventory', 'SuperDuperMovement', 'SuperDuperMovement_Addon',
        'WaitAsync', 'SuperDuperDamageFlash', 'SuperDuperSamsara', 'SimpleCraftSystem',
        'SimpleCustomHints', 'SuperDuperMessage', 'SDLight', 'SuperDuperLoot',
        'SuperDuperCamera', 'SuperDuperEnemies'];
    const currentManifest = preMigrationOrder
        .filter(name => !relocated.includes(name))
        .map(name => ({ name, status: true, parameters: {} }));
    // engineModules carry orderBefore = everyone that preceded them.
    const modules = relocated.map(name => {
        const idx = preMigrationOrder.indexOf(name);
        return { name, parameters: {}, orderBefore: preMigrationOrder.slice(0, idx) };
    });

    const dir = tempDir();
    try {
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: modules }));
        const ctx = makePluginManager(dir);
        const merged = ctx.PluginManager.mergeEngineModules(currentManifest);
        const mergedNames = merged.map(p => p.name);

        // The merged list must be a permutation of the original 49...
        assert.strictEqual(mergedNames.length, preMigrationOrder.length);
        assert.deepEqual([...mergedNames].sort(), [...preMigrationOrder].sort());
        // ...and preserve the original relative order exactly.
        const positions = preMigrationOrder.map(name => mergedNames.indexOf(name));
        for (let i = 1; i < positions.length; i++) {
            assert.ok(positions[i] > positions[i - 1],
                `${preMigrationOrder[i]} must load after ${preMigrationOrder[i - 1]}`);
        }
    } finally {
        cleanupTemp(dir);
    }
});

test('mergeEngineModules ignores separators and disabled plugins as anchors (live-data shape)', () => {
    // Regression: the live project's orderBefore lists contain separator
    // rows ("------", status off) and disabled plugins. Anchoring on the
    // LAST such entry (they repeat to the end of the manifest) pushed every
    // module to the tail of the merged list, inverting plugin alias order
    // (camera loaded before movement; zoom/cursor broke in playtest).
    const SEP = '--------------------------------------';
    const originalOrder = [
        'SRD_GameUpgrade', 'SuperDuperCore', 'WaitAsync', SEP,
        'YEP_SaveEventLocations', SEP, 'SuperDuperMovement', SEP,
        'SuperDuperScreen', 'SuperDuperCamera', 'SuperDuperLight',
        'SuperDuperInventory', SEP, 'N_HideIdleMouse', SEP,
        'SuperDuperEnemies', 'SRD_LightEditor', 'ProfilingOverlay'
    ];
    const manifestShape = name => (name === SEP
        ? { name, status: false, parameters: {} }
        : { name, status: name !== 'SuperDuperLight', parameters: {} });
    // Live manifest: separators and the disabled SuperDuperLight kept.
    const manifest = originalOrder.filter(n => !['WaitAsync', 'SuperDuperMovement', 'SuperDuperCamera', 'SuperDuperInventory', 'SuperDuperEnemies'].includes(n)).map(manifestShape);
    // Modules carry the DIRTY orderBefore: full prefix including separators
    // and disabled plugins (exactly what buildEngineModuleEntry produced
    // before the fix).
    const dirty = name => ({ name, parameters: {}, orderBefore: originalOrder.slice(0, originalOrder.indexOf(name)) });
    const modules = ['WaitAsync', 'SuperDuperMovement', 'SuperDuperCamera', 'SuperDuperInventory', 'SuperDuperEnemies'].map(dirty);

    const dir = tempDir();
    try {
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: modules }));
        const ctx = makePluginManager(dir);
        const mergedNames = ctx.PluginManager.mergeEngineModules(manifest).map(p => p.name);

        // Merged LOAD order must equal the original load order (separators
        // and disabled plugins stay in the list but never load).
        const expected = originalOrder.filter(n => n !== SEP && n !== 'SuperDuperLight');
        const loaded = ctx.PluginManager.mergeEngineModules(manifest)
            .filter(p => p.status).map(p => p.name);
        assert.deepEqual(loaded, expected);
    } finally {
        cleanupTemp(dir);
    }
});

test('buildEngineModuleEntry records only loadable predecessors', () => {
    const SEP = '--------------------------------------';
    const plugins = [
        { name: 'A', status: true, parameters: {} },
        { name: SEP, status: false, parameters: {} },
        { name: 'B', status: false, parameters: {} },
        { name: 'C', status: true, parameters: { k: 'v' } }
    ];
    const entry = PluginCommandMigration.buildEngineModuleEntry(plugins, 'C');
    assert.deepEqual(entry.orderBefore, ['A'], 'separator and disabled entries skipped');
    assert.deepEqual(entry.parameters, { k: 'v' });
});

test('harvestAllPlugins moves everything into project config and empties the manifest', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        const plugins = [
            { name: 'A', status: true, description: '', parameters: { pa: '1' } },
            { name: '--------------------------------------', status: false, description: '', parameters: {} },
            { name: 'B', status: true, description: '', parameters: { pb: '2' } },
            { name: 'C', status: false, description: '', parameters: { pc: '3' } }
        ];
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = ' + JSON.stringify(plugins) + ';\n');
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'Existing', parameters: {}, orderBefore: [] }]
        }));

        const report = PluginCommandMigration.harvestAllPlugins({ fs, path, projectPath: dir });
        assert.strictEqual(report.ok, true, report.error);
        assert.deepEqual(report.moved.sort(), ['A', 'B']);
        assert.deepEqual(report.disabled, ['C']);

        const manifest = fs.readFileSync(path.join(dir, 'js', 'plugins.js'), 'utf8');
        assert.ok(!manifest.includes('"A"') && !manifest.includes('"C"'), 'manifest emptied');
        const meta = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        // Modules are re-sorted to the canonical original order; unknown
        // modules (Existing) keep relative order at the end.
        assert.strictEqual(meta.engineModules.length, 3);
        assert.deepEqual(meta.engineModules.map(m => m.name), ['A', 'B', 'Existing']);
        const a = meta.engineModules.find(m => m.name === 'A');
        assert.strictEqual(a.parameters.pa, '1');
        assert.deepEqual(a.orderBefore, [], 'nothing precedes A');
        const b = meta.engineModules.find(m => m.name === 'B');
        assert.deepEqual(b.orderBefore, ['A'], 'separator does not anchor');
        assert.deepEqual(meta.disabledPlugins, [{ name: 'C', parameters: { pc: '3' } }]);
        assert.ok(fs.existsSync(report.backupPath), 'backup folder created');

        // Idempotent: second run reports nothing to harvest.
        const again = PluginCommandMigration.harvestAllPlugins({ fs, path, projectPath: dir });
        assert.strictEqual(again.ok, false);
        assert.ok(String(again.error).includes('already empty'));
    } finally {
        cleanupTemp(dir);
    }
});

test('computeLoadOrder mirrors the runtime merge (separators ignored)', () => {
    const SEP = '--------------------------------------';
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'),
            'var $plugins = [' +
            '{"name":"First","status":true,"parameters":{}},' +
            JSON.stringify({ name: SEP, status: false, parameters: {} }) + ',' +
            '{"name":"Last","status":true,"parameters":{}}' +
            '];\n');
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [{ name: 'Middle', parameters: {}, orderBefore: ['First', SEP] }]
        }));
        const report = PluginCommandMigration.computeLoadOrder({ fs, path, projectPath: dir });
        assert.strictEqual(report.ok, true, report.error);
        assert.deepEqual(report.names, ['First', 'Middle', 'Last']);
    } finally {
        cleanupTemp(dir);
    }
});
