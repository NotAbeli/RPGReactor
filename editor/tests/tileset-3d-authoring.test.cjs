const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(editorRoot, '..');
const classes = require(path.join(editorRoot, 'src', 'utils', 'Tileset3DClass.js'));
const Reactor3D = require(path.join(repoRoot, 'runtime', 'reactor_3d.js'));

const quietConsole = Object.create(console);
quietConsole.log = () => {};
quietConsole.warn = () => {};
quietConsole.error = () => {};

function loadBrowserClass(relativePath, className, globals = {}) {
    const source = fs.readFileSync(path.join(editorRoot, 'src', relativePath), 'utf8');
    return vm.runInNewContext(`${source}\n${className};`, {
        console: quietConsole,
        process,
        require,
        nw: {},
        RRTileset3DClass: classes,
        ...globals
    });
}

function tempProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-reactor-tileset-3d-'));
    fs.mkdirSync(path.join(root, 'data'));
    return root;
}

//-----------------------------------------------------------------------------
// Storage key

test('an autotile is classified once, not forty-eight times', () => {
    // A shape is a corner arrangement, not a different kind of thing, so all 48
    // ids of a kind read one entry. Without this the file would carry tens of
    // thousands of lines for a single tileset.
    const base = 2816;
    let data = classes.setClass(classes.create(), 3, base + 17, classes.UPRIGHT);

    assert.deepEqual(Object.keys(data.tilesets['3']), [String(base)]);
    for (const shape of [0, 1, 17, 47]) {
        assert.equal(classes.classOf(data, 3, base + shape), classes.UPRIGHT,
            `shape ${shape} reads the kind's class`);
    }
    assert.equal(classes.classOf(data, 3, base + 48), classes.AUTO, 'the next kind is untouched');
});

test('the editor and the runtime fold ids the same way', () => {
    for (const tileId of [0, 255, 1024, 1535, 1536, 2047, 2048, 2049, 2095, 2096, 4351, 8191, 8192]) {
        assert.equal(classes.keyFor(tileId), Reactor3D.classKey(tileId),
            `tile ${tileId} folds identically`);
    }
});

test('a hand-written file naming a shape is still read back', () => {
    // normalize folds keys, so a file edited by hand or written by an older
    // build resolves through the same lookup the runtime uses.
    const data = classes.normalize({ version: 1, tilesets: { 3: { 2833: classes.GROUND } } });
    assert.deepEqual(Object.keys(data.tilesets['3']), ['2816']);
    assert.equal(classes.classOf(data, 3, 2816), classes.GROUND);
});

//-----------------------------------------------------------------------------
// Persistence

test('the database loads a classification sidecar and hands it to callers', async () => {
    const DatabaseManager = loadBrowserClass('DatabaseManager.js', 'DatabaseManager');
    const manager = new DatabaseManager();
    const root = tempProject();
    try {
        for (const [key, fileName] of manager.dataFiles) {
            fs.writeFileSync(path.join(root, 'data', fileName),
                JSON.stringify(key === 'system' ? {} : [null]));
        }
        fs.writeFileSync(path.join(root, 'data', classes.FILENAME), JSON.stringify({
            version: 1,
            tilesets: { 5: { 1029: classes.UPRIGHT, 40: 'nonsense' } }
        }));

        assert.equal(await manager.loadAllData(root), true);
        const store = manager.getTileset3D();
        assert.equal(classes.classOf(store, 5, 1029), classes.UPRIGHT);
        assert.equal(classes.classOf(store, 5, 40), classes.AUTO, 'garbage entries are dropped');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('a project that never classifies a tile gains no file', async () => {
    const DatabaseManager = loadBrowserClass('DatabaseManager.js', 'DatabaseManager');
    const manager = new DatabaseManager();
    const root = tempProject();
    try {
        assert.equal(await manager.saveAllData(root), true);
        assert.equal(fs.existsSync(path.join(root, 'data', classes.FILENAME)), false,
            'the 3D feature costs a 2D project nothing, not even an empty file');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('classification saves with the database and reads back in the runtime', async () => {
    const DatabaseManager = loadBrowserClass('DatabaseManager.js', 'DatabaseManager');
    const manager = new DatabaseManager();
    const root = tempProject();
    try {
        classes.setClass(manager.getTileset3D(), 7, 2816, classes.UPRIGHT);
        assert.equal(await manager.saveAllData(root), true);

        const written = JSON.parse(fs.readFileSync(path.join(root, 'data', classes.FILENAME), 'utf8'));
        Reactor3D.setClassification(written);
        try {
            // The whole point of the file: the runtime resolves the same tile
            // to the same class from any shape of the autotile.
            assert.equal(Reactor3D.tileClass(7, 2816), Reactor3D.CLASS_UPRIGHT);
            assert.equal(Reactor3D.tileClass(7, 2839), Reactor3D.CLASS_UPRIGHT);
            assert.equal(Reactor3D.tileClass(7, 100), Reactor3D.CLASS_AUTO);
        } finally {
            Reactor3D.setClassification(null);
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('an emptied classification keeps its file rather than leaving a stale one', async () => {
    const DatabaseManager = loadBrowserClass('DatabaseManager.js', 'DatabaseManager');
    const manager = new DatabaseManager();
    const root = tempProject();
    const filePath = path.join(root, 'data', classes.FILENAME);
    try {
        classes.setClass(manager.getTileset3D(), 7, 2816, classes.UPRIGHT);
        await manager.saveTileset3D(root);

        classes.setClass(manager.getTileset3D(), 7, 2816, classes.AUTO);
        await manager.saveTileset3D(root);

        assert.equal(fs.existsSync(filePath), true, 'the file the author has in version control stays');
        assert.equal(classes.isEmpty(JSON.parse(fs.readFileSync(filePath, 'utf8'))), true,
            'and no longer claims a class that was cleared');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('unsaved classification counts as unsaved work', async () => {
    const DatabaseManager = loadBrowserClass('DatabaseManager.js', 'DatabaseManager');
    const manager = new DatabaseManager();
    const root = tempProject();
    try {
        // The close-without-saving prompt reads getDirtyKeys; classification
        // lives outside dataFiles, so it has to be reported explicitly or a
        // whole afternoon of classifying vanishes without a warning.
        // Array.from: the manager builds its arrays inside a VM realm, where
        // deepStrictEqual rejects them on prototype identity alone.
        await manager.saveAllData(root);
        assert.deepEqual(Array.from(manager.getDirtyKeys()), []);

        classes.setClass(manager.getTileset3D(), 2, 1029, classes.GROUND);
        assert.deepEqual(Array.from(manager.getDirtyKeys()), ['tileset3d']);

        await manager.saveAllData(root);
        assert.deepEqual(Array.from(manager.getDirtyKeys()), []);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('a damaged sidecar leaves the database openable', async () => {
    const DatabaseManager = loadBrowserClass('DatabaseManager.js', 'DatabaseManager');
    const manager = new DatabaseManager();
    const root = tempProject();
    try {
        for (const [key, fileName] of manager.dataFiles) {
            fs.writeFileSync(path.join(root, 'data', fileName),
                JSON.stringify(key === 'system' ? {} : [null]));
        }
        fs.writeFileSync(path.join(root, 'data', classes.FILENAME), '{"tilesets":');

        assert.equal(await manager.loadAllData(root), true);
        assert.equal(classes.isEmpty(manager.getTileset3D()), true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

//-----------------------------------------------------------------------------
// Authoring UI

function recordingContext() {
    const calls = [];
    const record = name => (...args) => calls.push({ name, args });
    return {
        calls,
        canvas: { width: 384, height: 384 },
        fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: '', lineCap: '',
        font: '', textAlign: '', textBaseline: '',
        fillRect: record('fillRect'),
        strokeRect: record('strokeRect'),
        fillText: record('fillText'),
        strokeText: record('strokeText'),
        beginPath: record('beginPath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        arc: record('arc'),
        fill: record('fill'),
        stroke: record('stroke'),
        clearRect: record('clearRect'),
        drawImage: record('drawImage')
    };
}

function tilesetEditor() {
    const Editor = loadBrowserClass(path.join('database', 'DatabaseTilesetEditor.js'),
        'DatabaseTilesetEditor', {
            window: { RRTileset3DClass: classes },
            document: { getElementById: () => null, querySelectorAll: () => [] }
        });
    const editor = new Editor(null, '/project', null);
    editor.currentTileset = {
        id: 4,
        name: 'Town',
        tilesetNames: ['', '', '', '', '', 'Outside_B', '', '', '', '', ''],
        flags: new Array(8192).fill(0)
    };
    // Standalone: no database owns the store, so it is created here rather
    // than read from a project that does not exist.
    editor._tileset3d = classes.create();
    return editor;
}

test('the tileset editor offers 3D classification as an edit mode', () => {
    const source = fs.readFileSync(
        path.join(editorRoot, 'src', 'database', 'DatabaseTilesetEditor.js'), 'utf8');
    assert.match(source, /data-mode="tile3d"/, 'a mode button exists');
    assert.match(source, /class="compact-flag-btn" id="flag-tile3d"/,
        'and joins the existing column of mode buttons');
});

test('clicking a tile cycles it through every class and back to automatic', () => {
    const editor = tilesetEditor();
    const tileIndex = 1029;

    for (const expected of [classes.GROUND, classes.UPRIGHT, classes.SCENERY, classes.AUTO]) {
        editor.cycleTile3DClass(tileIndex);
        assert.equal(classes.classOf(editor._tileset3d, 4, tileIndex), expected);
    }
    assert.equal(classes.isEmpty(editor._tileset3d), true, 'and leaves nothing behind');
});

test('3D mode replaces the flag markers instead of crowding them', () => {
    // A tile already carries up to seven flag glyphs; classifying a building
    // means reading its shape in the art underneath.
    const editor = tilesetEditor();
    editor.currentTileset.flags[0] = 0x0f;   // an X the flag overlay would draw

    const flagCtx = recordingContext();
    editor.currentEditMode = 'passability';
    editor.drawCompactPassageOverlay(flagCtx, 48, 48, 5, true);
    assert.equal(flagCtx.calls.some(call => call.name === 'fillText' && call.args[0] === 'X'), true);

    const classCtx = recordingContext();
    editor.currentEditMode = 'tile3d';
    editor.drawCompactPassageOverlay(classCtx, 48, 48, 5, true);
    assert.equal(classCtx.calls.some(call => call.name === 'fillText'), false,
        'no flag glyphs in 3D mode');
});

test('an unclassified tile is left unmarked so classified ones stand out', () => {
    const editor = tilesetEditor();
    editor.currentEditMode = 'tile3d';

    const blank = recordingContext();
    editor.drawCompactPassageOverlay(blank, 48, 48, 5, true);
    assert.deepEqual(blank.calls, [], 'automatic tiles draw nothing at all');

    editor.cycleTile3DClass(0);
    const marked = recordingContext();
    editor.drawCompactPassageOverlay(marked, 48, 48, 5, true);
    assert.equal(marked.calls.some(call => call.name === 'fillRect'), true);
});

test('switching in and out of 3D mode repaints what is on screen', () => {
    const source = fs.readFileSync(
        path.join(editorRoot, 'src', 'database', 'DatabaseTilesetEditor.js'), 'utf8');
    // The mode changes what the overlay shows, not just what a click does, so
    // the canvases already drawn have to be repainted or the view lies.
    assert.match(source, /was3D !== \(mode === 'tile3d'\)\) this\.refreshOverlays\(\)/);

    const editor = tilesetEditor();
    const repainted = [];
    editor.redrawCanvasOverlay = (canvas, imageIndex) => repainted.push(imageIndex);
    editor.tabCanvases = [
        { canvas: {}, imageIndex: 0, isSplitSheet: false },
        { canvas: {}, imageIndex: 4, isSplitSheet: false }
    ];
    editor.refreshOverlays();
    assert.deepEqual(repainted, [0, 4], 'every stacked canvas of the A tab');
});

test('standalone saves write the classification beside Tilesets.json', () => {
    const editor = tilesetEditor();
    const root = tempProject();
    try {
        editor.projectPath = root;
        editor.tilesetList = [null, editor.currentTileset];
        editor.currentTileset.id = 1;
        classes.setClass(editor._tileset3d, 1, 1029, classes.UPRIGHT);

        editor.saveTilesetsFile();

        assert.equal(fs.existsSync(path.join(root, 'data', 'Tilesets.json')), true);
        const written = JSON.parse(fs.readFileSync(path.join(root, 'data', classes.FILENAME), 'utf8'));
        assert.equal(classes.classOf(written, 1, 1029), classes.UPRIGHT);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('the database owns the store whenever there is one', () => {
    // Otherwise the modal's OK and Cancel would cover every edit except the 3D
    // classes, which would persist through a Cancel and vanish on an OK.
    const editor = tilesetEditor();
    const store = classes.create();
    editor.databaseManager = { getTileset3D: () => store, saveTileset3D: () => true };

    editor.cycleTile3DClass(1029);
    assert.equal(classes.classOf(store, 4, 1029), classes.GROUND);
    assert.equal(classes.isEmpty(editor._tileset3d), true, 'the standalone store stays unused');
});
