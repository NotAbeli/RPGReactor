//=============================================================================
// SuperDuperCore.js
//=============================================================================
/*:
 * @target MV MZ
 * @plugindesc [v2.1.0] Super Duper Core — утилиты + конфигурация.
 * @author Korolev
 * @orderBefore SuperDuperScreen,SuperDuperCamera,SuperDuperSave,SuperDuperInventory,SuperDuperMovement,SuperDuperBattle,SuperDuperEnemies,SuperDuperLight,SuperDuperMessage,SuperDuperChoices,SuperDuperDrop,SuperDuperGameOver,SuperDuperNotification,SuperDuperSettings,SimpleCraftSystem,SimpleCustomHints
 *
 * @help
 * ============================================================================
 * SUPER DUPER CORE v2.1.0
 * ============================================================================
 * Единое ядро для всех SuperDuper плагинов.
 * Должен быть ПЕРВЫМ в списке плагинов.
 *
 * Разрешение экрана задаётся в SRD_GameUpgrade (Game Resolution).
 * Здесь — только синхронизация и утилиты.
 *
 * ============================================================================
 * ПАРАМЕТРЫ
 * ============================================================================
 *
 * @param --- Экран ---
 * @default
 *
 * @param Ширина экрана
 * @parent --- Экран ---
 * @type number
 * @min 1
 * @default 1280
 * @desc Ширина экрана. Должна совпадать с SRD_GameUpgrade.
 *
 * @param Высота экрана
 * @parent --- Экран ---
 * @type number
 * @min 1
 * @default 720
 * @desc Высота экрана. Должна совпадать с SRD_GameUpgrade.
 *
 * @param --- Цвета ---
 * @default
 *
 * @param Color Primary
 * @parent --- Цвета ---
 * @text Основной цвет
 * @desc Основной цвет интерфейса (Hex).
 * @type string
 * @default #ffffff
 *
 * @param Color Accent
 * @parent --- Цвета ---
 * @text Акцентный цвет
 * @desc Цвет выделения (Hex).
 * @type string
 * @default #ffaa00
 *
 * @param Color Background
 * @parent --- Цвета ---
 * @text Цвет фона
 * @desc Цвет фона окон (Hex).
 * @type string
 * @default #000000
 */

var Imported = Imported || {};
Imported.SuperDuperCore = true;

(function () {
    'use strict';

    var params = PluginManager.parameters('SuperDuperCore');

    var pScreenW = Number(params['Ширина экрана']) || 1280;
    var pScreenH = Number(params['Высота экрана']) || 720;

    // ========================================================================
    // 1. ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЁН
    // ========================================================================
    window.SuperDuper = window.SuperDuper || {};

    // ========================================================================
    // 2. ЯДРО
    // ========================================================================
    SuperDuper.Core = {
        screen: {
            width:  pScreenW,
            height: pScreenH
        },

        color: {
            primary:    String(params['Color Primary']    || '#ffffff'),
            accent:     String(params['Color Accent']     || '#ffaa00'),
            background: String(params['Color Background'] || '#000000')
        },

        // --- Утилиты ---
        clamp: function (value, min, max) {
            return Math.max(min, Math.min(max, value));
        },

        lerp: function (a, b, t) {
            return a + (b - a) * t;
        },

        remap: function (value, oldMin, oldMax, newMin, newMax) {
            var t = (value - oldMin) / (oldMax - oldMin);
            return newMin + (newMax - newMin) * t;
        },

        // --- Позиционирование ---
        centerX: function () {
            return this.screen.width / 2;
        },

        centerY: function () {
            return this.screen.height / 2;
        },

        center: function () {
            return { x: this.centerX(), y: this.centerY() };
        },

        pct: function (percentX, percentY) {
            return {
                x: this.screen.width  * percentX / 100,
                y: this.screen.height * percentY / 100
            };
        },

        pctX: function (percentX) {
            return this.screen.width * percentX / 100;
        },

        pctY: function (percentY) {
            return this.screen.height * percentY / 100;
        },

        px: function (pixelX, pixelY) {
            return { x: pixelX, y: pixelY };
        },

        // --- Реестр ---
        registry: {}
    };

    SuperDuper.Core.registry.Core = { version: '2.1.0' };

    // ========================================================================
    // 3. СИНХРОНИЗАЦИЯ С GRAPHICS ПРИ ЗАПУСКЕ
    // ========================================================================
    var _SceneManager_initGraphics = SceneManager.initGraphics;
    SceneManager.initGraphics = function() {
        _SceneManager_initGraphics.call(this);
        SuperDuper.Core.screen.width  = Graphics.width;
        SuperDuper.Core.screen.height = Graphics.height;
    };

})();
