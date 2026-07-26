#!/usr/bin/env node
/**
 * Regenerates authored-data-shapes.json from the project corpus in template/.
 *
 * The corpus is authored by RPG Maker itself, which makes it the reference for
 * what a record or event command is supposed to look like. Most of those
 * projects are private and not committed, so the derived shapes are vendored
 * here instead and the tests read the vendored copy. Run this by hand after
 * adding a project to template/, then commit the JSON.
 *
 *   node editor/tests/helpers/derive-authored-data-shapes.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const templatesDir = path.join(repoRoot, 'template');
const outputPath = path.join(__dirname, 'authored-data-shapes.json');

const RECORD_FILES = {
    actors: 'Actors', classes: 'Classes', skills: 'Skills', items: 'Items',
    weapons: 'Weapons', armors: 'Armors', enemies: 'Enemies', troops: 'Troops',
    states: 'States', animations: 'Animations', tilesets: 'Tilesets',
    commonEvents: 'CommonEvents'
};

function projects() {
    if (!fs.existsSync(templatesDir)) return [];
    return fs.readdirSync(templatesDir)
        .filter(name => fs.existsSync(path.join(templatesDir, name, 'data')))
        .sort();
}

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function recordShapes(projectNames) {
    const shapes = {};
    for (const [type, dataFile] of Object.entries(RECORD_FILES)) {
        let sampled = 0;
        const counts = new Map();
        for (const project of projectNames) {
            const records = readJson(path.join(templatesDir, project, 'data', `${dataFile}.json`));
            if (!Array.isArray(records)) continue;
            for (const record of records) {
                if (!record || typeof record !== 'object') continue;
                sampled++;
                for (const field of Object.keys(record)) {
                    counts.set(field, (counts.get(field) || 0) + 1);
                }
            }
        }
        if (sampled === 0) continue;
        shapes[type] = {
            sampled,
            always: [...counts].filter(([field, n]) => n === sampled && field !== 'id')
                .map(([field]) => field).sort(),
            everSeen: [...counts.keys()].sort()
        };
    }
    return shapes;
}

function commandParameterLengths(projectNames) {
    const lengths = new Map();
    const visit = node => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (Number.isInteger(node.code) && Array.isArray(node.parameters)) {
            if (!lengths.has(node.code)) lengths.set(node.code, new Set());
            lengths.get(node.code).add(node.parameters.length);
        }
        Object.values(node).forEach(visit);
    };
    for (const project of projectNames) {
        const dataDir = path.join(templatesDir, project, 'data');
        for (const file of fs.readdirSync(dataDir).filter(name => name.endsWith('.json'))) {
            const parsed = readJson(path.join(dataDir, file));
            if (parsed) visit(parsed);
        }
    }
    const out = {};
    for (const code of [...lengths.keys()].sort((a, b) => a - b)) {
        out[code] = [...lengths.get(code)].sort((a, b) => a - b);
    }
    return out;
}

const projectNames = projects();
if (projectNames.length === 0) {
    console.error(`No projects found under ${templatesDir}; nothing to derive.`);
    process.exit(1);
}

const derived = {
    _provenance: {
        description: 'Field and parameter shapes observed in RPG Maker-authored project data. Regenerated with editor/tests/helpers/derive-authored-data-shapes.cjs.',
        projects: projectNames
    },
    records: recordShapes(projectNames),
    commandParameterLengths: commandParameterLengths(projectNames)
};

fs.writeFileSync(outputPath, `${JSON.stringify(derived, null, 1)}\n`);
console.log(`Wrote ${path.relative(repoRoot, outputPath)} from ${projectNames.length} project(s).`);
