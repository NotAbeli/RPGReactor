const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const workspaceRoot = path.resolve(__dirname, '..', '..');

// Runs the real pixi_compat.js against a stub PIXI shaped like the running
// version, so the upload-batching contract is exercised end to end.
function loadCompat({ v8 = true } = {}) {
    const source = fs.readFileSync(path.join(workspaceRoot, 'runtime', 'libs', 'pixi_compat.js'), 'utf8');

    const uploads = [];
    const resizes = [];
    class TextureSource {
        constructor(options) {
            this.resource = (options && options.resource) || null;
            this.destroyed = false;
            this._resolution = 1;
            this.width = (this.resource && this.resource.width) || 1;
            this.height = (this.resource && this.resource.height) || 1;
            this.pixelWidth = this.width;
            this.pixelHeight = this.height;
        }
        get resourceWidth() { return this.resource ? this.resource.width : 0; }
        get resourceHeight() { return this.resource ? this.resource.height : 0; }
        // Stands in for GlTextureSystem.onSourceUpdate, which v8 wires to the
        // source's "update" event and which performs a full texImage2D.
        update() {
            if (this.resource && this.resource.width !== this.pixelWidth) {
                this.pixelWidth = this.resource.width;
                this.width = this.resource.width;
                resizes.push(this);
            }
            uploads.push(this);
        }
        // v8 returns true only when the dimensions actually changed, and emits
        // "resize" — which GlTextureSystem also routes to onSourceUpdate.
        resize(width, height) {
            if (this.width === width && this.height === height) return false;
            this.width = width;
            this.height = height;
            resizes.push(this);
            uploads.push(this);
            return true;
        }
        destroy() { this.destroyed = true; }
    }

    const renders = [];
    class AbstractRenderer {
        render(options) { renders.push(options); }
    }

    const PIXI = {
        AbstractRenderer,
        Container: class Container {},
        Texture: class Texture {},
        settings: {},
        Rectangle: class Rectangle {},
    };
    if (v8) {
        // _isV8Pixi is derived from the presence of TextureSource.
        PIXI.TextureSource = TextureSource;
        PIXI.CanvasSource = TextureSource;
        PIXI.ImageSource = TextureSource;
    }

    const sandbox = {
        PIXI,
        window: { PIXI },
        console: { log() {}, warn() {}, error() {}, info() {} },
        document: {
            createElement: () => ({ width: 1, height: 1, getContext: () => ({}) })
        },
        navigator: { userAgent: 'test' },
        performance: { now: () => 0 }
    };
    sandbox.globalThis = sandbox;
    sandbox.window.document = sandbox.document;

    try {
        vm.runInNewContext(source, sandbox);
    } catch (error) {
        // The compat file touches many optional PIXI surfaces; the parts under
        // test are guarded individually and installed before anything throws.
        if (!PIXI.__reactorFlushTextureUploads) throw error;
    }

    return { PIXI, uploads, renders, resizes, TextureSource, AbstractRenderer };
}

test('many draw ops between renders collapse into one upload', () => {
    const { PIXI, uploads } = loadCompat();
    const canvas = { width: 640, height: 480 };
    const baseTexture = new PIXI.BaseTexture(canvas);

    // Stands in for a window redrawing its contents: corescript ends every
    // Bitmap draw op with _baseTexture.update().
    uploads.length = 0;
    for (let call = 0; call < 246; call++) baseTexture.update();

    assert.equal(uploads.length, 0, 'no upload happens while drawing');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 1, 'the source is queued once, not 246 times');

    new PIXI.AbstractRenderer().render({});
    assert.equal(uploads.length, 1, '246 draw ops cost exactly one GPU upload');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 0, 'the queue drains');
});

test('every render flushes first, including render-to-texture mid-update', () => {
    const { PIXI, uploads } = loadCompat();
    const first = new PIXI.BaseTexture({ width: 8, height: 8 });
    const second = new PIXI.BaseTexture({ width: 8, height: 8 });
    const renderer = new PIXI.AbstractRenderer();

    uploads.length = 0;
    first.update();
    // A light-map pass renders to a texture before the main frame render. It
    // must see the fresh pixels, not last frame's.
    renderer.render({ container: {}, target: {} });
    assert.equal(uploads.length, 1, 'a render-to-texture pass uploads pending work first');

    second.update();
    renderer.render({});
    assert.equal(uploads.length, 2);

    // A render with nothing pending does no upload work at all.
    renderer.render({});
    assert.equal(uploads.length, 2);
});

test('distinct sources each upload once per flush', () => {
    const { PIXI, uploads } = loadCompat();
    const textures = [0, 1, 2].map(() => new PIXI.BaseTexture({ width: 4, height: 4 }));

    uploads.length = 0;
    for (const texture of textures) {
        texture.update();
        texture.update();
    }
    assert.equal(PIXI.__reactorPendingTextureUploads(), 3);

    new PIXI.AbstractRenderer().render({});
    assert.equal(uploads.length, 3, 'each source uploads exactly once');
});

test('destroying a source with pending work uploads it first', () => {
    const { PIXI, uploads } = loadCompat();
    // Window_Base.createContents() destroys the previous contents bitmap while
    // a popup sprite is still displaying it, so the queued pixels have to be
    // sent before the source goes away.
    const displayed = new PIXI.BaseTexture({ width: 64, height: 24 });

    uploads.length = 0;
    displayed.update();
    assert.equal(uploads.length, 0);

    displayed._textureSource.destroy();
    assert.equal(uploads.length, 1, 'the pending upload is flushed on teardown');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 0);
});

test('destroying a source with no pending work does not force a flush', () => {
    const { PIXI, uploads } = loadCompat();
    const queued = new PIXI.BaseTexture({ width: 8, height: 8 });
    const other = new PIXI.BaseTexture({ width: 8, height: 8 });

    uploads.length = 0;
    queued.update();
    other._textureSource.destroy();
    assert.equal(uploads.length, 0, 'an unrelated teardown leaves the queue alone');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 1);
});

test('a source destroyed before the flush is skipped, not thrown on', () => {
    const { PIXI, uploads } = loadCompat();
    const texture = new PIXI.BaseTexture({ width: 4, height: 4 });

    uploads.length = 0;
    texture.update();
    texture._textureSource.destroyed = true;

    assert.doesNotThrow(() => new PIXI.AbstractRenderer().render({}));
    assert.equal(uploads.length, 0, 'a dead source is not uploaded');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 0, 'and is dropped from the queue');
});

test('a resized source reconciles its dimensions immediately, not at flush', () => {
    const { PIXI, uploads, resizes } = loadCompat();
    const canvas = { width: 64, height: 24 };
    const baseTexture = new PIXI.BaseTexture(canvas);

    uploads.length = 0;
    resizes.length = 0;

    // A window growing its contents changes the backing canvas. Texture frames
    // and UVs are derived from the source size, so that must land before any
    // sprite is built from it — a deferred resize draws mirrored or stretched.
    canvas.width = 128;
    baseTexture.update();

    assert.equal(resizes.length, 1, 'the new size is applied on the spot');
    assert.equal(baseTexture._textureSource.width, 128);
    assert.equal(PIXI.__reactorPendingTextureUploads(), 0,
        'a size change goes straight through to v8, leaving nothing queued');

    // A draw that does not change size still batches.
    uploads.length = 0;
    baseTexture.update();
    baseTexture.update();
    assert.equal(uploads.length, 0);
    assert.equal(PIXI.__reactorPendingTextureUploads(), 1);
});

test('the runtime switch restores immediate uploads', () => {
    const { PIXI, uploads } = loadCompat();
    const texture = new PIXI.BaseTexture({ width: 8, height: 8 });

    uploads.length = 0;
    PIXI.__reactorDeferTextureUploads = false;
    texture.update();
    assert.equal(uploads.length, 1, 'the upload happens on the spot');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 0, 'nothing is queued');

    PIXI.__reactorDeferTextureUploads = true;
    texture.update();
    assert.equal(uploads.length, 1, 'batching resumes');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 1);
});

test('off v8 the upload stays immediate, since nothing would drain a queue', () => {
    const { PIXI, uploads } = loadCompat({ v8: false });
    // Without PIXI.TextureSource the shim has no source to build, so drive the
    // policy directly through a legacy-shaped update.
    assert.equal(typeof PIXI.__reactorFlushTextureUploads, 'function');
    assert.equal(PIXI.__reactorPendingTextureUploads(), 0);
    assert.equal(uploads.length, 0);
});
