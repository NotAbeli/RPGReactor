const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const PluginCommandMigration = require('../src/PluginCommandMigration.js');
const ProjectManager = require('../src/ProjectManager.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-dbsections-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

/** vm-load the DatabaseManager agonia block (browser-global class). */
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

function getReseedDefaults() {
    // Extract the defaults object the reseed builds, by running reseed on a
    // project with an EMPTY module config: every section then falls back to
    // the hardcoded defaults (the thing we want to compare).
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');
        const report = PluginCommandMigration.reseedAgoniaConfig({ fs, path, projectPath: dir });
        assert.strictEqual(report.ok, true, report.error);
        return JSON.parse(fs.readFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), 'utf8'));
    } finally {
        cleanupTemp(dir);
    }
}

test('agonia defaults cover twenty-six sections in both DatabaseManager and reseed (no drift)', () => {
    const { DatabaseManager } = makeDbManager();
    const defaults = DatabaseManager.agoniaDefaults();
    const sections = Object.keys(defaults).sort();
    assert.deepEqual(sections, ['audio', 'battle', 'camera', 'craft', 'dash', 'drop', 'enemies', 'gifts', 'hints', 'inventory', 'lighting', 'loot', 'message', 'notification', 'popup', 'save', 'screen', 'settings', 'spriter', 'splash', 'steps', 'stamina', 'title', 'gameover', 'choices', 'variables'].sort());

    const reseed = getReseedDefaults();
    assert.deepEqual(Object.keys(reseed).sort(), sections, 'reseed sections match');
    for (const section of sections) {
        const a = defaults[section];
        const b = reseed[section];
        assert.deepEqual(
            Object.keys(a).sort(), Object.keys(b).sort(),
            `section ${section}: same keys in DatabaseManager and reseed defaults`
        );
        for (const key of Object.keys(a)) {
            // loose deepEqual: values from the vm realm have foreign prototypes
            assert.deepEqual(a[key], b[key],
                `section ${section}.${key}: same default value in both copies`);
        }
    }
});

test('seed values pull camera/screen/inventory tuning from engineModules', () => {
    const { manager } = makeDbManager();
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [
                { name: 'SuperDuperCamera', parameters: {
                    'Зум по умолчанию': '2.00',
                    'Включить барьеры': 'true',
                    'Активные регионы': '15',
                    'Обычный курсор': 'cursor'
                }, orderBefore: [] },
                { name: 'SuperDuperScreen', parameters: {
                    'Enabled on Startup': 'true',
                    'Scanline Intensity': '0.40'
                }, orderBefore: [] },
                { name: 'SuperDuperInventory', parameters: {
                    'RMB Variable ID': '17',
                    'Disable Standard Menu': 'true'
                }, orderBefore: [] }
            ]
        }));
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');
        const seeded = manager.agoniaSeedValues(dir);
        assert.strictEqual(seeded.camera['Зум по умолчанию'], 2);
        assert.strictEqual(seeded.camera['Включить барьеры'], true);
        assert.strictEqual(seeded.camera['Активные регионы'], 15);
        assert.strictEqual(seeded.camera['Обычный курсор'], 'cursor');
        assert.strictEqual(seeded.screen['Enabled on Startup'], true);
        assert.strictEqual(seeded.screen['Scanline Intensity'], 0.4);
        assert.strictEqual(seeded.inventory['RMB Variable ID'], 17);
        assert.strictEqual(seeded.inventory['Disable Standard Menu'], true);
        // Untouched keys fall back to defaults.
        assert.strictEqual(seeded.camera['Инерция'], 0.18);
    } finally {
        cleanupTemp(dir);
    }
});

test('editor SECTIONS render every defaults section with valid field types', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'database', 'DatabaseAgoniaEditor.js'), 'utf8');
    const context = { console };
    vm.createContext(context);
    vm.runInContext(source + '\nthis.DatabaseAgoniaEditor = DatabaseAgoniaEditor;', context);
    const Editor = context.DatabaseAgoniaEditor;

    const { DatabaseManager } = makeDbManager();
    const defaults = DatabaseManager.agoniaDefaults();
    const validTypes = new Set(['number', 'color', 'bool', 'switchId', 'variableId', 'idList', 'string']);

    // The spriter section is owned by the dedicated DatabaseSpriterEditor
    // tab, audio by the Audio Studio window, battle/dash by
    // DatabaseBattleEditor, enemies by DatabaseEnemiesEditor (S10) and
    // craft/hints/popup/loot/gifts by the S15 data editors - none of them
    // render through the flat Agonia editor.
    const flatSections = Object.keys(defaults)
        .filter(s => !['spriter', 'audio', 'battle', 'dash', 'enemies', 'craft', 'hints', 'popup', 'loot', 'gifts', 'steps', 'variables', 'drop', 'notification', 'save', 'title', 'splash', 'gameover', 'message', 'choices', 'settings'].includes(s));
    const editorSections = Editor.SECTIONS;
    assert.deepEqual(
        Object.keys(editorSections).sort(),
        flatSections.sort(),
        'editor covers every flat defaults section'
    );
    for (const [section, def] of Object.entries(editorSections)) {
        const editedKeys = new Set();
        for (const column of def.columns) {
            for (const field of column.fields) {
                assert.ok(validTypes.has(field.type), `${section}.${field.key}: known type ${field.type}`);
                editedKeys.add(field.key);
            }
        }
        for (const key of Object.keys(defaults[section])) {
            assert.ok(editedKeys.has(key),
                `${section}.${key} present in defaults but has no editor field`);
        }
    }
});

test('MV bridge applies all five sections over module parameters', () => {
    const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            camera: { 'Зум по умолчанию': 3, 'Обычный курсор': 'custom' },
            screen: { 'Enabled on Startup': false },
            inventory: { 'Default Max Slots': 9 },
            stamina: { 'Max Stamina': 150 },
            lighting: { 'Wall Softness': 20 }
        }));
        const scriptTags = [];
        const sandbox = {
            console, $plugins: [],
            window: null,
            Game_Interpreter: function () { },
            Spriteset_Map: function () { }, Sprite: function () { }, Bitmap: function () { },
            Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
            TouchInput: { isTriggered: () => false },
            Window_TitleCommand: function () { },
            ImageManager: { loadSystem: () => ({ isReady: () => false }) },
            Graphics: { width: 816, height: 624 },
            $gameTemp: {},
            navigator: { getGamepads: () => [] },
            document: {
                createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
                body: { appendChild: tag => scriptTags.push(tag) },
            },
            process: { env: {}, cwd: () => dir },
            require: name => {
                if (name === 'fs') return fs;
                if (name === 'path') return path;
                return null;
            },
        };
        sandbox.window = sandbox;
        sandbox.PluginManager = {
            _path: 'js/plugins/', _scripts: [], _parameters: {}, _errorUrls: [],
            onError() { }, setParameters(n, p) { this._parameters[n.toLowerCase()] = p; },
            parameters(n) { return this._parameters[n.toLowerCase()] || {}; },
            loadScript() { },
            setup(plugins) {
                plugins.forEach(function (p) {
                    if (p.status && !this._scripts.includes(p.name)) {
                        this.setParameters(p.name, p.parameters);
                        this._scripts.push(p.name);
                    }
                }, this);
            },
        };
        vm.createContext(sandbox);
        vm.runInContext(SNIPPET, sandbox);
        vm.runInContext(`$plugins = [
            {name:'SuperDuperCamera',status:true,parameters:{}},
            {name:'SuperDuperScreen',status:true,parameters:{}},
            {name:'SuperDuperInventory',status:true,parameters:{}},
            {name:'SuperDuperMovement',status:true,parameters:{}},
            {name:'SDLight',status:true,parameters:{}}
        ]; PluginManager.setup($plugins);`, sandbox);

        const PM = sandbox.PluginManager;
        assert.strictEqual(PM.parameters('SuperDuperCamera')['Зум по умолчанию'], '3');
        assert.strictEqual(PM.parameters('SuperDuperCamera')['Обычный курсор'], 'custom');
        // Untouched camera keys are not injected (only listed keys merge).
        assert.strictEqual(PM.parameters('SuperDuperCamera')['Инерция'], undefined);
        assert.strictEqual(PM.parameters('SuperDuperScreen')['Enabled on Startup'], 'false');
        assert.strictEqual(PM.parameters('SuperDuperInventory')['Default Max Slots'], '9');
        assert.strictEqual(PM.parameters('SuperDuperMovement')['Max Stamina'], '150');
        assert.strictEqual(PM.parameters('SDLight')['Wall Softness'], '20');
    } finally {
        cleanupTemp(dir);
    }
});

test('reactor runtime AGONIA_MODULE_SECTIONS covers the six sections', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'reactor_managers.js'), 'utf8');
    const start = source.indexOf('PluginManager.AGONIA_MODULE_SECTIONS');
    assert.ok(start > 0, 'section map not found');
    const end = source.indexOf('};', start);
    const block = source.slice(start, end + 2);
    for (const name of ['stamina', 'lighting', 'camera', 'inventory', 'screen', 'spriter']) {
        assert.ok(block.includes(`"${name}"`), `section ${name} mapped`);
    }
});
