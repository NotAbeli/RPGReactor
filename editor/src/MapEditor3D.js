/**
 * The editor's 3D map viewport.
 *
 * A checkbox beside the A1 toggle swaps the PIXI canvas for a three.js one
 * showing the same map standing up. It is a view, not a second editor: the map
 * data, the palette and every tool stay exactly as they are, and turning the
 * checkbox off puts the 2D canvas back untouched.
 *
 * The geometry comes from `runtime/reactor_3d.js` — the same file the game
 * loads, read off disk at first use rather than copied into the editor. A
 * viewport that built its own geometry would drift from the runtime the first
 * time either changed, and the whole point of looking at it here is to see what
 * the game will draw.
 */
class MapEditor3D {
    constructor(projectController) {
        this.projectController = projectController;
        this.enabled = false;
        this.canvas = null;
        this.renderer = null;
        this.camera = null;
        this.mapScene = null;
        this.eventGroup = null;
        this.frame = null;
        this.librariesLoaded = false;
        this.sheetImages = {};
        this.lastError = null;

        // Orbit state. Distance is in tiles; the map is one unit per tile.
        // A shallow pitch is the point of the view: from overhead a standing
        // facade is edge-on and the map looks exactly like the 2D one.
        this.view = { yaw: 0, pitch: 34, distance: 24, target: { x: 0, y: 0, z: 0 } };
        this.pointer = null;
        this.billboards = [];
        this.labels = [];
        // Beyond this the labels overlap into a band; the sprites still read.
        this.LABEL_DISTANCE = 45;
        // The camera distance the label sizes were chosen at.
        this.LABEL_REFERENCE = 24;
        this.pickables = [];

        this.fs = null;
        this.path = null;
        const host = typeof window !== 'undefined' ? window.RPGReactorHost : null;
        if (host?.fs && host?.path) {
            this.fs = host.fs;
            this.path = host.path;
        }
        if (!this.fs && typeof nw !== 'undefined') {
            this.fs = require('fs');
            this.path = require('path');
        }
    }

    //-------------------------------------------------------------------------
    // Libraries

    /**
     * Load three.js and the runtime's 3D module into the page.
     *
     * Both are read from the runtime directory with fs and injected as classic
     * scripts: the editor is packaged separately from `runtime/`, so a relative
     * <script src> in index.html would resolve in the source tree and break in
     * a distributed build. Loading on demand also means an editor session that
     * never opens the 3D view never parses two megabytes of three.js.
     */
    async ensureLibraries() {
        if (this.librariesLoaded) return true;
        if (typeof window !== 'undefined' && window.THREE && window.Reactor3D) {
            this.librariesLoaded = true;
            return true;
        }

        const runtimePath = this.projectController?.projectManager?.getRuntimePath?.();
        if (!runtimePath || !this.fs || !this.path) {
            this.lastError = 'The runtime directory could not be found.';
            return false;
        }

        const files = [
            this.path.join(runtimePath, 'libs', 'three.js'),
            this.path.join(runtimePath, 'reactor_3d.js')
        ];
        for (const file of files) {
            if (!this.fs.existsSync(file)) {
                this.lastError = `Missing ${file}`;
                return false;
            }
        }

        try {
            for (const file of files) {
                await this.injectScript(this.fs.readFileSync(file, 'utf8'), file);
            }
        } catch (error) {
            this.lastError = error.message;
            return false;
        }

        this.librariesLoaded = !!(window.THREE && window.Reactor3D);
        if (!this.librariesLoaded) this.lastError = 'three.js did not define THREE.';
        return this.librariesLoaded;
    }

    injectScript(source, label) {
        return new Promise((resolve, reject) => {
            const element = document.createElement('script');
            element.textContent = source;
            element.dataset.rrSource = label;
            try {
                document.head.appendChild(element);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    //-------------------------------------------------------------------------
    // Enable / disable

    isEnabled() {
        return this.enabled;
    }

    async setEnabled(on) {
        if (on === this.enabled) return this.enabled;
        if (!on) {
            this.teardown();
            return false;
        }

        if (!await this.ensureLibraries()) {
            console.error(`3D view unavailable: ${this.lastError}`);
            return false;
        }

        this.enabled = true;
        this.createCanvas();
        await this.rebuild();
        this.startLoop();
        this.listenForEdits();
        this.showPixi(false);
        return true;
    }

    /**
     * Follow edits made with the 2D tools.
     *
     * Debounced rather than immediate: a rebuild remakes every buffer, and a
     * fill or a large stamp can announce several strokes in quick succession.
     */
    listenForEdits() {
        if (this._onMapEdited || typeof document === 'undefined') return;
        this._onMapEdited = () => {
            clearTimeout(this._rebuildTimer);
            this._rebuildTimer = setTimeout(() => {
                this.rebuild().catch(error => console.error('3D rebuild failed:', error));
            }, 200);
        };
        document.addEventListener('rr-map-edited', this._onMapEdited);

        // Selecting an event anywhere — the map, the events panel, the editor —
        // funnels through EventManager.selectEvent, so following that keeps the
        // 3D highlight in step without knowing who did the selecting.
        this._onEventSelected = event => this.selectEventById(event.detail?.eventId);
        document.addEventListener('rr-event-selected', this._onEventSelected);
    }

    stopListeningForEdits() {
        if (typeof document !== 'undefined') {
            if (this._onMapEdited) document.removeEventListener('rr-map-edited', this._onMapEdited);
            if (this._onEventSelected) document.removeEventListener('rr-event-selected', this._onEventSelected);
        }
        clearTimeout(this._rebuildTimer);
        this._onMapEdited = null;
        this._onEventSelected = null;
    }

    /** Highlight the mesh belonging to an event id, or clear the highlight. */
    selectEventById(eventId) {
        if (!this.eventGroup) return null;
        if (eventId === null || eventId === undefined) return this.select(null);
        const match = this.pickables.find(mesh =>
            mesh.userData.event && mesh.userData.event.id === eventId);
        return match ? this.select(match) : null;
    }

    teardown() {
        this.enabled = false;
        this.stopLoop();
        this.stopListeningForEdits();
        this.clearScene();
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        if (this.hint && this.hint.parentNode) {
            this.hint.parentNode.removeChild(this.hint);
        }
        this.hint = null;
        this.detachInput();
        this.canvas = null;
        this.camera = null;
        this.sheetImages = {};
        this.showPixi(true);
        window.reactor?.updateMapZoom?.();
    }

    /**
     * Show or hide the 2D canvas.
     *
     * Hidden rather than destroyed: TilemapManager owns it, has sized and
     * cropped it for this map, and turning 3D off has to give it back exactly
     * as it was.
     */
    showPixi(visible) {
        const canvas = this.projectController?.app?.canvas;
        if (canvas) canvas.style.display = visible ? 'block' : 'none';
        // The 2D scrollbars sit above everything at z-index 1000 and scroll a
        // canvas that is no longer on screen, so they go with it.
        for (const bar of document.querySelectorAll('.custom-scrollbar')) {
            bar.style.display = visible ? '' : 'none';
        }
    }

    container() {
        return document.getElementById('canvas-container');
    }

    createCanvas() {
        const container = this.container();
        if (!container) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'map-3d-canvas';
        this.canvas.style.cssText =
            'position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 5;';
        container.appendChild(this.canvas);

        this.createHint(container);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.camera = Reactor3D.createCamera({ fov: 40 });
        this.resize();
        this.attachInput();
    }

    /**
     * A one-off note about the controls.
     *
     * None of orbit, pan or re-frame is guessable from looking at the canvas,
     * and a viewport nobody can steer is a viewport nobody uses. It fades on
     * its own rather than needing dismissing.
     */
    createHint(container) {
        const tt = text => (window.I18n ? window.I18n.tText(text) : text);
        this.hint = document.createElement('div');
        this.hint.className = 'map-3d-hint';
        this.hint.textContent = tt('Drag to paint or orbit · Shift or right-drag to pan · Scroll to zoom · Double-click empty space to re-frame');
        container.appendChild(this.hint);
        // Two frames, so the transition has a start state to animate from.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (this.hint) this.hint.classList.add('is-fading');
        }));
    }

    resize() {
        const container = this.container();
        if (!container || !this.renderer || !this.camera) return;
        const rect = container.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    //-------------------------------------------------------------------------
    // Scene

    currentMap() {
        return this.projectController?.getTilemapManager?.()?.currentMap || null;
    }

    currentTileset() {
        return this.projectController?.getTilemapManager?.()?.currentTileset || null;
    }

    projectPath() {
        return this.projectController?.getCurrentProject?.()?.path || null;
    }

    /**
     * Rebuild the scene from whatever map is open.
     *
     * Cheap enough to call on every edit: the geometry builder produces one
     * merged mesh per tileset sheet, so even a 200x200 map is a handful of
     * buffers rather than tens of thousands of objects.
     */
    async rebuild() {
        if (!this.enabled || !this.renderer) return false;
        const mapData = this.currentMap();
        const tileset = this.currentTileset();
        if (!mapData || !tileset) return false;

        // Asset caches are keyed by file name, which is only unique within one
        // project: opening a second project whose tileset or character sheet
        // shares a name would otherwise draw the first project's artwork.
        const projectPath = this.projectPath();
        if (projectPath !== this._cachedProjectPath) {
            this.sheetImages = {};
            this.characterImages = {};
            this._cachedProjectPath = projectPath;
        }

        this.attachSidecar(mapData);
        this.loadClassification();
        const bitmaps = await this.loadSheets(tileset);

        this.clearScene();
        this.mapScene = new Reactor3D.MapScene(mapData, bitmaps, {
            flags: tileset.flags,
            tilesetId: tileset.id
        });
        this.applyAtmosphere(mapData);
        await this.buildEvents(mapData);
        this.frameMap(mapData);

        // An empty view has several possible causes — no sheets on disk, a
        // tileset with no images, geometry that built nothing — and they look
        // identical on screen. Keep the counts where they can be read.
        this.lastBuild = {
            map: `${mapData.width}x${mapData.height}`,
            sheets: Object.keys(bitmaps).length,
            meshes: this.mapScene._meshes.length,
            events: this.eventGroup ? this.eventGroup.children.length : 0
        };
        return true;
    }

    /**
     * Read the map's elevation sidecar, if it has one.
     *
     * Without it every cell sits at elevation 0, which is what an existing 2D
     * map looks like before any elevation has been painted — flat, but correct.
     */
    attachSidecar(mapData) {
        if (!this.fs || !this.path || !mapData || !mapData.id) return;
        const projectPath = this.projectPath();
        if (!projectPath) return;

        const file = `Map${String(mapData.id).padStart(3, '0')}${Reactor3D.SIDECAR_SUFFIX}`;
        const filePath = this.path.join(projectPath, 'data', file);
        if (!this.fs.existsSync(filePath)) return;
        try {
            mapData.reactor3d = JSON.parse(this.fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`${file} is not valid JSON.`, error);
        }
    }

    /**
     * Give the scene a sky and some distance.
     *
     * Without them the map is a lit slab floating in a void, and its edge is a
     * hard line against nothing. Fog fades the far side of a large map into the
     * same colour as the sky, which reads as depth and hides that edge. The
     * colour is taken from the editor's own theme so the viewport does not
     * fight whatever palette is in use.
     */
    applyAtmosphere(mapData) {
        if (!this.mapScene) return;
        const scene = this.mapScene.scene();
        const colour = new THREE.Color(this.skyColour());
        scene.background = colour;
        // Starts fading beyond a screenful and is total at roughly twice the
        // map's longest side, so a small map never fogs at all.
        const span = Math.max(mapData.width, mapData.height);
        scene.fog = new THREE.Fog(colour, span * 0.9, span * 2.2);
    }

    skyColour() {
        // `--color-bg-base`, not `--color-bg-deep`: deep is pure black on the
        // dark themes, and a black sky gives fog nothing to fade into, so
        // distance reads as the map simply ending.
        const fallback = 0x1a1a1a;
        if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
        try {
            const value = getComputedStyle(document.documentElement)
                .getPropertyValue('--color-bg-base').trim();
            // three.js reads hex and named colours but not `var(...)`, and an
            // empty string would silently become black.
            return value && !value.startsWith('var') ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    /**
     * Hand the runtime the project's tile classification.
     *
     * The runtime fetches this over XHR relative to the running game; there is
     * no running game here, so the editor reads it off disk. Without it every
     * tile falls back to the flag guess and the height cap then rejects any
     * building taller than eight tiles — which does not merely leave it flat,
     * it paints the wall art onto the floor as ground texture.
     */
    loadClassification() {
        if (!this.fs || !this.path || typeof Reactor3D === 'undefined') return;
        const projectPath = this.projectPath();
        if (!projectPath) return;

        const filePath = this.path.join(projectPath, 'data', Reactor3D.CLASSIFICATION_FILE);
        if (!this.fs.existsSync(filePath)) {
            Reactor3D.setClassification(null);
            return;
        }
        try {
            Reactor3D.setClassification(JSON.parse(this.fs.readFileSync(filePath, 'utf8')));
        } catch (error) {
            console.error(`${Reactor3D.CLASSIFICATION_FILE} is not valid JSON.`, error);
            Reactor3D.setClassification(null);
        }
    }

    /**
     * Load the tileset sheets as plain images.
     *
     * Not the TilemapManager's PIXI textures: those live in a WebGL context
     * three.js cannot read from, and the underlying image is what a
     * CanvasTexture wants anyway.
     */
    async loadSheets(tileset) {
        const projectPath = this.projectPath();
        if (!projectPath || !this.path) return {};

        const bitmaps = {};
        const directory = this.path.join(projectPath, 'img', 'tilesets');
        const pending = [];

        tileset.tilesetNames.forEach((name, index) => {
            if (!name) return;
            const cached = this.sheetImages[name];
            if (cached) {
                bitmaps[index] = cached;
                return;
            }
            const filePath = this.path.join(directory, `${name}.png`);
            if (this.fs && !this.fs.existsSync(filePath)) return;

            pending.push(new Promise(resolve => {
                const image = new Image();
                image.onload = () => {
                    const bitmap = { image, width: image.naturalWidth, height: image.naturalHeight };
                    this.sheetImages[name] = bitmap;
                    bitmaps[index] = bitmap;
                    resolve();
                };
                // A missing sheet leaves a hole in the map rather than failing
                // the whole build; the other sheets still draw.
                image.onerror = () => resolve();
                image.src = this.assetUrl(filePath);
            }));
        });

        await Promise.all(pending);
        return bitmaps;
    }

    assetUrl(filePath) {
        if (typeof window !== 'undefined' && window.RPGReactorAssetUrl) {
            return window.RPGReactorAssetUrl(filePath);
        }
        return 'file://' + String(filePath).replace(/\\/g, '/');
    }

    /**
     * One cube per event.
     *
     * Events are the thing you cannot see in a 3D view of tile data — they are
     * not in the map's tile planes at all — so they get solid boxes standing on
     * their tile, coloured by trigger so a parallel process reads differently
     * from something you walk into.
     */
    async buildEvents(mapData) {
        if (!this.mapScene) return;
        const scene = this.mapScene.scene();
        this.eventGroup = new THREE.Group();
        this.billboards = [];
        this.labels = [];
        this.pickables = [];
        this.selected = null;

        const sheets = await this.loadCharacterSheets(mapData);
        const cube = new THREE.BoxGeometry(0.55, 0.55, 0.55);

        for (const event of mapData.events || []) {
            if (!event) continue;
            const elevation = Reactor3D.elevationAt(mapData, event.x, event.y);
            const sprite = this.eventSprite(event, sheets);
            const mesh = sprite || new THREE.Mesh(cube, new THREE.MeshBasicMaterial({
                color: this.eventColor(event),
                transparent: true,
                opacity: 0.8
            }));
            const height = sprite ? sprite.userData.height : 0.55;
            mesh.position.set(event.x + 0.5, elevation + height / 2, event.y + 0.5);
            // What the raycaster hands back on a click.
            mesh.userData.event = event;
            this.eventGroup.add(mesh);
            this.pickables.push(mesh);
            if (sprite) this.billboards.push(mesh);

            const label = this.eventLabel(event);
            if (label) {
                label.position.set(event.x + 0.5, elevation + height + 0.28, event.y + 0.5);
                label.userData.event = event;
                this.eventGroup.add(label);
                this.billboards.push(label);
                this.labels.push(label);
            }
        }

        scene.add(this.eventGroup);
        this.faceCamera();
    }

    /**
     * Load every character sheet the map's events refer to, once each.
     *
     * A map with three hundred events usually draws them from a handful of
     * sheets, so this is a few loads rather than one per event.
     */
    async loadCharacterSheets(mapData) {
        const projectPath = this.projectPath();
        if (!projectPath || !this.path) return {};

        const names = new Set();
        for (const event of mapData.events || []) {
            const name = event?.pages?.[0]?.image?.characterName;
            if (name) names.add(name);
        }

        this.characterImages = this.characterImages || {};
        const directory = this.path.join(projectPath, 'img', 'characters');
        await Promise.all([...names].map(name => new Promise(resolve => {
            if (this.characterImages[name] !== undefined) return resolve();
            const file = this.path.join(directory, name.endsWith('.png') ? name : `${name}.png`);
            if (this.fs && !this.fs.existsSync(file)) {
                this.characterImages[name] = null;
                return resolve();
            }
            const image = new Image();
            image.onload = () => { this.characterImages[name] = image; resolve(); };
            // A missing sheet leaves that event as a plain cube rather than
            // failing the whole scene.
            image.onerror = () => { this.characterImages[name] = null; resolve(); };
            image.src = this.assetUrl(file);
        })));
        return this.characterImages;
    }

    /**
     * A billboard of the event's character graphic.
     *
     * The frame is cropped into its own canvas rather than addressed by UVs:
     * the sheet layouts differ between normal and `$` sheets, and cropping once
     * keeps that arithmetic in one place. Null when the event has no graphic,
     * which is also when the 2D editor shows a bare coloured square.
     */
    eventSprite(event, sheets) {
        const image = event?.pages?.[0]?.image;
        const sheet = image && image.characterName && sheets[image.characterName];
        if (!sheet || !sheet.width) return null;

        const big = window.RRAssetFiles?.isBigCharacter
            ? window.RRAssetFiles.isBigCharacter(image.characterName)
            : /^[!$]*\$/.test(image.characterName);
        const directionRow = { 2: 0, 4: 1, 6: 2, 8: 3 }[image.direction || 2] || 0;

        let frameWidth, frameHeight, baseX, baseY;
        if (big) {
            frameWidth = sheet.width / 3;
            frameHeight = sheet.height / 4;
            baseX = 0;
            baseY = directionRow * frameHeight;
        } else {
            frameWidth = sheet.width / 12;
            frameHeight = sheet.height / 8;
            baseX = ((image.characterIndex || 0) % 4) * 3 * frameWidth;
            baseY = (Math.floor((image.characterIndex || 0) / 4) * 4 + directionRow) * frameHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(frameWidth));
        canvas.height = Math.max(1, Math.round(frameHeight));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet,
            baseX + (image.pattern === undefined ? 1 : image.pattern) * frameWidth, baseY,
            frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;

        // A 48px frame is one tile, the same relationship the 2D map uses.
        const height = frameHeight / 48;
        const width = frameWidth / 48;
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.4 })
        );
        mesh.userData.height = height;
        return mesh;
    }

    /** The event's number and name, as the 2D map labels its squares. */
    eventLabel(event) {
        const text = `${String(event.id).padStart(3, '0')}: ${event.name || ''}`.trim();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const font = 'bold 24px sans-serif';
        ctx.font = font;
        canvas.width = Math.ceil(ctx.measureText(text).width) + 16;
        canvas.height = 34;

        const draw = canvas.getContext('2d');
        draw.font = font;
        draw.fillStyle = 'rgba(0, 0, 0, 0.72)';
        draw.fillRect(0, 0, canvas.width, canvas.height);
        draw.fillStyle = '#ffffff';
        draw.textBaseline = 'middle';
        draw.fillText(text, 8, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        // Sized for the reference distance; `updateLabelVisibility` rescales it
        // with the camera so a label holds its size on screen rather than
        // swelling to fill the view as you zoom in.
        const scale = 0.0085;
        return new THREE.Mesh(
            new THREE.PlaneGeometry(canvas.width * scale, canvas.height * scale),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false })
        );
    }

    /**
     * Hide the name labels once the view is wide enough that they collide.
     *
     * A two-hundred-tile map holds hundreds of events; at map-wide zoom their
     * labels overlap into an unreadable band, and the sprites alone read fine.
     */
    updateLabelVisibility() {
        const visible = this.view.distance <= this.LABEL_DISTANCE;
        const scale = this.view.distance / this.LABEL_REFERENCE;
        for (const label of this.labels || []) {
            label.visible = visible;
            label.scale.setScalar(scale);
        }
    }

    /**
     * Turn the sprites and labels to face the camera.
     *
     * Yaw only: a character sprite that pitched with the camera would lie down
     * when you looked from above, and standing upright is what makes 2D sprites
     * read as being in the scene.
     */
    faceCamera() {
        const yaw = -this.view.yaw * Math.PI / 180;
        for (const mesh of this.billboards || []) mesh.rotation.y = yaw;
    }

    /**
     * The event under the cursor, if any.
     *
     * Only the event cubes are tested. The ground and the facades are one
     * merged mesh per sheet, so a hit against them identifies a sheet rather
     * than a tile and is no use for picking.
     */
    eventAt(clientX, clientY) {
        if (!this.pickables || !this.pickables.length || !this.camera || !this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        this._raycaster = this._raycaster || new THREE.Raycaster();
        const point = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        this._raycaster.setFromCamera(point, this.camera);
        const hits = this._raycaster.intersectObjects(this.pickables, false);
        return hits.length ? hits[0].object : null;
    }

    /**
     * The map tile under the cursor.
     *
     * The ground is one merged mesh per sheet, so a hit cannot name a tile
     * directly — but the world position can, since the map is one unit per
     * tile. That is what lets the 3D view call the same `paintTile` the 2D
     * canvas does rather than growing a second painting path.
     */
    tileAt(clientX, clientY) {
        const mapData = this.currentMap();
        if (!this.mapScene || !this.camera || !this.canvas || !mapData) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        this._raycaster = this._raycaster || new THREE.Raycaster();
        this._raycaster.setFromCamera(new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        ), this.camera);

        const hits = this._raycaster.intersectObjects(this.mapScene._meshes, false);
        if (!hits.length) return null;
        const point = hits[0].point;
        const x = Math.floor(point.x);
        const y = Math.floor(point.z);
        if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) return null;
        return {
            x,
            y,
            // Where within the tile, in pixels, for the tools that care which
            // quadrant was clicked.
            localX: (point.x - x) * 48,
            localY: (point.z - y) * 48
        };
    }

    /** Mark a mesh as the selected one, or clear the selection with null. */
    select(mesh) {
        if (this.selected && this.selected !== mesh) this.highlight(this.selected, false);
        this.selected = mesh || null;
        if (this.selected) this.highlight(this.selected, true);
        return this.selected ? this.selected.userData.event : null;
    }

    highlight(mesh, on) {
        const scale = on ? 1.25 : 1;
        mesh.scale.set(scale, scale, scale);
        if (mesh.material.map) {
            // A character sprite is brightened rather than faded: dimming the
            // unselected ones would make every other event harder to read.
            mesh.material.color.setHex(on ? 0xfff2a0 : 0xffffff);
        } else {
            mesh.material.opacity = on ? 1 : 0.8;
        }
    }

    eventColor(event) {
        const trigger = event.pages?.[0]?.trigger ?? 0;
        switch (trigger) {
            case 1: return 0x4ea3ff;   // player touch
            case 2: return 0x59d98b;   // event touch
            case 3: return 0xffc44d;   // autorun
            case 4: return 0xc98bff;   // parallel
            default: return 0xff6b6b;  // action button
        }
    }

    clearScene() {
        if (this.eventGroup) {
            for (const child of this.eventGroup.children) {
                child.geometry.dispose();
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
            this.eventGroup.parent?.remove(this.eventGroup);
            this.eventGroup = null;
        }
        this.billboards = [];
        this.labels = [];
        if (this.mapScene) {
            this.mapScene.destroy();
            this.mapScene = null;
        }
    }

    //-------------------------------------------------------------------------
    // Camera

    /** Point the camera at the middle of the map, far enough back to see it. */
    frameMap(mapData) {
        const x = mapData.width / 2;
        const z = mapData.height / 2;
        this.view.target = { x, y: Reactor3D.elevationAt(mapData, Math.floor(x), Math.floor(z)), z };
        this.view.distance = Math.max(12, Math.max(mapData.width, mapData.height) * 0.9);
        this.applyCamera();
    }

    applyCamera() {
        if (!this.camera) return;
        this.faceCamera();
        this.updateLabelVisibility();
        this.updateZoomReadout();
        Reactor3D.aimCamera(this.camera, this.view.target, {
            yaw: this.view.yaw,
            pitch: this.view.pitch,
            distance: this.view.distance
        });
    }

    attachInput() {
        if (!this.canvas) return;
        this._onPointerDown = event => {
            this.pointer = {
                x: event.clientX,
                y: event.clientY,
                // Where the drag began, so a click can be told from an orbit.
                startX: event.clientX,
                startY: event.clientY,
                pan: event.button !== 0 || event.shiftKey,
                paint: false
            };
            this.canvas.setPointerCapture?.(event.pointerId);

            // A left drag paints when the palette has tiles selected, exactly
            // as it does on the 2D canvas, and orbits when it does not. Holding
            // Ctrl orbits regardless, for turning the view without clearing the
            // palette first.
            if (event.button === 0 && !event.shiftKey && !event.ctrlKey && this.canPaint()) {
                const tile = this.tileAt(event.clientX, event.clientY);
                if (tile) {
                    this.pointer.paint = true;
                    this.beginPaint();
                    this.paintAt(tile);
                }
            }
        };
        this._onPointerMove = event => {
            if (!this.pointer) {
                this.updateHover(event.clientX, event.clientY);
                this.reportTileUnderCursor(event.clientX, event.clientY);
                return;
            }
            const dx = event.clientX - this.pointer.x;
            const dy = event.clientY - this.pointer.y;
            this.pointer.x = event.clientX;
            this.pointer.y = event.clientY;
            if (this.pointer.paint) {
                const tile = this.tileAt(event.clientX, event.clientY);
                if (tile) this.paintAt(tile);
            } else if (this.pointer.pan) {
                this.pan(dx, dy);
            } else {
                this.orbit(dx, dy);
            }
        };
        this._onPointerUp = event => {
            const drag = this.pointer;
            this.pointer = null;
            this.canvas.releasePointerCapture?.(event.pointerId);
            if (drag && drag.paint) {
                this.endPaint();
                return;
            }
            if (!drag || drag.pan) return;

            // Orbiting sweeps the pointer across the canvas and must not also
            // select whatever it happens to finish on. A few pixels of travel
            // is a click with a shaky hand.
            const travel = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
            if (travel > 4) return;
            this.handleClick(event.clientX, event.clientY);
        };
        this._onDoubleClick = event => {
            const cube = this.eventAt(event.clientX, event.clientY);
            if (!cube) {
                // Nothing under the cursor: put the whole map back in view.
                // Getting lost in an orbit camera is easy and there is
                // otherwise no way home.
                const mapData = this.currentMap();
                if (mapData) this.frameMap(mapData);
                return;
            }
            event.preventDefault();
            const picked = this.select(cube);
            if (picked && typeof this.onEventActivated === 'function') {
                this.onEventActivated(picked);
            }
        };
        this._onWheel = event => {
            event.preventDefault();
            // The 3D canvas lives inside #canvas-container, which carries
            // TilemapManager's own wheel-zoom handler. Without this the same
            // scroll also zoomed the hidden 2D view, re-cropped its canvas and
            // overwrote the zoom readout with the 2D scale.
            event.stopPropagation();
            this.zoom(event.deltaY);
        };
        this._onContextMenu = event => {
            // The browser menu is never wanted here — right-drag pans — but a
            // right-click that lands on an event gets the same menu the 2D map
            // gives it, judged by the same four-pixel test as a left-click.
            event.preventDefault();
            const drag = this.pointer;
            if (drag && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) return;
            const cube = this.eventAt(event.clientX, event.clientY);
            if (!cube) return;
            const picked = this.select(cube);
            if (picked && typeof this.onEventContextMenu === 'function') {
                this.onEventContextMenu(picked, event.clientX, event.clientY);
            }
        };
        this._onResize = () => this.resize();
        // The window is not the only thing that changes the canvas size — the
        // sidebar divider does too, and that fires no resize event. Without
        // this the 3D view stayed stretched until the window itself moved.
        if (typeof ResizeObserver === 'function') {
            this._resizeObserver = new ResizeObserver(() => this.resize());
            const container = this.container();
            if (container) this._resizeObserver.observe(container);
        }

        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        this.canvas.addEventListener('pointermove', this._onPointerMove);
        this.canvas.addEventListener('pointerup', this._onPointerUp);
        this.canvas.addEventListener('pointercancel', this._onPointerUp);
        this.canvas.addEventListener('dblclick', this._onDoubleClick);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        window.addEventListener('resize', this._onResize);
    }

    detachInput() {
        if (this.canvas) {
            this.canvas.removeEventListener('pointerdown', this._onPointerDown);
            this.canvas.removeEventListener('pointermove', this._onPointerMove);
            this.canvas.removeEventListener('pointerup', this._onPointerUp);
            this.canvas.removeEventListener('pointercancel', this._onPointerUp);
            this.canvas.removeEventListener('dblclick', this._onDoubleClick);
            this.canvas.removeEventListener('wheel', this._onWheel);
            this.canvas.removeEventListener('contextmenu', this._onContextMenu);
        }
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        this.pointer = null;
    }

    //-------------------------------------------------------------------------
    // Painting
    //
    // Every stroke runs through MapEditor: the same `paintTile`, the same undo
    // state, the same autotile and stamp handling. The 3D view only works out
    // which tile the cursor is over — a second painting implementation would
    // drift from the first and would have to be fixed twice.

    mapEditor() {
        return window.reactor?.mapEditor || null;
    }

    /** Whether a left drag should paint rather than orbit. */
    canPaint() {
        const editor = this.mapEditor();
        if (!editor || !this.currentMap()) return false;
        const palette = editor.tilesetPaletteViewer;
        return !!(editor.mapStamp || editor.shadowPenMode
            || (palette && palette.selectedTiles && palette.selectedTiles.length));
    }

    beginPaint() {
        const editor = this.mapEditor();
        if (!editor) return;
        editor.beginEditState();
        editor.lastPaintedTile = { x: -1, y: -1, quadrant: -1 };
    }

    paintAt(tile) {
        const editor = this.mapEditor();
        if (!editor) return;
        // The quadrant-sensitive tools read this rather than taking coordinates,
        // so the raycast hit is handed over in the pixel space they expect.
        editor.lastMousePos = {
            x: tile.x * 48 + tile.localX,
            y: tile.y * 48 + tile.localY
        };
        editor.paintTile(tile.x, tile.y);
        this._paintDirty = true;
    }

    /**
     * Finish a stroke.
     *
     * `resetDrawingState` commits the undo entry and announces the edit, which
     * is what brings the 3D geometry back in line — the same announcement a
     * stroke on the 2D canvas makes.
     */
    endPaint() {
        const editor = this.mapEditor();
        if (!editor) return;
        editor.resetDrawingState(true);
        if (this._paintDirty) {
            this._paintDirty = false;
            this.projectController?.tilemapManager?.renderMap?.({ preserveScroll: true });
        }
    }

    /** Show the tile under the cursor in the map info bar, as 2D does. */
    reportTileUnderCursor(clientX, clientY) {
        const tile = this.tileAt(clientX, clientY);
        if (tile) window.reactor?.updateMapCoordinates?.(tile.x, tile.y);
    }

    /** Select the event under the pointer, or clear the selection. */
    handleClick(clientX, clientY) {
        const picked = this.select(this.eventAt(clientX, clientY));
        if (typeof this.onEventSelected === 'function') this.onEventSelected(picked);
    }

    /** The cursor becomes a pointer over an event, as it does on the 2D map. */
    updateHover(clientX, clientY) {
        if (!this.canvas) return;
        this.canvas.style.cursor = this.eventAt(clientX, clientY) ? 'pointer' : 'default';
    }

    orbit(dx, dy) {
        this.view.yaw -= dx * 0.4;
        // Clamped short of straight down and of the horizon: at 90 the orbit
        // maths degenerates, and below ~5 the camera slides under the ground.
        this.view.pitch = Math.min(89, Math.max(5, this.view.pitch - dy * 0.3));
        this.applyCamera();
    }

    pan(dx, dy) {
        // Pan across the ground plane in the direction the camera faces, so
        // dragging right moves the view right however the camera is turned.
        const yaw = this.view.yaw * Math.PI / 180;
        const scale = this.view.distance * 0.0016;
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        this.view.target.x -= (dx * rightX - dy * -rightZ) * scale;
        this.view.target.z -= (dx * rightZ + dy * rightX) * scale;
        this.applyCamera();
    }

    zoom(deltaY) {
        const factor = deltaY > 0 ? 1.1 : 1 / 1.1;
        this.view.distance = Math.min(400, Math.max(3, this.view.distance * factor));
        this.applyCamera();
    }

    /**
     * Report the 3D zoom in the map info bar.
     *
     * The bar otherwise keeps showing the 2D scale, which does not move while
     * you are in 3D and reads as the zoom being broken.
     */
    updateZoomReadout() {
        const element = document.getElementById('map-zoom');
        if (!element) return;
        element.textContent = `${Math.round((this.LABEL_REFERENCE / this.view.distance) * 100)}%`;
    }

    //-------------------------------------------------------------------------
    // Loop

    startLoop() {
        if (this.frame !== null) return;
        const tick = () => {
            if (!this.enabled) return;
            this.frame = requestAnimationFrame(tick);
            this.render();
        };
        this.frame = requestAnimationFrame(tick);
    }

    stopLoop() {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    render() {
        if (!this.renderer || !this.camera || !this.mapScene) return;
        this.animateAutotiles();
        this.renderer.render(this.mapScene.scene(), this.camera);
    }

    /**
     * Advance the A1 water and waterfalls.
     *
     * Same cadence as the game — a frame every 30 ticks at 60fps — and the same
     * A1 checkbox that governs the 2D canvas governs this, so the two views
     * agree about whether water is moving. Sliding UVs, so an animated frame
     * costs nothing like a rebuild.
     */
    animateAutotiles() {
        if (typeof this.mapScene.setAnimationFrame !== 'function') return;
        const enabled = window.reactor?.optionsManager?.getAnimateAutotiles?.() !== false;
        if (!enabled) {
            this.mapScene.setAnimationFrame(0);
            return;
        }
        this._animationCount = (this._animationCount || 0) + 1;
        this.mapScene.setAnimationFrame(Math.floor(this._animationCount / 30));
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapEditor3D;
}
