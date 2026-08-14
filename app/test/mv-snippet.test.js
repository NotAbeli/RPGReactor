const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const PROJECT_MANAGER = path.join(__dirname, '..', 'src', 'ProjectManager.js');
const MARKER = 'RPGReactor: engine plugin catalog loader';

function extractSnippet() {
    const source = fs.readFileSync(PROJECT_MANAGER, 'utf8');
    const start = source.indexOf('static MV_CATALOG_LOADER_SNIPPET');
    assert.ok(start > 0, 'MV_CATALOG_LOADER_SNIPPET not found');
    const joinIndex = source.indexOf("].join('\\n');", start);
    assert.ok(joinIndex > start, 'snippet join terminator not found');
    const arrayStart = source.indexOf('[', start);
    const lines = eval(source.slice(arrayStart, joinIndex + 1));
    return lines.join('\n');
}

function applyPatch(source, snippet) {
    if (source.includes(MARKER)) return source;
    return source.replace(/\s*$/, '') + snippet;
}

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agonia-test-'));
}

function cleanupTemp(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
}

test('snippet is extractable and compiles as JavaScript', () => {
    const snippet = extractSnippet();
    assert.ok(snippet.includes(MARKER));
    assert.doesNotThrow(() => new Function(snippet));
});

test('patch application is idempotent', () => {
    const snippet = extractSnippet();
    const original = 'var PluginManager = {};\n\n\n  ';
    const once = applyPatch(original, snippet);
    const twice = applyPatch(once, snippet);
    assert.strictEqual(twice, once);
    assert.strictEqual(once.endsWith(snippet), true);
    assert.strictEqual((once.match(new RegExp(MARKER, 'g')) || []).length, 2);
});

test('patched loader resolves local overrides first', () => {
    const snippet = extractSnippet();
    const projectDir = tempDir();
    const engineDir = tempDir();
    try {
        const localDir = path.join(projectDir, 'js', 'plugins');
        fs.mkdirSync(localDir, { recursive: true });
        fs.writeFileSync(path.join(localDir, 'Local.js'), '// local', 'utf8');
        fs.writeFileSync(path.join(engineDir, 'Engine.js'), '// engine', 'utf8');
        const scripts = [];
        const context = {
            window: null,
            PluginManager: { _path: 'js/plugins/', onError: function () { } },
            process: { env: { RPGREACTOR_PLUGINS_DIR: engineDir }, cwd: () => projectDir },
            require: name => {
                if (name === 'fs') return fs;
                if (name === 'path') return path;
                return null;
            },
            document: {
                createElement: () => ({ type: '', src: '', async: false, _url: '' }),
                body: { appendChild: script => scripts.push(script) },
            },
        };
        context.window = context;
        vm.createContext(context);
        vm.runInContext(snippet, context);
        context.PluginManager.loadScript('Local.js');
        assert.strictEqual(scripts[0].src, 'js/plugins/Local.js');
        context.PluginManager.loadScript('Engine.js');
        const expected = encodeURI('file:///' + path.join(engineDir, 'Engine.js').replace(/\\/g, '/'));
        assert.strictEqual(scripts[1].src, expected);
        context.PluginManager.loadScript('Ghost.js');
        assert.strictEqual(scripts[2].src, 'js/plugins/Ghost.js');
    } finally {
        cleanupTemp(projectDir);
        cleanupTemp(engineDir);
    }
});

test('snippet re-execution is a no-op via the guard flag', () => {
    const snippet = extractSnippet();
    const projectDir = tempDir();
    try {
        const context = {
            window: null,
            PluginManager: { _path: 'js/plugins/', onError: function () { } },
            process: { env: {}, cwd: () => projectDir },
            require: () => null,
            document: {
                createElement: () => ({ type: '', src: '', async: false, _url: '' }),
                body: { appendChild: () => { } },
            },
        };
        context.window = context;
        vm.createContext(context);
        vm.runInContext(snippet, context);
        assert.strictEqual(context.PluginManager.__rpgReactorCatalogV2, true);
        const originalLoadScript = context.PluginManager.loadScript;
        vm.runInContext(snippet, context);
        assert.strictEqual(context.PluginManager.loadScript, originalLoadScript);
    } finally {
        cleanupTemp(projectDir);
    }
});

test('snippet bails out safely in environments without require', () => {
    const snippet = extractSnippet();
    const context = {
        window: null,
        PluginManager: { _path: 'js/plugins/', onError: function () { } },
        document: {
            createElement: () => ({ type: '', src: '', async: false, _url: '' }),
            body: { appendChild: () => { } },
        },
    };
    context.window = context;
    vm.createContext(context);
    assert.doesNotThrow(() => vm.runInContext(snippet, context));
    assert.strictEqual(context.PluginManager.__rpgReactorCatalogV2, true);
    // Without require at all the snippet returns before installing anything.
    assert.strictEqual(context.PluginManager.loadScript, undefined);
});
