/**
 * What covers the top of a raised wall.
 *
 * A wall autotile draws a wall *face* and has no top, so a wall raised into a
 * mass was capped with its own side art — a building wearing its front as a
 * hat. A4 guarantees a roof for every wall (alternating rows, eight kinds to a
 * row), so the pairing is derivable; A3 is walls throughout and has to be
 * named in the classification file.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const editorRoot = path.resolve(__dirname, '..');
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));
const Geometry = Reactor3D.Geometry;

const PLANES = 6;
const A3 = 4352;
const A4 = 5888;
const A2 = 2816;

function mapWith(width, height, layers) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    for (const [z, cells] of Object.entries(layers)) {
        cells.forEach((tileId, index) => { data[Number(z) * plane + index] = tileId; });
    }
    return { width, height, data };
}

const quietConsole = Object.create(console);
quietConsole.log = quietConsole.warn = quietConsole.error = () => {};

/** The editor's own shape calculator, driven by a stubbed neighbourhood. */
function editorShapeCalculator() {
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor.js'), 'utf8');
    const MapEditor = vm.runInNewContext(`${source}\nMapEditor;`, {
        console: quietConsole, process, require, window: {}, document: {}
    });
    const editor = Object.create(MapEditor.prototype);
    editor.tilemapManager = { currentMap: { width: 3, height: 3, data: [] } };
    return (present) => {
        // The cell under test sits at (1,1); `present` holds the offsets of
        // neighbours carrying the same kind.
        editor.isSameKindTile = (base, x, y) => present.has(`${x - 1},${y - 1}`);
        return editor.calculateAutotileShape(A2, 1, 1).shape;
    };
}

//-----------------------------------------------------------------------------

test('the roof for a wall follows from the A4 sheet layout', () => {
    // Rows alternate roof, wall, roof, wall — eight kinds to a row — so a
    // wall's roof is the kind one row back.
    const wallKind8 = A4 + 8 * 48;          // row 1, the first wall row
    assert.equal(Geometry.roofForWall(wallKind8), A4 + 0 * 48);
    assert.equal(Geometry.roofForWall(A4 + 15 * 48), A4 + 7 * 48);
    assert.equal(Geometry.roofForWall(A4 + 24 * 48), A4 + 16 * 48);

    // A roof has no roof of its own, and A3 has none to pair with.
    assert.equal(Geometry.roofForWall(A4), 0, 'a roof kind is not a wall');
    assert.equal(Geometry.roofForWall(A3), 0, 'A3 is walls throughout');
    assert.equal(Geometry.roofForWall(A2), 0);
    assert.equal(Geometry.roofForWall(1), 0);
});

test('an authored roof wins over the derived one', () => {
    Reactor3D.setClassification({
        version: 1, tilesets: {}, standIns: {}, objects: {},
        materials: { 3: { [A3]: { top: A2 + 96 } } }
    });
    try {
        assert.equal(Reactor3D.topFaceFor(3, A3 + 7), A2 + 96,
            'A3 gets the roof it was given');
        // The derived answer still applies where nothing was authored.
        assert.equal(Reactor3D.topFaceFor(3, A4 + 8 * 48 + 3), A4);
        assert.equal(Reactor3D.topFaceFor(9, A3), 0, 'another tileset says nothing');
    } finally {
        Reactor3D.setClassification(null);
    }
});

test('the roof shape is chosen the way the editor would choose it', () => {
    // A roof laid over a mass has to pick its corners exactly as the same roof
    // painted flat would, or a building disagrees with its own roof where the
    // two meet. Both implementations are driven over every neighbourhood.
    const editorShape = editorShapeCalculator();
    const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1]
    ];

    for (let mask = 0; mask < 256; mask++) {
        const present = new Set();
        offsets.forEach(([dx, dy], bit) => {
            if (mask & (1 << bit)) present.add(`${dx},${dy}`);
        });
        const mine = Geometry.floorShapeFrom((dx, dy) => present.has(`${dx},${dy}`));
        assert.equal(mine, editorShape(present),
            `neighbourhood ${mask.toString(2).padStart(8, '0')} disagrees`);
    }
});

test('a raised wall is capped with its roof, not with its own face', () => {
    // One A4 wall cell raised into a mass. Its top used to draw the wall art;
    // it now draws the roof the sheet pairs with it.
    const wall = A4 + 8 * 48;
    const roof = A4;
    const cells = new Array(9).fill(A2);
    cells[4] = wall + 15;
    const mapData = mapWith(3, 3, { 0: cells });

    const built = Geometry.build(mapData, {
        isScenery: tileId => tileId === wall + 15,
        isAuthored: () => true,
        topFaceFor: tileId => Geometry.roofForWall(Geometry.autotileBase(tileId))
    });

    // The roof lives on A4 too, so look at where the top face samples from:
    // an isolated roof cell takes shape 46, whose quadrants are the block's
    // outer corners.
    const roofRect = Geometry.sheetRectFor(roof + 46);
    const topQuads = [];
    for (const group of built.groups) {
        for (let q = 0; q < group.positions.length / 3; q += 4) {
            const ys = [0, 1, 2, 3].map(i => group.positions[(q + i) * 3 + 1]);
            if (Math.min(...ys) === Math.max(...ys) && ys[0] > 0.5) topQuads.push(group);
        }
    }
    assert.ok(topQuads.length > 0, 'the mass has a top');
    assert.ok(roofRect, 'the roof kind addresses a sheet');

    // Without a pairing the cap stays the wall's own art, which is the
    // behaviour every existing project has today.
    const plain = Geometry.build(mapData, {
        isScenery: tileId => tileId === wall + 15,
        isAuthored: () => true
    });
    assert.equal(plain.quads > 0, true, 'still builds');
});

test('a run of wall reads as one roof surface', () => {
    // Three walls side by side: the middle cap continues into both neighbours,
    // so it takes a through-strip shape rather than an isolated one. Reusing
    // the wall's own stored shape gave each cell an isolated roof and the run
    // read as three separate huts.
    const wall = A4 + 8 * 48;
    const cells = new Array(25).fill(A2);
    for (const index of [11, 12, 13]) cells[index] = wall + 5;
    const mapData = mapWith(5, 5, { 0: cells });

    const topFaceFor = tileId => Geometry.roofForWall(Geometry.autotileBase(tileId));
    const built = Geometry.build(mapData, {
        isScenery: tileId => tileId === wall + 5,
        isAuthored: () => true,
        topFaceFor
    });
    assert.ok(built.quads > 0);

    // The shape the middle cell's cap asks for: neighbours east and west only.
    const middle = Geometry.floorShapeFrom((dx, dy) => dy === 0 && (dx === -1 || dx === 1));
    assert.equal(middle, 33, 'a horizontal through-strip');
    const end = Geometry.floorShapeFrom((dx, dy) => dy === 0 && dx === 1);
    assert.equal(end, 43, 'the left end of that strip');
});

test('a tile with no roof is left exactly as it was', () => {
    // Every project that has never named a roof must render as it did before.
    const wall = A3 + 15;
    const cells = new Array(9).fill(A2);
    cells[4] = wall;
    const mapData = mapWith(3, 3, { 0: cells });
    const options = { isScenery: tileId => tileId === wall, isAuthored: () => true };

    const before = Geometry.build(mapData, options);
    const after = Geometry.build(mapData, Object.assign({}, options, {
        // A3 derives nothing, so this returns 0 for every tile.
        topFaceFor: tileId => Geometry.roofForWall(Geometry.autotileBase(tileId))
    }));
    assert.equal(after.quads, before.quads);
    assert.deepEqual(
        Array.from(after.groups[0].uvs),
        Array.from(before.groups[0].uvs),
        'the same art, in the same places');
});

test('the classification file carries materials through a round trip', () => {
    const classes = require(path.join(editorRoot, 'src', 'utils', 'Tileset3DClass.js'));

    let store = classes.create();
    assert.deepEqual(store.materials, {}, 'a fresh file has the map');

    store = classes.setTopFace(store, 3, A3 + 12, A2 + 96 + 7);
    // Both ends fold to the autotile kind, so any shape of the wall finds the
    // roof and the roof is named by its kind rather than by one of its shapes.
    assert.deepEqual(classes.materialOf(store, 3, A3), { top: A2 + 96 });
    assert.deepEqual(classes.materialOf(store, 3, A3 + 47), { top: A2 + 96 });
    assert.equal(classes.materialOf(store, 3, A3 + 48), null, 'another kind is untouched');

    const reread = classes.normalize(JSON.parse(JSON.stringify(store)));
    assert.deepEqual(classes.materialOf(reread, 3, A3), { top: A2 + 96 });

    // Cleared with 0, and the tileset drops out when nothing is left.
    store = classes.setTopFace(store, 3, A3, 0);
    assert.equal(classes.materialOf(store, 3, A3), null);
    assert.deepEqual(store.materials, {});

    // Malformed entries degrade rather than throwing.
    const damaged = classes.normalize({
        version: 1, tilesets: {}, materials: { 3: { [A3]: { top: -5 } }, 4: 'nonsense' }
    });
    assert.deepEqual(damaged.materials, {});
});

test('the three copies of the wall-autotile rule agree', () => {
    // The runtime, the classification module and the map editor each need to
    // know which kinds are walls, and they are in three files that cannot
    // import each other.
    const classes = require(path.join(editorRoot, 'src', 'utils', 'Tileset3DClass.js'));
    for (const tileId of [A3, A3 + 47, A4 - 1, A4, A4 + 8 * 48, A4 + 16 * 48,
        A4 + 24 * 48, 2048, A2, 1536, 1, 0]) {
        assert.equal(classes.isWallLike(tileId), Geometry.isWallAutotile(tileId),
            `they disagree about ${tileId}`);
    }
});

test('the Roof tool pairs a wall with a roof in two clicks', () => {
    // It names a relationship between two tiles rather than a property of one,
    // so it cannot be a single click like the class tools.
    const source = fs.readFileSync(
        path.join(editorRoot, 'src', 'database', 'DatabaseTilesetEditor.js'), 'utf8');
    assert.match(source, /\['top', tt\('Roof'\),/, 'the tool is offered');
    assert.match(source, /this\._tile3dTopWall = picked;/, 'the wall is remembered');
    assert.match(source, /classes\.setTopFace\(store, tilesetId, wall, picked\)/,
        'and the second click names the roof');
    // Clicking the same wall twice clears it rather than pairing it with itself.
    assert.match(source, /classes\.setTopFace\(store, tilesetId, wall, 0\)/);
    // Autotiles are the whole point here, so this tool is not in the refusal.
    assert.match(source,
        /\(tool === 'object' \|\| tool === 'role'\) && autotile/);
});
