const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(editorRoot, '..');
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));

const source = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor3D.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
const mainSource = fs.readFileSync(path.join(editorRoot, 'src', 'main.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(editorRoot, 'src', 'ProjectController.js'), 'utf8');
const mapEditorSource = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor.js'), 'utf8');

const quietConsole = Object.create(console);
quietConsole.error = () => {};
quietConsole.warn = () => {};

function viewport(controller = {}) {
    const MapEditor3D = vm.runInNewContext(`${source}\nMapEditor3D;`, {
        console: quietConsole,
        window: {},
        document: { addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [] },
        Reactor3D,
        require,
        setTimeout,
        clearTimeout
    });
    return new MapEditor3D(controller);
}

//-----------------------------------------------------------------------------
// Wiring

test('the 3D toggle sits beside the A1 toggle on the map info bar', () => {
    assert.match(indexHtml, /id="map-3d-view" type="checkbox"/);
    assert.ok(indexHtml.indexOf('map-autotile-animation') < indexHtml.indexOf('map-3d-view'),
        'and after it, so A1 keeps its place');
    // Unchecked in the markup: 3D is opt-in, and an editor that never opens it
    // never parses two megabytes of three.js.
    const checkbox = indexHtml.match(/<input id="map-3d-view"[^>]*>/)[0];
    assert.equal(/\bchecked\b/.test(checkbox), false);
});

test('the viewport module ships and is loaded by the editor', () => {
    assert.match(indexHtml, /<script src="src\/MapEditor3D\.js"><\/script>/);
    assert.ok(fs.existsSync(path.join(editorRoot, 'src', 'MapEditor3D.js')));
});

test('the toggle reports what actually happened, not what was asked', () => {
    // three.js or the runtime directory can be missing in a partial install; a
    // ticked box over a 2D canvas would be a lie.
    assert.match(mainSource, /const active = await this\.mapEditor3D\.setEnabled/);
    assert.match(mainSource, /if \(checkbox\) checkbox\.checked = active;/);
});

test('the view follows the map instead of freezing on one', () => {
    assert.match(controllerSource, /refreshMap3DView\(\)/);
    assert.match(mapEditorSource, /notifyMapEdited\(\)/);
    assert.match(mapEditorSource, /rr-map-edited/);
    assert.match(source, /addEventListener\('rr-map-edited'/);
});

test('rebuilds are debounced', () => {
    // A rebuild remakes every buffer, and a fill or a large stamp announces
    // several strokes in quick succession.
    assert.match(source, /this\._rebuildTimer = setTimeout/);
});

test('3D A1 animation is time-based rather than monitor-frame-based', () => {
    const view = viewport();
    const frames = [];
    view.mapScene = { setAnimationFrame(frame) { frames.push(frame); } };

    view.animateAutotiles(1000);
    view.animateAutotiles(1499);
    view.animateAutotiles(1500);
    view.animateAutotiles(2500);

    assert.deepEqual(frames, [0, 0, 1, 3]);
    assert.match(source, /timestamp - this\._animationStartedAt\) \/ 500/,
        'the cadence is independent of 60Hz, 120Hz, or 144Hz requestAnimationFrame');
});

//-----------------------------------------------------------------------------
// Libraries

test('the runtime module is read from disk, not copied into the editor', () => {
    // A viewport with its own copy of the geometry would drift from the runtime
    // the first time either changed, and seeing what the game will draw is the
    // entire point of the view.
    assert.match(source, /getRuntimePath/);
    assert.match(source, /'libs', 'three\.js'/);
    assert.match(source, /'reactor_3d\.js'/);
    assert.equal(fs.existsSync(path.join(repoRoot, 'runtime', 'libs', 'three.js')), true);
});

test('a missing runtime directory reports rather than throws', async () => {
    const view = viewport({ projectManager: { getRuntimePath: () => null } });
    assert.equal(await view.ensureLibraries(), false);
    assert.match(view.lastError, /runtime directory/);
    assert.equal(await view.setEnabled(true), false, 'and the view stays off');
});

//-----------------------------------------------------------------------------
// Camera

test('the whole map is framed when the view opens', () => {
    const view = viewport();
    view.frameMap({ width: 101, height: 51, data: [], events: [] });
    assert.deepEqual(
        { x: view.view.target.x, z: view.view.target.z },
        { x: 50.5, z: 25.5 },
        'centred on the map');
    assert.ok(view.view.distance > 51, 'far enough back to see its longest side');
});

test('a small map is not framed from inside itself', () => {
    const view = viewport();
    view.frameMap({ width: 3, height: 3, data: [], events: [] });
    assert.ok(view.view.distance >= 12);
});

test('the camera cannot be orbited under the ground or straight down', () => {
    const view = viewport();
    view.camera = null;   // applyCamera is a no-op without one

    view.orbit(0, 1000);
    assert.equal(view.view.pitch, 5, 'stops above the horizon');
    view.orbit(0, -1000);
    // Well short of overhead: standing art has nothing to show a camera looking
    // straight down at it, which is why an HD-2D game does not offer the angle.
    assert.equal(view.view.pitch, 72, 'stops short of looking down on standing art');
});

test('zoom is clamped at both ends', () => {
    const view = viewport();
    view.camera = null;

    for (let i = 0; i < 200; i++) view.zoom(-1);
    assert.equal(view.view.distance, 3);
    for (let i = 0; i < 400; i++) view.zoom(1);
    assert.equal(view.view.distance, 400);
});

//-----------------------------------------------------------------------------
// Events

test('every event trigger gets its own colour', () => {
    const view = viewport();
    const colors = [0, 1, 2, 3, 4].map(trigger => view.eventColor({ pages: [{ trigger }] }));
    assert.equal(new Set(colors).size, 5, 'a parallel process reads differently from a door');
    assert.equal(view.eventColor({}), view.eventColor({ pages: [{ trigger: 0 }] }),
        'and an event with no pages falls back rather than throwing');
});

//-----------------------------------------------------------------------------
// Handing the canvas back

test('turning 3D off leaves the 2D canvas exactly as it was', () => {
    // TilemapManager owns that canvas and has sized and cropped it for this
    // map; the 3D view may only hide it.
    assert.match(source, /canvas\.style\.display = visible \? 'block' : 'none'/);
    assert.equal(/app\.canvas\.(remove|destroy)/.test(source), false);
    assert.match(source, /\.custom-scrollbar/, 'and the scrollbars go with it');
});

test('the editor hands the runtime its classification', () => {
    // The runtime fetches this by XHR relative to the running game. There is no
    // running game here, and without it every wall is guessed, capped for being
    // too tall, and then laid flat on the floor as ground texture.
    assert.match(source, /Reactor3D\.setClassification/);
    assert.match(source, /CLASSIFICATION_FILE/);
    assert.match(source, /this\.loadClassification\(\)/);
});

test('the editor initializes the map scene with both authored passes visible', () => {
    assert.match(source, /this\.mapScene\.setPass\('all'\)/);
});

test('the editor composites starred geometry after events with fresh depth', () => {
    assert.match(source, /setPass\('below'\)/);
    assert.match(source, /this\.renderer\.clearDepth\(\)/);
    assert.match(source, /setPass\('above'\)/);
    assert.match(source, /this\.eventGroup\.visible = false/);
    assert.match(source, /this\.grid\.visible = false/);
    assert.match(source, /this\.hoverCell\.visible = false/);
});

test('a click selects an event but a drag does not', () => {
    assert.match(source, /travel > 4/);
    assert.match(source, /addEventListener\('dblclick'/);
    assert.match(mainSource, /onEventActivated[\s\S]{0,120}editEvent/);
});

test('picking tests the event meshes only', () => {
    // Ground and facades are one merged mesh per sheet, so a hit against them
    // identifies a sheet rather than a tile and is no use for picking. Name
    // labels are excluded too: they are overlays, and letting one be selected
    // also fought with the screen-space rescale that keeps them legible.
    assert.match(source, /intersectObjects\(this\.pickables, false\)/);
    assert.match(source, /this\.pickables\.push\(mesh\)/);
    assert.equal(/this\.pickables\.push\(label\)/.test(source), false);
});

test('name labels hold their size on screen as you zoom', () => {
    // A fixed world size meant a label swelled to fill the view up close and
    // vanished from a distance.
    const view = viewport();
    view.labels = [{ visible: true, scale: { setScalar(value) { this.value = value; } } }];

    view.view.distance = view.LABEL_REFERENCE;
    view.updateLabelVisibility();
    assert.equal(view.labels[0].scale.value, 1);

    view.view.distance = view.LABEL_REFERENCE * 2;
    view.updateLabelVisibility();
    assert.equal(view.labels[0].scale.value, 2, 'twice as far, twice as large in world units');

    view.view.distance = view.LABEL_DISTANCE + 1;
    view.updateLabelVisibility();
    assert.equal(view.labels[0].visible, false, 'and hidden once they would collide');
});

test('the default camera is not overhead', () => {
    const view = viewport();
    assert.ok(view.view.pitch < 45,
        'from overhead a standing facade is edge-on and 3D looks exactly like 2D');
});

test('an event with a character graphic gets its sprite, one without gets a cube', () => {
    // The 2D editor draws a bare coloured square for a graphic-less event, so
    // the 3D view does the same rather than showing nothing.
    const view = viewport();
    assert.equal(view.eventSprite({ pages: [{ image: { characterName: '' } }] }, {}), null);
    assert.equal(view.eventSprite({}, {}), null);
    assert.match(source, /isBigCharacter/, 'a $ sheet is one 3x4 block, not a 4x2 grid of them');
    assert.match(source, /sheet\.width \/ 12/, 'a normal sheet is 3 frames across 4 columns');
    assert.match(source, /sheet\.height \/ 8/, '4 directions down 2 rows');
});

test('right-clicking a mesh reaches the same menu the 2D map uses', () => {
    assert.match(source, /onEventContextMenu/);
    assert.match(mainSource, /onEventContextMenu[\s\S]{0,160}showContextMenu/);
});

test('selection follows whoever made it, in either direction', () => {
    // EventManager.selectEvent is the one funnel for the map, the events panel
    // and the editor, so the 3D view follows that rather than each of them.
    const eventManagerSource = fs.readFileSync(
        path.join(editorRoot, 'src', 'EventManager.js'), 'utf8');
    assert.match(eventManagerSource, /rr-event-selected/);
    assert.match(eventManagerSource, /this\.notifyEventSelected\(event\)/);
    assert.match(source, /addEventListener\('rr-event-selected'/);
    assert.match(mainSource, /onEventSelected[\s\S]{0,320}selectEventById/);
});

test('a sprite is brightened when selected, never dimmed when not', () => {
    // Fading the unselected ones would make every other event harder to read.
    assert.match(source, /mesh\.material\.color\.setHex\(on \? 0xfff2a0 : 0xffffff\)/);
});

test('the viewport says how to steer it', () => {
    // Orbit, pan and re-frame are not guessable from looking at a canvas, and
    // a viewport nobody can steer is a viewport nobody uses.
    assert.match(source, /createHint\(container\)/);
    assert.match(source, /map-3d-hint/);
    const css = fs.readFileSync(path.join(editorRoot, 'css', 'styles.css'), 'utf8');
    assert.match(css, /\.map-3d-hint\b/);
    assert.match(css, /pointer-events: none/, 'the hint never intercepts a drag');
    assert.match(css, /\.map-3d-hint\.is-fading/, 'and it leaves on its own');
});

test('double-clicking empty space re-frames rather than doing nothing', () => {
    // Getting lost in an orbit camera is easy; without this there is no way home.
    assert.match(source, /if \(!cube\) \{[\s\S]{0,320}this\.frameMap\(mapData\)/);
});

test('asset caches are dropped when the project changes', () => {
    // They are keyed by file name, which is unique only within one project: a
    // second project with a same-named tileset would draw the first one's art.
    assert.match(source, /_cachedProjectPath/);
    assert.match(source, /this\.sheetImages = \{\};[\s\S]{0,80}this\.characterImages = \{\};/);
});

test('the canvas follows the container, not only the window', () => {
    // The sidebar divider resizes the canvas and fires no window resize event.
    assert.match(source, /new ResizeObserver/);
    assert.match(source, /this\._resizeObserver\.disconnect\(\)/, 'and is disconnected on teardown');
});

test('painting runs through the 2D map editor, not a second implementation', () => {
    // A parallel painting path would drift from the first and have to be fixed
    // twice; the 3D view only works out which tile the cursor is over.
    assert.match(source, /editor\.paintTile\(tile\.x, tile\.y\)/);
    assert.match(source, /editor\.beginEditState\(\)/);
    assert.match(source, /editor\.resetDrawingState\(true\)/);
});

test('a drag paints only when the palette has a selection', () => {
    // The same contract as the 2D canvas: with tiles selected a drag paints,
    // without them it orbits. Ctrl forces orbit either way.
    const view = viewport();
    view.projectController = { getTilemapManager: () => ({ currentMap: { width: 4, height: 4 } }) };

    const editor = { tilesetPaletteViewer: { selectedTiles: [] } };
    view.mapEditor = () => editor;
    assert.equal(view.canPaint(), false);

    editor.tilesetPaletteViewer.selectedTiles = [{ tileId: 5 }];
    assert.equal(view.canPaint(), true);

    editor.tilesetPaletteViewer.selectedTiles = [];
    editor.shadowPenMode = true;
    assert.equal(view.canPaint(), true, 'the shadow pen paints with no tile selected');
});

test('a raycast hit becomes a tile coordinate', () => {
    // The ground is one merged mesh per sheet, so a hit cannot name a tile —
    // but the world position can, since the map is one unit per tile.
    assert.match(source, /Math\.floor\(point\.x\)/);
    assert.match(source, /Math\.floor\(point\.z\)/);
    // In pixels, and a pixel is whatever size this project's tiles are: MZ
    // offers 48, 32, 24 and 16, and a hardcoded 48 put every quadrant offset
    // half a tile out on anything but the default.
    assert.match(source, /localX: \(point\.x - x\) \* this\.tilePixels\(\)/,
        'quadrant tools get pixel offsets in the project\'s tile size');
});

test('the scene has a sky and fog scaled to the map', () => {
    // Without them the map is a slab in a void and its edge is a hard line
    // against nothing.
    assert.match(source, /scene\.background = colour/);
    assert.match(source, /new THREE\.Fog\(colour/);
    assert.match(source, /--color-bg-base/, 'deep is pure black, which fog cannot fade into');
});
