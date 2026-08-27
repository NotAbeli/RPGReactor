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
        wrap.style.cssText = 'display:none;flex-direction:column;width:300px;max-height:calc(100% - 16px);position:absolute;top:8px;right:48px;z-index:9000;background:var(--color-bg-panel);border:1px solid var(--color-border);box-shadow:var(--shadow-popup, -2px 2px 8px rgba(0,0,0,0.3));overflow:hidden;';
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
        const head = `
        <div style="padding:8px 10px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:6px;">
            <span style="font-weight:600;">👤 ${this._t('npcPanel.title', 'Враги (НПС)')}</span>
            <span style="flex:1"></span>
            <span id="eim-save-status" style="font-size:10px;color:var(--color-text-muted);">${this._dirtyCard ? '●' : ''}</span>
            <button class="agonia-btn" data-eim-act="save" style="padding:2px 8px;font-size:11px;">💾 ${this._t('npcPanel.save', 'Сохранить')}</button>
        </div>`;
        const body = this.selectedEvent && this.selectedTemplate
            ? this._enemyHtml()
            : this._emptyHtml() + this._templatesHtml();
        return head + `<div style="flex:1;overflow:auto;padding:8px 10px;font-size:12px;">${body}</div>`;
    }

    _emptyHtml() {
        return `<div style="color:var(--color-text-muted);padding:4px 2px 10px;">
            ${this._t('npcPanel.noSelection', 'Кликните по врагу на карте (красная рамка), чтобы править его карточку.')}</div>`;
    }

    _sec(title) {
        return `<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--color-text-dim);margin:12px 0 6px;">${title}</div>`;
    }

    _row(label, inner) {
        return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
            <span style="flex:none;width:130px;color:var(--color-text-dim);">${label}</span>
            <span style="flex:1;min-width:0;">${inner}</span></div>`;
    }

    _inp(key, value, type) {
        return `<input data-eim-card="${key}" type="${type || 'text'}" value="${String(value === undefined || value === null ? '' : value).replace(/"/g, '&quot;')}" style="width:100%;box-sizing:border-box;">`;
    }

    _enemyHtml() {
        const tpl = this.selectedTemplate;
        const ev = this.selectedEvent;
        const tag = String(tpl.match || '').replace(/[<>]/g, '');
        let html = '';

        html += this._sec(this._t('npcPanel.card', 'Карточка'));
        html += this._row(this._t('npcPanel.tag', 'Тег вида'), `<code>${tag}</code>`);
        html += this._row('HP', this._inp('hp', tpl.hp, 'number'));
        html += this._row(this._t('npcPanel.scope', 'Область'), tpl.scope === 'global' ? this._t('npcPanel.scopeGlobal', 'глобальная (между картами)') : this._t('npcPanel.scopeLocal', 'локальная'));
        html += `<div style="margin:4px 0;"><button class="agonia-btn" data-eim-act="open-db" style="padding:3px 10px;font-size:11px;">${this._t('npcPanel.openDb', 'Открыть в БД →')}</button></div>`;
        html += `<div style="font-size:10px;color:var(--color-warn,#e6b34a);padding:2px;">${this._t('npcPanel.warn', 'Правки ниже меняют карточку БД — всех врагов этого вида на всех картах.')}</div>`;

        html += this._sec(this._t('npcPanel.visual', 'Визуал'));
        html += `<div style="margin:4px 0;"><img data-eim-preview src="${this._spriteUrl(tpl.spriteName)}" alt="" style="image-rendering:pixelated;max-width:100%;max-height:120px;display:${tpl.spriteName ? 'block' : 'none'};border:1px solid var(--color-border);"></div>`;
        html += this._row(this._t('npcPanel.sprite', 'Спрайт'), this._inp('spriteName', tpl.spriteName));
        html += this._row(this._t('npcPanel.spriteIdx', 'Индекс'), this._inp('spriteIndex', tpl.spriteIndex, 'number'));
        html += this._row('Коллайдер', this._inp('collider', tpl.collider));

        html += this._sec(this._t('npcPanel.behavior', 'Поведение'));
        html += this._row(this._t('npcPanel.attackRadius', 'Радиус атаки'), this._inp('attackRadius', tpl.attackRadius, 'number'));
        html += this._row(this._t('npcPanel.hearing', 'Радиус слуха'), this._inp('hearingRadius', tpl.hearingRadius, 'number'));
        html += this._row(this._t('npcPanel.hearingThr', 'Порог шума'), this._inp('hearingThreshold', tpl.hearingThreshold, 'number'));
        html += this._row(this._t('npcPanel.chase', 'Погоня от (в бою)'), this._inp('chaseThreshold', tpl.chaseThreshold, 'number'));
        html += this._row(this._t('npcPanel.cower', 'Приседание от'), this._inp('cowerThreshold', tpl.cowerThreshold, 'number'));
        html += this._row(this._t('npcPanel.tracer', 'Трассер'), this._attackLabel('Tracer List', tpl.tracerId));
        html += this._row(this._t('npcPanel.melee', 'Ближний бой'), this._attackLabel('Melee List', tpl.meleeId));
        html += this._row(this._t('npcPanel.dash', 'Рывок'), String(tpl.dashName || '—'));

        html += this._sec(this._t('npcPanel.damage', 'Урон по врагу'));
        html += this._row(this._t('npcPanel.dmgMelee', 'Оружие ближнее (var)'), this._inp('damageMeleeVar', tpl.damageMeleeVar, 'number'));
        html += this._row(this._t('npcPanel.dmgGun', 'Оружие дальнее (var)'), this._inp('damageGunVar', tpl.damageGunVar, 'number'));
        html += this._row(this._t('npcPanel.dmgByWeapon', 'Урон оружием'), this._inp('damageMelee', tpl.damageMelee, 'number'));
        html += this._row(this._t('npcPanel.dmgFists', 'Урон без оружия'), this._inp('damageFists', tpl.damageFists, 'number'));
        html += this._row('SE', this._inp('damageSE', tpl.damageSE));
        html += this._row(this._t('npcPanel.sneak', 'Скрытное убийство'), `<input data-eim-card="sneakKill" type="checkbox" ${String(tpl.sneakKill) === 'true' ? 'checked' : ''}>`);

        html += this._sec(this._t('npcPanel.deps', 'От чего зависит (только чтение)'));
        for (const line of this._dependencyLines(tpl)) {
            html += `<div style="margin:2px 0;color:var(--color-text);">• ${line}</div>`;
        }

        html += this._sec(this._t('npcPanel.onMap', 'На карте'));
        html += this._row('ID / ' + this._t('npcPanel.name', 'Имя'), `<code>${ev.id}</code> <input data-eim-ev="name" value="${String(ev.name || '').replace(/"/g, '&quot;')}" style="width:60%;">`);
        html += this._row('X / Y', `<input data-eim-ev="x" type="number" value="${ev.x}" style="width:56px;"> <input data-eim-ev="y" type="number" value="${ev.y}" style="width:56px;">`);
        html += `<div style="margin:6px 0;"><button class="agonia-btn" data-eim-act="del" style="padding:3px 10px;font-size:11px;color:#ff7a7a;">✕ ${this._t('npcPanel.delete', 'Удалить врага')}</button></div>`;

        html += this._templatesHtml();
        return html;
    }

    _dependencyLines(tpl) {
        const meleeVar = Number(tpl.damageMeleeVar) || 2;
        const gunVar = Number(tpl.damageGunVar) || 37;
        const fists = Number(tpl.damageFists) || -20;
        const byWpn = Number(tpl.damageMelee) || -100;
        const chase = Number(tpl.chaseThreshold) || 2;
        const cower = Number(tpl.cowerThreshold) || 3;
        const hearR = Number(tpl.hearingRadius) || 0;
        const hearT = Number(tpl.hearingThreshold) || 0;
        return [
            `Переменная облика/оружия ГГ: ${meleeVar} → урон ${byWpn}, ${gunVar} → ${byWpn}, прочее → ${fists} + рана`,
            `Счётчик боя: погоня при ≥ ${chase} врагах в бою, приседание при ≥ ${cower}`,
            `Слух: радиус ${hearR}, порог шума ${hearT} (заметил — насторожился, YurStealth включает A)`,
            `Свитч «вне боя»: скрытное убийство оружием ${String(tpl.sneakKill) === 'true' ? 'вкл' : 'выкл'}`,
            `Свитч прицела ГГ (18): увидел прицел + контакт → паника`,
            `Свитч глобального сброса ИИ (48), MEHP HP в переменных от базовой`,
            `Селф-свитчи: A — заметил игрока, B — резерв, C — вошёл в бой, D — получил урон`
        ];
    }

    _templatesHtml() {
        const templates = this.getTemplates();
        if (!templates.length) return '';
        let html = this._sec(this._t('npcPanel.place', 'Поставить врага'));
        html += `<div style="font-size:10px;color:var(--color-text-muted);margin-bottom:4px;">${this._t('npcPanel.placeHint', 'Кликните по виду, затем по пустой клетке карты.')}</div>`;
        for (const t of templates) {
            const tag = String(t.match || '').replace(/[<>]/g, '');
            const active = this.placementTemplate === t;
            html += `<button class="agonia-btn" data-eim-place="${String(t.match).replace(/"/g, '&quot;')}" style="display:block;width:100%;text-align:left;margin:2px 0;padding:4px 8px;font-size:11px;${active ? 'border-color:var(--color-accent-border-mid);font-weight:700;' : ''}">👤 ${tag} · HP ${t.hp || '?'} ${active ? '· клик по карте…' : ''}</button>`;
        }
        return html;
    }

    _spriteUrl(name) {
        if (!name) return '';
        try {
            if (typeof RRAssetFiles === 'undefined') return '';
            const proj = this.projectController && this.projectController.getCurrentProject();
            if (!proj || !proj.path) return '';
            const path = this._req('path');
            if (!path) return '';
            return RRAssetFiles.toUrl(path.join(proj.path, 'img', 'characters', name + '.png'));
        } catch (e) {
            return '';
        }
    }

    _req(name) {
        try {
            if (typeof require === 'function') return require(name);
            if (typeof window !== 'undefined' && typeof window.require === 'function') return window.require(name);
        } catch (e) { /* not in NW/node */ }
        return null;
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
            });
        });
        el.querySelectorAll('[data-eim-card]').forEach(inp => {
            inp.addEventListener('change', () => {
                if (!this.selectedTemplate) return;
                const key = inp.dataset.eimCard;
                const value = inp.type === 'checkbox' ? (inp.checked ? 'true' : 'false') : inp.value;
                this._saveCard(this.selectedTemplate.match, key, value);
                if (key === 'spriteName' || key === 'spriteIndex') {
                    const img = el.querySelector('[data-eim-preview]');
                    if (img && key === 'spriteName') { img.src = this._spriteUrl(value); img.style.display = value ? 'block' : 'none'; }
                }
            });
        });
        el.querySelectorAll('[data-eim-ev]').forEach(inp => {
            inp.addEventListener('change', () => this._saveEventField(inp.dataset.eimEv, inp.value));
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
