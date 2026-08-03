/**
 * Pasting a sampled area that contains autotiles.
 *
 * Right-dragging the map lifts a rectangle and clicking puts it down again. A
 * stamp carries the tile ids it was lifted from, and an autotile id is a corner
 * arrangement rather than a picture — so a stretch taken out of the middle of a
 * wall arrives carrying middle-of-wall pieces, with no ends, and reads as a
 * wall someone has cut a slice out of.
 *
 * RPG Maker rebuilds the shapes on paste, so the copy comes down as a finished
 * wall of its own. Shift is what asks for the ids verbatim, exactly as it does
 * when painting a single autotile from the palette.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const MapEditor = require(path.join(editorRoot, 'src', 'MapEditor.js'));

const PLANES = 6;
/** An A4 wall kind — the wall rows use the 16-shape system with real end caps. */
const WALL = 5888 + 8 * 48;
const LEFT_CAP = 1;
const RIGHT_CAP = 4;

/**
 * A map with one wall run, and an editor holding it.
 *
 * The wall is built the way the editor would build it: capped at both ends,
 * plain in the middle.
 */
function wallMap({ width = 14, height = 8, at = { x: 1, y: 1 }, wide = 4, tall = 3 } = {}) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    for (let y = at.y; y < at.y + tall; y++) {
        for (let x = at.x; x < at.x + wide; x++) {
            const left = x === at.x ? LEFT_CAP : 0;
            const right = x === at.x + wide - 1 ? RIGHT_CAP : 0;
            data[y * width + x] = WALL + left + right;
        }
    }
    const map = { width, height, data, tilesetId: 1 };
    const tilemapManager = {
        currentMap: map, TILE_WIDTH: 48, TILE_HEIGHT: 48,
        isA2DecorationKind: () => false, updateTiles() {}, renderMap() {}
    };
    const editor = new MapEditor(tilemapManager, {
        currentLayer: 'A', selectedTiles: [], tilesetTextures: {}, clearSelection() {}
    });
    editor.layerMode = 'auto';
    const shapes = (x0, x1, y) => {
        const out = [];
        for (let x = x0; x <= x1; x++) {
            const tileId = data[y * width + x];
            out.push(tileId ? tileId - WALL : null);
        }
        return out;
    };
    return { editor, map, data, width, shapes };
}

test('a copied piece of wall is rebuilt into a wall of its own', () => {
    // The reported case. The two middle columns carry no caps at all, so put
    // down verbatim they read as a slice cut out of something bigger.
    const { editor, map, shapes } = wallMap();
    assert.deepEqual(shapes(1, 4, 2), [LEFT_CAP, 0, 0, RIGHT_CAP], 'the source wall');

    const stamp = editor.captureMapStamp(map, { x: 2, y: 1 }, { x: 3, y: 3 });
    assert.deepEqual([stamp.data[2] - WALL, stamp.data[3] - WALL], [0, 0],
        'lifted with no ends on it');

    editor.mapStamp = stamp;
    editor.preserveAutotileShape = false;
    editor.paintMapStamp(8, 1);

    assert.deepEqual(shapes(8, 9, 2), [LEFT_CAP, RIGHT_CAP],
        'and put down as a finished wall, capped at both ends');
});

test('Shift puts the pieces down exactly as they were lifted', () => {
    // The other half of the rule, and the same thing Shift means when painting
    // a single autotile from the palette.
    const { editor, map, shapes } = wallMap();
    const stamp = editor.captureMapStamp(map, { x: 2, y: 1 }, { x: 3, y: 3 });

    editor.mapStamp = stamp;
    editor.preserveAutotileShape = true;
    editor.paintMapStamp(8, 1);

    assert.deepEqual(shapes(8, 9, 2), [0, 0], 'no ends added');
});

test('Shift can claim the gesture while a stamp is held', () => {
    // The palette selection is cleared when a stamp is picked up, so the check
    // that decides whether Shift paints or pans has to know a stamp counts.
    const { editor, map } = wallMap();
    editor.mapStamp = editor.captureMapStamp(map, { x: 2, y: 1 }, { x: 3, y: 3 });
    editor.currentTool = 'pencil';
    editor.enabled = true;
    assert.equal(editor.canPreserveAutotileShape(), true);
    assert.equal(editor.claimsShiftAutotilePaint({
        data: { button: 0, originalEvent: { shiftKey: true } }
    }), true, 'or Shift would be read as a pan and nothing would be pasted');
});

test('a whole wall copied with its ends keeps them', () => {
    // Rebuilding must not mean "always add caps": a copy that already has its
    // ends, put down clear of anything else, comes out identical.
    const { editor, map, shapes } = wallMap();
    const stamp = editor.captureMapStamp(map, { x: 1, y: 1 }, { x: 4, y: 3 });
    editor.mapStamp = stamp;
    editor.preserveAutotileShape = false;
    editor.paintMapStamp(8, 1);
    assert.deepEqual(shapes(8, 11, 2), [LEFT_CAP, 0, 0, RIGHT_CAP]);
});

test('a copy pasted against an existing wall joins it', () => {
    // The border is rebuilt too, not just the pasted cells — otherwise the
    // wall already there keeps a cap facing the new piece and the two read as
    // separate walls touching.
    const { editor, map, shapes } = wallMap();
    const stamp = editor.captureMapStamp(map, { x: 2, y: 1 }, { x: 3, y: 3 });
    editor.mapStamp = stamp;
    editor.preserveAutotileShape = false;
    // Straight onto the wall's east end, continuing the run.
    editor.paintMapStamp(5, 1);

    const run = shapes(1, 6, 2);
    assert.equal(run[0], LEFT_CAP, 'the west end is still an end');
    assert.equal(run[5], RIGHT_CAP, 'the new east end is one now');
    assert.deepEqual(run.slice(1, 5), [0, 0, 0, 0],
        'and everything between is a continuous wall');
});

test('nothing but the shape-bearing bands is touched', () => {
    // A5 is not an autotile and B-G are pictures. Rebuilding either would
    // rewrite ids that mean a position on a sheet, not a corner arrangement.
    const { editor, map, data, width } = wallMap();
    const plane = width * map.height;
    // Just outside the pasted rectangle but inside the border the reshape
    // walks — the paste itself replaces everything it covers, which is a
    // different thing and is what a paste is for.
    data[1 * plane + 2 * width + 7] = 1600;   // A5, upper layer
    data[2 * plane + 2 * width + 10] = 300;   // B sheet
    const stamp = editor.captureMapStamp(map, { x: 2, y: 1 }, { x: 3, y: 3 });
    editor.mapStamp = stamp;
    editor.preserveAutotileShape = false;
    editor.paintMapStamp(8, 1);
    assert.equal(data[1 * plane + 2 * width + 7], 1600, 'the A5 tile is untouched');
    assert.equal(data[2 * plane + 2 * width + 10], 300, 'and the B-sheet one');
});
