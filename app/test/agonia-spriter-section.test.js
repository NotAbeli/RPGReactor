const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('vm');

const PluginCommandMigration = require('../src/PluginCommandMigration.js');
const ProjectManager = require('../src/ProjectManager.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-spriter-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function makeDbManager() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'DatabaseManager.js'), 'utf8');
    const start = source.indexOf('static get AGONIA_FILENAME');
    const end = source.indexOf('captureSavedState(dataKey = null)');
    assert.ok(start > 0 && end > start, 'agonia block not found');
    const chunk = source.slice(start, end);
    const context = { console };
    vm.createContext(context);
    vm.runInContext(`(function(){ class DatabaseManager {\n${chunk}\n} this.DatabaseManager = DatabaseManager; })()`, context);
    const manager = Object.create(context.DatabaseManager.prototype);
    manager.fs = fs;
    manager.path = path;
    return { manager, DatabaseManager: context.DatabaseManager };
}

/** The plugin's exact parsing helpers (SuperDuperSpriter.js), including
 *  the nested safeParse of Conditions/Visuals JSON strings. */
function pluginParseCollection(raw) {
    let arr = [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
    } catch (e) { /* empty */ }
    const safeParse = s => {
        try { return JSON.parse(s); } catch (e) { return {}; }
    };
    return arr.map(item => {
        const obj = safeParse(item);
        if (obj.Conditions !== undefined) obj.Conditions = safeParse(obj.Conditions);
        if (obj.Visuals !== undefined) obj.Visuals = safeParse(obj.Visuals);
        return obj;
    });
}

test('spriter defaults: all keys, MV-string collections', () => {
    const { DatabaseManager } = makeDbManager();
    const spriter = DatabaseManager.agoniaDefaults().spriter;
    assert.deepStrictEqual(
        Object.keys(spriter).sort(),
        ['ApplyToActor', 'Debug', 'EnablePoses', 'NPCMappings', 'PoseMappings', 'SpriteMappings', 'VariableId']
    );
    assert.strictEqual(spriter.VariableId, 17);
    assert.strictEqual(spriter.EnablePoses, true);
    // Collections are stored as MV strings (JSON array of JSON strings).
    assert.strictEqual(typeof spriter.SpriteMappings, 'string');
    assert.deepStrictEqual(JSON.parse(spriter.SpriteMappings), []);
});

test('spriter seed: harvests live plugin parameters from engineModules', () => {
    const { manager } = makeDbManager();
    const dir = tempDir();
    try {
        const mapping = JSON.stringify({
            Name: 'Лом', Priority: 5,
            Conditions: JSON.stringify({ MainValue: 2, SwitchId1: 0, SwitchId2: 0, SwitchId3: 15, ExtVarId: 0, ExtVarOp: 'equal', ExtVarVal: 0 }),
            Visuals: JSON.stringify({ CharacterName: 'Actor1', CharacterIndex: 3, Frames: 4, Directions: 4 })
        });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({
            engineModules: [
                {
                    name: 'SuperDuperSpriter', parameters: {
                        'VariableId': '17',
                        'EnablePoses': 'true',
                        'SpriteMappings': JSON.stringify([mapping])
                    }, orderBefore: []
                }
            ]
        }));
        fs.mkdirSync(path.join(dir, 'js'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');

        const seeded = manager.agoniaSeedValues(dir);
        assert.strictEqual(seeded.spriter.VariableId, 17);
        assert.strictEqual(seeded.spriter.EnablePoses, true);
        // The MV-format collection string survives seeding verbatim.
        const parsed = pluginParseCollection(seeded.spriter.SpriteMappings);
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].Name, 'Лом');
        assert.strictEqual(parsed[0].Conditions.MainValue, 2);
        assert.strictEqual(parsed[0].Visuals.CharacterIndex, 3);
    } finally {
        cleanupTemp(dir);
    }
});

test('MV bridge merges the spriter section into SuperDuperSpriter params (MV format intact)', () => {
    const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;
    const dir = tempDir();
    try {
        const mapping = JSON.stringify({
            Name: 'Test', Priority: 0,
            Conditions: JSON.stringify({ MainValue: 1 }),
            Visuals: JSON.stringify({ CharacterName: 'Actor2' })
        });
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            spriter: {
                VariableId: 17,
                EnablePoses: true,
                ApplyToActor: true,
                Debug: false,
                SpriteMappings: JSON.stringify([mapping]),
                PoseMappings: '[]',
                NPCMappings: '[]'
            }
        }));
        const scriptTags = [];
        const sandbox = {
            console, $plugins: [], window: null,
            Game_Interpreter: function () { }, Spriteset_Map: function () { },
            Sprite: function () { }, Bitmap: function () { },
            Input: { _currentState: {}, _gamepadStates: [], gamepadMapper: {}, _pollGamepads() { }, _updateGamepadState() { }, isTriggered: () => false, update() { } },
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
        vm.runInContext(`$plugins = [{name:'SuperDuperSpriter',status:true,parameters:{}}]; PluginManager.setup($plugins);`, sandbox);

        const params = sandbox.PluginManager.parameters('SuperDuperSpriter');
        assert.strictEqual(params['VariableId'], '17');
        assert.strictEqual(params['EnablePoses'], 'true');
        // The collection stays a string the plugin's safeParseArray reads.
        const parsed = pluginParseCollection(params['SpriteMappings']);
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].Visuals.CharacterName, 'Actor2');
        assert.strictEqual(parsed[0].Conditions.MainValue, 1);
    } finally {
        cleanupTemp(dir);
    }
});

test('editor codec round-trips MV collection strings', () => {
    const Editor = require('../src/database/DatabaseSpriterEditor.js');
    const entry = {
        Name: 'Поза удара', Priority: 2,
        Conditions: { MainValue: 14, SwitchId3: 15 },
        Visuals: { CharacterName: '', GridX: 3, GridY: 1, Width: 48, Height: 48 }
    };
    const encoded = Editor.encodeCollection([entry, { IdName: 'NPC' }]);
    assert.strictEqual(typeof encoded, 'string');
    // Encoded form keeps Conditions/Visuals as JSON strings (plugin format).
    const rawItem = JSON.parse(JSON.parse(encoded)[0]);
    assert.strictEqual(typeof rawItem.Conditions, 'string');
    assert.strictEqual(typeof rawItem.Visuals, 'string');
    const decoded = Editor.decodeCollection(encoded);
    assert.strictEqual(decoded.length, 2);
    assert.strictEqual(decoded[0].Name, 'Поза удара');
    assert.strictEqual(decoded[0].Conditions.MainValue, 14);
    assert.strictEqual(decoded[0].Visuals.GridX, 3);
    assert.strictEqual(decoded[1].IdName, 'NPC');
    // Round-trip is stable.
    assert.strictEqual(Editor.encodeCollection(decoded), encoded);
    // The plugin parser accepts the encoded form and reads conditions.
    const pluginParsed = pluginParseCollection(encoded);
    assert.strictEqual(pluginParsed[0].Conditions.MainValue, 14);
    assert.strictEqual(pluginParsed[0].Visuals.GridX, 3);
    // Live-format entries (nested values already strings in the item) decode
    // into editable objects.
    const live = JSON.stringify([JSON.stringify({
        Name: 'Лом', Priority: '10',
        Conditions: JSON.stringify({ MainValue: '2', SwitchId3: '15' }),
        Visuals: JSON.stringify({ CharacterName: 'Actor1', CharacterIndex: '3' })
    })]);
    const liveDecoded = Editor.decodeCollection(live);
    assert.strictEqual(liveDecoded[0].Conditions.MainValue, '2');
    assert.strictEqual(liveDecoded[0].Visuals.CharacterName, 'Actor1');
    // Garbage input decodes without throwing.
    assert.deepStrictEqual(Editor.decodeCollection('not json'), []);
    assert.deepStrictEqual(Editor.decodeCollection('["broken json"]'), [{}]);
});

test('editor blank entries match the plugin parser expectations', () => {
    const Editor = require('../src/database/DatabaseSpriterEditor.js');
    for (const kind of ['SpriteMappings', 'PoseMappings', 'NPCMappings']) {
        const blank = Editor.blankEntry(kind);
        const encoded = Editor.encodeCollection([blank]);
        const parsed = pluginParseCollection(encoded)[0];
        assert.ok(parsed, kind + ' blank parses');
        if (kind !== 'NPCMappings') {
            assert.ok(parsed.Conditions && typeof parsed.Conditions === 'object', kind + ' has Conditions');
            assert.ok(parsed.Visuals && typeof parsed.Visuals === 'object', kind + ' has Visuals');
        } else {
            assert.ok(parsed.Visuals && typeof parsed.Visuals === 'object', 'NPC has Visuals');
            assert.ok(typeof parsed.IdName === 'string' && parsed.IdName, 'NPC has IdName');
        }
    }
});
