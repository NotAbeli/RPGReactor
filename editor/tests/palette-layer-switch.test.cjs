const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const viewerSource = fs.readFileSync(path.join(editorRoot, 'src', 'TilesetPaletteViewer.js'), 'utf8');
const sheetsSource = fs.readFileSync(path.join(editorRoot, 'src', 'utils', 'TilesetSheets.js'), 'utf8');

function viewerOn(layer, selection) {
    const info = { innerHTML: '', style: {} };
    const elements = {
        'selection-info': info,
        'tileset-preview-container': { style: {} },
        'region-ui-container': { style: {} }
    };
    const documentStub = {
        getElementById: id => elements[id] || null,
        querySelectorAll: () => [],
        querySelector: () => null,
        createElement: () => ({ style: {}, getContext: () => null })
    };
    const TilesetPaletteViewer = vm.runInNewContext(
        `${sheetsSource}\n${viewerSource}\nTilesetPaletteViewer;`,
        { console, process, require, nw: {}, window: {}, document: documentStub });

    const viewer = Object.create(TilesetPaletteViewer.prototype);
    viewer.currentLayer = layer;
    viewer.selectedTiles = selection;
    viewer.hidden = [];
    let previewHidden = 0;
    viewer.mapEditor = { hideTilePreview: () => { previewHidden++; } };
    viewer.renderCurrentLayer = () => { viewer.__rendered = (viewer.__rendered || 0) + 1; };
    viewer.__info = info;
    viewer.__previewHidden = () => previewHidden;
    return viewer;
}

test('switching sheets drops the previous sheet selection', () => {
    // The palette redraws with nothing highlighted, so a surviving selection
    // meant a click painted tiles from a sheet the user was no longer looking
    // at — and with no highlight to explain why.
    const viewer = viewerOn('F', [{ x: 2, y: 3, layer: 'F' }, { x: 3, y: 3, layer: 'F' }]);
    viewer.selectLayer('G');

    assert.equal(viewer.currentLayer, 'G');
    // Length rather than deepEqual: selectLayer builds the replacement array
    // inside the vm realm, so its prototype is not the host's Array and a
    // strict deep comparison against [] fails on identity alone.
    assert.equal(viewer.selectedTiles.length, 0, 'the stale selection is gone');
});

test('the selection readout matches the cleared state', () => {
    const viewer = viewerOn('B', [{ x: 0, y: 0, layer: 'B' }]);
    viewer.selectLayer('C');
    assert.match(viewer.__info.innerHTML, /No tiles selected/);
});

test('the stale hover preview is dropped too', () => {
    // Nothing rebuilds the preview until the pointer moves again, so it would
    // otherwise sit there showing the old sheet's tile.
    const viewer = viewerOn('F', [{ x: 1, y: 1, layer: 'F' }]);
    viewer.selectLayer('G');
    assert.equal(viewer.__previewHidden(), 1);
});

test('re-selecting the current sheet keeps the selection', () => {
    // Clicking the active tab, or any code path that re-asserts the current
    // layer, must not throw away what the user has picked.
    const selection = [{ x: 4, y: 5, layer: 'D' }];
    const viewer = viewerOn('D', selection);
    viewer.selectLayer('D');
    assert.deepEqual(viewer.selectedTiles, selection);
    assert.equal(viewer.__previewHidden(), 0);
});

test('switching to the region tab clears it as well', () => {
    // Region painting has nothing to do with tile selection, and coming back
    // to a sheet should not resurrect a selection made before the detour.
    const viewer = viewerOn('E', [{ x: 1, y: 2, layer: 'E' }]);
    viewer.onRegionTabSelected = () => {};
    viewer.selectLayer('R');
    assert.equal(viewer.selectedTiles.length, 0);
});

test('the clear happens before the layer is switched over', () => {
    // Order matters: the guard compares against the outgoing layer, so writing
    // currentLayer first would make every switch look like a no-op.
    const at = viewerSource.indexOf('selectLayer(layerName) {');
    const body = viewerSource.slice(at, viewerSource.indexOf('\n    }', at));
    const guard = body.indexOf('if (layerName !== this.currentLayer)');
    const assign = body.indexOf('this.currentLayer = layerName;');
    assert.ok(guard >= 0 && assign > guard,
        'the comparison precedes the assignment');
});
