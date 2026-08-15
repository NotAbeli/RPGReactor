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

const CHUNK = loadChunk('Game_Interpreter.prototype.command728', 'Game_Interpreter.prototype.command730');

function makeRuntime(overrides = {}) {
    const calls = [];
    const audioCalls = [];
    const rt = {
        calls, audioCalls,
        context: {
            console: { warn: () => { }, log: () => { } },
            window: {},
            AudioManager: {
                playBgs(bgs, pos) { audioCalls.push({ fn: 'playBgs', bgs, pos }); },
                playSe(se, aex) { audioCalls.push({ fn: 'playSe', se, aex }); }
            },
            Game_Interpreter: function () { },
            ...overrides
        }
    };
    rt.context.Game_Interpreter.prototype = {
        pluginCommand(command, args) { calls.push({ command, args }); }
    };
    vm.createContext(rt.context);
    vm.runInContext(CHUNK, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('command728 play BGS source builds the OcRam AEX object from params', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it._eventId = 5;
    it.command728([0, 0, 0, 'generator_hum', '', 80, 105, 15, 2, 3, 0, 1, 0]);
    assert.strictEqual(rt.audioCalls.length, 1);
    const { fn, bgs } = rt.audioCalls[0];
    assert.strictEqual(fn, 'playBgs');
    assert.strictEqual(bgs.name, 'generator_hum');
    assert.strictEqual(bgs.volume, 80);
    assert.strictEqual(bgs.pitch, 105);
    const aex = bgs.AEX;
    assert.strictEqual(aex.type, 'd');
    assert.strictEqual(aex.distance, 15);
    assert.strictEqual(aex.radius, 2);
    assert.strictEqual(aex.fade, 3);
    assert.strictEqual(aex.pan, true);
    assert.strictEqual(aex.forced, true);
    assert.strictEqual(aex['new'], false);
    assert.ok(aex.dynamic);
    assert.strictEqual(aex.eventId, 5);
    assert.deepEqual(aex.linkedEvents, [5]);
});

test('command728 play SE uses the se file slot and forces a new buffer', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command728([1, 1, 7, '', 'distant_gunshot', 60, 100, 30, 1, 0, 1, 1, 0]);
    const { fn, se, aex } = rt.audioCalls[0];
    assert.strictEqual(fn, 'playSe');
    assert.strictEqual(se.name, 'distant_gunshot');
    assert.strictEqual(se.volume, 60);
    assert.strictEqual(aex.type, 'x');
    assert.strictEqual(aex.distance, 30);
    assert.strictEqual(aex.eventId, 7);
    assert.strictEqual(aex['new'], true);
    // x-type keeps autopan, unlike the y type in the plugin parser.
    assert.strictEqual(aex.pan, true);
});

test('command728 bg type mirrors the plugin: everywhere, unpositioned', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it._eventId = 3;
    it.command728([0, 0, 0, 'storm', '', 90, 100, 25, 4, 2, 3, 1, 1]);
    const aex = rt.audioCalls[0].bgs.AEX;
    assert.strictEqual(aex.type, 'bg');
    assert.strictEqual(aex.dynamic, false);
    assert.strictEqual(aex.pan, false);
    assert.strictEqual(aex.distance, 0);
    assert.strictEqual(aex.radius, 0);
});

test('command728 stop delegates to clear_aex with the resolved event', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it._eventId = 9;
    it.command728([2, 0, 0]);
    it.command728([2, 1, 12, '', '', 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(rt.calls, [
        { command: 'clear_aex', args: ['9'] },
        { command: 'clear_aex', args: ['12'] }
    ]);
    assert.strictEqual(rt.audioCalls.length, 0);
});

test('command728 without an anchor plays map-wide instead of a silent source', () => {
    const rt = makeRuntime();
    const it = rt.interpreter(); // no _eventId: common event context
    it.command728([0, 0, 0, 'rain', '', 70, 100, 20, 0, 2, 0, 1, 1]);
    assert.strictEqual(rt.audioCalls.length, 1);
    const { fn, bgs } = rt.audioCalls[0];
    assert.strictEqual(fn, 'playBgs');
    assert.strictEqual(bgs.AEX, undefined, 'plain playback, no AEX');
    assert.strictEqual(bgs.name, 'rain');
});

test('command728 clamps volume/pitch and skips empty names', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it._eventId = 1;
    it.command728([0, 0, 0, '', '', 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.strictEqual(rt.audioCalls.length, 0, 'empty name is a no-op');
    it.command728([0, 0, 0, 'hum', '', 500, 5, 0, 0, 0, 0, 0, 0]);
    const { bgs } = rt.audioCalls[0];
    assert.strictEqual(bgs.volume, 100);
    assert.strictEqual(bgs.pitch, 50);
});

test('command728 no AudioManager in scope is a safe no-op', () => {
    const rt = makeRuntime({ AudioManager: undefined });
    const it = rt.interpreter();
    it._eventId = 2;
    it.command728([0, 0, 0, 'hum', '', 90, 100, 20, 0, 2, 0, 1, 1]);
    assert.strictEqual(rt.audioCalls.length, 0);
});
