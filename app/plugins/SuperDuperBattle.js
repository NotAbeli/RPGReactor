/*:
 * @plugindesc [v1.45] ABS Core: Боевая система. Fix: Script Call Safety.
 * @author SDB Team (Jarvis Protocol)
 *
 * @param --- System Settings ---
 * @default
 *
 * @param Debug Mode
 * @text Режим Отладки
 * @type boolean
 * @desc ВКЛ = Хитбоксы, ESP и консоль видны сразу при старте игры.
 * @default true
 *
 * @param Disable Mouse Move
 * @text Отключить движение мышью
 * @type boolean
 * @desc Блокирует стандартное перемещение по клику RPG Maker MV.
 * @default true
 *
 * @param --- Database ---
 * @default
 *
 * @param Melee List
 * @text Список Ближнего Боя
 * @type struct<MeleeAttack>[]
 * @desc Атаки ближнего боя (Sector/Box).
 * @default []
 *
 * @param Projectile List
 * @text Список Снарядов
 * @type struct<ProjectileAttack>[]
 * @desc Снаряды (Физика Galv).
 * @default []
 *
 * @param Tracer List
 * @text Список Трассеров
 * @type struct<TracerAttack>[]
 * @desc Хитскан атаки (Лучи).
 * @default []
 *
 * @help
 * ============================================================================
 * SUPER DUPER BATTLE (SDB) - ABS SYSTEM v1.45
 * ============================================================================
 *
 * Обновление v1.45:
 * - FIX: Усилена защита вызова команд через Script.
 * - SAFETY: Если this.performProjectile(1) вызван в контексте, где нет события,
 * команда безопасно игнорируется или перенаправляется на игрока, не вызывая ошибки.
 *
 * ----------------------------------------------------------------------------
 * 1. SCRIPT CALLS (Вызов Атак)
 * ----------------------------------------------------------------------------
 *
 * this.performMelee(id, [source], [target])
 * this.performProjectile(id, [source], [target])
 * this.performTracer(id, [source], [target])
 *
 * ============================================================================
 */

/*~struct~MeleeAttack:
 * @param ID
 * @text ID Атаки
 * @type number
 * @min 1
 * @default 1
 *
 * @param PID
 * @text PID (Тип)
 * @type number
 * @default 1
 *
 * @param Name
 * @text Название
 * @default Slash
 *
 * @param Source
 * @text Источник (Sid)
 * @type text
 * @desc 0/n: Вызывающий, -1/p: Игрок, ID: Событие.
 * @default 0
 *
 * @param Target
 * @text Цель/Направление (Tid)
 * @type text
 * @desc 0: Взгляд/Мышь, -1/p: Игрок, m: Мышь, ID: Событие.
 * @default 0
 *
 * @param Shape
 * @text Форма
 * @type select
 * @option Sector (Конус)
 * @value sector
 * @option Box (Прямоугольник)
 * @value box
 * @default sector
 *
 * @param Range
 * @text Радиус/Длина
 * @type number
 * @default 48
 *
 * @param Width
 * @text Ширина/FOV
 * @type number
 * @default 90
 *
 * @param Duration
 * @text Длительность (Тики)
 * @type number
 * @min 1
 * @desc Сколько кадров хитбокс активен.
 * @default 15
 *
 * @param Regions
 * @text Регионы-стены
 * @type text
 * @default 
 *
 * @param Terrains
 * @text Террейны-стены
 * @type text
 * @default 
 *
 * @param AnimID
 * @text Анимация удара
 * @type animation
 * @default 1
 *
 * @param ActionsEvent
 * @text Действия (Событие)
 * @type text
 * @default s(A:on)
 *
 * @param ActionsPlayer
 * @text Действия (Игрок)
 * @type text
 * @default 
 *
 * @param ActionsShooter
 * @text Действия (Стрелок)
 * @type text
 * @default 
 */

/*~struct~ProjectileAttack:
 * @param ID
 * @text ID Снаряда
 * @type number
 * @min 1
 * @default 1
 *
 * @param PID
 * @text PID (Тип)
 * @type number
 * @default 1
 *
 * @param Source
 * @text Источник (Sid)
 * @type text
 * @desc 0/n: Вызывающий, -1/p: Игрок, ID: Событие.
 * @default 0
 *
 * @param Target
 * @text Цель/Направление (Tid)
 * @type text
 * @desc 0: Взгляд/Мышь, -1/p: Игрок, m: Мышь, ID: Событие.
 * @default 0
 *
 * @param Graphic
 * @text Графика
 * @type file
 * @dir img/pictures
 * @default 
 *
 * @param Speed
 * @text Скорость
 * @type number
 * @default 5
 *
 * @param Distance
 * @text Время жизни (TTL)
 * @type number
 * @default 60
 *
 * @param Hitbox
 * @text Хитбокс
 * @type number
 * @default 10
 *
 * @param Z
 * @text Z-Level
 * @type number
 * @decimals 1
 * @default 3
 *
 * @param Regions
 * @text Регионы-стены
 * @type text
 * @default 
 *
 * @param Terrains
 * @text Террейны-стены
 * @type text
 * @default 
 *
 * @param AnimID
 * @text Анимация Hit
 * @type animation
 * @default 1
 *
 * @param ActionsEvent
 * @text Действия (Событие)
 * @type text
 * @default 
 *
 * @param ActionsPlayer
 * @text Действия (Игрок)
 * @type text
 * @default 
 *
 * @param ActionsShooter
 * @text Действия (Стрелок)
 * @type text
 * @default 
 */

/*~struct~TracerAttack:
 * @param ID
 * @text ID Трассера
 * @type number
 * @min 1
 * @default 1
 *
 * @param PID
 * @text PID (Тип)
 * @type number
 * @default 1
 *
 * @param Source
 * @text Источник (Sid)
 * @type text
 * @desc 0/n: Вызывающий, -1/p: Игрок, ID: Событие.
 * @default 0
 *
 * @param Target
 * @text Цель/Направление (Tid)
 * @type text
 * @desc 0: Взгляд/Мышь, -1/p: Игрок, m: Мышь, ID: Событие.
 * @default 0
 *
 * @param MaxRange
 * @text Дальность
 * @type number
 * @default 300
 *
 * @param Color
 * @text Цвет
 * @type string
 * @default #FF0000
 *
 * @param Regions
 * @text Регионы-стены
 * @type text
 * @default 
 *
 * @param Terrains
 * @text Террейны-стены
 * @type text
 * @default 
 *
 * @param AnimID
 * @text Анимация Hit
 * @type animation
 * @default 1
 *
 * @param ActionsEvent
 * @text Действия (Событие)
 * @type text
 * @default 
 *
 * @param ActionsPlayer
 * @text Действия (Игрок)
 * @type text
 * @default 
 *
 * @param ActionsShooter
 * @text Действия (Стрелок)
 * @type text
 * @default 
 */

var Imported = Imported || {};
Imported.SuperDuperBattle = true;
Imported.Galv_MapProjectiles = true;

window.Galv = window.Galv || {};
window.Galv.PROJ = window.Galv.PROJ || {};

var SDB = SDB || {};
SDB.Core = SDB.Core || {};
SDB.Melee = SDB.Melee || {};
SDB.Proj = SDB.Proj || {};
SDB.Tracer = SDB.Tracer || {};

(function() {
    'use strict';

    // --------------------------------------------------------------------------
    // PARAMS & DB PARSING
    // --------------------------------------------------------------------------
    var parameters = PluginManager.parameters('SuperDuperBattle');
    
    SDB.Params = {
        debugMode: parameters['Debug Mode'] === 'true',
        disableMouse: parameters['Disable Mouse Move'] === 'true',
        meleeList: JSON.parse(parameters['Melee List'] || '[]'),
        projList: JSON.parse(parameters['Projectile List'] || '[]'),
        tracerList: JSON.parse(parameters['Tracer List'] || '[]')
    };

    SDB.parseList = function(list) {
        var parsedMap = {};
        for (var i = 0; i < list.length; i++) {
            var item = JSON.parse(list[i]);
            parsedMap[Number(item.ID)] = item;
            // Pre-process arrays
            if (item.Regions) {
                item._regions = item.Regions.split(',').map(Number);
            } else {
                item._regions = [];
            }
            if (item.Terrains) {
                item._terrains = item.Terrains.split(',').map(Number);
            } else {
                item._terrains = [];
            }
        }
        return parsedMap;
    };

    SDB.DB = {
        Melee: SDB.parseList(SDB.Params.meleeList),
        Proj: SDB.parseList(SDB.Params.projList),
        Tracer: SDB.parseList(SDB.Params.tracerList)
    };

    SDB.isDebug = SDB.Params.debugMode;
    SDB.DebugLogs = [];
    console.log("SDB INITIALIZED v1.45. Debug Mode: " + SDB.isDebug);

    // --------------------------------------------------------------------------
    // UTILS & LOGGING
    // --------------------------------------------------------------------------
    SDB.Core.log = function(msg) {
        if (!SDB.isDebug) return;
        var logLine = "[" + new Date().toLocaleTimeString().split(' ')[0] + "] " + msg;
        console.log("[SDB] " + msg);
        SDB.DebugLogs.push(logLine);
        if (SDB.DebugLogs.length > 10) {
            SDB.DebugLogs.shift();
        }
    };

    if (SDB.Params.disableMouse) {
        var _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
        Scene_Map.prototype.processMapTouch = function() {
            // Override to disable click-to-move
        };
    }

    // --------------------------------------------------------------------------
    // MATH
    // --------------------------------------------------------------------------
    SDB.Core.degToRad = function(deg) {
        return deg * (Math.PI / 180);
    };

    SDB.Core.radToDeg = function(rad) {
        return rad * (180 / Math.PI);
    };

    SDB.Core.getDistance = function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    };

    // VELOCITY COMPENSATION (Fix for moving targets)
    SDB.Core.getTargetSpeedBuffer = function(target) {
        if (target.isMoving()) {
            // Speed (px/frame) * buffer multiplier
            return target.distancePerFrame() * 48 * 2.0; 
        }
        return 0;
    };

    // TWO-WAY CCD: Target Motion Prediction
    SDB.Core.getTargetPredictedPos = function(target) {
        if (target.isMoving()) {
            // Predict position next frame
            var dx = (target._realX - target._x) * 48; // Interpolated delta X
            var dy = (target._realY - target._y) * 48; // Interpolated delta Y
            return {
                x: target._realX * 48 + 24 + dx,
                y: target._realY * 48 + 24 + dy
            };
        }
        return {
            x: target._realX * 48 + 24,
            y: target._realY * 48 + 24
        };
    };

    // CCD: Continuous Collision Detection
    SDB.Core.segmentCircleIntersect = function(x1, y1, x2, y2, cx, cy, r) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var fx = x1 - cx;
        var fy = y1 - cy;
        
        var a = dx * dx + dy * dy;
        var b = 2 * (fx * dx + fy * dy);
        var c = (fx * fx + fy * fy) - (r * r);
        
        var discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;
        
        discriminant = Math.sqrt(discriminant);
        var t1 = (-b - discriminant) / (2 * a);
        var t2 = (-b + discriminant) / (2 * a);
        
        if (t1 >= 0 && t1 <= 1) return true;
        if (t2 >= 0 && t2 <= 1) return true;
        
        if (SDB.Core.getDistance(x1, y1, cx, cy) < r) return true;
        
        return false;
    };

    // --------------------------------------------------------------------------
    // TARGET RESOLVING
    // --------------------------------------------------------------------------
    SDB.Core.resolveTarget = function(val, contextChar) {
        if (val === undefined || val === null || val === "" || val === "0" || val === 0 || val === 'n') {
            return contextChar;
        }
        if (val === -1 || val === "-1" || val === 'p' || val === 'player') {
            return $gamePlayer;
        }
        if (val === 'm' || val === 'mouse') {
            return { x: 0, y: 0, _isMouse: true };
        }
        var id = Number(val);
        if (id > 0) {
            return $gameMap.event(id);
        }
        // Fallback safety for null context
        return contextChar || $gamePlayer;
    };

    SDB.Core.calcAngle = function(source, target) {
        var sRealX = source._realX * 48 + 24;
        var sRealY = source._realY * 48 + 24;
        var tRealX, tRealY;

        if (target._isMouse) {
            // Mouse in World Coordinates
            tRealX = TouchInput.x + $gameMap.displayX() * 48;
            tRealY = TouchInput.y + $gameMap.displayY() * 48;
        } else if (target === source || target === null) {
            // No target = Aim Direction
            var d = source.direction();
            if (d === 2) return Math.PI / 2;
            if (d === 4) return Math.PI;
            if (d === 6) return 0;
            if (d === 8) return -Math.PI / 2;
            return 0;
        } else {
            // Entity Target
            tRealX = target._realX * 48 + 24;
            tRealY = target._realY * 48 + 24;
        }

        return Math.atan2(tRealY - sRealY, tRealX - sRealX);
    };

    // --------------------------------------------------------------------------
    // ACTION PARSER
    // --------------------------------------------------------------------------
    SDB.Core.executeActionString = function(actionStr, target, source) {
        if (!actionStr) return;
        var actions = actionStr.split(',');
        SDB.Core.log("Action Exec: " + actionStr);

        for (var i = 0; i < actions.length; i++) {
            var cmd = actions[i].trim();
            var match = cmd.match(/([A-Za-z]+)\((.*)\)/);
            var code = match ? match[1] : cmd;
            var args = match ? match[2].split(':') : [];

            if (code.toUpperCase() === 'E') {
                if (target && target.erase) target.erase();
            } else if (code === 'S') {
                if (args.length >= 2) {
                    var swId = Number(args[0]);
                    var state = args[1].toLowerCase() === 'on';
                    $gameSwitches.setValue(swId, state);
                }
            } else if (code === 's') {
                var char = args[0].toUpperCase();
                var state = args[1].toLowerCase() === 'on';
                var targetObj = (args[2] && args[2].toLowerCase() === 's') ? source : target;
                if (targetObj && targetObj.eventId) { 
                    var key = [$gameMap.mapId(), targetObj.eventId(), char];
                    $gameSelfSwitches.setValue(key, state);
                } else if (targetObj === $gamePlayer) {
                    SDB.Core.log("WARNING: Cannot set Self Switch on Player.");
                }
            } else if (code.toUpperCase() === 'C') {
                 if (args[0]) {
                     $gameTemp.reserveCommonEvent(Number(args[0]));
                 }
            }
        }
    };

    SDB.Core.processHit = function(target, source, data) {
        var tName = target === $gamePlayer ? "Player" : "Event " + target.eventId();
        SDB.Core.log("HIT: " + tName);
        
        if (Number(data.AnimID) > 0) {
            target.requestAnimation(Number(data.AnimID));
        }

        if (target === $gamePlayer) {
            SDB.Core.executeActionString(data.ActionsPlayer, target, source);
            SDB.Core.executeActionString(data.ActionsShooter, source, target);
        } else {
            SDB.Core.executeActionString(data.ActionsEvent, target, source);

            // P37: прямое применение стана и отбрасывания при попадании
            // по врагу оружием игрока — НЕ через P14-страницу (она зависит
            // от action string карточки атаки, которая может не ставить D)
            if (source === $gamePlayer && typeof SDE_API !== 'undefined' && SDE_API.getWeaponByVar) {
                var weapon = SDE_API.getWeaponByVar($gameVariables.value(17));
                if (weapon) {
                    var stun = Math.max(0, Number(weapon.stun) || 0);
                    var kb = Math.max(0, Number(weapon.knockback) || 0);
                    if (stun > 0) SDE_API.hitStun(target.eventId(), stun);
                    if (kb > 0) SDE_API.hitKnockback(target.eventId(), kb);
                }
            }
        }
    };

    SDB.Core.isValidTarget = function(event, pid) {
        if (!event || event._erased) return false;
        if (!event._projEffects) return false;
        if (event._projEffects === true) return true;
        if (Array.isArray(event._projEffects)) {
            return event._projEffects.indexOf(pid) !== -1;
        }
        return false;
    };

    SDB.Core.isBlocker = function(event, pid) {
        if (!event || event._erased) return false;
        if (!event._projBlock) return false;
        if (event._projBlock === true || event._projBlock === -1) return true;
        if (Array.isArray(event._projBlock)) {
            return event._projBlock.indexOf(pid) !== -1;
        }
        return false;
    };

    // --------------------------------------------------------------------------
    // MODULE: MELEE (ACTIVE + INTERPOLATED)
    // --------------------------------------------------------------------------
    Game_Map.prototype.addSDBMelee = function(data, context, srcOv, tarOv) {
        this._sdbMelee = this._sdbMelee || [];
        var attacker = SDB.Core.resolveTarget(srcOv !== undefined ? srcOv : data.Source, context);
        if (!attacker) return;

        var aimTarget = SDB.Core.resolveTarget(tarOv !== undefined ? tarOv : data.Target, null);
        if (!aimTarget && attacker === $gamePlayer) aimTarget = { _isMouse: true };

        var hitbox = {
            data: data,
            attacker: attacker,
            target: aimTarget,
            life: Number(data.Duration) || 15,
            pid: Number(data.PID) || 1,
            hitList: [],
            lastX: attacker._realX * 48 + 24,
            lastY: attacker._realY * 48 + 24
        };
        this._sdbMelee.push(hitbox);
        SDB.Core.log("Melee START: " + data.ID);
    };

    SDB.Melee.update = function() {
        var activeList = $gameMap._sdbMelee || [];
        for (var i = activeList.length - 1; i >= 0; i--) {
            var box = activeList[i];
            
            box.life--;
            var angle = SDB.Core.calcAngle(box.attacker, box.target);
            var cx = box.attacker._realX * 48 + 24;
            var cy = box.attacker._realY * 48 + 24;
            
            if (SDB.isDebug) {
                SDB.Debug.addMeleeShape(box.attacker, angle, box.data);
            }

            var candidates = $gameMap.events().concat([$gamePlayer]);
            var baseBodyRadius = 24; 

            // INTERPOLATION (Backtrace)
            var distMoved = SDB.Core.getDistance(cx, cy, box.lastX, box.lastY);
            var checks = (distMoved > 24) ? 2 : 1; 

            for (var j = 0; j < candidates.length; j++) {
                var target = candidates[j];
                
                if (target === box.attacker) continue;
                if (!SDB.Core.isValidTarget(target, box.pid)) continue;
                if (box.hitList.indexOf(target) !== -1) continue;

                var tMapX = Math.floor(target._realX);
                var tMapY = Math.floor(target._realY);
                if (box.data._regions.indexOf($gameMap.regionId(tMapX, tMapY)) !== -1) continue;
                if (box.data._terrains.indexOf($gameMap.terrainTag(tMapX, tMapY)) !== -1) continue;

                var hit = false;
                
                for (var k = 0; k < checks; k++) {
                    var lerpT = (k + 1) / checks;
                    var lerpCX = box.lastX + (cx - box.lastX) * lerpT;
                    var lerpCY = box.lastY + (cy - box.lastY) * lerpT;

                    var tx = target._realX * 48 + 24;
                    var ty = target._realY * 48 + 24;
                    var dist = SDB.Core.getDistance(lerpCX, lerpCY, tx, ty);

                    var speedBuffer = SDB.Core.getTargetSpeedBuffer(target);
                    var effectiveRadius = baseBodyRadius + speedBuffer;

                    if (dist < effectiveRadius) {
                        hit = true;
                    } else if (box.data.Shape === 'sector') {
                        var widthBonus = (target.isMoving()) ? 20 : 0;
                        hit = SDB.Melee.checkSector(lerpCX, lerpCY, tx, ty, Number(box.data.Range) + effectiveRadius, Number(box.data.Width) + widthBonus, angle);
                    } else {
                        hit = SDB.Melee.checkBox(lerpCX, lerpCY, tx, ty, Number(box.data.Range) + effectiveRadius, Number(box.data.Width) + effectiveRadius, angle);
                    }

                    if (hit) break;
                }

                if (hit) {
                    box.hitList.push(target);
                    SDB.Core.processHit(target, box.attacker, box.data);
                }
            }

            box.lastX = cx;
            box.lastY = cy;

            if (box.life <= 0) {
                activeList.splice(i, 1);
            }
        }
    };

    SDB.Melee.checkSector = function(cx, cy, tx, ty, radius, fovDeg, facingAngle) {
        if (SDB.Core.getDistance(cx, cy, tx, ty) > radius) return false;
        var angleToTarget = Math.atan2(ty - cy, tx - cx);
        var angleDiff = angleToTarget - facingAngle;
        while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        return Math.abs(angleDiff) <= (SDB.Core.degToRad(fovDeg) / 2) + 0.05;
    };

    SDB.Melee.checkBox = function(cx, cy, tx, ty, length, width, angle) {
        var boxCx = cx + Math.cos(angle) * (length / 2);
        var boxCy = cy + Math.sin(angle) * (length / 2);
        var dx = tx - boxCx;
        var dy = ty - boxCy;
        var cos = Math.cos(-angle);
        var sin = Math.sin(-angle);
        var localX = dx * cos - dy * sin;
        var localY = dx * sin + dy * cos;
        return (Math.abs(localX) <= length / 2) && (Math.abs(localY) <= width / 2);
    };

    SDB.Melee.perform = function(context, id, srcOv, tarOv) {
        var data = SDB.DB.Melee[id];
        if (data) {
            $gameMap.addSDBMelee(data, context, srcOv, tarOv);
        }
    };

    // --------------------------------------------------------------------------
    // PROJECTILES
    // --------------------------------------------------------------------------
    Game_Map.prototype.addSDBProjectile = function(data, context, srcOv, tarOv) {
        SDB.Core.log("Spawn Proj ID: " + data.ID);
        this._sdbProjectiles = this._sdbProjectiles || [];
        
        var attacker = SDB.Core.resolveTarget(srcOv !== undefined ? srcOv : data.Source, context);
        if (!attacker) return;

        var aimTarget = SDB.Core.resolveTarget(tarOv !== undefined ? tarOv : data.Target, null);
        if (!aimTarget && attacker === $gamePlayer) aimTarget = { _isMouse: true };

        var angle = SDB.Core.calcAngle(attacker, aimTarget);
        
        var bullet = {
            x: attacker._realX * 48 + 24,
            y: attacker._realY * 48 + 24,
            vx: Math.cos(angle) * Number(data.Speed),
            vy: Math.sin(angle) * Number(data.Speed),
            data: data,
            attacker: attacker,
            life: Number(data.Distance),
            angle: angle,
            z: Number(data.Z) || 3,
            pid: Number(data.PID) || 1
        };
        
        this._sdbProjectiles.push(bullet);
        if (SceneManager._scene._spriteset) {
            SceneManager._scene._spriteset.createSDBProjectile(this._sdbProjectiles.length - 1);
        }
    };

    function Sprite_SDBProjectile() {
        this.initialize.apply(this, arguments);
    }
    Sprite_SDBProjectile.prototype = Object.create(Sprite.prototype);
    Sprite_SDBProjectile.prototype.constructor = Sprite_SDBProjectile;

    Sprite_SDBProjectile.prototype.initialize = function(index) {
        Sprite.prototype.initialize.call(this);
        this._index = index;
        this._data = $gameMap._sdbProjectiles[index];
        this.anchor.set(0.5);
        this._ticker = 0;
        this._pattern = 0;
        this.update();
    };

    Sprite_SDBProjectile.prototype.loadBitmap = function() {
        if (!this._data) return;
        var rawName = this._data.data.Graphic;
        var match = rawName.match(/(.*)\((\d+),(\d+)\)/);
        if (match) {
            this._bitmapName = match[1];
            this._frames = Number(match[2]);
            this._frameSpeed = Number(match[3]);
        } else {
            this._bitmapName = rawName;
            this._frames = 1;
            this._frameSpeed = 0;
        }
        this.bitmap = ImageManager.loadPicture(this._bitmapName);
        this.rotation = this._data.angle + (Math.PI/2);
    };

    Sprite_SDBProjectile.prototype.update = function() {
        Sprite.prototype.update.call(this);
        var bullet = $gameMap._sdbProjectiles[this._index];
        if (!bullet || bullet.life <= 0) { 
            if (this.parent) this.parent.removeChild(this); 
            return; 
        }
        
        if (!this.bitmap) this.loadBitmap();
        
        // CCD: Store Old position
        var oldX = bullet.x;
        var oldY = bullet.y;
        
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life--;
        this.x = $gameMap.adjustX(bullet.x / 48) * 48;
        this.y = $gameMap.adjustY(bullet.y / 48) * 48;
        this.z = bullet.z;
        
        if (this._frames > 1 && ++this._ticker >= this._frameSpeed) {
            this._ticker = 0;
            this._pattern = (this._pattern + 1) % this._frames;
            var w = this.bitmap.width / this._frames;
            this.setFrame(this._pattern * w, 0, w, this.bitmap.height);
        }
        
        this.updateCollision(bullet, oldX, oldY);
    };

    Sprite_SDBProjectile.prototype.updateCollision = function(bullet, oldX, oldY) {
        var mapX = Math.floor(bullet.x / 48);
        var mapY = Math.floor(bullet.y / 48);
        
        if (bullet.data._regions.indexOf($gameMap.regionId(mapX, mapY)) !== -1 || 
            bullet.data._terrains.indexOf($gameMap.terrainTag(mapX, mapY)) !== -1) { 
            bullet.life = 0; return; 
        }
        if (bullet.z < 4 && !$gameMap.isPassable(mapX, mapY, 2)) {
             if (bullet.data._regions.length === 0 && bullet.data._terrains.length === 0) { 
                 bullet.life = 0; return; 
             }
        }
        
        var candidates = $gameMap.events().concat([$gamePlayer]);
        var radius = Number(bullet.data.Hitbox) || 10;
        
        for (var i = 0; i < candidates.length; i++) {
            var t = candidates[i];
            if (t === bullet.attacker || t._erased) continue;
            
            var tRx = t._realX * 48 + 24;
            var tRy = t._realY * 48 + 24;
            var tRadius = radius + 12; // Base padding
            
            // --- VELOCITY COMPENSATION ---
            tRadius += SDB.Core.getTargetSpeedBuffer(t);
            // -----------------------------

            if (SDB.Core.segmentCircleIntersect(oldX, oldY, bullet.x, bullet.y, tRx, tRy, tRadius)) {
                if (SDB.Core.isBlocker(t, bullet.pid)) { 
                    bullet.life = 0; return; 
                }
                if (SDB.Core.isValidTarget(t, bullet.pid)) { 
                    SDB.Core.processHit(t, bullet.attacker, bullet.data); 
                    bullet.life = 0; return; 
                }
            }
        }
    };

    Sprite_SDBProjectile.prototype.destroyBullet = function(bullet) {
        bullet.life = 0;
        $gameMap._sdbProjectiles[this._index] = null;
        this.parent.removeChild(this);
    };

    // --------------------------------------------------------------------------
    // TRACER
    // --------------------------------------------------------------------------
    SDB.Tracer.perform = function(context, id, srcOv, tarOv) {
        var data = SDB.DB.Tracer[id];
        if (!data) return SDB.Core.log("Tracer ID " + id + " MISSING!");
        SDB.Core.log("Perform Tracer: " + id);

        var attacker = SDB.Core.resolveTarget(srcOv !== undefined ? srcOv : data.Source, context);
        if (!attacker) return;

        var aimTarget = SDB.Core.resolveTarget(tarOv !== undefined ? tarOv : data.Target, null);
        if (!aimTarget && attacker === $gamePlayer) aimTarget = { _isMouse: true };

        var angle = SDB.Core.calcAngle(attacker, aimTarget);
        
        var startX = attacker._realX * 48 + 24;
        var startY = attacker._realY * 48 + 24;
        var pid = Number(data.PID) || 1;
        var maxDist = Number(data.MaxRange);
        
        var step = 12; var dist = 0; var hitObj = null;
        var endX = startX + Math.cos(angle) * maxDist;
        var endY = startY + Math.sin(angle) * maxDist;

        while (dist < maxDist) {
            dist += step;
            var cx = startX + Math.cos(angle) * dist;
            var cy = startY + Math.sin(angle) * dist;

            var mapX = Math.floor(cx / 48);
            var mapY = Math.floor(cy / 48);

            if (data._regions.indexOf($gameMap.regionId(mapX, mapY)) !== -1 || 
                data._terrains.indexOf($gameMap.terrainTag(mapX, mapY)) !== -1) {
                endX = cx; endY = cy; 
                SDB.Core.log("Tracer hit Wall/Region");
                break;
            }
            if (data._regions.length === 0 && data._terrains.length === 0) {
                if (!$gameMap.isPassable(mapX, mapY, 2)) {
                    endX = cx; endY = cy; 
                    SDB.Core.log("Tracer hit Map Wall");
                    break;
                }
            }

            var candidates = $gameMap.events().concat([$gamePlayer]);
            for (var j = 0; j < candidates.length; j++) {
                var t = candidates[j];
                if (t === attacker || t._erased) continue;
                if ((SDB.Core.isValidTarget(t, pid) || SDB.Core.isBlocker(t, pid))) {
                    var tx = t._realX * 48 + 24;
                    var ty = t._realY * 48 + 24;
                    
                    var tBuffer = 24 + SDB.Core.getTargetSpeedBuffer(t);

                    if (SDB.Core.getDistance(cx, cy, tx, ty) < tBuffer) { 
                        endX = cx; endY = cy;
                        if (SDB.Core.isValidTarget(t, pid)) hitObj = t;
                        dist = maxDist + 999;
                        break;
                    }
                }
            }
        }

        SDB.Debug.addTracerLine(startX / 48, startY / 48, endX / 48, endY / 48, data.Color);
        if (hitObj) {
            SDB.Core.processHit(hitObj, attacker, data);
        }
    };

    // --------------------------------------------------------------------------
    // EXTENSIONS
    // --------------------------------------------------------------------------
    var _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        _Game_Map_update.call(this, sceneActive);
    };

    // SYNC FIX: Post-Move Update
    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        SDB.Melee.update();
        if (this._sdbDebug) {
            this._sdbDebug.update();
        }
    };

    // INTERPRETER SAFETY FIX (v1.45)
    var _Game_Interpreter_executeCommand = Game_Interpreter.prototype.executeCommand;
    Game_Interpreter.prototype.executeCommand = function() {
        SDB.Core.currentInterpreter = this;
        return _Game_Interpreter_executeCommand.apply(this, arguments);
    };

    // Legacy Wrappers
    window.Galv.PROJ.quickTar = function(id) { 
        if (SDB.Core.currentInterpreter && SDB.Core.currentInterpreter.character(0)) {
            SDB.Core.currentInterpreter.character(0).performProjectile(id); 
        }
    };
    window.Galv.PROJ.quickDir = function(id) { 
        if (SDB.Core.currentInterpreter && SDB.Core.currentInterpreter.character(0)) {
            SDB.Core.currentInterpreter.character(0).performProjectile(id); 
        }
    };

    // Interpreter Methods (with safety check)
    Game_Interpreter.prototype.performMelee = function(id, s, t) { 
        var char = this.character(0);
        if (char) char.performMelee(id, s, t); 
        else SDB.Core.log("performMelee: No character context!");
    };
    Game_Interpreter.prototype.performProjectile = function(id, s, t) { 
        var char = this.character(0);
        if (char) char.performProjectile(id, s, t); 
        else {
             // FALLBACK: Use Player as default attacker if context is missing
             SDB.Core.log("performProjectile: No event context, defaulting to Player");
             $gamePlayer.performProjectile(id, s, t);
        }
    };
    Game_Interpreter.prototype.performTracer = function(id, s, t) { 
        var char = this.character(0);
        if (char) char.performTracer(id, s, t); 
        else SDB.Core.log("performTracer: No character context!");
    };

    var _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        _Game_CharacterBase_initMembers.call(this);
        this._projEffects = false;
        this._projBlock = false;
        this._projYoffset = 0;
    };

    var _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
    Game_Event.prototype.setupPageSettings = function() {
        _Game_Event_setupPageSettings.call(this);
        var page = this.page();
        if (!page) return;
        this._projEffects = false;
        this._projBlock = false;
        for (var i = 0; i < page.list.length; i++) {
            var cmd = page.list[i];
            if (cmd.code === 108 || cmd.code === 408) {
                var comment = cmd.parameters[0];
                var effectMatch = comment.match(/<projEffect(?::\s*(.*))?>/i);
                if (effectMatch) {
                    this._projEffects = effectMatch[1] ? effectMatch[1].split(',').map(Number) : true;
                }
                var blockMatch = comment.match(/<projBlock:\s*(.*)>/i);
                if (blockMatch) {
                    var val = blockMatch[1].trim().toLowerCase();
                    this._projBlock = (val === 'true') ? true : (val === 'false' ? false : val.split(',').map(Number));
                }
                var yMatch = comment.match(/<projY:\s*(\d+)>/i);
                if (yMatch) this._projYoffset = Number(yMatch[1]);
            }
        }
    };

    Game_Player.prototype.setupSDB = function() { this._projEffects = true; };
    var _Game_Player_initMembers = Game_Player.prototype.initMembers;
    Game_Player.prototype.initMembers = function() { _Game_Player_initMembers.call(this); this.setupSDB(); };

    Game_Character.prototype.performMelee = function(id, s, t) { 
        SDB.Melee.perform(this, id, s, t); 
    };
    Game_Character.prototype.performProjectile = function(id, s, t) { 
        if (SDB.DB.Proj[id]) {
            $gameMap.addSDBProjectile(SDB.DB.Proj[id], this, s, t);
        }
    };
    Game_Character.prototype.performTracer = function(id, s, t) { 
        SDB.Tracer.perform(this, id, s, t); 
    };

    Game_Player.prototype.performMelee = function(id, s, t) { 
        SDB.Melee.perform(this, id, s, t); 
    };
    Game_Player.prototype.performProjectile = function(id, s, t) { 
        if (SDB.DB.Proj[id]) {
            $gameMap.addSDBProjectile(SDB.DB.Proj[id], this, s, t);
        }
    };
    Game_Player.prototype.performTracer = function(id, s, t) { 
        SDB.Tracer.perform(this, id, s, t); 
    };

    // --------------------------------------------------------------------------
    // DEBUG VISUALS
    // --------------------------------------------------------------------------
    function Sprite_SDBDebug() { 
        this.initialize.apply(this, arguments); 
    }
    Sprite_SDBDebug.prototype = Object.create(PIXI.Graphics.prototype);
    Sprite_SDBDebug.prototype.constructor = Sprite_SDBDebug;
    
    Sprite_SDBDebug.prototype.initialize = function() {
        if (typeof PIXISuper === "function") { PIXISuper(PIXI.Graphics, this); }
        else { PIXI.Graphics.call(this); }
        this.z = 999;
        this._textSprite = new Sprite(new Bitmap(Graphics.width, 400));
        this.addChild(this._textSprite);
    };

    Sprite_SDBDebug.prototype.update = function() {
        this.clear();
        
        if (!SDB.isDebug) {
            this._textSprite.visible = false;
            return;
        }
        this._textSprite.visible = true;

        // ESP: Draw Entity Hitboxes
        this.lineStyle(2, 0x00FFFF, 0.7); 
        this.drawCircle($gamePlayer.screenX(), $gamePlayer.screenY() - 24, 20);
        
        var events = $gameMap.events();
        for (var eIdx = 0; eIdx < events.length; eIdx++) {
            var event = events[eIdx];
            if (event._erased) continue;
            if (event._projEffects) { 
                this.lineStyle(2, 0xFF0000, 0.7); 
                this.drawCircle(event.screenX(), event.screenY() - 24, 20); 
            }
            if (event._projBlock) { 
                this.lineStyle(2, 0xFFA500, 0.7); 
                this.drawRect(event.screenX() - 20, event.screenY() - 44, 40, 40); 
            }
        }

        // Pilot Light
        this.lineStyle(0); 
        this.beginFill(0xFF0000, 1); 
        this.drawRect(10, 10, 10, 10); 
        this.endFill();

        // Logs
        this._textSprite.bitmap.clear();
        this._textSprite.bitmap.fontSize = 12;
        this._textSprite.bitmap.fillRect(10, 30, 300, 16 * SDB.DebugLogs.length + 5, 'rgba(0,0,0,0.6)');
        for (var lIdx = 0; lIdx < SDB.DebugLogs.length; lIdx++) {
            this._textSprite.bitmap.drawText(SDB.DebugLogs[lIdx], 15, 30 + lIdx * 16, 290, 16);
        }

        // Tracers
        for (var tIdx = SDB.Debug.tracers.length - 1; tIdx >= 0; tIdx--) {
            var t = SDB.Debug.tracers[tIdx];
            this.lineStyle(2, t.color, t.life / 60);
            this.moveTo($gameMap.adjustX(t.x1) * 48, $gameMap.adjustY(t.y1) * 48);
            this.lineTo($gameMap.adjustX(t.x2) * 48, $gameMap.adjustY(t.y2) * 48);
            if (--t.life <= 0) {
                SDB.Debug.tracers.splice(tIdx, 1);
            }
        }

        // Melee Shapes
        for (var sIdx = SDB.Debug.shapes.length - 1; sIdx >= 0; sIdx--) {
            var s = SDB.Debug.shapes[sIdx];
            
            // Re-calculate screen position based on character position (Dynamic)
            var realX = s.char ? s.char._realX : 0;
            var realY = s.char ? s.char._realY : 0;
            var sx = $gameMap.adjustX(realX) * 48 + 24;
            var sy = $gameMap.adjustY(realY) * 48 + 24;

            this.lineStyle(2, 0x00FF00, 0.5); 
            this.beginFill(0x00FF00, 0.2);
            
            if (s.type === 'sector') {
                this.moveTo(sx, sy);
                this.arc(sx, sy, s.range, s.angle - SDB.Core.degToRad(s.width/2), s.angle + SDB.Core.degToRad(s.width/2));
                this.lineTo(sx, sy);
            } else {
                var cx = sx + Math.cos(s.angle) * s.range;
                var cy = sy + Math.sin(s.angle) * s.range;
                this.drawCircle(cx, cy, s.width/2); 
                this.moveTo(sx, sy); 
                this.lineTo(cx, cy);
            }
            this.endFill();
            
            if (--s.life <= 0) {
                SDB.Debug.shapes.splice(sIdx, 1);
            }
        }
    };

    SDB.Debug = { shapes: [], tracers: [] };
    
    SDB.Debug.addMeleeShape = function(char, angle, data) {
        SDB.Debug.shapes.push({
            type: data.Shape, 
            char: char, 
            angle: angle, 
            range: Number(data.Range), 
            width: Number(data.Width), 
            life: 1
        });
    };
    
    SDB.Debug.addTracerLine = function(x1, y1, x2, y2, c) {
        SDB.Debug.tracers.push({
            x1: x1, 
            y1: y1, 
            x2: x2, 
            y2: y2, 
            color: parseInt(c.replace('#','0x')), 
            life: 60
        });
    };

    // MOVED DEBUG LAYER TO UPPER LAYER TO ENSURE VISIBILITY
    var _Spriteset_Map_createUpperLayer = Spriteset_Map.prototype.createUpperLayer;
    Spriteset_Map.prototype.createUpperLayer = function() {
        _Spriteset_Map_createUpperLayer.call(this);
        this._sdbDebug = new Sprite_SDBDebug();
        this.addChild(this._sdbDebug);
    };

    Spriteset_Map.prototype.createSDBProjectile = function(idx) {
        this._tilemap.addChild(new Sprite_SDBProjectile(idx));
    };

    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mid) {
        _Game_Map_setup.call(this, mid);
        this._sdbProjectiles = []; 
        this._sdbMelee = [];
        SDB.Debug.shapes = []; 
        SDB.Debug.tracers = []; 
        SDB.DebugLogs = [];
    };

})();