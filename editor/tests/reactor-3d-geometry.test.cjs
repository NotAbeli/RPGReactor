const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));
const Geometry = Reactor3D.Geometry;

const PLANES = 6;

/** A map whose four tile planes are filled from `layers`. */
function mapWith(width, height, layers) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    for (const [z, cells] of Object.entries(layers)) {
        cells.forEach((tileId, index) => { data[Number(z) * plane + index] = tileId; });
    }
    return { width, height, data };
}

const flat = () => 0;

test('sheet addressing matches the 2D renderer exactly', () => {
    // A tile showing one image in 2D and another in 3D is miserable to chase
    // visually, so the arithmetic is pinned against the 2D expression itself.
    const twoD = tileId => {
        const local = tileId % 256;
        return {
            setNumber: 5 + Math.floor(tileId / 256),
            sx: ((Math.floor(local / 128) % 2) * 8 + (local % 8)) * 48,
            sy: (Math.floor((local % 256) / 8) % 16) * 48
        };
    };
    for (const tileId of [1, 127, 128, 255, 256, 800, 1023, 1024, 1029, 1280, 1535]) {
        const rect = Geometry.sheetRectFor(tileId);
        const expected = twoD(tileId);
        assert.equal(rect.setNumber, expected.setNumber, `sheet for ${tileId}`);
        assert.equal(rect.sx, expected.sx, `sx for ${tileId}`);
        assert.equal(rect.sy, expected.sy, `sy for ${tileId}`);
    }
});

test('the F and G sheets resolve here too', () => {
    // They were added to the 2D renderer; the 3D one must not have to be
    // taught about each new sheet separately.
    assert.equal(Geometry.sheetRectFor(1024).setNumber, 9);
    assert.equal(Geometry.sheetRectFor(1279).setNumber, 9);
    assert.equal(Geometry.sheetRectFor(1280).setNumber, 10);
    assert.equal(Geometry.sheetRectFor(1535).setNumber, 10);
});

test('A5 uses its own eight-wide grid, and autotiles report their kind', () => {
    const a5 = Geometry.sheetRectFor(1536 + 9);
    assert.equal(a5.setNumber, 4);
    assert.equal(a5.sx, 48, 'column 1');
    assert.equal(a5.sy, 48, 'row 1');
    assert.ok(!a5.autotile);

    for (const [tileId, setNumber] of [[2048, 0], [2816, 1], [4352, 2], [5888, 3]]) {
        const rect = Geometry.sheetRectFor(tileId);
        assert.equal(rect.setNumber, setNumber);
        assert.equal(rect.autotile, true);
        assert.equal(rect.kind, Math.floor((tileId - 2048) / 48));
    }
});

test('empty and out-of-range ids address nothing', () => {
    for (const tileId of [0, -1, 8192, 99999, NaN, undefined]) {
        assert.equal(Geometry.sheetRectFor(tileId), null, `${tileId} is not a tile`);
    }
});

test('the topmost plane wins, as it does on screen', () => {
    const map = mapWith(1, 1, { 0: [1], 1: [300], 3: [800] });
    assert.equal(Geometry.topTileAt(map, 0, 0), 800);

    const lower = mapWith(1, 1, { 0: [1], 1: [300] });
    assert.equal(Geometry.topTileAt(lower, 0, 0), 300);

    assert.equal(Geometry.topTileAt(mapWith(1, 1, {}), 0, 0), 0, 'an empty stack');
    assert.equal(Geometry.topTileAt(map, 5, 5), 0, 'out of range');
});

test('an empty cell contributes no geometry', () => {
    const built = Geometry.build(mapWith(2, 2, {}), { elevationAt: flat });
    assert.deepEqual(built.groups, []);
    assert.equal(built.quads, 0);
});

test('a flat map emits ground and no walls at all', () => {
    // Every neighbour is level, and the rim is at elevation 0 like the outside,
    // so nothing should be extruded.
    const built = Geometry.build(mapWith(3, 3, { 0: new Array(9).fill(1) }), { elevationAt: flat });
    assert.equal(built.quads, 9, 'one ground quad per cell, nothing more');
    assert.equal(built.groups.length, 1);
    assert.equal(built.groups[0].positions.length / 3, 9 * 4);
});

test('walls appear only where a neighbour is lower', () => {
    // A single raised cell in the middle of a flat 3x3: four exposed sides.
    const raised = (x, y) => (x === 1 && y === 1 ? 1 : 0);
    const built = Geometry.build(mapWith(3, 3, { 0: new Array(9).fill(1) }), { elevationAt: raised });
    assert.equal(built.quads, 9 + 4, 'nine grounds plus four walls');
});

test('the map rim is closed off rather than left floating', () => {
    // Outside the map counts as elevation 0, so a raised edge cell still gets
    // its outward-facing wall.
    const built = Geometry.build(mapWith(1, 1, { 0: [1] }), { elevationAt: () => 3 });
    assert.equal(built.quads, 1 + 4, 'ground plus all four sides');
});

test('a cell lower than its neighbour does not build their shared wall twice', () => {
    // Only the higher cell owns the face between them.
    const step = (x) => (x === 0 ? 2 : 0);
    const built = Geometry.build(mapWith(2, 1, { 0: [1, 1] }), { elevationAt: step });
    // Tall cell: ground + 3 rim walls + 1 facing its lower neighbour = 5.
    // Short cell: ground only, since every neighbour is level or higher.
    assert.equal(built.quads, 5 + 1);
});

test('geometry is grouped by sheet, which is what keeps the draw calls down', () => {
    const cells = [1, 300, 800, 1029, 1, 300];
    const built = Geometry.build(mapWith(6, 1, { 0: cells }), { elevationAt: flat });
    const sheets = built.groups.map(group => group.setNumber).sort((a, b) => a - b);
    assert.deepEqual(sheets, [5, 6, 8, 9], 'one group per distinct sheet, not per tile');
    const total = built.groups.reduce((sum, group) => sum + group.positions.length / 3, 0);
    assert.equal(total, 6 * 4);
});

test('UVs point at the tile and are flipped into texture space', () => {
    // Image space counts down from the top; texture space counts up. Getting
    // this backwards renders every tile vertically mirrored.
    const built = Geometry.build(mapWith(1, 1, { 0: [1] }), {
        elevationAt: flat,
        sheetSize: () => ({ width: 768, height: 768 })
    });
    const uvs = Array.from(built.groups[0].uvs.slice(0, 8));
    const rect = Geometry.sheetRectFor(1);
    const u0 = rect.sx / 768;
    const u1 = (rect.sx + 48) / 768;
    const v0 = 1 - (rect.sy + 48) / 768;
    const v1 = 1 - rect.sy / 768;
    assert.deepEqual(uvs, [u0, v1, u1, v1, u1, v0, u0, v0]);
    assert.ok(v1 > v0, 'the top of the tile is the higher V');
});

test('ground sits at the cell elevation and walls drop to the neighbour', () => {
    const built = Geometry.build(mapWith(1, 1, { 0: [1] }), { elevationAt: () => 4 });
    const positions = built.groups[0].positions;
    // First quad is the ground: every Y is the cell's own height.
    for (let i = 0; i < 4; i++) assert.equal(positions[i * 3 + 1], 4);
    // Walls span from that height down to the outside, which is 0.
    const wallYs = new Set();
    for (let i = 4; i < positions.length / 3; i++) wallYs.add(positions[i * 3 + 1]);
    assert.deepEqual([...wallYs].sort(), [0, 4]);
});

test('indices widen past the 16-bit vertex limit', () => {
    // A large map passes 65535 vertices, where Uint16 silently wraps and the
    // mesh folds in on itself.
    const small = Geometry.build(mapWith(4, 4, { 0: new Array(16).fill(1) }), { elevationAt: flat });
    assert.equal(small.groups[0].indices.constructor, Uint16Array);

    const wide = 130;
    const big = Geometry.build(mapWith(wide, wide, { 0: new Array(wide * wide).fill(1) }),
        { elevationAt: flat });
    assert.ok(big.groups[0].positions.length / 3 > 65535, 'this map really does exceed it');
    assert.equal(big.groups[0].indices.constructor, Uint32Array);
});

test('a full-size map stays within a handful of draw calls', () => {
    // The spike's actual question: whether a 200x200 map is drawable without
    // instancing. One merged mesh per sheet means draw calls track the number
    // of sheets in use, not the number of tiles.
    const width = 200;
    const height = 200;
    const cells = new Array(width * height);
    const sheets = [1, 300, 800, 1029, 1536, 2048];
    for (let i = 0; i < cells.length; i++) cells[i] = sheets[i % sheets.length];

    const built = Geometry.build(mapWith(width, height, { 0: cells }), {
        elevationAt: (x, y) => Math.floor(2 + 2 * Math.sin(x / 9) + 2 * Math.cos(y / 7))
    });

    assert.ok(built.groups.length <= 11,
        `one group per sheet at most, got ${built.groups.length}`);
    assert.equal(built.groups.length, sheets.length);
    assert.ok(built.quads > width * height, 'walls were emitted, not just ground');
});

//-----------------------------------------------------------------------------
// Autotiles
//
// The 3D quadrant maths was derived from Tilemap._addAutotile, so re-deriving it
// in the test would prove nothing. Instead the shipped 2D function is lifted out
// of reactor_core.js and executed against a recording stub, and the two are
// compared. If the corescript's autotile handling ever changes, this fails.

const fs = require('node:fs');
const coreSource = fs.readFileSync(path.join(repoRoot, 'runtime', 'reactor_core.js'), 'utf8');

function literal(name) {
    const match = coreSource.match(new RegExp(`Tilemap\\.${name} = (\\[[\\s\\S]*?\\n\\];)`));
    assert.ok(match, `${name} is present in reactor_core.js`);
    // eslint-disable-next-line no-eval
    return eval(match[1].replace(/;$/, ''));
}

const TABLES = {
    floor: literal('FLOOR_AUTOTILE_TABLE'),
    wall: literal('WALL_AUTOTILE_TABLE'),
    waterfall: literal('WATERFALL_AUTOTILE_TABLE')
};

/** Run the shipped 2D _addAutotile and record what it would draw. */
function twoDQuadrants(tileId) {
    const signature = 'Tilemap.prototype._addAutotile = function(layer, tileId, dx, dy) {';
    const at = coreSource.indexOf(signature);
    assert.ok(at >= 0, '_addAutotile is present');
    const body = coreSource.slice(at + signature.length, coreSource.indexOf('\n};', at));

    const Tilemap = {
        TILE_ID_A1: 2048, TILE_ID_A2: 2816, TILE_ID_A3: 4352,
        TILE_ID_A4: 5888, TILE_ID_MAX: 8192,
        FLOOR_AUTOTILE_TABLE: TABLES.floor,
        WALL_AUTOTILE_TABLE: TABLES.wall,
        WATERFALL_AUTOTILE_TABLE: TABLES.waterfall,
        getAutotileKind: id => Math.floor((id - 2048) / 48),
        getAutotileShape: id => (id - 2048) % 48,
        isTileA1: id => id >= 2048 && id < 2816,
        isTileA2: id => id >= 2816 && id < 4352,
        isTileA3: id => id >= 4352 && id < 5888,
        isTileA4: id => id >= 5888 && id < 8192
    };
    // eslint-disable-next-line no-new-func
    const fn = new Function('Tilemap', `return function(layer, tileId, dx, dy) {${body}};`)(Tilemap);

    const calls = [];
    fn.call({
        animationFrame: 0,
        tileWidth: 48,
        tileHeight: 48,
        _isTableTile: () => false
    }, { addRect: (...args) => calls.push(args) }, tileId, 0, 0);
    return calls;
}

test('autotile quadrants match what the 2D renderer draws', () => {
    // A2 ground is most of a typical map, A3/A4 are walls and roofs, A1 is
    // water. Sampling several shapes of each covers both tables.
    const samples = [];
    for (const base of [2048, 2816, 4352, 5888]) {
        for (const kind of [0, 1, 5]) {
            for (const shape of [0, 1, 15, 20, 46]) {
                samples.push(base + kind * 48 + shape);
            }
        }
    }

    let compared = 0;
    for (const tileId of samples) {
        const ours = Geometry.autotileQuads(tileId, 48, TABLES);
        // Skip before running the 2D reference: where we fall back, it indexes
        // past the end of its table and throws, which is itself worth knowing —
        // those ids cannot occur in a real map.
        if (!ours) continue;
        const theirs = twoDQuadrants(tileId);
        assert.equal(ours.length, 4, `four quadrants for ${tileId}`);
        for (let i = 0; i < 4; i++) {
            const [setNumber, sx, sy] = theirs[i];
            assert.equal(ours[i].setNumber, setNumber, `sheet, tile ${tileId} quadrant ${i}`);
            assert.equal(ours[i].sx, sx, `sx, tile ${tileId} quadrant ${i}`);
            assert.equal(ours[i].sy, sy, `sy, tile ${tileId} quadrant ${i}`);
        }
        compared++;
    }
    assert.ok(compared >= 40, `only ${compared} tiles were actually compared`);
});

test('quadrants are half-cells laid out west-to-east, north-to-south', () => {
    const quads = Geometry.autotileQuads(2816, 48, TABLES);
    assert.deepEqual(quads.map(q => [q.qx, q.qy]), [[0, 0], [1, 0], [0, 1], [1, 1]]);
    assert.ok(quads.every(q => q.width === 24 && q.height === 24));
});

test('an autotile cell becomes four ground quads, not one', () => {
    // Drawing the whole-tile rect gives a map where every grass tile is the
    // same wrong patch — the giveaway that quadrants were skipped.
    const built = Geometry.build(mapWith(2, 2, { 0: new Array(4).fill(2816) }),
        { elevationAt: flat, tables: TABLES });
    assert.equal(built.quads, 4 * 4);
    assert.equal(built.groups.length, 1, 'still one draw call');
});

test('the quarter-cells tile the whole cell with no gap or overlap', () => {
    const built = Geometry.build(mapWith(1, 1, { 0: [2816] }),
        { elevationAt: flat, tables: TABLES });
    const positions = built.groups[0].positions;
    const xs = new Set();
    const zs = new Set();
    for (let i = 0; i < positions.length / 3; i++) {
        xs.add(positions[i * 3]);
        zs.add(positions[i * 3 + 2]);
    }
    assert.deepEqual([...xs].sort((a, b) => a - b), [0, 0.5, 1]);
    assert.deepEqual([...zs].sort((a, b) => a - b), [0, 0.5, 1]);
});

test('an autotile builds its four quadrants by default', () => {
    // This used to assert the opposite. Without a running game the builder got
    // no shape tables and fell back to one whole-tile quad — the block's
    // bordered corner stamped over every cell — and the test pinned that
    // fallback as if it were the contract. The tables now ship with the module,
    // so the default path draws the real thing.
    const built = Geometry.build(mapWith(1, 1, { 0: [2816] }), { elevationAt: flat });
    assert.equal(built.quads, 4, 'four quarter-cells, not one whole tile');
});

test('the whole-tile fallback survives for a caller with no table', () => {
    // Drawing nothing would leave holes in the ground, so a table that does not
    // cover a shape still yields something visible.
    assert.equal(Geometry.autotileQuads(2816, 48, null), null);
    const built = Geometry.build(mapWith(1, 1, { 0: [2816] }), { elevationAt: flat, tables: {} });
    assert.equal(built.quads, 1, 'one whole-tile quad rather than a hole');
});

test('a shape outside its table falls back rather than indexing past the end', () => {
    // The waterfall table defines four shapes; an odd A1 kind can carry more.
    const waterfallKind = 2048 + 5 * 48;
    assert.equal(Geometry.autotileQuads(waterfallKind + 40, 48, TABLES), null);
    const built = Geometry.build(mapWith(1, 1, { 0: [waterfallKind + 40] }),
        { elevationAt: flat, tables: TABLES });
    assert.equal(built.quads, 1);
});

test('a cliff face under an autotile uses that autotile\'s quadrants', () => {
    // This asserted the opposite. Walls sampled `sheetRectFor`, which for an
    // autotile is the block's whole top-left tile — a corner fragment, often of
    // something else entirely — so raised terrain grew cliffs patched with the
    // wrong artwork.
    const built = Geometry.build(mapWith(1, 1, { 0: [2816] }),
        { elevationAt: () => 2, tables: TABLES });
    // Four quarter-cells of ground, and each of the four rim walls likewise.
    assert.equal(built.quads, 4 + 4 * 4);

    const quadrants = new Set(Geometry.autotileQuads(2816, 48, TABLES).map(q => q.sx / 768));
    const uvs = built.groups[0].uvs;
    for (let i = 0; i < uvs.length; i += 8) {
        assert.ok(quadrants.has(uvs[i]) || quadrants.has(uvs[i + 2]),
            'every face samples a quadrant');
    }
});

test('a guessed facade is capped, an authored one is not', () => {
    // The cap exists to stop a cliff face or map-edge wall — impassable by
    // coincidence — from becoming a tower while a tileset is unclassified. It
    // has no business overruling someone who has said what a tile is: tilesets
    // draw buildings as single perspective props dozens of tiles tall, and
    // capping those dropped whole city blocks back onto the floor.
    const height = 20;
    const column = new Array(height).fill(0).map((_, y) => (y < 15 ? 1 : 0));
    const map = mapWith(1, height, { 0: column });

    const guessed = Geometry.uprightRuns(map, () => true, 8);
    assert.deepEqual(guessed, [], 'a 15-tile run of guesses is rejected');

    const authored = Geometry.uprightRuns(map, () => true, 8, () => true);
    assert.equal(authored.length, 1, 'the same run stands when it was authored');
    assert.equal(authored[0].tiles.length, 15);
});

test('one authored tile vouches for the run it is part of', () => {
    // A run is a single object; classifying its base is classifying the thing.
    const height = 20;
    const map = mapWith(1, height, { 0: new Array(height).fill(0).map((_, y) => (y < 12 ? 1 : 0)) });

    const runs = Geometry.uprightRuns(map, () => true, 8, tileId => tileId === 1);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].tiles.length, 12);
});

test('the cap still applies where nothing was authored', () => {
    const height = 30;
    const map = mapWith(1, height, { 0: new Array(height).fill(1) });
    assert.deepEqual(Geometry.uprightRuns(map, () => true, 8, () => false), []);
});

test('every layer of a cell is drawn, not just the top one', () => {
    // A cell holds up to four tiles and the 2D renderer composites all of
    // them: a floor, a decal over it, a puddle over that. Drawing only the
    // topmost showed the decal alone with nothing underneath — not the map the
    // author drew, and the commonest way the 3D view looks "wrong".
    const map = mapWith(1, 1, { 0: [1], 1: [300], 2: [700] });
    const built = Geometry.build(map, { elevationAt: flat });
    assert.equal(built.quads, 3, 'one quad per painted layer');
    assert.deepEqual(built.groups.map(g => g.setNumber).sort(), [5, 6, 7],
        'each from its own sheet');
});

test('stacked layers keep the author\'s order and stay a hair apart', () => {
    // Elevation 0 so the map rim builds no walls; only the ground quads remain.
    const map = mapWith(1, 1, { 0: [1], 1: [2] });
    const built = Geometry.build(map, { elevationAt: flat });
    const heights = built.groups[0].positions.filter((_, i) => i % 3 === 1);
    const levels = [...new Set(heights)].sort((a, b) => a - b);
    assert.equal(levels.length, 2, 'the two layers sit at different heights');
    assert.equal(levels[0], 0, 'the lower one at the cell elevation');
    // Far below a tile's width: coplanar quads would z-fight, a visible gap
    // would show daylight between a floor and its own decal.
    assert.ok(levels[1] - levels[0] > 0 && levels[1] - levels[0] < 0.01);
});

test('an empty layer between two painted ones is skipped', () => {
    const map = mapWith(1, 1, { 0: [1], 2: [2] });
    assert.equal(Geometry.build(map, { elevationAt: flat }).quads, 2);
});

test('the built-in autotile tables match the corescript exactly', () => {
    // The builder used to read these off the global `Tilemap`, which only a
    // running game has. The editor viewport and the offline renderer load this
    // module alone, got null, and silently fell back to blitting each
    // autotile's corner — a seamless field of grass came out as a grid of
    // bordered squares. The copy is pinned here so it cannot drift from the
    // corescript it was taken from.
    const fs = require('node:fs');
    const source = fs.readFileSync(path.join(repoRoot, 'runtime', 'reactor_core.js'), 'utf8');

    const tableFrom = name => {
        const start = source.indexOf(`Tilemap.${name} = [`);
        assert.ok(start >= 0, `${name} exists in the corescript`);
        let depth = 0;
        const open = source.indexOf('[', start);
        for (let i = open; i < source.length; i++) {
            if (source[i] === '[') depth++;
            else if (source[i] === ']' && --depth === 0) {
                return JSON.parse(source.slice(open, i + 1).replace(/\s+/g, ''));
            }
        }
        throw new Error(`${name} is not closed`);
    };

    for (const name of ['FLOOR_AUTOTILE_TABLE', 'WALL_AUTOTILE_TABLE', 'WATERFALL_AUTOTILE_TABLE']) {
        assert.deepEqual(Geometry[name], tableFrom(name), `${name} matches`);
    }
});

test('autotiles build from the tables with no game running', () => {
    // Node has no `Tilemap`, which is exactly the situation the editor is in.
    assert.equal(typeof globalThis.Tilemap, 'undefined');
    const tables = Geometry.autotileTables({});
    assert.ok(tables && tables.floor && tables.wall && tables.waterfall);

    // Shape 0 is the fully-enclosed interior: no quadrant may come from the
    // block's outer border, or a field of grass draws a grid over itself.
    const quads = Geometry.autotileQuads(2816, 48, tables);
    assert.equal(quads.length, 4);
    assert.deepEqual(quads.map(q => [q.sx, q.sy]), [[48, 96], [24, 96], [48, 72], [24, 72]]);
});

test('a standing autotile uses its shape quadrants, not the block corner', () => {
    // A facade sampled `sheetRectFor`, which for an autotile is the block's
    // whole top-left tile — a corner piece. Walls came out built from grass
    // corners, and mountains were edged with a different mountain's border.
    const grass = 2816 + 16 * 48;            // an A2 kind, shape 0
    const map = mapWith(1, 1, { 0: [grass] });
    const built = Geometry.build(map, {
        elevationAt: flat,
        isUpright: () => true,
        uprightDepth: 0
    });
    assert.equal(built.quads, 4, 'four quadrants make up the face');

    const ground = Geometry.autotileQuads(grass, 48, TABLES);
    const size = { width: 768, height: 768 };
    const expected = new Set(ground.map(q => (q.sx / size.width).toFixed(6)));
    const actual = new Set();
    const uvs = built.groups[0].uvs;
    for (let i = 0; i < uvs.length; i += 8) actual.add(uvs[i].toFixed(6));
    assert.deepEqual([...actual].sort(), [...expected].sort(),
        'the face samples exactly what the ground would');
});

test('nothing stands up unless it was classified', () => {
    // "Impassable or draws above characters" covers a great deal of ordinary
    // terrain. Guessing from it stood mountains and forests on end, and since a
    // facade is one plane at its run's southern edge, everything behind that
    // plane vanished — scenery appearing that was never placed, and scenery
    // that was placed going missing.
    const flags = [];
    flags[1] = 0x0f;                          // impassable
    flags[2] = 0x10;                          // draws above characters
    const predicate = Reactor3D.uprightPredicate(99, flags);
    assert.equal(predicate(1), false);
    assert.equal(predicate(2), false);

    const guessing = Reactor3D.uprightPredicate(99, flags, { guess: true });
    assert.equal(guessing(1), true, 'still available on request');
    assert.equal(guessing(2), true);
});

test('an authored class always wins over the guess', () => {
    const flags = [];
    flags[1] = 0x0f;
    Reactor3D.setClassification({ version: 1, tilesets: { 99: { 1: Reactor3D.CLASS_GROUND } } });
    try {
        assert.equal(Reactor3D.uprightPredicate(99, flags, { guess: true })(1), false);
    } finally {
        Reactor3D.setClassification(null);
    }
});

test('animated water carries a UV stride, still ground carries none', () => {
    // The A1 frames sit side by side in the same sheet, so animation is a UV
    // slide rather than a rebuild — a 200x200 map animates without touching
    // its geometry.
    const water = Geometry.build(mapWith(1, 1, { 0: [2048] }), { elevationAt: flat });
    assert.ok(water.groups[0].anim, 'the A1 group is animated');
    assert.ok(water.groups[0].anim.some(value => value !== 0));

    const ground = Geometry.build(mapWith(1, 1, { 0: [1] }), { elevationAt: flat });
    assert.equal(ground.groups[0].anim, null, 'a B-sheet tile never moves');
});

test('a waterfall slides down the sheet, not across it', () => {
    // Odd A1 kinds are waterfalls: `by` advances, and V counts up from the
    // bottom, so the stride has to be negative or the water runs backwards.
    const waterfall = Geometry.build(mapWith(1, 1, { 0: [2048 + 5 * 48] }), { elevationAt: flat });
    const anim = waterfall.groups[0].anim;
    const us = [], vs = [];
    for (let i = 0; i < anim.length; i += 2) { us.push(anim[i]); vs.push(anim[i + 1]); }
    assert.ok(us.every(value => value === 0), 'no horizontal drift');
    assert.ok(vs.every(value => value < 0), 'downward through the sheet');
});

test('scenery raises its cell instead of standing a picture on it', () => {
    // Standing a billboard per cell was the first attempt, and it turned a
    // mountain range into rows of cardboard cut-outs with daylight between
    // them: terrain covers an area, and a picture does not. Raised ground gets
    // its cliff faces from the wall code for free and reads as a mass.
    const map = mapWith(1, 3, { 0: [1, 1, 1] });
    const raised = Geometry.build(map, { elevationAt: flat, isScenery: () => true });
    const heights = new Set();
    for (let i = 0; i < raised.groups[0].positions.length / 3; i++) {
        heights.add(raised.groups[0].positions[i * 3 + 1]);
    }
    assert.deepEqual([...heights].sort(), [0, 1], 'ground lifted a tile, walls down to 0');

    const level = Geometry.build(map, { elevationAt: flat });
    assert.ok(raised.quads > level.quads, 'the raised edge gains cliff faces');
});

test('a scenery cell stands one tile tall however many neighbours it has', () => {
    const map = mapWith(1, 5, { 0: [1, 1, 1, 1, 1] });
    const built = Geometry.build(map, { elevationAt: flat, isScenery: () => true, uprightDepth: 0 });
    const heights = new Set();
    for (let i = 0; i < built.groups[0].positions.length / 3; i++) {
        heights.add(built.groups[0].positions[i * 3 + 1]);
    }
    assert.deepEqual([...heights].sort(), [0, 1], 'ground at 0, tops at 1 — never stacked');
});

test('scenery is never guessed, only authored', () => {
    // Nothing in the 2D flags tells a forest from a shopfront, which is the
    // whole reason classification is authored.
    const flags = [];
    flags[1] = 0x0f;
    assert.equal(Reactor3D.sceneryPredicate(77)(1), false);
    Reactor3D.setClassification({ version: 1, tilesets: { 77: { 1: Reactor3D.CLASS_SCENERY } } });
    try {
        assert.equal(Reactor3D.sceneryPredicate(77)(1), true);
        assert.equal(Reactor3D.uprightPredicate(77, flags, { guess: true })(1), false,
            'scenery does not also collapse into facades');
    } finally {
        Reactor3D.setClassification(null);
    }
});

test('a standing object is never capped with a horizontal slab', () => {
    // Boxing a facade — sides plus a lid — is wrong for cut-out art. The lid
    // laid the tile flat across the whole cell, so a spire or a jagged roof
    // grew a horizontal shelf that ignored its silhouette, and a side smeared
    // one column of pixels across the depth. Depth is a second upright plane
    // crossing the first, so every face stays an alpha-tested cut-out.
    const built = Geometry.build(mapWith(1, 1, { 0: [1] }), {
        elevationAt: flat,
        isUpright: () => true,
        isAuthored: () => true
    });
    const positions = built.groups[0].positions;
    for (let q = 0; q < positions.length / 3; q += 4) {
        const ys = [0, 1, 2, 3].map(i => positions[(q + i) * 3 + 1]);
        assert.notEqual(Math.min(...ys), Math.max(...ys),
            'no face lies flat: every one spans a height');
    }
});

test('the crossing plane runs at right angles to the face', () => {
    const built = Geometry.build(mapWith(1, 1, { 0: [1] }), {
        elevationAt: flat,
        isUpright: () => true,
        isAuthored: () => true
    });
    assert.equal(built.quads, 2, 'the face and one plane crossing it');

    const positions = built.groups[0].positions;
    const constantAxis = q => {
        const xs = [0, 1, 2, 3].map(i => positions[(q + i) * 3]);
        const zs = [0, 1, 2, 3].map(i => positions[(q + i) * 3 + 2]);
        return Math.min(...xs) === Math.max(...xs) ? 'x' : (Math.min(...zs) === Math.max(...zs) ? 'z' : '?');
    };
    assert.deepEqual([constantAxis(0), constantAxis(4)].sort(), ['x', 'z']);
});

test('the crossing plane is dropped where a neighbour continues the wall', () => {
    // Inside a wide building the crossing planes would be buried and still
    // drawn, so they are culled exactly where the sides used to be.
    const wide = Geometry.build(mapWith(3, 1, { 0: [1, 1, 1] }), {
        elevationAt: flat,
        isUpright: () => true,
        isAuthored: () => true
    });
    // Three faces; only the two outer columns cross, the middle one is enclosed.
    assert.equal(wide.quads, 3 + 0);
});

test('a building stands on a floor rather than over a hole', () => {
    // A facade consumes every cell of its run, and those cells usually hold
    // nothing but the building's own artwork — so excluding upright tiles left
    // the footprint with no ground at all, and a building drawn fifteen tiles
    // tall showed a fifteen-cell hole through to the sky.
    const height = 6;
    const column = [];
    for (let y = 0; y < height; y++) column.push(y < 4 ? 700 : 1);   // building, then street
    const map = mapWith(1, height, { 0: column });

    const built = Geometry.build(map, {
        elevationAt: flat,
        isUpright: id => id === 700,
        isAuthored: () => true,
        uprightDepth: 0
    });
    const groundY = 0;
    let groundQuads = 0;
    const positions = built.groups.flatMap(g => Array.from(g.positions));
    for (let q = 0; q < positions.length / 3; q += 4) {
        const ys = [0, 1, 2, 3].map(i => positions[(q + i) * 3 + 1]);
        if (ys.every(y => y === groundY)) groundQuads++;
    }
    assert.equal(groundQuads, height, 'every cell of the run keeps a floor');
});

test('the floor under a building comes from the street, not an overlay', () => {
    // `nearestGround` used to take the top of the stack, which is often a
    // see-through decoration: it alpha-tests away to nothing and leaves exactly
    // the hole it was meant to close. The bottom layer is the actual floor.
    const map = mapWith(1, 3, {
        0: [700, 1, 0],      // building, floor, empty
        1: [0, 900, 0]       // an overlay drawn on top of that floor
    });
    const run = { x: 0, northY: 0, southY: 0 };
    assert.equal(Geometry.nearestGround(map, run, id => id === 700), 1);
});

test('a footprint with no floor anywhere south still finds one', () => {
    // A dense block can be buildings all the way to the map edge one way.
    const map = mapWith(1, 3, { 0: [1, 700, 700] });
    const run = { x: 0, northY: 1, southY: 2 };
    assert.equal(Geometry.nearestGround(map, run, id => id === 700), 1,
        'found by looking north when south is built up');
});

test('a floor is found in a neighbouring column when its own has none', () => {
    const map = mapWith(2, 1, { 0: [700, 1] });
    const run = { x: 0, northY: 0, southY: 0 };
    assert.equal(Geometry.nearestGround(map, run, id => id === 700), 1);
});
