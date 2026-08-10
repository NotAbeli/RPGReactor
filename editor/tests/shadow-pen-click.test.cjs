/**
 * A single click of the shadow pen paints.
 *
 * It did not. The pen paints a *quadrant* of a cell and works out which one
 * from `lastMousePos`, and only `pointermove` ever set that field — so a press
 * with no move before it had nothing to read, `toggleShadow` took the missing
 * position as "cannot tell which quarter" and returned, and the click painted
 * nothing. Dragging worked perfectly, because the drag's first move filled the
 * field in. That is a strange shape of bug to report and an easy one to
 * dismiss as a slip of the hand.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const MapEditor = require(path.join(editorRoot, 'src', 'MapEditor.js'));

const PLANES = 6;
const SHADOW_PLANE = 4;
const TILE = 48;

function editorOn(width = 10, height = 5) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    const map = { width, height, data, tilesetId: 1 };
    const drawn = [];
    const tilemapManager = {
        currentMap: map, TILE_WIDTH: TILE, TILE_HEIGHT: TILE,
        isA2DecorationKind: () => false, updateTiles() {}, renderMap() {},
        updateShadowTile(x, y, bits) { drawn.push({ x, y, bits }); }
    };
    const editor = new MapEditor(tilemapManager, {
        currentLayer: 'A', selectedTiles: [], tilesetTextures: {}, clearSelection() {}
    });
    editor.shadowPenMode = true;
    const shadowAt = (x, y) => data[SHADOW_PLANE * plane + y * width + x] || 0;
    /** Press at a point inside the map, in pixels, the way the handler does. */
    const clickAt = (px, py) => {
        editor.lastMousePos = { x: px, y: py };
        editor.lastPaintedTile = { x: -1, y: -1, quadrant: -1 };
        editor.shadowPaintMode = null;
        editor.paintTile(Math.floor(px / TILE), Math.floor(py / TILE));
    };
    return { editor, data, shadowAt, drawn, clickAt };
}

test('one click paints the quadrant it landed in', () => {
    const { shadowAt, drawn, clickAt } = editorOn();
    // Bottom-right quarter of cell (2, 1): bit 3.
    clickAt(2 * TILE + 40, 1 * TILE + 40);
    assert.equal(shadowAt(2, 1), 1 << 3);
    assert.equal(drawn.length, 1, 'and the cell is redrawn');
});

test('each quadrant of a cell is its own', () => {
    const { shadowAt, clickAt } = editorOn();
    const cell = { x: 3, y: 2 };
    const corners = [
        [8, 8, 0],     // top-left
        [40, 8, 1],    // top-right
        [8, 40, 2],    // bottom-left
        [40, 40, 3]    // bottom-right
    ];
    let expected = 0;
    for (const [dx, dy, bit] of corners) {
        clickAt(cell.x * TILE + dx, cell.y * TILE + dy);
        expected |= 1 << bit;
        assert.equal(shadowAt(cell.x, cell.y), expected,
            `after the quadrant at +${dx},+${dy}`);
    }
});

test('clicking a painted quadrant takes it off again', () => {
    const { shadowAt, clickAt } = editorOn();
    clickAt(TILE + 8, TILE + 8);
    assert.equal(shadowAt(1, 1), 1 << 0, 'on');
    clickAt(TILE + 8, TILE + 8);
    assert.equal(shadowAt(1, 1), 0, 'and off, because a click is a toggle');
});

test('with no press position there is nothing to paint', () => {
    // The failure this file exists for, stated directly: the pen cannot guess a
    // quadrant, so it declines rather than picking one. That is the correct
    // behaviour of `toggleShadow` — the bug was that a press left it in this
    // state at all.
    const { editor, shadowAt } = editorOn();
    editor.lastMousePos = null;
    editor.paintTile(2, 2);
    assert.equal(shadowAt(2, 2), 0);
});

test('the press records where it landed, so the first click has a quadrant', () => {
    // The fix, at its source: the pointerdown handler stores the position it
    // just computed. Asserted here because the handler lives inside a PIXI
    // event binding that these tests do not stand up.
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor.js'), 'utf8');
    const down = source.slice(source.indexOf("_rrOn('pointerdown'"));
    const body = down.slice(0, down.indexOf("_rrOn('pointermove'"));
    const posAt = body.indexOf('const pos = event.data.getLocalPosition(container);');
    const storeAt = body.indexOf('this.lastMousePos = pos;');
    assert.ok(posAt >= 0, 'the press works out where it is');
    assert.ok(storeAt > posAt, 'and stores it before anything reads it');
    // Before the tile bounds check rejects an out-of-map press, and well
    // before paintTile is reached.
    assert.ok(storeAt < body.indexOf('this.paintTile('), 'ahead of the paint');
    assert.match(body, /else if \(this\.shadowPenMode\) \{\s*this\.paintTile\(tileX, tileY\);/,
        'pointerdown paints immediately instead of waiting for pointer movement');
});
