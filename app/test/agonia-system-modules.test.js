const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('vm');

const ProjectManager = require('../src/ProjectManager.js');
const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-s2-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

/**
 * Sandbox capturing script tags + parameters instead of executing the real
 * 3252-line SDLight. loadScript builds a DOM script element through the
 * bridge's catalog loader; the capture records name/URL order.
 */
function makeSandbox(dir) {
    const scriptTags = [];
    function PixiFilter() { this.uniforms = {}; }
    PixiFilter.prototype.apply = function () { };
    function Scene_Base() { this.initialize.apply(this, arguments); }
    Scene_Base.prototype = { filters: null, initialize() { }, start() { }, update() { } };
    function Game_System() { this.initialize.apply(this, arguments); }
    Game_System.prototype = { initialize() { } };
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
        PIXI: { Filter: PixiFilter, settings: {}, SCALE_MODES: {}, GC_MODES: {}, WRAP_MODES: {} },
        Utils: { isOptionValid: () => false, isNwjs: () => false, RPGMAKER_VERSION: '1.6.3' },
        document: {
            createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
            body: { appendChild: tag => scriptTags.push(tag), style: {} },
        },
        process: { env: {}, cwd: () => dir },
        require: n => (n === 'fs' ? fs : n === 'path' ? path : null),
    };
    sandbox.window = sandbox;
    sandbox.PluginManager = {
        _path: 'js/plugins/', _scripts: [], _parameters: {}, _errorUrls: [],
        onError() { },
        setParameters(n, p) { this._parameters[n.toLowerCase()] = p; },
        parameters(n) { return this._parameters[n.toLowerCase()] || {}; },
        loadScript(name) { scriptTags.push({ src: 'js/plugins/' + name, _systemLoad: true }); },
        setup(plugins) {
            plugins.forEach(function (p) {
                if (p.status && !this._scripts.includes(p.name)) {
                    this.setParameters(p.name, p.parameters);
                    this.loadScript(p.name + '.js');
                    this._scripts.push(p.name);
                }
            }, this);
        },
    };
    vm.createContext(sandbox);
    vm.runInContext(SNIPPET, sandbox);
    return { sandbox, scriptTags };
}

function writeProject(dir, { retired = [], agonia = {} } = {}) {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: retired }));
    fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify(agonia));
}

const RETIRED_SDLIGHT = {
    name: 'SDLight', reason: 'S2',
    parameters: {
        'Use Real Shadows': 'true',
        'Wall Softness': '16',
        'Region Settings': '8 #000000, 1 #000000,',
        'Master Opacity Variable': '337'
    },
    orderBefore: []
};

test('system module: retired SDLight loads from snapshot + DB overrides, before plugins', () => {
    const dir = tempDir();
    try {
        writeProject(dir, {
            retired: [RETIRED_SDLIGHT],
            agonia: { lighting: { 'Use Real Shadows': true, 'Player radius': 0, 'Dash Blocking Switches': [18] } }
        });
        const { sandbox, scriptTags } = makeSandbox(dir);
        vm.runInContext(`$plugins = [{name:'WaitAsync',status:true,parameters:{}}]; PluginManager.setup($plugins);`, sandbox);

        const PM = sandbox.PluginManager;
        const params = PM.parameters('SDLight');
        // Snapshot keys kept.
        assert.strictEqual(params['Wall Softness'], '16');
        assert.strictEqual(params['Region Settings'], '8 #000000, 1 #000000,');
        assert.strictEqual(params['Master Opacity Variable'], '337');
        // DB overrides (stringified MV style).
        assert.strictEqual(params['Use Real Shadows'], 'true');
        assert.strictEqual(params['Player radius'], '0');

        // The system scripts load FIRST (before plugin scripts); every
        // registered module fires (SDLight, Movement, Addon) in registry order.
        assert.strictEqual(scriptTags.length, 4);
        assert.strictEqual(scriptTags[0].src, 'js/plugins/SDLight.js');
        assert.ok(scriptTags[0].src.indexOf('SuperDuperMovement') === -1, 'SDLight leads');
        assert.strictEqual(scriptTags[3].src, 'js/plugins/WaitAsync.js');

        // _scripts tracks the system module (no double-load if it returns
        // to the manifest later).
        assert.ok(PM._scripts.includes('SDLight'));

        // Not in $plugins - it is not a plugin.
        assert.ok(!sandbox.window.$plugins.some(p => p.name === 'SDLight'));
    } finally {
        cleanupTemp(dir);
    }
});

test('system module: transitional (SDLight still a plugin) -> loader skips, params via applyAgoniaConfig', () => {
    const dir = tempDir();
    try {
        writeProject(dir, {
            retired: [RETIRED_SDLIGHT],
            agonia: { lighting: { 'Wall Softness': 16 } }
        });
        const { sandbox, scriptTags } = makeSandbox(dir);
        vm.runInContext(`$plugins = [{name:'SDLight',status:true,parameters:{'Wall Softness':'1','Use Real Shadows':'false'}}]; PluginManager.setup($plugins);`, sandbox);
        const PM = sandbox.PluginManager;
        // applyAgoniaConfig wrote the DB value into the plugin's params.
        assert.strictEqual(PM.parameters('SDLight')['Wall Softness'], '16');
        assert.strictEqual(PM.parameters('SDLight')['Use Real Shadows'], 'false', 'non-DB key untouched');
        // The plugin loaded exactly once through the PLUGIN path (no system
        // double-load).
        const sdLoads = scriptTags.filter(t => String(t.src).includes('SDLight'));
        assert.strictEqual(sdLoads.length, 1, 'loaded once');
        assert.ok(!sdLoads[0]._systemLoad, 'via the plugin path, not the system loader');
        assert.ok(PM._scripts.includes('SDLight'), 'tracked as a plugin');
    } finally {
        cleanupTemp(dir);
    }
});

test('system module: no retired record -> DB-only params still load the module', () => {
    const dir = tempDir();
    try {
        writeProject(dir, { retired: [], agonia: { lighting: { 'Player radius': 0 } } });
        const { sandbox, scriptTags } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);
        // Every registered system module loads (SDLight, Movement, Addon).
        const systemSrcs = scriptTags.map(t => t.src);
        assert.ok(systemSrcs.includes('js/plugins/SDLight.js'), 'SDLight loaded');
        assert.strictEqual(sandbox.PluginManager.parameters('SDLight')['Player radius'], '0');
        // Registry order: Movement before its Addon.
        assert.ok(systemSrcs.indexOf('js/plugins/SuperDuperMovement.js') !== -1, 'Movement loaded');
        assert.ok(systemSrcs.indexOf('js/plugins/SuperDuperMovement_Addon.js') !== -1, 'Addon loaded');
        assert.ok(systemSrcs.indexOf('js/plugins/SuperDuperMovement.js') < systemSrcs.indexOf('js/plugins/SuperDuperMovement_Addon.js'),
            'Movement before Addon');
    } finally {
        cleanupTemp(dir);
    }
});

test('system module: no DB, no snapshot -> module still loads with empty params', () => {
    const dir = tempDir();
    try {
        writeProject(dir, {});
        const { sandbox, scriptTags } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);
        // All three registered modules load with file defaults.
        assert.strictEqual(scriptTags.length, 3, 'SDLight + Movement + Addon');
    } finally {
        cleanupTemp(dir);
    }
});
