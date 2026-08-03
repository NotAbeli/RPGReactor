/**
 * Which z-slot a B-G tile lands on.
 *
 * Reported as: "things on tab A are put on layer 1, B on layer 2, C on 3, D on
 * 4 — the letters are where they are getting their layer priorities". Exactly
 * so: the tab's letter chose the slot, and the search for a free one then ran
 * *upwards* from it, so the same object dropped from two tabs sat at two
 * different depths and a B tile went underneath a C tile for no reason.
 *
 * RPG Maker does not work that way, and its own maps say so. Across the
 * bundled projects, of 256,366 cells carrying exactly one B-G tile, 90.8% have
 * it on z3 and 8.9% on z2; of the 45,075 carrying two, 99.8% use z2 and z3
 * together. B, C, D and E each sit on z2/z3 in the same proportions — the sheet
 * makes no difference. Every picture sheet starts at the top of the stack, and
 * only the A tabs own the ground.
 *
 * Which *way* a cell fills is not something those counts can answer — two tiles
 * end up at z2 and z3 whichever order they were laid down in. It is settled by
 * what the map draws: z3 covers z2, so painting one thing over another has to
 * put the new one above, or the tile just placed vanishes behind the tile
 * placed before it. So the top slot is always taken and the stack moves down
 * beneath it, which is also what leaves that z2+z3 pairing, older underneath.
 * Putting something *below* what is already there is what choosing a layer by
 * hand is for.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const MapEditor = require(path.join(editorRoot, 'src', 'MapEditor.js'));

const PLANES = 6;
/** First tile id of each picture sheet. */
const SHEET_BASE = { B: 0, C: 256, D: 512, E: 768, F: 1024, G: 1280 };

function editorOn(width = 4, height = 1, { starred = [] } = {}) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    const map = { width, height, data, tilesetId: 1 };
    // The star flag, 0x10: "draws above characters".
    const flags = [];
    for (const tileId of starred) flags[tileId] = 0x10;
    const editor = new MapEditor({
        currentMap: map, TILE_WIDTH: 48, TILE_HEIGHT: 48,
        currentTileset: { flags },
        isHigherTile: tileId => !!(flags[tileId] & 0x10),
        isA2DecorationKind: () => false, updateTiles() {}, renderMap() {}
    }, { currentLayer: 'A', selectedTiles: [], tilesetTextures: {}, clearSelection() {} });
    editor.layerMode = 'auto';
    const at = (x, y, layer) => data[layer * plane + y * width + x] || 0;
    const put = (x, y, layer, tileId) => { data[layer * plane + y * width + x] = tileId; };
    return { editor, map, data, at, put, plane, width, height };
}

test('every picture sheet starts at the top of the stack', () => {
    // The heart of the report: the letter decided the slot.
    const { editor } = editorOn();
    for (const key of Object.keys(SHEET_BASE)) {
        assert.equal(editor.getLayerIndex(key), 3, `${key} starts at z3`);
    }
});

test('the A tabs still own the ground', () => {
    const { editor } = editorOn();
    for (const key of ['A', 'A1', 'A2', 'A3', 'A4', 'A5']) {
        assert.equal(editor.getLayerIndex(key), 0, `${key} starts at z0`);
    }
});

test('a tile lands on the top slot when the cell is empty', () => {
    const { editor, data, width, height } = editorOn();
    for (const key of Object.keys(SHEET_BASE)) {
        const layer = editor.findAvailableLayer(data, width, height, 0, 0,
            editor.getLayerIndex(key));
        assert.equal(layer, 3, `a ${key} tile goes to z3`);
    }
});

test('a second tile goes on top of the first, not behind it', () => {
    // The point of the whole thing: paint one object over another and the one
    // you just placed has to be the one you can see.
    const { editor, data, at, put, width, height } = editorOn();
    put(0, 0, 3, SHEET_BASE.B + 5);

    assert.equal(editor.findAvailableLayer(data, width, height, 0, 0, 3), -2,
        'the top slot is taken, so the stack shifts rather than going underneath');

    editor.shiftLayersDown(data, width, height, 0, 0, SHEET_BASE.C + 7);
    assert.equal(at(0, 0, 3), SHEET_BASE.C + 7, 'the new tile is on top');
    assert.equal(at(0, 0, 2), SHEET_BASE.B + 5, 'and the older one is beneath it');
    // Which is the z2+z3 pairing the authored maps are full of.
    assert.equal(at(0, 0, 1), 0);
});

test('a picture tile never lands on the ground slot', () => {
    // z0 belongs to the terrain, and shifting preserves it however many tiles
    // are piled into the cell — a crate must not rub out the floor under it.
    const { editor, data, at, put, width, height } = editorOn();
    // Non-zero ids: tile 0 is the B sheet's first cell and also means "empty",
    // so filling a slot with it fills nothing.
    put(0, 0, 0, 2816);
    put(0, 0, 3, SHEET_BASE.B + 1);
    put(0, 0, 2, SHEET_BASE.C + 1);
    put(0, 0, 1, SHEET_BASE.D + 1);

    editor.shiftLayersDown(data, width, height, 0, 0, SHEET_BASE.E + 1);
    assert.equal(at(0, 0, 0), 2816, 'the terrain is still there');
    assert.equal(at(0, 0, 3), SHEET_BASE.E + 1, 'the newest on top');
    assert.equal(at(0, 0, 1), SHEET_BASE.C + 1, 'the oldest picture tile falls off the bottom');
});

test('a full stack shifts down and keeps the newest on top', () => {
    // -2 means "shift". The oldest falls off the bottom, the rest move down,
    // and the tile just placed sits at z3 where the next one will look first.
    const { editor, data, at, put, width, height } = editorOn();
    put(0, 0, 0, 2816);                       // terrain, which must survive
    put(0, 0, 1, SHEET_BASE.B + 1);
    put(0, 0, 2, SHEET_BASE.B + 2);
    put(0, 0, 3, SHEET_BASE.B + 3);

    editor.shiftLayersDown(data, width, height, 0, 0, SHEET_BASE.G + 9);

    assert.equal(at(0, 0, 0), 2816, 'the terrain is untouched');
    assert.equal(at(0, 0, 3), SHEET_BASE.G + 9, 'the new tile is on top');
    assert.equal(at(0, 0, 2), SHEET_BASE.B + 3, 'and the others moved down');
    assert.equal(at(0, 0, 1), SHEET_BASE.B + 2);
});

test('the F and G sheets behave exactly like B to E', () => {
    // They are Reactor's added sheets and were lumped in with D at z3 by
    // accident rather than by rule; now they are on the rule.
    const { editor, data, width, height } = editorOn();
    assert.equal(editor.getLayerIndex('F'), editor.getLayerIndex('B'));
    assert.equal(editor.getLayerIndex('G'), editor.getLayerIndex('E'));
    assert.equal(editor.findAvailableLayer(data, width, height, 0, 0,
        editor.getLayerIndex('G')), 3);
});

test('a chosen layer still overrides the stacking', () => {
    const { editor, data, put, width, height } = editorOn();
    put(0, 0, 2, SHEET_BASE.B);
    for (const mode of [0, 1, 2, 3]) {
        editor.layerMode = mode;
        assert.equal(editor.findAvailableLayer(data, width, height, 0, 0, 3), mode,
            `layer ${mode} is used as chosen, occupied or not`);
    }
});

test('a plain tile slides under an overhang rather than shoving it down', () => {
    // The star flag means "draws above characters" — a canopy, an archway, the
    // top of a doorway. Painting a plain tile into a cell holding one of those
    // must not displace it; the overhang is the thing meant to be in front.
    // The authored maps agree: of 14,066 stacked pairs where exactly one is
    // starred, it is the upper of the two 84% of the time.
    const canopy = SHEET_BASE.B + 9;
    const crate = SHEET_BASE.C + 3;
    const { editor, data, put, width, height } = editorOn(4, 1, { starred: [canopy] });
    put(0, 0, 3, canopy);

    assert.equal(editor.findAvailableLayer(data, width, height, 0, 0, 3, crate), 2,
        'the crate goes beneath the canopy, which keeps the top slot');
});

test('two overhangs still stack newest on top', () => {
    // Both starred, so neither is the one that has to stay in front and the
    // ordinary rule applies: the one just painted is the one you see.
    const canopy = SHEET_BASE.B + 9;
    const leaves = SHEET_BASE.C + 4;
    const { editor, data, put, width, height } = editorOn(4, 1, { starred: [canopy, leaves] });
    put(0, 0, 3, canopy);
    assert.equal(editor.findAvailableLayer(data, width, height, 0, 0, 3, leaves), -2,
        'shifts, so the new overhang is on top');
});

test('an overhang painted over a plain tile goes on top', () => {
    // The other way round: the star is the new tile, so it takes the top slot
    // and the plain one moves down under it.
    const canopy = SHEET_BASE.B + 9;
    const crate = SHEET_BASE.C + 3;
    const { editor, data, put, width, height } = editorOn(4, 1, { starred: [canopy] });
    put(0, 0, 3, crate);
    assert.equal(editor.findAvailableLayer(data, width, height, 0, 0, 3, canopy), -2);
});

test('an overhang with a full stack beneath it still shifts', () => {
    // Sliding under is only possible while there is room. With every slot
    // taken the stack has to move, or the tile would go nowhere at all.
    const canopy = SHEET_BASE.B + 9;
    const crate = SHEET_BASE.C + 3;
    const { editor, data, put, width, height } = editorOn(4, 1, { starred: [canopy] });
    put(0, 0, 3, canopy);
    put(0, 0, 2, SHEET_BASE.D + 1);
    put(0, 0, 1, SHEET_BASE.E + 1);
    assert.equal(editor.findAvailableLayer(data, width, height, 0, 0, 3, crate), -2);
});

test('the star check survives a tileset that is not there yet', () => {
    // A map can be opened before its tileset resolves, and the layer choice
    // has to keep working rather than throwing.
    const { editor } = editorOn();
    editor.tilemapManager.isHigherTile = undefined;
    editor.tilemapManager.currentTileset = null;
    assert.equal(editor.drawsAboveCharacters(SHEET_BASE.B + 9), false);
    assert.equal(editor.drawsAboveCharacters(0), false, 'and an empty cell is not an overhang');
});
