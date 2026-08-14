/*:
 * @plugindesc [v1.3] Super Duper Damage Flash. Мигание урона и наследование графики.
 * @author Korolev
 *
 * @param Default Color
 * @text Цвет по умолчанию
 * @desc Цвет мигания в формате R,G,B,A (Красный, Зеленый, Синий, Прозрачность). Максимум 255.
 * @default 255,0,0,170
 *
 * @param Default Duration
 * @text Длительность по умолчанию
 * @desc Сколько кадров (тиков) длится мигание (60 = 1 секунда).
 * @type number
 * @default 15
 *
 * @param Enemy Variable Base
 * @text База Переменных HP
 * @desc Должно совпадать с Variable Base ID в плагине SuperDuperEnemies (по умолчанию 1000).
 * @type number
 * @default 1000
 *
 * @help
 * ============================================================================
 * Super Duper Damage Flash (v1.3)
 * ============================================================================
 * 1. ЭФФЕКТ УРОНА:
 * Добавляет эффект заливки цветом при получении урона.
 * Автоматически отслеживает HP врагов из SuperDuperEnemies.
 * * 2. НАСЛЕДОВАНИЕ ГРАФИКИ:
 * Если на странице события в "Заметках" (через команду Комментарий) написать:
 * <prev_graphic>
 * То при переходе на эту страницу внешний вид события (спрайт) не изменится.
 * Будет использоваться графика с предыдущей активной страницы.
 *
 * ============================================================================
 * ПЛАГИН-КОМАНДЫ:
 * ============================================================================
 * SDDF FLASH                 - Текущее событие (враг) мигает красным.
 * SDDF FLASH PLAYER          - Игрок мигает стандартным цветом.
 * SDDF FLASH EVENT 5         - Событие с ID 5 мигает.
 * SDDF FLASH 10              - Текущее событие мигает 10 кадров.
 */

(function() {
    'use strict';

    var pluginName = 'SuperDuperDamageFlash';
    var parameters = PluginManager.parameters(pluginName);
    
    var colorStr = parameters['Default Color'] || "255,0,0,170";
    var defaultColor = colorStr.split(',').map(function(n) { return Number(n.trim()); });
    var defaultDuration = Number(parameters['Default Duration'] || 15);
    var enemyVarBase = Number(parameters['Enemy Variable Base'] || 1000);

    // --- СИСТЕМА НАСЛЕДОВАНИЯ ГРАФИКИ ---

    var _Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function() {
        // Сохраняем текущую графику перед обновлением страницы
        var oldName = this._characterName;
        var oldIndex = this._characterIndex;
        
        _Game_Event_setupPage.call(this);

        // Проверяем, есть ли на новой странице тег <prev_graphic>
        if (this.page()) {
            var hasPrevGraphicTag = this.page().list.some(function(cmd) {
                return (cmd.code === 108 || cmd.code === 408) && cmd.parameters[0].trim() === '<prev_graphic>';
            });

            if (hasPrevGraphicTag && oldName !== undefined) {
                // Возвращаем старую графику
                this.setImage(oldName, oldIndex);
            }
        }
    };

    // --- ЯДРО ПЕРСОНАЖЕЙ (FLASH) ---

    var _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        _Game_CharacterBase_initMembers.call(this);
        this._sdDamageFlashTimer = 0;
        this._sdDamageFlashColor = [0, 0, 0, 0];
    };

    var _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function() {
        _Game_CharacterBase_update.call(this);
        if (this._sdDamageFlashTimer > 0) {
            this._sdDamageFlashTimer--;
        }
    };

    Game_CharacterBase.prototype.requestDamageFlash = function(duration, color) {
        this._sdDamageFlashTimer = duration || defaultDuration;
        this._sdDamageFlashColor = color || defaultColor;
    };

    // --- АВТО-ДЕТЕКТ УРОНА ---
    var _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function(variableId, value) {
        var oldValue = this.value(variableId);
        _Game_Variables_setValue.call(this, variableId, value);
        
        if (variableId > enemyVarBase && variableId <= enemyVarBase + 900) {
            if (value < oldValue && oldValue > 0) {
                var eventId = variableId - enemyVarBase;
                if ($gameMap && $gameMap.event(eventId)) {
                    $gameMap.event(eventId).requestDamageFlash();
                }
            }
        }
    };

    // --- ГРАФИЧЕСКОЕ ОТОБРАЖЕНИЕ ---

    var _Sprite_Character_update = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        _Sprite_Character_update.call(this);
        this.updateSdDamageFlash();
    };

    Sprite_Character.prototype.updateSdDamageFlash = function() {
        if (this._character && this._character._sdDamageFlashTimer > 0) {
            this.setBlendColor(this._character._sdDamageFlashColor);
            this._sdIsFlashing = true;
        } else if (this._sdIsFlashing) {
            this.setBlendColor([0, 0, 0, 0]);
            this._sdIsFlashing = false;
        }
    };

    // --- ПЛАГИН-КОМАНДЫ ---

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);

        if (command.toUpperCase() === 'SDDF') {
            var subCommand = args[0] ? args[0].toUpperCase().trim() : '';
            if (subCommand === 'FLASH') {
                var arg1 = args[1] ? args[1].toUpperCase().trim() : '';
                var target = null;
                var duration = defaultDuration;

                if (arg1 === 'PLAYER' || arg1 === 'ACTOR') {
                    target = $gamePlayer;
                    if (args[2]) duration = Number(args[2]);
                } else if (arg1 === 'EVENT') {
                    var evId = Number(args[2]);
                    target = $gameMap.event(evId);
                    if (args[3]) duration = Number(args[3]);
                } else if (arg1 === 'SELF' || arg1 === '') {
                    target = $gameMap.event(this.eventId());
                    if (args[2]) duration = Number(args[2]);
                } else if (!isNaN(Number(arg1))) {
                    target = $gameMap.event(this.eventId());
                    duration = Number(arg1);
                }

                if (target && typeof target.requestDamageFlash === 'function') {
                    target.requestDamageFlash(duration);
                }
            }
        }
    };

})();