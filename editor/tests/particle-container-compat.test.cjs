/**
 * A container that accepts every sprite and draws none of them.
 *
 * v8 kept the name ParticleContainer and changed what it draws: only
 * `particleChildren`, which are Particle objects handed to addParticle().
 * Ordinary children are ignored outright. A plugin written against v5 does
 *
 *     const c = new PIXI.ParticleContainer(10000, { tint: true });
 *     c.addChild(sprite);
 *
 * and gets nothing on screen, with no error and no warning -- the effect just
 * never appears. Weather, particle and damage-popup plugins all reach for it.
 *
 * The same failure shape as the tilemap's plugin layers: a container quietly
 * declining to draw what it was given.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const compat = fs.readFileSync(
    path.join(repoRoot, 'runtime', 'libs', 'pixi_compat.js'), 'utf8');

/** The shim, lifted out and run against a stand-in PIXI. */
function applyShim(PIXI, isV8 = true) {
    const start = compat.indexOf('if (_isV8Pixi && PIXI.Container && PIXI.ParticleContainer &&');
    const end = compat.indexOf('    if (!PIXI.BaseTexture) {');
    assert.ok(start >= 0 && end > start, 'the ParticleContainer shim is where it was');
    vm.runInNewContext(compat.slice(start, end), { PIXI, _isV8Pixi: isV8 });
    return PIXI;
}

/** v8 as it actually behaves: children go in, nothing comes out. */
function fakeV8() {
    class Container {
        constructor() { this.children = []; }
        addChild(c) { this.children.push(c); return c; }
        removeChild(c) {
            const i = this.children.indexOf(c);
            if (i >= 0) this.children.splice(i, 1);
            return c;
        }
    }
    class ParticleContainer extends Container {
        constructor() { super(); this.particleChildren = []; }
        addParticle(p) { this.particleChildren.push(p); return p; }
    }
    return { Container, ParticleContainer };
}

test('a sprite added the old way is a child that will actually be drawn', () => {
    const PIXI = applyShim(fakeV8());
    const container = new PIXI.ParticleContainer(10000, { tint: true });
    const sprite = { name: 'a light' };

    container.addChild(sprite);

    assert.ok(container instanceof PIXI.Container, 'it is an ordinary container');
    assert.equal(container.children.length, 1, 'and the sprite is a real child');
    assert.equal(container.children[0], sprite);
    // v8's version would have left `children` unrendered and drawn from
    // particleChildren, which nothing here ever fills.
    assert.notEqual(Object.getPrototypeOf(container), PIXI.__v8ParticleContainer.prototype);
});

test('the v5 constructor arguments survive, because plugins read them back', () => {
    const PIXI = applyShim(fakeV8());
    const props = { scale: true, tint: true };
    const container = new PIXI.ParticleContainer(500, props, 2048, true);

    assert.equal(container.maxSize, 500);
    assert.equal(container.properties, props);
    assert.equal(container.batchSize, 2048);
    assert.equal(container.autoResize, true);
    assert.equal(container.interactiveChildren, false);

    container.setProperties({ tint: false });
    assert.deepEqual(container.properties, { tint: false });

    // Constructed bare, as plenty of plugins do.
    const bare = new PIXI.ParticleContainer();
    assert.equal(bare.maxSize, 1500);
    assert.equal(Object.keys(bare.properties).length, 0);
    assert.equal(bare.batchSize, 16384);
    assert.equal(bare.autoResize, false);
});

test('v8\'s own names still work rather than throwing mid-update', () => {
    const PIXI = applyShim(fakeV8());
    const container = new PIXI.ParticleContainer();
    const particle = { texture: null };

    assert.equal(container.addParticle(particle), particle);
    assert.equal(container.particleChildren.length, 1);
    assert.equal(container.particleChildren[0], particle);
    container.removeParticle(particle);
    assert.equal(container.particleChildren.length, 0);
});

test('the MV location points at the same class', () => {
    // reactor_mv_compat defines this too, but it is switched off for MZ
    // projects, and an MZ project can still carry an MV-era plugin.
    const PIXI = applyShim(fakeV8());
    assert.equal(PIXI.particles.ParticleContainer, PIXI.ParticleContainer);
});

test('an MV compat layer that got there first is left alone', () => {
    const PIXI = fakeV8();
    class AlreadyShimmed extends PIXI.Container {}
    PIXI.particles = { ParticleContainer: AlreadyShimmed };
    applyShim(PIXI);
    assert.equal(PIXI.particles.ParticleContainer, AlreadyShimmed);
});

test('applying it twice does not wrap the wrapper', () => {
    const PIXI = applyShim(fakeV8());
    const once = PIXI.ParticleContainer;
    const original = PIXI.__v8ParticleContainer;
    applyShim(PIXI);
    assert.equal(PIXI.ParticleContainer, once, 'same class');
    assert.equal(PIXI.__v8ParticleContainer, original, 'and v8\'s is not overwritten with ours');
});

test('nothing is touched on v5, v6 or v7', () => {
    // There the class does the right thing already, and replacing it would
    // throw away real batching.
    const PIXI = fakeV8();
    const original = PIXI.ParticleContainer;
    applyShim(PIXI, false);
    assert.equal(PIXI.ParticleContainer, original);
    assert.equal(PIXI.__v8ParticleContainer, undefined);
    assert.equal(PIXI.particles, undefined);
});
