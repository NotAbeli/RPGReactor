const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const editorRoot = path.resolve(__dirname, '..');
const rrEscapeHtml = require(path.join(editorRoot, 'src', 'utils', 'HtmlEscape.js'));

const USER_FIELDS = '(name|note|description|nickname|profile|message[1-4]|displayName)';
const SAFE = /rrEscapeHtml|escapeHTML|escapeHtml|HtmlEscape|_esc\(|_t\(|_tt\(|tt\(/;

// Interpolations of a property read off a data record, e.g. ${event.note}.
const USER_FIELD_READ = new RegExp('\\$\\{[^}]*\\b[a-zA-Z_]\\w*\\.' + USER_FIELDS + '\\b[^}]*\\}', 'g');

// Developer-authored schema text, not project data.
const STATIC_SCHEMA_ALLOWLIST = new Set(['meta.description']);

function sourceFiles() {
    const files = [];
    const walk = directory => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const full = path.join(directory, entry.name);
            // Generated character-part data, not markup.
            if (entry.isDirectory()) {
                if (full.includes(path.join('CharacterGenerator', 'styles'))) continue;
                walk(full);
            } else if (entry.name.endsWith('.js')) {
                files.push(full);
            }
        }
    };
    walk(path.join(editorRoot, 'src'));
    return files;
}

/** Bodies of every template literal assigned to innerHTML. */
function innerHtmlTemplates(text) {
    const bodies = [];
    const opener = /innerHTML\s*\+?=\s*`/g;
    let match;
    while ((match = opener.exec(text)) !== null) {
        let index = match.index + match[0].length;
        let depth = 0;
        while (index < text.length) {
            const char = text[index];
            if (char === '\\') { index += 2; continue; }
            if (char === '`' && depth === 0) break;
            if (text.startsWith('${', index)) { depth++; index += 2; continue; }
            if (char === '}' && depth > 0) depth--;
            index++;
        }
        bodies.push({ line: text.slice(0, match.index).split('\n').length, body: text.slice(match.index + match[0].length, index) });
    }
    return bodies;
}

test('the escape helper neutralises the characters that break out of markup', () => {
    assert.equal(rrEscapeHtml('"><img src=x onerror=alert(1)>'),
        '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(rrEscapeHtml('</textarea><script>1</script>'),
        '&lt;/textarea&gt;&lt;script&gt;1&lt;/script&gt;');
    assert.equal(rrEscapeHtml("O'Brien & Sons"), 'O&#39;Brien &amp; Sons');
    assert.equal(rrEscapeHtml(null), '');
    assert.equal(rrEscapeHtml(undefined), '');
    assert.equal(rrEscapeHtml(0), '0', 'a falsy-but-real value is preserved');
});

test('the event name and note are escaped before reaching innerHTML', () => {
    // These are project-authored and this window has Node enabled, so an
    // unescaped name from an imported project would run with full privileges.
    const source = fs.readFileSync(path.join(editorRoot, 'src', 'event', 'EventEditor.js'), 'utf8');
    assert.match(source, /value="\$\{rrEscapeHtml\(event\.name\)\}"/);
    assert.match(source, /\$\{rrEscapeHtml\(event\.note\)\}<\/textarea>/);
    assert.doesNotMatch(source, /value="\$\{event\.name \|\| ''\}"/);
    assert.doesNotMatch(source, /\$\{event\.note \|\| ''\}<\/textarea>/);
});

test('no innerHTML template interpolates a project-authored field unescaped', () => {
    const offenders = [];
    for (const file of sourceFiles()) {
        const text = fs.readFileSync(file, 'utf8');
        for (const { line, body } of innerHtmlTemplates(text)) {
            for (const fragment of body.match(USER_FIELD_READ) || []) {
                if (SAFE.test(fragment)) continue;
                const inner = fragment.slice(2, -1).trim();
                if (STATIC_SCHEMA_ALLOWLIST.has(inner)) continue;
                offenders.push(`${path.relative(editorRoot, file)}:~${line} ${fragment}`);
            }
        }
    }
    assert.deepEqual(offenders, [],
        `wrap these in rrEscapeHtml, or allowlist them if the value is developer-authored:\n${offenders.join('\n')}`);
});

test('the escape helper is loaded before anything that renders markup', () => {
    const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
    const helper = html.indexOf('src/utils/HtmlEscape.js');
    const eventEditor = html.indexOf('src/event/EventEditor.js');
    assert.ok(helper >= 0, 'the helper is loaded');
    assert.ok(eventEditor < 0 || helper < eventEditor, 'and loaded first');
});
