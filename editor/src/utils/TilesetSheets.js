/**
 * Tileset sheet slots and the tile-ID bands they address.
 *
 * RPG Maker allocates nine sheets (A1-A5, B-E). Reactor adds two more, F and G,
 * in the 1024-1535 tile-ID band, which MZ leaves unallocated between E (ending
 * at 1023) and A5 (starting at 1536). Nothing in the MZ format or in an
 * MZ-authored project ever produces an ID in that band, so the addition cannot
 * collide with imported data.
 *
 * The band was chosen because the engine's own address arithmetic already
 * resolves it correctly without modification:
 *
 *   setNumber = 5 + Math.floor(tileId / 256)   ->  1024 => 9, 1280 => 10
 *
 * That expression backs both tile rendering (Tilemap._addNormalTile) and event
 * tile-graphics (Sprite_Character.tilesetBitmap), and the 8192-entry tileset
 * `flags` array already covers 1024-1535, so passability, star, ladder, counter
 * and terrain tags need no format change either.
 *
 * Slot 11 is deliberately left unused. The legacy (pre-v8) tile renderer packs
 * sheets into 2048px atlases four to a texture with MAX_GL_TEXTURES = 3, and
 * UltraMode7 reimplements that packing itself (`setNumber >> 2`). Slots 0-11
 * stay inside those assumptions; slot 12 would break them.
 */
(function(root) {
    // Sheet slot keys, indexed by position in a tileset's `tilesetNames`.
    const SHEET_KEYS = ['A1', 'A2', 'A3', 'A4', 'A5', 'B', 'C', 'D', 'E', 'F', 'G'];

    // Slots Reactor presents. Stored arrays may legitimately be shorter: an
    // MZ-authored tileset carries nine entries and is left that way until a
    // slot beyond it is actually assigned.
    const SHEET_COUNT = SHEET_KEYS.length;

    // Sheets that behave like B-E: plain 16x16 tile grids, not autotiles.
    const NORMAL_SHEET_KEYS = ['B', 'C', 'D', 'E', 'F', 'G'];

    // First tile ID of each normal sheet, by slot index.
    const NORMAL_SHEET_BASE = { 5: 0, 6: 256, 7: 512, 8: 768, 9: 1024, 10: 1280 };

    // The Reactor-added band, half-open: [1024, 1536).
    const EXTENDED_TILE_ID_MIN = 1024;
    const EXTENDED_TILE_ID_MAX = 1536;

    const keyFromIndex = index => SHEET_KEYS[index] || null;
    const indexFromKey = key => SHEET_KEYS.indexOf(key);

    const isNormalSheetKey = key => NORMAL_SHEET_KEYS.includes(key);

    /**
     * True for a slot laid out like B-E: a 16x16 grid stored as two 8-wide
     * halves, addressed 256 tiles per sheet. Slots 5-10 (B, C, D, E, F, G).
     */
    const isNormalSheetIndex = index =>
        Object.prototype.hasOwnProperty.call(NORMAL_SHEET_BASE, index);

    /** True for a tile ID in the Reactor-added F/G band. */
    const isExtendedTileId = tileId =>
        Number.isInteger(tileId) &&
        tileId >= EXTENDED_TILE_ID_MIN &&
        tileId < EXTENDED_TILE_ID_MAX;

    /** Sheet slot that holds a normal (non-autotile, non-A5) tile ID. */
    const setNumberForNormalTileId = tileId => 5 + Math.floor(tileId / 256);

    /** First tile ID addressed by a normal sheet slot, or null if not one. */
    const baseTileIdForSheet = index =>
        Object.prototype.hasOwnProperty.call(NORMAL_SHEET_BASE, index)
            ? NORMAL_SHEET_BASE[index]
            : null;

    /**
     * Read a slot from a tileset's `tilesetNames`, tolerating the shorter
     * arrays that MZ-authored and pre-F/G Reactor projects carry.
     */
    const nameAt = (tilesetNames, index) => (tilesetNames && tilesetNames[index]) || '';

    /**
     * Assign a sheet slot, growing `tilesetNames` if needed.
     *
     * Writing past the end of a short array would otherwise leave holes, which
     * `JSON.stringify` turns into `null` — and the runtime iterates the array
     * with `for...of`, handing those nulls to `ImageManager.loadTileset`. Any
     * gap is filled with '' so every element stays a string.
     */
    const setNameAt = (tilesetNames, index, name) => {
        for (let i = tilesetNames.length; i < index; i++) tilesetNames[i] = '';
        tilesetNames[index] = name || '';
        return tilesetNames;
    };

    const api = {
        SHEET_KEYS,
        SHEET_COUNT,
        NORMAL_SHEET_KEYS,
        NORMAL_SHEET_BASE,
        EXTENDED_TILE_ID_MIN,
        EXTENDED_TILE_ID_MAX,
        keyFromIndex,
        indexFromKey,
        isNormalSheetKey,
        isNormalSheetIndex,
        isExtendedTileId,
        setNumberForNormalTileId,
        baseTileIdForSheet,
        nameAt,
        setNameAt
    };
    root.RRTilesetSheets = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
