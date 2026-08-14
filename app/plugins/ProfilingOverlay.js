/*:
 * @plugindesc Профайлер производительности: показывает, какое событие/общее событие грузит систему и почему локация лагает.
 * @author Developer
 *
 * @param Toggle Key
 * @text Toggle Key
 * @type select
 * @option F9
 * @value F9
 * @option F10
 * @value F10
 * @option F11
 * @value F11
 * @default F9
 * @desc Клавиша включения/выключения оверлея профайлера.
 *
 * @param Show on Start
 * @text Show on Start
 * @type boolean
 * @default false
 * @desc Показывать оверлей сразу при запуске игры.
 *
 * @param Profiling Mode
 * @text Profiling Mode
 * @type select
 * @option Detailed (полный)
 * @value detailed
 * @option Minimal (FPS + события)
 * @value minimal
 * @option Light (только FPS)
 * @value light
 * @default detailed
 * @desc Объём выводимой информации.
 *
 * @param Lag Threshold (ms)
 * @text Lag Threshold (ms)
 * @type number
 * @decimals 2
 * @default 2
 * @desc События с EMA выше этого порога помечаются [LAGGING].
 *
 * @param Log to Console
 * @text Log to Console
 * @type boolean
 * @default false
 * @desc Раз в секунду дублировать статистику в консоль (F8/F12).
 *
 * @param Top Events
 * @text Top Events
 * @type number
 * @min 3
 * @max 40
 * @default 12
 * @desc Сколько самых тяжёлых событий показывать в списке.
 *
 * @help
 * =========================================================================
 *  ProfilingOverlay — диагностика лагов в RPG Maker MV
 * =========================================================================
 *
 *  Управление:
 *    • Toggle Key (по умолчанию F10 в этом проекте) — вкл/выкл оверлей.
 *
 *  Что показывает (Detailed):
 *    - FPS и время кадра (с разделением логика/рендер)
 *    - Текущая карта, тайлсет, число событий и спрайтов
 *    - Число активных параллельных событий и общих событий
 *    - Время: Game_Map.update, Spriteset.update, Game_Player
 *    - Топ самых тяжёлых событий с именами и текущей командой
 *    - Топ самых тяжёлых параллельных общих событий
 *
 *  Plugin Commands:
 *    ProfilingOverlay toggle
 *    ProfilingOverlay show
 *    ProfilingOverlay hide
 *    ProfilingOverlay mode light|minimal|detailed
 *    ProfilingOverlay resetStats         — сброс накопленной статистики
 *    ProfilingOverlay dumpMap            — дамп всех событий карты в консоль
 *    ProfilingOverlay dumpEvent <id>     — дамп конкретного события
 *    ProfilingOverlay dumpCommon <id>    — дамп общего события
 *
 *  Примечание:
 *    EMA (экспоненциальное скользящее среднее) отражает ТЕКУЩУЮ нагрузку,
 *    а не среднее с момента запуска. При смене карты статистика сбрасывается.
 */

(function () {

    //====================================================================
    //  Параметры
    //====================================================================
    var parameters = PluginManager.parameters('ProfilingOverlay');
    var toggleKeyName = String(parameters['Toggle Key'] || 'F9');
    var showOnStart = String(parameters['Show on Start']) === 'true';
    var profilingMode = String(parameters['Profiling Mode'] || 'detailed');
    var lagThreshold = Number(parameters['Lag Threshold (ms)'] || 2);
    var logToConsole = String(parameters['Log to Console']) === 'true';
    var topEventsCount = Math.max(3, Math.min(40, Number(parameters['Top Events'] || 12)));

    var overlayVisible = showOnStart;
    var currentMode = profilingMode;

    //====================================================================
    //  Утилиты времени (performance.now для суб-мс точности)
    //====================================================================
    var nowFn = (typeof performance !== 'undefined' && performance.now)
        ? function () { return performance.now(); }
        : function () { return Date.now(); };

    //====================================================================
    //  Карта кодов команд → понятные имена
    //====================================================================
    var COMMAND_NAMES = {
        0:   'END',
        101: 'ShowText', 102: 'Choices', 103: 'InputNum', 104: 'SelectItem',
        105: 'ScrollText', 108: 'Comment', 408: 'Comment',
        111: 'If', 411: 'Else', 412: 'EndIf',
        112: 'Loop', 113: 'BreakLoop', 413: 'Repeat',
        115: 'ExitEvent', 117: 'CommonEvent', 118: 'Label', 119: 'JumpLabel',
        121: 'Switches', 122: 'Variables', 123: 'SelfSwitch', 124: 'Timer',
        125: 'Gold', 126: 'Items', 127: 'Weapons', 128: 'Armors', 129: 'Party',
        201: 'Transfer', 202: 'VehiclePos', 203: 'EventPos', 204: 'ScrollMap',
        205: 'MoveRoute', 206: 'BoardVehicle', 211: 'Transparency',
        212: 'Animation', 213: 'Balloon', 214: 'EraseEvent',
        216: 'Followers', 217: 'GatherFollowers',
        218: 'FadeOut', 219: 'FadeIn', 221: 'TintScreen', 222: 'Flash', 223: 'Shake',
        224: 'Wait', 225: 'ShowPic', 230: 'MovePic', 231: 'RotatePic',
        232: 'TintPic', 233: 'ErasePic', 234: 'Weather',
        235: 'PlayBGM', 236: 'FadeBGM', 237: 'SaveBGM', 238: 'ResumeBGM',
        239: 'PlayBGS', 240: 'FadeBGS', 241: 'SaveBGS', 242: 'ResumeBGS',
        249: 'PlayME', 250: 'PlaySE', 251: 'StopSE', 254: 'PlayMovie',
        282: 'Tileset', 283: 'Battleback', 284: 'Parallax', 285: 'LocInfo',
        301: 'Battle', 302: 'Shop', 303: 'NameInput',
        311: 'HP', 312: 'MP', 313: 'State', 314: 'Recover',
        315: 'EXP', 316: 'Level', 317: 'Param', 318: 'Skill', 319: 'Equip',
        320: 'Name', 321: 'Class', 322: 'ActorImg', 323: 'VehicleImg',
        324: 'Nickname', 325: 'Profile', 326: 'TP',
        331: 'EnemyHP', 332: 'EnemyMP', 333: 'EnemyState', 334: 'EnemyRecover',
        335: 'EnemyAppear', 336: 'EnemyTransform', 337: 'BattleAnim',
        339: 'ForceAction', 340: 'AbortBattle',
        351: 'OpenMenu', 352: 'OpenSave', 353: 'GameOver', 354: 'ToTitle',
        355: 'Script', 356: 'PluginCmd', 655: 'ScriptLine'
    };

    function commandLabel(code) {
        if (code === undefined || code === null) return '—';
        return COMMAND_NAMES[code] || ('code' + code);
    }

    //====================================================================
    //  Состояние профайлера
    //====================================================================
    var _frameTimeMs = 0;          // последний кадр (мс)
    var _fpsSamples = [];          // окно последних кадров
    var _fps = 0;
    var _lastTick = nowFn();

    var _logicMs = 0;              // Game_Map.update
    var _spritesetMs = 0;          // Spriteset_Map.update
    var _playerMs = 0;             // Game_Player.update
    var _eventsMs = 0;             // Game_Map.updateEvents (включая common)
    var _interpreterMs = 0;        // Game_Map.updateInterpreter (main)

    var _eventProfiles = {};       // id -> профиль события
    var _commonProfiles = {};      // id -> профиль общего события
    var _lastMapId = -2;           // для авто-сброса при смене карты

    var _frameCount = 0;
    var _consoleLogTimer = 0;

    // EMA-коэффициент: alpha = 1/N → «окно» ~ N кадров
    var EMA_ALPHA = 1 / 60;

    function resetStats() {
        _eventProfiles = {};
        _commonProfiles = {};
        _fpsSamples = [];
        _fps = 0;
        _frameCount = 0;
    }

    function getEventProfile(id) {
        if (!_eventProfiles[id]) {
            _eventProfiles[id] = {
                emaMs: 0, peakMs: 0, samples: 0,
                lastCmdCode: 0, lastIndex: -1, lastActive: 0
            };
        }
        return _eventProfiles[id];
    }

    function getCommonProfile(id) {
        if (!_commonProfiles[id]) {
            _commonProfiles[id] = {
                emaMs: 0, peakMs: 0, samples: 0,
                lastCmdCode: 0, lastIndex: -1, lastActive: 0
            };
        }
        return _commonProfiles[id];
    }

    function recordSample(profile, dtMs, cmdCode, cmdIndex) {
        //EMA: y = alpha*x + (1-alpha)*y
        profile.emaMs = EMA_ALPHA * dtMs + (1 - EMA_ALPHA) * profile.emaMs;
        if (dtMs > profile.peakMs) profile.peakMs = dtMs;
        profile.samples++;
        if (cmdCode !== undefined) profile.lastCmdCode = cmdCode;
        if (cmdIndex !== undefined) profile.lastIndex = cmdIndex;
        profile.lastActive = _frameCount;
    }

    //====================================================================
    //  Безопасные помощники чтения данных
    //====================================================================
    function mapEventName(id) {
        try {
            if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.events && $dataMap.events[id]) {
                return $dataMap.events[id].name || ('EV' + id);
            }
        } catch (e) {}
        return 'EV' + id;
    }

    function commonEventName(id) {
        try {
            if (typeof $dataCommonEvents !== 'undefined' && $dataCommonEvents && $dataCommonEvents[id]) {
                return $dataCommonEvents[id].name || ('CE' + id);
            }
        } catch (e) {}
        return 'CE' + id;
    }

    function interpreterCmdInfo(interpreter) {
        if (!interpreter || !interpreter.isRunning()) return null;
        try {
            var cmd = interpreter._list && interpreter._list[interpreter._index];
            if (cmd) return { code: cmd.code, index: interpreter._index };
        } catch (e) {}
        return null;
    }

    //====================================================================
    //  HTML-оверлей
    //====================================================================
    var _overlayEl = null;

    function createOverlayElement() {
        if (_overlayEl) return;
        var el = document.createElement('div');
        el.id = 'profiling_overlay';
        el.style.position = 'fixed';
        el.style.top = '4px';
        el.style.left = '4px';
        el.style.width = '430px';
        el.style.background = 'rgba(0,0,0,0.82)';
        el.style.color = '#9eff9e';
        el.style.fontFamily = 'Consolas, "Courier New", monospace';
        el.style.fontSize = '12px';
        el.style.lineHeight = '15px';
        el.style.padding = '8px';
        el.style.zIndex = '999999';
        el.style.pointerEvents = 'none';
        el.style.border = '1px solid #2f7d2f';
        el.style.borderRadius = '4px';
        el.style.boxSizing = 'border-box';
        el.style.whiteSpace = 'pre';
        el.style.maxHeight = '96vh';
        el.style.overflowY = 'auto';
        el.style.display = 'none';
        document.body.appendChild(el);
        _overlayEl = el;
    }

    function showOverlay() { createOverlayElement(); _overlayEl.style.display = 'block'; }
    function hideOverlay() { if (_overlayEl) _overlayEl.style.display = 'none'; }

    function fmt(n, d) { d = (d === undefined) ? 2 : d; return n.toFixed(d); }

    function colorForMs(ms) {
        if (ms > lagThreshold) return '#ff5a5a';
        if (ms > lagThreshold * 0.4) return '#ffcc55';
        return '#9eff9e';
    }

    function updateOverlay() {
        // Лениво создаём элемент при первом вызове, если оверлей включён
        if (!_overlayEl) {
            if (overlayVisible) { showOverlay(); } else { return; }
        }
        if (_overlayEl.style.display === 'none') return;
        if (!$gameMap) { _overlayEl.innerHTML = '<span style="color:#888">— карта не загружена —</span>'; return; }

        var L = [];
        var mapId = $gameMap.mapId();
        var mapName = '';
        try {
            if (typeof $dataMap !== 'undefined' && $dataMap && $dataMap.displayName) mapName = $dataMap.displayName;
        } catch (e) {}

        var fpsCol = _fps < 30 ? '#ff5a5a' : _fps < 50 ? '#ffcc55' : '#9eff9e';

        L.push('<span style="color:#fff">=== PROFILING ===</span>');
        L.push('FPS: <span style="color:' + fpsCol + '">' + _fps + '</span>  (' + fmt(_frameTimeMs, 1) + ' ms)');
        L.push('');

        if (currentMode === 'light') { _overlayEl.innerHTML = L.join('<br>'); return; }

        // --- Карта / контекст ---
        var tilesetId = $gameMap.tilesetId();
        var tilesetName = ($dataTilesets && $dataTilesets[tilesetId]) ? $dataTilesets[tilesetId].name : '?';
        var events = $gameMap.events();
        var commonEvents = $gameMap._commonEvents || [];

        // активные параллельные события (interpreter running)
        var parallelIds = [];
        var parallelCommonIds = [];
        var i, ev;
        for (i = 0; i < events.length; i++) {
            ev = events[i];
            if (ev && ev._interpreter && ev._interpreter.isRunning()) parallelIds.push(ev.eventId());
        }
        for (i = 0; i < commonEvents.length; i++) {
            var ce = commonEvents[i];
            if (ce && ce._interpreter && ce._interpreter.isRunning()) parallelCommonIds.push(ce._commonEventId);
        }

        var spritesetLen = 0;
        try {
            if (SceneManager._scene && SceneManager._scene._spriteset) {
                var ss = SceneManager._scene._spriteset;
                if (ss.children) spritesetLen = ss.children.length;
            }
        } catch (e) {}

        var picCount = 0;
        try { if ($gameScreen) picCount = $gameScreen._pictures ? $gameScreen._pictures.length - 1 : 0; } catch (e) {}

        L.push('Map: <span style="color:#fff">' + mapId + (mapName ? ' "' + mapName + '"' : '') + '</span> (' +
            $gameMap.width() + 'x' + $gameMap.height() + ')  Tileset: ' + tilesetName);
        L.push('Events: ' + events.length + '  Sprites: ' + spritesetLen + '  Pictures: ' + picCount);
        L.push('Parallel events: ' + parallelIds.length + '   Common(parallel): ' + parallelCommonIds.length);

        if (currentMode === 'minimal') {
            _overlayEl.innerHTML = L.join('<br>');
            return;
        }

        // --- Detailed: тайминги по фазам ---
        L.push('');
        L.push('<span style="color:#aaa">[TIME ms]</span> ' +
            'logic:<span style="color:' + colorForMs(_logicMs) + '">' + fmt(_logicMs) + '</span>  ' +
            'events:<span style="color:' + colorForMs(_eventsMs) + '">' + fmt(_eventsMs) + '</span>  ' +
            'interp:<span style="color:' + colorForMs(_interpreterMs) + '">' + fmt(_interpreterMs) + '</span>  ' +
            'player:<span style="color:' + colorForMs(_playerMs) + '">' + fmt(_playerMs) + '</span>  ' +
            'spriteset:<span style="color:' + colorForMs(_spritesetMs) + '">' + fmt(_spritesetMs) + '</span>');

        // --- Топ событий ---
        var sortedEv = [];
        for (var k in _eventProfiles) {
            if (_eventProfiles.hasOwnProperty(k)) {
                var p = _eventProfiles[k];
                if (p.samples > 0 && (_frameCount - p.lastActive) < 300) sortedEv.push({ id: k, p: p });
            }
        }
        sortedEv.sort(function (a, b) { return b.p.emaMs - a.p.emaMs; });

        if (sortedEv.length > 0) {
            L.push('');
            L.push('<span style="color:#aaa">--- Slowest events (EMA) ---</span>');
            for (i = 0; i < sortedEv.length && i < topEventsCount; i++) {
                var se = sortedEv[i];
                if (se.p.emaMs < 0.02 && se.p.peakMs < 0.1) continue;
                var name = mapEventName(Number(se.id)).substr(0, 22);
                var lag = se.p.emaMs > lagThreshold ? ' <span style="color:#ff5a5a">[LAG]</span>' :
                          (se.p.emaMs > lagThreshold * 0.4 ? ' <span style="color:#ffcc55">[!]</span>' : '');
                var par = (parallelIds.indexOf(Number(se.id)) >= 0) ? ' PAR' : '';
                var cmd = se.p.lastIndex >= 0
                    ? ' cmd#' + se.p.lastIndex + ':' + commandLabel(se.p.lastCmdCode)
                    : '';
                L.push('  #' + se.id + ' ' + padName(name) +
                    '<span style="color:' + colorForMs(se.p.emaMs) + '">' + fmt(se.p.emaMs, 3) + 'ms</span>' +
                    ' (peak ' + fmt(se.p.peakMs, 2) + ')' + cmd + par + lag);
            }
        }

        // --- Топ общих событий ---
        var sortedCe = [];
        for (var c in _commonProfiles) {
            if (_commonProfiles.hasOwnProperty(c)) {
                var cp = _commonProfiles[c];
                if (cp.samples > 0 && (_frameCount - cp.lastActive) < 300) sortedCe.push({ id: c, p: cp });
            }
        }
        sortedCe.sort(function (a, b) { return b.p.emaMs - a.p.emaMs; });

        if (sortedCe.length > 0) {
            L.push('');
            L.push('<span style="color:#aaa">--- Slowest common events (parallel) ---</span>');
            for (i = 0; i < sortedCe.length && i < topEventsCount; i++) {
                var sc = sortedCe[i];
                if (sc.p.emaMs < 0.02 && sc.p.peakMs < 0.1) continue;
                var cname = commonEventName(Number(sc.id)).substr(0, 22);
                var cLag = sc.p.emaMs > lagThreshold ? ' <span style="color:#ff5a5a">[LAG]</span>' :
                           (sc.p.emaMs > lagThreshold * 0.4 ? ' <span style="color:#ffcc55">[!]</span>' : '');
                var ccmd = sc.p.lastIndex >= 0
                    ? ' cmd#' + sc.p.lastIndex + ':' + commandLabel(sc.p.lastCmdCode)
                    : '';
                L.push('  CE#' + sc.id + ' ' + padName(cname) +
                    '<span style="color:' + colorForMs(sc.p.emaMs) + '">' + fmt(sc.p.emaMs, 3) + 'ms</span>' +
                    ' (peak ' + fmt(sc.p.peakMs, 2) + ')' + ccmd + cLag);
            }
        }

        L.push('');
        L.push('<span style="color:#666">' + toggleKeyName + '=toggle  mode: ' + currentMode +
            '  (dumpMap/dumpEvent N/dumpCommon N в консоль)</span>');

        _overlayEl.innerHTML = L.join('<br>');
    }

    function padName(s) {
        s = s + '';
        while (s.length < 24) s += ' ';
        return '<span style="color:#cfe">' + escapeHtml(s) + '</span>';
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    //====================================================================
    //  Хук: Game_Map.update — общая логика карты
    //====================================================================
    var _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function (sceneActive) {
        var t0 = nowFn();
        _Game_Map_update.call(this, sceneActive);
        _logicMs = nowFn() - t0;

        // авто-сброс при смене карты
        if (this.mapId() !== _lastMapId) {
            _lastMapId = this.mapId();
            resetStats();
        }
    };

    var _Game_Map_updateEvents = Game_Map.prototype.updateEvents;
    Game_Map.prototype.updateEvents = function () {
        var t0 = nowFn();
        _Game_Map_updateEvents.call(this);
        _eventsMs = nowFn() - t0;
    };

    var _Game_Map_updateInterpreter = Game_Map.prototype.updateInterpreter;
    Game_Map.prototype.updateInterpreter = function () {
        var t0 = nowFn();
        _Game_Map_updateInterpreter.call(this);
        _interpreterMs = nowFn() - t0;
    };

    //====================================================================
    //  Хук: Game_Event.update — профилирование каждого события
    //====================================================================
    var _Game_Event_update = Game_Event.prototype.update;
    Game_Event.prototype.update = function () {
        var t0 = nowFn();
        _Game_Event_update.call(this);
        var dt = nowFn() - t0;
        var id = this.eventId();
        if (id > 0) {
            var prof = getEventProfile(id);
            var info = interpreterCmdInfo(this._interpreter);
            recordSample(prof, dt, info ? info.code : undefined, info ? info.index : undefined);
        }
    };

    //====================================================================
    //  Хук: Game_CommonEvent.update — профилирование общих событий
    //====================================================================
    var _Game_CommonEvent_update = Game_CommonEvent.prototype.update;
    Game_CommonEvent.prototype.update = function () {
        var t0 = nowFn();
        _Game_CommonEvent_update.call(this);
        var dt = nowFn() - t0;
        var id = this._commonEventId;
        if (id > 0) {
            var prof = getCommonProfile(id);
            var info = interpreterCmdInfo(this._interpreter);
            recordSample(prof, dt, info ? info.code : undefined, info ? info.index : undefined);
        }
    };

    //====================================================================
    //  Хук: Game_Player.update — отдельный тайминг игрока
    //====================================================================
    var _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function (sceneActive) {
        var t0 = nowFn();
        _Game_Player_update.call(this, sceneActive);
        _playerMs = nowFn() - t0;
    };

    //====================================================================
    //  Хук: Spriteset_Map.update — тайминг рендера/спрайтов
    //====================================================================
    if (typeof Spriteset_Map !== 'undefined') {
        var _Spriteset_Map_update = Spriteset_Map.prototype.update;
        Spriteset_Map.prototype.update = function () {
            var t0 = nowFn();
            _Spriteset_Map_update.call(this);
            _spritesetMs = nowFn() - t0;
        };
    }

    //====================================================================
    //  Хук: Scene_Map.update — FPS / время кадра + авто-обновление оверлея
    //====================================================================
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        var now = nowFn();
        _frameTimeMs = now - _lastTick;
        _lastTick = now;

        _fpsSamples.push(_frameTimeMs);
        if (_fpsSamples.length > 60) _fpsSamples.shift();
        _frameCount++;

        // FPS раз в ~30 кадров
        if ((_frameCount % 30) === 0) {
            var sum = 0;
            for (var i = 0; i < _fpsSamples.length; i++) sum += _fpsSamples[i];
            _fps = sum > 0 ? Math.round(1000 / (sum / _fpsSamples.length)) : 0;
        }

        // Лог в консоль раз в секунду
        if (logToConsole) {
            _consoleLogTimer++;
            if (_consoleLogTimer >= 60) {
                _consoleLogTimer = 0;
                logToConsoleFn();
            }
        }

        _Scene_Map_update.call(this);

        if (overlayVisible && this === SceneManager._scene) {
            updateOverlay();
        }
    };

    function logToConsoleFn() {
        if (!$gameMap) return;
        console.log('%c[Profiling] FPS:' + _fps + ' (' + fmt(_frameTimeMs, 1) + 'ms) ' +
            'logic:' + fmt(_logicMs) + ' events:' + fmt(_eventsMs) +
            ' spriteset:' + fmt(_spritesetMs) + ' player:' + fmt(_playerMs),
            'color:#9eff9e');
        console.log('[Profiling] Map ' + $gameMap.mapId() + '  Events:' + $gameMap.events().length +
            '  Parallel:' + countParallel());
    }

    function countParallel() {
        var n = 0;
        var evts = $gameMap.events();
        for (var i = 0; i < evts.length; i++) {
            if (evts[i] && evts[i]._interpreter && evts[i]._interpreter.isRunning()) n++;
        }
        return n;
    }

    //====================================================================
    //  Горячая клавиша (toggle)
    //--------------------------------------------------------------------
    //  ВАЖНО: RPG Maker MV из коробки регистрирует в Input.keyMapper
    //  только F9 (debug). F10/F11 там нет, поэтому Input.isTriggered('F10')
    //  НИКОГДА не сработает. Используем прямой DOM-listener на keydown,
    //  который работает независимо от движка, и прописываем клавишу в
    //  keyMapper — для подстраховки.
    //====================================================================

    // Имя клавиши → keyCode
    var TOGGLE_KEYCODES = { 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123 };
    var toggleKeyCode = TOGGLE_KEYCODES[toggleKeyName] || 121; // по умолчанию F10

    // Прописываем клавишу в keyMapper движка (на всякий случай)
    try {
        if (Input.keyMapper && !(toggleKeyCode in Input.keyMapper)) {
            Input.keyMapper[toggleKeyCode] = 'profilingToggle';
        }
    } catch (e) {}

    function toggleOverlay() {
        overlayVisible = !overlayVisible;
        if (overlayVisible) showOverlay(); else hideOverlay();
    }

    // Прямой DOM-listener — самый надёжный способ (не зависит от фокуса canvas)
    window.addEventListener('keydown', function (e) {
        if (e.keyCode === toggleKeyCode) {
            // Проверяем, что не идёт ввод текста (окно имени и т.п.)
            var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea') return;
            e.preventDefault();
            e.stopPropagation();
            toggleOverlay();
        }
    }, true); // capture-phase — перехватываем раньше всех

    //====================================================================
    //  Plugin Commands
    //====================================================================
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command !== 'ProfilingOverlay') return;

        switch (args[0]) {
        case 'toggle':
            overlayVisible = !overlayVisible;
            if (overlayVisible) showOverlay(); else hideOverlay();
            break;
        case 'show':
            overlayVisible = true; showOverlay(); break;
        case 'hide':
        case 'close':
            overlayVisible = false; hideOverlay(); break;
        case 'mode':
            if (['light', 'minimal', 'detailed'].indexOf(args[1]) >= 0) {
                currentMode = args[1];
                console.log('[Profiling] Mode -> ' + currentMode);
            }
            break;
        case 'resetStats':
            resetStats();
            console.log('[Profiling] Stats reset');
            break;
        case 'dumpMap':
            dumpMap();
            break;
        case 'dumpEvent':
            dumpEvent(parseInt(args[1], 10));
            break;
        case 'dumpCommon':
            dumpCommon(parseInt(args[1], 10));
            break;
        }
    };

    function dumpMap() {
        if (!$gameMap) { console.log('[Profiling] нет карты'); return; }
        var out = [];
        var evts = $gameMap.events();
        for (var i = 0; i < evts.length; i++) {
            var ev = evts[i]; if (!ev) continue;
            var info = interpreterCmdInfo(ev._interpreter);
            out.push({
                id: ev.eventId(),
                name: mapEventName(ev.eventId()),
                x: ev._x, y: ev._y,
                page: ev._pageIndex,
                running: !!(ev._interpreter && ev._interpreter.isRunning()),
                cmdIndex: info ? info.index : null,
                cmd: info ? commandLabel(info.code) : null,
                profile: _eventProfiles[ev.eventId()] || null
            });
        }
        console.groupCollapsed('[Profiling] Map ' + $gameMap.mapId() + ' — ' + out.length + ' events');
        console.table(out);
        console.groupEnd();
    }

    function dumpEvent(id) {
        if (!$gameMap) { console.log('[Profiling] нет карты'); return; }
        var ev = $gameMap.event(id);
        if (!ev) { console.log('[Profiling] событие ' + id + ' не найдено'); return; }
        var info = interpreterCmdInfo(ev._interpreter);
        console.log('[Profiling] Event #' + id + ' "' + mapEventName(id) + '":', {
            x: ev._x, y: ev._y, page: ev._pageIndex,
            running: !!(ev._interpreter && ev._interpreter.isRunning()),
            cmdIndex: info ? info.index : null,
            cmd: info ? commandLabel(info.code) : null,
            profile: _eventProfiles[id] || null,
            trigger: ($dataMap && $dataMap.events && $dataMap.events[id]) ? $dataMap.events[id].pages[ev._pageIndex] : null
        });
    }

    function dumpCommon(id) {
        if (!$gameMap) { console.log('[Profiling] нет карты'); return; }
        var ce = $gameMap._commonEvents ? $gameMap._commonEvents[id] : null;
        if (!ce) { console.log('[Profiling] общее событие ' + id + ' не найдено/не параллельное'); return; }
        var info = interpreterCmdInfo(ce._interpreter);
        console.log('[Profiling] CommonEvent #' + id + ' "' + commonEventName(id) + '":', {
            running: !!(ce._interpreter && ce._interpreter.isRunning()),
            cmdIndex: info ? info.index : null,
            cmd: info ? commandLabel(info.code) : null,
            profile: _commonProfiles[id] || null
        });
    }

})();
