const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_objects.js');
const PluginCommandMigration = require('../src/PluginCommandMigration.js');

function loadChunk(startMarker, endMarker) {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf(startMarker);
    assert.ok(start > 0, `${startMarker} not found`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `${endMarker} not found after ${startMarker}`);
    const tail = source.indexOf('};', end);
    return source.slice(start, tail + 2);
}

const CHUNK = loadChunk('Game_Interpreter.prototype.command710', 'Game_Interpreter.prototype.command724');

function makeRuntime(overrides = {}) {
    const rt = { calls: [], waitModes: [] };
    rt.context = {
        console: { warn: () => { }, log: () => { } },
        $gameMap: {
            events: () => [
                { eventId: () => 3 },
                { eventId: () => 7 }
            ]
        },
        ...overrides
    };
    rt.context.Game_Interpreter = function () { };
    rt.context.Game_Interpreter.prototype = {
        pluginCommand(command, args) { rt.calls.push({ command, args: args.slice() }); },
        setWaitMode(mode) { rt.waitModes.push(mode); }
    };
    vm.createContext(rt.context);
    vm.runInContext(CHUNK, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('command710 wraps ZoomIn and optionally waits for the camera', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command710([2, 0, 0]);
    it.command710([2.5, 20, 1]);
    assert.deepEqual(rt.calls, [
        { command: 'ZoomIn', args: ['2', '0'] },
        { command: 'ZoomIn', args: ['2.5', '20'] }
    ]);
    assert.deepEqual(rt.waitModes, ['camera']);
});

test('command711 covers player, event and coordinate focus', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command711([0, 0, 0, 0, 20, 0]);
    it.command711([1, 94, 0, 0, 1, 0]);
    it.command711([2, 0, 14, 9, 1, 1]);
    assert.deepEqual(rt.calls, [
        { command: 'FocusCamera', args: ['player', '20'] },
        { command: 'FocusCamera', args: ['event', '94', '1'] },
        { command: 'FocusCamera', args: ['14', '9', '1'] }
    ]);
    assert.deepEqual(rt.waitModes, ['camera']);
});

test('command712 wraps ResetFocus', () => {
    const rt = makeRuntime();
    rt.interpreter().command712([1]);
    assert.deepEqual(rt.calls, [{ command: 'ResetFocus', args: ['1'] }]);
});

test('command721 dispatches phases through SDE SET_FLAG and RESET_ALL', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command721(['combat', 1]);
    it.command721(['loch', 0]);
    it.command721(['__reset_all', 1]);
    assert.deepEqual(rt.calls, [
        { command: 'SDE', args: ['SET_FLAG', 'SELF', 'combat', 'ON'] },
        { command: 'SDE', args: ['SET_FLAG', 'SELF', 'loch', 'OFF'] },
        { command: 'SDE', args: ['RESET_ALL', 'SELF'] }
    ]);
});

test('command722 dispatches MEHP add/set/get', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command722([0, -20, 0]);
    it.command722([1, 50, 0]);
    it.command722([2, 0, 7]);
    assert.deepEqual(rt.calls, [
        { command: 'MEHP_ADD', args: ['-20'] },
        { command: 'MEHP_SET', args: ['50'] },
        { command: 'MEHP_GET', args: ['7'] }
    ]);
});

test('command723 sets the phase on every map event', () => {
    const rt = makeRuntime();
    rt.interpreter().command723(['shot', 1]);
    assert.deepEqual(rt.calls, [
        { command: 'SDE', args: ['SET_FLAG', '3', 'shot', 'ON'] },
        { command: 'SDE', args: ['SET_FLAG', '7', 'shot', 'ON'] }
    ]);
});

test('command724 wraps SDL FillChest including the this-event form', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command724(['абоба', 'тех', 3, 10, 10, 2]);
    it.command724(['', 'кнцл', 2, 2, 5, '']);
    assert.deepEqual(rt.calls, [
        { command: 'SDL', args: ['FillChest', 'абоба', 'тех', '3-10', '10', '2'] },
        { command: 'SDL', args: ['FillChest', 'this', 'кнцл', '2', '5'] }
    ]);
});

test('camera corpus strings convert with the [N] bracket convention stripped', () => {
    const cases = [
        ['ZoomIn 2', 710, [2, 0, 0]],
        ['ZoomIn 2.2', 710, [2.2, 0, 0]],
        ['ZoomIn 0.5', 710, [0.5, 0, 0]],
        ['ZoomOut 2', 710, [0.5, 0, 0]],
        ['FocusCamera player [20]', 711, [0, 0, 0, 0, 20, 0]],
        ['FocusCamera player [1]', 711, [0, 0, 0, 0, 1, 0]],
        ['FocusCamera event [94] [1]', 711, [1, 94, 0, 0, 1, 0]],
        ['FocusCamera [14] [9] [1]', 711, [2, 0, 14, 9, 1, 0]],
        ['FocusCamera [44] [19] [20]', 711, [2, 0, 44, 19, 20, 0]],
        ['ResetFocus [1]', 712, [1]],
    ];
    for (const [text, code, parameters] of cases) {
        const parsed = PluginCommandMigration.parseLegacyCommand(text);
        assert.ok(parsed, `parses: ${text}`);
        assert.strictEqual(parsed.plugin, 'SuperDuperCamera', `plugin for: ${text}`);
        assert.strictEqual(parsed.code, code, `code for: ${text}`);
        assert.deepEqual(parsed.parameters, parameters, `params for: ${text}`);
    }
});

test('MEHP corpus strings convert, including the broken SELF forms', () => {
    const cases = [
        ['MEHP_ADD SELF -20', 722, [0, -20, 0]],
        ['MEHP_ADD -100', 722, [0, -100, 0]],
        ['MEHP_COMBAT_START SELF', 721, ['combat', 1]],
        ['MEHP_COMBAT_END SELF', 721, ['combat', 0]],
        ['MEHP_PANIC_START SELF', 721, ['panic', 1]],
        ['MEHP_FLEE_START SELF', 721, ['flee', 1]],
        ['MEHP_LOCH_END SELF', 721, ['loch', 0]],
        ['MEHP_SHOT_END SELF', 721, ['shot', 0]],
        ['MEHP_WOUND_START SELF', 721, ['wound', 1]],
        ['MEHP_CALM_RESET SELF', 721, ['__reset_all', 1]],
        ['MEHP_SHOT_ALL_START', 723, ['shot', 1]],
        ['MEHP_LOCH_ALL_START', 723, ['loch', 1]],
    ];
    for (const [text, code, parameters] of cases) {
        const parsed = PluginCommandMigration.parseLegacyCommand(text);
        assert.ok(parsed, `parses: ${text}`);
        assert.strictEqual(parsed.plugin, 'SuperDuperEnemies', `plugin for: ${text}`);
        assert.strictEqual(parsed.code, code, `code for: ${text}`);
        assert.deepEqual(parsed.parameters, parameters, `params for: ${text}`);
    }
});

test('SDL FillChest corpus string converts', () => {
    const parsed = PluginCommandMigration.parseLegacyCommand('SDL FillChest абоба тех 3-10 10 2');
    assert.ok(parsed);
    assert.strictEqual(parsed.plugin, 'SuperDuperLoot');
    assert.strictEqual(parsed.code, 724);
    assert.deepEqual(parsed.parameters, ['абоба', 'тех', 3, 10, 10, 2]);
});
