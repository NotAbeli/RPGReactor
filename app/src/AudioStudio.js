/**
 * AudioStudio - professional audio tool window for the Agonia editor.
 *
 * Three tabs:
 *   Библиотека  - browser for bgm/bgs/me/se with waveform, transport,
 *                 volume/pitch/pan (live) and loop toggle.
 *   Микшер      - six channel strips (BGM, BGS, BGS2, BGS3, ME, SE) with
 *                 live preview plus per-map auto-start rules (persisted to
 *                 the `audio` section of data/AgoniaEngine.json, applied at
 *                 runtime by the AgoniaAudioRules system module).
 *   Зоны        - ambient zone editor: scans real map events in the
 *                 OcRam_Audio_EX <aex> format, edits/adds/removes them
 *                 (AudioStudioZones does the JSON work).
 *
 * The old AudioPlayer modal stays untouched for inline event-editor
 * previews; the toolbar button opens this window instead.
 */
class AudioStudio {
    constructor(opts = {}) {
        this._getCurrentProject = opts.getCurrentProject || (() => null);
        this._getDatabaseManager = opts.getDatabaseManager || (() => null);

        this.CHANNELS = [
            { key: 'bgm', label: 'BGM', folder: 'bgm', loop: true },
            { key: 'bgs', label: 'BGS', folder: 'bgs', loop: true },
            { key: 'bgs2', label: 'BGS2', folder: 'bgs', loop: true },
            { key: 'bgs3', label: 'BGS3', folder: 'bgs', loop: true },
            { key: 'me', label: 'ME', folder: 'me', loop: false },
            { key: 'se', label: 'SE', folder: 'se', loop: false }
        ];

        this._engines = {};          // key -> {audio, src, pan, gain, track, record}
        this._ctx = null;
        this._waveCache = new Map(); // relativePath -> peaks [ [min,max], ... ]
        this._typeLists = {};        // folder -> [{name, relativePath}]
        this._currentType = 'bgm';
        this._selected = null;       // {type, name, relativePath, url}
        this._zonesMapId = null;
        this._rulesMapId = null;
        this._pendingZones = null;   // {updates, removals, additions}
        this._built = false;
    }

    _tt(text) {
        return (typeof window !== 'undefined' && window.I18n && window.I18n.tText)
            ? window.I18n.tText(text) : text;
    }

    _projectPath() {
        const p = this._getCurrentProject();
        return p ? p.path : null;
    }

    _path() { return window.require('path'); }

    _audioDir(folder) {
        const proj = this._projectPath();
        return proj ? this._path().join(proj, 'audio', folder) : null;
    }

    _urlFor(record) {
        if (!record) return '';
        return RRAssetFiles.toUrl(this._path().join(this._audioDir(this._folderOf(record)), record.relativePath));
    }

    _folderOf(record) {
        // bgs2/bgs3 records come from the bgs folder
        return record._folder || 'bgm';
    }

    // ------------------------------------------------------------------
    // Audio engine (per-channel element + WebAudio graph)
    // ------------------------------------------------------------------

    _context() {
        if (!this._ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this._ctx = Ctx ? new Ctx() : null;
        }
        if (this._ctx && this._ctx.state === 'suspended') {
            try { this._ctx.resume(); } catch (e) { /* ignore */ }
        }
        return this._ctx;
    }

    _engine(key) {
        if (!this._engines[key]) {
            const audio = new window.Audio();
            audio.preload = 'auto';
            const eng = { audio, src: null, pan: null, gain: null, track: null, record: null };
            const ctx = this._context();
            if (ctx) {
                try {
                    eng.src = ctx.createMediaElementSource(audio);
                    eng.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
                    eng.gain = ctx.createGain();
                    if (eng.pan) { eng.src.connect(eng.pan); eng.pan.connect(eng.gain); }
                    else { eng.src.connect(eng.gain); }
                    eng.gain.connect(ctx.destination);
                } catch (e) { eng.src = null; }
            }
            this._engines[key] = eng;
        }
        return this._engines[key];
    }

    _play(key, record, state) {
        const eng = this._engine(key);
        const url = this._urlFor(record);
        if (!url) return;
        if (eng.track !== record.name || eng.audio.src !== url) {
            eng.audio.src = url;
            eng.track = record.name;
        }
        eng.audio.loop = state.loop;
        eng.audio.playbackRate = Math.min(4, Math.max(0.25, (state.pitch || 100) / 100));
        if (eng.gain) eng.gain.gain.value = (state.volume || 100) / 100;
        if (eng.pan) eng.pan.pan.value = Math.max(-1, Math.min(1, (state.pan || 0) / 100));
        eng.record = record;
        try { eng.audio.currentTime = 0; } catch (e) { /* not loaded yet */ }
        eng.audio.play().catch(() => { /* autoplay guard - user gesture came first */ });
        if (key === this._activeLibraryKey()) this._attachLibraryEngine(eng);
    }

    _stop(key) {
        const eng = this._engines[key];
        if (eng) { try { eng.audio.pause(); } catch (e) { /* ignore */ } }
    }

    _activeLibraryKey() { return this._selected ? this._selected.type : 'bgm'; }

    // ------------------------------------------------------------------
    // Window shell
    // ------------------------------------------------------------------

    open() {
        const modal = document.getElementById('audio-studio-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        if (!this._built) {
            this._buildShell(modal);
            this._built = true;
        }
        this._refreshLibrary();
        this._refreshMixer();
        this._refreshZones();
    }

    close() {
        const modal = document.getElementById('audio-studio-modal');
        if (modal) modal.style.display = 'none';
        for (const key of Object.keys(this._engines)) this._stop(key);
    }

    _buildShell(modal) {
        modal.innerHTML = '';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';

        const win = document.createElement('div');
        win.style.cssText = `
            background-color: var(--color-bg-surface);
            border: 1px solid var(--color-border); border-radius: 10px;
            width: 86%; max-width: 1240px; height: 88%;
            display: flex; flex-direction: column;
            box-shadow: 0 6px 30px rgba(0,0,0,0.55);
            overflow: hidden;
        `;
        modal.appendChild(win);

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px 18px; display: flex; align-items: center; gap: 14px;
            background-color: var(--color-bg-deep);
            border-bottom: 2px solid var(--color-accent-border-mid);
        `;
        const title = document.createElement('div');
        title.style.cssText = 'font-size: 19px; font-weight: 600; color: var(--color-text-strong);';
        title.textContent = this._tt('Аудио-студия');
        header.appendChild(title);
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size: 11px; color: var(--color-text-dim);';
        sub.textContent = this._tt('Библиотека · Микшер каналов · Эмбиент-зоны карт');
        header.appendChild(sub);
        header.appendChild(this._div('flex:1'));
        const closeBtn = this._button('✕ ' + this._tt('Закрыть'), () => this.close());
        closeBtn.style.marginLeft = 'auto';
        header.appendChild(closeBtn);
        win.appendChild(header);

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:6px;padding:10px 14px 0;border-bottom:1px solid var(--color-border);';
        win.appendChild(tabsRow);

        const content = document.createElement('div');
        content.style.cssText = 'flex:1;overflow:hidden;position:relative;';
        win.appendChild(content);

        const tabs = [
            { id: 'library', label: 'Библиотека' },
            { id: 'mixer', label: 'Микшер и правила' },
            { id: 'zones', label: 'Эмбиент-зоны' }
        ];
        this._tabBodies = {};
        let activeTab = 'library';
        for (const tab of tabs) {
            const body = document.createElement('div');
            body.style.cssText = 'position:absolute;inset:0;overflow:auto;padding:14px;display:none;';
            content.appendChild(body);
            this._tabBodies[tab.id] = body;

            const el = document.createElement('div');
            el.textContent = this._tt(tab.label);
            el.style.cssText = `
                padding: 8px 18px; font-size: 13px; font-weight: 600;
                color: var(--color-text); cursor: pointer; user-select: none;
                border: 1px solid var(--color-border); border-bottom: none;
                border-radius: 6px 6px 0 0;
                background-color: var(--color-bg-deep);
            `;
            const activate = () => {
                activeTab = tab.id;
                tabsRow.querySelectorAll('div').forEach(t => {
                    t.style.backgroundColor = 'var(--color-bg-deep)';
                    t.style.color = 'var(--color-text)';
                });
                el.style.backgroundColor = 'var(--color-bg-panel)';
                el.style.color = 'var(--color-text-strong)';
                Object.entries(this._tabBodies).forEach(([id, b]) => {
                    b.style.display = id === activeTab ? 'block' : 'none';
                });
                if (activeTab === 'mixer') this._refreshMixer();
                if (activeTab === 'zones') this._refreshZones();
            };
            el.addEventListener('click', activate);
            tabsRow.appendChild(el);
            if (tab.id === 'library') setTimeout(activate, 0);
        }

        this._buildLibrary(this._tabBodies.library);
        this._buildMixer(this._tabBodies.mixer);
        this._buildZones(this._tabBodies.zones);

        modal.addEventListener('click', e => { if (e.target === modal) this.close(); });
    }

    // ------------------------------------------------------------------
    // Small UI helpers
    // ------------------------------------------------------------------

    _div(css) {
        const el = document.createElement('div');
        el.style.cssText = css || '';
        return el;
    }

    _button(text, onClick, kind) {
        const btn = document.createElement('button');
        btn.textContent = this._tt(text);
        btn.style.cssText = `
            padding: 5px 12px; font-size: 12px; cursor: pointer;
            background-color: ${kind === 'danger' ? 'var(--color-danger, #b33)' : 'var(--color-bg-deep)'};
            color: var(--color-text-strong);
            border: 1px solid var(--color-border); border-radius: 4px;
        `;
        btn.addEventListener('click', onClick);
        return btn;
    }

    _label(text, hint) {
        const wrap = this._div('display:flex;flex-direction:column;gap:2px;');
        const l = document.createElement('label');
        l.style.cssText = 'font-size:11px;color:var(--color-text);font-weight:600;';
        l.textContent = this._tt(text);
        wrap.appendChild(l);
        if (hint) {
            const h = this._div('font-size:10px;color:var(--color-text-dim);line-height:1.4;');
            h.textContent = hint;
            wrap.appendChild(h);
        }
        return wrap;
    }

    _slider(value, min, max, step, onInput) {
        const s = document.createElement('input');
        s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
        s.style.cssText = 'width:100%;cursor:pointer;';
        s.addEventListener('input', () => onInput(Number(s.value), s));
        return s;
    }

    _numInput(value, min, max, onChange) {
        const i = document.createElement('input');
        i.type = 'number'; i.value = value;
        if (min !== undefined) i.min = min;
        if (max !== undefined) i.max = max;
        i.style.cssText = `
            width:70px;padding:4px 6px;font-size:12px;
            background-color:var(--color-bg-deep);color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
        i.addEventListener('input', () => {
            const n = Number(i.value);
            if (!Number.isNaN(n)) onChange(n);
        });
        return i;
    }

    _select(options, value, onChange) {
        const sel = document.createElement('select');
        sel.style.cssText = `
            padding:4px 6px;font-size:12px;max-width:230px;
            background-color:var(--color-bg-deep);color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
        for (const o of options) {
            const opt = document.createElement('option');
            opt.value = o.value; opt.textContent = o.label;
            sel.appendChild(opt);
        }
        sel.value = value;
        sel.addEventListener('change', () => onChange(sel.value));
        return sel;
    }

    _checkbox(value, onChange) {
        const box = document.createElement('input');
        box.type = 'checkbox'; box.checked = !!value;
        box.style.cursor = 'pointer';
        box.addEventListener('change', () => onChange(box.checked));
        return box;
    }

    _fmtTime(sec) {
        if (!Number.isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    _listTypeFolder(type) {
        return (this.CHANNELS.find(c => c.key === type) || { folder: 'bgm' }).folder;
    }

    // ------------------------------------------------------------------
    // Library tab
    // ------------------------------------------------------------------

    _typeList(folder) {
        if (!this._typeLists[folder]) {
            try {
                const dir = this._audioDir(folder);
                this._typeLists[folder] = dir ? (RRAssetFiles.listUnique(dir, ['.ogg', '.m4a', '.mp3']) || []) : [];
            } catch (e) {
                this._typeLists[folder] = [];
            }
        }
        return this._typeLists[folder];
    }

    _buildLibrary(root) {
        root.innerHTML = '';
        const row = this._div('display:flex;gap:14px;height:100%;');
        row.style.minHeight = '420px';

        // Left: type tabs + search + list
        const left = this._div('display:flex;flex-direction:column;width:300px;min-width:240px;gap:8px;');
        const typeRow = this._div('display:flex;gap:4px;flex-wrap:wrap;');
        for (const t of ['bgm', 'bgs', 'me', 'se']) {
            const b = this._button(t.toUpperCase(), () => {
                this._currentType = t;
                typeRow.querySelectorAll('button').forEach(x => x.style.borderColor = 'var(--color-border)');
                b.style.borderColor = 'var(--color-accent-text, #7ab0ff)';
                this._renderLibraryList();
            });
            if (t === this._currentType) b.style.borderColor = 'var(--color-accent-text, #7ab0ff)';
            typeRow.appendChild(b);
        }
        left.appendChild(typeRow);

        this._libSearch = document.createElement('input');
        this._libSearch.type = 'search';
        this._libSearch.placeholder = this._tt('Поиск...');
        this._libSearch.style.cssText = `
            padding: 6px 10px; font-size: 12px;
            background-color: var(--color-bg-deep); color: var(--color-text-strong);
            border: 1px solid var(--color-border); border-radius: 4px;
        `;
        this._libSearch.addEventListener('input', () => this._renderLibraryList());
        left.appendChild(this._libSearch);

        const listWrap = this._div('flex:1;overflow:auto;border:1px solid var(--color-border);border-radius:6px;background-color:var(--color-bg-deep);');
        this._libList = document.createElement('div');
        listWrap.appendChild(this._libList);
        left.appendChild(listWrap);
        row.appendChild(left);

        // Right: player
        const right = this._div('flex:1;display:flex;flex-direction:column;gap:12px;min-width:0;');
        const nowTitle = this._div('font-size:14px;font-weight:600;color:var(--color-text-strong);');
        nowTitle.textContent = this._tt('Ничего не выбрано');
        this._nowTitle = nowTitle;
        right.appendChild(nowTitle);

        const waveWrap = this._div('position:relative;border:1px solid var(--color-border);border-radius:6px;background-color:var(--color-bg-deep);height:120px;cursor:pointer;');
        this._waveCanvas = document.createElement('canvas');
        this._waveCanvas.style.cssText = 'width:100%;height:100%;display:block;';
        this._waveCanvas.width = 1000; this._waveCanvas.height = 240;
        waveWrap.appendChild(this._waveCanvas);
        this._waveHint = this._div('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:12px;');
        this._waveHint.textContent = this._tt('Волна появится после выбора дорожки');
        waveWrap.appendChild(this._waveHint);
        waveWrap.addEventListener('click', e => this._waveSeek(e, waveWrap));
        right.appendChild(waveWrap);

        const seekRow = this._div('display:flex;align-items:center;gap:8px;');
        this._timeLabel = this._div('font-size:11px;color:var(--color-text);min-width:90px;');
        this._timeLabel.textContent = '0:00 / 0:00';
        this._seek = this._slider(0, 0, 1000, 1, v => {
            const eng = this._engine(this._activeLibraryKey());
            if (eng && eng.audio.duration) eng.audio.currentTime = eng.audio.duration * v / 1000;
        });
        this._seek.style.flex = '1';
        seekRow.appendChild(this._timeLabel);
        seekRow.appendChild(this._seek);
        right.appendChild(seekRow);

        const transport = this._div('display:flex;gap:8px;align-items:center;');
        this._btnPlay = this._button('▶ Играть', () => this._libraryPlayPause());
        this._btnStop = this._button('■ Стоп', () => { this._stop(this._activeLibraryKey()); });
        this._btnLoop = this._button('⟳ Цикл: вкл', () => this._toggleLoop());
        this._loop = true;
        transport.appendChild(this._btnPlay);
        transport.appendChild(this._btnStop);
        transport.appendChild(this._btnLoop);
        transport.appendChild(this._div('flex:1'));
        const hint = this._div('font-size:10px;color:var(--color-text-dim);');
        hint.textContent = this._tt('Клик по волне — переход; громкость/питч/пан применяются на лету');
        transport.appendChild(hint);
        right.appendChild(transport);

        const ctrlGrid = this._div('display:grid;grid-template-columns:repeat(3,1fr);gap:12px;');
        this._libState = { volume: 100, pitch: 100, pan: 0 };
        const mkSlider = (label, key, min, max, fmt) => {
            const wrap = this._label(label);
            const val = this._div('font-size:11px;color:var(--color-text-dim);');
            const s = this._slider(this._libState[key], min, max, 1, v => {
                this._libState[key] = v;
                val.textContent = fmt(v);
                this._applyLibState();
            });
            val.textContent = fmt(this._libState[key]);
            wrap.appendChild(s);
            wrap.appendChild(val);
            return wrap;
        };
        ctrlGrid.appendChild(mkSlider('Громкость', 'volume', 0, 100, v => v + '%'));
        ctrlGrid.appendChild(mkSlider('Питч', 'pitch', 50, 150, v => v + '%'));
        ctrlGrid.appendChild(mkSlider('Панорама', 'pan', -100, 100, v => (v > 0 ? 'R' + v : v < 0 ? 'L' + (-v) : 'центр')));
        right.appendChild(ctrlGrid);

        row.appendChild(right);
        root.appendChild(row);
    }

    _renderLibraryList() {
        const records = this._typeList(this._listTypeFolder(this._currentType));
        const q = (this._libSearch.value || '').trim().toLowerCase();
        this._libList.innerHTML = '';
        const filtered = records.filter(r => !q || r.name.toLowerCase().includes(q));
        if (!filtered.length) {
            const empty = this._div('padding:14px;color:var(--color-text-muted);font-size:12px;');
            empty.textContent = this._projectPath()
                ? this._tt('Нет файлов')
                : this._tt('Сначала откройте проект');
            this._libList.appendChild(empty);
            return;
        }
        for (const rec of filtered.slice(0, 800)) {
            const item = document.createElement('div');
            item.textContent = RRAssetFiles.basename ? RRAssetFiles.basename(rec.name) : rec.name;
            item.title = rec.name;
            item.style.cssText = `
                padding: 5px 10px; font-size: 12px; cursor: pointer;
                color: var(--color-text); border-bottom: 1px solid var(--color-border);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            `;
            if (this._selected && this._selected.name === rec.name && this._selected.type === this._currentType) {
                item.style.backgroundColor = 'var(--color-bg-panel)';
                item.style.color = 'var(--color-text-strong)';
            }
            item.addEventListener('click', () => this._selectTrack(this._currentType, rec));
            this._libList.appendChild(item);
        }
    }

    _selectTrack(type, record) {
        this._selected = { type, name: record.name, relativePath: record.relativePath, url: this._urlFor(record) };
        this._selected._folder = this._listTypeFolder(type);
        this._nowTitle.textContent = (type.toUpperCase()) + ' · ' + (RRAssetFiles.basename ? RRAssetFiles.basename(record.name) : record.name);
        this._waveHint.textContent = this._tt('Чтение волны...');
        this._renderLibraryList();
        this._loadWave(record, this._selected._folder).then(peaks => {
            this._waveHint.style.display = peaks ? 'none' : 'flex';
            if (!peaks) this._waveHint.textContent = this._tt('Волна недоступна для этого формата');
            this._drawWave(peaks || null, 0);
        });
        // stop previous engine channel and start fresh
        this._stop(type);
        this._play(type, record, Object.assign({}, this._libState, { loop: this._loop }));
        this._pushRecent(type, record.name);
    }

    _libraryPlayPause() {
        const key = this._activeLibraryKey();
        const eng = this._engine(key);
        if (!this._selected) return;
        if (eng.audio.paused) {
            this._play(key, { name: this._selected.name, relativePath: this._selected.relativePath, _folder: this._selected._folder },
                Object.assign({}, this._libState, { loop: this._loop }));
        } else {
            eng.audio.pause();
        }
    }

    _toggleLoop() {
        this._loop = !this._loop;
        this._btnLoop.textContent = this._loop ? '⟳ Цикл: вкл' : '⟳ Цикл: выкл';
        const eng = this._engine(this._activeLibraryKey());
        eng.audio.loop = this._loop;
    }

    _applyLibState() {
        const eng = this._engine(this._activeLibraryKey());
        eng.audio.playbackRate = Math.min(4, Math.max(0.25, this._libState.pitch / 100));
        if (eng.gain) eng.gain.gain.value = this._libState.volume / 100;
        if (eng.pan) eng.pan.pan.value = Math.max(-1, Math.min(1, this._libState.pan / 100));
    }

    _attachLibraryEngine(eng) {
        if (eng._studioWired) return;
        eng._studioWired = true;
        eng.audio.addEventListener('timeupdate', () => {
            if (!this._selected) return;
            const a = eng.audio;
            this._timeLabel.textContent = this._fmtTime(a.currentTime) + ' / ' + this._fmtTime(a.duration);
            if (a.duration) {
                this._seek.value = String(Math.round(1000 * a.currentTime / a.duration));
                this._drawWaveProgress(a.currentTime / a.duration);
            }
        });
        eng.audio.addEventListener('play', () => { this._btnPlay.textContent = '⏸ Пауза'; });
        eng.audio.addEventListener('pause', () => { this._btnPlay.textContent = '▶ Играть'; });
    }

    // ------------------------------------------------------------------
    // Waveform
    // ------------------------------------------------------------------

    async _loadWave(record, folder) {
        const cacheKey = folder + '/' + record.relativePath;
        if (this._waveCache.has(cacheKey)) return this._waveCache.get(cacheKey);
        try {
            const ctx = this._context();
            if (!ctx || !window.fetch) throw new Error('no webaudio');
            const url = RRAssetFiles.toUrl(this._path().join(this._audioDir(folder), record.relativePath));
            const buf = await (await fetch(url)).arrayBuffer();
            const audioBuf = await ctx.decodeAudioData(buf.slice(0));
            const data = audioBuf.getChannelData(0);
            const buckets = 800;
            const size = Math.floor(data.length / buckets) || 1;
            const peaks = [];
            for (let i = 0; i < buckets; i++) {
                let min = 1, max = -1;
                const base = i * size;
                for (let j = 0; j < size; j += 4) {
                    const v = data[base + j] || 0;
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
                peaks.push([min, max]);
            }
            this._waveCache.set(cacheKey, peaks);
            return peaks;
        } catch (e) {
            return null;
        }
    }

    _drawWave(peaks, progress) {
        const canvas = this._waveCanvas;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (!peaks || !peaks.length) return;
        const mid = h / 2;
        ctx.fillStyle = 'rgba(128,128,128,0.35)';
        ctx.fillRect(0, mid - 0.5, w, 1);
        const barW = w / peaks.length;
        for (let i = 0; i < peaks.length; i++) {
            const [min, max] = peaks[i];
            const x = i * barW;
            const played = progress !== undefined && (i / peaks.length) <= progress;
            ctx.fillStyle = played ? 'rgba(122,176,255,0.9)' : 'rgba(120,140,170,0.55)';
            const y1 = mid - max * mid * 0.92;
            const y2 = mid - min * mid * 0.92;
            ctx.fillRect(x, y1, Math.max(1, barW * 0.8), Math.max(1, y2 - y1));
        }
        this._lastPeaks = peaks;
    }

    _drawWaveProgress(p) {
        this._drawWave(this._lastPeaks || null, p);
    }

    _waveSeek(e, wrap) {
        const eng = this._engine(this._activeLibraryKey());
        if (!eng.audio.duration) return;
        const rect = wrap.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        eng.audio.currentTime = eng.audio.duration * p;
        this._drawWaveProgress(p);
    }

    _pushRecent(type, name) {
        const audio = this._getAudio();
        let recent = AudioStudio._parseJson(audio['Recent Tracks'], []);
        recent = recent.filter(r => !(r && r.type === type && r.name === name));
        recent.unshift({ type, name });
        recent = recent.slice(0, 20);
        audio['Recent Tracks'] = JSON.stringify(recent);
        this._saveAudioQuiet();
    }

    static _parseJson(v, fallback) {
        if (typeof v !== 'string') return Array.isArray(v) ? v : fallback;
        try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p : fallback;
        } catch (e) { return fallback; }
    }

    // ------------------------------------------------------------------
    // DB (audio section) access
    // ------------------------------------------------------------------

    _getAudio() {
        const dm = this._getDatabaseManager();
        if (dm && dm.data) {
            if (!dm.data.agonia) dm.data.agonia = DatabaseManager.agoniaDefaults();
            if (!dm.data.agonia.audio) dm.data.agonia.audio = DatabaseManager.agoniaDefaults().audio;
            return dm.data.agonia.audio;
        }
        // Fallback: edit the sidecar directly.
        const fs = window.require('fs');
        const path = this._path();
        const file = path.join(this._projectPath(), 'data', 'AgoniaEngine.json');
        let db = {};
        try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { db = {}; }
        if (!db.audio) db.audio = DatabaseManager.agoniaDefaults().audio;
        this._directDb = { file, db };
        return db.audio;
    }

    _saveAudioQuiet() {
        // Debounced persist (recent tracks etc.).
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._saveAudio(), 800);
    }

    _saveAudio() {
        const dm = this._getDatabaseManager();
        if (dm && dm.data && dm.saveAgonia) {
            dm.saveAgonia(this._projectPath()).catch(() => { /* status surfaced by DM */ });
            return true;
        }
        if (this._directDb) {
            try {
                const fs = window.require('fs');
                fs.writeFileSync(this._directDb.file, JSON.stringify(this._directDb.db, null, 2) + '\n', 'utf8');
                return true;
            } catch (e) { return false; }
        }
        return false;
    }

    _getRules() {
        return AudioStudio._parseJson(this._getAudio()['Map Rules'], []);
    }

    // ------------------------------------------------------------------
    // Mixer tab: channel strips + map auto-start rules
    // ------------------------------------------------------------------

    _buildMixer(root) {
        root.innerHTML = '';
        const title = this._div('font-size:15px;font-weight:600;color:var(--color-text-strong);padding:0 0 8px;');
        title.textContent = this._tt('Микшер каналов');
        root.appendChild(title);

        const strips = this._div('display:grid;grid-template-columns:repeat(6,1fr);gap:10px;');
        this._stripEls = {};
        for (const ch of this.CHANNELS) {
            const strip = this._div(`
                background-color: var(--color-bg-panel);
                border: 1px solid var(--color-border); border-radius: 6px;
                padding: 10px; display: flex; flex-direction: column; gap: 8px;
            `);
            const head = this._div('font-weight:600;font-size:13px;color:var(--color-text-strong);');
            head.textContent = ch.label;
            strip.appendChild(head);

            const state = { volume: 100, pitch: 100, pan: 0, loop: ch.loop };
            this._stripEls[ch.key] = { state, record: null };

            const volVal = this._div('font-size:10px;color:var(--color-text-dim);');
            volVal.textContent = '100%';
            const volWrap = this._label('Громкость');
            volWrap.appendChild(this._slider(100, 0, 100, 1, v => {
                state.volume = v; volVal.textContent = v + '%';
                const eng = this._engine(ch.key);
                if (eng.gain) eng.gain.gain.value = v / 100;
                this._persistVolume(ch.key, v);
            }));
            volWrap.appendChild(volVal);
            strip.appendChild(volWrap);

            const pitchVal = this._div('font-size:10px;color:var(--color-text-dim);');
            pitchVal.textContent = '100%';
            const pitchWrap = this._label('Питч');
            pitchWrap.appendChild(this._slider(100, 50, 150, 1, v => {
                state.pitch = v; pitchVal.textContent = v + '%';
                this._engine(ch.key).audio.playbackRate = Math.min(4, Math.max(0.25, v / 100));
            }));
            pitchWrap.appendChild(pitchVal);
            strip.appendChild(pitchWrap);

            const panVal = this._div('font-size:10px;color:var(--color-text-dim);');
            panVal.textContent = this._tt('центр');
            const panWrap = this._label('Панорама');
            panWrap.appendChild(this._slider(0, -100, 100, 1, v => {
                state.pan = v;
                panVal.textContent = v > 0 ? 'R' + v : (v < 0 ? 'L' + (-v) : this._tt('центр'));
                const eng = this._engine(ch.key);
                if (eng.pan) eng.pan.pan.value = Math.max(-1, Math.min(1, v / 100));
            }));
            panWrap.appendChild(panVal);
            strip.appendChild(panWrap);

            if (ch.loop) {
                const loopRow = this._div('display:flex;align-items:center;gap:6px;font-size:11px;color:var(--color-text);');
                loopRow.appendChild(document.createTextNode(this._tt('Цикл') + ' '));
                loopRow.appendChild(this._checkbox(true, v => {
                    state.loop = v;
                    this._engine(ch.key).audio.loop = v;
                }));
                strip.appendChild(loopRow);
            }

            const btnRow = this._div('display:flex;gap:6px;');
            btnRow.appendChild(this._button('▶', () => this._stripPlay(ch.key)));
            btnRow.appendChild(this._button('■', () => this._stop(ch.key)));
            strip.appendChild(btnRow);

            const now = this._div('font-size:10px;color:var(--color-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
            now.textContent = '—';
            this._stripEls[ch.key].nowEl = now;
            strip.appendChild(now);

            strips.appendChild(strip);
        }
        root.appendChild(strips);

        const note = this._div('font-size:10px;color:var(--color-text-dim);padding:6px 0 2px;');
        note.textContent = this._tt('▶ проигрывает выбранную в «Библиотеке» дорожку на канале с его настройками. Громкости каналов сохраняются в БД.');
        root.appendChild(note);

        // ---- Map rules ----
        const rulesTitle = this._div('font-size:15px;font-weight:600;color:var(--color-text-strong);padding:14px 0 8px;');
        rulesTitle.textContent = this._tt('Правила автозапуска на картах');
        root.appendChild(rulesTitle);
        const hint = this._div('font-size:10px;color:var(--color-text-dim);padding-bottom:8px;');
        hint.textContent = this._tt('Применяются при загрузке карты в игре (системный модуль AgoniaAudioRules): BGM — стандартный канал, BGS2/BGS3 — глобальные каналы OcRam (играют и в бою).');
        root.appendChild(hint);

        const rulesPanel = this._div(`
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border); border-radius: 6px;
            padding: 12px; display: flex; flex-direction: column; gap: 10px;
        `);
        this._rulesPanel = rulesPanel;
        root.appendChild(rulesPanel);
    }

    _persistVolume(key, v) {
        const audio = this._getAudio();
        const field = { bgm: 'BGM Volume', bgs: 'BGS Volume', bgs2: 'BGS2 Volume', bgs3: 'BGS3 Volume', me: 'ME Volume', se: 'SE Volume' }[key];
        if (field && audio[field] !== v) {
            audio[field] = v;
            this._saveAudioQuiet();
        }
    }

    _stripPlay(key) {
        if (!this._selected) return;
        const folder = this._listTypeFolder(this._selected.type);
        const record = { name: this._selected.name, relativePath: this._selected.relativePath, _folder: folder };
        const strip = this._stripEls[key];
        strip.record = record;
        strip.nowEl.textContent = record.name;
        this._play(key, record, strip.state);
    }

    _refreshMixer() {
        if (!this._rulesPanel) return;
        this._rulesPanel.innerHTML = '';
        const proj = this._projectPath();
        if (!proj) {
            const empty = this._div('color:var(--color-text-muted);font-size:12px;padding:8px;');
            empty.textContent = this._tt('Сначала откройте проект');
            this._rulesPanel.appendChild(empty);
            return;
        }

        const maps = AudioStudioZones.listMaps(proj);
        const headRow = this._div('display:flex;gap:10px;align-items:end;flex-wrap:wrap;');
        const mapWrap = this._label('Карта');
        const mapSel = this._select(
            [{ value: '', label: '— ' + this._tt('выберите карту') + ' —' }]
                .concat(maps.map(m => ({ value: String(m.id), label: m.id + ': ' + m.name }))),
            this._rulesMapId ? String(this._rulesMapId) : '',
            v => { this._rulesMapId = v ? Number(v) : null; this._refreshMixer(); });
        mapWrap.appendChild(mapSel);
        headRow.appendChild(mapWrap);
        this._rulesPanel.appendChild(headRow);
        if (!this._rulesMapId) return;

        const rules = this._getRules();
        const existing = rules.find(r => r && Number(r.mapId) === this._rulesMapId);
        const draft = this._rulesDraftKeep || JSON.parse(JSON.stringify(
            existing || { mapId: this._rulesMapId, bgm: null, bgs2: null, bgs3: null }));

        const bgmFiles = this._typeList('bgm').map(r => ({ value: r.name, label: RRAssetFiles.basename ? RRAssetFiles.basename(r.name) : r.name }));
        const bgsFiles = this._typeList('bgs').map(r => ({ value: r.name, label: RRAssetFiles.basename ? RRAssetFiles.basename(r.name) : r.name }));

        const mkChannelRow = (label, key, files, defaultVol) => {
            const row = this._div('display:flex;gap:10px;align-items:end;flex-wrap:wrap;border-top:1px solid var(--color-border);padding-top:10px;');
            const enableWrap = this._label(label);
            enableWrap.appendChild(this._checkbox(!!draft[key], v => {
                draft[key] = v ? { name: (files[0] && files[0].value) || '', volume: defaultVol, pitch: 100, pan: 0 } : null;
                this._refreshMixerDraft(draft);
            }));
            row.appendChild(enableWrap);
            if (!draft[key]) {
                const off = this._div('font-size:11px;color:var(--color-text-dim);padding-bottom:6px;');
                off.textContent = this._tt('выключен');
                row.appendChild(off);
                return row;
            }
            const cfg = draft[key];
            const fileWrap = this._label('Дорожка');
            fileWrap.appendChild(this._select([{ value: '', label: '—' }].concat(files), cfg.name, v => { cfg.name = v; }));
            row.appendChild(fileWrap);
            const mk = (label2, k, min, max) => {
                const w = this._label(label2);
                const val = this._div('font-size:10px;color:var(--color-text-dim);');
                val.textContent = String(cfg[k]);
                w.appendChild(this._slider(cfg[k], min, max, 1, v => { cfg[k] = v; val.textContent = String(v); }));
                w.appendChild(val);
                return w;
            };
            row.appendChild(mk('Громкость', 'volume', 0, 100));
            row.appendChild(mk('Питч', 'pitch', 50, 150));
            row.appendChild(mk('Панорама', 'pan', -100, 100));
            if (cfg.name) {
                row.appendChild(this._button('▶', () => {
                    const folder = key === 'bgm' ? 'bgm' : 'bgs';
                    const rec = this._typeList(folder).find(r => r.name === cfg.name);
                    if (rec) {
                        const r2 = { name: rec.name, relativePath: rec.relativePath, _folder: folder };
                        this._play(key === 'bgm' ? 'bgm' : key, r2,
                            { volume: cfg.volume, pitch: cfg.pitch, pan: cfg.pan, loop: true });
                    }
                }));
            }
            return row;
        };

        this._rulesPanel.appendChild(mkChannelRow('BGM', 'bgm', bgmFiles, 100));
        this._rulesPanel.appendChild(mkChannelRow('BGS2', 'bgs2', bgsFiles, 90));
        this._rulesPanel.appendChild(mkChannelRow('BGS3', 'bgs3', bgsFiles, 90));

        const actions = this._div('display:flex;gap:8px;padding-top:10px;');
        const saveBtn = this._button('Сохранить правило', () => {
            const audio = this._getAudio();
            const rules2 = this._getRules().filter(r => r && Number(r.mapId) !== this._rulesMapId);
            if (draft.bgm || draft.bgs2 || draft.bgs3) rules2.push(draft);
            audio['Map Rules'] = JSON.stringify(rules2);
            this._saveAudio();
            saveBtn.textContent = this._tt('Сохранено ✓');
            setTimeout(() => { saveBtn.textContent = this._tt('Сохранить правило'); }, 1200);
        });
        actions.appendChild(saveBtn);
        const delBtn = this._button('Удалить правило', () => {
            const audio = this._getAudio();
            audio['Map Rules'] = JSON.stringify(this._getRules().filter(r => r && Number(r.mapId) !== this._rulesMapId));
            this._saveAudio();
            this._refreshMixer();
        }, 'danger');
        actions.appendChild(delBtn);
        this._rulesPanel.appendChild(actions);

        this._refreshMixerDraft(draft);
    }

    _refreshMixerDraft(draft) {
        // Checkbox toggles mutate the draft in place; re-render the panel
        // around the SAME draft so the toggle survives the redraw.
        this._rulesDraftKeep = draft;
        this._refreshMixer();
        this._rulesDraftKeep = null;
    }

    // ------------------------------------------------------------------
    // Zones tab
    // ------------------------------------------------------------------

    _buildZones(root) {
        root.innerHTML = '';
        const title = this._div('font-size:15px;font-weight:600;color:var(--color-text-strong);padding-bottom:4px;');
        title.textContent = this._tt('Эмбиент-зоны карт (позиционный звук)');
        root.appendChild(title);
        const hint = this._div('font-size:10px;color:var(--color-text-dim);padding-bottom:10px;line-height:1.5;');
        hint.textContent = this._tt('Зоны — это реальные события карты в формате OcRam (<aex>-комментарий + Play BGS): рантайм не меняется, существующие источники видны автоматически. Источники с дополнительной логикой показаны «ручными» — редактируются только простые зоны. Изменения пишутся в data/Map###.json — закройте карту в редакторе перед сохранением.');
        root.appendChild(hint);

        const bar = this._div('display:flex;gap:10px;align-items:end;flex-wrap:wrap;padding-bottom:10px;');
        const mapWrap = this._label('Карта');
        const maps = this._projectPath() ? AudioStudioZones.listMaps(this._projectPath()) : [];
        this._zonesMapSel = this._select(
            [{ value: '', label: '— ' + this._tt('выберите карту') + ' —' }]
                .concat(maps.map(m => ({ value: String(m.id), label: m.id + ': ' + m.name }))),
            this._zonesMapId ? String(this._zonesMapId) : '',
            v => { this._zonesMapId = v ? Number(v) : null; this._pendingZones = null; this._refreshZones(); });
        mapWrap.appendChild(this._zonesMapSel);
        bar.appendChild(mapWrap);
        bar.appendChild(this._button('+ ' + this._tt('Добавить зону'), () => this._zoneAddForm()));
        this._zoneSaveBtn = this._button(this._tt('Сохранить изменения'), () => this._zoneSave());
        this._zoneSaveBtn.style.display = 'none';
        bar.appendChild(this._zoneSaveBtn);
        root.appendChild(bar);

        this._zonesList = this._div('display:flex;flex-direction:column;gap:10px;');
        root.appendChild(this._zonesList);
    }

    _refreshZones() {
        if (!this._zonesList) return;
        this._zonesList.innerHTML = '';
        this._zoneSaveBtn.style.display = 'none';
        const proj = this._projectPath();
        if (!proj) return;
        if (!this._zonesMapId) {
            const empty = this._div('color:var(--color-text-muted);font-size:12px;padding:8px;');
            empty.textContent = this._tt('Выберите карту');
            this._zonesList.appendChild(empty);
            return;
        }
        if (!this._pendingZones) {
            let zones = [];
            try { zones = AudioStudioZones.scanZones(proj, this._zonesMapId); }
            catch (e) {
                const err = this._div('color:#f88;font-size:12px;padding:8px;');
                err.textContent = this._tt('Не удалось прочитать карту') + ': ' + e.message;
                this._zonesList.appendChild(err);
                return;
            }
            this._pendingZones = {
                zones,
                updates: [], removals: [],
                additions: [],
                removedIds: new Set()
            };
        }
        const p = this._pendingZones;
        const visible = p.zones.filter(z => !p.removedIds.has(z.eventId)).concat(p.additions);
        if (!visible.length) {
            const empty = this._div('color:var(--color-text-muted);font-size:12px;padding:8px;');
            empty.textContent = this._tt('На карте нет эмбиент-зон');
            this._zonesList.appendChild(empty);
        }
        for (const zone of p.zones) {
            if (p.removedIds.has(zone.eventId)) continue;
            this._zonesList.appendChild(this._zoneCard(zone, false));
        }
        p.additions.forEach((add, i) => {
            this._zonesList.appendChild(this._zoneCard(add, true, i));
        });
        const dirty = p.updates.length || p.removals.length || p.additions.length;
        this._zoneSaveBtn.style.display = dirty ? '' : 'none';
    }

    _zoneCard(zone, isNew, addIndex) {
        const card = this._div(`
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border); border-radius: 6px;
            padding: 12px; display: flex; flex-direction: column; gap: 8px;
        `);
        const head = this._div('display:flex;gap:10px;align-items:center;flex-wrap:wrap;');
        const name = this._div('font-weight:600;font-size:13px;color:var(--color-text-strong);');
        name.textContent = (isNew ? '+ ' : '#' + zone.eventId + ' ') + (zone.bgs.name || this._tt('без файла'));
        head.appendChild(name);
        if (!isNew && !zone.editable) {
            const badge = this._div('font-size:10px;padding:2px 8px;border-radius:8px;background-color:var(--color-bg-deep);color:var(--color-text-dim);border:1px solid var(--color-border);');
            badge.textContent = this._tt('ручной источник');
            head.appendChild(badge);
        }
        head.appendChild(this._div('flex:1'));
        if (zone.bgs.name) {
            head.appendChild(this._button('▶ ' + this._tt('прослушать'), () => {
                const rec = this._typeList('bgs').find(r => r.name === zone.bgs.name);
                if (rec) this._play('bgs', { name: rec.name, relativePath: rec.relativePath, _folder: 'bgs' },
                    { volume: zone.bgs.volume, pitch: zone.bgs.pitch, pan: zone.bgs.pan, loop: true });
            }));
        }
        if (isNew) {
            head.appendChild(this._button('Убрать', () => {
                this._pendingZones.additions.splice(addIndex, 1);
                this._refreshZones();
            }, 'danger'));
            card.appendChild(head);
            this._zoneFields(card, zone, upd => {
                if (upd) Object.assign(zone, upd);
            });
            return card;
        }
        if (zone.editable) {
            head.appendChild(this._button('Удалить', () => {
                this._pendingZones.removals.push(zone.eventId);
                this._pendingZones.removedIds.add(zone.eventId);
                this._refreshZones();
            }, 'danger'));
            card.appendChild(head);
            const mark = () => {
                if (!this._pendingZones.updates.some(u => u.eventId === zone.eventId)) {
                    this._pendingZones.updates.push({ eventId: zone.eventId, zone });
                    this._zoneSaveBtn.style.display = '';
                }
            };
            this._zoneFields(card, zone, mark);
        } else {
            card.appendChild(head);
            const ro = this._div('font-size:11px;color:var(--color-text-dim);line-height:1.6;');
            ro.textContent = 'aex: ' + AudioStudioZones.encodeAex(zone.aex) +
                '  ·  (' + zone.x + ', ' + zone.y + ')' +
                '  ·  ' + zone.bgs.volume + '% / ' + zone.bgs.pitch + '% / pan ' + zone.bgs.pan;
            card.appendChild(ro);
        }
        return card;
    }

    _zoneFields(card, zone, onChange) {
        const grid = this._div('display:grid;grid-template-columns:repeat(6,1fr);gap:8px;');
        const bgsFiles = this._typeList('bgs').map(r => ({ value: r.name, label: RRAssetFiles.basename ? RRAssetFiles.basename(r.name) : r.name }));

        const fileWrap = this._label('Файл BGS');
        fileWrap.appendChild(this._select([{ value: '', label: '—' }].concat(bgsFiles), zone.bgs.name, v => { zone.bgs.name = v; onChange(); }));
        grid.appendChild(fileWrap);

        const mkNum = (label, apply, min, max) => {
            const w = this._label(label);
            w.appendChild(this._numInput(apply.get(), min, max, v => { apply.set(v); onChange(); }));
            return w;
        };
        grid.appendChild(mkNum('X', { get: () => zone.x, set: v => zone.x = v }, 0, 999));
        grid.appendChild(mkNum('Y', { get: () => zone.y, set: v => zone.y = v }, 0, 999));
        grid.appendChild(mkNum('Дистанция', { get: () => zone.aex.distance, set: v => zone.aex.distance = v }, 0, 255));
        grid.appendChild(mkNum('Радиус', { get: () => zone.aex.radius, set: v => zone.aex.radius = v }, 0, 255));
        grid.appendChild(mkNum('Fade (сек)', { get: () => zone.aex.fade, set: v => zone.aex.fade = v }, 0, 120));
        grid.appendChild(mkNum('Громкость', { get: () => zone.bgs.volume, set: v => zone.bgs.volume = v }, 0, 100));
        grid.appendChild(mkNum('Питч', { get: () => zone.bgs.pitch, set: v => zone.bgs.pitch = v }, 50, 150));
        grid.appendChild(mkNum('Пан', { get: () => zone.bgs.pan, set: v => zone.bgs.pan = v }, -100, 100));

        const typeWrap = this._label('Тип');
        typeWrap.appendChild(this._select([
            { value: 'd', label: 'd — динамичный' },
            { value: 'x', label: 'x — горизонталь' },
            { value: 'y', label: 'y — вертикаль' },
            { value: 'bg', label: 'bg — фон (везде)' }
        ], zone.aex.type, v => { zone.aex.type = v; onChange(); }));
        grid.appendChild(typeWrap);

        const flags = this._div('display:flex;gap:14px;align-items:center;font-size:11px;color:var(--color-text);flex-wrap:wrap;');
        const mkFlag = (label, key) => {
            const wrap = this._div('display:flex;gap:5px;align-items:center;');
            wrap.appendChild(document.createTextNode(this._tt(label)));
            wrap.appendChild(this._checkbox(zone.aex[key], v => { zone.aex[key] = v; onChange(); }));
            return wrap;
        };
        flags.appendChild(mkFlag('Автопан', 'pan'));
        flags.appendChild(mkFlag('Форс (играть при входе)', 'forced'));
        flags.appendChild(mkFlag('Новый буфер', 'isNew'));
        const flagsCell = this._div('grid-column:span 3;display:flex;align-items:end;');
        flagsCell.appendChild(flags);
        grid.appendChild(flagsCell);

        card.appendChild(grid);
        return card;
    }

    _zoneAddForm() {
        if (!this._zonesMapId) return;
        const bgs = this._typeList('bgs');
        this._pendingZones.additions.push({
            isNewZone: true,
            eventId: -1,
            x: 0, y: 0,
            editable: true,
            aex: { type: 'd', distance: 20, radius: 0, fade: 2, pan: true, forced: true, isNew: true },
            bgs: { name: (bgs[0] && bgs[0].name) || '', volume: 90, pitch: 100, pan: 0 }
        });
        this._refreshZones();
    }

    _zoneSave() {
        const p = this._pendingZones;
        if (!p) return;
        try {
            const report = AudioStudioZones.applyEdits(this._projectPath(), this._zonesMapId, {
                updates: p.updates.map(u => ({
                    eventId: u.eventId, x: u.zone.x, y: u.zone.y,
                    aex: u.zone.aex, bgs: u.zone.bgs
                })),
                removals: p.removals.slice(),
                additions: p.additions.map(a => ({ x: a.x, y: a.y, aex: a.aex, bgs: a.bgs }))
            });
            this._pendingZones = null;
            this._refreshZones();
            const msg = 'OK: +' + report.added + ' ~' + report.updated + ' -' + report.removed +
                (report.errors.length ? ' | ' + this._tt('ошибки') + ': ' + report.errors.join('; ') : '');
            this._zoneSaveBtn.textContent = msg;
            setTimeout(() => { this._zoneSaveBtn.textContent = this._tt('Сохранить изменения'); }, 2500);
        } catch (e) {
            alert(this._tt('Не удалось сохранить карту') + ': ' + e.message);
        }
    }

    _refreshLibrary() {
        this._typeLists = {};
        if (this._libList) this._renderLibraryList();
    }
}

if (typeof window !== 'undefined') {
    window.AudioStudio = AudioStudio;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioStudio;
}
