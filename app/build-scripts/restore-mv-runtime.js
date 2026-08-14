#!/usr/bin/env node
/**
 * Restores the RPG Maker MV corescript into a project from its
 * rpgmaker-runtime-backup.zip (created when the Agonia runtime was
 * installed), then re-patches js/rpg_managers.js with the RPGReactor
 * catalog + Agonia bridge snippet (v2) that:
 *   - merges project.rpgreactor engineModules into $plugins at setup time
 *   - applies data/AgoniaEngine.json settings over module parameters
 *   - installs the native 700+ event commands (MV implementations)
 *
 *   node build-scripts/restore-mv-runtime.js <projectPath> [--zip <path>]
 *
 * Idempotent: re-running extracts the same archive and re-applies the patch.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ProjectManager = require('../src/ProjectManager.js');

// Runtime files that belong to the Agonia (reactor) runtime only; the MV
// corescript does not reference them and the restored index.html does not
// load them. Removed so the two runtimes never share js/libs.
const REACTOR_ONLY_LIBS = [
    'effekseer.min.js', 'effekseer.wasm', 'localforage.min.js',
    'pako.min.js', 'three.js', 'vorbisdecoder.js', 'pixi_compat.js'
];

const SNIPPET_START = '// >>> RPGReactor: engine plugin catalog loader';
const SNIPPET_END = '// <<< RPGReactor: engine plugin catalog loader >>>';

function parseZip(buf) {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip archive (no end-of-central-directory)');
    const count = buf.readUInt16LE(eocd + 10);
    let off = buf.readUInt32LE(eocd + 16);
    const entries = [];
    for (let n = 0; n < count; n++) {
        if (buf.readUInt32LE(off) !== 0x02014b50) break;
        const method = buf.readUInt16LE(off + 10);
        const csize = buf.readUInt32LE(off + 20);
        const nameLen = buf.readUInt16LE(off + 28);
        const extraLen = buf.readUInt16LE(off + 30);
        const cmtLen = buf.readUInt16LE(off + 32);
        const lho = buf.readUInt32LE(off + 42);
        const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
        entries.push({ name, method, csize, lho });
        off += 46 + nameLen + extraLen + cmtLen;
    }
    return entries;
}

function extractEntry(buf, entry) {
    const nameLen = buf.readUInt16LE(entry.lho + 26);
    const extraLen = buf.readUInt16LE(entry.lho + 28);
    const dstart = entry.lho + 30 + nameLen + extraLen;
    const data = buf.slice(dstart, dstart + entry.csize);
    if (entry.method === 0) return Buffer.from(data);
    if (entry.method === 8) return zlib.inflateRawSync(data);
    throw new Error('unsupported zip compression method ' + entry.method + ' for ' + entry.name);
}

function unlinkSafe(fs, p) {
    try { fs.unlinkSync(p); return true; }
    catch (e) { try { fs.rmSync(p, { force: true }); return true; } catch (e2) { return false; } }
}

function restoreMvRuntime({ fs, path, projectPath, zipPath, snippet }) {
    const report = { ok: false, error: null, zipPath, extracted: 0, removed: [], patched: false };
    if (!fs || !path || !projectPath || !zipPath || !snippet) {
        report.error = 'fs, path, projectPath, zipPath and snippet are required';
        return report;
    }
    try {
        if (!fs.existsSync(zipPath)) {
            report.error = `archive not found: ${zipPath}`;
            return report;
        }
        const entries = parseZip(fs.readFileSync(zipPath));

        // 1. Extract the MV corescript (js/*, index.html) back into place.
        for (const entry of entries) {
            const target = path.join(projectPath, entry.name.replace(/\\/g, '/'));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, extractEntry(fs.readFileSync(zipPath), entry));
            report.extracted++;
        }

        // 2. Remove Agonia-runtime leftovers the MV corescript never loads.
        const jsPath = path.join(projectPath, 'js');
        if (fs.existsSync(jsPath)) {
            for (const file of fs.readdirSync(jsPath)) {
                if (/^reactor_.*\.js$/.test(file)) {
                    if (unlinkSafe(fs, path.join(jsPath, file))) report.removed.push('js/' + file);
                }
            }
            const libsPath = path.join(jsPath, 'libs');
            if (fs.existsSync(libsPath)) {
                for (const lib of REACTOR_ONLY_LIBS) {
                    if (fs.existsSync(path.join(libsPath, lib))) {
                        if (unlinkSafe(fs, path.join(libsPath, lib))) report.removed.push('js/libs/' + lib);
                    }
                }
            }
            const probe = path.join(jsPath, 'nwprobe.js');
            if (fs.existsSync(probe)) unlinkSafe(fs, probe);
        }

        // 3. Re-patch js/rpg_managers.js: strip any previous snippet block
        //    (v1 catalog-only or v2 bridge), then append the current one.
        const managersPath = path.join(projectPath, 'js', 'rpg_managers.js');
        let source = fs.readFileSync(managersPath, 'utf8');
        const strip = new RegExp(
            '\\s*//' + ' >>> RPGReactor: engine plugin catalog loader[^\\n]*\\n[\\s\\S]*?//' +
            ' <<< RPGReactor: engine plugin catalog loader >>>[^\\n]*\\n?', 'g'
        );
        source = source.replace(strip, '');
        if (!source.includes(SNIPPET_START)) {
            source = source.replace(/\s*$/, '') + '\n' + snippet.trim() + '\n';
            fs.writeFileSync(managersPath, source, 'utf8');
            report.patched = true;
        }

        report.ok = true;
        return report;
    } catch (error) {
        report.error = error.message || String(error);
        return report;
    }
}

function main() {
    const args = process.argv.slice(2);
    if (!args.length) {
        console.log('Usage: node build-scripts/restore-mv-runtime.js <projectPath> [--zip <path>]');
        process.exit(1);
    }
    const positional = [];
    let zipArg = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--zip') zipArg = args[++i];
        else positional.push(args[i]);
    }
    const projectPath = positional[0];
    if (!projectPath || !fs.existsSync(projectPath)) {
        console.error(`Project path not found: ${projectPath || '(missing)'}`);
        process.exit(1);
    }
    const zipPath = zipArg || path.join(projectPath, 'rpgmaker-runtime-backup.zip');
    const report = restoreMvRuntime({ fs, path, projectPath, zipPath, snippet: ProjectManager.MV_CATALOG_LOADER_SNIPPET });
    if (!report.ok) {
        console.error(`Restore failed: ${report.error}`);
        process.exit(1);
    }
    console.log('MV runtime restored');
    console.log(`  extracted files : ${report.extracted}`);
    console.log(`  removed         : ${report.removed.length ? report.removed.join(', ') : 'none'}`);
    console.log(`  bridge snippet  : ${report.patched ? 'applied (v2)' : 'already present'}`);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { restoreMvRuntime, parseZip, extractEntry, REACTOR_ONLY_LIBS };
}

if (require.main === module) main();
