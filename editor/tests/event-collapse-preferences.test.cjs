const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorRoot = path.resolve(__dirname, '..');
const EventCollapsePreferences = require(path.join(editorRoot, 'src', 'event', 'EventCollapsePreferences.js'));

function loadEventCommandList() {
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'event', 'EventCommandList.js'), 'utf8');
    return vm.runInNewContext(`${source}\nEventCommandList;`, {
        console, process, require, nw: {}, window: {}, EventCollapsePreferences,
        document: { createElement: () => ({ style: {}, dataset: {} }) }
    });
}

const EventCommandList = loadEventCommandList();

function memoryStorage(seed = {}) {
    const store = new Map(Object.entries(seed));
    return {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: key => store.delete(key),
        _dump: () => Object.fromEntries(store)
    };
}

const scope = { projectPath: '/games/demo', kind: 'map', mapId: 3, eventId: 7, pageIndex: 0 };

test('nothing stored means everything is expanded', () => {
    const storage = memoryStorage();
    assert.deepEqual(EventCollapsePreferences.load(scope, storage), []);
});

test('folds round-trip per page and do not leak between pages', () => {
    const storage = memoryStorage();
    EventCollapsePreferences.save(scope, ['0:111:0'], storage);
    EventCollapsePreferences.save({ ...scope, pageIndex: 1 }, ['4:102:0'], storage);
    EventCollapsePreferences.save({ ...scope, eventId: 8 }, ['2:112:1'], storage);

    assert.deepEqual(EventCollapsePreferences.load(scope, storage), ['0:111:0']);
    assert.deepEqual(EventCollapsePreferences.load({ ...scope, pageIndex: 1 }, storage), ['4:102:0']);
    assert.deepEqual(EventCollapsePreferences.load({ ...scope, eventId: 8 }, storage), ['2:112:1']);
    assert.deepEqual(EventCollapsePreferences.load({ ...scope, mapId: 99 }, storage), [],
        'an unvisited page inherits nothing');
});

test('expanding everything again removes the record rather than storing an empty list', () => {
    const storage = memoryStorage();
    EventCollapsePreferences.save(scope, ['0:111:0'], storage);
    assert.equal(Object.keys(JSON.parse(storage.getItem(EventCollapsePreferences.STORAGE_KEY))).length, 1);

    EventCollapsePreferences.save(scope, [], storage);
    assert.deepEqual(JSON.parse(storage.getItem(EventCollapsePreferences.STORAGE_KEY)), {},
        'the default state leaves no residue behind');
});

test('corrupt storage degrades to fully expanded instead of throwing', () => {
    assert.deepEqual(EventCollapsePreferences.load(scope, memoryStorage({
        [EventCollapsePreferences.STORAGE_KEY]: 'not json'
    })), []);
    assert.deepEqual(EventCollapsePreferences.load(scope, memoryStorage({
        [EventCollapsePreferences.STORAGE_KEY]: '["an array, not a map"]'
    })), []);
});

test('deleting a project forgets its pages and leaves others alone', () => {
    const storage = memoryStorage();
    EventCollapsePreferences.save(scope, ['0:111:0'], storage);
    EventCollapsePreferences.save({ ...scope, projectPath: '/games/other' }, ['1:111:0'], storage);

    assert.equal(EventCollapsePreferences.clearProject('/games/demo', storage), true);
    assert.deepEqual(EventCollapsePreferences.load(scope, storage), []);
    assert.deepEqual(EventCollapsePreferences.load({ ...scope, projectPath: '/games/other' }, storage),
        ['1:111:0'], 'the other project keeps its folds');
});

test('a stored fold is restored on reopen, and a stale one is ignored', () => {
    const instance = Object.create(EventCommandList.prototype);
    instance.collapsedBlocks = new WeakSet();
    instance.currentPageIndex = 0;
    instance.eventEditor = {
        currentEvent: { id: 7 },
        projectController: { currentProject: { path: '/games/demo' }, tilemapManager: { currentMap: { id: 3 } } }
    };

    const page = {
        list: [
            { code: 111, indent: 0, parameters: ['A'] },
            { code: 101, indent: 1, parameters: [] },
            { code: 412, indent: 0, parameters: [] }
        ]
    };

    // Stored against the real localStorage the module defaults to.
    const store = new Map();
    global.localStorage = {
        getItem: key => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value))
    };

    try {
        EventCollapsePreferences.save(instance.collapseScope(), ['0:111:0']);
        instance.hydrateCollapsedBlocks(page);
        assert.equal(instance.isBlockCollapsed(page.list[0]), true, 'the fold came back');

        // A page edited since the fold was saved: the command at index 0 is now
        // a different code, so the positional key must not fold it.
        const edited = {
            list: [
                { code: 101, indent: 0, parameters: [] },
                { code: 111, indent: 0, parameters: ['A'] },
                { code: 412, indent: 0, parameters: [] }
            ]
        };
        instance.collapsedBlocks = new WeakSet();
        instance._collapseHydratedList = null;
        instance.hydrateCollapsedBlocks(edited);
        assert.equal(instance.isBlockCollapsed(edited.list[1]), false,
            'a stale key leaves the block expanded rather than folding the wrong one');
    } finally {
        delete global.localStorage;
    }
});
