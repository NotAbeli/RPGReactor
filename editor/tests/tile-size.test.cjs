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
