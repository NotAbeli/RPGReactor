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
            },
            {
                // Dead since the original plugin was lost; restored natively
                // as command 740. The legacy slot argument is dropped.
                plugin: 'NastyTextPop',
                match: /^nastytextpop\s+(-?\d+)\s+\d+\s+(\d+)\s+(.+)$/i,
                parse: (m) => {
                    const targetId = Number(m[1]);
                    const mode = targetId === -1 ? -1 : 0;
                    return {
                        code: 740,
                        parameters: [mode, mode === -1 ? 0 : targetId, Number(m[2]),
                            m[3].replace(/\s+/g, ' ').trim()]
                    };
                }
            },
            {
                // Dead intro-slide setters (SDS = the lost intro plugin);
                // restored natively as commands 741-744.
                plugin: 'SDS_Intro',
                match: /^sds_settitle\s+(.+)$/i,
                parse: (m) => ({ code: 741, parameters: [m[1].trim()] })
            },
            {
                plugin: 'SDS_Intro',
                match: /^sds_settext\s+(.+)$/i,
                parse: (m) => ({ code: 742, parameters: [m[1].trim().replace(/^"+|"+$/g, '')] })
            },
            {
                plugin: 'SDS_Intro',
                match: /^sds_setface\s+(\S+)\s+(\d+)$/i,
                parse: (m) => ({ code: 743, parameters: [m[1], Number(m[2])] })
            },
            {
                plugin: 'SDS_Intro',
                match: /^sds_setbg\s+(\S+)$/i,
                parse: (m) => ({ code: 744, parameters: [m[1]] })
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
     * orderBefore preserves the original load position: names of every
     * loadable (status true) manifest entry that preceded it. Separator
     * rows and disabled plugins are skipped — anchoring on them later
     * pushes the module to the wrong position in the merged list.
     */
    static buildEngineModuleEntry(plugins, pluginName) {
        const orderBefore = [];
        let parameters = {};
        for (const entry of plugins) {
            if (entry && String(entry.name) === pluginName) {
                parameters = entry.parameters || {};
                break;
            }
            if (entry && entry.name && entry.status) orderBefore.push(String(entry.name));
        }
        return { name: pluginName, parameters, orderBefore };
    }

    /**
     * Rebuild data/AgoniaEngine.json from the project's live tuning:
     * engineModules parameters first, plugin manifest second, plain
     * defaults last. Repairs a sidecar that was seeded from the wrong
     * source (pre-migration manifest) and overrode tuned module parameters.
     */
    static reseedAgoniaConfig(options) {
        const { fs, path, projectPath } = options;
        const report = { ok: false, error: null, written: null, seeded: {} };
        if (!fs || !path || !projectPath) {
            report.error = 'fs, path and projectPath are required';
            return report;
        }
        try {
            const defaults = {
                stamina: {
                    'Max Stamina': 100, 'Dash Speed Level': 5, 'Horizontal Mult': 1,
                    'Vertical Mult': 1, 'Diagonal Mult': 1, 'Drain Per Frame': 0.5,
                    'Recover Per Frame': 0.4, 'Dash Blocking Switches': [],
                    'Max Stamina Variable ID': 0, 'Regen Variable ID': 0,
                    'Stamina Display Variable ID': 0, 'Dash Control Switch ID': 0
                },
                lighting: {
                    'Player radius': 150, 'Default Tint': '#000000',
                    'Player Light Influence': 1, 'Breathing Speed': 0,
                    'Vignette Color': '#000000', 'Vignette Scale': 1,
                    'Vignette Sharpness': 1, 'Vignette Disable Switch': 0,
                    'Use Real Shadows': false, 'MapSwitch Base': 0,
                    'MapSwitch Stride': 0, 'Wall Softness': 1
                },
                camera: {
                    'Зум по умолчанию': 2, 'Зумить картинки': true,
                    'Инерция': 0.18, 'Сила предсказания': 0.35, 'Макс. скорость': 0.25,
                    'Ускорение камеры': 0.08, 'Инерция скорости': 0.35, 'Свитч отключения': 0,
                    'Включить барьеры': true, 'Активные регионы': 15,
                    'Регионы слева': 11, 'Регионы справа': 12,
                    'Регионы сверху': 13, 'Регионы снизу': 14, 'Хард-точки по краям': true,
                    'Ширина рамки': 960, 'Высота рамки': 540,
                    'Свитч прицеливания': 18, 'Поворот за курсором': true,
                    'Скорость прицеливания': 3, 'Обычный курсор': 'cursor',
                    'Курсор прицела': 'cursor aim', 'Общее событие': 12,
                    'Макс. сдвиг камеры': 90, 'Плавность прицела': 0.3,
                    'Возврат в центр': 60, 'Свитч откл. сглаживания': 0
                },
                inventory: {
                    'Open Trigger': 'key_i', 'Custom Key Code': 73, 'Use Key': 'e',
                    'Disable Standard Menu': true, 'RMB Variable ID': 17,
                    'Hotbar Watch Var': 0, 'Free Slots Variable': 12,
                    'Max Slots Variable': 5, 'Default Max Slots': 5,
                    'Drag Threshold': 12, 'Global Volume': 0
                },
                screen: {
                    'Screen Width': 1280, 'Screen Height': 720, 'Enabled on Startup': true,
                    'Overall Intensity': 0.1, 'Blur Radius': 0.1, 'Sharpening': 0.4,
                    'Bloom Intensity': 0.5, 'Bloom Threshold': 1, 'Color Temperature': 0,
                    'Saturation': 1, 'Contrast': 1, 'Brightness': 1,
                    'Wave Intensity': 0.1, 'Chroma Intensity': 0.5,
                    'Scanline Intensity': 0.4, 'Noise Intensity': 1.5
                }
            };
            const sectionPlugins = {
                stamina: 'SuperDuperMovement',
                lighting: 'SDLight',
                camera: 'SuperDuperCamera',
                inventory: 'SuperDuperInventory',
                screen: 'SuperDuperScreen'
            };
            const normalize = (value) => {
                if (Array.isArray(value)) return value.map(Number).filter(n => !Number.isNaN(n));
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed.startsWith('[')) {
                        try { return normalize(JSON.parse(trimmed)); } catch (e) { /* keep string */ }
                    }
                    if (trimmed === 'true') return true;
                    if (trimmed === 'false') return false;
                    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
                }
                return value;
            };
            const applyEntry = (entry, source) => {
                if (!entry || !entry.parameters) return;
                for (const [section, pluginName] of Object.entries(sectionPlugins)) {
                    if (String(entry.name) !== pluginName) continue;
                    report.seeded[section] = source;
                    for (const key of Object.keys(defaults[section])) {
                        if (entry.parameters[key] !== undefined) {
                            defaults[section][key] = normalize(entry.parameters[key]);
                        }
                    }
                }
            };
            const metaPath = path.join(projectPath, 'project.rpgreactor');
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
                for (const module of (Array.isArray(meta.engineModules) ? meta.engineModules : [])) {
                    applyEntry(module, 'engineModules');
                }
            }
            const jsPath = path.join(projectPath, 'js');
            for (const manifest of ['reactor_plugins.js', 'plugins.js']) {
                const manifestPath = path.join(jsPath, manifest);
                if (!fs.existsSync(manifestPath)) continue;
                const text = fs.readFileSync(manifestPath, 'utf8');
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start < 0 || end <= start) break;
                for (const plugin of JSON.parse(text.slice(start, end + 1))) {
                    applyEntry(plugin, 'manifest');
                }
                break;
            }
            const target = path.join(projectPath, 'data', 'AgoniaEngine.json');
            let backup = null;
            if (fs.existsSync(target)) {
                backup = target + '.bak';
                fs.copyFileSync(target, backup);
            }
            fs.mkdirSync(path.join(projectPath, 'data'), { recursive: true });
            fs.writeFileSync(target, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
            report.ok = true;
            report.written = target;
            report.backup = backup;
            return report;
        } catch (error) {
            report.error = error.message || String(error);
            return report;
        }
    }

    /**
     * Compute the exact runtime load order for a project: manifest entries
     * merged with engineModules using the same anchoring rules as
     * PluginManager.mergeEngineModules (only loadable entries anchor).
     * Used by --print-order to verify order without launching the game.
     */
    static computeLoadOrder(options) {
        const { fs, path, projectPath } = options;
        const report = { ok: false, error: null, names: [] };
        if (!fs || !path || !projectPath) {
            report.error = 'fs, path and projectPath are required';
            return report;
        }
        try {
            const jsPath = path.join(projectPath, 'js');
            let manifestPath = null;
            for (const candidate of ['reactor_plugins.js', 'plugins.js']) {
                const full = path.join(jsPath, candidate);
                if (fs.existsSync(full)) { manifestPath = full; break; }
            }
            const plugins = [];
            if (manifestPath) {
                const text = fs.readFileSync(manifestPath, 'utf8');
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start >= 0 && end > start) {
                    plugins.push(...JSON.parse(text.slice(start, end + 1)));
                }
            }
            const metaPath = path.join(projectPath, 'project.rpgreactor');
            let modules = [];
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
                modules = Array.isArray(meta.engineModules) ? meta.engineModules : [];
            }
            // Mirror PluginManager.mergeEngineModules, including the
            // dependency-order pass over pending modules (canonical
            // orderBefore prefixes order them even with an empty manifest).
            const present = new Set(plugins.map(p => p && String(p.name)));
            const pending = modules.filter(m => m && m.name && !present.has(String(m.name)));
            const merged = plugins.slice();
            const pendingNames = new Set(pending.map(m => String(m.name)));
            const pendingDeps = new Map();
            for (const module of pending) {
                const orderBefore = Array.isArray(module.orderBefore)
                    ? module.orderBefore.map(String) : [];
                pendingDeps.set(module, orderBefore.filter(n => pendingNames.has(n)).length);
            }
            const sorted = pending.slice().sort((a, b) => (pendingDeps.get(a) || 0) - (pendingDeps.get(b) || 0));
            for (const module of sorted) {
                const orderBefore = Array.isArray(module.orderBefore)
                    ? module.orderBefore.map(String) : [];
                let insertAt = 0;
                for (let i = 0; i < merged.length; i++) {
                    if (merged[i] && merged[i].status && orderBefore.includes(String(merged[i].name))) {
                        insertAt = i + 1;
                    }
                }
                merged.splice(insertAt, 0, { name: module.name, status: true, parameters: module.parameters || {} });
            }
            report.names = merged.filter(p => p && p.status && p.name).map(p => String(p.name));
            report.ok = true;
            return report;
        } catch (error) {
            report.error = error.message || String(error);
            return report;
        }
    }

    /**
     * Move EVERY remaining manifest plugin into the project config:
     * enabled ones -> engineModules (with full parameters and load order),
     * disabled ones -> disabledPlugins (name + parameters, not loaded).
     * After this the plugin manifest is empty and every plugin setting
     * lives in project.rpgreactor under version control.
     */
    static harvestAllPlugins(options) {
        const { fs, path, projectPath } = options;
        const report = {
            ok: false, error: null, manifestPath: null, backupPath: null,
            moved: [], disabled: [], manifestWritten: false
        };
        if (!fs || !path || !projectPath) {
            report.error = 'fs, path and projectPath are required';
            return report;
        }
        try {
            const jsPath = path.join(projectPath, 'js');
            let manifestPath = null;
            for (const candidate of ['reactor_plugins.js', 'plugins.js']) {
                const full = path.join(jsPath, candidate);
                if (fs.existsSync(full)) { manifestPath = full; break; }
            }
            if (!manifestPath) {
                report.error = 'plugin manifest not found (js/plugins.js / js/reactor_plugins.js)';
                return report;
            }
            report.manifestPath = manifestPath;
            const manifestText = fs.readFileSync(manifestPath, 'utf8');
            const start = manifestText.indexOf('[');
            const end = manifestText.lastIndexOf(']');
            if (start < 0 || end <= start) {
                report.error = 'manifest does not contain a $plugins array';
                return report;
            }
            const plugins = JSON.parse(manifestText.slice(start, end + 1));
            if (!Array.isArray(plugins) || plugins.length === 0) {
                report.error = 'manifest is already empty — nothing to harvest';
                return report;
            }

            const metaPath = path.join(projectPath, 'project.rpgreactor');
            let projectMeta = {};
            if (fs.existsSync(metaPath)) {
                projectMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
            }
            const modules = Array.isArray(projectMeta.engineModules) ? projectMeta.engineModules : [];
            const moduleNames = new Set(modules.map(m => m && String(m.name)));
            const disabled = Array.isArray(projectMeta.disabledPlugins) ? projectMeta.disabledPlugins.slice() : [];
            const disabledNames = new Set(disabled.map(d => d && String(d.name)));

            // Normalize every module's orderBefore against the canonical
            // original order: separators and disabled plugins removed, and
            // modules ordered by their position in the ORIGINAL manifest
            // (the merged engineModules list may have accumulated in
            // migration order, which differs).
            const canonical = [];
            for (const entry of plugins) {
                if (entry && entry.name && entry.status && !/^-+$/.test(String(entry.name))) {
                    canonical.push(String(entry.name));
                }
            }
            const moduleByName = new Map(modules.map(m => [String(m.name), m]));
            for (const name of canonical) {
                if (!moduleNames.has(name)) {
                    modules.push(this.buildEngineModuleEntry(plugins, name));
                    moduleNames.add(name);
                }
            }
            // Reorder the whole engineModules list to match the canonical
            // original order; unknown modules keep their relative position
            // at the end.
            const rank = new Map(canonical.map((name, i) => [name, i]));
            modules.sort((a, b) => {
                const ra = rank.has(String(a.name)) ? rank.get(String(a.name)) : canonical.length;
                const rb = rank.has(String(b.name)) ? rank.get(String(b.name)) : canonical.length;
                if (ra !== rb) return ra - rb;
                return 0;
            });
            // Rewrite orderBefore for every module from the canonical order.
            for (let i = 0; i < modules.length; i++) {
                modules[i].orderBefore = canonical.slice(0, rank.has(String(modules[i].name))
                    ? rank.get(String(modules[i].name)) : canonical.length);
            }

            for (const entry of plugins) {
                if (!entry || !entry.name) continue;
                const name = String(entry.name);
                // Separator rows ("------") are manifest cosmetics, not plugins.
                if (/^-+$/.test(name)) continue;
                if (entry.status) {
                    report.moved.push(name);
                } else {
                    if (!disabledNames.has(name)) {
                        disabled.push({ name, parameters: entry.parameters || {} });
                        disabledNames.add(name);
                    }
                    report.disabled.push(name);
                }
            }

            projectMeta.engineModules = modules;
            projectMeta.disabledPlugins = disabled;
            projectMeta.modified = new Date().toISOString();

            // Backup, then write both files.
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
            const backupPath = path.join(projectPath, `manifest-harvest-backup-${stamp}`);
            fs.mkdirSync(backupPath, { recursive: true });
            fs.copyFileSync(manifestPath, path.join(backupPath, path.basename(manifestPath)));
            if (fs.existsSync(metaPath)) fs.copyFileSync(metaPath, path.join(backupPath, 'project.rpgreactor'));
            report.backupPath = backupPath;

            fs.writeFileSync(metaPath, JSON.stringify(projectMeta, null, 2) + '\n', 'utf8');
            const prefix = manifestText.slice(0, start);
            fs.writeFileSync(manifestPath, prefix + '[];\n', 'utf8');
            report.manifestWritten = true;
            report.ok = true;
            return report;
        } catch (error) {
            report.error = error.message || String(error);
            return report;
        }
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
