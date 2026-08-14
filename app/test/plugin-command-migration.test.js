const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PluginCommandMigration = require('../src/PluginCommandMigration.js');
const AgoniaNativeCommands = require('../src/event/commands/agonia/NativeCommands.js');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-migration-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

test('convertCommand rewrites 357 MZ structured form in place', () => {
    const structured = {
        code: 357, indent: 0,
        parameters: ['SuperDuperInventory', 'VisualChestStored', 'Открыть Сундук', { name: 'стелаж1' }]
    };
    assert.strictEqual(PluginCommandMigration.convertCommand(structured), true);
    assert.strictEqual(structured.code, 715);
    assert.deepEqual(structured.parameters, ['стелаж1']);
    assert.strictEqual(structured.indent, 0, 'indent preserved');
});

test('collectChestIds gathers ids from native and legacy commands', () => {
    const containers = [{
        events: [{
            pages: [{
                list: [
                    { code: 715, indent: 0, parameters: ['комод'] },
                    { code: 356, indent: 0, parameters: ['VisualChestStored шкафпарней'] },
                    { code: 356, indent: 0, parameters: ['fire radius 0 #C04000'] },
                    { code: 0, indent: 0, parameters: [] }
                ]
            }]
        }]
    }];
    const ids = AgoniaNativeCommands.collectChestIds(containers);
    assert.ok(ids.includes('комод'));
    assert.ok(ids.includes('шкафпарней'));
    assert.strictEqual(ids.length, 2);
});

test('registry exposes every native command with unique codes', () => {
    const commands = AgoniaNativeCommands.COMMANDS;
    const codes = commands.map(c => c.code);
    assert.strictEqual(new Set(codes).size, codes.length, 'codes are unique');
    for (const expected of [715, 716, 717, 718, 719, 725, 726, 730, 731, 732, 733, 734, 735, 736, 737]) {
        assert.ok(codes.includes(expected), `code ${expected} registered`);
    }
});

test('parseLegacyCommand handles the real corpus strings', () => {
    const cases = [
        ['VisualChestStored комод', { plugin: 'SuperDuperInventory', code: 715, parameters: ['комод'] }],
        ['VisualChestStored', { plugin: 'SuperDuperInventory', code: 715, parameters: [''] }],
        ['Stamina add -25', { plugin: 'SuperDuperMovement', code: 725, parameters: [0, -25] }],
        ['Stamina fill', { plugin: 'SuperDuperMovement', code: 725, parameters: [1, 0] }],
        ['Stamina exhaust', { plugin: 'SuperDuperMovement', code: 725, parameters: [2, 0] }],
        ['AltimitDash dash РывокВрага', { plugin: 'SuperDuperMovement_Addon', code: 726, parameters: [0, 0, 'РывокВрага'] }],
        ['AltimitDash dash УдарЛома', { plugin: 'SuperDuperMovement_Addon', code: 726, parameters: [0, 0, 'УдарЛома'] }],
        ['AltimitDash dash 3', { plugin: 'SuperDuperMovement_Addon', code: 726, parameters: [0, 0, '3'] }],
        ['WaitAsync 3', { plugin: 'WaitAsync', code: 730, parameters: [3] }],
        ['WaitAsync 15', { plugin: 'WaitAsync', code: 730, parameters: [15] }],
        ['SDDF FLASH', { plugin: 'SuperDuperDamageFlash', code: 731, parameters: [0, 0, 0] }],
        ['SDDF FLASH PLAYER', { plugin: 'SuperDuperDamageFlash', code: 731, parameters: [1, 0, 0] }],
        ['SDDF FLASH EVENT 5', { plugin: 'SuperDuperDamageFlash', code: 731, parameters: [2, 5, 0] }],
        ['SDDF FLASH 10', { plugin: 'SuperDuperDamageFlash', code: 731, parameters: [0, 0, 10] }],
        ['SaveToSamsara', { plugin: 'SuperDuperSamsara', code: 732, parameters: [] }],
        ['LoadFromSamsara', { plugin: 'SuperDuperSamsara', code: 733, parameters: [] }],
        ['CraftSystem open', { plugin: 'SimpleCraftSystem', code: 734, parameters: [] }],
        ['Hint show_preset df Знакомьтесь - ваш инввентарь', { plugin: 'SimpleCustomHints', code: 735, parameters: ['df', 'Знакомьтесь - ваш инввентарь'] }],
        ['Title show TL НОВАЯ ЖИЗНЬ', { plugin: 'SimpleCustomHints', code: 737, parameters: ['TL', 'НОВАЯ ЖИЗНЬ'] }],
        ['mark(ДрлН)', { plugin: 'SuperDuperMessage', code: 736, parameters: ['ДрлН'] }],
        ["mark('1')", { plugin: 'SuperDuperMessage', code: 736, parameters: ["'1'"] }],
    ];
    for (const [text, expected] of cases) {
        const parsed = PluginCommandMigration.parseLegacyCommand(text);
        assert.ok(parsed, `parses: ${text}`);
        assert.strictEqual(parsed.plugin, expected.plugin, `plugin for: ${text}`);
        assert.strictEqual(parsed.code, expected.code, `code for: ${text}`);
        assert.deepEqual(parsed.parameters, expected.parameters, `params for: ${text}`);
    }
    // Non-convertible strings stay untouched.
    for (const foreign of ['fire radius 0 #C04000', 'RegionBlock 8 ON #555555', 'SDL Give тех 1-3', 'Title clear', 'Hint show_preset_icon df 24 текст']) {
        assert.strictEqual(PluginCommandMigration.parseLegacyCommand(foreign), null, `foreign: ${foreign}`);
    }
});

test('collectSuggestions gathers dash names, marks and presets from corpus', () => {
    const containers = [{
        commonEvents: [{
            list: [
                { code: 356, parameters: ['AltimitDash dash Рывок'] },
                { code: 356, parameters: ['AltimitDash dash УдарЛома'] },
                { code: 356, parameters: ['mark(н1)'] },
                { code: 356, parameters: ['Hint show_preset df Первый взгляд'] },
                { code: 356, parameters: ['Title show TL НОВАЯ ЖИЗНЬ'] },
                { code: 726, indent: 0, parameters: [0, 0, 'РывокВрага'] },
                { code: 0, parameters: [] }
            ]
        }]
    }];
    const dashNames = AgoniaNativeCommands.collectSuggestions('dashNames', containers);
    assert.ok(dashNames.includes('Рывок'));
    assert.ok(dashNames.includes('УдарЛома'));
    assert.ok(dashNames.includes('РывокВрага'));
    const markIds = AgoniaNativeCommands.collectSuggestions('markIds', containers);
    assert.ok(markIds.includes('н1'));
    const presets = AgoniaNativeCommands.collectSuggestions('hintPresets', containers);
    assert.ok(presets.includes('df'));
    assert.ok(presets.includes('TL'));
    const titleTexts = AgoniaNativeCommands.collectSuggestions('titleTexts', containers);
    assert.ok(titleTexts.includes('НОВАЯ ЖИЗНЬ'));
});

function makeSampleProject(projectPath) {
    fs.mkdirSync(path.join(projectPath, 'data'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'js'), { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'data', 'Map001.json'), JSON.stringify({
        events: [{
            pages: [{
                list: [
                    { code: 356, indent: 0, parameters: ['VisualChestStored комод'] },
                    { code: 356, indent: 0, parameters: ['Stamina add -30'] },
                    { code: 356, indent: 0, parameters: ['AltimitDash dash Рывок'] },
                    { code: 356, indent: 0, parameters: ['WaitAsync 15'] },
                    { code: 356, indent: 0, parameters: ['SDDF FLASH EVENT 5'] },
                    { code: 356, indent: 0, parameters: ['SaveToSamsara'] },
                    { code: 356, indent: 0, parameters: ['mark(ДрлН)'] },
                    { code: 356, indent: 0, parameters: ['fire radius 0 #C04000'] },
                    { code: 0, indent: 0, parameters: [] }
                ]
            }]
        }]
    }));
    fs.writeFileSync(path.join(projectPath, 'data', 'CommonEvents.json'), JSON.stringify([
        null,
        { id: 1, name: 'CE1', list: [
            { code: 356, indent: 0, parameters: ['Stamina fill'] },
            { code: 356, indent: 0, parameters: ['LoadFromSamsara'] },
            { code: 356, indent: 0, parameters: ['CraftSystem open'] },
            { code: 356, indent: 0, parameters: ['Hint show_preset df Текст подсказки'] },
            { code: 356, indent: 0, parameters: ['Title show TL НОВАЯ ЖИЗНЬ'] },
            { code: 0, indent: 0, parameters: [] }
        ] }
    ]));
    const plugins = [
        { name: 'SRD_GameUpgrade', status: true, description: '', parameters: {} },
        { name: 'SuperDuperInventory', status: true, description: '', parameters: { 'Sound Volume': '90' } },
        { name: 'SuperDuperMovement', status: true, description: '', parameters: { 'Max Stamina': '120' } },
        { name: 'SuperDuperMovement_Addon', status: true, description: '', parameters: {} },
        { name: 'WaitAsync', status: true, description: '', parameters: {} },
        { name: 'SuperDuperDamageFlash', status: true, description: '', parameters: {} },
        { name: 'SuperDuperSamsara', status: true, description: '', parameters: {} },
        { name: 'SimpleCraftSystem', status: true, description: '', parameters: {} },
        { name: 'SimpleCustomHints', status: true, description: '', parameters: {} },
        { name: 'SuperDuperMessage', status: true, description: '', parameters: {} },
        { name: 'UnrelatedPlugin', status: true, description: '', parameters: {} }
    ];
    fs.writeFileSync(path.join(projectPath, 'js', 'plugins.js'),
        '/* migrated fixture */\nvar $plugins = ' + JSON.stringify(plugins, null, 2) + ';\n');
    fs.writeFileSync(path.join(projectPath, 'project.rpgreactor'), JSON.stringify({
        enginePluginsDir: 'X:/fake/catalog'
    }, null, 2));
}

test('applyToProject converts all families, relocates plugins and stays idempotent', () => {
    const projectPath = tempDir();
    try {
        makeSampleProject(projectPath);

        const report = PluginCommandMigration.applyToProject({ fs, path, projectPath });
        assert.strictEqual(report.ok, true, report.error);
        assert.strictEqual(report.converted, 12);
        assert.strictEqual(report.movedPlugins.length, 9);
        assert.ok(fs.existsSync(report.backupPath), 'backup folder exists');

        const map = JSON.parse(fs.readFileSync(path.join(projectPath, 'data', 'Map001.json'), 'utf8'));
        const list = map.events[0].pages[0].list;
        assert.strictEqual(list[0].code, 715);
        assert.strictEqual(list[1].code, 725);
        assert.deepEqual(list[1].parameters, [0, -30]);
        assert.strictEqual(list[2].code, 726);
        assert.strictEqual(list[3].code, 730);
        assert.deepEqual(list[4].parameters, [2, 5, 0]);
        assert.strictEqual(list[5].code, 732);
        assert.strictEqual(list[6].code, 736);
        assert.strictEqual(list[7].code, 356, 'SDLight string untouched');

        const common = JSON.parse(fs.readFileSync(path.join(projectPath, 'data', 'CommonEvents.json'), 'utf8'));
        const ceList = common[1].list;
        assert.strictEqual(ceList[0].code, 725);
        assert.deepEqual(ceList[0].parameters, [1, 0]);
        assert.strictEqual(ceList[1].code, 733);
        assert.strictEqual(ceList[2].code, 734);
        assert.strictEqual(ceList[3].code, 735);
        assert.deepEqual(ceList[3].parameters, ['df', 'Текст подсказки']);
        assert.strictEqual(ceList[4].code, 737);

        const manifest = fs.readFileSync(path.join(projectPath, 'js', 'plugins.js'), 'utf8');
        assert.ok(manifest.includes('SRD_GameUpgrade'), 'unrelated plugins kept');
        assert.ok(manifest.includes('UnrelatedPlugin'), 'unrelated plugins kept');
        assert.ok(!manifest.includes('"SuperDuperMovement"'), 'family removed');

        const meta = JSON.parse(fs.readFileSync(path.join(projectPath, 'project.rpgreactor'), 'utf8'));
        assert.strictEqual(meta.engineModules.length, 9);
        const movement = meta.engineModules.find(m => m.name === 'SuperDuperMovement');
        assert.strictEqual(movement.parameters['Max Stamina'], '120');
        assert.deepStrictEqual(movement.orderBefore, ['SRD_GameUpgrade', 'SuperDuperInventory']);

        // Idempotent: second run does nothing.
        const again = PluginCommandMigration.applyToProject({ fs, path, projectPath });
        assert.strictEqual(again.ok, true, again.error);
        assert.strictEqual(again.converted, 0);
        assert.strictEqual(again.movedPlugins.length, 0);
        assert.strictEqual(again.backupPath, null, 'no backup on no-op run');
    } finally {
        cleanupTemp(projectPath);
    }
});

test('applyToProject with a single plugin scope converts only that family', () => {
    const projectPath = tempDir();
    try {
        makeSampleProject(projectPath);
        const report = PluginCommandMigration.applyToProject({
            fs, path, projectPath, pluginNames: ['WaitAsync']
        });
        assert.strictEqual(report.ok, true);
        assert.strictEqual(report.converted, 1);
        assert.deepEqual(report.movedPlugins, ['WaitAsync']);
        const map = JSON.parse(fs.readFileSync(path.join(projectPath, 'data', 'Map001.json'), 'utf8'));
        const list = map.events[0].pages[0].list;
        assert.strictEqual(list[3].code, 730);
        assert.strictEqual(list[0].code, 356, 'other families untouched');
    } finally {
        cleanupTemp(projectPath);
    }
});

test('applyToProject dry-run writes nothing', () => {
    const projectPath = tempDir();
    try {
        makeSampleProject(projectPath);
        const beforeMap = fs.readFileSync(path.join(projectPath, 'data', 'Map001.json'), 'utf8');
        const beforeManifest = fs.readFileSync(path.join(projectPath, 'js', 'plugins.js'), 'utf8');
        const report = PluginCommandMigration.applyToProject({ fs, path, projectPath, dryRun: true });
        assert.strictEqual(report.ok, true);
        assert.strictEqual(report.converted, 12);
        assert.strictEqual(fs.readFileSync(path.join(projectPath, 'data', 'Map001.json'), 'utf8'), beforeMap);
        assert.strictEqual(fs.readFileSync(path.join(projectPath, 'js', 'plugins.js'), 'utf8'), beforeManifest);
    } finally {
        cleanupTemp(projectPath);
    }
});
