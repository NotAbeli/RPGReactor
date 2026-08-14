/*:
 * @plugindesc (v4.4) SuperDuperHints. Подсказки с плавной физикой и Кинематографичные Титры (HUD Maker Layer Sync).
 * @author Korolev
 *
 * @param hintSettings
 * @text === ПОДСКАЗКИ ===
 * @default 
 *
 * @param Presets
 * @parent hintSettings
 * @text Список Пресетов (Подсказки)
 * @desc Настройте стили подсказок здесь.
 * @type struct<PresetConfig>[]
 * @default []
 *
 * @param Default Animation Speed
 * @parent hintSettings
 * @text Скорость анимации
 * @desc Скорость появления/исчезновения (0.01 - 1.0). Рекомендуется 0.20 - 0.25 для резкости.
 * @type number
 * @decimals 2
 * @default 0.22
 *
 * @param Drop Distance
 * @parent hintSettings
 * @text Дистанция падения
 * @desc Откуда падает текст (пиксели). Увеличено для эффекта разгона.
 * @type number
 * @default 60
 *
 * @param Hint Z-Index
 * @parent hintSettings
 * @text Z-Index Подсказок
 * @desc Слой глубины (z-index). Чем больше, тем выше. (По умолчанию 140)
 * @type number
 * @default 140
 *
 * @param titleSettings
 * @text === ТИТРЫ (CONTROL STYLE) ===
 * @default 
 *
 * @param Title Presets
 * @parent titleSettings
 * @text Пресеты Титров
 * @desc Настройте стили для огромных надписей на экране.
 * @type struct<TitlePreset>[]
 * @default []
 *
 * @param Title Z-Index
 * @parent titleSettings
 * @text Z-Index Титров
 * @desc Слой глубины (z-index). Чем больше, тем выше. (По умолчанию 150)
 * @type number
 * @default 150
 *
 * @help
 * ============================================================================
 * SuperDuperHints v4.4
 * Автор: Korolev
 * ============================================================================
 * * Мощный гибридный плагин, объединяющий динамичные подсказки (с физикой резинки)
 * и кинематографичные титры в стиле игры Control.
 *
 * ============================================================================
 * КОМАНДЫ ДЛЯ ПОДСКАЗОК (HINTS):
 * ============================================================================
 * 1. ПОКАЗАТЬ ПО ПРЕСЕТУ:
 * Hint show_preset [PresetName] [Text...]
 *
 * 2. ПОКАЗАТЬ ПО ПРЕСЕТУ (С подменой иконки):
 * Hint show_preset_icon [PresetName] [IconID] [Text...]
 *
 * 3. СКРЫТЬ (Вручную):
 * Hint hide
 *
 * ============================================================================
 * КОМАНДЫ ДЛЯ ТИТРОВ (TITLES):
 * ============================================================================
 * 1. ПОКАЗАТЬ ТИТР ПО ПРЕСЕТУ:
 * Title show [PresetName] [Ваш Текст]
 * Пример: Title show Boss1 ДИРЕКТОР ПРИБЫЛ
 *
 * 2. МГНОВЕННО СКРЫТЬ ТЕКУЩИЙ ТИТР:
 * Title clear
 */

/*~struct~PresetConfig:
 * @param Name
 * @text Имя пресета (ID)
 * @type string
 * @default default
 *
 * @param Icon Index
 * @text ID Иконки (Default)
 * @type number
 * @default 0
 *
 * @param Font Size
 * @text Размер шрифта
 * @type number
 * @default 24
 *
 * @param Icon Size
 * @text Размер иконки
 * @type number
 * @default 32
 *
 * @param Centered
 * @text По центру экрана?
 * @type boolean
 * @default true
 *
 * @param X
 * @text Координата X
 * @type number
 * @default 0
 *
 * @param Y
 * @text Координата Y
 * @type number
 * @default 100
 *
 * @param Duration
 * @text Время показа (Таймер)
 * @desc В кадрах (60 кадров ~ 1 сек).
 * @type number
 * @default 180
 *
 * @param Hide on Transfer
 * @text Скрывать при переходе?
 * @desc Если true, подсказка исчезнет МГНОВЕННО при смене карты.
 * @type boolean
 * @default true
 *
 * @param SE Name
 * @text Звук (SE)
 * @desc Имя файла звука при появлении.
 * @type file
 * @dir audio/se
 *
 * @param SE Volume
 * @text Громкость звука
 * @type number
 * @default 90
 *
 * @param SE Pitch
 * @text Тон звука
 * @type number
 * @default 100
 */

/*~struct~TitlePreset:
 * @param Name
 * @text Имя пресета (ID)
 * @type string
 * @default Title1
 *
 * @param Font Size
 * @text Размер шрифта
 * @type number
 * @default 72
 *
 * @param Outline Width
 * @text Толщина обводки
 * @desc Настройте толщину тени/обводки текста (по умолчанию 8).
 * @type number
 * @default 8
 *
 * @param Centered X
 * @text По центру X?
 * @type boolean
 * @default true
 *
 * @param Centered Y
 * @text По центру Y?
 * @type boolean
 * @default true
 *
 * @param X Offset
 * @text Смещение по X (если не по центру)
 * @type number
 * @default 0
 *
 * @param Y Offset
 * @text Смещение по Y (если не по центру)
 * @type number
 * @default 0
 *
 * @param Appear Type
 * @text Тип появления
 * @type select
 * @option Fade (Плавное проявление всего текста)
 * @value Fade
 * @option Typewriter (По буквам)
 * @value Typewriter
 * @default Fade
 *
 * @param Typewriter Center
 * @text Выравнивание Typewriter
 * @desc Static: Буквы на своих финальных местах. Dynamic: Текст сдвигается из центра.
 * @type select
 * @option Static (Буквы на своих местах)
 * @value Static
 * @option Dynamic (Всегда по центру)
 * @value Dynamic
 * @default Static
 *
 * @param Disappear Type
 * @text Тип исчезновения
 * @type select
 * @option Fade (Плавное растворение)
 * @value Fade
 * @option Typewriter (Стирание по буквам)
 * @value Typewriter
 * @default Fade
 *
 * @param Typewriter Delay
 * @text Задержка печати/стирания (кадры)
 * @desc Между буквами.
 * @type number
 * @default 5
 *
 * @param Fade In Time
 * @text Время проявления (кадры)
 * @desc Сколько кадров надпись выходит из прозрачности
 * @type number
 * @default 60
 *
 * @param Hold Time
 * @text Время на экране (кадры)
 * @desc Сколько кадров надпись висит полностью видимой
 * @type number
 * @default 120
 *
 * @param Fade Out Time
 * @text Время исчезновения (кадры)
 * @desc Сколько кадров надпись растворяется во тьме (для Fade).
 * @type number
 * @default 60
 *
 * @param Appear SE Name
 * @text Звук появления
 * @desc Проигрывается 1 раз при старте титра.
 * @type file
 * @dir audio/se
 *
 * @param Appear SE Volume
 * @text Громкость появления
 * @type number
 * @default 90
 *
 * @param Appear SE Pitch
 * @text Тон появления
 * @type number
 * @default 100
 *
 * @param Type SE Name
 * @text Звук печати/стирания букв
 * @desc Проигрывается при каждой новой/удаленной букве.
 * @type file
 * @dir audio/se
 *
 * @param Type SE Volume
 * @text Громкость печати
 * @type number
 * @default 90
 *
 * @param Type SE Pitch
 * @text Тон печати
 * @type number
 * @default 100
 */

(function() {
    var parameters = PluginManager.parameters('SuperDuperHints');
    if (!parameters || Object.keys(parameters).length === 0) {
        parameters = PluginManager.parameters('SimpleCustomHints');
    }
    
    var animSpeed = Number(parameters['Default Animation Speed'] || 0.22);
    var dropDist = Number(parameters['Drop Distance'] || 60);
    var hintZIndex = Number(parameters['Hint Z-Index'] || 140);
    var titleZIndex = Number(parameters['Title Z-Index'] || 150);
    
    var overshootOffset = 8;
    var bounceOffset = 4;

    // --- Парсинг Пресетов Подсказок ---
    var presets = {};
    try {
        var rawPresets = JSON.parse(parameters['Presets'] || '[]');
        for (var i = 0; i < rawPresets.length; i++) {
            var p = JSON.parse(rawPresets[i]);
            presets[p.Name] = {
                iconIndex: Number(p['Icon Index']),
                fontSize: Number(p['Font Size']),
                iconSize: Number(p['Icon Size']),
                centered: String(p['Centered']) === 'true',
                x: Number(p['X']),
                y: Number(p['Y']),
                duration: Number(p['Duration']),
                hideOnTransfer: String(p['Hide on Transfer']) === 'true',
                se: {
                    name: p['SE Name'] || '',
                    volume: Number(p['SE Volume'] || 90),
                    pitch: Number(p['SE Pitch'] || 100),
                    pan: 0
                }
            };
        }
    } catch (e) {
        console.error("SuperDuperHints: Ошибка при чтении пресетов подсказок!", e);
    }

    // --- Парсинг Пресетов Титров ---
    var titlePresets = {};
    try {
        var rawTitlePresets = JSON.parse(parameters['Title Presets'] || '[]');
        for (var j = 0; j < rawTitlePresets.length; j++) {
            var tp = JSON.parse(rawTitlePresets[j]);
            titlePresets[tp.Name] = {
                fontSize: Number(tp['Font Size'] || 72),
                outlineWidth: Number(tp['Outline Width'] || 8),
                centeredX: String(tp['Centered X']) === 'true',
                centeredY: String(tp['Centered Y']) === 'true',
                x: Number(tp['X Offset'] || 0),
                y: Number(tp['Y Offset'] || 0),
                appearType: String(tp['Appear Type'] || 'Fade'),
                disappearType: String(tp['Disappear Type'] || 'Fade'),
                typeCenter: String(tp['Typewriter Center'] || 'Static'),
                fadeIn: Number(tp['Fade In Time'] || 60),
                hold: Number(tp['Hold Time'] || 120),
                fadeOut: Number(tp['Fade Out Time'] || 60),
                typeDelay: Number(tp['Typewriter Delay'] || 5),
                appearSe: {
                    name: tp['Appear SE Name'] || '',
                    volume: Number(tp['Appear SE Volume'] || 90),
                    pitch: Number(tp['Appear SE Pitch'] || 100),
                    pan: 0
                },
                typeSe: {
                    name: tp['Type SE Name'] || '',
                    volume: Number(tp['Type SE Volume'] || 90),
                    pitch: Number(tp['Type SE Pitch'] || 100),
                    pan: 0
                }
            };
        }
    } catch(e) {
        console.error("SuperDuperHints: Ошибка при чтении пресетов титров!", e);
    }

    // ======================================================================
    // Game_Screen (Ядро данных)
    // ======================================================================
    
    var _Game_Screen_initialize = Game_Screen.prototype.initialize;
    Game_Screen.prototype.initialize = function() {
        _Game_Screen_initialize.call(this);
        this.clearCustomHintInstant();
        this.clearCustomTitleInstant();
    };

    Game_Screen.prototype.checkSdmInit = function() {
        if (!this._customHint) this.clearCustomHintInstant();
        if (!this._customTitle) this.clearCustomTitleInstant();
    };

    // --- Логика Подсказок ---
    Game_Screen.prototype.clearCustomHintInstant = function() {
        this._customHint = {
            visible: false,
            phase: 'idle',
            text: "",
            iconIndex: 0,
            x: 0,
            y: 0,
            centered: false,
            fontSize: 24,
            iconSize: 32,
            opacity: 0,
            currentY: 0,
            timer: 0,
            hideOnTransfer: false
        };
    };

    Game_Screen.prototype.showCustomHintRaw = function(data) {
        this.checkSdmInit();
        var h = this._customHint;

        if (h.visible && h.text === data.text && h.phase !== 'hiding') {
            h.timer = data.duration || 0; 
            return; 
        }

        h.text = data.text;
        h.iconIndex = data.iconIndex;
        h.x = data.x;
        h.y = data.y;
        h.centered = data.centered;
        h.fontSize = data.fontSize;
        h.iconSize = data.iconSize;
        h.timer = data.duration || 0;
        h.hideOnTransfer = data.hideOnTransfer;

        h.opacity = 0;
        h.currentY = h.y - dropDist;
        h.phase = 'appearing';
        h.visible = true;

        if (data.se && data.se.name) {
            AudioManager.playSe(data.se);
        }
    };

    Game_Screen.prototype.hideCustomHint = function() {
        this.checkSdmInit();
        if (this._customHint.visible && this._customHint.phase !== 'idle' && this._customHint.phase !== 'hiding') {
            this._customHint.phase = 'hiding';
        }
    };

    Game_Screen.prototype.updateCustomHint = function() {
        this.checkSdmInit();
        var h = this._customHint;
        if (!h.visible || h.phase === 'idle') return;

        if (h.phase === 'showing' && h.timer > 0) {
            h.timer--;
            if (h.timer <= 0) {
                this.hideCustomHint();
            }
        }
    };

    // --- Логика Кинематографичных Титров ---
    Game_Screen.prototype.clearCustomTitleInstant = function() {
        this._customTitle = { active: false };
    };

    Game_Screen.prototype.showCustomTitle = function(presetName, text) {
        this.checkSdmInit();
        var preset = titlePresets[presetName];
        if (!preset) {
            console.warn("SuperDuperHints: Пресет титров не найден - " + presetName);
            return;
        }
        this._customTitle = {
            active: true,
            preset: preset,
            text: text,
            phase: 'in', 
            timer: preset.fadeIn,
            opacity: 0,
            typeIndex: preset.appearType === 'Typewriter' ? 0 : text.length,
            typeTimer: 0
        };

        if (preset.appearSe && preset.appearSe.name) {
            AudioManager.playSe(preset.appearSe);
        }

        if (preset.fadeIn <= 0) {
            this._customTitle.opacity = 255;
            this._customTitle.phase = preset.hold > 0 ? 'hold' : 'out';
            this._customTitle.timer = preset.hold;
        }
    };

    Game_Screen.prototype.updateCustomTitle = function() {
        this.checkSdmInit();
        var t = this._customTitle;
        if (!t || !t.active) return;

        var p = t.preset;

        if (p.appearType === 'Typewriter' && t.phase !== 'out' && t.typeIndex < t.text.length) {
            t.typeTimer++;
            if (t.typeTimer >= p.typeDelay) {
                t.typeTimer = 0;
                t.typeIndex++;
                if (p.typeSe && p.typeSe.name) {
                    var currentChar = t.text.charAt(t.typeIndex - 1);
                    if (currentChar && currentChar.trim() !== '') {
                        AudioManager.playSe(p.typeSe);
                    }
                }
            }
        }

        if (t.phase === 'in') {
            t.timer--;
            t.opacity = 255 * (1 - (t.timer / Math.max(p.fadeIn, 1)));
            if (t.timer <= 0) {
                t.opacity = 255;
                t.phase = 'hold';
                t.timer = p.hold;
            }
        } else if (t.phase === 'hold') {
            t.timer--;
            if (t.timer <= 0) {
                t.phase = 'out';
                t.timer = p.fadeOut;
            }
        } else if (t.phase === 'out') {
            if (p.disappearType === 'Typewriter') {
                t.typeTimer++;
                if (t.typeTimer >= p.typeDelay) {
                    t.typeTimer = 0;
                    t.typeIndex--;
                    if (p.typeSe && p.typeSe.name && t.typeIndex >= 0) {
                        var erasedChar = t.text.charAt(t.typeIndex);
                        if (erasedChar && erasedChar.trim() !== '') {
                            AudioManager.playSe(p.typeSe);
                        }
                    }
                }
                if (t.typeIndex <= 0) {
                    t.opacity = 0;
                    t.active = false;
                }
            } else {
                t.timer--;
                t.opacity = 255 * (t.timer / Math.max(p.fadeOut, 1));
                if (t.timer <= 0) {
                    t.opacity = 0;
                    t.active = false;
                }
            }
        }
    };

    var _Game_Screen_update = Game_Screen.prototype.update;
    Game_Screen.prototype.update = function() {
        _Game_Screen_update.call(this);
        this.updateCustomHint();
        this.updateCustomTitle();
    };

    // ======================================================================
    // Очистка при переходе (только для подсказок, титры остаются поверх)
    // ======================================================================

    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        if ($gameScreen._customHint && $gameScreen._customHint.visible) {
            if ($gameScreen._customHint.hideOnTransfer) {
                $gameScreen.clearCustomHintInstant();
            }
        }
    };

    // ======================================================================
    // Sprite_CustomHint (Графика подсказок)
    // ======================================================================

    function Sprite_CustomHint() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CustomHint.prototype = Object.create(Sprite.prototype);
    Sprite_CustomHint.prototype.constructor = Sprite_CustomHint;

    Sprite_CustomHint.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(Graphics.boxWidth, 200);
        this.anchor.x = 0; 
        this.anchor.y = 0;
        this.z = hintZIndex; 
        this.zIndex = hintZIndex;
    };

    Sprite_CustomHint.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (!$gameScreen) return;
        var data = $gameScreen._customHint;

        if (!data || (!data.visible && data.phase === 'idle')) {
            this.visible = false;
            this.opacity = 0;
            return;
        }

        this.visible = true;

        if (data.phase === 'appearing' && data.opacity === 0) {
            this.refresh(data);
        }

        this.updateAnimation(data);
    };

    Sprite_CustomHint.prototype.refresh = function(data) {
        this.bitmap.clear();
        this.bitmap.fontSize = data.fontSize;
        
        var textPadding = 10;
        var iconWidth = (data.iconIndex > 0) ? data.iconSize + textPadding : 0;
        var textWidth = this.bitmap.measureTextWidth(data.text);
        
        var totalWidth = iconWidth + textWidth + 20;
        var totalHeight = Math.max(data.fontSize, data.iconSize);

        var iconY = (totalHeight - data.iconSize) / 2;
        var textY = (totalHeight - data.fontSize) / 2;
        
        if (data.iconIndex > 0) {
            this.drawCustomIcon(data.iconIndex, 0, iconY, data.iconSize);
        }

        this.bitmap.drawText(data.text, iconWidth, textY, textWidth + 20, data.fontSize, 'left');

        if (data.centered) {
            this.x = (Graphics.boxWidth - totalWidth) / 2;
        } else {
            this.x = data.x;
        }
    };

    Sprite_CustomHint.prototype.drawCustomIcon = function(iconIndex, x, y, size) {
        var bitmap = ImageManager.loadSystem('IconSet');
        var pw = Window_Base._iconWidth;
        var ph = Window_Base._iconHeight;
        var sx = iconIndex % 16 * pw;
        var sy = Math.floor(iconIndex / 16) * ph;
        this.bitmap.blt(bitmap, sx, sy, pw, ph, x, y, size, size);
    };

    Sprite_CustomHint.prototype.updateAnimation = function(data) {
        var lerp = function(start, end, speed) {
            // Защита от переполнения физики, если animSpeed выкручен в космос
            speed = Math.max(0.01, Math.min(speed, 0.95)); 
            return start + (end - start) * speed;
        };

        // Независимое появление/исчезновение прозрачности
        if (data.phase === 'hiding') {
            data.opacity = lerp(data.opacity, 0, animSpeed * 0.8);
            if (data.opacity <= 2) {
                $gameScreen.clearCustomHintInstant();
            }
        } else {
            data.opacity = lerp(data.opacity, 255, animSpeed * 1.5);
        }

        // Плавная физика позиционирования
        if (data.phase === 'appearing') {
            var targetY = data.y + overshootOffset;
            data.currentY = lerp(data.currentY, targetY, animSpeed * 1.8);
            
            // Больше не ждем прозрачности, мгновенно переходим к отскоку
            if (Math.abs(data.currentY - targetY) < 1.0) {
                data.phase = 'bouncing'; 
            }
        } else if (data.phase === 'bouncing') {
            var targetY = data.y - bounceOffset;
            data.currentY = lerp(data.currentY, targetY, animSpeed * 1.4);
            
            if (Math.abs(data.currentY - targetY) < 1.0) {
                data.phase = 'settling';
            }
        } else if (data.phase === 'settling') {
            data.currentY = lerp(data.currentY, data.y, animSpeed * 1.2); 
            if (Math.abs(data.currentY - data.y) < 0.5) {
                data.currentY = data.y;
                data.phase = 'showing';
            }
        } else if (data.phase === 'hiding') {
            // Кинематографичный уход чуть вверх при скрытии
            data.currentY = lerp(data.currentY, data.y - 15, animSpeed * 0.6);
        }

        this.y = data.currentY;
        this.opacity = data.opacity;
    };

    // ======================================================================
    // Sprite_CustomTitle (Графика Титров)
    // ======================================================================

    function Sprite_CustomTitle() {
        this.initialize.apply(this, arguments);
    }

    Sprite_CustomTitle.prototype = Object.create(Sprite.prototype);
    Sprite_CustomTitle.prototype.constructor = Sprite_CustomTitle;

    Sprite_CustomTitle.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
        this.z = titleZIndex; 
        this.zIndex = titleZIndex;
        this._lastText = "";
        this._lastIndex = -1;
    };

    Sprite_CustomTitle.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (!$gameScreen) return;
        var t = $gameScreen._customTitle;
        
        if (!t || !t.active) {
            this.opacity = 0;
            this._lastText = "";
            return;
        }

        this.opacity = t.opacity;
        var currentText = t.text.substring(0, t.typeIndex);

        if (this._lastText !== currentText || this._lastIndex !== t.typeIndex) {
            this._lastText = currentText;
            this._lastIndex = t.typeIndex;
            this.refresh(t.preset, currentText, t.text);
        }
    };

    Sprite_CustomTitle.prototype.refresh = function(preset, text, fullText) {
        this.bitmap.clear();
        this.bitmap.fontSize = preset.fontSize;
        this.bitmap.outlineWidth = preset.outlineWidth; 
        this.bitmap.outlineColor = 'rgba(0, 0, 0, 0.8)'; 

        var x = preset.x;
        var y = preset.centeredY ? (Graphics.boxHeight - preset.fontSize) / 2 : preset.y;
        var align = 'left';
        var width = Graphics.boxWidth;

        if (preset.centeredX) {
            if (preset.appearType === 'Typewriter' && preset.typeCenter === 'Static') {
                var fullWidth = this.bitmap.measureTextWidth(fullText);
                x = (Graphics.boxWidth - fullWidth) / 2;
                align = 'left';
                width = fullWidth;
            } else {
                x = 0;
                align = 'center';
                width = Graphics.boxWidth;
            }
        } else {
            x = preset.x;
            align = 'left';
            width = Graphics.boxWidth - x;
        }

        this.bitmap.drawText(text, x, y, width, preset.fontSize, align);
    };

    // ======================================================================
    // Интеграция спрайтов в сцены (По логике SRD_HUDMaker)
    // ======================================================================

    var _Scene_Map_createMapNameWindow = Scene_Map.prototype.createMapNameWindow;
    Scene_Map.prototype.createMapNameWindow = function() {
        _Scene_Map_createMapNameWindow.call(this);
        this._customHintSprite = new Sprite_CustomHint();
        this._customTitleSprite = new Sprite_CustomTitle();
        this.addChild(this._customHintSprite);
        this.addChild(this._customTitleSprite);
    };

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (this._fadeSprite) {
            this.removeChild(this._fadeSprite);
            this.addChild(this._fadeSprite);
        }
    };

    var _Scene_Battle_createSpriteset = Scene_Battle.prototype.createSpriteset;
    Scene_Battle.prototype.createSpriteset = function() {
        _Scene_Battle_createSpriteset.call(this);
        this._customHintSprite = new Sprite_CustomHint();
        this._customTitleSprite = new Sprite_CustomTitle();
        this.addChild(this._customHintSprite);
        this.addChild(this._customTitleSprite);
    };

    var _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function() {
        _Scene_Battle_start.call(this);
        if (this._fadeSprite) {
            this.removeChild(this._fadeSprite);
            this.addChild(this._fadeSprite);
        }
    };

    // ======================================================================
    // Обработка Плагин-команд
    // ======================================================================

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        
        var cmd = (command || '').toLowerCase();
        
        if (cmd === 'hint') {
            var action = args[0] ? args[0].toLowerCase() : '';
            
            if (action === 'hide') {
                $gameScreen.hideCustomHint();
                return;
            }

            if (action === 'show') {
                var iconId = parseInt(args[1]);
                var x = parseInt(args[2]);
                var y = parseInt(args[3]);
                var centered = (String(args[4]).toLowerCase() === 'true');
                var fSize = parseInt(args[5]);
                var iSize = parseInt(args[6]);
                var text = "";
                for (var i = 7; i < args.length; i++) {
                    text += args[i] + (i < args.length - 1 ? " " : "");
                }
                $gameScreen.showCustomHintRaw({
                    iconIndex: iconId, x: x, y: y, centered: centered,
                    fontSize: fSize, iconSize: iSize, text: text,
                    duration: 0, hideOnTransfer: false, se: null
                });
                return;
            }

            if (action === 'show_preset' || action === 'show_preset_icon') {
                var presetName = args[1];
                var preset = presets[presetName];
                
                if (!preset) {
                    console.warn("SuperDuperHints: Пресет подсказки не найден: " + presetName);
                    return;
                }

                var textStartIdx = 2;
                var finalIcon = preset.iconIndex;

                if (action === 'show_preset_icon') {
                    finalIcon = parseInt(args[2]);
                    textStartIdx = 3;
                }

                var text = "";
                for (var i = textStartIdx; i < args.length; i++) {
                    text += args[i] + (i < args.length - 1 ? " " : "");
                }

                var data = {
                    iconIndex: finalIcon,
                    fontSize: preset.fontSize,
                    iconSize: preset.iconSize,
                    centered: preset.centered,
                    x: preset.x,
                    y: preset.y,
                    duration: preset.duration,
                    hideOnTransfer: preset.hideOnTransfer,
                    se: preset.se,
                    text: text
                };

                $gameScreen.showCustomHintRaw(data);
            }
        }

        if (cmd === 'title') {
            var titleAction = args[0] ? args[0].toLowerCase() : '';

            if (titleAction === 'clear') {
                $gameScreen.clearCustomTitleInstant();
                return;
            }

            if (titleAction === 'show') {
                var titlePresetName = args[1];
                var titleText = args.slice(2).join(' ');
                $gameScreen.showCustomTitle(titlePresetName, titleText);
            }
        }
    };
})();