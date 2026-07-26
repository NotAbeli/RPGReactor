const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');

/**
 * Everything the repository tracks. A file that exists only on the author's
 * disk works locally and is absent for everyone else, which is the failure this
 * whole file is about — it is invisible until someone clones.
 */
function trackedFiles() {
    const output = execFileSync('git', ['ls-files', '-z'], {
        cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
    });
    return new Set(output.split('\0').filter(Boolean));
}

/** Local `src`/`href` targets of a document, as repo-relative paths. */
function localReferences(documentPath) {
    const source = fs.readFileSync(path.join(repoRoot, documentPath), 'utf8');
    const base = path.posix.dirname(documentPath);
    return [...source.matchAll(/(?:src|href)="([^"?#]+)"/g)]
        .map(match => match[1])
        .filter(reference => !/^(?:[a-z]+:|\/\/|#)/i.test(reference))
        .map(reference => ({ reference, repoPath: path.posix.normalize(path.posix.join(base, reference)) }));
}

const tracked = trackedFiles();

for (const documentPath of ['editor/index.html', 'template/Demo/index.html']) {
    test(`${documentPath}: every referenced file exists`, () => {
        const missing = localReferences(documentPath)
            .filter(entry => !fs.existsSync(path.join(repoRoot, entry.repoPath)))
            .map(entry => entry.reference);
        assert.deepEqual(missing, [], `referenced but absent:\n${missing.join('\n')}`);
    });

    test(`${documentPath}: every referenced file is committed`, () => {
        // A script tag pointing at an untracked file loads fine for whoever
        // wrote it and 404s for everyone else. For the editor that is a broken
        // window; for the Demo the loader stalls on the spinner forever.
        const untracked = localReferences(documentPath)
            .filter(entry => fs.existsSync(path.join(repoRoot, entry.repoPath)))
            .filter(entry => !tracked.has(entry.repoPath))
            .map(entry => entry.reference);
        assert.deepEqual(untracked, [],
            `present locally but never committed — git add these:\n${untracked.join('\n')}`);
    });
}

test('the reference scan actually finds the scripts it is meant to guard', () => {
    // A regex that silently matched nothing would make both checks vacuous.
    const editorRefs = localReferences('editor/index.html');
    assert.ok(editorRefs.length > 100, `editor/index.html references (${editorRefs.length})`);
    const scripts = editorRefs.filter(entry => entry.repoPath.endsWith('.js'));
    assert.ok(scripts.length > 100, `and most of them are scripts (${scripts.length})`);
    assert.ok(scripts.some(entry => entry.repoPath === 'editor/src/main.js'),
        'including the entry point');

    const demoRefs = localReferences('template/Demo/index.html');
    assert.ok(demoRefs.length >= 3, `Demo references (${demoRefs.length})`);
});

test('an untracked file would be reported rather than passed over', () => {
    const untrackedName = 'editor/src/__not_a_real_file_for_this_test__.js';
    assert.equal(tracked.has(untrackedName), false);
    // The check keys on set membership, so anything absent from git ls-files
    // fails it — the two assertions above only pass because the tree is clean.
    assert.ok(tracked.has('editor/src/main.js'), 'and a committed file is recognised');
});
