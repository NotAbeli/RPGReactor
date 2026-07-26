const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(editorRoot, relative), 'utf8');
const controllerSource = read('src/ProjectController.js');
const mainSource = read('src/main.js');

/** The shipped title builder, lifted so the real rule is what runs. */
function titleBuilder() {
    const at = controllerSource.indexOf('    updateWindowTitle() {');
    assert.ok(at >= 0, 'updateWindowTitle exists');
    const body = controllerSource.slice(controllerSource.indexOf('{', at) + 1,
        controllerSource.indexOf('\n    }', at));
    // eslint-disable-next-line no-new-func
    return new Function('window', 'document', 'nw', 'ProjectController', `return (function(){${body}}).call(this);`);
}

function runTitle(state, { hasTitlebar = false } = {}) {
    const label = { textContent: 'RPG Reactor | Reactor One' };
    const doc = {
        title: '',
        querySelector: selector =>
            (hasTitlebar && selector === '#compat-titlebar .compat-titlebar-title') ? label : null
    };
    const controllerStatic = {
        updateCompatibilityTitlebar(title) {
            const found = doc.querySelector('#compat-titlebar .compat-titlebar-title');
            if (found) found.textContent = title;
        }
    };
    titleBuilder().call(state, undefined, doc, undefined, controllerStatic);
    return { documentTitle: doc.title, labelText: label.textContent };
}

const withProject = gameTitle => ({
    currentProject: { name: 'MyFolder' },
    databaseManager: { data: { system: { gameTitle } } }
});

test('the window title carries the open project name', () => {
    assert.equal(runTitle(withProject('Crystal Saga')).documentTitle, 'RPG Reactor | Crystal Saga');
    assert.equal(runTitle({ currentProject: null, databaseManager: { data: {} } }).documentTitle,
        'RPG Reactor');
});

test('the compat titlebar shows that same title, not a baked-in project name', () => {
    // Frameless compatibility mode (Wine/Proton) swaps the native titlebar for
    // our own. It was built with a literal "RPG Reactor | Reactor One" — the
    // bundled demo's name — and nothing ever wrote to it again, so every
    // project displayed the demo's title. Only packaged users on that path saw
    // it, which is why it did not reproduce in development.
    const result = runTitle(withProject('Crystal Saga'), { hasTitlebar: true });
    assert.equal(result.labelText, 'RPG Reactor | Crystal Saga');
    assert.equal(result.labelText, result.documentTitle, 'the two never diverge');
});

test('the titlebar follows a project switch', () => {
    assert.equal(runTitle(withProject('First Game'), { hasTitlebar: true }).labelText,
        'RPG Reactor | First Game');
    assert.equal(runTitle(withProject('Second Game'), { hasTitlebar: true }).labelText,
        'RPG Reactor | Second Game');
    assert.equal(runTitle({ currentProject: null, databaseManager: { data: {} } },
        { hasTitlebar: true }).labelText, 'RPG Reactor', 'and closing a project clears it');
});

test('no project name is hard-coded into the titlebar markup', () => {
    assert.doesNotMatch(mainSource, /compat-titlebar-title">RPG Reactor \| Reactor One/);
    assert.match(mainSource, /<div class="compat-titlebar-title"><\/div>/);
    assert.match(mainSource, /label\.textContent = document\.title \|\| 'RPG Reactor'/,
        'it is seeded from the live title at construction');
});

test('the title update reaches the titlebar on every refresh path', () => {
    assert.match(controllerSource, /ProjectController\.updateCompatibilityTitlebar\(title\);/);
    // Every caller of updateWindowTitle therefore updates the titlebar too.
    const callers = (controllerSource.match(/this\.updateWindowTitle\(\)/g) || []).length;
    assert.ok(callers >= 4, `project open/close/save paths all refresh it (${callers})`);
    assert.match(controllerSource, /rr-language-changed', \(\) => this\.updateWindowTitle\(\)/,
        'including a language change');
});

test('the titlebar only exists in the compatibility path it was built for', () => {
    assert.match(mainSource, /params\.get\('rrFrameless'\) === '1' \|\| params\.get\('rrWineFrame'\) === '0'/);
    assert.match(mainSource, /if \(framelessCompatibility\) \{[\s\S]{0,200}installCompatibilityTitlebar\(\)/,
        'a normal framed window keeps the native titlebar');
});
