/*
 *=============================================================================
 * SuperDuperMovement_Addon.js
 *=============================================================================
 * Автор: Korolev
 * Лицензия: MIT
 */

/*:
 * @plugindesc [v1.1.2] Аддон для SuperDuperMovement: Умный ИИ, A*, Патрули и Боевые рывки.
 * @author Korolev
 *
 * @param --- НАСТРОЙКИ БОЕВЫХ РЫВКОВ (DASH СКИЛЛЫ) ---
 * @default
 *
 * @param Dash Active Switch
 * @text Переключатель: Состояние Рывка
 * @parent --- НАСТРОЙКИ БОЕВЫХ РЫВКОВ (DASH СКИЛЛЫ) ---
 * @type switch
 * @desc ID переключателя, который будет ВКЛЮЧЕН, пока игрок находится в боевом рывке.
 * @default 0
 *
 * @param Dash Database
 * @text База Данных Рывков
 * @parent --- НАСТРОЙКИ БОЕВЫХ РЫВКОВ (DASH СКИЛЛЫ) ---
 * @type struct<DashSettings>[]
 * @desc Настройте профили боевых рывков.
 * @default []
 *
 * @param Collision Steps
 * @text Точность коллизии рывка
 * @parent --- НАСТРОЙКИ БОЕВЫХ РЫВКОВ (DASH СКИЛЛЫ) ---
 * @type number
 * @min 1
 * @max 10
 * @desc Микро-шаги для боевого рывка (защита от пролета сквозь стены). Стандарт: 4.
 * @default 4
 *
 * @param --- ОТСЛЕЖИВАНИЕ И ОГРАНИЧЕНИЯ ---
 * @default
 *
 * @param Post-Dash Stun
 * @text Оглушение после рывка (кадры)
 * @parent --- ОТСЛЕЖИВАНИЕ И ОГРАНИЧЕНИЯ ---
 * @type number
 * @desc Время (в кадрах), в течение которого герой не может двигаться после рывка.
 * @default 10
 *
 * @param Lock Direction
 * @text Блокировка поворота
 * @parent --- ОТСЛЕЖИВАНИЕ И ОГРАНИЧЕНИЯ ---
 * @type boolean
 * @desc Запрещает герою вертеться во время рывка.
 * @default true
 *
 * @param Dash Tracking Switch ID
 * @text Переключатель: Трекер Рывка
 * @parent --- ОТСЛЕЖИВАНИЕ И ОГРАНИЧЕНИЯ ---
 * @type switch
 * @desc ID переключателя для включения трекера направления и вектора (0 = выкл).
 * @default 0
 *
 * @param Dash Tracking Variable ID
 * @text Переменная: Статус Трекера
 * @parent --- ОТСЛЕЖИВАНИЕ И ОГРАНИЧЕНИЯ ---
 * @type variable
 * @desc Переменная, куда пишется ID состояния (Face * 10 + MoveDir).
 * @default 0
 *
 * @param --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
 * @default
 *
 * @param Dead Zone Regions
 * @text Мертвые зоны (ID Регионов)
 * @parent --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
 * @desc Укажите через запятую ID регионов (R), которые ИИ должен обходить как стены. Пример: 8, 10, 15
 * @default 
 *
 * @param Repulsion Force
 * @text Сила отталкивания от стен
 * @parent --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
 * @desc Сила отталкивания от препятствий при поиске пути (0.0 - 5.0).
 * @default 2.5
 *
 * @param Path Refresh Rate
 * @text Частота обновления (кадры)
 * @parent --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
 * @desc Как часто пересчитывать маршрут A* (стандарт: 30).
 * @default 30
 *
 * @param Debug Mode
 * @text Режим отладки
 * @type boolean
 * @desc Включить логирование в консоль (F8).
 * @default false
 *
 * @help
 * ============================================================================
 * SuperDuperMovement_Addon (v1.1.2)
 * ============================================================================
 * Этот плагин является дополнением к ядру SuperDuperMovement.
 * Модуль стамины вырезан (управляется ядром), оставлены мощные системы ИИ:
 *
 * ============================================================================
 * КОМАНДЫ ПЛАГИНА (Plugin Commands):
 * ============================================================================
 * [БОЕВЫЕ РЫВКИ]:
 * AltimitDash dash [Name]       — Запустить рывок (для события или игрока).
 * AltimitDash playerDash [Name] — Запустить рывок специально для игрока.
 * AltimitDash eventDash [ID] [Name] — Запустить рывок события по ID.
 *
 * ============================================================================
 * УМНОЕ ПЕРЕДВИЖЕНИЕ И ТАКТИКА (Использовать в "Задать маршрут -> Скрипт"):
 * ============================================================================
 * Базовое преследование:
 * this.smartMoveTo(x, y);       — Умное движение к координатам.
 * this.smartMoveToPlayer();     — Умное преследование игрока.
 * this.smartMoveToEvent(id);    — Умное движение к другому событию.
 * this.smartStop();             — Остановить умное движение.
 * * Тактическое поведение (Для связи с SuperDuperEnemies):
 * this.smartFleeFromPlayer(10);   — Убегать от игрока до дистанции 10 клеток.
 * this.smartBackAway(8);          — Пятиться от игрока (уходит, но смотрит на него).
 * this.smartWander(5, 120);       — Бродить (крысы): радиус 5 кл., пауза 120 кадров.
 * this.smartPatrol([[5,5], [10,5], [10,10]]); — Патрулировать по координатам по кругу.
 * this.smartOrbitPlayer(2.5, 6.0); — Бегать кругами вокруг игрока (мин и макс радиус).
 * * ============================================================================
 * ----------------------------------------------------------------------------
 * ОТСЛЕЖИВАНИЕ НАПРАВЛЕНИЯ И РЫВКОВ (ТРЕКЕР ИЗ ALTIMIT PATCH)
 * ----------------------------------------------------------------------------
 * Трекер генерирует двузначное число и пишет его в выбранную переменную. 
 * Формула: (Направление взгляда * 10) + (Вектор движения)
 */

/*~struct~DashSettings:
 * @param Name
 * @text Название (ID)
 * @desc Уникальное имя рывка (используется в командах плагина).
 *
 * @param TargetMode
 * @text Тип наведения
 * @type select
 * @option По направлению движения (Movement)
 * @value 0
 * @option За курсором мыши (Mouse - только для игрока)
 * @value 1
 * @option В сторону игрока (To Player - только для NPC)
 * @value 2
 * @default 0
 *
 * @param MaxCharges
 * @text Максимум зарядов
 * @type number
 * @min 1
 * @default 1
 *
 * @param SpeedMultiplier
 * @text Множитель Скорости
 * @type number
 * @decimals 2
 * @default 5.0
 *
 * @param Duration
 * @text Длительность (в кадрах)
 * @type number
 * @default 15
 *
 * @param Decay
 * @text Коэффициент затухания
 * @type number
 * @decimals 1
 * @desc Как быстро рывок теряет скорость (1.5 = плавно).
 * @default 1.5
 *
 * @param Cooldown
 * @text Время восстановления заряда (в кадрах)
 * @type number
 * @default 60
 *
 * @param SE
 * @text Звук Рывка
 * @type file
 * @dir audio/se
 * @default Wind7
 */

(function() {
    'use strict';

    const pluginName = 'SuperDuperMovement_Addon';
    
    const params = PluginManager.parameters(pluginName);
    const debugMode = params['Debug Mode'] === 'true';
    const ALTIMIT_PRECISION = 128;

    // --- КОНФИГУРАЦИЯ БОЕВЫХ РЫВКОВ ---
    const collisionSteps = parseInt(params['Collision Steps'] || 4);
    const activeDashSwitchId = parseInt(params['Dash Active Switch'] || 0);
    const dashDatabase = {};
    let firstDashKey = null;

    // --- КОНФИГУРАЦИЯ ОТСЛЕЖИВАНИЯ И ОГРАНИЧЕНИЙ ---
    const CONF_TRACKER = {
        postDashStun: parseInt(params['Post-Dash Stun'] || 10),
        lockDirection: params['Lock Direction'] === 'true',
        switchId: parseInt(params['Dash Tracking Switch ID'] || 0),
        varId: parseInt(params['Dash Tracking Variable ID'] || 0)
    };

    try {
        const rawData = JSON.parse(params['Dash Database'] || '[]');
        rawData.forEach((json, index) => {
            const item = JSON.parse(json);
            if (item.Name) {
                dashDatabase[item.Name] = {
                    name: item.Name,
                    targetMode: parseInt(item.TargetMode || 0),
                    maxCharges: parseInt(item.MaxCharges || 1),
                    multiplier: Number(item.SpeedMultiplier || 5.0),
                    duration: Number(item.Duration || 15),
                    decay: Number(item.Decay || 1.5),
                    cooldown: Number(item.Cooldown || 60),
                    se: item.SE || ''
                };
                if (index === 0) firstDashKey = item.Name;
            }
        });
    } catch (e) { console.error("SuperDuperMovement_Addon: Ошибка парсинга базы данных рывков.", e); }

    // --- КОНФИГУРАЦИЯ ПОИСКА ПУТИ ---
    const CONF_REPULSION = Number(params['Repulsion Force'] || 2.5);
    const CONF_REFRESH_RATE = Number(params['Path Refresh Rate'] || 30);
    const MAX_ITERATIONS = 2000;
    
    const deadZoneRegionsParam = params['Dead Zone Regions'] || '';
    let deadZoneRegions = [];
    if (deadZoneRegionsParam.trim() !== '') {
        deadZoneRegions = deadZoneRegionsParam.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    }

    // ======================================================================
    // ПОИСК ПУТИ: АЛГОРИТМ A* (PATHFINDING UTILITIES)
    // ======================================================================
    function isDeadZone(x, y, ignoredZones) {
        if (deadZoneRegions.length === 0) return false;
        const regionId = $gameMap.regionId(Math.round(x), Math.round(y));
        if (ignoredZones && ignoredZones.contains(regionId)) return false;
        return deadZoneRegions.contains(regionId);
    }

    function checkLineOfSight(char, startX, startY, endX, endY, ignoredZones) {
        const mapMesh = $gameMap.collisionMesh(char._collisionType);
        const dist = Math.hypot(endX - startX, endY - startY);
        if (dist > 20) return false;
        
        const stepSize = 0.5; 
        const steps = Math.ceil(dist / stepSize);
        const dx = (endX - startX) / steps;
        const dy = (endY - startY) / steps;

        for (let i = 1; i < steps; i++) {
            const cx = startX + dx * i;
            const cy = startY + dy * i;
            if (isDeadZone(cx, cy, ignoredZones)) return false;
            if (!$gameMap.canMoveOn(char, cx, cy, mapMesh)) return false;
        }
        return true;
    }

    const AStar = {
        heuristic: function(x1, y1, x2, y2) { return Math.abs(x1 - x2) + Math.abs(y1 - y2); },
        findPath: function(char, targetX, targetY, ignoredZones) {
            const startX = Math.round(char._realX);
            const startY = Math.round(char._realY);
            const endX = Math.round(targetX);
            const endY = Math.round(targetY);

            if (startX === endX && startY === endY) return [{x: targetX, y: targetY}];

            const openList = [];
            const closedList = {}; 
            openList.push({x: startX, y: startY, parent: null, g: 0, f: 0});
            let iterations = 0;
            const neighbors = [
                {x:0, y:1, c:1}, {x:0, y:-1, c:1}, {x:1, y:0, c:1}, {x:-1, y:0, c:1},
                {x:1, y:1, c:1.4}, {x:1, y:-1, c:1.4}, {x:-1, y:1, c:1.4}, {x:-1, y:-1, c:1.4}
            ];

            while (openList.length > 0) {
                if (iterations++ > MAX_ITERATIONS) return null;
                openList.sort((a, b) => a.f - b.f);
                const current = openList.shift();
                const key = current.x + "," + current.y;

                if (closedList[key]) continue;
                closedList[key] = true;

                if (current.x === endX && current.y === endY) {
                    const path = [];
                    let curr = current;
                    while (curr.parent) {
                        path.push({x: curr.x, y: curr.y});
                        curr = curr.parent;
                    }
                    path.reverse();
                    if (path.length > 0) path[path.length - 1] = {x: targetX, y: targetY};
                    return path;
                }

                for (let i = 0; i < neighbors.length; i++) {
                    const nb = neighbors[i];
                    const nx = current.x + nb.x;
                    const ny = current.y + nb.y;
                    
                    if (!$gameMap.isValid(nx, ny)) continue;
                    if (closedList[nx + "," + ny]) continue;
                    if (isDeadZone(nx, ny, ignoredZones)) continue;

                    let isPassable = $gameMap.checkPassage(current.x, current.y, 0x0f) && $gameMap.checkPassage(nx, ny, 0x0f);
                    if (nb.c > 1 && isPassable) {
                         if (!$gameMap.checkPassage(current.x, ny, 0x0f) || 
                             !$gameMap.checkPassage(nx, current.y, 0x0f) ||
                             isDeadZone(current.x, ny, ignoredZones) || 
                             isDeadZone(nx, current.y, ignoredZones)) {
                             isPassable = false;
                         }
                    }

                    if (isPassable) {
                        const g = current.g + nb.c;
                        const h = this.heuristic(nx, ny, endX, endY);
                        openList.push({x: nx, y: ny, parent: current, g: g, f: g + h});
                    }
                }
            }
            return null;
        }
    };

    // ======================================================================
    // КОМАНДЫ ПЛАГИНА
    // ======================================================================
    const _SDAP_Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _SDAP_Game_Interpreter_pluginCommand.call(this, command, args);

        if (command === 'AltimitDash') {
            const subCommand = args[0];
            const dashName = args[1] || firstDashKey;
            
            if (subCommand === 'dash') {
                const target = this._eventId > 0 ? $gameMap.event(this._eventId) : $gamePlayer;
                if (target) target.tryDash(dashName);
            }
            if (subCommand === 'playerDash') $gamePlayer.tryDash(dashName);
            if (subCommand === 'eventDash') {
                const event = (parseInt(args[1]) === 0) ? $gameMap.event(this._eventId) : $gameMap.event(parseInt(args[1]));
                if (event) event.tryDash(args[2] || firstDashKey);
            }
        }
    };

    // Сброс маршрута ИИ при смене страницы события
    const _SDAP_Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function() {
        if (this._amsSmartTarget) {
            this.smartStop();
        }
        _SDAP_Game_Event_setupPage.call(this);
    };

    // ======================================================================
    // ИНИЦИАЛИЗАЦИЯ ПЕРСОНАЖЕЙ
    // ======================================================================
    const _SDAP_Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        _SDAP_Game_CharacterBase_initMembers.call(this);
        
        this._amsDashActive = false;
        this._amsDashTimer = 0;
        this._amsDashVector = { x: 0, y: 0 };
        this._amsDashSettings = null;
        this._amsDashChargeData = null;

        this._amsSmartPath = null;
        this._amsSmartTarget = null;
        this._amsSmartRefreshTimer = 0;
        this._amsVelocityX = 0;
        this._amsVelocityY = 0;
        
        this._amsSteerTimer = Math.randomInt(4);
        this._amsTargetSteerX = 0;
        this._amsTargetSteerY = 0;

        // Переменные детектора застревания
        this._amsStuckTimer = 0;
        this._amsLastX = undefined;
        this._amsLastY = undefined;
    };

    // ======================================================================
    // ЕДИНЫЙ РАСЧЕТ ДИСТАНЦИИ (СЛИЯНИЕ СИСТЕМ)
    // ======================================================================
    const _SDAP_Game_CharacterBase_distancePerFrame = Game_CharacterBase.prototype.distancePerFrame;
    Game_CharacterBase.prototype.distancePerFrame = function() {
        if (this._amsDashActive) {
            const s = this._amsDashSettings;
            const baseSpeed = 0.0625; 
            const t = this._amsDashTimer / s.duration; 
            let dashDist = baseSpeed * (1.0 + (s.multiplier - 1.0) * Math.pow(t, s.decay));
            return Math.floor(dashDist * ALTIMIT_PRECISION) / ALTIMIT_PRECISION;
        }
        return _SDAP_Game_CharacterBase_distancePerFrame.call(this);
    };

    // ======================================================================
    // ГЛАВНЫЙ ЦИКЛ ОБНОВЛЕНИЯ (UPDATE LOOP)
    // ======================================================================
    const _SDAP_Game_CharacterBase_update = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function() {
        this.updateDashCharges();

        if (this._amsDashActive) {
            this._amsDashTimer--;
            this.updateDashPhysics(); 
            if (this._amsDashTimer <= 0) this.endDash();
            this.updateAnimation();
            return; 
        }

        if (this._amsSmartTarget) {
             this.updateSmartPathLogic();
        }

        _SDAP_Game_CharacterBase_update.call(this);
    };

    const _SDAP_Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _SDAP_Game_Player_update.call(this, sceneActive);
        if (sceneActive) {
            this.updateDashTracking();
        }
    };

    Game_Player.prototype.updateDashTracking = function() {
        if (CONF_TRACKER.switchId <= 0 || CONF_TRACKER.varId <= 0) return;
        if (!$gameSwitches || !$gameVariables) return;

        if (!$gameSwitches.value(CONF_TRACKER.switchId)) {
            if ($gameVariables.value(CONF_TRACKER.varId) !== 0) {
                $gameVariables.setValue(CONF_TRACKER.varId, 0);
                this._track_lastRealX = undefined;
                this._track_lastRealY = undefined;
            }
            return;
        }

        if (this._track_lastRealX === undefined || this._track_lastRealY === undefined) {
            this._track_lastRealX = this._realX || 0;
            this._track_lastRealY = this._realY || 0;
            return;
        }

        const currentValue = $gameVariables.value(CONF_TRACKER.varId);
        const faceDir = this.direction();
        const dx = $gameMap.deltaX(this._realX, this._track_lastRealX);
        const dy = $gameMap.deltaY(this._realY, this._track_lastRealY);
        let moveDir = 0;

        if (dx > 0.001) {
            moveDir = 6;
        } else if (dx < -0.001) {
            moveDir = 4;
        } else {
            if (dy > 0.001 && faceDir === 2) {
                moveDir = 2; 
            } else if (dy < -0.001 && faceDir === 8) {
                moveDir = 8; 
            }
        }

        const newValue = (faceDir * 10) + moveDir;
        this._track_lastRealX = this._realX;
        this._track_lastRealY = this._realY;

        if (currentValue !== newValue) {
            $gameVariables.setValue(CONF_TRACKER.varId, newValue);
        }
    };

    // ======================================================================
    // БОЕВЫЕ РЫВКИ (DASH SKILLS) - ЛОГИКА
    // ======================================================================
    Game_CharacterBase.prototype.updateDashCharges = function() {
        if (!this._amsDashChargeData) return;
        for (const key in this._amsDashChargeData) {
            const data = this._amsDashChargeData[key];
            if (data.current < data.max) {
                data.rechargeTimer++;
                if (data.rechargeTimer >= data.cooldown) {
                    data.current++;
                    data.rechargeTimer = 0;
                }
            }
        }
    };

    Game_CharacterBase.prototype.tryDash = function(key) {
        const settings = dashDatabase[key];
        if (!settings) return;

        if (!this._amsDashChargeData) {
            this._amsDashChargeData = {};
            for (const k in dashDatabase) {
                const c = dashDatabase[k];
                this._amsDashChargeData[k] = { current: c.maxCharges, max: c.maxCharges, rechargeTimer: 0, cooldown: c.cooldown };
            }
        }

        const chargeData = this._amsDashChargeData[key];
        if (this._amsDashActive) return;
        if (chargeData && chargeData.current <= 0) return;

        let vx = 0, vy = 0, canStart = false;

        if (this === $gamePlayer && settings.targetMode === 1) { 
            const dx = TouchInput.x - this.screenX();
            const dy = TouchInput.y - (this.screenY() - 24);
            const mag = Math.sqrt(dx * dx + dy * dy);
            if (mag > 0.1) { vx = dx / mag; vy = dy / mag; } 
            else { const d = this.direction(); if(d==2)vy=1; if(d==8)vy=-1; if(d==4)vx=-1; if(d==6)vx=1; }
            canStart = true;
        } else if (settings.targetMode === 2 && this !== $gamePlayer) { 
            const dx = $gamePlayer._x - this._x;
            const dy = $gamePlayer._y - this._y;
            const mag = Math.sqrt(dx * dx + dy * dy);
            if (mag > 0) { vx = dx/mag; vy = dy/mag; }
            canStart = true;
        } else { 
            if (this === $gamePlayer && Input.dir8 > 0) {
                 const dir = Input.dir8;
                 if ([1,2,3].contains(dir)) vy = 1; if ([7,8,9].contains(dir)) vy = -1;
                 if ([1,4,7].contains(dir)) vx = -1; if ([3,6,9].contains(dir)) vx = 1;
                 const m = Math.sqrt(vx*vx+vy*vy); vx/=m; vy/=m;
                 canStart = true; 
            } else if (this !== $gamePlayer) { 
                 const d = this.direction();
                 if(d==2)vy=1; if(d==8)vy=-1; if(d==4)vx=-1; if(d==6)vx=1;
                 if (this._altimitMovement && this._altimitMovement.velocity) {
                     const avx = this._altimitMovement.velocity.x;
                     const avy = this._altimitMovement.velocity.y;
                     const am = Math.sqrt(avx*avx+avy*avy);
                     if (am > 0.1) { vx = avx/am; vy = avy/am; }
                 }
                 canStart = true;
            }
        }

        if (canStart) {
            if (chargeData) chargeData.current--;
            this.startDash(vx, vy, settings);
        }
    };

    Game_CharacterBase.prototype.startDash = function(vx, vy, settings) {
        this._amsDashSettings = settings;
        this._amsDashActive = true;
        this._amsDashTimer = settings.duration;
        this._amsDashVector = { x: vx, y: vy };
        
        this._amsVelocityX = 0;
        this._amsVelocityY = 0;
        
        this.amsForceStopPhysics();

        if (this === $gamePlayer && activeDashSwitchId > 0) {
            $gameSwitches.setValue(activeDashSwitchId, true);
        }

        if (settings.se && this.screenX() > 0 && this.screenX() < Graphics.width) {
            AudioManager.playSe({ name: settings.se, volume: 80, pitch: 110, pan: 0 });
        }
        if (debugMode) console.log("SuperDuperMovement_Addon: Старт боевого рывка");
    };

    Game_CharacterBase.prototype.updateDashPhysics = function() {
        this.amsForceStopPhysics();

        const s = this._amsDashSettings;
        const currentSpeed = this.distancePerFrame();
        const totalVx = this._amsDashVector.x * currentSpeed;
        const totalVy = this._amsDashVector.y * currentSpeed;

        if (typeof this.moveVector === 'function') {
            const steps = collisionSteps; 
            const subVx = totalVx / steps;
            const subVy = totalVy / steps;

            for (let i = 0; i < steps; i++) {
                const xBefore = this._x;
                const yBefore = this._y;

                this.moveVector(subVx, subVy);

                const distMoved = Math.sqrt(Math.pow(this._x - xBefore, 2) + Math.pow(this._y - yBefore, 2));
                const expectedDist = Math.sqrt(subVx * subVx + subVy * subVy);

                if (expectedDist > 0.0001 && distMoved < expectedDist * 0.2) {
                    if (debugMode) console.log("SuperDuperMovement_Addon: Столкновение со стеной во время рывка");
                    this.endDash();
                    return;
                }
            }
        }
    };

    Game_CharacterBase.prototype.endDash = function() {
        this._amsDashActive = false;
        this._amsDashVector = { x: 0, y: 0 };
        this._amsDashSettings = null;
        this.amsForceStopPhysics();

        if (this === $gamePlayer && activeDashSwitchId > 0) {
            $gameSwitches.setValue(activeDashSwitchId, false);
        }
    };

    Game_CharacterBase.prototype.amsForceStopPhysics = function() {
        if (this._altimitMovement) {
            if (this._altimitMovement.velocity) {
                this._altimitMovement.velocity.x = 0;
                this._altimitMovement.velocity.y = 0;
            }
        }
    };

    // ======================================================================
    // УМНЫЙ ПОИСК ПУТИ (SMART PATHFINDING) - АПИ
    // ======================================================================
    Game_Character.prototype.smartMoveTo = function(x, y) {
        this._amsSmartTarget = { type: 'coord', x: x, y: y };
        this._amsSmartPath = null;
        this._amsSmartRefreshTimer = 0;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartMoveToPlayer = function() {
        this._amsSmartTarget = { type: 'player' };
        this._amsSmartPath = null;
        this._amsSmartRefreshTimer = 0;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartMoveToEvent = function(id) {
        this._amsSmartTarget = { type: 'event', id: id };
        this._amsSmartPath = null;
        this._amsSmartRefreshTimer = 0;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    // --- НОВЫЕ ТАКТИЧЕСКИЕ КОМАНДЫ ПОВЕДЕНИЯ ---
    
    Game_Character.prototype.smartFleeFromPlayer = function(safeDistance) {
        this._amsSmartTarget = { type: 'flee', safeDist: safeDistance || 10 };
        this._amsSmartPath = null;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartBackAway = function(safeDistance) {
        this._amsSmartTarget = { type: 'back_away', safeDist: safeDistance || 5 };
        this._amsSmartPath = null;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartWander = function(radius, waitFrames) {
        this._amsSmartTarget = { 
            type: 'wander', 
            radius: radius || 5, 
            wait: waitFrames || 60, 
            anchorX: Math.round(this._x), 
            anchorY: Math.round(this._y), 
            timer: 0 
        };
        this._amsSmartPath = null;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartPatrol = function(pointsArray) {
        if (!pointsArray || pointsArray.length === 0) return;
        this._amsSmartTarget = { type: 'patrol', points: pointsArray, index: 0 };
        this._amsSmartPath = null;
        this._amsSmartRefreshTimer = 0;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartOrbitPlayer = function(minRadius, maxRadius) {
        const min = minRadius !== undefined ? minRadius : 3.0;
        const max = maxRadius !== undefined ? maxRadius : min + 1.0;
        this._amsSmartTarget = {
            type: 'orbit',
            minRadius: min,
            maxRadius: max,
            targetRadius: min + Math.random() * (max - min), 
            dir: Math.random() > 0.5 ? 1 : -1,
            stuckTimer: 0,
            lastX: this._x,
            lastY: this._y,
            changeTimer: Math.randomInt(60) + 30,
            radiusChangeTimer: Math.randomInt(60) + 60
        };
        this._amsSmartPath = null;
        this._amsStuckTimer = 0;
        this._moveRouteForcing = true;
    };

    Game_Character.prototype.smartStop = function() {
        this._amsSmartTarget = null;
        this._amsSmartPath = null;
        this._moveRouteForcing = false;
        this._amsVelocityX = 0;
        this._amsVelocityY = 0;
        this._amsStuckTimer = 0;
    };

    // ======================================================================
    // ЛОГИКА ИИ УМНОГО ПЕРЕДВИЖЕНИЯ И ТАКТИКИ
    // ======================================================================
    Game_CharacterBase.prototype.updateSmartPathLogic = function() {
        const target = this._amsSmartTarget;
        if (!target) return;

        const speed = this.distancePerFrame();

        // --- ГЛОБАЛЬНЫЙ ДЕТЕКТОР ЗАСТРЕВАНИЯ (ANTI-STUCK) ---
        if (this._amsLastX !== undefined && this._amsLastY !== undefined) {
            const movedDist = Math.hypot(this._x - this._amsLastX, this._y - this._amsLastY);
            const vLen = Math.hypot(this._amsVelocityX, this._amsVelocityY);
            
            // Если пытаемся идти, но реальное смещение крошечное (буксуем в хитбоксе)
            if (vLen > 0.1 && movedDist < speed * 0.3) {
                this._amsStuckTimer = (this._amsStuckTimer || 0) + 1;
            } else {
                this._amsStuckTimer = 0;
            }
        }
        this._amsLastX = this._x;
        this._amsLastY = this._y;

        if (this._amsStuckTimer > 25) { // Застряли примерно на 0.4 секунды
            this._amsStuckTimer = 0;
            if (target.type === 'wander') {
                target.timer = target.wait; // Сдаемся, ждем и выбираем новую точку
                this._amsSmartPath = null;
                this._amsVelocityX = 0; 
                this._amsVelocityY = 0;
                return;
            } else if (target.type === 'patrol') {
                target.index = (target.index + 1) % target.points.length; // Скипаем недостижимую точку
                this._amsSmartPath = null;
                return;
            } else if (target.type === 'coord') {
                this.smartStop(); // Отменяем команду движения
                return;
            } else if (target.type !== 'orbit') {
                // Для преследования и отступления - сбрасываем путь и даем случайный импульс (пинок) в сторону
                this._amsSmartPath = null;
                this._amsSmartRefreshTimer = 0;
                this._amsVelocityX = (Math.random() - 0.5) * 2;
                this._amsVelocityY = (Math.random() - 0.5) * 2;
            }
        }

        const ignoredZones = [];
        const charRegion = $gameMap.regionId(Math.round(this._x), Math.round(this._y));
        if (deadZoneRegions.contains(charRegion)) ignoredZones.push(charRegion);

        // --- FLEE & BACK AWAY ---
        if (target.type === 'flee' || target.type === 'back_away') {
            const px = $gamePlayer._x;
            const py = $gamePlayer._y;
            const dist = Math.hypot(px - this._x, py - this._y);

            if (dist >= target.safeDist) {
                this._amsVelocityX = 0; this._amsVelocityY = 0; return;
            }

            const dx = this._x - px;
            const dy = this._y - py;
            const fleeTx = this._x + dx * 2;
            const fleeTy = this._y + dy * 2;
            
            this.applyContextSteering(fleeTx, fleeTy, ignoredZones, target.type === 'back_away');
            return;
        }

        // --- WANDER (Случайное блуждание для зверей/крыс) ---
        if (target.type === 'wander') {
            if (target.timer > 0) {
                target.timer--;
                this._amsVelocityX = 0; this._amsVelocityY = 0;
                return;
            }
            if (!this._amsSmartPath || this._amsSmartPath.length === 0) {
                const r = target.radius;
                let found = false;
                for(let i=0; i<10; i++) {
                    const nx = target.anchorX + Math.floor(Math.random() * r * 2) - r;
                    const ny = target.anchorY + Math.floor(Math.random() * r * 2) - r;
                    if ($gameMap.isValid(nx, ny) && $gameMap.checkPassage(nx, ny, 0x0f) && !isDeadZone(nx, ny, ignoredZones)) {
                        this._amsSmartPath = AStar.findPath(this, nx, ny, ignoredZones);
                        if (this._amsSmartPath && this._amsSmartPath.length > 0) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) { target.timer = target.wait; return; }
            }
        }

        // --- ORBIT ---
        if (target.type === 'orbit') {
            const px = $gamePlayer._x;
            const py = $gamePlayer._y;

            target.changeTimer--;
            if (target.changeTimer <= 0) {
                target.dir *= -1;
                target.changeTimer = Math.randomInt(60) + 30;
            }

            target.radiusChangeTimer--;
            if (target.radiusChangeTimer <= 0) {
                target.targetRadius = target.minRadius + Math.random() * (target.maxRadius - target.minRadius);
                target.radiusChangeTimer = Math.randomInt(60) + 60;
            }

            const movedDist = Math.hypot(this._x - target.lastX, this._y - target.lastY);
            if (movedDist < speed * 0.4) {
                target.stuckTimer++;
                if (target.stuckTimer > 5) {
                    target.dir *= -1; 
                    target.targetRadius = target.minRadius + Math.random() * (target.maxRadius - target.minRadius);
                    target.stuckTimer = 0;
                    target.changeTimer = Math.randomInt(60) + 30;
                }
            } else {
                target.stuckTimer = 0;
            }
            target.lastX = this._x;
            target.lastY = this._y;

            const currentAngle = Math.atan2(this._y - py, this._x - px);
            const angularAhead = (speed / Math.max(1, target.targetRadius)) * 3.0; 
            const targetAngle = currentAngle + (angularAhead * target.dir);

            const tx = px + Math.cos(targetAngle) * target.targetRadius;
            const ty = py + Math.sin(targetAngle) * target.targetRadius;

            this.applyContextSteering(tx, ty, ignoredZones, false);
            return;
        }

        // --- PLAYER, EVENT, COORD, PATROL, WANDER ---
        let tx, ty;
        if (target.type === 'player') { tx = $gamePlayer._x; ty = $gamePlayer._y; }
        else if (target.type === 'event') { 
            const ev = $gameMap.event(target.id);
            if (!ev) { this.smartStop(); return; }
            tx = ev._x; ty = ev._y;
        } else if (target.type === 'coord') { tx = target.x; ty = target.y; }
        else if (target.type === 'patrol') {
            const pt = target.points[target.index];
            tx = pt[0]; ty = pt[1];
        } else if (target.type === 'wander' && this._amsSmartPath && this._amsSmartPath.length > 0) {
            tx = this._amsSmartPath[this._amsSmartPath.length - 1].x;
            ty = this._amsSmartPath[this._amsSmartPath.length - 1].y;
        }

        if (tx !== undefined && ty !== undefined) {
            const targetRegion = $gameMap.regionId(Math.round(tx), Math.round(ty));
            if (deadZoneRegions.contains(targetRegion) && !ignoredZones.contains(targetRegion)) {
                ignoredZones.push(targetRegion);
            }

            const distToGoal = Math.hypot(tx - this._x, ty - this._y);
            
            if (distToGoal < Math.max(0.5, speed * 1.5)) { 
                if (target.type === 'patrol') {
                    target.index = (target.index + 1) % target.points.length;
                    this._amsSmartPath = null;
                } else if (target.type === 'wander') {
                    target.timer = target.wait;
                    this._amsSmartPath = null;
                } else {
                    this.smartStop(); 
                }
                return; 
            }

            if (this._amsSmartRefreshTimer > 0) this._amsSmartRefreshTimer--;
            
            if (target.type !== 'wander' && (!this._amsSmartPath || this._amsSmartPath.length === 0 || this._amsSmartRefreshTimer <= 0)) {
                if (checkLineOfSight(this, this._x, this._y, tx, ty, ignoredZones)) {
                    this._amsSmartPath = [{x: tx, y: ty}];
                    this._amsSmartRefreshTimer = 20;
                } else {
                    this._amsSmartPath = AStar.findPath(this, tx, ty, ignoredZones);
                    this._amsSmartRefreshTimer = CONF_REFRESH_RATE + Math.randomInt(10);
                }
            }
        }

        if (!this._amsSmartPath || this._amsSmartPath.length === 0) return;

        let targetNode = this._amsSmartPath[0];
        const lookAhead = Math.min(this._amsSmartPath.length, 5);
        for (let i = lookAhead - 1; i > 0; i--) {
            const node = this._amsSmartPath[i];
            if (checkLineOfSight(this, this._x, this._y, node.x, node.y, ignoredZones)) {
                this._amsSmartPath.splice(0, i); 
                targetNode = this._amsSmartPath[0];
                break;
            }
        }

        const distToNode = Math.hypot(targetNode.x - this._x, targetNode.y - this._y);
        if (distToNode < Math.max(0.5, speed * 2.0)) {
            this._amsSmartPath.shift();
            if (this._amsSmartPath.length === 0) {
                if (target.type === 'wander') target.timer = target.wait;
                return;
            }
            targetNode = this._amsSmartPath[0];
        }

        this.applyContextSteering(targetNode.x, targetNode.y, ignoredZones, false);
    };

    // ======================================================================
    // CONTEXT STEERING BEHAVIOR (Плавный обход препятствий)
    // ======================================================================
    Game_CharacterBase.prototype.applyContextSteering = function(targetX, targetY, ignoredZones, forceFacePlayer) {
        const dx = targetX - this._x;
        const dy = targetY - this._y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 0.001) return;

        const desireX = dx / dist;
        const desireY = dy / dist;

        if (this._amsSteerTimer === undefined) this._amsSteerTimer = Math.randomInt(4);
        
        this._amsSteerTimer--;
        
        if (this._amsSteerTimer <= 0) {
            this._amsSteerTimer = 4; 

            const sensorCount = 8;
            let bestDirX = 0, bestDirY = 0;
            const mapMesh = $gameMap.collisionMesh(this._collisionType);

            for (let i = 0; i < sensorCount; i++) {
                const angle = (i / sensorCount) * Math.PI * 2;
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);
                let interest = Math.max(0, (dirX * desireX) + (dirY * desireY));

                let steps = 2, safety = 1.0; 
                for (let s = 1; s <= steps; s++) {
                    const cx = this._x + (dirX * 0.7) * (s/steps);
                    const cy = this._y + (dirY * 0.7) * (s/steps);
                    if (isDeadZone(cx, cy, ignoredZones) || !$gameMap.canMoveOn(this, cx, cy, mapMesh)) { 
                        safety = (s-1)/steps; 
                        break; 
                    }
                }

                if (safety < 1.0) interest -= (1.0 - safety) * CONF_REPULSION;
                const weight = Math.max(0, interest);
                bestDirX += dirX * weight;
                bestDirY += dirY * weight;
            }

            const finalLen = Math.hypot(bestDirX, bestDirY);
            if (finalLen > 0.01) {
                this._amsTargetSteerX = bestDirX / finalLen;
                this._amsTargetSteerY = bestDirY / finalLen;
            } else {
                this._amsTargetSteerX = desireX;
                this._amsTargetSteerY = desireY;
            }
        }

        const steerForce = 0.2;
        const targetSteerX = this._amsTargetSteerX !== undefined ? this._amsTargetSteerX : desireX;
        const targetSteerY = this._amsTargetSteerY !== undefined ? this._amsTargetSteerY : desireY;
        
        this._amsVelocityX = this._amsVelocityX * (1 - steerForce) + targetSteerX * steerForce;
        this._amsVelocityY = this._amsVelocityY * (1 - steerForce) + targetSteerY * steerForce;

        const vLen = Math.hypot(this._amsVelocityX, this._amsVelocityY);
        const speed = this.distancePerFrame();
        
        if (vLen > 0) {
            const vx = (this._amsVelocityX / vLen) * speed;
            const vy = (this._amsVelocityY / vLen) * speed;
            
            this.moveVector(vx, vy);
            
            if (forceFacePlayer) {
                const pdx = $gamePlayer._x - this._x;
                const pdy = $gamePlayer._y - this._y;
                if (Math.abs(pdx) > Math.abs(pdy)) this.setDirection(pdx > 0 ? 6 : 4);
                else this.setDirection(pdy > 0 ? 2 : 8);
            } else if (vLen > 0.1 && !this.isDirectionFixed()) {
                if (Math.abs(this._amsVelocityX) > Math.abs(this._amsVelocityY)) this.setDirection(this._amsVelocityX > 0 ? 6 : 4);
                else this.setDirection(this._amsVelocityY > 0 ? 2 : 8);
            }
            this._isMoving = true;
        }
    };

    Game_CharacterBase.prototype.sdDisableGridSnap = function(enable) {
        if (enable) {
            Object.defineProperty(this, '_moveAlignGrid', { get: function() { return false; }, configurable: true });
        } else {
            delete this._moveAlignGrid;
        }
    };

    // --- БЛОКИРОВКИ ПОВОРОТА И ДВИЖЕНИЯ ---
    const _SDAP_Game_CharacterBase_setDirection = Game_CharacterBase.prototype.setDirection;
    Game_CharacterBase.prototype.setDirection = function(d) {
        if (CONF_TRACKER.lockDirection && this._amsDashActive) return; // Запрет поворота в рывке
        _SDAP_Game_CharacterBase_setDirection.call(this, d);
    };

    const _SDAP_Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (this._amsDashActive) return false; // Блокировка движения только в самом полете
        return _SDAP_Game_Player_canMove.call(this);
    };

})();