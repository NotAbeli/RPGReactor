const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('vm');

const ProjectManager = require('../src/ProjectManager.js');

function makeDbManager() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'DatabaseManager.js'), 'utf8');
    const start = source.indexOf('static get AGONIA_FILENAME');
    const end = source.indexOf('captureSavedState(dataKey = null)');
    assert.ok(start > 0 && end > start, 'agonia block not found');
    const chunk = source.slice(start, end);
    const context = { console };
    vm.createContext(context);
    vm.runInContext(`(function(){ class DatabaseManager {\n${chunk}\n} this.DatabaseManager = DatabaseManager; })()`, context);
    return { DatabaseManager: context.DatabaseManager };
}

test('UI editor field defs stay consistent with the section defaults (no drift)', () => {
    const Editor = require('../src/database/DatabaseUIEditor.js');
    const { DatabaseManager } = makeDbManager();
    const defaults = DatabaseManager.agoniaDefaults();
    for (const [section, fields] of Object.entries(Editor.FIELD_DEFS)) {
        assert.ok(defaults[section], 'section ' + section + ' exists in defaults');
        for (const f of fields) {
            assert.ok(f.key in defaults[section],
                section + '.' + f.key + ' has an editor field but no default (normalizeAgonia would drop it)');
        }
    }
});

test('MV bridge merges UI sections into the live plugins', () => {
    const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'agonia-s16-'));
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            save: { 'Max Slots': 20, 'Text Color': '#00ff88' },
            title: { 'Animation Mode': '1' },
            splash: { 'Phase 3 Time': 200 },
            gameover: { 'Hold Time': 33 },
            message: { 'Delay Time': 15 },
            choices: { 'Scale Active': 1.25 },
            settings: { 'Fade Speed': 90 },
            craft: { 'Hint 2 Text': 'Верстак', 'Slot 1 X': 500 },
            inventory: { 'Visual Settings': '{"Hotbar Y":"690"}' }
        }));
        const scriptTags = [];
        const sandbox = {
            console, $plugins: [], window: null,
            Game_Interpreter: function () { }, Spriteset_Map: function () { },
            Sprite: function () { }, Bitmap: function () { },
            Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepads() { }, isTriggered: () => false, update() { } },
            TouchInput: { isTriggered: () => false }, Window_TitleCommand: function () { },
            ImageManager: { loadSystem: () => ({ isReady: () => false }) },
            Graphics: { width: 816, height: 624 }, $gameTemp: {},
            navigator: { getGamepads: () => [] },
            document: {
                createElement: () => ({ type: '', src: '', async: false, onerror: null, _url: '' }),
                body: { appendChild: tag => scriptTags.push(tag) },
            },
            process: { env: {}, cwd: () => dir },
            require: n => (n === 'fs' ? fs : n === 'path' ? path : null),
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
        vm.runInContext(SNIPPET, sandbox);
        vm.runInContext(`$plugins = [
            {name:'SuperDuperSave',status:true,parameters:{}},
            {name:'MOG_TitlePictureCom',status:true,parameters:{}},
            {name:'SuperDuperSplash',status:true,parameters:{}},
            {name:'SuperDuperGameOver',status:true,parameters:{}},
            {name:'SuperDuperMessage',status:true,parameters:{}},
            {name:'SuperDuperChoices',status:true,parameters:{}},
            {name:'SuperDuperSettings',status:true,parameters:{}},
            {name:'SimpleCraftSystem',status:true,parameters:{}},
            {name:'SuperDuperInventory',status:true,parameters:{}}
        ]; PluginManager.setup($plugins);`, sandbox);

        const PM = sandbox.PluginManager;
        assert.strictEqual(PM.parameters('SuperDuperSave')['Max Slots'], '20');
        assert.strictEqual(PM.parameters('SuperDuperSave')['Text Color'], '#00ff88');
        assert.strictEqual(PM.parameters('MOG_TitlePictureCom')['Animation Mode'], '1');
        assert.strictEqual(PM.parameters('SuperDuperSplash')['Phase 3 Time'], '200');
        assert.strictEqual(PM.parameters('SuperDuperGameOver')['Hold Time'], '33');
        assert.strictEqual(PM.parameters('SuperDuperMessage')['Delay Time'], '15');
        assert.strictEqual(PM.parameters('SuperDuperChoices')['Scale Active'], '1.25');
        assert.strictEqual(PM.parameters('SuperDuperSettings')['Fade Speed'], '90');
        assert.strictEqual(PM.parameters('SimpleCraftSystem')['Hint 2 Text'], 'Верстак');
        assert.strictEqual(PM.parameters('SimpleCraftSystem')['Slot 1 X'], '500');
        assert.strictEqual(PM.parameters('SuperDuperInventory')['Visual Settings'], '{"Hotbar Y":"690"}');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('sptags note-tag plumbing round-trips (ItemTags stage A)', () => {
    const Item = require('../src/database/DatabaseItemEditor.js');
    // read
    assert.deepStrictEqual(Item.readSptags('<sptags:острый, spdisposable>'), ['острый']);
    assert.strictEqual(Item.readSpDisposable('<sptags:острый, spdisposable>'), true);
    assert.strictEqual(Item.readSpDisposable('<sptags:острый>\n<spdisposable>'), true);
    // write keeps foreign tags
    const note = '<foo:1>\n<sptags:острый>';
    const written = Item.writeSptags(note, 'острый, ломик');
    assert.ok(/<foo:1>/.test(written), 'foreign tags survive');
    assert.ok(/<sptags:острый, ломик>/.test(written));
    assert.deepStrictEqual(Item.readSptags(written), ['острый', 'ломик']);
    // disposable toggle standalone
    const withD = Item.writeSpDisposable('<sptags:острый>', true);
    assert.strictEqual(Item.readSpDisposable(withD), true);
    const withoutD = Item.writeSpDisposable(withD, false);
    assert.strictEqual(Item.readSpDisposable(withoutD), false);
    assert.deepStrictEqual(Item.readSptags(withoutD), ['острый']);
    // disposable preserved inside sptags on tag rewrite
    const kept = Item.writeSptags('<sptags:острый, spdisposable>', 'ломик');
    assert.deepStrictEqual(Item.readSptags(kept), ['ломик']);
    assert.strictEqual(Item.readSpDisposable(kept), true);
});
