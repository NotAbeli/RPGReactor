const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');

// Minimal stand-in for a <select>, modelling the one behaviour this bug turns
// on: assigning a value that matches no option leaves selectedIndex at -1, and
// the element then renders empty and collapses to its padding.
class FakeSelect {
    constructor() {
        this.options = [];
    this.selectedIndex = -1;
        this._value = '';
    }
    set innerHTML(html) {
        this.options = [];
    this.selectedIndex = -1;
        this._value = '';
        const match = /<option value="([^"]*)">([^<]*)<\/option>/.exec(String(html));
        if (match) this.appendChild({ value: match[1], textContent: match[2] });
    }
    appendChild(option) {
        // The real DOM stringifies option values; without this the fake would
        // report numbers and mask a genuine string/number mismatch.
        option.value = String(option.value);
        this.options.push(option);
    if (this.selectedIndex < 0) {
        this.selectedIndex = 0;
            this._value = option.value;
        }
    }
    get value() {
    return this.selectedIndex >= 0 ? this.options[this.selectedIndex].value : '';
    }
    set value(next) {
        const index = this.options.findIndex(option => String(option.value) === String(next));
    this.selectedIndex = index;
        this._value = index >= 0 ? this.options[index].value : '';
    }
}

const controllerSource = fs.readFileSync(path.join(editorRoot, 'src', 'ProjectController.js'), 'utf8');

// document has to live inside the vm context: a `global.document` set out here
// is invisible to code evaluated in another realm.
function controllerWith(tilesets) {
    const select = new FakeSelect();
    const documentStub = {
    getElementById: () => select,
        createElement: () => ({ value: '', textContent: '' })
    };
    const ProjectController = vm.runInNewContext(`${controllerSource}\nProjectController;`, {
        console, process, require, nw: {}, document: documentStub
    });
    const controller = Object.create(ProjectController.prototype);
    controller.databaseManager = { data: { tilesets } };
    controller._tt = text => text;
    controller._t = key => key;
    controller.__select = select;
    return controller;
}

test('a map pointing at a cleared tileset selects a real one instead of nothing', () => {
    // Tileset 1 was cleared, so the project's entries start at 2.
    const controller = controllerWith([
        null, null,
        { id: 2, name: 'Ja Overworld' },
        { id: 3, name: 'Ja Inside' }
    ]);
    controller.populateTilesetDropdown();
    const select = controller.__select;
    assert.equal(select.options.length, 2);

        // The failing case: a new map defaults to tilesetId 1, which no longer exists.
    const chosen = controller.selectTilesetOption(select, 1);
    assert.notEqual(select.selectedIndex, -1,
            'an unmatched id must not leave the control blank and collapsed');
    assert.equal(chosen, '2', 'it falls back to the first available tileset');
    assert.equal(select.options[select.selectedIndex].textContent, '0002: Ja Overworld');
});

test('a valid id still selects exactly that tileset', () => {
    const controller = controllerWith([
        null,
        { id: 1, name: 'Overworld' },
        { id: 2, name: 'Inside' },
        { id: 3, name: 'Dungeon' }
    ]);
    controller.populateTilesetDropdown();
    const select = controller.__select;
    assert.equal(controller.selectTilesetOption(select, 3), '3');
    assert.equal(select.options[select.selectedIndex].textContent, '0003: Dungeon');
});

test('a project with no tilesets still renders a normal-height control', () => {
    const controller = controllerWith([null, null, null]);
    controller.populateTilesetDropdown();
    const select = controller.__select;
    assert.equal(select.options.length, 1, 'a placeholder keeps the select from being empty');
    assert.equal(select.options[0].textContent, 'common.none');

    controller.selectTilesetOption(select, 7);
    assert.equal(select.selectedIndex, 0, 'the placeholder is selected rather than nothing');
});

test('the select declares a height floor so it cannot collapse visually', () => {
    const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
    const at = html.indexOf('id="map-tileset-select"');
    const style = html.slice(at).match(/style="([^"]*)"/)[1];
    assert.match(style, /min-height:\s*\d+px/,
    'an empty select would otherwise shrink to its padding');
});

test('each option leads with the tileset id, zero padded', () => {
    // The database lists tilesets by number, so the map's dropdown has to name
    // the same identifier or the two cannot be matched up.
    const controller = controllerWith([
        null,
        { id: 1, name: 'Overworld' },
        { id: 12, name: 'Inside' },
        { id: 211, name: 'Canite City' },
        { id: 1000, name: 'Last Slot' }
    ]);
    controller.populateTilesetDropdown();
    const labels = controller.__select.options.map(option => option.textContent);
    assert.deepEqual(labels, [
        '0001: Overworld',
        '0012: Inside',
        '0211: Canite City',
        '1000: Last Slot'
    ], 'ids pad to four digits, matching the Change Tileset picker; 1000 is not truncated');
});

test('a nameless tileset still shows its id', () => {
    const controller = controllerWith([null, { id: 7, name: '' }]);
    controller.populateTilesetDropdown();
    // The old label fell back to "Tileset 7", which would now read "007: Tileset 7".
    assert.equal(controller.__select.options[0].textContent, '0007: common.unnamed');
});

test('the option value stays the bare id the map record stores', () => {
    const controller = controllerWith([null, { id: 4, name: 'Ship' }]);
    controller.populateTilesetDropdown();
    assert.equal(controller.__select.options[0].value, '4',
        'the id prefix is presentation only and must not leak into the saved value');
});

test('both tileset pickers label the same database entry identically', () => {
    // A tileset numbered here and numbered differently in the Change Tileset
    // command would read as two different records.
    const changeTileset = fs.readFileSync(
        path.join(editorRoot, 'src', 'event', 'commands', 'ChangeTilesetEditor.js'), 'utf8');
    const controllerSrc = fs.readFileSync(
        path.join(editorRoot, 'src', 'ProjectController.js'), 'utf8');
    assert.match(changeTileset, /padStart\(4, '0'\)/);
    const at = controllerSrc.indexOf('populateTilesetDropdown() {');
    const body = controllerSrc.slice(at, controllerSrc.indexOf('\n    selectTilesetOption', at));
    assert.match(body, /padStart\(4, '0'\)/);
});
