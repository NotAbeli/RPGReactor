const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const derive = require(path.join(repoRoot, 'editor', 'build-scripts', 'derive-tileset-3d-classes.cjs'));
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));

const { GROUND, UPRIGHT, SCENERY, FOLIAGE } = derive;
const PLANES = 6;
const BLOCKED = 0x0f;      // impassable on all four sides
const STAR = 0x10;         // draws above characters

/** A map whose tile planes are filled from `layers`. */
function mapWith(width, height, layers) {
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    for (const [z, cells] of Object.entries(layers)) {
        cells.forEach((tileId, index) => { data[Number(z) * plane + index] = tileId; });
    }
    return { width, height, data, tilesetId: 1 };
}

/** A tileset whose named tiles carry the given flags and nothing else does. */
function tilesetWith(flagsByTile) {
    const flags = new Array(8192).fill(0);
    for (const [tileId, value] of Object.entries(flagsByTile)) flags[Number(tileId)] = value;
    return { id: 1, name: 'test', flags };
}

/** Paint `tiles` over the whole grid, cycling through them. */
const fill = (width, height, tiles) =>
    Array.from({ length: width * height }, (unused, i) => tiles[i % tiles.length]);

test('the class values match the runtime the file is read by', () => {
    assert.equal(GROUND, Reactor3D.CLASS_GROUND);
    assert.equal(UPRIGHT, Reactor3D.CLASS_UPRIGHT);
    assert.equal(SCENERY, Reactor3D.CLASS_SCENERY);
    assert.equal(FOLIAGE, Reactor3D.CLASS_FOLIAGE);
    assert.equal(derive.LONE_SHAPE, Reactor3D.LONE_SHAPE);
    assert.equal(derive.classKey(2048 + 47), Reactor3D.classKey(2048 + 47));
});

test('a canopy tiled over an area becomes trees, not a facade', () => {
    // The reported bug. B tiles painted as a texture across a 20x20 block were
    // classified upright, and every column of the block then collapsed into one
    // facade as tall as the run: a 58x39 forest became walls sixteen tiles high.
    //
    // The tiling art is columns 4-5, rows 5-6 of the B sheet. The lone tree is
    // drawn in the same columns directly above it, rows 3-4, and is not painted
    // here — it is the template, not the fill.
    const canopy = [44, 45, 52, 53];
    const flags = {};
    for (const id of canopy) flags[id] = BLOCKED;
    const map = mapWith(20, 20, { 2: fill(20, 20, canopy) });

    const { classes, standIns } = derive.classifyTileset([map], tilesetWith(flags));
    for (const id of canopy) {
        assert.equal(classes[id], FOLIAGE, `tile ${id} is terrain`);
    }

    // Standing the tiling art up gave a wall of bark; standing the tree above
    // it up gives a forest. The span matters: pointing at tile 28 alone drew
    // the top-left quarter of each tree, a hillside of spikes.
    assert.deepEqual(standIns[44], [28, 2, 2], 'pointed at the whole tree, not a corner of it');
    assert.deepEqual(standIns[53], [28, 2, 2]);
});

test('a building drawn as one picture still stands up', () => {
    // Just as dense as the canopy, and the opposite answer: every cell of a
    // building is a different part of one drawing, so nothing repeats.
    const flags = {};
    const cells = [];
    for (let i = 0; i < 64; i++) { cells.push(200 + i); flags[200 + i] = BLOCKED | STAR; }
    const map = mapWith(8, 8, { 2: cells });

    const { classes } = derive.classifyTileset([map], tilesetWith(flags));
    assert.equal(classes[200], UPRIGHT);
    assert.equal(classes[263], UPRIGHT);
});

test('a prop in open ground is judged on its own, not on its neighbours', () => {
    // A crater beside a forest joins that forest's connected region, and
    // judging by region raised it a tile on a plinth of its own. The
    // neighbourhood is what settles it: the crater's is mostly empty.
    const canopy = [44, 45, 52, 53];
    const flags = { 800: BLOCKED, 801: BLOCKED, 808: BLOCKED, 809: BLOCKED };
    for (const id of canopy) flags[id] = BLOCKED;

    const width = 24, height = 12;
    const cells = new Array(width * height).fill(0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < 12; x++) cells[y * width + x] = canopy[(x + y) % canopy.length];
    }
    // The crater sits just clear of the canopy, in the open.
    cells[5 * width + 14] = 800; cells[5 * width + 15] = 801;
    cells[6 * width + 14] = 808; cells[6 * width + 15] = 809;
    const map = mapWith(width, height, { 2: cells });

    const { classes } = derive.classifyTileset([map], tilesetWith(flags));
    assert.equal(classes[44], FOLIAGE, 'the canopy is terrain');
    for (const id of [800, 801, 808, 809]) {
        assert.equal(classes[id], UPRIGHT, `the rock at ${id} is a prop, not terrain`);
    }
});

test('a B-E tile that blocks or draws above the character stands up', () => {
    // Requiring the star flag was far too strict. An author sets it only where
    // a character can walk *behind* something, so a lone tree, a mountain and a
    // landed ship all lay flat while the forest beside them stood up. What
    // stays flat is what is genuinely painted onto the ground.
    //
    // Tile 300 sits at column 4 row 5 of its sheet, 400 at column 8 row 2 and
    // 500 at column 12 row 6, so all three are separate pieces of art.
    const flags = { 300: BLOCKED, 400: STAR, 500: 0 };
    const map = mapWith(10, 10, { 2: (() => {
        const cells = new Array(100).fill(0);
        cells[22] = 300; cells[55] = 400; cells[77] = 500;
        return cells;
    })() });

    const { classes } = derive.classifyTileset([map], tilesetWith(flags));
    assert.equal(classes[300], UPRIGHT, 'blocking the way means it is a thing in the world');
    assert.equal(classes[400], UPRIGHT, 'so does drawing above the character');
    // Nothing is written for it: with no flag suggesting otherwise the runtime
    // already lays it flat, so an entry would only repeat what silence says.
    assert.ok(!(500 in classes), 'a walkable, unstarred marking stays on the floor');
});

test('one starred row stands the whole prop, not just that row', () => {
    // ★ means "draws above the character", so an author sets it on the rows a
    // character can walk behind and leaves the rest bare: the Infernis gantry
    // is three rows tall and only its top row carries it. Read per tile, that
    // stood the top of a structure up and left its legs on the floor.
    //
    // Columns 4-6, rows 5-7 of the sheet: ids 300-302, 308-310, 316-318.
    const rows = [[300, 301, 302], [308, 309, 310], [316, 317, 318]];
    const flags = {};
    for (const row of rows) for (const id of row) flags[id] = BLOCKED;
    for (const id of rows[0]) flags[id] = BLOCKED | STAR;   // only the top row

    const cells = new Array(100).fill(0);
    rows.forEach((row, r) => row.forEach((id, c) => { cells[(r + 2) * 10 + c + 3] = id; }));
    const { classes } = derive.classifyTileset([mapWith(10, 10, { 2: cells })],
        tilesetWith(flags));

    for (const row of rows) {
        for (const id of row) {
            assert.equal(classes[id], UPRIGHT, `tile ${id} stands with the rest of the prop`);
        }
    }
});

test('autotiles are read off the sheet rather than guessed', () => {
    const blocked = {};
    for (const id of [2048, 2816, 4352, 5888, 5888 + 8 * 48]) blocked[id] = BLOCKED;
    const flags = tilesetWith(blocked).flags;

    assert.equal(derive.autotileClass(2048, flags), GROUND, 'A1 water lies flat even when blocked');
    assert.equal(derive.autotileClass(2816, flags), FOLIAGE, 'a blocked A2 is a forest or a range');
    assert.equal(derive.autotileClass(2816 + 48, flags), GROUND, 'a walkable A2 is floor');
    // A wall is a mass, not a cut-out: standing each column of one as a plane
    // made a dungeon's walls vanish from above and turned a block of wall eight
    // cells deep into an eight-tile tower.
    assert.equal(derive.autotileClass(4352, flags), SCENERY, 'A3 is walls throughout');
    assert.equal(derive.autotileClass(5888, flags), FOLIAGE, 'a blocked A4 roof row is terrain');
    assert.equal(derive.autotileClass(5888 + 8 * 48, flags), SCENERY, 'the A4 wall rows are mass');
    // A5 has no shapes, so there is no lone variant to stand up: it is a mass.
    assert.equal(derive.autotileClass(1536, tilesetWith({ 1536: BLOCKED }).flags), SCENERY);
});

test('only tiles the maps actually use are classified', () => {
    // An unclassified tile renders flat, which is the honest answer for art
    // nobody has painted yet — and it keeps the file to the project's size
    // rather than the tileset's.
    const flags = { 300: BLOCKED | STAR, 400: BLOCKED | STAR };
    const map = mapWith(6, 6, { 2: (() => {
        const cells = new Array(36).fill(0);
        cells[14] = 300;
        return cells;
    })() });

    const { classes } = derive.classifyTileset([map], tilesetWith(flags));
    assert.ok(300 in classes, 'the painted tile is classified');
    assert.ok(!(400 in classes), 'the unpainted one is left alone');
});

test('a derived file survives the runtime and the editor store unchanged', () => {
    const canopy = [44, 45, 52, 53];
    const flags = {};
    for (const id of canopy) flags[id] = BLOCKED;
    const map = mapWith(16, 16, { 2: fill(16, 16, canopy) });
    const { classes, standIns } = derive.classifyTileset([map], tilesetWith(flags));
    const file = { version: 1, tilesets: { 1: classes }, standIns: { 1: standIns } };
    Reactor3D.setClassification(file);
    assert.equal(Reactor3D.tileClass('1', 44), FOLIAGE);
    assert.equal(Reactor3D.foliagePredicate('1')(44), true);
    assert.equal(Reactor3D.uprightPredicate('1', null, { guess: false })(44), false,
        'foliage does not also join a facade');
    assert.equal(Reactor3D.standInFor('1', 2816 + 3), 2816 + Reactor3D.LONE_SHAPE,
        'an autotile resolves its own lone variant');
    Reactor3D.setClassification(null);

    const store = require(path.join(repoRoot, 'editor', 'src', 'utils', 'Tileset3DClass.js'));
    assert.deepEqual(store.normalize(file).tilesets['1'], classes,
        'the editor reads back exactly what was written');
});
