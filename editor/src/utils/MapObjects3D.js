/**
 * Which cells of a map are one 3D object, said outright rather than derived.
 *
 * The tileset says what a *tile* is, and that is all it can say. An autotile id
 * is a corner arrangement shared by forty-eight shapes, so three shops built
 * from one wall kind are the same tile as each other and no classification can
 * tell them apart; declaring a rectangle of a sheet does not help, because an
 * autotile has no place in a drawing to declare. Which cells make up one
 * building is a fact about a *placement*, and the map is the only place it can
 * be recorded.
 *
 * That is what this holds: an object number per cell, painted the way regions
 * are painted. Cells sharing a number are one object however they are arranged
 * — a building hacked together out of bits of three others is still one thing,
 * and says so.
 *
 * Per layer, because a tree on B standing over a wall on A is not part of the
 * building. Layers with nothing painted are absent rather than stored as planes
 * of zeroes, so the common case of walls on z0 and signage on z3 costs two
 * planes rather than four.
 *
 * It lives in `Map###.r3d.json` beside the map, never in `Map###.json`, so the
 * map remains ordinary RPG Maker data — which matters here more than for most
 * things, because MZ's six planes are full and there is no seventh to take.
 */
(function(root) {
    'use strict';

    const VERSION = 1;
    const MODE_3D = '3d';
    const LAYERS = 4;
    /** Object numbers, with 0 meaning "not part of any object". */
    const NONE = 0;
    const MAX_ID = 255;

    const clampId = value => {
        const id = Math.round(Number(value));
        if (!Number.isFinite(id)) return NONE;
        return Math.max(NONE, Math.min(MAX_ID, id));
    };

    const inside = (mapData, x, y) =>
        !!mapData && x >= 0 && y >= 0 && x < mapData.width && y < mapData.height;

    const validLayer = layer => Number.isInteger(layer) && layer >= 0 && layer < LAYERS;

    /**
     * The sidecar, created in memory if the map has none.
     *
     * Creating it writes nothing: a map only gains a file when something is
     * actually painted and saved.
     */
    const ensure = mapData => {
        if (!mapData || !mapData.width || !mapData.height) return null;
        let sidecar = mapData.reactor3d;
        if (!sidecar || typeof sidecar !== 'object') {
            sidecar = { version: VERSION, mode: MODE_3D };
            mapData.reactor3d = sidecar;
        }
        sidecar.width = mapData.width;
        sidecar.height = mapData.height;
        return sidecar;
    };

    /** One layer's plane, made only when something is about to go into it. */
    const planeFor = (mapData, field, layer, create) => {
        const sidecar = create ? ensure(mapData) : (mapData && mapData.reactor3d);
        if (!sidecar || !validLayer(layer)) return null;
        const store = sidecar[field] || (create ? (sidecar[field] = {}) : null);
        if (!store) return null;
        const plane = mapData.width * mapData.height;
        let cells = store[layer];
        if (!Array.isArray(cells)) {
            if (!create) return null;
            cells = new Array(plane).fill(0);
            store[layer] = cells;
        } else if (cells.length !== plane) {
            // A resized map keeps what still exists; new ground belongs to
            // nothing. Same rule the height field follows.
            const previous = cells;
            const grown = new Array(plane).fill(0);
            const oldWidth = sidecar.width || mapData.width;
            const oldHeight = Math.floor(previous.length / Math.max(1, oldWidth));
            for (let y = 0; y < Math.min(oldHeight, mapData.height); y++) {
                for (let x = 0; x < Math.min(oldWidth, mapData.width); x++) {
                    grown[y * mapData.width + x] = previous[y * oldWidth + x] || 0;
                }
            }
            cells = grown;
            store[layer] = cells;
        }
        return cells;
    };

    /** Drop a plane that has been cleared, so an emptied map has no leftovers. */
    const prune = (mapData, field, layer) => {
        const store = mapData && mapData.reactor3d && mapData.reactor3d[field];
        const cells = store && store[layer];
        if (!Array.isArray(cells) || cells.some(value => value)) return;
        delete store[layer];
        if (!Object.keys(store).length) delete mapData.reactor3d[field];
    };

    const readAt = (mapData, field, x, y, layer) => {
        const cells = planeFor(mapData, field, layer, false);
        if (!cells || !inside(mapData, x, y)) return 0;
        const value = cells[y * mapData.width + x];
        return Number.isFinite(value) ? value : 0;
    };

    const writeAt = (mapData, field, x, y, layer, value) => {
        if (!inside(mapData, x, y) || !validLayer(layer)) return false;
        // Nothing to do, and nothing to create a plane for.
        if (!value && !planeFor(mapData, field, layer, false)) return false;
        const cells = planeFor(mapData, field, layer, true);
        if (!cells) return false;
        const index = y * mapData.width + x;
        if (cells[index] === value) return false;
        cells[index] = value;
        if (!value) prune(mapData, field, layer);
        return true;
    };

    /** The object a cell's tile belongs to on this layer, or 0. */
    const at = (mapData, x, y, layer) => readAt(mapData, 'objects', x, y, layer);

    /** Put a cell into an object, or take it out with 0. */
    const setAt = (mapData, x, y, layer, id) => {
        const value = clampId(id);
        const changed = writeAt(mapData, 'objects', x, y, layer, value);
        // A cell that belongs to nothing cannot be that nothing's footing.
        if (changed && !value) writeAt(mapData, 'objectGround', x, y, layer, 0);
        return changed;
    };

    /**
     * Whether a cell is its object's footing rather than a course of its height.
     *
     * Standing a drawing up turns its map rows into courses, so a building
     * painted across seven rows is seven tiles tall and plants itself on its
     * southernmost row. Marking the rows that are the ground it stands on —
     * the pavement in front of a shop, the skirt of an archway — is what puts
     * its feet where its feet are.
     */
    const groundAt = (mapData, x, y, layer) => !!readAt(mapData, 'objectGround', x, y, layer);

    const setGroundAt = (mapData, x, y, layer, on) => {
        // Only meaningful inside an object, and silently marking cells that
        // belong to nothing would leave marks the author cannot see.
        if (on && !at(mapData, x, y, layer)) return false;
        return writeAt(mapData, 'objectGround', x, y, layer, on ? 1 : 0);
    };

    /** Every object number in use on the map, ascending — what the palette lists. */
    const idsInUse = mapData => {
        const store = mapData && mapData.reactor3d && mapData.reactor3d.objects;
        const found = new Set();
        for (const layer of Object.keys(store || {})) {
            for (const value of store[layer] || []) if (value) found.add(value);
        }
        return [...found].sort((a, b) => a - b);
    };

    /** The lowest number nobody is using, for "group this as a new object". */
    const nextFreeId = mapData => {
        const used = new Set(idsInUse(mapData));
        for (let id = 1; id <= MAX_ID; id++) if (!used.has(id)) return id;
        return NONE;
    };

    /** Every cell of one object, for selecting or clearing it whole. */
    const cellsOf = (mapData, id) => {
        const store = mapData && mapData.reactor3d && mapData.reactor3d.objects;
        const found = [];
        if (!store || !id) return found;
        for (const key of Object.keys(store)) {
            const cells = store[key];
            if (!Array.isArray(cells)) continue;
            for (let index = 0; index < cells.length; index++) {
                if (cells[index] !== id) continue;
                found.push({ x: index % mapData.width, y: Math.floor(index / mapData.width),
                    layer: Number(key) });
            }
        }
        return found;
    };

    const isEmpty = mapData => !idsInUse(mapData).length;

    /**
     * A copy of both fields, for undo.
     *
     * Deep, because the planes are mutated in place — a shallow copy would
     * hand back the same arrays a stroke is about to write into.
     */
    const snapshot = mapData => {
        const sidecar = mapData && mapData.reactor3d;
        if (!sidecar) return null;
        const copy = field => {
            const store = sidecar[field];
            if (!store) return null;
            const out = {};
            for (const key of Object.keys(store)) {
                if (Array.isArray(store[key])) out[key] = store[key].slice();
            }
            return out;
        };
        return { objects: copy('objects'), objectGround: copy('objectGround') };
    };

    /**
     * Put a snapshot back.
     *
     * One taken from a different size is refused rather than written: Map
     * Properties can resize a map between a stroke and its undo, and a sidecar
     * that disagrees with its own map about how big it is is worse than a lost
     * undo.
     */
    const restore = (mapData, state) => {
        if (!mapData || !state) return false;
        const sidecar = ensure(mapData);
        if (!sidecar) return false;
        const plane = mapData.width * mapData.height;
        for (const field of ['objects', 'objectGround']) {
            const store = state[field];
            if (!store) {
                delete sidecar[field];
                continue;
            }
            const out = {};
            for (const key of Object.keys(store)) {
                if (store[key].length !== plane) return false;
                out[key] = store[key].slice();
            }
            sidecar[field] = out;
        }
        return true;
    };

    const api = {
        VERSION, LAYERS, NONE, MAX_ID,
        at, setAt, groundAt, setGroundAt,
        idsInUse, nextFreeId, cellsOf, isEmpty, snapshot, restore
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.RRMapObjects3D = api;
})(typeof window !== 'undefined' ? window : globalThis);
