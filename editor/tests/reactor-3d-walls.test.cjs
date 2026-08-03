/**
 * Walls as boxes rather than as one plane.
 *
 * A wall autotile's shape is an exposed-edge mask that every map already
 * carries, so the sides of a raised wall are derivable: which sides show, where
 * the run ends and needs a cap, and how many courses of art the drop is worth.
 * Before this the renderer read one bit of it — the south face — and stretched
 * a single quad over whatever height the mass happened to be.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const editorRoot = path.resolve(__dirname, '..');
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));
const Geometry = Reactor3D.Geometry;

const PLANES = 6;
const A3 = 4352;
const A4 = 5888;

function mapWith(width, height, layers) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    for (const [z, cells] of Object.entries(layers)) {
        cells.forEach((tileId, index) => { data[Number(z) * plane + index] = tileId; });
    }
    return { width, height, data };
}

/** Build with a set of tiles treated as scenery — the mass path walls take. */
function buildMass(mapData, sceneryIds, options = {}) {
    const scenery = new Set(sceneryIds);
    return Geometry.build(mapData, Object.assign({
        isScenery: tileId => scenery.has(tileId),
        isAuthored: () => true,
        sceneryHeight: options.sceneryHeight === undefined ? 1 : options.sceneryHeight,
        elevationAt: options.elevationAt || (() => 0)
    }, options.extra || {}));
}

/** Every quad in the result as {ys, xs, zs}. */
function quads(result) {
    const all = [];
    for (const group of result.groups) {
        for (let q = 0; q < group.positions.length / 3; q += 4) {
            const corner = i => [0, 1, 2].map(a => group.positions[(q + i) * 3 + a]);
            all.push([0, 1, 2, 3].map(corner));
        }
    }
    return all;
}

const vertical = corners => {
    const ys = corners.map(c => c[1]);
    return Math.min(...ys) !== Math.max(...ys);
};

//-----------------------------------------------------------------------------
// The mask itself

test('a wall autotile is recognised the way the editor recognises one', () => {
    // A3 is walls throughout; A4 alternates roof rows and wall rows, eight
    // kinds to a row, odd rows being walls. Two copies of that rule would
    // drift, so this pins the runtime's against the editor's source.
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor.js'), 'utf8');
    assert.match(source, /isWallAutotile\(baseTileId\) \{/, 'the editor still has one');

    assert.equal(Geometry.isWallAutotile(A3), true);
    assert.equal(Geometry.isWallAutotile(A3 + 47), true);
    assert.equal(Geometry.isWallAutotile(A4 - 1), true);

    // A4 kinds 0-7 are roofs, 8-15 walls, 16-23 roofs, and so on.
    assert.equal(Geometry.isWallAutotile(A4), false, 'A4 kind 0 is a roof');
    assert.equal(Geometry.isWallAutotile(A4 + 8 * 48), true, 'kind 8 is a wall');
    assert.equal(Geometry.isWallAutotile(A4 + 16 * 48), false, 'kind 16 is a roof');
    assert.equal(Geometry.isWallAutotile(A4 + 24 * 48), true, 'kind 24 is a wall');

    // Ground, A5 and B-G are not.
    assert.equal(Geometry.isWallAutotile(2048), false);
    assert.equal(Geometry.isWallAutotile(2816), false);
    assert.equal(Geometry.isWallAutotile(1536), false);
    assert.equal(Geometry.isWallAutotile(1), false);
});

test('the cap bits match what the editor writes into the map', () => {
    // Verified against MZ-authored maps in calculateWallAutotileShape:
    // west 1, north 2, east 4, south 8, set when the neighbour is absent.
    assert.equal(Geometry.WALL_CAP_WEST, 1);
    assert.equal(Geometry.WALL_CAP_NORTH, 2);
    assert.equal(Geometry.WALL_CAP_EAST, 4);
    assert.equal(Geometry.WALL_CAP_SOUTH, 8);

    const source = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor.js'), 'utf8');
    assert.match(source, /if \(!left\) shape \+= 1;/);
    assert.match(source, /if \(!top\) shape \+= 2;/);
    assert.match(source, /if \(!right\) shape \+= 4;/);
    assert.match(source, /if \(!bottom\) shape \+= 8;/);

    // A face open on every edge is shape 0; closed on every edge is 15, which
    // the wall table draws as an isolated block.
    assert.equal(Geometry.wallFaceShape({}), 0);
    assert.equal(Geometry.wallFaceShape(
        { left: true, right: true, top: true, bottom: true }), 15);
    assert.equal(Geometry.wallFaceShape({ left: true, top: true }), 3);
    assert.equal(Geometry.wallFaceShape({ right: true, bottom: true }), 12);
});

test('a kind resolves to its own shape 0', () => {
    assert.equal(Geometry.autotileBase(A3 + 17), A3);
    assert.equal(Geometry.autotileBase(A3 + 48 + 5), A3 + 48);
    assert.equal(Geometry.autotileBase(1), 1, 'a plain tile is its own base');
});

//-----------------------------------------------------------------------------
// What gets built

test('a lone raised wall is a box, not a plane', () => {
    // One cell of wall in the middle of a floor. Every side of it faces open
    // air, so every side is drawn. The renderer used to emit the south face
    // only, which left a building inside-out from the north and a line from
    // the east.
    const wall = A3 + 15;
    const cells = new Array(9).fill(2816);
    cells[4] = wall;
    const result = buildMass(mapWith(3, 3, { 0: cells }), [wall]);

    const sides = quads(result).filter(vertical);
    // Four sides, each cut into the four quadrants an autotile shape selects.
    assert.equal(sides.length, 16, 'four faces of four quadrants');

    // One face per direction: group them by the axis they are flat on.
    const planes = new Set(sides.map(corners => {
        const xs = corners.map(c => c[0]), zs = corners.map(c => c[2]);
        return Math.min(...xs) === Math.max(...xs)
            ? `x=${xs[0]}` : `z=${zs[0]}`;
    }));
    assert.deepEqual([...planes].sort(), ['x=1', 'x=2', 'z=1', 'z=2'],
        'west, east, north and south faces all present');
});

test('a wall that carries on sideways is not capped there', () => {
    // Three walls in a row. The middle one's north and south faces continue
    // into their neighbours, so those faces take an uncapped shape; the ends
    // still cap. Reusing the shape stored in the map gave every face the same
    // caps, because in plan the west end and the north side are one edge.
    const wall = A3;
    const cells = new Array(25).fill(2816);
    for (const index of [11, 12, 13]) cells[index] = wall + 5;
    const mapData = mapWith(5, 5, { 0: cells });

    // The middle cell's south face: left is cell 11, right is cell 13, both
    // the same wall and the same height, so neither edge is an end.
    const carriesOn = Geometry.wallFaceShape({ top: true, bottom: true });
    assert.equal(carriesOn, Geometry.WALL_CAP_NORTH + Geometry.WALL_CAP_SOUTH);

    const result = buildMass(mapData, [wall + 5]);
    const sides = quads(result).filter(vertical);
    // Three cells, and only their outward faces: the two joins between them
    // are interior and never built.
    // south + north for each of 3, plus west of the leftmost and east of the
    // rightmost = 8 faces, 4 quadrants each.
    assert.equal(sides.length, 8 * 4);
});

test('a tall wall is courses of art, not one stretched quad', () => {
    // Height comes from elevation here rather than from the scenery lift, so
    // the drop is three tiles. Three courses of wall art, each a tile tall,
    // is what a wall looks like; one quad pulled over three tiles is a smear.
    const wall = A3;
    const cells = new Array(9).fill(2816);
    cells[4] = wall + 15;
    const mapData = mapWith(3, 3, { 0: cells });

    const result = buildMass(mapData, [wall + 15], {
        sceneryHeight: 3,
        elevationAt: () => 0
    });
    const sides = quads(result).filter(vertical);

    // Four faces x three courses x four quadrants.
    assert.equal(sides.length, 4 * 3 * 4);

    // Each quadrant is half a tile tall, and together the courses span the
    // whole drop with no gaps.
    const spans = sides.map(corners => {
        const ys = corners.map(c => c[1]);
        return [Math.min(...ys), Math.max(...ys)];
    });
    assert.equal(Math.max(...spans.map(s => s[1])), 3, 'the top of the mass');
    assert.equal(Math.min(...spans.map(s => s[0])), 0, 'down to the floor');
    for (const [low, high] of spans) {
        assert.ok(Math.abs((high - low) - 0.5) < 1e-9,
            `a quadrant is half a tile tall, got ${high - low}`);
    }
});

test('only the top course is capped along its top edge', () => {
    // The top of a mass is where the wall ends and the roof begins, so that
    // course shows its top edge; the courses below carry on downwards.
    const top = Geometry.wallFaceShape({ left: true, right: true, top: true, bottom: false });
    const middle = Geometry.wallFaceShape({ left: true, right: true, top: false, bottom: false });
    const bottom = Geometry.wallFaceShape({ left: true, right: true, top: false, bottom: true });

    assert.equal(top & Geometry.WALL_CAP_NORTH, Geometry.WALL_CAP_NORTH);
    assert.equal(middle & Geometry.WALL_CAP_NORTH, 0);
    assert.equal(middle & Geometry.WALL_CAP_SOUTH, 0);
    assert.equal(bottom & Geometry.WALL_CAP_SOUTH, Geometry.WALL_CAP_SOUTH);
    // The ends are the same on every course of the same run.
    for (const shape of [top, middle, bottom]) {
        assert.equal(shape & Geometry.WALL_CAP_WEST, Geometry.WALL_CAP_WEST);
        assert.equal(shape & Geometry.WALL_CAP_EAST, Geometry.WALL_CAP_EAST);
    }
});

test('a cliff is untouched by any of this', () => {
    // Terrain that is not a wall autotile keeps the single stretched face it
    // always had, taking the art of the cell it belongs to.
    const cliff = 2816 + 48;
    const cells = new Array(9).fill(2816);
    cells[4] = cliff;
    const result = buildMass(mapWith(3, 3, { 0: cells }), [cliff], { sceneryHeight: 2 });

    const sides = quads(result).filter(vertical);
    // Four faces, four quadrants each, one course however tall the drop.
    assert.equal(sides.length, 16);
    const tallest = Math.max(...sides.map(corners => {
        const ys = corners.map(c => c[1]);
        return Math.max(...ys) - Math.min(...ys);
    }));
    assert.equal(tallest, 1, 'half of a two-tile drop, stretched');
});
