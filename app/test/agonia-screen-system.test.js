const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const PluginCommandMigration = require('../src/PluginCommandMigration.js');
const ProjectManager = require('../src/ProjectManager.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-s1-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

// Canonical order of the seven-module fixture; prefixes are full.
const CANON = ['SRD_GameUpgrade', 'SuperDuperCore', 'WaitAsync', 'SuperDuperMovement', 'SuperDuperScreen', 'SDLight', 'ZTail'];

function writeFixture(dir) {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    const modules = CANON.map((name, i) => ({
        name,
        parameters: { ['p_' + name]: name.length },
        orderBefore: CANON.slice(0, i)
    }));
    fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
        engineModules: modules,
        disabledPlugins: [{ name: 'DeadOne', parameters: { z: '1' } }]
    }));
}

test('retire/restore round-trip: exact tuning, exact canonical position', () => {
    const dir = tempDir();
    try {
        writeFixture(dir);

        const ret = PluginCommandMigration.retirePlugins({
            fs, path, projectPath: dir,
            names: ['SRD_GameUpgrade', 'SuperDuperCore', 'SuperDuperScreen'],
            reason: 'S1 screen system'
        });
        assert.strictEqual(ret.ok, true, ret.error);
        assert.deepEqual(ret.retired.sort(), ['SRD_GameUpgrade', 'SuperDuperCore', 'SuperDuperScreen']);

        let meta = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        assert.deepEqual(meta.engineModules.map(m => m.name), ['WaitAsync', 'SuperDuperMovement', 'SDLight', 'ZTail']);
        // OrderBefore of the survivors still carries the retired names
        // (harvested prefixes are historical fact) - the merge ignores
        // missing anchors safely.
        assert.strictEqual(meta.retiredPlugins.length, 3);
        const srd = meta.retiredPlugins.find(r => r.name === 'SRD_GameUpgrade');
        assert.strictEqual(srd.parameters.p_SRD_GameUpgrade, 'SRD_GameUpgrade'.length);
        assert.strictEqual(srd.reason, 'S1 screen system');
        assert.ok(srd.retiredAt);
        assert.deepEqual(srd.orderBefore, [], 'SRD was first: empty prefix');

        // Retire is idempotent-safe: retiring again reports not-found.
        const ret2 = PluginCommandMigration.retirePlugins({
            fs, path, projectPath: dir, names: ['SRD_GameUpgrade']
        });
        assert.strictEqual(ret2.ok, false);
        assert.deepEqual(ret2.notFound, ['SRD_GameUpgrade']);

        // Restore: canonical positions and tuning must return bit-for-bit.
        const res = PluginCommandMigration.restoreRetired({
            fs, path, projectPath: dir,
            names: ['SuperDuperScreen', 'SRD_GameUpgrade', 'SuperDuperCore']
        });
        assert.strictEqual(res.ok, true, res.error);

        meta = JSON.parse(fs.readFileSync(path.join(dir, 'project.rpgreactor'), 'utf8'));
        assert.deepEqual(meta.engineModules.map(m => m.name), CANON, 'canonical order restored');
        assert.strictEqual(meta.retiredPlugins.length, 0);
        // Tuning back, prefixes rebuilt canonically.
        assert.strictEqual(meta.engineModules[0].parameters.p_SRD_GameUpgrade, 'SRD_GameUpgrade'.length);
        for (let i = 0; i < CANON.length; i++) {
            assert.deepEqual(meta.engineModules[i].orderBefore, CANON.slice(0, i),
                `prefix of ${CANON[i]} canonical`);
        }
        assert.deepEqual(meta.disabledPlugins, [{ name: 'DeadOne', parameters: { z: '1' } }]);
    } finally {
        cleanupTemp(dir);
    }
});

/** Sandbox with PIXI v4-ish Filter + Scene_Base for the screen system. */
function makeScreenSandbox(dir, { plugins = [], agonia = null } = {}) {
    const scriptTags = [];
    const filtersApplied = [];
    function FakeSceneBase() { }
    FakeSceneBase.prototype.filters = null;
    FakeSceneBase.prototype.start = function () { };
    FakeSceneBase.prototype.update = function () { };

    const filterInstances = [];
    function PixiFilter() { this.uniforms = {}; }
    PixiFilter.prototype.apply = function () { };
    const sandbox = {
        console, $plugins: plugins,
        window: null,
        _rrListeners: {},
        addEventListener(type, fn) {
            (this._rrListeners[type] = this._rrListeners[type] || []).push(fn);
        },
        SceneManager: { _screenWidth: 816, _screenHeight: 624, _boxWidth: 816, _boxHeight: 624, _scene: null },
        Scene_Base: FakeSceneBase,
        Game_Interpreter: function () { },
        Sprite: function () { }, Bitmap: function () { }, Spriteset_Map: function () { },
        Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
        TouchInput: { isTriggered: () => false },
        Window_TitleCommand: function () { },
        ImageManager: { loadSystem: () => ({ isReady: () => false }) },
        Graphics: { width: 816, height: 624 },
        $gameTemp: {},
        navigator: { getGamepads: () => [] },
        PIXI: { Filter: PixiFilter },
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
    vm.runInContext(ProjectManager.MV_CATALOG_LOADER_SNIPPET, sandbox);
    return { sandbox, scriptTags };
}

test('screen system (transitional): plugins loaded -> system parts stay off', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Screen Width': 1920, 'Screen Height': 1080, 'Enabled on Startup': true }
        }));
        const { sandbox } = makeScreenSandbox(dir, {
            plugins: [
                { name: 'SRD_GameUpgrade', status: true, parameters: {} },
                { name: 'SuperDuperCore', status: true, parameters: {} },
                { name: 'SuperDuperScreen', status: true, parameters: {} }
            ]
        });
        vm.runInContext(`$plugins = [
            {name:'SRD_GameUpgrade',status:true,parameters:{}},
            {name:'SuperDuperCore',status:true,parameters:{}},
            {name:'SuperDuperScreen',status:true,parameters:{}}
        ]; PluginManager.setup($plugins);`, sandbox);

        // Plugins own everything: no system overrides.
        assert.strictEqual(sandbox.SceneManager._screenWidth, 816, 'resolution untouched');
        assert.strictEqual(sandbox.__RRMVBridge.screen.crt, null, 'no system CRT');
        assert.strictEqual(sandbox.__RRMVBridge.screen.core, false, 'no Core shim');
        // Scene_Base.start stays the original function (no CRT hook).
        assert.strictEqual(sandbox.Scene_Base.prototype.start.toString(), (function () { }).toString());
    } finally {
        cleanupTemp(dir);
    }
});

test('screen system (retired): resolution, Core shim, CRT filter and 727 all system-owned', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: {
                'Screen Width': 1280, 'Screen Height': 720,
                'Enabled on Startup': true,
                'Scanline Intensity': 0.4, 'Noise Intensity': 1.5,
                'Overall Intensity': 0.1
            }
        }));
        const { sandbox } = makeScreenSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);

        // Resolution from the DB through the SRD fields.
        assert.strictEqual(sandbox.SceneManager._screenWidth, 1280);
        assert.strictEqual(sandbox.SceneManager._screenHeight, 720);
        assert.strictEqual(sandbox.SceneManager._boxWidth, 1280);

        // Core shim installed with the same numbers.
        assert.ok(sandbox.window.SuperDuper.Core);
        assert.strictEqual(sandbox.window.SuperDuper.Core.screen.width, 1280);
        assert.strictEqual(sandbox.window.SuperDuper.Core.pctX(50), 640);
        assert.strictEqual(sandbox.window.SuperDuper.Core.clamp(11, 0, 10), 10);

        // System CRT installed and wired to Scene_Base.
        const crt = sandbox.__RRMVBridge.screen.crt;
        assert.ok(crt, 'system CRT installed');
        assert.strictEqual(crt.active, true);
        assert.strictEqual(crt.filter.uniforms.uScanline, 0.4);
        assert.strictEqual(crt.filter.uniforms.uNoise, 1.5);
        assert.strictEqual(crt.filter.uniforms.uResolution[0], 1280);

        // Scene lifecycle drives the filter.
        const scene = new sandbox.Scene_Base();
        scene.start();
        assert.ok(scene.filters && scene.filters.indexOf(crt.filter) !== -1, 'filter applied on start');
        scene.update();
        assert.strictEqual(crt.filter.uniforms.uWaveTime, 0.05, 'wave time advances while active');

        // Toggle off removes it from the live scene.
        sandbox.SceneManager._scene = scene;
        crt.setActive(false);
        assert.strictEqual(crt.active, false);
        assert.ok(!scene.filters, 'filter removed from live scene');
        scene.update();
        assert.strictEqual(crt.filter.uniforms.uWaveTime, 0.05, 'no advancement while inactive');

        // Presets: registered + applied.
        crt.registerPreset('vhs', { intensity: 1, scanline: 2 });
        crt.setActive(true);
        assert.strictEqual(crt.applyPreset('VHS'), true);
        assert.strictEqual(crt.filter.uniforms.uIntensity, 1);
        assert.strictEqual(crt.applyPreset('nope'), false);

        // 727 dispatches to the system CRT (no pluginCommand).
        const GI = sandbox.Game_Interpreter;
        const calls = [];
        GI.prototype.pluginCommand = function (c, a) { calls.push(c); };
        const it = Object.create(GI.prototype);
        it._params = [0];
        it.command727();
        assert.strictEqual(crt.active, false, '727 OFF hit the system CRT');
        assert.strictEqual(calls.length, 0, 'no plugin fallback');
        it._params = [1];
        it.command727();
        assert.strictEqual(crt.active, true, '727 ON hit the system CRT');
    } finally {
        cleanupTemp(dir);
    }
});

test('727 falls back to the plugin when no system CRT is installed', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            screen: { 'Screen Width': 1280, 'Screen Height': 720 }
        }));
        const { sandbox } = makeScreenSandbox(dir, {
            plugins: [{ name: 'SuperDuperScreen', status: true, parameters: {} }]
        });
        vm.runInContext(`$plugins = [{name:'SuperDuperScreen',status:true,parameters:{}}]; PluginManager.setup($plugins);`, sandbox);
        assert.strictEqual(sandbox.__RRMVBridge.screen.crt, null);

        const GI = sandbox.Game_Interpreter;
        const calls = [];
        GI.prototype.pluginCommand = function (c, a) { calls.push([c, a]); };
        const it = Object.create(GI.prototype);
        it._params = [2, 'VHS'];
        it.command727();
        assert.deepEqual(calls, [['SUPERDUPER', ['PRESET', 'VHS']]]);
    } finally {
        cleanupTemp(dir);
    }
});
