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
  * @param Hitbox Avoidance
  * @text Учитывать хитбоксы объектов
  * @parent --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
  * @type boolean
  * @desc A* учитывает реальные коллайдеры объектов (события/игрок/фолловеры) и формы collision mesh карты, а не только флаги тайлов.
  * @default true
  *
  * @param Soft Cost Value
  * @text Цена движущихся объектов
  * @parent --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
  * @type number
  * @min 0
  * @desc Штраф на клетки под движущимися объектами (игрок/ИИ): путь обходит их, если обход дешевле. 0 = игнорировать.
  * @default 3
  *
  * @param Goal Exempt Radius
  * @text Радиус освобождения цели
  * @parent --- НАСТРОЙКИ УМНОГО ПОИСКА ПУТИ (A*) ---
  * @type number
  * @min 0
  * @desc Препятствия ближе этого радиуса (в клетках) от цели погони не блокируют путь — иначе цель в толпе недостижима.
  * @default 2
  *
   * @param Debug Mode
  * @text Режим отладки
  * @type boolean
  * @desc Включить логирование в консоль (F8).
  * @default false
  *
  * @param --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @default
  *
  * @param Cross-Map Pursuit
  * @text Сквозная погоня
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type boolean
  * @desc Враги продолжают преследование после ухода героя с карты: читают двери (ивенты с переходом) и идут за ним.
  * @default true
  *
  * @param Pursuit Limit
  * @text Лимит преследователей
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type number
  * @min 1
  * @desc Максимум врагов, одновременно идущих за героем между картами.
  * @default 4
  *
  * @param Transit Frames
  * @text Кадры на переход
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type number
  * @min 0
  * @desc Сколько кадров враг «идёт через дверь» между картами (плюс время пути до двери).
  * @default 90
  *
  * @param Interest Timeout
  * @text Интерес погони (сек)
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type number
  * @min 10
  * @desc Сколько секунд враг держит интерес без сближения, после чего сдаётся.
  * @default 120
  *
   * @param Door Search Radius
  * @text Радиус поиска двери
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type number
  * @min 1
  * @desc Радиус (клетки) поиска двери, которой воспользовался герой.
  * @default 3
  *
  * @param Door SE
  * @text Звук двери
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type string
  * @desc SE при входе/выходе врага через дверь (audio/se, пусто = без звука).
  * @default Door1
  *
  * @param Door SE Volume
  * @text Громкость двери
  * @parent --- СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
  * @type number
  * @min 0
  * @max 100
  * @desc Громкость SE двери.
  * @default 90
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
    // P18: дебаг-режим включается параметром ИЛИ env RPGREACTOR_DEBUG=1
    // (кнопка 🐞 в редакторе запускает игру с этим env — маршруты видны
    // без правки конфига проекта).
    let debugMode = params['Debug Mode'] === 'true';
    try {
        if (!debugMode && typeof process !== 'undefined' && process.env
            && process.env.RPGREACTOR_DEBUG === '1') debugMode = true;
    } catch (e) { /* не NW — только параметр */ }
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
    // P1: точный A* — хитбоксы объектов и формы collision mesh
    const CONF_HITBOX = params['Hitbox Avoidance'] !== 'false';
    const CONF_SOFT_COST = Number(params['Soft Cost Value'] || 3);
    const CONF_GOAL_EXEMPT = Number(params['Goal Exempt Radius'] || 2);
    
    const deadZoneRegionsParam = params['Dead Zone Regions'] || '';
    let deadZoneRegions = [];
    if (deadZoneRegionsParam.trim() !== '') {
        deadZoneRegions = deadZoneRegionsParam.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    }

    // --- P23: СКВОЗНАЯ ПОГОНЯ (ЧЕРЕЗ КАРТЫ) ---
    const CONF_XMAP = params['Cross-Map Pursuit'] !== 'false';
    const XMAP_LIMIT = Math.max(1, Number(params['Pursuit Limit'] || 4));
    const XMAP_TRANSIT = Math.max(0, Number(params['Transit Frames'] || 90));
    const XMAP_INTEREST = Math.max(10, Number(params['Interest Timeout'] || 120)) * 60;
    const XMAP_DOOR_RADIUS = Math.max(1, Number(params['Door Search Radius'] || 3));
    // P28: дверь при межкарточном транзите — SE + покадровая анимация чарсета
    const XMAP_DOOR_SE = String(params['Door SE'] || 'Door1');
    const XMAP_DOOR_VOL = Math.max(0, Math.min(100, Number(params['Door SE Volume'] || 90)));

    // ======================================================================
    // ПОИСК ПУТИ: АЛГОРИТМ A* (PATHFINDING UTILITIES)
    // P1: точная проходимость (тайл-флаги + collision mesh карты +
    // реальные хитбоксы объектов с Минковски-инфляцией), octile-эвристика
    // (admissible => гарантия кратчайшего пути), бинарная куча,
    // best-effort при недостижимой цели.
    // ======================================================================
    function isDeadZone(x, y, ignoredZones) {
        if (deadZoneRegions.length === 0) return false;
        const regionId = $gameMap.regionId(Math.round(x), Math.round(y));
        if (ignoredZones && ignoredZones.contains(regionId)) return false;
        return deadZoneRegions.contains(regionId);
    }

    function checkLineOfSight(char, startX, startY, endX, endY, ignoredZones, hardObstacles, box) {
        const mapMesh = $gameMap.collisionMesh(char._collisionType);
        const dist = Math.hypot(endX - startX, endY - startY);
        if (dist > 20) return false;

        // P16: шаг 0.25 — 0.5 перепрыгивала узкие коллайдеры мебели на
        // диагоналях (сплайн вейпоинтов чиркал угол, физика блокировала).
        const stepSize = 0.25;
        const steps = Math.ceil(dist / stepSize);
        const dx = (endX - startX) / steps;
        const dy = (endY - startY) / steps;

        // P21: canMoveOn НЕ ВИДИТ коллайдеры событий впереди (проверяет их
        // в ТЕКУЩЕЙ позиции персонажа, SuperDuperMovement.js:2441) — стул-ивент
        // на прямой был невидим для LOS, и прямая ветка погони вечно
        // долбилась в мебель, не доходя до A*. Слой-3: инфляционные AABB
        // из buildPathContext (та же формула, что cellPenalty).
        const obs = (hardObstacles && hardObstacles.length > 0) ? hardObstacles : null;

        for (let i = 1; i < steps; i++) {
            const cx = startX + dx * i;
            const cy = startY + dy * i;
            if (isDeadZone(cx, cy, ignoredZones)) return false;
            if (!$gameMap.canMoveOn(char, cx, cy, mapMesh)) return false;
            if (obs) {
                for (let j = 0; j < obs.length; j++) {
                    const ob = obs[j];
                    if (!ob.hard) continue;
                    // P22: центр-в-интервале (см. cellPenalty)
                    if (cx > ob.x1 && cx < ob.x2 && cy > ob.y1 && cy < ob.y2) return false;
                }
            }
        }
        return true;
    }

    // P21: точка (центр ищущего) против жёстких инфляционных AABB — для
    // сенсоров steering: canMoveOn слеп к событиям впереди (см. выше).
    // P22: центр-в-интервале (см. cellPenalty).
    function hardPointBlocked(ctx, cx, cy) {
        if (!ctx || !ctx.obstacles) return false;
        const obs = ctx.obstacles;
        for (let j = 0; j < obs.length; j++) {
            const ob = obs[j];
            if (!ob.hard) continue;
            if (cx > ob.x1 && cx < ob.x2 && cy > ob.y1 && cy < ob.y2) return true;
        }
        return false;
    }

    // --- Octile-эвристика: admissible для 8 направлений со стоимостями {1, √2}
    function octile(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return dx > dy ? dx + (Math.SQRT2 - 1) * dy : dy + (Math.SQRT2 - 1) * dx;
    }

    // --- Бинарная куча: O(log n) push/pop, тай-брейк по большему g (ровнее путь)
    class MinHeap {
        constructor() { this._a = []; }
        get size() { return this._a.length; }
        _less(x, y) { return x.f < y.f || (x.f === y.f && x.g > y.g); }
        push(node) {
            const a = this._a;
            a.push(node);
            let i = a.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (this._less(a[i], a[p])) { const t = a[i]; a[i] = a[p]; a[p] = t; i = p; }
                else break;
            }
        }
        pop() {
            const a = this._a;
            if (a.length === 0) return null;
            const top = a[0];
            const last = a.pop();
            if (a.length > 0) {
                a[0] = last;
                let i = 0;
                for (;;) {
                    const l = 2 * i + 1, r = l + 1;
                    let m = i;
                    if (l < a.length && this._less(a[l], a[m])) m = l;
                    if (r < a.length && this._less(a[r], a[m])) m = r;
                    if (m === i) break;
                    const t = a[i]; a[i] = a[m]; a[m] = t;
                    i = m;
                }
            }
            return top;
        }
    }

    const NEIGHBORS = [
        {x: 0, y: 1, c: 1}, {x: 0, y: -1, c: 1}, {x: 1, y: 0, c: 1}, {x: -1, y: 0, c: 1},
        {x: 1, y: 1, c: Math.SQRT2}, {x: 1, y: -1, c: Math.SQRT2},
        {x: -1, y: 1, c: Math.SQRT2}, {x: -1, y: -1, c: Math.SQRT2}
    ];

    // --- Классификация: движущееся препятствие (мягкая цена) или статичное (жёсткий блок)
    function isDynamicMover(char) {
        if (typeof Game_Player !== 'undefined' && char instanceof Game_Player) return true;
        if (typeof Game_Follower !== 'undefined' && char instanceof Game_Follower) return true;
        if (char._amsSmartTarget) return true;                               // наш умный ИИ
        if (char._moveRouteForcing) return true;                             // принудительный маршрут
        if (typeof char._moveType === 'number' && char._moveType > 0) return true; // random/approach/custom
        return false;
    }

    function colliderApi() {
        if (typeof Collider !== 'undefined') return Collider;
        if (typeof window !== 'undefined' && window.Collider) return window.Collider;
        return null;
    }

    // P20: реальные хитбоксы персонажей карты (сырые AABB, без инфляции) —
    // для дебаг-оверлея. P22: предикат зеркалит buildPathContext — рисуем
    // только навигационно значимые тела (динамика; статик физический или
    // с явным кастомным коллайдером), а не sharedTile-фоллбек всего подряд.
    function collectHitboxes() {
        const chars = (typeof $gameMap !== 'undefined' && $gameMap && $gameMap.characters) ? $gameMap.characters() : [];
        const boxes = [];
        for (let i = 0; i < chars.length; i++) {
            const c = chars[i];
            if (!c || !c.collider) continue;
            let ab = null;
            try { const col = c.collider(); ab = col ? col.aabbox : null; } catch (e) { ab = null; }
            if (!ab) continue;
            const dynamic = isDynamicMover(c);
            const phys = c.isNormalPriority ? c.isNormalPriority() : true;
            if (!dynamic && !phys && !hasCustomCollider(c)) continue;
            const x1 = c._x + ab.left, y1 = c._y + ab.top;
            const x2 = c._x + ab.right, y2 = c._y + ab.bottom;
            if (!(x2 > x1) || !(y2 > y1)) continue;
            boxes.push({ hard: !dynamic, x1: x1, y1: y1, x2: x2, y2: y2 });
        }
        return boxes;
    }

    // P20: сегментная проверка против ЖЁСТКИХ инфляционных AABB контекста
    // (та же формула, что cellPenalty). Возвращает true + клетки пересечения —
    // findPath использует это для инварианта «путь не пересекает твёрдое».
    function hardSegmentBlocked(ctx, ax, ay, bx, by, outCells) {
        const obs = ctx.obstacles;
        if (!obs) return false;
        let anyHard = false;
        for (let i = 0; i < obs.length; i++) if (obs[i].hard) { anyHard = true; break; }
        if (!anyHard) return false;
        const dist = Math.hypot(bx - ax, by - ay);
        if (dist < 0.001) return false;
        const steps = Math.ceil(dist / 0.25);
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const cx = ax + (bx - ax) * t;
            const cy = ay + (by - ay) * t;
            for (let j = 0; j < obs.length; j++) {
                const ob = obs[j];
                if (!ob.hard) continue;
                // P22: центр-в-интервале (см. cellPenalty)
                if (cx > ob.x1 && cx < ob.x2 && cy > ob.y1 && cy < ob.y2) {
                    if (outCells) outCells.push(Math.round(cx) + ',' + Math.round(cy));
                    return true;
                }
            }
        }
        return false;
    }

    // P22: ЯВНОЕ тело события — кастомный коллайдер страницы (<collider>).
    // Такие статики — навигационная стена даже при приоритете «ниже игрока»
    // (физика их не толкает, но сквозь стул враг визуально проходить не
    // должен). События БЕЗ кастомного коллайдера получают sharedTile-фоллбек
    // — их видит обычный collidableWith.
    function hasCustomCollider(entry) {
        try {
            if (typeof Game_Event !== 'undefined' && entry instanceof Game_Event && entry.page) {
                const pg = entry.page();
                return !!(pg && pg._collider);
            }
        } catch (e) {}
        return false;
    }

    /**
     * Контекст одного поиска: кэш проходимости + препятствия из реальных
     * коллайдеров. AABB препятствия раздувается на AABB ищущего (Минковски):
     * центр ищущего коллизит с препятствием ⇔ center ∈ (x1,x2)×(y1,y2).
     */
    function buildPathContext(char, goalEntity, ignoredZones) {
        const seekerCollider = (char.collider && char.collider()) || null;
        const ab = seekerCollider ? seekerCollider.aabbox : null;
        const ctx = {
            char: char,
            ignoredZones: ignoredZones || [],
            mesh: null,
            cache: {},
            obstacles: [],
            sl: ab ? ab.left : 0.3, st: ab ? ab.top : 0.3,
            sr: ab ? ab.right : 0.7, sb: ab ? ab.bottom : 0.7,
            seekerCollider: seekerCollider
        };
        if (!CONF_HITBOX) return ctx;

        if (typeof $gameMap !== 'undefined' && $gameMap && $gameMap.collisionMesh) {
            try { ctx.mesh = $gameMap.collisionMesh(char._collisionType); } catch (e) { ctx.mesh = null; }
        }

        const characters = (typeof $gameMap !== 'undefined' && $gameMap && $gameMap.characters) ? $gameMap.characters() : [];
        const gx = goalEntity ? goalEntity._x : undefined;
        const gy = goalEntity ? goalEntity._y : undefined;
        for (let i = 0; i < characters.length; i++) {
            const entry = characters[i];
            if (!entry || entry === char) continue;
            const hard = !isDynamicMover(entry);
            // P22: статик с явным телом — стена даже без физической коллизии
            const physical = !(char.collidableWith && !char.collidableWith(entry));
            if (!physical && !(hard && hasCustomCollider(entry))) continue;
            if (entry === goalEntity) continue; // цель погони — не препятствие для своего преследователя
            // Освобождение цели (P16): радиус снимает ТОЛЬКО мягкую толпу
            // (другие ИИ, фолловеры) — мебель у игрока остаётся стеной,
            // иначе путь строится сквозь стул и враг буксует рядом.
            if (goalEntity && !hard && Math.hypot(entry._x - gx, entry._y - gy) <= CONF_GOAL_EXEMPT + 0.5) continue;
            const eCol = (entry.collider && entry.collider()) || null;
            const eAb = eCol ? eCol.aabbox : null;
            if (!eAb) continue;
            ctx.obstacles.push({
                hard: hard,
                x1: entry._x + eAb.left - ctx.sr,
                x2: entry._x + eAb.right - ctx.sl,
                y1: entry._y + eAb.top - ctx.sb,
                y2: entry._y + eAb.bottom - ctx.st
            });
        }
        // P16: одноразовый блэклист клетки-блокировщика после застревания
        // (взводится anti-stuck в updateSmartPathLogic, потребляется findPath)
        if (char._amsStuckBlacklist) {
            const bl = char._amsStuckBlacklist;
            ctx.obstacles.push({ hard: true, x1: bl.x - 0.5, x2: bl.x + 0.5, y1: bl.y - 0.5, y2: bl.y + 0.5 });
        }
        return ctx;
    }

    /**
     * Штраф входа в клетку: Infinity = непроходима, число = доп. цена.
     * Лениво, с мемоизацией на один поиск: тайл-флаги -> collision mesh
     * (точные формы: коллайдер ищущего в точке клетки) -> хитбоксы объектов.
     */
    function cellPenalty(ctx, x, y) {
        const key = x + ',' + y;
        if (ctx.cache[key] !== undefined) return ctx.cache[key];
        let penalty = 0;
        if (isDeadZone(x, y, ctx.ignoredZones)) {
            penalty = Infinity;
        } else if (ctx.extraBlocks && ctx.extraBlocks.has(key)) {
            // P20: жёсткий блок клеток пересечения — пересбор пути в обход
            penalty = Infinity;
        } else if (!$gameMap.checkPassage(x, y, 0x0f)) {
            penalty = Infinity;
        } else {
            const Col = colliderApi();
            if (ctx.mesh && Col && ctx.seekerCollider) {
                const polys = Col.polygonsWithinColliderList(x, y, ctx.seekerCollider.aabbox, 0, 0, ctx.mesh);
                for (let i = 0; i < polys.length; i++) {
                    if (Col.intersect(x, y, ctx.seekerCollider, 0, 0, polys[i])) { penalty = Infinity; break; }
                }
            }
            if (penalty !== Infinity) {
                for (let i = 0; i < ctx.obstacles.length; i++) {
                    const ob = ctx.obstacles[i];
                    // P22: интервал уже Минковски-раздут под ЦЕНТР ищущего —
                    // проверка «центр ∈ (x1,x2)×(y1,y2)». Прежняя бокс-против-
                    // бокса проверка сдвигала блок на полклетки влево-вверх:
                    // маленькие/высокие коллайдеры не блокировали свою клетку,
                    // вместо неё блокировалась клетка сверху.
                    if (x > ob.x1 && x < ob.x2 && y > ob.y1 && y < ob.y2) {
                        if (ob.hard) { penalty = Infinity; break; }
                        penalty += CONF_SOFT_COST;
                    }
                }
            }
        }
        ctx.cache[key] = penalty;
        return penalty;
    }

    const AStar = {
        heuristic: octile,
        findPath: function(char, targetX, targetY, ignoredZones, goalEntity, extraBlocks) {
            const startX = Math.round(char._realX !== undefined ? char._realX : char._x);
            const startY = Math.round(char._realY !== undefined ? char._realY : char._y);
            const endX = Math.round(targetX);
            const endY = Math.round(targetY);

            if (startX === endX && startY === endY) {
                char._amsStuckBlacklist = null; // одноразовый — цель достигнута
                return [{x: targetX, y: targetY}];
            }

            const ctx = buildPathContext(char, goalEntity, ignoredZones);
            // P20: жёсткий блэклист клеток от сегментной валидации (пересбор)
            if (extraBlocks) ctx.extraBlocks = extraBlocks;
            // P16: блэклист уже в ctx (buildPathContext) — путь обязан обойти
            const open = new MinHeap();
            const closed = {};
            const bestG = {};
            let iterations = 0;
            const startH = octile(startX, startY, endX, endY);
            const startNode = {x: startX, y: startY, parent: null, g: 0, f: startH};
            bestG[startX + ',' + startY] = 0;
            open.push(startNode);
            let bestNode = startNode;   // best-effort: узел с минимальной эвристикой
            let reached = false;

            while (open.size > 0) {
                if (iterations++ > MAX_ITERATIONS) break;
                const current = open.pop();
                const ckey = current.x + ',' + current.y;
                if (closed[ckey]) continue;
                closed[ckey] = true;

                if (octile(current.x, current.y, endX, endY) < octile(bestNode.x, bestNode.y, endX, endY)) {
                    bestNode = current;
                }

                if (current.x === endX && current.y === endY) { bestNode = current; reached = true; break; }

                for (let i = 0; i < NEIGHBORS.length; i++) {
                    const nb = NEIGHBORS[i];
                    const nx = current.x + nb.x;
                    const ny = current.y + nb.y;

                    if (!$gameMap.isValid(nx, ny)) continue;
                    const nkey = nx + ',' + ny;
                    if (closed[nkey]) continue;

                    const enter = cellPenalty(ctx, nx, ny);
                    if (enter === Infinity) continue;
                    if (nb.c > 1) {
                        // диагональ без срезания углов: обе ортогональные клетки проходимы
                        if (cellPenalty(ctx, current.x, ny) === Infinity) continue;
                        if (cellPenalty(ctx, nx, current.y) === Infinity) continue;
                    }

                    const ng = current.g + nb.c + enter;
                    if (bestG[nkey] !== undefined && bestG[nkey] <= ng) continue;
                    bestG[nkey] = ng;
                    open.push({x: nx, y: ny, parent: current, g: ng, f: ng + octile(nx, ny, endX, endY)});
                }
            }

            // Best-effort: недостижимая цель -> путь к ближайшей достигнутой точке
            if (!bestNode) { char._amsStuckBlacklist = null; return null; }
            if (bestNode.x === startX && bestNode.y === startY && !reached) {
                char._amsStuckBlacklist = null; // не сдвинулись ни на шаг
                return null;
            }

            const path = [];
            let curr = bestNode;
            while (curr) { path.push({x: curr.x, y: curr.y}); curr = curr.parent; }
            path.reverse();
            path.shift(); // стартовая клетка не нужна
            if (reached && path.length > 0) path[path.length - 1] = {x: targetX, y: targetY};

            // P20: ИНВАРИАНТ — путь не пересекает жёсткие хитбоксы. Клеточный
            // A* не срезает углы, но тонкий AABB может «прошить» диагональ
            // между центрами свободных клеток, а финальная дробная точка —
            // чиркнуть инфляционную зону у мебели. Пересечение → жёсткий блок
            // клеток пересечения + ОДИН пересбор (дальше — best-effort,
            // anti-stuck догонит остатки физикой).
            if (CONF_HITBOX && path.length > 0 && ctx.obstacles.length > 0) {
                const crossed = [];
                let px = startX, py = startY, blocked = false;
                for (let i = 0; i < path.length; i++) {
                    if (hardSegmentBlocked(ctx, px, py, path[i].x, path[i].y, crossed)) { blocked = true; break; }
                    px = path[i].x; py = path[i].y;
                }
                if (blocked && crossed.length > 0 && !extraBlocks) {
                    return this.findPath(char, targetX, targetY, ignoredZones, goalEntity, new Set(crossed));
                }
            }
            char._amsStuckBlacklist = null; // блэклист одноразовый — потреблён
            // P16: контекст поиска живёт с путём — порог прибытия консультирует
            // жёсткие препятствия у вейпоинта (см. updateSmartPathLogic)
            char._amsPathCtx = ctx;
            return path.length > 0 ? path : [{x: targetX, y: targetY}];
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
        // P37: отбрасывание — физический толчок от игрока (работает и в стане)
        if (this._sdeKnockback && this._sdeKnockback.frames > 0) {
            this._sdeKnockback.frames--;
            this.moveVector(this._sdeKnockback.vx, this._sdeKnockback.vy);
            _SDAP_Game_CharacterBase_update.call(this);
            return;
        }

        // P37: стан — враг замирает (нет движения, нет ИИ)
        if (this._sdeStunTimer > 0) {
            this._sdeStunTimer--;
            this._amsVelocityX = 0;
            this._amsVelocityY = 0;
            _SDAP_Game_CharacterBase_update.call(this);
            return;
        }

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
                // P16: умный выход из застревания — немедленный re-plan,
                // блэклист буксующей клетки (жёсткая в следующем поиске)
                // и пинок ПЕРПЕНДИКУЛЯРНО желаемому направлению (скольжение
                // вдоль препятствия) вместо чистого рандома.
                this._amsSmartPath = null;
                this._amsSmartRefreshTimer = 0;
                this._amsStuckBlacklist = {
                    x: Math.round(this._x + (this._amsVelocityX || 0) * 2),
                    y: Math.round(this._y + (this._amsVelocityY || 0) * 2)
                };
                const vLen2 = Math.hypot(this._amsVelocityX, this._amsVelocityY);
                if (vLen2 > 0.05) {
                    const nx = -this._amsVelocityY / vLen2;
                    const ny = this._amsVelocityX / vLen2;
                    const side = (Math.random() < 0.5) ? 1 : -1;
                    this._amsVelocityX = nx * side;
                    this._amsVelocityY = ny * side;
                } else {
                    this._amsVelocityX = (Math.random() - 0.5) * 2;
                    this._amsVelocityY = (Math.random() - 0.5) * 2;
                }
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
        // P23-урок: в MV симулируется ТОЛЬКО карта игрока ($gameMap всегда
        // его; _mapId у Game_Player нет). «Враг на карте без игрока» не
        // существует: при переносе хук performTransfer собирает всех
        // преследователей в призраки, материализация — тиком.
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
                const goalEntity = target.type === 'player' ? $gamePlayer
                    : (target.type === 'event' && $gameMap.event(target.id)) ? $gameMap.event(target.id)
                    : null;
                // P21: прямая ветка обязана видеть стул-ивент на линии —
                // иначе погоня вечно долбится в мебель мимо A*. Контекст
                // строится и здесь (раз в ~20 кадров, дёшево).
                const losCtx = CONF_HITBOX ? buildPathContext(this, goalEntity, ignoredZones) : null;
                if (checkLineOfSight(this, this._x, this._y, tx, ty, ignoredZones,
                    losCtx ? losCtx.obstacles : null, losCtx)) {
                    this._amsSmartPath = [{x: tx, y: ty}];
                    this._amsPathCtx = null; // прямой путь — контекст поиска неактуален
                    this._amsSmartRefreshTimer = 20;
                } else {
                    this._amsSmartPath = AStar.findPath(this, tx, ty, ignoredZones, goalEntity);
                    this._amsSmartRefreshTimer = CONF_REFRESH_RATE + Math.randomInt(10);
                }
            }
        }

        this.followSmartPath(target, ignoredZones, speed);
    };

    // P23: следование по уже построенному _amsSmartPath (срезка look-ahead,
    // порог прибытия у мебели, steering). Общая для обычной погони и
    // сквозной (враг идёт к двери тем же механизмом).
    Game_CharacterBase.prototype.followSmartPath = function(target, ignoredZones, speed) {
        if (!this._amsSmartPath || this._amsSmartPath.length === 0) return;

        let targetNode = this._amsSmartPath[0];
        const lookAhead = Math.min(this._amsSmartPath.length, 5);
        // P21: срезка видит твёрдые хитбоксы из контекста поиска (мебель) —
        // иначе она выпрямляла A*-обход обратно в прямую через стул.
        // У прямого пути длина 1 — цикл не исполняется, ctx не нужен.
        const spliceCtx = (CONF_HITBOX && this._amsPathCtx) ? this._amsPathCtx : null;
        for (let i = lookAhead - 1; i > 0; i--) {
            const node = this._amsSmartPath[i];
            if (checkLineOfSight(this, this._x, this._y, node.x, node.y, ignoredZones,
                spliceCtx ? spliceCtx.obstacles : null, spliceCtx)) {
                this._amsSmartPath.splice(0, i);
                targetNode = this._amsSmartPath[0];
                break;
            }
        }

        const distToNode = Math.hypot(targetNode.x - this._x, targetNode.y - this._y);
        // P16: у клетки, соседней с жёстким препятствием (мебель), порог
        // прибытия жёстче — полклетки «досчитано» оставляло врага внутри
        // инфляционной зоны, физика блокировала, он буксовал у стула.
        let arrival = Math.max(0.5, speed * 2.0);
        if (CONF_HITBOX && this._amsNearHard === undefined) this._amsNearHard = false;
        if (CONF_HITBOX && this._amsPathCtx && this._amsPathCtx.obstacles) {
            const obs = this._amsPathCtx.obstacles;
            let near = false;
            for (let oi = 0; oi < obs.length; oi++) {
                const ob = obs[oi];
                if (!ob.hard) continue;
                // P22: интервал центров + запас 1.05 (узел рядом с зоной)
                if (targetNode.x > ob.x1 - 1.05 && targetNode.x < ob.x2 + 1.05 &&
                    targetNode.y > ob.y1 - 1.05 && targetNode.y < ob.y2 + 1.05) { near = true; break; }
            }
            this._amsNearHard = near;
        }
        if (CONF_HITBOX && this._amsNearHard) arrival = Math.min(arrival, 0.3);
        if (distToNode < arrival) {
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
            // P21: сенсоры видят твёрдые хитбоксы событий (мебель) из
            // контекста поиска — canMoveOn их не видит, steering упирался
            // в стул. Для flee/orbit контекста нет — поведение прежнее.
            const steerCtx = (CONF_HITBOX && this._amsPathCtx) ? this._amsPathCtx : null;

            for (let i = 0; i < sensorCount; i++) {
                const angle = (i / sensorCount) * Math.PI * 2;
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);
                let interest = Math.max(0, (dirX * desireX) + (dirY * desireY));

                let steps = 2, safety = 1.0;
                for (let s = 1; s <= steps; s++) {
                    const cx = this._x + (dirX * 0.7) * (s/steps);
                    const cy = this._y + (dirY * 0.7) * (s/steps);
                    if (isDeadZone(cx, cy, ignoredZones) || !$gameMap.canMoveOn(this, cx, cy, mapMesh)
                        || hardPointBlocked(steerCtx, cx, cy)) {
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

    // ======================================================================
    // P1: ВИЗУАЛЬНЫЙ ДЕБАГ МАРШРУТОВ (только при Debug Mode)
    // Точки пути всех умных ИИ поверх карты; цвет — по типу поведения.
    // ======================================================================
    // P19: Spriteset_Map масштабируется зумом камеры (scale = zoomScale,
    // сдвиг -zoomX*(scale-1) + shake) — оверлей живёт на сцене мимо
    // спрайтсета, поэтому координаты мира обязаны проходить ту же
    // трансформацию, иначе при зуме точки «уплывают». Объявлена ДО
    // дебаг-блока: тест-хук проверяет математику и без Debug Mode.
    function pathDebugXform(spriteset) {
        if (!spriteset || !spriteset.scale) return { kx: 1, ky: 1, ox: 0, oy: 0 };
        return {
            kx: spriteset.scale.x || 1,
            ky: spriteset.scale.y || 1,
            ox: spriteset.x || 0,
            oy: spriteset.y || 0
        };
    }

    // P20: мостик из дебаг-блока наружу (redrawPathDebug блочно-скоуплен) —
    // тест-хук отдаёт его как overlayDraw, если блок исполнился.
    let sdaOverlayDraw = null;

    if (debugMode && typeof Sprite !== 'undefined' && typeof Bitmap !== 'undefined'
        && typeof Scene_Map !== 'undefined' && typeof Graphics !== 'undefined') {

        const PATH_COLORS = {
            player: '#ff5a5a', event: '#ff9d5a', coord: '#5ad4ff',
            patrol: '#5aff8a', wander: '#ffd35a', flee: '#d45aff',
            back_away: '#d45aff', orbit: '#d4ff5a'
        };

        // P17: тонкая линия между вейпоинтами (Брезенхэм fillRect 1px —
        // у MV Bitmap нет drawLine) + линия от врага к первому вейпоинту.
        function debugLine(bitmap, x0, y0, x1, y1, color) {
            let x = Math.round(x0), y = Math.round(y0);
            const ex = Math.round(x1), ey = Math.round(y1);
            const dx = Math.abs(ex - x), dy = Math.abs(ey - y);
            const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
            let err = dx - dy;
            for (var guard = 0; guard < 2048; guard++) {
                bitmap.fillRect(x, y, 1, 1, color);
                if (x === ex && y === ey) break;
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
        }

        function redrawPathDebug(bitmap, xform) {
            bitmap.clear();
            if (typeof $gameMap === 'undefined' || !$gameMap) return;
            const xf = xform || { kx: 1, ky: 1, ox: 0, oy: 0 };
            const tw = $gameMap.tileWidth();
            const th = $gameMap.tileHeight();
            // P20: угол хитбокса — абсолютные тайловые координаты (без +tw/2):
            // та же зум-трансформация, что у вейпоинтов (P19).
            const corner = (tx, ty) => ({
                x: Math.round(Math.round($gameMap.adjustX(tx) * tw) * xf.kx + xf.ox),
                y: Math.round(Math.round($gameMap.adjustY(ty) * th) * xf.ky + xf.oy)
            });
            // P20: у MV Bitmap НЕТ strokeRect — рамка = 4 fillRect по 1px
            function strokeBox(bmp, x, y, w, h, color) {
                bmp.fillRect(x, y, w, 1, color);
                bmp.fillRect(x, y + h - 1, w, 1, color);
                bmp.fillRect(x, y, 1, h, color);
                bmp.fillRect(x + w - 1, y, 1, h, color);
            }
            // P20: твёрдые предметы (статик, красный) и динамика (синяя рамка)
            // — ровно те хитбоксы, которые видит A* (слой 3, cellPenalty).
            const hitboxes = (typeof collectHitboxes === 'function') ? collectHitboxes() : [];
            for (let i = 0; i < hitboxes.length; i++) {
                const hb = hitboxes[i];
                const p1 = corner(hb.x1, hb.y1);
                const p2 = corner(hb.x2, hb.y2);
                const w = Math.max(1, p2.x - p1.x), h = Math.max(1, p2.y - p1.y);
                if (hb.hard) {
                    bitmap.fillRect(p1.x, p1.y, w, h, 'rgba(255,72,72,0.20)');
                    strokeBox(bitmap, p1.x, p1.y, w, h, '#ff4848');
                } else {
                    strokeBox(bitmap, p1.x, p1.y, w, h, '#4d9dff');
                }
            }
            const toScreen = (wx, wy) => ({
                x: Math.round((Math.round($gameMap.adjustX(wx) * tw + tw / 2)) * xf.kx + xf.ox),
                y: Math.round((Math.round($gameMap.adjustY(wy) * th + th / 2)) * xf.ky + xf.oy)
            });
            const movers = [];
            if ($gameMap.events) movers.push.apply(movers, $gameMap.events());
            if (typeof $gamePlayer !== 'undefined' && $gamePlayer) movers.push($gamePlayer);
            for (let i = 0; i < movers.length; i++) {
                const m = movers[i];
                const t = m._amsSmartTarget;
                const path = m._amsSmartPath;
                if (!t || !path || path.length === 0) continue;
                const color = PATH_COLORS[t.type] || '#ffffff';
                const pt = (wp) => toScreen(wp.x, wp.y);
                // линия от врага к первому вейпоинту
                const from = toScreen(m._x, m._y);
                const first = pt(path[0]);
                debugLine(bitmap, from.x, from.y, first.x, first.y, color);
                let prev = first;
                for (let j = 0; j < path.length; j++) {
                    const p = pt(path[j]);
                    if (j > 0) debugLine(bitmap, prev.x, prev.y, p.x, p.y, color);
                    bitmap.fillRect(p.x - 2, p.y - 2, 5, 5, color);
                    prev = p;
                }
                const lastP = prev;
                bitmap.drawCircle(lastP.x, lastP.y, 6, color);
            }
        }

        // P17b: спрайт-подкласс с СОБСТВЕННЫМ update() — ядро MV зовёт
        // update() у детей сцены каждый кадр (Scene_Base.update → children),
        // независимо от алиас-цепочек Scene_Map.update других плагинов;
        // рисование и заливка текстуры (checkDirty — у простых Sprite его
        // никто не вызывает, WebGL-текстура оставалась пустой) живут здесь.
        function Sprite_PathDebug() {
            this.initialize.apply(this, arguments);
        }
        Sprite_PathDebug.prototype = Object.create(Sprite.prototype);
        Sprite_PathDebug.prototype.constructor = Sprite_PathDebug;
        Sprite_PathDebug.prototype.initialize = function() {
            Sprite.prototype.initialize.call(this, new Bitmap(Graphics.width, Graphics.height));
            // MV Sprite.opacity — шкала 0–255 (НЕ 0–1): старое `= 0.9`
            // давало worldAlpha 0.0035 — спрайт был всегда невидим.
            this.opacity = 230;
            this._sdaLastDrawn = -1;
            // P23: оверлей по умолчанию СКРЫТ (маршруты+хитбоксы мешают игре);
            // F10 в дебаг-запуске включает/выключает на лету.
            this.visible = false;
        };
        Sprite_PathDebug.prototype.update = function() {
            Sprite.prototype.update.call(this);
            try {
                var f = Graphics.frameCount;
                // P22: каждый кадр — редроу раз в 10 кадров заметно лагал
                // за двигающимися персонажами (точки «отставали»)
                if (f !== this._sdaLastDrawn) {
                    this._sdaLastDrawn = f;
                    // P19: зум-трансформация из спрайтсета сцены (камера)
                    redrawPathDebug(this.bitmap, pathDebugXform(this.parent && this.parent._spriteset));
                    if (this.bitmap.checkDirty) this.bitmap.checkDirty();
                    if (this.bitmap._baseTexture && this.bitmap._baseTexture.update) {
                        this.bitmap._baseTexture.update();
                    }
                }
            } catch (e) { /* дебаг не должен ронять сцену */ }
        };

        const _SDAP_Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
        Scene_Map.prototype.createDisplayObjects = function() {
            _SDAP_Scene_Map_createDisplayObjects.call(this);
            try {
                this._sdaPathDebugSprite = new Sprite_PathDebug();
                this.addChild(this._sdaPathDebugSprite);
            } catch (e) { /* дебаг не должен ронять сцену */ }
        };

        // P20: экспорт отрисовки наружу (для тестов движка)
        sdaOverlayDraw = redrawPathDebug;
    }

    // ======================================================================
    // P23: СКВОЗНАЯ ПОГОНЯ ЧЕРЕЗ КАРТЫ
    // MV симулирует только карту игрока: события не могут существовать за её
    // пределами. Механика: при уходе героя погонящиеся враги «входят в дверь»
    // (реестр-призрак на $gameSystem, выживает в сейвах), транзит идёт по
    // таймеру, при совпадении карты призрака с картой героя — материализация
    // (заглушка того же вида телепортируется к двери прибытия, либо событие
    // инжектится динамически со скелетом из карточки БД).
    // Дверь = событие с командой 201 (переход) на триггере 0/1 — назначение
    // читается точно (mapId/x/y), сюжетные автозапуски (триггер 3) игнорируются.
    // ======================================================================

    // P28: есть ли у события команда перехода (201) хоть на одной странице —
    // для распознавания парной двери прибытия (триггер любой)
    function xmapHasTransfer(ev) {
        try {
            var data = ev.event && ev.event();
            if (!data || !data.pages) return false;
            for (var p = 0; p < data.pages.length; p++) {
                var list = data.pages[p].list || [];
                for (var i = 0; i < list.length; i++) {
                    if (list[i].code === 201) return true;
                }
            }
        } catch (e) {}
        return false;
    }

    // P29: SE открытия двери лежит ВНУТРИ ивента двери (первая команда SE в
    // списке активной страницы — та же, что слышит герой). Фоллбек —
    // параметр Door SE.
    function xmapDoorSeFromEvent(ev) {
        try {
            var lists = [];
            var pg = ev.page ? ev.page() : null;
            if (pg && pg.list) lists.push(pg.list);
            var data = ev.event && ev.event();
            if (data && data.pages) {
                for (var i = 0; i < data.pages.length; i++) lists.push(data.pages[i].list || []);
            }
            for (var L = 0; L < lists.length; L++) {
                var list = lists[L];
                for (var c = 0; c < list.length; c++) {
                    var cmd = list[c];
                    if (cmd.code === 250 && cmd.parameters && cmd.parameters[0] && cmd.parameters[0].name) {
                        var a = cmd.parameters[0];
                        return {
                            name: String(a.name),
                            volume: Math.max(0, Math.min(100, Number(a.volume) || 90)),
                            pitch: Math.max(50, Math.min(150, Number(a.pitch) || 100)),
                            pan: 0
                        };
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    // --- P28: дверь открывается/закрывается при транзите врага. Двери —
    // чарсеты (!SF_Door и т.п.), кадры листаются через pattern; рулим
    // спрайтом двери напрямую, не трогая её сложный список команд.
    let xmapDoorFxQueue = [];
    function xmapDoorFx(evId) {
        try {
            var ev = $gameMap.event(evId);
            // P29 приоритет SE: статическое ребро (файл данных — герой слышит
            // этот звук при открытии) -> рантайм-страница -> параметр Door SE
            var se = null;
            try {
                var edges = xmapGraph().edges[$gameMap.mapId()] || [];
                for (var i = 0; i < edges.length; i++) {
                    if (edges[i].evId === evId && edges[i].se) { se = { name: edges[i].se.name, volume: edges[i].se.volume, pitch: edges[i].se.pitch, pan: 0 }; break; }
                }
            } catch (e3) {}
            if (!se && ev) se = xmapDoorSeFromEvent(ev);
            if (!se) se = { name: XMAP_DOOR_SE, volume: XMAP_DOOR_VOL, pitch: 100, pan: 0 };
            if (se.name && typeof AudioManager !== 'undefined' && AudioManager.playSe) {
                AudioManager.playSe(se);
            }
            if (!ev || !ev._characterName || typeof ev.setPattern !== 'function') return;
            // 0 закрыта -> 1 полу -> 2 открыта (пауза) -> 1 -> 0 закрыта
            xmapDoorFxQueue.push({
                evId: evId,
                seq: [ { p: 1, w: 5 }, { p: 2, w: 14 }, { p: 1, w: 5 }, { p: 0, w: 1 } ],
                idx: 0, wait: 0
            });
        } catch (e) { /* эффект не должен ронять кадр */ }
    }
    function xmapDoorFxTick() {
        for (var i = xmapDoorFxQueue.length - 1; i >= 0; i--) {
            var f = xmapDoorFxQueue[i];
            var ev = $gameMap.event(f.evId);
            if (!ev) { xmapDoorFxQueue.splice(i, 1); continue; }
            if (f.wait > 0) { f.wait--; continue; }
            if (f.idx >= f.seq.length) {
                try { ev.setPattern(0); } catch (e) {}
                xmapDoorFxQueue.splice(i, 1);
                continue;
            }
            var step = f.seq[f.idx++];
            try { ev.setPattern(step.p); } catch (e) {}
            f.wait = step.w;
        }
    }

    // --- Реестр призраков (персистентный, на $gameSystem) ---
    function xmapState() {
        if (typeof $gameSystem === 'undefined' || !$gameSystem) return null;
        if (!$gameSystem._sdPursuit) $gameSystem._sdPursuit = { seq: 0, ghosts: [] };
        return $gameSystem._sdPursuit;
    }

    // --- Парсинг дверей из JSON карты (для статического графа; режим 1
    // с переменными не резолвится статически — пропускается). P29: вместе с
    // ребром выносим ПЕРВУЮ SE страницы-двери (её слышит герой при открытии;
    // рантайм-страницы дверей переписываются чужими плагинами — файл надёжен) ---
    function xmapParseDoorList(json) {
        var doors = [];
        if (!json || !json.events) return doors;
        for (var i = 1; i < json.events.length; i++) {
            var ev = json.events[i];
            if (!ev || !ev.pages) continue;
            var found = false;
            for (var p = 0; p < ev.pages.length && !found; p++) {
                var pg = ev.pages[p];
                var trig = pg.trigger;
                if (trig !== 0 && trig !== 1) continue;
                var list = pg.list || [];
                for (var c = 0; c < list.length; c++) {
                    if (list[c].code === 201 && list[c].parameters && list[c].parameters[0] === 0) {
                        var pr = list[c].parameters;
                        // первая SE страницы — «дверной» звук открытия
                        var se = null;
                        for (var s = 0; s < list.length; s++) {
                            if (list[s].code === 250 && list[s].parameters && list[s].parameters[0]
                                && list[s].parameters[0].name) {
                                var a = list[s].parameters[0];
                                se = {
                                    name: String(a.name),
                                    volume: Math.max(0, Math.min(100, Number(a.volume) || 90)),
                                    pitch: Math.max(50, Math.min(150, Number(a.pitch) || 100))
                                };
                                break;
                            }
                        }
                        var door = {
                            evId: i, x: ev.x, y: ev.y,
                            toMap: Number(pr[1]), toX: Number(pr[2]), toY: Number(pr[3])
                        };
                        if (se) door.se = se;
                        doors.push(door);
                        found = true;
                        break;
                    }
                }
            }
        }
        return doors;
    }

    // --- Статический граф дверей: читаем data/Map*.json напрямую через fs
    // (игра живёт в NW с node-интеграцией). Кэш на сессию. ---
    let xmapGraphCache = null;
    function xmapGraph() {
        if (xmapGraphCache) return xmapGraphCache;
        var edges = {};
        try {
            if (typeof process === 'undefined' || !process.versions || !process.versions.nw) {
                throw new Error('no nw');
            }
            var fs = require('fs');
            var path = require('path');
            var dir = path.join(process.cwd(), 'data');
            var files = fs.readdirSync(dir);
            for (var i = 0; i < files.length; i++) {
                var m = /^Map(\d+)\.json$/.exec(files[i]);
                if (!m) continue;
                try {
                    var json = JSON.parse(fs.readFileSync(path.join(dir, files[i]), 'utf8'));
                    var doors = xmapParseDoorList(json);
                    if (doors.length) edges[Number(m[1])] = doors;
                } catch (e) { /* битая карта — пропускаем */ }
            }
        } catch (e) { /* браузерный контекст — сквозной погони нет */ }
        return (xmapGraphCache = { edges: edges });
    }

    // --- BFS по графу: маршрут fromMap -> toMap (массив хопов-дверей) ---
    function xmapRouteOnGraph(graph, fromMap, toMap) {
        if (fromMap === toMap) return [];
        if (!graph || !graph.edges) return null;
        var parent = {};
        parent[fromMap] = null;
        var queue = [fromMap];
        var found = false;
        while (queue.length && !found) {
            var cur = queue.shift();
            var doors = graph.edges[cur] || [];
            for (var i = 0; i < doors.length; i++) {
                var d = doors[i];
                if (!(d.toMap in parent)) {
                    parent[d.toMap] = { fromMap: cur, door: d };
                    if (d.toMap === toMap) { found = true; break; }
                    queue.push(d.toMap);
                }
            }
        }
        if (!(toMap in parent)) return null;
        var hops = [];
        var cur2 = toMap;
        while (parent[cur2]) {
            hops.unshift(parent[cur2].door);
            cur2 = parent[cur2].fromMap;
        }
        return hops;
    }
    function xmapRoute(fromMap, toMap) {
        return xmapRouteOnGraph(xmapGraph(), fromMap, toMap);
    }

    // --- Двери ТЕКУЩЕЙ карты в рантайме. P23-урок: активные страницы событий
    // в рантайме ПЕРЕЗАПИСЫВАЮТСЯ чужими плагинами (замечено: скелет P2
    // добавляет свои 201, aex-зоны меняют триггеры) — странице верить
    // нельзя. Источник истины — статический граф (файлы данных); из рантайма
    // берём только живые координаты события (если есть) и пропуск erased. ---
    function xmapDoorsRuntime() {
        var doors = [];
        try {
            var mapId = $gameMap.mapId();
            var list = (xmapGraph().edges[mapId] || []).slice();
            for (var i = 0; i < list.length; i++) {
                var d = list[i];
                var ev = ($gameMap.event && $gameMap.event(d.evId)) || null;
                if (ev && ev._erased) continue;
                doors.push({
                    evId: d.evId,
                    x: ev ? ev._x : d.x,
                    y: ev ? ev._y : d.y,
                    toMap: d.toMap, toX: d.toX, toY: d.toY
                });
            }
        } catch (e) { /* безопасно */ }
        return doors;
    }

    // --- Тег вида врага (match-строка карточки SuperDuperEnemies) ---
    function xmapTagOf(ev) {
        try {
            if (typeof SDE_API !== 'undefined' && SDE_API.getMatchTag) {
                var t = SDE_API.getMatchTag($gameMap.mapId(), ev._eventId);
                if (t) return t;
            }
        } catch (e) {}
        var note = (ev.event && ev.event()) ? (ev.event().note || '') : '';
        var m = /<([^>]+)>/.exec(note);
        return m ? m[1] : null;
    }

    // --- Вход в дверь: снимаем состояние врага в реестр-призрак ---
    function xmapEnterTransit(ev, door, extraFrames) {
        var st = xmapState();
        if (!st) return false;
        if (st.ghosts.length >= XMAP_LIMIT) return false;
        var tag = xmapTagOf(ev);
        if (!tag) return false;
        var selfSwitches = {};
        try {
            var letters = ['A', 'B', 'C', 'D'];
            for (var i = 0; i < letters.length; i++) {
                var v = $gameSelfSwitches.value([$gameMap.mapId(), ev._eventId, letters[i]]);
                if (v) selfSwitches[letters[i]] = true;
            }
        } catch (e) {}
        var hp = null;
        try {
            if (typeof SDE_API !== 'undefined' && SDE_API.getEventData) {
                var d = SDE_API.getEventData($gameMap.mapId(), ev._eventId);
                if (d) hp = d.hp;
            }
        } catch (e) {}
        st.ghosts.push({
            key: 'p' + (++st.seq),
            tag: tag,
            selfSwitches: selfSwitches,
            hp: hp,
            leg: { toMap: door.toMap, toX: door.toX, toY: door.toY },
            etaFrames: XMAP_TRANSIT + Math.max(0, extraFrames | 0),
            interest: XMAP_INTEREST,
            waiting: false
        });
        try { ev.smartStop(); } catch (e) {}
        try { ev.erase(); } catch (e) {}
        // P28: дверь за врагом открывается и закрывается
        xmapDoorFx(door.evId);
        return true;
    }

    // --- Материализация призрака на карте игрока ---
    function xmapMaterialize(g) {
        try {
            var mapId = $gameMap.mapId();
            if (g.leg.toMap !== mapId) return false;
            // P28: враг выходит из двери — дверь открывается/закрывается.
            // Сначала статическое ребро рядом; парная дверь часто авторан
            // (триггер 2 — в граф не входит) — тогда рантайм-скан: событие
            // с чарсетом и командой 201 на любой странице в радиусе 1.6.
            try {
                var edges = xmapGraph().edges[mapId] || [];
                var best = null, bestD = 1.6;
                for (var e = 0; e < edges.length; e++) {
                    var d = Math.hypot(edges[e].x - g.leg.toX, edges[e].y - g.leg.toY);
                    if (d < bestD) { bestD = d; best = edges[e]; }
                }
                if (!best) {
                    var evsAll = $gameMap.events();
                    for (var e2 = 0; e2 < evsAll.length; e2++) {
                        var e3 = evsAll[e2];
                        if (!e3 || e3._erased || !e3._characterName) continue;
                        if (Math.hypot(e3._x - g.leg.toX, e3._y - g.leg.toY) >= 1.6) continue;
                        if (xmapHasTransfer(e3)) { best = { evId: e3._eventId }; break; }
                    }
                }
                if (best) xmapDoorFx(best.evId);
            } catch (e2) { /* безопасно */ }
            // 1) заглушка того же вида на карте -> телепортируем к точке прибытия
            var evs = $gameMap.events();
            var target = null;
            for (var i = 0; i < evs.length; i++) {
                var ev = evs[i];
                if (!ev || ev._erased) continue;
                if (xmapTagOf(ev) === g.tag) { target = ev; break; }
            }
            if (target) {
                target.locate(g.leg.toX, g.leg.toY);
            } else {
                // 2) заглушки нет — инжект события со скелетом из карточки
                if (typeof SDE_API === 'undefined' || !SDE_API.buildTemplatePages) return false;
                var pages = SDE_API.buildTemplatePages(g.tag);
                if (!pages || !pages.length) return false;
                // P28: note несёт и шаги врага (громкость + персональный пул),
                // как у редакторных заглушек — иначе инжект беззвучно ходит
                var tpl = SDE_API.getTemplate ? SDE_API.getTemplate(g.tag) : null;
                var tagClean = String(g.tag).replace(/^[<]+|[>]+$/g, '');
                var note = '<' + tagClean + '>';
                if (tpl) {
                    var sVol = Number(tpl.stepVolume);
                    if (sVol > 0) note += ' <step_se:' + Math.min(150, Math.round(sVol)) + '>';
                    else note += ' <step_se>';
                    var sSnd = String(tpl.stepSounds || '').trim();
                    if (sSnd) note += ' <step_snds:' + sSnd + '>';
                }
                var id = $dataMap.events.length;
                var evData = {
                    id: id, name: 'PURSUIT ' + g.tag, note: note,
                    x: g.leg.toX, y: g.leg.toY, pages: pages
                };
                // MV-контракт: meta обязателен (SuperDuperMovement читает
                // dataEvent.meta.collider на setupPageSettings)
                try {
                    if (typeof DataManager !== 'undefined' && DataManager.extractMetadata) {
                        DataManager.extractMetadata(evData);
                    } else {
                        evData.meta = {};
                    }
                } catch (e) { evData.meta = {}; }
                $dataMap.events[id] = evData;
                target = new Game_Event(mapId, id);
                $gameMap._events[id] = target;
                if (SDE_API.registerInjectedEvent) SDE_API.registerInjectedEvent(mapId, id, g.tag);
                // спрайт для события, добавленного после старта сцены
                var scene = (typeof SceneManager !== 'undefined') && SceneManager._scene;
                var set = scene && scene._spriteset;
                if (set && set._characterSprites && typeof Sprite_Character !== 'undefined') {
                    try {
                        var sp = new Sprite_Character(target);
                        set._characterSprites.push(sp);
                        if (set._tilemap) set._tilemap.addChild(sp);
                    } catch (e) { /* спрайт добавится при следующем рендере */ }
                }
            }
            // восстановить фазу боя (селф-свитчи) и HP
            try {
                var letters2 = ['A', 'B', 'C', 'D'];
                for (var k = 0; k < letters2.length; k++) {
                    $gameSelfSwitches.setValue([mapId, target._eventId, letters2[k]], !!g.selfSwitches[letters2[k]]);
                }
            } catch (e) {}
            if (g.hp !== null && g.hp !== undefined && SDE_API.setEventDataHp) {
                SDE_API.setEventDataHp(mapId, target._eventId, g.hp);
            }
            try { target.refresh(); } catch (e) {}
            try { target.smartMoveToPlayer(); } catch (e) {}
            return true;
        } catch (e) {
            if (typeof window !== 'undefined') window.__p23MatErr = String(e && e.message ? e.message : e);
            return false;
        }
    }

    // --- Тик реестра (каждый кадр активной карты) ---
    function xmapTick() {
        try { xmapDoorFxTick(); } catch (e) { /* безопасно */ }
        var st = xmapState();
        if (!st || st.ghosts.length === 0) return;
        var playerMap = $gameMap.mapId(); // P23-урок: карта игрока == текущая
        for (var i = st.ghosts.length - 1; i >= 0; i--) {
            var g = st.ghosts[i];
            g.interest--;
            if (g.interest <= 0) { st.ghosts.splice(i, 1); continue; }
            if (g.leg.toMap === playerMap) {
                g.etaFrames--;
                if (g.etaFrames <= 0 && xmapMaterialize(g)) st.ghosts.splice(i, 1);
            } else {
                // игрок ушёл дальше: призрак стоит у двери (waiting) или едет
                if (g.etaFrames > 0) { g.etaFrames--; continue; }
                var route = xmapRoute(g.leg.toMap, playerMap);
                if (route && route.length > 0) {
                    g.leg = { toMap: route[0].toMap, toX: route[0].toX, toY: route[0].toY };
                    g.etaFrames = XMAP_TRANSIT;
                    g.waiting = false;
                } else {
                    g.waiting = true; // тупик — ждёт у двери возвращения героя
                }
            }
        }
    }

    // P23: тик реестра — только когда Game_Map есть (vm-тесты его не дают)
    if (typeof Game_Map !== 'undefined' && Game_Map.prototype) {
        const _SDAP_Game_Map_update = Game_Map.prototype.update;
        Game_Map.prototype.update = function(isActive) {
            _SDAP_Game_Map_update.call(this, isActive);
            if (CONF_XMAP) {
                try { xmapTick(); } catch (e) { /* погоня не должна ронять кадр */ }
            }
        };
    }

    // --- Уход героя с карты: все погонящиеся враги «видели» дверь и входят ---
    const _SDAP_Game_Player_performTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function() {
        if (typeof window !== 'undefined') window.__p23HookRan = true;
        if (CONF_XMAP && this._transferring && typeof $gameMap !== 'undefined' && $gameMap) {
            try {
                var toMap = this._newMapId;
                var px = this._x, py = this._y;
                var chasers = [];
                var evs = $gameMap.events();
                for (var i = 0; i < evs.length; i++) {
                    var ev = evs[i];
                    if (ev && ev._amsSmartTarget && ev._amsSmartTarget.type === 'player' && !ev._erased) chasers.push(ev);
                }
                for (var c = 0; c < chasers.length; c++) {
                    var ch = chasers[c];
                    // дверь, которой воспользовался герой: рядом с точкой ухода
                    // и ведущая на целевую карту
                    var doors = xmapDoorsRuntime();
                    var door = null;
                    for (var d = 0; d < doors.length; d++) {
                        if (doors[d].toMap === toMap &&
                            Math.hypot(doors[d].x - px, doors[d].y - py) <= XMAP_DOOR_RADIUS) { door = doors[d]; break; }
                    }
                    if (!door) {
                        // герой ушёл «скриптом» — идём по графу
                        var route = xmapRoute($gameMap.mapId(), toMap);
                        if (route && route.length > 0) {
                            var rt = xmapDoorsRuntime();
                            for (var d2 = 0; d2 < rt.length; d2++) {
                                if (rt[d2].toMap === route[0].toMap) { door = rt[d2]; break; }
                            }
                        }
                    }
                    if (door) {
                        var dist = Math.hypot(door.x - ch._x, door.y - ch._y);
                        xmapEnterTransit(ch, door, Math.round(dist * 16)); // ~16 кадров на клетку
                    } else {
                        try { ch.smartStop(); } catch (e) {} // некуда идти
                    }
                }
            } catch (e) {
                if (typeof window !== 'undefined') window.__p23Err = String(e && e.message ? e.message : e);
            }
        }
        return _SDAP_Game_Player_performTransfer.call(this);
    };

    // ======================================================================
    // ТЕСТ-ХУК (виден только вне игры тестам движка; на поведение не влияет)
    // ======================================================================
    if (typeof window !== 'undefined' && !window.__SDA_TEST) {
        window.__SDA_TEST = {
            AStar: AStar,
            MinHeap: MinHeap,
            octile: octile,
            isDynamicMover: isDynamicMover,
            buildPathContext: buildPathContext,
            cellPenalty: cellPenalty,
            checkLineOfSight: checkLineOfSight,
            config: {
                hitbox: () => CONF_HITBOX,
                softCost: () => CONF_SOFT_COST,
                goalExempt: () => CONF_GOAL_EXEMPT
            },
            debugActive: () => debugMode,
            pathDebugXform: (typeof pathDebugXform === 'function') ? pathDebugXform : null,
            collectHitboxes: (typeof collectHitboxes === 'function') ? collectHitboxes : null,
            hardSegmentBlocked: (typeof hardSegmentBlocked === 'function') ? hardSegmentBlocked : null,
            overlayDraw: sdaOverlayDraw,
            // P23: сквозная погоня
            xmap: {
                parseDoorList: (typeof xmapParseDoorList === 'function') ? xmapParseDoorList : null,
                routeOnGraph: (typeof xmapRouteOnGraph === 'function') ? xmapRouteOnGraph : null,
                doorsRuntime: (typeof xmapDoorsRuntime === 'function') ? xmapDoorsRuntime : null,
                enterTransit: (typeof xmapEnterTransit === 'function') ? xmapEnterTransit : null,
                materialize: (typeof xmapMaterialize === 'function') ? xmapMaterialize : null,
                tick: (typeof xmapTick === 'function') ? xmapTick : null,
                state: (typeof xmapState === 'function') ? xmapState : null,
                enabled: () => CONF_XMAP,
                doorFx: (typeof xmapDoorFx === 'function') ? xmapDoorFx : null,
                doorFxQueue: () => xmapDoorFxQueue,
                setGraphCache: function(fake) { xmapGraphCache = fake; },
                clearGraphCache: function() { xmapGraphCache = null; }
            }
        };
    }

})();