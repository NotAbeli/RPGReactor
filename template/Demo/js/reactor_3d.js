//=============================================================================
// reactor_3d.js — RPG Reactor HD-2D renderer
//=============================================================================
/*
 * A 3D view of an ordinary RPG Maker map.
 *
 * Design constraints this file exists to honour:
 *
 * 1. The grid stays authoritative. `Game_Map`, `Game_Character`, passability,
 *    region logic and the event interpreter are untouched and keep operating on
 *    the same `width * height * 6` planes. What follows is a *view* of that
 *    grid plus elevation; nothing here feeds back into game logic.
 *
 * 2. The map file is never rewritten. Elevation and geometry live in a sidecar
 *    (`Map###.r3d.json`), so a 2D project never gains a file, and a 3D map's
 *    `Map###.json` remains valid RPG Maker data describing its 2D footprint.
 *
 * 3. Three.js loads on demand. It is ~2 MB; a project with no 3D maps must
 *    never download or parse it, so there is no entry in `scriptUrls`.
 *
 * 4. Compositing is by stacked canvases, not a shared WebGL context. The
 *    runtime already does this in production — Effekseer owns a WebGL1 canvas
 *    at z-index 2 over the game canvas at z-index 1 — so the 3D canvas simply
 *    takes z-index 0 underneath. PIXI keeps drawing windows, pictures, weather
 *    and every plugin-authored sprite exactly as it does in 2D.
 */

//-----------------------------------------------------------------------------
// Reactor3D
//
// Namespace and lifecycle. Everything is static; there is at most one viewport.

function Reactor3D() {
    throw new Error("This is a static class");
}

Reactor3D.LIB_URL = "js/libs/three.js";
Reactor3D.SIDECAR_SUFFIX = ".r3d.json";

Reactor3D._loadPromise = null;
Reactor3D._viewport = null;
Reactor3D._unsupportedReason = null;

/**
 * True once three.js is present. Callers that must not await use this to decide
 * whether a 3D map can be shown this frame.
 */
Reactor3D.isLoaded = function() {
    return typeof THREE !== "undefined";
};

/**
 * Load three.js once, resolving immediately on later calls.
 *
 * Rejection is deliberately swallowed into a resolved `false`: a project whose
 * three.js is missing should fall back to the 2D tilemap with a console error,
 * not fail to boot.
 */
Reactor3D.ensureLoaded = function() {
    if (this.isLoaded()) return Promise.resolve(true);
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = new Promise(resolve => {
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = this.LIB_URL;
        script.async = false;
        script.onload = () => resolve(this.isLoaded());
        script.onerror = () => {
            console.error(
                `Reactor3D: could not load ${this.LIB_URL}. ` +
                "3D maps will fall back to the 2D tilemap."
            );
            this._unsupportedReason = "three.js failed to load";
            resolve(false);
        };
        document.body.appendChild(script);
    });
    return this._loadPromise;
};

/**
 * Whether this machine can present a 3D map at all.
 *
 * Checked before the library is fetched so a WebGL-less host does not pay 2 MB
 * to discover it cannot draw.
 */
Reactor3D.isSupported = function() {
    if (this._unsupportedReason) return false;
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) {
            this._unsupportedReason = "no WebGL context";
            return false;
        }
        return true;
    } catch (e) {
        this._unsupportedReason = String(e && e.message ? e.message : e);
        return false;
    }
};

Reactor3D.unsupportedReason = function() {
    return this._unsupportedReason;
};

Reactor3D.viewport = function() {
    return this._viewport;
};

/** Create the viewport if needed; null when 3D is unavailable. */
Reactor3D.acquireViewport = function() {
    if (!this.isLoaded()) return null;
    if (!this._viewport) this._viewport = new Reactor3D.Viewport();
    return this._viewport;
};

/** Tear the viewport down. Safe to call when there is none. */
Reactor3D.releaseViewport = function() {
    if (this._viewport) {
        this._viewport.destroy();
        this._viewport = null;
    }
};

//-----------------------------------------------------------------------------
// Map mode
//
// Which renderer a map wants. Read from the sidecar when present, and settable
// by a `<3d>` map note so a map can opt in without a sidecar existing yet.

Reactor3D.MODE_2D = "2d";
Reactor3D.MODE_3D = "3d";

/**
 * Render mode for a loaded map.
 *
 * `$dataMap.meta` is populated by DataManager's notetag pass, so `<3d>` works
 * as an escape hatch that survives a round trip through RPG Maker itself. The
 * sidecar wins when both are present, because that is the authored source.
 */
Reactor3D.mapMode = function(mapData) {
    if (!mapData) return this.MODE_2D;
    const sidecar = mapData.reactor3d;
    if (sidecar && typeof sidecar.mode === "string") {
        return sidecar.mode === this.MODE_3D ? this.MODE_3D : this.MODE_2D;
    }
    if (mapData.meta && mapData.meta["3d"]) return this.MODE_3D;
    return this.MODE_2D;
};

Reactor3D.isMap3D = function(mapData) {
    return this.mapMode(mapData) === this.MODE_3D;
};

//-----------------------------------------------------------------------------
// Elevation
//
// A flat `width * height` array of tile heights, in whole tiles. Absent data
// reads as 0, which renders a 3D map as a flat plane rather than failing —
// the state an existing 2D map is in before anyone paints elevation.

Reactor3D.DEFAULT_ELEVATION = 0;

Reactor3D.elevationAt = function(mapData, x, y) {
    if (!mapData) return this.DEFAULT_ELEVATION;
    const sidecar = mapData.reactor3d;
    const heights = sidecar && sidecar.elevation;
    if (!Array.isArray(heights)) return this.DEFAULT_ELEVATION;
    const width = mapData.width;
    const height = mapData.height;
    if (x < 0 || y < 0 || x >= width || y >= height) return this.DEFAULT_ELEVATION;
    const value = heights[y * width + x];
    return Number.isFinite(value) ? value : this.DEFAULT_ELEVATION;
};

/**
 * A starting elevation derived from the map's own passability.
 *
 * An existing 2D map carries no height data, and asking an author to paint a
 * whole city by hand before seeing anything in 3D is a poor first experience.
 * Impassable cells are overwhelmingly walls, buildings and cliffs, so raising
 * them recovers a recognisable massing from a map that was never authored for
 * 3D — the starting point an author then edits, not a final answer.
 *
 * Passability is read the way `Game_Map.checkPassage` reads it: the planes are
 * walked top-down and the first tile with a decisive flag wins, with [*] tiles
 * skipped because they say nothing about passage.
 */
Reactor3D.deriveElevation = function(mapData, flags, options) {
    const opts = options || {};
    const wallHeight = opts.wallHeight === undefined ? 2 : opts.wallHeight;
    if (!mapData || !Array.isArray(mapData.data) || !flags) return null;

    const plane = mapData.width * mapData.height;
    const elevation = new Array(plane).fill(0);
    for (let i = 0; i < plane; i++) {
        let blocked = false;
        for (let z = 3; z >= 0; z--) {
            const tileId = mapData.data[z * plane + i] || 0;
            if (!tileId) continue;
            const flag = flags[tileId] || 0;
            if ((flag & 0x10) !== 0) continue;   // [*] no effect on passage
            blocked = (flag & 0x0f) === 0x0f;
            break;
        }
        if (blocked) elevation[i] = wallHeight;
    }
    return elevation;
};

/**
 * Build a fresh sidecar for a map that has none.
 *
 * Kept here rather than in the editor so the runtime and the editor cannot
 * disagree about the shape of the file.
 */
Reactor3D.createSidecar = function(width, height) {
    return {
        version: 1,
        mode: Reactor3D.MODE_3D,
        elevation: new Array(width * height).fill(Reactor3D.DEFAULT_ELEVATION),
        camera: {
            // A shallow orthographic-feeling view: high field-of-view angles
            // read as a first-person tilt rather than the diorama look HD-2D
            // depends on.
            pitch: 55,
            yaw: 0,
            distance: 12,
            fov: 30
        }
    };
};

//-----------------------------------------------------------------------------
// Reactor3D.Viewport
//
// Owns the canvas, renderer and camera. One per game; the scene inside it is
// swapped per map.

Reactor3D.Viewport = function() {
    this.initialize(...arguments);
};

Reactor3D.Viewport.prototype.initialize = function() {
    this._canvas = document.createElement("canvas");
    this._canvas.id = "reactor3dCanvas";
    // Below the game canvas (z-index 1) so PIXI keeps drawing every window,
    // picture and plugin sprite over the top, and non-interactive so it cannot
    // intercept the input the game canvas expects.
    this._canvas.style.zIndex = 0;
    this._canvas.style.pointerEvents = "none";
    document.body.appendChild(this._canvas);

    this._renderer = new THREE.WebGLRenderer({
        canvas: this._canvas,
        antialias: false,   // HD-2D wants crisp texels, not smoothed edges
        alpha: true
    });
    this._renderer.setPixelRatio(1);
    this._renderer.setClearColor(0x000000, 1);

    this._scene = null;
    this._camera = null;
    this.resize();
};

/** Match the game canvas's backing size and on-screen placement. */
Reactor3D.Viewport.prototype.resize = function() {
    const width = Graphics.width;
    const height = Graphics.height;
    this._canvas.width = width;
    this._canvas.height = height;
    this._renderer.setSize(width, height, false);
    // Reuse the engine's own centring so the two canvases cannot drift apart
    // when the window is resized or the game is scaled.
    Graphics._centerElement(this._canvas);
    if (this._camera && this._camera.isPerspectiveCamera) {
        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
    }
};

Reactor3D.Viewport.prototype.setScene = function(scene, camera) {
    this._scene = scene;
    this._camera = camera;
    this.resize();
};

Reactor3D.Viewport.prototype.scene = function() {
    return this._scene;
};

Reactor3D.Viewport.prototype.camera = function() {
    return this._camera;
};

Reactor3D.Viewport.prototype.render = function() {
    if (!this._scene || !this._camera) return;
    this._renderer.render(this._scene, this._camera);
};

Reactor3D.Viewport.prototype.setVisible = function(visible) {
    this._canvas.style.display = visible ? "block" : "none";
};

Reactor3D.Viewport.prototype.destroy = function() {
    if (this._renderer) {
        this._renderer.dispose();
        this._renderer = null;
    }
    if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._scene = null;
    this._camera = null;
};

//-----------------------------------------------------------------------------
// Reactor3D.Geometry
//
// Tile addressing and mesh building. Deliberately free of THREE and the DOM:
// it takes map data and returns typed arrays, which is what lets the part where
// correctness actually matters — which sheet a tile comes from, and which
// pixels of it — be verified in the ordinary test suite rather than by looking
// at a viewport. A test pins that independence, so reaching for either from in
// here fails rather than eroding the boundary quietly.
//
// The addressing must agree exactly with the 2D renderer in reactor_core.js. If
// it drifts, a tile shows one image in 2D and another in 3D, which is miserable
// to chase visually. `sheetRectFor` is the single place that resolves it.
//
// World space: one tile is one unit on X (east) and Z (south); one elevation
// step is one unit on Y (up), so a grid coordinate maps to a world position
// without arithmetic.

Reactor3D.Geometry = {};

Reactor3D.Geometry.bands = function() {
    const T = typeof Tilemap !== "undefined" ? Tilemap : null;
    return {
        A5: T ? T.TILE_ID_A5 : 1536,
        A1: T ? T.TILE_ID_A1 : 2048,
        A2: T ? T.TILE_ID_A2 : 2816,
        A3: T ? T.TILE_ID_A3 : 4352,
        A4: T ? T.TILE_ID_A4 : 5888,
        MAX: T ? T.TILE_ID_MAX : 8192
    };
};

/**
 * Where a tile's pixels live: which sheet, and the rectangle within it.
 *
 * Returns null for an empty or out-of-range id. Autotiles resolve to their
 * whole-tile source rect here; `autotileQuads` splits them into the four
 * quadrants the shape table actually selects.
 */
Reactor3D.Geometry.sheetRectFor = function(tileId, tileSize) {
    const size = tileSize || 48;
    const band = this.bands();
    if (!Number.isFinite(tileId) || tileId <= 0 || tileId >= band.MAX) return null;

    // A5 and B-G are plain grids. This is the same expression the 2D renderer
    // uses (Tilemap._addNormalTile), including the two-half split that puts
    // ids 128-255 of a sheet in its right-hand columns.
    if (tileId < band.A5) {
        const setNumber = 5 + Math.floor(tileId / 256);
        const local = tileId % 256;
        return {
            setNumber,
            sx: ((Math.floor(local / 128) % 2) * 8 + (local % 8)) * size,
            sy: (Math.floor((local % 256) / 8) % 16) * size,
            width: size,
            height: size
        };
    }
    if (tileId < band.A1) {
        // A5: a plain 8-wide grid, unlike every other A sheet.
        const local = tileId - band.A5;
        return {
            setNumber: 4,
            sx: (local % 8) * size,
            sy: Math.floor(local / 8) * size,
            width: size,
            height: size
        };
    }

    const kind = Math.floor((tileId - band.A1) / 48);
    const tx = kind % 8;
    const ty = Math.floor(kind / 8);
    if (tileId < band.A2) return { setNumber: 0, sx: tx * size, sy: ty * size, width: size, height: size, autotile: true, kind };
    if (tileId < band.A3) return { setNumber: 1, sx: tx * size, sy: (ty - 2) * size, width: size, height: size, autotile: true, kind };
    if (tileId < band.A4) return { setNumber: 2, sx: tx * size, sy: (ty - 6) * size, width: size, height: size, autotile: true, kind };
    return { setNumber: 3, sx: tx * size, sy: (ty - 10) * size, width: size, height: size, autotile: true, kind };
};

/**
 * The topmost drawable tile in a cell.
 *
 * The 3D ground takes one texture per cell, so the upper planes win the way
 * they do on screen in 2D — layer 3 over 2 over 1 over 0.
 */
/**
 * The shape tables the 2D renderer uses to cut an autotile into quadrants.
 *
 * Read from `Tilemap` rather than copied, so the two cannot drift; tests inject
 * them instead, which is what keeps this section free of the corescript.
 * Returns null when they are unavailable, and the caller then falls back to the
 * whole-tile rect rather than drawing nothing.
 */
/**
 * MZ's autotile shape tables, copied from the corescript.
 *
 * The geometry builder reads these from the global `Tilemap` when a game is
 * running, but nothing else that draws a map has one: the editor viewport and
 * the offline preview renderer both load this file on its own. Without a table
 * every autotile silently fell back to a whole-tile blit of its block's corner,
 * so a seamless field of grass rendered as a grid of bordered squares. A test
 * pins this copy against `reactor_core.js`.
 */
Reactor3D.Geometry.FLOOR_AUTOTILE_TABLE = [
    [[2,4],[1,4],[2,3],[1,3]], [[2,0],[1,4],[2,3],[1,3]], [[2,4],[3,0],[2,3],[1,3]], [[2,0],[3,0],[2,3],[1,3]],
    [[2,4],[1,4],[2,3],[3,1]], [[2,0],[1,4],[2,3],[3,1]], [[2,4],[3,0],[2,3],[3,1]], [[2,0],[3,0],[2,3],[3,1]],
    [[2,4],[1,4],[2,1],[1,3]], [[2,0],[1,4],[2,1],[1,3]], [[2,4],[3,0],[2,1],[1,3]], [[2,0],[3,0],[2,1],[1,3]],
    [[2,4],[1,4],[2,1],[3,1]], [[2,0],[1,4],[2,1],[3,1]], [[2,4],[3,0],[2,1],[3,1]], [[2,0],[3,0],[2,1],[3,1]],
    [[0,4],[1,4],[0,3],[1,3]], [[0,4],[3,0],[0,3],[1,3]], [[0,4],[1,4],[0,3],[3,1]], [[0,4],[3,0],[0,3],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]], [[2,2],[1,2],[2,3],[3,1]], [[2,2],[1,2],[2,1],[1,3]], [[2,2],[1,2],[2,1],[3,1]],
    [[2,4],[3,4],[2,3],[3,3]], [[2,4],[3,4],[2,1],[3,3]], [[2,0],[3,4],[2,3],[3,3]], [[2,0],[3,4],[2,1],[3,3]],
    [[2,4],[1,4],[2,5],[1,5]], [[2,0],[1,4],[2,5],[1,5]], [[2,4],[3,0],[2,5],[1,5]], [[2,0],[3,0],[2,5],[1,5]],
    [[0,4],[3,4],[0,3],[3,3]], [[2,2],[1,2],[2,5],[1,5]], [[0,2],[1,2],[0,3],[1,3]], [[0,2],[1,2],[0,3],[3,1]],
    [[2,2],[3,2],[2,3],[3,3]], [[2,2],[3,2],[2,1],[3,3]], [[2,4],[3,4],[2,5],[3,5]], [[2,0],[3,4],[2,5],[3,5]],
    [[0,4],[1,4],[0,5],[1,5]], [[0,4],[3,0],[0,5],[1,5]], [[0,2],[3,2],[0,3],[3,3]], [[0,2],[1,2],[0,5],[1,5]],
    [[0,4],[3,4],[0,5],[3,5]], [[2,2],[3,2],[2,5],[3,5]], [[0,2],[3,2],[0,5],[3,5]], [[0,0],[1,0],[0,1],[1,1]]
];

Reactor3D.Geometry.WALL_AUTOTILE_TABLE = [
    [[2,2],[1,2],[2,1],[1,1]], [[0,2],[1,2],[0,1],[1,1]], [[2,0],[1,0],[2,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]],
    [[2,2],[3,2],[2,1],[3,1]], [[0,2],[3,2],[0,1],[3,1]], [[2,0],[3,0],[2,1],[3,1]], [[0,0],[3,0],[0,1],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]], [[0,2],[1,2],[0,3],[1,3]], [[2,0],[1,0],[2,3],[1,3]], [[0,0],[1,0],[0,3],[1,3]],
    [[2,2],[3,2],[2,3],[3,3]], [[0,2],[3,2],[0,3],[3,3]], [[2,0],[3,0],[2,3],[3,3]], [[0,0],[3,0],[0,3],[3,3]]
];

Reactor3D.Geometry.WATERFALL_AUTOTILE_TABLE = [
    [[2,0],[1,0],[2,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]],
    [[2,0],[3,0],[2,1],[3,1]], [[0,0],[3,0],[0,1],[3,1]]
];

/**
 * The shape tables to build with.
 *
 * A running game's `Tilemap` wins, so a plugin that replaces the tables still
 * governs what the 3D view draws; otherwise the copy above is used. Returning
 * null here is what produced the corner-blit bug, so it no longer can.
 */
Reactor3D.Geometry.autotileTables = function(options) {
    if (options && options.tables) return options.tables;
    const T = typeof Tilemap !== "undefined" ? Tilemap : null;
    if (T && T.FLOOR_AUTOTILE_TABLE) {
        return {
            floor: T.FLOOR_AUTOTILE_TABLE,
            wall: T.WALL_AUTOTILE_TABLE,
            waterfall: T.WATERFALL_AUTOTILE_TABLE
        };
    }
    return {
        floor: this.FLOOR_AUTOTILE_TABLE,
        wall: this.WALL_AUTOTILE_TABLE,
        waterfall: this.WATERFALL_AUTOTILE_TABLE
    };
};

/**
 * Cut an autotile into the four quadrants its shape selects.
 *
 * An autotile is not one picture: its 48 shapes each pick four 24x24 corners out
 * of the sheet, which is how a single kind renders every combination of
 * neighbours. Drawing the whole-tile rect instead gives the unmistakable look of
 * a map where every grass tile is the same wrong patch, so the ground takes four
 * half-size quads per cell here rather than one.
 *
 * `qx`/`qy` place each quadrant within the cell: 0 is west/north, 1 is
 * east/south, matching the 2D renderer's `i % 2` and `floor(i / 2)`.
 *
 * A1 water sits on animation frame 0. Scrolling water and waterfalls need the
 * frame swapped per tick, which is a later concern than getting the shape right.
 */
Reactor3D.Geometry.autotileQuads = function(tileId, tileSize, tables) {
    if (!tables) return null;
    const band = this.bands();
    const size = tileSize || 48;
    const kind = Math.floor((tileId - band.A1) / 48);
    const shape = (tileId - band.A1) % 48;
    const tx = kind % 8;
    const ty = Math.floor(kind / 8);

    let setNumber = 0;
    let bx = 0;
    let by = 0;
    let table = tables.floor;
    // Pixels this tile's UVs move per animation step; 0 means it never moves.
    let animU = 0;
    let animV = 0;

    if (tileId < band.A2) {
        // A1. The first four kinds are the fixed water and rock cells; the rest
        // pair a still surface with a waterfall on odd kinds.
        setNumber = 0;
        // A1 is the animated sheet. The frames sit side by side in the same
        // block — the still surface shifts two tiles east per frame, a
        // waterfall one tile south — so a quad can be animated by sliding its
        // UVs rather than rebuilt. `animU`/`animV` record that stride in
        // pixels; everything else stays zero and never moves.
        if (kind === 0) { bx = 0; by = 0; animU = size * 2; }
        else if (kind === 1) { bx = 0; by = 3; animU = size * 2; }
        else if (kind === 2) { bx = 6; by = 0; }
        else if (kind === 3) { bx = 6; by = 3; }
        else {
            bx = Math.floor(tx / 4) * 8;
            by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
            if (kind % 2 !== 0) {
                bx += 6;
                table = tables.waterfall || tables.floor;
                animV = size;
            } else {
                animU = size * 2;
            }
        }
    } else if (tileId < band.A3) {
        setNumber = 1;
        bx = tx * 2;
        by = (ty - 2) * 3;
    } else if (tileId < band.A4) {
        setNumber = 2;
        bx = tx * 2;
        by = (ty - 6) * 2;
        table = tables.wall;
    } else {
        setNumber = 3;
        bx = tx * 2;
        by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
        if (ty % 2 === 1) table = tables.wall;
    }

    // The waterfall table only defines four shapes, so a kind whose shape falls
    // outside its table has no quadrants; the caller falls back rather than
    // indexing past the end.
    const entry = table && table[shape];
    if (!entry) return null;

    const half = size / 2;
    return entry.map((pair, i) => ({
        setNumber,
        sx: (bx * 2 + pair[0]) * half,
        sy: (by * 2 + pair[1]) * half,
        width: half,
        height: half,
        qx: i % 2,
        qy: Math.floor(i / 2),
        animU,
        animV
    }));
};

/**
 * How far each stacked ground layer is lifted above the one below.
 *
 * Enough for the depth buffer to keep them apart, far too little to see: a
 * tile is one unit wide, so this is a thousandth of a tile.
 */
Reactor3D.Geometry.LAYER_LIFT = 0.001;

Reactor3D.Geometry.topTileAt = function(mapData, x, y, isUpright) {
    if (!mapData || !Array.isArray(mapData.data)) return 0;
    const { width, height } = mapData;
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const plane = width * height;
    for (let z = 3; z >= 0; z--) {
        const tileId = mapData.data[z * plane + y * width + x] || 0;
        if (tileId <= 0) continue;
        // An upright tile is an object standing on the ground, not the ground
        // itself, so it cannot supply the surface texture.
        if (isUpright && isUpright(tileId)) continue;
        return tileId;
    }
    return 0;
};

/**
 * Every ground tile in a cell, bottom layer first.
 *
 * A cell holds up to four tiles and the 2D renderer composites all of them —
 * a floor, a decal over it, a puddle over that. Taking only the topmost one
 * showed the decal alone with nothing underneath, which is not the map the
 * author drew.
 */
/**
 * The floor a facade is standing on.
 *
 * Walks south from the run — the direction the building faces, so the first
 * floor found is the street in front of it — then north if the whole southern
 * column is built up, then along the run's own row. A dense city block can be
 * buildings all the way to the map edge in one direction, and any of those
 * misses left the footprint as a hole through to the sky.
 */
Reactor3D.Geometry.nearestGround = function(mapData, run, isUpright) {
    const { width, height } = mapData;
    // The bottom of the stack, not the top: the lowest layer is the floor,
    // while the top is often a decoration drawn over it. Taking the top filled
    // a building's footprint with a see-through overlay, which alpha-tests away
    // to nothing and leaves the hole it was meant to close.
    const surfaceOf = (x, y) => {
        const stack = this.groundStackAt(mapData, x, y, isUpright);
        return stack.length ? stack[0] : 0;
    };

    for (let y = run.southY + 1; y < height; y++) {
        const found = surfaceOf(run.x, y);
        if (found) return found;
    }
    for (let y = run.northY - 1; y >= 0; y--) {
        const found = surfaceOf(run.x, y);
        if (found) return found;
    }
    for (let step = 1; step < width; step++) {
        const west = run.x - step >= 0 ? surfaceOf(run.x - step, run.southY) : 0;
        if (west) return west;
        const east = run.x + step < width ? surfaceOf(run.x + step, run.southY) : 0;
        if (east) return east;
    }
    return 0;
};

Reactor3D.Geometry.groundStackAt = function(mapData, x, y, isUpright) {
    if (!mapData || !Array.isArray(mapData.data)) return [];
    const { width, height } = mapData;
    if (x < 0 || y < 0 || x >= width || y >= height) return [];
    const plane = width * height;
    const stack = [];
    for (let z = 0; z <= 3; z++) {
        const tileId = mapData.data[z * plane + y * width + x] || 0;
        if (tileId <= 0) continue;
        if (isUpright && isUpright(tileId)) continue;
        stack.push(tileId);
    }
    return stack;
};

/** The upright tile in a cell, if any — the topmost one wins. */
Reactor3D.Geometry.uprightTileAt = function(mapData, x, y, isUpright) {
    if (!isUpright || !mapData || !Array.isArray(mapData.data)) return 0;
    const { width, height } = mapData;
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    const plane = width * height;
    for (let z = 3; z >= 0; z--) {
        const tileId = mapData.data[z * plane + y * width + x] || 0;
        if (tileId > 0 && isUpright(tileId)) return tileId;
    }
    return 0;
};

/**
 * Collapse columns of upright tiles into standing facades.
 *
 * Standing each upright tile up on its own cell folds a building in half: its
 * base is impassable wall and its top is a walk-behind roof, so per-tile
 * treatment leaves the lower half lying on the ground and the upper half
 * hanging in the air.
 *
 * A tileset draws a building as a run of tiles going *north* up the screen, and
 * that run is the building's elevation — north in 2D is up in 3D. So a
 * contiguous north-south run becomes one facade standing at the run's southern
 * face, with the southernmost tile at the bottom and each tile further north
 * one unit higher. A three-tile shopfront becomes a three-unit facade showing
 * the same three tiles in the same order.
 *
 * Returns one entry per run: the column, the cells it consumed, and the tiles
 * bottom-up.
 */
Reactor3D.Geometry.uprightRuns = function(mapData, isUpright, maxHeight, isAuthored) {
    if (!isUpright || !mapData || !Array.isArray(mapData.data)) return [];
    const { width, height } = mapData;
    const cap = maxHeight || Infinity;
    const runs = [];

    for (let x = 0; x < width; x++) {
        let y = 0;
        while (y < height) {
            if (!this.uprightTileAt(mapData, x, y, isUpright)) { y++; continue; }

            // Walk south to the end of the run.
            let end = y;
            while (end + 1 < height && this.uprightTileAt(mapData, x, end + 1, isUpright)) end++;

            // Bottom-up means south-to-north, which is how the facade stacks.
            const tiles = [];
            let authored = false;
            for (let row = end; row >= y; row--) {
                const tile = this.uprightTileAt(mapData, x, row, isUpright);
                tiles.push(tile);
                if (isAuthored && isAuthored(tile)) authored = true;
            }
            // A run longer than a building is a cliff face or a map-edge wall
            // that happens to share the impassable flag. Leaving it as terrain
            // is wrong-looking; standing it up is worse.
            //
            // The cap only judges guesses. Where an author has classified a
            // tile as upright the height is theirs to choose: tilesets draw
            // buildings as single perspective props dozens of tiles tall, and
            // capping those dropped whole city blocks back to the floor.
            if (authored || tiles.length <= cap) {
                runs.push({ x, northY: y, southY: end, tiles });
            }
            y = end + 1;
        }
    }
    return runs;
};

/**
 * Build ground and wall geometry, grouped by sheet.
 *
 * One group per sheet means one draw call per sheet — at most eleven for a
 * whole map, however large — without needing instancing or a custom shader.
 * Geometry is rebuilt only when the map changes, so the cost is paid on map
 * load rather than per frame.
 *
 * Walls are emitted only where a neighbour is lower, so a flat map produces no
 * side faces at all and interior cliff faces are never built.
 */
Reactor3D.Geometry.build = function(mapData, options) {
    const opts = options || {};
    const tileSize = opts.tileSize || 48;
    const elevationAt = opts.elevationAt || (() => 0);
    const sheetSize = opts.sheetSize || (() => ({ width: 768, height: 768 }));
    const tables = this.autotileTables(opts);
    // MZ's star flag already means "draws above characters", which authors set
    // on trees, roofs, signs and anything else tall. Reusing it means an
    // existing map stands its objects up without being re-authored.
    const isUpright = opts.isUpright || null;
    // Which tiles were classified by hand rather than guessed from flags. The
    // facade cap applies only to guesses; see `uprightRuns`.
    const isAuthored = opts.isAuthored || null;
    // Tiles that raise the ground they sit on instead of joining a facade.
    const isScenery = opts.isScenery || null;
    const sceneryHeight = opts.sceneryHeight === undefined ? 1 : opts.sceneryHeight;
    const uprightHeight = opts.uprightHeight === undefined ? 1 : opts.uprightHeight;
    // How deep a standing object is, in tiles. Shallow on purpose: the art is
    // drawn front-on, so a deep box would stretch one column of pixels across
    // a face wide enough to read as smearing. Zero returns flat cut-outs.
    const uprightDepth = opts.uprightDepth === undefined ? 1 : opts.uprightDepth;
    const maxFacade = opts.maxFacade === undefined ? Reactor3D.AUTO_MAX_FACADE : opts.maxFacade;

    const groups = new Map();
    const groupFor = setNumber => {
        if (!groups.has(setNumber)) {
            groups.set(setNumber, {
                setNumber, positions: [], uvs: [], indices: [], vertexCount: 0,
                // Per-vertex UV stride for animated tiles, and whether any
                // vertex in this group actually has one.
                anim: [], animated: false
            });
        }
        return groups.get(setNumber);
    };

    // A quad, wound counter-clockwise seen from its front. `uv` is in pixels
    // within the sheet; it is normalised here so callers never deal with the
    // V-flip between image space and texture space.
    const quad = (group, corners, rect, size) => {
        const base = group.vertexCount;
        for (const corner of corners) group.positions.push(corner[0], corner[1], corner[2]);
        const u0 = rect.sx / size.width;
        const u1 = (rect.sx + rect.width) / size.width;
        // Image space counts down from the top; texture space counts up.
        const v0 = 1 - (rect.sy + rect.height) / size.height;
        const v1 = 1 - rect.sy / size.height;
        group.uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
        // Normalised the same way as the UVs so the consumer just adds it.
        const du = (rect.animU || 0) / size.width;
        // Negated: a waterfall's next frame is further *down* the sheet, and V
        // counts up from the bottom.
        const dv = -(rect.animV || 0) / size.height;
        for (let i = 0; i < 4; i++) group.anim.push(du, dv);
        if (du || dv) group.animated = true;
        group.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        group.vertexCount += 4;
    };

    /**
     * A vertical or horizontal face, split into autotile quadrants if needed.
     *
     * `corners` is the whole face wound as [top-left, top-right, bottom-right,
     * bottom-left]. An autotile's shape picks four quadrants out of its block,
     * so the face is subdivided the same way and each piece takes its own
     * quadrant: sampling the block's whole top-left tile instead put a corner
     * fragment — often a patch of something else entirely — on every cliff.
     */
    const faceQuads = (group, corners, rect, size, parts) => {
        if (!parts) {
            quad(group, corners, rect, size);
            return 1;
        }
        const at = (u, v) => [0, 1, 2].map(axis =>
            corners[0][axis] * (1 - u) * (1 - v) +
            corners[1][axis] * u * (1 - v) +
            corners[3][axis] * (1 - u) * v +
            corners[2][axis] * u * v);
        for (const part of parts) {
            const u0 = part.qx * 0.5;
            const v0 = part.qy * 0.5;
            quad(group, [
                at(u0, v0), at(u0 + 0.5, v0), at(u0 + 0.5, v0 + 0.5), at(u0, v0 + 0.5)
            ], part, size);
        }
        return parts.length;
    };

    if (!mapData || !Array.isArray(mapData.data)) return { groups: [], quads: 0 };

    const { width, height } = mapData;
    let quadCount = 0;

    /**
     * The height of a cell's surface.
     *
     * Scenery raises the ground rather than standing a picture on it. Trying
     * the other way first — a billboard per cell — turned a mountain range into
     * rows of cardboard cut-outs with daylight between them, because terrain
     * covers an *area* and a picture does not. Raised ground gets its cliff
     * faces from the wall code below for free, and a range reads as a mass.
     */
    const surfaceAt = (x, y) => {
        const base = elevationAt(x, y);
        if (!isScenery || x < 0 || y < 0 || x >= width || y >= height) return base;
        return this.uprightTileAt(mapData, x, y, isScenery) ? base + sceneryHeight : base;
    };

    // Facades first, and note which cells they consumed: a cell inside a
    // building's footprint is under the building, not open ground.
    const consumed = new Set();
    // Cell index -> the ground tile to draw under a facade that covers it.
    const apron = new Map();
    const runs = this.uprightRuns(mapData, isUpright, maxFacade, isAuthored);

    // A facade drawn as a single plane is paper: seen from the side a chimney
    // or a mast disappears to a line. Giving it a shallow depth costs two more
    // quads per level and makes it read as a solid object from any angle.
    // Columns that adjoin another run share that edge, so a wide building is
    // still one flat wall and only its outer corners are boxed.
    const byColumn = new Map();
    for (const run of runs) byColumn.set(`${run.x}:${run.southY}`, run);
    const covers = (x, southY, level) => {
        const neighbour = byColumn.get(`${x}:${southY}`);
        return !!neighbour && neighbour.tiles.length > level;
    };

    for (const run of runs) {
        const consumes = true;
        const base = surfaceAt(run.x, run.southY);
        // The facade stands on the southern face of the run, which is the front
        // of the footprint as drawn.
        const zFace = run.southY + 1;
        const zBack = zFace - uprightDepth;
        run.tiles.forEach((tileId, level) => {
            const rect = this.sheetRectFor(tileId, tileSize);
            if (!rect) return;
            const group = groupFor(rect.setNumber);
            const size = sheetSize(rect.setNumber);
            const y0 = base + level * uprightHeight;
            const y1 = y0 + uprightHeight;

            // An autotile standing up is still an autotile: its shape picks
            // four quadrants out of the block, and taking the block's whole
            // top-left tile instead samples a corner piece — a wall built from
            // grass corners, or a mountain edged with a different mountain's
            // border. The quadrants tile the face the same way they tile the
            // ground, with qy running down the face instead of south.
            const parts = rect.autotile
                ? this.autotileQuads(tileId, tileSize, tables)
                : null;
            const half = uprightHeight / 2;
            const faces = parts
                ? parts.map(part => ({
                    rect: part,
                    x0: run.x + part.qx * 0.5,
                    x1: run.x + part.qx * 0.5 + 0.5,
                    yTop: y1 - part.qy * half,
                    yBot: y1 - (part.qy + 1) * half
                }))
                : [{ rect, x0: run.x, x1: run.x + 1, yTop: y1, yBot: y0 }];

            for (const face of faces) {
                quad(group, [
                    [face.x0, face.yTop, zFace],
                    [face.x1, face.yTop, zFace],
                    [face.x1, face.yBot, zFace],
                    [face.x0, face.yBot, zFace]
                ], face.rect, size);
                quadCount++;
            }

            // Depth, as a second plane crossing the first at right angles.
            //
            // Boxing the facade instead — side faces plus a cap — was wrong for
            // cut-out art: a side stretched one column of pixels across the
            // whole depth, and the cap laid the tile flat, so a spire or a
            // jagged roof grew a horizontal slab the width of its cell that
            // ignored the silhouette entirely. Both planes here are ordinary
            // alpha-tested billboards, so the shape stays the shape from any
            // angle, and the object reads as solid rather than as paper.
            if (uprightDepth > 0 && !covers(run.x - 1, run.southY, level)
                && !covers(run.x + 1, run.southY, level)) {
                const midX = run.x + 0.5;
                const crossFaces = parts
                    ? parts.map(part => ({
                        rect: part,
                        z0: zBack + part.qx * (zFace - zBack) * 0.5,
                        z1: zBack + (part.qx + 1) * (zFace - zBack) * 0.5,
                        yTop: y1 - part.qy * half,
                        yBot: y1 - (part.qy + 1) * half
                    }))
                    : [{ rect, z0: zBack, z1: zFace, yTop: y1, yBot: y0 }];
                for (const face of crossFaces) {
                    quad(group, [
                        [midX, face.yTop, face.z0],
                        [midX, face.yTop, face.z1],
                        [midX, face.yBot, face.z1],
                        [midX, face.yBot, face.z0]
                    ], face.rect, size);
                    quadCount++;
                }
            }
        });
        if (consumes) {
            for (let row = run.northY; row <= run.southY; row++) {
                consumed.add(row * width + run.x);
            }
            // The floor the building stands on.
            //
            // A facade's cells usually hold nothing but the building's own art,
            // so excluding upright tiles leaves them with no ground at all and
            // the footprint rendered as a hole you could see the sky through. A
            // building drawn fifteen tiles tall left a fifteen-cell hole. The
            // street it faces — the cell immediately south of the run — is the
            // surface it is standing on, so that is what fills it.
            const surface = this.nearestGround(mapData, run, isUpright);
            if (surface) {
                for (let row = run.northY; row <= run.southY; row++) {
                    apron.set(row * width + run.x, surface);
                }
            }
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const top = surfaceAt(x, y);
            const underFacade = consumed.has(y * width + x);

            // The floor a building stands on. Skipping a facade's footprint
            // entirely left a hole you could see straight through from above,
            // because a facade is one plane at the run's southern end and the
            // cells behind it had nothing at all.
            let stack = this.groundStackAt(mapData, x, y, isUpright);
            if (!stack.length && underFacade) {
                const surface = apron.get(y * width + x);
                if (surface) stack = [surface];
            }
            // Nothing but upright tiles here and no facade claimed them — a run
            // the cap rejected. Better to lay the art flat than draw a hole.
            if (!stack.length && !underFacade) stack = this.groundStackAt(mapData, x, y);
            if (!stack.length) continue;

            // Every layer of the cell, bottom first, each lifted a hair above
            // the one below so the depth buffer keeps the author's order
            // instead of letting coplanar quads fight. The lift is far below a
            // tile's width, so nothing separates visibly even edge-on.
            for (let layer = 0; layer < stack.length; layer++) {
                const tileId = stack[layer];
                const rect = this.sheetRectFor(tileId, tileSize);
                if (!rect) continue;

                const group = groupFor(rect.setNumber);
                const size = sheetSize(rect.setNumber);
                const surface = top + layer * this.LAYER_LIFT;

                // Ground face(s), lying flat at this cell's elevation. An
                // autotile is four quarter-cells, because its shape picks four
                // corners out of the sheet rather than one whole picture.
                const quads = rect.autotile
                    ? this.autotileQuads(tileId, tileSize, tables)
                    : null;
                if (quads) {
                    for (const part of quads) {
                        const px = x + part.qx * 0.5;
                        const pz = y + part.qy * 0.5;
                        quad(group, [
                            [px, surface, pz],
                            [px + 0.5, surface, pz],
                            [px + 0.5, surface, pz + 0.5],
                            [px, surface, pz + 0.5]
                        ], part, size);
                        quadCount++;
                    }
                } else {
                    // North-west first: the quad's first corner takes the
                    // image's top-left texel, and a tile's top row belongs at
                    // the cell's north edge — winding it from the south flips
                    // every tile front-to-back on the ground.
                    quad(group, [
                        [x, surface, y],
                        [x + 1, surface, y],
                        [x + 1, surface, y + 1],
                        [x, surface, y + 1]
                    ], rect, size);
                    quadCount++;
                }
            }

            // A building's footprint gets no wall skirt: the facade already
            // stands there, and a second wall would z-fight with it.
            if (underFacade) continue;

            // Walls take the topmost ground tile's art — the surface you can
            // see — rather than whichever layer happened to be drawn last.
            const surfaceId = stack[stack.length - 1];
            const surfaceRect = this.sheetRectFor(surfaceId, tileSize);
            if (!surfaceRect) continue;
            const surfaceGroup = groupFor(surfaceRect.setNumber);
            const surfaceSize = sheetSize(surfaceRect.setNumber);
            const surfaceParts = surfaceRect.autotile
                ? this.autotileQuads(surfaceId, tileSize, tables)
                : null;

            // Walls, one per side whose neighbour sits lower. A cell outside the
            // map counts as elevation 0, so the map's rim is closed off rather
            // than floating.
            const neighbours = [
                { dx: 0, dy: 1, corners: h => [[x, top, y + 1], [x + 1, top, y + 1], [x + 1, h, y + 1], [x, h, y + 1]] },
                { dx: 0, dy: -1, corners: h => [[x + 1, top, y], [x, top, y], [x, h, y], [x + 1, h, y]] },
                { dx: -1, dy: 0, corners: h => [[x, top, y], [x, top, y + 1], [x, h, y + 1], [x, h, y]] },
                { dx: 1, dy: 0, corners: h => [[x + 1, top, y + 1], [x + 1, top, y], [x + 1, h, y], [x + 1, h, y + 1]] }
            ];
            for (const side of neighbours) {
                const nx = x + side.dx;
                const ny = y + side.dy;
                const outside = nx < 0 || ny < 0 || nx >= width || ny >= height;
                const neighbourTop = outside ? 0 : surfaceAt(nx, ny);
                if (neighbourTop >= top) continue;
                // Wall faces sample the whole-tile rect even for autotiles: a
                // cliff side wants wall art, which the sidecar will name rather
                // than it being derivable from whichever ground tile sits above.
                quadCount += faceQuads(surfaceGroup, side.corners(neighbourTop),
                    surfaceRect, surfaceSize, surfaceParts);
            }
        }
    }

    // Typed arrays so the caller can hand them straight to BufferAttribute.
    const built = Array.from(groups.values()).map(group => ({
        setNumber: group.setNumber,
        positions: Float32Array.from(group.positions),
        uvs: Float32Array.from(group.uvs),
        // Only animated groups carry the stride; the rest would be all zeroes.
        anim: group.animated ? Float32Array.from(group.anim) : null,
        // 16-bit indices top out at 65535 vertices, which a large map passes.
        indices: group.vertexCount > 65535
            ? Uint32Array.from(group.indices)
            : Uint16Array.from(group.indices)
    }));

    return { groups: built, quads: quadCount };
};

//-----------------------------------------------------------------------------
// Tile classification
//
// Which tiles stand up and which lie flat cannot be derived from map data: a
// shopfront wall and a cliff edge are both simply impassable, so any heuristic
// over 2D flags sweeps up terrain along with buildings — on Moletown it
// produced facades fifty-one tiles tall. Classification is therefore authored,
// per tileset rather than per map, since tilesets are shared and a tile is the
// same kind of thing wherever it is painted.
//
// Stored beside the database as `Tilesets.r3d.json`, keyed by tileset id. A
// project without one behaves exactly as before.

Reactor3D.CLASS_AUTO = 0;      // fall back to the heuristic
Reactor3D.CLASS_GROUND = 1;    // always lies flat
Reactor3D.CLASS_UPRIGHT = 2;   // part of a standing object
Reactor3D.CLASS_SCENERY = 3;   // stands on its own cell, one tile tall

/*
 * Upright and scenery are both "stands up", and the difference is what the
 * tiles mean together. A building is one picture spanning a column of cells, so
 * its cells collapse into a single facade as tall as the run — Moletown draws
 * towers fifty tiles high that way. A forest or a mountain range is the same
 * tile repeated across an area; collapsing that gives a fifty-tile wall of
 * trees instead of fifty trees. Scenery therefore stands per cell, one tile
 * tall, and the ground still draws underneath it.
 */

Reactor3D.CLASSIFICATION_FILE = "Tilesets.r3d.json";

/**
 * A facade taller than this is treated as terrain instead.
 *
 * Buildings are bounded; a run spanning a third of the map is a cliff face or a
 * map-edge wall that happens to share the impassable flag. The cap keeps the
 * automatic guess from producing towers while an author has yet to classify a
 * tileset, and never overrides an explicit UPRIGHT.
 */
Reactor3D.AUTO_MAX_FACADE = 8;

Reactor3D._classification = null;

Reactor3D.setClassification = function(data) {
    this._classification = data || null;
};

Reactor3D.classification = function() {
    return this._classification;
};

/**
 * The id a class is stored under.
 *
 * Autotiles occupy 48 consecutive ids — one per shape — but a shape is a corner
 * arrangement, not a different kind of thing: a wall is a wall whichever of its
 * corners are joined. So a kind is classified once, at its base id, and every
 * shape reads that entry. (Flags are an MZ format and are still mirrored across
 * all 48; this file is ours, and keeping one entry per kind holds it to a few
 * hundred lines instead of tens of thousands.)
 */
Reactor3D.classKey = function(tileId) {
    if (tileId >= 2048 && tileId < 8192) {
        return 2048 + Math.floor((tileId - 2048) / 48) * 48;
    }
    return tileId;
};

/** How a tile behaves in 3D: explicit if classified, otherwise AUTO. */
Reactor3D.tileClass = function(tilesetId, tileId) {
    const all = this._classification;
    const forTileset = all && all.tilesets && all.tilesets[tilesetId];
    const value = forTileset && forTileset[this.classKey(tileId)];
    return value === this.CLASS_GROUND || value === this.CLASS_UPRIGHT
        || value === this.CLASS_SCENERY
        ? value
        : this.CLASS_AUTO;
};

/**
 * The predicate the geometry builder uses.
 *
 * An explicit class always wins. Where a tile is unclassified the flags supply
 * a guess — impassable or draws-above-characters — which is what lets a map
 * that has never been touched show something recognisable.
 */
Reactor3D.uprightPredicate = function(tilesetId, flags, options) {
    // Guessing is off by default. The flag heuristic was meant to let an
    // unclassified map show something recognisable, but "impassable or draws
    // above characters" covers a great deal of ordinary terrain: on a world map
    // it stood mountains and forests on end, and since a facade is one plane at
    // its run's southern edge, everything behind that plane vanished. The
    // result was scenery the author never placed and scenery they did place
    // going missing. A map with no classification now renders flat, which is at
    // least the map they drew.
    const guess = !!(options && options.guess) && !!flags;
    return tileId => {
        const explicit = this.tileClass(tilesetId, tileId);
        if (explicit === this.CLASS_UPRIGHT) return true;
        // Any other explicit class settles it. Falling through to the guess
        // here let a scenery tile join a facade as well as standing on its own
        // cell, so a forest was both dotted across the ground and welded into a
        // wall behind itself.
        if (explicit !== this.CLASS_AUTO) return false;
        if (!guess) return false;
        const flag = flags[tileId] || 0;
        return (flag & 0x10) !== 0 || (flag & 0x0f) === 0x0f;
    };
};

/**
 * Tiles that stand on their own cell rather than joining a facade.
 *
 * Never guessed: there is nothing in the 2D flags that distinguishes a forest
 * from a shopfront, which is the whole reason classification is authored.
 */
Reactor3D.sceneryPredicate = function(tilesetId) {
    return tileId => this.tileClass(tilesetId, tileId) === this.CLASS_SCENERY;
};

/** True where a tile has been classified rather than guessed. */
Reactor3D.isClassified = function(tilesetId, tileId) {
    return this.tileClass(tilesetId, tileId) !== this.CLASS_AUTO;
};

/** An empty classification file, ready to be filled in by the editor. */
Reactor3D.createClassification = function() {
    return { version: 1, tilesets: {} };
};

Reactor3D._classificationPromise = null;

/**
 * Fetch the classification file once per session.
 *
 * Only a 3D map asks for it, so a 2D project issues no extra request. A missing
 * file is the ordinary state rather than an error: every tile then falls back
 * to the flag heuristic, which is what an unclassified project already gets.
 */
Reactor3D.loadClassification = function() {
    if (this._classificationPromise) return this._classificationPromise;
    if (typeof XMLHttpRequest === "undefined") return Promise.resolve();

    this._classificationPromise = new Promise(resolve => {
        const url = "data/" + this.CLASSIFICATION_FILE;
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.overrideMimeType("application/json");
        xhr.onload = () => {
            if (xhr.status < 400) {
                try {
                    this.setClassification(JSON.parse(xhr.responseText));
                } catch (e) {
                    console.error(`Reactor3D: ${this.CLASSIFICATION_FILE} is not valid JSON.`, e);
                }
            }
            resolve();
        };
        xhr.onerror = () => resolve();
        xhr.send();
    });
    return this._classificationPromise;
};

//-----------------------------------------------------------------------------
// Reactor3D.MapScene
//
// A three.js scene built from one map. Meshes are grouped by tileset sheet, so
// the whole ground is a handful of draw calls however large the map.

Reactor3D.MapScene = function() {
    this.initialize(...arguments);
};

Reactor3D.MapScene.prototype.initialize = function(mapData, bitmaps, options) {
    this._scene = new THREE.Scene();
    this._materials = [];
    this._meshes = [];
    this._textures = [];
    this._animated = [];
    this._frame = -1;
    this.build(mapData, bitmaps, options);
};

/**
 * Show an animation frame of the A1 water and waterfalls.
 *
 * The frames live side by side in the same sheet, so this slides UVs rather
 * than rebuilding anything: a 200x200 map animates without touching its
 * geometry. Matches `Tilemap._drawAutotile` — the still surface cycles
 * 0,1,2,1 and a waterfall runs 0,1,2.
 */
Reactor3D.MapScene.prototype.setAnimationFrame = function(frame) {
    const next = Math.floor(frame) || 0;
    if (next === this._frame || !this._animated || !this._animated.length) return;
    this._frame = next;

    const surface = [0, 1, 2, 1][((next % 4) + 4) % 4];
    const waterfall = ((next % 3) + 3) % 3;
    for (const entry of this._animated) {
        const uv = entry.geometry.getAttribute("uv");
        for (let i = 0; i < entry.base.length; i += 2) {
            const du = entry.stride[i];
            const dv = entry.stride[i + 1];
            uv.array[i] = entry.base[i] + du * surface;
            uv.array[i + 1] = entry.base[i + 1] + dv * waterfall;
        }
        uv.needsUpdate = true;
    }
};

Reactor3D.MapScene.prototype.scene = function() {
    return this._scene;
};

/**
 * Wrap a loaded Bitmap as a texture.
 *
 * Nearest filtering both ways: HD-2D depends on crisp texels, and linear
 * filtering also bleeds neighbouring tiles across a quad's edges because every
 * tile is a sub-rectangle of a shared sheet.
 */
Reactor3D.MapScene.prototype.textureFor = function(bitmap) {
    const source = bitmap && (bitmap.image || bitmap.canvas);
    if (!source) return null;
    const texture = new THREE.CanvasTexture(source);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this._textures.push(texture);
    return texture;
};

/**
 * The running game's tileset, when there is a running game.
 *
 * Guarded with `typeof` rather than a plain truth test: the editor loads this
 * same file to draw its 3D viewport, and there `$gameMap` is not merely null,
 * it was never declared.
 */
Reactor3D.currentFlags = function() {
    return (typeof $gameMap !== "undefined" && $gameMap
        && $gameMap.tilesetFlags && $gameMap.tilesetFlags()) || null;
};

Reactor3D.currentTilesetId = function() {
    return (typeof $gameMap !== "undefined" && $gameMap
        && $gameMap.tilesetId && $gameMap.tilesetId()) || 0;
};

/**
 * Build the meshes for a map.
 *
 * `options.flags` and `options.tilesetId` let a caller outside the running game
 * — the editor viewport — supply the tileset it is showing.
 */
Reactor3D.MapScene.prototype.build = function(mapData, bitmaps, options) {
    this.clear();
    if (!mapData) return;

    const settings = options || {};
    const flags = settings.flags || Reactor3D.currentFlags();
    const tilesetId = settings.tilesetId != null
        ? settings.tilesetId
        : Reactor3D.currentTilesetId();
    const built = Reactor3D.Geometry.build(mapData, {
        elevationAt: (x, y) => Reactor3D.elevationAt(mapData, x, y),
        // Authored classification where it exists, flags as the guess where it
        // does not.
        isUpright: Reactor3D.uprightPredicate(tilesetId, flags),
        // An authored upright is never second-guessed by the facade cap.
        isAuthored: tileId => Reactor3D.isClassified(tilesetId, tileId),
        isScenery: Reactor3D.sceneryPredicate(tilesetId),
        sheetSize: setNumber => {
            const bitmap = bitmaps && bitmaps[setNumber];
            // The sheet's real size, so a non-standard sheet still maps its
            // pixels correctly rather than being stretched to an assumed 768.
            return {
                width: (bitmap && bitmap.width) || 768,
                height: (bitmap && bitmap.height) || 768
            };
        }
    });

    for (const group of built.groups) {
        const texture = this.textureFor(bitmaps && bitmaps[group.setNumber]);
        if (!texture) continue;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(group.positions, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(group.uvs, 2));
        geometry.setIndex(new THREE.BufferAttribute(group.indices, 1));
        geometry.computeVertexNormals();
        if (group.anim) {
            // Keep the frame-0 UVs; every later frame is computed from them
            // rather than accumulated, so rounding cannot drift over an hour.
            this._animated.push({
                geometry,
                base: Float32Array.from(group.uvs),
                stride: group.anim
            });
        }

        // Unlit to begin with, so colours match the 2D view exactly and any
        // difference on screen is geometry rather than shading. Lighting is a
        // later pass. alphaTest rather than blending keeps cut-out tiles from
        // needing back-to-front sorting.
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.5,
            // Upright panels are seen from either side as the camera turns, and
            // double-siding also means ground winding cannot silently hide a
            // whole sheet.
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        this._scene.add(mesh);
        this._meshes.push(mesh);
        this._materials.push(material);
    }
};

Reactor3D.MapScene.prototype.clear = function() {
    this._animated = [];
    this._frame = -1;
    for (const mesh of this._meshes) {
        this._scene.remove(mesh);
        mesh.geometry.dispose();
    }
    for (const material of this._materials) material.dispose();
    for (const texture of this._textures) texture.dispose();
    this._meshes = [];
    this._materials = [];
    this._textures = [];
};

Reactor3D.MapScene.prototype.destroy = function() {
    this.clear();
    this._scene = null;
};

//-----------------------------------------------------------------------------
// Camera
//
// A pitched view of the grid. The focus point is a map cell, so following the
// player is a matter of handing over its position rather than tracking a
// separate camera object.

Reactor3D.createCamera = function(settings) {
    const fov = (settings && settings.fov) || 30;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
    return camera;
};

/**
 * Point `camera` at a grid position.
 *
 * Pitch is measured from the horizon, so 90 is straight down and the shallow
 * angles HD-2D uses sit around 50-60. Yaw rotates about the focus, which keeps
 * a rotated camera looking at the same cell.
 */
Reactor3D.aimCamera = function(camera, focus, settings) {
    if (!camera) return;
    const opts = settings || {};
    const pitch = ((opts.pitch || 55) * Math.PI) / 180;
    const yaw = ((opts.yaw || 0) * Math.PI) / 180;
    const distance = opts.distance || 12;

    // Cell centres, so the camera does not sit on a tile corner.
    const cx = focus.x + 0.5;
    const cy = focus.y || 0;
    const cz = focus.z + 0.5;

    camera.position.set(
        cx - Math.sin(yaw) * Math.cos(pitch) * distance,
        cy + Math.sin(pitch) * distance,
        cz + Math.cos(yaw) * Math.cos(pitch) * distance
    );
    camera.lookAt(cx, cy, cz);
    camera.updateMatrixWorld();
};

/**
 * Where a world position lands on the game canvas.
 *
 * Characters stay ordinary PIXI sprites drawn over the 3D ground — which is the
 * HD-2D look, and keeps every plugin that touches Sprite_Character working — so
 * their screen positions come from projecting through the same camera rather
 * than from the 2D scroll.
 */
Reactor3D.projectToScreen = function(camera, x, y, z) {
    if (!camera || !THREE.Vector3) return null;
    const vector = new THREE.Vector3(x, y, z);
    vector.project(camera);
    return {
        x: (vector.x * 0.5 + 0.5) * Graphics.width,
        y: (-vector.y * 0.5 + 0.5) * Graphics.height,
        // Behind the camera; the caller hides the sprite rather than drawing it
        // mirrored in front.
        visible: vector.z < 1
    };
};

//-----------------------------------------------------------------------------
// Scene preparation
//
// three.js is fetched the first time a 3D map is entered, so the scene has to
// wait for it. A failure resolves rather than rejects: the map falls back to the
// 2D tilemap instead of refusing to load.

Reactor3D._prepared = null;

Reactor3D.beginPrepare = function(mapData) {
    if (!this.isMap3D(mapData)) {
        this._prepared = true;
        return;
    }
    if (!this.isSupported()) {
        console.warn(
            `Reactor3D: 3D unavailable (${this.unsupportedReason()}); ` +
            "falling back to the 2D tilemap."
        );
        this._prepared = true;
        return;
    }
    this._prepared = false;
    Promise.all([this.ensureLoaded(), this.loadClassification()]).then(() => {
        this._prepared = true;
    });
};

Reactor3D.isPrepared = function() {
    return this._prepared !== false;
};

/** Whether this map should actually be drawn in 3D right now. */
Reactor3D.shouldRender3D = function(mapData) {
    return this.isMap3D(mapData) && this.isLoaded() && this.isSupported();
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = Reactor3D;
}
