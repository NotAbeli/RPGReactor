const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ProjectManager = require('../src/ProjectManager.js');
const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-singlewriter-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function makeSandbox(dir) {
    function PixiFilter() { this.uniforms = {}; }
    PixiFilter.prototype.apply = function () { };
    function FakeSceneBase() { this.initialize.apply(this, arguments); }
    FakeSceneBase.prototype.filters = null;
    FakeSceneBase.prototype.initialize = function () { };
    FakeSceneBase.prototype.start = function () { };
    FakeSceneBase.prototype.update = function () { };
    const sandbox = {
        console, $plugins: [], window: null, _rrListeners: {},
        addEventListener(t, f) { (this._rrListeners[t] = this._rrListeners[t] || []).push(f); },
        SceneManager: { _screenWidth: 816, _screenHeight: 624, _boxWidth: 816, _boxHeight: 624, _scene: null },
        Scene_Base: FakeSceneBase,
        Game_Interpreter: function () { }, Sprite: function () { }, Bitmap: function () { }, Spriteset_Map: function () { },
        Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
        TouchInput: { isTriggered: () => false },
        Window_TitleCommand: function () { },
        ImageManager: { loadSystem: () => ({ isReady: () => false }) },
        Graphics: { width: 816, height: 624 }, $gameTemp: {}, navigator: { getGamepads: () => [] },
        PIXI: { Filter: PixiFilter, settings: {}, SCALE_MODES: {}, GC_MODES: {}, WRAP_MODES: {} },
        Utils: { isOptionValid: () => false, isNwjs: () => false, RPGMAKER_VERSION: '1.6.3' },
        document: { createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }), body: { appendChild() { }, style: {} } },
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
    return sandbox;
}

const LEGACY_SCREEN_PLUGINS = [
    { name: 'SRD_GameUpgrade', status: true, parameters: {
        'Game Resolution': '{"Width":"816","Height":"624"}',
        'Screen Resolution': '{"Width":"816","Height":"624"}',
        'Initial Fullscreen': 'false',
        'Window Title': ''
    } },
    { name: 'SuperDuperCore', status: true, parameters: {
        'Разрешение экрана (Ширина)': '816',
        'Разрешение экрана (Высота)': '624',
        'Разрешение отображения (Ширина)': '640',
        'Разрешение отображения (Высота)': '360'
    } },
    { name: 'SuperDuperScreen', status: true, parameters: {
        'Screen Width': '816', 'Screen Height': '624', 'Enabled on Startup': 'true'
    } }
];

test('single writer: DB resolution overwrites every legacy screen plugin copy', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Screen Width': 1440, 'Screen Height': 900, 'Fullscreen': true, 'Window Title': 'Agonia Test' }
        }));
        const sb = makeSandbox(dir);
        vm.runInContext(`$plugins = ${JSON.stringify(LEGACY_SCREEN_PLUGINS)}; PluginManager.setup($plugins);`, sb);

        const PM = sb.PluginManager;
        const srd = PM.parameters('SRD_GameUpgrade');
        const expectedJson = JSON.stringify({ Width: '1440', Height: '900' });
        assert.strictEqual(srd['Game Resolution'], expectedJson);
        assert.strictEqual(srd['Screen Resolution'], expectedJson);
        assert.strictEqual(srd['Initial Fullscreen'], 'true');
        assert.strictEqual(srd['Window Title'], 'Agonia Test');

        const core = PM.parameters('SuperDuperCore');
        assert.strictEqual(core['Разрешение экрана (Ширина)'], '1440');
        assert.strictEqual(core['Разрешение экрана (Высота)'], '900');
        // The display-scale knobs are NOT screen writers - must stay untouched.
        assert.strictEqual(core['Разрешение отображения (Ширина)'], '640');
        assert.strictEqual(core['Разрешение отображения (Высота)'], '360');

        const screen = PM.parameters('SuperDuperScreen');
        assert.strictEqual(screen['Screen Width'], '1440');
        assert.strictEqual(screen['Screen Height'], '900');
        assert.strictEqual(screen['Enabled on Startup'], 'true', 'CRT flag owned by applyAgoniaConfig, untouched');

        // window.$plugins carries the same consistent copies.
        const wp = sb.window.$plugins;
        assert.strictEqual(wp.find(p => p.name === 'SRD_GameUpgrade').parameters['Game Resolution'], expectedJson);
        assert.strictEqual(wp.find(p => p.name === 'SuperDuperScreen').parameters['Screen Height'], '900');
    } finally {
        cleanupTemp(dir);
    }
});

test('single writer: DB fullscreen=false writes "false"; empty title leaves the plugin value', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Screen Width': 1280, 'Screen Height': 720, 'Fullscreen': false, 'Window Title': '' }
        }));
        const sb = makeSandbox(dir);
        vm.runInContext(`$plugins = ${JSON.stringify(LEGACY_SCREEN_PLUGINS.map(p =>
            p.name === 'SRD_GameUpgrade'
                ? { ...p, parameters: { ...p.parameters, 'Window Title': 'Kept From Plugin' } }
                : p))}; PluginManager.setup($plugins);`, sb);

        const srd = sb.PluginManager.parameters('SRD_GameUpgrade');
        assert.strictEqual(srd['Initial Fullscreen'], 'false');
        assert.strictEqual(srd['Window Title'], 'Kept From Plugin', 'empty DB title does not blank the plugin one');
    } finally {
        cleanupTemp(dir);
    }
});

test('single writer: no DB values -> legacy plugin parameters untouched', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Enabled on Startup': true }
        }));
        const sb = makeSandbox(dir);
        vm.runInContext(`$plugins = ${JSON.stringify(LEGACY_SCREEN_PLUGINS)}; PluginManager.setup($plugins);`, sb);
        const srd = sb.PluginManager.parameters('SRD_GameUpgrade');
        assert.strictEqual(srd['Game Resolution'], '{"Width":"816","Height":"624"}');
        const core = sb.PluginManager.parameters('SuperDuperCore');
        assert.strictEqual(core['Разрешение экрана (Ширина)'], '816');
    } finally {
        cleanupTemp(dir);
    }
});

test('single writer: screen section schema includes fullscreen/title in both defaults copies', () => {
    // Drift test already compares values; here we assert the keys exist in the
    // editor layout so the DB fields are reachable from the UI.
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'database', 'DatabaseAgoniaEditor.js'), 'utf8');
    assert.ok(source.includes("{ key: 'Fullscreen', type: 'bool' }"), 'Fullscreen field in editor');
    assert.ok(source.includes("{ key: 'Window Title', type: 'string' }"), 'Window Title field in editor');
});
