const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_objects.js');

function loadCommand715() {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf('Game_Interpreter.prototype.command715');
    assert.ok(start > 0, 'command715 not found in runtime');
    const end = source.indexOf('};', start);
    assert.ok(end > start, 'command715 block end not found');
    return source.slice(start, end + 2);
}

const CHUNK = loadCommand715();

function makeProto() {
    const calls = [];
    const proto = {
        pluginCommand(command, args) { calls.push({ command, args }); }
    };
    return { proto, calls };
}

function runChunk(proto) {
    const context = { Game_Interpreter: function () { } };
    context.Game_Interpreter.prototype = proto;
    vm.createContext(context);
    vm.runInContext(CHUNK, context);
}

test('command715 delegates to pluginCommand with the chest id', () => {
    const { proto, calls } = makeProto();
    runChunk(proto);

    const interpreter = Object.create(proto);
    assert.strictEqual(interpreter.command715(['комод']), true);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].command, 'VisualChestStored');
    assert.deepEqual(calls[0].args, ['комод']);
});

test('command715 passes no args for the auto-id form', () => {
    const { proto, calls } = makeProto();
    runChunk(proto);

    const interpreter = Object.create(proto);
    assert.strictEqual(interpreter.command715(['']), true);
    assert.strictEqual(interpreter.command715([]), true);
    assert.strictEqual(calls.length, 2);
    assert.deepEqual(calls[0].args, []);
    assert.deepEqual(calls[1].args, []);
});
