//=============================================================================
// SuperDuperScreen.js
//=============================================================================

/*:
 * @plugindesc [v3.5] Глобальный пост-эффект VHS, размытие, свечение и цветокоррекция (UI включен). Оптимизировано!
 * @author Korolev
 *
 * @param --- Core (SuperDuperCore) ---
 * @default
 *
 * @note
 * Если установлен плагин SuperDuperCore, ширина/высота экрана
 * берутся из него. Свои параметры Screen Width и Screen Height
 * удалены — используйте Core для централизованной настройки.
 *
 * @param --- Основные ---
 * @default
 *
 * @param Enabled on Startup
 * @parent --- Основные ---
 * @text Включен со старта
 * @desc Включает эффект сразу при запуске игры (на титульном экране).
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 *
 * @param Overall Intensity
 * @parent --- Основные ---
 * @text Общая сила эффекта (VHS)
 * @desc Глобальный множитель только для искажений, полос и шума (0.0 - 2.0).
 * @type number
 * @decimals 2
 * @default 1.0
 *
 * @param --- Кинематография ---
 * @default
 *
 * @param Blur Radius
 * @parent --- Кинематография ---
 * @text Радиус размытия
 * @desc Базовое размытие всего экрана ДО наложения эффектов (0.0 - нет, 3.0 - сильное).
 * @type number
 * @decimals 2
 * @default 0.5
 *
 * @param Sharpening
 * @parent --- Кинематография ---
 * @text Резкость
 * @desc Искусственное повышение резкости в самом конце (0.0 - выкл, 1.0 - макс).
 * @type number
 * @decimals 2
 * @default 0.3
 *
 * @param Bloom Intensity
 * @parent --- Кинематография ---
 * @text Сила свечения (Bloom)
 * @desc Насколько сильно яркие участки будут светиться.
 * @type number
 * @decimals 2
 * @default 0.4
 *
 * @param Bloom Threshold
 * @parent --- Кинематография ---
 * @text Порог свечения
 * @desc Что считать "ярким" для свечения (0.0 - всё, 1.0 - только белое).
 * @type number
 * @decimals 2
 * @default 0.6
 *
 * @param Color Temperature
 * @parent --- Кинематография ---
 * @text Цветовая температура
 * @desc Оттенок: -1.0 (холодный/синий) до 1.0 (теплый/оранжевый). 0.0 - нейтральный.
 * @type number
 * @decimals 2
 * @min -1.0
 * @max 1.0
 * @default 0.0
 *
 * @param --- Цветокоррекция ---
 * @default
 *
 * @param Saturation
 * @parent --- Цветокоррекция ---
 * @text Насыщенность (Saturation)
 * @desc Насыщенность цветов. 1.0 - обычная, 0.0 - ч/б.
 * @type number
 * @decimals 2
 * @default 0.75
 *
 * @param Contrast
 * @parent --- Цветокоррекция ---
 * @text Контраст (Contrast)
 * @desc Контрастность изображения.
 * @type number
 * @decimals 2
 * @default 1.15
 *
 * @param Brightness
 * @parent --- Цветокоррекция ---
 * @text Яркость (Brightness)
 * @desc Множитель яркости.
 * @type number
 * @decimals 2
 * @default 0.95
 *
 * @param --- Детали VHS ---
 * @default
 *
 * @param Wave Intensity
 * @parent --- Детали VHS ---
 * @text Сила волн (Искажение)
 * @desc Насколько сильно строки будут "плыть".
 * @type number
 * @decimals 2
 * @default 0.5
 *
 * @param Chroma Intensity
 * @parent --- Детали VHS ---
 * @text Хроматическая аберрация
 * @desc Сдвиг красного и синего каналов.
 * @type number
 * @decimals 2
 * @default 1.2
 *
 * @param Scanline Intensity
 * @parent --- Детали VHS ---
 * @text Сила сканлайнов (Полосы)
 * @desc Заметность горизонтальных телевизионных полос.
 * @type number
 * @decimals 2
 * @default 0.8
 *
 * @param Noise Intensity
 * @parent --- Детали VHS ---
 * @text Сила шума (Зерно)
 * @desc Количество белого шума на экране.
 * @type number
 * @decimals 2
 * @default 0.7
 *
 * @param --- Пресеты ---
 * @default
 *
 * @param Presets
 * @parent --- Пресеты ---
 * @text Базовые Пресеты
 * @type struct<Preset>[]
 * @desc Список заранее подготовленных пресетов.
 * @default []
 *
 * @help
 * ============================================================================
 * Описание
 * ============================================================================
 * Плагин "Super Duper Screen" v3.5
 * Автор: Korolev
 * * - Виньетка полностью удалена.
 * - Эффекты возвращены на слой Scene_Base (поверх UI).
 * - Оставлены: размытие, эффект Bloom, цветовая температура, резкость, VHS.
 * - [v3.4] Шейдер сурово оптимизирован: FPS выше, лагов нет.
 * - [v3.4] Добавлена плавная интерполяция (фейд) параметров.
 * - [v3.5] Добавлена система Супер-пупер Пресетов (сохранение и загрузка).
 *
 * ============================================================================
 * Команды плагина (Plugin Commands)
 * ============================================================================
 * SuperDuper ON
 * SuperDuper OFF
 *
 * SuperDuper SET [параметр] [значение] [время_в_кадрах]
 * SuperDuper PRESET [имя_пресета] [время_в_кадрах]
 * SuperDuper SAVE_PRESET [имя_пресета]
 *
 * Доступные параметры:
 * intensity, blur, bloom, bloomthresh, colortemp, sharpen, saturation, 
 * contrast, brightness, wave, chroma, scanline, noise.
 *
 * ПРИМЕРЫ:
 * SuperDuper SET blur 1.5 60        (Плавно размоет картинку за 60 кадров)
 * * SuperDuper SAVE_PRESET Action     (Сохранит ТЕКУЩИЕ настройки как "Action")
 * SuperDuper PRESET Action 120      (За 2 секунды плавно перейдет к "Action")
 * SuperDuper PRESET Normal 60       (Перейдет к пресету Normal, если он есть)
 *
 */

/*~struct~Preset:
 * @param name
 * @text Имя пресета
 * @type string
 * @desc Имя (без пробелов, английскими). Например: Action
 *
 * @param settings
 * @text Настройки
 * @type string
 * @desc Формат: blur:1.5, wave:0.0, chroma:2.0 (через запятую)
 */

(function() {
    var parameters = PluginManager.parameters('SuperDuperScreen');

    var getNum = function(paramName, defValue) {
        var val = Number(parameters[paramName]);
        return isNaN(val) ? defValue : val;
    };

    // Читаем размеры экрана из SuperDuperCore (если есть), иначе — дефолт
    var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
    var scrW = core ? core.screen.width : 1280;
    var scrH = core ? core.screen.height : 720;

    var defaultSettings = {
        screenWidth: scrW,
        screenHeight: scrH,
        active: String(parameters['Enabled on Startup']) === 'true',
        intensity: getNum('Overall Intensity', 1.0),
        
        blur: getNum('Blur Radius', 0.5),
        bloom: getNum('Bloom Intensity', 0.4),
        bloomthresh: getNum('Bloom Threshold', 0.6),
        colortemp: getNum('Color Temperature', 0.0),
        sharpen: getNum('Sharpening', 0.3),
        
        saturation: getNum('Saturation', 0.75),
        contrast: getNum('Contrast', 1.15),
        brightness: getNum('Brightness', 0.95),
        
        wave: getNum('Wave Intensity', 0.5),
        chroma: getNum('Chroma Intensity', 1.2),
        scanline: getNum('Scanline Intensity', 0.8),
        noise: getNum('Noise Intensity', 0.7)
    };

    // Парсим пресеты из настроек плагина
    var rawPresets = parameters['Presets'] || '[]';
    var parsedPresets = {};
    try {
        var arr = JSON.parse(rawPresets);
        for (var i = 0; i < arr.length; i++) {
            var p = JSON.parse(arr[i]);
            if (p.name && p.settings) {
                var presetConfig = {};
                var parts = p.settings.split(',');
                for (var j = 0; j < parts.length; j++) {
                    var kv = parts[j].split(':');
                    if (kv.length === 2) {
                        presetConfig[kv[0].trim().toLowerCase()] = Number(kv[1].trim());
                    }
                }
                parsedPresets[p.name.trim().toLowerCase()] = presetConfig;
            }
        }
    } catch(e) {
        console.warn("SuperDuperScreen: Ошибка парсинга пресетов!", e);
    }

    var getSuperDuperConfig = function() {
        if ($gameSystem && $gameSystem._superDuperConfig) {
            // Патч для старых сохранений
            if (!$gameSystem._superDuperTarget) {
                $gameSystem._superDuperTarget = JSON.parse(JSON.stringify($gameSystem._superDuperConfig));
                $gameSystem._superDuperFrames = {};
            }
            // Патч для сохранений без кастомных пресетов
            if (!$gameSystem._superDuperSavedPresets) {
                $gameSystem._superDuperSavedPresets = {};
            }
            return $gameSystem._superDuperConfig;
        }
        return defaultSettings;
    };

    //=========================================================================
    // Фрагментный шейдер (Оптимизированный PIXI)
    //=========================================================================
    var fragmentSrc = [
        'varying vec2 vTextureCoord;',
        'uniform sampler2D uSampler;',
        
        // Разделяем время, чтобы избежать просадок точности и визуальных дерганий
        'uniform float uWaveTime;',
        'uniform float uNoiseTime;',
        'uniform vec2 uResolution;',
        
        // Переменные VHS
        'uniform float uIntensity;',
        'uniform float uWave;',
        'uniform float uChroma;',
        'uniform float uScanline;',
        'uniform float uNoise;',
        
        // Переменные Кинематографии
        'uniform float uBlur;',
        'uniform float uBloom;',
        'uniform float uBloomThresh;',
        'uniform float uColorTemp;',
        'uniform float uSharpen;',
        
        // Переменные цвета
        'uniform float uSaturation;',
        'uniform float uContrast;',
        'uniform float uBrightness;',
        
        'float rand(vec2 co){',
        '    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);',
        '}',

        // Оптимизированная функция, совмещающая размытие и хроматическую аберрацию за 1 проход
        'vec3 getChromaBlurred(sampler2D tex, vec2 uv, vec2 res, float radius, float shift) {',
        '    if (radius <= 0.0 && shift <= 0.0) return texture2D(tex, uv).rgb;',
        '    vec3 c = vec3(0.0);',
        '    vec2 off = radius / res;',
        '    vec2 s = vec2(shift, 0.0);',
        
        '    c.r += texture2D(tex, uv + vec2(-off.x, -off.y) - s).r;',
        '    c.g += texture2D(tex, uv + vec2(-off.x, -off.y)).g;',
        '    c.b += texture2D(tex, uv + vec2(-off.x, -off.y) + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2( 0.0,   -off.y) - s).r;',
        '    c.g += texture2D(tex, uv + vec2( 0.0,   -off.y)).g;',
        '    c.b += texture2D(tex, uv + vec2( 0.0,   -off.y) + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2( off.x, -off.y) - s).r;',
        '    c.g += texture2D(tex, uv + vec2( off.x, -off.y)).g;',
        '    c.b += texture2D(tex, uv + vec2( off.x, -off.y) + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2(-off.x,  0.0) - s).r;',
        '    c.g += texture2D(tex, uv + vec2(-off.x,  0.0)).g;',
        '    c.b += texture2D(tex, uv + vec2(-off.x,  0.0) + s).b;',
        
        '    c.r += texture2D(tex, uv - s).r;',
        '    c.g += texture2D(tex, uv).g;',
        '    c.b += texture2D(tex, uv + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2( off.x,  0.0) - s).r;',
        '    c.g += texture2D(tex, uv + vec2( off.x,  0.0)).g;',
        '    c.b += texture2D(tex, uv + vec2( off.x,  0.0) + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2(-off.x,  off.y) - s).r;',
        '    c.g += texture2D(tex, uv + vec2(-off.x,  off.y)).g;',
        '    c.b += texture2D(tex, uv + vec2(-off.x,  off.y) + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2( 0.0,    off.y) - s).r;',
        '    c.g += texture2D(tex, uv + vec2( 0.0,    off.y)).g;',
        '    c.b += texture2D(tex, uv + vec2( 0.0,    off.y) + s).b;',
        
        '    c.r += texture2D(tex, uv + vec2( off.x,  off.y) - s).r;',
        '    c.g += texture2D(tex, uv + vec2( off.x,  off.y)).g;',
        '    c.b += texture2D(tex, uv + vec2( off.x,  off.y) + s).b;',
        
        '    return c / 9.0;',
        '}',

        'void main(void) {',
        '    vec2 uv = vTextureCoord;',

        '    // 1. Искажение строк (Волны)',
        '    float wave = sin(uv.y * 15.0 + uWaveTime) * 0.003 * uWave * uIntensity;',
        '    uv.x += wave;',

        '    // 2. Базовое размытие и Хроматическая аберрация (Оптимизировано)',
        '    float shift = 0.004 * uChroma * uIntensity;',
        '    vec3 baseColor = getChromaBlurred(uSampler, uv, uResolution, uBlur, shift);',
        '    float originalAlpha = texture2D(uSampler, uv).a;',
        '    vec4 color = vec4(baseColor, originalAlpha);',

        '    // 3. Bloom (Свечение ярких участков - Оптимизировано, 5 выборок)',
        '    if (uBloom > 0.0) {',
        '        vec3 bloomColor = vec3(0.0);',
        '        vec2 offB = (uBlur + 4.0) / uResolution;',
        '        vec2 sB = vec2(shift, 0.0);',
        
        '        bloomColor.r += texture2D(uSampler, uv - sB).r;',
        '        bloomColor.g += texture2D(uSampler, uv).g;',
        '        bloomColor.b += texture2D(uSampler, uv + sB).b;',
        
        '        bloomColor.r += texture2D(uSampler, uv + vec2(-offB.x, -offB.y) - sB).r;',
        '        bloomColor.g += texture2D(uSampler, uv + vec2(-offB.x, -offB.y)).g;',
        '        bloomColor.b += texture2D(uSampler, uv + vec2(-offB.x, -offB.y) + sB).b;',
        
        '        bloomColor.r += texture2D(uSampler, uv + vec2(offB.x, -offB.y) - sB).r;',
        '        bloomColor.g += texture2D(uSampler, uv + vec2(offB.x, -offB.y)).g;',
        '        bloomColor.b += texture2D(uSampler, uv + vec2(offB.x, -offB.y) + sB).b;',
        
        '        bloomColor.r += texture2D(uSampler, uv + vec2(-offB.x, offB.y) - sB).r;',
        '        bloomColor.g += texture2D(uSampler, uv + vec2(-offB.x, offB.y)).g;',
        '        bloomColor.b += texture2D(uSampler, uv + vec2(-offB.x, offB.y) + sB).b;',
        
        '        bloomColor.r += texture2D(uSampler, uv + vec2(offB.x, offB.y) - sB).r;',
        '        bloomColor.g += texture2D(uSampler, uv + vec2(offB.x, offB.y)).g;',
        '        bloomColor.b += texture2D(uSampler, uv + vec2(offB.x, offB.y) + sB).b;',
        
        '        bloomColor /= 5.0;',
        
        '        float blumLum = dot(bloomColor, vec3(0.299, 0.587, 0.114));',
        '        float bright = max(0.0, blumLum - uBloomThresh);',
        '        color.rgb += bloomColor * bright * uBloom;',
        '    }',

        '    // 4. Сканлайны (Применяются поверх размытия)',
        '    float scanline = sin(uv.y * 800.0) * 0.04 * uScanline * uIntensity;',
        '    color.rgb -= scanline;',

        '    // 5. Зернистость (Не должна размываться)',
        '    float noise = (rand(uv + vec2(uNoiseTime)) - 0.5) * 0.15 * uNoise * uIntensity;',
        '    color.rgb += noise;',

        '    // 6. Цветовая температура',
        '    color.r += uColorTemp * 0.15;',
        '    color.b -= uColorTemp * 0.15;',

        '    // 7. Базовая Цветокоррекция',
        '    color.rgb *= uBrightness;',
        '    color.rgb = (color.rgb - 0.5) * uContrast + 0.5;',
        '    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));',
        '    vec3 gray = vec3(luminance);',
        '    color.rgb = mix(gray, color.rgb, uSaturation);',

        '    // 8. Sharpening (Резкость - теперь вычисляется из baseColor без дополнительных выборок)',
        '    color.rgb += (color.rgb - baseColor) * uSharpen;',

        '    gl_FragColor = color;',
        '}'
    ].join('\n');

    //=========================================================================
    // PIXI Filter Class
    //=========================================================================
    function SuperDuperFilter() {
        if (typeof PIXISuper === "function") { PIXISuper(PIXI.Filter, this, [null, fragmentSrc]); }
        else { PIXI.Filter.call(this, null, fragmentSrc); }
        this.uniforms.uWaveTime = 0.0;
        this.uniforms.uNoiseTime = 0.0;
        this.uniforms.uResolution = [scrW, scrH];
        this.updateUniforms(defaultSettings);
    }

    SuperDuperFilter.prototype = Object.create(PIXI.Filter.prototype);
    SuperDuperFilter.prototype.constructor = SuperDuperFilter;

    // Перехват применяемого фильтра для точного расчета текстуры
    SuperDuperFilter.prototype.apply = function(filterManager, input, output, clear) {
        var tw = input.width || scrW;
        var th = input.height || scrH;
        
        if (input.size) {
            tw = input.size.width;
            th = input.size.height;
        }
        
        var sw = input.sourceFrame ? input.sourceFrame.width : tw;
        var sh = input.sourceFrame ? input.sourceFrame.height : th;
        
        this.uniforms.uResolution[0] = sw;
        this.uniforms.uResolution[1] = sh;
        
        PIXI.Filter.prototype.apply.call(this, filterManager, input, output, clear);
    };

    SuperDuperFilter.prototype.updateTime = function() {
        // Закольцовываем время безопасно, чтобы не было скачков в шейдере
        this.uniforms.uWaveTime = (this.uniforms.uWaveTime + 0.05) % (Math.PI * 2);
        this.uniforms.uNoiseTime = (this.uniforms.uNoiseTime + 0.01) % 1.0;
    };

    SuperDuperFilter.prototype.updateUniforms = function(config) {
        this.uniforms.uIntensity = config.intensity;
        
        this.uniforms.uBlur = config.blur;
        this.uniforms.uBloom = config.bloom;
        this.uniforms.uBloomThresh = config.bloomthresh;
        this.uniforms.uColorTemp = config.colortemp;
        this.uniforms.uSharpen = config.sharpen;
        
        this.uniforms.uWave = config.wave;
        this.uniforms.uChroma = config.chroma;
        this.uniforms.uScanline = config.scanline;
        this.uniforms.uNoise = config.noise;
        
        this.uniforms.uSaturation = config.saturation;
        this.uniforms.uContrast = config.contrast;
        this.uniforms.uBrightness = config.brightness;
    };

    //=========================================================================
    // Game_System
    //=========================================================================
    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._superDuperConfig = JSON.parse(JSON.stringify(defaultSettings));
        this._superDuperTarget = JSON.parse(JSON.stringify(defaultSettings)); // Для интерполяции
        this._superDuperFrames = {}; // Отслеживание кадров
        this._superDuperSavedPresets = {}; // Для кастомных пресетов
    };

    //=========================================================================
    // Scene_Base (Возвращено поверх всего, включая UI)
    //=========================================================================
    var _Scene_Base_start = Scene_Base.prototype.start;
    Scene_Base.prototype.start = function() {
        _Scene_Base_start.call(this);
        this._superDuperFilter = new SuperDuperFilter();
    };

    var _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function() {
        _Scene_Base_update.call(this);
        this.updateSuperDuperFilter();
    };

    Scene_Base.prototype.updateSuperDuperFilter = function() {
        if (!this._superDuperFilter) return;

        // Pixi v8 (Agonia runtime): the CRT filter's fragment shader and the
        // legacy Filter.apply(input, output) contract are Pixi-4 era. On v8
        // the filter renders the whole scene black (scene tree healthy,
        // direct-stage sprites still visible). Skip the effect until the
        // shader is ported; every other feature of the plugin keeps working.
        if (typeof PIXI !== "undefined" && PIXI.TextureSource) {
            if (this.filters && this.filters.indexOf(this._superDuperFilter) !== -1) {
                var newFilters = this.filters.slice();
                newFilters.splice(newFilters.indexOf(this._superDuperFilter), 1);
                this.filters = newFilters.length > 0 ? newFilters : null;
                this.filterArea = null;
            }
            return;
        }

        var config = getSuperDuperConfig();
        
        // БЕЗОПАСНАЯ ПРОВЕРКА: $gameSystem может не существовать на экране заставок
        var targets = $gameSystem ? $gameSystem._superDuperTarget : null;
        var frames = $gameSystem ? $gameSystem._superDuperFrames : null;

        // Плавная интерполяция значений
        if (config && targets && frames) {
            for (var key in frames) {
                if (frames[key] > 0) {
                    var diff = targets[key] - config[key];
                    config[key] += diff / frames[key];
                    frames[key]--;
                    if (frames[key] <= 0) {
                        config[key] = targets[key];
                    }
                }
            }
        }

        if (config.active) {
            var currentFilters = this.filters || [];
            if (currentFilters.indexOf(this._superDuperFilter) === -1) {
                var newFilters = currentFilters.slice();
                newFilters.push(this._superDuperFilter);
                this.filters = newFilters;
            }
            
            var sw = Graphics.boxWidth || config.screenWidth;
            var sh = Graphics.boxHeight || config.screenHeight;
            
            // Оптимизация Garbage Collector'а (не создаем Rectangle каждый кадр)
            if (!this.filterArea) {
                this.filterArea = new Rectangle(0, 0, sw, sh);
            } else {
                this.filterArea.width = sw;
                this.filterArea.height = sh;
            }
            
            this._superDuperFilter.updateTime();
            this._superDuperFilter.updateUniforms(config);
        } else {
            if (this.filters) {
                var index = this.filters.indexOf(this._superDuperFilter);
                if (index !== -1) {
                    var newFilters = this.filters.slice();
                    newFilters.splice(index, 1);
                    this.filters = newFilters.length > 0 ? newFilters : null;
                }
                
                if (!this.filters) {
                    this.filterArea = null;
                }
            }
        }
    };

    //=========================================================================
    // Game_Interpreter
    //=========================================================================
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        
        if (command.toUpperCase() === 'SUPERDUPER') {
            var action = args[0] ? args[0].toUpperCase() : '';
            
            if (action === 'ON') {
                $gameSystem._superDuperConfig.active = true;
            } 
            else if (action === 'OFF') {
                $gameSystem._superDuperConfig.active = false;
            }
            else if (action === 'SAVE_PRESET' && args[1]) {
                var pName = args[1].toLowerCase();
                var currentConfig = Object.assign({}, $gameSystem._superDuperConfig);
                
                // Удаляем системные параметры из сохраняемого пресета
                delete currentConfig.active;
                delete currentConfig.screenWidth;
                delete currentConfig.screenHeight;
                
                $gameSystem._superDuperSavedPresets[pName] = currentConfig;
            }
            else if (action === 'PRESET' && args[1]) {
                var pName = args[1].toLowerCase();
                var duration = Number(args[2]) || 0;
                
                // Ищем сначала в сохраненных в процессе игры, потом в редакторе
                var targetPreset = $gameSystem._superDuperSavedPresets[pName] || parsedPresets[pName];
                
                if (targetPreset) {
                    for (var key in targetPreset) {
                        if (targetPreset.hasOwnProperty(key) && $gameSystem._superDuperConfig.hasOwnProperty(key)) {
                            if (duration > 0) {
                                $gameSystem._superDuperTarget[key] = targetPreset[key];
                                $gameSystem._superDuperFrames[key] = duration;
                            } else {
                                $gameSystem._superDuperConfig[key] = targetPreset[key];
                                $gameSystem._superDuperTarget[key] = targetPreset[key];
                                $gameSystem._superDuperFrames[key] = 0;
                            }
                        }
                    }
                }
            }
            else if (action === 'SET' && args[1] && args[2]) {
                var param = args[1].toLowerCase();
                var value = Number(args[2]);
                var duration = Number(args[3]) || 0; // Время фейда в кадрах
                
                if (!isNaN(value) && $gameSystem._superDuperConfig.hasOwnProperty(param)) {
                    if (duration > 0) {
                        $gameSystem._superDuperTarget[param] = value;
                        $gameSystem._superDuperFrames[param] = duration;
                    } else {
                        // Моментальное применение
                        $gameSystem._superDuperConfig[param] = value;
                        $gameSystem._superDuperTarget[param] = value;
                        $gameSystem._superDuperFrames[param] = 0;
                    }
                }
            }
        }
    };

})();