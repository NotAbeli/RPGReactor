#!/usr/bin/env node
/**
 * Regenerate `runtime/libs/three.js` from the installed `three` package.
 *
 * The runtime loads its libraries as classic <script> tags, but three ships
 * only ESM and CommonJS builds. `three.cjs` is a single self-contained bundle
 * with no `require()` calls, so wrapping it in an IIFE that supplies a local
 * `module`/`exports` and assigns the result to `window.THREE` produces a
 * classic script without a bundler in the toolchain.
 *
 * The output is committed, the way `runtime/libs/pixi.js` is. The npm package
 * exists to record provenance and to regenerate this file; the game never
 * loads from node_modules.
 *
 * Usage: node build-scripts/vendor-three.js
 */
const fs = require('node:fs');
const path = require('node:path');

const editorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(editorRoot, '..');

const packageJsonPath = path.join(editorRoot, 'node_modules', 'three', 'package.json');
const sourcePath = path.join(editorRoot, 'node_modules', 'three', 'build', 'three.cjs');
const outputPath = path.join(repoRoot, 'runtime', 'libs', 'three.js');

if (!fs.existsSync(sourcePath)) {
    console.error(`three is not installed: ${sourcePath} is missing.\nRun "npm install" in editor/ first.`);
    process.exit(1);
}

const version = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
const source = fs.readFileSync(sourcePath, 'utf8');

// A stray require() would silently become a ReferenceError in the browser, so
// refuse rather than ship a bundle that only fails at runtime.
const requires = source.match(/\brequire\s*\(/g);
if (requires) {
    console.error(`three.cjs contains ${requires.length} require() call(s); it is no longer self-contained.`);
    process.exit(1);
}

const banner = `/**
 * three.js r${version.replace(/^0\./, '')} (npm three@${version}) — MIT.
 * Copyright 2010-2026 Three.js Authors. See THIRD_PARTY_NOTICES.md.
 *
 * GENERATED FILE — do not edit. Regenerate with:
 *   node editor/build-scripts/vendor-three.js
 *
 * three publishes ESM and CommonJS only; the runtime loads classic scripts.
 * The upstream CommonJS bundle is self-contained, so it is wrapped here with a
 * local module/exports and published as window.THREE.
 */
(function (root) {
    const module = { exports: {} };
    const exports = module.exports;
`;

const footer = `
    root.THREE = module.exports;
})(typeof globalThis !== 'undefined' ? globalThis : window);
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, banner + source + footer, 'utf8');

const kb = (fs.statSync(outputPath).size / 1024).toFixed(0);
console.log(`Wrote ${path.relative(repoRoot, outputPath)} from three@${version} (${kb} KB)`);
