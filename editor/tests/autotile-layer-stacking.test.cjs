/**
 * Which A-layer slot a painted autotile lands in.
 *
 * Auto must distinguish ground replacement from decoration stacking while
 * still reconnecting a terrain to the layer occupied by its neighbors.
 *
 * Looking at the cell under the cursor is not enough on its own. A shape
 * is decided by neighbours on the *same* slot, so a stretch of road put down at
 * z0 beside road living at z1 cannot see it and both ends cap off against each
 * other — which is what a repaired stretch of road actually looked like. So a
 * tile first joins the slot its own terrain already occupies beside it.
 *
 * Without a matching neighbor, ground replaces z0 and decorations stack at z1.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const MapEditor = require(path.join(editorRoot, 'src', 'MapEditor.js'));

const PLANES = 6;
/** Kinds within a band, as tile ids. */
const A2 = kind => 2816 + kind * 48;
const A1 = kind => 2048 + kind * 48;

function makeEditor(width, height, layers = {}, { decorations = [] } = {}) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    for (const [z, cells] of Object.entries(layers)) {
        cells.forEach((tileId, index) => { data[Number(z) * plane + index] = tileId; });
    }
    const map = { width, height, data, tilesetId: 1 };
    const tilemapManager = {
        currentMap: map,
        TILE_WIDTH: 48, TILE_HEIGHT: 48,
        isA2DecorationKind: kind => decorations.includes(kind),
        tileTargetLayer: () => null,
        updateTiles() {}, renderMap() {}
    };
    const editor = new MapEditor(tilemapManager,
        { currentLayer: 'A', selectedTiles: [], tilesetTextures: {} });
    editor.layerMode = 'auto';
    return { editor, map, data, plane };
}

test('a different ground terrain replaces the first A slot', () => {
    const { editor } = makeEditor(1, 1, { 0: [A2(10)] });
    assert.equal(editor.getAutotilePlacementLayer(A2(9), 0, 0), 0);
    assert.equal(editor.getAutotilePlacementLayer(A2(11), 0, 0), 0);
    assert.equal(editor.getAutotilePlacementLayer(A1(0), 0, 0), 0);
});

test('the same terrain repainted replaces itself rather than stacking', () => {
    // Otherwise every stroke over ground you already painted would pile up a
    // second copy at z1. The authored maps never stack a kind on itself.
    const { editor } = makeEditor(1, 1, { 0: [A2(10) + 17] });
    assert.equal(editor.getAutotilePlacementLayer(A2(10), 0, 0), 0,
        'any of a kind\'s 48 shapes is the same terrain');
});

test('painting onto bare ground uses the ground slot', () => {
    const { editor } = makeEditor(1, 1, {});
    assert.equal(editor.getAutotilePlacementLayer(A2(9), 0, 0), 0);
});

test('Auto paints a ground autotile over water on layer 1 and connects the stroke', () => {
    const water = A1(0), sand = A2(0);
    const waterPlane = new Array(15).fill(water);
    const { editor, data, plane } = makeEditor(5, 3, {
        0: waterPlane
    });
    editor.getBaseTileIdFromPalettePosition = () => sand;
    const paletteTile = { x: 0, y: 0, layer: 'A2' };

    for (let x = 1; x <= 3; x++) {
        editor.paintSingleTileFromPalette(x, 1, paletteTile);
    }

    for (let x = 1; x <= 3; x++) {
        const at = 5 + x;
        assert.equal(editor.sameAutotileKind(data[at], sand), true,
            'sand replaces water on the first map layer');
        assert.equal(data[plane + at], 0, 'Auto does not stack ground on the second map layer');
    }
    assert.deepEqual(data.slice(6, 9).map(tileId => tileId - sand), [43, 33, 45],
        'the stroke gets connected left, middle, and right autotile shapes');
});

test('a chosen layer still wins over all of it', () => {
    const { editor } = makeEditor(1, 1, { 0: [A2(10)] });
    for (const mode of [0, 1, 2, 3]) {
        editor.layerMode = mode;
        assert.equal(editor.getAutotilePlacementLayer(A2(9), 0, 0), mode);
    }
});

test('terrains are told apart by kind, and by band', () => {
    const { editor } = makeEditor(1, 1, {});
    assert.equal(editor.sameAutotileKind(A2(5), A2(5) + 47), true, 'all 48 shapes are one terrain');
    assert.equal(editor.sameAutotileKind(A2(5), A2(6)), false);
    // The fifth kind of A1 and the fifth of A2 are different terrains that
    // happen to share a number.
    assert.equal(editor.sameAutotileKind(A1(5), A2(5)), false);
    // A5 is not an autotile: each id is its own picture.
    assert.equal(editor.sameAutotileKind(1600, 1600), true);
    assert.equal(editor.sameAutotileKind(1600, 1601), false);
    assert.equal(editor.sameAutotileKind(0, A2(5)), false, 'an empty cell is no terrain');
});

test('a road erased and painted back rejoins the road either side', () => {
    // The reported case end to end. The road sits at z1 over ground at z0;
    // erasing takes the topmost slot, so the ground stays. Painting it back
    // used to land at z0, where the shape calculation — which only looks at
    // the slot being painted — saw no road either side and capped the piece
    // off at both ends.
    const road = A2(9), ground = A2(10);
    const { editor, data, plane } = makeEditor(5, 1, {
        0: new Array(5).fill(ground),
        1: [road + 34, road + 34, road + 34, road + 34, road + 34]
    });

    const erased = editor.eraseTile(2, 0, data, 5, 1, plane);
    assert.deepEqual(erased, [1], 'the road goes, the ground stays');
    assert.equal(data[plane + 2], 0);
    assert.equal(data[2], ground, 'ground untouched');

    const slot = editor.getAutotilePlacementLayer(road, 2, 0);
    assert.equal(slot, 1, 'it goes back where its neighbours are');

    const { shape } = editor.calculateAutotileShape(road, 2, 0, null, slot);
    // Shape 46 is the isolated piece — bordered on every side, which is the
    // hard end cap that was reported. A piece with road east and west of it
    // must not be that.
    assert.notEqual(shape, 46, 'not capped off as an isolated piece');
    const { shape: onGroundSlot } = editor.calculateAutotileShape(road, 2, 0, null, 0);
    assert.notEqual(shape, onGroundSlot,
        'and the slot is what makes the difference — z0 sees no road at all');
});

test('a table painted on a floor leaves the floor underneath', () => {
    const floor = A2(0), table = A2(13);
    const { editor, data } = makeEditor(1, 1, { 0: [floor] }, { decorations: [13] });
    const slot = editor.getAutotilePlacementLayer(table, 0, 0);
    assert.equal(slot, 1, 'the table sits above the floor');
    assert.equal(data[0], floor, 'which is still there');
});

test('a decoration stacks over the first A slot', () => {
    const { editor } = makeEditor(1, 1, { 0: [A2(10)] }, { decorations: [13] });
    assert.equal(editor.getAutotilePlacementLayer(A2(13), 0, 0), 1);
});

test('a lower-layer decoration neighbor cannot make an extension erase the floor', () => {
    const floor = A2(0), decoration = A2(13);
    const { editor, data, plane } = makeEditor(2, 1, {
        0: [decoration, floor]
    }, { decorations: [13] });
    editor.getBaseTileIdFromPalettePosition = () => decoration;

    editor.paintSingleTileFromPalette(1, 0, { x: 0, y: 0, layer: 'A2' });

    assert.equal(data[1], floor, 'the existing floor remains on layer 1');
    assert.equal(editor.sameAutotileKind(data[plane + 1], decoration), true,
        'the decoration extends on layer 2');
});

test('different A1 water kinds stack while the same water replaces itself', () => {
    const shallow = A1(0), deep = A1(1);
    const { editor, data, plane } = makeEditor(1, 1, { 0: [shallow] });
    assert.equal(editor.getAutotilePlacementLayer(shallow, 0, 0), 0);
    assert.equal(editor.getAutotilePlacementLayer(deep, 0, 0), 1);

    editor.getBaseTileIdFromPalettePosition = () => deep;
    editor.paintSingleTileFromPalette(0, 0, { x: 0, y: 0, layer: 'A1' });
    assert.equal(editor.sameAutotileKind(data[0], shallow), true);
    assert.equal(editor.sameAutotileKind(data[plane], deep), true);
});

test('a tile joins the slot its own terrain already occupies beside it', () => {
    // The reported case. Road runs at z1 over ground at z0; the middle of the
    // run was repaired onto z0 by the old rule and now reads as three pieces.
    // Painting beside the surviving z1 road has to land at z1, or the join
    // cannot be made whatever the shape calculation then does.
    const road = A2(9), ground = A2(10);
    const { editor } = makeEditor(4, 1, {
        0: [ground, road, road, ground],
        1: [road, 0, 0, road]
    });
    assert.equal(editor.adjacentAutotileLayer(road, 1, 0), 1, 'road at z1 to the west');
    assert.equal(editor.getAutotilePlacementLayer(road, 1, 0), 1,
        'so it goes to z1 even though z0 holds the same kind');
    assert.equal(editor.adjacentAutotileLayer(road, 2, 0), 1, 'road at z1 to the east');
});

test('the ground slot is joined too, when that is where the terrain lives', () => {
    const grass = A2(4);
    const { editor } = makeEditor(3, 1, { 0: [grass, 0, 0] });
    assert.equal(editor.adjacentAutotileLayer(grass, 1, 0), 0);
    assert.equal(editor.getAutotilePlacementLayer(grass, 1, 0), 0);
});

test('the upper slot wins when the terrain is on both sides at different levels', () => {
    const road = A2(9), ground = A2(10);
    const { editor } = makeEditor(3, 1, {
        0: [road, ground, 0],
        1: [0, 0, road]
    });
    // West neighbour has it at z0, east at z1. Continuing the run above wins.
    assert.equal(editor.adjacentAutotileLayer(road, 1, 0), 1);
});

test('nothing of the kind nearby leaves ground on the first A slot', () => {
    const road = A2(9), ground = A2(10);
    const { editor } = makeEditor(3, 1, { 0: [ground, ground, ground] });
    assert.equal(editor.adjacentAutotileLayer(road, 1, 0), null);
    assert.equal(editor.getAutotilePlacementLayer(road, 1, 0), 0, 'ground replaces the ground slot');
});

test('only the four sides are asked, as an autotile shape is', () => {
    const road = A2(9);
    const { editor } = makeEditor(3, 3, { 1: [road, 0, 0, 0, 0, 0, 0, 0, 0] });
    // The road is diagonally adjacent to the middle cell, which is no
    // adjacency at all as far as a shape is concerned.
    assert.equal(editor.adjacentAutotileLayer(road, 1, 1), null);
});

test('a repainted stretch rejoins the road when it is dragged across', () => {
    // End to end, on the damaged shape the old rule produced: road at z1 either
    // side of a stretch sitting at z0. Painting across it, each cell in turn,
    // must leave one continuous run on one slot.
    const road = A2(9), ground = A2(10);
    const width = 8;
    const { editor, data, plane } = makeEditor(width, 1, {
        0: [ground, ground, road, road, road, road, ground, ground],
        1: [road, road, 0, 0, 0, 0, road, road]
    });
    editor.getBaseTileIdFromPalettePosition = () => road;
    for (const x of [2, 3, 4, 5]) {
        editor.paintSingleTileFromPalette(x, 0, { x: 0, y: 0, layer: 'A2' });
    }
    const slots = [];
    for (let x = 0; x < width; x++) {
        slots.push(editor.sameAutotileKind(data[plane + x], road) ? 1 : 0);
    }
    assert.deepEqual(slots, [1, 1, 1, 1, 1, 1, 1, 1],
        'the whole road ends up on one slot');
    assert.equal(data.slice(2, 6).some(tile => editor.sameAutotileKind(tile, road)), false,
        'the repaired cells do not keep hidden lower-layer duplicates');

    // And with them all on one slot, the middle is no longer an end piece.
    const { shape } = editor.calculateAutotileShape(road, 3, 0, null, 1);
    assert.notEqual(shape, 46, 'not isolated');
});
