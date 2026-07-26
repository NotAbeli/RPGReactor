const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspaceRoot = path.resolve(__dirname, '..', '..');

// Runs the real installInterpreterCompatibility() against a stub interpreter
// shaped like the MZ one, so the wait-mode contracts are exercised rather than
// asserted against source text.
function installInterpreterCompatibility(Game_Interpreter) {
    const compat = fs.readFileSync(path.join(workspaceRoot, 'runtime', 'reactor_mv_compat.js'), 'utf8');
    const start = compat.indexOf('    function installInterpreterCompatibility() {');
    const end = compat.indexOf('\n    function installWindowCompatibility()', start);
    assert.ok(start >= 0 && end > start, 'interpreter compatibility section is locatable');

    const sandbox = { global: { Game_Interpreter }, Game_Interpreter, console };
    vm.runInNewContext(`${compat.slice(start, end)}\ninstallInterpreterCompatibility();`, sandbox);
}

function makeInterpreterClass() {
    function Game_Interpreter() {}
    Game_Interpreter.prototype.clear = function() {
        this._waitMode = '';
        this._characterId = 0;
        this._list = null;
        this._index = 0;
    };
    Game_Interpreter.prototype.setup = function(list, eventId) {
        this.clear();
        this._list = list;
        this._eventId = eventId || 0;
    };
    // MZ's contract: the wait resolves through _characterId.
    Game_Interpreter.prototype.character = function(param) {
        if (param < 0) return this._player;
        return this._charactersById[param] || this._player;
    };
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'route') {
            const character = this.character(this._characterId);
            const waiting = !!(character && character.isMoveRouteForcing());
            if (!waiting) this._waitMode = '';
            return waiting;
        }
        return false;
    };
    Game_Interpreter.prototype.command205 = function(params) {
        this._characterId = params[0];
        const character = this.character(params[0]);
        if (character) {
            character.forceMoveRoute(params[1]);
            if (params[1].wait) this._waitMode = 'route';
        }
        return true;
    };
    return Game_Interpreter;
}

function makeCharacter(name) {
    return {
        name,
        forcing: false,
        forceMoveRoute(route) { this.forcing = true; this.route = route; },
        isMoveRouteForcing() { return this.forcing; }
    };
}

test('a finished MV route wait cannot answer the next event\'s wait check', () => {
    const Game_Interpreter = makeInterpreterClass();
    installInterpreterCompatibility(Game_Interpreter);

    const guard = makeCharacter('guard');
    const merchant = makeCharacter('merchant');
    const interpreter = new Game_Interpreter();
    interpreter._player = makeCharacter('player');
    interpreter._charactersById = { 1: guard, 2: merchant };

    // Event A: Set Movement Route with Wait on the guard.
    interpreter.command205([1, { wait: true, list: [] }]);
    assert.equal(interpreter._waitMode, 'route');
    assert.equal(interpreter.updateWaitMode(), true, 'the wait holds while the guard moves');

    guard.forcing = false;
    assert.equal(interpreter.updateWaitMode(), false, 'the wait releases when the guard stops');
    assert.equal(interpreter._waitMode, '');

    // Event B reuses the same interpreter instance, and arms its wait through
    // the MZ contract alone — the path an MV plugin takes when it forces a
    // route itself and only calls setWaitMode.
    interpreter.setup([], 2);
    merchant.forceMoveRoute({ wait: true, list: [] });
    interpreter._characterId = 2;
    interpreter._waitMode = 'route';

    assert.equal(interpreter.updateWaitMode(), true,
        'the merchant\'s wait must hold; a stale mirror from event A would dissolve it');
    assert.equal(interpreter._waitMode, 'route');

    merchant.forcing = false;
    assert.equal(interpreter.updateWaitMode(), false, 'and still releases normally');
});

test('the MV mirror still outranks _characterId while it is fresh', () => {
    const Game_Interpreter = makeInterpreterClass();
    installInterpreterCompatibility(Game_Interpreter);

    const follower = makeCharacter('follower');
    const runningEvent = makeCharacter('runningEvent');
    const interpreter = new Game_Interpreter();
    interpreter._player = runningEvent;
    interpreter._charactersById = {};

    // A follower-control plugin overrides command205 and sets only _character,
    // leaving _characterId at 0 — which MZ resolves to the running event.
    Object.defineProperty(interpreter, '_character', {
        value: follower, writable: true, configurable: true, enumerable: false
    });
    interpreter._characterId = 0;
    follower.forcing = true;
    interpreter._waitMode = 'route';

    assert.equal(interpreter.updateWaitMode(), true,
        'the wait follows the mirrored follower, not the running event');

    follower.forcing = false;
    assert.equal(interpreter.updateWaitMode(), false);
    assert.equal(interpreter._character, null, 'the mirror is dropped once its wait ends');
});

test('the mirror is never enumerable, so interpreters stay serializable', () => {
    const Game_Interpreter = makeInterpreterClass();
    installInterpreterCompatibility(Game_Interpreter);

    const guard = makeCharacter('guard');
    const interpreter = new Game_Interpreter();
    interpreter._player = makeCharacter('player');
    interpreter._charactersById = { 1: guard };

    interpreter.command205([1, { wait: true, list: [] }]);
    assert.equal(Object.keys(interpreter).includes('_character'), false,
        'a live character in a save would be deep-cloned and soft-lock the wait after load');
    assert.equal(JSON.stringify(interpreter).includes('"_character"'), false);

    // Clearing must not resurrect it as an ordinary enumerable property.
    interpreter.clear();
    assert.equal(Object.keys(interpreter).includes('_character'), false);
    assert.equal(interpreter._character, null);
});
