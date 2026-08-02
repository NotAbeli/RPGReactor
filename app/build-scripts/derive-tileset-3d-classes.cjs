#!/usr/bin/env node
/**
 * Derives a project's `Tilesets.r3d.json` from the way its maps are painted.
 *
 *   node editor/build-scripts/derive-tileset-3d-classes.cjs "template/My Project"
 *   node editor/build-scripts/derive-tileset-3d-classes.cjs "template/My Project" --dry-run
 *
 * Which tiles stand up in 3D cannot be read off the tileset flags: a shopfront
 * wall and a forest are both simply impassable, and a file generated from the
 * flags alone stood a 58x39 forest on end as facades up to sixteen tiles tall.
 * The flags do settle one half of the question — whether a tile is scenery at
 * all, which is what impassable-on-all-sides and draws-above-characters mean —
 * so this script takes that from them and settles the other half, prop versus
 * terrain, from the maps.
 *
 * The distinction it uses: a building is one picture spread across its cells,
 * so within its footprint the tiles are mostly distinct. A forest or a mountain
 * range is a small set of tiles repeated over an area, so each tile recurs many
 * times. Region shape alone is not enough — a small clump of forest looks like
 * a prop — so a tile that reads as terrain anywhere it is painted is terrain
 * everywhere. That asymmetry is deliberate: a misjudged prop lies flat or rises
 * a tile, while a misjudged forest becomes a wall across the map.
 *
 * Autotiles are not guessed at all. A1, A2 and the A4 roof rows are floors, A3
 * and the A4 wall rows are walls, and A5 lies flat — the sheet a tile lives on
 * already says which.
 *
 * Only tiles actually painted on a map that uses the tileset are classified;
 * anything else is left out, and an unclassified tile renders flat.
 */
const fs = require('node:fs');
const path = require('node:path');

const GROUND = 1, UPRIGHT = 2, SCENERY = 3, FOLIAGE = 4;
const VERSION = 1;
const OUTPUT = 'Tilesets.r3d.json';
/** The autotile shape drawn for a single isolated cell. */
const LONE_SHAPE = 46;

/** Half-width of the neighbourhood each placement is judged in. */
const WINDOW = 2;
/** How full that neighbourhood must be before it counts as covered ground. */
const COVERAGE = 0.8;
/**
 * How often the tiles in it must repeat before it counts as a texture.
 *
 * Measured across the whole neighbourhood rather than per tile: a canopy is
 * drawn as a block of tiles laid down as a unit, and asking each of them to
 * recur on its own split the block, raising four of its rows and leaving the
 * other four flat — a forest in corduroy.
 */
const REUSE = 2;
/**
 * How much terrain-like use it takes to call a tile terrain.
 *
 * Low on purpose. A canopy tile painted mostly in small clumps and once in a
 * large mass is still a canopy tile, and the large mass is where it does the
 * damage: a misjudged prop rises a tile, a misjudged forest becomes a wall
 * across the map.
 */
const TERRAIN_SHARE = 0.25;

const readJson = file => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

/** Autotiles occupy 48 ids per kind; a kind is classified once, at its base. */
const classKey = tileId =>
    (tileId >= 2048 && tileId < 8192) ? 2048 + Math.floor((tileId - 2048) / 48) * 48 : tileId;

/** True where the flags say a tile is something other than floor. */
const standsUp = (flags, tileId) => {
    const flag = flags[tileId] || 0;
    return (flag & 0x10) !== 0 || (flag & 0x0f) === 0x0f;
};

/**
 * The class of an autotile, from the sheet it lives on.
 *
 * A3 is walls throughout and A4 alternates roof rows and wall rows, eight kinds
 * to a row, so those need no guessing. The rest are surfaces, and there the
 * flags do separate the two cases that matter: a walkable A2 is floor, while a
 * blocked one is a mountain or a cliff mass, which rises rather than lying flat.
 */
function autotileClass(tileId, flags) {
    // A wall is a mass, not a cut-out.
    //
    // Standing each column of one as a plane on its southern face was wrong in
    // both directions at once: from above a dungeon's walls vanished and the
    // maze read as open floor, and from an angle a block of wall eight cells
    // deep became an eight-tile tower. Raising the ground instead makes the
    // walled area solid and the corridors carved out of it, and the wall art
    // reaches the vertical faces through the same code that draws a cliff.
    if (tileId >= 4352 && tileId < 5888) return SCENERY;      // A3 walls
    if (tileId >= 5888 && tileId < 8192) {                    // A4 roofs and walls
        const kind = Math.floor((tileId - 5888) / 48);
        if (Math.floor(kind / 8) % 2 === 1) return SCENERY;
        return standsUp(flags, tileId) ? FOLIAGE : GROUND;
    }
    // A1 is water and waterfalls, which lie flat however they are flagged;
    // impassable water raised as a mass turns a lake into a plateau.
    if (tileId >= 2048 && tileId < 2816) return GROUND;
    if (tileId >= 2816 && tileId < 4352) {                   // A2 ground
        // A blocked A2 is a forest or a range rather than floor, and an
        // autotile always has a lone variant to stand there — shape 46, what
        // the sheet draws for one isolated cell of it. So it becomes cut-outs
        // rather than a raised slab: a range of peaks, not a mesa.
        return standsUp(flags, tileId) ? FOLIAGE : GROUND;
    }
    if (tileId >= 1536 && tileId < 2048) {                   // A5, whole tiles
        // A5 has no shapes and so no lone variant; a blocked one is a mass.
        return standsUp(flags, tileId) ? SCENERY : GROUND;
    }
    return null;
}

/** Where a B-E tile sits on its sheet, in whole tiles. */
function sheetCell(tileId) {
    const local = tileId % 256;
    return {
        setNumber: 5 + Math.floor(tileId / 256),
        col: (Math.floor(local / 128) % 2) * 8 + (local % 8),
        row: Math.floor((local % 256) / 8) % 16
    };
}

/** The B-E tile at a sheet position, or 0 when it runs off the sheet. */
function tileAtCell(setNumber, col, row) {
    if (col < 0 || col > 15 || row < 0 || row > 15) return 0;
    const half = col >= 8 ? 128 : 0;
    return (setNumber - 5) * 256 + half + row * 8 + (col % 8);
}

/**
 * The lone variant of a B-E fill, guessed from the sheet.
 *
 * A B-E sheet has no rule saying where a lone variant sits, but the convention
 * these tilesets follow is that an object block holds both: the tiling art at
 * the bottom and the single object drawn above it, in the same columns. So the
 * block of fill tiles is measured and the same footprint directly above it is
 * offered. It is a guess, and the 3D Shape editor can point it somewhere else.
 */
function guessStandIn(fillTiles) {
    const cells = fillTiles.map(sheetCell);
    const setNumber = cells[0].setNumber;
    if (cells.some(cell => cell.setNumber !== setNumber)) return null;
    const cols = cells.map(cell => cell.col), rows = cells.map(cell => cell.row);
    const minCol = Math.min(...cols), maxCol = Math.max(...cols);
    const minRow = Math.min(...rows), maxRow = Math.max(...rows);
    const width = maxCol - minCol + 1, height = maxRow - minRow + 1;
    // Only a compact block reads as one piece of art; scattered tiles have no
    // "above" to speak of.
    if (width > 4 || height > 4 || cells.length !== width * height) return null;
    // A sheet is two half-width columns of ids side by side, and a block
    // straddling that seam is not contiguous in the image, so the whole span
    // could not be sampled as one rect.
    if (Math.floor(minCol / 8) !== Math.floor(maxCol / 8)) return null;
    const above = tileAtCell(setNumber, minCol, minRow - height);
    if (!(above > 0) || minRow - height < 0) return null;
    // The lone variant is the same size as the block it stands in for: one
    // tree drawn over the 2x2 the tiling art also occupies.
    return [above, width, height];
}

/**
 * Judge every B-E placement on one map by the company it keeps, tallying for
 * each tile how often it reads as terrain and how often as a prop.
 *
 * The neighbourhood is the unit rather than the connected region: a crater
 * painted at the edge of a forest joins that forest's region and inherits its
 * verdict, and the crater then rises a tile on a plinth of its own. What
 * separates the two locally is that a forest cell sits in covered ground and
 * repeats itself there, while a crater sits in open ground and does not.
 */
function tallyMap(map, tally) {
    const { width, height, data } = map;
    const plane = width * height;
    const occupied = new Uint8Array(plane);
    for (let z = 0; z < 4; z++) {
        for (let i = 0; i < plane; i++) {
            const id = data[z * plane + i];
            if (id > 0 && id < 1536) occupied[i] = 1;
        }
    }

    const side = WINDOW * 2 + 1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!occupied[y * width + x]) continue;

            const x0 = Math.max(0, x - WINDOW), x1 = Math.min(width - 1, x + WINDOW);
            const y0 = Math.max(0, y - WINDOW), y1 = Math.min(height - 1, y + WINDOW);
            let covered = 0, placements = 0;
            const distinct = new Set();
            for (let ny = y0; ny <= y1; ny++) {
                for (let nx = x0; nx <= x1; nx++) {
                    const cell = ny * width + nx;
                    if (occupied[cell]) covered++;
                    for (let z = 0; z < 4; z++) {
                        const id = data[z * plane + cell];
                        if (id > 0 && id < 1536) { distinct.add(id); placements++; }
                    }
                }
            }
            // Edge windows are clipped, so measure against the area actually
            // examined rather than the full square.
            const area = (x1 - x0 + 1) * (y1 - y0 + 1);
            const terrain = area >= side * side * 0.5
                && covered >= area * COVERAGE
                && placements >= distinct.size * REUSE;

            for (let z = 0; z < 4; z++) {
                const id = data[z * plane + y * width + x];
                if (!(id > 0 && id < 1536)) continue;
                const entry = tally.get(id) || { terrain: 0, prop: 0 };
                entry[terrain ? 'terrain' : 'prop']++;
                tally.set(id, entry);
            }
        }
    }
}

/**
 * Classify one tileset from the maps that use it.
 *
 * Returns `{ classes, counts }`, where `classes` is keyed the way the file is:
 * autotiles at their kind's base id, B-E tiles at their own.
 */
function classifyTileset(maps, tileset) {
    const flags = tileset.flags;

    // Every autotile kind and B-E tile the maps actually use.
    const placedAuto = new Set();
    const tally = new Map();
    for (const map of maps) {
        const plane = map.width * map.height;
        for (let z = 0; z < 4; z++) {
            for (let i = 0; i < plane; i++) {
                const id = map.data[z * plane + i];
                if (id >= 1536) placedAuto.add(classKey(id));
            }
        }
        tallyMap(map, tally);
    }

    const classes = {};
    const counts = { GROUND: 0, UPRIGHT: 0, SCENERY: 0, FOLIAGE: 0 };
    const record = (tileId, value) => {
        // A GROUND entry only earns its place where it contradicts the
        // runtime's flag heuristic; otherwise it says what the absence of an
        // entry already says.
        if (value === GROUND && !standsUp(flags, tileId)) return;
        classes[tileId] = value;
        counts[value === SCENERY ? 'SCENERY' : value === UPRIGHT ? 'UPRIGHT'
            : value === FOLIAGE ? 'FOLIAGE' : 'GROUND']++;
    };

    for (const tileId of placedAuto) {
        const value = autotileClass(tileId, flags);
        if (value !== null) record(tileId, value);
    }
    const terrainTiles = [], propTiles = [];
    for (const [tileId, use] of tally) {
        const total = use.terrain + use.prop;
        // Terrain first: a canopy tile is terrain whatever its flags say.
        if (use.terrain >= total * TERRAIN_SHARE) {
            record(tileId, FOLIAGE);
            terrainTiles.push(tileId);
        } else propTiles.push(tileId);
    }

    // Almost everything on a B-E sheet is an object, and an object stands.
    //
    // A B-E tile that blocks movement or draws above the character is a thing
    // in the world — a tree, a peak, a ship, a shrub — not a marking on the
    // floor. Requiring the star flag was far too strict: an author sets it only
    // where a character can walk *behind* something, so a lone tree, a mountain
    // and a landed ship all lay flat on the map while the forest beside them
    // stood up. What is left flat is what is genuinely painted onto the ground:
    // roads, cracks, scorch marks, anything walkable and unstarred.
    //
    // The test runs per block of art rather than per tile, so one blocking or
    // starred piece raises the whole picture: the Infernis gantry is three rows
    // tall and only its top row is starred, and reading that per tile stood its
    // head up and left its legs on the floor.
    const standing = new Set();
    for (const block of sheetBlocks(propTiles)) {
        if (!block.some(tileId => standsUp(flags, tileId))) continue;
        for (const tileId of block) standing.add(tileId);
    }
    for (const tileId of propTiles) {
        record(tileId, standing.has(tileId) ? UPRIGHT : GROUND);
    }

    // Seed a declaration for every block of prop art, so a project starts with
    // objects to correct rather than a blank sheet. A block is the same guess
    // the geometry would make on its own; writing it down is what lets an
    // author fix the cases the guess gets wrong — two different objects side by
    // side on the sheet look exactly like one wide object to it.
    const objects = [];
    for (const block of sheetBlocks(propTiles.filter(tileId => standing.has(tileId)))) {
        const cells = block.map(sheetCell);
        const setNumber = cells[0].setNumber;
        if (cells.some(cell => cell.setNumber !== setNumber)) continue;
        const cols = cells.map(cell => cell.col), rows = cells.map(cell => cell.row);
        const minCol = Math.min(...cols), maxCol = Math.max(...cols);
        const minRow = Math.min(...rows), maxRow = Math.max(...rows);
        const w = maxCol - minCol + 1, h = maxRow - minRow + 1;
        // Only a filled rectangle is one picture; an L of tiles is two things
        // that happen to touch, and guessing a bounding box around them would
        // declare the wrong object with more confidence than before.
        if (block.length !== w * h) continue;
        if (Math.floor(minCol / 8) !== Math.floor(maxCol / 8)) continue;
        objects.push({ tile: tileAtCell(setNumber, minCol, minRow), w, h, roles: 'S'.repeat(w * h) });
    }

    // Point each block of fill at the lone variant drawn above it. Blocks are
    // found by walking the tiles' positions on the sheet, since that is where
    // an object's pieces sit together whatever their ids look like.
    const standIns = {};
    for (const block of sheetBlocks(terrainTiles)) {
        const standIn = guessStandIn(block);
        if (!standIn || block.includes(standIn[0])) continue;
        for (const tileId of block) standIns[tileId] = standIn;
    }
    return { classes, counts, standIns, objects };
}

/** Group B-E tiles into the connected blocks they form on their sheets. */
function sheetBlocks(tileIds) {
    const cells = new Map();
    for (const tileId of tileIds) {
        const cell = sheetCell(tileId);
        cells.set(`${cell.setNumber}:${cell.col}:${cell.row}`, { tileId, ...cell });
    }
    const blocks = [];
    const seen = new Set();
    for (const [key, cell] of cells) {
        if (seen.has(key)) continue;
        const stack = [key];
        seen.add(key);
        const block = [];
        while (stack.length) {
            const current = cells.get(stack.pop());
            block.push(current.tileId);
            const around = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dc, dr] of around) {
                const next = `${current.setNumber}:${current.col + dc}:${current.row + dr}`;
                if (cells.has(next) && !seen.has(next)) { seen.add(next); stack.push(next); }
            }
        }
        blocks.push(block);
    }
    return blocks;
}

function classifyProject(projectDir) {
    const dataDir = path.join(projectDir, 'data');
    const tilesets = readJson(path.join(dataDir, 'Tilesets.json'));
    if (!Array.isArray(tilesets)) {
        throw new Error(`no Tilesets.json under ${dataDir}`);
    }

    const mapFiles = fs.readdirSync(dataDir).filter(name => /^Map\d+\.json$/.test(name)).sort();
    const byTileset = new Map();
    for (const name of mapFiles) {
        const map = readJson(path.join(dataDir, name));
        if (!map || !Array.isArray(map.data) || !map.width) continue;
        if (!byTileset.has(map.tilesetId)) byTileset.set(map.tilesetId, []);
        byTileset.get(map.tilesetId).push(map);
    }

    const out = { version: VERSION, tilesets: {}, standIns: {}, objects: {} };
    const report = [];
    for (const [tilesetId, maps] of [...byTileset.entries()].sort((a, b) => a[0] - b[0])) {
        const tileset = tilesets[tilesetId];
        if (!tileset || !Array.isArray(tileset.flags)) continue;
        const { classes, counts, standIns, objects } = classifyTileset(maps, tileset);

        if (Object.keys(classes).length > 0) {
            out.tilesets[String(tilesetId)] = classes;
            report.push({ tilesetId, name: tileset.name, maps: maps.length, counts });
        }
        if (Object.keys(standIns).length > 0) out.standIns[String(tilesetId)] = standIns;
        if (objects.length > 0) out.objects[String(tilesetId)] = objects;
    }
    return { out, report };
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const target = args.find(arg => !arg.startsWith('--'));
    if (!target) {
        console.error('usage: derive-tileset-3d-classes.cjs <project directory> [--dry-run]');
        process.exit(1);
    }
    const projectDir = path.resolve(target);
    const { out, report } = classifyProject(projectDir);

    for (const row of report) {
        console.log(`tileset ${String(row.tilesetId).padStart(4)}  ${String(row.maps).padStart(3)} map(s)  ` +
            `${row.name}`);
        console.log(`    ground ${String(row.counts.GROUND).padStart(4)}   ` +
            `upright ${String(row.counts.UPRIGHT).padStart(4)}   ` +
            `scenery ${String(row.counts.SCENERY).padStart(4)}   ` +
            `foliage ${String(row.counts.FOLIAGE).padStart(4)}`);
    }

    const outputPath = path.join(projectDir, 'data', OUTPUT);
    if (dryRun) {
        console.log(`\n(dry run) would write ${Object.keys(out.tilesets).length} tilesets to ${outputPath}`);
        return;
    }
    fs.writeFileSync(outputPath, JSON.stringify(out, null, 0) + '\n');
    console.log(`\nwrote ${outputPath} (${Object.keys(out.tilesets).length} tilesets)`);
}

if (require.main === module) main();

module.exports = { classifyProject, classifyTileset, autotileClass, classKey, standsUp, tallyMap,
    guessStandIn, sheetBlocks, sheetCell,
    WINDOW, COVERAGE, REUSE, TERRAIN_SHARE, GROUND, UPRIGHT, SCENERY, FOLIAGE, LONE_SHAPE };
