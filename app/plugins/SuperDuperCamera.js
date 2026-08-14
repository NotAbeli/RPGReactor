/*:
 * @plugindesc [v7.7.0] SuperDuperCamera: зум, стабилизированная камера, Hard Points барьеры, прицеливание.
 * @author SumRndmDde + Bridge + Korolev
 *
 * @help
 * ============================================================================
 * SuperDuperCamera v7.7.0
 * ============================================================================
 * Объединяет 4 системы:
 * 1. CameraCore — зум камеры (PIXI-масштаб спрайтсета, UI не страдает).
 * 2. SmoothCamera — плавное следование за ГГ, мёртвые/мягкие зоны.
 * 3. Bounds — Edge Clamp ограничитель камеры по регионам.
 * 4. Scope — прицеливание на ПКМ, сдвиг камеры, поворот игрока.
 *
 * ЗУМ:
 * «Зум по умолчанию» масштабирует только карту (спрайтсет PIXI).
 * Меню, текст, окна остаются в полном разрешении — картинка чёткая.
 * Для катсцен: setCameraFocus(scale, duration) в событий.
 *
 * ПЛАВНОСТЬ:
 * Мёртвая зона — область в центре, где камера стоит на месте.
 * Мягкая зона — область, где камера плавно догоняет ГГ.
 * Инерция — насколько плавно камера движется (0 = мгновенно, 1 = очень медленно).
 * Ускорение + инерция скорости — стабилизация: камера разгоняется и
 * тормозит плавно, без скачков скорости.
 *
 * БАРЬЕРЫ (Hard Points, velocity-only):
 * Проверяются только 4 точки в центре сторон рамки.
 * Тайл блокирует камеру только при движении В его сторону.
 * Если точка внутри стоп-тайла и камера идёт вниз — она просто остановится.
 * Если камера идёт вверх — пускает, телепорта не будет.
 * Закрасьте регионы на карте и укажите их ID в параметрах.
 * Активные регионы = стены со всех сторон.
 * Направленные = блокируют только один край камеры.
 *
 * ПРИЦЕЛИВАНИЕ:
 * Удержание ПКМ → камера сдвигается к курсору, игрок поворачивается.
 * Клик ЛКМ во время прицела → вызов общего события (например, выстрел).
 *
 * ============================================================================
 * @param --- Камера (ядро) ---
 * @default
 *
 * @param Зум по умолчанию
 * @parent --- Камера (ядро) ---
 * @type number
 * @decimals 2
 * @min 0.10
 * @max 10.0
 * @default 1.00
 * @desc Базовый зум. 1.00 = нормально. 2.00 = вдвое ближе. 0.50 = вдвое дальше.
 *
 * @param Зумить картинки
 * @parent --- Камера (ядро) ---
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 * @desc Картинки (Show Picture) масштабируются вместе с картой при зуме.
 *
 * @param Формула отступа
 * @parent --- Камера (ядро) ---
 * @desc Формула отступа краёв карты при отдалении (zoom < 1). Только для продвинутых.
 * @default (Graphics.width / scale) - Graphics.width
 *
 * @param Чинить полосы
 * @parent --- Камера (ядро) ---
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 * @desc Автоматически убирать чёрные полосы (1px) при движении камеры.
 *
 * ============================================================================
 * @param --- Плавность камеры ---
 * @default
 *
 * @param Инерция
 * @parent --- Плавность камеры ---
 * @type number
 * @decimals 2
 * @min 0
 * @max 1
 * @default 0.18
 * @desc Плавность движения камеры. 0 = жёстко за ГГ. 0.5 = очень плавно. 1 = еле ползёт.
 *
 * @param Сила предсказания
 * @parent --- Плавность камеры ---
 * @type number
 * @decimals 2
 * @min 0
 * @max 1
 * @default 0.35
 * @desc Камера заглядывает вперёд по направлению движения. 0 = не заглядывает. 1 = сильно.
 *
 * @param Макс. скорость
 * @parent --- Плавность камеры ---
 * @type number
 * @decimals 2
 * @min 0.01
 * @default 0.25
 * @desc Макс. скорость камеры (тайлов/кадр). Ограничивает рывок при догоне ГГ.
 *
 * @param Ускорение камеры
 * @parent --- Плавность камеры ---
 * @type number
 * @decimals 3
 * @min 0
 * @max 1
 * @default 0.080
 * @desc Макс. изменение скорости камеры за кадр (тайлов/кадр²). Меньше = плавнее разгон и торможение.
 *
 * @param Инерция скорости
 * @parent --- Плавность камеры ---
 * @type number
 * @decimals 2
 * @min 0
 * @max 1
 * @default 0.35
 * @desc Насколько плавно камера меняет скорость. 0 = резко, 1 = почти не меняется.
 *
 * @param Свитч отключения
 * @parent --- Плавность камеры ---
 * @type switch
 * @default 0
 * @desc Если этот переключатель ON — плавная камера отключается (стандартная RPG Maker).
 *
 * ============================================================================
 * @param --- Барьеры (регионы) ---
 * @default
 *
 * @param Включить барьеры
 * @parent --- Барьеры (регионы) ---
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 * @desc Ограничивать движение камеры по регионам (стены). Закрасьте регионы на карте.
 *
 * @param Активные регионы
 * @parent --- Барьеры (регионы) ---
 * @desc ID регионов-стен через запятую. Блокируют вход камеры со ВСЕХ сторон. Выход разрешён.
 * @default 1, 2, 3, 4, 5
 *
 * @param Регионы слева
 * @parent --- Барьеры (регионы) ---
 * @desc ID регионов через запятую. Блокируют только ЛЕВЫЙ край камеры.
 * @default
 *
 * @param Регионы справа
 * @parent --- Барьеры (регионы) ---
 * @desc ID регионов через запятую. Блокируют только ПРАВЫЙ край камеры.
 * @default
 *
 * @param Регионы сверху
 * @parent --- Барьеры (регионы) ---
 * @desc ID регионов через запятую. Блокируют только ВЕРХНИЙ край камеры.
 * @default
 *
 * @param Регионы снизу
 * @parent --- Барьеры (регионы) ---
 * @desc ID регионов через запятую. Блокируют только НИЖНИЙ край камеры.
 * @default
 *
 * @param Хард-точки по краям
 * @parent --- Барьеры (регионы) ---
 * @type boolean
 * @on Включить
 * @off Выключить
 * @default true
 * @desc Показывать 4 белые точки в центре сторон рамки в отладке. Сами точки всегда работают.
 *
 * ============================================================================
 * @param --- Зоны камеры ---
 * @default
 *
 * @param Ширина рамки
 * @parent --- Зоны камеры ---
 * @type number
 * @min 0
 * @desc Ширина внутренней рамки (коллизии о стены). Пусто = ширина экрана. Меньше = уже зона блокировки.
 * @default
 *
 * @param Высота рамки
 * @parent --- Зоны камеры ---
 * @type number
 * @min 0
 * @desc Высота внутренней рамки (коллизии о стены). Пусто = высота экрана.
 * @default
 *
 * @param Пресеты мёртвой зоны
 * @parent --- Зоны камеры ---
 * @type struct<ZonePreset>[]
 * @default ["{\"Название\":\"Default\",\"Сдвиг X\":\"0\",\"Сдвиг Y\":\"0\",\"Ширина\":\"64\",\"Высота\":\"64\"}"]
 * @desc Мёртвая зона — внутри неё камера стоит на месте. Создайте несколько размеров.
 *
 * @param Активная мёртвая зона
 * @parent --- Зоны камеры ---
 * @type number
 * @min 0
 * @default 0
 * @desc Какой пресет мёртвой зоны использовать (0 = первый, 1 = второй, ...).
 *
 * @param Пресеты мягкой зоны
 * @parent --- Зоны камеры ---
 * @type struct<ZonePreset>[]
 * @default ["{\"Название\":\"Default\",\"Сдвиг X\":\"0\",\"Сдвиг Y\":\"0\",\"Ширина\":\"128\",\"Высота\":\"128\"}"]
 * @desc Мягкая зона — в ней камера плавно догоняет ГГ. Должна быть больше мёртвой.
 *
 * @param Активная мягкая зона
 * @parent --- Зоны камеры ---
 * @type number
 * @min 0
 * @default 0
 * @desc Какой пресет мягкой зоны использовать (0 = первый, 1 = второй, ...).
 *
 * ============================================================================
 * @param --- Отладка ---
 * @default
 *
 * @param Показать зоны
 * @parent --- Отладка ---
 * @type boolean
 * @on Показать
 * @off Скрыть
 * @default false
 * @desc Рисовать на экране: мёртвая зона (кр.), мягкая (зел.), рамка (пурп.), регионы.
 *
 * @param Дебаг HUD
 * @parent --- Отладка ---
 * @type boolean
 * @on Показать
 * @off Скрыть
 * @default false
 * @desc Текстовый HUD в углу: скорость камеры, координаты, статус прицела.
 *
 * ============================================================================
 * @param --- Прицеливание ---
 * @default
 *
 * @param Свитч прицеливания
 * @parent --- Прицеливание ---
 * @type switch
 * @default 1
 * @desc Этот переключатель ON, когда игрок удерживает ПКМ. Используйте в условиях событий.
 *
 * @param Поворот за курсором
 * @parent --- Прицеливание ---
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 * @desc Поворачивать персонажа в сторону курсора при удержании ПКМ.
 *
 * @param Скорость прицеливания
 * @parent --- Прицеливание ---
 * @type number
 * @min 1
 * @max 8
 * @default 3
 * @desc Скорость ходьбы игрока во время прицеливания (1 = очень медленно, 8 = бег).
 *
 * @param Обычный курсор
 * @parent --- Прицеливание ---
 * @type file
 * @dir img/system
 * @desc Файл курсора для обычного режима. Выберите из списка. Пусто = системный курсор.
 * @default
 *
 * @param Курсор прицела
 * @parent --- Прицеливание ---
 * @type file
 * @dir img/system
 * @desc Файл курсора при удержании ПКМ. Выберите из списка. Пусто = системный курсор.
 * @default
 *
 * @param Общее событие
 * @parent --- Прицеливание ---
 * @type number
 * @min 0
 * @default 1
 * @desc ID общего события при клике ЛКМ во время прицела (например, выстрел). 0 = выключено.
 *
 * @param Макс. сдвиг камеры
 * @parent --- Прицеливание ---
 * @type number
 * @min 0
 * @default 60
 * @desc Насколько далеко камера сдвигается к курсору при прицеле (в пикселях).
 *
 * @param Плавность прицела
 * @parent --- Прицеливание ---
 * @type number
 * @decimals 2
 * @min 0.01
 * @max 0.50
 * @default 0.05
 * @desc Плавность сдвига камеры к курсору. Меньше = плавнее. Не зависит от Инерции.
 *
 * @param Возврат в центр
 * @parent --- Прицеливание ---
 * @type number
 * @min 1
 * @default 45
 * @desc Сколько кадров камера возвращается в центр после отпускания ПКМ.
 *
 * @param Свитч откл. сглаживания
 * @parent --- Прицеливание ---
 * @type switch
 * @default 0
 * @desc Если ON — плавная камера отключается при возврате из прицела (резкий возврат).
 */

/*~struct~ZonePreset:
 * @param Название
 * @type text
 * @default Зона
 * @desc Имя пресета (для удобства, не влияет на работу).
 *
 * @param Сдвиг X
 * @type number
 * @default 0
 * @desc Сдвиг центра зоны по горизонтали (в пикселях). + = вправо, − = влево.
 *
 * @param Сдвиг Y
 * @type number
 * @default 0
 * @desc Сдвиг центра зоны по вертикали (в пикселях). + = вниз, − = вверх.
 *
 * @param Ширина
 * @type number
 * @min 1
 * @default 64
 * @desc Ширина зоны (в пикселях). Мёртвая зона: обычно 32–128. Мягкая: 64–256.
 *
 * @param Высота
 * @type number
 * @min 1
 * @default 64
 * @desc Высота зоны (в пикселях).
 */

(function() {
    'use strict';

    //=============================================================================
    // 0. GLOBAL PARAMETER PROXY
    //=============================================================================
    var THIS_PLUGIN_NAME = 'SuperDuperCamera';
    var ALL_PARAMS = PluginManager.parameters(THIS_PLUGIN_NAME);

    var _PluginManager_parameters = PluginManager.parameters;
    PluginManager.parameters = function(name) {
        if (name === 'SRD_CameraCore' || name === 'CombinedCameraSystem' || name === 'CameraScope' || name === 'UnifiedCameraSystem' || name === 'SuperDuperBounds') {
            return ALL_PARAMS;
        }
        return _PluginManager_parameters.call(this, name);
    };

    //=============================================================================
    // 1. SRD CAMERA CORE LOGIC
    //=============================================================================
    var SRD = SRD || {};
    SRD.CameraCore = SRD.CameraCore || {};
    var Imported = Imported || {};
    Imported["SumRndmDde Camera Core"] = 1.05;
    Imported["CameraScope Bridge"] = 6.5;

    (function(_) {
        const params = PluginManager.parameters(THIS_PLUGIN_NAME);

        _.zoom = parseFloat(params['Зум по умолчанию'] || 1);
        _.pics = String(params['Зумить картинки']).trim().toLowerCase() === 'true';
        _.margin = String(params['Формула отступа']);
        _.fixYan1 = String(params['Чинить полосы']).trim().toLowerCase() === 'true';

        const _Game_Screen_clear = Game_Screen.prototype.clear;
        Game_Screen.prototype.clear = function() {
            _Game_Screen_clear.apply(this, arguments);
            this._playerRegionId = 0;
            this._playerZoomInfo = null;
            this._completeZoomIn = 0;
            this._zoomXTarget = this._zoomX;
            this._zoomYTarget = this._zoomY;
            this._zoomXSpeed = 0;
            this._zoomYSpeed = 0;
            this.focusEvent = 0;
        };

        const _Game_Screen_updateZoom = Game_Screen.prototype.updateZoom;
        Game_Screen.prototype.updateZoom = function() {
            _Game_Screen_updateZoom.apply(this, arguments);
            this.updateTilemapMargin();
        };

        Game_Screen.prototype.clearZoom = function() {
            this._zoomX = Graphics.boxWidth / 2;
            this._zoomY = Graphics.boxHeight / 2;
            this._zoomScale = _.zoom;
            this._zoomScaleTarget = _.zoom;
            this._zoomDuration = 0;
            this.refreshZoomInfo();
            this.refreshTilemapMargin(this._zoomScale);
            if (SceneManager.isNextScene(Scene_Battle)) {
                this.ultraClearZoom();
            }
        };

        Game_Screen.prototype.refreshZoomInfo = function() {
            if (this._playerZoomInfo) {
                this._zoomX = this._playerZoomInfo.x;
                this._zoomY = this._playerZoomInfo.y;
                this._zoomScale = this._playerZoomInfo.scale;
                this._zoomScaleTarget = this._playerZoomInfo.scale;
                this._zoomDuration = this._playerZoomInfo.duration;
            }
        };

        Game_Screen.prototype.ultraClearZoom = function() {
            this._zoomX = 0;
            this._zoomY = 0;
            this._zoomScale = 1;
            this._zoomScaleTarget = 1;
            this._zoomDuration = 0;
        };

        const _Game_Screen_onBattleStart = Game_Screen.prototype.onBattleStart;
        Game_Screen.prototype.onBattleStart = function() {
            _Game_Screen_onBattleStart.apply(this, arguments);
            this.ultraClearZoom();
        };

        Game_Screen.prototype.setCameraFocus = function(scale, duration, nullify) {
            this.setupZoomInfo(scale, duration);
            this.setupZoomStuff();
            if (duration === 0) {
                this._zoomScale = this._zoomScaleTarget;
                this._zoomDuration = 0;
            }
            if (nullify) this._playerZoomInfo = null;
            this.setupTilemapMargin();
        };

        Game_Screen.prototype.setupZoomInfo = function(scale, duration) {
            this._playerZoomInfo = {};
            this._playerZoomInfo.x = Graphics.boxWidth / 2;
            this._playerZoomInfo.y = Graphics.boxHeight / 2;
            this._playerZoomInfo.scale = eval(scale) * _.zoom;
            this._playerZoomInfo.duration = eval(duration);
        };

        Game_Screen.prototype.setupZoomStuff = function() {
            this._zoomX = this._playerZoomInfo.x;
            this._zoomY = this._playerZoomInfo.y;
            this._zoomScaleTarget = this._playerZoomInfo.scale;
            this._zoomDuration = this._playerZoomInfo.duration;
        };

        Game_Screen.prototype.resetCameraFocus = function(duration) {
            this.setCameraFocus(_.zoom, duration, true);
        };

        Game_Screen.prototype.setupTilemapMargin = function() {
            if (this._zoomScaleTarget < this._zoomScale) {
                this.refreshTilemapMargin(this._zoomScaleTarget);
                this._completeZoomIn = 2;
            } else {
                this._completeZoomIn = 1;
            }
        };

        Game_Screen.prototype.updateTilemapMargin = function() {
            if (this._zoomDuration === 0 && this._completeZoomIn) {
                this.refreshTilemapMargin(this._zoomScale);
                this._completeZoomIn = 0;
            } else if (this._zoomDuration === 0 && this._completeZoomIn) {
                this.refreshTilemapMargin(this._zoomScaleTarget);
                this._completeZoomIn = 0;
            }
        };

        Game_Screen.prototype.refreshTilemapMargin = function(scale) {
            if (SceneManager._scene.constructor === Scene_Map) {
                const margin = (this._zoomScaleTarget < 1) ? eval(_.margin) : 1;
                const tilemap = SceneManager._scene._spriteset._tilemap;
                tilemap._margin = margin;
                tilemap.width = Graphics.width + (margin * 2);
                tilemap.height = Graphics.height + (margin * 2);
            }
        };

        Game_Screen.prototype.isCameraZooming = function() {
            return Boolean(this._zoomDuration > 0);
        };

        if (!Game_Character.prototype.updateScroll) {
            Game_Character.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
                var x1 = lastScrolledX;
                var y1 = lastScrolledY;
                var x2 = this.scrolledX();
                var y2 = this.scrolledY();
                if (y2 > y1 && y2 > this.centerY()) $gameMap.scrollDown(y2 - y1);
                if (x2 < x1 && x2 < this.centerX()) $gameMap.scrollLeft(x1 - x2);
                if (x2 > x1 && x2 > this.centerX()) $gameMap.scrollRight(x2 - x1);
                if (y2 < y1 && y2 < this.centerY()) $gameMap.scrollUp(y1 - y2);
            };
        }

        Game_CharacterBase.prototype.centerX = function() { return (Graphics.width / $gameMap.tileWidth() - 1) / 2.0; };
        Game_CharacterBase.prototype.centerY = function() { return (Graphics.height / $gameMap.tileHeight() - 1) / 2.0; };
        Game_CharacterBase.prototype.centerCamera = function(dur) { return $gameMap.setDisplayPosStart(this.x - this.centerX(), this.y - this.centerY(), dur); };
        Game_CharacterBase.prototype.centerCameraOnPos = function(x, y, dur) { return $gameMap.setDisplayPosStart(x - this.centerX(), y - this.centerY(), dur); };

        const _Game_Event_update = Game_Event.prototype.update;
        Game_Event.prototype.update = function() {
            var lastScrolledX = this.scrolledX();
            var lastScrolledY = this.scrolledY();
            _Game_Event_update.apply(this, arguments);
            this.updateScroll(lastScrolledX, lastScrolledY);
        };

        Game_Event.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
            if ($gameScreen.focusEvent === this._eventId) Game_Character.prototype.updateScroll.apply(this, arguments);
        };

        const _Game_Follower_update = Game_Follower.prototype.update;
        Game_Follower.prototype.update = function() {
            var lastScrolledX = this.scrolledX();
            var lastScrolledY = this.scrolledY();
            _Game_Follower_update.apply(this, arguments);
            this.updateScroll(lastScrolledX, lastScrolledY);
        };

        Game_Follower.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
            if ($gameScreen.focusEvent === this._memberIndex * (-1)) Game_Character.prototype.updateScroll.apply(this, arguments);
        };

        const _Game_Map_initialize = Game_Map.prototype.initialize;
        Game_Map.prototype.initialize = function() {
            _Game_Map_initialize.apply(this, arguments);
            this._newDisplayX = 0; this._newDisplayY = 0;
            this._newParallaxX = 0; this._newParallaxY = 0;
            this._scrollDuration = 0;
            this._displayXSpeed = 0; this._displayYSpeed = 0;
            this._parallaxXSpeed = 0; this._parallaxYSpeed = 0;
        };

        const _Game_Map_setup = Game_Map.prototype.setup;
        Game_Map.prototype.setup = function(mapId) {
            this._newDisplayX = 0; this._newDisplayY = 0;
            this._scrollDuration = 0;
            $gameScreen.focusEvent = 0;
            $gameScreen.resetCameraFocus(0);
            _Game_Map_setup.apply(this, arguments);
            this._parallaxX = this._displayX;
            this._parallaxY = this._displayY;
        };

        Game_Map.prototype.setDisplayPosStart = function(x, y, dur) {
            if (dur <= 1) {
                this.setDisplayPos.call(this, x, y);
                this._parallaxX = this._displayX;
                this._parallaxY = this._displayY;
            } else {
                this.setDisplayPosInfo(x, y);
                this.setDisplayPosSpeeds(dur);
            }
        };

        Game_Map.prototype.shiftCameraPosition = function(x, y, dur) {
            this.setDisplayPosStart(this._displayX + x, this._displayY + y, dur);
        };

        Game_Map.prototype.setDisplayPosInfo = function(x, y) {
            if (this.isLoopHorizontal()) {
                this._newDisplayX = x.mod(this.width());
                this._newParallaxX = x;
            } else {
                var endX = this.width() - this.screenTileX();
                this._newDisplayX = endX < 0 ? endX / 2 : x.clamp(0, endX);
                this._newParallaxX = this._newDisplayX;
            }
            if (this.isLoopVertical()) {
                this._newDisplayY = y.mod(this.height());
                this._newParallaxY = y;
            } else {
                var endY = this.height() - this.screenTileY();
                this._newDisplayY = endY < 0 ? endY / 2 : y.clamp(0, endY);
                this._newParallaxY = this._newDisplayY;
            }
            if (this._scrollDuration <= 1) {
                this._parallaxX = this._newParallaxX;
                this._parallaxY = this._newParallaxY;
            }
        };

        Game_Map.prototype.setDisplayPosSpeeds = function(dur) {
            this._scrollDuration = dur;
            this._displayXSpeed = (this._newDisplayX - this._displayX) / this._scrollDuration;
            this._displayYSpeed = (this._newDisplayY - this._displayY) / this._scrollDuration;
            this._parallaxXSpeed = (this._newParallaxX - this._parallaxX) / this._scrollDuration;
            this._parallaxYSpeed = (this._newParallaxY - this._parallaxY) / this._scrollDuration;
        };

        const _Game_Map_updateScroll = Game_Map.prototype.updateScroll;
        Game_Map.prototype.updateScroll = function() {
            _Game_Map_updateScroll.apply(this, arguments);
            this.updateCameraScroll();
        };

        Game_Map.prototype.updateCameraScroll = function() {
            if (this._scrollDuration > 0) {
                this._scrollDuration--;
                this._displayX += this._displayXSpeed;
                this._displayY += this._displayYSpeed;
                this._parallaxX += this._parallaxXSpeed;
                this._parallaxY += this._parallaxYSpeed;
            }
        };

        Game_Map.prototype.isCameraScrolling = function() { return Boolean(this._scrollDuration > 0); };

        const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
        Game_Interpreter.prototype.pluginCommand = function(command, args) {
            _Game_Interpreter_pluginCommand.apply(this, arguments);
            const com = command.trim().toLowerCase();
            const checkDur = function(i) { return (args[i]) ? eval(args[i]) : 0; };
            const resetSC = () => {
                if (window.SC) {
                    window.SC._isInitialized = false;
                    window.SC._lastRX = null;
                    window.SC._lastRY = null;
                }
            };

            if (com === 'zoomin') $gameScreen.setCameraFocus(String(args[0]), checkDur(1));
            else if (com === 'zoomout') $gameScreen.setCameraFocus("1/(" + String(args[0]) + ")", checkDur(1));
            else if (com === 'focuscamera') {
                const com2 = String(args[0]).trim().toLowerCase();
                if (com2 === 'event') {
                    const eventId = eval(args[1]);
                    if ($gameMap.event(eventId)) {
                        $gameScreen.focusEvent = eventId;
                        resetSC();
                        $gameMap.event(eventId).centerCamera(checkDur(2));
                    }
                } else if (com2 === 'follower') {
                    const followerId = eval(args[1]);
                    if ($gamePlayer.followers().follower(followerId - 1)) {
                        $gameScreen.focusEvent = (followerId * (-1));
                        resetSC();
                        $gamePlayer.followers().follower(followerId - 1).centerCamera(checkDur(2));
                    }
                } else if (com2 === 'player') {
                    $gameScreen.focusEvent = 0; resetSC(); $gamePlayer.centerCamera(checkDur(1));
                } else {
                    $gameScreen.focusEvent = null; resetSC(); $gamePlayer.centerCameraOnPos(eval(args[0]), eval(args[1]), checkDur(2));
                }
            } else if (com === 'resetfocus') { $gameScreen.focusEvent = 0; resetSC(); $gamePlayer.centerCamera(checkDur(0)); }
            else if (com === 'resetzoom') $gameScreen.resetCameraFocus(checkDur(0));
            else if (com === 'setdefaultzoom') _.zoom = eval(args[0]);
            else if (com === 'shiftcamera') $gameMap.shiftCameraPosition(eval(args[0]), eval(args[1]), checkDur(2));
            else if (com === 'waitforcamera') this.setWaitMode('camera');
            else if (com === 'waitforcamerafocus') this.setWaitMode('camera-focus');
            else if (com === 'waitforcamerazoom') this.setWaitMode('camera-zoom');
        };

        const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
        Game_Interpreter.prototype.updateWaitMode = function() {
            let waiting = null;
            if (this._waitMode === 'camera') waiting = ($gameMap.isCameraScrolling() || $gameScreen.isCameraZooming());
            else if (this._waitMode === 'camera-focus') waiting = $gameMap.isCameraScrolling();
            else if (this._waitMode === 'camera-zoom') waiting = $gameScreen.isCameraZooming();
            if (waiting) return true;
            else if (waiting === false) { this._waitMode = ''; return false; }
            return _Game_Interpreter_updateWaitMode.apply(this, arguments);
        };

        const _Scene_Map_start = Scene_Map.prototype.start;
        Scene_Map.prototype.start = function() {
            _Scene_Map_start.apply(this, arguments);
            $gameScreen.clearZoom();
        };

        if (Imported.YEP_CoreEngine && _.fixYan1) {
            Sprite.prototype.updateTransform = function() {
                PIXI.Sprite.prototype.updateTransform.call(this);
                if (this._offset) {
                    this.worldTransform.tx += this._offset.x;
                    this.worldTransform.ty += this._offset.y;
                }
            };
        }

        if (_.pics) {
            Scene_Base.prototype.createPicturesForCameraCore = Spriteset_Base.prototype.createPictures;
            const _Scene_Map_createSpriteset = Scene_Map.prototype.createSpriteset;
            Scene_Map.prototype.createSpriteset = function() { _Scene_Map_createSpriteset.apply(this, arguments); this.createPicturesForCameraCore(); };
            const _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
            Scene_Battle.prototype.createSpriteset = function() { _Scene_Battle_createSpriteset.apply(this, arguments); this.createPicturesForCameraCore(); };
            Spriteset_Base.prototype.createPictures = function() {};
        }

    })(SRD.CameraCore);


    //=============================================================================
    // 2. SMOOTH CAMERA & BOUNDS PHYSICS (Hero-Anchored Physics)
    //=============================================================================
    (function() {
        var Params = PluginManager.parameters(THIS_PLUGIN_NAME);

        var PREDICT = Number(Params['Сила предсказания'] || 0.35);
        var INERTIA = Number(Params['Инерция'] || 0.18);
        var ACCEL = Number(Params['Ускорение камеры'] || 0.08);
        var SPEED_INERTIA = Number(Params['Инерция скорости'] || 0.35);
        var DISABLE_SWITCH_ID = Number(Params['Свитч отключения'] || 0) | 0;
        var DEBUG_VISIBLE = String(Params['Показать зоны'] || 'false') === 'true';
        var SHOW_DEBUG_HUD = String(Params['Дебаг HUD'] || 'false') === 'true';

        var ENABLE_BOUNDS = String(Params['Включить барьеры'] || 'true') === 'true';
        var HARD_MIDPOINTS = String(Params['Хард-точки по краям'] || 'true') === 'true';

        var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
        var coreW = core ? core.screen.width : 1280;
        var coreH = core ? core.screen.height : 720;
        var pFrameW = Params['Ширина рамки'] ? Number(Params['Ширина рамки']) : 0;
        var pFrameH = Params['Высота рамки'] ? Number(Params['Высота рамки']) : 0;
        function FRAME_WIDTH() { return pFrameW || Graphics.width; }
        function FRAME_HEIGHT() { return pFrameH || Graphics.height; }
        var MAX_GLIDE_SPEED = Number(Params['Макс. скорость'] || 0.25);


        var parseRegions = function(str) {
            if (!str) return [];
            return String(str).split(',').map(function(s) { return Number(s.trim()); }).filter(function(n) { return !isNaN(n) && n > 0; });
        };
        var ACTIVE_REGIONS = parseRegions(Params['Активные регионы'] || '1, 2, 3, 4, 5');
        var LEFT_REGIONS = parseRegions(Params['Регионы слева'] || '');
        var RIGHT_REGIONS = parseRegions(Params['Регионы справа'] || '');
        var TOP_REGIONS = parseRegions(Params['Регионы сверху'] || '');
        var BOTTOM_REGIONS = parseRegions(Params['Регионы снизу'] || '');
        var ACTIVE_SET = new Set(ACTIVE_REGIONS);
        var LEFT_SET = new Set(LEFT_REGIONS);
        var RIGHT_SET = new Set(RIGHT_REGIONS);
        var TOP_SET = new Set(TOP_REGIONS);
        var BOTTOM_SET = new Set(BOTTOM_REGIONS);

        function parseStructArray(raw) {
            if (!raw || raw === '') return [];
            try {
                var arr = JSON.parse(raw);
                if (!Array.isArray(arr)) return [];
                return arr.map(function(s) {
                    if (typeof s !== 'string') return null;
                    try { return JSON.parse(s); } catch (e) { return null; }
                }).filter(function(o) { return o && typeof o === 'object'; });
            } catch (e) { return []; }
        }

        var DEAD_LIST = parseStructArray(Params['Пресеты мёртвой зоны']);
        var SOFT_LIST = parseStructArray(Params['Пресеты мягкой зоны']);
        var DEAD_IDX = Math.max(0, Math.min(DEAD_LIST.length - 1, Number(Params['Активная мёртвая зона'] || 0) | 0));
        var SOFT_IDX = Math.max(0, Math.min(SOFT_LIST.length - 1, Number(Params['Активная мягкая зона'] || 0) | 0));

        function zoneFrom(list, idx, defW, defH) {
            var z = list && list[idx];
            if (!z) return { name: 'Default', x: 0, y: 0, w: defW, h: defH };
            return {
                name: String(z['Название'] || 'Zone'),
                x: Number(z['Сдвиг X'] || 0),
                y: Number(z['Сдвиг Y'] || 0),
                w: Number(z['Ширина'] || defW),
                h: Number(z['Высота'] || defH)
            };
        }

        // ============================================================================
        // HARD POINT CONSTRAINTS (velocity-only)
        // Only 4 midpoints of the frame sides are checked.
        // A midpoint blocks velocity toward that side; moving away is allowed.
        // ============================================================================

        Game_Map.prototype.resolveHeroBounds = function(targetCx, targetCy, prevCx, prevCy) {
            if (ACTIVE_REGIONS.length === 0 && LEFT_REGIONS.length === 0 && RIGHT_REGIONS.length === 0 && TOP_REGIONS.length === 0 && BOTTOM_REGIONS.length === 0) {
                return {x: targetCx, y: targetCy};
            }

            var hasPrev = arguments.length >= 4 && isFinite(prevCx) && isFinite(prevCy);

            var zoom = ($gameScreen && $gameScreen._zoomScale) ? $gameScreen._zoomScale : 1.0;
            if (!isFinite(zoom) || zoom <= 0) zoom = 1.0;

            var tw = this.tileWidth();
            var th = this.tileHeight();
            var halfWPx = (FRAME_WIDTH() / zoom) / 2;
            var halfHPx = (FRAME_HEIGHT() / zoom) / 2;
            if (!isFinite(halfWPx) || !isFinite(halfHPx)) return {x: targetCx, y: targetCy};

            var EPS = 0.001;
            var DIR_EPS = 1e-6;
            var map = this;
            var regionAt = function(c, r) { return map.isValid(c, r) ? map.regionId(c, r) : -1; };

            var cx = targetCx * tw;
            var cy = targetCy * th;
            var resX = cx;
            var resY = cy;

            var dx = hasPrev ? (targetCx - prevCx) : 0;
            var dy = hasPrev ? (targetCy - prevCy) : 0;

            function rightBlocked(x, y) {
                var c = Math.floor((x + halfWPx + EPS) / tw);
                var r = regionAt(c, Math.floor((y + EPS) / th));
                return ACTIVE_SET.has(r) || RIGHT_SET.has(r);
            }
            function leftBlocked(x, y) {
                var c = Math.floor((x - halfWPx - EPS) / tw);
                var r = regionAt(c, Math.floor((y + EPS) / th));
                return ACTIVE_SET.has(r) || LEFT_SET.has(r);
            }
            function bottomBlocked(x, y) {
                var r = Math.floor((y + halfHPx + EPS) / th);
                var c = regionAt(Math.floor((x + EPS) / tw), r);
                return ACTIVE_SET.has(c) || BOTTOM_SET.has(c);
            }
            function topBlocked(x, y) {
                var r = Math.floor((y - halfHPx - EPS) / th);
                var c = regionAt(Math.floor((x + EPS) / tw), r);
                return ACTIVE_SET.has(c) || TOP_SET.has(c);
            }

            // Two passes to handle corners correctly
            for (var i = 0; i < 2; i++) {
                // Horizontal
                if (dx > DIR_EPS && rightBlocked(resX, resY)) {
                    resX = Math.floor((resX + halfWPx + EPS) / tw) * tw - halfWPx;
                } else if (dx < -DIR_EPS && leftBlocked(resX, resY)) {
                    resX = (Math.floor((resX - halfWPx - EPS) / tw) + 1) * tw + halfWPx;
                } else if (Math.abs(dx) <= DIR_EPS) {
                    var rb = rightBlocked(resX, resY);
                    var lb = leftBlocked(resX, resY);
                    if (rb && !lb) {
                        resX = Math.floor((resX + halfWPx + EPS) / tw) * tw - halfWPx;
                    } else if (lb && !rb) {
                        resX = (Math.floor((resX - halfWPx - EPS) / tw) + 1) * tw + halfWPx;
                    }
                }

                // Vertical
                if (dy > DIR_EPS && bottomBlocked(resX, resY)) {
                    resY = Math.floor((resY + halfHPx + EPS) / th) * th - halfHPx;
                } else if (dy < -DIR_EPS && topBlocked(resX, resY)) {
                    resY = (Math.floor((resY - halfHPx - EPS) / th) + 1) * th + halfHPx;
                } else if (Math.abs(dy) <= DIR_EPS) {
                    var bb = bottomBlocked(resX, resY);
                    var tb = topBlocked(resX, resY);
                    if (bb && !tb) {
                        resY = Math.floor((resY + halfHPx + EPS) / th) * th - halfHPx;
                    } else if (tb && !bb) {
                        resY = (Math.floor((resY - halfHPx - EPS) / th) + 1) * th + halfHPx;
                    }
                }
            }

            return {x: resX / tw, y: resY / th};
        };

        // Returns which sides are currently blocked at the given camera center.
        // Used to zero velocity instead of teleporting the camera position.
        Game_Map.prototype.getCameraBoundFlags = function(targetCx, targetCy) {
            var flags = { right: false, left: false, bottom: false, top: false };
            if (ACTIVE_REGIONS.length === 0 && LEFT_REGIONS.length === 0 && RIGHT_REGIONS.length === 0 && TOP_REGIONS.length === 0 && BOTTOM_REGIONS.length === 0) {
                return flags;
            }

            var zoom = ($gameScreen && $gameScreen._zoomScale) ? $gameScreen._zoomScale : 1.0;
            if (!isFinite(zoom) || zoom <= 0) zoom = 1.0;

            var tw = this.tileWidth();
            var th = this.tileHeight();
            var halfWPx = (FRAME_WIDTH() / zoom) / 2;
            var halfHPx = (FRAME_HEIGHT() / zoom) / 2;
            if (!isFinite(halfWPx) || !isFinite(halfHPx)) return flags;

            var EPS = 0.001;
            var cx = targetCx * tw;
            var cy = targetCy * th;
            var map = this;
            var regionAt = function(c, r) { return map.isValid(c, r) ? map.regionId(c, r) : -1; };

            var rightCol = Math.floor((cx + halfWPx + EPS) / tw);
            var rightReg = regionAt(rightCol, Math.floor((cy + EPS) / th));
            if (ACTIVE_SET.has(rightReg) || RIGHT_SET.has(rightReg)) flags.right = true;

            var leftCol = Math.floor((cx - halfWPx - EPS) / tw);
            var leftReg = regionAt(leftCol, Math.floor((cy + EPS) / th));
            if (ACTIVE_SET.has(leftReg) || LEFT_SET.has(leftReg)) flags.left = true;

            var botRow = Math.floor((cy + halfHPx + EPS) / th);
            var botReg = regionAt(Math.floor((cx + EPS) / tw), botRow);
            if (ACTIVE_SET.has(botReg) || BOTTOM_SET.has(botReg)) flags.bottom = true;

            var topRow = Math.floor((cy - halfHPx - EPS) / th);
            var topReg = regionAt(Math.floor((cx + EPS) / tw), topRow);
            if (ACTIVE_SET.has(topReg) || TOP_SET.has(topReg)) flags.top = true;

            return flags;
        };

        // Wrapper for Scope fallback: converts display coords to camera center and back
        Game_Map.prototype.resolveCameraBounds = function(displayX, displayY) {
            if (this._resolvingCameraBounds) return {x: displayX, y: displayY};
            this._resolvingCameraBounds = true;

            var tw = this.tileWidth();
            var th = this.tileHeight();
            var centerX = ($gamePlayer && $gamePlayer.centerX) ? $gamePlayer.centerX() : (Graphics.width / tw - 1) / 2.0;
            var centerY = ($gamePlayer && $gamePlayer.centerY) ? $gamePlayer.centerY() : (Graphics.height / th - 1) / 2.0;
            var targetCx = displayX + centerX + 0.5;
            var targetCy = displayY + centerY + 0.5;
            var resolved = this.resolveHeroBounds(targetCx, targetCy, targetCx, targetCy);

            this._resolvingCameraBounds = false;
            return {
                x: resolved.x - centerX - 0.5,
                y: resolved.y - centerY - 0.5
            };
        };

        var SC = {
            predict: PREDICT,
            inertia: INERTIA,
            maxGlideSpeed: MAX_GLIDE_SPEED,
            deadIdx: DEAD_IDX,
            softIdx: SOFT_IDX,
            
            camPxX: 0,
            camPxY: 0,
            camVx: 0,
            camVy: 0,

            _lastRX: null,
            _lastRY: null,
            debugVisible: DEBUG_VISIBLE,
            showHud: SHOW_DEBUG_HUD,
            _isInitialized: false,
            _dbg: false,

            boundsEnabled: ENABLE_BOUNDS,

            tileW: function() { return $gameMap && $gameMap.tileWidth ? $gameMap.tileWidth() : 48; },
            tileH: function() { return $gameMap && $gameMap.tileHeight ? $gameMap.tileHeight() : 48; },
            centerTilesX: function() { return $gamePlayer && $gamePlayer.centerX ? $gamePlayer.centerX() : 0; },
            centerTilesY: function() { return $gamePlayer && $gamePlayer.centerY ? $gamePlayer.centerY() : 0; },

            isSwitchOn: function() {
                var id = DISABLE_SWITCH_ID;
                return id > 0 && $gameSwitches && $gameSwitches.value && $gameSwitches.value(id);
            },

            currentDead: function() { return zoneFrom(DEAD_LIST, this.deadIdx, 64, 64); },
            currentSoft: function() { return zoneFrom(SOFT_LIST, this.softIdx, 128, 128); },

            seedFromDisplay: function() {
                if (!$gameMap || !$gameMap.displayX || !$gameMap.displayY) return;
                var tw = this.tileW(), th = this.tileH();
                var currentDispX = $gameMap.displayX();
                var currentDispY = $gameMap.displayY();

                if (!isFinite(currentDispX) || !isFinite(currentDispY)) {
                    currentDispX = 0; currentDispY = 0;
                }

                if ($gameTemp && $gameTemp._rmsCameraOffsetX) currentDispX -= $gameTemp._rmsCameraOffsetX;
                if ($gameTemp && $gameTemp._rmsCameraOffsetY) currentDispY -= $gameTemp._rmsCameraOffsetY;

                this.camPxX = (currentDispX + this.centerTilesX() + 0.5) * tw;
                this.camPxY = (currentDispY + this.centerTilesY() + 0.5) * th;
                this.camVx = 0;
                this.camVy = 0;

                if ($gamePlayer) {
                    this._lastRX = (typeof $gamePlayer._realX === 'number') ? $gamePlayer._realX : $gamePlayer.x;
                    this._lastRY = (typeof $gamePlayer._realY === 'number') ? $gamePlayer._realY : $gamePlayer.y;
                }
                this._isInitialized = true;
            },

            update: function() {
                if (!$gameMap || !$gamePlayer || !$gameScreen) return;
                
                if ($gameScreen.focusEvent !== 0) {
                    this._isInitialized = false;
                    this._lastRX = null;
                    this._lastRY = null;
                    this.camVx = 0;
                    this.camVy = 0;
                    return;
                }
                if (this.isSwitchOn()) return;

                if (!this._isInitialized) {
                    this.seedFromDisplay();
                    return;
                }

                var tw = this.tileW(), th = this.tileH();
                var rx = (typeof $gamePlayer._realX === 'number') ? $gamePlayer._realX : $gamePlayer.x;
                var ry = (typeof $gamePlayer._realY === 'number') ? $gamePlayer._realY : $gamePlayer.y;

                if (this._lastRX === null || this._lastRY === null) {
                    this._lastRX = rx;
                    this._lastRY = ry;
                    this.seedFromDisplay();
                    return;
                }

                var vxTiles = rx - this._lastRX;
                var vyTiles = ry - this._lastRY;
                this._lastRX = rx;
                this._lastRY = ry;

                // 1. PREDICTION (velocity-based, capped per-axis)
                var lookFrames = 8 * this.predict;
                var maxPred = 5;
                var predX = Math.max(-maxPred, Math.min(maxPred, vxTiles * lookFrames));
                var predY = Math.max(-maxPred, Math.min(maxPred, vyTiles * lookFrames));
                var heroPxX = (rx + predX + 0.5) * tw;
                var heroPxY = (ry + predY + 0.5) * th;

                // 2. DEAD ZONE + SOFT ZONE (smoothstep ramp, per-axis)
                var dead = this.currentDead();
                var soft = this.currentSoft();

                heroPxX += Number(dead.x) || 0;
                heroPxY += Number(dead.y) || 0;

                var camX = this.camPxX, camY = this.camPxY;
                var dx = heroPxX - camX;
                var dy = heroPxY - camY;

                var targetX = camX, targetY = camY;
                var useDead = (dead.w > 0 && dead.h > 0);

                if (useDead) {
                    var ax = Math.abs(dx), ay = Math.abs(dy);
                    var overX = ax - dead.w / 2;
                    var overY = ay - dead.h / 2;
                    var softW = Math.max(1, Number(soft.w) || 1);
                    var softH = Math.max(1, Number(soft.h) || 1);
                    if (overX > 0) {
                        var tx = Math.min(1, overX / softW);
                        tx = tx * tx * (3 - 2 * tx);
                        targetX = camX + Math.sign(dx) * overX * tx;
                    }
                    if (overY > 0) {
                        var ty = Math.min(1, overY / softH);
                        ty = ty * ty * (3 - 2 * ty);
                        targetY = camY + Math.sign(dy) * overY * ty;
                    }
                } else {
                    targetX = heroPxX;
                    targetY = heroPxY;
                }

                // 3. SPEED-STABILIZED SMOOTHING
                var desiredVx = (targetX - camX) * (1 - this.inertia);
                var desiredVy = (targetY - camY) * (1 - this.inertia);

                this.camVx += (desiredVx - this.camVx) * SPEED_INERTIA;
                this.camVy += (desiredVy - this.camVy) * SPEED_INERTIA;

                // Hard acceleration limit
                var maxAccelPx = ACCEL * tw;
                var prevVx = this.camVx;
                var prevVy = this.camVy;
                this.camVx = Math.max(prevVx - maxAccelPx, Math.min(prevVx + maxAccelPx, this.camVx));
                this.camVy = Math.max(prevVy - maxAccelPx, Math.min(prevVy + maxAccelPx, this.camVy));

                // Max speed cap
                var moveSpeed = Math.hypot(this.camVx, this.camVy);
                var maxSpeedPx = this.maxGlideSpeed * tw;
                if (moveSpeed > maxSpeedPx && moveSpeed > 0) {
                    this.camVx = (this.camVx / moveSpeed) * maxSpeedPx;
                    this.camVy = (this.camVy / moveSpeed) * maxSpeedPx;
                }

                // 4. HARD POINT CONSTRAINTS (velocity-only)
                // Only 4 midpoints of the frame sides are checked.
                // If a side is blocked, we zero velocity toward that side.
                // Moving away from the wall is always allowed.
                if (this.boundsEnabled && typeof $gameMap.getCameraBoundFlags === 'function') {
                    var flags = $gameMap.getCameraBoundFlags(this.camPxX / tw, this.camPxY / th);
                    if (flags.right && this.camVx > 0) this.camVx = 0;
                    if (flags.left && this.camVx < 0) this.camVx = 0;
                    if (flags.bottom && this.camVy > 0) this.camVy = 0;
                    if (flags.top && this.camVy < 0) this.camVy = 0;
                }

                this.camPxX += this.camVx;
                this.camPxY += this.camVy;

                // NaN safety
                if (!isFinite(this.camPxX) || !isFinite(this.camPxY) || !isFinite(this.camVx) || !isFinite(this.camVy)) {
                    this.seedFromDisplay();
                    return;
                }

                this.applyDisplay();
            },

            applyDisplay: function() {
                if (!$gameMap || !$gameMap.setDisplayPos) return;
                var tw = this.tileW(), th = this.tileH();
                
                var scopeOffX = ($gameTemp && $gameTemp._rmsCameraOffsetX) ? $gameTemp._rmsCameraOffsetX : 0;
                var scopeOffY = ($gameTemp && $gameTemp._rmsCameraOffsetY) ? $gameTemp._rmsCameraOffsetY : 0;
                
                // Convert camera pixels to display coordinates
                var finalDispX = (this.camPxX / tw) - this.centerTilesX() - 0.5 + scopeOffX;
                var finalDispY = (this.camPxY / th) - this.centerTilesY() - 0.5 + scopeOffY;

                // Clamp to map bounds
                var zoom = ($gameScreen && $gameScreen._zoomScale) ? $gameScreen._zoomScale : 1.0;
                if (!isFinite(zoom) || zoom <= 0) zoom = 1.0;
                var screenTilesX = (Graphics.boxWidth / tw) / zoom;
                var screenTilesY = (Graphics.boxHeight / th) / zoom;
                var maxX = $gameMap.width() - screenTilesX;
                var maxY = $gameMap.height() - screenTilesY;
                
                finalDispX = Math.max(0, Math.min(Math.max(0, maxX), finalDispX));
                finalDispY = Math.max(0, Math.min(Math.max(0, maxY), finalDispY));

                this._isUpdatingDisp = true;
                $gameMap.setDisplayPos(finalDispX, finalDispY);
                this._isUpdatingDisp = false;
            }
        };

        window.SC = SC;

        // Sync camera when engine sets display position directly
        var _Game_Map_setDisplayPos = Game_Map.prototype.setDisplayPos;
        Game_Map.prototype.setDisplayPos = function(x, y) {
            if (!isFinite(x) || !isFinite(y)) return;
            _Game_Map_setDisplayPos.call(this, x, y);
            if (window.SC && !window.SC._isUpdatingDisp && window.SC._isInitialized) {
                var tw = window.SC.tileW(), th = window.SC.tileH();
                var scopeOffX = ($gameTemp && $gameTemp._rmsCameraOffsetX) ? $gameTemp._rmsCameraOffsetX : 0;
                var scopeOffY = ($gameTemp && $gameTemp._rmsCameraOffsetY) ? $gameTemp._rmsCameraOffsetY : 0;
                window.SC.camPxX = (x - scopeOffX + window.SC.centerTilesX() + 0.5) * tw;
                window.SC.camPxY = (y - scopeOffY + window.SC.centerTilesY() + 0.5) * th;
            }
        };

        var _Scene_Map_start = Scene_Map.prototype.start;
        Scene_Map.prototype.start = function() {
            _Scene_Map_start.call(this);
            if (SC) {
                SC._isInitialized = false;
                SC._lastRX = null;
                SC._lastRY = null;
                SC.camVx = 0;
                SC.camVy = 0;
            }
        };

        // Event-based teleport detection (clean reset on map transfer)
        var _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
        Game_Player.prototype.performTransfer = function() {
            _Game_Player_performTransfer.apply(this, arguments);
            if (window.SC) {
                SC._isInitialized = false;
                SC._lastRX = null;
                SC._lastRY = null;
                SC.camVx = 0;
                SC.camVy = 0;
            }
        };

        var _Scene_Map_updateMain = Scene_Map.prototype.updateMain;
        Scene_Map.prototype.updateMain = function() {
            _Scene_Map_updateMain.call(this);
            if (window.SC) window.SC.update();
        };

        // ====================================================================
        // ADVANCED PIXI DEBUG LAYER (Crystal Debug Fix)
        // ====================================================================
        function SmoothCamDebugLayer() { this.initialize.apply(this, arguments); }
        SmoothCamDebugLayer.prototype = Object.create(PIXI.Container.prototype);
        SmoothCamDebugLayer.prototype.constructor = SmoothCamDebugLayer;
        SmoothCamDebugLayer.prototype.initialize = function() {
            PIXI.Container.call(this);
            this.z = 999999; 
            
            this._g = new PIXI.Graphics();
            this.addChild(this._g);
            
            this._text = new PIXI.Text('', { 
                fontFamily: 'monospace', fontSize: 16, fill: 0xffffff, align: 'left',
                dropShadow: true, dropShadowColor: '#000000', dropShadowBlur: 3
            });
            this._text.x = 10;
            this._text.y = 10;
            this.addChild(this._text);

            this._prevPxX = undefined;
            this._prevPxY = undefined;
            this._currSpeed = 0;
        };

        SmoothCamDebugLayer.prototype.redraw = function() {
            this._g.clear();
            if (!$gameMap || !$gameScreen) return;

            var zoom = $gameScreen.zoomScale() || 1.0;
            var zx = $gameScreen.zoomX() || 0;
            var zy = $gameScreen.zoomY() || 0;
            var shake = $gameScreen.shake() || 0;

            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            var camPxX = $gameMap.displayX() * tw;
            var camPxY = $gameMap.displayY() * th;

            if (this._prevPxX !== undefined) {
                var vx = camPxX - this._prevPxX;
                var vy = camPxY - this._prevPxY;
                this._currSpeed = Math.sqrt(vx*vx + vy*vy);
            }
            this._prevPxX = camPxX;
            this._prevPxY = camPxY;

            if ((!DEBUG_VISIBLE && !SC.showHud) || $gameScreen.focusEvent !== 0 || !SC) {
                this._text.text = '';
                return;
            }

            if (SC.showHud) {
                var offX = ($gameTemp && $gameTemp._rmsCameraOffsetX) ? $gameTemp._rmsCameraOffsetX.toFixed(2) : '0.00';
                var offY = ($gameTemp && $gameTemp._rmsCameraOffsetY) ? $gameTemp._rmsCameraOffsetY.toFixed(2) : '0.00';
                var isAiming = ($gameSwitches && $gameSwitches.value(Number(Params['Свитч прицеливания'] || 1)));
                
                var txt = `SC Engine: ${SC._isInitialized ? "HERO ANCHORED" : "STANDBY"}\n`;
                txt += `Speed: ${this._currSpeed.toFixed(2)} px/f\n`;
                txt += `Aiming: ${isAiming}\n`;
                txt += `Scope Offset: ${offX}, ${offY}`;
                
                this._text.text = txt;
                this._text.style.fill = 0xFFFFFF;
            } else {
                this._text.text = '';
            }

            if (DEBUG_VISIBLE) {
                var screenW = Graphics.boxWidth || Graphics.width;
                var screenH = Graphics.boxHeight || Graphics.height;
                var visW = screenW / zoom;
                var visH = screenH / zoom;

                var cx = screenW / 2;
                var cy = screenH / 2;

                if (SC.boundsEnabled) {
                    var scanPad = 2;
                    var hX = SC.camPxX / tw;
                    var hY = SC.camPxY / th;
                    
                    var startX = Math.floor(Math.min($gameMap.displayX(), hX)) - scanPad;
                    var startY = Math.floor(Math.min($gameMap.displayY(), hY)) - scanPad;
                    var endX = Math.ceil(Math.max($gameMap.displayX() + visW / tw, hX)) + scanPad;
                    var endY = Math.ceil(Math.max($gameMap.displayY() + visH / th, hY)) + scanPad;

                    for (var y = startY; y < endY; y++) {
                        for (var x = startX; x < endX; x++) {
                            var mapX = $gameMap.roundX(x);
                            var mapY = $gameMap.roundY(y);
                            
                            if ($gameMap.isValid(mapX, mapY)) {
                                var reg = $gameMap.regionId(mapX, mapY);
                                var color = null;
                                if (ACTIVE_SET.has(reg)) color = 0xFF0000;
                                else if (LEFT_SET.has(reg)) color = 0x0000FF;
                                else if (RIGHT_SET.has(reg)) color = 0x00FF00;
                                else if (TOP_SET.has(reg)) color = 0xFFFF00;
                                else if (BOTTOM_SET.has(reg)) color = 0x00FFFF;

                                if (color !== null) {
                                    var screenPxX = ($gameMap.adjustX(mapX) * tw - zx) * zoom + zx + shake;
                                    var screenPxY = ($gameMap.adjustY(mapY) * th - zy) * zoom + zy;
                                    this._g.beginFill(color, 0.4);
                                    this._g.drawRect(screenPxX, screenPxY, tw * zoom, th * zoom);
                                    this._g.endFill();
                                }
                            }
                        }
                    }

                    // Hard midpoint points (white circles) on frame sides
                    var frameScreenX = cx - FRAME_WIDTH() / 2;
                    var frameScreenY = cy - FRAME_HEIGHT() / 2;
                    var frameScreenW = FRAME_WIDTH();
                    var frameScreenH = FRAME_HEIGHT();
                    if (HARD_MIDPOINTS && SC.boundsEnabled) {
                        this._g.lineStyle(0);
                        this._g.beginFill(0xFFFFFF, 1);
                        this._g.drawCircle(cx, frameScreenY, 5);               // top
                        this._g.drawCircle(cx, frameScreenY + frameScreenH, 5); // bottom
                        this._g.drawCircle(frameScreenX, cy, 5);               // left
                        this._g.drawCircle(frameScreenX + frameScreenW, cy, 5); // right
                        this._g.endFill();
                    }
                    
                    // Hero crosshair (white)
                    var heroSx = $gamePlayer ? $gamePlayer.screenX() : 0;
                    var heroSy = $gamePlayer ? $gamePlayer.screenY() : 0;
                    var ancX = (heroSx - zx) * zoom + zx + shake;
                    var ancY = (heroSy - zy) * zoom + zy;
                    
                    this._g.lineStyle(2, 0xFFFFFF, 0.8);
                    this._g.moveTo(ancX - 10, ancY); this._g.lineTo(ancX + 10, ancY);
                    this._g.moveTo(ancX, ancY - 10); this._g.lineTo(ancX, ancY + 10);


                }

                // Tracking zones (dead = red, soft = green) — centered on screen
                var dead = SC.currentDead(), soft = SC.currentSoft();
                
                if (dead && dead.w > 0 && dead.h > 0) {
                    var deadW = dead.w * zoom;
                    var deadH = dead.h * zoom;
                    var dX = cx - deadW / 2 + (dead.x * zoom);
                    var dY = cy - deadH / 2 + (dead.y * zoom);
                    this._g.lineStyle(2, 0xFF0000, 0.8);
                    this._g.drawRect(Math.floor(dX), Math.floor(dY), Math.floor(deadW), Math.floor(deadH));
                }
                if (soft && soft.w > 0 && soft.h > 0) {
                    var softW = soft.w * zoom;
                    var softH = soft.h * zoom;
                    var sX = cx - softW / 2 + (soft.x * zoom);
                    var sY = cy - softH / 2 + (soft.y * zoom);
                    this._g.lineStyle(2, 0x00FF00, 0.8);
                    this._g.drawRect(Math.floor(sX), Math.floor(sY), Math.floor(softW), Math.floor(softH));
                }
            }
        };

        var _Scene_Map_update = Scene_Map.prototype.update;
        Scene_Map.prototype.update = function() {
            _Scene_Map_update.call(this);
            
            if (!this._smoothCamDebug) {
                this._smoothCamDebug = new SmoothCamDebugLayer();
                this.addChild(this._smoothCamDebug);
            } else {
                this._smoothCamDebug.redraw();
                if (this.children[this.children.length - 1] !== this._smoothCamDebug) {
                    this.addChild(this._smoothCamDebug);
                }
            }
        };
    })();

    //=============================================================================
    // 3. CAMERA SCOPE (AIMING) LOGIC (Restored from v3.1.8)
    //=============================================================================
    (function() {
        const P = PluginManager.parameters(THIS_PLUGIN_NAME);

        const switchId = Number(P['Свитч прицеливания'] || 1);
        const enableRotation = String(P['Поворот за курсором'] || 'true').toLowerCase() === 'true';
        const aimingSpeed = Number(P['Скорость прицеливания'] || 3);
        const normalCursor = String(P['Обычный курсор'] || '').trim();
        const pressedCursor = String(P['Курсор прицела'] || '').trim();
        const commonEventId = Number(P['Общее событие'] || 1);
        const cameraOffsetMax = Number(P['Макс. сдвиг камеры'] || 60);
        const cameraSmoothing = Math.min(Math.max(Number(P['Плавность прицела'] || 0.05), 0.01), 0.2);
        const returnDuration = Number(P['Возврат в центр'] || 45);
        const disableSmoothSwitchId = Number(P['Свитч откл. сглаживания'] || 0);

        let rightMouseDown = false;
        let originalMoveSpeed = 4;
        let mouseX = 0, mouseY = 0;
        let lastDirection = 2;
        let camOffX = 0, camOffY = 0;
        let camTargetX = 0, camTargetY = 0;
        let appliedTileOX = 0, appliedTileOY = 0;
        let isReturning = false;
        let returnProgress = 0;
        let returnStartX = 0, returnStartY = 0;

        if (!$gameTemp) window.$gameTemp = {};
        $gameTemp._rmsCameraOffsetX = 0;
        $gameTemp._rmsCameraOffsetY = 0;

        function setCursor(image) {
            if (!image) return;
            document.body.style.cursor = `url('img/system/${image}.png'), auto`;
            if (typeof TouchInput.setCursorImage === 'function') {
                try { TouchInput.setCursorImage(image); } catch (e) {}
            }
        }

        function resetCursor() {
            if (normalCursor) document.body.style.cursor = `url('img/system/${normalCursor}.png'), auto`;
            else document.body.style.cursor = 'auto';
            if (typeof TouchInput.resetCursorImage === 'function') {
                try { TouchInput.resetCursorImage(); } catch (e) {}
            }
        }
        window.addEventListener('load', () => resetCursor());

        function inSceneMap() { return SceneManager._scene instanceof Scene_Map; }

        function canControlPlayer() {
            if (!inSceneMap() || !$gamePlayer) return false;
            return $gamePlayer.canMove() || $gamePlayer._amsDashActive === true;
        }

        function getGameMousePosition(clientX, clientY) {
            const canvas = document.querySelector('canvas');
            if (!canvas) return { x: clientX, y: clientY };
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
        }

        function calculateDirection() {
            if (!$gamePlayer) return lastDirection;
            const dx = mouseX - $gamePlayer.screenX();
            const dy = mouseY - $gamePlayer.screenY();
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 30) return lastDirection;
            const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            if (angle >= 315 || angle < 45) return 6;
            if (angle >= 135 && angle < 225) return 4;
            if (angle >= 45 && angle < 135) return 2;
            return 8;
        }

        function updatePlayerDirection() {
            if (!enableRotation || !rightMouseDown || !canControlPlayer()) return;
            lastDirection = calculateDirection();
            $gamePlayer.setDirection(lastDirection);
        }

        function triggerCommonEvent() {
            if (commonEventId > 0) $gameTemp.reserveCommonEvent(commonEventId);
        }

        function calculateCameraTarget() {
            if (!rightMouseDown) {
                camTargetX = 0; camTargetY = 0;
                return;
            }
            const cx = Graphics.width / 2, cy = Graphics.height / 2;
            const dx = mouseX - cx, dy = mouseY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist, ny = dy / dist;
            let strength = Math.min(dist / cx, 1.0);
            strength = Math.pow(strength, 0.5);
            const zoom = $gameScreen ? ($gameScreen._zoomScale || 1.0) : 1.0;
            camTargetX = (nx * strength * cameraOffsetMax) / zoom;
            camTargetY = (ny * strength * cameraOffsetMax) / zoom;
        }

        function smoothReturnToZero() {
            if (!isReturning) return;
            returnProgress++;
            const progress = Math.min(returnProgress / returnDuration, 1);
            
            const easeT = 1 - Math.pow(1 - progress, 2);
            
            camOffX = returnStartX * (1 - easeT);
            camOffY = returnStartY * (1 - easeT);
            camTargetX = camOffX;
            camTargetY = camOffY;

            if (returnProgress >= returnDuration) {
                isReturning = false;
                camOffX = 0; camOffY = 0;
                camTargetX = 0; camTargetY = 0;
                if (disableSmoothSwitchId > 0) $gameSwitches.setValue(disableSmoothSwitchId, false);
            }
        }

        function updateCameraOffsetLerp() {
            if (isReturning) {
                smoothReturnToZero();
            } else if (rightMouseDown) {
                camOffX += (camTargetX - camOffX) * cameraSmoothing;
                camOffY += (camTargetY - camOffY) * cameraSmoothing;
            } else {
                camOffX += (0 - camOffX) * cameraSmoothing * 0.5;
                camOffY += (0 - camOffY) * cameraSmoothing * 0.5;
                camTargetX = camOffX;
                camTargetY = camOffY;
            }
            
            if (Math.abs(camOffX) < 0.01) camOffX = 0;
            if (Math.abs(camOffY) < 0.01) camOffY = 0;

            if ($gameMap) {
                $gameTemp._rmsCameraOffsetX = camOffX / $gameMap.tileWidth();
                $gameTemp._rmsCameraOffsetY = camOffY / $gameMap.tileHeight();
            }
        }

        const _Scene_Map_start_Scope = Scene_Map.prototype.start;
        Scene_Map.prototype.start = function() {
            _Scene_Map_start_Scope.apply(this, arguments);
            appliedTileOX = 0; appliedTileOY = 0;
            isReturning = false;
            returnProgress = 0;
            camOffX = 0; camOffY = 0;
            camTargetX = 0; camTargetY = 0;
            rightMouseDown = false;
        };

        // Scope fallback when smooth camera is disabled
        Scene_Map.prototype.applyCameraScopeFallback = function() {
            if (!$gameTemp || !$gameMap) return;
            const wantOX = $gameTemp._rmsCameraOffsetX || 0;
            const wantOY = $gameTemp._rmsCameraOffsetY || 0;

            const dX = wantOX - appliedTileOX;
            const dY = wantOY - appliedTileOY;
            let targetX = $gameMap._displayX + dX;
            let targetY = $gameMap._displayY + dY;
            appliedTileOX = wantOX;
            appliedTileOY = wantOY;

            if (window.SC && window.SC.boundsEnabled && typeof $gameMap.resolveCameraBounds === 'function') {
                var resolved = $gameMap.resolveCameraBounds(targetX, targetY);
                targetX = resolved.x;
                targetY = resolved.y;
            } else {
                var zoom = $gameScreen ? ($gameScreen._zoomScale || 1.0) : 1.0;
                var maxX = $gameMap.width() - (Graphics.boxWidth / $gameMap.tileWidth() / zoom);
                var maxY = $gameMap.height() - (Graphics.boxHeight / $gameMap.tileHeight() / zoom);
                targetX = Math.max(0, Math.min(Math.max(0, maxX), targetX));
                targetY = Math.max(0, Math.min(Math.max(0, maxY), targetY));
            }

            if (Math.abs($gameMap._displayX - targetX) > 1e-6 || Math.abs($gameMap._displayY - targetY) > 1e-6) {
                $gameMap.setDisplayPos(targetX, targetY);
            }
        };

        const _Scene_Map_updateMain_Scope = Scene_Map.prototype.updateMain;
        Scene_Map.prototype.updateMain = function() {
            _Scene_Map_updateMain_Scope.call(this);
            
            var scActive = (window.SC && window.SC._isInitialized && !window.SC.isSwitchOn());
            if (scActive) {
                // Keep fallback coordinates synced in case SC disables
                if ($gameTemp) {
                    appliedTileOX = $gameTemp._rmsCameraOffsetX || 0;
                    appliedTileOY = $gameTemp._rmsCameraOffsetY || 0;
                }
            } else {
                this.applyCameraScopeFallback();
            }
        };

        const _Game_Player_update = Game_Player.prototype.update;
        Game_Player.prototype.update = function(sceneActive) {
            _Game_Player_update.call(this, sceneActive);
            if (rightMouseDown && canControlPlayer()) this.setMoveSpeed(aimingSpeed);
        };

        const _Game_Player_setDirection = Game_Player.prototype.setDirection;
        Game_Player.prototype.setDirection = function(dir) {
            if (rightMouseDown && enableRotation && canControlPlayer()) {
                _Game_Player_setDirection.call(this, lastDirection);
            } else {
                _Game_Player_setDirection.call(this, dir);
                lastDirection = dir;
            }
        };

        const _Scene_Map_update_Scope = Scene_Map.prototype.update;
        Scene_Map.prototype.update = function() {
            _Scene_Map_update_Scope.call(this);
            if (rightMouseDown && enableRotation && canControlPlayer()) updatePlayerDirection();
            calculateCameraTarget();
            updateCameraOffsetLerp();
        };

        document.addEventListener('mousedown', e => {
            if (!inSceneMap()) return;
            if (e.button === 2 && canControlPlayer()) {
                e.preventDefault();
                if (isReturning) {
                    isReturning = false;
                    if (disableSmoothSwitchId > 0) $gameSwitches.setValue(disableSmoothSwitchId, false);
                }

                rightMouseDown = true;
                $gameSwitches.setValue(switchId, true);
                originalMoveSpeed = $gamePlayer.moveSpeed();
                $gamePlayer.setMoveSpeed(aimingSpeed);
                if (pressedCursor) setCursor(pressedCursor);

                const pos = getGameMousePosition(e.clientX, e.clientY);
                mouseX = pos.x; mouseY = pos.y;
                updatePlayerDirection();
                calculateCameraTarget();
            }
            if (e.button === 0 && rightMouseDown && canControlPlayer()) {
                e.preventDefault();
                triggerCommonEvent();
            }
        });

        document.addEventListener('mouseup', e => {
            if (!inSceneMap()) return;
            if (e.button === 2) {
                rightMouseDown = false;
                $gameSwitches.setValue(switchId, false);
                if ($gamePlayer) $gamePlayer.setMoveSpeed(originalMoveSpeed);
                resetCursor();

                if ((camOffX !== 0 || camOffY !== 0) && !isReturning) {
                    isReturning = true;
                    returnProgress = 0;
                    returnStartX = camOffX;
                    returnStartY = camOffY;
                    if (disableSmoothSwitchId > 0) $gameSwitches.setValue(disableSmoothSwitchId, true);
                } else {
                    camTargetX = 0; camTargetY = 0;
                }
            }
        });

        document.addEventListener('mousemove', e => {
            if (!inSceneMap()) return;
            const pos = getGameMousePosition(e.clientX, e.clientY);
            mouseX = pos.x; mouseY = pos.y;
            if (rightMouseDown && enableRotation && canControlPlayer()) updatePlayerDirection();
            calculateCameraTarget();
        });

        document.addEventListener('contextmenu', e => {
            if (!inSceneMap()) return;
            if (e.button === 2) { e.preventDefault(); return false; }
        });
    })();

    //=============================================================================
    // 4. GLOBAL OVERRIDES (THE "NUCLEAR" OPTION)
    //=============================================================================
    var _Game_Player_updateScroll_Final = Game_Player.prototype.updateScroll;
    
    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        if ($gameScreen.focusEvent !== 0) return;
        
        var sc = window.SC;
        var smoothActive = false;
        
        if (sc) {
            if (typeof sc.isSwitchOn === 'function' && sc.isSwitchOn()) smoothActive = false;
            else smoothActive = true;
        }

        if (smoothActive) return; 

        Game_Character.prototype.updateScroll.apply(this, arguments);
    };

    //=============================================================================
    // 5. THE ULTIMATE MATH FIX (ZERO JITTER, ZERO SEAMS, PERFECT LIGHT SYNC)
    //=============================================================================
    Game_CharacterBase.prototype.screenX = function() {
        var tw = $gameMap.tileWidth();
        var realWorldX = (this.scrolledX() + $gameMap.displayX()) * tw + tw / 2;
        var cameraWorldX = $gameMap.displayX() * tw;
        return Math.round(realWorldX) - Math.round(cameraWorldX);
    };

    Game_CharacterBase.prototype.screenY = function() {
        var th = $gameMap.tileHeight();
        var realWorldY = (this.scrolledY() + $gameMap.displayY()) * th + th - this.shiftY() - this.jumpHeight();
        var cameraWorldY = $gameMap.displayY() * th;
        return Math.round(realWorldY) - Math.round(cameraWorldY);
    };

    var _Spriteset_Map_updateTilemap = Spriteset_Map.prototype.updateTilemap;
    Spriteset_Map.prototype.updateTilemap = function() {
        _Spriteset_Map_updateTilemap.call(this);
        this._tilemap.origin.x = Math.round($gameMap.displayX() * $gameMap.tileWidth());
        this._tilemap.origin.y = Math.round($gameMap.displayY() * $gameMap.tileHeight());
        this._tilemap.x = 0;
        this._tilemap.y = 0;
    };

    var _Spriteset_Map_updateParallax = Spriteset_Map.prototype.updateParallax;
    Spriteset_Map.prototype.updateParallax = function() {
        _Spriteset_Map_updateParallax.call(this);
        if (this._parallax.bitmap) {
            this._parallax.origin.x = Math.round($gameMap.parallaxOx());
            this._parallax.origin.y = Math.round($gameMap.parallaxOy());
            this._parallax.x = 0;
            this._parallax.y = 0;
        }
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        
        if (this._lightmask) {
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            
            var realCamX = $gameMap.displayX() * tw;
            var realCamY = $gameMap.displayY() * th;
            
            this._lightmask.x = realCamX - Math.round(realCamX);
            this._lightmask.y = realCamY - Math.round(realCamY);
        }
    };

})();