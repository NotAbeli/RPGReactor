const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const metrics = require(path.join(editorRoot, 'src', 'utils', 'TileMetrics.js'));

test('the tile size comes from the project, not from an assumption', () => {
    // RPG Maker MZ offers 48, 32, 24 and 16 and records the choice in
    // System.json. A real project at 32 rendered as a mosaic of the wrong art
    // in the editor, because every sheet was sampled in 48-pixel steps: each
    // read landed one and a half tiles along and the error accumulated.
    assert.equal(metrics.tileSizeOf({ tileSize: 32 }), 32);
    assert.equal(metrics.tileSizeOf({ tileSize: 24 }), 24);
    assert.equal(metrics.tileSizeOf({ tileSize: 16 }), 16);
    assert.equal(metrics.tileSizeOf({ tileSize: 48 }), 48);

    // Anything else is more likely a damaged file than a project nobody has
    // seen, and guessing silently is what this module exists to stop.
    assert.equal(metrics.tileSizeOf({ tileSize: 64 }), 48);
    assert.equal(metrics.tileSizeOf({ tileSize: '32' }), 32, 'a string still reads as a number');
    assert.equal(metrics.tileSizeOf({}), 48);
    assert.equal(metrics.tileSizeOf(null), 48);
    assert.equal(metrics.tileSizeOf(undefined), 48);

    // A 32-pixel project's sheets are two thirds of MZ's standard layout.
    assert.equal(metrics.sheetScaleOf({ tileSize: 32 }), 2 / 3);
    assert.equal(768 * metrics.sheetScaleOf({ tileSize: 32 }), 512);
    assert.equal(576 * metrics.sheetScaleOf({ tileSize: 32 }), 384);
});

test('the renderers read it rather than hardcoding 48', () => {
    // Each of these sampled sheets in 48-pixel steps, so a 32-pixel project
    // drew the wrong tile everywhere. The distinction that matters: 48 also
    // means "shapes per autotile kind" in tile-id arithmetic, which is a
    // property of the format and must stay exactly where it is.
    const tilemap = fs.readFileSync(path.join(editorRoot, 'src', 'TilemapManager.js'), 'utf8');
    assert.match(tilemap, /this\.TILE_SIZE = this\.readTileSize\(\)/);
    assert.match(tilemap, /refreshTileMetrics\(\)/);
    assert.doesNotMatch(tilemap, /const tileSize = 48/, 'no pixel size is assumed');
    // The format constant survives untouched.
    assert.match(tilemap, /\(tileId - this\.TILE_ID_A1\) \/ 48/);

    const palette = fs.readFileSync(path.join(editorRoot, 'src', 'TilesetPaletteViewer.js'), 'utf8');
    assert.doesNotMatch(palette, /const tileSize = 48/);
    assert.doesNotMatch(palette, /canvasX \/ 48/);
    assert.match(palette, /refreshTileMetrics\(\)/);

    const tilesets = fs.readFileSync(
        path.join(editorRoot, 'src', 'database', 'DatabaseTilesetEditor.js'), 'utf8');
    assert.match(tilesets, /this\.tileSize = this\.readTileSize\(\)/);
    assert.doesNotMatch(tilesets, /size: 48, stepped/);

    // And the surfaces are told to re-read once the database has loaded, since
    // both are constructed before it.
    const main = fs.readFileSync(path.join(editorRoot, 'src', 'main.js'), 'utf8');
    assert.match(main, /tilesetPaletteViewer\.refreshTileMetrics\(\)/);
    assert.match(main, /tilemapManager\.refreshTileMetrics\(\)/);

    // The module is loaded before the code that uses it.
    const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
    assert.ok(html.indexOf('src/utils/TileMetrics.js') > 0, 'the editor loads it');
});

test('nothing that measures in pixels still assumes 48', () => {
    // A sweep rather than a list, because the ones that get missed are the
    // ones nobody thought to look at. The distinction: 48 as a *pixel* size is
    // the project's choice, while 48 as "shapes per autotile kind" is fixed by
    // the file format and must never move.
    const files = [
        'src/TilemapManager.js', 'src/MapEditor.js', 'src/MapEditor3D.js',
        'src/TilesetPaletteViewer.js', 'src/ProjectController.js',
        'src/database/DatabaseTilesetEditor.js'
    ];
    // A default reached when the project has not said — `|| 48`, `: 48`,
    // `return 48` — is the point of the exercise rather than a violation, and
    // `% 48` / `< 48` / `2048 + kind * 48` are the format's shapes per kind.
    const allowed = [
        /\|\| 48/, /: 48\b/, /return 48;/,                      // stated fallbacks
        /[%<] 48/, /\d{4} \+ [^;]*\* 48/,                       // format arithmetic
        /- (?:2048|2816|4352|5888|band\.base|tileStart|this\.TILE_ID_A1)\) \/ 48/,
        /48 (?:IDs|shapes|kinds|variations|consecutive)/,
        /0\.48/, /48, 32, 24, 16/, /prototype\.tileSize = 48/,
        /kindOffset = 48/, /A4 has 48/, /shape slots/
    ];
    const offenders = [];
    for (const file of files) {
        const source = fs.readFileSync(path.join(editorRoot, file), 'utf8');
        source.split('\n').forEach((line, index) => {
            if (!/\b48\b/.test(line)) return;
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;        // a comment
            if (allowed.some(pattern => pattern.test(line))) return;
            offenders.push(`${file}:${index + 1}  ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [],
        `these still measure in a hardcoded 48:\n${offenders.join('\n')}`);
});

test('changing the size in the Database reaches the open map', () => {
    // Every surface reads the size once, when a project loads. Changing it in
    // the Database and seeing nothing happen until the next launch looks
    // exactly like the setting doing nothing at all.
    const system2 = fs.readFileSync(
        path.join(editorRoot, 'src', 'database', 'DatabaseSystem2Editor.js'), 'utf8');
    assert.match(system2, /system\.tileSize = parseInt/);
    assert.match(system2, /rpgReactorTileSizeChanged/, 'it announces the change');

    const main = fs.readFileSync(path.join(editorRoot, 'src', 'main.js'), 'utf8');
    assert.match(main, /window\.rpgReactorTileSizeChanged = \(\) =>/);
    assert.match(main, /refreshTileMetrics\(\)/);
    assert.match(main, /loadMap\(openMap/, 'and the open map is redrawn');
});
