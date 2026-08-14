const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const OBJECTS = path.join(__dirname, '..', 'runtime', 'reactor_objects.js');
const SPRITES = path.join(__dirname, '..', 'runtime', 'reactor_sprites.js');
const PluginCommandMigration = require('../src/PluginCommandMigration.js');

function loadChunk(sourceFile, startMarker, endMarker) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    const start = source.indexOf(startMarker);
    assert.ok(start > 0, `${startMarker} not found in ${path.basename(sourceFile)}`);
    const end = source.indexOf(endMarker, start);
    assert.ok(end > start, `${endMarker} not found after ${startMarker}`);
    const tail = source.indexOf('};', end);
    return source.slice(start, tail + 2);
}

test('NastyTextPop corpus strings convert to command 740', () => {
    const cases = [
        // player target (-1), slot dropped, duration, text normalized
        ['NastyTextPop -1 1 45    Заново...', [-1, 0, 45, 'Заново...']],
        ['NastyTextPop -1 1 60       \\c[10]Блять.', [-1, 0, 60, '\\c[10]Блять.']],
        ['NastyTextPop 3 1 120 *Шипение*', [0, 3, 120, '*Шипение*']],
        ['NastyTextPop 3 1 120    Оставайтесь...', [0, 3, 120, 'Оставайтесь...']],
        ['NastyTextPop -1 1 45 Открыл', [-1, 0, 45, 'Открыл']],
    ];
    for (const [text, parameters] of cases) {
        const parsed = PluginCommandMigration.parseLegacyCommand(text);
        assert.ok(parsed, `parses: ${text}`);
        assert.strictEqual(parsed.plugin, 'NastyTextPop');
        assert.strictEqual(parsed.code, 740);
        assert.deepEqual(parsed.parameters, parameters, `params for: ${text}`);
    }
});

test('SDS_Set* corpus strings convert to slide setters', () => {
    assert.deepEqual(
        PluginCommandMigration.parseLegacyCommand('SDS_SetTitle Пиздец'),
        { plugin: 'SDS_Intro', code: 741, parameters: ['Пиздец'] }
    );
    assert.deepEqual(
        PluginCommandMigration.parseLegacyCommand('SDS_SetText "Ну эта бля пизда"'),
        { plugin: 'SDS_Intro', code: 742, parameters: ['Ну эта бля пизда'] }
    );
    assert.deepEqual(
        PluginCommandMigration.parseLegacyCommand('SDS_SetFace Kirill 0'),
        { plugin: 'SDS_Intro', code: 743, parameters: ['Kirill', 0] }
    );
    assert.deepEqual(
        PluginCommandMigration.parseLegacyCommand('SDS_SetBg snap'),
        { plugin: 'SDS_Intro', code: 744, parameters: ['snap'] }
    );
});

function makeObjectsRuntime() {
    const chunk = loadChunk(OBJECTS, 'Game_Interpreter.prototype.command740', 'Game_Interpreter.prototype.command745');
    const rt = { pops: [], warns: [], waitModes: [] };
    rt.context = {
        console: { warn: msg => rt.warns.push(String(msg)), log: () => { } },
        $gameTemp: {
            requestAgoniaTextPop(target, text, duration) { rt.pops.push({ target, text, duration }); }
        },
        $gamePlayer: { screenX: () => 100, screenY: () => 200, name: 'player' },
        $gameMap: {
            event(id) { return id === 3 ? { screenX: () => 50, screenY: () => 60, name: 'ev3' } : null; }
        },
        Game_Interpreter: function () { },
    };
    rt.context.Game_Interpreter.prototype = {
        setWaitMode(mode) { rt.waitModes.push(mode); }
    };
    vm.createContext(rt.context);
    vm.runInContext(chunk, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('command740 queues a text pop for player and event targets', () => {
    const rt = makeObjectsRuntime();
    const it = rt.interpreter();
    it.command740([-1, 0, 45, 'Заново...']);
    it.command740([0, 3, 120, '*Шипение*']);
    assert.strictEqual(rt.pops.length, 2);
    assert.strictEqual(rt.pops[0].target.name, 'player');
    assert.strictEqual(rt.pops[0].duration, 45);
    assert.strictEqual(rt.pops[1].target.name, 'ev3');
    assert.strictEqual(rt.pops[1].text, '*Шипение*');

    it.command740([0, 99, 60, 'нет цели']);
    assert.strictEqual(rt.pops.length, 2, 'missing target does not queue');
    assert.ok(rt.warns.some(w => w.includes('event 99')));
});

function makeSlideRuntime() {
    const chunk = loadChunk(OBJECTS, 'Game_Interpreter.prototype.command740', 'Game_Interpreter.prototype.command745');
    const rt = { warns: [], waitModes: [] };
    rt.context = {
        console: { warn: msg => rt.warns.push(String(msg)), log: () => { } },
        $gameTemp: {},
        Game_Interpreter: function () { },
    };
    rt.context.Game_Interpreter.prototype = {
        setWaitMode(mode) { rt.waitModes.push(mode); }
    };
    vm.createContext(rt.context);
    vm.runInContext(chunk, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('slide setters accumulate config and Show Slide activates the wait', () => {
    const rt = makeSlideRuntime();
    const it = rt.interpreter();
    it.command741(['Пиздец']);
    it.command742(['Ну эта бля пизда']);
    it.command743(['Kirill', 0]);
    it.command744(['snap']);
    const config = rt.context.$gameTemp._agoniaSlideConfig;
    assert.strictEqual(config.title, 'Пиздец');
    assert.strictEqual(config.text, 'Ну эта бля пизда');
    assert.strictEqual(config.faceName, 'Kirill');
    assert.strictEqual(config.faceIndex, 0);
    assert.strictEqual(config.bgName, 'snap');

    it.command745([300]);
    assert.strictEqual(rt.context.$gameTemp._agoniaSlideDuration, 300);
    assert.strictEqual(rt.context.$gameTemp._agoniaSlideActive, true);
    assert.deepEqual(rt.waitModes, ['agoniaSlide']);

    // Show without config warns and does not activate.
    rt.context.$gameTemp._agoniaSlideConfig = null;
    rt.context.$gameTemp._agoniaSlideActive = false;
    it.command745([300]);
    assert.strictEqual(rt.context.$gameTemp._agoniaSlideActive, false);
    assert.ok(rt.warns.some(w => w.includes('Show Slide')));
});

function makeSpriteSandbox() {
    const source = fs.readFileSync(SPRITES, 'utf8');
    const start = source.indexOf('function Sprite_AgoniaTextPop');
    const end = source.indexOf('const _Spriteset_Map_createLowerLayer_Agonia');
    assert.ok(start > 0 && end > start, 'agonia sprite block not found');
    const chunk = source.slice(start, end);

    const rt = { destroyed: [] };
    class FakeBitmap {
        constructor(w, h) { this.width = w; this.height = h; this.fontSize = 16; this._texts = []; }
        measureTextWidth(text) { return String(text).length * 10; }
        drawText(text) { this._texts.push({ text, color: this.textColor }); }
        fillAll() { }
        destroy() { rt.destroyed.push(this); }
        isReady() { return true; }
    }
    function FakeSprite() {
        this.anchor = { x: 0, y: 0 };
        this.opacity = 255;
        this.bitmap = null;
        this.scale = { x: 1, y: 1 };
    }
    FakeSprite.prototype.initialize = function () { FakeSprite.call(this); };
    FakeSprite.prototype.addChild = function (child) { return child; };
    FakeSprite.prototype.update = function () { };
    FakeSprite.prototype.destroy = function () { };
    FakeSprite.prototype.setFrame = function (x, y, w, h) { this._frame = [x, y, w, h]; };
    const colors = { 0: '#ffffff', 10: '#ff8888' };
    rt.context = {
        Sprite: FakeSprite,
        Bitmap: FakeBitmap,
        Graphics: { width: 1280, height: 720 },
        ColorManager: { textColor: n => colors[n] || '#ffffff' },
        ImageManager: {
            loadPicture: name => ({ __name: name, isReady: () => true, width: 640, height: 480, addLoadListener() { } }),
            loadFace: name => ({ __name: name, isReady: () => true, width: 576, height: 768 })
        },
        Utils: { isOptionValid: () => false }
    };
    vm.createContext(rt.context);
    vm.runInContext(chunk, rt.context);
    return rt;
}

test('Sprite_AgoniaTextPop renders color-coded segments and finishes', () => {
    const rt = makeSpriteSandbox();
    const target = { screenX: () => 640, screenY: () => 300 };
    const pop = new rt.context.Sprite_AgoniaTextPop(target, 'Блять. \\c[10]Ой.', 45);
    assert.ok(pop.bitmap, 'bitmap created');
    // two segments: default color + color 10
    assert.strictEqual(pop.bitmap._texts.length, 2);
    assert.strictEqual(pop.bitmap._texts[0].text, 'Блять. ');
    assert.strictEqual(pop.bitmap._texts[1].color, '#ff8888');
    // position above the character
    assert.strictEqual(pop.x, 640);
    assert.strictEqual(pop.y, 300 - 52);
    // lifecycle
    for (let i = 0; i < 45; i++) pop.update();
    assert.ok(pop.isDone());
});

test('Sprite_AgoniaSlide builds content and stretches the background', () => {
    const rt = makeSpriteSandbox();
    const slide = new rt.context.Sprite_AgoniaSlide(
        { title: 'Т', text: 'строка 1\nстрока 2', faceName: 'Kirill', faceIndex: 1, bgName: 'snap' }, 300
    );
    // dim + bg + face + title + 2 text lines = 6 parts
    assert.strictEqual(slide._parts.length, 6);
    const bg = slide._parts[1];
    slide.update();
    assert.ok(Math.abs(bg.scale.x - 1280 / 640) < 0.001, 'bg stretched to screen width');
    assert.ok(Math.abs(bg.scale.y - 720 / 480) < 0.001, 'bg stretched to screen height');
    const face = slide._parts[2];
    assert.deepStrictEqual(face._frame, [144, 0, 144, 144], 'face index 1 selects second cell');
    // full lifecycle: fade in + hold + fade out
    const total = 300 + 30;
    for (let i = 0; i < total; i++) slide.update();
    assert.ok(slide.isDone());
});
