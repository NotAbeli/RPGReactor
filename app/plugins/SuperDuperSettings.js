//=============================================================================
// SuperDuperSettings.js
//=============================================================================
/*:
 * @target MV MZ
 * @plugindesc Декоративный экран настроек (фон + анимация).
 * @author Korolev
 *
 * @param --- SuperDuperCore ---
 * @default
 *
 * @note
 * Все координаты могут быть пустыми — берутся как % от SuperDuperCore.
 *
 * @param --- Основные ---
 * @default
 *
 * @param Enable Editor
 * @parent --- Основные ---
 * @desc Включить режим визуального редактора? (Работает только в режиме Playtest).
 * @type boolean
 * @on Включен
 * @off Выключен
 * @default true
 *
 * @param Background Image
 * @parent --- Основные ---
 * @desc Фоновое изображение.
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Fade Speed
 * @parent --- Основные ---
 * @desc Скорость появления/затухания (в кадрах).
 * @type number
 * @default 60
 *
 * @param --- Анимация (Гитарист) ---
 * @default
 *
 * @param Anim Image
 * @parent --- Анимация (Гитарист) ---
 * @desc Картинка раскадровки (спрайт-лист).
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Anim X
 * @parent --- Анимация (Гитарист) ---
 * @desc Позиция X
 * @type number
 * @default 400
 *
 * @param Anim Y
 * @parent --- Анимация (Гитарист) ---
 * @desc Позиция Y
 * @type number
 * @default 300
 *
 * @param Frame Width
 * @parent --- Анимация (Гитарист) ---
 * @desc Ширина одного кадра
 * @type number
 * @default 48
 *
 * @param Frame Height
 * @parent --- Анимация (Гитарист) ---
 * @desc Высота одного кадра
 * @type number
 * @default 48
 *
 * @param Total Frames
 * @parent --- Анимация (Гитарист) ---
 * @desc Общее количество кадров (по вертикали)
 * @type number
 * @default 18
 *
 * @param Anim Speed
 * @parent --- Анимация (Гитарист) ---
 * @desc Скорость анимации (задержка в тиках между кадрами. Меньше = быстрее)
 * @type number
 * @default 5
 *
 * @param Anim Scale
 * @parent --- Анимация (Гитарист) ---
 * @desc Масштаб анимации (1.0 = 100%, 2.0 = 200%)
 * @type number
 * @decimals 2
 * @default 1.00
 *
 * @help
 * ============================================================================
 * SUPER DUPER SETTINGS
 * ============================================================================
 * Декоративный экран (фон + анимация).
 * Разрешение настраивается в Plugin Manager → SuperDuperCore.
 * ============================================================================
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('SuperDuperSettings');

    var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
    var scrW = core ? core.screen.width : 1280;
    var scrH = core ? core.screen.height : 720;
    function pctX(p) { return Math.round(scrW * p / 100); }
    function pctY(p) { return Math.round(scrH * p / 100); }

    var pEnableEditor = String(parameters['Enable Editor'] || 'true') === 'true';
    var pBgImage = String(parameters['Background Image'] || '');
    var pFadeSpeed = Number(parameters['Fade Speed'] || 60);

    var cfgAnim = {
        img: String(parameters['Anim Image'] || ''),
        x: parameters['Anim X'] ? Number(parameters['Anim X']) : pctX(49),
        y: parameters['Anim Y'] ? Number(parameters['Anim Y']) : pctY(51),
        w: Number(parameters['Frame Width'] || 48),
        h: Number(parameters['Frame Height'] || 48),
        frames: Number(parameters['Total Frames'] || 18),
        speed: Number(parameters['Anim Speed'] || 5),
        scale: Number(parameters['Anim Scale'] || 1.00)
    };

    // ======================================================================
    // ======================================================================
    // SPRITE_SETTINGS_ANIM
    // ======================================================================
    function Sprite_SettingsAnim() {
        this.initialize.apply(this, arguments);
    }

    Sprite_SettingsAnim.prototype = Object.create(Sprite.prototype);
    Sprite_SettingsAnim.prototype.constructor = Sprite_SettingsAnim;

    Sprite_SettingsAnim.prototype.initialize = function(config) {
        Sprite.prototype.initialize.call(this);
        this._config = config;
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.x = config.x;
        this.y = config.y;
        this.scale.x = config.scale;
        this.scale.y = config.scale;
        this._tick = 0;
        this._currentFrame = 0;
        this._frameInitialized = false;
        if (config.img) {
            this.bitmap = ImageManager.loadPicture(config.img);
        } else {
            this.bitmap = new Bitmap(config.w, config.h);
            this.bitmap.fillAll('rgba(255, 0, 0, 0.5)');
        }
    };

    Sprite_SettingsAnim.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (!this.bitmap || !this.bitmap.isReady()) return;
        if (!this._frameInitialized) {
            this.setFrame(0, 0, this._config.w, this._config.h);
            this._frameInitialized = true;
        }
        this._tick++;
        if (this._tick >= this._config.speed) {
            this._tick = 0;
            this._currentFrame = (this._currentFrame + 1) % this._config.frames;
            this.setFrame(this._currentFrame * this._config.w, 0, this._config.w, this._config.h);
        }
    };

    // ======================================================================
    // SCENE_SUPERDUPERSETTINGS
    // ======================================================================
    function Scene_SuperDuperSettings() {
        this.initialize.apply(this, arguments);
    }

    Scene_SuperDuperSettings.prototype = Object.create(Scene_Base.prototype);
    Scene_SuperDuperSettings.prototype.constructor = Scene_SuperDuperSettings;

    Scene_SuperDuperSettings.prototype.initialize = function() {
        Scene_Base.prototype.initialize.call(this);
    };

    Scene_SuperDuperSettings.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        this.createBackground();
        this.createAnimSprite();
    };

    Scene_SuperDuperSettings.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        this.startFadeIn(pFadeSpeed, false);
    };

    Scene_SuperDuperSettings.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        if (Input.isTriggered('cancel') || Input.isTriggered('ok')) {
            this.popScene();
        }
    };

    Scene_SuperDuperSettings.prototype.createBackground = function() {
        var bg = new Sprite();
        if (pBgImage) {
            bg.bitmap = ImageManager.loadPicture(pBgImage);
        } else {
            bg.bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
            bg.bitmap.fillAll('black');
        }
        this._bgSprite = bg;
        this.addChild(bg);
    };

    Scene_SuperDuperSettings.prototype.createAnimSprite = function() {
        this._animSprite = new Sprite_SettingsAnim(cfgAnim);
        this.addChild(this._animSprite);
    };

})();
