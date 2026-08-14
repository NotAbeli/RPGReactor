/*:
 * @plugindesc [RU] v1.0 Редактор путей/POI/выходов/маршрутов для НПС (вкладка в F12 Super Tools Engine).
 * @author Korolev
 *
 * @help
 * ============================================================================
 * SUPER DUPER NPC PATHS (v1.0)
 * ============================================================================
 * Добавляет в F12-меню Super Tools Engine вкладку "NPC Paths" для настройки:
 *   - Точек интереса (POI) и выходов с локации
 *   - Путей (полилиний) между точками
 *   - Привязок маршрутов к конкретным НПС (по eventId/типу врага)
 *   - Условий "когда НПС пользуется маршрутом" (по state-флагам SuperDuperEnemies)
 *
 * ЗАВИСИМОСТИ (обязательные):
 *   - SRD_SuperToolsEngine.js
 *   - SuperDuperEnemies.js            (источник НПС + флаги состояния)
 *   - SuperDuperMovement_Addon.js     (smartPatrol/smartMoveTo/smartFleeFromPlayer/...)
 *
 * КАК ЭТО РАБОТАЕТ
 *   1. НПС = событие карты, зарегистрированное в SuperDuperEnemies (через match).
 *      Список НПС текущей карты берётся через window.SDE_API.getRegisteredEventIds().
 *   2. Все настройки сохраняются в data/NpcPaths.json (override по mapId).
 *   3. В рантайме (вне редактора) плагин каждый кадр (с throttling) проверяет:
 *      - глобальный switch "Движения НПС" (по умолчанию 64) включён?
 *      - для каждого НПС: какой маршрут из его списка подходит под текущие флаги?
 *      - при смене активного маршрута вызывает соответствующую smart*-команду.
 *
 * СТРУКТУРА data/NpcPaths.json:
 *   {
 *     "version": 1,
 *     "savedAt": 0,
 *     "maps": {
 *       "<mapId>": {
 *         "points": { "<id>": { x, y, type, label, mapExitId } },
 *         "paths":  { "<id>": { from, to, points: [[x,y],...] } },
 *         "npc":    { "<eventId>": { name, enemyId, routes: [...] } }
 *       }
 *     }
 *   }
 *
 * @param NpcMovementSwitch
 * @text Switch "Движения НПС"
 * @desc ID переключателя. Когда ВЫКЛ, НПС стоят на месте. 0 = всегда активны.
 * @type switch
 * @default 64
 *
 * @param RouteCheckInterval
 * @parent Runtime
 * @text Интервал проверки (кадры)
 * @desc Как часто пересчитывать активный маршрут каждого НПС.
 * @type number
 * @min 1
 * @default 30
 *
 * @param --- Runtime ---
 * @default
 */

(function () {
    "use strict";

    // ===========================================================================
    // GUARD: выходим, если нет SRD Super Tools Engine или SuperDuperEnemies
    // ===========================================================================
    if (typeof MakerManager === 'undefined') {
        // SRD_SuperToolsEngine не загружен — silently exit. Плагин только для playtest UI.
        return;
    }
    if (typeof window.SDE_API === 'undefined') {
        // SuperDuperEnemies отсутствует либо старая версия без SDE_API. Тоже молча.
        // В этом случае плагин не сможет читать флаги — значит runtime-движения не будет.
        console.warn('[SuperDuperNpcPaths] window.SDE_API не найден — runtime-движения НПС недоступны.');
    }

    // ===========================================================================
    // КОНСТАНТЫ И ПАРАМЕТРЫ
    // ===========================================================================
    var PLUGIN_NAME = 'SuperDuperNpcPaths';

    var params = PluginManager.parameters(PLUGIN_NAME) || {};
    var NPC_MOVEMENT_SWITCH = Number(params['NpcMovementSwitch'] || 64);
    var ROUTE_CHECK_INTERVAL = Math.max(1, Number(params['RouteCheckInterval'] || 30));

    // Допустимые типы точек
    var POINT_TYPES = ['waypoint', 'poi', 'exit'];

    // Состояния UI редактора (только в playtest/F12-окне)
    var UI = {
        tab: 'points',          // 'points' | 'paths' | 'npc' | 'conditions'
        selPointId: null,       // выбранный point id
        selPathId: null,        // выбранный path id
        selNpcId: null,         // выбранный eventId НПС
        selRouteIdx: -1,        // выбранный индекс маршрута в routes НПС
        editorActive: false,    // true, пока пользователь в нашей вкладке F12
        pickMode: null,         // null | 'addPathPoint' | 'pickNpc'
        dirty: false            // есть несохранённые правки
    };

    // in-memory копия data/NpcPaths.json
    var PATCH = { version: 1, savedAt: 0, maps: {} };
    var PATCH_LOADED = false;
    var ID_COUNTER = 0;          // монотонный счётчик для генерации id

    // Хранилище текущего активного маршрута на каждом событии (для runtime)
    // key: mapId+'_'+eventId, value: индекс активного route в routes НПС
    var ACTIVE_ROUTE = {};

    // Throttling runtime-проверки
    var RUNTIME_TICK = 0;

    // ===========================================================================
    // МЕНЕДЖЕР (по образцу LightEditorManager)
    // ===========================================================================
    function NpcPathsManager() { throw new Error('NpcPathsManager — статический класс'); }
    window.NpcPathsManager = NpcPathsManager;

    // alias-ы
    var _ = {};

    // ===========================================================================
    // DOM-ХЕЛПЕРЫ (работают через MakerManager.document — контекст F12-окна)
    // ===========================================================================
    function doc() { return MakerManager.document; }
    function esc(s) {
        s = (s === undefined || s === null) ? '' : String(s);
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function getVal(id) { var el = doc().getElementById(id); return el ? el.value : ''; }
    function getChecked(id) { var el = doc().getElementById(id); return el ? !!el.checked : false; }
    function setHTML(id, html) { var el = doc().getElementById(id); if (el) el.innerHTML = html; }
    function refreshOverlay() {
        var scene = SceneManager._scene;
        if (scene && scene._spriteset && scene._spriteset._npcPathsOverlay) {
            scene._spriteset._npcPathsOverlay._dirty = true;
        }
    }

    // ===========================================================================
    // ДОСТУП К ДАННЫМ КАРТЫ
    // ===========================================================================
    NpcPathsManager.currentMapId = function () {
        return $gameMap ? $gameMap.mapId() : 0;
    };

    NpcPathsManager.mapData = function (mapId, create) {
        mapId = (mapId === undefined) ? this.currentMapId() : mapId;
        var key = String(mapId);
        if (!PATCH.maps[key] && create) {
            PATCH.maps[key] = { points: {}, paths: {}, npc: {} };
        }
        return PATCH.maps[key] || null;
    };

    NpcPathsManager.ensureCurrent = function () {
        return this.mapData(this.currentMapId(), true);
    };

    NpcPathsManager.uid = function (prefix) {
        ID_COUNTER++;
        return prefix + ID_COUNTER;
    };

    // Список НПС текущей карты: [{eventId, name, enemyId}]
    NpcPathsManager.npcList = function () {
        if (!window.SDE_API) return [];
        var mapId = this.currentMapId();
        var ids = window.SDE_API.getRegisteredEventIds();
        var result = [];
        for (var i = 0; i < ids.length; i++) {
            var evId = ids[i];
            var ev = $dataMap && $dataMap.events ? $dataMap.events[evId] : null;
            var name = ev ? (ev.name || ('EV' + evId)) : ('EV' + evId);
            var data = window.SDE_API.getEventData(mapId, evId);
            result.push({ eventId: evId, name: name, enemyId: data ? data.enemyId : 0 });
        }
        result.sort(function (a, b) { return a.eventId - b.eventId; });
        return result;
    };

    // Список точек текущей карты в виде массива [{id, ...}]
    NpcPathsManager.pointList = function () {
        var m = this.mapData();
        if (!m) return [];
        var arr = [];
        for (var id in m.points) {
            if (m.points.hasOwnProperty(id)) arr.push(Object.assign({ id: id }, m.points[id]));
        }
        arr.sort(function (a, b) {
            if (a.type !== b.type) return a.type < b.type ? -1 : 1;
            return a.id < b.id ? -1 : 1;
        });
        return arr;
    };

    NpcPathsManager.pathList = function () {
        var m = this.mapData();
        if (!m) return [];
        var arr = [];
        for (var id in m.paths) {
            if (m.paths.hasOwnProperty(id)) arr.push(Object.assign({ id: id }, m.paths[id]));
        }
        return arr;
    };

    NpcPathsManager.npcConfig = function (eventId, create) {
        var m = this.ensureCurrent();
        if (!m.npc[String(eventId)] && create) {
            m.npc[String(eventId)] = { name: '', enemyId: 0, routes: [] };
        }
        return m.npc[String(eventId)] || null;
    };

    NpcPathsManager.allFlagNames = function () {
        if (window.SDE_API && window.SDE_API.getKnownFlagNames) {
            return window.SDE_API.getKnownFlagNames();
        }
        // fallback-список (из справки SuperDuperEnemies)
        return ['combat','calm','warning','panic','alert','flee','wound',
                'scope','gun','melee','dead','zona','hearing','contact',
                'light_actual','light_tangent','light_bright','shot','loch','remembergun'];
    };

    // ===========================================================================
    // PERSISTENCE
    // ===========================================================================
    NpcPathsManager._isNwjs = function () {
        return (typeof Utils !== 'undefined' && Utils.isNwjs && Utils.isNwjs());
    };

    NpcPathsManager._patchPath = function () {
        try {
            if (typeof FileManager !== 'undefined' && FileManager.filePath) {
                return FileManager.filePath('data/NpcPaths.json');
            }
        } catch (e) {}
        var path = require('path');
        var base = path.dirname(process.mainModule.filename);
        return path.join(base, 'data', 'NpcPaths.json');
    };

    NpcPathsManager.loadPatch = function () {
        if (PATCH_LOADED) return;
        PATCH_LOADED = true;
        if (!this._isNwjs()) return;
        try {
            var fs = require('fs');
            var p = this._patchPath();
            if (fs.existsSync(p)) {
                var raw = fs.readFileSync(p, 'utf8');
                var parsed = JSON.parse(raw);
                if (parsed && parsed.maps) {
                    PATCH.version = parsed.version || 1;
                    PATCH.savedAt = parsed.savedAt || 0;
                    PATCH.maps = parsed.maps || {};
                    // восстановим ID_COUNTER чтобы не было коллизий при добавлении новых
                    var maxN = 0;
                    for (var mk in PATCH.maps) {
                        if (!PATCH.maps.hasOwnProperty(mk)) continue;
                        var mp = PATCH.maps[mk];
                        if (mp.points) for (var pid in mp.points) {
                            var n = parseInt(pid.replace(/[^0-9]/g, ''), 10);
                            if (!isNaN(n) && n > maxN) maxN = n;
                        }
                        if (mp.paths) for (var ptid in mp.paths) {
                            var n2 = parseInt(ptid.replace(/[^0-9]/g, ''), 10);
                            if (!isNaN(n2) && n2 > maxN) maxN = n2;
                        }
                    }
                    ID_COUNTER = maxN;
                }
            }
        } catch (e) {
            console.warn('[SuperDuperNpcPaths] loadPatch error:', e);
        }
    };

    NpcPathsManager.saveAll = function () {
        if (!this._isNwjs()) {
            this._setStatus('Сохранение недоступно вне NW.js', '#e74c3c');
            return false;
        }
        try {
            var fs = require('fs');
            var p = this._patchPath();
            // бэкап
            try {
                if (fs.existsSync(p)) {
                    fs.writeFileSync(p + '.bak', fs.readFileSync(p));
                }
            } catch (e2) {}
            PATCH.savedAt = Date.now();
            fs.writeFileSync(p, JSON.stringify(PATCH, null, 2));
            UI.dirty = false;
            this._setStatus('Сохранено: ' + new Date().toLocaleTimeString(), '#2ecc71');
            this._refreshSaveBtn();
            return true;
        } catch (e) {
            console.error('[SuperDuperNpcPaths] saveAll error:', e);
            this._setStatus('Ошибка сохранения: ' + e.message, '#e74c3c');
            return false;
        }
    };

    NpcPathsManager.clearPatch = function () {
        if (!this._isNwjs()) return;
        try {
            var fs = require('fs');
            var p = this._patchPath();
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {}
        PATCH.maps = {};
        PATCH.savedAt = 0;
        UI.dirty = false;
        UI.selPointId = null;
        UI.selPathId = null;
        UI.selNpcId = null;
        UI.selRouteIdx = -1;
    };

    NpcPathsManager.markDirty = function () {
        UI.dirty = true;
        this._refreshSaveBtn();
    };

    NpcPathsManager._setStatus = function (text, color) {
        var el = doc().getElementById('saveStatus');
        if (el) {
            el.textContent = text;
            el.style.color = color || '#cccccc';
        }
    };

    NpcPathsManager._refreshSaveBtn = function () {
        var btn = doc().getElementById('saveBtn');
        if (btn) {
            btn.textContent = UI.dirty ? '💾 Сохранить всё *' : '💾 Сохранить всё';
            btn.style.fontWeight = UI.dirty ? 'bold' : 'normal';
        }
    };

    // ===========================================================================
    // ТОЧКИ И ПУТИ — операции добавления/удаления
    // ===========================================================================
    NpcPathsManager.addPointAt = function (x, y, type, label) {
        var m = this.ensureCurrent();
        var id = this.uid('p');
        m.points[id] = {
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            type: type || 'waypoint',
            label: label || '',
            mapExitId: null
        };
        this.markDirty();
        return id;
    };

    NpcPathsManager.deletePoint = function (id) {
        var m = this.mapData();
        if (!m || !m.points[id]) return;
        // Удалим также ссылки из путей
        for (var pid in m.paths) {
            if (!m.paths.hasOwnProperty(pid)) continue;
            var path = m.paths[pid];
            if (path.from === id || path.to === id) {
                // разорвём связь, оставим точки как есть
                if (path.from === id) path.from = null;
                if (path.to === id) path.to = null;
            }
        }
        delete m.points[id];
        if (UI.selPointId === id) UI.selPointId = null;
        this.markDirty();
    };

    NpcPathsManager.updatePoint = function (id, fields) {
        var m = this.mapData();
        if (!m || !m.points[id]) return;
        for (var k in fields) {
            if (fields.hasOwnProperty(k)) m.points[id][k] = fields[k];
        }
        this.markDirty();
    };

    NpcPathsManager.createPath = function (fromId, toId) {
        var m = this.ensureCurrent();
        var id = this.uid('pt');
        var from = m.points[fromId], to = m.points[toId];
        var pts = [];
        if (from) pts.push([from.x, from.y]);
        if (to)   pts.push([to.x, to.y]);
        m.paths[id] = { from: fromId || null, to: toId || null, points: pts };
        this.markDirty();
        return id;
    };

    NpcPathsManager.deletePath = function (id) {
        var m = this.mapData();
        if (!m || !m.paths[id]) return;
        delete m.paths[id];
        if (UI.selPathId === id) UI.selPathId = null;
        this.markDirty();
    };

    NpcPathsManager.appendPathPoint = function (pathId, x, y) {
        var m = this.mapData();
        if (!m || !m.paths[pathId]) return;
        m.paths[pathId].points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
        this.markDirty();
    };

    NpcPathsManager.removeLastPathPoint = function (pathId) {
        var m = this.mapData();
        if (!m || !m.paths[pathId]) return;
        var pts = m.paths[pathId].points;
        if (pts.length > 0) pts.pop();
        this.markDirty();
    };

    // ===========================================================================
    // МАРШРУТЫ НПС — операции
    // ===========================================================================
    NpcPathsManager.addRoute = function (eventId) {
        var cfg = this.npcConfig(eventId, true);
        cfg.routes.push({
            kind: 'patrol',          // patrol | goto | flee | wander | stop
            target: null,            // pathId (patrol) | pointId (goto) | null (flee/wander)
            radius: 5,               // для wander
            waitFrames: 60,          // для wander
            safeDistance: 10,        // для flee
            conditions: [],          // массив {flag, negated}
            mode: 'all'              // all (AND) | any (OR)
        });
        this.markDirty();
        return cfg.routes.length - 1;
    };

    NpcPathsManager.deleteRoute = function (eventId, idx) {
        var cfg = this.npcConfig(eventId);
        if (!cfg || idx < 0 || idx >= cfg.routes.length) return;
        cfg.routes.splice(idx, 1);
        if (UI.selRouteIdx === idx) UI.selRouteIdx = -1;
        else if (UI.selRouteIdx > idx) UI.selRouteIdx--;
        this.markDirty();
    };

    NpcPathsManager.updateRoute = function (eventId, idx, fields) {
        var cfg = this.npcConfig(eventId);
        if (!cfg || idx < 0 || idx >= cfg.routes.length) return;
        var r = cfg.routes[idx];
        for (var k in fields) {
            if (fields.hasOwnProperty(k)) r[k] = fields[k];
        }
        this.markDirty();
    };

    NpcPathsManager.addCondition = function (eventId, routeIdx, flag, negated) {
        var cfg = this.npcConfig(eventId);
        if (!cfg || routeIdx < 0 || routeIdx >= cfg.routes.length) return;
        cfg.routes[routeIdx].conditions.push({ flag: flag, negated: !!negated });
        this.markDirty();
    };

    NpcPathsManager.deleteCondition = function (eventId, routeIdx, condIdx) {
        var cfg = this.npcConfig(eventId);
        if (!cfg || routeIdx < 0 || routeIdx >= cfg.routes.length) return;
        cfg.routes[routeIdx].conditions.splice(condIdx, 1);
        this.markDirty();
    };

    // ===========================================================================
    // ЛОГИКА ВЫБОРА МАРШРУТА ПО ФЛАГАМ
    // ===========================================================================
    NpcPathsManager.routeMatches = function (route, flags) {
        if (!route.conditions || route.conditions.length === 0) return true;
        var mode = route.mode === 'any' ? 'any' : 'all';
        for (var i = 0; i < route.conditions.length; i++) {
            var c = route.conditions[i];
            var val = !!(flags && flags[c.flag]);
            var ok = c.negated ? !val : val;
            if (mode === 'any' && ok) return true;
            if (mode === 'all' && !ok) return false;
        }
        // any: ни одно условие не сработало -> false
        // all: все ok -> true
        return mode === 'all';
    };

    NpcPathsManager.pickRoute = function (cfg, flags) {
        if (!cfg || !cfg.routes || cfg.routes.length === 0) return -1;
        for (var i = 0; i < cfg.routes.length; i++) {
            if (this.routeMatches(cfg.routes[i], flags)) return i;
        }
        return -1;
    };

    // ===========================================================================
    // РЕГИСТРАЦИЯ В SRD SUPER TOOLS ENGINE
    // ===========================================================================
    // 1) Экспорт NpcPathsManager в контекст F12-окна
    _.MakerManager_assignWindow = MakerManager.assignWindow;
    MakerManager.assignWindow = function () {
        _.MakerManager_assignWindow.apply(this, arguments);
        try { this._window.window.NpcPathsManager = NpcPathsManager; } catch (e) {}
    };

    // 2) Добавление кнопки-ланчера в Tool Kit
    _.MakerManager_getLauncherButtonsRaw = MakerManager.getLauncherButtonsRaw;
    MakerManager.getLauncherButtonsRaw = function () {
        var result = _.MakerManager_getLauncherButtonsRaw.apply(this, arguments);
        try {
            result.push(this.generateLauncherRow(
                "NPC Paths",
                "Редактор путей / POI / выходов / маршрутов для НПС",
                "NpcPathsManager.setupWindowHtml()",
                "#1fa84a"
            ));
        } catch (e) { console.warn('[NpcPaths] launcher error:', e); }
        return result;
    };
    // Сброс кэша кнопок
    try { MakerManager._buttons = undefined; } catch (e) {}

    // 3) Очистка при закрытии F12
    _.MakerManager_onFinish = MakerManager.onFinish;
    MakerManager.onFinish = function () {
        UI.editorActive = false;
        refreshOverlay();
        if (_.MakerManager_onFinish) _.MakerManager_onFinish.apply(this, arguments);
    };

    // ===========================================================================
    // ТОЧКА ВХОДА ВКЛАДКИ
    // ===========================================================================
    NpcPathsManager.setupWindowHtml = function () {
        this.loadPatch();
        UI.editorActive = true;
        UI.pickMode = null;
        MakerManager.window.title = "Super Tools Engine  -  NPC Paths";
        MakerManager.mode = 'npc_paths';
        this.setTab(UI.tab || 'points');
        refreshOverlay();
    };

    NpcPathsManager.returnToMaker = function () {
        UI.editorActive = false;
        UI.pickMode = null;
        refreshOverlay();
        MakerManager.setupWindowHtml();
    };

    // ===========================================================================
    // СБОРКА СТРАНИЦЫ
    // ===========================================================================
    NpcPathsManager.setTab = function (tab) {
        UI.tab = tab;
        var body;
        switch (tab) {
            case 'points':     body = this.getPointsHtml(); break;
            case 'paths':      body = this.getPathsHtml();  break;
            case 'npc':        body = this.getNpcHtml();    break;
            case 'conditions': body = this.getConditionsHtml(); break;
            default:           body = this.getPointsHtml();
        }
        MakerManager.mainHTML = this.topBar(tab) + this.getStyles() + this.getSaveBar() + body;
        this._refreshSaveBtn();
        refreshOverlay();
    };

    NpcPathsManager.topBar = function (active) {
        function item(tab, label) {
            var cls = (tab === active) ? ' class="np-tab np-tab-active"' : ' class="np-tab"';
            return '<a' + cls + ' onclick="NpcPathsManager.setTab(\'' + tab + '\')">' + esc(label) + '</a>';
        }
        return '' +
        '<div class="np-topbar">' +
            item('points', 'Точки') +
            item('paths', 'Пути') +
            item('npc', 'НПС') +
            item('conditions', 'Условия') +
            '<a class="np-tab np-tab-back" onclick="NpcPathsManager.returnToMaker()">← Назад</a>' +
        '</div>';
    };

    NpcPathsManager.getStyles = function () {
        var c = MakerManager.colors || {};
        var bg   = c.window || '#222222';
        var fg   = c.text || '#ffffff';
        var acc  = c.positive || '#1fa84a';
        var acc2 = c.detail2 || '#1f8af4';
        var warn = c.negative || '#e74c3c';
        return '' +
        '<style>' +
          '.np-wrap { padding: 8px; color: ' + fg + '; font-family: sans-serif; font-size: 13px; }' +
          '.np-topbar { display: flex; gap: 4px; padding: 6px; background: ' + bg + '; border-bottom: 2px solid ' + acc + '; }' +
          '.np-tab { padding: 6px 12px; cursor: pointer; border-radius: 4px 4px 0 0; background: #333; color: ' + fg + '; }' +
          '.np-tab:hover { background: #444; }' +
          '.np-tab-active { background: ' + acc + '; color: #000; font-weight: bold; }' +
          '.np-tab-back { margin-left: auto; background: #555; }' +
          '.np-savebar { padding: 8px; background: rgba(0,0,0,0.25); display: flex; align-items: center; gap: 10px; }' +
          '.np-savebar button { padding: 6px 12px; cursor: pointer; border: none; border-radius: 3px; background: ' + acc + '; color: #000; font-weight: bold; }' +
          '.np-savebar button.clear { background: ' + warn + '; color: #fff; }' +
          '.np-savebar button:disabled { opacity: 0.5; cursor: default; }' +
          '#saveStatus { font-size: 12px; opacity: 0.85; }' +
          '.np-section { padding: 8px; }' +
          '.np-h2 { font-size: 15px; margin: 8px 0 4px; color: ' + acc + '; border-bottom: 1px solid #444; padding-bottom: 2px; }' +
          '.np-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }' +
          '.np-row label { min-width: 110px; opacity: 0.85; }' +
          '.np-row input[type=text], .np-row input[type=number], .np-row select { flex: 1; padding: 4px; background: #1a1a1a; color: ' + fg + '; border: 1px solid #444; border-radius: 3px; }' +
          '.np-btn { padding: 4px 10px; cursor: pointer; border: 1px solid ' + acc + '; background: transparent; color: ' + acc + '; border-radius: 3px; }' +
          '.np-btn:hover { background: ' + acc + '; color: #000; }' +
          '.np-btn.warn { border-color: ' + warn + '; color: ' + warn + '; }' +
          '.np-btn.warn:hover { background: ' + warn + '; color: #fff; }' +
          '.np-btn.active { background: ' + acc2 + '; color: #fff; border-color: ' + acc2 + '; }' +
          '.np-list { background: #1a1a1a; border: 1px solid #444; border-radius: 3px; max-height: 240px; overflow-y: auto; }' +
          '.np-list-item { padding: 6px 8px; cursor: pointer; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 6px; }' +
          '.np-list-item:hover { background: #2a2a2a; }' +
          '.np-list-item.selected { background: rgba(31,168,74,0.25); }' +
          '.np-list-item .badge { padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: bold; }' +
          '.np-badge-waypoint { background: #888; color: #000; }' +
          '.np-badge-poi { background: ' + acc2 + '; color: #fff; }' +
          '.np-badge-exit { background: ' + warn + '; color: #fff; }' +
          '.np-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }' +
          '.np-col { background: rgba(0,0,0,0.15); padding: 8px; border-radius: 4px; }' +
          '.np-hint { font-size: 11px; opacity: 0.65; margin-top: 4px; line-height: 1.4; }' +
          '.np-tag { display: inline-block; padding: 2px 8px; background: #333; border-radius: 10px; margin: 2px; font-size: 11px; }' +
          '.np-tag.neg { background: ' + warn + '; color: #fff; }' +
          '.np-tag.pos { background: ' + acc + '; color: #000; }' +
          '.np-tag-del { cursor: pointer; opacity: 0.6; margin-left: 4px; }' +
          '.np-tag-del:hover { opacity: 1; }' +
          '.np-divider { border-top: 1px dashed #444; margin: 8px 0; }' +
        '</style>';
    };

    NpcPathsManager.getSaveBar = function () {
        var disabled = this._isNwjs() ? '' : ' disabled';
        return '' +
        '<div class="np-savebar">' +
            '<button id="saveBtn" onclick="NpcPathsManager.saveAll()"' + disabled + '>💾 Сохранить всё</button>' +
            '<button class="clear" onclick="NpcPathsManager.confirmClear()"' + disabled + '>✕ Очистить</button>' +
            '<span id="saveStatus"></span>' +
            '<span class="np-hint" style="margin-left:auto">Карта #' + this.currentMapId() + (UI.dirty ? ' • есть несохранённые правки' : '') + '</span>' +
        '</div>';
    };

    NpcPathsManager.confirmClear = function () {
        var d = doc();
        if (!d) return;
        if (!d.default.confirm('Удалить ВСЕ настройки путей для ВСЕХ карт? Это необратимо.')) return;
        this.clearPatch();
        this.setTab(UI.tab);
    };

    // ===========================================================================
    // ВКЛАДКА: ТОЧКИ (POI / EXIT / WAYPOINT)
    // ===========================================================================
    NpcPathsManager.getPointsHtml = function () {
        var list = this.pointList();
        var sel = UI.selPointId;

        var items = '';
        if (list.length === 0) {
            items = '<div class="np-hint">На этой карте ещё нет точек. Кликни по карте в режиме добавления точки (кнопка ниже).</div>';
        } else {
            for (var i = 0; i < list.length; i++) {
                var pt = list[i];
                var cls = 'np-list-item' + (pt.id === sel ? ' selected' : '');
                var badge = '<span class="badge np-badge-' + pt.type + '">' + pt.type + '</span>';
                var label = pt.label ? esc(pt.label) : ('(' + pt.type + ')');
                items += '<div class="' + cls + '" onclick="NpcPathsManager.selectPoint(\'' + pt.id + '\')">' +
                    badge +
                    '<span style="flex:1"><b>' + label + '</b> <span class="np-hint">[' + pt.x + ', ' + pt.y + ']' + (pt.mapExitId ? ' → map ' + pt.mapExitId : '') + '</span></span>' +
                    '</div>';
            }
        }

        var detail = '';
        if (sel) {
            var p = this.mapData().points[sel];
            if (p) {
                var typeOpts = POINT_TYPES.map(function (t) {
                    return '<option value="' + t + '"' + (t === p.type ? ' selected' : '') + '>' + t + '</option>';
                }).join('');
                detail = '' +
                '<div class="np-section">' +
                    '<div class="np-h2">Свойства точки</div>' +
                    '<div class="np-row"><label>Имя:</label><input type="text" id="ptLabel" value="' + esc(p.label) + '" onchange="NpcPathsManager.commitPointField(\'label\', this.value)"></div>' +
                    '<div class="np-row"><label>Тип:</label><select id="ptType" onchange="NpcPathsManager.commitPointField(\'type\', this.value)">' + typeOpts + '</select></div>' +
                    '<div class="np-row"><label>X:</label><input type="number" step="0.5" value="' + p.x + '" onchange="NpcPathsManager.commitPointField(\'x\', Number(this.value))"></div>' +
                    '<div class="np-row"><label>Y:</label><input type="number" step="0.5" value="' + p.y + '" onchange="NpcPathsManager.commitPointField(\'y\', Number(this.value))"></div>' +
                    (p.type === 'exit'
                        ? '<div class="np-row"><label>Выход → карта #:</label><input type="number" value="' + (p.mapExitId || '') + '" onchange="NpcPathsManager.commitPointField(\'mapExitId\', Number(this.value))"></div>'
                        : '') +
                    '<div class="np-row" style="margin-top:8px">' +
                        '<button class="np-btn" onclick="NpcPathsManager.startPick(\'addPointAtCursor\')">📍 Клик по карте</button>' +
                        '<button class="np-btn warn" onclick="NpcPathsManager.deletePoint(\'' + sel + '\'); NpcPathsManager.setTab(\'points\')">Удалить</button>' +
                    '</div>' +
                '</div>';
            }
        }

        return '' +
        '<div class="np-wrap">' +
            '<div class="np-grid">' +
                '<div class="np-col">' +
                    '<div class="np-h2">Точки карты #' + this.currentMapId() + '</div>' +
                    '<div class="np-list">' + items + '</div>' +
                    '<div class="np-row" style="margin-top:8px">' +
                        '<button class="np-btn" onclick="NpcPathsManager.startPick(\'addPointAtCursor\', \'poi\')">+ POI (клик по карте)</button>' +
                        '<button class="np-btn" onclick="NpcPathsManager.startPick(\'addPointAtCursor\', \'exit\')">+ Выход</button>' +
                        '<button class="np-btn" onclick="NpcPathsManager.startPick(\'addPointAtCursor\', \'waypoint\')">+ Waypoint</button>' +
                    '</div>' +
                    '<div class="np-hint">Точка = место на карте. POI — точка интереса. Exit — выход с локации (можно указать целевую карту). Waypoint — промежуточная точка для построения пути.</div>' +
                '</div>' +
                '<div class="np-col">' + detail +
                    (sel ? '' : '<div class="np-hint">Выбери точку слева, чтобы изменить её свойства, или добавь новую кликом по карте.</div>') +
                '</div>' +
            '</div>' +
        '</div>';
    };

    NpcPathsManager.selectPoint = function (id) {
        UI.selPointId = id;
        this.setTab('points');
    };

    NpcPathsManager.commitPointField = function (field, value) {
        if (!UI.selPointId) return;
        this.updatePoint(UI.selPointId, (function(){ var o={}; o[field]=value; return o; })());
        if (field === 'type' || field === 'mapExitId') this.setTab('points');
        refreshOverlay();
    };

    // ===========================================================================
    // ВКЛАДКА: ПУТИ
    // ===========================================================================
    NpcPathsManager.getPathsHtml = function () {
        var paths = this.pathList();
        var pts = this.pointList();
        var sel = UI.selPathId;

        var items = '';
        if (paths.length === 0) {
            items = '<div class="np-hint">Пока нет путей. Создай путь кнопкой ниже.</div>';
        } else {
            for (var i = 0; i < paths.length; i++) {
                var path = paths[i];
                var cls = 'np-list-item' + (path.id === sel ? ' selected' : '');
                var fn = path.from ? (this.mapData().points[path.from] ? this.mapData().points[path.from].label || path.from : '?'+path.from) : '—';
                var tn = path.to   ? (this.mapData().points[path.to]   ? this.mapData().points[path.to].label   || path.to   : '?'+path.to)   : '—';
                items += '<div class="' + cls + '" onclick="NpcPathsManager.selectPath(\'' + path.id + '\')">' +
                    '<span style="flex:1"><b>' + esc(fn) + ' → ' + esc(tn) + '</b> <span class="np-hint">(' + path.points.length + ' точ.)</span></span>' +
                    '</div>';
            }
        }

        var detail = '';
        if (sel) {
            var p = this.mapData().paths[sel];
            if (p) {
                var optNone = '<option value="">— нет —</option>';
                var optFrom = optNone + pts.map(function (pt) {
                    return '<option value="' + pt.id + '"' + (pt.id === p.from ? ' selected' : '') + '>' + esc(pt.label || pt.id) + ' [' + pt.x + ',' + pt.y + ']</option>';
                }).join('');
                var optTo = optNone + pts.map(function (pt) {
                    return '<option value="' + pt.id + '"' + (pt.id === p.to ? ' selected' : '') + '>' + esc(pt.label || pt.id) + ' [' + pt.x + ',' + pt.y + ']</option>';
                }).join('');
                var seqHtml = p.points.map(function (xy, idx) {
                    return '<span class="np-tag">[' + xy[0] + ',' + xy[1] + ']</span>';
                }).join(' ');
                detail = '' +
                '<div class="np-section">' +
                    '<div class="np-h2">Свойства пути</div>' +
                    '<div class="np-row"><label>От точки:</label><select onchange="NpcPathsManager.commitPathEndpoint(\'from\', this.value)">' + optFrom + '</select></div>' +
                    '<div class="np-row"><label>До точки:</label><select onchange="NpcPathsManager.commitPathEndpoint(\'to\', this.value)">' + optTo + '</select></div>' +
                    '<div class="np-divider"></div>' +
                    '<div class="np-h2">Промежуточные точки</div>' +
                    '<div style="margin:4px 0">' + (seqHtml || '<span class="np-hint">нет</span>') + '</div>' +
                    '<div class="np-row">' +
                        '<button class="np-btn' + (UI.pickMode === 'addPathPoint' ? ' active' : '') + '" onclick="NpcPathsManager.toggleAddPathPoint()">📍 Клик по карте — добавить</button>' +
                        '<button class="np-btn" onclick="NpcPathsManager.removeLastPathPoint(\'' + sel + '\'); NpcPathsManager.setTab(\'paths\')">⌫ Убрать последнюю</button>' +
                    '</div>' +
                    '<div class="np-row" style="margin-top:8px">' +
                        '<button class="np-btn warn" onclick="NpcPathsManager.deletePath(\'' + sel + '\'); NpcPathsManager.setTab(\'paths\')">Удалить путь</button>' +
                    '</div>' +
                '</div>';
            }
        }

        return '' +
        '<div class="np-wrap">' +
            '<div class="np-grid">' +
                '<div class="np-col">' +
                    '<div class="np-h2">Пути карты #' + this.currentMapId() + '</div>' +
                    '<div class="np-list">' + items + '</div>' +
                    '<div class="np-row" style="margin-top:8px">' +
                        '<button class="np-btn" onclick="NpcPathsManager.createPathPrompt()">+ Новый путь</button>' +
                    '</div>' +
                '</div>' +
                '<div class="np-col">' + detail +
                    (sel ? '' : '<div class="np-hint">Выбери путь слева или создай новый.</div>') +
                '</div>' +
            '</div>' +
        '</div>';
    };

    NpcPathsManager.selectPath = function (id) {
        UI.selPathId = id;
        UI.pickMode = null;
        this.setTab('paths');
    };

    NpcPathsManager.commitPathEndpoint = function (field, value) {
        if (!UI.selPathId) return;
        var m = this.mapData();
        if (!m || !m.paths[UI.selPathId]) return;
        m.paths[UI.selPathId][field] = (value === '') ? null : value;
        // Перестроим points по from/to если промежуточных нет
        if (m.paths[UI.selPathId].points.length <= 2) {
            var p = m.paths[UI.selPathId];
            p.points = [];
            if (p.from && m.points[p.from]) p.points.push([m.points[p.from].x, m.points[p.from].y]);
            if (p.to   && m.points[p.to])   p.points.push([m.points[p.to].x,   m.points[p.to].y]);
        }
        this.markDirty();
        this.setTab('paths');
    };

    NpcPathsManager.toggleAddPathPoint = function () {
        if (!UI.selPathId) return;
        UI.pickMode = (UI.pickMode === 'addPathPoint') ? null : 'addPathPoint';
        this.setTab('paths');
    };

    NpcPathsManager.createPathPrompt = function () {
        var pts = this.pointList();
        if (pts.length < 1) {
            // создадим пустой путь без точек, пользователь дополнит кликами
            var id = this.createPath(null, null);
            UI.selPathId = id;
            this.setTab('paths');
            return;
        }
        var id = this.createPath(pts[0].id, pts.length > 1 ? pts[1].id : pts[0].id);
        UI.selPathId = id;
        this.setTab('paths');
    };

    // ===========================================================================
    // ВКЛАДКА: НПС
    // ===========================================================================
    NpcPathsManager.getNpcHtml = function () {
        var npcs = this.npcList();
        var sel = UI.selNpcId;

        var items = '';
        if (npcs.length === 0) {
            items = '<div class="np-hint">На этой карте нет зарегистрированных НПС/врагов (см. SuperDuperEnemies → EnemyDatabase → match).</div>';
        } else {
            for (var i = 0; i < npcs.length; i++) {
                var n = npcs[i];
                var cfg = this.npcConfig(n.eventId);
                var cls = 'np-list-item' + (n.eventId === sel ? ' selected' : '');
                items += '<div class="' + cls + '" onclick="NpcPathsManager.selectNpc(' + n.eventId + ')">' +
                    '<span style="flex:1"><b>EV' + n.eventId + '</b> ' + esc(n.name) + ' <span class="np-hint">type=' + n.enemyId + ', routes=' + (cfg ? cfg.routes.length : 0) + '</span></span>' +
                    '</div>';
            }
        }

        var detail = '';
        if (sel) {
            var cfg = this.npcConfig(sel, true);
            var routesHtml = '';
            for (var r = 0; r < cfg.routes.length; r++) {
                var route = cfg.routes[r];
                var condHtml = '';
                for (var c = 0; c < route.conditions.length; c++) {
                    var cond = route.conditions[c];
                    condHtml += '<span class="np-tag ' + (cond.negated ? 'neg' : 'pos') + '">' +
                        (cond.negated ? '!' : '') + esc(cond.flag) +
                        '<span class="np-tag-del" onclick="NpcPathsManager.deleteCondition(' + sel + ',' + r + ',' + c + '); NpcPathsManager.setTab(\'npc\')">✕</span>' +
                        '</span>';
                }
                if (!condHtml) condHtml = '<span class="np-hint">всегда (без условий)</span>';
                var cls = 'np-list-item' + (r === UI.selRouteIdx ? ' selected' : '');
                routesHtml += '<div class="' + cls + '" style="flex-direction:column; align-items:stretch" onclick="NpcPathsManager.selectRoute(' + r + ')">' +
                    '<div><b>Маршрут #' + (r+1) + ' — ' + route.kind + '</b>' +
                        ' <button class="np-btn warn" style="float:right; padding:2px 6px" onclick="event.stopPropagation(); NpcPathsManager.deleteRoute(' + sel + ',' + r + '); NpcPathsManager.setTab(\'npc\')">✕</button>' +
                    '</div>' +
                    '<div style="margin-top:4px">' + condHtml + '</div>' +
                '</div>';
            }
            if (!routesHtml) routesHtml = '<div class="np-hint">У НПС пока нет маршрутов.</div>';

            // Форма редактирования выбранного маршрута
            var formHtml = '';
            if (UI.selRouteIdx >= 0 && UI.selRouteIdx < cfg.routes.length) {
                var rt = cfg.routes[UI.selRouteIdx];
                var kindOpts = ['patrol','goto','flee','wander','stop'].map(function (k) {
                    return '<option value="' + k + '"' + (k === rt.kind ? ' selected' : '') + '>' + k + '</option>';
                }).join('');
                var targetHtml = '';
                if (rt.kind === 'patrol' || rt.kind === 'goto') {
                    var pts2 = this.pointList();
                    var paths2 = this.pathList();
                    if (rt.kind === 'patrol') {
                        var opts = '<option value="">— выбери путь —</option>' + paths2.map(function (p) {
                            return '<option value="' + p.id + '"' + (p.id === rt.target ? ' selected' : '') + '>path ' + p.id + ' (' + p.points.length + ' точ.)</option>';
                        }).join('');
                        targetHtml = '<div class="np-row"><label>Путь:</label><select onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {target:this.value})">' + opts + '</select></div>';
                    } else {
                        var optsp = '<option value="">— выбери точку —</option>' + pts2.map(function (p) {
                            return '<option value="' + p.id + '"' + (p.id === rt.target ? ' selected' : '') + '>' + esc(p.label || p.id) + ' [' + p.x + ',' + p.y + ']</option>';
                        }).join('');
                        targetHtml = '<div class="np-row"><label>Цель:</label><select onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {target:this.value})">' + optsp + '</select></div>';
                    }
                }
                var extraHtml = '';
                if (rt.kind === 'flee') {
                    extraHtml = '<div class="np-row"><label>Безопасная дистанция:</label><input type="number" step="1" value="' + (rt.safeDistance||10) + '" onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {safeDistance:Number(this.value)})"></div>';
                } else if (rt.kind === 'wander') {
                    extraHtml = '<div class="np-row"><label>Радиус:</label><input type="number" step="0.5" value="' + (rt.radius||5) + '" onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {radius:Number(this.value)})"></div>' +
                                '<div class="np-row"><label>Пауза (кадры):</label><input type="number" step="1" value="' + (rt.waitFrames||60) + '" onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {waitFrames:Number(this.value)})"></div>';
                }
                var modeOpts = '<option value="all"' + (rt.mode!=='any'?' selected':'') + '>И (all)</option>' +
                               '<option value="any"' + (rt.mode==='any'?' selected':'') + '>Или (any)</option>';
                formHtml = '' +
                '<div class="np-divider"></div>' +
                '<div class="np-h2">Параметры маршрута #' + (UI.selRouteIdx+1) + '</div>' +
                '<div class="np-row"><label>Тип:</label><select onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {kind:this.value}); NpcPathsManager.setTab(\'npc\')">' + kindOpts + '</select></div>' +
                targetHtml +
                extraHtml +
                '<div class="np-row"><label>Режим условий:</label><select onchange="NpcPathsManager.updateRoute(' + sel + ',' + UI.selRouteIdx + ', {mode:this.value})">' + modeOpts + '</select></div>' +
                '<div class="np-hint">patrol — круговой обход точек пути; goto — идти к точке; flee — убегать от игрока; wander — блуждать вокруг; stop — стоять.</div>';
            }

            detail = '' +
            '<div class="np-section">' +
                '<div class="np-h2">EV' + sel + ' — ' + esc(this._npcName(sel)) + '</div>' +
                '<div class="np-h2">Маршруты</div>' +
                '<div class="np-list">' + routesHtml + '</div>' +
                '<div class="np-row" style="margin-top:8px">' +
                    '<button class="np-btn" onclick="NpcPathsManager.addRoute(' + sel + '); NpcPathsManager.setTab(\'npc\')">+ Добавить маршрут</button>' +
                '</div>' +
                formHtml +
            '</div>';
        }

        return '' +
        '<div class="np-wrap">' +
            '<div class="np-grid">' +
                '<div class="np-col">' +
                    '<div class="np-h2">НПС карты #' + this.currentMapId() + '</div>' +
                    '<div class="np-list">' + items + '</div>' +
                    '<div class="np-hint">Список берётся из SuperDuperEnemies (события, чей Note содержит match-строку из EnemyDatabase).</div>' +
                '</div>' +
                '<div class="np-col">' + detail +
                    (sel ? '' : '<div class="np-hint">Выбери НПС слева, чтобы задать ему маршруты и условия.</div>') +
                '</div>' +
            '</div>' +
        '</div>';
    };

    NpcPathsManager._npcName = function (eventId) {
        var ev = $dataMap && $dataMap.events ? $dataMap.events[eventId] : null;
        return ev ? (ev.name || ('EV' + eventId)) : ('EV' + eventId);
    };

    NpcPathsManager.selectNpc = function (eventId) {
        UI.selNpcId = eventId;
        UI.selRouteIdx = -1;
        this.setTab('npc');
    };

    NpcPathsManager.selectRoute = function (idx) {
        UI.selRouteIdx = idx;
        this.setTab('npc');
    };

    // ===========================================================================
    // ВКЛАДКА: УСЛОВИЯ (добавление условий к выбранному маршруту НПС)
    // ===========================================================================
    NpcPathsManager.getConditionsHtml = function () {
        var npcId = UI.selNpcId;
        var routeIdx = UI.selRouteIdx;
        var flags = this.allFlagNames();

        var header = '';
        if (npcId === null || routeIdx < 0) {
            header = '<div class="np-hint">Сначала выбери НПС и его маршрут на вкладке "НПС". Здесь ты добавляешь условия "когда этот маршрут активен".</div>';
        } else {
            header = '<div class="np-h2">Условия для: EV' + npcId + ' → маршрут #' + (routeIdx+1) + '</div>';
        }

        var flagGrid = '';
        if (npcId !== null && routeIdx >= 0) {
            var cfg = this.npcConfig(npcId);
            var cur = cfg && cfg.routes[routeIdx] ? cfg.routes[routeIdx] : null;
            var present = {};
            if (cur) cur.conditions.forEach(function (c) { present[c.flag + (c.negated ? '!' : '')] = true; });
            // Текущее состояние флагов на карте (если SDE_API доступен)
            var live = (window.SDE_API && $gameMap) ? window.SDE_API.getFlags($gameMap.mapId(), npcId) : null;

            flagGrid = '<div class="np-h2">Палитра флагов (клик — добавить)</div>';
            flagGrid += '<div>';
            for (var i = 0; i < flags.length; i++) {
                var f = flags[i];
                var active = live ? !!live[f] : false;
                var dot = active ? '●' : '○';
                var style = active ? 'style="border-color:#2ecc71;color:#2ecc71"' : '';
                flagGrid += '<span class="np-tag" title="' + (active ? 'активен сейчас' : 'неактивен') + '">' +
                    '<a class="np-tag-del" style="margin-right:4px" onclick="NpcPathsManager.addCondition(' + npcId + ',' + routeIdx + ',\'' + f + '\',false); NpcPathsManager.setTab(\'conditions\')">+' + dot + ' ' + esc(f) + '</a>' +
                    '<a class="np-tag-del" style="opacity:0.7" onclick="NpcPathsManager.addCondition(' + npcId + ',' + routeIdx + ',\'' + f + '\',true); NpcPathsManager.setTab(\'conditions\')">!' + esc(f) + '</a>' +
                    '</span>';
            }
            flagGrid += '</div>';

            if (cur) {
                var list = '';
                for (var c = 0; c < cur.conditions.length; c++) {
                    var cond = cur.conditions[c];
                    list += '<span class="np-tag ' + (cond.negated ? 'neg' : 'pos') + '">' +
                        (cond.negated ? 'НЕ ' : '') + esc(cond.flag) +
                        '<span class="np-tag-del" onclick="NpcPathsManager.deleteCondition(' + npcId + ',' + routeIdx + ',' + c + '); NpcPathsManager.setTab(\'conditions\')">✕</span>' +
                        '</span>';
                }
                flagGrid += '<div class="np-divider"></div>' +
                    '<div class="np-h2">Текущие условия (mode=' + cur.mode + ')</div>' +
                    '<div>' + (list || '<span class="np-hint">нет — маршрут активен всегда</span>') + '</div>';
            }
        }

        return '' +
        '<div class="np-wrap">' +
            '<div class="np-section">' +
                header +
                flagGrid +
                '<div class="np-divider"></div>' +
                '<div class="np-h2">Шпаргалка по флагам</div>' +
                '<div class="np-hint">' +
                    '<b>combat</b> — в боевом режиме (тревога) • ' +
                    '<b>calm</b> — спокоен • ' +
                    '<b>warning</b> — насторожен • ' +
                    '<b>panic</b> — паника • ' +
                    '<b>alert</b> — в настороженности • ' +
                    '<b>flee</b> — бежит • ' +
                    '<b>scope</b> — игрок целится (switch 18) • ' +
                    '<b>gun</b> — дальнобойное оружие в руках • ' +
                    '<b>melee</b> — оружие ближнего боя • ' +
                    '<b>zona</b> — игрок в радиусе атаки • ' +
                    '<b>hearing</b> — слышит игрока • ' +
                    '<b>contact</b> — прямой зрительный контакт • ' +
                    '<b>dead</b> — мёртв' +
                '</div>' +
            '</div>' +
        '</div>';
    };

    // ===========================================================================
    // PICK MODE — клики по карте в редакторе
    // ===========================================================================
    NpcPathsManager.startPick = function (mode, subType) {
        UI.pickMode = mode;
        UI.pickSubType = subType || null;
        this._setStatus('Кликни по карте (LMB). Esc — отмена.', '#f4a31f');
    };

    NpcPathsManager.cancelPick = function () {
        UI.pickMode = null;
        UI.pickSubType = null;
        this._setStatus('', '#cccccc');
        this.setTab(UI.tab);
    };

    // Вызывается из Scene_Map.update при клике мыши по карте (только в playtest и editorActive)
    NpcPathsManager.handleMapClick = function (mapX, mapY) {
        if (!UI.editorActive) return false;
        var mode = UI.pickMode;
        if (!mode) return false;

        if (mode === 'addPointAtCursor') {
            var type = UI.pickSubType || 'waypoint';
            var id = this.addPointAt(mapX, mapY, type);
            UI.selPointId = id;
            UI.pickMode = null;
            this._setStatus('Добавлена точка ' + id, '#2ecc71');
            this.setTab('points');
            return true;
        }
        if (mode === 'addPathPoint') {
            if (!UI.selPathId) return false;
            this.appendPathPoint(UI.selPathId, mapX, mapY);
            this._setStatus('Точка добавлена в путь ' + UI.selPathId, '#2ecc71');
            this.setTab('paths');
            return true;
        }
        if (mode === 'pickNpc') {
            // выбираем событие под курсором
            var x = Math.round(mapX), y = Math.round(mapY);
            var evId = this._eventAt(x, y);
            if (evId > 0) {
                UI.selNpcId = evId;
                this._setStatus('Выбран EV' + evId, '#2ecc71');
                this.setTab('npc');
            }
            UI.pickMode = null;
            return true;
        }
        return false;
    };

    NpcPathsManager._eventAt = function (x, y) {
        if (!$gameMap || !$gameMap.events) return 0;
        var events = $gameMap.events();
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (!e) continue;
            if (Math.round(e.x) === x && Math.round(e.y) === y) return e.eventId();
        }
        return 0;
    };

    // ===========================================================================
    // OVERLAY SPRITE — рисует точки/пути поверх карты
    // ===========================================================================
    function Sprite_NpcPathsOverlay() { this.initialize.apply(this, arguments); }
    Sprite_NpcPathsOverlay.prototype = Object.create(Sprite.prototype);
    Sprite_NpcPathsOverlay.prototype.constructor = Sprite_NpcPathsOverlay;

    Sprite_NpcPathsOverlay.prototype.initialize = function () {
        Sprite.prototype.initialize.call(this);
        this._dirty = true;
        this._canvas = null;
        this._ctx = null;
        this._mapW = 0;  // в тайлах
        this._mapH = 0;
        this.rebuild();
    };

    Sprite_NpcPathsOverlay.prototype.rebuild = function () {
        if (!$dataMap) return;
        var tw = ($gameMap && $gameMap.tileWidth) ? $gameMap.tileWidth() : 48;
        var th = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;
        var w = ($dataMap.width || 16) * tw;
        var h = ($dataMap.height || 16) * th;
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
        }
        this._canvas.width = w;
        this._canvas.height = h;
        this._ctx = this._canvas.getContext('2d');
        this._mapW = $dataMap.width || 16;
        this._mapH = $dataMap.height || 16;
        // Создаём/обновляем текстуру спрайта из этого canvas
        if (!this.texture || !this.texture.baseTexture ||
            this.texture.baseTexture.source !== this._canvas) {
            if (this.texture) this.texture.destroy(true);
            this.texture = PIXI.Texture.from(this._canvas);
        } else {
            this.texture.update();
        }
        this.anchor.set(0, 0);
    };

    Sprite_NpcPathsOverlay.prototype.update = function () {
        Sprite.prototype.update.call(this);
        if (!UI.editorActive) {
            this.visible = false;
            return;
        }
        this.visible = true;
        // Смещаем overlay в соответствии со скроллом карты (texture — в координатах тайла)
        var tw = ($gameMap && $gameMap.tileWidth) ? $gameMap.tileWidth() : 48;
        var th = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;
        if ($gameMap) {
            this.x = -Math.round($gameMap.displayX() * tw);
            this.y = -Math.round($gameMap.displayY() * th);
        }
        if (this._dirty) {
            this._draw();
            this._dirty = false;
        }
    };

    Sprite_NpcPathsOverlay.prototype._draw = function () {
        if (!this._ctx) return;
        var ctx = this._ctx;
        var tw = ($gameMap && $gameMap.tileWidth) ? $gameMap.tileWidth() : 48;
        var th = ($gameMap && $gameMap.tileHeight) ? $gameMap.tileHeight() : 48;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        var m = NpcPathsManager.mapData();
        if (!m) {
            if (this.texture) this.texture.update();
            return;
        }

        // 1) Пути (полилинии)
        for (var pid in m.paths) {
            if (!m.paths.hasOwnProperty(pid)) continue;
            var path = m.paths[pid];
            if (!path.points || path.points.length < 1) continue;
            var selected = (pid === UI.selPathId);
            ctx.lineWidth = selected ? 4 : 2;
            ctx.strokeStyle = selected ? '#1fa84a' : 'rgba(31,138,244,0.8)';
            ctx.beginPath();
            ctx.moveTo(path.points[0][0] * tw, path.points[0][1] * th);
            for (var i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i][0] * tw, path.points[i][1] * th);
            }
            ctx.stroke();
            // промежуточные точки (если > 2)
            for (var j = 1; j < path.points.length - 1; j++) {
                ctx.fillStyle = '#1f8af4';
                ctx.beginPath();
                ctx.arc(path.points[j][0] * tw, path.points[j][1] * th, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 2) Точки
        for (var id in m.points) {
            if (!m.points.hasOwnProperty(id)) continue;
            var p = m.points[id];
            var px = p.x * tw, py = p.y * th;
            var sel = (id === UI.selPointId);
            var color = '#888888', label = id;
            if (p.type === 'poi')       { color = '#1f8af4'; }
            else if (p.type === 'exit') { color = '#e74c3c'; }
            if (sel) color = '#1fa84a';

            // внешний круг
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px, py, sel ? 10 : 7, 0, Math.PI * 2);
            ctx.fill();
            // белый центр
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();

            // подпись
            if (p.label) label = p.label;
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(px + 10, py - 18, ctx.measureText(label).width + 8, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, px + 14, py - 6);
        }

        // 3) Подсветка выбранного НПС
        if (UI.selNpcId !== null && $gameMap && $gameMap.events) {
            var ev = $gameMap.event(UI.selNpcId);
            if (ev) {
                var ex = ev.x * tw, ey = ev.y * th;
                ctx.strokeStyle = '#1fa84a';
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.arc(ex, ey, 22, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                // линии от НПС ко всем его точкам целей в маршрутах
                var cfg = NpcPathsManager.npcConfig(UI.selNpcId);
                if (cfg) {
                    ctx.strokeStyle = 'rgba(31,168,74,0.4)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    for (var r = 0; r < cfg.routes.length; r++) {
                        var rt = cfg.routes[r];
                        if (!rt.target) continue;
                        // если target — точка
                        if (m.points[rt.target]) {
                            ctx.beginPath();
                            ctx.moveTo(ex, ey);
                            ctx.lineTo(m.points[rt.target].x * tw, m.points[rt.target].y * th);
                            ctx.stroke();
                        }
                        // если target — путь, рисуем к первой точке пути
                        if (m.paths[rt.target] && m.paths[rt.target].points.length > 0) {
                            ctx.beginPath();
                            ctx.moveTo(ex, ey);
                            ctx.lineTo(m.paths[rt.target].points[0][0] * tw, m.paths[rt.target].points[0][1] * th);
                            ctx.stroke();
                        }
                    }
                    ctx.setLineDash([]);
                }
            }
        }

        // 4) Подсказка режима
        if (UI.pickMode) {
            ctx.fillStyle = 'rgba(244,163,31,0.9)';
            ctx.fillRect(8, 8, 280, 22);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('Кликай по карте (Esc — отмена): ' + UI.pickMode, 14, 24);
        }

        // Копируем canvas в текстуру спрайта
        if (this.texture) this.texture.update();
    };

    // ===========================================================================
    // ИНТЕГРАЦИЯ В SPRITESET_MAP
    // ===========================================================================
    var _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function () {
        _Spriteset_Map_createCharacters.apply(this, arguments);
        try {
            // Overlay добавляем в сам Spriteset (а не в Tilemap), чтобы он
            // отрисовывался поверх тайлов и событий, и чтобы мы сами управляли
            // его смещением через displayX/Y.
            this._npcPathsOverlay = new Sprite_NpcPathsOverlay();
            this.addChild(this._npcPathsOverlay);
        } catch (e) {
            console.warn('[SuperDuperNpcPaths] overlay init error:', e);
        }
    };

    // ===========================================================================
    // КЛИК-ОБРАБОТКА ПО КАРТЕ — alias Scene_Map.update
    // ===========================================================================
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        try {
            // обработка кликов редактора (только когда активно F12-меню)
            if (UI.editorActive && TouchInput.isTriggered() && UI.pickMode) {
                var mx = $gameMap.canvasToMapX(TouchInput.x);
                var my = $gameMap.canvasToMapY(TouchInput.y);
                NpcPathsManager.handleMapClick(mx, my);
            }
            // Esc — отмена pick mode
            if (UI.editorActive && UI.pickMode && Input.isTriggered && Input.isTriggered('escape')) {
                NpcPathsManager.cancelPick();
            }
            // обновление overlay
            if (this._spriteset && this._spriteset._npcPathsOverlay) {
                this._spriteset._npcPathsOverlay.update();
            }
            // runtime-логика выбора маршрута
            NpcPathsManager.runtimeTick();
        } catch (e) {
            // не роняем игру из-за ошибок плагина
            if (window.console) console.warn('[SuperDuperNpcPaths] update error:', e);
        }
    };

    // ===========================================================================
    // RUNTIME — выбор маршрута и вызов smart* команд
    // ===========================================================================
    NpcPathsManager.runtimeTick = function () {
        // Только если SuperDuperEnemies и smart* API доступны
        if (!window.SDE_API) return;
        if (typeof Game_Character.prototype.smartPatrol !== 'function') return;
        // Глобальный switch
        if (NPC_MOVEMENT_SWITCH > 0 && $gameSwitches && !$gameSwitches.value(NPC_MOVEMENT_SWITCH)) {
            return;
        }
        RUNTIME_TICK++;
        if (RUNTIME_TICK < ROUTE_CHECK_INTERVAL) return;
        RUNTIME_TICK = 0;

        var mapId = $gameMap.mapId();
        var cfg = this.mapData(mapId);
        if (!cfg || !cfg.npc) return;

        // перебираем НПС, зарегистрированных в SuperDuperEnemies
        var ids = window.SDE_API.getRegisteredEventIds();
        for (var i = 0; i < ids.length; i++) {
            var evId = ids[i];
            var key = mapId + '_' + evId;
            var npcCfg = cfg.npc[String(evId)];
            if (!npcCfg || !npcCfg.routes || npcCfg.routes.length === 0) continue;

            // Получаем событие и его флаги
            var ev = $gameMap.event(evId);
            if (!ev) continue;
            var flags = window.SDE_API.getFlags(mapId, evId);
            if (!flags) continue;
            if (flags.dead) continue;

            // Какой маршрут должен быть активным?
            var want = this.pickRoute(npcCfg, flags);
            if (want === (ACTIVE_ROUTE[key] || -1)) continue; // ничего не изменилось
            ACTIVE_ROUTE[key] = want;

            // Применяем
            if (want < 0) {
                // нет подходящего маршрута — остановимся
                ev.smartStop();
                continue;
            }
            var route = npcCfg.routes[want];
            try {
                this._applyRoute(ev, route, cfg);
            } catch (e) {
                console.warn('[SuperDuperNpcPaths] applyRoute EV' + evId + ':', e);
            }
        }
    };

    NpcPathsManager._applyRoute = function (ev, route, cfg) {
        switch (route.kind) {
            case 'patrol':
                var pts = this._resolvePathPoints(route.target, cfg);
                if (pts && pts.length > 0) ev.smartPatrol(pts);
                break;
            case 'goto':
                var xy = this._resolvePointXY(route.target, cfg);
                if (xy) ev.smartMoveTo(xy[0], xy[1]);
                break;
            case 'flee':
                ev.smartFleeFromPlayer(route.safeDistance || 10);
                break;
            case 'wander':
                ev.smartWander(route.radius || 5, route.waitFrames || 60);
                break;
            case 'stop':
                ev.smartStop();
                break;
        }
    };

    NpcPathsManager._resolvePathPoints = function (pathId, cfg) {
        if (!pathId || !cfg || !cfg.paths || !cfg.paths[pathId]) return null;
        var arr = cfg.paths[pathId].points;
        // возвращаем копию массива массивов
        var out = [];
        for (var i = 0; i < arr.length; i++) out.push([arr[i][0], arr[i][1]]);
        return out;
    };

    NpcPathsManager._resolvePointXY = function (pointId, cfg) {
        if (!pointId || !cfg || !cfg.points || !cfg.points[pointId]) return null;
        return [cfg.points[pointId].x, cfg.points[pointId].y];
    };

    // Очистка активного маршрута при смене карты
    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function (mapId) {
        _Game_Map_setup.apply(this, arguments);
        ACTIVE_ROUTE = {};
    };

    // ===========================================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ===========================================================================
    NpcPathsManager.loadPatch();

    // Защита от ошибок: если overlay не создался (например, нет PIXI.CanvasRenderer),
    // плагин всё равно работает с UI + runtime.
    console.log('[SuperDuperNpcPaths] v1.0 loaded. Switch=' + NPC_MOVEMENT_SWITCH + ', interval=' + ROUTE_CHECK_INTERVAL);

})();
