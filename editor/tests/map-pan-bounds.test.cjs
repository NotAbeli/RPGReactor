/**
 * Panning the map with the middle mouse button.
 *
 * Reported as: pan to the edge and the view keeps going past it, then jitters
 * and snaps back. The drag wrote the container position straight out and left
 * the clamping to `updateScrollbars`, which is throttled to one call a frame —
 * so the view was drawn out of bounds and yanked back a frame later, every
 * frame, for as long as the drag kept pulling.
 *
 * Clamping as the view moves fixes the jitter but introduces a second problem
 * if the drag anchor is left alone: the overshoot accumulates in the anchor,
 * and pulling back does nothing until it has been unwound. Both are covered
 * here, because fixing only the first is what makes a pan feel stuck.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const metrics = require(path.join(editorRoot, 'src', 'utils', 'TileMetrics.js'));

function loadTilemapManager() {
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'TilemapManager.js'), 'utf8');
    const sandbox = {
        console: Object.assign(Object.create(console), { log() {}, warn() {}, error() {} }),
        RRTileMetrics: metrics,
        requestAnimationFrame: () => 0,
        PIXI: {
            TextureStyle: { defaultOptions: {} },
            Rectangle: class {}, Texture: class {}, Sprite: class {},
            Container: class { constructor() { this.children = []; } addChild() {} }
        },
        document: {
            getElementById: () => null,
            addEventListener() {}, removeEventListener() {}
        },
        addEventListener() {}, removeEventListener() {}
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return {
        TilemapManager: new vm.Script(`${source}\n;TilemapManager;`).runInContext(sandbox),
        sandbox
    };
}

const VIEWPORT = { width: 800, height: 600 };

/**
 * A manager with a map bigger than the viewport, its pan handlers wired up.
 *
 * `pan.down`/`pan.move`/`pan.up` fire the real listeners `setupPanning`
 * registered, so the arithmetic under test is the shipped arithmetic.
 */
function panner({ mapTiles = { width: 40, height: 30 }, tileSize = 48, scale = 1 } = {}) {
    const { TilemapManager, sandbox } = loadTilemapManager();
    const manager = new TilemapManager(null, '/project', { getSystem: () => ({ tileSize }) });

    const handlers = {};
    manager.container = {
        x: 0, y: 0,
        scale: { x: scale, y: scale },
        on(name, fn) { handlers[name] = fn; }
    };
    manager.currentMap = { width: mapTiles.width, height: mapTiles.height };
    // The scrollbars are a separate surface; this is about where the view goes.
    manager.initCustomScrollbars = () => {};
    manager.updateScrollbars = () => {};

    const element = {
        getBoundingClientRect: () => ({ ...VIEWPORT, left: 0, top: 0 }),
        querySelectorAll: () => [],
        addEventListener() {}, removeEventListener() {}
    };
    sandbox.document.getElementById = id => (id === 'canvas-container' ? element : null);

    manager.setupPanning();

    const at = (x, y) => ({ data: { global: { x, y }, button: 1, originalEvent: { shiftKey: false } } });
    return {
        manager,
        container: manager.container,
        // The furthest the view may travel: the map's far edge against the
        // viewport's, as a negative container offset. Zero when the map is
        // the smaller of the two and there is nowhere to go.
        limitX: Math.min(0, VIEWPORT.width - mapTiles.width * tileSize * scale),
        limitY: Math.min(0, VIEWPORT.height - mapTiles.height * tileSize * scale),
        down: (x, y) => handlers.pointerdown(Object.assign(at(x, y), { stopPropagation() {} })),
        move: (x, y) => handlers.pointermove(at(x, y)),
        up: () => handlers.pointerup()
    };
}

test('panning inside the map follows the pointer exactly', () => {
    const p = panner();
    p.down(400, 300);
    p.move(300, 250);
    assert.equal(p.container.x, -100, 'moved with the pointer');
    assert.equal(p.container.y, -50);
    p.move(350, 280);
    assert.equal(p.container.x, -50);
    assert.equal(p.container.y, -20);
});

test('a pan stops at the edge of the map instead of going past it', () => {
    const p = panner();
    p.down(400, 300);
    // Drag far further than the map is wide, in one throw and then in steps.
    p.move(-4000, -4000);
    assert.equal(p.container.x, p.limitX, 'held at the right-hand edge');
    assert.equal(p.container.y, p.limitY, 'held at the bottom edge');

    for (let i = 0; i < 20; i++) {
        p.move(-4000 - i * 50, -4000 - i * 50);
        assert.equal(p.container.x, p.limitX, `still at the edge on step ${i}`);
        assert.equal(p.container.y, p.limitY);
    }

    // And the other way: the near edge is 0, never positive.
    p.up();
    p.down(0, 0);
    p.move(9000, 9000);
    assert.equal(p.container.x, 0, 'held at the left-hand edge');
    assert.equal(p.container.y, 0, 'held at the top edge');
});

test('the view never leaves the map even if no frame is ever rendered', () => {
    // The defect exactly: clamping used to happen in the throttled scrollbar
    // refresh, so between frames the view was genuinely out of bounds and was
    // drawn there. Nothing here flushes a frame.
    const p = panner();
    p.down(400, 300);
    for (let step = 1; step <= 200; step++) {
        p.move(400 - step * 37, 300 - step * 29);
        assert.ok(p.container.x <= 0 && p.container.x >= p.limitX,
            `x left the map on step ${step}: ${p.container.x}`);
        assert.ok(p.container.y <= 0 && p.container.y >= p.limitY,
            `y left the map on step ${step}: ${p.container.y}`);
    }
});

test('pulling back from the edge moves the view at once', () => {
    // Without re-anchoring, an overshoot accumulates in the drag origin and
    // has to be unwound before the map moves again — the pan reads as stuck
    // for exactly as far as it was pushed past the edge.
    const p = panner();
    p.down(400, 300);
    p.move(-4000, 300);                       // hard against the right edge
    assert.equal(p.container.x, p.limitX);

    p.move(-3990, 300);                       // ten pixels back
    assert.equal(p.container.x, p.limitX + 10, 'moved immediately, by exactly ten');

    p.move(-3890, 300);                       // a hundred further back
    assert.equal(p.container.x, p.limitX + 110);
});

test('a map smaller than the viewport does not pan at all', () => {
    // There is nothing to reach, so both ends of the range are zero. Letting
    // it drift puts the map somewhere other than where the canvas is cropped.
    const p = panner({ mapTiles: { width: 5, height: 5 } });
    p.down(400, 300);
    for (const [x, y] of [[100, 100], [700, 500], [-900, -900], [4000, 4000]]) {
        p.move(x, y);
        assert.equal(p.container.x, 0, `x moved to ${p.container.x}`);
        assert.equal(p.container.y, 0, `y moved to ${p.container.y}`);
    }
});

test('the reach of a pan follows the zoom', () => {
    // Zoomed in, the map is larger in view pixels and there is more of it to
    // travel across; the bounds are read at the current scale rather than
    // captured once.
    for (const scale of [0.5, 1, 2, 4]) {
        const p = panner({ scale });
        p.down(400, 300);
        p.move(-99999, -99999);
        assert.equal(p.container.x, p.limitX, `right edge at ${scale}x`);
        assert.equal(p.container.y, p.limitY, `bottom edge at ${scale}x`);
    }
});

test('the tile size is honoured when working out how far the map reaches', () => {
    // A 16-pixel project's map is a third of the pixels a 48-pixel one is, so
    // it runs out of travel three times sooner.
    // Wide enough that even a 16-pixel project overflows the viewport, so all
    // four have somewhere to travel and the comparison means something.
    const mapTiles = { width: 100, height: 80 };
    for (const tileSize of [48, 32, 24, 16]) {
        const p = panner({ tileSize, mapTiles });
        p.down(400, 300);
        p.move(-99999, 300);
        assert.equal(p.container.x, p.limitX, `${tileSize}px project`);
        assert.equal(p.container.x, VIEWPORT.width - mapTiles.width * tileSize);
    }
});
