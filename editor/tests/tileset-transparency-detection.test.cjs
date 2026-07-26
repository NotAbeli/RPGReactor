const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const viewerSource = fs.readFileSync(path.join(editorRoot, 'src', 'TilesetPaletteViewer.js'), 'utf8');

const TILE = 48;

/**
 * A scratch canvas that reproduces the one behaviour under test: drawImage
 * copies a tile out of a synthetic sheet, and getImageData returns the alpha of
 * exactly the rectangle asked for. `opaqueRows` describes which rows of the
 * source tile carry art.
 */
function makeEnvironment(opaqueRows) {
    let drawn = null;
    const context = {
        clearRect() { drawn = null; },
        drawImage(_img, sx, sy) { drawn = { sx, sy }; },
        getImageData(x, y, width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let row = 0; row < height; row++) {
                const sourceRow = y + row;
                if (!opaqueRows.has(sourceRow)) continue;
                for (let col = 0; col < width; col++) {
                    data[(row * width + col) * 4 + 3] = 255;
                }
            }
            return { data };
        }
    };
    const documentStub = {
        createElement: () => ({ width: 0, height: 0, getContext: () => context }),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const TilesetPaletteViewer = vm.runInNewContext(`${viewerSource}\nTilesetPaletteViewer;`, {
        console, process, require, nw: {}, window: {}, document: documentStub
    });
    const viewer = Object.create(TilesetPaletteViewer.prototype);
    viewer.currentLayer = 'B';
    viewer.tilesetTextures = { B: { width: TILE * 8, height: TILE * 16 } };
    return { viewer, drawnAt: () => drawn };
}

test('a tile whose art is only a sliver at the top is not called transparent', () => {
    // The reported case: a few pixels continuing an object from the tile above.
    const { viewer } = makeEnvironment(new Set([0, 1, 2]));
    viewer.selectedTiles = [{ x: 3, y: 5, layer: 'B' }];

    assert.equal(viewer.isSelectionTransparent(), false,
        'sampling only the centre missed this and armed the eraser');
});

test('art hugging any edge counts, not just the centre', () => {
    for (const rows of [[0], [TILE - 1], [1, 2]]) {
        const { viewer } = makeEnvironment(new Set(rows));
        viewer.selectedTiles = [{ x: 0, y: 0, layer: 'B' }];
        assert.equal(viewer.isSelectionTransparent(), false, `rows ${rows} are opaque`);
    }
});

test('a genuinely empty tile is still reported transparent, so the eraser still arms', () => {
    const { viewer } = makeEnvironment(new Set());
    viewer.selectedTiles = [{ x: 0, y: 0, layer: 'B' }];
    assert.equal(viewer.isSelectionTransparent(), true);
});

test('a mixed selection is opaque as soon as one tile carries art', () => {
    const { viewer } = makeEnvironment(new Set([0, 1, 2]));
    viewer.selectedTiles = [
        { x: 3, y: 4, layer: 'B' },
        { x: 3, y: 5, layer: 'B' }
    ];
    assert.equal(viewer.isSelectionTransparent(), false,
        'selecting the sliver together with its parent already worked; alone must too');
});

test('the tile is read from its own position on the source sheet', () => {
    const { viewer, drawnAt } = makeEnvironment(new Set([0]));
    viewer.selectedTiles = [{ x: 3, y: 5, layer: 'B' }];
    viewer.isSelectionTransparent();
    assert.deepEqual({ ...drawnAt() }, { sx: 3 * TILE, sy: 5 * TILE });
});

test('autotile layers are left alone, since their grid is a preview', () => {
    for (const layer of ['A1', 'A2', 'A3', 'A4']) {
        const { viewer } = makeEnvironment(new Set());
        viewer.selectedTiles = [{ x: 0, y: 0, layer }];
        assert.equal(viewer.isSelectionTransparent(), false,
            `${layer} must never be judged transparent from sheet pixels`);
    }
});

test('the whole tile is sampled, not a cropped window', () => {
    assert.match(viewerSource, /getImageData\(0, 0, tileSize, tileSize\)/);
    assert.doesNotMatch(viewerSource, /getImageData\(12, 12, 24, 24\)/);
});
