const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');

function loadClass(file, className) {
    const source = fs.readFileSync(path.join(editorRoot, 'src', file), 'utf8');
    return vm.runInNewContext(`${source}\n${className};`, {
        console, process, require, nw: {}, window: {},
        document: { createElement: () => ({ style: {}, getContext: () => null }), getElementById: () => null }
    });
}

const MapEditor = loadClass('MapEditor.js', 'MapEditor');

function editorWithMap(width, height) {
    const editor = Object.create(MapEditor.prototype);
    editor.undoStack = [];
    editor.redoStack = [];
    editor.maxUndoSteps = 50;
    editor.tilemapManager = {
        currentMap: { width, height, data: new Array(width * height * 6).fill(0) },
        renderMap() {}
    };
    editor.regionManager = null;
    editor.notifyUndoStateChange = () => { editor.notified = (editor.notified || 0) + 1; };
    return editor;
}

test('an undo snapshot taken before a resize is discarded, not restored', () => {
    const editor = editorWithMap(20, 15);
    // A paint on the 20x15 map.
    editor.undoStack.push(new Array(20 * 15 * 6).fill(7));

    // Map Properties resizes the map; data is replaced at the new size.
    editor.tilemapManager.currentMap.width = 10;
    editor.tilemapManager.currentMap.height = 10;
    editor.tilemapManager.currentMap.data = new Array(10 * 10 * 6).fill(0);

    editor.undo();

    const map = editor.tilemapManager.currentMap;
    assert.equal(map.data.length, 10 * 10 * 6,
        'restoring the old-sized array would leave data and dimensions disagreeing');
    assert.equal(map.data.every(value => value === 0), true, 'the resized map is untouched');
    assert.equal(editor.undoStack.length, 0, 'the stale snapshot is dropped');
});

test('a redo snapshot from before a resize is discarded too', () => {
    const editor = editorWithMap(8, 8);
    editor.redoStack.push(new Array(30 * 30 * 6).fill(3));

    editor.redo();

    assert.equal(editor.tilemapManager.currentMap.data.length, 8 * 8 * 6);
    assert.equal(editor.redoStack.length, 0);
});

test('same-size history still works exactly as before', () => {
    const editor = editorWithMap(6, 4);
    const painted = new Array(6 * 4 * 6).fill(0);
    painted[0] = 42;

    editor.undoStack.push(painted.slice());
    editor.undo();
    assert.equal(editor.tilemapManager.currentMap.data[0], 42, 'a valid snapshot is restored');
    assert.equal(editor.redoStack.length, 1, 'and the current state became redoable');

    editor.redo();
    assert.equal(editor.tilemapManager.currentMap.data[0], 0, 'redo returns to the newer state');
});

test('a mixed stack keeps only the snapshots that still fit', () => {
    const editor = editorWithMap(5, 5);
    const good = new Array(5 * 5 * 6).fill(1);
    editor.undoStack.push(new Array(9 * 9 * 6).fill(0), good.slice(), new Array(2 * 2 * 6).fill(0));

    editor.dropStaleUndoStates();
    assert.equal(editor.undoStack.length, 1);
    assert.equal(editor.undoStack[0].length, 5 * 5 * 6);
});

test('map resize clears paint history rather than leaving it to be filtered', () => {
    const controller = fs.readFileSync(path.join(editorRoot, 'src', 'ProjectController.js'), 'utf8');
    const at = controller.indexOf('async applyMapResize(');
    assert.ok(at >= 0, 'applyMapResize is locatable');
    const body = controller.slice(at, controller.indexOf('\n    analyzeMapResize(', at));
    assert.match(body, /this\.mapEditor\.clearUndoHistory\(\)/,
        'the resize drops paint snapshots taken at the old dimensions');
    assert.match(body, /this\.eventManager\.clearUndoHistory\(\)/,
        'and event snapshots, which would otherwise restore events the resize deleted');
});

test('the shared clipboard file is written atomically for other instances', () => {
    // A whole-map envelope is large; a truncate-in-place write can be read
    // mid-flight by a second editor and break the paste.
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'ReactorClipboard.js'), 'utf8');
    const at = source.indexOf('static writeSharedFile(');
    const body = source.slice(at, source.indexOf('static readSharedFile(', at));
    assert.match(body, /RRWriteFileAtomicSync/, 'the atomic helper is used when available');
    assert.match(body, /renameSync/, 'guarded on the fs actually supporting rename');
});
