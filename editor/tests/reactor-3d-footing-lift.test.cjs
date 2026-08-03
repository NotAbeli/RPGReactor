/**
 * Where a column of standing art meets the ground.
 *
 * Reported as chunks missing out of the front of a mountain range in 3D on a
 * map that looks solid in 2D. A connected region of upright cells shares one
 * footing — its southernmost row — so that a wall does not tear in depth. That
 * footing was deciding *height* as well: a column whose lowest painted cell is
 * north of the region's footing had its art indexed from the footing, so it was
 * drawn that many courses up with nothing beneath it. A range's southern edge
 * steps back in ones and twos, so its whole front row stood a tile clear of the
 * ground. On Infernis Prime, 166 of 616 columns; across the project's 906 maps,
 * 10,207.
 *
 * The two questions are separated here: the footing still sets the depth the
 * art is drawn at, and a column only hangs when something is holding it up.
 * An archway's panel has posts either side, so the rows beneath it are spanned
 * by the same region left and right; a range's edge has open ground on one
 * side, so it sits down.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));
const Geometry = Reactor3D.Geometry;

const PLANES = 6;
/** Ids used as standing art; anything else is ordinary ground. */
const STAND = new Set([100, 101, 102, 103]);
const isUpright = tileId => STAND.has(tileId);

/**
 * A map painted from rows of characters, one per cell.
 *
 * `#` is standing art, `.` is bare ground. The art goes on the upper layer, as
 * a prop drawn over terrain is on a real map.
 */
function mapFrom(rows) {
    const height = rows.length;
    const width = rows[0].length;
    const plane = width * height;
    const data = new Array(plane * PLANES).fill(0);
    rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            data[y * width + x] = 1;                       // ground everywhere
            if (ch === '#') data[2 * plane + y * width + x] = 100;
        });
    });
    return { width, height, data };
}

/** The runs of one map, keyed by column. */
function columnsOf(rows) {
    const runs = Geometry.uprightRuns(mapFrom(rows), isUpright, Infinity, null);
    const byColumn = new Map();
    for (const run of runs) {
        if (!byColumn.has(run.x)) byColumn.set(run.x, []);
        byColumn.get(run.x).push(run);
    }
    return byColumn;
}

/** How many empty courses sit beneath a column's lowest piece of art. */
function hang(run) {
    let lift = 0;
    while (lift < run.tiles.length && run.tiles[lift] === undefined) lift++;
    return lift;
}

/** Every course of art the run actually carries. */
function courses(run) {
    return [...run.tiles].filter(tile => tile !== undefined);
}

test('a stepped edge stands on the ground, not above it', () => {
    // The reported case, in miniature: a range whose southern edge steps back
    // by one. The left column stops a row short of the region's footing, and
    // there is open ground west of it, so nothing is holding it up.
    //
    //   ##      <- both columns painted here
    //   .#      <- only the right column reaches the footing
    const byColumn = columnsOf([
        '##',
        '.#'
    ]);
    const left = byColumn.get(0)[0];
    const right = byColumn.get(1)[0];

    assert.equal(hang(left), 0, 'the stepped-back column sits on the ground');
    assert.equal(hang(right), 0);
    // Both still stand at the region's footing, so the wall does not tear in
    // depth — that is what sharing a footing is for and it is unchanged.
    assert.equal(left.faceY, 1);
    assert.equal(right.faceY, 1);
    assert.deepEqual(courses(left), [100]);
    assert.deepEqual(courses(right), [100, 100]);
});

test('an archway keeps hanging, because its posts hold it up', () => {
    // The case the shared footing exists for. The middle column's lower rows
    // are spanned by the same region on both sides, so it is a panel over a
    // gap rather than an edge that steps back.
    //
    //   ###
    //   #.#
    //   #.#
    const byColumn = columnsOf([
        '###',
        '#.#',
        '#.#'
    ]);
    const middle = byColumn.get(1)[0];
    assert.equal(hang(middle), 2, 'the panel stays two courses up, over the opening');
    assert.equal(middle.faceY, 2, 'and at the footing the posts stand on');
    assert.deepEqual(courses(middle), [100]);

    for (const x of [0, 2]) {
        const post = byColumn.get(x)[0];
        assert.equal(hang(post), 0, `post at ${x} is on the ground`);
        assert.deepEqual(courses(post), [100, 100, 100]);
    }
});

test('bridging is counted only while it is unbroken', () => {
    // A panel carried for two rows and open below that is a panel on posts
    // standing on a slope, not a panel floating three tiles up. Counting every
    // bridged row anywhere beneath would put it back in the air.
    //
    //   ###
    //   #.#
    //   #.#
    //   ..#      <- the west post stops, so the bridging breaks here
    const byColumn = columnsOf([
        '###',
        '#.#',
        '#.#',
        '..#'
    ]);
    const middle = byColumn.get(1)[0];
    assert.equal(hang(middle), 2, 'it hangs over the opening it actually spans');
    assert.equal(middle.faceY, 3, 'while still standing at the region footing');
});

test('a flat-bottomed wall is untouched', () => {
    // Every column already reaches the footing, so there is nothing to lower
    // and this must produce exactly what it always did.
    const byColumn = columnsOf([
        '###',
        '###'
    ]);
    for (const x of [0, 1, 2]) {
        const run = byColumn.get(x)[0];
        assert.equal(hang(run), 0);
        assert.equal(run.faceY, 1);
        assert.deepEqual(courses(run), [100, 100]);
    }
});

test('separate regions keep their own footings', () => {
    // Two buildings that do not touch are two buildings. Lowering a column
    // must not merge them or move either one's base.
    //
    //   #.#
    //   #.#
    //   ..#
    const byColumn = columnsOf([
        '#.#',
        '#.#',
        '..#'
    ]);
    assert.equal(byColumn.get(0)[0].faceY, 1, 'the west building keeps its own base');
    assert.equal(byColumn.get(2)[0].faceY, 2, 'the east one keeps its own');
    assert.equal(hang(byColumn.get(0)[0]), 0);
    assert.equal(hang(byColumn.get(2)[0]), 0);
});

test('no course of art is gained or lost by lowering a column', () => {
    // The change moves art down; it must never drop a course or invent one.
    // A ragged edge in both directions, which is what a range's front is.
    const rows = [
        '..##..',
        '.####.',
        '######'
    ];
    const painted = rows.join('').split('').filter(ch => ch === '#').length;
    const runs = Geometry.uprightRuns(mapFrom(rows), isUpright, Infinity, null);
    const drawn = runs.reduce((total, run) => total + courses(run).length, 0);
    assert.equal(drawn, painted, 'every painted cell is drawn exactly once');

    // And every column of this shape reaches the ground: each stepped-back
    // column has open ground to one side.
    for (const run of runs) {
        assert.equal(hang(run), 0, `column ${run.x} hangs`);
    }
});

test('bridging is judged by reach along a row, which is coarse', () => {
    // An honest limit rather than a claim. The test is whether the region has
    // art either side of the column on the row beneath, which cannot tell a
    // post holding the panel up from a connected spur of the same region
    // further along the row.
    //
    //   ..##..
    //   .####.
    //   ######
    //   #.####
    //   #..###   <- the lone west column is still connected, up its own side
    //
    // So column 2, which stops at row 3, reads as spanning an opening and
    // stays a course up. Both readings are defensible here and the cheap one
    // is kept: tracing what actually carries a load is the structure question
    // the design notes record as unsolved, and the failure is one column of
    // one shape rather than a whole range's front.
    const byColumn = columnsOf([
        '..##..',
        '.####.',
        '######',
        '#.####',
        '#..###'
    ]);
    assert.equal(hang(byColumn.get(2)[0]), 1, 'read as an opening, not an edge');
    // The columns that matter — the range's own stepped front — are grounded
    // regardless.
    for (const x of [0, 3, 4, 5]) {
        assert.equal(hang(byColumn.get(x)[0]), 0, `column ${x} is on the ground`);
    }
});

test('a column bridged to the map edge still hangs', () => {
    // Bridging is judged within the region, not against the map, so a panel
    // whose posts run off the edge of the map is still a panel.
    const byColumn = columnsOf([
        '###',
        '#.#'
    ]);
    assert.equal(hang(byColumn.get(1)[0]), 1);
});
