const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ProjectManager = require('../src/ProjectManager.js');
const { restoreMvRuntime } = require('../build-scripts/restore-mv-runtime.js');

const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-mvbridge-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

/**
 * Full MV-shaped sandbox: PluginManager with the real MV setup semantics,
 * document mocks, fs/path against a temp "project" directory. Runs the v2
 * snippet, then drives PluginManager.setup($plugins) exactly like main.js.
 */
function makeSandbox(projectDir) {
    const loadedScripts = [];
    const scriptTags = [];
    const sandbox = {
        console,
        $plugins: [],
        Game_Interpreter: function () { },
        Spriteset_Map: function () { },
        Sprite: function () { },
        Bitmap: function () { },
        // MV-shaped Input with the real gamepad poll path (hardening target)
        Input: {
            _currentState: {},
            _previousState: {},
            _latestButton: null,
            _pressedTime: 0,
            _gamepadStates: [],
            gamepadMapper: { 0: 'ok', 1: 'cancel' },
            _pollGamepads() { },
            _updateGamepadState(gamepad) {
                const lastState = this._gamepadStates[gamepad.index] || [];
                const newState = [];
                const buttons = gamepad.buttons;
                for (let i = 0; i < buttons.length; i++) newState[i] = buttons[i].pressed;
                for (let j = 0; j < newState.length; j++) {
                    if (newState[j] !== lastState[j]) {
                        const buttonName = this.gamepadMapper[j];
                        if (buttonName) this._currentState[buttonName] = newState[j];
                    }
                }
                this._gamepadStates[gamepad.index] = newState;
            },
            isTriggered(name) {
                return this._currentState[name] && !this._previousState[name];
            },
            update() {
                for (const name in this._currentState) this._previousState[name] = this._currentState[name];
            },
        },
        TouchInput: { isTriggered: () => false },
        Window_TitleCommand: function () { },
        // Minimal event bus so the hardening's window listeners are testable
        _rrListeners: {},
        addEventListener(type, fn) {
            (this._rrListeners[type] = this._rrListeners[type] || []).push(fn);
        },
        ImageManager: { loadSystem: () => ({ isReady: () => false }), loadPicture: () => ({}), loadFace: () => ({}) },
        Graphics: { width: 816, height: 624 },
        $gameTemp: {},
        $gamePlayer: { screenX: () => 400, screenY: () => 300 },
        navigator: { getGamepads: () => [] },
        document: {
            createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
            body: { appendChild: tag => scriptTags.push(tag) },
        },
        process: { env: {}, cwd: () => projectDir },
        require: name => {
            if (name === 'fs') return fs;
            if (name === 'path') return path;
            throw new Error('module not mocked: ' + name);
        },
    };
    sandbox.window = sandbox;
    sandbox.PluginManager = {
        _path: 'js/plugins/',
        _scripts: [],
        _parameters: {},
        _errorUrls: [],
        onError: () => { },
        setParameters(name, parameters) {
            this._parameters[name.toLowerCase()] = parameters;
        },
        parameters(name) {
            return this._parameters[name.toLowerCase()] || {};
        },
        loadScript(name) {
            loadedScripts.push(name);
        },
        setup(plugins) {
            plugins.forEach(function (plugin) {
                if (plugin.status && !this._scripts.includes(plugin.name)) {
                    this.setParameters(plugin.name, plugin.parameters);
                    this.loadScript(plugin.name + '.js');
                    this._scripts.push(plugin.name);
                }
            }, this);
        },
    };
    vm.createContext(sandbox);
    vm.runInContext(SNIPPET, sandbox);

    const GI = sandbox.Game_Interpreter;
    GI.prototype.updateWaitMode = function () { return false; };
    GI.prototype.setWaitMode = function (mode) { this._waitMode = mode; };
    const pluginCalls = [];
    GI.prototype.pluginCommand = function (command, args) {
        pluginCalls.push({ command, args: args.slice() });
    };

    return { sandbox, loadedScripts, scriptTags, pluginCalls };
}

const SEP = '--------------------------------------';
const CANONICAL = ['A', 'WaitAsync', 'B', 'SEP', 'SuperDuperMovement', 'C', 'SDLight', 'Z'];

function writeFixture(dir) {
    // Manifest: only non-module ON plugins, original relative order, with
    // separator rows and a disabled plugin (live-data shape).
    const manifest = [
        { name: 'A', status: true, parameters: { pa: '1' } },
        { name: SEP, status: false, parameters: {} },
        { name: 'B', status: true, parameters: {} },
        { name: 'SuperDuperLight', status: false, parameters: {} },
        { name: 'C', status: true, parameters: {} },
        { name: 'Z', status: true, parameters: {} },
    ];
    const pluginsJs = 'var $plugins = ' + JSON.stringify(manifest) + ';\n';
    // engineModules with DIRTY orderBefore (includes separators + disabled).
    const modules = ['WaitAsync', 'SuperDuperMovement', 'SDLight'].map(name => ({
        name, parameters: name === 'SuperDuperMovement' ? { 'Max Stamina': '100' } : {}, orderBefore: []
    }));
    modules[0].orderBefore = ['A', SEP, 'SuperDuperLight'];
    modules[1].orderBefore = ['A', SEP, 'B', 'SuperDuperLight'];
    modules[2].orderBefore = ['A', SEP, 'B', 'SuperDuperLight', 'C'];
    fs.mkdirSync(path.join(dir, 'js', 'plugins'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), pluginsJs);
    fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: modules }));
    fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
        stamina: { 'Max Stamina': 150, 'Dash Blocking Switches': [18] },
        lighting: { 'Use Real Shadows': true, 'Player radius': 210 }
    }));
    return manifest;
}

test('bridge snippet merges engine modules in canonical order with MV load semantics', () => {
    const dir = tempDir();
    try {
        const manifest = writeFixture(dir);
        const { sandbox, scriptTags } = makeSandbox(dir);
        vm.runInContext(`$plugins = ${JSON.stringify(manifest)};`, sandbox);

        vm.runInContext('PluginManager.setup($plugins);', sandbox);

        // The bridge's catalog loader builds real script tags (MV semantics:
        // setup appends '.js'; separators and disabled entries never load).
        // SuperDuperSpriter, SuperDuperMovement_Addon, SuperDuperCamera,
        // SuperDuperInventory, SuperDuperBattle and SuperDuperEnemies are
        // in the system-module registry but not in this fixture's modules,
        // so they fire once as system loads first (registry order).
        assert.deepEqual(scriptTags.map(t => t.src), [
            'js/plugins/SuperDuperSpriter.js',
            'js/plugins/SuperDuperMovement_Addon.js',
            'js/plugins/SuperDuperCamera.js',
            'js/plugins/SuperDuperInventory.js',
            'js/plugins/SuperDuperBattle.js',
            'js/plugins/SuperDuperEnemies.js',
            'js/plugins/AgoniaAudioRules.js',
            'js/plugins/AgoniaDebugKit.js',
            'js/plugins/A.js', 'js/plugins/WaitAsync.js', 'js/plugins/B.js',
            'js/plugins/SuperDuperMovement.js', 'js/plugins/C.js',
            'js/plugins/SDLight.js', 'js/plugins/Z.js'
        ]);
        // window.$plugins reflects the merged list.
        const names = sandbox.window.$plugins.map(p => p.name);
        assert.deepEqual(names.filter(n => n !== SEP && n !== 'SuperDuperLight'),
            ['A', 'WaitAsync', 'B', 'SuperDuperMovement', 'C', 'SDLight', 'Z']);
    } finally {
        cleanupTemp(dir);
    }
});

test('bridge applies AgoniaEngine.json settings over module parameters (stringified)', () => {
    const dir = tempDir();
    try {
        writeFixture(dir);
        const { sandbox } = makeSandbox(dir);
        const manifest = [];
        vm.runInContext(`$plugins = ${JSON.stringify(manifest)}; PluginManager.setup($plugins);`, sandbox);

        const PM = sandbox.PluginManager;
        assert.strictEqual(PM.parameters('SuperDuperMovement')['Max Stamina'], '150');
        assert.strictEqual(PM.parameters('SuperDuperMovement')['Dash Blocking Switches'], '[18]');
        assert.strictEqual(PM.parameters('SDLight')['Use Real Shadows'], 'true');
        assert.strictEqual(PM.parameters('SDLight')['Player radius'], '210');
    } finally {
        cleanupTemp(dir);
    }
});

test('bridge installs the native 7XX commands and dispatches to pluginCommand', () => {
    const dir = tempDir();
    try {
        writeFixture(dir);
        const { sandbox, pluginCalls } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);

    sandbox.Window_TitleCommand.prototype.processOk = function () { };
    const GI = sandbox.Game_Interpreter;
        const it = Object.create(GI.prototype);
        for (const code of [700, 701, 702, 703, 704, 705, 706, 707, 709, 710,
            711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723,
            724, 725, 726, 727, 729, 730, 731, 732, 733, 734, 735, 736, 737,
            738, 740, 741, 742, 743, 744, 745, 746, 747, 748, 749, 750, 751]) {
            assert.strictEqual(typeof GI.prototype['command' + code], 'function',
                'command' + code + ' installed');
        }

        // MV dispatch semantics: executeCommand assigns this._params and
        // invokes the handler with NO arguments (see MV command356). This
        // is the exact shape the live game uses — args here would hide the
        // "Cannot read properties of undefined (reading 0)" regression.
        const run = (code, params) => {
            it._params = params;
            assert.strictEqual(it['command' + code](), true, 'command' + code + ' returns true');
        };
        run(725, [0, -25]);
        run(725, [1, 0]);
        run(700, [1, 60, 1, 0, '#e97451', '', '']);
        // P33: натив 730 ставит поля интерпретатора напрямую (не через
        // плагин-команду) — контракт WaitAsync-плагина: _waitMode waitAsync
        it._waitAsyncFrames = 0; it._waitMode = '';
        run(730, [15]);
        assert.strictEqual(it._waitAsyncFrames, 15, 'waitAsync frames set directly');
        assert.strictEqual(it._waitMode, 'waitAsync', 'waitAsync mode set directly');
        run(740, [-1, 0, 45, 'Заново...']);
        assert.deepEqual(pluginCalls, [
            { command: 'Stamina', args: ['add', '-25'] },
            { command: 'Stamina', args: ['fill'] },
            { command: 'fire', args: ['radiusgrow', '60', '#e97451'] },
        ]);
        // text pop queued on $gameTemp
        assert.strictEqual(sandbox.$gameTemp._rrTextPopQueue.length, 1);
        assert.strictEqual(sandbox.$gameTemp._rrTextPopQueue[0].text, 'Заново...');

        // slide setters accumulate + show activates the wait
        run(741, ['Заголовок']);
        run(743, ['Kirill', 1]);
        run(745, [300]);
        assert.strictEqual(sandbox.$gameTemp._rrSlideConfig.title, 'Заголовок');
        assert.strictEqual(sandbox.$gameTemp._rrSlideConfig.faceName, 'Kirill');
        assert.strictEqual(sandbox.$gameTemp._rrSlideActive, true);
        assert.strictEqual(it._waitMode, 'agoniaSlide');
        sandbox.$gameTemp._rrSlideActive = true;
        assert.strictEqual(it.updateWaitMode(), true, 'wait blocks while slide active');
        sandbox.$gameTemp._rrSlideActive = false;
        assert.strictEqual(it.updateWaitMode(), false, 'wait releases when done');

        // A command with NO parameters recorded must not throw (adapter
        // resolves this._params || []).
        it._params = undefined;
        assert.strictEqual(it.command733(), true);
        it._params = undefined;
        assert.doesNotThrow(() => it.command734());

        // ---- Wave-2 commands (all under the same no-arg MV contract) ----
        pluginCalls.length = 0;
        run(705, [0, '#aabbcc', 0]);
        run(705, [1, 2.5]);
        run(705, [3, 'spichka']);
        run(706, [1]);
        run(706, [2]);
        run(707, ['']);
        run(709, ['#123456']);
        run(713, [2, -1, 30]);
        run(714, [0, 0, 20]);
        run(714, [1, 2]);
        run(727, [1]);
        run(727, [2, 'VHS']);
        run(729, [0]);
        run(738, [2]);
        run(746, []);
        run(747, ['Слот 1']);
        run(748, []);
        run(749, [12]);
        assert.deepEqual(pluginCalls, [
            { command: 'Light', args: ['color', '#aabbcc'] },
            { command: 'Light', args: ['brightness', '2.5'] },
            { command: 'Light', args: ['preset', 'spichka'] },
            { command: 'Light', args: ['flicker', 'on'] },
            { command: 'fire', args: [] },
            { command: 'Light', args: ['flashlight'] },
            { command: 'Vignette', args: ['color', '#123456'] },
            { command: 'ShiftCamera', args: ['2', '-1', '30'] },
            { command: 'ResetZoom', args: ['20'] },
            { command: 'SetDefaultZoom', args: ['2'] },
            { command: 'SUPERDUPER', args: ['ON'] },
            { command: 'SUPERDUPER', args: ['PRESET', 'VHS'] },
            { command: 'hide_treasure_popup', args: [] },
            { command: 'DISABLENEXTTEXTFF', args: [] },
            { command: 'SDI_ClearRoundItems', args: [] },
            { command: 'SetSaveName', args: ['Слот 1'] },
            { command: 'ResetAllEventLocations', args: [] },
            { command: 'MEHP_SETUP', args: ['12'] },
        ]);

        // 701 player target -> bare Light on/off
        pluginCalls.length = 0;
        run(701, [1, 0, 1]);
        run(701, [0, 5, 0]);
        assert.deepEqual(pluginCalls, [
            { command: 'Light', args: ['on'] },
            { command: 'Light', args: ['off', '5'] },
        ]);

        // 735 show/hide/clear + icon form
        pluginCalls.length = 0;
        run(735, [0, 'df', 'Текст', '']);
        run(735, [0, 'df', 'Текст', 24]);
        run(735, [1]);
        run(735, [2]);
        assert.deepEqual(pluginCalls, [
            { command: 'Hint', args: ['show_preset', 'df', 'Текст'] },
            { command: 'Hint', args: ['show_preset_icon', 'df', '24', 'Текст'] },
            { command: 'Hint', args: ['hide'] },
            { command: 'Hint', args: ['clear'] },
        ]);

        // 750 hide choice: unconditional and switch-gated
        sandbox.$gameMessage = { _choices: ['Да', 'Нет', 'Может'] };
        sandbox.$gameSwitches = { value: id => id === 9 };
        run(750, [2, 0]); // always hide #2
        assert.deepEqual(sandbox.$gameMessage._choices, ['Да', 'Может']);
        run(750, [1, 9]); // switch 9 is ON -> hides
        assert.deepEqual(sandbox.$gameMessage._choices, ['Может']);
        run(750, [1, 5]); // switch 5 is OFF -> keeps
        assert.deepEqual(sandbox.$gameMessage._choices, ['Может']);

        // 751 gift through window.gift
        const gifts = [];
        sandbox.window.gift = (name, id) => gifts.push({ name, id });
        run(751, ['Настя', 19]);
        assert.deepEqual(gifts, [{ name: 'Настя', id: 19 }]);
    } finally {
        cleanupTemp(dir);
    }
});

test('chest helpers operate on the SuperDuperInventory storage format', () => {
    const dir = tempDir();
    try {
        writeFixture(dir);
        const { sandbox } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);

        const slots = { 'комод': new Array(15).fill(null) };
        sandbox.$dataItems = [null, { id: 1, name: 'Бинт', itypeId: 1 }, { id: 2, name: 'Спичка', itypeId: 1 }];
        sandbox.$dataWeapons = [null, { id: 1, name: 'Нож' }];
        sandbox.$dataArmors = [null, { id: 1, name: 'Куртка' }];
        sandbox.$gameSystem = {
            getChestItems: id => slots[id],
            addItemToChest(id, item, amount) {
                const chest = slots[id];
                for (let i = 0; i < chest.length; i++) {
                    if (chest[i] === null) { chest[i] = { item, amount }; return true; }
                }
                return false;
            }
        };
        const switchValues = {};
        sandbox.$gameSwitches = { setValue: (id, v) => { switchValues[id] = v; }, value: id => switchValues[id] };
        const varValues = {};
        sandbox.$gameVariables = { setValue: (id, v) => { varValues[id] = v; }, value: id => varValues[id] };
        const gained = [];
        sandbox.$gameParty = { gainItem: (item, n) => gained.push({ item, n }) };

        const it = Object.create(sandbox.Game_Interpreter.prototype);
        const run = (code, params) => { it._params = params; it['command' + code](); };
        run(716, ['комод', 0, 1, 3, 0]);
        assert.strictEqual(slots['комод'][0].amount, 3);
        run(719, ['комод', 7, 3, 0, 1]);
        assert.strictEqual(varValues[7], 3);
        run(719, ['комод', 7, 3, 1, 1]);
        assert.strictEqual(varValues[7], 0, 'weapon id 1 is not item id 1');
        run(717, ['комод', 0, 1, 1, 1]);
        assert.strictEqual(slots['комод'][0].amount, 2);
        assert.strictEqual(gained.length, 1, 'moved to party');
        run(718, ['комод']);
        assert.ok(slots['комод'].every(s => s === null));
    } finally {
        cleanupTemp(dir);
    }
});

test('input hardening swallows gamepad drift spikes but honors held presses', () => {
    const dir = tempDir();
    try {
        writeFixture(dir);
        const { sandbox } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);
        assert.ok(sandbox.window.__rrInputHardened, 'hardening installed');

        const Input = sandbox.Input;
        const pad = pressed => ({ index: 0, axes: [0, 0],
            buttons: pressed.map(p => ({ pressed: p, value: p ? 1 : 0 })) });

        // Poll 1 (bootstrap, released): establishes the raw baseline.
        Input._updateGamepadState(pad([false]));
        assert.ok(!Input._currentState.ok);

        // Single-frame spike: pressed this poll only -> must be swallowed.
        Input._updateGamepadState(pad([true]));
        assert.ok(!Input._currentState.ok, 'drift spike suppressed');

        // Released again -> still nothing.
        Input._updateGamepadState(pad([false]));
        assert.ok(!Input._currentState.ok);

        // A real press: held across two polls -> honored on the second.
        Input._updateGamepadState(pad([true]));   // deferred (first stable frame)
        assert.ok(!Input._currentState.ok);
        Input._updateGamepadState(pad([true]));   // second frame -> press lands
        assert.strictEqual(Input._currentState.ok, true);

        // Release passes through immediately.
        Input._updateGamepadState(pad([false]));
        assert.strictEqual(Input._currentState.ok, false);
    } finally {
        cleanupTemp(dir);
    }
});

test('input hardening blocks synthetic (untrusted) DOM events at capture', () => {
    const dir = tempDir();
    try {
        writeFixture(dir);
        const { sandbox } = makeSandbox(dir);
        vm.runInContext('$plugins = []; PluginManager.setup($plugins);', sandbox);

        let stopped = false;
        const ev = { isTrusted: false,
            stopPropagation() { stopped = true; },
            preventDefault() { } };
        const keydown = sandbox._rrListeners.keydown || [];
        assert.ok(keydown.length > 0, 'keydown capture listeners exist');
        keydown.forEach(fn => fn(ev));
        assert.ok(stopped, 'synthetic event stopped before game handlers');

        // A trusted event flows through untouched.
        let stoppedTrusted = false;
        const trusted = { isTrusted: true,
            stopPropagation() { stoppedTrusted = true; },
            preventDefault() { } };
        keydown.forEach(fn => fn(trusted));
        assert.ok(!stoppedTrusted, 'trusted event untouched');
    } finally {
        cleanupTemp(dir);
    }
});

test('restoreMvRuntime extracts the archive, cleans reactor leftovers and re-patches the bridge', () => {
    const dir = tempDir();
    try {
        // Build a synthetic "project" that currently runs the Agonia runtime.
        const jsPath = path.join(dir, 'js');
        const libsPath = path.join(jsPath, 'libs');
        fs.mkdirSync(libsPath, { recursive: true });
        fs.writeFileSync(path.join(jsPath, 'reactor_main.js'), '// agonia');
        fs.writeFileSync(path.join(jsPath, 'reactor_managers.js'), '// agonia');
        fs.writeFileSync(path.join(libsPath, 'pako.min.js'), '// agonia');
        fs.writeFileSync(path.join(libsPath, 'pixi_compat.js'), '// agonia');
        fs.writeFileSync(path.join(libsPath, 'pixi.js'), '// PIXI v8 (stale)');

        // Archive of the MV corescript, including a managers file carrying
        // the v1 catalog-only snippet (what the live backup contains).
        const v1Block = [
            '// >>> RPGReactor: engine plugin catalog loader (do not remove this block) <<<',
            '(function() { /* v1 catalog loader */ })();',
            '// <<< RPGReactor: engine plugin catalog loader >>>',
            ''
        ].join('\n');
        const mvManagers = '// MV rpg_managers.js\n' + v1Block;
        const manager = new ProjectManager();
        manager.fs = fs;
        manager.path = path;
        const zipPath = path.join(dir, 'mv-backup.zip');
        manager.writeZipArchive(zipPath, [
            { name: 'js/main.js', data: Buffer.from('// mv main') },
            { name: 'js/rpg_core.js', data: Buffer.from('// mv core') },
            { name: 'js/rpg_managers.js', data: Buffer.from(mvManagers) },
            { name: 'js/libs/pixi.js', data: Buffer.from('// PIXI v4') },
            { name: 'index.html', data: Buffer.from('<script src="js/rpg_core.js"></script>') },
        ]);

        const report = restoreMvRuntime({ fs, path, projectPath: dir, zipPath, snippet: SNIPPET });
        assert.strictEqual(report.ok, true, report.error);

        // MV corescript restored, Agonia leftovers removed.
        assert.ok(fs.existsSync(path.join(jsPath, 'rpg_core.js')));
        assert.ok(fs.existsSync(path.join(jsPath, 'main.js')));
        assert.strictEqual(fs.readFileSync(path.join(libsPath, 'pixi.js'), 'utf8'), '// PIXI v4');
        assert.ok(!fs.existsSync(path.join(jsPath, 'reactor_main.js')));
        assert.ok(!fs.existsSync(path.join(jsPath, 'reactor_managers.js')));
        assert.ok(!fs.existsSync(path.join(libsPath, 'pako.min.js')));
        assert.ok(!fs.existsSync(path.join(libsPath, 'pixi_compat.js')));
        assert.ok(/rpg_core\.js/.test(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')));

        // Managers: v1 stripped, v2 present exactly once, MV code intact.
        const patched = fs.readFileSync(path.join(jsPath, 'rpg_managers.js'), 'utf8');
        assert.ok(patched.startsWith('// MV rpg_managers.js'));
        assert.ok(!patched.includes('/* v1 catalog loader */'));
        assert.strictEqual(patched.split('// >>> RPGReactor: engine plugin catalog loader').length - 1, 1);
        assert.ok(patched.includes('__rpgReactorCatalogV2'));
        assert.ok(patched.includes('__RRMVBridge'));

        // Idempotent: a second run extracts the same archive cleanly.
        const again = restoreMvRuntime({ fs, path, projectPath: dir, zipPath, snippet: SNIPPET });
        assert.strictEqual(again.ok, true, again.error);
        const repatched = fs.readFileSync(path.join(jsPath, 'rpg_managers.js'), 'utf8');
        assert.strictEqual(repatched.split('// >>> RPGReactor: engine plugin catalog loader').length - 1, 1);
    } finally {
        cleanupTemp(dir);
    }
});
