const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const AudioCommandEditor = require('../src/event/commands/AudioCommandEditor.js');

test('channel routes: Play BGM/BGS/Fadeout BGS are routable, ME/SE are not', () => {
    const r241 = AudioCommandEditor.CHANNEL_ROUTES[241];
    const r245 = AudioCommandEditor.CHANNEL_ROUTES[245];
    const r246 = AudioCommandEditor.CHANNEL_ROUTES[246];
    assert.deepStrictEqual(r241.map(r => r.key), ['bgm', 'bgs2', 'bgs3']);
    assert.deepStrictEqual(r245.map(r => r.key), ['bgs', 'bgs2', 'bgs3']);
    assert.deepStrictEqual(r246.map(r => r.key), ['bgs', 'bgs2', 'bgs3']);
    // BGS2/3 read files from the bgs folder (OcRam plays them there).
    assert.strictEqual(AudioCommandEditor.channelRoute(241, 'bgs2').folder, 'bgs');
    assert.strictEqual(AudioCommandEditor.channelRoute(241, 'bgm').folder, 'bgm');
    assert.strictEqual(AudioCommandEditor.channelRoute(245, 'bgs').nativeCode, 245);
    assert.ok(!AudioCommandEditor.CHANNEL_ROUTES[249]);
    assert.ok(!AudioCommandEditor.CHANNEL_ROUTES[250]);
});

test('parse 356 play_bgs2/3 into the channel editor form', () => {
    const parsed = AudioCommandEditor.parseAudioCommand({
        code: 356, indent: 1, parameters: ['play_bgs2 rain 80 95 -20']
    });
    assert.strictEqual(parsed.uiCode, 245);
    assert.strictEqual(parsed.channelKey, 'bgs2');
    assert.strictEqual(parsed.uiCommand.parameters[0].name, 'rain');
    assert.strictEqual(parsed.uiCommand.parameters[0].volume, 80);
    assert.strictEqual(parsed.uiCommand.parameters[0].pitch, 95);
    assert.strictEqual(parsed.uiCommand.parameters[0].pan, -20);

    const parsed3 = AudioCommandEditor.parseAudioCommand({
        code: 356, indent: 0, parameters: ['play_bgs3 wind 40']
    });
    assert.strictEqual(parsed3.channelKey, 'bgs3');
    assert.strictEqual(parsed3.uiCommand.parameters[0].volume, 40);
    // Missing args fall back to editor defaults.
    const bare = AudioCommandEditor.parseAudioCommand({
        code: 356, indent: 0, parameters: ['play_bgs3 wind']
    });
    assert.strictEqual(bare.uiCommand.parameters[0].volume, 90);
    assert.strictEqual(bare.uiCommand.parameters[0].pitch, 100);
});

test('build round-trips the routed plugin command exactly', () => {
    const original = { code: 356, indent: 2, parameters: ['play_bgs2 rain 80 95 -20'] };
    const parsed = AudioCommandEditor.parseAudioCommand(original);
    const rebuilt = AudioCommandEditor.buildAudioCommand(parsed.uiCode, parsed.channelKey, parsed.uiCommand);
    assert.deepStrictEqual(rebuilt, original);
});

test('build keeps native codes native and remaps folder-mismatched channels', () => {
    const bgm = AudioCommandEditor.buildAudioCommand(241, 'bgm', {
        code: 241, indent: 0, parameters: [{ name: 'Theme', volume: 90, pitch: 100, pan: 0 }]
    });
    assert.strictEqual(bgm.code, 241);
    // Picking BGS2 in the BGM dialog yields the routed plugin command.
    const routed = AudioCommandEditor.buildAudioCommand(241, 'bgs2', {
        code: 241, indent: 0, parameters: [{ name: 'rain', volume: 70, pitch: 100, pan: 0 }]
    });
    assert.strictEqual(routed.code, 356);
    assert.strictEqual(routed.parameters[0], 'play_bgs2 rain 70 100 0');
});

test('stop_bgs2/3 parse and build as fadeout-channel commands', () => {
    const stop = AudioCommandEditor.parseAudioCommand({ code: 356, indent: 0, parameters: ['stop_bgs3'] });
    assert.strictEqual(stop.uiCode, 246);
    assert.strictEqual(stop.channelKey, 'bgs3');
    const rebuilt = AudioCommandEditor.buildAudioCommand(246, 'bgs3', stop.uiCommand);
    assert.deepStrictEqual(rebuilt, { code: 356, indent: 0, parameters: ['stop_bgs3'] });
    // Native BGS fadeout stays native with its duration.
    const native = AudioCommandEditor.buildAudioCommand(246, 'bgs', { code: 246, indent: 0, parameters: [2.5] });
    assert.strictEqual(native.code, 246);
    assert.strictEqual(native.parameters[0], 2.5);
});

test('isRoutedPluginAudio only matches the four audio plugin commands', () => {
    assert.ok(AudioCommandEditor.isRoutedPluginAudio({ code: 356, parameters: ['play_bgs2 rain 80 100 0'] }));
    assert.ok(AudioCommandEditor.isRoutedPluginAudio({ code: 356, parameters: ['stop_bgs2'] }));
    assert.ok(!AudioCommandEditor.isRoutedPluginAudio({ code: 356, parameters: ['SomeOther command'] }));
    assert.ok(!AudioCommandEditor.isRoutedPluginAudio({ code: 245, parameters: [{}] }));
    // Native audio commands parse into their own channel.
    const native = AudioCommandEditor.parseAudioCommand({
        code: 245, indent: 0, parameters: [{ name: 'Fire', volume: 80, pitch: 100, pan: 0 }]
    });
    assert.strictEqual(native.channelKey, 'bgs');
    assert.strictEqual(native.uiCommand.parameters[0].name, 'Fire');
});
