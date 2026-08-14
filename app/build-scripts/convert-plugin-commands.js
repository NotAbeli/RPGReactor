#!/usr/bin/env node
/**
 * CLI wrapper for PluginCommandMigration.
 *
 *   node build-scripts/convert-plugin-commands.js <projectPath> [--dry-run] [--plugin <name>]
 *
 * Converts legacy plugin command event entries (code 356/357) into Agonia
 * Engine native commands (700+) and moves the owning plugins into the
 * engine-modules list of project.rpgreactor. Creates a timestamped backup
 * folder first. Idempotent: re-running performs zero changes.
 */
const fs = require('node:fs');
const path = require('node:path');
const PluginCommandMigration = require('../src/PluginCommandMigration.js');

function usage() {
    console.log('Usage: node build-scripts/convert-plugin-commands.js <projectPath> [--dry-run] [--plugin <name>]');
    console.log('  --plugin   relocate only this family (repeatable); default: all known families');
    console.log('  --dry-run  report what would change without writing');
    console.log(`  families   : ${PluginCommandMigration.FAMILIES.join(', ')}`);
}

function detectEnginePluginsDir() {
    // Dev repo layout: app/build-scripts/../plugins (the generated catalog).
    const candidate = path.join(__dirname, '..', 'plugins');
    return fs.existsSync(candidate) ? candidate : null;
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        usage();
        process.exit(1);
    }
    const positional = [];
    let dryRun = false;
    const pluginNames = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run') dryRun = true;
        else if (args[i] === '--plugin') pluginNames.push(args[++i]);
        else if (args[i] === '--help' || args[i] === '-h') { usage(); process.exit(0); }
        else positional.push(args[i]);
    }
    const projectPath = positional[0];
    if (!projectPath || !fs.existsSync(projectPath)) {
        console.error(`Project path not found: ${projectPath || '(missing)'}`);
        process.exit(1);
    }

    const report = PluginCommandMigration.applyToProject({
        fs, path, projectPath, dryRun,
        pluginNames: pluginNames.length ? pluginNames : undefined,
        enginePluginsDir: detectEnginePluginsDir()
    });

    if (!report.ok) {
        console.error(`Migration failed: ${report.error}`);
        process.exit(1);
    }
    const scope = pluginNames.length ? pluginNames.join(', ') : 'all families';
    console.log(`Plugin command migration (${scope})${report.dryRun ? ' [dry run]' : ''}`);
    console.log(`  converted commands : ${report.converted}`);
    if (report.removed > 0) console.log(`  removed (dead)     : ${report.removed}`);
    const files = Object.entries(report.filesTouched);
    if (files.length) {
        console.log(`  files touched      : ${files.length}`);
        for (const [file, count] of files.slice(0, 20)) console.log(`    ${file}: ${count}`);
        if (files.length > 20) console.log(`    ... and ${files.length - 20} more`);
    } else {
        console.log('  files touched      : 0');
    }
    console.log(`  plugins moved      : ${report.movedPlugins.length ? report.movedPlugins.join(', ') : 'none'}`);
    console.log(`  backup             : ${report.backupPath || '(nothing written)'}`);
    console.log(report.converted === 0 && !report.movedPlugins.length
        ? '  nothing to do (already migrated)' : '  done');
}

main();
