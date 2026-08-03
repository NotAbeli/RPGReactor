/**
 * The shadow a wall casts.
 *
 * RPG Maker fills the *left half* of the cell immediately east of a wall —
 * quadrant bits 0x01 (bottom-left) and 0x04 (top-left) — and takes it away
 * again when the wall goes. Reactor drew no shadow at all: the only thing that
 * wrote the shadow plane was the shadow pen, so a wall placed in the editor had
 * none, and one that arrived inside a pasted stamp brought whatever shadow had
 * been lifted with it, whether or not there was a wall left to cast it.
 *
 * The rule is read off the authored maps rather than guessed. Of 39,104 shadow
 * cells across the bundled projects, 85.6% carry exactly the 0x05 pattern, and
 * much the commonest thing beside a shadow is a wall immediately west of it.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const MapEditor = require(path.join(editorRoot, 'src', 'MapEditor.js'));

const PLANES = 6;
const SHADOW_PLANE = 4;
/** An A4 wall kind — the wall rows, which is what casts. */
const WALL = 5888 + 8 * 48;
/** An A4 *roof* kind, from an even row: terrain, and it casts nothing. */
const ROOF = 5888 + 0 * 48;
const LEFT_HALF = 0x05;
const RIGHT_HALF = 0x0A;

/** A palette holding one wall kind, so the area tools have something to paint. */
function wallPalette() {
    // A4 wall kind 8 sits at palette column 0, row 1 of the A4 grid.
    return { currentLayer: 'A', selectedTiles: [{ x: 0, y: 1, layer: 'A4' }],
        tilesetTextures: {}, clearSelection() {} };
}

function editorOn(width = 10, height = 5) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    const map = { width, height, data, tilesetId: 1 };
    const tilemapManager = {
        currentMap: map, TILE_WIDTH: 48, TILE_HEIGHT: 48,
        isA2DecorationKind: () => false, updateTiles() {}, renderMap() {}
    };
    const editor = new MapEditor(tilemapManager, {
        currentLayer: 'A', selectedTiles: [], tilesetTextures: {}, clearSelection() {}
    });
    editor.layerMode = 'auto';
    const shadowAt = (x, y) => data[SHADOW_PLANE * plane + y * width + x] || 0;
    const setShadow = (x, y, bits) => { data[SHADOW_PLANE * plane + y * width + x] = bits; };
    const put = (x, y, tileId, layer = 0) => { data[layer * plane + y * width + x] = tileId; };
    /** Do an edit with the shadow pass wrapped round it, as the editor does. */
    const edit = (cells, mutate) => {
        const before = editor.captureWallState(cells);
        mutate();
        return editor.refreshAutoShadow(before);
    };
    return { editor, map, data, shadowAt, setShadow, put, edit };
}

test('a wall casts on the cell east of it', () => {
    const { shadowAt, put, edit } = editorOn();
    const updates = edit([{ x: 2, y: 1 }, { x: 3, y: 1 }], () => {
        put(2, 1, WALL + 1);
        put(3, 1, WALL + 4);
    });
    assert.equal(shadowAt(4, 1), LEFT_HALF, 'the left half of the cell beyond the wall');
    assert.equal(shadowAt(2, 1), 0, 'not on the wall itself');
    assert.equal(shadowAt(3, 1), 0, 'nor between two cells of the same wall');
    assert.equal(shadowAt(1, 1), 0, 'and nothing to the west');
    assert.ok(updates.some(update => update.x === 4 && update.y === 1 && update.layer === 4),
        'and the change is reported so the shadow plane redraws');
});

test('erasing the wall takes its shadow with it', () => {
    // The report: erasing an autotile left the shadow behind, which is how it
    // was noticed at all.
    const { shadowAt, put, edit } = editorOn();
    edit([{ x: 3, y: 1 }], () => put(3, 1, WALL));
    assert.equal(shadowAt(4, 1), LEFT_HALF);

    edit([{ x: 3, y: 1 }], () => put(3, 1, 0));
    assert.equal(shadowAt(4, 1), 0, 'gone with the wall');
});

test('a shadow painted by hand in the other half survives', () => {
    // Only the two quadrants a wall casts are ever touched, so the pen's work
    // is not rubbed out by building a wall beside it — or by removing one.
    const { shadowAt, setShadow, put, edit } = editorOn();
    setShadow(4, 1, RIGHT_HALF);

    edit([{ x: 3, y: 1 }], () => put(3, 1, WALL));
    assert.equal(shadowAt(4, 1), 0x0F, 'both halves are shadowed now');

    edit([{ x: 3, y: 1 }], () => put(3, 1, 0));
    assert.equal(shadowAt(4, 1), RIGHT_HALF, 'and the painted half is still there');
});

test('a wall casts nothing onto another wall', () => {
    // There is nothing for it to fall on, and the authored maps agree: only
    // 4.7% of shadow cells hold a wall themselves.
    const { shadowAt, put, edit } = editorOn();
    edit([{ x: 2, y: 1 }, { x: 3, y: 1 }], () => {
        put(2, 1, WALL);
        put(3, 1, WALL);
    });
    assert.equal(shadowAt(3, 1), 0);
    assert.equal(shadowAt(4, 1), LEFT_HALF, 'the run casts past its east end');
});

test('only wall autotiles cast', () => {
    // A4 alternates roof rows and wall rows, and a roof is terrain.
    const { shadowAt, put, edit } = editorOn();
    edit([{ x: 2, y: 1 }], () => put(2, 1, ROOF));
    assert.equal(shadowAt(3, 1), 0, 'a roof casts nothing');

    edit([{ x: 5, y: 1 }], () => put(5, 1, 2816 + 4 * 48));
    assert.equal(shadowAt(6, 1), 0, 'nor does A2 ground');
});

test('a wall on any layer casts', () => {
    // Walls are painted onto whichever A-slot the stacking rules chose, and a
    // wall is a wall wherever it sits.
    const { shadowAt, put, edit } = editorOn();
    edit([{ x: 2, y: 1 }], () => put(2, 1, WALL, 1));
    assert.equal(shadowAt(3, 1), LEFT_HALF);
});

test('a wall at the map edge casts nothing off the map', () => {
    const { shadowAt, put, edit, data } = editorOn(4, 3);
    edit([{ x: 3, y: 1 }], () => put(3, 1, WALL));
    assert.equal(shadowAt(3, 1), 0);
    // Nothing wrapped onto the next row, which is what an unclamped x + 1 does.
    assert.equal(data[SHADOW_PLANE * 12 + 2 * 4 + 0], 0);
});

test('an edit that moves no wall changes no shadow', () => {
    // The pass keys off walls coming and going, not off cells being touched.
    // Filling a floor under a wall that was already there must not conjure a
    // shadow the author never asked for.
    const { shadowAt, put, edit } = editorOn();
    put(3, 1, WALL, 3);                       // a wall already standing
    const updates = edit([{ x: 3, y: 1 }], () => put(3, 1, 2816 + 4 * 48, 0));
    assert.deepEqual(updates, [], 'nothing reported');
    assert.equal(shadowAt(4, 1), 0, 'and no shadow invented');
});

test('the rectangle tool casts too', () => {
    // The area tools take their own path through the editor and were missed
    // when the shadow pass was first wired in, so each is pinned here.
    const { editor, shadowAt, data } = editorOn(10, 6);
    editor.tilesetPaletteViewer = wallPalette();
    editor.paintRectangle({ x: 2, y: 1 }, { x: 4, y: 3 });

    for (let y = 1; y <= 3; y++) {
        assert.ok(data[2 + y * 10] >= 5888, `a wall was painted at (2, ${y})`);
        assert.equal(shadowAt(5, y), LEFT_HALF, `and casts east of the block at row ${y}`);
        assert.equal(shadowAt(3, y), 0, 'not between two cells of the same wall');
    }
    assert.equal(shadowAt(5, 0), 0, 'and nothing above the block');
    assert.equal(shadowAt(5, 4), 0, 'nor below it');
});

test('the circle tool casts too', () => {
    const { editor, shadowAt } = editorOn(12, 9);
    editor.tilesetPaletteViewer = wallPalette();
    editor.paintCircle({ x: 5, y: 4 }, { x: 8, y: 4 });

    // Whatever the circle's exact footprint, every cell just east of a painted
    // wall carries the shadow and no cell inside the disc does.
    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 12; x++) {
            const expected = editor.wallAt(x - 1, y) && !editor.wallAt(x, y) ? LEFT_HALF : 0;
            assert.equal(shadowAt(x, y), expected, `cell (${x}, ${y})`);
        }
    }
    assert.ok(editor.wallAt(5, 4), 'the circle actually painted something');
});

test('erasing an area takes its shadows with it', () => {
    const { editor, shadowAt } = editorOn(10, 6);
    editor.tilesetPaletteViewer = wallPalette();
    editor.paintRectangle({ x: 2, y: 1 }, { x: 4, y: 3 });
    assert.equal(shadowAt(5, 2), LEFT_HALF);

    const positions = [];
    for (let y = 1; y <= 3; y++) for (let x = 2; x <= 4; x++) positions.push({ x, y });
    editor.eraseTilesAtPositions(positions);

    for (let y = 1; y <= 3; y++) assert.equal(shadowAt(5, y), 0, `row ${y} is clear again`);
});
