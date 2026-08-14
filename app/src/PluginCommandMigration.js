/**
 * PluginCommandMigration - Converts legacy plugin-command event entries
 * (code 356/357) into engine-native event commands (codes 700+) and moves
 * the owning plugins from the project plugin manifest into the engine-modules
 * list in project.rpgreactor, so the plugins can be removed from the project
 * plugin list while all of their functionality keeps working.
 *
 * Pure data logic only: no DOM, no direct fs access. The editor and the CLI
 * wrapper (build-scripts/convert-plugin-commands.js) inject fs/path.
 */
class PluginCommandMigration {
    /**
     * Grammar table: ordered matchers over legacy code-356 strings.
     * Each entry: { plugin, match, parse(text) -> { code, parameters } | null }
     */
    static get GRAMMARS() {
        return [
            {
                plugin: 'SuperDuperInventory',
                match: /^(visualcheststored|visualchest|openchest)(\s+(.*))?$/i,
                parse: (m) => ({ code: 715, parameters: [(m[3] || '').trim()] })
            },
            {
                plugin: 'SuperDuperMovement',
                match: /^stamina\s+(add|fill|exhaust)(\s+(-?\d+(?:\.\d+)?))?$/i,
                parse: (m) => {
                    const sub = m[1].toLowerCase();
                    if (sub === 'fill') return { code: 725, parameters: [1, 0] };
                    if (sub === 'exhaust') return { code: 725, parameters: [2, 0] };
                    return { code: 725, parameters: [0, Number(m[3] || 0)] };
                }
            },
            {
                plugin: 'SuperDuperMovement_Addon',
                match: /^altimitdash\s+(playerdash|eventdash|dash)\s+(.+)$/i,
                parse: (m) => {
                    const sub = m[1].toLowerCase();
                    const rest = m[2].trim().split(/\s+/);
                    if (sub === 'playerdash') return { code: 726, parameters: [1, 0, rest[0]] };
                    if (sub === 'eventdash') return { code: 726, parameters: [2, Number(rest[0] || 0), rest.slice(1).join(' ')] };
                    return { code: 726, parameters: [0, 0, rest.join(' ')] };
                }
            },
            {
                plugin: 'WaitAsync',
                match: /^waitasync\s+(\d+)$/i,
                parse: (m) => ({ code: 730, parameters: [Number(m[1])] })
            },
            {
                plugin: 'SuperDuperDamageFlash',
                match: /^sddf\s+flash(\s+(.*))?$/i,
                parse: (m) => {
                    const rest = (m[2] || '').trim().split(/\s+/).filter(Boolean);
                    if (rest.length === 0) return { code: 731, parameters: [0, 0, 0] };
                    if (/^player$/i.test(rest[0])) return { code: 731, parameters: [1, 0, 0] };
                    if (/^event$/i.test(rest[0]) && rest.length >= 2) return { code: 731, parameters: [2, Number(rest[1]), 0] };
                    if (/^\d+$/.test(rest[0])) return { code: 731, parameters: [0, 0, Number(rest[0])] };
                    return null;
                }
            },
            {
                plugin: 'SuperDuperSamsara',
                match: /^(savetosamsara|loadfromsamsara)$/i,
                parse: (m) => ({
                    code: /^save/i.test(m[1]) ? 732 : 733,
                    parameters: []
                })
            },
            {
                plugin: 'SimpleCraftSystem',
                match: /^craftsystem\s+open$/i,
                parse: () => ({ code: 734, parameters: [] })
            },
            {
                plugin: 'SimpleCustomHints',
                match: /^hint\s+show_preset\s+(\S+)(\s+(.*))?$/i,
                parse: (m) => ({ code: 735, parameters: [m[1], (m[3] || '').trim()] })
            },
            {
                plugin: 'SimpleCustomHints',
                match: /^title\s+show\s+(\S+)(\s+(.*))?$/i,
                parse: (m) => ({ code: 737, parameters: [m[1], (m[3] || '').trim()] })
            },
            {
                plugin: 'SuperDuperMessage',
                match: /^mark\((.+)\)$/i,
                parse: (m) => ({ code: 736, parameters: [m[1].trim()] })
            },
            {
                plugin: 'SDLight',
                match: /^(light|fire)\s+(radius|radiusgrow)\s+(\d+)((?:\s+\S+)*)$/i,
                parse: (m) => {
                    const type = m[1].toLowerCase() === 'fire' ? 1 : 0;
                    const mode = m[2].toLowerCase() === 'radiusgrow' ? 1 : 0;
                    const radius = Number(m[3]);
                    let duration = 0;
                    let color = '';
                    let preset = '';
                    let mult = '';
                    for (const token of m[4].trim().split(/\s+/).filter(Boolean)) {
                        const tMatch = /^t(\d+)$/i.exec(token);
                        if (tMatch) { duration = Number(tMatch[1]); continue; }
                        if (!color && token.startsWith('#')) { color = token; continue; }
                        if (mult === '' && !Number.isNaN(Number(token))) { mult = Number(token); continue; }
                        if (!preset) preset = token;
                    }
                    return { code: 700, parameters: [type, radius, mode, duration, color, preset, mult] };
                }
            },
            {
                plugin: 'SDLight',
                match: /^light\s+(on|off)\s+(\d+)$/i,
                parse: (m) => ({ code: 701, parameters: [/^on$/i.test(m[1]) ? 1 : 0, Number(m[2])] })
            },
            {
                plugin: 'SDLight',
                match: /^regionblock\s+(\d+)\s+(on|off)(?:\s+(#\S+))?$/i,
                parse: (m) => ({
                    code: 702,
                    parameters: [Number(m[1]), /^on$/i.test(m[2]) ? 1 : 0, m[3] || '#000000']
                })
            },
            {
                plugin: 'SDLight',
                match: /^tint\s+(set|fade)\s+(#\S+)(?:\s+(\d+))?$/i,
                parse: (m) => ({
                    code: 703,
                    parameters: [/^fade$/i.test(m[1]) ? 1 : 0, m[2], Number(m[3] || 60)]
                })
            },
            {
                plugin: 'SDLight',
                match: /^localswitch\s+(\d+)\s+(on|off|toggle)(?:\s+map\s+(\d+)|\s+(\d+))?$/i,
                parse: (m) => {
                    const state = /^on$/i.test(m[2]) ? 1 : /^toggle$/i.test(m[2]) ? 2 : 0;
                    return { code: 704, parameters: [Number(m[1]), state, Number(m[3] || m[4] || 0)] };
                }
            },
            {
                plugin: 'SuperDuperLoot',
                match: /^sdl\s+give\s+(\S+)\s+(\d+)(?:-(\d+))?$/i,
                parse: (m) => ({
                    code: 720,
                    parameters: [m[1], Number(m[2]), Number(m[3] || m[2])]
                })
            },
            {
                // Dead command: handled by no plugin (left over from an old
                // lighting setup). The user opted to drop it on migration.
                plugin: 'SDLight',
                match: /^light\s+switch\s+reset$/i,
                parse: () => ({ remove: true })
            },
            {
                plugin: 'SuperDuperCamera',
                match: /^zoomin\s+([\d.[\]-]+(?:\s+[\d.[\]-]+)*)$/i,
                parse: (m) => {
                    const tokens = m[1].split(/\s+/);
                    return { code: 710, parameters: [PluginCommandMigration.unbracket(tokens[0]), PluginCommandMigration.unbracket(tokens[1] || 0), 0] };
                }
            },
            {
                plugin: 'SuperDuperCamera',
                match: /^zoomout\s+([\d.[\]-]+(?:\s+[\d.[\]-]+)*)$/i,
                parse: (m) => {
                    const tokens = m[1].split(/\s+/);
                    const divisor = PluginCommandMigration.unbracket(tokens[0]) || 1;
                    return { code: 710, parameters: [Math.round((1 / divisor) * 100) / 100, PluginCommandMigration.unbracket(tokens[1] || 0), 0] };
                }
            },
            {
                plugin: 'SuperDuperCamera',
                match: /^focuscamera\s+(.+)$/i,
                parse: (m) => {
                    const tokens = m[1].trim().split(/\s+/);
                    const head = tokens[0].toLowerCase();
                    const ub = PluginCommandMigration.unbracket.bind(PluginCommandMigration);
                    if (head === 'player') {
                        return { code: 711, parameters: [0, 0, 0, 0, ub(tokens[1] || 0), 0] };
                    }
                    if (head === 'event') {
                        return { code: 711, parameters: [1, ub(tokens[1] || 0), 0, 0, ub(tokens[2] || 0), 0] };
                    }
                    if (head === 'follower') return null; // no native equivalent yet
                    return { code: 711, parameters: [2, 0, ub(tokens[0]), ub(tokens[1] || 0), ub(tokens[2] || 0), 0] };
                }
            },
            {
                plugin: 'SuperDuperCamera',
                match: /^resetfocus(?:\s+(\[?\d+\]?))?$/i,
                parse: (m) => ({ code: 712, parameters: [PluginCommandMigration.unbracket(m[1] || 0)] })
            },
            {
                plugin: 'SuperDuperEnemies',
                match: /^mehp_(combat|panic|flee|alert|shot|loch|wound)_(start|end)(?:\s+self|\s+\d+)?$/i,
                parse: (m) => ({
                    code: 721,
                    parameters: [m[1].toLowerCase(), /^start$/i.test(m[2]) ? 1 : 0]
                })
            },
            {
                plugin: 'SuperDuperEnemies',
                match: /^mehp_calm_reset(?:\s+self|\s+\d+)?$/i,
                parse: () => ({ code: 721, parameters: ['__reset_all', 1] })
            },
            {
                plugin: 'SuperDuperEnemies',
                match: /^mehp_(combat|panic|flee|alert|shot|loch|wound)_all_(start|end)$/i,
                parse: (m) => ({
                    code: 723,
                    parameters: [m[1].toLowerCase(), /^start$/i.test(m[2]) ? 1 : 0]
                })
            },
            {
                plugin: 'SuperDuperEnemies',
                match: /^mehp_add(?:\s+self)?\s+(-?\d+)$/i,
                parse: (m) => ({ code: 722, parameters: [0, Number(m[1]), 0] })
            },
            {
                plugin: 'SuperDuperEnemies',
                match: /^mehp_set(?:\s+self)?\s+(-?\d+)$/i,
                parse: (m) => ({ code: 722, parameters: [1, Number(m[1]), 0] })
            },
            {
                plugin: 'SuperDuperEnemies',
                match: /^mehp_get(?:\s+self)?\s+(\d+)$/i,
                parse: (m) => ({ code: 722, parameters: [2, 0, Number(m[1])] })
            },
            {
                plugin: 'SuperDuperLoot',
                match: /^sdl\s+fillchest\s+(\S+)\s+(\S+)\s+(\d+)(?:-(\d+))?\s+(\d+)(?:\s+(\d+))?$/i,
                parse: (m) => ({
                    code: 724,
                    parameters: [m[1] === 'this' ? '' : m[1], m[2], Number(m[3]), Number(m[4] || m[3]), Number(m[5]), m[6] ? Number(m[6]) : '']
                })
            }
        ];
    }

    /** Legacy eval-convention "[N]" -> plain number. */
    static unbracket(value) {
        const n = Number(String(value).replace(/[[\]]/g, ""));
        return Number.isNaN(n) ? 0 : n;
    }

    /** Manifest plugin families this migrator can relocate to engine modules. */
    static get FAMILIES() {
        return [...new Set(this.GRAMMARS.map(g => g.plugin))];
    }

    /**
     * Parse a legacy 356 command string. Returns
     * { plugin, code, parameters } or null when not convertible.
     * pluginSet optionally restricts conversion to the given family names.
     */
    static parseLegacyCommand(text, pluginSet) {
        if (typeof text !== 'string') return null;
        const trimmed = text.trim();
        for (const grammar of this.GRAMMARS) {
            if (pluginSet && !pluginSet.has(grammar.plugin)) continue;
            const m = grammar.match.exec(trimmed);
            if (!m) continue;
            const parsed = grammar.parse(m);
            if (parsed) return { plugin: grammar.plugin, ...parsed };
        }
        return null;
    }

    /**
     * Convert one event command in place. Returns true when replaced.
     *   356: legacy MV string form, matched against the grammar table
     *   357: MZ structured form, SuperDuperInventory VisualChest/Stored
     */
    static convertCommand(command, pluginSet) {
        if (!command || typeof command.code !== 'number') return false;
        if (command.code === 356) {
            const parsed = this.parseLegacyCommand(String((command.parameters || [])[0] || ''), pluginSet);
            if (!parsed) return false;
            if (parsed.remove) return 'remove';
            command.code = parsed.code;
            command.parameters = parsed.parameters;
            return true;
        }
        if (command.code === 357) {
            if (pluginSet && !pluginSet.has('SuperDuperInventory')) return false;
            const params = command.parameters || [];
            const pluginName = String(params[0] || '');
            if (pluginName !== 'SuperDuperInventory') return false;
            const commandName = String(params[1] || '').toLowerCase();
            if (!['visualchest', 'visualcheststored'].includes(commandName)) return false;
            const args = params[3] || {};
            const chestId = String(args.name || args.chestId || '').trim();
            command.code = 715;
            command.parameters = [chestId];
            return true;
        }
        return false;
    }

    /**
     * Walk every event command list in a parsed data container and convert
     * matching commands in place. pluginSet optionally restricts families.
     */
    static convertDataContainer(container, pluginSet) {
        let converted = 0;
        let removed = 0;
        const visit = (value) => {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (Array.isArray(value.list)) {
                const removeAt = [];
                for (let i = 0; i < value.list.length; i++) {
                    const result = this.convertCommand(value.list[i], pluginSet);
                    if (result === 'remove') removeAt.push(i);
                    else if (result) converted++;
                }
                for (let i = removeAt.length - 1; i >= 0; i--) {
                    value.list.splice(removeAt[i], 1);
                    removed++;
                }
            }
            Object.values(value).forEach(v => { if (v && typeof v === 'object') visit(v); });
        };
        visit(container);
        return { converted, removed };
    }

    /**
     * Extract the $plugins array source from a manifest file text
     * (js/plugins.js / js/reactor_plugins.js). Returns the array text or null.
     */
    static extractManifestArray(text) {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start < 0 || end <= start) return null;
        return text.slice(start, end + 1);
    }

    /**
     * Build the engine-module entry for a plugin leaving the manifest.
     * orderBefore preserves the original load position (names of every
     * manifest entry that preceded it).
     */
    static buildEngineModuleEntry(plugins, pluginName) {
        const orderBefore = [];
        let parameters = {};
        for (const entry of plugins) {
            if (entry && String(entry.name) === pluginName) {
                parameters = entry.parameters || {};
                break;
            }
            if (entry && entry.name) orderBefore.push(String(entry.name));
        }
        return { name: pluginName, parameters, orderBefore };
    }

    /**
     * Full project conversion. options:
     *   fs, path           - injected node modules (required)
     *   projectPath        - absolute project directory (required)
     *   pluginNames        - families to relocate (default: all known)
     *   dryRun             - when true, nothing is written
     *   enginePluginsDir   - catalog dir recorded into project.rpgreactor
     *                        when the project lacks enginePluginsDir
     * Returns a report { ok, error, dryRun, backupPath, converted, skipped,
     * filesTouched, convertedByPlugin, movedPlugins, enginePluginsDirWritten }.
     */
    static applyToProject(options) {
        const { fs, path, projectPath } = options;
        const pluginNames = (Array.isArray(options.pluginNames) && options.pluginNames.length
            ? options.pluginNames : this.FAMILIES)
            .filter(name => this.FAMILIES.includes(name));
        const pluginSet = new Set(pluginNames);
        const report = {
            ok: false, error: null, dryRun: !!options.dryRun,
            backupPath: null, converted: 0, removed: 0, skipped: 0,
            filesTouched: {}, convertedByPlugin: {}, movedPlugins: []
        };
        if (!fs || !path || !projectPath) {
            report.error = 'fs, path and projectPath are required';
            return report;
        }

        try {
            const dataDir = path.join(projectPath, 'data');
            if (!fs.existsSync(dataDir)) {
                report.error = `data folder not found: ${dataDir}`;
                return report;
            }

            // Locate the plugin manifest (reactor or MV form).
            const jsDir = path.join(projectPath, 'js');
            const manifestCandidates = ['reactor_plugins.js', 'plugins.js'];
            let manifestPath = null;
            for (const candidate of manifestCandidates) {
                const full = path.join(jsDir, candidate);
                if (fs.existsSync(full)) { manifestPath = full; break; }
            }

            // Pass 1: scan and convert data files in memory.
            const pendingWrites = [];
            for (const file of fs.readdirSync(dataDir)) {
                if (!file.endsWith('.json')) continue;
                const full = path.join(dataDir, file);
                let json;
                try {
                    json = JSON.parse(fs.readFileSync(full, 'utf8'));
                } catch (e) {
                    report.skipped++;
                    continue;
                }
                const before = report.converted;
                const { converted, removed } = this.convertDataContainer(json, pluginSet);
                if (converted > 0 || removed > 0) {
                    report.converted += converted;
                    report.removed += removed;
                    report.filesTouched[file] = converted + removed;
                    pendingWrites.push({ full, json });
                    // Attribute conversions by rereading the new codes.
                    const byPlugin = {};
                    const visit = (value) => {
                        if (!value || typeof value !== 'object') return;
                        if (Array.isArray(value)) { value.forEach(visit); return; }
                        if (Array.isArray(value.list)) {
                            for (const command of value.list) {
                                if (typeof command.code === 'number' && command.code >= 700) {
                                    byPlugin[command.code] = (byPlugin[command.code] || 0) + 1;
                                }
                            }
                        }
                        Object.values(value).forEach(v => { if (v && typeof v === 'object') visit(v); });
                    };
                    visit(json);
                    report.convertedByPlugin[file] = byPlugin;
                    void before;
                }
            }

            // Pass 2: plan manifest + project.rpgreactor changes.
            let manifestText = null;
            let plugins = null;
            if (manifestPath) {
                manifestText = fs.readFileSync(manifestPath, 'utf8');
                const arrayText = this.extractManifestArray(manifestText);
                if (arrayText) {
                    try {
                        plugins = JSON.parse(arrayText);
                    } catch (e) {
                        plugins = null;
                    }
                }
            }

            const metaPath = path.join(projectPath, 'project.rpgreactor');
            let projectMeta = {};
            if (fs.existsSync(metaPath)) {
                projectMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
            }

            const modules = Array.isArray(projectMeta.engineModules) ? projectMeta.engineModules.slice() : [];
            const moduleNames = () => new Set(modules.map(m => m && String(m.name)));

            let manifestWrite = null;
            let metaWrite = null;
            let manifestChanged = false;

            if (Array.isArray(plugins)) {
                let kept = plugins.slice();
                for (const pluginName of pluginNames) {
                    const present = kept.some(p => p && String(p.name) === pluginName);
                    if (!present) continue;
                    if (!moduleNames().has(pluginName)) {
                        modules.push(this.buildEngineModuleEntry(plugins, pluginName));
                    }
                    kept = kept.filter(p => !(p && String(p.name) === pluginName));
                    report.movedPlugins.push(pluginName);
                    manifestChanged = true;
                }
                if (manifestChanged) {
                    const prefix = manifestText.slice(0, manifestText.indexOf('['));
                    manifestWrite = prefix + JSON.stringify(kept, null, 2) + ';\n';
                }
            }

            const needsEngineDir = !projectMeta.enginePluginsDir
                && options.enginePluginsDir
                && fs.existsSync(options.enginePluginsDir);
            if (needsEngineDir) projectMeta.enginePluginsDir = options.enginePluginsDir;

            if (manifestChanged || needsEngineDir
                || (modules.length !== (Array.isArray(projectMeta.engineModules) ? projectMeta.engineModules.length : 0))) {
                projectMeta.engineModules = modules;
                projectMeta.modified = new Date().toISOString();
                metaWrite = JSON.stringify(projectMeta, null, 2) + '\n';
            }

            const anythingToDo = pendingWrites.length > 0 || manifestWrite || metaWrite;
            if (options.dryRun || !anythingToDo) {
                report.ok = true;
                return report;
            }

            // Backup before writing: data/ + manifest + project.rpgreactor.
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
            const backupPath = path.join(projectPath, `engine-commands-backup-${stamp}`);
            fs.mkdirSync(backupPath, { recursive: true });
            const backupData = path.join(backupPath, 'data');
            fs.mkdirSync(backupData, { recursive: true });
            for (const write of pendingWrites) {
                fs.copyFileSync(write.full, path.join(backupData, path.basename(write.full)));
            }
            if (manifestPath && manifestWrite) fs.copyFileSync(manifestPath, path.join(backupPath, path.basename(manifestPath)));
            if (fs.existsSync(metaPath)) fs.copyFileSync(metaPath, path.join(backupPath, 'project.rpgreactor'));
            report.backupPath = backupPath;

            // Write results.
            for (const write of pendingWrites) {
                fs.writeFileSync(write.full, JSON.stringify(write.json), 'utf8');
            }
            if (manifestWrite && manifestPath) {
                fs.writeFileSync(manifestPath, manifestWrite, 'utf8');
            }
            if (metaWrite) {
                fs.writeFileSync(metaPath, metaWrite, 'utf8');
            }
            report.ok = true;
            return report;
        } catch (error) {
            report.error = error.message || String(error);
            return report;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginCommandMigration;
}
