const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const compat = fs.readFileSync(
    path.join(repoRoot, 'runtime', 'libs', 'pixi_compat.js'), 'utf8');

function classes() {
    class Point {
        copyFrom(other) {
            this.x = other.x;
            this.y = other.y;
            return this;
        }
    }
    class ObservablePoint extends Point {}
    class Rectangle extends Point {}
    class Matrix {
        constructor(value) { this.value = value; }
        copyTo(other) {
            other.value = this.value;
            return other;
        }
    }
    return { Point, ObservablePoint, Rectangle, Matrix };
}

function applyShim(PIXI) {
    const marker = compat.indexOf('[PIXI.Point, "copyFrom"]');
    const start = compat.lastIndexOf('\n    [\n', marker) + 1;
    const end = compat.indexOf('\n\n    // -------------------------------------------------------------------------', marker);
    assert.ok(marker >= 0 && start >= 0 && end > marker, 'the geometry copy shim is locatable');
    vm.runInNewContext(compat.slice(start, end), { PIXI });
}

test('Point, ObservablePoint and Rectangle copy their argument into themselves', () => {
    const PIXI = classes();
    applyShim(PIXI);

    for (const Type of [PIXI.Point, PIXI.ObservablePoint, PIXI.Rectangle]) {
        const target = new Type();
        const result = target.copy({ x: 17, y: 29 });
        assert.equal(result, target);
        assert.deepEqual({ x: target.x, y: target.y }, { x: 17, y: 29 });
    }
});

test('Matrix keeps the legacy opposite direction and copies itself into its argument', () => {
    const PIXI = classes();
    applyShim(PIXI);
    const source = new PIXI.Matrix('source');
    const target = new PIXI.Matrix('target');

    const result = source.copy(target);

    assert.equal(result, target);
    assert.equal(source.value, 'source');
    assert.equal(target.value, 'source');
});

test('a PIXI version that still supplies copy keeps its own implementation', () => {
    const PIXI = classes();
    const nativeCopy = function() { return 'native'; };
    PIXI.Point.prototype.copy = nativeCopy;
    applyShim(PIXI);
    assert.equal(PIXI.Point.prototype.copy, nativeCopy);
});
