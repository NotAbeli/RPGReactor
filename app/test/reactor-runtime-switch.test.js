const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ProjectManager = require('../src/ProjectManager.js');
const RUNTIME = path.join(__dirname, '..', 'runtime');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-switch-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

function makeManager() {
    const manager = new ProjectManager();
    manager.fs = fs;
    manager.path = path;
    // getRuntimePath() looks at process.cwd(); point it at the real runtime.
    const originalCwd = process.cwd();
    process.chdir(path.join(__dirname, '..'));
    return { manager, restore: () => process.chdir(originalCwd) };
}

function makeMvProject(dir, { engineModules = true } = {}) {
    fs.mkdirSync(path.join(dir, 'js', 'libs'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'js', 'main.js'), '// mv main');
    fs.writeFileSync(path.join(dir, 'js', 'rpg_core.js'), '// mv core');
    fs.writeFileSync(path.join(dir, 'js', 'rpg_managers.js'), '// mv managers');
    fs.writeFileSync(path.join(dir, 'js', 'plugins.js'), 'var $plugins = [];\n');
    fs.writeFileSync(path.join(dir, 'js', 'libs', 'pixi.js'), '// mv pixi');
    fs.writeFileSync(path.join(dir, 'index.html'), '<script src="js/rpg_core.js"></script>');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 't', main: 'index.html' }));
    fs.writeFileSync(path.join(dir, 'project.rpgreactor'), JSON.stringify(
        engineModules ? { engineModules: [{ name: 'SuperDuperInventory', parameters: {}, orderBefore: [] }] } : {}
    ));
}

test('ensureAgoniaRuntimeForPlaytest switches a migrated MV project to the Agonia runtime', async () => {
    const dir = tempDir();
    const { manager, restore } = makeManager();
    try {
        makeMvProject(dir);
        const result = await manager.ensureAgoniaRuntimeForPlaytest(dir);

        assert.strictEqual(result.switched, true, result.error);
        assert.ok(result.archivedTo, 'MV files archived');

        // Reactor runtime installed into js/.
        assert.ok(fs.existsSync(path.join(dir, 'js', 'reactor_main.js')));
        assert.ok(fs.existsSync(path.join(dir, 'js', 'reactor_managers.js')));
        assert.ok(fs.existsSync(path.join(dir, 'js', 'libs', 'pixi.js')), 'reactor pixi shipped');

        // index.html now boots the reactor runtime.
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        assert.ok(/js\/reactor_main\.js/.test(html), 'index.html references reactor_main.js');

        // MV corescript quarantined: gone from js/, present in the zip.
        assert.ok(!fs.existsSync(path.join(dir, 'js', 'rpg_core.js')));
        assert.ok(!fs.existsSync(path.join(dir, 'js', 'main.js')));
        const zipPath = path.join(dir, result.archivedTo);
        assert.ok(fs.existsSync(zipPath));
        const zip = fs.readFileSync(zipPath);
        const text = zip.toString('latin1');
        assert.ok(text.includes('js/rpg_core.js'), 'rpg_core.js inside the archive');
        assert.ok(text.includes('js/main.js'), 'main.js inside the archive');

        // Reactor plugin manifest seeded from the project manifest.
        assert.ok(fs.existsSync(path.join(dir, 'js', 'reactor_plugins.js')));
    } finally {
        restore();
        cleanupTemp(dir);
    }
});

test('ensureAgoniaRuntimeForPlaytest is idempotent (already switched -> no-op)', async () => {
    const dir = tempDir();
    const { manager, restore } = makeManager();
    try {
        makeMvProject(dir);
        const first = await manager.ensureAgoniaRuntimeForPlaytest(dir);
        assert.strictEqual(first.switched, true, first.error);
        const zipsAfterFirst = fs.readdirSync(dir).filter(f => f.startsWith('rpgmaker-runtime-backup'));

        const second = await manager.ensureAgoniaRuntimeForPlaytest(dir);
        assert.strictEqual(second.switched, false);
        assert.strictEqual(second.alreadyReactor, true);
        const zipsAfterSecond = fs.readdirSync(dir).filter(f => f.startsWith('rpgmaker-runtime-backup'));
        assert.strictEqual(zipsAfterSecond.length, zipsAfterFirst.length, 'no extra archive created');
    } finally {
        restore();
        cleanupTemp(dir);
    }
});

test('ensureAgoniaRuntimeForPlaytest skips an unmigrated MV project', async () => {
    const dir = tempDir();
    const { manager, restore } = makeManager();
    try {
        makeMvProject(dir, { engineModules: false });
        const result = await manager.ensureAgoniaRuntimeForPlaytest(dir);
        assert.strictEqual(result.switched, false);
        assert.ok(result.skipped && result.skipped.includes('engine modules'));
        assert.ok(fs.existsSync(path.join(dir, 'js', 'rpg_core.js')), 'MV files untouched');
    } finally {
        restore();
        cleanupTemp(dir);
    }
});
