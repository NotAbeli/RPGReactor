/**
 * P15: тёмные регионные стены (тайлы затемнения) в превью света.
 * У мостовых проектов манифест plugins.js ПУСТ — SDLight живёт в
 * project.rpgreactor (retiredPlugins/engineModules). _loadBlockedRegions
 * обязан находить его там; пустые параметры резолвятся дефолтами.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class Container { constructor(){this.children=[];this.parent=null;this.visible=true;this.zIndex=0;this.label='';this.cursor='';this.interactive=false;} on(){} off(){} addChild(c){c.parent=this;this.children.push(c);return c;} addChildAt(c,i){c.parent=this;this.children.splice(Math.min(i,this.children.length),0,c);return c;} removeChild(c){this.children=this.children.filter(x=>x!==c);c.parent=null;} removeChildren(){const o=this.children;this.children=[];o.forEach(c=>{c.parent=null;});return o;} destroy(o){this.children.slice().forEach(c=>c.destroy&&c.destroy(o));this.children=[];} }
class Graphics extends Container { constructor(){super();this.ops=[];this.visible=true;} rect(){return this;} ellipse(){return this;} circle(){return this;} moveTo(){return this;} lineTo(){return this;} closePath(){return this;} fill(){return this;} stroke(){return this;} clear(){this.ops.length=0;return this;} }

function loadLightManager() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'LightManager.js'), 'utf8');
    const ctx = {
        console, window: null, navigator: {},
        PIXI: { Container, Graphics, Sprite: class extends Container {}, Texture: { from: () => ({}) }, Text: class extends Container {} },
        document: { createElement: () => ({ getContext: () => ({ setTransform(){},clearRect(){},fillRect(){},fillText(){},drawImage(){},save(){},restore(){},beginPath(){},rect(){},fill(){},stroke(){},arc(){},createRadialGradient: () => ({ addColorStop(){} }), globalCompositeOperation: '', fillStyle: '' }), style: {} }), getElementById: () => null, body: {}, addEventListener() {} },
        setInterval: () => 1, clearInterval() {}, setTimeout: (f) => f && f(), clearTimeout() {},
        requestAnimationFrame() {},
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src + '\nthis.LightManager = LightManager;', ctx, { filename: 'LightManager.js' });
    return ctx.LightManager;
}

function makeTmpProject(files) {
    const dir = fs.mkdtempSync(path.join(process.env.TEMP, 'opencode', 'p15-'));
    for (const [rel, content] of Object.entries(files)) {
        const p = path.join(dir, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content);
    }
    return dir;
}

test('P15: пустой plugins.js — регионы из project.rpgreactor + дефолты', () => {
    const LM = loadLightManager();
    const dir = makeTmpProject({
        'js/plugins.js': '// Generated\nvar $plugins =\n[];\n',
        'project.rpgreactor': JSON.stringify({
            engineModules: [],
            retiredPlugins: [{ name: 'SDLight', parameters: { 'Region Settings': '', 'Wall Softness': '10' } }]
        })
    });
    const lm = new LM({ getCurrentProject: () => ({ path: dir }) }, {});
    lm.fs = fs;
    lm.path = path;
    lm._loadBlockedRegions();
    // пустой Region Settings → дефолты PROJECT_DEFAULTS: 8,1,11,12,13,14
    for (const rid of [8, 1, 11, 12, 13, 14]) {
        assert.ok(lm._blockedRegions[rid], 'blocked region ' + rid);
    }
    assert.strictEqual(lm._blockedRegions[8], '#000000', 'color resolved');
    assert.strictEqual(lm._wallSoftness, 10, 'wall softness from the snapshot');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('P15: явные регионы в rpgreactor перекрывают дефолты; plugins.js приоритетнее', () => {
    const LM = loadLightManager();
    // rpgreactor с явными регионами
    const dir1 = makeTmpProject({
        'js/plugins.js': 'var $plugins = [];',
        'project.rpgreactor': JSON.stringify({
            engineModules: [{ name: 'SDLight', parameters: { 'Region Settings': '5 #112233', 'Wall Softness': '' } }]
        })
    });
    const lm1 = new LM({ getCurrentProject: () => ({ path: dir1 }) }, {});
    lm1.fs = fs; lm1.path = path;
    lm1._loadBlockedRegions();
    assert.strictEqual(lm1._blockedRegions[5], '#112233', 'explicit region from rpgreactor');
    assert.ok(!lm1._blockedRegions[8], 'defaults not mixed in when explicit');
    assert.strictEqual(lm1._wallSoftness, 10, 'empty softness -> PROJECT_DEFAULTS 10');

    // plugins.js с SDLight приоритетнее rpgreactor
    const dir2 = makeTmpProject({
        'js/plugins.js': 'var $plugins = [{ "name": "SDLight", "status": true, "parameters": { "Region Settings": "3 #445566" } }];',
        'project.rpgreactor': JSON.stringify({
            engineModules: [{ name: 'SDLight', parameters: { 'Region Settings': '9 #000000' } }]
        })
    });
    const lm2 = new LM({ getCurrentProject: () => ({ path: dir2 }) }, {});
    lm2.fs = fs; lm2.path = path;
    lm2._loadBlockedRegions();
    assert.strictEqual(lm2._blockedRegions[3], '#445566', 'plugins.js wins');
    assert.ok(!lm2._blockedRegions[9], 'rpgreactor region not used');
    fs.rmSync(dir1, { recursive: true, force: true });
    fs.rmSync(dir2, { recursive: true, force: true });
});
