/**
 * Per-tile 3D classification, stored beside the database as `Tilesets.r3d.json`.
 *
 * Which tiles stand up and which lie flat cannot be derived from map data — a
 * shopfront wall and a cliff edge are both simply impassable, and guessing from
 * the flags produced facades fifty-one tiles tall on a real city map. So it is
 * authored, and because a tile is the same kind of thing wherever it is painted,
 * it is stored per tileset rather than per map.
 *
 * The file is additive: a project without one behaves exactly as it did, and the
 * runtime falls back to its flag heuristic for any tile left unclassified. The
 * class values mirror `Reactor3D.CLASS_*` in `runtime/reactor_3d.js`; a test
 * pins them together, since the editor cannot load the runtime module.
 */
(function(root) {
    const AUTO = 0;      // fall back to the runtime's heuristic
    const GROUND = 1;    // always lies flat
    const UPRIGHT = 2;   // part of a standing object
    const SCENERY = 3;   // stands on its own cell, one tile tall

    // Upright and scenery both stand up; the difference is what a column of
    // them means. A building is one picture spanning many cells, so those cells
    // collapse into a single facade as tall as the column. A forest is the same
    // tile repeated over an area — collapsing that gives a wall of bark instead
    // of trees — so scenery stands per cell with the ground still under it.

    const FILENAME = 'Tilesets.r3d.json';
    const VERSION = 1;

    const create = () => ({ version: VERSION, tilesets: {} });

    /**
     * The id a class is stored under.
     *
     * Autotiles occupy 48 consecutive ids — one per shape — but a shape is a
     * corner arrangement, not a different kind of thing, so a kind is
     * classified once at its base id and every shape reads that entry. Mirrors
     * `Reactor3D.classKey`; a test pins the two together.
     */
    const keyFor = tileId => {
        const id = Number(tileId);
        if (id >= 2048 && id < 8192) return 2048 + Math.floor((id - 2048) / 48) * 48;
        return id;
    };

    /**
     * Normalise whatever was on disk.
     *
     * A hand-edited or truncated file must not take the editor down, so anything
     * unrecognised degrades to "nothing is classified" rather than throwing.
     */
    const normalize = data => {
        if (!data || typeof data !== 'object' || !data.tilesets || typeof data.tilesets !== 'object') {
            return create();
        }
        const tilesets = {};
        for (const [tilesetId, tiles] of Object.entries(data.tilesets)) {
            if (!tiles || typeof tiles !== 'object') continue;
            const kept = {};
            for (const [tileId, value] of Object.entries(tiles)) {
                // Only the two explicit classes are stored; AUTO is the absence
                // of an entry, so writing it would bloat the file for no reason.
                // Keys are folded to their autotile kind so a hand-written file
                // that named a shape is still read back by every shape.
                if (value === GROUND || value === UPRIGHT || value === SCENERY) {
                    kept[keyFor(tileId)] = value;
                }
            }
            if (Object.keys(kept).length > 0) tilesets[tilesetId] = kept;
        }
        return { version: VERSION, tilesets };
    };

    const classOf = (data, tilesetId, tileId) => {
        const tiles = data && data.tilesets && data.tilesets[tilesetId];
        const value = tiles && tiles[keyFor(tileId)];
        return value === GROUND || value === UPRIGHT || value === SCENERY ? value : AUTO;
    };

    /**
     * Set a tile's class, returning the same object for chaining.
     *
     * Setting AUTO deletes the entry, and an emptied tileset drops out
     * entirely, so clearing every tile leaves a file identical to a fresh one
     * rather than a husk of empty objects.
     */
    const setClass = (data, tilesetId, tileId, value) => {
        const store = data && data.tilesets ? data : create();
        const key = String(tilesetId);
        const tile = keyFor(tileId);
        if (value !== GROUND && value !== UPRIGHT && value !== SCENERY) {
            if (store.tilesets[key]) {
                delete store.tilesets[key][tile];
                if (Object.keys(store.tilesets[key]).length === 0) delete store.tilesets[key];
            }
            return store;
        }
        if (!store.tilesets[key]) store.tilesets[key] = {};
        store.tilesets[key][tile] = value;
        return store;
    };

    /** Ground -> Upright -> Scenery -> Auto, the order the editor cycles. */
    const cycle = current => {
        if (current === AUTO) return GROUND;
        if (current === GROUND) return UPRIGHT;
        if (current === UPRIGHT) return SCENERY;
        return AUTO;
    };

    /** How many tiles a tileset has classified, for a "needs attention" hint. */
    const countClassified = (data, tilesetId) => {
        const tiles = data && data.tilesets && data.tilesets[String(tilesetId)];
        return tiles ? Object.keys(tiles).length : 0;
    };

    const isEmpty = data =>
        !data || !data.tilesets || Object.keys(data.tilesets).length === 0;

    const api = {
        AUTO, GROUND, UPRIGHT, SCENERY, FILENAME, VERSION,
        create, normalize, keyFor, classOf, setClass, cycle, countClassified, isEmpty
    };
    root.RRTileset3DClass = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
