const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('vm');

const ProjectManager = require('../src/ProjectManager.js');
const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-nobattle-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function makeSandbox(dir, overrides = {}) {
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
        // No-battle targets present as mocks so installNoBattle patches them.
        DataManager: { isBattleTest: () => true },
        BattleManager: {
            setup() { throw new Error('battle started'); },
            startBattle() { throw new Error('battle started'); }
        },
        Game_Player: function () { },
        Scene_Battle: function () { },
        Window_BattleLog: function () { },
        Window_PartyCommand: function () { },
        Game_Interpreter: function () { },
        Spriteset_Map: function () { }, Sprite: function () { }, Bitmap: function () { },
        Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
        TouchInput: { isTriggered: () => false }, Window_TitleCommand: function () { },
        ImageManager: { loadSystem: () => ({ isReady: () => false }) },
        Graphics: { width: 816, height: 624 }, $gameTemp: {},
        navigator: { getGamepads: () => [] },
        PIXI: { Filter: PixiFilter, settings: {}, SCALE_MODES: {}, GC_MODES: {}, WRAP_MODES: {} },
        Utils: { isOptionValid: () => false, isNwjs: () => false, RPGMAKER_VERSION: '1.6.3' },
        Rectangle: function (x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; },
        document: {
            createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
            body: { appendChild: tag => scriptTags.push(tag) },
        },
        process: { env: {}, cwd: () => dir },
        require: n => (n === 'fs' ? fs : n === 'path' ? path : null),
        ...overrides
    };
    sandbox.Game_Player.prototype = {
        updateEncounter() { throw new Error('encounter!'); },
        encounterProgressValue() { return 999; }
    };
    sandbox.window = sandbox;
    sandbox.PluginManager = {
        _path: 'js/plugins/', _scripts: [], _parameters: {}, _errorUrls: [],
        onError() { }, setParameters(n, p) { this._parameters[n.toLowerCase()] = p; },
        parameters(n) { return this._parameters[n.toLowerCase()] || {}; },
        loadScript() { },
        setup(plugins) { plugins.forEach(function (p) { if (p.status) this._scripts.push(p.name); }, this); },
    };
    vm.createContext(sandbox);
    vm.runInContext(SNIPPET, sandbox);
    return { sandbox, scriptTags };
}

test('no-battle: 301 and enemy ops become no-ops, battle entry points blocked', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        const { sandbox } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);

        const GI = sandbox.Game_Interpreter;
        const proto = GI.prototype;
        // Interpreter commands patched at install time exist on the prototype.
        assert.strictEqual(typeof proto.command301, 'function');
        // 301 warns and continues the event list.
        assert.strictEqual(proto.command301.call({}), true);
        // Enemy ops are silent no-ops.
        for (const code of [331, 332, 333, 334, 335, 336, 337, 339, 340, 342]) {
            assert.strictEqual(proto['command' + code].call({}), true, 'command' + code + ' no-op');
        }
        // Battle-only system/actor commands (S13): battle music/ME,
        // encounters, battle background, animations (stub), states (stub),
        // TP.
        for (const code of [132, 133, 136, 139, 212, 283, 313, 326]) {
            assert.strictEqual(proto['command' + code].call({}), true, 'command' + code + ' no-op');
        }
        // Battle entry points are blocked.
        assert.strictEqual(sandbox.DataManager.isBattleTest(), false);
        sandbox.BattleManager.setup(1);      // must not throw
        sandbox.BattleManager.startBattle(); // must not throw
        // Random encounters are disabled.
        const player = Object.create(sandbox.Game_Player.prototype);
        player.updateEncounter();
        assert.strictEqual(player.encounterProgressValue(), 0);
    } finally {
        cleanupTemp(dir);
    }
});

test('no-battle: battle UI classes purged on the first map start', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        function Scene_Map() { }
        Scene_Map.prototype = { start() { } };
        const { sandbox } = makeSandbox(dir, { Scene_Map });
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);

        // Before the first map start the classes still exist (plugins are
        // still loading and alias them).
        assert.ok(sandbox.window.Scene_Battle, 'Scene_Battle alive during plugin load');
        // First map start purges them - after every script has run.
        const map = Object.create(sandbox.Scene_Map.prototype);
        map.start();
        assert.strictEqual(sandbox.window.Scene_Battle, undefined, 'Scene_Battle purged');
        assert.strictEqual(sandbox.window.Window_BattleLog, undefined);
        assert.strictEqual(sandbox.window.Window_PartyCommand, undefined);
        // Non-battle classes are untouched.
        assert.ok(sandbox.window.Game_Interpreter, 'Game_Interpreter survives (save data needs it)');
        assert.ok(sandbox.window.Game_Player, 'Game_Player survives');
        // Idempotent: a second map start is a no-op.
        map.start();
        assert.strictEqual(sandbox.window.Scene_Battle, undefined);
    } finally {
        cleanupTemp(dir);
    }
});

test('no-battle: install is tolerant when battle classes never existed', () => {
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        // Sandbox WITHOUT any battle classes or managers at all.
        const { sandbox } = makeSandbox(dir, {
            Scene_Battle: undefined, Window_BattleLog: undefined, Window_PartyCommand: undefined,
            DataManager: undefined, BattleManager: undefined
        });
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);
        assert.ok(sandbox.window.Game_Interpreter, 'boot survives without battle classes');
    } finally {
        cleanupTemp(dir);
    }
});
