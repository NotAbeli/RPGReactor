const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('vm');

const ProjectManager = require('../src/ProjectManager.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-s15-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function pluginParseCollection(raw) {
    let arr = [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
    } catch (e) { /* empty */ }
    return arr.map(item => {
        try { return JSON.parse(item); } catch (e) { return {}; }
    });
}

const { AgoniaCardEditorBase } = require('../src/database/DatabaseDataEditors.js');

const RECIPE = JSON.stringify({ ResultItemID: '2', Ingredients: JSON.stringify(['1', '9']) });
const LOOT_CAT = JSON.stringify({
    Name: 'кнцл',
    Items: JSON.stringify([JSON.stringify({ ItemId: '1', Price: '1', Size: '1' })])
});
const GIFT_CHAR = JSON.stringify({
    Id: 'Настя', VariableId: '105',
    SpecificItems: JSON.stringify([JSON.stringify({ ItemId: '1', Points: '10' })]),
    TagSettings: '[]',
    DisallowedItems: JSON.stringify(['23']),
    DisallowedTags: '[]',
    DefaultPoints: '1'
});
const HINT = JSON.stringify({ Name: 'df', 'Icon Index': '8', Y: '610', Duration: '350', Centered: 'true' });

test('card editor codec round-trips the S15 plugin formats', () => {
    // Recipes: nested Ingredients is a JSON-string array of item ids.
    const recipes = AgoniaCardEditorBase.decodeCollection(JSON.stringify([RECIPE]));
    assert.strictEqual(recipes[0].ResultItemID, '2');
    const ings = AgoniaCardEditorBase.decodeNested(recipes[0].Ingredients);
    assert.deepStrictEqual(ings, ['1', '9']);
    assert.strictEqual(
        AgoniaCardEditorBase.encodeCollection(recipes),
        JSON.stringify([RECIPE]), 'recipe round-trip is stable');
    assert.strictEqual(
        AgoniaCardEditorBase.encodeNested(ings), JSON.stringify(['1', '9']));

    // Loot: nested Items is a JSON-string array of object strings.
    const cats = AgoniaCardEditorBase.decodeCollection(JSON.stringify([LOOT_CAT]));
    assert.strictEqual(cats[0].Name, 'кнцл');
    const items = AgoniaCardEditorBase.decodeNested(cats[0].Items);
    assert.strictEqual(items[0].ItemId, '1');
    assert.strictEqual(items[0].Price, '1');

    // Gifts: nested SpecificItems/DisallowedItems survive verbatim.
    const chars = AgoniaCardEditorBase.decodeCollection(JSON.stringify([GIFT_CHAR]));
    assert.strictEqual(chars[0].Id, 'Настя');
    const specific = AgoniaCardEditorBase.decodeNested(chars[0].SpecificItems);
    assert.strictEqual(specific[0].Points, '10');
    const disallowed = AgoniaCardEditorBase.decodeNested(chars[0].DisallowedItems);
    assert.deepStrictEqual(disallowed, ['23']);

    // Hints presets: flat entries.
    const hints = AgoniaCardEditorBase.decodeCollection(JSON.stringify([HINT]));
    assert.strictEqual(hints[0].Name, 'df');

    // Garbage input is safe.
    assert.deepStrictEqual(AgoniaCardEditorBase.decodeCollection('x'), []);
    assert.deepStrictEqual(AgoniaCardEditorBase.decodeNested(null), []);
});

test('MV bridge merges the five S15 sections into live plugin params', () => {
    const SNIPPET = ProjectManager.MV_CATALOG_LOADER_SNIPPET;
    const dir = tempDir();
    try {
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify({ engineModules: [], retiredPlugins: [] }));
        fs.writeFileSync(path.join(dir, 'data', 'AgoniaEngine.json'), JSON.stringify({
            craft: { Recipes: JSON.stringify([RECIPE]) },
            hints: { Presets: JSON.stringify([HINT]), 'Title Presets': '[]', 'Hint Z-Index': 140 },
            popup: { Duration: 15, 'Gold Icon Index': 163 },
            loot: { Categories: JSON.stringify([LOOT_CAT]) },
            gifts: { Characters: JSON.stringify([GIFT_CHAR]) }
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
        vm.runInContext(`$plugins = [
            {name:'SimpleCraftSystem',status:true,parameters:{}},
            {name:'SimpleCustomHints',status:true,parameters:{}},
            {name:'MOG_TreasurePopup',status:true,parameters:{}},
            {name:'SuperDuperLoot',status:true,parameters:{}},
            {name:'SuperDuperGifts',status:true,parameters:{}}
        ]; PluginManager.setup($plugins);`, sandbox);

        const PM = sandbox.PluginManager;
        assert.strictEqual(PM.parameters('SimpleCraftSystem')['Recipes'], JSON.stringify([RECIPE]));
        assert.strictEqual(PM.parameters('SimpleCustomHints')['Hint Z-Index'], '140');
        assert.ok(/df/.test(PM.parameters('SimpleCustomHints')['Presets']), 'preset payload passes through');
        assert.strictEqual(PM.parameters('MOG_TreasurePopup')['Duration'], '15');
        const cats = pluginParseCollection(PM.parameters('SuperDuperLoot')['Categories']);
        assert.strictEqual(cats[0].Name, 'кнцл');
        const chars = pluginParseCollection(PM.parameters('SuperDuperGifts')['Characters']);
        assert.strictEqual(chars[0].Id, 'Настя');
    } finally {
        cleanupTemp(dir);
    }
});

test('native suggestions collect loot categories and gift characters from the sidecar + natives', () => {
    // Load NativeCommands as a module (it exports via module.exports too).
    const NC = require('../src/event/commands/agonia/NativeCommands.js');
    const containers = [
        { loot: { Categories: JSON.stringify([LOOT_CAT]) }, gifts: { Characters: JSON.stringify([GIFT_CHAR]) } },
        { list: [
            { code: 720, parameters: ['старый-лут', 5, 10] },
            { code: 751, parameters: ['Настя', 3] }
        ] }
    ];
    const cats = NC.collectSuggestions('lootCategories', containers);
    assert.ok(cats.includes('кнцл'), 'sidecar category suggested');
    assert.ok(cats.includes('старый-лут'), 'native-used category suggested');
    const chars = NC.collectSuggestions('giftCharacters', containers);
    assert.ok(chars.includes('Настя'));
});
