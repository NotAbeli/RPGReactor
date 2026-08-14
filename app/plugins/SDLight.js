//=============================================================================
// SDLight - Modular Lighting System
// SDLight.js
// Version: 1.0.0 (Refactored from SuperDuperLight v5.9.46)
//=============================================================================
/*:
 * @plugindesc v1.0 SDLight — модульная система освещения (рефакторинг SuperDuperLight v5.9.46)
 * @author Super Duper Team
 *
 * @param --- Master ---
 * @default
 *
 * @param Master Opacity Variable
 * @text Переменная Яркости (Master)
 * @desc ID переменной (0-100). 0=норма (тьма), 100=светло (слой скрыт).
 * @type variable
 * @default 337
 *
 * @param Vignette Disable Switch
 * @text ID переключателя выкл. виньетки
 * @desc При ВКЛ виньетка исчезает (остается только Тинт/Туман).
 * @type switch
 * @default 6
 *
 * @param Sensor Debug Switch
 * @text ID переключателя отладки
 * @desc При ВКЛ отрисовывает цветные хитбоксы света (Фактический/Касательный/Яркий).
 * @type switch
 * @default 8
 *
 * @param --- Sensor Zones ---
 * @default
 *
 * @param Bright Zone Percent
 * @text Зона: Яркий (%)
 * @parent --- Sensor Zones ---
 * @desc Процент радиуса для хитбокса "Яркий" (центр).
 * @type number
 * @min 1
 * @max 100
 * @default 45
 *
 * @param Tangent Zone Percent
 * @text Зона: Касательный (%)
 * @parent --- Sensor Zones ---
 * @desc Процент радиуса для хитбокса "Касательный" (середина).
 * @type number
 * @min 1
 * @max 100
 * @default 60
 *
 * @param --- Falloff Presets ---
 * @default
 *
 * @param Falloff Presets
 * @text Пресеты затухания (Именованные)
 * @desc База данных пресетов (для Света и Стен).
 * @type struct<FalloffPreset>[]
 * @default []
 *
 * @param Default Falloff Config
 * @text Настройка затухания (Default)
 * @desc Градиент для света БЕЗ пресета. Если пусто: Линейный.
 * @type struct<FalloffStep>[]
 * @default []
 *
 * @param --- Player Light ---
 * @default
 *
 * @param Player radius
 * @text Радиус света игрока
 * @desc Радиус зоны чистой видимости вокруг игрока.
 * @default 0
 *
 * @param Default Tint
 * @text Цвет Тумана (Тинт)
 * @desc Базовый цвет атмосферы рядом с игроком.
 * @default #161616
 *
 * @param Vignette Color
 * @text Цвет Виньетки
 * @desc Цвет, в который уходит экран по краям (Глубина).
 * @default #000000
 *
 * @param Vignette Scale
 * @text Размер Виньетки (База)
 * @desc Множитель размера "пузыря" атмосферы.
 * @default 0.4
 *
 * @param Vignette Sharpness
 * @text Резкость Виньетки
 * @desc Где начинается затемнение (от 0.0 до 1.0).
 * @default 0.08
 *
 * @param Player Light Influence
 * @text Влияние Света Игрока
 * @desc Коэффициент. Насколько свет игрока отодвигает виньетку.
 * @default 1.3
 *
 * @param Breathing Speed
 * @text Скорость Дыхания
 * @desc Как быстро виньетка реагирует на изменение света (0.01 - 1.0).
 * @default 0.05
 *
 * @param Events Clear Vignette
 * @text События разгоняют тьму
 * @desc Если true, лампы и костры тоже будут убирать виньетку.
 * @type boolean
 * @on true
 * @off false
 * @default false
 *
 * @param Vignette Clear Multiplier
 * @text Множитель очистки виньетки
 * @desc Множитель для vignette cut-radius, если events_clear_vignette=true.
 * @type number
 * @decimals 2
 * @default 1
 *
 * @param Flashlight offset
 * @text Сдвиг фонарика
 * @desc Сдвиг источника света игрока по Y (для совмещения с головой персонажа).
 * @type number
 * @default 0
 *
 * @param --- Regions / Walls ---
 * @default
 *
 * @param Region Settings
 * @text Блокирующие регионы (по умолчанию)
 * @desc Формат: "ID1 #HEXCOLOR ID2 #HEXCOLOR ...". Можно менять через Plugin Command.
 * @default 8 #000000, 1 #000000, 11 #000000, 12 #000000, 13 #000000, 14 #000000,
 *
 * @param Wall Softness
 * @text Мягкость стен
 * @desc Ширина градиентного перехода на границах тайлов (0-24).
 * @type number
 * @min 0
 * @max 24
 * @default 10
 *
 * @param Wall Preset ID
 * @text Пресет затухания для стен
 * @desc ID из "Falloff Presets" (применяется к границам тайлов стен).
 * @default
 *
 * @param Iso Bottom Offset
 * @text Изометрический сдвиг низа стены
 * @desc Сдвиг нижней границы тайла стены (для изо-перспективы).
 * @type number
 * @default 3
 *
 * @param Wall Tint Opacity
 * @text Непрозрачность тинта стен
 * @desc Затемнение тайлов стен поверх их цвета (0.0 - 1.0).
 * @type number
 * @decimals 2
 * @min 0.0
 * @max 1.0
 * @default 0.35
 *
 * @param --- Shadow System ---
 * @default
 *
 * @param Use Real Shadows
 * @text Настоящие тени (tile-based)
 * @desc Свет не проходит сквозь blocking regions. Простая и быстрая реализация через raycast.
 * @type boolean
 * @on true
 * @off false
 * @default false
 *
 * @param Activation Time (frames)
 * @text Плавное включение (кадры)
 * @desc Скорость разгорания света в кадрах (60 fps). 0 = мгновенно. 18 = 0.3 сек.
 * @type number
 * @min 0
 * @max 120
 * @default 18
 *
 * @param --- Debug ---
 * @default
 *
 * @param Debug Mode
 * @text Режим отладки (console)
 * @desc Печатает диагностику в консоль разработчика.
 * @type boolean
 * @on true
 * @off false
 * @default false
 *
 * @param --- Map Switches ---
 * @default
 *
 * @param MapSwitch Base
 * @text База глоб. переключателя
 * @desc Лок.переключатель (карта M, слот N) = глобальный переключатель (Base + M*Stride + N). 0 = хранить отдельно, не в глобальных.
 * @type number
 * @default 1000
 *
 * @param MapSwitch Stride
 * @text Шаг карт (Stride)
 * @desc Сколько слотов резервируется на карту. N должно быть < Stride.
 * @type number
 * @default 10
 *
 * @help
 * ============================================================================
 * SDLight — рефакторинг SuperDuperLight v5.9.46
 * ============================================================================
 *
 * СОВМЕСТИМОСТЬ С TERRAX LIGHTING:
 *   - Импортирует Imported.TerraxLighting = true
 *   - Все 30 getters/setters на Game_Variables (SetRadius, GetRadius, etc.)
 *   - Те же Plugin Commands: Tint, Vignette, RegionBlock, Light
 *   - Те же Note Tags: light | fire | flashlight с теми же аргументами
 *   - Tile-based region blocks с autotile cache
 *   - 3-tier сенсоры (Actual/Tangent/Bright)
 *
 * ОТЛИЧИЯ ОТ ОРИГИНАЛА:
 *   - Единый Bresenham raycast (вместо 3 копий)
 *   - Объединённые getLightZone / getLightIntensity
 *   - Именованные константы (CANVAS_PADDING и т.д.) вместо магических чисел
 *   - Options-object для radialFill вместо 14 позиционных параметров
 *   - Структурированный парсер Note (без мутации массива)
 *   - Кеш масок тайлов в renderRegionBlocks
 *   - НАСТОЯЩИЕ ТЕНИ: visibility polygon от стен (этап 2)
 *   - Baked lighting: статические источники кешируются в bitmap (этап 3)
 *   - Static layer: стены + bake-нутые источники не пересчитываются каждый кадр (этап 4)
 *   - Плавное включение света (этап 5)
 *   - Авто-detect стен по terrain tag (опционально)
 *
 * PLUGIN COMMANDS:
 *   Tint set #COLOR                        - мгновенно установить тинт
 *   Tint fade #COLOR SPEED                 - плавно перейти к тинту
 *   Vignette color #COLOR                  - установить цвет виньетки
 *   RegionBlock ID #COLOR                  - добавить блокирующий регион
 *   RegionBlock ID OFF                     - убрать блокирующий регион
 *   Light radius N [tDURATION] [COLOR] [PRESET] [MULT] [BRIGHT] [SMOOTH]
 *   Light radiusGrow N [...]               - то же, но по умолчанию с анимацией
 *   Light on / Light off                   - включить/выключить свет игрока
 *   Light color #COLOR                     - цвет света игрока
 *   Light brightness N                     - яркость (0.0 - 1.0)
 *   Light smooth N                         - плавность (0.0 - 1.0)
 *   Light preset ID                        - применить пресет затухания
 *   Light flicker on / Light flicker off   - эффект костра
 *   Light flashlight BRIGHTNESS            - включить фонарик
 *   Light cycle COLOR1 FRAMES1 COLOR2 FRAMES2 ...  - цикл цветов
 *
 * MAP-LOCAL SWITCHES — ИНСТРУКЦИЯ (свет и переключатели локации):
 * ============================================================================
 * Локальный переключатель — это отдельный ВКЛ/ВЫКЛ для каждой карты (один на всю
 * локацию). Хранится в реальном глобальном переключателе по формуле:
 *     глоб.SW = MapSwitch Base + mapId × Stride + N     (по умолч. Base=1000, Stride=10)
 * Пример: карта 104, слот 1 → глобальный переключатель № 1000 + 104*10 + 1 = 2041.
 * Узнать номер для текущей карты: в редакторе света (F12) — он написан у галочки,
 *   либо скриптом:  SDMapSwitch.globalId($gameMap.mapId(), 1)
 *
 * 1) КАК НАСТРОИТЬ УСЛОВИЕ ГОРЕНИЯ СВЕТА
 *    - Открой F12 → Light Editor → кликни источник на карте.
 *    - В панели есть «Условие свечения»: галочка + поле «доп. условия».
 *    - Пусто everywhere → светит всегда.
 *    - Доп. условия — любые комбинации: S5 (глоб. SW 5), V12>=3 (переменная 12),
 *      && (И), || (ИЛИ), ! (НЕ), скобки. Пример:  S5 && V12>=3
 *
 * 2) КАК ПРИВЯЗАТЬ СВЕТ К ЛОКАЛЬНОМУ ПЕРЕКЛЮЧАТЕЛЮ
 *    - В панели источника поставь ГАЛОЧКУ «Лок. переключатель этой карты».
 *    - Свет загорится ТОЛЬКО когда этот переключатель вкл.
 *    - Если ещё заполнить «доп. условия» — они тоже должны выполняться (И).
 *
 * 3) КАК ПРОВЕРЯТЬ ЛОКАЛЬНЫЙ ПЕРЕКЛЮЧАТЕЛЬ В ОБЪЕКТЕ (для страниц события)
 *    Вариант А — комментарий в начале страницы (ПРОЩЕ ВСЕГО, рекомендуется):
 *      • Открой 2-й лист события → первая команда: «Комментарий» (◆ Comment).
 *      • Напиши тег:   <L1>    → страница активна, только когда лок.перекл. №1
 *        этой карты ВКЛ.   <!L1>  → только когда ВЫКЛ.   <L3> — другой слот.
 *      • В Conditions страницы ничего ставить НЕ нужно — плагин сам проверит тег.
 *      • У объекта: лист 1 (без тега) — состояние «выкл», лист 2 с <L1> — «вкл».
 *    Вариант Б — условие страницы через глобальный переключатель:
 *      • Conditions → Switch → впиши № глоб.переключателя этой карты (см. формулу).
 *    Вариант В — скриптом (Conditional Branch → Script):
 *        $gameMap.localSwitch(1)
 *      В условии света тот же токен пишется как  L1  (напр. "L1 && !S5").
 *
 * 4) КАК ВКЛЮЧИТЬ / ВЫКЛЮЧИТЬ ЛОКАЛЬНЫЙ ПЕРЕКЛЮЧАТЕЛЬ
 *    Plugin Command:
 *      LocalSwitch 1 on               → вкл на ТЕКУЩЕЙ карте
 *      LocalSwitch 1 off              → выкл на текущей карте
 *      LocalSwitch 1 toggle           → переключить
 *      LocalSwitch 1 on map 104       → вкл на карте 104 (с любой локации!)
 *      LocalSwitch 1 on 104           → короткая форма
 *    Скрипт:
 *      $gameMap.setLocalSwitch(1, true)            // текущая карта
 *      SDMapSwitch.set(104, 1, true)               // конкретная карта
 *      SDMapSwitch.toggle(104, 1)
 *      SDMapSwitch.get(104, 1)                     // проверить
 *    (N может быть 1..Stride-1; света по умолчанию используют N=1.)
 *
 * ★ Параметр "MapSwitch Base" задаёт стартовый № глоб. переключателя. Если у тебя
 *   уже заняты переключатели 1000+ — поставь в Plugin Manager базу повыше
 *   (например 5000). Переключатели [Base … Base+maxMapId*Stride] зарезервируй.
 * ============================================================================
 *
 * NOTE TAGS (на событие, первая строка Note):
 *   light RADIUS #COLOR BRIGHTNESS SMOOTH PRESET MULT
 *   light RADIUS:RADIUS_Y #COLOR ...                       (овальный свет)
 *   fire RADIUS #COLOR BRIGHTNESS SMOOTH PRESET MULT       (с мерцанием)
 *   flashlight LENGTH WIDTH #COLOR BRIGHTNESS DIRECTION
 *
 *   Поддерживаемые модификаторы (в любом порядке):
 *     bNN        — яркость в % (b50 = 0.5)
 *     dN         — направление (1=up,2=right,3=down,4=left)
 *     preset_id  — ID пресета из Falloff Presets
 *     number     — multiplier виньетки
 *
 * SCRIPT CALLS (Terrax-compatible):
 *   $gameVariables.SetRadius(N)            $gameVariables.GetRadius()
 *   $gameVariables.SetRadiusTarget(N)      $gameVariables.GetRadiusTarget()
 *   $gameVariables.SetRadiusSpeed(N)       $gameVariables.GetRadiusSpeed()
 *   $gameVariables.SetPlayerColor('#FFF')  $gameVariables.GetPlayerColor()
 *   $gameVariables.SetPlayerBrightness(N)  $gameVariables.GetPlayerBrightness()
 *   $gameVariables.SetPlayerSmoothness(N)  $gameVariables.GetPlayerSmoothness()
 *   $gameVariables.SetPlayerPreset(ID)     $gameVariables.GetPlayerPreset()
 *   $gameVariables.SetFlashlight(bool)     $gameVariables.GetFlashlight()
 *   $gameVariables.SetFlashlightLength(N)  $gameVariables.GetFlashlightLength()
 *   $gameVariables.SetFlashlightWidth(N)   $gameVariables.GetFlashlightWidth()
 *   $gameVariables.SetFire(bool)           $gameVariables.GetFire()
 *   $gameVariables.SetSavedTint('#FFF')    $gameVariables.GetSavedTint()
 *   $gameVariables.SetSavedVignette('#FF') $gameVariables.GetSavedVignette()
 *   $gameVariables.SetPlayerVignetteMult(N) $gameVariables.GetPlayerVignetteMult()
 *   $gameVariables.SetBlockedRegions(obj)  $gameVariables.GetBlockedRegions()
 *
 * SCRIPT CALLS (SDLight-native):
 *   $gamePlayer.getLightZone()             - 0/1/2/3 (Dark/Actual/Tangent/Bright)
 *   $gameMap.event(N).getLightZone()       - то же для события
 *   $gamePlayer.getLightIntensity()        - 0.0..1.0
 *
 * СОВМЕСТИМОСТЬ:
 *   - SuperDuperEnemies: использует флаги light_actual / light_tangent / light_bright
 *     (эти флаги устанавливаются отдельным плагином через getLightZone)
 *
 * ============================================================================
 */

var Imported = Imported || {};
Imported.SDLight = true;
Imported.TerraxLighting = true; // Backwards-compat hook

(function() {
    "use strict";

    // =========================================================================
    // SECTION: CONSTANTS
    // =========================================================================

    /**
     * Геометрические константы рендера.
     * Раньше были магическими числами (20, 128) в 5+ местах.
     */
    var CANVAS_PADDING = 20;       // Сдвиг маски по X (из-за bitmap margin)
    var BITMAP_MARGIN = 128;       // Bitmap создается с запасом (w+128, h+128)
    var MAX_RAYCAST_STEPS = 100;   // Лимит итераций Bresenham line
    var FLICKER_PROBABILITY = 0.2; // Вероятность обновления flicker offset per frame
    var FLICKER_RANGE = 7;         // Максимальное смещение радиуса при flicker

    /**
     * Зоны освещённости сенсора (0-3).
     * Используется в getLightZone и SuperDuperEnemies.
     */
    var ZONE = {
        DARK: 0,
        ACTUAL: 1,
        TANGENT: 2,
        BRIGHT: 3
    };

    /**
     * Типы источников света (по Note tag).
     */
    var LIGHT_TYPE = {
        NORMAL: 'Normal',
        FIRE: 'Fire',
        FLASHLIGHT: 'Flashlight'
    };

    /**
     * Направления (RPG Maker convention).
     * 1=up, 2=right, 3=down, 4=left (для flashlight direction modifier)
     */
    var DIRECTION_MAP = { 1: 8, 2: 6, 3: 2, 4: 4 };

    // =========================================================================
    // SECTION: PARAMETERS
    // =========================================================================

    var parameters = PluginManager.parameters('SDLight');
    if (Object.keys(parameters).length === 0) {
        // Fallback на параметры Terrax (для миграции)
        parameters = PluginManager.parameters('TerraxLighting');
    }

    // Hardcoded project defaults — используются если parameters сброшен в ""
    // (RPG Maker при Test Play перезаписывает plugins.js используя @default;
    //  если @default пустой, значение становится "". Этот fallback гарантирует
    //  что плагин работает корректно даже с пустыми parameters.)
    var PROJECT_DEFAULTS = {
        'Master Opacity Variable': '337',
        'Vignette Disable Switch': '6',
        'Sensor Debug Switch': '8',
        'Bright Zone Percent': '45',
        'Tangent Zone Percent': '60',
        'Player radius': '0',
        'Default Tint': '#161616',
        'Vignette Color': '#000000',
        'Vignette Scale': '0.4',
        'Vignette Sharpness': '0.08',
        'Player Light Influence': '1.3',
        'Breathing Speed': '0.05',
        'Events Clear Vignette': 'false',
        'Vignette Clear Multiplier': '1',
        'Flashlight offset': '0',
        'Region Settings': '8 #000000, 1 #000000, 11 #000000, 12 #000000, 13 #000000, 14 #000000,',
        'Wall Softness': '10',
        'Wall Preset ID': '',
        'Iso Bottom Offset': '3',
        'Wall Tint Opacity': '0.35',
        'Use Real Shadows': 'false',
        'Activation Time (frames)': '18',
        'Debug Mode': 'false',
        'MapSwitch Base': '1000',
        'MapSwitch Stride': '10'
    };
    function param(key) {
        var v = parameters[key];
        if (v === undefined || v === null || v === '') {
            v = PROJECT_DEFAULTS[key];
        }
        return v;
    }

    var CONFIG = {
        // Master
        masterOpacityVar: Number(param('Master Opacity Variable') || 0),
        vignetteDisableSwitch: Number(param('Vignette Disable Switch') || 0),
        sensorDebugSwitch: Number(param('Sensor Debug Switch') || 0),

        // Sensor zones (0.0 - 1.0)
        zoneBrightPct: Number(param('Bright Zone Percent') || 30) / 100.0,
        zoneTangentPct: Number(param('Tangent Zone Percent') || 60) / 100.0,

        // Player light defaults
        playerRadiusDefault: Number(param('Player radius')),
        defaultTint: param('Default Tint') || '#161616',
        defaultVignette: param('Vignette Color') || '#000000',
        vignetteScale: Number(param('Vignette Scale') || 0.4),
        vignetteSharpness: Number(param('Vignette Sharpness') || 0.08),
        playerInfluence: Number(param('Player Light Influence') || 1.3),
        breathingSpeed: Number(param('Breathing Speed') || 0.05),
        // HARDCODE-OVERRIDE:_eventsClearVignette = false.
        // В рабочем старом SuperDuperLight было false. При true каждый event-свет
        // вырезает яркую дырку в виньетке и заливает её непрозрачным цветом →
        // маленькие цветные света «инвертируются» (тёмный центр, яркое кольцо).
        // ПРАВКА plugins.js НЕ помогала: RPG Maker перегенерирует его из редактора.
        // Если захочешь вернуть — поставь в Plugin Manager И удали эту строку
        // (верни param('Events Clear Vignette') === 'true').
        eventsClearVignette: false,
        vignetteClearMult: Number(param('Vignette Clear Multiplier') || 1),
        flashlightOffset: Number(param('Flashlight offset') || 0),

        // Walls / Regions
        wallSoftness: Math.min(Number(param('Wall Softness') || 10), 24),
        wallPresetId: param('Wall Preset ID') || '',
        wallIsoOffset: Number(param('Iso Bottom Offset') || 3),
        wallTintOpacity: Number(param('Wall Tint Opacity') || 0.35),

        // Debug
        debugMode: (param('Debug Mode') === 'true'),

        // === Shadow system (tile-based) ===
        useRealShadows: (param('Use Real Shadows') !== 'false'), // по умолчанию ON
        activationFrames: Number(param('Activation Time (frames)') || 18),

        // === Map-local switches ===
        // Лок.переключатель (карта M, слот N) хранится в глобальном переключателе
        // (base + M*stride + N), чтобы условия страниц события могли его проверять.
        // base=0 → хранить отдельно на $gameSystem (только скрипт/команды, без страниц).
        mapSwitchBase: Number(param('MapSwitch Base') || 0),
        mapSwitchStride: Math.max(1, Number(param('MapSwitch Stride') || 10))
    };

    // =========================================================================
    // SECTION: UTILITIES — Color
    // =========================================================================

    /**
     * Цветовые утилиты. Без зависимостей.
     */
    var Color = {
        hexToRgb: function(hex) {
            if (!hex) return { r: 0, g: 0, b: 0 };
            // Поддержка shorthand (#fff)
            var shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            hex = hex.replace(shorthand, function(m, r, g, b) {
                return r + r + g + g + b + b;
            });
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
                : { r: 0, g: 0, b: 0 };
        },

        rgbToHex: function(rgb) {
            return "#" + ((1 << 24) +
                (Math.floor(rgb.r) << 16) +
                (Math.floor(rgb.g) << 8) +
                Math.floor(rgb.b)).toString(16).slice(1);
        },

        /**
         * Гарантирует, что строка цвета начинается с '#'.
         */
        ensureHash: function(s) {
            if (!s) return '#000000';
            return (s.charAt(0) !== '#') ? '#' + s : s;
        }
    };

    // =========================================================================
    // SECTION: UTILITIES — Math
    // =========================================================================

    var MathUtil = {
        clamp: function(v, min, max) {
            return Math.min(Math.max(v, min), max);
        },

        /**
         * Защита от NaN и Infinity. Используется везде, где работают координаты.
         */
        isValid: function(n) {
            return !isNaN(n) && isFinite(n);
        },

        /**
         * Linear interpolation.
         */
        lerp: function(a, b, t) {
            return a + (b - a) * t;
        }
    };

    // =========================================================================
    // SECTION: UTILITIES — Geometry (Bresenham Raycast)
    // =========================================================================

    /**
     * ЕДИНСТВЕННАЯ реализация raycast в проекте (было 3 копии).
     *
     * Алгоритм: Bresenham line от (x1,y1) до (x2,y2).
     * Возвращает false, если на пути есть тайл с регионом из blockedRegions.
     * Возвращает true, если достигли цели.
     *
     * @param {number} x1 - стартовая X в tile coordinates (real)
     * @param {number} y1 - стартовая Y в tile coordinates (real)
     * @param {number} x2 - целевая X
     * @param {number} y2 - целевая Y
     * @param {object} blockedRegions - { regionId: colorHex }
     * @returns {boolean} true если путь свободен
     */
    function raycastClear(x1, y1, x2, y2, blockedRegions) {
        var dx = Math.abs(x2 - x1);
        var dy = Math.abs(y2 - y1);
        var sx = (x1 < x2) ? 1 : -1;
        var sy = (y1 < y2) ? 1 : -1;
        var err = dx - dy;
        var x = x1, y = y1;

        for (var i = 0; i < MAX_RAYCAST_STEPS; i++) {
            var regionId = $gameMap.regionId(Math.round(x), Math.round(y));
            if (blockedRegions[regionId]) return false;
            if (Math.abs(x - x2) < 0.5 && Math.abs(y - y2) < 0.5) break;
            var e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx)  { err += dx; y += sy; }
        }
        return true;
    }


    // =========================================================================
    // SECTION: FALLOFF PRESETS PARSER
    // =========================================================================

    /**
     * Парсит структуру пресетов затухания.
     * Возвращает { id: [{ pos, alpha }, ...] }
     */
    var FalloffPresets = (function() {
        var presets = {};

        function parseSteps(stepsRawJson) {
            var steps = [];
            try {
                var raw = JSON.parse(stepsRawJson || '[]');
                for (var j = 0; j < raw.length; j++) {
                    var sData = JSON.parse(raw[j]);
                    steps.push({ pos: Number(sData.Percent), alpha: Number(sData.Opacity) });
                }
                steps.sort(function(a, b) { return a.pos - b.pos; });
            } catch (e) {
                if (CONFIG.debugMode) console.warn('[SDLight] Falloff steps parse fail:', e);
            }
            return steps;
        }

        // Парсим пресеты из параметров
        var parsedFromParams = false;
        try {
            var rawPresets = param('Falloff Presets');
            if (rawPresets && rawPresets !== '[]') {
                var parsedList = JSON.parse(rawPresets);
                for (var i = 0; i < parsedList.length; i++) {
                    try {
                        var pData = JSON.parse(parsedList[i]);
                        var pId = String(pData.ID || '').trim();
                        if (!pId) continue;
                        presets[pId] = parseSteps(pData.Steps);
                        parsedFromParams = true;
                    } catch (e) { /* skip */ }
                }
            }
        } catch (e) { /* skip */ }

        // Fallback: если параметры пустые (RPG Maker сбросил) — используем захардкоженные
        if (!parsedFromParams || Object.keys(presets).length === 0) {
            var HARDCODED_PRESETS = {
                'global': [{pos:0.00, alpha:0.70}, {pos:0.01, alpha:0.65}, {pos:0.02, alpha:0.50},
                           {pos:0.03, alpha:0.45}, {pos:0.05, alpha:0.30}, {pos:1.00, alpha:0.00}],
                'global?': [{pos:0.00, alpha:0.20}, {pos:1.00, alpha:0.00}],
                'global2': [{pos:0.00, alpha:0.55}, {pos:1.00, alpha:0.00}],
                'spichka': [{pos:0.00, alpha:0.90}, {pos:0.14, alpha:0.70}, {pos:0.30, alpha:0.20},
                            {pos:0.45, alpha:0.10}, {pos:1.00, alpha:0.00}],
                'lamp':    [{pos:0.00, alpha:0.80}, {pos:0.10, alpha:0.65}, {pos:0.25, alpha:0.45},
                            {pos:0.42, alpha:0.30}, {pos:0.54, alpha:0.20}, {pos:0.65, alpha:0.10},
                            {pos:1.00, alpha:0.00}],
                '1':       [{pos:0.00, alpha:1.00}, {pos:1.00, alpha:0.00}],
                '3':       [{pos:0.00, alpha:0.85}, {pos:1.00, alpha:0.00}],
                '2':       [{pos:0.00, alpha:0.50}, {pos:0.20, alpha:0.10}, {pos:1.00, alpha:0.00}]
            };
            for (var hId in HARDCODED_PRESETS) {
                if (!presets[hId]) presets[hId] = HARDCODED_PRESETS[hId];
            }
            if (CONFIG.debugMode) console.log('[SDLight] Falloff Presets loaded from HARDCODED fallback:', Object.keys(presets).join(','));
        }

        var defaultSteps = parseSteps(param('Default Falloff Config'));

        // Снимок пресетов, существующих на момент загрузки — считаются
        // "встроенными" (редактировать можно, удалять — нет). Пресеты, созданные
        // через register() позже — пользовательские (удалять можно).
        var builtinIds = {};
        Object.keys(presets).forEach(function(k) { builtinIds[k] = true; });

        return {
            /**
             * Возвращает массив шагов пресета по ID, или null если не найден.
             * ВНИМАНИЕ: возвращает ЖИВУЮ ссылку на внутренний массив — мутация
             * поля объекта отражается на рендере в тот же кадр.
             */
            get: function(id) {
                return (id && presets[id]) ? presets[id] : null;
            },

            /**
             * Возвращает дефолтные шаги затухания.
             */
            getDefault: function() {
                return defaultSteps;
            },

            /**
             * Регистрирует новый пресет (для runtime-расширений / live-редактора).
             */
            register: function(id, steps) {
                if (id && Array.isArray(steps)) {
                    presets[id] = steps.slice().sort(function(a, b) { return a.pos - b.pos; });
                }
            },

            /** Список всех ID пресетов. */
            ids: function() {
                return Object.keys(presets);
            },

            /** true, если пресет существовал на момент загрузки (нельзя удалять). */
            isBuiltin: function(id) {
                return !!builtinIds[id];
            },

            /** Удаляет только пользовательский пресет. false, если встроенный. */
            remove: function(id) {
                if (!id || builtinIds[id]) return false;
                delete presets[id];
                return true;
            }
        };
    })();

    // =========================================================================
    // SECTION: STATE (private)
    // =========================================================================

    /**
     * Глобальное состояние плагина. Раньше было разбросано по 8+ переменных.
     */
    var state = {
        currentTint: CONFIG.defaultTint,
        targetTint: CONFIG.defaultTint,
        tintSpeed: 0,
        tintTimer: 0,

        currentVignette: CONFIG.defaultVignette,
        cachedVignetteRadius: 0,

        blockedRegions: {},

        lightEvents: [],         // [{ eventId, type, radius, color, ... }]
        oldMapId: 0,
        firstRun: true,

        playerFlickerOffset: 0,
        autotileCache: {}        // key: "color_mask_iso_short" -> Bitmap
    };

    // Инициализация blockedRegions из параметров
    (function initBlockedRegions() {
        var raw = param('Region Settings');  // <-- param() с fallback
        console.log('[SDLight] Region Settings raw =', JSON.stringify(raw));
        console.log('[SDLight] useRealShadows =', param('Use Real Shadows'));
        console.log('[SDLight] CONFIG.useRealShadows =', CONFIG.useRealShadows);
        if (!raw) { console.log('[SDLight] Region Settings пустой — shadow system OFF'); return; }
        var groups = raw.split(',');
        var loaded = 0;
        for (var i = 0; i < groups.length; i++) {
            var pair = groups[i].trim().split(/\s+/);
            if (pair.length >= 2) {
                var id = Number(pair[0]);
                var col = pair[1];
                if (!isNaN(id)) {
                    state.blockedRegions[id] = Color.ensureHash(col);
                    loaded++;
                }
            }
        }
        console.log('[SDLight] blockedRegions loaded:', loaded, '→', Object.keys(state.blockedRegions).join(','));
    })();

    // =========================================================================
    // SECTION: SHADOW HELPERS (tile-based)
    // =========================================================================
    //
    // Tile-based shadow использует blockedRegions напрямую через raycastClear().
    // Дополнительная регистрация сегментов/углов не нужна — Bresenham сам
    // проверяет регионы на каждом шаге.
    // =========================================================================

    /**
     * No-op — для tile-based shadow регистрация не нужна.
     * Сохранено для совместимости с существующими вызовами в _updateMask.
     */
    function buildShadowCasters() {
        // tile-based shadow использует blockedRegions напрямую
    }

    /**
     * Сброс теневой системы при смене карты (no-op для tile-based).
     */
    function resetShadowSystem() {
        // tile-based shadow не имеет состояния для сброса
    }

    //
    // ВНИМАНИЕ: setters/getters хранят данные на самом $gameVariables.
    // Префикс _txReserv* используется редко, _tx* — основное хранилище.
    // Это позволяет сохранять состояние через стандартный save/load
    // (т.к. $gameVariables серилизуется полностью).
    //
    // Совместимость с Terrax Lighting обеспечивается 1:1 именами методов.
    // =========================================================================

    /**
     * Базовый setter/getter с дефолтом и optional validator.
     */
    function defineVarProp(key, defaultValue, validator) {
        Game_Variables.prototype['Set' + key] = function(v) {
            if (validator) v = validator(v);
            this['_tx' + key] = v;
        };
        Game_Variables.prototype['Get' + key] = function() {
            var v = this['_tx' + key];
            return (v !== undefined) ? v : defaultValue;
        };
    }

    // Light radius (игрок)
    defineVarProp('Radius', CONFIG.playerRadiusDefault, Number);
    defineVarProp('RadiusTarget', CONFIG.playerRadiusDefault, Number);
    defineVarProp('RadiusSpeed', 0, Number);

    // Player visual props
    defineVarProp('PlayerColor', '#FFFFFF', function(v) {
        return Color.ensureHash(v);
    });
    defineVarProp('PlayerBrightness', 1.0, Number);
    defineVarProp('PlayerSmoothness', 1.0, Number);
    defineVarProp('PlayerPreset', null);
    defineVarProp('PlayerVignetteMult', undefined);

    // Flashlight
    defineVarProp('Flashlight', false);
    defineVarProp('FlashlightDensity', 3, Number);
    defineVarProp('FlashlightLength', 8, Number);
    defineVarProp('FlashlightWidth', 12, Number);

    // Fire flicker
    defineVarProp('Fire', false);

    // Saved state (для save/load)
    defineVarProp('SavedTint');
    defineVarProp('SavedVignette');

    // Blocked regions (для save/load)
    defineVarProp('BlockedRegions');

    // =========================================================================
    // SECTION: SENSOR — Light zones & intensity
    // =========================================================================
    //
    // Архитектура: ОДИН общий цикл по источникам + общие helpers.
    // В оригинале было 3 копии: getLightZone, getLightIntensity, _renderDebugHitboxes.
    //
    // Координаты: все расчёты в TILE space (realX, realY).
    // Для raycast используем именно tile coords (regionId работает в тайлах).
    //
    // Для intensity (0..1) используем linear falloff от центра (1.0) до края (0.0).
    // Для zone (0..3) используем пороги zoneBrightPct / zoneTangentPct.
    // =========================================================================

    /**
     * Возвращает "процент удалённости" от центра для кругового/овального источника.
     * 0 = в центре, 1 = на границе, >1 = снаружи.
     *
     * @param {number} tx,ty - цель (tile coords)
     * @param {number} sx,sy - источник (tile coords)
     * @param {number} rX,rY - радиусы в pixel units
     * @param {number} pw,ph - tileWidth, tileHeight
     */
    function getCirclePercent(tx, ty, sx, sy, rX, rY, pw, ph) {
        var dxPx = Math.abs(tx - sx) * pw;
        var dyPx = Math.abs(ty - sy) * ph;
        var rYeff = (rY !== undefined && rY > 0) ? rY : rX;
        return Math.sqrt((dxPx / rX) * (dxPx / rX) + (dyPx / rYeff) * (dyPx / rYeff));
    }

    /**
     * Возвращает "процент удалённости" от центра для конуса фонарика.
     * 0 = у источника, 1 = на границе, >1 = снаружи.
     * Возвращает -1 если точка не в конусе.
     *
     * @param {number} tx,ty - цель (tile coords)
     * @param {number} sx,sy - источник (tile coords)
     * @param {number} dir - 2/4/6/8 (RPG Maker direction)
     * @param {number} length - длина конуса в tile units
     * @param {number} width - ширина конуса в tile units
     */
    function getConePercent(tx, ty, sx, sy, dir, length, width) {
        var dx = tx - sx, dy = ty - sy;
        var halfW = width / 2;
        var pctLen = 0, pctWid = 0, inside = false;

        switch (dir) {
            case 2: // down
                if (dy >= 0 && dy <= length && Math.abs(dx) <= halfW) {
                    pctLen = dy / length;
                    pctWid = Math.abs(dx) / halfW;
                    inside = true;
                }
                break;
            case 8: // up
                if (dy <= 0 && Math.abs(dy) <= length && Math.abs(dx) <= halfW) {
                    pctLen = Math.abs(dy) / length;
                    pctWid = Math.abs(dx) / halfW;
                    inside = true;
                }
                break;
            case 4: // left
                if (dx <= 0 && Math.abs(dx) <= length && Math.abs(dy) <= halfW) {
                    pctLen = Math.abs(dx) / length;
                    pctWid = Math.abs(dy) / halfW;
                    inside = true;
                }
                break;
            case 6: // right
                if (dx >= 0 && dx <= length && Math.abs(dy) <= halfW) {
                    pctLen = dx / length;
                    pctWid = Math.abs(dy) / halfW;
                    inside = true;
                }
                break;
        }
        return inside ? Math.max(pctLen, pctWid) : -1;
    }

    /**
     * Преобразует процент удалённости (0..1) в зону (0..3).
     */
    function percentToZone(pct) {
        if (pct <= CONFIG.zoneBrightPct) return ZONE.BRIGHT;
        if (pct <= CONFIG.zoneTangentPct) return ZONE.TANGENT;
        return ZONE.ACTUAL;
    }

    /**
     * Строит "source" объект для игрока.
     * Source = { x, y, type, radius, radiusY, brightness, direction, flashLength, flashWidth }
     *
     * ВАЖНО: если игрок НЕ в режиме фонарика, смещаем его y-координату
     * (в оригинале это было `flashlightoffset / tileHeight`).
     * Это нужно для совпадения логического центра с визуальным.
     */
    function buildPlayerSource(ph) {
        var px = $gamePlayer._realX;
        var py = $gamePlayer._realY;
        if (!$gameVariables.GetFlashlight()) {
            py -= (CONFIG.flashlightOffset / ph);
        }
        return {
            kind: 'player',
            x: px, y: py,
            type: $gameVariables.GetFlashlight() ? LIGHT_TYPE.FLASHLIGHT : LIGHT_TYPE.NORMAL,
            radius: $gameVariables.GetRadius(),
            radiusY: $gameVariables.GetRadius(), // у игрока всегда круг
            brightness: $gameVariables.GetPlayerBrightness(),
            direction: $gamePlayer._direction,
            flashLength: $gameVariables.GetFlashlightLength(),
            flashWidth: $gameVariables.GetFlashlightWidth(),
            isFire: $gameVariables.GetFire()
        };
    }

    /**
     * Строит "source" объект для события.
     * Берёт данные из состояния события (распарсенные Note tags).
     */
    function buildEventSource(event, light) {
        var dir = event._direction;
        if (light.flashlightDir && DIRECTION_MAP[light.flashlightDir]) {
            dir = DIRECTION_MAP[light.flashlightDir];
        }
        return {
            kind: 'event',
            x: event._realX, y: event._realY,
            type: light.type,
            radius: light.radius,
            radiusY: (light.radiusY !== undefined) ? light.radiusY : light.radius,
            brightness: light.brightness,
            direction: dir,
            flashLength: light.flashLength || 8,
            flashWidth: light.flashWidth || 12,
            isFire: (light.type === LIGHT_TYPE.FIRE)
        };
    }

    /**
     * Универсальный расчёт "процента удалённости" для любого источника.
     * Возвращает -1 если точка вне источника.
     *
     * Для FLASHLIGHT — это cone percent.
     * Для NORMAL/FIRE — это circle percent.
     */
    function getLightPercent(tx, ty, source, pw, ph) {
        if (source.type === LIGHT_TYPE.FLASHLIGHT) {
            return getConePercent(tx, ty, source.x, source.y, source.direction,
                                  source.flashLength, source.flashWidth);
        }
        return getCirclePercent(tx, ty, source.x, source.y,
                                source.radius, source.radiusY, pw, ph);
    }

    /**
     * Считает intensity (0..1) от ОДНОГО источника.
     * Учитывает brightness самого источника.
     * Возвращает 0 если вне источника или нет прямой видимости.
     */
    function intensityFromSource(tx, ty, source, pw, ph) {
        var pct = getLightPercent(tx, ty, source, pw, ph);
        if (pct < 0 || pct > 1) return 0;
        if (!raycastClear(tx, ty, source.x, source.y, state.blockedRegions)) return 0;

        var brightness = (source.brightness !== undefined) ? source.brightness : 1.0;
        return (1.0 - pct) * brightness;
    }

    /**
     * Глобальная освещённость карты (0..1).
     * Управляется через masterOpacityVar (значение 0..100).
     */
    function getGlobalBrightness() {
        if (CONFIG.masterOpacityVar <= 0) return 0;
        var mVal = Number($gameVariables.value(CONFIG.masterOpacityVar));
        return MathUtil.clamp(isNaN(mVal) ? 0 : mVal, 0, 100) / 100.0;
    }

    /**
     * ГЛАВНЫЙ SENSOR API #1: зона освещённости для персонажа.
     * 0=Тьма, 1=Фактический, 2=Касательный, 3=Яркий.
     *
     * Используется SuperDuperEnemies для флагов light_actual/tangent/bright.
     *
     * @param {Game_CharacterBase} character
     * @returns {number} 0..3
     */
    function getLightZone(character) {
        var tx = character._realX, ty = character._realY;
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();

        // Если карта полностью освещена — то сразу bright
        if (getGlobalBrightness() >= 1.0) return ZONE.BRIGHT;

        var maxZone = ZONE.DARK;

        // 1. Свет игрока
        var pRad = $gameVariables.GetRadius();
        if (pRad > 0) {
            var playerSrc = buildPlayerSource(ph);
            var pct = getLightPercent(tx, ty, playerSrc, pw, ph);
            if (pct >= 0 && pct <= 1 &&
                raycastClear(tx, ty, playerSrc.x, playerSrc.y, state.blockedRegions)) {
                maxZone = Math.max(maxZone, percentToZone(pct));
                if (maxZone === ZONE.BRIGHT) return ZONE.BRIGHT;
            }
        }

        // 2. Свет событий
        for (var i = 0; i < state.lightEvents.length; i++) {
            var light = state.lightEvents[i];
            if (!light.active) continue;
            if (light.condFn && !light.condFn($gameSwitches, $gameVariables)) continue;
            var event = $gameMap.event(light.eventId);
            if (!event) continue;

            var src = buildEventSource(event, light);
            var pct = getLightPercent(tx, ty, src, pw, ph);
            if (pct >= 0 && pct <= 1 &&
                raycastClear(tx, ty, src.x, src.y, state.blockedRegions)) {
                maxZone = Math.max(maxZone, percentToZone(pct));
                if (maxZone === ZONE.BRIGHT) return ZONE.BRIGHT;
            }
        }

        return maxZone;
    }

    /**
     * ГЛАВНЫЙ SENSOR API #2: интенсивность освещения (0..1).
     * Суммирует вклад всех источников (с учётом перекрытий).
     * Сохранено поведение оригинала: max(1.0, total + globalLight).
     *
     * @param {Game_CharacterBase} character
     * @returns {number} 0..1
     */
    function getLightIntensity(character) {
        var tx = character._realX, ty = character._realY;
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();

        var globalLight = getGlobalBrightness();
        if (globalLight >= 1.0) return 1.0;

        var total = 0;

        // 1. Свет игрока
        var pRad = $gameVariables.GetRadius();
        if (pRad > 0) {
            total += intensityFromSource(tx, ty, buildPlayerSource(ph), pw, ph);
        }

        // 2. Свет событий
        for (var i = 0; i < state.lightEvents.length; i++) {
            var light = state.lightEvents[i];
            if (!light.active) continue;
            if (light.condFn && !light.condFn($gameSwitches, $gameVariables)) continue;
            var event = $gameMap.event(light.eventId);
            if (!event) continue;
            total += intensityFromSource(tx, ty, buildEventSource(event, light), pw, ph);
        }

        return Math.min(1.0, total + globalLight);
    }

    /**
     * Регистрируем sensor API на Game_CharacterBase (для вызовов из событий).
     * В оригинале тоже было здесь, но через прямое prototype присвоение.
     */
    Game_CharacterBase.prototype.getLightZone = function() {
        return getLightZone(this);
    };

    Game_CharacterBase.prototype.getLightIntensity = function() {
        return getLightIntensity(this);
    };

    // =========================================================================
    // SECTION: NOTE PARSER — парсинг тегов в Note событий
    // =========================================================================
    //
    // Поддерживаемые форматы (первые слова строки Note):
    //   light RADIUS #COLOR [модификаторы...]
    //   light RADIUS:RADIUS_Y #COLOR ...                 (овал)
    //   fire  RADIUS #COLOR ...                          (с мерцанием)
    //   flashlight LENGTH WIDTH #COLOR ...               (конус)
    //
    // Модификаторы (могут быть в любом порядке после COLOR):
    //   NUM                 — vignetteMultiplier (расширение виньетки)
    //   NUM                 — brightness (если второй числовой токен)
    //   NUM                 — falloff smoothness (если третий числовой)
    //   bNN                 — brightness в % (альтернатива числу, b50 = 0.5)
    //   dN                  — direction modifier (1=up,2=right,3=down,4=left)
    //   preset_id           — ID пресета затухания (из Falloff Presets)
    //    NUM                 — customId для flashlight, или flashDir для flashlight type
    //    cycle COL1 F1 COL2 F2 ... — анимация циклических цветов
    //
    // ВНИМАНИЕ: оригинал использовал parts.shift() в разных ветках и мутировал
    // массив в процессе. Здесь — два прохода с явной структурой.
    // =========================================================================

    var NoteParser = {
        /**
         * Создаёт пустой lightObj с дефолтами.
         */
        createDefault: function(type) {
            return {
                eventId: 0,                 // Заполняется вызывающим кодом
                type: type,
                radius: 100,
                radiusY: 100,
                color: '#FFFFFF',
                brightness: 1.0,
                falloff: 1.0,
                presetId: null,
                direction: 0,
                active: true,
                customId: 0,
                cycle: [],
                cycleIndex: 0,
                cycleTimer: 0,
                flashLength: 8,
                flashWidth: 12,
                flashlightDir: 0,
                vignetteMultiplier: undefined,
                flickerOffset: 0,

                // --- Плавное включение/выключение ---
                activationProgress: 0,      // 0..1 (0=выкл, 1=полностью вкл)
                activationTarget: 1,        // к чему стремимся
                pendingDeactivation: false, // true если ждём полного затухания перед удалением

                // --- Условие свечения (строка-выражение, прекомпилится в condFn) ---
                cond: null,                 // строка, напр. "S5 && V12>=3"
                condFn: null                // function() -> bool, null = всегда светит
            };
        },

        /**
         * Главная функция парсинга.
         * @param {string} noteText — содержимое Note события (первая строка)
         * @returns {object|null} — lightObj или null если это не light/fire/flashlight
         */
        parse: function(noteText) {
            if (!noteText || typeof noteText !== 'string') return null;
            var tokens = noteText.trim().split(/\s+/);
            var cmd = (tokens.shift() || '').toLowerCase();
            if (cmd !== 'light' && cmd !== 'fire' && cmd !== 'flashlight') return null;

            var type = (cmd === 'fire') ? LIGHT_TYPE.FIRE
                     : (cmd === 'flashlight') ? LIGHT_TYPE.FLASHLIGHT
                     : LIGHT_TYPE.NORMAL;

            var light = this.createDefault(type);

            // 1. Префиксные токены: radius или (length, width)
            if (type === LIGHT_TYPE.FLASHLIGHT) {
                light.flashLength = Number(tokens.shift()) || 8;
                light.flashWidth = Number(tokens.shift()) || 12;
            } else {
                var radTok = String(tokens.shift() || '');
                var radParts = radTok.split(':');
                light.radius = Number(radParts[0]) || 100;
                light.radiusY = (radParts.length > 1) ? (Number(radParts[1]) || light.radius) : light.radius;
            }

            // 2. Токен цвета или маркер "cycle"
            var colorTok = tokens.shift();

            // 3. Если colorTok === 'cycle' — собираем пары color/frames
            if (colorTok && colorTok.toLowerCase() === 'cycle') {
                light.color = '#FFFFFF';
                while (tokens.length >= 2) {
                    var cColor = String(tokens.shift());
                    var cFrames = Number(tokens.shift());
                    if (!isNaN(cFrames) && cFrames > 0) {
                        light.cycle.push({
                            color: Color.ensureHash(cColor),
                            frames: cFrames
                        });
                    }
                }
                return light;
            }

            // 4. Цвет
            light.color = colorTok ? Color.ensureHash(colorTok) : '#FFFFFF';

            // 5. Извлекаем preset-токены (в любом месте)
            var remaining = [];
            for (var i = 0; i < tokens.length; i++) {
                var t = tokens[i];
                if (FalloffPresets.get(t)) {
                    light.presetId = t;
                } else {
                    remaining.push(t);
                }
            }

            // 6. Парсим модификаторы (важен порядок!)
            // Паттерн: [mult] [brightness_or_bNN] [falloff] [dN ...] [customId/flashDir]
            var idx = 0;
            function peek() { return remaining[idx]; }
            function next() { return remaining[idx++]; }
            function isNum(s) { return s !== undefined && !isNaN(Number(s)); }
            function isTagB(s) { return s && /^b\d+$/i.test(s); }
            function isTagD(s) { return s && /^d\d+$/i.test(s); }

            // 6a. Необязательный vignetteMultiplier (первое число, если не tag)
            if (isNum(peek()) && !isTagB(peek())) {
                light.vignetteMultiplier = Number(next());
            }

            // 6b. Brightness: либо bNN, либо число
            if (isTagB(peek())) {
                light.brightness = Number(next().substring(1)) / 100;
            } else if (isNum(peek())) {
                light.brightness = Number(next());
            }

            // 6c. Falloff smoothness (число после brightness)
            if (isNum(peek())) {
                light.falloff = Number(next());
            }

            // 6d. Остальные модификаторы (dN, customId/flashDir)
            while (idx < remaining.length) {
                var tok = next();
                if (isTagB(tok)) {
                    light.brightness = Number(tok.substring(1)) / 100;
                } else if (isTagD(tok)) {
                    light.direction = Number(tok.substring(1));
                } else if (isNum(tok)) {
                    if (type === LIGHT_TYPE.FLASHLIGHT) {
                        light.flashlightDir = Number(tok);
                    } else {
                        light.customId = Number(tok);
                    }
                }
                // Иначе — нераспознанный токен, игнорируем
            }

            return light;
        }
    };

    // =========================================================================
    // SECTION: RENDERER HELPERS
    // =========================================================================
    //
    // Унифицированные хелперы для конвертации tile-coords -> screen-coords,
    // и для radial fill (вместо 14-параметричной функции).
    // В оригинале один и тот же расчёт позиции повторялся 5+ раз.
    // =========================================================================

    /**
     * Конвертирует tile-coords в screen-coords относительно камеры.
     * ВНИМАНИЕ: добавляет CANVAS_PADDING по X (из-за bitmap margin).
     *
     * @param {number} realX,realY - позиция в tile coords
     * @param {number} pw,ph - tileWidth, tileHeight
     * @returns {{x:number, y:number}}
     */
    function tileToScreen(realX, realY, pw, ph) {
        var dx = Math.floor($gameMap.displayX());
        var dy = Math.floor($gameMap.displayY());
        var realDx = $gameMap.displayX();
        var realDy = $gameMap.displayY();

        var x = (pw / 2) + ((realX - dx) * pw) + CANVAS_PADDING;
        var y = (ph / 2) + ((realY - dy) * ph);

        // Loop scroll handling (в оригинале повторялось в 3 местах)
        if ($dataMap.scrollType === 2 || $dataMap.scrollType === 3) {
            if (realDx - 10 > realX) x += $gameMap.width() * pw;
        }
        if ($dataMap.scrollType === 1 || $dataMap.scrollType === 3) {
            if (realDy - 10 > realY) y += $gameMap.height() * ph;
        }
        return { x: x, y: y };
    }

    // (polygonToScreen удалён — tile-based shadow использует buildLitTilesPath напрямую)

    /**
     * Спец-вариант для игрока: другой scroll-handling (без -10).
     * В оригинале было `if (realDx > $gamePlayer.x)` вместо `realDx - 10 > lx`.
     */
    function playerToScreen(pw, ph) {
        var px = $gamePlayer._realX, py = $gamePlayer._realY;
        var dx = Math.floor($gameMap.displayX());
        var dy = Math.floor($gameMap.displayY());
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();

        var x = (pw / 2) + ((px - dx) * pw) + CANVAS_PADDING;
        var y = (ph / 2) + ((py - dy) * ph);

        if (realDx > $gamePlayer.x) x += $gameMap.width() * pw;
        if (realDy > $gamePlayer.y) y += $gameMap.height() * ph;

        return { x: x, y: y };
    }

    /**
     * Radial gradient fill с OPTIONS OBJECT вместо 14 позиционных параметров.
     *
     * Оригинал: radialgradientFillRectSDL(x1,y1,r1,r2,color1,color2,flicker,brightness,direction,isVision,cachedOffset,smoothness,presetId,radiusY)
     *
     * @param {Bitmap} bitmap
     * @param {object} opts:
     *   - x, y: позиция центра
     *   - innerR, outerR: радиусы (innerR обычно 0)
     *   - color: цвет (#hex)
     *   - isVision: если true — рисуем "чёрную дыру" (для cutVignette)
     *   - brightness: множитель alpha (0..1)
     *   - smoothness: плавность затухания (0..1, 1=постоянная яркость до края)
     *   - presetId: id пресета falloff
     *   - radiusY: для овала
     *   - direction: 0=круг, 1-4=направление (1=up, 2=right, 3=down, 4=left)
     *               рисует прямоугольник-плечо вместо круга
     *   - isFire: если true — добавляет flicker offset
     *   - flickerOffset: смещение для эффекта мерцания
     */
    function radialFill(bitmap, opts) {
        var x = opts.x;
        var y = opts.y;
        var innerR = opts.innerR || 0;
        var outerR = opts.outerR;
        var color = opts.color;
        var isVision = !!opts.isVision;
        var brightness = (opts.brightness !== undefined) ? opts.brightness : 1.0;
        var smoothness = (opts.smoothness !== undefined) ? opts.smoothness : 1.0;
        var presetId = opts.presetId || null;
        var radiusY = (opts.radiusY !== undefined && opts.radiusY > 0) ? opts.radiusY : outerR;
        var direction = opts.direction || 0;
        var isFire = !!opts.isFire;
        var flickerOffset = opts.flickerOffset || 0;

        if (!MathUtil.isValid(x) || !MathUtil.isValid(y) ||
            !MathUtil.isValid(innerR) || !MathUtil.isValid(outerR) ||
            innerR < 0 || outerR < 0) return;

        var ctx = bitmap._context;

        // Apply flicker effect
        if (isFire) {
            outerR = Math.max(0, outerR - flickerOffset);
            if (!isVision) {
                var rgbF = Color.hexToRgb(color);
                rgbF.g = MathUtil.clamp(rgbF.g + (flickerOffset * 1.5 - 5), 0, 255);
                color = Color.rgbToHex(rgbF);
            }
        }

        // Compute effective outer radii (with optional oval)
        var rX = outerR;
        var rY = (radiusY !== outerR && flickerOffset > 0)
               ? rX * (radiusY / (rX + flickerOffset))
               : radiusY;
        var isOval = (rX !== rY);

        var alpha = MathUtil.clamp(brightness, 0, 1);
        var startFade = Math.max(0, 1 - smoothness);
        var fadeDist = 1 - startFade;

        try {
            ctx.save();

            if (isOval) {
                ctx.translate(x, y);
                ctx.scale(1, rY / rX);
                ctx.translate(-x, -y);
            }

            var grad = ctx.createRadialGradient(x, y, innerR, x, y, outerR);
            var baseRgb = Color.hexToRgb(color);
            var baseStr = baseRgb.r + ',' + baseRgb.g + ',' + baseRgb.b;
            var startColor = isVision
                ? 'rgba(0,0,0,' + alpha + ')'
                : 'rgba(' + baseStr + ',' + alpha + ')';

            grad.addColorStop(0, startColor);
            grad.addColorStop(startFade, startColor);

            var preset = FalloffPresets.get(presetId) || FalloffPresets.getDefault();
            if (preset && preset.length > 0) {
                for (var s = 0; s < preset.length; s++) {
                    var step = preset[s];
                    var pos = startFade + fadeDist * step.pos;
                    var aVal = alpha * step.alpha;
                    var col = isVision
                        ? 'rgba(0,0,0,' + aVal + ')'
                        : 'rgba(' + baseStr + ',' + aVal + ')';
                    grad.addColorStop(pos, col);
                }
            } else {
                var endColor = isVision
                    ? 'rgba(0,0,0,0.0)'
                    : 'rgba(' + baseStr + ',0.0)';
                grad.addColorStop(1, endColor);
            }

            ctx.fillStyle = grad;

            // Directional arm (rectangle) or full circle
            if (direction === 0) {
                var pad = CANVAS_PADDING;
                ctx.fillRect(x - outerR - pad, y - outerR - pad,
                            (outerR * 2) + (pad * 2), (outerR * 2) + (pad * 2));
            } else {
                var halfTw = $gameMap.tileWidth() / 2;
                var halfTh = $gameMap.tileHeight() / 2;
                switch (direction) {
                    case 1: ctx.fillRect(x - outerR, y - halfTh, outerR * 2, outerR * 2); break;
                    case 2: ctx.fillRect(x - outerR, y - outerR, outerR + halfTw, outerR * 2); break;
                    case 3: ctx.fillRect(x - outerR, y - outerR, outerR * 2, outerR + halfTh); break;
                    case 4: ctx.fillRect(x - halfTw, y - outerR, outerR * 2, outerR * 2); break;
                }
            }

            bitmap._setDirty();
        } catch (e) {
            // Defensive: bad gradient params (NaN radius etc) — skip silently
        } finally {
            // Гарантированное восстановление canvas state (fix бага с clip без restore)
            try { ctx.restore(); } catch (e2) { /* ignore */ }
        }
    }

    /**
     * Специализированный fill для flashlight (конус).
     * Использует ту же логику что и оригинал, но с options object.
     *
     * @param {Bitmap} bitmap
     * @param {object} opts:
     *   - x, y: позиция источника
     *   - color: цвет
     *   - direction: 2/4/6/8
     *   - length, width: в tile units
     *   - isVision: режим (true = для cutVignette)
     *   - brightness: множитель alpha
     */
    function flashlightFill(bitmap, opts) {
        var x = opts.x;
        var y = opts.y;
        var color = opts.color;
        var direction = opts.direction;
        var length = opts.length;
        var width = opts.width;
        var isVision = !!opts.isVision;
        var brightness = (opts.brightness !== undefined) ? opts.brightness : 1.0;

        if (!MathUtil.isValid(x) || !MathUtil.isValid(y)) return;

        var pw = $gameMap.tileWidth();
        var ph = $gameMap.tileHeight();
        var ctx = bitmap._context;
        var alpha = MathUtil.clamp(brightness, 0, 1);

        // Cone in pixel units
        var lenPx = length * pw;
        var widPx = width * pw;

        // Cone bounding box
        var bx1 = x, by1 = y, bx2 = x, by2 = y;
        switch (direction) {
            case 2: bx1 = x - widPx / 2; by1 = y; bx2 = x + widPx / 2; by2 = y + lenPx; break;
            case 8: bx1 = x - widPx / 2; by1 = y - lenPx; bx2 = x + widPx / 2; by2 = y; break;
            case 4: bx1 = x - lenPx; by1 = y - widPx / 2; bx2 = x; by2 = y + widPx / 2; break;
            case 6: bx1 = x; by1 = y - widPx / 2; bx2 = x + lenPx; by2 = y + widPx / 2; break;
        }

        try {
            ctx.save();

            var grad = ctx.createLinearGradient(x, y, (bx1 + bx2) / 2, (by1 + by2) / 2);
            var baseRgb = Color.hexToRgb(color);
            var baseStr = baseRgb.r + ',' + baseRgb.g + ',' + baseRgb.b;

            grad.addColorStop(0, isVision ? 'rgba(0,0,0,' + alpha + ')' : 'rgba(' + baseStr + ',' + alpha + ')');
            grad.addColorStop(0.3, isVision ? 'rgba(0,0,0,' + (alpha * 0.7) + ')' : 'rgba(' + baseStr + ',' + (alpha * 0.7) + ')');
            grad.addColorStop(1, isVision ? 'rgba(0,0,0,0)' : 'rgba(' + baseStr + ',0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x, y);
            if (direction === 2) { ctx.lineTo(x - widPx/2, y); ctx.lineTo(x - widPx/2, y + lenPx); ctx.lineTo(x + widPx/2, y + lenPx); ctx.lineTo(x + widPx/2, y); }
            else if (direction === 8) { ctx.lineTo(x - widPx/2, y); ctx.lineTo(x - widPx/2, y - lenPx); ctx.lineTo(x + widPx/2, y - lenPx); ctx.lineTo(x + widPx/2, y); }
            else if (direction === 4) { ctx.lineTo(x, y - widPx/2); ctx.lineTo(x - lenPx, y - widPx/2); ctx.lineTo(x - lenPx, y + widPx/2); ctx.lineTo(x, y + widPx/2); }
            else if (direction === 6) { ctx.lineTo(x, y - widPx/2); ctx.lineTo(x + lenPx, y - widPx/2); ctx.lineTo(x + lenPx, y + widPx/2); ctx.lineTo(x, y + widPx/2); }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            bitmap._setDirty();
        } catch (e) { /* skip */ }
    }

    // =========================================================================
    // SECTION: RENDERER — Lightmask class
    // =========================================================================
    //
    // Контейнер PIXI, который рисует маску освещения поверх карты.
    // Алгоритм (каждый кадр):
    //   1. Очистить bitmap маски
    //   2. Залить виньеткой (gradient от центра к краям)
    //   3. Вырезать "дырки" в виньетке для источников света (destination-out)
    //   4. Добавить свет (lighter mode) — цветные радиальные градиенты
    //   5. Нарисовать стены (region blocks)
    //   6. (Опционально) debug hitboxes
    //   7. Добавить bitmap как Sprite с правильным subpixel-сдвигом
    // =========================================================================

    /**
     * Единый резолвер позиции источника в tile-координатах.
     * Синтетические источники (без реального event'а) хранят координаты в light.x/y.
     * Возвращает null, если позицию определить нельзя (реальный event исчез).
     */
    function lightTilePos(light) {
        if (!light) return null;
        if (light.synthetic) {
            if (light.x === undefined || light.y === undefined) return null;
            return { x: light.x, y: light.y };
        }
        var event = $gameMap.event(light.eventId);
        if (!event) return null;
        return { x: event._realX, y: event._realY };
    }

    function Lightmask() {
        this.initialize.apply(this, arguments);
    }

    var pixiVersion = PIXI.VERSION || "4.0.0";
    var BaseClass = pixiVersion.startsWith("v2") ? PIXI.DisplayObjectContainer : PIXI.Container;
    Lightmask.prototype = Object.create(BaseClass.prototype);
    Lightmask.prototype.constructor = Lightmask;

    Lightmask.prototype.initialize = function() {
        // Pixi v6+ base classes are ES6 classes: `PIXI.Container.call(this)`
        // throws "cannot be invoked without 'new'". PIXISuper (pixi_compat)
        // bridges the legacy ES5 super call; fall back to direct call only
        // on ancient Pixi where it still works.
        if (typeof PIXISuper === "function") {
            PIXISuper(BaseClass, this);
        } else {
            BaseClass.call(this);
        }
        this._width = Graphics.width;
        this._height = Graphics.height;
        this._sprites = [];
        this._createBitmap();
    };

    Lightmask.prototype._createBitmap = function() {
        // Bitmap создаётся с запасом BITMAP_MARGIN (для выхода света за экран)
        var w = Graphics.width || 800;
        var h = Graphics.height || 600;
        this._maskBitmap = new Bitmap(w + BITMAP_MARGIN, h + BITMAP_MARGIN);
    };

    Lightmask.prototype.update = function() {
        this._updateMask();
    };

    /**
     * Главный цикл рендера маски.
     * В оригинале был монолит на 118 строк — разбит на чёткие шаги.
     *
     * Архитектура теневой системы (если CONFIG.useRealShadows=true):
     *   - Visibility polygon используется как clip path в radialFill
     *   - Baked polygon cache — только массив точек (без bitmap)
     *   - Стены НЕ рисуются как тайлы (они работают как shadow casters)
     */
    Lightmask.prototype._updateMask = function() {
        // 1. Master alpha (управляется через $gameVariables)
        this._updateMasterAlpha();

        // 2. Reload events on new map + restore saved state
        var mapId = $gameMap.mapId();
        if (mapId !== state.oldMapId) {
            state.oldMapId = mapId;
            resetShadowSystem();
            reloadLightEvents();
            buildShadowCasters();        // Этап 1
            if (state.firstRun) {
                restoreSavedState();
                state.firstRun = false;
            }
            console.log('[SDLight-DIAG] map ' + mapId + ' enter → ' +
                'R=' + $gameVariables.GetRadius() +
                ' bright=' + $gameVariables.GetPlayerBrightness() +
                ' color=' + $gameVariables.GetPlayerColor() +
                ' preset=' + $gameVariables.GetPlayerPreset() +
                ' fire=' + $gameVariables.GetFire() +
                ' eventsClearVignette=' + CONFIG.eventsClearVignette +
                ' lights=' + state.lightEvents.length);
        }

        // 3. Clear bitmap
        this._maskBitmap.clear();

        // 4. Animate interpolations (включая новую smooth activation)
        updateRadiusInterpolation();
        updateFlickerOffsets();
        updateTintInterpolation();
        updateActivationProgresss();     // Этап 5

        // 5. Clear old sprites
        while (this._sprites.length > 0) {
            this.removeChild(this._sprites.pop());
        }

        var ctx = this._maskBitmap._context;

        // 6. Background: classic vignette (gradient tint -> vignette color)
        this._drawVignette();

        // 7. Cut holes for lights (destination-out = стирать маску)
        if (ctx) ctx.globalCompositeOperation = 'destination-out';
        this._cutVignetteForLights();
        this._renderPlayerLight(true);  // vision mode = cut

        // 8. Add colored lights (lighter = additive blending)
        if (ctx) ctx.globalCompositeOperation = 'lighter';
        this._renderPlayerLight(false); // color mode
        this._renderEventLights();

        // 9. Region blocks — закрашиваем тайлы стен всегда
        //    (в режиме real shadows tile-based shadow обрезает свет,
        //     но стены всё равно видны как тёмные тайлы для совместимости)
        if (Object.keys(state.blockedRegions).length > 0) {
            if (ctx) ctx.globalCompositeOperation = 'source-over';
            this._renderRegionBlocks();
        }

        // 10. Reset composition
        if (ctx) ctx.globalCompositeOperation = 'source-over';

        // 11. Debug hitboxes (если switch ВКЛ)
        if (CONFIG.sensorDebugSwitch > 0 &&
            $gameSwitches.value(CONFIG.sensorDebugSwitch)) {
            this._renderDebugHitboxes();
        }

        // 12. Subpixel jitter fix + add final sprite
        var realDx = $gameMap.displayX();
        var realDy = $gameMap.displayY();
        var fractX = realDx - Math.floor(realDx);
        var fractY = realDy - Math.floor(realDy);
        var shiftX = -CANVAS_PADDING - (fractX * $gameMap.tileWidth());
        var shiftY = -(fractY * $gameMap.tileHeight());
        this._addSprite(shiftX, shiftY, this._maskBitmap);
    };

    /**
     * Обновление alpha маски на основе Master Opacity Variable.
     * 0 = полная тьма (alpha = 1), 100 = полный свет (alpha = 0).
     */
    Lightmask.prototype._updateMasterAlpha = function() {
        if (CONFIG.masterOpacityVar <= 0 || !$gameVariables) {
            this.alpha = 1.0;
            return;
        }
        var mVal = Number($gameVariables.value(CONFIG.masterOpacityVar));
        if (isNaN(mVal)) mVal = 0;
        mVal = MathUtil.clamp(mVal, 0, 100);
        var progress = mVal / 100.0;
        this.alpha = MathUtil.clamp(1.0 - Math.pow(progress, 2.5), 0, 1);
    };

    /**
     * Рисует фоновую виньетку.
     * Если vignette_disable_switch ON — заливает纯ым тинтом без градиента.
     */
    Lightmask.prototype._drawVignette = function() {
        var ctx = this._maskBitmap._context;
        var w = this._maskBitmap.width;
        var h = this._maskBitmap.height;

        // Plain tint (если switch ON)
        if (CONFIG.vignetteDisableSwitch > 0 &&
            $gameSwitches.value(CONFIG.vignetteDisableSwitch)) {
            ctx.fillStyle = state.currentTint;
            ctx.fillRect(0, 0, w, h);
            this._maskBitmap._setDirty();
            return;
        }

        // Точка центра — позиция игрока
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var pos = playerToScreen(pw, ph);
        if (!MathUtil.isValid(pos.x) || !MathUtil.isValid(pos.y)) return;

        // Радиус виньетки
        var shortSide = Math.min(Graphics.width, Graphics.height);
        var pRadius = $gameVariables.GetRadius();
        var r2 = shortSide * CONFIG.vignetteScale;

        // Player light отодвигает виньетку (если influence > 0)
        var targetInfluence = 0;
        if (pRadius > 0) {
            var customMult = $gameVariables.GetPlayerVignetteMult();
            var mult = (customMult !== undefined) ? customMult : CONFIG.playerInfluence;
            targetInfluence = pRadius * mult;
            if (!$gameVariables.GetFlashlight()) targetInfluence *= 0.8;
        }

        // Smooth breathing
        if (Math.abs(state.cachedVignetteRadius - targetInfluence) > 1) {
            state.cachedVignetteRadius += (targetInfluence - state.cachedVignetteRadius) * CONFIG.breathingSpeed;
        } else {
            state.cachedVignetteRadius = targetInfluence;
        }
        r2 += state.cachedVignetteRadius;

        // Если tint и vignette одинаковые — простая заливка
        if (state.currentTint === state.currentVignette) {
            ctx.fillStyle = state.currentVignette;
            ctx.fillRect(0, 0, w, h);
            this._maskBitmap._setDirty();
            return;
        }

        // Gradient vignette
        try {
            var grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r2);
            grad.addColorStop(0, state.currentTint);
            grad.addColorStop(CONFIG.vignetteSharpness, state.currentTint);
            grad.addColorStop(1, state.currentVignette);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            this._maskBitmap._setDirty();
        } catch (e) { /* skip */ }
    };

    /**
     * Вырезает "дырки" в виньетке для источников света.
     * Это делает видимую область вокруг источников (событий).
     *
     * Использует тот же NoteParser result что и _renderEventLights.
     */
    Lightmask.prototype._cutVignetteForLights = function() {
        if (!CONFIG.eventsClearVignette) return;

        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();

        for (var i = 0; i < state.lightEvents.length; i++) {
            var light = state.lightEvents[i];
            if (!light.active) continue;
            if (light.condFn && !light.condFn($gameSwitches, $gameVariables)) continue;

            var mult = (light.vignetteMultiplier !== undefined)
                     ? light.vignetteMultiplier
                     : (CONFIG.eventsClearVignette ? CONFIG.vignetteClearMult : 0);
            if (mult <= 0) continue;

            var event = light.synthetic ? null : $gameMap.event(light.eventId);
            if (!light.synthetic && !event) continue;

            var tp = lightTilePos(light);
            if (!tp) continue;
            var pos = tileToScreen(tp.x, tp.y, pw, ph);
            if (!MathUtil.isValid(pos.x) || !MathUtil.isValid(pos.y)) continue;

            // Cut radius = effective radius * mult (с учётом flicker и activation)
            var effRadius = getEffectiveRadius(light);
            var cutRadius = (effRadius - light.flickerOffset) * mult;
            if (cutRadius < 0) cutRadius = 0;

            radialFill(this._maskBitmap, {
                x: pos.x, y: pos.y,
                innerR: 0, outerR: cutRadius,
                color: '#000000',
                isVision: true,        // режим "вырезание"
                brightness: light.brightness,
                smoothness: light.falloff,
                presetId: light.presetId,
                radiusY: getEffectiveRadiusY(light) * mult
            });
        }
    };

    /**
     * Рендерит свет игрока.
     * @param {boolean} isVisionMode - true=вырезание виньетки, false=добавление цвета
     */
    Lightmask.prototype._renderPlayerLight = function(isVisionMode) {
        var current = $gameVariables.GetRadius();
        var isFlashlight = $gameVariables.GetFlashlight();
        if (!isFlashlight && current <= 0) {
            if (!state._diagPlayerGated) {
                console.log('[SDLight-DIAG] _renderPlayerLight ПРОПУСК: radius=' + current +
                            ' flashlight=' + isFlashlight + ' — свет игрока НЕ рисуется');
                state._diagPlayerGated = true;
            }
            return;
        }
        if (state._diagPlayerGated) {
            console.log('[SDLight-DIAG] _renderPlayerLight ОК: radius=' + current + ' — рисую');
            state._diagPlayerGated = false;
        }

        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var pos = playerToScreen(pw, ph);
        if (!MathUtil.isValid(pos.x) || !MathUtil.isValid(pos.y)) return;

        var color = $gameVariables.GetPlayerColor();
        var isFire = $gameVariables.GetFire();
        var brightness = $gameVariables.GetPlayerBrightness();
        var smoothness = $gameVariables.GetPlayerSmoothness();
        var preset = $gameVariables.GetPlayerPreset();

        if (isFlashlight) {
            flashlightFill(this._maskBitmap, {
                x: pos.x, y: pos.y,
                color: color,
                direction: $gamePlayer._direction,
                length: $gameVariables.GetFlashlightLength(),
                width: $gameVariables.GetFlashlightWidth(),
                isVision: isVisionMode,
                brightness: brightness
            });
        } else {
            // Сдвигаем Y на flashlightOffset (визуальный центр игрока)
            var yPos = pos.y - CONFIG.flashlightOffset;
            var offset = isFire ? state.playerFlickerOffset : 0;

            radialFill(this._maskBitmap, {
                x: pos.x, y: yPos,
                innerR: 0, outerR: current,
                color: color,
                isVision: isVisionMode,
                brightness: brightness,
                smoothness: smoothness,
                presetId: preset,
                isFire: isFire,
                flickerOffset: offset
            });
        }
    };

    /**
     * Рендерит свет всех событий с Note tags light/fire/flashlight.
     */
    Lightmask.prototype._renderEventLights = function() {
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();

        for (var i = 0; i < state.lightEvents.length; i++) {
            var light = state.lightEvents[i];
            if (!light.active) continue;
            if (light.condFn && !light.condFn($gameSwitches, $gameVariables)) continue;

            var event = light.synthetic ? null : $gameMap.event(light.eventId);
            if (!light.synthetic && !event) continue;

            var tp = lightTilePos(light);
            if (!tp) continue;
            var pos = tileToScreen(tp.x, tp.y, pw, ph);
            if (!MathUtil.isValid(pos.x) || !MathUtil.isValid(pos.y)) continue;
            var renderColor = light.color;
            if (light.cycle && light.cycle.length > 0) {
                light.cycleTimer++;
                var currentCycle = light.cycle[light.cycleIndex];
                if (light.cycleTimer >= currentCycle.frames) {
                    light.cycleTimer = 0;
                    light.cycleIndex++;
                    if (light.cycleIndex >= light.cycle.length) light.cycleIndex = 0;
                }
                renderColor = light.cycle[light.cycleIndex].color;
            }

            var effRadius = getEffectiveRadius(light);

            if (light.type === LIGHT_TYPE.FLASHLIGHT) {
                flashlightFill(this._maskBitmap, {
                    x: pos.x, y: pos.y,
                    color: renderColor,
                    direction: light.synthetic ? (light.direction || 2) : event._direction,
                    length: light.flashLength,
                    width: light.flashWidth,
                    brightness: light.brightness
                });
            } else {
                radialFill(this._maskBitmap, {
                    x: pos.x, y: pos.y,
                    innerR: 0, outerR: effRadius,
                    color: renderColor,
                    brightness: light.brightness,
                    smoothness: light.falloff,
                    presetId: light.presetId,
                    radiusY: getEffectiveRadiusY(light),
                    isFire: (light.type === LIGHT_TYPE.FIRE),
                    flickerOffset: light.flickerOffset
                });
            }
        }
    };

    /**
     * Рендерит тайлы блокирующих регионов (стены).
     * Использует autotile cache — каждый уникальный bitmap кешируется.
     */
    Lightmask.prototype._renderRegionBlocks = function() {
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);
        var startX = dx, startY = dy;
        var endX = startX + Math.ceil(Graphics.width / pw) + 3;
        var endY = startY + Math.ceil(Graphics.height / ph) + 3;
        var ctx = this._maskBitmap._context;

        // DEBUG: посчитаем сколько стен на экране
        var wallsFound = 0;
        var mapId = ($gameMap && $gameMap._mapId) ? $gameMap._mapId : '?';

        ctx.save();
        // Идеальный фикс швов canvas: отключаем сглаживание
        ctx.imageSmoothingEnabled = false;

        for (var x = startX; x < endX; x++) {
            for (var y = startY; y < endY; y++) {
                var mapX = $gameMap.roundX(x);
                var mapY = $gameMap.roundY(y);
                var regionId = $gameMap.regionId(mapX, mapY);

                if (!state.blockedRegions[regionId]) continue;
                wallsFound++;
                var color = state.blockedRegions[regionId];

                // Compute bitmask: какие соседи имеют тот же цвет
                var mask = 0;
                var check = function(ox, oy) {
                    var rid = $gameMap.regionId($gameMap.roundX(x + ox), $gameMap.roundY(y + oy));
                    return (state.blockedRegions[rid] === color);
                };
                if (check(0, -1)) mask |= 1;   // Up
                if (check(1, 0))  mask |= 2;   // Right
                if (check(0, 1))  mask |= 4;   // Down
                if (check(-1, 0)) mask |= 8;   // Left
                if (check(1, -1)) mask |= 16;  // Up-Right
                if (check(1, 1))  mask |= 32;  // Down-Right
                if (check(-1, 1)) mask |= 64;  // Down-Left
                if (check(-1, -1)) mask |= 128;// Up-Left

                var shortMask = 0;
                if ((mask & 2) && !check(1, 1)) shortMask |= 2;
                if ((mask & 8) && !check(-1, 1)) shortMask |= 8;

                var effectiveIso = (mask & 4) ? 0 : CONFIG.wallIsoOffset;

                var bitmap = this._getAutotileBitmap(color, mask, effectiveIso, shortMask);

                var x1 = (x - dx) * pw + CANVAS_PADDING;
                var y1 = (y - dy) * ph;
                ctx.drawImage(bitmap.canvas, x1, y1);
            }
        }
        ctx.restore();
        this._maskBitmap._setDirty();

        // DEBUG
        if (!Lightmask.prototype._renderRegionBlocks._logged) {
            Lightmask.prototype._renderRegionBlocks._logged = true;
            console.log('[SDLight] _renderRegionBlocks FIRST: mapId=' + mapId +
                        ' wallsOnScreen=' + wallsFound +
                        ' blockedRegionsKeys=' + Object.keys(state.blockedRegions).join(','));
        }
    };

    /**
     * Возвращает (или создаёт и кеширует) Bitmap для тайла стены с данными параметрами.
     * Ключ кеша: "color_mask_iso_short".
     *
     * В оригинале был ~160 строк, оставлены как есть (эта логика хорошо отлажена).
     */
    Lightmask.prototype._getAutotileBitmap = function(color, mask, isoOff, shortMask) {
        if (!this._autotileCache) this._autotileCache = {};
        var key = color + "_" + mask + "_" + isoOff + "_" + (shortMask || 0);
        if (this._autotileCache[key]) return this._autotileCache[key];

        var size = $gameMap.tileWidth();
        var bitmap = new Bitmap(size, size);
        var ctx = bitmap._context;

        var rgb = Color.hexToRgb(color);
        var colorSolid = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 1.0)';
        var colorZero  = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.0)';

        var preset = FalloffPresets.get(CONFIG.wallPresetId);

        var addStops = function(grad) {
            if (preset) {
                for (var i = 0; i < preset.length; i++) {
                    var step = preset[i];
                    grad.addColorStop(step.pos,
                        'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + step.alpha + ')');
                }
            } else {
                grad.addColorStop(0, colorSolid);
                grad.addColorStop(1, colorZero);
            }
        };

        // 1. Solid fill
        ctx.fillStyle = colorSolid;
        ctx.fillRect(0, 0, size, size);

        // 2. Erase edges (cardinal)
        ctx.globalCompositeOperation = 'destination-out';
        var fadeSize = CONFIG.wallSoftness;

        if (!(mask & 1)) { // Top missing
            var g = ctx.createLinearGradient(0, 0, 0, fadeSize);
            addStops(g);
            ctx.fillStyle = g; ctx.fillRect(0, 0, size, fadeSize);
        }
        if (!(mask & 2)) { // Right missing
            var g = ctx.createLinearGradient(size, 0, size - fadeSize, 0);
            addStops(g);
            ctx.fillStyle = g; ctx.fillRect(size - fadeSize, 0, fadeSize, size);
        }
        if (!(mask & 4)) { // Down missing (with iso support)
            if (isoOff > 0) {
                ctx.fillStyle = colorSolid;
                ctx.fillRect(0, size - isoOff, size, isoOff);
            }
            var g = ctx.createLinearGradient(0, size - isoOff, 0, size - isoOff - fadeSize);
            addStops(g);
            ctx.fillStyle = g;
            ctx.fillRect(0, size - isoOff - fadeSize, size, fadeSize);
        }
        if (!(mask & 8)) { // Left missing
            var g = ctx.createLinearGradient(0, 0, fadeSize, 0);
            addStops(g);
            ctx.fillStyle = g; ctx.fillRect(0, 0, fadeSize, size);
        }

        // Short neighbour fix
        if ((mask & 2) && (shortMask & 2)) {
            var g = ctx.createLinearGradient(size, 0, size - fadeSize, 0);
            addStops(g);
            ctx.fillStyle = g;
            ctx.fillRect(size - fadeSize, size - CONFIG.wallIsoOffset, fadeSize, CONFIG.wallIsoOffset);
        }
        if ((mask & 8) && (shortMask & 8)) {
            var g = ctx.createLinearGradient(0, 0, fadeSize, 0);
            addStops(g);
            ctx.fillStyle = g;
            ctx.fillRect(0, size - CONFIG.wallIsoOffset, fadeSize, CONFIG.wallIsoOffset);
        }

        // 3. Diagonal inner corners
        var cSize = fadeSize;
        var addStopsRadial = function(grad) {
            if (preset) {
                for (var i = 0; i < preset.length; i++) {
                    var step = preset[i];
                    grad.addColorStop(step.pos,
                        'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + step.alpha + ')');
                }
            } else {
                grad.addColorStop(0, colorSolid);
                grad.addColorStop(1, colorZero);
            }
        };

        // Top-Right Corner
        if ((mask & 1) && (mask & 2) && !(mask & 16)) {
            var g = ctx.createRadialGradient(size, 0, 0, size, 0, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(size, 0); ctx.lineTo(size, cSize);
            ctx.arc(size, 0, cSize, Math.PI / 2, Math.PI);
            ctx.fill();
        }
        // Bottom-Right Corner
        if ((mask & 2) && (mask & 4) && !(mask & 32)) {
            var cornerY = (shortMask & 2) ? size - CONFIG.wallIsoOffset : size;
            var g = ctx.createRadialGradient(size, cornerY, 0, size, cornerY, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(size, cornerY); ctx.lineTo(size - cSize, cornerY);
            ctx.arc(size, cornerY, cSize, Math.PI, Math.PI * 1.5);
            ctx.fill();
        }
        // Bottom-Left Corner
        if ((mask & 4) && (mask & 8) && !(mask & 64)) {
            var cornerY = (shortMask & 8) ? size - CONFIG.wallIsoOffset : size;
            var g = ctx.createRadialGradient(0, cornerY, 0, 0, cornerY, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, cornerY); ctx.lineTo(0, cornerY - cSize);
            ctx.arc(0, cornerY, cSize, Math.PI * 1.5, 0);
            ctx.fill();
        }
        // Top-Left Corner
        if ((mask & 8) && (mask & 1) && !(mask & 128)) {
            var g = ctx.createRadialGradient(0, 0, 0, 0, 0, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(fadeSize, 0);
            ctx.arc(0, 0, cSize, 0, Math.PI / 2);
            ctx.fill();
        }

        // 4. Outer bottom corners (iso offset smoothing)
        if (isoOff > 0) {
            var bottomY = size - isoOff;
            if (!(mask & 4) && !(mask & 2)) {
                var g = ctx.createRadialGradient(size, bottomY, 0, size, bottomY, cSize);
                addStopsRadial(g);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(size, bottomY); ctx.lineTo(size - cSize, bottomY);
                ctx.arc(size, bottomY, cSize, Math.PI, Math.PI * 1.5);
                ctx.fill();
            }
            if (!(mask & 4) && !(mask & 8)) {
                var g = ctx.createRadialGradient(0, bottomY, 0, 0, bottomY, cSize);
                addStopsRadial(g);
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(0, bottomY); ctx.lineTo(0, bottomY - cSize);
                ctx.arc(0, bottomY, cSize, Math.PI * 1.5, 0);
                ctx.fill();
            }
        }

        // 5. Tint overlay (если wall_tint_opacity > 0)
        if (CONFIG.wallTintOpacity > 0) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + CONFIG.wallTintOpacity + ')';
            ctx.fillRect(0, 0, size, size - isoOff);
        }

        ctx.globalCompositeOperation = 'source-over';

        this._autotileCache[key] = bitmap;
        return bitmap;
    };

    /**
     * Рендерит debug-хитбоксы для всех источников света (3 зоны).
     * ИСПОЛЬЗУЕТ те же хелперы (getLightPercent, percentToZone) что и Sensor —
     * нет дублирования формул cone/circle.
     */
    Lightmask.prototype._renderDebugHitboxes = function() {
        var ctx = this._maskBitmap._context;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 2;

        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();

        // Цвета зон (от центра к краю)
        var zones = [
            { pct: 1.0, color: 'rgba(255, 0, 0, 0.8)' },                // BRIGHT
            { pct: CONFIG.zoneTangentPct, color: 'rgba(255, 165, 0, 0.8)' }, // TANGENT
            { pct: CONFIG.zoneBrightPct, color: 'rgba(0, 255, 0, 0.8)' }    // ACTUAL (центр)
        ];

        // 1. Player light
        var pRad = $gameVariables.GetRadius();
        if (pRad > 0) {
            var pPos = playerToScreen(pw, ph);
            if ($gameVariables.GetFlashlight()) {
                this._drawConeDebug(ctx, pPos.x, pPos.y, $gamePlayer._direction,
                                    $gameVariables.GetFlashlightLength(),
                                    $gameVariables.GetFlashlightWidth(), zones);
            } else {
                // Visual center сдвинут на flashlightOffset
                var yPos = pPos.y - CONFIG.flashlightOffset;
                this._drawCircleDebug(ctx, pPos.x, yPos, pRad, pRad, zones);
            }
        }

        // 2. Event lights
        for (var i = 0; i < state.lightEvents.length; i++) {
            var light = state.lightEvents[i];
            if (!light.active) continue;
            if (light.condFn && !light.condFn($gameSwitches, $gameVariables)) continue;
            var event = light.synthetic ? null : $gameMap.event(light.eventId);
            if (!light.synthetic && !event) continue;
            var tp = lightTilePos(light);
            if (!tp) continue;
            var pos = tileToScreen(tp.x, tp.y, pw, ph);

            if (light.type === LIGHT_TYPE.FLASHLIGHT) {
                var dir = light.synthetic ? (light.direction || 2) : event._direction;
                if (light.flashlightDir && DIRECTION_MAP[light.flashlightDir]) {
                    dir = DIRECTION_MAP[light.flashlightDir];
                }
                this._drawConeDebug(ctx, pos.x, pos.y, dir, light.flashLength, light.flashWidth, zones);
            } else {
                this._drawCircleDebug(ctx, pos.x, pos.y, light.radius,
                                      light.radiusY || light.radius, zones);
            }
        }

        ctx.restore();
        this._maskBitmap._setDirty();
    };

    /**
     * Рисует 3 debug-кольца для кругового источника.
     */
    Lightmask.prototype._drawCircleDebug = function(ctx, x, y, rX, rY, zones) {
        for (var z = 0; z < zones.length; z++) {
            ctx.strokeStyle = zones[z].color;
            ctx.beginPath();
            if (rX !== rY) {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(1, rY / rX);
                ctx.arc(0, 0, rX * zones[z].pct, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
            } else {
                ctx.arc(x, y, rX * zones[z].pct, 0, 2 * Math.PI);
                ctx.stroke();
            }
        }
    };

    /**
     * Рисует 3 debug-прямоугольника для cone-источника.
     */
    Lightmask.prototype._drawConeDebug = function(ctx, x, y, dir, length, width, zones) {
        var pw = $gameMap.tileWidth();
        for (var z = 0; z < zones.length; z++) {
            var len = length * pw * zones[z].pct;
            var wid = width * pw * zones[z].pct;
            ctx.strokeStyle = zones[z].color;
            ctx.beginPath();
            if (dir === 2) ctx.rect(x - wid / 2, y, wid, len);
            else if (dir === 8) ctx.rect(x - wid / 2, y - len, wid, len);
            else if (dir === 4) ctx.rect(x - len, y - wid / 2, len, wid);
            else if (dir === 6) ctx.rect(x, y - wid / 2, len, wid);
            ctx.stroke();
        }
    };

    /**
     * Создаёт Sprite из bitmap и добавляет в контейнер.
     * blendMode = 2 (MULTIPLY) — стандартное поведение маски освещения.
     */
    Lightmask.prototype._addSprite = function(x, y, bitmap) {
        var sprite = new Sprite(this.viewport);
        sprite.bitmap = bitmap;
        sprite.blendMode = 2; // Multiply
        sprite.x = x;
        sprite.y = y;
        this._sprites.push(sprite);
        this.addChild(sprite);
    };

    // =========================================================================
    // SECTION: STATE UPDATE FUNCTIONS
    // =========================================================================
    //
    // Эти функции вызываются из _updateMask каждый кадр.
    // Вынесены из главного цикла для читаемости.
    // =========================================================================

    /**
     * Перебирает все события на карте и парсит их Note через NoteParser.
     * Заполняет state.lightEvents.
     */
    function reloadLightEvents() {
        state.lightEvents = [];
        var events = $gameMap.events();
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            if (!event || !event.event) continue;
            var note = event.event().note;
            var light = NoteParser.parse(note);
            if (light) {
                light.eventId = event._eventId;
                state.lightEvents.push(light);
            }
        }
        // Уведомляем внешних подписчиков (напр. SRD_LightEditor — применить snapshot).
        if (window.SDLightAPI && SDLightAPI._dispatch) SDLightAPI._dispatch('eventsReloaded');
    }

    /**
     * Восстанавливает сохранённое состояние tint/vignette/blockedRegions.
     * Вызывается один раз при первом обновлении (state.firstRun).
     */
    function restoreSavedState() {
        var savedTint = $gameVariables.GetSavedTint();
        if (savedTint) {
            state.currentTint = savedTint;
            state.targetTint = savedTint;
        }
        var savedVignette = $gameVariables.GetSavedVignette();
        if (savedVignette) {
            state.currentVignette = savedVignette;
        } else {
            state.currentVignette = CONFIG.defaultVignette;
        }
        var savedRegions = $gameVariables.GetBlockedRegions();
        if (savedRegions) {
            for (var key in savedRegions) {
                state.blockedRegions[key] = savedRegions[key];
            }
        }
    }

    /**
     * Плавная интерполяция радиуса света игрока к target.
     * Сохраняет оригинальную логику (speed в pixel units per frame).
     */
    function updateRadiusInterpolation() {
        var current = $gameVariables.GetRadius();
        var target = $gameVariables.GetRadiusTarget();
        var speed = $gameVariables.GetRadiusSpeed();

        if (speed > 0) {
            if (current < target) {
                current = Math.min(current + speed, target);
                $gameVariables.SetRadius(current);
            } else if (current > target) {
                current = Math.max(current - speed, target);
                $gameVariables.SetRadius(current);
            }
            if (Math.abs(current - target) < 0.1) {
                $gameVariables.SetRadiusSpeed(0);
                $gameVariables.SetRadius(target);
            }
        } else if (current !== target) {
            $gameVariables.SetRadius(target);
        }
    }

    /**
     * Мгновенно привести cachedVignetteRadius к целевому влиянию света игрока.
     *
     * Фикс бага «первое зажигание — мягкий falloff не виден, второе — виден»:
     * cachedVignetteRadius (см. _drawVignette) — stateful и адаптируется через
     * "дыхание" (breathingSpeed). При первом зажигании он ещё ~0 → тёмная виньетка
     * накрывает мягкий градиент света; при повторном (после гашения) кеш не успевает
     * упасть до 0 → свет виден сразу. Снаппим кэш при воспламенении, чтобы первый
     * раз вёл себя как второй. Для остальных изменений «дыхание» сохраняется.
     *
     * @param {number} targetRadius — радиус, который только что установили (target)
     */
    function snapVignetteOnIgnite(targetRadius) {
        var r = (targetRadius !== undefined) ? targetRadius : $gameVariables.GetRadius();
        if (r <= 0) { state.cachedVignetteRadius = 0; return; }
        var customMult = $gameVariables.GetPlayerVignetteMult();
        var mult = (customMult !== undefined) ? customMult : CONFIG.playerInfluence;
        var target = r * mult;
        if (!$gameVariables.GetFlashlight()) target *= 0.8;
        state.cachedVignetteRadius = target;
    }

    /**
     * Обновление flicker offsets (для эффекта костра).
     * Player fire + все события с type=FIRE.
     */
    function updateFlickerOffsets() {
        if (Math.random() < FLICKER_PROBABILITY) {
            state.playerFlickerOffset = Math.random() * FLICKER_RANGE;
        }

        for (var i = 0; i < state.lightEvents.length; i++) {
            var light = state.lightEvents[i];
            if (light.type === LIGHT_TYPE.FIRE) {
                if (Math.random() < FLICKER_PROBABILITY) {
                    light.flickerOffset = Math.random() * FLICKER_RANGE;
                } else if (light.flickerOffset === undefined) {
                    light.flickerOffset = 0;
                }
            } else {
                light.flickerOffset = 0;
            }
        }
    }

    /**
     * Обновление activationProgress для всех light events.
     * Если activationFrames <= 1 — мгновенное включение (как в оригинале).
     * Иначе прогресс растёт/падает со скоростью 1/activationFrames за кадр.
     *
     * Источники с pendingDeactivation удаляются, когда прогресс падает до 0.
     */
    function updateActivationProgresss() {
        if (CONFIG.activationFrames <= 1) {
            // Мгновенное включение — просто ставим 1 для всех active источников
            for (var i = state.lightEvents.length - 1; i >= 0; i--) {
                var light = state.lightEvents[i];
                if (light.active) {
                    light.activationProgress = 1;
                    light.activationTarget = 1;
                } else if (light.pendingDeactivation) {
                    state.lightEvents.splice(i, 1);
                }
            }
            return;
        }

        var speed = 1 / CONFIG.activationFrames;

        for (var j = state.lightEvents.length - 1; j >= 0; j--) {
            var l = state.lightEvents[j];

            if (l.activationProgress < l.activationTarget) {
                l.activationProgress = Math.min(l.activationProgress + speed, l.activationTarget);
            } else if (l.activationProgress > l.activationTarget) {
                l.activationProgress = Math.max(l.activationProgress - speed, l.activationTarget);
            }

            // Если deactivation complete → удаляем источник
            if (l.pendingDeactivation && l.activationProgress <= 0) {
                state.lightEvents.splice(j, 1);
            }
        }
    }

    /**
     * Возвращает эффективный радиус источника с учётом плавного включения.
     */
    function getEffectiveRadius(light) {
        if (CONFIG.activationFrames <= 1) return light.radius;
        var progress = light.activationProgress || 1;
        // ease-out для более естественного "разгорания"
        var eased = 1 - Math.pow(1 - progress, 3);
        return light.radius * eased;
    }

    /**
     * Возвращает эффективный радиус по Y с учётом плавного включения.
     *
     * ВАЖНО: radiusY должен масштабироваться тем же easing-коэффициентом,
     * что и radius. Иначе во время разгорания (и flicker) rX != rY и круг
     * превращается в вытянутый овал (особенно заметно на маленьких источниках).
     * Формула flicker в radialFill корректно сохраняет круг, только если
     * radiusY на входе равен пред-flicker outerR (т.е. radius*eased).
     */
    function getEffectiveRadiusY(light) {
        if (CONFIG.activationFrames <= 1) {
            return (light.radiusY !== undefined) ? light.radiusY : light.radius;
        }
        var progress = light.activationProgress || 1;
        var eased = 1 - Math.pow(1 - progress, 3);
        var baseY = (light.radiusY !== undefined) ? light.radiusY : light.radius;
        return baseY * eased;
    }

    /**
     * Плавная интерполяция tint от current к target.
     * Использует RGB-lerp, длительность = tintSpeed кадров.
     */
    function updateTintInterpolation() {
        if (state.currentTint === state.targetTint) return;
        state.tintTimer++;
        var startRgb = Color.hexToRgb(state.currentTint);
        var endRgb = Color.hexToRgb(state.targetTint);
        var progress = Math.min(1, state.tintTimer / state.tintSpeed);
        var newR = Math.floor(MathUtil.lerp(startRgb.r, endRgb.r, progress));
        var newG = Math.floor(MathUtil.lerp(startRgb.g, endRgb.g, progress));
        var newB = Math.floor(MathUtil.lerp(startRgb.b, endRgb.b, progress));
        var currentHex = Color.rgbToHex({ r: newR, g: newG, b: newB });
        if (progress >= 1) {
            state.currentTint = state.targetTint;
        } else {
            state.currentTint = currentHex;
        }
    }

    // =========================================================================
    // SECTION: PLUGIN COMMANDS
    // =========================================================================
    //
    // Поддерживаемые команды (case-insensitive):
    //   Tint set #COLOR                            - мгновенно
    //   Tint fade #COLOR SPEED                     - плавно
    //   Vignette color #COLOR
    //   RegionBlock ID #COLOR                      - добавить/заменить
    //   RegionBlock ID OFF                         - убрать
    //   Light radius N [tDURATION] [COLOR] [PRESET] [MULT] [BRIGHT] [SMOOTH]
    //   Light radiusGrow N [...]                   - по умолчанию с анимацией
    //   Light on / Light off
    //   Light color #COLOR
    //   Light brightness N
    //   Light smooth N
    //   Light preset ID
    //   Light flicker on / Light flicker off
    //   Light flashlight BRIGHTNESS [DURATION]     - включить фонарик
    //   Light cycle COLOR1 F1 COLOR2 F2 ...
    //
    // Хукаем Game_Interpreter.pluginCommand через alias.
    // =========================================================================

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (!command) return;
        var cmd = command.toLowerCase();

        switch (cmd) {
            case 'tint':
                cmdTint(args);
                break;
            case 'vignette':
                cmdVignette(args);
                break;
            case 'regionblock':
                cmdRegionBlock(args);
                break;
            case 'light':
                cmdLight(args);
                break;
            case 'fire':
                cmdFire(args);
                break;
            case 'localswitch':
            case 'mapswitch':
                cmdLocalSwitch(args);
                break;
        }
    };

    // =========================================================================
    // SECTION: MAP-LOCAL SWITCHES (переключатели уровня карты)
    // =========================================================================
    // Отдельный набор переключателей ДЛЯ КАЖДОЙ карты (как self-switch, но общий
    // на всю карту и адресуемый с любой локации). Хранится на $gameSystem →
    // сохраняется в save. Удобно для управления светом/событиями конкретной локи.
    //
    //   Окно/скрипт:  SDMapSwitch.get(mapId, idx)
    //                 SDMapSwitch.set(mapId, idx, true/false)
    //                 SDMapSwitch.toggle(mapId, idx)
    //                 $gameMap.localSwitch(idx)        — текущая карта, чтение
    //                 $gameMap.setLocalSwitch(idx, v)  — текущая карта, запись
    //
    //   В условии свечения (cond) источника:  L<N> — лок. переключатель N текущей карты.
    //     Пример:  L1 && !S5     (горит, если лок. SW1 текущей карты вкл и глобальный SW5 выкл)
    //
    //   Plugin Commands:
    //     LocalSwitch <id> on            — вкл на текущей карте
    //     LocalSwitch <id> off           — выкл на текущей карте
    //     LocalSwitch <id> toggle        — перехват
    //     LocalSwitch <id> on map <mapId>   — для конкретной карты (с любой локации)
    //     LocalSwitch <id> on <mapId>       — короткая форма (mapId числом)
    // =========================================================================

    window.SDMapSwitch = {
        // Номер глобального переключателя, в который отображается (mapId, idx).
        // Формула: base + mapId*stride + idx. 0 = нет отображения (хранится на $gameSystem).
        globalId: function(mapId, idx) {
            if (CONFIG.mapSwitchBase <= 0) return 0;
            return CONFIG.mapSwitchBase + Number(mapId) * CONFIG.mapSwitchStride + Number(idx);
        },
        get: function(mapId, idx) {
            var gid = this.globalId(mapId, idx);
            if (gid > 0) {
                return !!(typeof $gameSwitches !== 'undefined' && $gameSwitches && $gameSwitches.value(gid));
            }
            // fallback: хранилище на $gameSystem
            if (typeof $gameSystem === 'undefined' || !$gameSystem || !$gameSystem._sdMapSwitches) return false;
            var m = $gameSystem._sdMapSwitches[String(mapId)];
            return !!(m && m[String(idx)]);
        },
        set: function(mapId, idx, val) {
            var gid = this.globalId(mapId, idx);
            if (gid > 0) {
                if (typeof $gameSwitches !== 'undefined' && $gameSwitches) $gameSwitches.setValue(gid, !!val);
                return;
            }
            if (typeof $gameSystem === 'undefined' || !$gameSystem) return;
            if (!$gameSystem._sdMapSwitches) $gameSystem._sdMapSwitches = {};
            var mk = String(mapId);
            if (!$gameSystem._sdMapSwitches[mk]) $gameSystem._sdMapSwitches[mk] = {};
            $gameSystem._sdMapSwitches[mk][String(idx)] = !!val;
        },
        toggle: function(mapId, idx) {
            var v = !this.get(mapId, idx);
            this.set(mapId, idx, v);
            return v;
        }
    };

    Game_Map.prototype.localSwitch = function(idx) {
        return SDMapSwitch.get(this.mapId(), idx);
    };
    Game_Map.prototype.setLocalSwitch = function(idx, val) {
        SDMapSwitch.set(this.mapId(), idx, val);
    };

    // =========================================================================
    // УСЛОВИЕ СТРАНИЦЫ СОБЫТИЯ через Комментарий (без глобальных переключателей).
    // =========================================================================
    // Положи в НАЧАЛО команды страницы события «Комментарий» (◆ Comment):
    //     <L1>      — страница активна, только когда лок.перекл. №1 ЭТОЙ карты ВКЛ
    //     <!L1>     — страница активна, только когда лок.перекл. №1 ВЫКЛ
    //     <L3>      — любой другой слот
    // Никаких глобальных переключателей и условий в Conditions не нужно — плагин
    // сам проверяет тег при выборе страницы. Кешируется на странице.
    // =========================================================================
    Game_Event.prototype._sdLSReq = function(page) {
        if (!page) return null;
        if (page._sdLSReqCache !== undefined) return page._sdLSReqCache;
        var req = null;
        if (page.list) {
            for (var i = 0; i < page.list.length; i++) {
                var cmd = page.list[i];
                if (!cmd) continue;
                if (cmd.code !== 108 && cmd.code !== 408) continue; // только комментарии
                var text = String((cmd.parameters && cmd.parameters[0]) || '');
                var moff = text.match(/<!L(\d+)>/);
                if (moff) { req = { idx: Number(moff[1]), on: false }; break; }
                var m = text.match(/<L(\d+)>/);
                if (m) { req = { idx: Number(m[1]), on: true }; break; }
            }
        }
        page._sdLSReqCache = req;
        return req;
    };
    Game_Event.prototype._meetsLSPageCond = function(page) {
        var req = this._sdLSReq(page);
        if (!req) return true;
        var mapId = (this._mapId !== undefined && this._mapId !== null) ? this._mapId : $gameMap.mapId();
        var val = SDMapSwitch.get(mapId, req.idx);
        return req.on ? val : !val;
    };
    var _SD_Game_Event_meetsConditions = Game_Event.prototype.meetsConditions;
    Game_Event.prototype.meetsConditions = function(page) {
        if (!_SD_Game_Event_meetsConditions.call(this, page)) return false;
        return this._meetsLSPageCond(page);
    };

    function cmdLocalSwitch(args) {
        if (!args || !args[0]) return;
        var idx = Number(args[0]);
        if (isNaN(idx)) return;
        var state = (args[1] || '').toLowerCase();
        // Разбор mapId: либо "map <id>", либо число в конце.
        var mapId = (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.mapId() : 0;
        for (var i = 2; i < args.length; i++) {
            var a = String(args[i] || '').toLowerCase();
            if (a === 'map' && args[i + 1] !== undefined && !isNaN(Number(args[i + 1]))) {
                mapId = Number(args[i + 1]); break;
            }
            if (a !== '' && !isNaN(Number(a))) { mapId = Number(a); }
        }
        if (state === 'on' || state === '1' || state === 'true') SDMapSwitch.set(mapId, idx, true);
        else if (state === 'off' || state === '0' || state === 'false') SDMapSwitch.set(mapId, idx, false);
        else if (state === 'toggle' || state === '!' || state === '!') SDMapSwitch.toggle(mapId, idx);
        // cond источников перевычисляется каждый кадр — доп. обновление не нужно.
    }

    function cmdFire(args) {
        // Голое 'fire' — toggle мерцания игрока (как в SuperDuperLight)
        if (!args || args.length === 0) {
            $gameVariables.SetFire(!$gameVariables.GetFire());
            return;
        }
        var sub = args[0].toLowerCase();

        // 'fire radius ...' / 'fire radiusgrow ...' — те же параметры, что у 'light radius'
        // + автоматически включаем мерцание (в этом суть 'fire' в оригинале).
        if (sub === 'radius' || sub === 'radiusgrow') {
            cmdLight(args);
            $gameVariables.SetFire(true);
            // Лог только в момент зажигания (R≈0), чтобы не спамить каждый кадр
            // (общее событие может слать команду на autorun).
            if ($gameVariables.GetRadius() <= 1) {
                console.log('[SDLight-DIAG] cmdFire зажигание → ' +
                    'target=' + $gameVariables.GetRadiusTarget() +
                    ' bright=' + $gameVariables.GetPlayerBrightness() +
                    ' color=' + $gameVariables.GetPlayerColor() +
                    ' preset=' + $gameVariables.GetPlayerPreset() +
                    ' fire=' + $gameVariables.GetFire());
            }
            return;
        }

        // on / off
        if (sub === 'on')  { $gameVariables.SetFire(true);  return; }
        if (sub === 'off') { $gameVariables.SetFire(false); return; }

        // По умолчанию — toggle мерцания
        $gameVariables.SetFire(!$gameVariables.GetFire());
    }

    function cmdTint(args) {
        if (!args[0]) return;
        var sub = args[0].toLowerCase();
        if (sub === 'set' && args[1]) {
            var c = Color.ensureHash(args[1]);
            state.currentTint = c;
            state.targetTint = c;
            $gameVariables.SetSavedTint(c);
        } else if (sub === 'fade' && args[1]) {
            var c = Color.ensureHash(args[1]);
            state.targetTint = c;
            state.tintSpeed = Number(args[2]) || 60;
            state.tintTimer = 0;
            $gameVariables.SetSavedTint(c);
        }
    }

    function cmdVignette(args) {
        if (args[0] === 'color' && args[1]) {
            var c = Color.ensureHash(args[1]);
            state.currentVignette = c;
            $gameVariables.SetSavedVignette(c);
        }
    }

    function cmdRegionBlock(args) {
        var id = Number(args[0]);
        if (isNaN(id)) return;
        var col = args[1];
        if (col && col.toUpperCase() === 'OFF') {
            delete state.blockedRegions[id];
        } else if (col) {
            state.blockedRegions[id] = Color.ensureHash(col);
        }
        $gameVariables.SetBlockedRegions(state.blockedRegions);

        // Этап 7: пересчитать shadow casters + инвалидировать bake
        if (CONFIG.useRealShadows) {
            buildShadowCasters();
        }
    }

    function cmdLight(args) {
        if (!args[0]) return;
        var sub = args[0].toLowerCase();

        // Sub-команды
        switch (sub) {
            case 'on':
            case 'off':
            case 'color': {
                // С числовым аргументом — управляем источником-событием по customId
                // (совместимость с SuperDuperLight/Terrax: Light on #N / off #N / color #N #hex)
                var lightId = Number(args[1]);
                if (!isNaN(lightId)) {
                    var matched = false;
                    for (var li = 0; li < state.lightEvents.length; li++) {
                        var lev = state.lightEvents[li];
                        if (lev.customId === lightId) {
                            matched = true;
                            if (sub === 'on') lev.active = true;
                            else if (sub === 'off') lev.active = false;
                            else if (args[2]) lev.color = Color.ensureHash(args[2]);
                        }
                    }
                    if (CONFIG.debugMode && !matched) {
                        console.log('[SDLight] Light ' + sub + ' ' + lightId +
                                    ': нет источника с customId=' + lightId);
                    }
                    return;
                }
                // Без ID — свет игрока
                if (sub === 'on') {
                    if (CONFIG.playerRadiusDefault > 0) {
                        $gameVariables.SetRadius(CONFIG.playerRadiusDefault);
                        $gameVariables.SetRadiusTarget(CONFIG.playerRadiusDefault);
                        snapVignetteOnIgnite(CONFIG.playerRadiusDefault);
                    }
                    // При radiusDefault=0 НЕ обнуляем радиус — иначе «Light on» гасит свет
                    // вместо включения (старый баг). Для включения игрока используй Light radius N.
                } else if (sub === 'off') {
                    $gameVariables.SetRadius(0);
                    $gameVariables.SetRadiusTarget(0);
                } else if (args[1]) {
                    $gameVariables.SetPlayerColor(args[1]);
                }
                return;
            }
            case 'brightness':
                $gameVariables.SetPlayerBrightness(Number(args[1]) || 1.0);
                return;
            case 'smooth':
                $gameVariables.SetPlayerSmoothness(Number(args[1]) || 1.0);
                return;
            case 'preset':
                $gameVariables.SetPlayerPreset(args[1] || null);
                return;
            case 'flicker':
                $gameVariables.SetFire(args[1] ? args[1].toLowerCase() === 'on' : true);
                return;
            case 'flashlight':
                $gameVariables.SetFlashlight(true);
                if (args[1] !== undefined) {
                    $gameVariables.SetPlayerBrightness(Number(args[1]));
                }
                return;
        }

        // radius / radiusGrow
        if (sub === 'radius' || sub === 'radiusgrow') {
            var newRad = Number(args[1]);
            if (isNaN(newRad)) return;
            // Запоминаем, был ли свет выключен — для снапа виньетки при воспламенении
            var wasOff = ($gameVariables.GetRadius() <= 0);

            // Извлекаем t<duration>
            var duration = 0;
            for (var i = 2; i < args.length; i++) {
                if (args[i] && args[i].match(/^t(\d+)$/i)) {
                    duration = Number(RegExp.$1);
                    args.splice(i, 1);
                    i--;
                }
            }

            // Устанавливаем target
            $gameVariables.SetRadiusTarget(newRad);

            // Скорость интерполяции
            if (sub === 'radius' && duration === 0) {
                // Мгновенно
                $gameVariables.SetRadiusSpeed(0);
                $gameVariables.SetRadius(newRad);
            } else {
                var ticks = (duration > 0) ? duration : 60;
                var current = $gameVariables.GetRadius();
                var speed = Math.abs(newRad - current) / ticks;
                $gameVariables.SetRadiusSpeed(speed < 0.1 ? 0.1 : speed);
            }

            // Опциональные параметры.
            // Сначала вырежем ИМЕНОВАННЫЕ пресеты (не-числовые токены) из любой
            // позиции после color. Иначе числовые модификаторы (mult/brightness)
            // «съедали» слот пресета, и он молча терялся → линейный falloff.
            // Числовые токены НЕ трогаем (в т.ч. числовые id пресетов '1'/'2'/'3' —
            // их корректно подхватит позиционный разбор ниже).
            for (var pp = 3; pp < args.length; pp++) {
                if (args[pp] && isNaN(Number(args[pp])) && FalloffPresets.get(args[pp])) {
                    $gameVariables.SetPlayerPreset(args[pp]);
                    args.splice(pp, 1);
                    pp--;
                }
            }

            // Оригинальный позиционный разбор: color, [preset], mult, brightness, smoothness
            var pIdx = 2;
            if (args[pIdx]) $gameVariables.SetPlayerColor(args[pIdx]);
            pIdx++;

            // Пресет (в т.ч. числовой id на позиции сразу после color)
            if (args[pIdx] && FalloffPresets.get(args[pIdx])) {
                $gameVariables.SetPlayerPreset(args[pIdx]);
                pIdx++;
            }

            // Числовой множитель (player vignette multiplier)
            if (args[pIdx] && !isNaN(Number(args[pIdx]))) {
                $gameVariables.SetPlayerVignetteMult(Number(args[pIdx]));
                pIdx++;
            }

            // Brightness (число)
            if (args[pIdx] && !isNaN(Number(args[pIdx]))) {
                $gameVariables.SetPlayerBrightness(Number(args[pIdx]));
                pIdx++;
            }

            // Smoothness (число)
            if (args[pIdx] && !isNaN(Number(args[pIdx]))) {
                $gameVariables.SetPlayerSmoothness(Number(args[pIdx]));
                pIdx++;
            }

            // Фикс «первое зажигание — мягкий falloff не виден»: при воспламенении
            // снеппить кеш виньетки к целевому влиянию, чтобы градиент был виден сразу
            // (а не только при повторном зажигании, когда кеш уже адаптирован).
            if (wasOff && newRad > 0) snapVignetteOnIgnite(newRad);
        }
    }

    // =========================================================================
    // SECTION: INTEGRATION — Hooks на RPG Maker классы
    // =========================================================================
    //
    // Создаём Lightmask при создании Spriteset_Map и добавляем в контейнер.
    // =========================================================================

    /**
     * Создаёт Lightmask (один на Spriteset).
     */
    Spriteset_Map.prototype.createLightmask = function() {
        this._lightmask = new Lightmask();
        this.addChild(this._lightmask);
    };

    // Alias: после createLowerLayer добавляем Lightmask
    var _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _Spriteset_Map_createLowerLayer.call(this);
        this.createLightmask();
    };

    // =========================================================================
    // SECTION: PUBLIC API — window.SDLightAPI
    // =========================================================================
    //
    // Минимальный публичный интерфейс для live-редактирования освещения.
    // Используется companion-плагином SRD_LightEditor (вкладка в F12 SRD).
    // Все методы безопасны: работают даже если $gameVariables ещё не создан.
    // =========================================================================

    function _gvReady() {
        return (typeof $gameVariables !== 'undefined') && !!$gameVariables;
    }

    window.SDLightAPI = {
        // --- Tint (цвет тумана рядом с игроком) ---
        setTint: function(hex) {
            var c = Color.ensureHash(hex);
            state.currentTint = c;
            state.targetTint = c;
            state.tintSpeed = 0;
            state.tintTimer = 0;
            if (_gvReady()) $gameVariables.SetSavedTint(c);
        },
        fadeTint: function(hex, frames) {
            var c = Color.ensureHash(hex);
            state.targetTint = c;
            state.tintSpeed = Math.max(1, Number(frames) || 60);
            state.tintTimer = 0;
            if (_gvReady()) $gameVariables.SetSavedTint(c);
        },
        getTint: function() { return state.currentTint; },

        // --- Vignette (цвет по краям экрана) ---
        setVignette: function(hex) {
            var c = Color.ensureHash(hex);
            state.currentVignette = c;
            if (_gvReady()) $gameVariables.SetSavedVignette(c);
        },
        getVignette: function() { return state.currentVignette; },

        // --- Master opacity (глобальная яркость карты, 0..100) ---
        setMasterOpacity: function(value) {
            if (CONFIG.masterOpacityVar > 0 && _gvReady()) {
                $gameVariables.setValue(CONFIG.masterOpacityVar,
                    MathUtil.clamp(Number(value) || 0, 0, 100));
            }
        },
        getMasterOpacity: function() {
            if (CONFIG.masterOpacityVar <= 0 || !_gvReady()) return 0;
            var v = Number($gameVariables.value(CONFIG.masterOpacityVar));
            return isNaN(v) ? 0 : MathUtil.clamp(v, 0, 100);
        },

        // --- Конфиг (только для чтения) ---
        getConfig: function() {
            return {
                masterOpacityVar:     CONFIG.masterOpacityVar,
                vignetteDisableSwitch: CONFIG.vignetteDisableSwitch,
                sensorDebugSwitch:    CONFIG.sensorDebugSwitch,
                defaultTint:          CONFIG.defaultTint,
                defaultVignette:      CONFIG.defaultVignette,
                playerRadiusDefault:  CONFIG.playerRadiusDefault,
                vignetteScale:        CONFIG.vignetteScale,
                vignetteSharpness:    CONFIG.vignetteSharpness,
                playerInfluence:      CONFIG.playerInfluence,
                flashlightOffset:     CONFIG.flashlightOffset,
                useRealShadows:       CONFIG.useRealShadows
            };
        },

        // --- Пресеты затухания ---
        getPresets: function() {
            return FalloffPresets.ids();
        },
        hasPreset: function(id) { return !!FalloffPresets.get(id); },
        /** Возвращает КОПИЮ шагов пресета (для редактирования). */
        getPreset: function(id) {
            var src = FalloffPresets.get(id);
            if (!src) return null;
            return src.map(function(s) { return { pos: s.pos, alpha: s.alpha }; });
        },
        /** Live-применяет новые шаги пресета. Рендер подхватит в тот же кадр. */
        registerPreset: function(id, steps) {
            if (!id || !Array.isArray(steps)) return false;
            // Не даём переопределять чужой ID пустым массивом случайно
            FalloffPresets.register(id, steps);
            return true;
        },
        /** true, если пресет встроенный (нельзя удалять). */
        isPresetBuiltin: function(id) { return FalloffPresets.isBuiltin(id); },
        /** Удаляет только пользовательский пресет. */
        removePreset: function(id) { return FalloffPresets.remove(id); },
        /** Создаёт новый пустой пресет (одна точка). false, если ID занят. */
        addPreset: function(id) {
            id = String(id || '').trim();
            if (!id || FalloffPresets.get(id)) return false;
            FalloffPresets.register(id, [{ pos: 0, alpha: 1 }, { pos: 1, alpha: 0 }]);
            return true;
        },

        // --- Источники света событий (объектов на карте) ---
        // state.lightEvents — приватный массив. Возвращаем безопасные дескрипторы.
        getLightEvents: function() {
            if (!state || !state.lightEvents) return [];
            var out = [];
            for (var i = 0; i < state.lightEvents.length; i++) {
                var l = state.lightEvents[i];
                var name = '';
                try {
                    var ev = $gameMap.event(l.eventId);
                    if (ev && ev.event) name = (ev.event().name || '');
                } catch (e) { /* ignore */ }
                out.push({
                    idx: i,
                    eventId: l.eventId,
                    synthetic: !!l.synthetic,
                    sid: l._sid || 0,
                    x: (l.x !== undefined) ? l.x : 0,
                    y: (l.y !== undefined) ? l.y : 0,
                    name: name,
                    type: l.type,
                    radius: l.radius,
                    radiusY: (l.radiusY !== undefined) ? l.radiusY : l.radius,
                    color: l.color || '#FFFFFF',
                    brightness: (l.brightness !== undefined) ? l.brightness : 1,
                    falloff: (l.falloff !== undefined) ? l.falloff : 1,
                    presetId: l.presetId || null,
                    active: !!l.active,
                    flashLength: l.flashLength || 8,
                    flashWidth: l.flashWidth || 12,
                    customId: l.customId || 0,
                    direction: l.direction || 0,
                    cond: l.cond || null,
                    suppressed: !!l.suppressed
                });
            }
            return out;
        },
        /** Возвращает один дескриптор источника по индексу. */
        getLightEvent: function(idx) {
            var all = this.getLightEvents();
            return all[idx] || null;
        },

        // --- Синтетические источники (без реального event'а) ---
        // Счётчик id синтетики (уникальный в рамках сессии)
        _syntheticCounter: 0,
        /**
         * Создаёт синтетический источник света в заданной tile-позиции.
         * def: { x, y, type?, radius?, color?, brightness?, falloff?, presetId?, flashLength?, flashWidth?, active? }
         * Возвращает sid (число) или -1 при ошибке.
         */
        addSyntheticLight: function(def) {
            if (!state || !state.lightEvents) return -1;
            def = def || {};
            if (def.x === undefined || def.y === undefined) return -1;
            var light = NoteParser.createDefault(def.type || 'Normal');
            light.synthetic = true;
            light.eventId = -1;
            light._sid = (++this._syntheticCounter);
            light.x = Number(def.x);
            light.y = Number(def.y);
            light.flickerOffset = 0;
            if (def.radius !== undefined) {
                light.radius = Number(def.radius);
                light.radiusY = (def.radiusY !== undefined) ? Number(def.radiusY) : light.radius;
            }
            if (def.color !== undefined) light.color = Color.ensureHash(def.color);
            if (def.brightness !== undefined) light.brightness = Number(def.brightness);
            if (def.falloff !== undefined) light.falloff = Number(def.falloff);
            if (def.presetId !== undefined) light.presetId = def.presetId ? String(def.presetId) : null;
            if (def.flashLength !== undefined) light.flashLength = Number(def.flashLength);
            if (def.flashWidth !== undefined) light.flashWidth = Number(def.flashWidth);
            if (def.active !== undefined) light.active = !!def.active;
            if (def.direction !== undefined) light.direction = Number(def.direction);
            if (def.cond !== undefined) {
                light.cond = (def.cond === '' || def.cond === null) ? null : String(def.cond);
                light.condFn = this._compileCond(light.cond);
            }
            if (def.suppressed !== undefined) light.suppressed = !!def.suppressed;
            state.lightEvents.push(light);
            return light._sid;
        },

        /**
         * Компиляция условия свечения (строка → function() → bool).
         * Синтаксис: S<n>=переключатель, V<n>=переменная, операторы && || ! > >= < <= == !=
         * и скобки. Пример: "S5 && V12>=3 && (V4==0 || !S8)"
         * null/пусто → null (всегда светит).
         */
        _compileCond: function(condStr) {
            if (!condStr || typeof condStr !== 'string') return null;
            try {
                var s = condStr.trim();
                if (!s) return null;
                // Заменяем S<n> → $gameSwitches.value(<n>), V<n> → $gameVariables.value(<n>)
                s = s.replace(/S(\d+)/g, '($gameSwitches.value($1))');
                s = s.replace(/V(\d+)/g, '($gameVariables.value($1))');
                // L<n> → локальный переключатель <n> ТЕКУЩЕЙ карты (SDMapSwitch).
                s = s.replace(/L(\d+)/g, '(window.SDMapSwitch && window.SDMapSwitch.get(($gameMap ? $gameMap.mapId() : 0),$1))');
                // Используем new Function для безопасной компиляции (не eval)
                var fn = new Function('$gameSwitches', '$gameVariables', 'return (' + s + ') ? true : false;');
                // Тестовый вызов — если упадёт, вернём null
                fn($gameSwitches || { value: function() { return 0; } }, $gameVariables || { value: function() { return 0; } });
                return fn;
            } catch (e) {
                if (CONFIG.debugMode) console.warn('[SDLight] cond compile fail:', condStr, e);
                return null;
            }
        },
        /** Список синтетических источников (с индексами в state.lightEvents). */
        getSyntheticLights: function() {
            if (!state || !state.lightEvents) return [];
            var out = [];
            for (var i = 0; i < state.lightEvents.length; i++) {
                var l = state.lightEvents[i];
                if (l && l.synthetic) {
                    out.push({
                        idx: i, sid: l._sid,
                        x: l.x, y: l.y, type: l.type, radius: l.radius, radiusY: l.radiusY,
                        color: l.color, brightness: l.brightness, falloff: l.falloff,
                        presetId: l.presetId, active: l.active,
                        flashLength: l.flashLength, flashWidth: l.flashWidth, direction: l.direction || 0,
                        cond: l.cond || null, suppressed: !!l.suppressed
                    });
                }
            }
            return out;
        },
        /** Удалить синтетический источник по sid. */
        removeSyntheticLight: function(sid) {
            if (!state || !state.lightEvents) return false;
            for (var i = 0; i < state.lightEvents.length; i++) {
                if (state.lightEvents[i] && state.lightEvents[i].synthetic && state.lightEvents[i]._sid === sid) {
                    state.lightEvents.splice(i, 1);
                    return true;
                }
            }
            return false;
        },

        /**
         * Мутирует поле источника ЖИВОЙ (рендер читает state.lightEvents[idx]
         * каждый кадр). Тип приводится по имени поля.
         */
        setLightProp: function(idx, key, value) {
            var l = state.lightEvents && state.lightEvents[idx];
            if (!l) return false;
            // Поддержка 'cond' — прекомпиляция выражения-условия.
            if (key === 'cond') {
                l.cond = (value === '' || value === null) ? null : String(value);
                l.condFn = this._compileCond(l.cond);
                return true;
            }
            switch (key) {
                case 'radius':
                case 'radiusY':
                case 'flashLength':
                case 'flashWidth':
                case 'customId':
                case 'direction':
                case 'x':
                case 'y':
                    l[key] = Number(value) || 0;
                    break;
                case 'brightness':
                case 'falloff':
                    l[key] = Number(value);
                    if (isNaN(l[key])) l[key] = (key === 'brightness') ? 1 : 1;
                    break;
                case 'active':
                    l[key] = (value === true || value === 'true');
                    break;
                case 'color':
                    l[key] = Color.ensureHash(value);
                    break;
                case 'presetId':
                    l[key] = (value === '' || value === null) ? null : String(value);
                    break;
                case 'type':
                    l[key] = String(value);
                    break;
                case 'cond':
                    l[key] = (value === '' || value === null) ? null : String(value);
                    l.condFn = this._compileCond(l[key]);
                    break;
                default:
                    l[key] = value;
            }
            return true;
        },

        // --- Принудительный пересчёт источников на карте ---
        reloadEvents: function() {
            if (typeof reloadLightEvents === 'function') reloadLightEvents();
        },

        /** Мгновенно привести кеш виньетки к влиянию света игрока (фикс первого зажигания). */
        snapVignette: function(targetRadius) {
            if (typeof snapVignetteOnIgnite === 'function') snapVignetteOnIgnite(targetRadius);
        },

        // --- Микро-система событий (для SRD_LightEditor auto-apply и др.) ---
        // Хук: SDLight вызывает _dispatch('eventsReloaded') в конце reloadLightEvents.
        _listeners: {},
        on: function(event, cb) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(cb);
        },
        _dispatch: function(event) {
            var cbs = this._listeners[event];
            if (!cbs) return;
            for (var i = 0; i < cbs.length; i++) {
                try { cbs[i](); } catch (e) {
                    if (CONFIG.debugMode) console.warn('[SDLight] listener "' + event + '" error:', e);
                }
            }
        },

        // --- Версия API ---
        version: '1.2'
    };
})();

