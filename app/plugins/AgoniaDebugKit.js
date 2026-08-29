/*:
 * @plugindesc Отладочный кит Agonia: автостарт без меню, принудительная погоня, дамп диагностики, тумблер маршрутов. Активен только при дебаг-запуске (env RPGREACTOR_DEBUG=1 или ?debug в URL).
 * @author Agonia Engine
 * @help
 * ============================================================================
 * AGONIA DEBUG KIT (v1.0.0)
 * ============================================================================
 * Специальный режим для отладки ИИ и движения. Активируется ТОЛЬКО при
 * дебаг-запуске (кнопка 🐞 в редакторе передаёт env RPGREACTOR_DEBUG=1;
 * вручную — добавь ?debug в URL index.html). При обычном запуске игры
 * и редактора полностью бездействует.
 *
 * Что делает при активации:
 *   - Пропускает титул — сразу новая игра на стартовую карту.
 *   - Бейдж «DEBUG» в левом верхнем углу.
 *   - F8  — принудительная погоня: все события с умным ИИ бегут к игроку.
 *   - F9  — дамп диагностики в debug/diagnostics-<map>-<frame>.json:
 *           карта, события, цели, маршруты, препятствия контекста поиска,
 *           перехваченные ошибки консоли.
 *   - F10 — тумблер видимости оверлея маршрутов (SuperDuperMovement_Addon).
 *
 * @param Force Chase Switch
 * @text Свитч запрета погони
 * @type switch
 * @desc Если свитч включён — F8 не трогает это событие (защита сюжетных ИИ).
 * @default 0
 */

(function() {
    'use strict';

    var params = PluginManager.parameters('AgoniaDebugKit');
    var noChaseSwitch = Number(params['Force Chase Switch'] || 0);

    // --- Активация: env (дебаг-запуск из редактора) или ?debug в URL ---
    var active = false;
    try {
        if (typeof process !== 'undefined' && process.env
            && process.env.RPGREACTOR_DEBUG === '1') active = true;
    } catch (e) { /* не NW */ }
    if (!active && typeof window !== 'undefined' && window.location
        && /[?&]debug\b/.test(window.location.search)) active = true;
    if (!active) return; // обычная игра — кит спит

    var capturedLogs = [];
    var _dkError = console.error;
    console.error = function() {
        try { capturedLogs.push('ERR ' + Array.prototype.join.call(arguments, ' ').slice(0, 400)); } catch (e) {}
        _dkError.apply(console, arguments);
    };

    // --- Автостарт: титул -> новая игра ---
    var _dk_Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _dk_Scene_Boot_start.call(this);
        if (!this._dkAutoStarted && DataManager.isDatabaseLoaded.call(DataManager)) {
            this._dkAutoStarted = true;
            setTimeout(function() {
                try {
                    if (SceneManager._scene instanceof Scene_Boot || SceneManager._scene instanceof Scene_Title) {
                        DataManager.setupNewGame();
                        SceneManager.goto(Scene_Map);
                        console.log('[DebugKit] auto new game');
                    }
                } catch (e) { console.error('[DebugKit] autostart failed:', e); }
            }, 300);
        }
    };
    Scene_Boot.prototype._dkPatched = true; // маркер для тестов движка

    // --- Бейдж DEBUG ---
    var _dk_Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function() {
        _dk_Scene_Map_createDisplayObjects.call(this);
        try {
            var bmp = new Bitmap(80, 22);
            bmp.fillRect(0, 0, 80, 22, 'rgba(200,0,0,0.75)');
            bmp.drawText('DEBUG', 0, 0, 80, 22, 'center');
            bmp._baseTexture.update();
            var sp = new Sprite(bmp);
            sp.x = 6; sp.y = 4; sp.z = 10000;
            this._dkBadge = sp;
            this.addChild(sp);
        } catch (e) { /* бейдж не критичен */ }
    };

    // --- Горячие клавиши: слушаем document напрямую (F-клавиши не всегда
    //     забинджены в маппинге MV Input) — см. addEventListener ниже.

    function dumpDiagnostics() {
        try {
            var fs = null, path = null;
            try { fs = require('fs'); path = require('path'); } catch (e) { return; }
            var out = {
                at: new Date().toISOString(),
                frame: Graphics.frameCount,
                mapId: $gameMap ? $gameMap.mapId() : null,
                player: $gamePlayer ? { x: $gamePlayer._x, y: $gamePlayer._y } : null,
                events: [],
                logs: capturedLogs.slice(-60)
            };
            var events = ($gameMap && $gameMap.events) ? $gameMap.events() : [];
            for (var i = 0; i < events.length; i++) {
                var e = events[i];
                if (!e) continue;
                var rec = { id: e._eventId, name: e.event() ? e.event().name : '?', x: e._x, y: e._y };
                if (e._amsSmartTarget) rec.target = e._amsSmartTarget.type;
                if (e._amsSmartPath) rec.path = e._amsSmartPath.map(function(w) { return Math.round(w.x * 10) / 10 + ',' + Math.round(w.y * 10) / 10; });
                if (e._amsStuckTimer) rec.stuck = e._amsStuckTimer;
                out.events.push(rec);
            }
            // препятствия контекста поиска первого умного ИИ
            if (window.__SDA_TEST && events.length) {
                var smart = events.filter(function(ev) { return ev && ev._amsSmartTarget; })[0];
                if (smart) {
                    var ctx = window.__SDA_TEST.buildPathContext(smart, null, []);
                    out.pathContext = {
                        obstacles: ctx.obstacles.length,
                        hard: ctx.obstacles.filter(function(o) { return o.hard; }).length,
                        seekerBox: [ctx.sl, ctx.st, ctx.sr, ctx.sb]
                    };
                }
            }
            // P20: реальные хитбоксы карты (статика/динамика)
            if (window.__SDA_TEST && window.__SDA_TEST.collectHitboxes) {
                try {
                    var hbs = window.__SDA_TEST.collectHitboxes();
                    out.hitboxes = {
                        total: hbs.length,
                        hard: hbs.filter(function(h) { return h.hard; }).length
                    };
                } catch (e) { /* диагностика не должна падать */ }
            }
            var dir = path.join(process.cwd(), 'debug');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            var file = path.join(dir, 'diagnostics-' + (out.mapId || 0) + '-' + out.frame + '.json');
            fs.writeFileSync(file, JSON.stringify(out, null, 1));
            console.log('[DebugKit] diagnostics ->', file);
        } catch (e) { console.error('[DebugKit] dump failed:', e); }
    }

    function forceChase() {
        var count = 0;
        var events = ($gameMap && $gameMap.events) ? $gameMap.events() : [];
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (!e || !e.smartMoveToPlayer) continue;
            if (noChaseSwitch > 0 && $gameSwitches.value(noChaseSwitch)) continue;
            e.smartMoveToPlayer();
            count++;
        }
        console.log('[DebugKit] force chase on', count, 'events');
    }

    function togglePathOverlay() {
        var scene = SceneManager._scene;
        if (scene && scene._sdaPathDebugSprite) {
            var sp = scene._sdaPathDebugSprite;
            sp.visible = !sp.visible;
            console.log('[DebugKit] path overlay', sp.visible ? 'ON' : 'OFF');
        } else {
            console.warn('[DebugKit] no path overlay (Debug Mode off in the Addon?)');
        }
    }

    // Хоткеи через onKeyDown — надёжнее маппинга MV Input (F-клавиши не всегда
    // забинджены): слушаем document напрямую.
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', function(ev) {
            try {
                if (ev.key === 'F8' || ev.keyCode === 119) { ev.preventDefault(); forceChase(); }
                else if (ev.key === 'F9' || ev.keyCode === 120) { ev.preventDefault(); dumpDiagnostics(); }
                else if (ev.key === 'F10' || ev.keyCode === 121) { ev.preventDefault(); togglePathOverlay(); }
            } catch (e) { /* безопасно */ }
        }, true);
    }

    // маркер для тестов движка (на игру не влияет)
    if (typeof window !== 'undefined') window.__DebugKitActive = true;

    console.log('[DebugKit] ACTIVE — F8 chase · F9 dump · F10 overlay');
})();
