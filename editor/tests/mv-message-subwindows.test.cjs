const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspaceRoot = path.resolve(__dirname, '..', '..');

// Runs the real installMessageSubWindowsCompatibility() against stub classes so
// the sub-window fallbacks are exercised rather than matched as source text.
function install(sandbox) {
    const compat = fs.readFileSync(path.join(workspaceRoot, 'runtime', 'reactor_mv_compat.js'), 'utf8');
    const start = compat.indexOf('    function installMessageSubWindowsCompatibility() {');
    const end = compat.indexOf('\n    function installTextStateCompatibility()', start);
    assert.ok(start >= 0 && end > start, 'message sub-window section is locatable');
    vm.runInNewContext(
        `${compat.slice(start, end)}\ninstallMessageSubWindowsCompatibility();`,
        sandbox
    );
}

function makeEnvironment() {
    function Window_Message() {}
    Window_Message.prototype.update = function() { this.updated = (this.updated || 0) + 1; };
    // MZ's own flow, verbatim in shape: no null check before .start().
    Window_Message.prototype.startInput = function() {
        if (this.pendingChoice) {
            this._choiceListWindow.start();
            return true;
        }
        return false;
    };
    Window_Message.prototype.setChoiceListWindow = function(window) {
        this._choiceListWindow = window;
    };

    const SceneManager = { _scene: null };
    const sandbox = { global: { Window_Message, SceneManager }, Window_Message, SceneManager, console };
    install(sandbox);
    return { Window_Message, SceneManager };
}

function makeChoiceWindow(name) {
    return { name, started: 0, start() { this.started++; } };
}

test('an unassociated message window resolves a pending choice to the scene window', () => {
    const { Window_Message, SceneManager } = makeEnvironment();

    const sceneChoiceWindow = makeChoiceWindow('scene');
    const sceneMessageWindow = new Window_Message();
    SceneManager._scene = {
        _messageWindow: sceneMessageWindow,
        _choiceListWindow: sceneChoiceWindow
    };

    // A second Window_Message, of the kind plugins build for measurement or
    // backlog and custom battle scenes never associate. It still updates.
    const strayWindow = new Window_Message();
    strayWindow.pendingChoice = true;

    assert.doesNotThrow(() => strayWindow.startInput(),
        'a pending choice on an unassociated window must not crash the game');
    assert.equal(sceneChoiceWindow.started, 1,
        'the choice starts on the scene window, so it stays answerable');
});

test('an associated window keeps using its own sub-window', () => {
    const { Window_Message, SceneManager } = makeEnvironment();

    const sceneChoiceWindow = makeChoiceWindow('scene');
    const ownChoiceWindow = makeChoiceWindow('own');
    SceneManager._scene = { _choiceListWindow: sceneChoiceWindow };

    const messageWindow = new Window_Message();
    messageWindow.setChoiceListWindow(ownChoiceWindow);
    messageWindow.pendingChoice = true;

    assert.equal(messageWindow._choiceListWindow, ownChoiceWindow);
    messageWindow.startInput();
    assert.equal(ownChoiceWindow.started, 1, 'its own window is used');
    assert.equal(sceneChoiceWindow.started, 0, 'the scene window is left alone');
});

test('with no scene window at all the read degrades instead of throwing', () => {
    const { Window_Message, SceneManager } = makeEnvironment();
    SceneManager._scene = null;

    const strayWindow = new Window_Message();
    strayWindow.pendingChoice = true;

    assert.doesNotThrow(() => strayWindow.startInput());
    // The stand-in must answer the methods MZ calls without a null check.
    const standIn = strayWindow._choiceListWindow;
    assert.equal(typeof standIn.start, 'function');
    assert.equal(standIn.active, false);
});

test('MV-named aliases resolve to the same window as the MZ names', () => {
    const { Window_Message, SceneManager } = makeEnvironment();

    const ownChoiceWindow = makeChoiceWindow('own');
    SceneManager._scene = { _choiceListWindow: makeChoiceWindow('scene') };

    const messageWindow = new Window_Message();
    messageWindow.setChoiceListWindow(ownChoiceWindow);

    assert.equal(messageWindow._choiceWindow, ownChoiceWindow,
        'MV plugins reading _choiceWindow see the same window as MZ corescript');

    // Number and item windows follow the same rule.
    const numberWindow = makeChoiceWindow('number');
    messageWindow._numberInputWindow = numberWindow;
    assert.equal(messageWindow._numberWindow, numberWindow);
    // The scene here has no _eventItemWindow, so this falls all the way
    // through to the stand-in, which answers start() harmlessly.
    assert.equal(typeof messageWindow._itemWindow.start, 'function');
    assert.equal(messageWindow._itemWindow.isOpenAndActive(), false);
});
