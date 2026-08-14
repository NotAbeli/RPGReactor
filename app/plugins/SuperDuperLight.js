//=============================================================================
// Super Duper Light - Ultimate Lighting System
// TerraxLighting.js
// Version: 5.9.46 (Feature: True Canvas Seam Fix, Subpixel Fix, Light Sensor & 3-Tier Hitboxes)
//=============================================================================
/*:
 * @plugindesc v5.9.46 Super Duper Light. Идеальный фикс швов, 3 уровня хитбоксов света и Отладка.
 * @author Super Duper Team (Refactored) + Korolev
 *
 * @param Master Opacity Variable
 * @text Переменная Яркости (Master)
 * @desc ID переменной (0-100), управляющей прозрачностью слоя.
 * 0 = Норма (Тьма). 100 = Светло (Слой скрыт).
 * @type variable
 * @default 0
 *
 * @param Vignette Disable Switch
 * @text ID переключателя выкл. виньетки
 * @desc Если этот переключатель ВКЛ (ON), виньетка по краям исчезает (остается только Тинт/Туман).
 * @type switch
 * @default 0
 *
 * @param Sensor Debug Switch
 * @text ID переключателя отладки
 * @desc ID переключателя. При ВКЛ отрисовывает цветные хитбоксы света (Фактический/Касательный/Яркий) на экране.
 * @type switch
 * @default 0
 *
 * @param --- Sensor Zones ---
 * @default
 *
 * @param Bright Zone Percent
 * @text Зона: Яркий (%)
 * @parent --- Sensor Zones ---
 * @desc Процент от радиуса источника света для хитбокса "Яркий" (самый центр).
 * @type number
 * @min 1
 * @max 100
 * @default 30
 *
 * @param Tangent Zone Percent
 * @text Зона: Касательный (%)
 * @parent --- Sensor Zones ---
 * @desc Процент от радиуса источника света для хитбокса "Касательный" (середина).
 * @type number
 * @min 1
 * @max 100
 * @default 60
 *
 * @param Falloff Presets
 * @text Пресеты затухания (Именованные)
 * @desc База данных пресетов (используется для Света и Стен).
 * @type struct<FalloffPreset>[]
 * @default []
 *
 * @param Default Falloff Config
 * @text Настройка затухания (Default)
 * @desc Градиент для света БЕЗ пресета. Если пусто: Линейный (0%->100% оп., 100%->0% оп.).
 * @type struct<FalloffStep>[]
 * @default []
 *
 * @param Player radius
 * @text Радиус света игрока
 * @desc Радиус зоны чистой видимости вокруг игрока.
 * @default 300
 *
 * @param Default Tint
 * @text Цвет Тумана (Тинт)
 * @desc Базовый цвет атмосферы рядом с игроком. 
 * @default #333333
 *
 * @param Vignette Color
 * @text Цвет Виньетки
 * @desc Цвет, в который уходит экран по краям (Глубина).
 * @default #000000
 *
 * @param Vignette Scale
 * @text Размер Виньетки (База)
 * @desc Множитель размера "пузыря" атмосферы. 
 * @default 0.7
 *
 * @param Vignette Sharpness
 * @text Резкость Виньетки
 * @desc Где начинается затемнение (от 0.0 до 1.0).
 * @default 0.2
 *
 * @param Player Light Influence
 * @text Влияние Света Игрока
 * @desc Коэффициент. Насколько свет игрока отодвигает виньетку.
 * @default 0.0
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
 * @default false
 *
 * @param Vignette Clear Multiplier
 * @text Множитель очистки (Global)
 * @desc Значение по умолчанию, если событие разгоняет тьму.
 * @default 1.1
 *
 * @param Region Settings
 * @text Настройки регионов (Стены)
 * @desc Список регионов, блокирующих свет. Формат: ID #Color, ID #Color
 * @default 
 *
 * @param Flashlight offset
 * @text Смещение фонарика
 * @desc Сдвиг луча фонарика по вертикали (Y).
 * @default 0
 *
 * @param Screensize X
 * @text Разрешение экрана X
 * @default 866
 *
 * @param Screensize Y
 * @text Разрешение экрана Y
 * @default 630
 *
 * @param Debug Mode
 * @text Режим отладки
 * @type boolean
 * @default true
 * * @param --- Wall Settings ---
 * @default
 * * @param Wall Softness
 * @text Мягкость края (px)
 * @parent --- Wall Settings ---
 * @desc Сколько пикселей от края тайла занимает градиент (макс 24).
 * @type number
 * @min 1
 * @max 24
 * @default 16
 *
 * @param Iso Bottom Offset
 * @text Отступ снизу (Iso)
 * @parent --- Wall Settings ---
 * @desc Поднять градиент от нижнего края тайла на X пикселей (для изометрии). Работает, если снизу пусто.
 * @type number
 * @default 0
 *
 * @param Wall Preset ID
 * @text ID Пресета Стен
 * @parent --- Wall Settings ---
 * @desc ID пресета из "Falloff Presets" для настройки кривой градиента стен. Оставьте пустым для линейного.
 * @type string
 *
 * @param Wall Tint Opacity
 * @text Прозрачность Тинта Стен
 * @parent --- Wall Settings ---
 * @desc Доп. слой цвета поверх стены (0.0 - 1.0). Ограничен границами тайла и отступом (Iso).
 * @type number
 * @decimals 2
 * @min 0.0
 * @max 1.0
 * @default 0.0
 *
 * @help
 * --------------------------------------------------------------------------
 * SUPER DUPER LIGHT v5.9.46
 * --------------------------------------------------------------------------
 * ОБНОВЛЕНИЕ: СИСТЕМА 3-Х ХИТБОКСОВ СВЕТА
 * Добавлена новая функция для проверки нахождения в конкретной зоне света.
 * В ветвлении условий: this.getLightZone()
 * * Возвращает одно из значений (целое число):
 * 3 - "Яркий" (центр источника)
 * 2 - "Касательный" (средняя дистанция)
 * 1 - "Фактический" (на самом краю источника света)
 * 0 - Тьма
 * * Пример: this.getLightZone() >= 2
 * (Сработает, если событие находится в Касательной или Яркой зоне)
 * * Процентное соотношение зон настраивается в параметрах плагина.
 * При включении переключателя отладки (Sensor Debug Switch) на экране
 * рисуются все 3 хитбокса (Красный = Фактический, Оранжевый = Касательный, 
 * Зеленый = Яркий).
 * * Старая функция this.getLightIntensity() сохранена для совместимости.
 * --------------------------------------------------------------------------
 */
/*~struct~FalloffPreset:
 * @param ID
 * @text ID Пресета
 * @type string
 * @default global
 *
 * @param Steps
 * @text Шаги затухания
 * @type struct<FalloffStep>[]
 */
/*~struct~FalloffStep:
 * @param Percent
 * @text Процент расстояния
 * @type number
 * @decimals 2
 * @min 0.0
 * @max 1.0
 * @default 0.2
 *
 * @param Opacity
 * @text Непрозрачность
 * @type number
 * @decimals 2
 * @min 0.0
 * @max 1.0
 * @default 0.8
 */

var Imported = Imported || {};
Imported.SuperDuperLight = true;
Imported.TerraxLighting = true; 

(function() {

    var parameters = PluginManager.parameters('SuperDuperLight');
    if (Object.keys(parameters).length === 0) {
        parameters = PluginManager.parameters('TerraxLighting');
    }

    // --- PARAMS ---
    var master_opacity_var = Number(parameters['Master Opacity Variable'] || 0);
    var vignette_disable_switch = Number(parameters['Vignette Disable Switch'] || 0); 
    var sensor_debug_switch = Number(parameters['Sensor Debug Switch'] || 0); 
    var player_radius_default = Number(parameters['Player radius']);
    var default_tint = parameters['Default Tint'] || '#333333';
    var default_vignette = parameters['Vignette Color'] || '#000000';
    var vignette_scale_param = Number(parameters['Vignette Scale'] || 0.7);
    var vignette_sharpness_param = Number(parameters['Vignette Sharpness'] || 0.2);
    var player_influence_param = Number(parameters['Player Light Influence'] || 0.0);
    var breathing_speed_param = Number(parameters['Breathing Speed'] || 0.05);
    var events_clear_vignette_global = (parameters['Events Clear Vignette'] === 'true');
    var vignette_clear_mult_default = Number(parameters['Vignette Clear Multiplier'] || 1.1);
    var region_settings_param = parameters['Region Settings'] || '';
    var flashlightoffset = Number(parameters['Flashlight offset'] || 0);
    var debug_mode = (parameters['Debug Mode'] === 'true');
    
    // --- SENSOR ZONES ---
    var zone_bright_pct = Number(parameters['Bright Zone Percent'] || 30) / 100.0;
    var zone_tangent_pct = Number(parameters['Tangent Zone Percent'] || 60) / 100.0;

    // --- WALL PARAMS ---
    var wall_softness = Number(parameters['Wall Softness'] || 16);
    if (wall_softness > 24) wall_softness = 24; 
    var wall_preset_id = parameters['Wall Preset ID'] || '';
    var wall_iso_offset = Number(parameters['Iso Bottom Offset'] || 0);
    var wall_tint_opacity = Number(parameters['Wall Tint Opacity'] || 0.0);

    // --- PRESETS PARSING ---
    var _falloffPresets = {};
    var _defaultFalloff = []; 

    function parseSteps(stepsRawJson) {
        var steps = [];
        try {
            var raw = JSON.parse(stepsRawJson || '[]');
            for (var j = 0; j < raw.length; j++) {
                var sData = JSON.parse(raw[j]);
                steps.push({ pos: Number(sData.Percent), alpha: Number(sData.Opacity) });
            }
            steps.sort(function(a, b) { return a.pos - b.pos; });
        } catch(e) {}
        return steps;
    }

    try {
        var rawPresets = parameters['Falloff Presets'];
        if (rawPresets) {
            var parsedList = JSON.parse(rawPresets);
            for (var i = 0; i < parsedList.length; i++) {
                try {
                    var pData = JSON.parse(parsedList[i]);
                    var pId = String(pData.ID || "").trim(); 
                    if (!pId) continue;
                    _falloffPresets[pId] = parseSteps(pData.Steps);
                } catch (e) {}
            }
        }
        // Parse Default Falloff
        if (parameters['Default Falloff Config']) {
             _defaultFalloff = parseSteps(parameters['Default Falloff Config']);
        }
    } catch (e) {}

    // --- STATE ---
    var _allLightEvents = [];
    var _oldMapId = 0;
    var _flashlightOn = false;
    var _playerFire = false;
    var _firstRun = true;
    var _debugRenderLog = {}; 
    
    var _currentTint = default_tint;
    var _targetTint = default_tint;
    var _currentVignette = default_vignette; 
    var _tintSpeed = 0;
    var _tintTimer = 0;
    var _blockedRegions = {}; 
    
    var _playerFlickerOffset = 0;
    var _cachedVignetteRadius = 0;

    // --- INIT BLOCKED REGIONS ---
    if (region_settings_param) {
        var groups = region_settings_param.split(',');
        for (var i = 0; i < groups.length; i++) {
            var pair = groups[i].trim().split(' ');
            if (pair.length >= 2) {
                var id = Number(pair[0]);
                var col = pair[1];
                if (!isNaN(id)) {
                    if (col && !col.startsWith('#')) col = '#' + col;
                    _blockedRegions[id] = col;
                }
            }
        }
    }

    // --- PLUGIN COMMANDS ---
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (!command) return;
        command = command.toLowerCase();

        if (command === 'tint') {
            if (args[0] === 'set') {
                _currentTint = args[1];
                _targetTint = args[1];
                $gameVariables.SetSavedTint(_currentTint);
            }
            if (args[0] === 'fade') {
                _targetTint = args[1];
                _tintSpeed = Number(args[2]) || 60;
                _tintTimer = 0;
                $gameVariables.SetSavedTint(_targetTint);
            }
        }
        if (command === 'vignette' && args[0] === 'color') {
            _currentVignette = args[1];
            $gameVariables.SetSavedVignette(_currentVignette);
        }
        if (command === 'regionblock') {
            var id = Number(args[0]);
            var col = args[1];
            if (col && col.toUpperCase() === 'OFF') delete _blockedRegions[id];
            else {
                if (col && !col.startsWith('#')) col = '#' + col;
                _blockedRegions[id] = col;
            }
            $gameVariables.SetBlockedRegions(_blockedRegions);
        }
        if (command === 'light') {
            var subCommand = (args[0] || '').toLowerCase();
            if (subCommand === 'radius' || subCommand === 'radiusgrow') {
                var newRad = Number(args[1]);
                if (!isNaN(newRad)) {
                    $gameVariables.SetRadiusTarget(newRad);
                    
                    var duration = 0;
                    for (var i = 2; i < args.length; i++) {
                        if (args[i] && args[i].match(/^t(\d+)$/i)) {
                            duration = Number(RegExp.$1);
                            args.splice(i, 1); 
                            i--;
                        }
                    }

                    if (subCommand === 'radius' && duration === 0) {
                        $gameVariables.SetRadiusSpeed(0); 
                        $gameVariables.SetRadius(newRad);
                    } else {
                        var ticks = (duration > 0) ? duration : 60;
                        var speed = Math.abs(newRad - $gameVariables.GetRadius()) / ticks;
                        $gameVariables.SetRadiusSpeed(speed < 0.1 ? 0.1 : speed);
                    }
                    if (args[2]) $gameVariables.SetPlayerColor(args[2]);
                    
                    var pMult = undefined;
                    var pBright = 1.0; 
                    var pSmooth = 1.0;
                    var pPreset = null; 

                    var startIdx = 3;
                    if (args[startIdx] && _falloffPresets[args[startIdx]]) {
                        pPreset = args[startIdx];
                        startIdx++;
                    }
                    
                    if (args[startIdx]) {
                        if (isNumber(args[startIdx]) && !isTag(args[startIdx])) {
                             pMult = Number(args[startIdx]);
                             startIdx++;
                        }
                    }
                    
                    if (args[startIdx]) {
                        if (isTag(args[startIdx])) {
                             pBright = parseTag(args[startIdx]);
                             startIdx++;
                        } else if (isNumber(args[startIdx])) {
                             pBright = Number(args[startIdx]);
                             startIdx++;
                        }
                    }
                    
                    if (args[startIdx]) {
                        if (_falloffPresets[args[startIdx]]) pPreset = args[startIdx];
                        else if (isNumber(args[startIdx])) pSmooth = Number(args[startIdx]);
                    }
                    
                    $gameVariables.SetPlayerVignetteMult(pMult);
                    $gameVariables.SetPlayerBrightness(pBright);
                    $gameVariables.SetPlayerSmoothness(pSmooth);
                    $gameVariables.SetPlayerPreset(pPreset);
                }
            } else if (subCommand === 'on' || subCommand === 'off' || subCommand === 'color') {
                var id = Number(args[1]);
                var light = _allLightEvents.find(l => l.customId === id);
                if (light) {
                    if (subCommand === 'on') light.active = true;
                    if (subCommand === 'off') light.active = false;
                    if (subCommand === 'color') light.color = args[2];
                }
            }
        }
        if (command === 'flashlight') {
            if (args[0] === 'on') {
                $gameVariables.SetFlashlight(true);
                $gameVariables.SetFlashlightLength(Number(args[1]) || 8);
                $gameVariables.SetFlashlightWidth(Number(args[2]) || 12);
                $gameVariables.SetPlayerColor(args[3] || '#FFFFFF');
                $gameVariables.SetFlashlightDensity(Number(args[4]) || 3);
            }
            if (args[0] === 'off') $gameVariables.SetFlashlight(false);
        }
        if (command === 'fire') {
            if (args.length > 0) {
                 var subCommand = args[0].toLowerCase();
                 if (subCommand === 'radius' || subCommand === 'radiusgrow') {
                    var newRad = Number(args[1]);
                    if (!isNaN(newRad)) {
                        $gameVariables.SetRadiusTarget(newRad);
                        
                        var duration = 0;
                        for (var i = 2; i < args.length; i++) {
                            if (args[i] && args[i].match(/^t(\d+)$/i)) {
                                duration = Number(RegExp.$1);
                                args.splice(i, 1);
                                i--;
                            }
                        }

                        if (subCommand === 'radius' && duration === 0) {
                             $gameVariables.SetRadiusSpeed(0); 
                             $gameVariables.SetRadius(newRad);
                        } else {
                             var ticks = (duration > 0) ? duration : 60;
                             var speed = Math.abs(newRad - $gameVariables.GetRadius()) / ticks;
                             $gameVariables.SetRadiusSpeed(speed < 0.1 ? 0.1 : speed);
                        }
                        if (args[2]) $gameVariables.SetPlayerColor(args[2]);
                        
                        var pMult = undefined;
                        var pBright = 1.0;
                        var pSmooth = 1.0;
                        var pPreset = null;
                        
                        var startIdx = 3;
                        if (args[startIdx] && _falloffPresets[args[startIdx]]) { pPreset = args[startIdx]; startIdx++; }
                        if (args[startIdx] && isNumber(args[startIdx]) && !isTag(args[startIdx])) { pMult = Number(args[startIdx]); startIdx++; }
                        if (args[startIdx]) {
                            if (isTag(args[startIdx])) { pBright = parseTag(args[startIdx]); startIdx++; }
                            else if (isNumber(args[startIdx])) { pBright = Number(args[startIdx]); startIdx++; }
                        }
                        if (args[startIdx]) {
                            if (_falloffPresets[args[startIdx]]) pPreset = args[startIdx];
                            else if (isNumber(args[startIdx])) pSmooth = Number(args[startIdx]);
                        }

                        $gameVariables.SetPlayerVignetteMult(pMult);
                        $gameVariables.SetPlayerBrightness(pBright);
                        $gameVariables.SetPlayerSmoothness(pSmooth);
                        $gameVariables.SetPlayerPreset(pPreset);
                        _playerFire = true;
                        $gameVariables.SetFire(true);
                    }
                 }
            } else {
                _playerFire = !_playerFire;
                $gameVariables.SetFire(_playerFire);
            }
        }
        if (command === 'reload' && args[0] === 'events') ReloadMapEvents();
    };

    function isNumber(n) { return !isNaN(n); }
    function isTag(s) { return s && (s.toString().toLowerCase().startsWith('b') || s.toString().toLowerCase().startsWith('d')); }
    function parseTag(s) { return Number(s.toString().substring(1)) / 100; }

    // --- SPRITESET ---
    Spriteset_Map.prototype.createLightmask = function() {
        this._lightmask = new Lightmask();
        this.addChild(this._lightmask);
    };

    var _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _Spriteset_Map_createLowerLayer.call(this);
        this.createLightmask();
    };

    function Lightmask() {
        this.initialize.apply(this, arguments);
    }

    var pixiVersion = PIXI.VERSION || "4.0.0"; 
    var BaseClass = (pixiVersion.startsWith("v2")) ? PIXI.DisplayObjectContainer : PIXI.Container;
    Lightmask.prototype = Object.create(BaseClass.prototype);
    Lightmask.prototype.constructor = Lightmask;

    Lightmask.prototype.initialize = function() {
        BaseClass.call(this);
        this._width = Graphics.width;
        this._height = Graphics.height;
        this._sprites = [];
        this._createBitmap();
    };

    Lightmask.prototype._createBitmap = function() {
        var w = Graphics.width || 800;
        var h = Graphics.height || 600;
        this._maskBitmap = new Bitmap(w + 128, h + 128);
    };

    Lightmask.prototype.update = function() {
        this._updateMask();
    };

    Lightmask.prototype._updateMask = function() {
        if (master_opacity_var > 0 && typeof $gameVariables !== 'undefined' && $gameVariables) {
            var mVal = Number($gameVariables.value(master_opacity_var));
            if (isNaN(mVal)) mVal = 0; 
            if (mVal < 0) mVal = 0;
            if (mVal > 100) mVal = 100;
            var progress = mVal / 100.0;
            this.alpha = 1.0 - Math.pow(progress, 2.5); 
            this.alpha = Math.min(1.0, Math.max(0.0, this.alpha));
        } else {
            this.alpha = 1.0;
        }

        var map_id = $gameMap.mapId();
        if (map_id !== _oldMapId) {
            _oldMapId = map_id;
            ReloadMapEvents();
            if (_firstRun) {
                var savedTint = $gameVariables.GetSavedTint();
                if (savedTint) { _currentTint = savedTint; _targetTint = savedTint; }
                var savedVignette = $gameVariables.GetSavedVignette();
                if (savedVignette) _currentVignette = savedVignette;
                else _currentVignette = default_vignette;
                var savedRegions = $gameVariables.GetBlockedRegions();
                if (savedRegions) for (var key in savedRegions) _blockedRegions[key] = savedRegions[key];
                _firstRun = false;
            }
        }

        this._maskBitmap.clear();

        var currentR = $gameVariables.GetRadius();
        var targetR = $gameVariables.GetRadiusTarget();
        var speedR = $gameVariables.GetRadiusSpeed();
        
        if (speedR > 0) { 
            if (currentR < targetR) {
                currentR = Math.min(currentR + speedR, targetR);
                $gameVariables.SetRadius(currentR);
            } else if (currentR > targetR) {
                currentR = Math.max(currentR - speedR, targetR);
                $gameVariables.SetRadius(currentR);
            }
            if (Math.abs(currentR - targetR) < 0.1) {
                 $gameVariables.SetRadiusSpeed(0);
                 $gameVariables.SetRadius(targetR);
            }
        } else {
            if (currentR !== targetR) $gameVariables.SetRadius(targetR);
        }

        if (Math.random() < 0.2) _playerFlickerOffset = Math.random() * 7;
        
        for (var i = 0; i < _allLightEvents.length; i++) {
            var light = _allLightEvents[i];
            if (light.type === 'Fire') {
                if (Math.random() < 0.2) light.flickerOffset = Math.random() * 7;
                else if (light.flickerOffset === undefined) light.flickerOffset = 0;
            } else {
                light.flickerOffset = 0;
            }
        }

        if (_currentTint !== _targetTint) {
            _tintTimer++;
            var startRgb = hexToRgb(_currentTint);
            var endRgb = hexToRgb(_targetTint);
            var progress = Math.min(1, _tintTimer / _tintSpeed);
            var newR = Math.floor(startRgb.r + (endRgb.r - startRgb.r) * progress);
            var newG = Math.floor(startRgb.g + (endRgb.g - startRgb.g) * progress);
            var newB = Math.floor(startRgb.b + (endRgb.b - startRgb.b) * progress);
            var currentHex = rgbToHex({r:newR, g:newG, b:newB});
            if (progress >= 1) {
                _currentTint = _targetTint;
                currentHex = _targetTint;
            } else {
                _currentTint = currentHex;
            }
        }

        while(this._sprites.length > 0) this.removeChild(this._sprites.pop());

        // 1. Background (Classic Vignette)
        this._drawClassicVignette(); 

        // 2. Cut Holes
        if (this._maskBitmap._context) this._maskBitmap._context.globalCompositeOperation = 'destination-out';
        this._cutVignetteForLights();
        this._renderPlayerLight(true); 

        // 3. Add Lights
        if (this._maskBitmap._context) this._maskBitmap._context.globalCompositeOperation = 'lighter';
        this._renderPlayerLight(false);
        this._renderEventLights();

        // 4. Regions (AUTOTILE SHADOWS)
        if (Object.keys(_blockedRegions).length > 0) {
             if (this._maskBitmap._context) this._maskBitmap._context.globalCompositeOperation = 'source-over';
             this._renderRegionBlocks();
        }

        if (this._maskBitmap._context) this._maskBitmap._context.globalCompositeOperation = 'source-over';

        // --- СЕНСОР ОТЛАДКА (3-TIER DEBUG HITBOXES) ---
        if (sensor_debug_switch > 0 && $gameSwitches.value(sensor_debug_switch)) {
             this._renderDebugHitboxes();
        }
        
        // --- СУБПИКСЕЛЬНЫЙ ФИКС СМЕЩЕНИЯ (JITTER FIX) ---
        var realDx = $gameMap.displayX();
        var realDy = $gameMap.displayY();
        var fractX = realDx - Math.floor(realDx);
        var fractY = realDy - Math.floor(realDy);
        var shiftX = -20 - (fractX * $gameMap.tileWidth());
        var shiftY = 0 - (fractY * $gameMap.tileHeight());
        
        this._addSprite(shiftX, shiftY, this._maskBitmap);
    };

    // --- ОТРИСОВКА ХИТБОКСОВ ОТЛАДКИ (3 ЗОНЫ) ---
    Lightmask.prototype._renderDebugHitboxes = function() {
        var ctx = this._maskBitmap._context;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 2;

        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);

        // Цвета зон
        var zones = [
            { pct: 1.0, color: 'rgba(255, 0, 0, 0.8)' },                // Фактический (Красный)
            { pct: zone_tangent_pct, color: 'rgba(255, 165, 0, 0.8)' }, // Касательный (Оранжевый)
            { pct: zone_bright_pct, color: 'rgba(0, 255, 0, 0.8)' }     // Яркий (Зеленый)
        ];

        // 1. Свет игрока
        var pRad = $gameVariables.GetRadius();
        if (pRad > 0) {
            var px = $gamePlayer._realX, py = $gamePlayer._realY;
            var x1 = (pw / 2) + ((px - dx) * pw);
            var y1 = (ph / 2) + ((py - dy) * ph);
            if (realDx > $gamePlayer.x) x1 += $gameMap.width() * pw;
            if (realDy > $gamePlayer.y) y1 += $gameMap.height() * ph;
            
            // ИСПРАВЛЕНИЕ: Добавляем +20px для компенсации сдвига Canvas
            x1 += 20;

            for (var z = 0; z < zones.length; z++) {
                ctx.strokeStyle = zones[z].color;
                ctx.beginPath();
                if ($gameVariables.GetFlashlight()) {
                    var len = $gameVariables.GetFlashlightLength() * pw * zones[z].pct; 
                    var wid = $gameVariables.GetFlashlightWidth() * pw * zones[z].pct;
                    var pDir = $gamePlayer._direction;
                    if (pDir === 2) ctx.rect(x1 - wid/2, y1, wid, len);
                    if (pDir === 8) ctx.rect(x1 - wid/2, y1 - len, wid, len);
                    if (pDir === 4) ctx.rect(x1 - len, y1 - wid/2, len, wid);
                    if (pDir === 6) ctx.rect(x1, y1 - wid/2, len, wid);
                } else {
                    // ИСПРАВЛЕНИЕ: Сдвигаем Y в соответствии с высотой фонарика игрока, чтобы центры совпали
                    var py_visual = y1 - flashlightoffset;
                    ctx.arc(x1, py_visual, pRad * zones[z].pct, 0, 2 * Math.PI);
                }
                ctx.stroke();
            }
        }

        // 2. Свет ивентов
        for (var i = 0; i < _allLightEvents.length; i++) {
            var light = _allLightEvents[i];
            if (!light.active) continue;
            var event = $gameMap.event(light.eventId);
            if (!event) continue;

            var lx = event._realX, ly = event._realY;
            var x1 = (pw / 2) + ((lx - dx) * pw);
            var y1 = (ph / 2) + ((ly - dy) * ph);
            if ($dataMap.scrollType === 2 || $dataMap.scrollType === 3) { if (realDx - 10 > lx) x1 += $gameMap.width() * pw; }
            if ($dataMap.scrollType === 1 || $dataMap.scrollType === 3) { if (realDy - 10 > ly) y1 += $gameMap.height() * ph; }

            // ИСПРАВЛЕНИЕ: Добавляем +20px для компенсации сдвига Canvas
            x1 += 20;

            for (var z = 0; z < zones.length; z++) {
                ctx.strokeStyle = zones[z].color;
                ctx.beginPath();
                if (light.type === 'Flashlight') {
                    var len = (light.flashLength || 8) * pw * zones[z].pct;
                    var wid = (light.flashWidth || 12) * pw * zones[z].pct;
                    var lDir = event._direction;
                    if (light.flashlightDir === 1) lDir = 8;
                    if (light.flashlightDir === 2) lDir = 6;
                    if (light.flashlightDir === 3) lDir = 2;
                    if (light.flashlightDir === 4) lDir = 4;

                    if (lDir === 2) ctx.rect(x1 - wid/2, y1, wid, len);
                    if (lDir === 8) ctx.rect(x1 - wid/2, y1 - len, wid, len);
                    if (lDir === 4) ctx.rect(x1 - len, y1 - wid/2, len, wid);
                    if (lDir === 6) ctx.rect(x1, y1 - wid/2, len, wid);
                    ctx.stroke();
                } else {
                    var rX = light.radius * zones[z].pct;
                    var rY = (light.radiusY !== undefined ? light.radiusY : light.radius) * zones[z].pct;
                    if (rX !== rY) {
                        ctx.save();
                        ctx.translate(x1, y1);
                        ctx.scale(1, rY / rX);
                        ctx.beginPath();
                        ctx.arc(0, 0, rX, 0, 2 * Math.PI);
                        ctx.stroke();
                        ctx.restore();
                    } else {
                        ctx.arc(x1, y1, rX, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                }
            }
        }

        ctx.restore();
        this._maskBitmap._setDirty();
    };

    // --- HELPER: AUTOTILE BITMAP CACHE ---
    Lightmask.prototype._getAutotileBitmap = function(color, mask, isoOff, shortMask) {
        if (!this._autotileCache) this._autotileCache = {};
        var key = color + "_" + mask + "_" + isoOff + "_" + (shortMask || 0);
        if (this._autotileCache[key]) return this._autotileCache[key];

        var size = $gameMap.tileWidth();
        var bitmap = new Bitmap(size, size);
        var ctx = bitmap._context;
        
        var rgb = hexToRgb(color);
        var colorSolid = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 1.0)';
        var colorZero  = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ', 0.0)';
        
        var preset = (wall_preset_id && _falloffPresets[wall_preset_id]) ? _falloffPresets[wall_preset_id] : null;

        var addStops = function(grad) {
            if (preset) {
                for (var i = 0; i < preset.length; i++) {
                    var step = preset[i];
                    var a = step.alpha; 
                    var col = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
                    grad.addColorStop(step.pos, col);
                }
            } else {
                grad.addColorStop(0, colorSolid);
                grad.addColorStop(1, colorZero);
            }
        };

        // 1. Fill solid
        ctx.fillStyle = colorSolid;
        ctx.fillRect(0, 0, size, size);
        
        // 2. Erase edges
        ctx.globalCompositeOperation = 'destination-out';
        var fadeSize = wall_softness; 
        
        // CARDINAL EDGES
        if (!(mask & 1)) { // Top Missing
            var g = ctx.createLinearGradient(0, 0, 0, fadeSize);
            addStops(g);
            ctx.fillStyle = g; ctx.fillRect(0, 0, size, fadeSize);
        }
        if (!(mask & 2)) { // Right Missing
            var g = ctx.createLinearGradient(size, 0, size - fadeSize, 0);
            addStops(g);
            ctx.fillStyle = g; ctx.fillRect(size - fadeSize, 0, fadeSize, size);
        }
        if (!(mask & 4)) { // Down Missing (With ISO Support)
            if (isoOff > 0) {
                 ctx.fillStyle = colorSolid; 
                 ctx.fillRect(0, size - isoOff, size, isoOff);
            }
            var g = ctx.createLinearGradient(0, size - isoOff, 0, size - isoOff - fadeSize);
            addStops(g);
            ctx.fillStyle = g; 
            ctx.fillRect(0, size - isoOff - fadeSize, size, fadeSize);
        }
        if (!(mask & 8)) { // Left Missing
            var g = ctx.createLinearGradient(0, 0, fadeSize, 0);
            addStops(g);
            ctx.fillStyle = g; ctx.fillRect(0, 0, fadeSize, size);
        }

        // --- FIX FOR NEIGHBOR SHORTNESS (GRADIENT BLEND) ---
        if ((mask & 2) && (shortMask & 2)) {
             var g = ctx.createLinearGradient(size, 0, size - fadeSize, 0);
             addStops(g);
             ctx.fillStyle = g;
             ctx.fillRect(size - fadeSize, size - wall_iso_offset, fadeSize, wall_iso_offset);
        }
        if ((mask & 8) && (shortMask & 8)) {
             var g = ctx.createLinearGradient(0, 0, fadeSize, 0);
             addStops(g);
             ctx.fillStyle = g;
             ctx.fillRect(0, size - wall_iso_offset, fadeSize, wall_iso_offset);
        }

        // DIAGONAL CORNERS (INNER)
        var addStopsRadial = function(grad) {
             if (preset) {
                for (var i = 0; i < preset.length; i++) {
                    var step = preset[i];
                    var a = step.alpha; 
                    var col = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
                    grad.addColorStop(step.pos, col);
                }
            } else {
                grad.addColorStop(0, colorSolid); // Tip = Erase
                grad.addColorStop(1, colorZero);  // Inside = Keep
            }
        };
        
        var cSize = fadeSize; 

        // Top-Right Corner
        if ((mask & 1) && (mask & 2) && !(mask & 16)) {
            var g = ctx.createRadialGradient(size, 0, 0, size, 0, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(size,0); ctx.lineTo(size, cSize); ctx.arc(size, 0, cSize, Math.PI/2, Math.PI); ctx.fill();
        }
        
        // Bottom-Right Corner
        if ((mask & 2) && (mask & 4) && !(mask & 32)) {
            var cornerY = size;
            if (shortMask & 2) cornerY = size - wall_iso_offset;
            var g = ctx.createRadialGradient(size, cornerY, 0, size, cornerY, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(size, cornerY); ctx.lineTo(size - cSize, cornerY); ctx.arc(size, cornerY, cSize, Math.PI, Math.PI * 1.5); ctx.fill();
        }
        
        // Bottom-Left Corner
        if ((mask & 4) && (mask & 8) && !(mask & 64)) {
            var cornerY = size;
            if (shortMask & 8) cornerY = size - wall_iso_offset;
            var g = ctx.createRadialGradient(0, cornerY, 0, 0, cornerY, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(0, cornerY); ctx.lineTo(0, cornerY - cSize); ctx.arc(0, cornerY, cSize, Math.PI * 1.5, 0); ctx.fill();
        }
        
        // Top-Left Corner
        if ((mask & 8) && (mask & 1) && !(mask & 128)) {
            var g = ctx.createRadialGradient(0, 0, 0, 0, 0, cSize);
            addStopsRadial(g);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fadeSize, 0); ctx.arc(0, 0, cSize, 0, Math.PI/2); ctx.fill();
        }
        
        // OUTER BOTTOM CORNERS (For Iso Offset Smoothing when *I* am Short)
        if (isoOff > 0) {
            var bottomY = size - isoOff;
            if (!(mask & 4) && !(mask & 2)) {
                var g = ctx.createRadialGradient(size, bottomY, 0, size, bottomY, cSize);
                addStopsRadial(g);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(size, bottomY); ctx.lineTo(size - cSize, bottomY); ctx.arc(size, bottomY, cSize, Math.PI, Math.PI * 1.5); ctx.fill();
            }
            if (!(mask & 4) && !(mask & 8)) {
                var g = ctx.createRadialGradient(0, bottomY, 0, 0, bottomY, cSize);
                addStopsRadial(g);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(0, bottomY); ctx.lineTo(0, bottomY - cSize); ctx.arc(0, bottomY, cSize, Math.PI * 1.5, 0); ctx.fill();
            }
        }
        
        // --- NEW: TINT TILE OVERLAY ---
        if (wall_tint_opacity > 0) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + wall_tint_opacity + ')';
            ctx.fillRect(0, 0, size, size - isoOff);
        }

        ctx.globalCompositeOperation = 'source-over';
        
        this._autotileCache[key] = bitmap;
        return bitmap;
    };

    Lightmask.prototype._renderRegionBlocks = function() {
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);
        var startX = dx, startY = dy;
        var endX = startX + Math.ceil(Graphics.width / pw) + 3;
        var endY = startY + Math.ceil(Graphics.height / ph) + 3;
        var ctx = this._maskBitmap._context;
        
        ctx.save();
        
        // ИДЕАЛЬНЫЙ ФИКС ШВОВ КАНВАСА: Принудительно отключаем сглаживание пикселей 
        // при склейке тайлов, чтобы избежать прозрачных линий на границах целых чисел.
        ctx.imageSmoothingEnabled = false;
        if (ctx.mozImageSmoothingEnabled !== undefined) ctx.mozImageSmoothingEnabled = false;
        if (ctx.webkitImageSmoothingEnabled !== undefined) ctx.webkitImageSmoothingEnabled = false;
        if (ctx.msImageSmoothingEnabled !== undefined) ctx.msImageSmoothingEnabled = false;

        for (var x = startX; x < endX; x++) {
            for (var y = startY; y < endY; y++) {
                var mapX = $gameMap.roundX(x);
                var mapY = $gameMap.roundY(y);
                var regionId = $gameMap.regionId(mapX, mapY);
                
                if (_blockedRegions[regionId]) {
                    var color = _blockedRegions[regionId];
                    var x1 = (x - dx) * pw + 20; 
                    var y1 = (y - dy) * ph;
                    
                    var mask = 0;
                    var check = function(ox, oy) {
                        var rid = $gameMap.regionId($gameMap.roundX(x + ox), $gameMap.roundY(y + oy));
                        return (_blockedRegions[rid] && _blockedRegions[rid] === color);
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

                    var effectiveIso = (mask & 4) ? 0 : wall_iso_offset;

                    var bitmap = this._getAutotileBitmap(color, mask, effectiveIso, shortMask);
                    
                    // Рисуем тайл ровно пиксель-в-пиксель без костыльного расширения
                    ctx.drawImage(bitmap.canvas, x1, y1);
                }
            }
        }
        ctx.restore();
        this._maskBitmap._setDirty();
    };

    Lightmask.prototype._cutVignetteForLights = function() {
        if (!events_clear_vignette_global) return;
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);
        var context = this._maskBitmap._context;

        for (var i = 0; i < _allLightEvents.length; i++) {
            var light = _allLightEvents[i];
            if (!light.active) continue;

            var mult = (light.vignetteMultiplier !== undefined) ? light.vignetteMultiplier : (events_clear_vignette_global ? vignette_clear_mult_default : 0);
            if (mult <= 0) continue; 

            var event = $gameMap.event(light.eventId);
            if (!event) continue; 

            var lx = event._realX, ly = event._realY;
            var x1 = (pw / 2) + ((lx - dx) * pw);
            var y1 = (ph / 2) + ((ly - dy) * ph);

            if ($dataMap.scrollType === 2 || $dataMap.scrollType === 3) { if (realDx - 10 > lx) x1 += $gameMap.width() * pw; }
            if ($dataMap.scrollType === 1 || $dataMap.scrollType === 3) { if (realDy - 10 > ly) y1 += $gameMap.height() * ph; }
            if (!isValid(x1) || !isValid(y1)) continue;

            var cutRadius = (light.radius - light.flickerOffset) * mult;
            if (cutRadius < 0) cutRadius = 0;
            
            var alpha = (light.brightness !== undefined) ? light.brightness : 1.0;
            alpha = Math.min(1.0, Math.max(0.0, alpha));
            
            var smooth = (light.falloff !== undefined) ? light.falloff : 1.0;
            var startFade = Math.max(0.0, 1.0 - smooth);
            var fadeDist = 1.0 - startFade;
            
            var rX = cutRadius;
            var rY = cutRadius; 
            if (light.radiusY !== undefined && light.radius > 0) {
                var ratio = light.radiusY / light.radius;
                rY = rX * ratio;
            }
            var isOval = (rX !== rY);

            var useDefault = (!light.presetId && _defaultFalloff.length === 0);
            
            try {
                context.save();
                if (isOval) {
                    context.translate(x1, y1);
                    context.scale(1, rY / rX);
                    context.translate(-x1, -y1); 
                }

                var grad = context.createRadialGradient(x1, y1, 0, x1, y1, cutRadius);
                var rgbaFull = 'rgba(0,0,0,' + alpha + ')';
                var rgbaZero = 'rgba(0,0,0,0.0)';
                
                if (useDefault) {
                     grad.addColorStop(0, rgbaFull);
                     grad.addColorStop(startFade, rgbaFull);
                     grad.addColorStop(1, rgbaZero);
                } else {
                     var stop1 = startFade + fadeDist * 0.40;
                     var stop2 = startFade + fadeDist * 0.95;
                     var rgbaRetain = 'rgba(0,0,0,' + (alpha * 0.95) + ')';
                     var rgbaDrop = 'rgba(0,0,0,' + (alpha * 0.10) + ')';
                     
                     grad.addColorStop(0, rgbaFull); 
                     grad.addColorStop(startFade, rgbaFull); 
                     grad.addColorStop(stop1, rgbaRetain);
                     grad.addColorStop(stop2, rgbaDrop);
                     grad.addColorStop(1, rgbaZero);
                }
                
                context.fillStyle = grad;
                context.beginPath();
                context.arc(x1, y1, cutRadius, 0, 2 * Math.PI);
                context.fill();
                context.restore();
            } catch(e) {}
        }
    };

    Lightmask.prototype._drawClassicVignette = function() {
        var context = this._maskBitmap._context;
        if (vignette_disable_switch > 0 && $gameSwitches.value(vignette_disable_switch)) {
            context.fillStyle = _currentTint;
            context.fillRect(0, 0, this._maskBitmap.width, this._maskBitmap.height);
            this._maskBitmap._setDirty(); 
            return;
        }

        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);
        var px = $gamePlayer._realX, py = $gamePlayer._realY;
        var x1 = (pw / 2) + ((px - dx) * pw) + 20; 
        var y1 = (ph / 2) + ((py - dy) * ph);

        if (realDx > $gamePlayer.x) x1 += $gameMap.width() * pw;
        if (realDy > $gamePlayer.y) y1 += $gameMap.height() * ph;

        if (!isValid(x1) || !isValid(y1)) return;

        var shortSide = Math.min(Graphics.width, Graphics.height);
        var r2 = shortSide * vignette_scale_param; 
        var pRadius = $gameVariables.GetRadius();
        
        var targetInfluence = 0;
        if (pRadius > 0) {
            var customMult = $gameVariables.GetPlayerVignetteMult();
            var mult = (customMult !== undefined) ? customMult : player_influence_param;
            targetInfluence = pRadius * mult;
            if (!$gameVariables.GetFlashlight()) targetInfluence *= 0.8;
        }
        
        if (Math.abs(_cachedVignetteRadius - targetInfluence) > 1) {
            _cachedVignetteRadius += (targetInfluence - _cachedVignetteRadius) * breathing_speed_param;
        } else {
            _cachedVignetteRadius = targetInfluence;
        }
        r2 += _cachedVignetteRadius;

        if (_currentTint === _currentVignette) {
             context.fillStyle = _currentVignette;
             context.fillRect(0, 0, this._maskBitmap.width, this._maskBitmap.height);
             return;
        }
        try {
            var grad = context.createRadialGradient(x1, y1, 0, x1, y1, r2);
            grad.addColorStop(0, _currentTint); 
            grad.addColorStop(vignette_sharpness_param, _currentTint); 
            grad.addColorStop(1, _currentVignette);    
            context.fillStyle = grad;
            context.fillRect(0, 0, this._maskBitmap.width, this._maskBitmap.height);
            this._maskBitmap._setDirty(); 
        } catch(e) {}
    };

    Lightmask.prototype._renderPlayerLight = function(isVisionMode) {
        var current = $gameVariables.GetRadius();
        if (current <= 0) return;
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);
        var px = $gamePlayer._realX, py = $gamePlayer._realY;
        var x1 = (pw / 2) + ((px - dx) * pw);
        var y1 = (ph / 2) + ((py - dy) * ph);

        if (realDx > $gamePlayer.x) x1 += $gameMap.width() * pw;
        if (realDy > $gamePlayer.y) y1 += $gameMap.height() * ph;
        if (!isValid(x1) || !isValid(y1)) return;

        var color = $gameVariables.GetPlayerColor();
        var isFlashlight = $gameVariables.GetFlashlight();
        var isFire = $gameVariables.GetFire();
        var brightness = $gameVariables.GetPlayerBrightness(); 
        var smoothness = $gameVariables.GetPlayerSmoothness(); 
        var preset = $gameVariables.GetPlayerPreset();

        if (isFlashlight) {
             var len = $gameVariables.GetFlashlightLength();
             var wid = $gameVariables.GetFlashlightWidth();
             var dir = $gamePlayer._direction;
             this._maskBitmap.radialgradientFillRect2(x1, y1, 20, current, color, '#000000', dir, len, wid, isVisionMode, brightness);
        } else {
            y1 -= flashlightoffset;
            var offset = isFire ? _playerFlickerOffset : 0;
            this._maskBitmap.radialgradientFillRectSDL(x1, y1, 0, current, color, '#000000', isFire, brightness, 0, isVisionMode, offset, smoothness, preset);
        }
    };

    Lightmask.prototype._renderEventLights = function() {
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight();
        var realDx = $gameMap.displayX(), realDy = $gameMap.displayY();
        var dx = Math.floor(realDx), dy = Math.floor(realDy);

        for (var i = 0; i < _allLightEvents.length; i++) {
            var light = _allLightEvents[i];
            if (!light.active) continue;

            var event = $gameMap.event(light.eventId);
            if (!event) continue; 
            var lx = event._realX, ly = event._realY, ldir = event._direction;
            var x1 = (pw / 2) + ((lx - dx) * pw);
            var y1 = (ph / 2) + ((ly - dy) * ph);

            if ($dataMap.scrollType === 2 || $dataMap.scrollType === 3) { if (realDx - 10 > lx) x1 += $gameMap.width() * pw; }
            if ($dataMap.scrollType === 1 || $dataMap.scrollType === 3) { if (realDy - 10 > ly) y1 += $gameMap.height() * ph; }
            if (!isValid(x1) || !isValid(y1)) continue;

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

            var brightness = light.brightness; 
            var smoothness = (light.falloff !== undefined) ? light.falloff : 1.0;

            if (light.type === 'Flashlight') {
                var finalDir = ldir;
                if (light.flashlightDir === 1) finalDir = 8;
                if (light.flashlightDir === 2) finalDir = 6;
                if (light.flashlightDir === 3) finalDir = 2;
                if (light.flashlightDir === 4) finalDir = 4;
                this._maskBitmap.radialgradientFillRect2(x1, y1, 0, light.radius, renderColor, '#000000', finalDir, light.flashLength, light.flashWidth, false, brightness);
            } else {
                this._maskBitmap.radialgradientFillRectSDL(x1, y1, 0, light.radius, renderColor, '#000000', light.type === 'Fire', brightness, light.direction, false, light.flickerOffset, smoothness, light.presetId, light.radiusY);
            }
        }
    };

    Lightmask.prototype._addSprite = function(x1, y1, bitmap) {
        var sprite = new Sprite(this.viewport);
        sprite.bitmap = bitmap;
        sprite.blendMode = 2; // Multiply
        sprite.x = x1;
        sprite.y = y1;
        this._sprites.push(sprite);
        this.addChild(sprite);
    };

    function ReloadMapEvents() {
        _allLightEvents = [];
        var events = $gameMap.events();
        for (var i = 0; i < events.length; i++) {
            var event = events[i];
            if (!event) continue;
            var note = event.event().note;
            var parts = note.trim().split(/\s+/);
            var command = parts.shift().toLowerCase();

            if (command === 'light' || command === 'fire' || command === 'flashlight') {
                var lightObj = {
                    eventId: event._eventId,
                    type: (command === 'fire') ? 'Fire' : (command === 'flashlight') ? 'Flashlight' : 'Normal',
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
                    flickerOffset: 0
                };
                if (command === 'flashlight') {
                    lightObj.flashLength = Number(parts.shift()) || 8;
                    lightObj.flashWidth = Number(parts.shift()) || 12;
                } else {
                    var radArg = String(parts.shift());
                    if (radArg.indexOf(':') > -1) {
                         var dims = radArg.split(':');
                         lightObj.radius = Number(dims[0]) || 100;
                         lightObj.radiusY = Number(dims[1]) || lightObj.radius;
                    } else {
                         lightObj.radius = Number(radArg) || 100;
                         lightObj.radiusY = lightObj.radius;
                    }
                }
                var colorArg = parts.shift();

                for (var j = 0; j < parts.length; j++) {
                     var possibleId = parts[j];
                     if (_falloffPresets[possibleId]) {
                         lightObj.presetId = possibleId;
                         parts.splice(j, 1); 
                         j--; 
                     }
                }
                
                if (parts.length > 0) {
                    var p1 = parts[0];
                    if (isNumber(p1) && !isTag(p1)) {
                        lightObj.vignetteMultiplier = Number(parts.shift());
                        if (parts.length > 0) {
                             if (isTag(parts[0])) {
                                 lightObj.brightness = parseTag(parts.shift());
                                 if (parts.length > 0 && isNumber(parts[0])) lightObj.falloff = Number(parts.shift());
                             } else if (isNumber(parts[0])) {
                                 lightObj.brightness = Number(parts.shift());
                                 if (parts.length > 0 && isNumber(parts[0])) lightObj.falloff = Number(parts.shift());
                             }
                        }
                    } else if (isTag(p1)) {
                         lightObj.brightness = parseTag(parts.shift());
                         if (parts.length > 0 && isNumber(parts[0])) lightObj.falloff = Number(parts.shift());
                    }
                }

                if (colorArg === 'cycle') {
                    while(parts.length >= 2) {
                        var cColor = parts.shift();
                        var cFrames = Number(parts.shift());
                        lightObj.cycle.push({color: cColor, frames: cFrames});
                    }
                } else {
                    lightObj.color = colorArg || '#FFFFFF';
                }
                while (parts.length > 0) {
                    var arg = parts.shift();
                    if (_falloffPresets[arg]) lightObj.presetId = arg; 
                    else if (arg.match(/^b\d+$/i)) lightObj.brightness = Number(arg.substring(1)) / 100; 
                    else if (arg.match(/^d\d+$/i)) lightObj.direction = Number(arg.substring(1));
                    else if (!isNaN(arg)) { 
                        if (command === 'flashlight') lightObj.flashlightDir = Number(arg);
                        else lightObj.customId = Number(arg);
                    }
                }
                _allLightEvents.push(lightObj);
            }
        }
    }

    Bitmap.prototype.radialgradientFillRectSDL = function(x1, y1, r1, r2, color1, color2, flicker, brightness, direction, isVision, cachedOffset, smoothness, presetId, radiusY) {
        if (direction === undefined) direction = 0;
        if (!isValid(x1) || !isValid(y1) || !isValid(r1) || !isValid(r2) || r1 < 0 || r2 < 0) return;

        x1 += 20; 
        var context = this._context;
        var grad;
        
        if (flicker) {
            var offset = (cachedOffset !== undefined) ? cachedOffset : 0;
            r2 = Math.max(0, r2 - offset);
            if (!isVision) {
                var rgb = hexToRgb(color1);
                rgb.g = Math.min(255, Math.max(0, rgb.g + (offset * 1.5 - 5))); 
                color1 = rgbToHex(rgb);
            }
        }
        
        var alpha = (brightness !== undefined) ? brightness : 1.0;
        alpha = Math.min(1.0, Math.max(0.0, alpha));
        var smooth = (smoothness !== undefined) ? smoothness : 1.0;
        var startFade = Math.max(0.0, 1.0 - smooth);
        var fadeDist = 1.0 - startFade;
        
        var rX = r2;
        var rY = (radiusY !== undefined && radiusY > 0) ? radiusY : rX;
        if (flicker && r2 !== (rX + offset)) { 
             var ratioOrg = (radiusY !== undefined) ? (radiusY / (rX + offset)) : 1.0;
             rY = rX * ratioOrg;
        }
        var isOval = (rX !== rY);

        try {
            context.save();
            if (isOval) {
                context.translate(x1, y1);
                context.scale(1, rY / rX);
                context.translate(-x1, -y1);
            }

            grad = context.createRadialGradient(x1, y1, r1, x1, y1, r2);
            var rgb = hexToRgb(color1);
            var baseRgb = rgb.r + ',' + rgb.g + ',' + rgb.b;

            var startColor = isVision ? ('rgba(0,0,0,' + alpha + ')') : ('rgba(' + baseRgb + ',' + alpha + ')');
            grad.addColorStop(0, startColor); 
            grad.addColorStop(startFade, startColor); 
            
            if (presetId && _falloffPresets[presetId]) { 
                 var steps = _falloffPresets[presetId];
                 for (var s = 0; s < steps.length; s++) {
                     var step = steps[s];
                     var pos = startFade + fadeDist * step.pos; 
                     var aVal = alpha * step.alpha;
                     var col = isVision ? ('rgba(0,0,0,' + aVal + ')') : ('rgba(' + baseRgb + ',' + aVal + ')');
                     grad.addColorStop(pos, col);
                 }
            } else if (_defaultFalloff.length > 0) {
                 for (var s = 0; s < _defaultFalloff.length; s++) {
                     var step = _defaultFalloff[s];
                     var pos = startFade + fadeDist * step.pos; 
                     var aVal = alpha * step.alpha;
                     var col = isVision ? ('rgba(0,0,0,' + aVal + ')') : ('rgba(' + baseRgb + ',' + aVal + ')');
                     grad.addColorStop(pos, col);
                 }
            } else {
                var endColorA = isVision ? 'rgba(0,0,0,0.0)' : ('rgba(' + baseRgb + ',0.0)');
                grad.addColorStop(1, endColorA);
            }
            
            context.fillStyle = grad;
            
            var pw = $gameMap.tileWidth() / 2;
            var ph = $gameMap.tileHeight() / 2;
            if (direction === 0) {
                var pad = 20;
                context.fillRect(x1 - r2 - pad, y1 - r2 - pad, (r2 * 2) + (pad * 2), (r2 * 2) + (pad * 2));
            } else {
                switch (direction) {
                    case 1: context.fillRect(x1 - r2, y1 - ph, r2 * 2, r2 * 2); break; 
                    case 2: context.fillRect(x1 - r2, y1 - r2, r2 + pw, r2 * 2); break; 
                    case 3: context.fillRect(x1 - r2, y1 - r2, r2 * 2, r2 + ph); break; 
                    case 4: context.fillRect(x1 - pw, y1 - r2, r2 * 2, r2 * 2); break; 
                }
            }
            context.restore();
            this._setDirty();
        } catch(e) {}
    };

    function hexToRgb(hex) {
        if (!hex) return {r:0, g:0, b:0};
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : {r:0, g:0, b:0};
    }

    function rgbToHex(rgb) {
        return "#" + ((1 << 24) + (Math.floor(rgb.r) << 16) + (Math.floor(rgb.g) << 8) + Math.floor(rgb.b)).toString(16).slice(1);
    }
    
    function isValid(n) { return !isNaN(n) && isFinite(n); }

    // --- LIGHT SENSOR ZONES ---
    Game_CharacterBase.prototype.getLightZone = function() {
        var pw = $gameMap.tileWidth();
        var ph = $gameMap.tileHeight();
        var maxZone = 0; // 0: Тьма, 1: Фактический, 2: Касательный, 3: Яркий
        
        var tx = this._realX;
        var ty = this._realY;

        // Глобальное освещение карты
        var globalLight = 0;
        if (master_opacity_var > 0 && typeof $gameVariables !== 'undefined') {
             var mVal = Number($gameVariables.value(master_opacity_var));
             if (isNaN(mVal)) mVal = 0;
             globalLight = Math.max(0, Math.min(100, mVal)) / 100.0;
        }
        if (globalLight >= 1.0) return 3;

        // Внутренний Raycasting для проверки теней от стен
        var checkLineOfSight = function(x1, y1, x2, y2) {
            var dx = Math.abs(x2 - x1);
            var dy = Math.abs(y2 - y1);
            var sx = (x1 < x2) ? 1 : -1;
            var sy = (y1 < y2) ? 1 : -1;
            var err = dx - dy;
            var x = x1;
            var y = y1;
            var loops = 0;
            while (loops < 100) { 
                loops++;
                var rX = Math.round(x);
                var rY = Math.round(y);
                var regionId = $gameMap.regionId(rX, rY);
                if (_blockedRegions[regionId]) return false; 
                if (Math.abs(x - x2) < 0.5 && Math.abs(y - y2) < 0.5) break;
                var e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
            return true;
        };

        // 1. Свет от игрока
        var pRad = $gameVariables.GetRadius();
        if (pRad > 0) {
            var px = $gamePlayer._realX;
            var py = $gamePlayer._realY;
            
            // ИСПРАВЛЕНИЕ: Выравниваем логический центр игрока с визуальным источником
            if (!$gameVariables.GetFlashlight()) {
                py -= (flashlightoffset / ph); 
            }
            
            if ($gameVariables.GetFlashlight()) {
                var len = $gameVariables.GetFlashlightLength(); 
                var wid = $gameVariables.GetFlashlightWidth();  
                var pDir = $gamePlayer._direction;
                var inConePct = -1;
                var dx = tx - px;
                var dy = ty - py;
                
                // Проверяем нахождение в хитбоксе (прямоугольнике)
                if (pDir === 2 && dy >= 0 && dy <= len && Math.abs(dx) <= wid/2) inConePct = Math.max(dy / len, Math.abs(dx) / (wid/2));
                if (pDir === 8 && dy <= 0 && Math.abs(dy) <= len && Math.abs(dx) <= wid/2) inConePct = Math.max(Math.abs(dy) / len, Math.abs(dx) / (wid/2));
                if (pDir === 4 && dx <= 0 && Math.abs(dx) <= len && Math.abs(dy) <= wid/2) inConePct = Math.max(Math.abs(dx) / len, Math.abs(dy) / (wid/2));
                if (pDir === 6 && dx >= 0 && dx <= len && Math.abs(dy) <= wid/2) inConePct = Math.max(dx / len, Math.abs(dy) / (wid/2));
                
                if (inConePct >= 0 && inConePct <= 1.0 && checkLineOfSight(tx, ty, px, py)) {
                    if (inConePct <= zone_bright_pct) maxZone = Math.max(maxZone, 3);
                    else if (inConePct <= zone_tangent_pct) maxZone = Math.max(maxZone, 2);
                    else maxZone = Math.max(maxZone, 1);
                }
            } else {
                var distP = Math.sqrt(Math.pow((tx - px) * pw, 2) + Math.pow((ty - py) * ph, 2));
                if (distP <= pRad && checkLineOfSight(tx, ty, px, py)) {
                    var pct = distP / pRad;
                    if (pct <= zone_bright_pct) maxZone = Math.max(maxZone, 3);
                    else if (pct <= zone_tangent_pct) maxZone = Math.max(maxZone, 2);
                    else maxZone = Math.max(maxZone, 1);
                }
            }
        }

        if (maxZone === 3) return 3; // Максимальная зона достигнута

        // 2. Ивенты со светом
        for (var i = 0; i < _allLightEvents.length; i++) {
            var light = _allLightEvents[i];
            if (!light.active) continue;

            var event = $gameMap.event(light.eventId);
            if (!event) continue;
            
            var lx = event._realX;
            var ly = event._realY;
            
            if (light.type === 'Flashlight') {
                var len = light.flashLength || 8;
                var wid = light.flashWidth || 12;
                var lDir = event._direction;
                if (light.flashlightDir === 1) lDir = 8;
                if (light.flashlightDir === 2) lDir = 6;
                if (light.flashlightDir === 3) lDir = 2;
                if (light.flashlightDir === 4) lDir = 4;
                
                var inConePct = -1;
                var dx = tx - lx;
                var dy = ty - ly;
                if (lDir === 2 && dy >= 0 && dy <= len && Math.abs(dx) <= wid/2) inConePct = Math.max(dy / len, Math.abs(dx) / (wid/2));
                if (lDir === 8 && dy <= 0 && Math.abs(dy) <= len && Math.abs(dx) <= wid/2) inConePct = Math.max(Math.abs(dy) / len, Math.abs(dx) / (wid/2));
                if (lDir === 4 && dx <= 0 && Math.abs(dx) <= len && Math.abs(dy) <= wid/2) inConePct = Math.max(Math.abs(dx) / len, Math.abs(dy) / (wid/2));
                if (lDir === 6 && dx >= 0 && dx <= len && Math.abs(dy) <= wid/2) inConePct = Math.max(dx / len, Math.abs(dy) / (wid/2));
                
                if (inConePct >= 0 && inConePct <= 1.0 && checkLineOfSight(tx, ty, lx, ly)) {
                    if (inConePct <= zone_bright_pct) maxZone = Math.max(maxZone, 3);
                    else if (inConePct <= zone_tangent_pct) maxZone = Math.max(maxZone, 2);
                    else maxZone = Math.max(maxZone, 1);
                }
            } else {
                var rX = light.radius;
                var rY = light.radiusY !== undefined ? light.radiusY : rX;
                var distPx = Math.abs(tx - lx) * pw;
                var distPy = Math.abs(ty - ly) * ph;
                
                var pct = Math.sqrt(Math.pow(distPx / rX, 2) + Math.pow(distPy / rY, 2));
                if (pct <= 1.0 && checkLineOfSight(tx, ty, lx, ly)) {
                    if (pct <= zone_bright_pct) maxZone = Math.max(maxZone, 3);
                    else if (pct <= zone_tangent_pct) maxZone = Math.max(maxZone, 2);
                    else maxZone = Math.max(maxZone, 1);
                }
            }
            if (maxZone === 3) return 3; // Дальше проверять нет смысла
        }
        
        return maxZone;
    };

    // --- OLD COMPATIBILITY ---
    Game_CharacterBase.prototype.getLightIntensity = function() {
        var pw = $gameMap.tileWidth(), ph = $gameMap.tileHeight(), total = 0, tx = this._realX, ty = this._realY;
        var globalLight = 0;
        if (master_opacity_var > 0 && typeof $gameVariables !== 'undefined') {
             var mVal = Number($gameVariables.value(master_opacity_var));
             globalLight = Math.max(0, Math.min(100, isNaN(mVal)?0:mVal)) / 100.0;
        }
        if (globalLight >= 1.0) return 1.0;
        var checkLineOfSight = function(x1, y1, x2, y2) {
            var dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1), sx = (x1 < x2) ? 1 : -1, sy = (y1 < y2) ? 1 : -1;
            var err = dx - dy, x = x1, y = y1, loops = 0;
            while (loops < 100) { 
                loops++;
                if (_blockedRegions[$gameMap.regionId(Math.round(x), Math.round(y))]) return false; 
                if (Math.abs(x - x2) < 0.5 && Math.abs(y - y2) < 0.5) break;
                var e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
            return true;
        };
        var pRad = $gameVariables.GetRadius();
        if (pRad > 0) {
            var px = $gamePlayer._realX, py = $gamePlayer._realY;
            
            // ИСПРАВЛЕНИЕ: Выравниваем логический центр игрока с визуальным источником
            if (!$gameVariables.GetFlashlight()) {
                py -= (flashlightoffset / ph); 
            }
            
            var distP = Math.sqrt(Math.pow((tx - px) * pw, 2) + Math.pow((ty - py) * ph, 2));
            if ($gameVariables.GetFlashlight()) {
                var len = $gameVariables.GetFlashlightLength(), wid = $gameVariables.GetFlashlightWidth(), pDir = $gamePlayer._direction;
                var dx = tx - px, dy = ty - py, inC = false;
                if (pDir === 2 && dy >= 0 && dy <= len && Math.abs(dx) <= wid/2) inC = true;
                if (pDir === 8 && dy <= 0 && Math.abs(dy) <= len && Math.abs(dx) <= wid/2) inC = true;
                if (pDir === 4 && dx <= 0 && Math.abs(dx) <= len && Math.abs(dy) <= wid/2) inC = true;
                if (pDir === 6 && dx >= 0 && dx <= len && Math.abs(dy) <= wid/2) inC = true;
                if (inC && checkLineOfSight(tx, ty, px, py)) total += Math.max(0, 1.0 - (distP / (len * pw))) * ($gameVariables.GetPlayerBrightness() || 1.0);
            } else {
                if (distP <= pRad && checkLineOfSight(tx, ty, px, py)) total += (1.0 - (distP / pRad)) * ($gameVariables.GetPlayerBrightness() || 1.0);
            }
        }
        for (var i = 0; i < _allLightEvents.length; i++) {
            var light = _allLightEvents[i]; if (!light.active) continue;
            var event = $gameMap.event(light.eventId); if (!event) continue;
            var lx = event._realX, ly = event._realY, rX = light.radius, rY = light.radiusY !== undefined ? light.radiusY : rX, b = light.brightness !== undefined ? light.brightness : 1.0;
            var distPx = Math.abs(tx - lx) * pw, distPy = Math.abs(ty - ly) * ph;
            if (light.type === 'Flashlight') {
                var len = light.flashLength || 8, wid = light.flashWidth || 12, lDir = event._direction;
                if (light.flashlightDir === 1) lDir = 8; else if (light.flashlightDir === 2) lDir = 6; else if (light.flashlightDir === 3) lDir = 2; else if (light.flashlightDir === 4) lDir = 4;
                var dx = tx - lx, dy = ty - ly, inC = false;
                if (lDir === 2 && dy >= 0 && dy <= len && Math.abs(dx) <= wid/2) inC = true;
                if (lDir === 8 && dy <= 0 && Math.abs(dy) <= len && Math.abs(dx) <= wid/2) inC = true;
                if (lDir === 4 && dx <= 0 && Math.abs(dx) <= len && Math.abs(dy) <= wid/2) inC = true;
                if (lDir === 6 && dx >= 0 && dx <= len && Math.abs(dy) <= wid/2) inC = true;
                if (inC && checkLineOfSight(tx, ty, lx, ly)) total += Math.max(0, 1.0 - (Math.sqrt(distPx*distPx + distPy*distPy) / (len * pw))) * b;
            } else {
                var nDist = Math.sqrt(Math.pow(distPx / rX, 2) + Math.pow(distPy / rY, 2));
                if (nDist <= 1.0 && checkLineOfSight(tx, ty, lx, ly)) total += (1.0 - nDist) * b;
            }
        }
        return Math.min(1.0, total + globalLight);
    };

    Game_Variables.prototype.SetRadius = function(v) { this._TxRadius = v; };
    Game_Variables.prototype.GetRadius = function() { return this._TxRadius !== undefined ? this._TxRadius : player_radius_default; };
    Game_Variables.prototype.SetRadiusTarget = function(v) { this._TxRadiusT = v; };
    Game_Variables.prototype.GetRadiusTarget = function() { return this._TxRadiusT !== undefined ? this._TxRadiusT : player_radius_default; };
    Game_Variables.prototype.SetRadiusSpeed = function(v) { this._TxRadiusS = v; };
    Game_Variables.prototype.GetRadiusSpeed = function() { return this._TxRadiusS || 0; };
    Game_Variables.prototype.SetPlayerColor = function(v) { 
        if (typeof v === 'string' && v.length > 0 && v.charAt(0) !== '#') v = '#' + v;
        this._TxPlColor = v; 
    };
    Game_Variables.prototype.GetPlayerColor = function() { return this._TxPlColor || '#FFFFFF'; };
    Game_Variables.prototype.SetPlayerBrightness = function(v) { this._TxPlBright = v; };
    Game_Variables.prototype.GetPlayerBrightness = function() { return (this._TxPlBright !== undefined) ? this._TxPlBright : 1.0; };
    Game_Variables.prototype.SetPlayerSmoothness = function(v) { this._TxPlSmooth = v; };
    Game_Variables.prototype.GetPlayerSmoothness = function() { return (this._TxPlSmooth !== undefined) ? this._TxPlSmooth : 1.0; };
    Game_Variables.prototype.SetPlayerPreset = function(v) { this._TxPlPreset = v; };
    Game_Variables.prototype.GetPlayerPreset = function() { return this._TxPlPreset || null; };
    Game_Variables.prototype.SetFlashlight = function(v) { this._TxFlash = v; };
    Game_Variables.prototype.GetFlashlight = function() { return this._TxFlash || false; };
    Game_Variables.prototype.SetFlashlightDensity = function(v) { this._TxFlashDen = v; };
    Game_Variables.prototype.GetFlashlightDensity = function() { return this._TxFlashDen || 3; };
    Game_Variables.prototype.SetFlashlightLength = function(v) { this._TxFlashLen = v; };
    Game_Variables.prototype.GetFlashlightLength = function() { return this._TxFlashLen || 8; };
    Game_Variables.prototype.SetFlashlightWidth = function(v) { this._TxFlashWid = v; };
    Game_Variables.prototype.GetFlashlightWidth = function() { return this._TxFlashWid || 12; };
    Game_Variables.prototype.SetFire = function(v) { this._TxFire = v; };
    Game_Variables.prototype.GetFire = function() { return this._TxFire || false; };
    Game_Variables.prototype.SetSavedTint = function(v) { this._TxSavedTint = v; };
    Game_Variables.prototype.GetSavedTint = function() { return this._TxSavedTint; };
    Game_Variables.prototype.SetSavedVignette = function(v) { this._TxSavedVignette = v; };
    Game_Variables.prototype.GetSavedVignette = function() { return this._TxSavedVignette; };
    Game_Variables.prototype.SetPlayerVignetteMult = function(v) { this._TxPlayerVignetteMult = v; };
    Game_Variables.prototype.GetPlayerVignetteMult = function() { return this._TxPlayerVignetteMult; };
    Game_Variables.prototype.SetBlockedRegions = function(v) { this._TxBlockedRegions = v; };
    Game_Variables.prototype.GetBlockedRegions = function() { return this._TxBlockedRegions; };
})();