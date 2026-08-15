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
    console.log('Usage: node build-scripts/convert-plugin-commands.js <projectPath> [options]');
    console.log('  --plugin          relocate only this family (repeatable); default: all known families');
    console.log('  --dry-run         report what would change without writing');
    console.log('  --reseed-agonia   rebuild data/AgoniaEngine.json from live tuning (engineModules, then manifest); backs up the old file');
    console.log('  --harvest-all     move every remaining manifest plugin into project.rpgreactor (enabled -> engineModules, disabled -> disabledPlugins) and empty the manifest');
    console.log('  --print-order     print the runtime plugin load order without launching the game');
    console.log('  --retire <a,b>    retire engine modules into retiredPlugins (full parameter snapshot; for plugins replaced by engine system modules)');
    console.log('  --restore-retired <a,b>  bring retired plugins back at their canonical positions with their exact tuning');
    console.log('  --reason <text>   retirement note recorded next to the snapshot');
    console.log(`  families          : ${PluginCommandMigration.FAMILIES.join(', ')}`);
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
    let reseedAgonia = false;
    let harvestAll = false;
    let printOrder = false;
    let retireArg = null;
    let restoreArg = null;
    let reasonArg = null;
    const pluginNames = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run') dryRun = true;
        else if (args[i] === '--reseed-agonia') reseedAgonia = true;
        else if (args[i] === '--harvest-all') harvestAll = true;
        else if (args[i] === '--print-order') printOrder = true;
        else if (args[i] === '--retire') retireArg = args[++i];
        else if (args[i] === '--restore-retired') restoreArg = args[++i];
        else if (args[i] === '--reason') reasonArg = args[++i];
        else if (args[i] === '--plugin') pluginNames.push(args[++i]);
        else if (args[i] === '--help' || args[i] === '-h') { usage(); process.exit(0); }
        else positional.push(args[i]);
    }
    const projectPath = positional[0];
    if (!projectPath || !fs.existsSync(projectPath)) {
        console.error(`Project path not found: ${projectPath || '(missing)'}`);
        process.exit(1);
    }

    if (reseedAgonia) {
        const report = PluginCommandMigration.reseedAgoniaConfig({ fs, path, projectPath });
        if (!report.ok) {
            console.error(`Reseed failed: ${report.error}`);
            process.exit(1);
        }
        console.log('AgoniaEngine.json reseeded');
        console.log(`  stamina source : ${report.seeded.stamina || 'defaults'}`);
        console.log(`  lighting source: ${report.seeded.lighting || 'defaults'}`);
        console.log(`  written        : ${report.written}`);
        if (report.backup) console.log(`  backup         : ${report.backup}`);
        process.exit(0);
    }

    if (retireArg !== null) {
        const names = retireArg.split(',').map(s => s.trim()).filter(Boolean);
        const report = PluginCommandMigration.retirePlugins({
            fs, path, projectPath, names,
            reason: reasonArg || 'replaced by an engine system module'
        });
        if (!report.ok) {
            console.error(`Retire failed: ${report.error}`);
            if (report.notFound && report.notFound.length) console.error('  not found: ' + report.notFound.join(', '));
            process.exit(1);
        }
        console.log('Engine modules retired');
        console.log(`  retired : ${report.retired.join(', ')}`);
        if (report.notFound.length) console.log(`  missing : ${report.notFound.join(', ')}`);
        console.log(`  restore : node build-scripts/convert-plugin-commands.js <project> --restore-retired "${report.retired.join(',')}"`);
        process.exit(0);
    }

    if (restoreArg !== null) {
        const names = restoreArg.split(',').map(s => s.trim()).filter(Boolean);
        const report = PluginCommandMigration.restoreRetired({ fs, path, projectPath, names });
        if (!report.ok) {
            console.error(`Restore failed: ${report.error}`);
            process.exit(1);
        }
        console.log('Retired plugins restored');
        console.log(`  restored : ${report.restored.join(', ')}`);
        if (report.notFound.length) console.log(`  missing  : ${report.notFound.join(', ')}`);
        process.exit(0);
    }

    if (harvestAll) {
        const report = PluginCommandMigration.harvestAllPlugins({ fs, path, projectPath });
        if (!report.ok) {
            console.error(`Harvest failed: ${report.error}`);
            process.exit(1);
        }
        console.log('Plugin harvest complete');
        console.log(`  moved to engineModules : ${report.moved.length}${report.moved.length ? ' (' + report.moved.join(', ') + ')' : ''}`);
        console.log(`  saved as disabled      : ${report.disabled.length}${report.disabled.length ? ' (' + report.disabled.join(', ') + ')' : ''}`);
        console.log(`  manifest emptied       : ${report.manifestPath}`);
        console.log(`  backup                 : ${report.backupPath}`);
        process.exit(0);
    }

    if (printOrder) {
        const order = PluginCommandMigration.computeLoadOrder({ fs, path, projectPath });
        if (!order.ok) {
            console.error(`Failed: ${order.error}`);
            process.exit(1);
        }
        console.log(`Runtime load order (${order.names.length} plugins):`);
        order.names.forEach((name, i) => console.log(`  ${String(i).padStart(2)} ${name}`));
        process.exit(0);
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
