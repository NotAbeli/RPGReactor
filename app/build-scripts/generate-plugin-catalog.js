// One-off import: builds app/plugins/catalog.json from the plugin sources.
// Usage: node build-scripts/generate-plugin-catalog.js
const fs = require('node:fs');
const path = require('node:path');

const pluginsDir = path.join(__dirname, '..', 'plugins');
const catalogPath = path.join(pluginsDir, 'catalog.json');

function parsePlugindesc(source) {
    const m = source.match(/@plugindesc\s+(\[[^\]]*\]\s*)?([^\r\n]*)/);
    if (!m) return { version: '', description: '' };
    const bracket = (m[1] || '').trim();
    const description = (m[2] || '').trim();
    let version = '';
    const vm = bracket.match(/\[v?([0-9][0-9.]*)\]/i);
    if (vm) {
        version = vm[1];
    } else {
        const vm2 = description.match(/\bv?([0-9]+\.[0-9]+(?:\.[0-9]+)?)\b/i);
        if (vm2) version = vm2[1];
    }
    return { version, description };
}

const entries = fs.readdirSync(pluginsDir)
    .filter(name => name.endsWith('.js'))
    .sort()
    .map(file => {
        const source = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
        const meta = parsePlugindesc(source);
        const authorM = source.match(/@author\s+([^\r\n]*)/);
        return {
            name: file.replace(/\.js$/, ''),
            file,
            version: meta.version,
            author: authorM ? authorM[1].trim() : '',
            description: meta.description
        };
    });

fs.writeFileSync(catalogPath, JSON.stringify({ engine: 'agonia', plugins: entries }, null, 2) + '\n');
console.log(`Catalog written: ${entries.length} plugins -> ${catalogPath}`);
