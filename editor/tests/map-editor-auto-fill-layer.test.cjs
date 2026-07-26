const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const MapEditor = require(path.join(editorRoot, 'src', 'MapEditor.js'));

function makeMap(width = 3, height = 1) {
    return { width, height, data: new Array(width * height * 6).fill(0), tilesetId: 1 };
}

function makeEditor(map, { decoration = false } = {}) {
    const updates = [];
    const tilemapManager = {
        container: null,
        currentMap: map,
        isA2DecorationKind: () => decoration,
        updateTiles: changes => updates.push(...changes),
        renderMap() {},
    };
    const palette = {
        currentLayer: 'A',
        selectedTiles: [{ x: 0, y: 0, layer: 'A2' }],
        tilesetTextures: {},
    };
    const editor = new MapEditor(tilemapManager, palette);
    editor.getBaseTileIdFromPalettePosition = () => decoration ? 2864 : 2912;
    return { editor, updates };
}

test('Auto bucket fills a lower floor without deleting or reshaping upper walls', () => {
    const map = makeMap();
    const layerSize = map.width * map.height;
    map.data.splice(0, layerSize, 2816, 2817, 2818);
    map.data.splice(layerSize, layerSize, 101, 102, 103);
    map.data.splice(layerSize * 2, layerSize, 201, 202, 203);
    map.data.splice(layerSize * 3, layerSize, 5888 + 5, 5888 + 10, 5888 + 7);
    map.data.splice(layerSize * 4, layerSize, 1, 2, 3);
    map.data.splice(layerSize * 5, layerSize, 11, 12, 13);
    const upperPlanes = map.data.slice(layerSize, layerSize * 6);
    const { editor, updates } = makeEditor(map);
    const reshapedLayers = [];
    editor.calculateAutotileShape = (base, x, _y, _preview, layer) => {
        reshapedLayers.push(layer);
        return { tileId: base + x, shape: x };
    };

    editor.beginEditState();
    editor.fillArea(0, 0);
    editor.commitEditState();

    assert.deepEqual(map.data.slice(0, layerSize), [2912, 2913, 2914]);
    assert.deepEqual(map.data.slice(layerSize, layerSize * 6), upperPlanes);
    assert.deepEqual(new Set(reshapedLayers), new Set([0]));
    assert.ok(updates.length > 0);
    assert.ok(updates.every(update => update.layer === 0));
    assert.equal(editor.undoStack.length, 1);
    editor.undo();
    assert.deepEqual(map.data.slice(0, layerSize), [2816, 2817, 2818]);
    assert.deepEqual(map.data.slice(layerSize, layerSize * 6), upperPlanes);
});

test('Auto bucket fills through upper-wall differences using the lower terrain region', () => {
    const map = makeMap(4, 1);
    const layerSize = map.width;
    map.data.splice(0, layerSize, 2816, 2817, 2818, 2960);
    map.data.splice(layerSize * 3, layerSize, 0, 5888 + 3, 6000, 0);
    const walls = map.data.slice(layerSize * 3, layerSize * 4);
    const { editor } = makeEditor(map);
    editor.calculateAutotileShape = (base, x, _y, _preview, layer) => ({ tileId: base + x, shape: x, layer });

    editor.fillArea(0, 0);

    assert.deepEqual(map.data.slice(0, 3), [2912, 2913, 2914]);
    assert.equal(editor.normalizeTileIdForFillMatch(map.data[3]), 2960, 'the boundary keeps its terrain kind');
    assert.deepEqual(map.data.slice(layerSize * 3, layerSize * 4), walls);
});

test('Auto decoration bucket replaces only its resolved second A slot', () => {
    const map = makeMap(2, 1);
    const layerSize = map.width;
    map.data.splice(0, layerSize, 2816, 2817);
    map.data.splice(layerSize, layerSize, 120, 121);
    map.data.splice(layerSize * 2, layerSize, 220, 221);
    map.data.splice(layerSize * 3, layerSize, 320, 321);
    const lowerFloor = map.data.slice(0, layerSize);
    const upperPlanes = map.data.slice(layerSize * 2, layerSize * 4);
    const { editor } = makeEditor(map, { decoration: true });
    const reshapedLayers = [];
    editor.calculateAutotileShape = (base, x, _y, _preview, layer) => {
        reshapedLayers.push(layer);
        return { tileId: base + x, shape: x };
    };

    editor.fillArea(0, 0);

    assert.deepEqual(map.data.slice(0, layerSize), lowerFloor);
    assert.deepEqual(map.data.slice(layerSize, layerSize * 2), [2864, 2865]);
    assert.deepEqual(map.data.slice(layerSize * 2, layerSize * 4), upperPlanes);
    assert.deepEqual(new Set(reshapedLayers), new Set([1]));
});
