const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_managers.js');

function loadPluginManagerChunk() {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf('function PluginManager()');
    const end = source.indexOf('PluginManager.registerCommand');
    assert.ok(start > 0, 'PluginManager block not found in runtime');
    assert.ok(end > start, 'PluginManager block end marker not found');
    return source.slice(start, end);
}

const CHUNK = loadPluginManagerChunk();

function makePluginManager({ env = {}, cwd }) {
    const loadedScripts = [];
    const context = {
        console,
        document: {
            createElement: () => ({ type: '', src: '', async: false, defer: false, onerror: null, _url: '' }),
            body: { appendChild: script => loadedScripts.push(script) },
        },
        Utils: {
            encodeURI: value => encodeURI(value),
            extractFileName: name => name,
        },
        process: { env, cwd: () => cwd },
        require: name => {
            if (name === 'fs') return fs;
            if (name === 'path') return path;
            throw new Error('module not mocked: ' + name);
        },
    };
    vm.createContext(context);
    vm.runInContext(CHUNK, context);
    context.__loadedScripts = loadedScripts;
    return context;
}

function resetCatalogCache(pm) {
    pm._enginePluginsDir = null;
    pm._enginePluginsDirResolved = false;
}

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-test-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

test('resolveEnginePluginsDir prefers env var when the dir exists', () => {
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        const ctx = makePluginManager({
            env: { RPGREACTOR_PLUGINS_DIR: engineDir },
            cwd: projectDir,
        });
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), engineDir);
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});

test('resolveEnginePluginsDir falls back to project.rpgreactor when env dir is missing', () => {
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        fs.writeFileSync(
            path.join(projectDir, 'project.rpgreactor'),
            JSON.stringify({ enginePluginsDir: engineDir }),
            'utf8');
        const ctx = makePluginManager({
            env: { RPGREACTOR_PLUGINS_DIR: path.join(projectDir, 'no-such-dir') },
            cwd: projectDir,
        });
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), engineDir);
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});

test('resolveEnginePluginsDir returns null without env and metadata', () => {
    const projectDir = tempDir();
    try {
        const ctx = makePluginManager({ env: {}, cwd: projectDir });
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), null);
    } finally {
        cleanupTemp(projectDir);
    }
});

test('resolveEnginePluginsDir ignores metadata pointing to a missing dir', () => {
    const projectDir = tempDir();
    try {
        fs.writeFileSync(
            path.join(projectDir, 'project.rpgreactor'),
            JSON.stringify({ enginePluginsDir: path.join(projectDir, 'gone') }),
            'utf8');
        const ctx = makePluginManager({ env: {}, cwd: projectDir });
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), null);
    } finally {
        cleanupTemp(projectDir);
    }
});

test('resolveEnginePluginsDir survives broken metadata JSON', () => {
    const projectDir = tempDir();
    try {
        fs.writeFileSync(path.join(projectDir, 'project.rpgreactor'), '{not json', 'utf8');
        const ctx = makePluginManager({ env: {}, cwd: projectDir });
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), null);
    } finally {
        cleanupTemp(projectDir);
    }
});

test('resolveEnginePluginsDir caches the first successful resolution', () => {
    const projectDir = tempDir();
    const engineA = tempDir();
    const engineB = tempDir();
    try {
        const env = { RPGREACTOR_PLUGINS_DIR: engineA };
        const ctx = makePluginManager({ env, cwd: projectDir });
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), engineA);
        env.RPGREACTOR_PLUGINS_DIR = engineB;
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), engineA);
        resetCatalogCache(ctx.PluginManager);
        assert.strictEqual(ctx.PluginManager.resolveEnginePluginsDir(), engineB);
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineA);
        cleanupTemp(engineB);
    }
});

test('localPluginExists checks <cwd>/js/plugins/<name>.js', () => {
    const projectDir = tempDir();
    try {
        const localDir = path.join(projectDir, 'js', 'plugins');
        fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, 'Local.js'), '// local', 'utf8');
        const ctx = makePluginManager({ env: {}, cwd: projectDir });
        assert.strictEqual(ctx.PluginManager.localPluginExists('Local'), true);
        assert.strictEqual(ctx.PluginManager.localPluginExists('Missing'), false);
    } finally {
        cleanupTemp(projectDir);
    }
});

test('makeUrl keeps the local URL when the project has the file', () => {
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        const localDir = path.join(projectDir, 'js', 'plugins');
        fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, 'Local.js'), '// local', 'utf8');
        fs.writeFileSync(path.join(engineDir, 'Local.js'), '// engine copy', 'utf8');
        const ctx = makePluginManager({
            env: { RPGREACTOR_PLUGINS_DIR: engineDir },
            cwd: projectDir,
        });
        assert.strictEqual(ctx.PluginManager.makeUrl('Local'), 'js/plugins/Local.js');
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});

test('makeUrl returns a file:// URL from the engine catalog when local is absent', () => {
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        fs.writeFileSync(path.join(engineDir, 'Engine.js'), '// engine', 'utf8');
        const ctx = makePluginManager({
            env: { RPGREACTOR_PLUGINS_DIR: engineDir },
            cwd: projectDir,
        });
        const url = ctx.PluginManager.makeUrl('Engine');
        const expected = encodeURI('file:///' + path.join(engineDir, 'Engine.js').replace(/\\/g, '/'));
        assert.strictEqual(url, expected);
        assert.ok(url.startsWith('file:///'));
        assert.ok(!url.includes('\\'));
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});

test('makeUrl falls back to the local URL when neither source has the file', () => {
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        const ctx = makePluginManager({
            env: { RPGREACTOR_PLUGINS_DIR: engineDir },
            cwd: projectDir,
        });
        assert.strictEqual(ctx.PluginManager.makeUrl('Ghost'), 'js/plugins/Ghost.js');
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});

test('loadScript injects a script tag with the resolved URL', () => {
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        fs.writeFileSync(path.join(engineDir, 'Engine.js'), '// engine', 'utf8');
        const ctx = makePluginManager({
            env: { RPGREACTOR_PLUGINS_DIR: engineDir },
            cwd: projectDir,
        });
        ctx.PluginManager.loadScript('Engine');
        assert.strictEqual(ctx.__loadedScripts.length, 1);
        assert.strictEqual(ctx.__loadedScripts[0].src, ctx.PluginManager.makeUrl('Engine'));
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});
