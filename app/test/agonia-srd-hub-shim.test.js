const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ProjectManager = require('../src/ProjectManager.js');
const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-s1b-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function makeSandbox(dir, extra = {}) {
    function PixiFilter() { this.uniforms = {}; }
    PixiFilter.prototype.apply = function () { };
    function FakeSceneBase() { this.initialize.apply(this, arguments); }
    FakeSceneBase.prototype.filters = null;
    FakeSceneBase.prototype.initialize = function () { };
    FakeSceneBase.prototype.start = function () { };
    FakeSceneBase.prototype.update = function () { };
    // MV convention: the constructor dispatches to initialize.
    function FakeGameSystem() { this.initialize.apply(this, arguments); }
    FakeGameSystem.prototype.initialize = function () { };
    // MV statics are functions; the shim's typeof guards require that shape.
    function FakeDecrypter() { }
    FakeDecrypter._ignoreList = [];
    function FakeResourceHandler() { }
    FakeResourceHandler._defaultRetryInterval = null;
    const sandbox = {
        console,
        $plugins: [],
        window: null,
        _rrListeners: {},
        addEventListener(type, fn) { (this._rrListeners[type] = this._rrListeners[type] || []).push(fn); },
        SceneManager: { _screenWidth: 816, _screenHeight: 624, _boxWidth: 816, _boxHeight: 624, _scene: null },
        Scene_Base: FakeSceneBase,
        Game_System: FakeGameSystem,
        Game_Interpreter: function () { },
        Sprite: function () { }, Bitmap: function () { }, Spriteset_Map: function () { },
        Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
        TouchInput: { isTriggered: () => false },
        Window_TitleCommand: function () { },
        ImageManager: { loadSystem: () => ({ isReady: () => false }) },
        Graphics: { width: 816, height: 624 },
        $gameTemp: {},
        navigator: { getGamepads: () => [] },
        PIXI: {
            Filter: PixiFilter,
            settings: {},
            SCALE_MODES: { LINEAR: 'linear', NEAREST: 'nearest' },
            GC_MODES: { AUTO: 1, MANUAL: 2 },
            WRAP_MODES: { CLAMP: 1, REPEAT: 2, MIRRORED_REPEAT: 3 }
        },
        ImageCache: function () { },
        JsonEx: { maxDepth: 100 },
        Decrypter: FakeDecrypter,
        ResourceHandler: FakeResourceHandler,
        Scene_Boot: function () { },
        Utils: { isOptionValid: () => true, isNwjs: () => false, RPGMAKER_VERSION: '1.6.3' },
        document: {
            createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
            body: { appendChild() { }, style: {} },
        },
        process: { env: {}, cwd: () => dir },
        require: name => {
            if (name === 'fs') return fs;
            if (name === 'path') return path;
            return null;
        },
        ...extra
    };
    sandbox.Scene_Boot.prototype = { start: function () { } };
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
    return sandbox;
}

const RETIRED_HUB = {
    name: 'SRD_GameUpgrade',
    reason: 'S1',
    parameters: {
        'Game Resolution': '{"Width":"1280","Height":"720"}',
        'Scale Mode': 'Nearest',
        'Garbage Collection Mode': 'Automatic',
        'Wrap Mode': 'Clamp',
        'Image Cache Limit': '30',
        'JsonEx Max Depth': '100',
        'Decrypter Ignore List': '["system/Window.png"]',
        'Retry Intervals': '["500","1000","3000"]',
        'Initial Fullscreen': 'true'
    },
    orderBefore: []
};

test('SRD hub shim: namespace, Imported flag, GameWindowManager, tuning ports, resolution', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [],
            retiredPlugins: [RETIRED_HUB]
        }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Screen Width': 1280, 'Screen Height': 720, 'Enabled on Startup': true }
        }));
        const sb = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sb);

        // Resolution via MV core fields.
        assert.strictEqual(sb.SceneManager._screenWidth, 1280);
        assert.strictEqual(sb.SceneManager._boxHeight, 720);

        // Namespace contract for the dependents.
        assert.strictEqual(sb.Imported['SumRndmDde Game Upgrade'], 1.35);
        assert.ok(Array.isArray(sb.SRD.NotetagGetters));
        assert.strictEqual(typeof sb.SRD.requirePlugin, 'function');
        assert.strictEqual(typeof sb.SRD.parse, 'function');
        assert.ok(sb.SRD.isPlaytest);
        const parsed = sb.SRD.parse('{"Width":"1280","Height":"720"}', true);
        assert.strictEqual(parsed.Width, 1280, 'numeric strings become numbers with parseEverything');
        assert.strictEqual(sb.SRD.parse('hello', true), 'hello');
        assert.strictEqual(sb.SRD.pluginExists('SumRndmDde Game Upgrade'), true);
        assert.strictEqual(sb.SRD.pluginExists('Nope'), false);

        // GameWindowManager stub.
        assert.strictEqual(typeof sb.GameWindowManager.closeGame, 'function');
        assert.strictEqual(typeof sb.GameWindowManager.onWindowClose, 'function');

        // Tuning ports from the retired snapshot.
        assert.strictEqual(sb.ImageCache.limit, 30 * 1000 * 1000);
        assert.strictEqual(sb.JsonEx.maxDepth, 100);
        assert.deepEqual(sb.Decrypter._ignoreList, ['img/system/Window.png']);
        assert.deepEqual(sb.ResourceHandler._defaultRetryInterval, ['500', '1000', '3000']);
        assert.strictEqual(sb.PIXI.settings.SCALE_MODE, 'nearest');
        assert.strictEqual(sb.PIXI.settings.GC_MODE, 2, 'Automatic param -> MANUAL (SRD semantics)');
        assert.strictEqual(sb.PIXI.settings.WRAP_MODE, 1);

        // Fullscreen boot hook installed (param true).
        assert.ok(sb.Scene_Boot.prototype.start.toString().indexOf('setTimeout') !== -1);
    } finally {
        cleanupTemp(dir);
    }
});

test('hub shim off while SRD_GameUpgrade is loaded (transitional)', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({}));
        const sb = makeSandbox(dir);
        vm.runInContext(`$plugins = [{name:'SRD_GameUpgrade',status:true,parameters:{}}]; PluginManager.setup($plugins);`, sb);
        assert.strictEqual(sb.window.__rrSrdHub, undefined, 'hub shim not installed');
        assert.strictEqual(sb.SceneManager._screenWidth, 816, 'resolution untouched');
    } finally {
        cleanupTemp(dir);
    }
});

test('system CRT carries _superDuperConfig + SUPERDUPER channel + interpolation', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Screen Width': 1280, 'Screen Height': 720, 'Enabled on Startup': true, 'Scanline Intensity': 0.4 }
        }));
        const sb = makeSandbox(dir);
        // Recorder installed BEFORE setup: the CRT intercept aliases it as the
        // passthrough, so foreign commands land here while SUPERDUPER is
        // captured by the system.
        const passthrough = [];
        sb.Game_Interpreter.prototype.pluginCommand = function (c, a) { passthrough.push(c); };
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sb);

        const crt = sb.__RRMVBridge.screen.crt;
        assert.ok(crt, 'system CRT installed');

        // Game_System carries the compatibility block (constructor -> initialize).
        const gs = new sb.Game_System();
        assert.ok(gs._superDuperConfig);
        assert.strictEqual(gs._superDuperConfig.active, true);
        assert.strictEqual(gs._superDuperConfig.scanline, 0.4);
        assert.deepEqual(gs._superDuperFrames, {});
        assert.deepEqual(gs._superDuperSavedPresets, {});

        // SUPERDUPER channel through the pluginCommand chain.
        sb.$gameSystem = gs;
        const GI = sb.Game_Interpreter;
        const it = Object.create(GI.prototype);
        it.pluginCommand('SUPERDUPER', ['OFF']);
        assert.strictEqual(crt.active, false, 'channel OFF');
        it.pluginCommand('SuperDuper', ['SET', 'scanline', '1.0', '3']);
        assert.strictEqual(gs._superDuperTarget.scanline, 1.0);
        assert.strictEqual(gs._superDuperFrames.scanline, 3);
        assert.strictEqual(gs._superDuperConfig.scanline, 0.4, 'not applied immediately');
        // Foreign commands still pass through.
        it.pluginCommand('Light', ['on', '4']);
        assert.deepEqual(passthrough, ['Light']);

        // Interpolation: 3 frames converge toward the target.
        const scene = new sb.Scene_Base();
        scene.update();
        const after1 = gs._superDuperConfig.scanline;
        assert.ok(after1 > 0.4 && after1 < 1.0, 'moved toward target');
        assert.strictEqual(gs._superDuperFrames.scanline, 2);
        scene.update(); scene.update();
        assert.strictEqual(gs._superDuperFrames.scanline, 0);
        assert.ok(Math.abs(gs._superDuperConfig.scanline - 1.0) < 1e-9, 'converged');
        assert.strictEqual(crt.filter.uniforms.uScanline, 1.0, 'uniforms follow config');

        // SET active through the channel drives the scene filter.
        assert.strictEqual(crt.active, false);
        scene.start();
        sb.SceneManager._scene = scene;
        it.pluginCommand('SUPERDUPER', ['ON']);
        scene.update();
        assert.strictEqual(crt.active, true);
        assert.ok(scene.filters && scene.filters.indexOf(crt.filter) !== -1, 'filter applied via config.active sync');

        // SAVE_PRESET / PRESET round-trip.
        it.pluginCommand('SUPERDUPER', ['SAVE_PRESET', 'MyVHS']);
        gs._superDuperConfig.scanline = 0.1;
        it.pluginCommand('SUPERDUPER', ['PRESET', 'myvhs']);
        assert.ok(Math.abs(gs._superDuperConfig.scanline - 1.0) < 1e-9, 'preset restored the value');

        // 727 prefers the system CRT and reads saved presets.
        it._params = [2, 'myvhs'];
        it.command727();
        assert.ok(Math.abs(crt.filter.uniforms.uScanline - 1.0) < 1e-9, '727 preset hit the system CRT');
    } finally {
        cleanupTemp(dir);
    }
});
