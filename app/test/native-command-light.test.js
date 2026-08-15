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

const LIGHT_CHUNK = loadChunk('Game_Interpreter.prototype.command700', 'Game_Interpreter.prototype.command720');

function makeLightRuntime() {
    const rt = { calls: [] };
    rt.context = {
        console: { warn: () => { }, log: () => { } },
        Game_Interpreter: function () { },
    };
    rt.context.Game_Interpreter.prototype = {
        pluginCommand(command, args) { rt.calls.push({ command, args: args.slice() }); }
    };
    vm.createContext(rt.context);
    vm.runInContext(LIGHT_CHUNK, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('command700 reproduces legacy light/fire argument sequences', () => {
    const rt = makeLightRuntime();
    const it = rt.interpreter();
    // light radius 0 #C04000
    it.command700([0, 0, 0, 0, '#C04000', '', '']);
    // fire radiusgrow 60 #e97451 (no t -> plugin default 60 ticks)
    it.command700([1, 60, 1, 0, '#e97451', '', '']);
    // fire radius 0 #e97451 spichka t2
    it.command700([1, 0, 0, 2, '#e97451', 'spichka', '']);
    // fire radius 0 #FF7F2E lamp t7 with mult=1 (corpus migration shape):
    // SDLight re-parses a numeric token after the preset as a numeric PRESET
    // id ('1' exists in its fallback table), overwriting the named preset.
    // A mult of 1 is the vignette default, so it must NOT be emitted.
    it.command700([1, 0, 0, 7, '#FF7F2E', 'lamp', 1]);
    // A non-default mult (0.5) IS emitted after the preset.
    it.command700([1, 0, 0, 0, '#C04000', 'lamp', 0.5]);
    assert.deepEqual(rt.calls, [
        { command: 'light', args: ['radius', '0', '#C04000'] },
        { command: 'fire', args: ['radiusgrow', '60', '#e97451'] },
        { command: 'fire', args: ['radius', '0', 't2', '#e97451', 'spichka'] },
        { command: 'fire', args: ['radius', '0', 't7', '#FF7F2E', 'lamp'] },
        { command: 'fire', args: ['radius', '0', '#C04000', 'lamp', '0.5'] }
    ]);
});

test('command701-704 wrap event light, region block, tint and local switch', () => {
    const rt = makeLightRuntime();
    const it = rt.interpreter();
    it.command701([1, 4]);
    it.command701([0, 5]);
    it.command702([8, 1, '#555555']);
    it.command702([7, 0, '#000000']);
    it.command703([0, '#111111', 60]);
    it.command703([1, '#222222', 30]);
    it.command704([1, 1, 0]);
    it.command704([2, 0, 104]);
    it.command704([3, 2, 0]);
    assert.deepEqual(rt.calls, [
        { command: 'Light', args: ['on', '4'] },
        { command: 'Light', args: ['off', '5'] },
        { command: 'RegionBlock', args: ['8', 'ON', '#555555'] },
        { command: 'RegionBlock', args: ['7', 'OFF'] },
        { command: 'Tint', args: ['set', '#111111'] },
        { command: 'Tint', args: ['fade', '#222222', '30'] },
        { command: 'LocalSwitch', args: ['1', 'on'] },
        { command: 'LocalSwitch', args: ['2', 'off', '104'] },
        { command: 'LocalSwitch', args: ['3', 'toggle'] }
    ]);
});

test('command720 wraps SDL Give with fixed and ranged amounts', () => {
    const rt = makeLightRuntime();
    const it = rt.interpreter();
    it.command720(['тех', 1, 3]);
    it.command720(['еда', 2, 2]);
    it.command720(['', 1, 1]);
    assert.deepEqual(rt.calls, [
        { command: 'SDL', args: ['Give', 'тех', '1-3'] },
        { command: 'SDL', args: ['Give', 'еда', '2'] }
    ]);
});

test('SDLight corpus strings convert to native parameters', () => {
    const cases = [
        ['light radius 0 #C04000', 700, [0, 0, 0, 0, '#C04000', '', '']],
        ['fire radius 0 #e97451', 700, [1, 0, 0, 0, '#e97451', '', '']],
        ['fire radiusgrow 60 #e97451', 700, [1, 60, 1, 0, '#e97451', '', '']],
        ['fire radiusgrow 10 #e97451', 700, [1, 10, 1, 0, '#e97451', '', '']],
        ['fire radius 120 #FF7F2E', 700, [1, 120, 0, 0, '#FF7F2E', '', '']],
        ['fire radius 0 #e97451 spichka t2', 700, [1, 0, 0, 2, '#e97451', 'spichka', '']],
        ['fire radius 0 #FF7F2E 1 lamp t7', 700, [1, 0, 0, 7, '#FF7F2E', 'lamp', 1]],
        ['RegionBlock 8 ON #555555', 702, [8, 1, '#555555']],
        ['RegionBlock 7 OFF', 702, [7, 0, '#000000']],
        ['tint set #111111', 703, [0, '#111111', 60]],
        ['Light on 4', 701, [1, 4]],
        ['Light off 7', 701, [0, 7]],
        ['SDL Give тех 1-3', 720, ['тех', 1, 3]],
        ['SDL Give кнцл 1-3', 720, ['кнцл', 1, 3]],
        ['LocalSwitch 1 on map 104', 704, [1, 1, 104]],
        ['LocalSwitch 2 toggle', 704, [2, 2, 0]],
    ];
    for (const [text, code, parameters] of cases) {
        const parsed = PluginCommandMigration.parseLegacyCommand(text);
        assert.ok(parsed, `parses: ${text}`);
        assert.strictEqual(parsed.code, code, `code for: ${text}`);
        assert.deepEqual(parsed.parameters, parameters, `params for: ${text}`);
    }
});

test('Light switch reset is marked for removal', () => {
    const parsed = PluginCommandMigration.parseLegacyCommand('Light switch reset');
    assert.ok(parsed && parsed.remove, 'flagged as remove');
    const command = { code: 356, indent: 0, parameters: ['Light switch reset'] };
    assert.strictEqual(PluginCommandMigration.convertCommand(command), 'remove');
});

test('convertDataContainer removes dead commands from lists', () => {
    const container = {
        events: [{
            pages: [{
                list: [
                    { code: 356, indent: 0, parameters: ['Light switch reset'] },
                    { code: 356, indent: 0, parameters: ['fire radius 42 #e97451'] },
                    { code: 356, indent: 0, parameters: ['Light switch reset'] },
                    { code: 0, indent: 0, parameters: [] }
                ]
            }]
        }]
    };
    const { converted, removed } = PluginCommandMigration.convertDataContainer(container);
    assert.strictEqual(converted, 1);
    assert.strictEqual(removed, 2);
    const list = container.events[0].pages[0].list;
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].code, 700);
    assert.strictEqual(list[1].code, 0);
});

test('SDLight and SuperDuperLoot belong to the migration families', () => {
    assert.ok(PluginCommandMigration.FAMILIES.includes('SDLight'));
    assert.ok(PluginCommandMigration.FAMILIES.includes('SuperDuperLoot'));
});
