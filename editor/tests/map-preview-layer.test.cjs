const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(editorRoot, 'src', 'MapEditor.js'), 'utf8');

test('previewLayer is a Container, not a Graphics', () => {
    // It is used as a parent on every pointer move. PIXI v8 deprecated
    // parenting to a Graphics, so each addChild ran a deprecation path and the
    // node did not batch like a container.
    assert.match(source, /this\.previewLayer = new PIXI\.Container\(\);/);
    assert.doesNotMatch(source, /this\.previewLayer = new PIXI\.Graphics\(\);/);
    assert.match(source, /this\.previewGraphics = new PIXI\.Graphics\(\);/);
    assert.match(source, /this\.previewLayer\.addChild\(this\.previewGraphics\);/);
});

test('vector drawing goes to the graphics child, parenting to the container', () => {
    // A stray previewLayer.rect/fill/stroke would throw: Containers have no
    // drawing API.
    assert.doesNotMatch(source, /this\.previewLayer\.(rect|fill|stroke|clear)\(/);
    // And previewGraphics must never be used as a parent, or we are back where
    // we started.
    assert.doesNotMatch(source, /this\.previewGraphics\.addChild\(/);
});

test('clearing keeps the graphics child alive', () => {
    // removeChildren() would take previewGraphics with it, silently killing
    // every rectangle drawn afterwards.
    assert.doesNotMatch(source, /this\.previewLayer\.removeChildren\(\)/);
    const at = source.indexOf('_resetPreviewLayer() {');
    assert.ok(at >= 0, 'the reset helper exists');
    const body = source.slice(at, source.indexOf('\n    hideTilePreview', at));
    assert.match(body, /if \(child === this\.previewGraphics\) continue;/);
    assert.match(body, /this\.previewGraphics\.clear\(\)/);
});

test('discarded preview children are destroyed, but not their textures', () => {
    // They are rebuilt every pointer move; detaching without destroying left a
    // fresh object per tile per movement for the collector. The textures are
    // shared with the tileset caches and must survive.
    const at = source.indexOf('_resetPreviewLayer() {');
    const body = source.slice(at, source.indexOf('\n    hideTilePreview', at));
    assert.match(body, /destroy\(\{ children: true, texture: false, textureSource: false \}\)/);
});

test('the preview no longer allocates a Graphics per tile', () => {
    // Three sites built one Graphics per previewed tile — per pointer move, for
    // every tile in a stamp or circle radius. They draw into the shared child
    // now, which is the layer's first child and so already sits behind the
    // sprites added after it.
    // Other preview paths legitimately build a Graphics per tile inside their
    // own PIXI.Container, which is not a deprecated parent and not this hot
    // path; the assertion is scoped to the preview layer.
    assert.doesNotMatch(source, /this\.previewLayer\.addChild\(borderGraphics\)/);
    const addChildren = source.match(/this\.previewLayer\.addChild\(/g) || [];
    assert.equal(addChildren.length, 3,
        'only previewGraphics and the two tile-sprite paths parent to the preview layer');
});

test('the container is torn down with its child', () => {
    const destroys = source.match(/this\.previewLayer\.destroy\(\{ children: true \}\)/g) || [];
    assert.equal(destroys.length, 2, 'both the rebuild and the teardown path');
    assert.match(source, /this\.previewGraphics = null;/);
});
