const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ProjectManager = require('../src/ProjectManager.js');
const PluginCommandMigration = require('../src/PluginCommandMigration.js');
const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-f4-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

// The canonical invariant of the screen system, frozen: whatever the plugin
// loadout, the DB screen section wins every legacy copy, and when the
// plugins are absent the system fields take the same values over.
function makeSandbox(dir, plugins, retired) {
    function PixiFilter() { this.uniforms = {}; }
    PixiFilter.prototype.apply = function () { };
    function Scene_Base() { this.initialize.apply(this, arguments); }
    Scene_Base.prototype = { filters: null, initialize() { }, start() { }, update() { } };
    function Game_System() { this.initialize.apply(this, arguments); }
    Game_System.prototype = { initialize() { } };
    function FakeDecrypter() { }
    FakeDecrypter._ignoreList = [];
    function FakeResourceHandler() { }
    FakeResourceHandler._defaultRetryInterval = null;
    const sandbox = {
        console, $plugins: [], window: null, _rrListeners: {},
        addEventListener(t, f) { (this._rrListeners[t] = this._rrListeners[t] || []).push(f); },
        SceneManager: { _screenWidth: 816, _screenHeight: 624, _boxWidth: 816, _boxHeight: 624, _scene: null },
        Scene_Base, Game_System,
        Game_Interpreter: function () { }, Sprite: function () { }, Bitmap: function () { }, Spriteset_Map: function () { },
        Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
        TouchInput: { isTriggered: () => false }, Window_TitleCommand: function () { },
        ImageManager: { loadSystem: () => ({ isReady: () => false }) },
        Graphics: { width: 816, height: 624, boxWidth: 816, boxHeight: 624 },
        Rectangle: function (x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; },
        $gameTemp: {}, navigator: { getGamepads: () => [] },
        PIXI: { Filter: PixiFilter, settings: {}, SCALE_MODES: { LINEAR: 'linear', NEAREST: 'nearest' }, GC_MODES: { AUTO: 1, MANUAL: 2 }, WRAP_MODES: { CLAMP: 1, REPEAT: 2, MIRRORED_REPEAT: 3 } },
        ImageCache: function () { }, JsonEx: { maxDepth: 100 },
        Decrypter: FakeDecrypter, ResourceHandler: FakeResourceHandler,
        Scene_Boot: function () { },
        Utils: { isOptionValid: () => false, isNwjs: () => false, RPGMAKER_VERSION: '1.6.3' },
        document: { createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }), body: { appendChild() { }, style: {} } },
        process: { env: {}, cwd: () => dir },
        require: n => (n === 'fs' ? fs : n === 'path' ? path : null),
    };
    sandbox.Scene_Boot.prototype = { start() { } };
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
    vm.runInContext(`$plugins = ${JSON.stringify(plugins)}; PluginManager.setup($plugins);`, sandbox);
    return sandbox;
}

const DB_SCREEN = { 'Screen Width': 1600, 'Screen Height': 900, 'Fullscreen': true, 'Window Title': 'Frozen' };

function writeProject(dir, retired) {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: retired || [] }));
    fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({ screen: DB_SCREEN }));
}

const LEGACY_COPIES = [
    { name: 'SRD_GameUpgrade', status: true, parameters: {
        'Game Resolution': '{"Width":"816","Height":"624"}',
        'Screen Resolution': '{"Width":"816","Height":"624"}',
        'Initial Fullscreen': 'false', 'Window Title': ''
    } },
    { name: 'SuperDuperCore', status: true, parameters: {
        'Разрешение экрана (Ширина)': '816', 'Разрешение экрана (Высота)': '624'
    } },
    { name: 'SuperDuperScreen', status: true, parameters: {
        'Screen Width': '816', 'Screen Height': '824'
    } }
];

test('FROZEN single-writer invariant: plugins loaded -> every legacy copy reads the DB', () => {
    const dir = tempDir();
    try {
        writeProject(dir, []);
        const sb = makeSandbox(dir, LEGACY_COPIES, []);
        const PM = sb.PluginManager;
        const resJson = JSON.stringify({ Width: '1600', Height: '900' });
        assert.strictEqual(PM.parameters('SRD_GameUpgrade')['Game Resolution'], resJson);
        assert.strictEqual(PM.parameters('SRD_GameUpgrade')['Screen Resolution'], resJson);
        assert.strictEqual(PM.parameters('SRD_GameUpgrade')['Initial Fullscreen'], 'true');
        assert.strictEqual(PM.parameters('SRD_GameUpgrade')['Window Title'], 'Frozen');
        assert.strictEqual(PM.parameters('SuperDuperCore')['Разрешение экрана (Ширина)'], '1600');
        assert.strictEqual(PM.parameters('SuperDuperCore')['Разрешение экрана (Высота)'], '900');
        assert.strictEqual(PM.parameters('SuperDuperScreen')['Screen Width'], '1600');
        assert.strictEqual(PM.parameters('SuperDuperScreen')['Screen Height'], '900');
        // System parts stay OFF in transitional mode (plugins own them).
        assert.strictEqual(sb.__rrSrdHub, undefined);
        assert.strictEqual(sb.SceneManager._screenWidth, 816, 'plugins own SceneManager while loaded');
    } finally {
        cleanupTemp(dir);
    }
});

test('FROZEN single-writer invariant: plugins retired -> system takes the same DB values over', () => {
    const dir = tempDir();
    try {
        const retired = ['SRD_GameUpgrade', 'SuperDuperCore', 'SuperDuperScreen'].map(name => ({
            name, reason: 'S1',
            parameters: {
                'Game Resolution': '{"Width":"816","Height":"624"}',
                'Initial Fullscreen': 'true',
                'Image Cache Limit': '30',
                'JsonEx Max Depth': '100'
            },
            orderBefore: []
        }));
        writeProject(dir, retired);
        const sb = makeSandbox(dir, [], retired);

        // Resolution now flows through the system (SceneManager fields).
        assert.strictEqual(sb.SceneManager._screenWidth, 1600);
        assert.strictEqual(sb.SceneManager._screenHeight, 900);
        assert.strictEqual(sb.SceneManager._boxWidth, 1600);
        assert.strictEqual(sb.SceneManager._boxHeight, 900);

        // Hub shim + Core shim + system CRT all live.
        assert.strictEqual(sb.window.__rrSrdHub, true);
        assert.strictEqual(sb.Imported['SumRndmDde Game Upgrade'], 1.35);
        assert.ok(sb.GameWindowManager && typeof sb.GameWindowManager.closeGame === 'function');
        assert.ok(sb.window.SuperDuper.Core);
        assert.strictEqual(sb.window.SuperDuper.Core.screen.width, 1600);
        assert.ok(sb.__RRMVBridge.screen.crt, 'system CRT installed');
        assert.strictEqual(sb.__RRMVBridge.screen.crt.active, true);
        // Tuning ports took the retired snapshot values.
        assert.strictEqual(sb.ImageCache.limit, 30 * 1000 * 1000);
        assert.strictEqual(sb.JsonEx.maxDepth, 100);
    } finally {
        cleanupTemp(dir);
    }
});

test('FROZEN: no DB screen values -> nothing writes anything', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({ screen: {} }));
        const sb = makeSandbox(dir, LEGACY_COPIES, []);
        const PM = sb.PluginManager;
        assert.strictEqual(PM.parameters('SRD_GameUpgrade')['Game Resolution'], '{"Width":"816","Height":"624"}');
        assert.strictEqual(sb.SceneManager._screenWidth, 816);
    } finally {
        cleanupTemp(dir);
    }
});

test('FROZEN: retire/restore round-trips the screen trio at canonical positions', () => {
    const dir = tempDir();
    try {
        const CANON = ['SRD_GameUpgrade', 'SuperDuperCore', 'A', 'SuperDuperScreen', 'Z'];
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: CANON.map((name, i) => ({
                name, parameters: { tuning: name + '-tuning' }, orderBefore: CANON.slice(0, i)
            }))
        }));
        const ret = PluginCommandMigration.retirePlugins({
            fs, path, projectPath: dir,
            names: ['SRD_GameUpgrade', 'SuperDuperCore', 'SuperDuperScreen']
        });
        assert.strictEqual(ret.ok, true, ret.error);
        let meta = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        assert.strictEqual(meta.retiredPlugins.find(r => r.name === 'SRD_GameUpgrade').parameters.tuning, 'SRD_GameUpgrade-tuning');

        const res = PluginCommandMigration.restoreRetired({
            fs, path, projectPath: dir,
            names: ['SuperDuperScreen', 'SRD_GameUpgrade', 'SuperDuperCore']
        });
        assert.strictEqual(res.ok, true, res.error);
        meta = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        assert.deepEqual(meta.engineModules.map(m => m.name), CANON, 'canonical order restored');
        assert.strictEqual(meta.engineModules[0].parameters.tuning, 'SRD_GameUpgrade-tuning', 'tuning intact');
        assert.strictEqual(meta.retiredPlugins.length, 0);
    } finally {
        cleanupTemp(dir);
    }
});
