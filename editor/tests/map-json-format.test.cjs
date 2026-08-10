const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(editorRoot, '..');
const utilitySource = fs.readFileSync(path.join(editorRoot, 'src', 'utils', 'DataLimits.js'), 'utf8');
const utilityContext = { console };
vm.runInNewContext(utilitySource, utilityContext);
const MapJson = utilityContext.RRMapJson;

test('map JSON keeps tile data inline and all other fields readable', () => {
    const map = {
        displayName: 'Test',
        width: 2,
        height: 1,
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        events: [null, { id: 1, data: { nested: true }, pages: [] }]
    };
    const json = MapJson.stringify(map);

    assert.deepEqual(JSON.parse(json), map);
    assert.match(json, /^  "data": \[1,2,3,4,5,6,7,8,9,10,11,12\],$/m);
    assert.match(json, /"events": \[\n    null,/);
    assert.match(json, /"data": \{\n        "nested": true\n      \}/,
        'an event property named data keeps ordinary nested formatting');
});

test('every map writer uses the shared formatter loaded before its consumers', () => {
    const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
    const formatter = html.indexOf('src/utils/DataLimits.js');
    assert.ok(formatter >= 0);
    for (const script of ['src/ProjectManager.js', 'src/TilemapManager.js', 'src/ProjectController.js']) {
        assert.ok(formatter < html.indexOf(script), `${script} loads after MapJson`);
    }

    const controller = fs.readFileSync(path.join(editorRoot, 'src', 'ProjectController.js'), 'utf8');
    const tilemap = fs.readFileSync(path.join(editorRoot, 'src', 'TilemapManager.js'), 'utf8');
    const project = fs.readFileSync(path.join(editorRoot, 'src', 'ProjectManager.js'), 'utf8');
    assert.equal((controller.match(/RRMapJson\.stringify/g) || []).length, 3);
    assert.equal((tilemap.match(/RRMapJson\.stringify/g) || []).length, 1);
    assert.match(project, /\^Map\\d\+\\\.json\$.*RRMapJson/s);

    const template = fs.readFileSync(path.join(repoRoot, 'template', 'Demo', 'data', 'Map001.json'), 'utf8');
    assert.match(template, /^  "data": \[[^\n]*\],$/m, 'the bundled starter uses compact tile data');
});
