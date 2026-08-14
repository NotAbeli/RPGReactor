const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_objects.js');

function loadChunk(startMarker, endMarker) {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf(startMarker);
    assert.ok(start > 0, `${startMarker} not found`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `${endMarker} not found after ${startMarker}`);
    const tail = source.indexOf('};', end);
    return source.slice(start, tail + 2);
}

// command715..737 span one contiguous block ending with _agoniaSlotItemType.
const CHEST_CHUNK = loadChunk('Game_Interpreter.prototype.command715', 'Game_Interpreter.prototype._agoniaSlotItemType');
// _agoniaSlotItemType..command737 include the misc-pack handlers.
const MISC_CHUNK = loadChunk('Game_Interpreter.prototype._agoniaSlotItemType', 'Game_Interpreter.prototype.command737');

function makeRuntime(chunk, overrides = {}) {
    const calls = [];
    const rt = {
        calls,
        windowMarks: [],
        warnings: [],
        context: {
            console: { warn: msg => rt.warnings.push(msg), log: () => { } },
            window: {},
            $gamePlayer: { _stamina: 50 },
            Game_Interpreter: function () { },
            ...overrides
        }
    };
    rt.context.Game_Interpreter.prototype = {
        pluginCommand(command, args) { calls.push({ command, args }); }
    };
    if (!('window' in overrides)) rt.context.window = { mark: id => rt.windowMarks.push(id) };
    vm.createContext(rt.context);
    vm.runInContext(chunk, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('command725 stamina delegates add/fill/exhaust with the right subcommand', () => {
    const rt = makeRuntime(MISC_CHUNK);
    const it = rt.interpreter();
    it.command725([0, -25]);
    it.command725([1, 0]);
    it.command725([2, 0]);
    assert.deepEqual(rt.calls, [
        { command: 'Stamina', args: ['add', '-25'] },
        { command: 'Stamina', args: ['fill'] },
        { command: 'Stamina', args: ['exhaust'] }
    ]);
});

test('command726 dash covers this event, player and event-by-id forms', () => {
    const rt = makeRuntime(MISC_CHUNK);
    const it = rt.interpreter();
    it.command726([0, 0, 'Рывок']);
    it.command726([1, 0, 'Рывок']);
    it.command726([2, 7, 'УдарЛома']);
    assert.deepEqual(rt.calls, [
        { command: 'AltimitDash', args: ['dash', 'Рывок'] },
        { command: 'AltimitDash', args: ['playerDash', 'Рывок'] },
        { command: 'AltimitDash', args: ['eventDash', '7', 'УдарЛома'] }
    ]);
});

test('command730 wait async passes the frame count as a string', () => {
    const rt = makeRuntime(MISC_CHUNK);
    rt.interpreter().command730([15]);
    assert.deepEqual(rt.calls, [{ command: 'WaitAsync', args: ['15'] }]);
});

test('command731 damage flash covers all target forms', () => {
    const rt = makeRuntime(MISC_CHUNK);
    const it = rt.interpreter();
    it.command731([0, 0, 0]);
    it.command731([0, 0, 10]);
    it.command731([1, 0, 0]);
    it.command731([2, 5, 0]);
    assert.deepEqual(rt.calls, [
        { command: 'SDDF', args: ['FLASH'] },
        { command: 'SDDF', args: ['FLASH', '10'] },
        { command: 'SDDF', args: ['FLASH', 'PLAYER'] },
        { command: 'SDDF', args: ['FLASH', 'EVENT', '5'] }
    ]);
});

test('command732/733/734 delegate to samsara and craft', () => {
    const rt = makeRuntime(MISC_CHUNK);
    const it = rt.interpreter();
    it.command732();
    it.command733();
    it.command734();
    assert.deepEqual(rt.calls, [
        { command: 'SaveToSamsara', args: [] },
        { command: 'LoadFromSamsara', args: [] },
        { command: 'CraftSystem', args: ['open'] }
    ]);
});

test('command735/737 build hint and title argument lines', () => {
    const rt = makeRuntime(MISC_CHUNK);
    const it = rt.interpreter();
    it.command735(['df', 'Знакомьтесь - ваш инввентарь']);
    it.command737(['TL', 'НОВАЯ ЖИЗНЬ']);
    assert.deepEqual(rt.calls, [
        { command: 'Hint', args: ['show_preset', 'df', 'Знакомьтесь - ваш инввентарь'] },
        { command: 'Title', args: ['show', 'TL', 'НОВАЯ ЖИЗНЬ'] }
    ]);
});

test('command736 text mark calls window.mark and warns without the module', () => {
    const rt = makeRuntime(MISC_CHUNK);
    rt.interpreter().command736(['ДрлН']);
    assert.deepEqual(rt.windowMarks, ['ДрлН']);

    const bare = makeRuntime(MISC_CHUNK, { window: {} });
    bare.interpreter().command736(['н1']);
    assert.strictEqual(bare.windowMarks.length, 0);
    assert.ok(bare.warnings.some(w => String(w).includes('Text Mark')));
});

test('command725 warns when the movement module is unavailable', () => {
    const rt = makeRuntime(MISC_CHUNK, { $gamePlayer: {} });
    rt.interpreter().command725([0, 10]);
    assert.strictEqual(rt.calls.length, 0);
    assert.ok(rt.warnings.some(w => String(w).includes('Stamina')));
});
