// Agonia Engine - Project Manager
// Handles project creation, loading, and saving

class ProjectManager {
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
        this.lastLoadError = null;
        this.lastCreateError = null;

        const host = typeof window !== 'undefined' ? window.RPGReactorHost : null;
        if (host?.fs && host?.path) {
            this.fs = host.fs;
            this.path = host.path;
        }

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

        const error = new Error(`Could not read ${this.path.basename(filePath)}: ${lastError?.message || lastError}`);
        error.code = lastError?.code;
        error.filePath = filePath;
        throw error;
    }

    getEngineVersion() {
        if (typeof window !== 'undefined' && window.RPGReactorHost?.version) {
            return window.RPGReactorHost.version;
        }
        if (!this.fs || !this.path || typeof process === 'undefined') {
            return '0.0.0';
        }

        try {
            const packagePath = this.path.join(process.cwd(), 'package.json');
            const packageData = JSON.parse(this.fs.readFileSync(packagePath, 'utf8'));
            return packageData.version || '0.0.0';
        } catch (error) {
            console.warn('Could not read Agonia Engine version from package.json:', error);
            return '0.0.0';
        }
    }

    async createNewProject(targetPath, projectName) {
        this.lastCreateError = null;
        if (!this.fs || !this.path) {
            console.error('File system not available');
            this.lastCreateError = 'File system not available';
            return false;
        }

        try {
            if (!this.isSafeProjectName(projectName)) {
                throw new Error('Project name must be a safe single folder name.');
            }
            const resolvedTarget = this.path.resolve(targetPath);

            console.log(`Creating new project: ${projectName} at ${targetPath}`);

            const engineVersion = this.getEngineVersion();
            const templatePath = this.getTemplateProjectPath();
            const runtimePath = this.getRuntimePath();

            if (this.fs.existsSync(resolvedTarget)) {
                const stat = this.fs.lstatSync ? this.fs.lstatSync(resolvedTarget) : this.fs.statSync(resolvedTarget);
                if (!stat.isDirectory() || stat.isSymbolicLink?.()) {
                    throw new Error('Project target must be an ordinary directory.');
                }
                if (this.fs.readdirSync(resolvedTarget).length > 0) {
                    throw new Error('Project target already exists and is not empty.');
                }
            } else {
                this.fs.mkdirSync(resolvedTarget);
            }
            targetPath = resolvedTarget;

            if (templatePath) {
                await this.copyDirectory(templatePath, targetPath);
                if (runtimePath) {
                    await this.copyRuntimeIntoProject(runtimePath, this.path.join(targetPath, 'js'), true);
                }
                this.updateCopiedTemplateProject(targetPath, projectName, engineVersion);
            } else {
                if (!runtimePath) {
                    console.error('Runtime corescript directory not found. Expected runtime/ beside the editor source.');
                    console.error('Current working directory:', process.cwd());
                    return false;
                }

                await this.createStarterProject(targetPath, projectName, engineVersion, runtimePath);
                this.writeProjectMetadata(targetPath, projectName, engineVersion);
            }

            console.log('Project created successfully!');
            return true;
        } catch (error) {
            console.error('Error creating project:', error);
            this.lastCreateError = error.message || String(error);
            return false;
        }
    }

    isSafeProjectName(projectName) {
        if (typeof projectName !== 'string' || !projectName || projectName !== projectName.trim()) return false;
        if (projectName === '.' || projectName === '..' || /[\\/\0-\x1f]/.test(projectName)) return false;
        if (/[. ]$/.test(projectName)) return false;
        return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(projectName);
    }

    async copyDirectory(source, target) {
        if (!this.fs || !this.path) return;

        // Create target directory
        if (!this.fs.existsSync(target)) {
            this.fs.mkdirSync(target, { recursive: true });
        }

        // Read source directory
        const files = this.fs.readdirSync(source);

        for (const file of files) {
            const sourcePath = this.path.join(source, file);
            const targetPath = this.path.join(target, file);
            const stat = this.fs.statSync(sourcePath);

            if (stat.isDirectory()) {
                // Recursively copy subdirectories
                await this.copyDirectory(sourcePath, targetPath);
            } else {
                // Copy file
                this.fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }

    async copyRuntimeIntoProject(runtimePath, jsPath, preservePluginConfig = false) {
        if (!this.fs.existsSync(jsPath)) this.fs.mkdirSync(jsPath, { recursive: true });
        for (const entry of this.fs.readdirSync(runtimePath, { withFileTypes: true })) {
            if (preservePluginConfig && entry.name === 'reactor_plugins.js') continue;
            const sourcePath = this.path.join(runtimePath, entry.name);
            const targetPath = this.path.join(jsPath, entry.name);
            if (entry.isDirectory()) {
                await this.copyDirectory(sourcePath, targetPath);
            } else {
                this.fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }

    writeZipArchive(zipPath, entries) {
        const zlib = require('zlib');
        const Buffer = require('buffer').Buffer;
        const now = new Date();
        const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
        const dosDate = ((Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
        const localParts = [];
        const centralParts = [];
        let offset = 0;
        for (const entry of entries) {
            const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
            const data = entry.data;
            const deflated = zlib.deflateRawSync(data);
            const method = deflated.length < data.length ? 8 : 0;
            const compressed = method === 8 ? deflated : data;
            const crc = this.crc32(data);
            const local = Buffer.alloc(30);
            local.writeUInt32LE(0x04034b50, 0);
            local.writeUInt16LE(20, 4);
            local.writeUInt16LE(0x0800, 6); // UTF-8 file names
            local.writeUInt16LE(method, 8);
            local.writeUInt16LE(dosTime, 10);
            local.writeUInt16LE(dosDate, 12);
            local.writeUInt32LE(crc, 14);
            local.writeUInt32LE(compressed.length, 18);
            local.writeUInt32LE(data.length, 22);
            local.writeUInt16LE(name.length, 26);
            localParts.push(local, name, compressed);
            const central = Buffer.alloc(46);
            central.writeUInt32LE(0x02014b50, 0);
            central.writeUInt16LE(20, 4);
            central.writeUInt16LE(20, 6);
            central.writeUInt16LE(0x0800, 8);
            central.writeUInt16LE(method, 10);
            central.writeUInt16LE(dosTime, 12);
            central.writeUInt16LE(dosDate, 14);
            central.writeUInt32LE(crc, 16);
            central.writeUInt32LE(compressed.length, 20);
            central.writeUInt32LE(data.length, 24);
            central.writeUInt16LE(name.length, 28);
            central.writeUInt32LE(offset, 42);
            centralParts.push(central, name);
            offset += 30 + name.length + compressed.length;
        }
        const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(entries.length, 8);
        eocd.writeUInt16LE(entries.length, 10);
        eocd.writeUInt32LE(centralSize, 12);
        eocd.writeUInt32LE(offset, 16);
        this.fs.writeFileSync(zipPath, Buffer.concat([...localParts, ...centralParts, eocd]));
    }

    collectRpgMakerRuntimeFiles(projectPath) {
        const jsPath = this.path.join(projectPath, 'js');
        const files = [];
        if (!this.fs.existsSync(jsPath)) return files;
        for (const entry of this.fs.readdirSync(jsPath, { withFileTypes: true })) {
            if (entry.isFile() && (entry.name === 'main.js' || /^(rmmz|rpg)_[\w.-]*\.js$/.test(entry.name))) {
                files.push(this.path.join('js', entry.name));
            }
        }
        // No corescript means nothing to quarantine: an already-converted
        // project's js/libs belongs to the Reactor runtime and stays put.
        if (!files.length) return files;
        const addLibs = (dir, rel) => {
            if (!this.fs.existsSync(dir)) return;
            for (const entry of this.fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = this.path.join(dir, entry.name);
                const relPath = this.path.join(rel, entry.name);
                if (entry.isDirectory()) addLibs(fullPath, relPath);
                else files.push(relPath);
            }
        };
        addLibs(this.path.join(jsPath, 'libs'), this.path.join('js', 'libs'));
        return files;
    }

    removeEmptyDirs(dir) {
        if (!this.fs.existsSync(dir)) return;
        for (const entry of this.fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) this.removeEmptyDirs(this.path.join(dir, entry.name));
        }
        if (!this.fs.readdirSync(dir).length) this.fs.rmdirSync(dir);
    }

    async installReactorRuntime(projectPath, projectName, options = {}) {
        const tt = text => (typeof window !== 'undefined' && window.I18n) ? window.I18n.tText(text) : text;
        if (!this.fs || !this.path) {
            return { ok: false, error: tt('File system not available.') };
        }
        const runtimePath = this.getRuntimePath();
        if (!runtimePath) {
            return { ok: false, error: tt('Runtime corescript directory not found. Expected runtime/ beside the editor.') };
        }

        try {
            const displayName = projectName || this.path.basename(projectPath);
            const packageResult = this.ensureProjectPackageMetadata(projectPath, displayName);
            if (!packageResult.ok) return packageResult;

            const jsPath = this.path.join(projectPath, 'js');
            const indexPath = this.path.join(projectPath, 'index.html');
            let indexUsesReactor = false;
            if (this.fs.existsSync(indexPath)) {
                indexUsesReactor = /js\/reactor_main\.js/.test(this.fs.readFileSync(indexPath, 'utf8'));
            }

            // Quarantine the RPG Maker corescript into a zip in the project
            // root so the two runtimes never share js/. Deploy staging
            // excludes the archive.
            const oldRuntimeFiles = this.collectRpgMakerRuntimeFiles(projectPath);
            let archivedTo = null;
            if (oldRuntimeFiles.length) {
                const archiveEntries = oldRuntimeFiles.map(relPath => ({
                    name: relPath.split(this.path.sep).join('/'),
                    data: this.fs.readFileSync(this.path.join(projectPath, relPath)),
                }));
                if (!indexUsesReactor && this.fs.existsSync(indexPath)) {
                    archiveEntries.push({ name: 'index.html', data: this.fs.readFileSync(indexPath) });
                }
                let zipName = 'rpgmaker-runtime-backup.zip';
                for (let counter = 2; this.fs.existsSync(this.path.join(projectPath, zipName)); counter++) {
                    zipName = `rpgmaker-runtime-backup-${counter}.zip`;
                }
                this.writeZipArchive(this.path.join(projectPath, zipName), archiveEntries);
                for (const relPath of oldRuntimeFiles) {
                    // unlinkSync, not rmSync: on Windows rmSync may leave the
                    // file listed (POSIX delete-pending) while other handles
                    // (editor/AV watchers) are open. unlinkSync deletes for real.
                    const filePath = this.path.join(projectPath, relPath);
                    try {
                        this.fs.unlinkSync(filePath);
                    } catch (unlinkError) {
                        try {
                            this.fs.rmSync(filePath, { force: true });
                        } catch (rmError) {
                            throw unlinkError;
                        }
                    }
                }
                this.removeEmptyDirs(this.path.join(jsPath, 'libs'));
                archivedTo = zipName;
            }

            await this.copyRuntimeIntoProject(runtimePath, jsPath, true);

            // Seed the Reactor plugin manifest from the project's RPG Maker
            // manifest so an imported plugin configuration keeps working.
            const reactorManifest = this.path.join(jsPath, 'reactor_plugins.js');
            const rpgMakerManifest = this.path.join(jsPath, 'plugins.js');
            if (!this.fs.existsSync(reactorManifest) || options.regenerateManifest) {
                if (this.fs.existsSync(rpgMakerManifest)) {
                    this.fs.copyFileSync(rpgMakerManifest, reactorManifest);
                } else if (!this.fs.existsSync(reactorManifest)) {
                    this.writeText(reactorManifest, 'var $plugins = [];\n');
                }
            }

            if (!indexUsesReactor) {
                const isMvProject = this.fs.existsSync(this.path.join(projectPath, 'Game.rpgproject'))
                    || this.fs.existsSync(this.path.join(projectPath, 'game.rpgproject'));
                this.writeText(indexPath, this.getStarterIndexHtml(displayName, { mvCompat: isMvProject }));
            }

            return { ok: true, archivedTo, package: packageResult };
        } catch (error) {
            console.error('Error installing Reactor runtime:', error);
            return { ok: false, error: error.message };
        }
    }

    getRuntimePath() {
        if (!this.fs || !this.path || typeof process === 'undefined') return null;

        const cwd = process.cwd();
        const candidates = [
            this.path.join(cwd, 'runtime'),
            this.path.join(cwd, '..', 'runtime')
        ];

        for (const candidate of candidates) {
            if (this.fs.existsSync(this.path.join(candidate, 'reactor_main.js'))) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Make sure a migrated project runs on the Agonia (Reactor) runtime for
     * playtest. Migrations move plugins into engineModules in
     * project.rpgreactor and native 700+ commands into event data — both are
     * understood only by the Reactor runtime, while a spawned playtest loads
     * the project's own index.html. When an RPG Maker corescript still lives
     * in js/ AND the project carries engine modules, switch the project over
     * once (same procedure as the manual Build-menu item: MV files are
     * quarantined into rpgmaker-runtime-backup.zip first).
     */
    async ensureAgoniaRuntimeForPlaytest(projectPath) {
        const result = { switched: false, alreadyReactor: false, skipped: null, archivedTo: null, error: null };
        if (!this.fs || !this.path) {
            result.error = 'File system not available.';
            return result;
        }
        try {
            const jsPath = this.path.join(projectPath, 'js');
            if (this.fs.existsSync(this.path.join(jsPath, 'reactor_main.js'))) {
                result.alreadyReactor = true;
                return result;
            }
            const hasMvCorescript = this.fs.existsSync(this.path.join(jsPath, 'rpg_managers.js'))
                || this.fs.existsSync(this.path.join(jsPath, 'main.js'));
            if (!hasMvCorescript) {
                result.skipped = 'no RPG Maker corescript in js/';
                return result;
            }
            const metaPath = this.path.join(projectPath, 'project.rpgreactor');
            let hasEngineModules = false;
            if (this.fs.existsSync(metaPath)) {
                const meta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
                hasEngineModules = Array.isArray(meta.engineModules) && meta.engineModules.length > 0;
            }
            if (!hasEngineModules) {
                result.skipped = 'project has no engine modules (not migrated)';
                return result;
            }
            const install = await this.installReactorRuntime(projectPath, this.path.basename(projectPath), {});
            if (!install.ok) {
                result.error = install.error;
                return result;
            }
            result.switched = true;
            result.archivedTo = install.archivedTo;
            return result;
        } catch (error) {
            result.error = error.message || String(error);
            return result;
        }
    }

    getTemplateProjectPath() {
        if (!this.fs || !this.path || typeof process === 'undefined') return null;

        const cwd = process.cwd();
        const candidates = [
            this.path.join(cwd, 'template', 'Demo'),
            this.path.join(cwd, '..', 'template', 'Demo')
        ];

        for (const candidate of candidates) {
            if (this.fs.existsSync(this.path.join(candidate, 'project.rpgreactor'))) {
                return candidate;
            }
        }

        return null;
    }

    updateCopiedTemplateProject(targetPath, projectName, engineVersion) {
        this.writeProjectMetadata(targetPath, projectName, engineVersion);

        const packagePath = this.path.join(targetPath, 'package.json');
        if (this.fs.existsSync(packagePath)) {
            const packageData = JSON.parse(this.fs.readFileSync(packagePath, 'utf8'));
            packageData.name = this.getProjectPackageName(projectName);
            packageData.version = engineVersion;
            packageData.window = packageData.window || {};
            packageData.window.title = projectName;
            this.writeJson(packagePath, packageData);
        }

        const systemPath = this.path.join(targetPath, 'data', 'System.json');
        if (this.fs.existsSync(systemPath)) {
            const systemData = JSON.parse(this.fs.readFileSync(systemPath, 'utf8'));
            systemData.gameTitle = projectName;
            this.writeJson(systemPath, systemData);
        }
    }

    writeProjectMetadata(targetPath, projectName, engineVersion) {
        const now = new Date().toISOString();
        const projectData = {
            name: projectName,
            version: engineVersion,
            engine: 'Agonia Engine',
            engineVersion: engineVersion,
            created: now,
            modified: now
        };

        this.writeJson(this.path.join(targetPath, 'project.rpgreactor'), projectData);
    }

    async createStarterProject(targetPath, projectName, engineVersion, runtimePath) {
        const jsPath = this.path.join(targetPath, 'js');
        const dataPath = this.path.join(targetPath, 'data');

        await this.copyDirectory(runtimePath, jsPath);
        this.writeText(this.path.join(jsPath, 'reactor_plugins.js'), 'var $plugins = [];\n');

        this.ensureDirectories(targetPath, [
            'audio/bgm', 'audio/bgs', 'audio/me', 'audio/se',
            'effects', 'fonts', 'icon', 'img/animations', 'img/battlebacks1',
            'img/battlebacks2', 'img/characters', 'img/enemies', 'img/faces',
            'img/parallaxes', 'img/pictures', 'img/sv_actors', 'img/sv_enemies',
            'img/system', 'img/tilesets', 'img/titles1', 'img/titles2', 'js/plugins'
        ]);

        this.writeText(this.path.join(targetPath, 'index.html'), this.getStarterIndexHtml(projectName));
        this.writeJson(this.path.join(targetPath, 'package.json'), this.getStarterPackage(projectName, engineVersion));
        this.writeText(this.path.join(targetPath, 'game.rmmzproject'), 'RPGMZ 1.0.0');

        if (!this.fs.existsSync(dataPath)) {
            this.fs.mkdirSync(dataPath, { recursive: true });
        }

        const dataFiles = this.getStarterData(projectName);
        for (const [fileName, data] of Object.entries(dataFiles)) {
            this.writeJson(this.path.join(dataPath, fileName), data);
        }

        this.writeSolidPng(this.path.join(targetPath, 'img', 'system', 'Window.png'), 192, 192, [32, 32, 40, 255]);
        this.writeSolidPng(this.path.join(targetPath, 'img', 'system', 'IconSet.png'), 512, 512, [0, 0, 0, 0]);
        this.copyEditorIcon(targetPath);
    }

    ensureDirectories(rootPath, directories) {
        for (const directory of directories) {
            const fullPath = this.path.join(rootPath, directory);
            if (!this.fs.existsSync(fullPath)) {
                this.fs.mkdirSync(fullPath, { recursive: true });
            }
        }
    }

    writeText(filePath, contents) {
        this.fs.writeFileSync(filePath, contents, 'utf8');
    }

    writeJson(filePath, data) {
        this.writeText(filePath, JSON.stringify(data, null, 2));
    }

    crc32(buffer) {
        let crc = 0xffffffff;
        for (const byte of buffer) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) {
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    writeSolidPng(filePath, width, height, rgba) {
        const zlib = require('zlib');
        const Buffer = require('buffer').Buffer;
        const rowSize = width * 4 + 1;
        const pixels = Buffer.alloc(rowSize * height);
        for (let y = 0; y < height; y++) {
            const row = y * rowSize;
            pixels[row] = 0;
            for (let x = 0; x < width; x++) {
                const offset = row + 1 + x * 4;
                pixels[offset] = rgba[0];
                pixels[offset + 1] = rgba[1];
                pixels[offset + 2] = rgba[2];
                pixels[offset + 3] = rgba[3];
            }
        }

        const crc32 = (buffer) => this.crc32(buffer);
        const chunk = (type, data) => {
            const name = Buffer.from(type, 'ascii');
            const length = Buffer.alloc(4);
            length.writeUInt32BE(data.length);
            const checksum = Buffer.alloc(4);
            checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
            return Buffer.concat([length, name, data, checksum]);
        };

        const header = Buffer.alloc(13);
        header.writeUInt32BE(width, 0);
        header.writeUInt32BE(height, 4);
        header[8] = 8;
        header[9] = 6;
        this.fs.writeFileSync(filePath, Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            chunk('IHDR', header),
            chunk('IDAT', zlib.deflateSync(pixels)),
            chunk('IEND', Buffer.alloc(0))
        ]));
    }

    getStarterIndexHtml(projectName, options = {}) {
        // The MV compatibility layer reads this flag at boot; deployed games
        // exclude the RPG Maker project markers, so the mode must ship here.
        const mvCompatLine = typeof options.mvCompat === 'boolean'
            ? `\n        <script>window.$reactorMvCompat = ${options.mvCompat};</script>`
            : '';
        return `<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="viewport" content="user-scalable=no">
        <link rel="icon" href="icon/icon.png" type="image/png">
        <link rel="apple-touch-icon" href="icon/icon.png">
        <title>${this.escapeHtml(projectName)}</title>
    </head>
    <body style="background-color: black">${mvCompatLine}
        <script type="text/javascript" src="js/reactor_main.js"></script>
    </body>
</html>
`;
    }

    getStarterPackage(projectName, engineVersion) {
        return {
            name: this.getProjectPackageName(projectName),
            version: engineVersion,
            main: 'index.html',
            'chromium-args': '--force-color-profile=srgb --window-size=1280,720',
            window: {
                title: projectName,
                width: 1280,
                height: 720,
                min_width: 1280,
                min_height: 720,
                position: 'center',
                resizable: true,
                frame: true,
                show: true,
                icon: 'icon/icon.png'
            }
        };
    }

    getStarterData(projectName) {
        const mapWidth = 17;
        const mapHeight = 13;
        const blankMapData = new Array(mapWidth * mapHeight * 6).fill(0);
        const emptyAudio = { name: '', pan: 0, pitch: 100, volume: 90 };

        return {
            'Actors.json': [null],
            'Animations.json': [null],
            'Armors.json': [null],
            'Classes.json': [null],
            'CommonEvents.json': [null],
            'Enemies.json': [null],
            'Items.json': [null],
            'Skills.json': [null],
            'States.json': [null],
            'Tilesets.json': [null, this.getStarterTileset()],
            'Troops.json': [null],
            'Weapons.json': [null],
            'MapInfos.json': [null, {
                id: 1,
                expanded: true,
                name: 'Map001',
                order: 1,
                parentId: 0,
                scrollX: 0,
                scrollY: 0
            }],
            'Map001.json': {
                autoplayBgm: false,
                autoplayBgs: false,
                battleback1Name: '',
                battleback2Name: '',
                bgm: { ...emptyAudio },
                bgs: { ...emptyAudio },
                disableDashing: false,
                displayName: '',
                encounterList: [],
                encounterStep: 30,
                height: mapHeight,
                note: '',
                parallaxLoopX: false,
                parallaxLoopY: false,
                parallaxName: '',
                parallaxShow: true,
                parallaxSx: 0,
                parallaxSy: 0,
                scrollType: 0,
                specifyBattleback: false,
                tilesetId: 1,
                width: mapWidth,
                data: blankMapData,
                events: [null]
            },
            'MapTest.json': {
                troopId: 1,
                canEscape: true,
                canLose: false,
                actor1Id: 1,
                actor1Level: 1,
                actor2Id: 0,
                actor2Level: 1,
                actor3Id: 0,
                actor3Level: 1,
                actor4Id: 0,
                actor4Level: 1
            },
            'System.json': this.getStarterSystem(projectName)
        };
    }

    getStarterTileset() {
        return {
            id: 1,
            mode: 1,
            name: 'Default',
            note: '',
            tilesetNames: ['', '', '', '', '', '', '', '', ''],
            flags: new Array(8192).fill(0)
        };
    }

    getStarterSystem(projectName) {
        const emptyAudio = { name: '', pan: 0, pitch: 100, volume: 90 };
        return {
            gameTitle: projectName,
            versionId: 1,
            locale: 'en_US',
            editMapId: 1,
            startMapId: 1,
            startX: 8,
            startY: 6,
            boat: { bgm: { ...emptyAudio }, characterIndex: 0, characterName: '', startMapId: 0, startX: 0, startY: 0 },
            ship: { bgm: { ...emptyAudio }, characterIndex: 0, characterName: '', startMapId: 0, startX: 0, startY: 0 },
            airship: { bgm: { ...emptyAudio }, characterIndex: 0, characterName: '', startMapId: 0, startX: 0, startY: 0 },
            title1Name: '',
            title2Name: '',
            titleBgm: { ...emptyAudio },
            battleBgm: { ...emptyAudio },
            victoryMe: { ...emptyAudio },
            defeatMe: { ...emptyAudio },
            gameoverMe: { ...emptyAudio },
            battleSystem: 1,
            tileSize: 48,
            windowTone: [0, 0, 0, 0],
            menuCommands: [true, true, true, true, true, true],
            itemCategories: [true, true, true, true],
            magicSkills: [1],
            hasEncryptedImages: false,
            hasEncryptedAudio: false,
            encryptionKey: '',
            optDisplayTp: true,
            optDrawTitle: true,
            optExtraExp: false,
            optFloorDeath: false,
            optFollowers: true,
            optKeyItemsNumber: true,
            optSideView: true,
            optSlipDeath: false,
            optTransparent: false,
            partyMembers: [],
            currencyUnit: 'G',
            elements: ['', 'Physical'],
            equipTypes: ['', 'Weapon', 'Shield', 'Head', 'Body', 'Accessory'],
            skillTypes: ['', 'Magic', 'Special'],
            weaponTypes: ['', 'Sword'],
            attackMotions: new Array(13).fill(null).map((_, index) => ({
                type: index === 1 ? 1 : 0,
                weaponImageId: index === 1 ? 1 : 0
            })),
            armorTypes: ['', 'General Armor'],
            switches: ['', 'Switch 1'],
            variables: ['', 'Variable 1'],
            terms: {
                basic: ['Level', 'Lv', 'HP', 'HP', 'MP', 'MP', 'TP', 'TP', 'Experience', 'EXP'],
                commands: ['Fight', 'Escape', 'Attack', 'Guard', 'Item', 'Skill', 'Equip', 'Status', 'Formation', 'Save', 'Game End', 'Options', 'Weapon', 'Armor', 'Key Item', 'Equip', 'Optimize', 'Clear', 'New Game', 'Continue', null, 'To Title', 'Cancel', null, 'Buy', 'Sell'],
                params: ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck', 'Hit Rate', 'Evasion Rate'],
                messages: {}
            },
            sounds: new Array(24).fill(null).map(() => ({ ...emptyAudio })),
            testBattlers: [],
            testTroopId: 1,
            battleback1Name: '',
            battleback2Name: '',
            titleCommandWindow: { background: 0, offsetX: 0, offsetY: 0 },
            advanced: {
                fallbackFonts: 'Verdana, sans-serif',
                fontSize: 26,
                gameId: 0,
                mainFontFilename: '',
                numberFontFilename: '',
                screenHeight: 624,
                screenScale: 1,
                screenWidth: 816,
                uiAreaHeight: 624,
                uiAreaWidth: 816,
                windowOpacity: 192
            }
        };
    }

    copyEditorIcon(targetPath) {
        const cwd = process.cwd();
        const iconCandidates = [
            this.path.join(cwd, 'images', 'icon.png'),
            this.path.join(cwd, 'editor', 'images', 'icon.png')
        ];

        for (const iconPath of iconCandidates) {
            if (this.fs.existsSync(iconPath)) {
                this.fs.copyFileSync(iconPath, this.path.join(targetPath, 'icon', 'icon.png'));
                return;
            }
        }
    }

    slugify(value) {
        const slug = String(value || 'rpg-reactor-game')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || 'rpg-reactor-game';
    }

    getProjectPackageName(projectName) {
        const name = this.slugify(projectName);
        return name === 'rmmz-game' ? 'rpg-reactor-game' : name;
    }

    ensureProjectPackageMetadata(projectPath, displayName = null) {
        if (!this.fs || !this.path) {
            return { ok: false, error: 'File system not available.' };
        }

        const packagePath = this.path.join(projectPath, 'package.json');
        const projectName = displayName || this.path.basename(projectPath) || 'Agonia Engine Game';
        let packageData;
        let created = false;
        const repaired = [];

        try {
            if (this.fs.existsSync(packagePath)) {
                const source = this.fs.readFileSync(packagePath, 'utf8').replace(/^\uFEFF/, '');
                packageData = JSON.parse(source);
                if (!packageData || typeof packageData !== 'object' || Array.isArray(packageData)) {
                    return {
                        ok: false,
                        path: packagePath,
                        error: `Cannot use ${packagePath}: expected package.json to contain a JSON object.`
                    };
                }
            } else {
                packageData = this.getStarterPackage(projectName, this.getEngineVersion());
                created = true;
            }

            if (typeof packageData.name !== 'string' || !packageData.name.trim()) {
                packageData.name = this.getProjectPackageName(projectName);
                repaired.push('name');
            }
            if (typeof packageData.main !== 'string' || !packageData.main.trim()) {
                packageData.main = 'index.html';
                repaired.push('main');
            }

            if (created || repaired.length > 0) {
                this._writeFileAtomic(this.fs, packagePath, JSON.stringify(packageData, null, 2), 'utf8');
            }
            return {
                ok: true,
                path: packagePath,
                created,
                repaired,
                packageName: packageData.name
            };
        } catch (error) {
            return {
                ok: false,
                path: packagePath,
                error: `Cannot use ${packagePath}: ${error.message || error}`
            };
        }
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ── Engine plugin catalog ──────────────────────────────────────────
    //
    // The engine ships a master plugin library (app/plugins, distributed as
    // a real folder next to the executable). Projects reference plugins
    // through their manifest and load them from the catalog by absolute
    // path, keeping the project's js/plugins folder empty.

    static MV_CATALOG_LOADER_SNIPPET = [
        '',
        '// >>> RPGReactor: engine plugin catalog loader (do not remove this block) <<<',
        '(function() {',
        "    if (typeof PluginManager === 'undefined' || PluginManager.__rpgReactorCatalogV2) return;",
        '    PluginManager.__rpgReactorCatalogV2 = true;',
        '    var fs = null, path = null;',
        "    try { fs = require('fs'); path = require('path'); } catch (e) { return; }",
        '    var cwd = process.cwd();',
        '    var engineDir = null;',
        '    try {',
        '        var fromEnv = process.env && process.env.RPGREACTOR_PLUGINS_DIR;',
        '        if (fromEnv && fs.existsSync(fromEnv)) engineDir = fromEnv;',
        '    } catch (e) {}',
        '    if (!engineDir) {',
        '        try {',
        "            var metaPath = path.join(cwd, 'project.rpgreactor');",
        '            if (fs.existsSync(metaPath)) {',
        "                var meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));",
        '                if (meta && meta.enginePluginsDir && fs.existsSync(meta.enginePluginsDir)) {',
        '                    engineDir = meta.enginePluginsDir;',
        '                }',
        '            }',
        '        } catch (e) {}',
        '    }',
        '    var localExists = function(name) {',
        '        try { return fs.existsSync(path.join(cwd, PluginManager._path, name)); }',
        '        catch (e) { return false; }',
        '    };',
        '    var catalogExists = function(name) {',
        '        try { return !!engineDir && fs.existsSync(path.join(engineDir, name)); }',
        '        catch (e) { return false; }',
        '    };',
        '    PluginManager.loadScript = function(name) {',
        '        var url = PluginManager._path + name;',
        '        if (!localExists(name) && catalogExists(name)) {',
        '            var abs = path.join(engineDir, name).replace(/\\\\/g, "/");',
        "            url = encodeURI('file:///' + abs);",
        '        }',
        "        var script = document.createElement('script');",
        "        script.type = 'text/javascript';",
        '        script.src = url;',
        '        script.async = false;',
        '        script.onerror = PluginManager.onError.bind(PluginManager);',
        '        script._url = url;',
        '        document.body.appendChild(script);',
        '    };',
        '',
        '    // ===================== Agonia Engine bridge =====================',
        '    // Merges project.rpgreactor engineModules into $plugins at setup',
        '    // time (load order preserved; separator rows and disabled manifest',
        '    // entries never anchor an insertion), applies data/AgoniaEngine.json',
        '    // settings over module parameters, and installs the native 700+',
        '    // event commands (Game_Interpreter.command7XX) plus the MV sprite',
        '    // implementations for text pops and intro slides.',
        '    var RR = {',
        '        stringify: function(v) {',
        '            if (v === null || v === undefined) return "";',
        '            if (typeof v === "object") return JSON.stringify(v);',
        '            return String(v);',
        '        },',
        '        mergeModules: function(plugins, modules) {',
        '            if (!modules || !modules.length) return plugins;',
        '            var present = {};',
        '            var i;',
        '            for (i = 0; i < plugins.length; i++) {',
        '                if (plugins[i] && plugins[i].name) present[plugins[i].name] = true;',
        '            }',
        '            var merged = plugins.slice();',
        '            var pending = [];',
        '            for (i = 0; i < modules.length; i++) {',
        '                var m = modules[i];',
        '                if (m && m.name && !present[m.name]) pending.push(m);',
        '            }',
        '            if (!pending.length) return merged;',
        '            var pendingNames = {};',
        '            for (i = 0; i < pending.length; i++) pendingNames[pending[i].name] = true;',
        '            var deps = {};',
        '            for (i = 0; i < pending.length; i++) {',
        '                var ob = pending[i].orderBefore || [];',
        '                var n = 0;',
        '                for (var j = 0; j < ob.length; j++) {',
        '                    if (pendingNames[ob[j]]) n++;',
        '                }',
        '                deps[pending[i].name] = n;',
        '            }',
        '            pending.sort(function(a, b) { return deps[a.name] - deps[b.name]; });',
        '            for (i = 0; i < pending.length; i++) {',
        '                var mod = pending[i];',
        '                var before = mod.orderBefore || [];',
        '                var at = 0;',
        '                for (var k = 0; k < merged.length; k++) {',
        '                    var e = merged[k];',
        '                    if (e && e.status && e.name && before.indexOf(e.name) !== -1) at = k + 1;',
        '                }',
        '                merged.splice(at, 0, {',
        '                    name: mod.name, status: true, description: "",',
        '                    parameters: mod.parameters || {}',
        '                });',
        '            }',
        '            return merged;',
        '        },',
        '        applyAgoniaConfig: function(plugins, config, sections) {',
        '            if (!config) return plugins;',
        '            Object.keys(sections).forEach(function(pluginName) {',
        '                var section = config[sections[pluginName]];',
        '                if (!section) return;',
        '                plugins.forEach(function(p) {',
        '                    if (!p || p.name !== pluginName) return;',
        '                    var params = p.parameters || {};',
        '                    Object.keys(section).forEach(function(key) {',
        '                        var v = section[key];',
        '                        if (v === undefined || v === null) return;',
        '                        params[key] = RR.stringify(v);',
        '                    });',
        '                    p.parameters = params;',
        '                });',
        '            });',
        '            return plugins;',
        '        },',
        '        install: function(plugins) {',
        '            var meta = null;',
        '            try {',
        '                meta = JSON.parse(fs.readFileSync(path.join(cwd, "project.rpgreactor"), "utf8"));',
        '            } catch (e) { meta = null; }',
        '            var list = (plugins || []).slice();',
        '            list = RR.mergeModules(list, meta && meta.engineModules);',
        '            var agonia = null;',
        '            try {',
        '                agonia = JSON.parse(fs.readFileSync(path.join(cwd, "data", "AgoniaEngine.json"), "utf8"));',
        '            } catch (e) { agonia = null; }',
        '            list = RR.applyAgoniaConfig(list, agonia, {',
        '                SuperDuperSpriter: "spriter",',
        '                SuperDuperMovement: "stamina",',
        '                SuperDuperMovement_Addon: "dash",',
        '                SDLight: "lighting",',
        '                SuperDuperCamera: "camera",',
        '                SuperDuperInventory: "inventory",',
        '                SuperDuperBattle: "battle",',
        '                SuperDuperEnemies: "enemies",',
        '                SimpleCraftSystem: "craft",',
        '                SimpleCustomHints: "hints",',
        '                MOG_TreasurePopup: "popup",',
        '                SuperDuperLoot: "loot",',
        '                SuperDuperGifts: "gifts",',
        '                SuperDuperScreen: "screen"',
        '            });',
        '            list = RR.applyScreenResolution(list, agonia);',
        '            RR.loadSystemModules(list, agonia, meta);',
        '            window.$plugins = list;',
        '            RR.installScreenSystem(list, agonia, meta);',
        '            RR.installCommands();',
        '            RR.installNoBattle();',
        '            return list;',
        '        },',
        '',
        '        // ===================== System Module Loader =====================',
        '        // Retired plugins whose FUNCTIONALITY the engine still needs run',
        '        // as system modules: the same catalog file, executed by the',
        '        // bridge BEFORE the plugin scripts (async=false preserves DOM',
        '        // order), with parameters merged from the retired snapshot and',
        '        // the DB section. Not in $plugins, not listed as a plugin',
        '        // anywhere - an engine subsystem with DB-driven config.',
        '        systemModules: {',
        '            "SuperDuperSpriter": { section: "spriter" },',
        '            "SDLight": { section: "lighting" },',
        '            "SuperDuperMovement": { section: "stamina" },',
        '            "SuperDuperMovement_Addon": { section: "dash" },',
        '            "SuperDuperCamera": { section: "camera" },',
        '            "SuperDuperInventory": { section: "inventory" },',
        '            "SuperDuperBattle": { section: "battle" },',
        '            "SuperDuperEnemies": { section: "enemies" },',
        '            "AgoniaAudioRules": { section: "audio" }',
        '        },',
        '        loadSystemModules: function(list, agonia, meta) {',
        '            var loaded = {};',
        '            (list || []).forEach(function(p) { if (p && p.name) loaded[p.name] = true; });',
        '            var retired = (meta && Array.isArray(meta.retiredPlugins)) ? meta.retiredPlugins : [];',
        '            Object.keys(RR.systemModules).forEach(function(name) {',
        '                if (loaded[name]) return;',
        '                var def = RR.systemModules[name];',
        '                var params = {};',
        '                for (var i = 0; i < retired.length; i++) {',
        '                    if (retired[i] && String(retired[i].name) === name) {',
        '                        params = Object.assign({}, retired[i].parameters || {});',
        '                        break;',
        '                    }',
        '                }',
        '                var section = (def.section && agonia && agonia[def.section]) || null;',
        '                if (section) {',
        '                    Object.keys(section).forEach(function(k) {',
        '                        var v = section[k];',
        '                        if (v === undefined || v === null) return;',
        '                        params[k] = RR.stringify(v);',
        '                    });',
        '                }',
        '                RR.loadSystemModule(name, params);',
        '            });',
        '        },',
        '        loadSystemModule: function(name, params) {',
        '            try {',
        '                PluginManager.setParameters(name, params || {});',
        '                PluginManager.loadScript(name + ".js");',
        '                if (PluginManager._scripts && PluginManager._scripts.indexOf(name) === -1) {',
        '                    PluginManager._scripts.push(name);',
        '                }',
        '                return true;',
        '            } catch (e) {',
        '                try { console.warn("System module failed to load:", name, e); } catch (e2) {}',
        '                return false;',
        '            }',
        '        },',
        '',
        '        // ===================== Single Writer: Screen =====================',
        '        // The DB screen section is the ONE source of truth for resolution,',
        '        // fullscreen and the window title. While the legacy plugins are',
        '        // still loaded, every one of them receives a derived, consistent',
        '        // copy at boot (their own writers are thereby owned from above);',
        '        // when they retire, the system modules take the same values over.',
        '        applyScreenResolution: function(list, agonia) {',
        '            var cfg = (agonia && agonia.screen) || {};',
        '            var w = Number(cfg["Screen Width"]);',
        '            var h = Number(cfg["Screen Height"]);',
        '            if (!isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) return list;',
        '            var fullscreen = cfg["Fullscreen"];',
        '            if (fullscreen === undefined || fullscreen === null) fullscreen = true;',
        '            var title = String(cfg["Window Title"] === undefined ? "" : cfg["Window Title"]);',
        '            var resJson = JSON.stringify({ Width: String(w), Height: String(h) });',
        '            for (var i = 0; i < list.length; i++) {',
        '                var p = list[i];',
        '                if (!p || !p.name) continue;',
        '                var params = p.parameters || (p.parameters = {});',
        '                if (p.name === "SRD_GameUpgrade") {',
        '                    params["Game Resolution"] = resJson;',
        '                    params["Screen Resolution"] = resJson;',
        '                    params["Initial Fullscreen"] = String(fullscreen === true || fullscreen === "true");',
        '                    if (title) params["Window Title"] = title;',
        '                } else if (p.name === "SuperDuperCore") {',
        '                    params["\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u044d\u043a\u0440\u0430\u043d\u0430 (\u0428\u0438\u0440\u0438\u043d\u0430)"] = String(w);',
        '                    params["\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u044d\u043a\u0440\u0430\u043d\u0430 (\u0412\u044b\u0441\u043e\u0442\u0430)"] = String(h);',
        '                } else if (p.name === "SuperDuperScreen") {',
        '                    params["Screen Width"] = String(w);',
        '                    params["Screen Height"] = String(h);',
        '                }',
        '            }',
        '            return list;',
        '        },',
        '',
        '        // ===================== Screen System (S1) =====================',
        '        // Replaces SRD_GameUpgrade (resolution), SuperDuperScreen (CRT',
        '        // filter) and SuperDuperCore (SuperDuper.Core API) once those',
        '        // plugins are retired. While a plugin is still loaded, its',
        '        // counterpart stays off — transitional mode, no double applied',
        '        // effects. Resolution flows from the DB screen section through',
        '        // the same SceneManager fields SRD used, so Graphics initialize',
        '        // picks it up identically.',
        '        installScreenSystem: function(list, agonia, meta) {',
        '            var loaded = {};',
        '            (list || []).forEach(function(p) { if (p && p.name) loaded[p.name] = true; });',
        '            var cfg = (agonia && agonia.screen) || {};',
        '            RR.screen = { cfg: cfg, crt: null, core: false };',
        '',
        '            // -- Resolution (replaces SRD_GameUpgrade) --',
        '            if (!loaded["SRD_GameUpgrade"]) {',
        '                var w = Number(cfg["Screen Width"]) || 1280;',
        '                var h = Number(cfg["Screen Height"]) || 720;',
        '                if (typeof SceneManager !== "undefined") {',
        '                    SceneManager._screenWidth = w;',
        '                    SceneManager._screenHeight = h;',
        '                    SceneManager._boxWidth = w;',
        '                    SceneManager._boxHeight = h;',
        '                }',
        '            }',
        '',
        '            // -- SRD hub shim (replaces SRD_GameUpgrade) --',
        '            // The remaining SRD plugins are self-sufficient for the',
        '            // notetag pump (guarded re-install), but OptionsCreator',
        '            // hard-returns without Imported["SumRndmDde Game Upgrade"]',
        '            // and needs SRD.requirePlugin/parse; SuperTools activates',
        '            // its GameWindowManager block under the same flag. Tuning',
        '            // ports (PIXI settings, ImageCache, JsonEx, Decrypter,',
        '            // ResourceHandler, boot fullscreen) read the retired',
        '            // snapshot\'s parameters so behavior stays identical.',
        '            if (!loaded["SRD_GameUpgrade"]) {',
        '                RR.installSrdHub(meta);',
        '            }',
        '',
        '            // -- SuperDuper.Core shim (replaces SuperDuperCore) --',
        '            if (!loaded["SuperDuperCore"] && typeof window !== "undefined") {',
        '                window.SuperDuper = window.SuperDuper || {};',
        '                if (!window.SuperDuper.Core) {',
        '                    var coreW = Number(cfg["Screen Width"]) || 1280;',
        '                    var coreH = Number(cfg["Screen Height"]) || 720;',
        '                    window.SuperDuper.Core = {',
        '                        screen: { width: coreW, height: coreH },',
        '                        color: { primary: "#ffffff", accent: "#ffaa00", background: "#000000" },',
        '                        clamp: function(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); },',
        '                        lerp: function(a, b, t) { return a + (b - a) * t; },',
        '                        remap: function(v, a1, a2, b1, b2) { var t = (v - a1) / (a2 - a1); return b1 + (b2 - b1) * t; },',
        '                        centerX: function() { return this.screen.width / 2; },',
        '                        centerY: function() { return this.screen.height / 2; },',
        '                        center: function() { return { x: this.centerX(), y: this.centerY() }; },',
        '                        pct: function(px, py) { return { x: this.screen.width * px / 100, y: this.screen.height * py / 100 }; },',
        '                        pctX: function(p) { return this.screen.width * p / 100; },',
        '                        pctY: function(p) { return this.screen.height * p / 100; },',
        '                        px: function(x, y) { return { x: x, y: y }; },',
        '                        registry: {}',
        '                    };',
        '                    RR.screen.core = true;',
        '                }',
        '            }',
        '',
        '            // -- CRT filter (replaces SuperDuperScreen) --',
        '            if (!loaded["SuperDuperScreen"]) {',
        '                RR.installCrtFilter(cfg);',
        '            }',
        '        },',
        '',
        '        installSrdHub: function(meta) {',
        '            if (window.__rrSrdHub) return;',
        '            window.__rrSrdHub = true;',
        '            var retired = (meta && Array.isArray(meta.retiredPlugins)) ? meta.retiredPlugins : [];',
        '            var rec = null;',
        '            for (var ri = 0; ri < retired.length; ri++) {',
        '                if (retired[ri] && String(retired[ri].name) === "SRD_GameUpgrade") { rec = retired[ri]; break; }',
        '            }',
        '            var P = (rec && rec.parameters) || {};',
        '            var asStr = function(k, d) { var v = P[k]; return (v === undefined || v === null || v === "") ? d : String(v); };',
        '            var asNum = function(k, d) { var n = Number(P[k]); return isFinite(n) ? n : d; };',
        '            var asList = function(k, d) {',
        '                var v = P[k];',
        '                if (Array.isArray(v)) return v;',
        '                if (typeof v === "string" && v !== "") {',
        '                    try { var arr = JSON.parse(v); if (Array.isArray(arr)) return arr; } catch (e) {}',
        '                }',
        '                return d;',
        '            };',
        '',
        '            // --- SRD namespace + utilities (contract of SRD_GameUpgrade) ---',
        '            window.SRD = window.SRD || {};',
        '            window.Imported = window.Imported || {};',
        '            var SRD = window.SRD;',
        '            SRD.Requirements = SRD.Requirements || [];',
        '            SRD.PluginCommands = SRD.PluginCommands || {};',
        '            SRD.NotetagGetters = SRD.NotetagGetters || [];',
        '            SRD.isPlaytest = (typeof Utils !== "undefined" && Utils.isOptionValid) ? Utils.isOptionValid("test") : false;',
        '            SRD.parse = function(string, parseEverything, deleteBlank) {',
        '                if (typeof string !== "string") return string;',
        '                var temp;',
        '                try { temp = JSON.parse(string); } catch (e) {',
        '                    if (deleteBlank && string === "") return undefined;',
        '                    return string;',
        '                }',
        '                if (typeof temp === "object" && temp !== null) {',
        '                    for (var key in temp) temp[key] = SRD.parse(temp[key], parseEverything, deleteBlank);',
        '                    return temp;',
        '                }',
        '                return parseEverything ? temp : string;',
        '            };',
        '            SRD.exists = function(v) { return typeof v !== "undefined"; };',
        '            SRD.isClass = function(v) { return typeof v === "function"; };',
        '            SRD.openLink = function(url) {',
        '                if (typeof Utils !== "undefined" && Utils.isNwjs && Utils.isNwjs()) {',
        '                    try { require("nw.gui").Shell.openExternal(url); } catch (e) {}',
        '                } else if (window.open) { window.open(url); }',
        '            };',
        '            SRD.pluginExists = function(name, version) {',
        '                if (window.Imported[name] === undefined) return false;',
        '                return version === undefined ? true : window.Imported[name] >= version;',
        '            };',
        '            SRD.requirePlugin = function(name, filename, requiredname, link, version) {',
        '                if (SRD.pluginExists(name, version)) return false;',
        '                SRD.Requirements.push(["plugin", filename, requiredname, link, version]);',
        '                return true;',
        '            };',
        '            SRD.requireVersion = function(filename, version) {',
        '                if (typeof Utils !== "undefined" && Utils.RPGMAKER_VERSION && Utils.RPGMAKER_VERSION >= version) return false;',
        '                SRD.Requirements.push(["project", filename, version]);',
        '                return true;',
        '            };',
        '            SRD.checkRequirements = function() {};',
        '            SRD.onWindowLoad = function() {};',
        '            window.Imported["SumRndmDde Game Upgrade"] = 1.35;',
        '',
        '            // --- GameWindowManager stub (SuperTools hooks closeGame/onWindowClose) ---',
        '            if (typeof window.GameWindowManager === "undefined") {',
        '                var rrWin = null;',
        '                try {',
        '                    if (typeof Utils !== "undefined" && Utils.isNwjs && Utils.isNwjs()) rrWin = require("nw.gui").Window.get();',
        '                } catch (e) { rrWin = null; }',
        '                window.GameWindowManager = {',
        '                    window: rrWin,',
        '                    closeGame: function() {',
        '                        if (this.window) { try { this.window.close(true); return; } catch (e) {} }',
        '                        if (typeof window !== "undefined" && window.close) window.close(true);',
        '                    },',
        '                    onWindowClose: function() { this.closeGame(); }',
        '                };',
        '            }',
        '',
        '            // --- Tuning ports (values from the retired snapshot) ---',
        '            if (typeof PIXI !== "undefined" && PIXI.settings) {',
        '                var scaleLinear = asStr("Scale Mode", "Nearest") === "Linear";',
        '                if (PIXI.SCALE_MODES) {',
        '                    PIXI.settings.SCALE_MODE = scaleLinear ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;',
        '                    if (PIXI.tilemap && PIXI.tilemap.TileRenderer) {',
        '                        PIXI.tilemap.TileRenderer.SCALE_MODE = scaleLinear ? PIXI.SCALE_MODES.LINEAR : PIXI.SCALE_MODES.NEAREST;',
        '                    }',
        '                }',
        '                if (PIXI.GC_MODES) {',
        '                    // SRD semantics: param "Manual" maps to AUTO, anything else to MANUAL.',
        '                    PIXI.settings.GC_MODE = asStr("Garbage Collection Mode", "Automatic") === "Manual"',
        '                        ? PIXI.GC_MODES.AUTO : PIXI.GC_MODES.MANUAL;',
        '                }',
        '                if (PIXI.WRAP_MODES) {',
        '                    var wrap = asStr("Wrap Mode", "Clamp");',
        '                    PIXI.settings.WRAP_MODE = wrap === "Repeat" ? PIXI.WRAP_MODES.REPEAT',
        '                        : wrap === "Mirrored Repeat" ? PIXI.WRAP_MODES.MIRRORED_REPEAT',
        '                        : PIXI.WRAP_MODES.CLAMP;',
        '                }',
        '            }',
        '            if (typeof ImageCache === "function") {',
        '                ImageCache.limit = asNum("Image Cache Limit", 30) * 1000 * 1000;',
        '            }',
        '            if (typeof JsonEx === "function") {',
        '                JsonEx.maxDepth = asNum("JsonEx Max Depth", 100);',
        '            }',
        '            if (typeof Decrypter === "function") {',
        '                var ignore = asList("Decrypter Ignore List", []).map(function(u) { return "img/" + u; });',
        '                Decrypter._ignoreList = ignore;',
        '            }',
        '            if (typeof ResourceHandler === "function") {',
        '                ResourceHandler._defaultRetryInterval = asList("Retry Intervals", ["500", "1000", "3000"]);',
        '            }',
        '',
        '            // --- Fullscreen on boot (Korolev stable-launch fix) ---',
        '            var wantFs = false;',
        '            var fsRaw = P["Initial Fullscreen"];',
        '            if (fsRaw === undefined) wantFs = true; else wantFs = String(fsRaw) === "true";',
        '            if (wantFs && typeof Scene_Boot !== "undefined" && Scene_Boot.prototype) {',
        '                var rrBootStart = Scene_Boot.prototype.start;',
        '                Scene_Boot.prototype.start = function() {',
        '                    rrBootStart.apply(this, arguments);',
        '                    setTimeout(function() {',
        '                        try {',
        '                            if (typeof Graphics !== "undefined" && Graphics._isFullScreen && !Graphics._isFullScreen()) {',
        '                                Graphics._requestFullScreen();',
        '                            }',
        '                        } catch (e) {}',
        '                    }, 50);',
        '                };',
        '            }',
        '        },',
        '',
        '',
        '        installCrtFilter: function(cfg) {',
        '            if (typeof PIXI === "undefined" || typeof Scene_Base === "undefined") return;',
        '            var num = function(k, d) { var v = Number(cfg[k]); return isFinite(v) ? v : d; };',
        '            var scrW = num("Screen Width", 1280);',
        '            var scrH = num("Screen Height", 720);',
        '            // defaultSettings carries the full plugin shape, including',
        '            // screenWidth/screenHeight (filterArea fallback) and active.',
        '            var defaultSettings = {',
        '                screenWidth: scrW,',
        '                screenHeight: scrH,',
        '                active: cfg["Enabled on Startup"] !== false,',
        '                intensity: num("Overall Intensity", 0.10),',
        '                blur: num("Blur Radius", 0.10),',
        '                bloom: num("Bloom Intensity", 0.50),',
        '                bloomthresh: num("Bloom Threshold", 1.00),',
        '                colortemp: num("Color Temperature", 0.00),',
        '                sharpen: num("Sharpening", 0.40),',
        '                wave: num("Wave Intensity", 0.10),',
        '                chroma: num("Chroma Intensity", 0.50),',
        '                scanline: num("Scanline Intensity", 0.40),',
        '                noise: num("Noise Intensity", 1.50),',
        '                saturation: num("Saturation", 1.00),',
        '                contrast: num("Contrast", 1.00),',
        '                brightness: num("Brightness", 1.00)',
        '            };',
        '',
        '            var fragmentSrc = [',
        '                "precision mediump float;",',
        '                "varying vec2 vTextureCoord;",',
        '                "uniform sampler2D uSampler;",',
        '                "uniform float uWaveTime;",',
        '                "uniform float uNoiseTime;",',
        '                "uniform vec2 uResolution;",',
        '                "uniform float uIntensity;",',
        '                "uniform float uWave;",',
        '                "uniform float uChroma;",',
        '                "uniform float uScanline;",',
        '                "uniform float uNoise;",',
        '                "uniform float uBlur;",',
        '                "uniform float uBloom;",',
        '                "uniform float uBloomThresh;",',
        '                "uniform float uColorTemp;",',
        '                "uniform float uSharpen;",',
        '                "uniform float uSaturation;",',
        '                "uniform float uContrast;",',
        '                "uniform float uBrightness;",',
        '                "float rand(vec2 co){",',
        '                "    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);",',
        '                "}",',
        '                "vec3 getChromaBlurred(sampler2D tex, vec2 uv, vec2 res, float radius, float shift) {",',
        '                "    if (radius <= 0.0 && shift <= 0.0) return texture2D(tex, uv).rgb;",',
        '                "    vec3 c = vec3(0.0);",',
        '                "    vec2 off = radius / res;",',
        '                "    vec2 s = vec2(shift, 0.0);",',
        '                "    c.r += texture2D(tex, uv + vec2(-off.x, -off.y) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2(-off.x, -off.y)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2(-off.x, -off.y) + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2( 0.0,   -off.y) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2( 0.0,   -off.y)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2( 0.0,   -off.y) + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2( off.x, -off.y) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2( off.x, -off.y)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2( off.x, -off.y) + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2(-off.x,  0.0) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2(-off.x,  0.0)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2(-off.x,  0.0) + s).b;",',
        '                "    c.r += texture2D(tex, uv - s).r;",',
        '                "    c.g += texture2D(tex, uv).g;",',
        '                "    c.b += texture2D(tex, uv + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2( off.x,  0.0) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2( off.x,  0.0)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2( off.x,  0.0) + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2(-off.x,  off.y) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2(-off.x,  off.y)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2(-off.x,  off.y) + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2( 0.0,    off.y) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2( 0.0,    off.y)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2( 0.0,    off.y) + s).b;",',
        '                "    c.r += texture2D(tex, uv + vec2( off.x,  off.y) - s).r;",',
        '                "    c.g += texture2D(tex, uv + vec2( off.x,  off.y)).g;",',
        '                "    c.b += texture2D(tex, uv + vec2( off.x,  off.y) + s).b;",',
        '                "    return c / 9.0;",',
        '                "}",',
        '                "void main(void) {",',
        '                "    vec2 uv = vTextureCoord;",',
        '                "    float wave = sin(uv.y * 15.0 + uWaveTime) * 0.003 * uWave * uIntensity;",',
        '                "    uv.x += wave;",',
        '                "    float shift = 0.004 * uChroma * uIntensity;",',
        '                "    vec3 baseColor = getChromaBlurred(uSampler, uv, uResolution, uBlur, shift);",',
        '                "    float originalAlpha = texture2D(uSampler, uv).a;",',
        '                "    vec4 color = vec4(baseColor, originalAlpha);",',
        '                "    if (uBloom > 0.0) {",',
        '                "        vec3 bloomColor = vec3(0.0);",',
        '                "        vec2 offB = (uBlur + 4.0) / uResolution;",',
        '                "        vec2 sB = vec2(shift, 0.0);",',
        '                "        bloomColor.r += texture2D(uSampler, uv - sB).r;",',
        '                "        bloomColor.g += texture2D(uSampler, uv).g;",',
        '                "        bloomColor.b += texture2D(uSampler, uv + sB).b;",',
        '                "        bloomColor.r += texture2D(uSampler, uv + vec2(-offB.x, -offB.y) - sB).r;",',
        '                "        bloomColor.g += texture2D(uSampler, uv + vec2(-offB.x, -offB.y)).g;",',
        '                "        bloomColor.b += texture2D(uSampler, uv + vec2(-offB.x, -offB.y) + sB).b;",',
        '                "        bloomColor.r += texture2D(uSampler, uv + vec2(offB.x, -offB.y) - sB).r;",',
        '                "        bloomColor.g += texture2D(uSampler, uv + vec2(offB.x, -offB.y)).g;",',
        '                "        bloomColor.b += texture2D(uSampler, uv + vec2(offB.x, -offB.y) + sB).b;",',
        '                "        bloomColor.r += texture2D(uSampler, uv + vec2(-offB.x, offB.y) - sB).r;",',
        '                "        bloomColor.g += texture2D(uSampler, uv + vec2(-offB.x, offB.y)).g;",',
        '                "        bloomColor.b += texture2D(uSampler, uv + vec2(-offB.x, offB.y) + sB).b;",',
        '                "        bloomColor.r += texture2D(uSampler, uv + vec2(offB.x, offB.y) - sB).r;",',
        '                "        bloomColor.g += texture2D(uSampler, uv + vec2(offB.x, offB.y)).g;",',
        '                "        bloomColor.b += texture2D(uSampler, uv + vec2(offB.x, offB.y) + sB).b;",',
        '                "        bloomColor /= 5.0;",',
        '                "        float blumLum = dot(bloomColor, vec3(0.299, 0.587, 0.114));",',
        '                "        float bright = max(0.0, blumLum - uBloomThresh);",',
        '                "        color.rgb += bloomColor * bright * uBloom;",',
        '                "    }",',
        '                "    float scanline = sin(uv.y * 800.0) * 0.04 * uScanline * uIntensity;",',
        '                "    color.rgb -= scanline;",',
        '                "    float noise = (rand(uv + vec2(uNoiseTime)) - 0.5) * 0.15 * uNoise * uIntensity;",',
        '                "    color.rgb += noise;",',
        '                "    color.r += uColorTemp * 0.15;",',
        '                "    color.b -= uColorTemp * 0.15;",',
        '                "    color.rgb *= uBrightness;",',
        '                "    color.rgb = (color.rgb - 0.5) * uContrast + 0.5;",',
        '                "    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));",',
        '                "    vec3 gray = vec3(luminance);",',
        '                "    color.rgb = mix(gray, color.rgb, uSaturation);",',
        '                "    color.rgb += (color.rgb - baseColor) * uSharpen;",',
        '                "    gl_FragColor = color;",',
        '                "}",',
        '            ].join("\\n");',
        '            var parsedPresets = {};',
        '',
        '            var getSuperDuperConfig = function() {',
        '                if (typeof $gameSystem !== "undefined" && $gameSystem && $gameSystem._superDuperConfig) {',
        '                    if (!$gameSystem._superDuperTarget) {',
        '                        $gameSystem._superDuperTarget = JSON.parse(JSON.stringify($gameSystem._superDuperConfig));',
        '                        $gameSystem._superDuperFrames = {};',
        '                    }',
        '                    if (!$gameSystem._superDuperSavedPresets) {',
        '                        $gameSystem._superDuperSavedPresets = {};',
        '                    }',
        '                    return $gameSystem._superDuperConfig;',
        '                }',
        '                return defaultSettings;',
        '            };',
        '',
        '            function RRScreenFilter() {',
        '                PIXI.Filter.call(this, null, fragmentSrc);',
        '                this.uniforms.uWaveTime = 0.0;',
        '                this.uniforms.uNoiseTime = 0.0;',
        '                this.uniforms.uResolution = [scrW, scrH];',
        '                this.updateUniforms(getSuperDuperConfig());',
        '            }',
        '            RRScreenFilter.prototype = Object.create(PIXI.Filter.prototype);',
        '            RRScreenFilter.prototype.constructor = RRScreenFilter;',
        '            RRScreenFilter.prototype.apply = function(filterManager, input, output, clear) {',
        '                var tw = input.width || scrW;',
        '                var th = input.height || scrH;',
        '                if (input.size) {',
        '                    tw = input.size.width;',
        '                    th = input.size.height;',
        '                }',
        '                var sw = input.sourceFrame ? input.sourceFrame.width : tw;',
        '                var sh = input.sourceFrame ? input.sourceFrame.height : th;',
        '                this.uniforms.uResolution[0] = sw;',
        '                this.uniforms.uResolution[1] = sh;',
        '                PIXI.Filter.prototype.apply.call(this, filterManager, input, output, clear);',
        '            };',
        '            RRScreenFilter.prototype.updateTime = function() {',
        '                this.uniforms.uWaveTime = (this.uniforms.uWaveTime + 0.05) % (Math.PI * 2);',
        '                this.uniforms.uNoiseTime = (this.uniforms.uNoiseTime + 0.01) % 1.0;',
        '            };',
        '            RRScreenFilter.prototype.updateUniforms = function(config) {',
        '                var u = this.uniforms;',
        '                u.uIntensity = config.intensity;',
        '                u.uBlur = config.blur;',
        '                u.uBloom = config.bloom;',
        '                u.uBloomThresh = config.bloomthresh;',
        '                u.uColorTemp = config.colortemp;',
        '                u.uSharpen = config.sharpen;',
        '                u.uWave = config.wave;',
        '                u.uChroma = config.chroma;',
        '                u.uScanline = config.scanline;',
        '                u.uNoise = config.noise;',
        '                u.uSaturation = config.saturation;',
        '                u.uContrast = config.contrast;',
        '                u.uBrightness = config.brightness;',
        '            };',
        '            RR.RRScreenFilter = RRScreenFilter;',
        '',
        '            if (typeof Game_System !== "undefined" && Game_System.prototype) {',
        '                var rrGsInit = Game_System.prototype.initialize;',
        '                Game_System.prototype.initialize = function() {',
        '                    rrGsInit.call(this);',
        '                    this._superDuperConfig = JSON.parse(JSON.stringify(defaultSettings));',
        '                    this._superDuperTarget = JSON.parse(JSON.stringify(defaultSettings));',
        '                    this._superDuperFrames = {};',
        '                    this._superDuperSavedPresets = {};',
        '                };',
        '            }',
        '',
        '            // Per-scene lifecycle, verbatim plugin shape: a fresh filter',
        '            // per scene start, per-frame updateSuperDuperFilter with',
        '            // filterArea + interpolation + updateTime/updateUniforms.',
        '            var rrSbs = Scene_Base.prototype.start;',
        '            Scene_Base.prototype.start = function() {',
        '                rrSbs.apply(this, arguments);',
        '                this._superDuperFilter = new RRScreenFilter();',
        '            };',
        '            var rrSbu = Scene_Base.prototype.update;',
        '            Scene_Base.prototype.update = function() {',
        '                rrSbu.apply(this, arguments);',
        '                RR.updateSuperDuperFilter.call(this);',
        '            };',
        '            RR.updateSuperDuperFilter = function() {',
        '                if (!this._superDuperFilter) return;',
        '                var config = getSuperDuperConfig();',
        '                var targets = (typeof $gameSystem !== "undefined" && $gameSystem) ? $gameSystem._superDuperTarget : null;',
        '                var frames = (typeof $gameSystem !== "undefined" && $gameSystem) ? $gameSystem._superDuperFrames : null;',
        '                if (config && targets && frames) {',
        '                    for (var key in frames) {',
        '                        if (frames[key] > 0) {',
        '                            config[key] += (targets[key] - config[key]) / frames[key];',
        '                            frames[key]--;',
        '                            if (frames[key] <= 0) config[key] = targets[key];',
        '                        }',
        '                    }',
        '                }',
        '                if (config.active) {',
        '                    var currentFilters = this.filters || [];',
        '                    if (currentFilters.indexOf(this._superDuperFilter) === -1) {',
        '                        var newFilters = currentFilters.slice();',
        '                        newFilters.push(this._superDuperFilter);',
        '                        this.filters = newFilters;',
        '                    }',
        '                    var sw2 = Graphics.boxWidth || config.screenWidth;',
        '                    var sh2 = Graphics.boxHeight || config.screenHeight;',
        '                    if (!this.filterArea) {',
        '                        this.filterArea = new Rectangle(0, 0, sw2, sh2);',
        '                    } else {',
        '                        this.filterArea.width = sw2;',
        '                        this.filterArea.height = sh2;',
        '                    }',
        '                    this._superDuperFilter.updateTime();',
        '                    this._superDuperFilter.updateUniforms(config);',
        '                } else {',
        '                    if (this.filters) {',
        '                        var index = this.filters.indexOf(this._superDuperFilter);',
        '                        if (index !== -1) {',
        '                            var nf = this.filters.slice();',
        '                            nf.splice(index, 1);',
        '                            this.filters = nf.length > 0 ? nf : null;',
        '                        }',
        '                        if (!this.filters) {',
        '                            this.filterArea = null;',
        '                        }',
        '                    }',
        '                }',
        '            };',
        '',
        '            // SUPERDUPER plugin command channel (plugin semantics: config',
        '            // only; the per-frame update applies it).',
        '            var rrOrigPc = (typeof Game_Interpreter !== "undefined" && Game_Interpreter.prototype) ? Game_Interpreter.prototype.pluginCommand : null;',
        '            if (typeof Game_Interpreter !== "undefined" && Game_Interpreter.prototype) {',
        '                Game_Interpreter.prototype.pluginCommand = function(command, args) {',
        '                    if (rrOrigPc) rrOrigPc.call(this, command, args);',
        '                    if (!command || String(command).toUpperCase() !== "SUPERDUPER") return;',
        '                    var gs = (typeof $gameSystem !== "undefined" && $gameSystem && $gameSystem._superDuperConfig) ? $gameSystem : null;',
        '                    if (!gs) return;',
        '                    var action = args[0] ? String(args[0]).toUpperCase() : "";',
        '                    if (action === "ON") {',
        '                        gs._superDuperConfig.active = true;',
        '                    } else if (action === "OFF") {',
        '                        gs._superDuperConfig.active = false;',
        '                    } else if (action === "SAVE_PRESET" && args[1]) {',
        '                        var pName = String(args[1]).toLowerCase();',
        '                        var currentConfig = Object.assign({}, gs._superDuperConfig);',
        '                        delete currentConfig.active;',
        '                        delete currentConfig.screenWidth;',
        '                        delete currentConfig.screenHeight;',
        '                        gs._superDuperSavedPresets[pName] = currentConfig;',
        '                    } else if (action === "PRESET" && args[1]) {',
        '                        var p2 = String(args[1]).toLowerCase();',
        '                        var duration = Number(args[2]) || 0;',
        '                        var targetPreset = gs._superDuperSavedPresets[p2] || parsedPresets[p2];',
        '                        if (targetPreset) {',
        '                            for (var key2 in targetPreset) {',
        '                                if (targetPreset.hasOwnProperty(key2) && gs._superDuperConfig.hasOwnProperty(key2)) {',
        '                                    if (duration > 0) {',
        '                                        gs._superDuperTarget[key2] = targetPreset[key2];',
        '                                        gs._superDuperFrames[key2] = duration;',
        '                                    } else {',
        '                                        gs._superDuperConfig[key2] = targetPreset[key2];',
        '                                        gs._superDuperTarget[key2] = targetPreset[key2];',
        '                                        gs._superDuperFrames[key2] = 0;',
        '                                    }',
        '                                }',
        '                            }',
        '                        }',
        '                    } else if (action === "SET" && args[1]) {',
        '                        var param = String(args[1]).toLowerCase();',
        '                        var value = Number(args[2]);',
        '                        var dur = Number(args[3]) || 0;',
        '                        if (!isNaN(value) && gs._superDuperConfig.hasOwnProperty(param)) {',
        '                            if (dur > 0) {',
        '                                gs._superDuperTarget[param] = value;',
        '                                gs._superDuperFrames[param] = dur;',
        '                            } else {',
        '                                gs._superDuperConfig[param] = value;',
        '                                gs._superDuperTarget[param] = value;',
        '                                gs._superDuperFrames[param] = 0;',
        '                            }',
        '                        }',
        '                    }',
        '                };',
        '            }',
        '',
        '            // 727 talks to the same config the plugin way.',
        '            RR.screen.crt = {',
        '                filter: null,',
        '                get active() {',
        '                    var gs = (typeof $gameSystem !== "undefined" && $gameSystem && $gameSystem._superDuperConfig) ? $gameSystem : null;',
        '                    return !!(gs ? gs._superDuperConfig.active : defaultSettings.active);',
        '                },',
        '                setActive: function(on) {',
        '                    var gs = (typeof $gameSystem !== "undefined" && $gameSystem && $gameSystem._superDuperConfig) ? $gameSystem : null;',
        '                    if (gs) gs._superDuperConfig.active = !!on;',
        '                    else defaultSettings.active = !!on;',
        '                },',
        '                applyPreset: function(name) {',
        '                    var gs = (typeof $gameSystem !== "undefined" && $gameSystem && $gameSystem._superDuperConfig) ? $gameSystem : null;',
        '                    var store = gs ? (gs._superDuperSavedPresets || {}) : {};',
        '                    var key = String(name || "").toLowerCase();',
        '                    return !!(store[key] || parsedPresets[key]);',
        '                },',
        '                registerPreset: function(name, s) { parsedPresets[String(name).toLowerCase()] = s; }',
        '            };',
        '        },',
        '',
        '        installInputHardening: function() {',
        '            if (window.__rrInputHardened) return;',
        '            window.__rrInputHardened = true;',
        '            // (1) Drop synthetic (!isTrusted) input events before any',
        '            // game handler sees them. Nothing in the game dispatches',
        '            // synthetic input legitimately; a scripted keydown/mousedown',
        '            // used to reach MV handlers and phantom-press menus.',
        '            var rrBlockSynthetic = function(ev) {',
        '                if (ev && ev.isTrusted === false) {',
        '                    ev.stopPropagation();',
        '                    try { ev.preventDefault(); } catch (e) {}',
        '                }',
        '            };',
        '            ["keydown", "keyup", "mousedown", "mouseup", "click",',
        '             "touchstart", "touchend"].forEach(function(t) {',
        '                window.addEventListener(t, rrBlockSynthetic, true);',
        '            });',
        '            // (2) Gamepad drift guard. MV maps a pad button to an action',
        '            // on the pressed EDGE (Input._updateGamepadState), so a',
        '            // single-frame spike from a drifting or virtual controller',
        '            // injects a full "ok" press (title auto-started a new game',
        '            // after idle). A press must survive two consecutive polls',
        '            // before the engine sees it; releases pass immediately.',
        '            if (typeof Input !== "undefined" && typeof Input._updateGamepadState === "function") {',
        '                var rrOrigPadState = Input._updateGamepadState;',
        '                Input._updateGamepadState = function(gamepad) {',
        '                    try {',
        '                        var idx = gamepad.index;',
        '                        var raw = this.__rrPadRaw || (this.__rrPadRaw = {});',
        '                        var btns = gamepad.buttons || [];',
        '                        var cur = [];',
        '                        for (var i = 0; i < btns.length; i++) {',
        '                            cur[i] = !!(btns[i] && btns[i].pressed);',
        '                        }',
        '                        var prev = raw[idx];',
        '                        raw[idx] = cur;',
        '                        if (prev && prev.length) {',
        '                            var stable = [];',
        '                            for (var j = 0; j < btns.length; j++) {',
        '                                var rawPressed = !!(btns[j] && btns[j].pressed);',
        '                                var btn = { pressed: rawPressed && prev[j] === true,',
        '                                    value: btns[j] ? btns[j].value : 0 };',
        '                                stable[j] = btn;',
        '                            }',
        '                            return rrOrigPadState.call(this, {',
        '                                index: idx, axes: gamepad.axes, buttons: stable',
        '                            });',
        '                        }',
        '                    } catch (e) {}',
        '                    return rrOrigPadState.apply(this, arguments);',
        '                };',
        '            }',
        '            // (3) Phantom-OK diagnostic: if the title command window',
        '            // confirms with no trusted input anywhere in the recent',
        '            // window, say so loudly once (source hunt for leftovers).',
        '            var rrLastTrustedInput = -1e9;',
        '            window.addEventListener("keydown", function() { rrLastTrustedInput = Date.now(); }, true);',
        '            window.addEventListener("mousedown", function() { rrLastTrustedInput = Date.now(); }, true);',
        '            if (typeof Window_TitleCommand !== "undefined" && Window_TitleCommand.prototype) {',
        '                var rrOrigTitleOk = Window_TitleCommand.prototype.processOk;',
        '                Window_TitleCommand.prototype.processOk = function() {',
        '                    if (Date.now() - rrLastTrustedInput > 1500 && !window.__rrPhantomReported) {',
        '                        window.__rrPhantomReported = true;',
        '                        var pads = "";',
        '                        try {',
        '                            var gp = navigator.getGamepads ? navigator.getGamepads() : [];',
        '                            for (var gi = 0; gi < gp.length; gi++) {',
        '                                if (gp[gi]) pads += (pads ? "; " : "") + gp[gi].id;',
        '                            }',
        '                        } catch (e) {}',
        '                        console.warn("[Agonia] Title OK without recent trusted input!" +',
        '                            " latest=" + (typeof Input !== "undefined" ? Input._latestButton : "?") +',
        '                            " pads=[" + pads + "]");',
        '                    }',
        '                    return rrOrigTitleOk.apply(this, arguments);',
        '                };',
        '            }',
        '        },',
        '        // ===================== No-Battle amputation =====================',
        '        // The project never enters Scene_Battle (combat is action-based',
        '        // via SuperDuperBattle). This removes the standard turn-based',
        '        // battle from the RUNTIME after plugins load: entry points are',
        '        // stubbed and the battle UI classes deleted. Game_* data',
        '        // classes (Game_Troop, Game_Actor...) stay - saves contain',
        '        // them and JsonEx needs live constructors to revive them.',
        '        installNoBattle: function() {',
        '            var warn = function(what) {',
        '                try { console.warn("[Agonia] Standard battle removed: " + what); } catch (e) {}',
        '            };',
        '            var GI = typeof Game_Interpreter !== "undefined" ? Game_Interpreter : null;',
        '            if (GI && GI.prototype) {',
        '                // 301: Battle Processing - refuse to start a battle.',
        '                GI.prototype.command301 = function() { warn("Battle Processing (301) skipped"); return true; };',
        '                // 331-337/339/340/342: enemy ops inside a battle -',
        '                // they only mean anything in a battle that cannot start.',
        '                [331, 332, 333, 334, 335, 336, 337, 339, 340, 342].forEach(function(code) {',
        '                    GI.prototype["command" + code] = function() { return true; };',
        '                });',
        '                // Battle-only system/actor commands: battle music/ME',
        '                // (132/133/139), encounters (136), battle background',
        '                // (283), animations (212 - Animations.json is a stub),',
        '                // actor states (313 - States.json is a stub) and TP',
        '                // (326 - a battle-only resource).',
        '                [132, 133, 136, 139, 212, 283, 313, 326].forEach(function(code) {',
        '                    GI.prototype["command" + code] = function() { return true; };',
        '                });',
        '            }',
        '            if (typeof DataManager !== "undefined" && DataManager.isBattleTest) {',
        '                DataManager.isBattleTest = function() { return false; };',
        '            }',
        '            if (typeof BattleManager !== "undefined" && BattleManager.setup) {',
        '                BattleManager.setup = function(troopId, canEscape, canLose) { warn("BattleManager.setup blocked"); };',
        '                BattleManager.startBattle = function() { warn("BattleManager.startBattle blocked"); };',
        '            }',
        '            if (typeof Game_Player !== "undefined" && Game_Player.prototype) {',
        '                Game_Player.prototype.updateEncounter = function() {};',
        '                Game_Player.prototype.encounterProgressValue = function() { return 0; };',
        '            }',
        '            // Delete the battle UI classes. Must run AFTER plugin',
        '            // scripts (HUDMaker/Camera/etc alias Scene_Battle at',
        '            // load time), and PluginManager.setup returns before',
        '            // async=false scripts execute - so do it once on the',
        '            // first map start, when every script has run and the',
        '            // aliases are already bound (they stay as dead code:',
        '            // nothing can reach the scene).',
        '            var battleClasses = ["Scene_Battle", "Spriteset_Battle",',
        '                "Window_BattleLog", "Window_BattleStatus", "Window_BattleEnemy",',
        '                "Window_BattleSkill", "Window_BattleItem", "Window_PartyCommand",',
        '                "Window_ActorCommand", "Window_BattleSkillVisible"];',
        '            var RRNB = window.__RRNoBattle;',
        '            if (!RRNB) {',
        '                RRNB = window.__RRNoBattle = { purge: function() {',
        '                    for (var i = 0; i < battleClasses.length; i++) {',
        '                        var name = battleClasses[i];',
        '                        try { window[name] = undefined; delete window[name]; } catch (e) {}',
        '                    }',
        '                    RRNB.done = true;',
        '                }, done: false };',
        '                if (typeof Scene_Map !== "undefined" && Scene_Map.prototype) {',
        '                    var rrNBStart = Scene_Map.prototype.start;',
        '                    Scene_Map.prototype.start = function() {',
        '                        var r = rrNBStart.apply(this, arguments);',
        '                        if (!RRNB.done) RRNB.purge();',
        '                        return r;',
        '                    };',
        '                }',
        '            }',
        '        },',
        '        installCommands: function() {',
        '            RR.installInputHardening();',
        '            var GI = typeof Game_Interpreter !== "undefined" ? Game_Interpreter : null;',
        '            if (!GI || !GI.prototype) return;',
        '            var p = GI.prototype;',
        '            if (p.__agoniaNative) return;',
        '            p.__agoniaNative = true;',
        '            // MV dispatch contract: executeCommand assigns',
        '            // this._params and invokes the handler with NO arguments',
        '            // (see MV Game_Interpreter.command356 reading',
        '            // this._params[0]). Our handlers follow the MZ convention',
        '            // f(params). Wrap each one so a no-arg call resolves',
        '            // params from this._params — otherwise params is',
        '            // undefined and the first params[0] read throws on MV.',
        '            var rrAdapt = function(fn) {',
        '                return function(params) {',
        '                    if (params === undefined || params === null) {',
        '                        params = this._params || [];',
        '                    }',
        '                    return fn.call(this, params);',
        '                };',
        '            };',
        '',
        '            p._rrChestItems = function(id) {',
        '                var s = id === undefined ? "" : String(id);',
        '                if (!s.trim()) return null;',
        '                if (typeof $gameSystem === "undefined" || !$gameSystem || !$gameSystem.getChestItems) return null;',
        '                return $gameSystem.getChestItems(s);',
        '            };',
        '            p._rrItemRef = function(type, id) {',
        '                var table = Number(type) === 1 ? $dataWeapons : Number(type) === 2 ? $dataArmors : $dataItems;',
        '                return (table && table[Number(id)]) || null;',
        '            };',
        '            p._rrSlotType = function(item) {',
        '                if (!item) return -1;',
        '                if (item.itypeId !== undefined) return 0;',
        '                if (typeof $dataWeapons !== "undefined" && $dataWeapons) {',
        '                    for (var i = 0; i < $dataWeapons.length; i++) {',
        '                        if ($dataWeapons[i] && $dataWeapons[i].id === item.id) return 1;',
        '                    }',
        '                }',
        '                return 2;',
        '            };',
        '',
        '            p.command700 = function(params) {',
        '                var type = Number(params[0] || 0);',
        '                var mode = Number(params[2] || 0);',
        '                var duration = Math.max(0, Number(params[3] || 0));',
        '                var color = String(params[4] || "").trim();',
        '                var preset = String(params[5] || "").trim();',
        '                var mult = params[6];',
        '                var args = [mode === 1 ? "radiusgrow" : "radius", String(Number(params[1] || 0))];',
        '                if (duration > 0) args.push("t" + duration);',
        '                if (color) args.push(color);',
        '                // SDLight positional parsing hazard: a NUMERIC token after',
        '                // the preset slot is re-parsed as a numeric PRESET id (\'1\'',
        '                // exists in the fallback table) and overwrites the named',
        '                // preset. A vignette multiplier of 1 is the default anyway,',
        '                // so emitting it only corrupts the preset - skip the no-op',
        '                // value and only pass a mult the user actually changed.',
        '                var multNum = Number(mult);',
        '                var multIsNoop = mult === "" || mult === undefined || mult === null',
        '                    || (!isNaN(multNum) && multNum === 1);',
        '                if (preset) args.push(preset);',
        '                if (!multIsNoop) args.push(String(mult));',
        '                this.pluginCommand(type === 1 ? "fire" : "light", args);',
        '                return true;',
        '            };',
        '            p.command701 = function(params) {',
        '                var on = Number(params[0]) === 1;',
        '                var target = Number(params[2] || 0); // 0 event light, 1 player light',
        '                if (target === 1) {',
        '                    // Player light: bare Light on/off',
        '                    this.pluginCommand("Light", [on ? "on" : "off"]);',
        '                } else {',
        '                    this.pluginCommand("Light", [on ? "on" : "off", String(Number(params[1] || 0))]);',
        '                }',
        '                return true;',
        '            };',
        '            p.command702 = function(params) {',
        '                var on = Number(params[1]) === 1;',
        '                this.pluginCommand("RegionBlock", on',
        '                    ? [String(Number(params[0] || 0)), "ON", String(params[2] || "#000000")]',
        '                    : [String(Number(params[0] || 0)), "OFF"]);',
        '                return true;',
        '            };',
        '            p.command703 = function(params) {',
        '                var fade = Number(params[0]) === 1;',
        '                var args = [fade ? "fade" : "set", String(params[1] || "#000000")];',
        '                if (fade) args.push(String(Math.max(1, Number(params[2] || 60))));',
        '                this.pluginCommand("Tint", args);',
        '                return true;',
        '            };',
        '            p.command704 = function(params) {',
        '                var state = Number(params[1] || 0);',
        '                var args = [String(Number(params[0] || 1)), state === 1 ? "on" : state === 2 ? "toggle" : "off"];',
        '                var mapId = Number(params[2] || 0);',
        '                if (mapId > 0) args.push(String(mapId));',
        '                this.pluginCommand("LocalSwitch", args);',
        '                return true;',
        '            };',
        '            p.command710 = function(params) {',
        '                this.pluginCommand("ZoomIn", [String(Number(params[0] || 1)), String(Math.max(0, Number(params[1] || 0)))]);',
        '                if (Number(params[2]) === 1 && this.setWaitMode) this.setWaitMode("camera");',
        '                return true;',
        '            };',
        '            p.command711 = function(params) {',
        '                var target = Number(params[0] || 0);',
        '                var duration = Math.max(0, Number(params[4] || 0));',
        '                if (target === 1) this.pluginCommand("FocusCamera", ["event", String(Number(params[1] || 0)), String(duration)]);',
        '                else if (target === 2) this.pluginCommand("FocusCamera", [String(Number(params[2] || 0)), String(Number(params[3] || 0)), String(duration)]);',
        '                else this.pluginCommand("FocusCamera", ["player", String(duration)]);',
        '                if (Number(params[5]) === 1 && this.setWaitMode) this.setWaitMode("camera");',
        '                return true;',
        '            };',
        '            p.command712 = function(params) {',
        '                this.pluginCommand("ResetFocus", [String(Math.max(0, Number(params[0] || 0)))]);',
        '                return true;',
        '            };',
        '            p.command715 = function(params) {',
        '                var chestId = params && params.length ? String(params[0] || "") : "";',
        '                this.pluginCommand("VisualChestStored", chestId ? [chestId] : []);',
        '                return true;',
        '            };',
        '            p.command716 = function(params) {',
        '                var chest = this._rrChestItems(params[0]);',
        '                var item = this._rrItemRef(params[1], params[2]);',
        '                var fullSwitchId = Number(params[4] || 0);',
        '                if (chest && item && $gameSystem.addItemToChest) {',
        '                    var added = $gameSystem.addItemToChest(String(params[0] || ""), item, Math.max(1, Number(params[3] || 1)));',
        '                    if (fullSwitchId > 0 && typeof $gameSwitches !== "undefined") $gameSwitches.setValue(fullSwitchId, !added);',
        '                } else if (fullSwitchId > 0 && typeof $gameSwitches !== "undefined") {',
        '                    $gameSwitches.setValue(fullSwitchId, true);',
        '                }',
        '                return true;',
        '            };',
        '            p.command717 = function(params) {',
        '                var chest = this._rrChestItems(params[0]);',
        '                if (!chest) return true;',
        '                var itemType = Number(params[1] || 0);',
        '                var itemId = Number(params[2] || 0);',
        '                var left = Math.max(1, Number(params[3] || 1));',
        '                var toInv = Number(params[4] || 0) === 1;',
        '                for (var i = 0; i < chest.length && left > 0; i++) {',
        '                    var slot = chest[i];',
        '                    if (!slot || !slot.item || slot.item.id !== itemId) continue;',
        '                    if (this._rrSlotType(slot.item) !== itemType) continue;',
        '                    while (left > 0 && slot.amount > 0) {',
        '                        slot.amount--; left--;',
        '                        if (toInv && typeof $gameParty !== "undefined" && $gameParty.gainItem) $gameParty.gainItem(slot.item, 1);',
        '                    }',
        '                    if (slot.amount <= 0) chest[i] = null;',
        '                }',
        '                return true;',
        '            };',
        '            p.command718 = function(params) {',
        '                var chest = this._rrChestItems(params[0]);',
        '                if (chest) { for (var i = 0; i < chest.length; i++) chest[i] = null; }',
        '                return true;',
        '            };',
        '            p.command719 = function(params) {',
        '                var chest = this._rrChestItems(params[0]);',
        '                var variableId = Number(params[1] || 0);',
        '                var mode = Number(params[2] || 0);',
        '                if (!chest) {',
        '                    if (variableId > 0 && typeof $gameVariables !== "undefined") $gameVariables.setValue(variableId, 0);',
        '                    return true;',
        '                }',
        '                var value = 0;',
        '                var i;',
        '                if (mode === 1) {',
        '                    var empty = true;',
        '                    for (i = 0; i < chest.length; i++) if (chest[i]) { empty = false; break; }',
        '                    value = empty ? 1 : 0;',
        '                } else if (mode === 2) {',
        '                    for (i = 0; i < chest.length; i++) if (chest[i]) value++;',
        '                } else if (mode === 3 || mode === 4) {',
        '                    var itemType = Number(params[3] || 0);',
        '                    var itemId = Number(params[4] || 0);',
        '                    var found = false;',
        '                    for (i = 0; i < chest.length; i++) {',
        '                        var slot = chest[i];',
        '                        if (!slot || !slot.item || slot.item.id !== itemId || slot.amount <= 0) continue;',
        '                        if (this._rrSlotType(slot.item) !== itemType) continue;',
        '                        found = true;',
        '                        if (mode === 3) value += slot.amount;',
        '                    }',
        '                    if (mode === 4) value = found ? 1 : 0;',
        '                } else {',
        '                    for (i = 0; i < chest.length; i++) if (chest[i] && chest[i].amount > 0) value += chest[i].amount;',
        '                }',
        '                if (variableId > 0 && typeof $gameVariables !== "undefined") $gameVariables.setValue(variableId, value);',
        '                return true;',
        '            };',
        '            p.command720 = function(params) {',
        '                var category = String(params[0] || "").trim();',
        '                if (!category) return true;',
        '                var min = Math.max(1, Number(params[1] || 1));',
        '                var max = Math.max(min, Number(params[2] || min));',
        '                this.pluginCommand("SDL", ["Give", category, min === max ? String(min) : min + "-" + max]);',
        '                return true;',
        '            };',
        '            p.command721 = function(params) {',
        '                var phase = String(params[0] || "").trim();',
        '                if (!phase) return true;',
        '                if (phase === "__reset_all") this.pluginCommand("SDE", ["RESET_ALL", "SELF"]);',
        '                else this.pluginCommand("SDE", ["SET_FLAG", "SELF", phase, Number(params[1]) === 1 ? "ON" : "OFF"]);',
        '                return true;',
        '            };',
        '            p.command722 = function(params) {',
        '                var op = Number(params[0] || 0);',
        '                if (op === 1) this.pluginCommand("MEHP_SET", [String(Number(params[1]) || 0)]);',
        '                else if (op === 2) this.pluginCommand("MEHP_GET", [String(Math.max(1, Number(params[2]) || 1))]);',
        '                else this.pluginCommand("MEHP_ADD", [String(Number(params[1]) || 0)]);',
        '                return true;',
        '            };',
        '            p.command723 = function(params) {',
        '                var phase = String(params[0] || "").trim();',
        '                if (!phase || typeof $gameMap === "undefined" || !$gameMap) return true;',
        '                var state = Number(params[1]) === 1 ? "ON" : "OFF";',
        '                var events = $gameMap.events();',
        '                for (var i = 0; i < events.length; i++) {',
        '                    var ev = events[i];',
        '                    if (ev && ev.eventId) this.pluginCommand("SDE", ["SET_FLAG", String(ev.eventId()), phase, state]);',
        '                }',
        '                return true;',
        '            };',
        '            p.command724 = function(params) {',
        '                var chestId = String(params[0] || "").trim() || "this";',
        '                var category = String(params[1] || "").trim();',
        '                if (!category) return true;',
        '                var min = Math.max(1, Number(params[2] || 1));',
        '                var max = Math.max(min, Number(params[3] || min));',
        '                var args = ["FillChest", chestId, category, min === max ? String(min) : min + "-" + max, String(Math.max(1, Number(params[4] || 1)))];',
        '                var mv = params[5];',
        '                if (mv !== "" && mv !== undefined && mv !== null) args.push(String(Math.max(1, Number(mv))));',
        '                this.pluginCommand("SDL", args);',
        '                return true;',
        '            };',
        '            p.command725 = function(params) {',
        '                var operation = Number(params[0] || 0);',
        '                if (operation === 1) this.pluginCommand("Stamina", ["fill"]);',
        '                else if (operation === 2) this.pluginCommand("Stamina", ["exhaust"]);',
        '                else this.pluginCommand("Stamina", ["add", String(Number(params[1] || 0))]);',
        '                return true;',
        '            };',
        '            p.command726 = function(params) {',
        '                var target = Number(params[0] || 0);',
        '                if (target === 1) this.pluginCommand("AltimitDash", ["playerDash", String(params[2] || "")]);',
        '                else if (target === 2) this.pluginCommand("AltimitDash", ["eventDash", String(Number(params[1] || 0)), String(params[2] || "")]);',
        '                else this.pluginCommand("AltimitDash", ["dash", String(params[2] || "")]);',
        '                return true;',
        '            };',
        '            p.command728 = function(params) {',
        '                var mode = Number(params[0] || 0);',
        '                var anchor = Number(params[1] || 0);',
        '                var eventId = anchor === 1 ? Number(params[2] || 0) : Number(this._eventId || 0);',
        '                if (mode === 2) {',
        '                    if (eventId > 0) this.pluginCommand("clear_aex", [String(eventId)]);',
        '                    else this.pluginCommand("clear_aex", ["this"]);',
        '                    return true;',
        '                }',
        '                if (typeof AudioManager === "undefined" || !AudioManager.playBgs || !AudioManager.playSe) return true;',
        '                var name = String(mode === 1 ? params[4] : params[3] || "").trim();',
        '                if (!name) return true;',
        '                var audio = {',
        '                    name: name,',
        '                    volume: Math.max(0, Math.min(100, Number(params[5] || 90))),',
        '                    pitch: Math.max(50, Math.min(150, Number(params[6] || 100))),',
        '                    pan: 0',
        '                };',
        '                if (!eventId) {',
        '                    // No anchor event (common event context): positional',
        '                    // falloff has no origin, so play map-wide instead of',
        '                    // spawning a silent source.',
        '                    if (mode === 1) AudioManager.playSe(audio);',
        '                    else AudioManager.playBgs(audio);',
        '                    return true;',
        '                }',
        '                var types = ["d", "x", "y", "bg"];',
        '                var flag = function(v, dflt) { return (v === undefined || v === "") ? dflt : Number(v) === 1; };',
        '                var aex = {',
        '                    type: types[Number(params[10] || 0)] || "d",',
        '                    distance: Math.max(0, Number(params[7] === undefined ? 20 : params[7])),',
        '                    radius: Math.max(0, Number(params[8] || 0)),',
        '                    fade: Math.max(0, Number(params[9] === undefined ? 2 : params[9])),',
        '                    pan: flag(params[11], true),',
        '                    forced: true,',
        '                    "new": mode === 1 ? true : flag(params[12], true),',
        '                    started: false,',
        '                    dynamic: true,',
        '                    commandIndex: 0,',
        '                    eventId: eventId,',
        '                    linkedEvents: [eventId]',
        '                };',
        '                if (aex.type === "bg") {',
        '                    // Mirror the plugin comment parser: background plays',
        '                    // everywhere at full volume, no positioning.',
        '                    aex.dynamic = false; aex.pan = false;',
        '                    aex.distance = 0; aex.radius = 0;',
        '                }',
        '                if (mode === 1) AudioManager.playSe(audio, aex);',
        '                else { audio.AEX = aex; AudioManager.playBgs(audio); }',
        '                return true;',
        '            };',
        '            p.command730 = function(params) {',
        '                this.pluginCommand("WaitAsync", [String(Math.max(0, Number(params[0] || 0)))]);',
        '                return true;',
        '            };',
        '            p.command731 = function(params) {',
        '                var target = Number(params[0] || 0);',
        '                var frames = Number(params[2] || 0);',
        '                if (target === 1) this.pluginCommand("SDDF", ["FLASH", "PLAYER"]);',
        '                else if (target === 2) this.pluginCommand("SDDF", ["FLASH", "EVENT", String(Number(params[1] || 0))]);',
        '                else if (frames > 0) this.pluginCommand("SDDF", ["FLASH", String(frames)]);',
        '                else this.pluginCommand("SDDF", ["FLASH"]);',
        '                return true;',
        '            };',
        '            p.command732 = function() { this.pluginCommand("SaveToSamsara", []); return true; };',
        '            p.command733 = function() { this.pluginCommand("LoadFromSamsara", []); return true; };',
        '            p.command734 = function() { this.pluginCommand("CraftSystem", ["open"]); return true; };',
        '            p.command735 = function(params) {',
        '                var mode = Number(params[0] || 0); // 0 show, 1 hide, 2 clear',
        '                if (mode === 2) { this.pluginCommand("Hint", ["clear"]); return true; }',
        '                if (mode === 1) { this.pluginCommand("Hint", ["hide"]); return true; }',
        '                var args = ["show_preset"];',
        '                var preset = String(params[1] || "");',
        '                var text = String(params[2] || "");',
        '                var iconId = params[3];',
        '                if (iconId !== undefined && iconId !== null && iconId !== "") {',
        '                    args = ["show_preset_icon", preset];',
        '                    args.push(String(iconId));',
        '                    if (text) args.push(text);',
        '                } else {',
        '                    if (preset) args.push(preset);',
        '                    if (text) args.push(text);',
        '                }',
        '                this.pluginCommand("Hint", args);',
        '                return true;',
        '            };',
        '            p.command736 = function(params) {',
        '                var markId = String(params[0] || "").trim();',
        '                if (typeof window !== "undefined" && typeof window.mark === "function") window.mark(markId);',
        '                return true;',
        '            };',
        '            p.command737 = function(params) {',
        '                var args = ["show"];',
        '                var preset = String(params[0] || "");',
        '                var text = String(params[1] || "");',
        '                if (preset) args.push(preset);',
        '                if (text) args.push(text);',
        '                this.pluginCommand("Title", args);',
        '                return true;',
        '            };',
        '            p.command740 = function(params) {',
        '                var mode = Number(params[0] === undefined ? -1 : params[0]);',
        '                var eventId = Number(params[1] || 0);',
        '                var duration = Math.max(10, Number(params[2] || 60));',
        '                var text = String(params[3] || "");',
        '                var target = mode === -1 ? (typeof $gamePlayer !== "undefined" ? $gamePlayer : null)',
        '                    : (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.event(eventId) : null);',
        '                if (!target) return true;',
        '                if (typeof $gameTemp !== "undefined" && $gameTemp) {',
        '                    if (!$gameTemp._rrTextPopQueue) $gameTemp._rrTextPopQueue = [];',
        '                    $gameTemp._rrTextPopQueue.push({ target: target, text: text, duration: duration });',
        '                }',
        '                return true;',
        '            };',
        '            p._rrSlideConfig = function() {',
        '                if (typeof $gameTemp === "undefined" || !$gameTemp) return null;',
        '                if (!$gameTemp._rrSlideConfig) {',
        '                    $gameTemp._rrSlideConfig = { title: "", text: "", faceName: "", faceIndex: 0, bgName: "" };',
        '                }',
        '                return $gameTemp._rrSlideConfig;',
        '            };',
        '            p.command741 = function(params) { var c = this._rrSlideConfig(); if (c) c.title = String(params[0] || ""); return true; };',
        '            p.command742 = function(params) { var c = this._rrSlideConfig(); if (c) c.text = String(params[0] || ""); return true; };',
        '            p.command743 = function(params) { var c = this._rrSlideConfig(); if (c) { c.faceName = String(params[0] || ""); c.faceIndex = Number(params[1] || 0); } return true; };',
        '            p.command744 = function(params) { var c = this._rrSlideConfig(); if (c) c.bgName = String(params[0] || ""); return true; };',
        '            p.command745 = function(params) {',
        '                if (typeof $gameTemp === "undefined" || !$gameTemp || !$gameTemp._rrSlideConfig) return true;',
        '                $gameTemp._rrSlideDuration = Math.max(30, Number(params[0] || 300));',
        '                $gameTemp._rrSlideActive = true;',
        '                this.setWaitMode("agoniaSlide");',
        '                return true;',
        '            };',
        '',
        '            // ---- Light pack (SDLight) ----',
        '            // 705: player light settings: [mode(color0/bright1/smooth2/preset3),',
        '            //      value, target(0 player/1 event id)]',
        '            p.command705 = function(params) {',
        '                var mode = Number(params[0] || 0);',
        '                var value = String(params[1] === undefined ? "" : params[1]);',
        '                var target = Number(params[2] || 0);',
        '                var args;',
        '                if (mode === 0) {',
        '                    // color: on an event light (#N) or the player',
        '                    if (target === 1) args = ["color", String(Number(params[3] || 0)), value];',
        '                    else args = ["color", value];',
        '                } else if (mode === 1) {',
        '                    args = ["brightness", value];',
        '                } else if (mode === 2) {',
        '                    args = ["smooth", value];',
        '                } else {',
        '                    args = ["preset", value];',
        '                }',
        '                this.pluginCommand("Light", args);',
        '                return true;',
        '            };',
        '            // 706: flicker on/off/toggle (bare fire semantics)',
        '            p.command706 = function(params) {',
        '                var state = Number(params[0] || 2);',
        '                if (state === 2) this.pluginCommand("fire", []);',
        '                else this.pluginCommand("Light", ["flicker", state === 1 ? "on" : "off"]);',
        '                return true;',
        '            };',
        '            // 707: flashlight [brightness]',
        '            p.command707 = function(params) {',
        '                var brightness = params[0];',
        '                var args = ["flashlight"];',
        '                if (brightness !== undefined && brightness !== null && brightness !== "") args.push(String(brightness));',
        '                this.pluginCommand("Light", args);',
        '                return true;',
        '            };',
        '            // 709: vignette color',
        '            p.command709 = function(params) {',
        '                this.pluginCommand("Vignette", ["color", String(params[0] || "#000000")]);',
        '                return true;',
        '            };',
        '',
        '            // ---- Camera pack (SuperDuperCamera) ----',
        '            // 713: shift camera [dx, dy, duration(0 instant)]',
        '            p.command713 = function(params) {',
        '                this.pluginCommand("ShiftCamera", [String(Number(params[0] || 0)),',
        '                    String(Number(params[1] || 0)), String(Math.max(0, Number(params[2] || 0)))]);',
        '                return true;',
        '            };',
        '            // 714: zoom control [mode(0 reset/1 set default), value, duration]',
        '            p.command714 = function(params) {',
        '                var mode = Number(params[0] || 0);',
        '                var duration = Math.max(0, Number(params[2] || 0));',
        '                if (mode === 1) {',
        '                    this.pluginCommand("SetDefaultZoom", [String(Number(params[1] || 1))]);',
        '                } else {',
        '                    this.pluginCommand("ResetZoom", [String(duration)]);',
        '                }',
        '                return true;',
        '            };',
        '',
        '            // ---- Screen/UI pack ----',
        '            // 727: CRT screen effect [mode(0 off/1 on/2 preset), name]',
        '            // Uses the system screen module when its CRT is installed',
        '            // (SuperDuperScreen retired); falls back to the plugin.',
        '            p.command727 = function(params) {',
        '                var mode = Number(params[0]);',
        '                if (!isFinite(mode)) mode = 1;',
        '                var name = String(params[1] || "");',
        '                if (RR.screen && RR.screen.crt) {',
        '                    if (mode === 2) {',
        '                        RR.screen.crt.applyPreset(name);',
        '                    } else {',
        '                        RR.screen.crt.setActive(mode !== 0);',
        '                    }',
        '                    return true;',
        '                }',
        '                var args = [mode === 0 ? "OFF" : mode === 2 ? "PRESET" : "ON"];',
        '                if (mode === 2) args.push(name || "Default");',
        '                this.pluginCommand("SUPERDUPER", args);',
        '                return true;',
        '            };',
        '            // 729: treasure popup visibility (MOG) [1 show / 0 hide]',
        '            p.command729 = function(params) {',
        '                this.pluginCommand(Number(params[0]) === 1 ? "show_treasure_popup" : "hide_treasure_popup", []);',
        '                return true;',
        '            };',
        '            // 738: text fast-forward (SuperDuperMessage) [0 enable/1 disable/2 disable next]',
        '            p.command738 = function(params) {',
        '                var mode = Number(params[0] || 0);',
        '                var cmd = mode === 1 ? "DISABLETEXTFF" : mode === 2 ? "DISABLENEXTTEXTFF" : "ENABLETEXTFF";',
        '                this.pluginCommand(cmd, []);',
        '                return true;',
        '            };',
        '',
        '            // ---- Misc pack ----',
        '            // 746: clear round items (SuperDuperDrop)',
        '            p.command746 = function() { this.pluginCommand("SDI_ClearRoundItems", []); return true; };',
        '            // 747: set save name (SuperDuperSave) [name]',
        '            p.command747 = function(params) {',
        '                this.pluginCommand("SetSaveName", [String(params[0] || "")]);',
        '                return true;',
        '            };',
        '            // 748: reset all event locations (YEP_SaveEventLocations)',
        '            p.command748 = function() { this.pluginCommand("ResetAllEventLocations", []); return true; };',
        '            // 749: enemy HP variable binding (SuperDuperEnemies MEHP_SETUP) [variableId]',
        '            p.command749 = function(params) {',
        '                this.pluginCommand("MEHP_SETUP", [String(Math.max(1, Number(params[0] || 1)))]);',
        '                return true;',
        '            };',
        '            // 750: hide a show-choices option by index with a switch condition',
        '            //      (native replacement for the legacy hide_choice script call)',
        '            //      params: [choiceIndex(1-based), switchId]',
        '            p.command750 = function(params) {',
        '                try {',
        '                    var index = Math.max(1, Number(params[0] || 1));',
        '                    var switchId = Math.max(0, Number(params[1] || 0));',
        '                    var hidden = switchId > 0',
        '                        ? (typeof $gameSwitches !== "undefined" && $gameSwitches.value(switchId))',
        '                        : true;',
        '                    if (!hidden) return true;',
        '                    if (typeof $gameMessage !== "undefined" && $gameMessage && $gameMessage._choices) {',
        '                        $gameMessage._choices.splice(index - 1, 1);',
        '                    }',
        '                } catch (e) {}',
        '                return true;',
        '            };',
        '            // 751: gift (SuperDuperGifts script call) [actorName, itemId]',
        '            p.command751 = function(params) {',
        '                try {',
        '                    if (typeof window !== "undefined" && typeof window.gift === "function") {',
        '                        window.gift(String(params[0] || ""), Number(params[1] || 0));',
        '                    }',
        '                } catch (e) {}',
        '                return true;',
        '            };',
        '',
        '            // Apply the MV dispatch adapter to every native command.',
        '            var rrCodes = [700, 701, 702, 703, 704, 705, 706, 707, 709, 710,',
        '                711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722,',
        '                723, 724, 725, 726, 727, 728, 729, 730, 731, 732, 733, 734, 735,',
        '                736, 737, 738, 740, 741, 742, 743, 744, 745, 746, 747, 748,',
        '                749, 750, 751];',
        '            for (var rrI = 0; rrI < rrCodes.length; rrI++) {',
        '                var rrName = "command" + rrCodes[rrI];',
        '                if (typeof p[rrName] === "function") {',
        '                    p[rrName] = rrAdapt(p[rrName]);',
        '                }',
        '            }',
        '',
        '            var rrUpdateWaitMode = p.updateWaitMode;',
        '            if (typeof rrUpdateWaitMode === "function") {',
        '                p.updateWaitMode = function() {',
        '                    if (this._waitMode === "agoniaSlide") {',
        '                        return !!(typeof $gameTemp !== "undefined" && $gameTemp && $gameTemp._rrSlideActive);',
        '                    }',
        '                    return rrUpdateWaitMode.apply(this, arguments);',
        '                };',
        '            }',
        '',
        '            RR.installPresentation();',
        '        },',
        '        textColor: function(n) {',
        '            if (!RR._skin) {',
        '                try { RR._skin = ImageManager.loadSystem("Window"); } catch (e) { RR._skin = null; }',
        '            }',
        '            var skin = RR._skin;',
        '            if (skin && skin.isReady && skin.isReady()) {',
        '                var px = 96 + (n % 8) * 12 + 6;',
        '                var py = 64 + Math.floor(n / 8) * 12 + 6;',
        '                try { return skin.getPixel(px, py); } catch (e) {}',
        '            }',
        '            return "#ffffff";',
        '        },',
        '        parseColorCodes: function(text) {',
        '            var BS = String.fromCharCode(92);',
        '            var s = String(text || "");',
        '            var segments = [];',
        '            var color = 0;',
        '            var start = 0;',
        '            var i = 0;',
        '            while (i < s.length) {',
        '                if (s.charAt(i) === BS && (s.charAt(i + 1) === "c" || s.charAt(i + 1) === "C") && s.charAt(i + 2) === "[") {',
        '                    var close = s.indexOf("]", i + 3);',
        '                    if (close !== -1) {',
        '                        var num = parseInt(s.slice(i + 3, close), 10);',
        '                        if (!isNaN(num)) {',
        '                            if (i > start) segments.push({ text: s.slice(start, i), c: color });',
        '                            color = num;',
        '                            i = close + 1;',
        '                            start = i;',
        '                            continue;',
        '                        }',
        '                    }',
        '                }',
        '                i++;',
        '            }',
        '            if (start < s.length || segments.length === 0) segments.push({ text: s.slice(start), c: color });',
        '            return segments;',
        '        },',
        '        installPresentation: function() {',
        '            if (typeof Sprite === "undefined" || typeof Spriteset_Map === "undefined") return;',
        '            if (Spriteset_Map.prototype.__rrPresents) return;',
        '            Spriteset_Map.prototype.__rrPresents = true;',
        '',
        '            function Sprite_RRTextPop(target, text, duration) {',
        '                this.initialize.apply(this, arguments);',
        '            }',
        '            Sprite_RRTextPop.prototype = Object.create(Sprite.prototype);',
        '            Sprite_RRTextPop.prototype.constructor = Sprite_RRTextPop;',
        '            Sprite_RRTextPop.prototype.initialize = function(target, text, duration) {',
        '                var size = 26;',
        '                this._target = target;',
        '                this._duration = Math.max(10, duration);',
        '                this._elapsed = 0;',
        '                this._rise = 0;',
        '                var segs = RR.parseColorCodes(String(text || ""));',
        '                var measure = new Bitmap(1, 1);',
        '                measure.fontSize = size;',
        '                var tw = 0;',
        '                segs.forEach(function(sg) { tw += measure.measureTextWidth(sg.text); });',
        '                var width = Math.min(Graphics.width - 20, Math.ceil(tw) + 10);',
        '                var height = size + 12;',
        '                Sprite.prototype.initialize.call(this, new Bitmap(width, height));',
        '                this.bitmap.fontSize = size;',
        '                this.bitmap.outlineColor = "rgba(0,0,0,0.85)";',
        '                this.bitmap.outlineWidth = 4;',
        '                var x = 5;',
        '                for (var i = 0; i < segs.length; i++) {',
        '                    this.bitmap.textColor = RR.textColor(segs[i].c);',
        '                    this.bitmap.drawText(segs[i].text, x, 0, Math.max(1, width - x), height, "left");',
        '                    x += this.bitmap.measureTextWidth(segs[i].text);',
        '                }',
        '                this.anchor.x = 0.5;',
        '                this.anchor.y = 1;',
        '                this.z = 9;',
        '                this.opacity = 0;',
        '                this.updatePosition();',
        '            };',
        '            Sprite_RRTextPop.prototype.updatePosition = function() {',
        '                if (this._target && this._target.screenX) {',
        '                    this.x = this._target.screenX();',
        '                    this.y = this._target.screenY() - 52 - this._rise;',
        '                }',
        '            };',
        '            Sprite_RRTextPop.prototype.rrUpdate = function() {',
        '                this._elapsed++;',
        '                this._rise = Math.min(this._rise + 0.35, 24);',
        '                this.updatePosition();',
        '                if (this._elapsed < 10) this.opacity = Math.min(255, this.opacity + 30);',
        '                else if (this._elapsed > this._duration - 20) this.opacity = Math.max(0, this.opacity - 18);',
        '                else this.opacity = 255;',
        '            };',
        '            Sprite_RRTextPop.prototype.isDone = function() { return this._elapsed >= this._duration; };',
        '            RR.SpriteTextPop = Sprite_RRTextPop;',
        '',
        '            function Sprite_RRSlide(config, duration) {',
        '                this.initialize.apply(this, arguments);',
        '            }',
        '            Sprite_RRSlide.prototype = Object.create(Sprite.prototype);',
        '            Sprite_RRSlide.prototype.constructor = Sprite_RRSlide;',
        '            Sprite_RRSlide.prototype.initialize = function(config, duration) {',
        '                Sprite.prototype.initialize.call(this, new Bitmap(Graphics.width, Graphics.height));',
        '                this._fade = 15;',
        '                this._total = Math.max(30, duration) + this._fade * 2;',
        '                this._elapsed = 0;',
        '                this._stretched = false;',
        '                this.bitmap.fillAll("rgba(0,0,0,0.9)");',
        '                if (config.bgName) {',
        '                    this._bg = new Sprite(ImageManager.loadPicture(config.bgName));',
        '                    this.addChild(this._bg);',
        '                }',
        '                var titleY = config.faceName ? 236 : 110;',
        '                var textY = config.faceName ? 320 : 210;',
        '                if (config.faceName) {',
        '                    var face = new Sprite(ImageManager.loadFace(config.faceName));',
        '                    var idx = Number(config.faceIndex) || 0;',
        '                    face.setFrame((idx % 4) * 144, Math.floor(idx / 4) * 144, 144, 144);',
        '                    face.anchor.x = 0.5;',
        '                    face.x = Graphics.width / 2;',
        '                    face.y = 70;',
        '                    this.addChild(face);',
        '                }',
        '                if (config.title) this._makeText(String(config.title), 44, "#f4f0e6", titleY);',
        '                if (config.text) {',
        '                    var NL = String.fromCharCode(10);',
        '                    var CR = String.fromCharCode(13);',
        '                    var lines = String(config.text).split(NL).slice(0, 8);',
        '                    for (var i = 0; i < lines.length; i++) {',
        '                        this._makeText(lines[i].split(CR).join(""), 26, "#e8e4da", textY + i * 38);',
        '                    }',
        '                }',
        '                this.opacity = 0;',
        '            };',
        '            Sprite_RRSlide.prototype._makeText = function(text, size, color, y) {',
        '                var sp = new Sprite(new Bitmap(Graphics.width, size + 14));',
        '                sp.bitmap.fontSize = size;',
        '                sp.bitmap.textColor = color;',
        '                sp.bitmap.outlineColor = "rgba(0,0,0,0.8)";',
        '                sp.bitmap.outlineWidth = Math.max(2, Math.floor(size / 14));',
        '                sp.bitmap.drawText(text, 20, 0, Graphics.width - 40, size + 14, "center");',
        '                sp.y = y;',
        '                this.addChild(sp);',
        '            };',
        '            Sprite_RRSlide.prototype.rrUpdate = function() {',
        '                this._elapsed++;',
        '                if (this._bg && !this._stretched && this._bg.bitmap && this._bg.bitmap.isReady && this._bg.bitmap.isReady()) {',
        '                    this._stretched = true;',
        '                    if (this._bg.bitmap.width > 0 && this._bg.bitmap.height > 0) {',
        '                        this._bg.scale.x = Graphics.width / this._bg.bitmap.width;',
        '                        this._bg.scale.y = Graphics.height / this._bg.bitmap.height;',
        '                    }',
        '                }',
        '                if (this._elapsed < this._fade) this.opacity = Math.floor((255 * this._elapsed) / this._fade);',
        '                else if (this._elapsed > this._total - this._fade) this.opacity = Math.max(0, Math.floor((255 * (this._total - this._elapsed)) / this._fade));',
        '                else this.opacity = 255;',
        '            };',
        '            Sprite_RRSlide.prototype.isDone = function() { return this._elapsed >= this._total; };',
        '            RR.SpriteSlide = Sprite_RRSlide;',
        '',
        '            var rrSpritesetUpdate = Spriteset_Map.prototype.update;',
        '            Spriteset_Map.prototype.update = function() {',
        '                rrSpritesetUpdate.apply(this, arguments);',
        '                var gt = (typeof $gameTemp !== "undefined") ? $gameTemp : null;',
        '                if (!gt) return;',
        '                if (gt._rrTextPopQueue && gt._rrTextPopQueue.length) {',
        '                    var queue = gt._rrTextPopQueue.splice(0);',
        '                    for (var i = 0; i < queue.length; i++) {',
        '                        var req = queue[i];',
        '                        var pop = new Sprite_RRTextPop(req.target, req.text, req.duration);',
        '                        this.addChild(pop);',
        '                        if (!this._rrTextPops) this._rrTextPops = [];',
        '                        this._rrTextPops.push(pop);',
        '                    }',
        '                }',
        '                if (this._rrTextPops) {',
        '                    var keep = [];',
        '                    for (var pp = 0; pp < this._rrTextPops.length; pp++) {',
        '                        var sp = this._rrTextPops[pp];',
        '                        sp.rrUpdate();',
        '                        if (sp.isDone()) { this.removeChild(sp); if (sp.bitmap && sp.bitmap.destroy) sp.bitmap.destroy(); }',
        '                        else keep.push(sp);',
        '                    }',
        '                    this._rrTextPops = keep;',
        '                }',
        '                if (gt._rrSlideActive && !this._rrSlide && gt._rrSlideConfig) {',
        '                    this._rrSlide = new Sprite_RRSlide(gt._rrSlideConfig, gt._rrSlideDuration || 300);',
        '                    this.addChild(this._rrSlide);',
        '                }',
        '                if (this._rrSlide) {',
        '                    this._rrSlide.rrUpdate();',
        '                    if (this._rrSlide.isDone()) {',
        '                        this.removeChild(this._rrSlide);',
        '                        if (this._rrSlide.bitmap && this._rrSlide.bitmap.destroy) this._rrSlide.bitmap.destroy();',
        '                        this._rrSlide = null;',
        '                        gt._rrSlideActive = false;',
        '                        gt._rrSlideConfig = null;',
        '                    }',
        '                }',
        '            };',
        '        }',
        '    };',
        '    window.__RRMVBridge = RR;',
        '',
        '    var rrOriginalSetup = PluginManager.setup;',
        '    PluginManager.setup = function(plugins) {',
        '        var list = plugins;',
        '        try { list = RR.install(plugins); } catch (e) {',
        '            try { console.warn("RPGReactor bridge failed:", e); } catch (e2) {}',
        '        }',
        '        return rrOriginalSetup.call(this, list);',
        '    };',
        '})();',
        '// <<< RPGReactor: engine plugin catalog loader >>>',
        ''
    ].join('\n');

    /**
     * Resolve the engine's master plugin catalog directory.
     * Candidates: RPGREACTOR_PLUGINS_DIR env override, <cwd>/plugins (dev
     * launch), <exe dir>/plugins (packaged Windows/Linux distribution),
     * <src dir>/../plugins (self-extracted package). Returns null when the
     * catalog is not installed.
     */
    getEnginePluginsDir() {
        if (!this.fs || !this.path || typeof process === 'undefined') return null;
        const candidates = [];
        const add = (dir) => {
            if (dir && !candidates.includes(dir)) candidates.push(dir);
        };
        try { add(process.env.RPGREACTOR_PLUGINS_DIR); } catch (e) { /* env unavailable */ }
        add(this.path.join(process.cwd(), 'plugins'));
        add(this.path.join(this.path.dirname(process.execPath), 'plugins'));
        if (typeof __dirname !== 'undefined') {
            add(this.path.resolve(__dirname, '..', 'plugins'));
        }
        for (const candidate of candidates) {
            try {
                if (!this.fs.existsSync(candidate)) continue;
                const stat = this.fs.statSync(candidate);
                if (!stat.isDirectory()) continue;
                const hasJs = this.fs.readdirSync(candidate)
                    .some(file => file.endsWith('.js'));
                if (hasJs) return this.path.resolve(candidate);
            } catch (e) { /* try the next candidate */ }
        }
        return null;
    }

    /**
     * Migrate a project to the engine plugin catalog:
     * - MV corescript projects get an idempotent loader patch in
     *   js/rpg_managers.js; Reactor projects get their runtime corescript
     *   refreshed (the catalog fallback ships in reactor_managers.js).
     * - Plugin files that exist in the catalog are backed up to a zip in
     *   the project root and removed from js/plugins. Files not present in
     *   the catalog are kept locally so nothing silently disappears.
     * - project.rpgreactor records enginePluginsDir as launch fallback.
     */
    async applyEnginePluginCatalogToProject(projectPath) {
        if (!this.fs || !this.path) {
            return { ok: false, error: 'File system not available.' };
        }
        const engineDir = this.getEnginePluginsDir();
        if (!engineDir) {
            return { ok: false, error: 'Engine plugin catalog not found (expected a plugins/ folder beside the editor executable or in the editor source tree). Run generate-plugin-catalog or reinstall the editor.' };
        }

        try {
            const jsPath = this.path.join(projectPath, 'js');
            const isReactor = this.fs.existsSync(this.path.join(jsPath, 'reactor_main.js'));
            const isMv = this.fs.existsSync(this.path.join(jsPath, 'rpg_managers.js'));
            if (!isReactor && !isMv) {
                return { ok: false, error: 'No recognizable game corescript found in js/ (neither reactor_main.js nor rpg_managers.js).' };
            }

            const manifestPath = this.path.join(jsPath, isReactor ? 'reactor_plugins.js' : 'plugins.js');
            if (!this.fs.existsSync(manifestPath)) {
                return { ok: false, error: `Plugin manifest not found: js/${isReactor ? 'reactor_plugins.js' : 'plugins.js'}` };
            }

            // Decide which local plugin files can be removed: only those
            // that exist in the engine catalog.
            const pluginsDir = this.path.join(jsPath, 'plugins');
            const localFiles = this.fs.existsSync(pluginsDir)
                ? this.fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))
                : [];
            const removable = [];
            const kept = [];
            for (const file of localFiles) {
                if (this.fs.existsSync(this.path.join(engineDir, file))) {
                    removable.push(file);
                } else {
                    kept.push(file);
                }
            }

            // Backup removable plugin files before deleting them.
            let backupName = null;
            if (removable.length) {
                const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
                backupName = `engine-plugins-backup-${stamp}.zip`;
                const entries = removable.map(file => ({
                    name: `js/plugins/${file}`.split(this.path.sep).join('/'),
                    data: this.fs.readFileSync(this.path.join(pluginsDir, file)),
                }));
                this.writeZipArchive(this.path.join(projectPath, backupName), entries);
                for (const file of removable) {
                    // unlinkSync, not rmSync: on Windows rmSync may leave the
                    // file listed (POSIX delete-pending) while other handles
                    // (editor/AV watchers) are open. unlinkSync deletes for real.
                    const filePath = this.path.join(pluginsDir, file);
                    try {
                        this.fs.unlinkSync(filePath);
                    } catch (unlinkError) {
                        try {
                            this.fs.rmSync(filePath, { force: true });
                        } catch (rmError) {
                            throw unlinkError;
                        }
                    }
                }
            }

            // Patch the loader so plugins resolve from the catalog.
            let patched = 'reactor-runtime';
            if (isMv) {
                patched = 'mv-loader';
                const managersPath = this.path.join(jsPath, 'rpg_managers.js');
                const source = this.fs.readFileSync(managersPath, 'utf8');
                if (!source.includes('RPGReactor: engine plugin catalog loader')) {
                    this._writeFileAtomic(this.fs, managersPath, source.replace(/\s*$/, '') + this.constructor.MV_CATALOG_LOADER_SNIPPET, 'utf8');
                }
            } else {
                const runtimePath = this.getRuntimePath();
                if (!runtimePath) {
                    return { ok: false, error: 'Runtime corescript directory not found. Expected runtime/ beside the editor.', backupName };
                }
                await this.copyRuntimeIntoProject(runtimePath, jsPath, true);
            }

            // Record the catalog path for direct (non-editor) launches.
            const metaPath = this.path.join(projectPath, 'project.rpgreactor');
            let projectMeta = {};
            if (this.fs.existsSync(metaPath)) {
                projectMeta = JSON.parse(this.fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
            }
            projectMeta.enginePluginsDir = engineDir;
            projectMeta.modified = new Date().toISOString();
            this._writeFileAtomic(this.fs, metaPath, JSON.stringify(projectMeta, null, 2) + '\n', 'utf8');

            return {
                ok: true,
                engineDir,
                patched,
                backupName,
                removed: removable,
                kept,
            };
        } catch (error) {
            console.error('Error applying engine plugin catalog:', error);
            return { ok: false, error: error.message || String(error) };
        }
    }

    async loadProject(projectPath) {
        this.lastLoadError = null;
        if (!this.fs || !this.path) {
            console.error('File system not available');
            this.lastLoadError = { message: 'File system not available', filePath: projectPath };
            return null;
        }

        try {
            // Look for Agonia Engine project file
            const projectFilePath = this.path.join(projectPath, 'project.rpgreactor');

            let projectData;
            if (this.fs.existsSync(projectFilePath)) {
                // Load Agonia Engine project
                projectData = await this._readJsonWithRetry(projectFilePath);
                if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) {
                    const error = new Error('project.rpgreactor must contain a JSON object');
                    error.filePath = projectFilePath;
                    throw error;
                }
                projectData.path = projectPath;
            } else {
                // Check if it's an RPG Maker project
                const rmmzFile = this.path.join(projectPath, 'game.rmmzproject');
                const rpgmvFile = this.path.join(projectPath, 'Game.rpgproject');
                const rpgmvLowerFile = this.path.join(projectPath, 'game.rpgproject');
                if (this.fs.existsSync(rmmzFile) || this.fs.existsSync(rpgmvFile) || this.fs.existsSync(rpgmvLowerFile)) {
                    // Import RPG Maker project
                    const engineVersion = this.getEngineVersion();
                    projectData = {
                        name: this.path.basename(projectPath),
                        version: engineVersion,
                        engine: 'Agonia Engine',
                        engineVersion: engineVersion,
                        imported: true,
                        importedFrom: this.fs.existsSync(rmmzFile) ? 'RPG Maker MZ' : 'RPG Maker MV',
                        path: projectPath
                    };
                } else {
                    console.error('No valid project file found');
                    this.lastLoadError = {
                        message: 'No project.rpgreactor, game.rmmzproject, or Game.rpgproject file was found.',
                        filePath: projectPath
                    };
                    return null;
                }
            }

            // Load map list
            const mapInfosPath = this.path.join(projectPath, 'data', 'MapInfos.json');
            if (this.fs.existsSync(mapInfosPath)) {
                projectData.maps = await this._readJsonWithRetry(mapInfosPath);
                if (!Array.isArray(projectData.maps)) {
                    const error = new Error('MapInfos.json must contain a JSON array');
                    error.filePath = mapInfosPath;
                    throw error;
                }
            } else {
                projectData.maps = [];
            }

            return projectData;
        } catch (error) {
            console.error('Error loading project:', error);
            this.lastLoadError = {
                message: error.message || String(error),
                code: error.code || null,
                filePath: error.filePath || null
            };
            return null;
        }
    }

    async saveProject(projectData) {
        if (!this.fs || !this.path) {
            console.error('File system not available');
            return false;
        }

        try {
            const projectFilePath = this.path.join(projectData.path, 'project.rpgreactor');
            projectData.modified = new Date().toISOString();

            // Don't save the path in the file
            const { path, maps, ...dataToSave } = projectData;

            this._writeFileAtomic(this.fs, projectFilePath, JSON.stringify(dataToSave, null, 2));

            // Save MapInfos.json if maps data exists
            if (maps) {
                if (!this.saveMapInfos(projectData.path, maps)) {
                    return false;
                }
            }

            console.log('Project saved successfully!');
            return true;
        } catch (error) {
            console.error('Error saving project:', error);
            return false;
        }
    }

    saveMapInfos(projectPath, mapsData) {
        if (!this.fs || !this.path) {
            console.error('File system not available');
            return false;
        }

        try {
            const mapInfosPath = this.path.join(projectPath, 'data', 'MapInfos.json');
            this._writeFileAtomic(this.fs, mapInfosPath, JSON.stringify(mapsData, null, 0)); // No formatting for RPG Maker compatibility
            console.log('MapInfos.json saved successfully!');
            return true;
        } catch (error) {
            console.error('Error saving MapInfos.json:', error);
            return false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = ProjectManager;
