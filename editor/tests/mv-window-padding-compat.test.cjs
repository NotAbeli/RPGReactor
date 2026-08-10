const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const compat = fs.readFileSync(
    path.join(repoRoot, 'runtime', 'reactor_mv_compat.js'), 'utf8');

function install(Window_Base, gameSystem) {
    const start = compat.indexOf('        Window_Base.prototype.standardPadding = function() {');
    const end = compat.indexOf('        Window_Base.prototype.textPadding = function()', start);
    assert.ok(start >= 0 && end > start, 'the MV padding methods are locatable');
    vm.runInNewContext(compat.slice(start, end), {
        Window_Base,
        $gameSystem: gameSystem
    });
}

test('MV updatePadding honors a plugin override of standardPadding', () => {
    function Window_Base() {}
    install(Window_Base, { windowPadding: () => 12 });
    const window = new Window_Base();
    window.standardPadding = () => 0;

    window.updatePadding();

    assert.equal(window.padding, 0,
        'a zero-padding autosave window keeps its full client area');
});

test('an ordinary window still uses the game system padding', () => {
    function Window_Base() {}
    install(Window_Base, { windowPadding: () => 14 });
    const window = new Window_Base();

    window.updatePadding();

    assert.equal(window.padding, 14);
});

test('the MV fallback remains 18 when no game system is available', () => {
    function Window_Base() {}
    install(Window_Base, null);
    const window = new Window_Base();
    window.updatePadding();
    assert.equal(window.padding, 18);
});
