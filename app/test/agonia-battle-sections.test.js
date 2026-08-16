const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('vm');

const PluginCommandMigration = require('../src/PluginCommandMigration.js');
const ProjectManager = require('../src/ProjectManager.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-s10-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

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

function pluginParseCollection(raw) {
    let arr = [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
    } catch (e) { /* empty */ }
    return arr.map(item => {
        try { return JSON.parse(item); } catch (e) { return {}; }
    });
}

const MELEE = JSON.stringify({
    ID: '1', PID: 1, Name: 'Кувалда', Source: 0, Target: 0,
    Shape: 'arc', Range: '2.5', Width: '140', Duration: '12',
    Regions: '', Terrains: '', AnimID: '0',
    ActionsEvent: '0', ActionsPlayer: '0', ActionsShooter: '0'
});
const DASH = JSON.stringify({
    Name: 'УдарЛома', TargetMode: '1', MaxCharges: '1',
    SpeedMultiplier: '2.40', Duration: '7', Decay: '3.0', Cooldown: '0', SE: 'Wind7'
});
const ENEMY = JSON.stringify({
    id: '2', match: '<box>', hp: '50', scope: '0',
    attackRadius: '6', calmRadius: '9', calmTime: '240',
    hearingRadius: '8', hearingThreshold: '70',
    panicContactTime: '120', panicTotalTime: '600', customRules: '[]'
});

test('battle/enemies/dash defaults: all keys, MV-string collections', () => {
    const { DatabaseManager } = makeDbManager();
    const d = DatabaseManager.agoniaDefaults();
    for (const [sec, keys] of [
        ['battle', ['Debug Mode', 'Disable Mouse Move', 'Melee List', 'Projectile List', 'Tracer List']],
        ['enemies', ['Optimization', 'TickRate', 'VariableBaseId', 'HearingVariable', 'NoCombatSwitch', 'CombatCountVariable', 'GlobalResetSwitch', 'EnemyDatabase']],
        ['dash', ['Dash Active Switch', 'Collision Steps', 'Post-Dash Stun', 'Lock Direction', 'Dash Tracking Switch ID', 'Dash Tracking Variable ID', 'Dash Database']]
    ]) {
        assert.deepStrictEqual(
            Object.keys(d[sec]).sort(), keys.slice().sort(),
            sec + ' covers all keys'
        );
        const blob = keys.find(k => /List|Database/.test(k));
        if (blob) {
            assert.strictEqual(typeof d[sec][blob], 'string', sec + '.' + blob + ' is an MV string');
            assert.deepStrictEqual(JSON.parse(d[sec][blob]), []);
        }
    }
});

test('seed pulls battle/enemies/dash tuning from retired snapshots', () => {
    const { manager } = makeDbManager();
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [],
            retiredPlugins: [
                { name: 'SuperDuperBattle', parameters: {
                    'Debug Mode': 'false',
                    'Melee List': JSON.stringify([MELEE]),
                    'Projectile List': '[]', 'Tracer List': '[]'
                }, orderBefore: [] },
                { name: 'SuperDuperEnemies', parameters: {
                    'TickRate': '4', 'VariableBaseId': '60',
                    'EnemyDatabase': JSON.stringify([ENEMY])
                }, orderBefore: [] },
                { name: 'SuperDuperMovement_Addon', parameters: {
                    'Dash Active Switch': '7',
                    'Dash Database': JSON.stringify([DASH])
                }, orderBefore: [] }
            ]
        }));
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');

        const seeded = manager.agoniaSeedValues(dir);
        // Battle
        const melee = pluginParseCollection(seeded.battle['Melee List']);
        assert.strictEqual(melee.length, 1);
        assert.strictEqual(melee[0].Name, 'Кувалда');
        assert.strictEqual(melee[0].Range, '2.5');
        // Enemies
        assert.strictEqual(seeded.enemies.TickRate, 4);
        const enemies = pluginParseCollection(seeded.enemies['EnemyDatabase']);
        assert.strictEqual(enemies.length, 1);
        assert.strictEqual(enemies[0].match, '<box>');
        // Dash
        assert.strictEqual(seeded.dash['Dash Active Switch'], 7);
        const dash = pluginParseCollection(seeded.dash['Dash Database']);
        assert.strictEqual(dash.length, 1);
        assert.strictEqual(dash[0].Name, 'УдарЛома');
        assert.strictEqual(dash[0].SpeedMultiplier, '2.40');
    } finally {
        cleanupTemp(dir);
    }
});

test('MV bridge merges battle/enemies/dash sections into module params', () => {
    const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            battle: { 'Debug Mode': false, 'Melee List': JSON.stringify([MELEE]), 'Projectile List': '[]', 'Tracer List': '[]' },
            enemies: { 'TickRate': 6, 'EnemyDatabase': JSON.stringify([ENEMY]) },
            dash: { 'Dash Database': JSON.stringify([DASH]) }
        }));
        const scriptTags = [];
        const sandbox = {
            console, $plugins: [], window: null,
            Game_Interpreter: function () { }, Spriteset_Map: function () { },
            Sprite: function () { }, Bitmap: function () { },
            Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
            TouchInput: { isTriggered: () => false }, Window_TitleCommand: function () { },
            ImageManager: { loadSystem: () => ({ isReady: () => false }) },
            Graphics: { width: 816, height: 624 }, $gameTemp: {},
            navigator: { getGamepads: () => [] },
            document: {
                createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
                body: { appendChild: tag => scriptTags.push(tag) },
            },
            process: { env: {}, cwd: () => dir },
            require: n => (n === 'fs' ? fs : n === 'path' ? path : null),
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
            {name:'SuperDuperBattle',status:true,parameters:{}},
            {name:'SuperDuperEnemies',status:true,parameters:{}},
            {name:'SuperDuperMovement_Addon',status:true,parameters:{}}
        ]; PluginManager.setup($plugins);`, sandbox);

        const PM = sandbox.PluginManager;
        // Transitional (plugin alive): applyAgoniaConfig injects DB values.
        const battle = PM.parameters('SuperDuperBattle');
        assert.strictEqual(battle['Debug Mode'], 'false');
        const melee = pluginParseCollection(battle['Melee List']);
        assert.strictEqual(melee[0].Name, 'Кувалда');
        assert.strictEqual(PM.parameters('SuperDuperEnemies')['TickRate'], '6');
        const dash = pluginParseCollection(PM.parameters('SuperDuperMovement_Addon')['Dash Database']);
        assert.strictEqual(dash[0].Name, 'УдарЛома');
    } finally {
        cleanupTemp(dir);
    }
});

test('battle editor codec round-trips collections', () => {
    const Battle = require('../src/database/DatabaseBattleEditor.js');
    const Enemies = require('../src/database/DatabaseEnemiesEditor.js');
    const entries = Battle.decodeCollection(JSON.stringify([MELEE]));
    assert.strictEqual(entries[0].Name, 'Кувалда');
    const re = Battle.encodeCollection(entries);
    assert.strictEqual(re, JSON.stringify([MELEE]));
    // Plugin parser accepts the encoded form.
    assert.strictEqual(pluginParseCollection(re)[0].Shape, 'arc');
    // Enemies codec
    const ee = Enemies.decodeCollection(JSON.stringify([ENEMY]));
    assert.strictEqual(ee[0].match, '<box>');
    assert.strictEqual(Enemies.encodeCollection(ee), JSON.stringify([ENEMY]));
    // Nested customRules is a single JSON array of objects (the plugin
    // JSON.parses it directly - unlike the top-level collection strings).
    const withRules = JSON.stringify([JSON.stringify({ id: 1, match: '<a>', customRules: JSON.stringify([Enemies.blankRule()]) })]);
    const parsed = Enemies.decodeCollection(withRules)[0];
    assert.strictEqual(typeof parsed.customRules, 'string');
    const rule = JSON.parse(parsed.customRules)[0];
    assert.strictEqual(rule.flag, 'combat');
});

test('reseed preserves authored battle/enemies/dash payloads from the sidecar', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            battle: { 'Melee List': JSON.stringify([MELEE]) },
            enemies: { 'EnemyDatabase': JSON.stringify([ENEMY]) },
            dash: { 'Dash Database': JSON.stringify([DASH]) }
        }));
        const report = PluginCommandMigration.reseedAgoniaConfig({ fs, path, projectPath: dir });
        assert.strictEqual(report.ok, true, report.error);
        const out = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), 'utf8'));
        assert.strictEqual(out.battle['Melee List'], JSON.stringify([MELEE]), 'melee payload survives');
        assert.strictEqual(out.enemies['EnemyDatabase'], JSON.stringify([ENEMY]), 'enemy payload survives');
        assert.strictEqual(out.dash['Dash Database'], JSON.stringify([DASH]), 'dash payload survives');
    } finally {
        cleanupTemp(dir);
    }
});
