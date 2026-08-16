// Agonia Engine - Database Manager
// Handles loading and managing all database JSON files

class DatabaseManager {
    static maximumEntries(dataKey) {
        const limits = globalThis.RR_LIMITS?.DATABASE_ENTRIES || {
            actors: 9999,
            classes: 9999,
            skills: 9999,
            items: 9999,
            weapons: 9999,
            armors: 9999,
            enemies: 9999,
            troops: 9999,
            states: 9999,
            animations: 1000,
            tilesets: 1000,
            commonEvents: 9999,
            elements: 512,
            skillTypes: 128,
            weaponTypes: 256,
            armorTypes: 256,
            equipTypes: 128
        };
        return limits[dataKey] || 0;
    }

    // Atomic write for project data: write a temp sibling then rename over
    // the destination, so a crash/kill/full-disk mid-write can never destroy
    // the previous good file. Falls back to a plain write when the fs
    // implementation has no renameSync (test mocks, web host shims).
    _writeFileAtomic(fs, filePath, data, options) {
        const atomic = (typeof window !== 'undefined' && window.RRWriteFileAtomicSync) || null;
        if (atomic && fs && typeof fs.renameSync === 'function') {
            atomic(fs, filePath, data, options);
        } else {
            fs.writeFileSync(filePath, data, options);
        }
    }

    constructor() {
        this.fs = null;
        this.path = null;
        this.projectPath = null;
        this.dataGeneration = 0;
        this.mutationGeneration = 0;
        this.savedState = {};
        const host = typeof window !== 'undefined' ? window.RPGReactorHost : null;
        if (host?.fs && host?.path) {
            this.fs = host.fs;
            this.path = host.path;
        }
        this.dataFiles = [
            ['actors', 'Actors.json'],
            ['classes', 'Classes.json'],
            ['skills', 'Skills.json'],
            ['items', 'Items.json'],
            ['weapons', 'Weapons.json'],
            ['armors', 'Armors.json'],
            ['enemies', 'Enemies.json'],
            ['troops', 'Troops.json'],
            ['states', 'States.json'],
            ['animations', 'Animations.json'],
            ['tilesets', 'Tilesets.json'],
            ['commonEvents', 'CommonEvents.json'],
            ['system', 'System.json']
        ];

        // Database storage
        this.data = {
            actors: [],
            classes: [],
            skills: [],
            items: [],
            weapons: [],
            armors: [],
            enemies: [],
            troops: [],
            states: [],
            animations: [],
            tilesets: [],
            commonEvents: [],
            system: null,
            mapInfos: [],
            // Per-tile 3D classification. Not one of the dataFiles: those are
            // the MZ database format, and this is ours, stored beside them.
            tileset3d: null,
            // Agonia Engine settings (data/AgoniaEngine.json): stamina etc.
            // Same sidecar pattern as tileset3d — never blocks the database.
            agonia: null
        };

        // Initialize Node.js modules if running in NW.js
        if (!this.fs && typeof nw !== 'undefined') {
            this.fs = require('fs');
            this.path = require('path');
        }
    }

    async _readJsonWithRetry(filePath, attempts = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < attempts; attempt++) {
            try {
                const content = this.fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
                return JSON.parse(content);
            } catch (error) {
                lastError = error;
                if (attempt + 1 < attempts && typeof setTimeout === 'function') {
                    await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
                }
            }
        }
        throw lastError;
    }

    async loadAllData(projectPath) {
        if (!this.fs || !this.path) {
            return false;
        }

        try {
            const dataPath = this.path.join(projectPath, 'data');
            const loaded = {};
            for (const [key, filename] of this.dataFiles) {
                loaded[key] = await this.loadJSON(dataPath, filename);
            }
            loaded.tileset3d = await this.loadTileset3D(projectPath);
            loaded.agonia = await this.loadAgonia(projectPath);
            Object.assign(this.data, loaded);
            this.projectPath = projectPath;
            this.dataGeneration++;
            this.mutationGeneration++;
            this.captureSavedState();

            return true;
        } catch (error) {
            console.error('Error loading database:', error);
            return false;
        }
    }

    async loadJSON(basePath, filename) {
        const filePath = this.path.join(basePath, filename);

        if (!this.fs.existsSync(filePath)) {
            return filename === 'System.json' ? {} : [];
        }

        try {
            return await this._readJsonWithRetry(filePath);
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
            throw new Error(`Could not parse ${filename}: ${error.message}`);
        }
    }

    serialize(data) {
        return JSON.stringify(data);
    }

    /**
     * The per-tile 3D classification module, when the page has loaded it.
     *
     * Absent in the web host and in tests that exercise the database alone, and
     * a project without classification behaves exactly as it did, so every
     * caller here treats a missing module as "nothing to do".
     */
    tileset3DClasses() {
        return (typeof globalThis !== 'undefined' && globalThis.RRTileset3DClass) || null;
    }

    /** The live classification store, created empty on first use. */
    getTileset3D() {
        const classes = this.tileset3DClasses();
        if (!classes) return null;
        if (!this.data.tileset3d) this.data.tileset3d = classes.create();
        return this.data.tileset3d;
    }

    async loadTileset3D(projectPath) {
        const classes = this.tileset3DClasses();
        if (!classes || !this.fs || !this.path) return null;
        const filePath = this.path.join(projectPath, 'data', classes.FILENAME);
        if (!this.fs.existsSync(filePath)) return classes.create();
        try {
            return classes.normalize(await this._readJsonWithRetry(filePath));
        } catch (error) {
            // A damaged sidecar must not stop the database from opening: the
            // runtime falls back to its flag heuristic for anything it cannot
            // read, so the cost is a worse-looking 3D map, not a dead editor.
            console.error(`Error loading ${classes.FILENAME}:`, error);
            return classes.create();
        }
    }

    async saveTileset3D(projectPath) {
        const classes = this.tileset3DClasses();
        if (!classes || !this.fs || !this.path) return true;
        const filePath = this.path.join(projectPath, 'data', classes.FILENAME);
        // A project that never classifies a tile gains no file. One that had
        // classes and then cleared them keeps an empty file rather than a stale
        // one — deleting a file the author may have in version control is not
        // this function's call to make.
        const store = this.data.tileset3d;
        if (classes.isEmpty(store) && !this.fs.existsSync(filePath)) {
            // Nothing to write, but the save still happened: without this the
            // baseline stays unset and the first classification never registers
            // as unsaved work.
            this.captureSavedState('tileset3d');
            return true;
        }
        try {
            this._writeFileAtomic(this.fs, filePath, JSON.stringify(classes.normalize(store)));
            this.captureSavedState('tileset3d');
            return true;
        } catch (error) {
            console.error(`Error saving ${classes.FILENAME}:`, error);
            return false;
        }
    }

    /**
     * Agonia Engine settings sidecar (data/AgoniaEngine.json).
     *
     * Shape: { stamina: { <plugin parameter name>: value, ... }, ...future }.
     * Section keys intentionally match the plugin parameter names so the
     * runtime can merge them straight into module parameters. Values use
     * natural JSON types (numbers, arrays); the runtime stringifies when
     * feeding PluginManager parameters.
     */
    static get AGONIA_FILENAME() {
        return 'AgoniaEngine.json';
    }

    static agoniaDefaults() {
        return {
            // Audio Studio section. Map Rules / Recent Tracks are stored as
            // JSON strings (object arrays must survive normalizeAgoniaValue,
            // which only passes numeric id lists through as arrays).
            audio: {
                'BGM Volume': 100,
                'BGS Volume': 100,
                'BGS2 Volume': 90,
                'BGS3 Volume': 90,
                'ME Volume': 100,
                'SE Volume': 100,
                'Map Rules': '[]',
                'Recent Tracks': '[]'
            },
            // Spriter keeps the three mapping collections in MV plugin format
            // (an array of JSON-object strings, itself serialized as a
            // string): the plugin's safeParseArray expects exactly that, so
            // the editor encodes/decodes on read/write instead of the
            // natural JSON arrays used by the other sections.
            // Battle/enemies/dash keep their databases in MV plugin format
            // (arrays of JSON-object strings, serialized as strings) - the
            // plugins' safeParseArray expects exactly that (see spriter).
            battle: {
                'Debug Mode': false,
                'Disable Mouse Move': false,
                'Melee List': '[]',
                'Projectile List': '[]',
                'Tracer List': '[]'
            },
            enemies: {
                'Optimization': true,
                'TickRate': 4,
                'VariableBaseId': 60,
                'HearingVariable': 0,
                'NoCombatSwitch': 0,
                'CombatCountVariable': 0,
                'GlobalResetSwitch': 0,
                'EnemyDatabase': '[]'
            },
            dash: {
                'Dash Active Switch': 0,
                'Collision Steps': 4,
                'Post-Dash Stun': 0,
                'Lock Direction': true,
                'Dash Tracking Switch ID': 0,
                'Dash Tracking Variable ID': 0,
                'Dash Database': '[]'
            },
            // Craft/hints/popup/loot/gifts keep their collections in MV
            // plugin format (see spriter); the plugins stay live - the DB
            // section feeds their parameters through the bridge merge.
            // UI Studio sections (S16): every screen's
            // tuning, defaults mirror the plugins' @default blocks.
            save: { "Enable Editor": true, "Max Slots": 10, "Fade In Duration": 60, "Intro Fade Out Duration": 60, "Fade Out Duration": 60, "BGM Volume": 90, "BGM Pitch": 100, "Rec X": 100, "Rec Y": 100, "Rec SE": "Save", "Rec SE Vol": 90, "Rec SE Pitch": 100, "Play X": 200, "Play Y": 100, "Play SE": "Load", "Play SE Vol": 90, "Play SE Pitch": 100, "Prev X": 100, "Prev Y": 200, "Prev SE": "Cursor1", "Prev SE Vol": 90, "Prev SE Pitch": 100, "Next X": 200, "Next Y": 200, "Next SE": "Cursor1", "Next SE Vol": 90, "Next SE Pitch": 100, "Stop X": 300, "Stop Y": 100, "Stop SE": "Cancel1", "Stop SE Vol": 90, "Stop SE Pitch": 100, "Back X": 300, "Back Y": 200, "Back SE": "Cancel2", "Back SE Vol": 90, "Back SE Pitch": 100, "Text X": 400, "Text Y": 150, "Text Font Size": 24, "Text Color": "#00ff00", "Diary X": 150, "Diary Y": 300, "Cassette X": 650, "Cassette Y": 300, "Cover X": 400, "Cover Y": 300, "Clip X": 200, "Clip Y": 100, "Snap X": 600, "Snap Y": 150, "Snap Width": 320, "Snap Height": 180, "Snap Quality": 70, "List X": 150, "List Y": 450, "List Width": 500, "List Visible": 5, "List Font Size": 22, "List Font Bold": true, "List Spacing": 10, "List Color": "#ffffff", "List Highlight Color": "#ffff00", "List Highlight Outline Color": "#000000", "List Highlight Outline Width": 4, "Scroll Sensitivity": 20, "List Select SE": "Cursor1", "List Select SE Vol": 90, "List Select SE Pitch": 100 },
            title: { "Animation Mode": "2", "Left & Right Input": true, "Com Fade-In Duration": 13, "Slide X-Axis": -100, "Slide Y-Axis": 0, "Smart Background": true, "Background X-Axis": 0, "Background Y-Axis": 0, "Background Fade-In Duration": 90, "Title Sprite": true, "Title Sprite X-Axis": "300", "Title Sprite Y-Axis": "150", "Fade-In Duration": 40, "Zoom Effect": true, "Zoom Speed": 40, "Cursor X-Axis": "0", "Cursor Y-Axis": "5", "Cursor Visible": true, "Cursor Wave Animation": true, "Cursor Rotation Animation": true, "Cursor Rotation Speed": "0.05", "Command Pos 1": "650,460", "Command Pos 2": "660,490", "Command Pos 3": "665,520", "Command Pos 4": "670,550", "Command Pos 5": "345,498", "Command Pos 6": "345,530", "Command Pos 7": "0,192", "Command Pos 8": "0,224", "Command Pos 9": "0,256", "Command Pos 10": "0,288" },
            splash: { "Enable Splash": true, "Splash Image": "MadeWithMv", "Logo Preset": "Action", "Static Sound": "Storm", "Power Off SE": "Laser", "Vignette Radius": 0.1, "Vignette Softness": 0, "Vignette Opacity": 1, "Phase 0 Time": 60, "Phase 1 Time": 60, "Phase 2 Time": 60, "Phase 3 Time": 150, "Phase 4 Time": 60 },
            gameover: { "Text Checkpoint": "Последняя контрольная точка", "Text SaveMenu": "Меню сохранений", "Text Title": "Главное меню", "Menu Y Offset": 60, "Cursor Sound File": "Cursor1", "Cursor Volume": 90, "Cursor Pitch": 100, "Ok Sound File": "Decision1", "Ok Volume": 90, "Ok Pitch": 100, "Buzzer Sound File": "Buzzer1", "Buzzer Volume": 90, "Buzzer Pitch": 100, "Static BGS": "Storm", "Max BGS Volume": 60, "Menu BGS Volume": 30, "Transition Time": 45, "Pre-phase Blackout": 255, "Hold Time": 20, "Shake Intensity": 20, "Background Opacity": 180, "Max Noise": 180, "Max Scanline": 60, "Max Chroma": 20 },
            message: { "Delay Time": 10, "Default Talk SE": "Cursor1,80,150", "Pause Time": 20, "Skip on RMB": false, "Skip on X": false, "Disable Move Route FF": false },
            choices: { "Gradient Align": "Right", "Gradient Width Percent": 50, "Gradient Solid Percent": 25, "Gradient Opacity": 0.85, "Frame Y Start": 0, "Frame Y End": 0, "Debug Mode": false, "Layout Mode": "Equidistant", "Max Visible": 6, "Choices Offset X": 0, "Choice Spacing": 70, "Symbol Active": "♦", "Symbol Inactive": "♢", "Symbol Color Active": "#ffaa00", "Symbol Color Inactive": "#888888", "Text Color Active": "#ffffff", "Text Color Inactive": "#cccccc", "Scale Active": 1.15, "Scale Inactive": 0.85, "Opacity Inactive": 120, "Shift X": 30, "Cursor SE Name": "Cursor1", "Cursor SE Volume": 90, "Cursor SE Pitch": 100, "Cursor SE Pan": 0, "Confirm SE Name": "Decision1", "Confirm SE Volume": 90, "Confirm SE Pitch": 100, "Confirm SE Pan": 0, "Cancel SE Name": "Cancel2", "Cancel SE Volume": 90, "Cancel SE Pitch": 100, "Cancel SE Pan": 0, "Wait Before": 0, "Wait After": 0, "Wheel Cooldown": 8 },
            settings: { "Enable Editor": true, "Fade Speed": 60, "Anim X": 400, "Anim Y": 300, "Frame Width": 48, "Frame Height": 48, "Total Frames": 18, "Anim Speed": 5, "Anim Scale": 1 },

            // World sections (S15-B): steps/variables/drop (one "Мир" tab)
            // and notifications (a block of the screen-text tab).
            steps: {
                'Base Step Interval': 25,
                'Events': true,
                'Max Hearing Distance': 8,
                'Volume Fade Type': 'linear',
                'Min Audible Volume': 20,
                'Player Speed Variable': 0,
                'Run Interval Mod': -5,
                'Run Volume Mod': 20,
                'Run Pitch Mod': 10,
                'Slow Interval Mod': 10,
                'Slow Volume Mod': -20,
                'Slow Pitch Mod': -10,
                'Terrain Configurations': '[]'
            },
            variables: {
                'Hand_MonitorVar': 1,
                'Hand_AutoZero': true,
                'Hand_States': '[]',
                'Reactor_Groups': '[]',
                'Decay_Variables': '[]',
                'AutoOff_Switches': '[]',
                'AutoOff_Variables': '[]',
                'Debug_Mode': false
            },
            drop: {
                'Drop Char File': '!Chest',
                'Drop Char Index': 0,
                'Drop Priority': 0,
                'Drop Step Anime': false,
                'Drop Walk Anime': false,
                'Drop Dir Fix': true,
                'Drop Radius': 1,
                'Icon Scale': 0.75,
                'Icon Y Offset': 0,
                'Icon Blink Min': 180,
                'Icon Blink Max': 255,
                'Icon Blink Period': 1,
                'Drop Sound': 'Equip1',
                'Drop Sound Vol': 90,
                'Drop Pickup Sound': 'Item3',
                'Drop Pickup Vol': 90,
                'Block Sound': 'Buzzer1',
                'Block Sound Vol': 80,
                'Pickup Delay': 30,
                'Stack Pickup Delay': 0,
                'Error Plugin Command': 'Hint show_preset default Инвентарь переполнен!'
            },
            notification: {
                'Monitored Variables': '[]',
                'Default X': 20,
                'Default Y': 20,
                'Spacing Y': 40,
                'Spawn Delay': 20,
                'Wait Time': 180,
                'Fade In Speed': 10,
                'Fade Out Speed': 10,
                'Slide In X': -30,
                'Slide In Y': 0,
                'Slide Out X': 30,
                'Slide Out Y': 0,
                'Slide Smoothness': 0.15
            },
            craft: {
                'Recipes': '[]',
                "Slot Size": 40,
                "Icon Offset X": 0,
                "Icon Offset Y": 0,
                "Hint Text": "ENTER - Создать | ESC - Выход | Клик по результату - Забрать",
                "Hint X": 0,
                "Hint Y": 60,
                "Hint Size": 18,
                "Hint 2 X": 0,
                "Hint 2 Y": 100,
                "Hint 2 Size": 18,
                "Preview Format": "Будет создано: %1",
                "Preview Color": "#FFFF00",
                "Preview X": 0,
                "Preview Y": 140,
                "Preview Size": 20,
                "Global Interact Sound": "Switch1",
                "Global Interact Volume": 90,
                "Error Sound": "Buzzer1",
                "Error Volume": 90,
                "Craft Sound": "Hammer",
                "Craft Volume": 90,
                "Pickup Sound": "Item1",
                "Pickup Volume": 90,
                "Open Sound": "Book2",
                "Open Volume": 90,
                "Close Sound": "Book2",
                "Close Volume": 90,
                "Slot 1 X": 300,
                "Slot 1 Y": 100,
                "Slot Spacing": 60,
                "Result Slot X": 550,
                "Result Slot Y": 100
            },
            hints: {
                'Presets': '[]',
                'Title Presets': '[]',
                'Default Animation Speed': 0.1,
                'Drop Distance': 60,
                'Hint Z-Index': 140,
                'Title Z-Index': 150
            },
            popup: {
                'Duration': 15,
                'Fade Speed': 5,
                'X - Axis': 0,
                'Y - Axis': -32,
                'Random Movement': false,
                'X Speed': 0,
                'Y Speed': 1,
                'Font Size': 16,
                'Icon Scale': 0.6,
                'Treasure Space Y-Axis': 20,
                'Zoom Effect': false,
                'Gold Popup': true,
                'Gold Icon Index': 163
            },
            loot: {
                'Categories': '[]'
            },
            gifts: {
                'Characters': '[]'
            },
            spriter: {
                'VariableId': 17,
                'EnablePoses': true,
                'ApplyToActor': true,
                'Debug': false,
                'SpriteMappings': '[]',
                'PoseMappings': '[]',
                'NPCMappings': '[]'
            },
            stamina: {
                'Max Stamina': 100,
                'Dash Speed Level': 5,
                'Horizontal Mult': 1,
                'Vertical Mult': 1,
                'Diagonal Mult': 1,
                'Drain Per Frame': 0.5,
                'Recover Per Frame': 0.4,
                'Dash Blocking Switches': [],
                'Max Stamina Variable ID': 0,
                'Regen Variable ID': 0,
                'Stamina Display Variable ID': 0,
                'Dash Control Switch ID': 0
            },
            lighting: {
                'Player radius': 150,
                'Default Tint': '#000000',
                'Player Light Influence': 1,
                'Breathing Speed': 0,
                'Vignette Color': '#000000',
                'Vignette Scale': 1,
                'Vignette Sharpness': 1,
                'Vignette Disable Switch': 0,
                'Use Real Shadows': false,
                'MapSwitch Base': 0,
                'MapSwitch Stride': 0,
                'Wall Softness': 1
            },
            camera: {
                'Зум по умолчанию': 2,
                'Зумить картинки': true,
                'Инерция': 0.18,
                'Сила предсказания': 0.35,
                'Макс. скорость': 0.25,
                'Ускорение камеры': 0.08,
                'Инерция скорости': 0.35,
                'Свитч отключения': 0,
                'Включить барьеры': true,
                'Активные регионы': 15,
                'Регионы слева': 11,
                'Регионы справа': 12,
                'Регионы сверху': 13,
                'Регионы снизу': 14,
                'Хард-точки по краям': true,
                'Ширина рамки': 960,
                'Высота рамки': 540,
                'Свитч прицеливания': 18,
                'Поворот за курсором': true,
                'Скорость прицеливания': 3,
                'Обычный курсор': 'cursor',
                'Курсор прицела': 'cursor aim',
                'Общее событие': 12,
                'Макс. сдвиг камеры': 90,
                'Плавность прицела': 0.3,
                'Возврат в центр': 60,
                'Свитч откл. сглаживания': 0
            },
            inventory: {
                'Open Trigger': 'key_i',
                'Custom Key Code': 73,
                'Use Key': 'e',
                'Disable Standard Menu': true,
                'RMB Variable ID': 17,
                'Hotbar Watch Var': 0,
                'Free Slots Variable': 12,
                'Max Slots Variable': 5,
                'Default Max Slots': 5,
                'Drag Threshold': 12,
                'Global Volume': 0
            },
            screen: {
                'Screen Width': 1280,
                'Screen Height': 720,
                'Fullscreen': true,
                'Window Title': '',
                'Enabled on Startup': true,
                'Overall Intensity': 0.1,
                'Blur Radius': 0.1,
                'Sharpening': 0.4,
                'Bloom Intensity': 0.5,
                'Bloom Threshold': 1,
                'Color Temperature': 0,
                'Saturation': 1,
                'Contrast': 1,
                'Brightness': 1,
                'Wave Intensity': 0.1,
                'Chroma Intensity': 0.5,
                'Scanline Intensity': 0.4,
                'Noise Intensity': 1.5
            }
        };
    }

    static normalizeAgoniaValue(value) {
        if (Array.isArray(value)) return value.map(Number).filter(n => !Number.isNaN(n));
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.startsWith('[')) {
                // MV plugin collections ('["{\\"Name\\":...}"]') are arrays of
                // JSON-object strings; only numeric id lists (Dash Blocking
                // Switches) normalize to number arrays, object collections
                // must survive verbatim for the plugin's safeParseArray.
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed) && parsed.length &&
                        parsed.every(item => typeof item === 'string' && item.trim().startsWith('{'))) {
                        return trimmed;
                    }
                    return this.normalizeAgoniaValue(parsed);
                } catch (e) { /* keep as string */ }
            }
            if (trimmed === 'true') return true;
            if (trimmed === 'false') return false;
            if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
        }
        return value;
    }

    static normalizeAgonia(config) {
        const defaults = this.agoniaDefaults();
        if (!config || typeof config !== 'object') return this.agoniaDefaults();
        const result = {};
        for (const section of Object.keys(defaults)) {
            result[section] = {};
            const source = config[section] && typeof config[section] === 'object' ? config[section] : {};
            for (const key of Object.keys(defaults[section])) {
                result[section][key] = this.normalizeAgoniaValue(source[key] !== undefined ? source[key] : defaults[section][key]);
            }
        }
        // Preserve unknown sections untouched for forward compatibility.
        for (const section of Object.keys(config)) {
            if (!(section in result)) result[section] = config[section];
        }
        return result;
    }

    /** Which engine module feeds which settings section. */
    static get AGONIA_SECTION_PLUGINS() {
        return {
            craft: 'SimpleCraftSystem',
            hints: 'SimpleCustomHints',
            popup: 'MOG_TreasurePopup',
            loot: 'SuperDuperLoot',
            gifts: 'SuperDuperGifts',
            steps: 'SuperDuperSteps',
            variables: 'SuperDuperVariables',
            drop: 'SuperDuperDrop',
            notification: 'SuperDuperNotification',
            save: 'SuperDuperSave',
            title: 'MOG_TitlePictureCom',
            splash: 'SuperDuperSplash',
            gameover: 'SuperDuperGameOver',
            message: 'SuperDuperMessage',
            choices: 'SuperDuperChoices',
            settings: 'SuperDuperSettings',
            battle: 'SuperDuperBattle',
            enemies: 'SuperDuperEnemies',
            dash: 'SuperDuperMovement_Addon',
            spriter: 'SuperDuperSpriter',
            stamina: 'SuperDuperMovement',
            lighting: 'SDLight',
            camera: 'SuperDuperCamera',
            inventory: 'SuperDuperInventory',
            screen: 'SuperDuperScreen'
        };
    }

    /**
     * Seed values for the AgoniaEngine.json sidecar when it does not exist
     * yet, so switching to database settings continues the game's current
     * tuning instead of resetting it. Source order:
     *   1. engineModules parameters in project.rpgreactor — after a plugin
     *      command migration the tuning lives here, NOT in the manifest
     *      (reading only the manifest seeded plain defaults and the runtime
     *      config merge then overrode the tuned module parameters —
     *      regression: wrong movement speed, shadows off, HUD variables 0)
     *   2. the plugin manifest (pre-migration projects)
     *   3. plain defaults
     */
    agoniaSeedValues(projectPath) {
        const defaults = this.constructor.agoniaDefaults();
        const sectionPlugins = this.constructor.AGONIA_SECTION_PLUGINS;
        const applyEntry = (entry) => {
            if (!entry || !entry.parameters) return;
            for (const [section, pluginName] of Object.entries(sectionPlugins)) {
                if (String(entry.name) !== pluginName) continue;
                for (const key of Object.keys(defaults[section])) {
                    if (entry.parameters[key] !== undefined) {
                        defaults[section][key] = this.constructor.normalizeAgoniaValue(entry.parameters[key]);
                    }
                }
            }
        };
        try {
            // 1. engineModules in project.rpgreactor
            const metaPath = this.path.join(projectPath, 'project.rpgreactor');
            let meta = null;
            if (this.fs.existsSync(metaPath)) {
                meta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
                for (const module of (Array.isArray(meta.engineModules) ? meta.engineModules : [])) {
                    applyEntry(module);
                }
            }
            // 2. plugin manifest (pre-migration projects; a plugin still in
            // the manifest wins only for sections its module didn't seed).
            const jsPath = this.path.join(projectPath, 'js');
            for (const manifest of ['reactor_plugins.js', 'plugins.js']) {
                const manifestPath = this.path.join(jsPath, manifest);
                if (!this.fs.existsSync(manifestPath)) continue;
                const text = this.fs.readFileSync(manifestPath, 'utf8');
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start < 0 || end <= start) break;
                for (const plugin of JSON.parse(text.slice(start, end + 1))) {
                    applyEntry(plugin);
                }
                break;
            }
            // 3. retired snapshots (retired plugins' live tuning lives ONLY
            // here - engineModules no longer carry it after retirement).
            try {
                const retired = Array.isArray(meta.retiredPlugins) ? meta.retiredPlugins : [];
                for (const rec of retired) applyEntry(rec);
            } catch (e) { /* unreadable retired list: defaults stand */ }
        } catch (e) {
            // Unreadable metadata: plain defaults are fine.
        }
        return defaults;
    }

    // Legacy alias kept for older callers.
    agoniaFromManifest(projectPath) {
        return this.agoniaSeedValues(projectPath);
    }

    async loadAgonia(projectPath) {
        if (!this.fs || !this.path) return this.constructor.agoniaDefaults();
        const filePath = this.path.join(projectPath, 'data', this.constructor.AGONIA_FILENAME);
        if (!this.fs.existsSync(filePath)) return this.agoniaSeedValues(projectPath);
        try {
            const raw = await this._readJsonWithRetry(filePath);
            const normalized = this.constructor.normalizeAgonia(raw);
            // Sections added after the sidecar was first written (e.g.
            // spriter) are absent from the file; normalize fills them with
            // plain defaults, which would hide the project's live tuning.
            // Seed just the missing sections from engineModules/manifest.
            for (const section of Object.keys(this.constructor.agoniaDefaults())) {
                if (raw && typeof raw === 'object' && (section in raw)) continue;
                const seeded = this.agoniaSeedValues(projectPath);
                if (seeded[section]) normalized[section] = seeded[section];
            }
            return normalized;
        } catch (error) {
            console.error(`Error loading ${this.constructor.AGONIA_FILENAME}:`, error);
            return this.agoniaSeedValues(projectPath);
        }
    }

    async saveAgonia(projectPath) {
        if (!this.fs || !this.path) return false;
        const filePath = this.path.join(projectPath, 'data', this.constructor.AGONIA_FILENAME);
        try {
            this._writeFileAtomic(this.fs, filePath,
                JSON.stringify(this.constructor.normalizeAgonia(this.data.agonia), null, 2) + '\n');
            this.captureSavedState('agonia');
            return true;
        } catch (error) {
            console.error(`Error saving ${this.constructor.AGONIA_FILENAME}:`, error);
            return false;
        }
    }

    captureSavedState(dataKey = null) {
        const entries = dataKey
            ? this.dataFiles.filter(([key]) => key === dataKey)
            : this.dataFiles;
        for (const [key] of entries) {
            this.savedState[key] = this.serialize(this.data[key]);
        }
        if (!dataKey || dataKey === 'tileset3d') {
            this.savedState.tileset3d = this.serialize(this.data.tileset3d || null);
        }
        if (!dataKey || dataKey === 'agonia') {
            this.savedState.agonia = this.serialize(this.data.agonia || null);
        }
    }

    getDirtyKeys() {
        const dirty = this.dataFiles
            .filter(([key]) => this.savedState[key] !== undefined && this.serialize(this.data[key]) !== this.savedState[key])
            .map(([key]) => key);
        // Classification lives outside dataFiles but is still unsaved work, and
        // the close-without-saving prompt reads this list.
        if (this.savedState.tileset3d !== undefined
            && this.serialize(this.data.tileset3d || null) !== this.savedState.tileset3d) {
            dirty.push('tileset3d');
        }
        if (this.savedState.agonia !== undefined
            && this.serialize(this.data.agonia || null) !== this.savedState.agonia) {
            dirty.push('agonia');
        }
        return dirty;
    }

    isDirty() {
        return this.getDirtyKeys().length > 0;
    }

    async saveJSON(projectPath, filename, data, options = {}) {
        if (!this.fs || !this.path) {
            return false;
        }

        try {
            const dataPath = this.path.join(projectPath, 'data');
            const filePath = this.path.join(dataPath, filename);

            // RPG Maker regenerates $dataSystem.versionId on every editor
            // save; the runtime's Scene_Load.reloadMapIfUpdated compares it
            // against the save file to force a fresh map setup when data
            // changed. Without the bump, loading a save made on an older
            // version of an edited map leaves the save's Game_Events
            // pointing at missing/renumbered $dataMap entries (per-frame
            // TypeError at map load — soft-lock).
            if (filename === 'System.json' && data) {
                data.versionId = DatabaseManager.newVersionId();
            }

            this._writeFileAtomic(this.fs, filePath, JSON.stringify(data, null, 2));
            const entry = this.dataFiles.find(([, file]) => file === filename);
            if (entry) this.captureSavedState(entry[0]);

            if (filename !== 'System.json' && !options.skipVersionBump && this.data && this.data.system) {
                this.data.system.versionId = DatabaseManager.newVersionId();
                const systemPath = this.path.join(dataPath, 'System.json');
                this._writeFileAtomic(this.fs, systemPath, JSON.stringify(this.data.system, null, 2));
                const systemEntry = this.dataFiles.find(([, file]) => file === 'System.json');
                if (systemEntry) this.captureSavedState(systemEntry[0]);
            }
            return true;
        } catch (error) {
            console.error(`Error saving ${filename}:`, error);
            return false;
        }
    }

    static newVersionId() {
        return Math.floor(Math.random() * 100000000);
    }

    // Helper methods to get specific data types
    getActors() {
        return this.data.actors.filter(a => a !== null);
    }

    getActor(id) {
        return this.data.actors[id] || null;
    }

    getClasses() {
        return this.data.classes.filter(c => c !== null);
    }

    getClass(id) {
        return this.data.classes[id] || null;
    }

    getSkills() {
        return this.data.skills.filter(s => s !== null);
    }

    getSkill(id) {
        return this.data.skills[id] || null;
    }

    getItems() {
        return this.data.items.filter(i => i !== null);
    }

    getItem(id) {
        return this.data.items[id] || null;
    }

    getWeapons() {
        return this.data.weapons.filter(w => w !== null);
    }

    getWeapon(id) {
        return this.data.weapons[id] || null;
    }

    getArmors() {
        return this.data.armors.filter(a => a !== null);
    }

    getArmor(id) {
        return this.data.armors[id] || null;
    }

    getEnemies() {
        return this.data.enemies.filter(e => e !== null);
    }

    getEnemy(id) {
        return this.data.enemies[id] || null;
    }

    getTroops() {
        return this.data.troops.filter(t => t !== null);
    }

    getTroop(id) {
        return this.data.troops[id] || null;
    }

    getStates() {
        return this.data.states.filter(s => s !== null);
    }

    getState(id) {
        return this.data.states[id] || null;
    }

    getAnimations() {
        return this.data.animations.filter(a => a !== null);
    }

    getAnimation(id) {
        return this.data.animations[id] || null;
    }

    getTilesets() {
        return this.data.tilesets.filter(t => t !== null);
    }

    getTileset(id) {
        return this.data.tilesets[id] || null;
    }

    getCommonEvents() {
        return this.data.commonEvents.filter(c => c !== null);
    }

    getCommonEvent(id) {
        return this.data.commonEvents[id] || null;
    }

    getSystem() {
        return this.data.system;
    }

    getMapInfos() {
        return this.data.mapInfos;
    }

    // Update methods
    updateActor(id, data) {
        this.data.actors[id] = data;
        this.mutationGeneration++;
    }

    updateClass(id, data) {
        this.data.classes[id] = data;
        this.mutationGeneration++;
    }

    updateSkill(id, data) {
        this.data.skills[id] = data;
        this.mutationGeneration++;
    }

    updateItem(id, data) {
        this.data.items[id] = data;
        this.mutationGeneration++;
    }

    updateWeapon(id, data) {
        this.data.weapons[id] = data;
        this.mutationGeneration++;
    }

    updateArmor(id, data) {
        this.data.armors[id] = data;
        this.mutationGeneration++;
    }

    updateEnemy(id, data) {
        this.data.enemies[id] = data;
        this.mutationGeneration++;
    }

    updateState(id, data) {
        this.data.states[id] = data;
        this.mutationGeneration++;
    }

    updateAnimation(id, data) {
        this.data.animations[id] = data;
        this.mutationGeneration++;
    }

    updateTroop(id, data) {
        this.data.troops[id] = data;
        this.mutationGeneration++;
    }

    updateTileset(id, data) {
        this.data.tilesets[id] = data;
        this.mutationGeneration++;
    }

    updateCommonEvent(id, data) {
        this.data.commonEvents[id] = data;
        this.mutationGeneration++;
    }

    addEntry(dataKey, template) {
        if (!this.data[dataKey]) return null;
        const maximum = this.getMaximumEntries(dataKey);
        if (!maximum || this.getMaxEntries(dataKey) >= maximum) return null;
        template.id = this.data[dataKey].length;
        this.data[dataKey].push(template);
        this.mutationGeneration++;
        return template;
    }

    deleteEntry(dataKey, id) {
        if (!this.data[dataKey]) return;
        this.data[dataKey][id] = null;
        this.mutationGeneration++;
    }

    /**
     * Get the current maximum count for a database type
     * (array length - 1, since index 0 is null)
     */
    getMaxEntries(dataKey) {
        if (!this.data[dataKey]) return 0;
        return Math.max(0, this.data[dataKey].length - 1);
    }

    getMaximumEntries(dataKey) {
        return DatabaseManager.maximumEntries(dataKey);
    }

    /**
     * Change the maximum number of entries for a database type.
     * If increasing, adds new default entries. If decreasing, truncates.
     * @param {string} dataKey - The database key (e.g. 'actors')
     * @param {number} newMax - The new maximum count
     * @param {object} template - Default template for new entries
     * @returns {boolean} Whether the operation succeeded
     */
    changeMaximum(dataKey, newMax, template) {
        if (!this.data[dataKey] || !Number.isInteger(newMax) || newMax < 1) return false;

        const currentMax = this.getMaxEntries(dataKey);
        const maximum = this.getMaximumEntries(dataKey);
        // Preserve imported projects that already exceed a stock limit, but
        // never let the editor grow them farther beyond it.
        if (!maximum || (newMax > maximum && newMax > currentMax)) return false;

        if (newMax > currentMax) {
            // Add new entries
            const serializedTemplate = JSON.stringify(template);
            for (let i = currentMax + 1; i <= newMax; i++) {
                const newEntry = JSON.parse(serializedTemplate);
                newEntry.id = i;
                newEntry.name = '';
                this.data[dataKey][i] = newEntry;
            }
        } else if (newMax < currentMax) {
            // Truncate array
            this.data[dataKey].length = newMax + 1;
        }

        if (newMax !== currentMax) this.mutationGeneration++;

        return true;
    }

    async saveAllData(projectPath) {
        if (!this.fs || !this.path) return false;

        const failed = [];
        for (const [key, filename] of this.dataFiles) {
            // System.json is part of dataFiles and gets its own fresh
            // versionId when its turn comes — skip the companion rewrite
            // that would otherwise re-save it after every other file.
            if (!await this.saveJSON(projectPath, filename, this.data[key], { skipVersionBump: true })) {
                failed.push(filename);
            }
        }
        if (!await this.saveTileset3D(projectPath)) {
            failed.push(this.tileset3DClasses()?.FILENAME || 'Tilesets.r3d.json');
        }
        if (!await this.saveAgonia(projectPath)) {
            failed.push('AgoniaEngine.json');
        }
        if (failed.length) console.error(`Failed to save database files: ${failed.join(', ')}`);
        return failed.length === 0;
    }
}
