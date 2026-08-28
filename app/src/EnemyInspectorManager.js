// Agonia Engine - Enemy Inspector Manager (S51)
// НПС-режим: подсветка врагов-заглушек на карте, клик — панель врага
// (карточка БД / визуал / поведение / урон / зависимости / позиция),
// постановка новых врагов кликом по карте из секции шаблонов.
// Паттерн — LightManager (плавающая панель + PIXI-взаимодействие).

class EnemyInspectorManager {
    constructor(projectController, databaseManager, eventManager) {
        this.projectController = projectController;
        this.databaseManager = databaseManager;
        this.eventManager = eventManager;
        this.tilemapManager = null;
        this.currentMap = null;

        this.npcMode = false;
        this.selectedEvent = null;
        this.selectedTemplate = null;
        this.placementTemplate = null;

        this.highlightContainer = null;   // рамки всех врагов (z 956)
        this.selectionBox = null;         // рамка выбранного
        this.panelEl = null;
        this._interactionContainer = null;
        this._pointerHandlers = null;
        this._dirtyCard = false;
    }

    _t(key, fallback) {
        return (typeof window !== 'undefined' && window.I18n && window.I18n.t)
            ? (window.I18n.t(key) || fallback) : fallback;
    }

    // ------------------------------------------------------------------
    // Данные: шаблоны и заглушки
    // ------------------------------------------------------------------

    getTemplates() {
        try {
            const agonia = this.databaseManager && this.databaseManager.data && this.databaseManager.data.agonia;
            const sec = agonia && agonia.enemies;
            if (!sec || !sec['EnemyDatabase']) return [];
            return JSON.parse(sec['EnemyDatabase'])
                .map(e => { try { return typeof e === 'string' ? JSON.parse(e) : e; } catch (err) { return null; } })
                .filter(t => t && String(t.template) === 'true' && t.match);
        } catch (e) {
            return [];
        }
    }

    /** Карточка-шаблон для события (по note-тегу, как у рантайм-экспандера). */
    findTemplateFor(ev) {
        if (!ev || !ev.note) return null;
        for (const t of this.getTemplates()) {
            if (ev.note.indexOf(String(t.match)) >= 0) return t;
        }
        return null;
    }

    /** Все заглушки врагов на текущей карте. */
    getEnemyStubs() {
        if (!this.currentMap || !this.currentMap.events) return [];
        const templates = this.getTemplates();
        if (!templates.length) return [];
        const out = [];
        for (const ev of this.currentMap.events) {
            if (!ev || !ev.note) continue;
            for (const t of templates) {
                if (ev.note.indexOf(String(t.match)) >= 0) { out.push(ev); break; }
            }
        }
        return out;
    }

    /** Имя атаки из секции Боя (если резолвится) — «№2 · Кувалда». */
    _attackLabel(listKey, id) {
        const n = Number(id) || 0;
        if (!n) return '—';
        let name = null;
        try {
            const battle = this.databaseManager && this.databaseManager.data
                && this.databaseManager.data.agonia && this.databaseManager.data.agonia.battle;
            if (battle && battle[listKey]) {
                const arr = JSON.parse(battle[listKey])
                    .map(e => { try { return typeof e === 'string' ? JSON.parse(e) : e; } catch (x) { return null; } });
                const card = arr[n - 1] || arr.find(c => c && Number(c.id) === n);
                if (card && card.Name) name = card.Name;
            }
        } catch (e) { /* нет секции — показываем просто номер */ }
        return name ? ('№' + n + ' · ' + name) : ('№' + n);
    }

    // ------------------------------------------------------------------
    // Режим НПС
    // ------------------------------------------------------------------

    setTilemapManager(tm) {
        this.tilemapManager = tm;
        if (tm && tm.container && typeof PIXI !== 'undefined' && this.npcMode) {
            this._ensureOverlay();
            this.refreshHighlights();
        }
    }

    setCurrentMap(map) {
        this.currentMap = map;
        this.selectedEvent = null;
        this.selectedTemplate = null;
        this.placementTemplate = null;
        if (this.npcMode) {
            this.refreshHighlights();
            this._renderPanel();
        }
    }

    setNpcMode(enabled) {
        this.npcMode = enabled;
        if (!enabled) {
            this._removeInteraction();
            this._removeOverlay();
            this._hidePanel();
            this.placementTemplate = null;
            // Drop the placement 'copy' cursor if placement was pending.
            if (this.tilemapManager && this.tilemapManager.container
                && this.tilemapManager.container.cursor === 'copy') {
                this.tilemapManager.container.cursor = 'default';
            }
            return;
        }
        if (this.tilemapManager && this.tilemapManager.container && typeof PIXI !== 'undefined') {
            this._ensureOverlay();
            this._setupInteraction();
        }
        // setEventMode(false) leaves a tile-editing crosshair; the NPC picker
        // is a selection tool - use the default cursor.
        if (this.tilemapManager && this.tilemapManager.container) {
            this.tilemapManager.container.cursor = 'default';
        }
        this._ensurePanel();
        this.refreshHighlights();
        this._renderPanel();
    }

    // ------------------------------------------------------------------
    // Подсветка врагов на карте
    // ------------------------------------------------------------------

    _ensureOverlay() {
        if (!this.tilemapManager || !this.tilemapManager.container || typeof PIXI === 'undefined') return;
        if (this.highlightContainer && this.highlightContainer.parent === this.tilemapManager.container) return;
        this.highlightContainer = new PIXI.Container();
        this.highlightContainer.label = 'enemyHighlights';
        this.highlightContainer.zIndex = 956; // над событиями (950), под selection-маркерами (955)
        this.tilemapManager.container.addChild(this.highlightContainer);
        this.tilemapManager.container.sortableChildren = true;
    }

    _removeOverlay() {
        if (this.highlightContainer) {
            if (this.highlightContainer.parent) this.highlightContainer.parent.removeChild(this.highlightContainer);
            this.highlightContainer.destroy({ children: true });
            this.highlightContainer = null;
        }
        this.selectionBox = null;
    }

    refreshHighlights() {
        if (!this.highlightContainer) return;
        this.highlightContainer.removeChildren();
        if (!this.npcMode) return;
        const ts = (this.tilemapManager && this.tilemapManager.TILE_WIDTH) || 48;
        for (const ev of this.getEnemyStubs()) {
            const tpl = this.findTemplateFor(ev);
            const sel = this.selectedEvent === ev;
            const g = new PIXI.Graphics();
            g.rect(1, 1, ts - 2, ts - 2);
            g.stroke({ color: sel ? 0x7ab0ff : 0xff5a5a, width: sel ? 3 : 2, alpha: 0.95 });
            if (sel) { g.rect(5, 5, ts - 10, ts - 10); g.stroke({ color: 0x7ab0ff, width: 1, alpha: 0.6 }); }
            g.x = ev.x * ts;
            g.y = ev.y * ts;
            this.highlightContainer.addChild(g);
        }
    }

    // ------------------------------------------------------------------
    // Взаимодействие с картой
    // ------------------------------------------------------------------

    _setupInteraction() {
        if (!this.tilemapManager || !this.tilemapManager.container) return;
        const container = this.tilemapManager.container;
        if (this._interactionContainer === container) return;
        if (this._interactionContainer) this._removeInteraction();
        this._interactionContainer = container;
        this._pointerHandlers = {};
        const on = (ev, h) => { this._pointerHandlers[ev] = h; container.on(ev, h); };
        container.interactive = true;
        on('pointerdown', (e) => this._handlePointerDown(e));
    }

    _removeInteraction() {
        const container = this._interactionContainer;
        if (container && this._pointerHandlers) {
            for (const [ev, h] of Object.entries(this._pointerHandlers)) {
                try { container.off(ev, h); } catch (e) { /* уже отвязан */ }
            }
        }
        this._pointerHandlers = null;
        this._interactionContainer = null;
    }

    _localTile(e) {
        const container = this.tilemapManager.container;
        const pos = e.data.getLocalPosition(container);
        const ts = this.tilemapManager.TILE_WIDTH || 48;
        return { px: pos.x, py: pos.y, tx: Math.floor(pos.x / ts), ty: Math.floor(pos.y / ts) };
    }

    _handlePointerDown(e) {
        if (!this.npcMode || !this.currentMap) return;
        if (e.data.button !== 0) return;
        const { tx, ty } = this._localTile(e);
        if (tx < 0 || tx >= this.currentMap.width || ty < 0 || ty >= this.currentMap.height) return;

        // Постановка: активный шаблон + клик по пустому месту
        if (this.placementTemplate) {
            const tpl = this.placementTemplate;
            this.placementTemplate = null;
            if (this.tilemapManager && this.tilemapManager.container) this.tilemapManager.container.cursor = 'default';
            const created = this.eventManager && this.eventManager.createEnemyStub
                ? this.eventManager.createEnemyStub(tx, ty, tpl)
                : null;
            if (created) {
                this.refreshHighlights();
                this.select(created);
            }
            this._renderPanel();
            return;
        }

        // Выбор врага по клетке
        const ev = (this.eventManager && this.eventManager.getEventAt)
            ? this.eventManager.getEventAt(tx, ty)
            : null;
        if (ev && this.findTemplateFor(ev)) {
            this.select(ev);
        } else {
            this.selectedEvent = null;
            this.selectedTemplate = null;
            this.refreshHighlights();
            this._renderPanel();
        }
    }

    select(ev) {
        this.selectedEvent = ev;
        this.selectedTemplate = this.findTemplateFor(ev);
        this.refreshHighlights();
        this._renderPanel();
    }

    // ------------------------------------------------------------------
    // Панель
    // ------------------------------------------------------------------

    _ensurePanel() {
        if (this.panelEl) return;
        const wrap = document.createElement('div');
        wrap.id = 'eim-panel';
        wrap.className = 'eim-panel';
        // P3: 620px, две колонки + нижняя полоса, без скролла — панель
        // показывается целиком; на узком контейнере сжимается, не вылезая
        // за левый край экрана.
        wrap.style.cssText = 'display:none;flex-direction:column;width:620px;max-width:calc(100% - 64px);position:absolute;top:8px;right:48px;z-index:9000;background:var(--color-bg-panel);border:1px solid var(--color-border);box-shadow:var(--shadow-popup, -2px 2px 8px rgba(0,0,0,0.3));';
        const host = document.getElementById('canvas-container') || document.body;
        host.appendChild(wrap);
        this.panelEl = wrap;
    }

    _hidePanel() {
        if (this.panelEl) this.panelEl.style.display = 'none';
    }

    _setSaveStatus(text, color) {
        const el = this.panelEl && this.panelEl.querySelector('#eim-save-status');
        if (el) { el.textContent = text; el.style.color = color || ''; }
    }

    _renderPanel() {
        if (!this.panelEl) return;
        this.panelEl.style.display = this.npcMode ? 'flex' : 'none';
        if (!this.npcMode) return;
        this.panelEl.innerHTML = this._panelHtml();
        this._bindPanel();
    }

    _panelHtml() {
        const tpl = this.selectedTemplate;
        const tag = tpl ? String(tpl.match || '').replace(/[<>]/g, '') : '';
        const head = `
        <div style="padding:6px 10px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:600;">👤 ${tpl ? '' : this._t('npcPanel.title', 'Враги (НПС)')}</span>
            ${tpl ? `
            <code style="font-size:12.5px;background:var(--color-bg-deep);padding:1px 6px;border-radius:3px;">${tag}</code>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--color-text-dim);">HP
                <input data-eim-card="hp" type="number" value="${tpl.hp || 0}" style="width:54px;"></span>
            <span title="${this._t('npcPanel.warn', 'Правки меняют карточку БД — всех врагов этого вида на всех картах.')}" style="cursor:help;color:var(--color-warn,#e6b34a);font-size:13px;">ⓘ</span>
            <button class="agonia-btn" data-eim-act="open-db" style="padding:2px 8px;font-size:11px;">${this._t('npcPanel.openDb', 'БД →')}</button>` : ''}
            <span style="flex:1"></span>
            <span id="eim-save-status" style="font-size:10px;color:var(--color-text-muted);">${this._dirtyCard ? '●' : ''}</span>
            <button class="agonia-btn" data-eim-act="save" style="padding:2px 8px;font-size:11px;">💾 ${this._t('npcPanel.save', 'Сохранить')}</button>
        </div>`;
        const body = this.selectedEvent && this.selectedTemplate
            ? this._enemyHtml()
            : this._emptyHtml();
        // P3: две колонки + нижняя полоса, без скролла — панель показывается
        // целиком. Колонкам min-width:0: без него длинный контент (селекты,
        // подписи страха, таблица урона) распирает 1fr-треки и вторая колонка
        // выезжает за край панели (тот же grid-blowout, что в S37b).
        return head + `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 16px;padding:4px 10px 10px;font-size:12px;align-items:start;">${body}</div>`;
    }

    /**
     * P7: список ивентов текущей карты для контекст-палитры (режим событий):
     * мини-превью графики + имя + координаты; клик — выбрать на карте,
     * двойной клик — открыть редактор события.
     */
    buildEventsPalette(hostEl) {
        if (!hostEl) return;
        hostEl.innerHTML = '';
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:var(--color-text-muted);padding:6px 10px;border-bottom:1px solid var(--color-border);';
        hint.textContent = this._t('ctxPalette.eventsHint', 'Клик — выбрать событие · двойной клик — редактор');
        hostEl.appendChild(hint);

        const events = (this.currentMap && this.currentMap.events) ? this.currentMap.events.filter(e => e) : [];
        if (!events.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);font-size:12px;padding:10px;';
            empty.textContent = this._t('ctxPalette.noEvents', 'На карте нет событий. Кликните по пустой клетке карты, чтобы создать.');
            hostEl.appendChild(empty);
            return;
        }
        const list = document.createElement('div');
        list.style.cssText = 'padding:6px;display:flex;flex-direction:column;gap:4px;';
        for (const ev of events) {
            const img = (ev.pages && ev.pages[0] && ev.pages[0].image) || {};
            const row = document.createElement('div');
            const sel = this.eventManager && this.eventManager.selectedEvent === ev;
            row.style.cssText = `
                display:flex;align-items:center;gap:8px;padding:4px 6px;cursor:pointer;
                border:1px solid ${sel ? 'var(--color-accent-border-mid,#5a8ad4)' : 'var(--color-border)'};
                border-radius:4px;background:${sel ? 'var(--color-bg-hover,rgba(122,176,255,0.12))' : 'var(--color-bg-deep)'};
            `;
            // мини-превью: лист персонажа с object-position на ячейку
            const thumb = document.createElement('div');
            const name = String(img.characterName || '');
            if (name) {
                const pic = document.createElement('img');
                pic.src = this._eventSpriteUrl(name);
                pic.style.cssText = 'width:24px;height:32px;image-rendering:pixelated;object-fit:none;';
                const idx = Number(img.characterIndex) || 0;
                pic.style.objectPosition = (-idx % 4 * 24) + 'px ' + (Math.floor(idx / 4) * 32) + 'px';
                // сдвиг на 2-й кадр (шаг) для живости: +24px по x
                pic.style.objectPosition = (-(idx % 4) * 24 - 24) + 'px ' + (-Math.floor(idx / 4) * 32) + 'px';
                thumb.appendChild(pic);
            } else {
                thumb.style.cssText = 'width:24px;height:32px;border:1px dashed var(--color-border);border-radius:3px;';
            }
            thumb.style.flex = 'none';
            thumb.style.overflow = 'hidden';
            row.appendChild(thumb);
            const label = document.createElement('div');
            label.style.cssText = 'flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            label.textContent = String(ev.name || ('EV' + ev.id));
            row.appendChild(label);
            const pos = document.createElement('span');
            pos.style.cssText = 'flex:none;font-size:10px;color:var(--color-text-dim);';
            pos.textContent = ev.x + ',' + ev.y;
            row.appendChild(pos);

            row.addEventListener('click', () => {
                if (this.eventManager && this.eventManager.selectEventById) this.eventManager.selectEventById(ev.id);
                this.buildEventsPalette(hostEl);
            });
            row.addEventListener('dblclick', () => {
                if (this.eventManager && this.eventManager.editEvent) this.eventManager.editEvent(ev);
            });
            list.appendChild(row);
        }
        hostEl.appendChild(list);
    }

    _eventSpriteUrl(name) {
        try {
            if (typeof RRAssetFiles === 'undefined') return '';
            const proj = this.projectController && this.projectController.getCurrentProject();
            if (!proj || !proj.path) return '';
            let path = null;
            try { path = (typeof require === 'function') ? require('path') : window.require('path'); } catch (e) { return ''; }
            return RRAssetFiles.toUrl(path.join(proj.path, 'img', 'characters', name + '.png'));
        } catch (e) {
            return '';
        }
    }

    /**
     * P7: список источников света для контекст-палитры (режим света):
     * цветной свотч + тип + радиус + координаты; клик — выбрать источник.
     */
    buildLightsPalette(hostEl) {
        if (!hostEl) return;
        hostEl.innerHTML = '';
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:var(--color-text-muted);padding:6px 10px;border-bottom:1px solid var(--color-border);';
        hint.textContent = this._t('ctxPalette.lightsHint', 'Клик — выбрать источник света');
        hostEl.appendChild(hint);

        const lights = (this._getLights && this._getLights()) || [];
        if (!lights.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);font-size:12px;padding:10px;';
            empty.textContent = this._t('ctxPalette.noLights', 'На карте нет источников света.');
            hostEl.appendChild(empty);
            return;
        }
        const list = document.createElement('div');
        list.style.cssText = 'padding:6px;display:flex;flex-direction:column;gap:4px;';
        for (const L of lights) {
            const p = L.props || {};
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 6px;cursor:pointer;border:1px solid var(--color-border);border-radius:4px;background:var(--color-bg-deep);';
            const sw = document.createElement('span');
            sw.style.cssText = 'flex:none;width:18px;height:18px;border-radius:50%;border:1px solid var(--color-border);background:' + (p.color || '#ffffff') + ';';
            row.appendChild(sw);
            const label = document.createElement('div');
            label.style.cssText = 'flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            label.textContent = (p.type === 'Flashlight' ? '🔦 Фонарь' : '💡 ' + (p.presetId || 'Свет'))
                + ' · ' + (p.radius || '?') + 'т'
                + (p.active === false ? ' · выкл' : '');
            row.appendChild(label);
            const pos = document.createElement('span');
            pos.style.cssText = 'flex:none;font-size:10px;color:var(--color-text-dim);';
            pos.textContent = L.x + ',' + L.y;
            row.appendChild(pos);
            row.addEventListener('click', () => {
                if (this._onSelectLight) this._onSelectLight(L.uid);
            });
            list.appendChild(row);
        }
        hostEl.appendChild(list);
    }

    /**
     * P6: спавн-палитра врагов в левом сайдбаре (вместо тайлсета в НПС-режиме).
     * Грид живых карточек-мини-плееров по всем template-карточкам БД; клик —
     * режим постановки (курсор copy), клик по карте = createEnemyStub.
     */
    buildSidebarPalette(hostEl) {
        if (!hostEl) return;
        hostEl.innerHTML = '';
        const templates = this.getTemplates();
        const header = document.createElement('div');
        header.style.cssText = 'font-size:10px;color:var(--color-text-muted);padding:6px 10px;border-bottom:1px solid var(--color-border);';
        header.textContent = this._t('npcPalette.hint', 'Кликните по врагу, затем по пустой клетке карты');
        hostEl.appendChild(header);

        if (!templates.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);font-size:12px;padding:10px;';
            empty.textContent = this._t('npcPalette.empty', 'Нет карточек-шаблонов. Создайте врага в БД (Бой → ИИ Врагов, чекбокс «Шаблон врага»).');
            hostEl.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.style.cssText = 'padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;';

        // свой инстанс Спрайтера под палитру — пул мини-плееров живёт своей
        // жизнью и рециклится при каждой пересборке
        let spriter = null;
        if (typeof DatabaseSpriterEditor !== 'undefined') {
            if (!this._paletteSpriter) {
                this._paletteSpriter = new DatabaseSpriterEditor(this.databaseManager, this.projectController, null, null);
            }
            spriter = this._paletteSpriter;
            if (spriter._players) spriter._players.length = 0;
            if (spriter._masterTimer) { clearInterval(spriter._masterTimer); spriter._masterTimer = null; }
        }

        for (const t of templates) {
            const tag = String(t.match || '').replace(/[<>]/g, '');
            const selKey = String(t.match || '');
            const isArmed = () => !!(this.placementTemplate && String(this.placementTemplate.match || '') === selKey);
            const card = document.createElement('div');
            const active = isArmed();
            card.style.cssText = `
                border: 1px solid ${active ? 'var(--color-accent-text, #7ab0ff)' : 'var(--color-border)'};
                border-radius: 6px; padding: 6px; cursor: pointer;
                background-color: var(--color-bg-deep); text-align: center;
                ${active ? 'box-shadow: 0 0 0 2px var(--color-accent-tint-25, rgba(122,176,255,0.25));' : ''}
            `;
            card.dataset.eimPlace = String(t.match || '');

            if (spriter) {
                const live = {
                    get Visuals() {
                        return { CharacterName: t.spriteName || '', CharacterIndex: Number(t.spriteIndex) || 0 };
                    }
                };
                card.appendChild(spriter._renderPlayer(live, 'skins', { mini: true }));
            }
            const cap = document.createElement('div');
            cap.style.cssText = 'font-size:10px;color:var(--color-text);margin-top:4px;word-break:break-word;';
            cap.textContent = '👤 ' + tag;
            card.appendChild(cap);
            const hp = document.createElement('div');
            hp.style.cssText = 'font-size:9.5px;color:var(--color-text-dim);';
            hp.textContent = 'HP ' + (t.hp || '?') + (active ? ' · клик по карте…' : '');
            card.appendChild(hp);

            card.addEventListener('click', () => {
                // getTemplates() репарсит MV-строку — сравниваем по тегу, не по ссылке
                this.placementTemplate = isArmed() ? null : t;
                if (this.placementTemplate && this.tilemapManager && this.tilemapManager.container) {
                    this.tilemapManager.container.cursor = 'copy';
                } else if (this.tilemapManager && this.tilemapManager.container) {
                    this.tilemapManager.container.cursor = 'default';
                }
                this.buildSidebarPalette(hostEl);
                this._renderPanel();
            });
            grid.appendChild(card);
        }
        hostEl.appendChild(grid);
    }

    /** Остановить плееры палитры (при выходе из НПС-режима). */
    stopPalettePlayers() {
        if (this._paletteSpriter && this._paletteSpriter._masterTimer) {
            clearInterval(this._paletteSpriter._masterTimer);
            this._paletteSpriter._masterTimer = null;
        }
        if (this._paletteSpriter && this._paletteSpriter._players) {
            this._paletteSpriter._players.length = 0;
        }
    }

    /** P5: фиксированный набор состояний карточки. */
    _statesList() {
        return [
            ['rest', this._t('npcPanel.stRest', 'Покой')],
            ['alert', this._t('npcPanel.stAlert', 'Тревога')],
            ['combat', this._t('npcPanel.stCombat', 'Бой')],
            ['panic', this._t('npcPanel.stPanic', 'Паника')],
            ['flee', this._t('npcPanel.stFlee', 'Бегство')],
            ['attack', this._t('npcPanel.stAttack', 'Атака')],
            ['hurt', this._t('npcPanel.stHurt', 'Урон')],
            ['death', this._t('npcPanel.stDeath', 'Смерть')]
        ];
    }

    /** P5: секция «Состояния» — строка на состояние: графика (пикер) + звук. */
    _statesHtml(tpl) {
        let gfx = {}, snd = {};
        try { if (tpl.stateGraphics) gfx = JSON.parse(tpl.stateGraphics) || {}; } catch (e) { gfx = {}; }
        try { if (tpl.stateSounds) snd = JSON.parse(tpl.stateSounds) || {}; } catch (e) { snd = {}; }
        let html = this._sec(this._t('npcPanel.states', 'Состояния (графика + звук)'));
        html += `<div style="font-size:10px;color:var(--color-text-muted);margin-bottom:2px;">${this._t('npcPanel.statesHint', 'Пусто = основной спрайт. Звук играется на входе состояния.')}</div>`;
        for (const [key, label] of this._statesList()) {
            const g = gfx[key] || {};
            const gLabel = g.name ? (String(g.name) + '#' + (Number(g.index) || 0)) : '—';
            html += `<div style="display:flex;align-items:center;gap:5px;margin:2px 0;min-width:0;">
                <span style="flex:none;width:58px;color:var(--color-text-dim);">${label}</span>
                <span title="${this._t('npcPanel.pickSprite', 'Выбрать файл и ячейку персонажа')}" data-eim-state-gfx="${key}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;padding:2px 6px;border:1px solid var(--color-border);border-radius:3px;background:var(--color-bg-deep);">${gLabel}</span>
                <input data-eim-state-se="${key}" type="text" value="${String(snd[key] || '').replace(/"/g, '&quot;')}" placeholder="SE" style="flex:none;width:84px;min-width:52px;box-sizing:border-box;font-size:11px;">
            </div>`;
        }
        return html;
    }

    _emptyHtml() {
        return `<div style="color:var(--color-text-muted);padding:4px 2px 10px;">
            ${this._t('npcPanel.noSelection', 'Кликните по врагу на карте (красная рамка), чтобы править его карточку.')}</div>`;
    }

    _sec(title) {
        return `<div style="font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--color-text-dim);margin:7px 0 4px;">${title}</div>`;
    }

    _row(label, inner) {
        return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;min-width:0;">
            <span style="flex:none;width:118px;color:var(--color-text-dim);">${label}</span>
            <span style="flex:1;min-width:0;">${inner}</span></div>`;
    }

    _inp(key, value, type) {
        return `<input data-eim-card="${key}" type="${type || 'text'}" value="${String(value === undefined || value === null ? '' : value).replace(/"/g, '&quot;')}" style="width:100%;min-width:52px;box-sizing:border-box;">`;
    }

    _sel(key, value, options) {
        let html = `<select data-eim-card="${key}" style="width:100%;min-width:0;box-sizing:border-box;">`;
        for (const [v, label] of options) {
            html += `<option value="${v}" ${String(value) === v ? 'selected' : ''}>${label}</option>`;
        }
        return html + '</select>';
    }

    _chk(key, checked, label) {
        return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;min-width:0;">
            <input data-eim-card="${key}" type="checkbox" ${checked ? 'checked' : ''}>
            <span>${label}</span></label>`;
    }

    _enemyHtml() {
        const tpl = this.selectedTemplate;
        const ev = this.selectedEvent;

        // --- Левая колонка: кто он ---
        let left = '';
        left += this._sec(this._t('npcPanel.character', 'Характер'));
        left += this._row(this._t('npcPanel.disposition', 'Поведение'), this._sel('disposition',
            String(tpl.disposition || 'aggressive'),
            [['aggressive', this._t('npcPanel.aggressive', 'Злой — нападает')],
             ['peaceful', this._t('npcPanel.peaceful', 'Мирный — не атакует')]]));

        // P3: страх оружием — чекбоксы из Арсенала
        const weapons = this.getWeapons();
        if (weapons.length) {
            const fearedSet = new Set(String(tpl.fearedWeapons || '').split(',')
                .map(s => Number(s.trim())).filter(n => n > 0));
            left += `<div style="font-size:10.5px;color:var(--color-text-dim);margin:5px 0 2px;">${this._t('npcPanel.fear', 'Боится оружия (паника/бегство от выбранных):')}</div>`;
            for (const w of weapons) {
                left += this._chkFeared(w.varValue, fearedSet.has(w.varValue),
                    (w.name || 'var ' + w.varValue) + ' <span style="color:var(--color-text-dim);">· var ' + w.varValue + '</span>');
            }
            left += `<div style="font-size:10px;color:var(--color-text-muted);margin-top:2px;">${this._t('npcPanel.fearHint', 'Ни один — глобальное условие оружия (GunCondition).')}</div>`;
        }

        left += this._sec(this._t('npcPanel.abilities', 'Способности'));
        left += `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 10px;margin:2px 0;">`;
        left += this._chk('canPanic', String(tpl.canPanic) !== 'false', this._t('npcPanel.canPanic', 'Пугается'));
        left += this._chk('canFlee', String(tpl.canFlee) !== 'false', this._t('npcPanel.canFlee', 'Убегает'));
        left += this._chk('rememberGun', String(tpl.rememberGun) !== 'false', this._t('npcPanel.rememberGun', 'Помнит оружие'));
        left += `</div>`;

        left += this._sec(this._t('npcPanel.speed', 'Скорость (MV 1–6)'));
        left += this._row(this._t('npcPanel.speedCalm', 'В покое'), this._inp('speedCalm', tpl.speedCalm, 'number'));
        left += this._row(this._t('npcPanel.speedCombat', 'В бою'), this._inp('speedCombat', tpl.speedCombat, 'number'));
        left += this._row(this._t('npcPanel.stepVolume', 'Громкость шагов %'), this._inp('stepVolume', tpl.stepVolume, 'number'));

        left += this._statesHtml(tpl);

        left += this._sec(this._t('npcPanel.visual', 'Визуал'));
        // P3b: без превью; файл и ячейка выбираются двухшаговым пикером (как в Спрайтере)
        left += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
            <span style="flex:none;width:118px;color:var(--color-text-dim);">${this._t('npcPanel.sprite', 'Спрайт')}</span>
            <input data-eim-card="spriteName" type="text" value="${String(tpl.spriteName || '').replace(/"/g, '&quot;')}" style="flex:1;min-width:0;box-sizing:border-box;" placeholder="img/characters">
            <button class="agonia-btn" data-eim-act="pick-sprite" title="${this._t('npcPanel.pickSprite', 'Выбрать файл и ячейку персонажа')}" style="flex:none;padding:2px 9px;">…</button>
        </div>`;
        left += this._row('Коллайдер', this._inp('collider', tpl.collider));

        // --- Правая колонка: как дерётся ---
        let right = '';
        right += this._sec(this._t('npcPanel.behavior', 'Поведение'));
        // P3d: поля поведения в один столбец — в половинной колонке двухколоночный
        // грид оставлял инпутам ~15px (нечитаемо); метки над полным рядом.
        right += this._row(this._t('npcPanel.attackRadius', 'Радиус атаки'), this._inp('attackRadius', tpl.attackRadius, 'number'));
        right += this._row(this._t('npcPanel.hearing', 'Радиус слуха'), this._inp('hearingRadius', tpl.hearingRadius, 'number'));
        right += this._row(this._t('npcPanel.hearingThr', 'Порог шума'), this._inp('hearingThreshold', tpl.hearingThreshold, 'number'));
        right += this._row(this._t('npcPanel.chase', 'Погоня от'), this._inp('chaseThreshold', tpl.chaseThreshold, 'number'));
        right += this._row(this._t('npcPanel.cower', 'Приседание от'), this._inp('cowerThreshold', tpl.cowerThreshold, 'number'));
        right += `<div style="font-size:10.5px;color:var(--color-text-dim);margin:4px 0 0;min-width:0;overflow-wrap:anywhere;">`;
        right += this._t('npcPanel.tracer', 'Трассер') + ': <b>' + this._attackLabel('Tracer List', tpl.tracerId) + '</b> · ';
        right += this._t('npcPanel.melee', 'Ближний бой') + ': <b>' + this._attackLabel('Melee List', tpl.meleeId) + '</b> · ';
        right += this._t('npcPanel.dash', 'Рывок') + ': <b>' + (String(tpl.dashName || '') !== '' ? tpl.dashName : '—') + '</b>';
        right += `</div>`;

        right += this._sec(this._t('npcPanel.damage', 'Урон по врагу'));
        right += this._damageTableHtml(tpl);

        // --- Нижняя полоса на всю ширину: справочник флагов | карта и постановка ---
        let bottom = `<div style="grid-column:1 / -1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 16px;border-top:1px solid var(--color-border);margin-top:4px;padding-top:2px;">`;
        bottom += `<div style="min-width:0;">`;
        bottom += this._sec(this._t('npcPanel.flags', 'Флаги ИИ (какие есть)'));
        bottom += this._flagsReferenceHtml(tpl);
        bottom += `</div><div style="min-width:0;">`;
        bottom += this._sec(this._t('npcPanel.onMap', 'На карте'));
        bottom += this._row(this._t('npcPanel.name', 'Имя') + ' / ID', `<code>${ev.id}</code> <input data-eim-ev="name" value="${String(ev.name || '').replace(/"/g, '&quot;')}" style="width:calc(100% - 34px);">`);
        bottom += this._row('X / Y', `<input data-eim-ev="x" type="number" value="${ev.x}" style="width:56px;"> <input data-eim-ev="y" type="number" value="${ev.y}" style="width:56px;">`);
        bottom += `<div style="margin:5px 0;"><button class="agonia-btn" data-eim-act="del" style="padding:2px 10px;font-size:11px;color:#ff7a7a;">✕ ${this._t('npcPanel.delete', 'Удалить врага')}</button></div>`;
        bottom += `</div></div>`;

        return `<div style="min-width:0;">${left}</div><div style="min-width:0;">${right}</div>${bottom}`;
    }

    /**
     * P3b/P5: двухшаговый пикер спрайта Спрайтера (шаг 1 — файл листа,
     * шаг 2 — ячейка персонажа 4×2; $-листы = одна ячейка). Без state —
     * пишет основной спрайт карточки; со state — графику состояния.
     */
    _pickSprite(state) {
        if (typeof DatabaseSpriterEditor === 'undefined') return;
        if (!this.selectedTemplate) return;
        if (!this._spriterPicker) {
            this._spriterPicker = new DatabaseSpriterEditor(this.databaseManager, this.projectController, null, null);
        }
        const cur = state ? '' : String(this.selectedTemplate.spriteName || '');
        this._spriterPicker._showFilePicker(cur, (name, index) => {
            if (state) {
                let gfx = {};
                try { if (this.selectedTemplate.stateGraphics) gfx = JSON.parse(this.selectedTemplate.stateGraphics) || {}; } catch (e) { gfx = {}; }
                gfx[state] = { name: String(name), index: Number(index) || 0 };
                this._saveCard(this.selectedTemplate.match, 'stateGraphics', JSON.stringify(gfx));
            } else {
                this._saveCard(this.selectedTemplate.match, 'spriteName', name);
                this._saveCard(this.selectedTemplate.match, 'spriteIndex', String(index !== undefined ? index : 0));
                const inp = this.panelEl && this.panelEl.querySelector('[data-eim-card="spriteName"]');
                if (inp) inp.value = name;
            }
        }, 'characters', { pickCharacterIndex: true });
    }

    _chkFeared(varValue, checked, label) {
        return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:2px 0;min-width:0;">
            <input data-eim-feared="${varValue}" type="checkbox" ${checked ? 'checked' : ''}>
            <span>${label}</span></label>`;
    }

    /** P3: Арсенал (enemies['Weapon List']) — справочник оружий ГГ. */
    getWeapons() {
        try {
            const agonia = this.databaseManager && this.databaseManager.data && this.databaseManager.data.agonia;
            const sec = agonia && agonia.enemies;
            if (!sec || !sec['Weapon List']) return [];
            return JSON.parse(sec['Weapon List'])
                .map(w => { try { return typeof w === 'string' ? JSON.parse(w) : w; } catch (e) { return null; } })
                .filter(Boolean);
        } catch (e) {
            return [];
        }
    }

    /** Таблица урона: оружие → урон (овverride врага > урон Арсенала), fallback кулаки. */
    _damageTableHtml(tpl) {
        let overrides = {};
        try { if (tpl.damageOverrides) overrides = JSON.parse(tpl.damageOverrides) || {}; } catch (e) { overrides = {}; }
        const weapons = this.getWeapons();
        let html = '';
        if (weapons.length) {
            html += `<div style="font-size:10px;color:var(--color-text-muted);margin-bottom:2px;">${this._t('npcPanel.dmgHint', 'Из Арсенала (Бой → Оружие); измени значение — станет переопределением этого врага.')}</div>`;
            for (const w of weapons) {
                const v = String(w.varValue);
                const effective = (overrides[v] !== undefined) ? overrides[v] : (w.damage !== undefined ? w.damage : '');
                html += this._row(
                    `${w.name || 'var ' + v} <span style="color:var(--color-text-dim);">var ${v}${String(w.sneakKill) === 'true' ? ' · скрытно' : ''}</span>`,
                    `<input data-eim-override="${v}" type="number" value="${String(effective).replace(/"/g, '&quot;')}" style="width:100%;box-sizing:border-box;">`);
            }
        }
        html += this._row(this._t('npcPanel.dmgFists', 'Без оружия (кулаки)'), this._inp('damageFists', tpl.damageFists, 'number'));
        html += this._row('SE (fallback)', this._inp('damageSE', tpl.damageSE));
        return html;
    }

    /** S52: справочник флагов движка ИИ с пометкой активных у этого врага. */
    _flagsReferenceHtml(tpl) {
        const chip = (name, desc, active) =>
            `<span title="${desc}" style="display:inline-block;margin:2px 3px 2px 0;padding:2px 8px;border-radius:9px;font-size:10.5px;border:1px solid ${active ? 'var(--color-accent-border-mid,#5a8ad4)' : 'var(--color-border)'};color:${active ? 'var(--color-text-strong,var(--color-text))' : 'var(--color-text-dim)'};opacity:${active ? 1 : 0.55};${active ? 'background:var(--color-accent-tint-25,rgba(122,176,255,0.16));' : ''}">${name}</span>`;
        const peaceful = String(tpl.disposition) === 'peaceful';
        const canPanic = String(tpl.canPanic) !== 'false';
        const canFlee = String(tpl.canFlee) !== 'false';
        const rememberGun = String(tpl.rememberGun) !== 'false';
        const attacks = !peaceful && ((Number(tpl.tracerId) || 0) > 0 || (Number(tpl.meleeId) || 0) > 0 || String(tpl.dashName || '') !== '');

        let html = `<div style="font-size:10px;color:var(--color-text-dim);margin-bottom:2px;">${this._t('npcPanel.flagsSensors', 'Сенсоры (считает движок всегда):')}</div><div>`;
        html += chip('zona', 'Игрок в радиусе атаки', Number(tpl.attackRadius) > 0);
        html += chip('contact', 'Прямой зрительный контакт (raycast)', true);
        html += chip('hearing', 'Игрок шумит в радиусе слуха', Number(tpl.hearingRadius) > 0);
        html += chip('scope', 'ГГ целится (глобальный свитч прицела)', true);
        html += chip('gun', 'У ГГ дальнобойное оружие', true);
        html += chip('melee', 'У ГГ оружие ближнего боя', true);
        html += chip('dead', 'HP врага ≤ 0', true);
        html += chip('light_*', 'Зоны света (яркая/касательная/фактическая)', true);
        html += `</div>`;

        html += `<div style="font-size:10px;color:var(--color-text-dim);margin:6px 0 2px;">${this._t('npcPanel.flagsClassic', 'Классические (включены у этого врага — жирнее):')}</div><div>`;
        html += chip('combat', 'В бою (от zona/hearing, таймаут)', true);
        html += chip('calm', 'Успокоился (таймер)', Number(tpl.calmTime) > 0);
        html += chip('warning', 'Насторожился (услышал шум)', true);
        html += chip('panic', 'Паника', canPanic);
        html += chip('flee', 'Бегство', canFlee);
        html += chip('remembergun', 'Запомнил оружие ГГ', rememberGun);
        html += chip('shot', 'По нему выстрелили (гаснет ~10 тиков)', true);
        html += chip('loch', 'Промах/ложная цель (гаснет ~10 тиков)', true);
        html += chip('wound', 'Ранен', true);
        html += `</div>`;
        html += `<div style="font-size:10px;color:var(--color-text-dim);margin-top:4px;">${
            attacks
                ? 'Атаки: ' + (peaceful ? '—' : [Number(tpl.tracerId) > 0 ? 'трассер' : null, Number(tpl.meleeId) > 0 ? 'удар' : null, String(tpl.dashName || '') !== '' ? 'рывок' : null].filter(Boolean).join(' + ') || '—')
                : 'Атак нет' + (peaceful ? ' (мирный)' : ' (не заданы карточки атак)') + '. Кастомные правила — в БД, вкладка «ИИ Врагов».'}</div>`;
        return html;
    }

    // ------------------------------------------------------------------
    // Правки: карточка (БД, глобально) и событие (карта)
    // ------------------------------------------------------------------

    /** Записать поле в карточку шаблона (in-memory; «Сохранить» — на диск). */
    _saveCard(matchTag, key, value) {
        const agonia = this.databaseManager && this.databaseManager.data && this.databaseManager.data.agonia;
        if (!agonia || !agonia.enemies || !agonia.enemies['EnemyDatabase']) return false;
        try {
            const arr = JSON.parse(agonia.enemies['EnemyDatabase']);
            for (let i = 0; i < arr.length; i++) {
                const o = JSON.parse(arr[i]);
                if (String(o.match) === String(matchTag)) {
                    o[key] = String(value);
                    arr[i] = JSON.stringify(o);
                    agonia.enemies['EnemyDatabase'] = JSON.stringify(arr);
                    this._dirtyCard = true;
                    this._setSaveStatus('●', '#e6b34a');
                    // обновить ссылки
                    if (this.selectedTemplate) this.selectedTemplate[key] = String(value);
                    return true;
                }
            }
        } catch (e) {
            console.error('EnemyInspector: card save failed', e);
        }
        return false;
    }

    async saveCardToDisk() {
        const proj = this.projectController && this.projectController.getCurrentProject();
        if (!proj || !this.databaseManager.saveAgonia) return false;
        const ok = await this.databaseManager.saveAgonia(proj.path);
        if (ok) {
            this._dirtyCard = false;
            this._setSaveStatus('✓ ' + new Date().toLocaleTimeString(), '#2ecc71');
        }
        return ok;
    }

    _saveEventField(key, value) {
        const ev = this.selectedEvent;
        if (!ev || !this.currentMap) return;
        if (key === 'x' || key === 'y') {
            const n = Math.max(0, Math.floor(Number(value) || 0));
            if (key === 'x' && n >= this.currentMap.width) return;
            if (key === 'y' && n >= this.currentMap.height) return;
            if (this.eventManager && this.eventManager.saveState) this.eventManager.saveState();
            ev[key] = n;
        } else {
            ev[key] = String(value);
        }
        if (this.eventManager && this.eventManager.renderEvents) this.eventManager.renderEvents();
        this.refreshHighlights();
    }

    _deleteSelected() {
        const ev = this.selectedEvent;
        if (!ev) return;
        if (this.eventManager && this.eventManager.deleteEvent) this.eventManager.deleteEvent(ev);
        this.selectedEvent = null;
        this.selectedTemplate = null;
        this.refreshHighlights();
        this._renderPanel();
    }

    // ------------------------------------------------------------------
    // Биндинг панели
    // ------------------------------------------------------------------

    _bindPanel() {
        const el = this.panelEl;
        if (!el) return;
        el.querySelectorAll('[data-eim-act]').forEach(b => {
            b.addEventListener('click', async () => {
                const a = b.dataset.eimAct;
                if (a === 'save') await this.saveCardToDisk();
                else if (a === 'open-db') {
                    const r = (typeof window !== 'undefined' && window.reactor) ? window.reactor : null;
                    if (r && r.openDatabase) r.openDatabase('enemyAI');
                } else if (a === 'del') this._deleteSelected();
                else if (a === 'pick-sprite') this._pickSprite();
            });
        });
        el.querySelectorAll('[data-eim-card]').forEach(inp => {
            inp.addEventListener('change', () => {
                if (!this.selectedTemplate) return;
                const key = inp.dataset.eimCard;
                const value = inp.type === 'checkbox' ? (inp.checked ? 'true' : 'false') : inp.value;
                this._saveCard(this.selectedTemplate.match, key, value);
            });
        });
        el.querySelectorAll('[data-eim-ev]').forEach(inp => {
            inp.addEventListener('change', () => this._saveEventField(inp.dataset.eimEv, inp.value));
        });
        // P3: оверрайд урона из таблицы Арсенала
        el.querySelectorAll('[data-eim-override]').forEach(inp => {
            inp.addEventListener('change', () => {
                if (!this.selectedTemplate) return;
                const v = inp.dataset.eimOverride;
                const weapon = this.getWeapons().find(w => String(w.varValue) === v);
                let overrides = {};
                try { if (this.selectedTemplate.damageOverrides) overrides = JSON.parse(this.selectedTemplate.damageOverrides) || {}; } catch (e) { overrides = {}; }
                const val = Number(inp.value) || 0;
                if (weapon && Number(weapon.damage) === val) delete overrides[v];
                else overrides[v] = String(val);
                this._saveCard(this.selectedTemplate.match, 'damageOverrides', JSON.stringify(overrides));
            });
        });
        // P3: страх оружием
        el.querySelectorAll('[data-eim-feared]').forEach(inp => {
            inp.addEventListener('change', () => {
                if (!this.selectedTemplate) return;
                const current = new Set(String(this.selectedTemplate.fearedWeapons || '').split(',')
                    .map(s => Number(s.trim())).filter(n => n > 0));
                const v = Number(inp.dataset.eimFeared);
                if (inp.checked) current.add(v); else current.delete(v);
                this._saveCard(this.selectedTemplate.match, 'fearedWeapons',
                    Array.from(current).sort((a, b) => a - b).join(','));
            });
        });
        // P5: графика состояния — клик по строке открывает пикер
        el.querySelectorAll('[data-eim-state-gfx]').forEach(span => {
            span.addEventListener('click', () => this._pickSprite(span.dataset.eimStateGfx));
        });
        // P5: звук состояния
        el.querySelectorAll('[data-eim-state-se]').forEach(inp => {
            inp.addEventListener('change', () => {
                if (!this.selectedTemplate) return;
                const key = inp.dataset.eimStateSe;
                let snd = {};
                try { if (this.selectedTemplate.stateSounds) snd = JSON.parse(this.selectedTemplate.stateSounds) || {}; } catch (e) { snd = {}; }
                if (String(inp.value || '').trim() === '') delete snd[key];
                else snd[key] = String(inp.value).trim();
                this._saveCard(this.selectedTemplate.match, 'stateSounds', JSON.stringify(snd));
            });
        });
        el.querySelectorAll('[data-eim-place]').forEach(b => {
            b.addEventListener('click', () => {
                const tag = b.dataset.eimPlace;
                const tpl = this.getTemplates().find(t => String(t.match) === tag);
                if (!tpl) return;
                this.placementTemplate = (this.placementTemplate === tpl) ? null : tpl;
                if (this.placementTemplate && this.tilemapManager && this.tilemapManager.container) {
                    this.tilemapManager.container.cursor = 'copy';
                } else if (this.tilemapManager && this.tilemapManager.container) {
                    this.tilemapManager.container.cursor = 'default';
                }
                this._renderPanel();
            });
        });
    }
}

if (typeof window !== 'undefined') {
    window.EnemyInspectorManager = EnemyInspectorManager;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnemyInspectorManager;
}
