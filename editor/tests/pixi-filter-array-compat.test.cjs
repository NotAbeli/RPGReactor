const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const compat = fs.readFileSync(
    path.join(repoRoot, 'runtime', 'libs', 'pixi_compat.js'), 'utf8');

function applyShim(PIXI, isV8 = true) {
    const start = compat.indexOf(
        '    if (_isV8Pixi && PIXI.Container && PIXI.Container.prototype &&\n' +
        '        typeof Proxy === "function") {');
    const end = compat.indexOf('\n\n    if (!PIXI.BaseTexture) {', start);
    assert.ok(start >= 0 && end > start, 'the mutable filter shim is locatable');
    vm.runInNewContext(compat.slice(start, end), { PIXI, _isV8Pixi: isV8, Proxy, WeakMap });
}

function fakeV8() {
    class Container {
        constructor() {
            this._committedFilters = null;
            this.filterEffectAttached = false;
            this.filterAssignments = 0;
        }
    }
    Object.defineProperty(Container.prototype, 'filters', {
        configurable: true,
        get() {
            return this._committedFilters;
        },
        set(value) {
            this._committedFilters = value ? Object.freeze(Array.from(value)) : null;
            this.filterEffectAttached = !!(value && value.length);
            this.filterAssignments++;
        }
    });
    return { Container };
}

test('a plugin can assign an empty filter list and push into it afterwards', () => {
    const PIXI = fakeV8();
    applyShim(PIXI);
    const container = new PIXI.Container();
    const filter = { name: 'encounter transition' };

    container.filters = container.filters || [];
    assert.doesNotThrow(() => container.filters.push(filter));

    assert.equal(container.filters[0], filter);
    assert.equal(container.filterEffectAttached, true,
        'the mutation is committed through v8 so its FilterEffect is attached');
    assert.equal(Object.isFrozen(container._committedFilters), true,
        'v8 can keep its immutable internal representation');
});

test('every ordinary array mutation is committed back through the native setter', () => {
    const PIXI = fakeV8();
    applyShim(PIXI);
    const container = new PIXI.Container();
    const first = { name: 'first' };
    const second = { name: 'second' };
    const replacement = { name: 'replacement' };
    container.filters = [first, second];

    const view = container.filters;
    view.splice(0, 1);
    assert.deepEqual(Array.from(container._committedFilters), [second]);

    view[0] = replacement;
    assert.deepEqual(Array.from(container._committedFilters), [replacement]);

    view.length = 0;
    assert.equal(container._committedFilters.length, 0);
    assert.equal(container.filterEffectAttached, false,
        'clearing the view detaches the now-empty effect');
});

test('direct assignment invalidates the old mutable view and installing twice is harmless', () => {
    const PIXI = fakeV8();
    applyShim(PIXI);
    const container = new PIXI.Container();
    container.filters = [{ name: 'old' }];
    const oldView = container.filters;

    container.filters = [{ name: 'new' }];
    const newView = container.filters;
    assert.notEqual(newView, oldView);
    assert.equal(newView[0].name, 'new');

    const descriptor = Object.getOwnPropertyDescriptor(PIXI.Container.prototype, 'filters');
    applyShim(PIXI);
    assert.equal(Object.getOwnPropertyDescriptor(PIXI.Container.prototype, 'filters').get,
        descriptor.get, 'the existing wrapper is not wrapped again');
});

test('PIXI versions before v8 keep their native filter property', () => {
    const PIXI = fakeV8();
    const descriptor = Object.getOwnPropertyDescriptor(PIXI.Container.prototype, 'filters');
    applyShim(PIXI, false);
    assert.equal(Object.getOwnPropertyDescriptor(PIXI.Container.prototype, 'filters').get,
        descriptor.get);
});
