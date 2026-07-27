const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const controllerSource = fs.readFileSync(path.join(editorRoot, 'src', 'ProjectController.js'), 'utf8');

/**
 * The heading and the name field are distinct elements, so the stub has to
 * resolve ids individually rather than returning one shared node.
 */
function controllerWith(mapData, { isNewMap = false, nameValue } = {}) {
    const elements = {
        'map-properties-title': { textContent: '' },
        'map-name-input': { value: nameValue !== undefined ? nameValue : (mapData?.name || '') }
    };
    const listeners = [];
    elements['map-name-input'].addEventListener = (type, handler) => listeners.push({ type, handler });
    elements['map-name-input'].removeEventListener = (type, handler) => {
        const at = listeners.findIndex(l => l.type === type && l.handler === handler);
        if (at >= 0) listeners.splice(at, 1);
    };

    const documentStub = { getElementById: id => elements[id] || null };
    const ProjectController = vm.runInNewContext(`${controllerSource}\nProjectController;`, {
        console, process, require, nw: {}, document: documentStub
    });

    const controller = Object.create(ProjectController.prototype);
    controller.currentEditingMap = mapData;
    controller.isCreatingNewMap = isNewMap;
    controller._t = key => key;
    controller._tt = text => text;
    controller.__elements = elements;
    controller.__listeners = listeners;
    return controller;
}

test('the heading names the map by id and name', () => {
    const controller = controllerWith({ id: 211, name: 'Canite City' });
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent,
        'mapProps.title | 211: Canite City');
});

test('map ids are zero padded to three digits, and larger ids are not cut', () => {
    for (const [id, expected] of [[1, '001'], [42, '042'], [999, '999'], [1042, '1042']]) {
        const controller = controllerWith({ id, name: 'Map' });
        controller.updateMapPropertiesTitle();
        assert.equal(controller.__elements['map-properties-title'].textContent,
            `mapProps.title | ${expected}: Map`);
    }
});

test('a new map keeps its own heading but still identifies itself', () => {
    // Creating a map already reserves its id, so the heading can show which
    // number the map will take before it is committed.
    const controller = controllerWith({ id: 25, name: 'New Map' }, { isNewMap: true });
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent,
        'mapCtx.newMap | 025: New Map');
});

test('the heading follows the name field, not the stored record', () => {
    // The point of the feature: renaming in General Settings retitles the
    // modal immediately, before anything is saved.
    const controller = controllerWith({ id: 7, name: 'Old Name' });
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent,
        'mapProps.title | 007: Old Name');

    controller.__elements['map-name-input'].value = 'Forest Path';
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent,
        'mapProps.title | 007: Forest Path');
    assert.equal(controller.currentEditingMap.name, 'Old Name',
        'and it does not write the edit back into the record, so Cancel still discards it');
});

test('an emptied name falls back rather than trailing a bare colon', () => {
    const controller = controllerWith({ id: 3, name: 'Something' }, { nameValue: '' });
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent,
        'mapProps.title | 003: common.unnamed');
});

test('a map with no id degrades to the name instead of printing 000', () => {
    const controller = controllerWith({ name: 'Orphan' });
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent,
        'mapProps.title | Orphan');
});

test('no map at all leaves the plain heading', () => {
    const controller = controllerWith(null);
    controller.updateMapPropertiesTitle();
    assert.equal(controller.__elements['map-properties-title'].textContent, 'mapProps.title');
});

test('modal controls are bound once, however often the modal is reopened', () => {
    // These elements are static in the document and outlive the modal, so a
    // fresh listener per open would stack up and one interaction would run the
    // handler repeatedly.
    const controller = controllerWith({ id: 5, name: 'Map' });

    for (let open = 0; open < 5; open++) {
        controller._bindMapPropertiesListener('map-name-input', 'input',
            () => controller.updateMapPropertiesTitle());
    }
    assert.equal(controller.__listeners.length, 1, 'reopening rebinds rather than accumulates');

    // A different event on the same element is tracked separately.
    controller._bindMapPropertiesListener('map-name-input', 'change', () => {});
    assert.equal(controller.__listeners.length, 2);

    // The surviving handler is the most recent one, so it closes over current state.
    let fired = 0;
    controller._bindMapPropertiesListener('map-name-input', 'input', () => { fired++; });
    assert.equal(controller.__listeners.length, 2);
    controller.__listeners.find(l => l.type === 'input').handler();
    assert.equal(fired, 1);
});

test('the three Map Properties checkboxes go through the same rebinding', () => {
    // They previously called addEventListener unconditionally on every open.
    for (const id of ['map-autoplay-bgm-checkbox', 'map-autoplay-bgs-checkbox',
                      'map-specify-battleback-checkbox']) {
        assert.match(controllerSource,
            new RegExp(`_bindMapPropertiesListener\\('${id}', 'change'`),
            `${id} is bound through the helper`);
        assert.doesNotMatch(controllerSource,
            new RegExp(`getElementById\\('${id}'\\)\\.addEventListener`),
            `${id} no longer binds directly`);
    }
});

test('the shipped modal wires the field the same way', () => {
    // Guard the two properties the behaviour depends on: listeners are bound
    // through the rebinding helper so reopening cannot stack them, and the
    // heading is composed after the form has been populated (composing earlier
    // would read an empty name field).
    assert.match(controllerSource,
        /_bindMapPropertiesListener\('map-name-input', 'input',\s*\n?\s*\(\) => this\.updateMapPropertiesTitle\(\)\)/);
    assert.match(controllerSource, /removeEventListener\(type, previous\)/);

    const populateAt = controllerSource.indexOf('this.populateMapPropertiesForm(mapData);');
    const titleAt = controllerSource.indexOf('this.updateMapPropertiesTitle();');
    assert.ok(populateAt >= 0 && titleAt > populateAt,
        'the heading is composed after the name field has been filled in');
});

test('the heading is assigned as text, never as markup', () => {
    // Map names are project-authored and reach a privileged editor surface.
    const at = controllerSource.indexOf('updateMapPropertiesTitle() {');
    assert.ok(at >= 0);
    const body = controllerSource.slice(at, controllerSource.indexOf('\n    populate', at));
    assert.doesNotMatch(body, /innerHTML/);
    assert.match(body, /title\.textContent =/);
});
