//=============================================================================
// SuperDuperSamsara.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Глобальные переменные и скрытые автосохранения.
 * @author Korolev
 *
 * @command SaveToSamsara
 * @text Сделать скрытое сохранение
 * @desc Сохраняет игру в теневой слот (Самсара), невидимый для игрока.
 *
 * @command LoadFromSamsara
 * @text Загрузить скрытое сохранение
 * @desc Загружает игру из теневого слота (Самсара), если оно существует.
 *
 * @param Global Switches
 * @text Глобальные Переключатели
 * @desc Список ID переключателей, которые будут общими для всех сохранений.
 * @type switch[]
 * @default []
 *
 * @param Global Variables
 * @text Глобальные Переменные
 * @desc Список ID переменных, которые будут общими для всех сохранений.
 * @type variable[]
 * @default []
 *
 * @help
 * ============================================================================
 * SUPER DUPER SAMSARA (Карма и Перерождение)
 * ============================================================================
 * Плагин разделен на две независимые высокодуховные механики:
 *
 * 1. КАРМА (ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ)
 * Укажите в настройках плагина ID нужных вам переменных или переключателей.
 * Любые их изменения будут мгновенно записываться в глобальный файл настроек 
 * игры (config). Их значения будут переноситься из одного сохранения в 
 * другое. Если игрок осмотрел шкаф, умер и загрузил старое сохранение — 
 * игра всё равно будет помнить, что шкаф уже осматривали.
 * Отлично подходит для мета-прогрессии, галерей, достижений и т.д.
 *
 * 2. ЦИКЛ ПЕРЕРОЖДЕНИЯ (СКРЫТЫЙ СЛОТ АВТОСОХРАНЕНИЯ)
 * Плагин резервирует глубоко спрятанный слот №777 под названием "Самсара".
 * Он не отображается ни в стандартных меню, ни в диктофоне.
 *
 * КОМАНДЫ ПЛАГИНА (Для MV используйте команду плагина в событии):
 * SaveToSamsara
 * LoadFromSamsara
 *
 * (Для MZ используйте удобный выпадающий список команд плагина).
 * Вы можете вызывать SaveToSamsara перед боссами или при переходе 
 * на другую локацию.
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('SuperDuperSamsara');

    // Функция для всеядного парсинга массивов (Поддержка и MV, и MZ форматов)
    function parseIdArray(param) {
        if (!param) return [];
        // Если это массив JSON (как делает MZ)
        if (param.startsWith('[')) {
            try {
                var arr = JSON.parse(param);
                return arr.map(function(id) { return Number(id); });
            } catch (e) {
                return [];
            }
        }
        // Если это просто строка через запятую (для MV)
        return param.split(',').map(function(id) { 
            return Number(id.trim()); 
        }).filter(function(id) { 
            return id > 0; 
        });
    }

    var globalSwitches = parseIdArray(parameters['Global Switches']);
    var globalVariables = parseIdArray(parameters['Global Variables']);

    var SAMSARA_SLOT = 777; // Номер теневого слота, чтобы не конфликтовал ни с чем

    // ======================================================================
    // 1. СИСТЕМА КАРМЫ (ИНЪЕКЦИЯ В CONFIG MANAGER)
    // ======================================================================

    // Инициализация хранилищ в менеджере конфигурации
    ConfigManager.samsaraSwitches = {};
    ConfigManager.samsaraVariables = {};

    var _ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function() {
        var config = _ConfigManager_makeData.call(this);
        config.samsaraSwitches = this.samsaraSwitches;
        config.samsaraVariables = this.samsaraVariables;
        return config;
    };

    var _ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        _ConfigManager_applyData.call(this, config);
        this.samsaraSwitches = config.samsaraSwitches || {};
        this.samsaraVariables = config.samsaraVariables || {};
    };

    // Перехват переключателей (Switches)
    var _Game_Switches_value = Game_Switches.prototype.value;
    Game_Switches.prototype.value = function(switchId) {
        if (globalSwitches.includes(switchId)) {
            return !!ConfigManager.samsaraSwitches[switchId];
        }
        return _Game_Switches_value.call(this, switchId);
    };

    var _Game_Switches_setValue = Game_Switches.prototype.setValue;
    Game_Switches.prototype.setValue = function(switchId, value) {
        // Мы все равно вызываем оригинальный метод, чтобы движок правильно обновил карту,
        // события на ней и запустил необходимые триггеры.
        _Game_Switches_setValue.call(this, switchId, value);
        
        // Но если это глобальный переключатель, мы тут же дублируем его в конфиг и сохраняем на диск.
        if (globalSwitches.includes(switchId)) {
            ConfigManager.samsaraSwitches[switchId] = value;
            ConfigManager.save();
        }
    };

    // Перехват переменных (Variables)
    var _Game_Variables_value = Game_Variables.prototype.value;
    Game_Variables.prototype.value = function(variableId) {
        if (globalVariables.includes(variableId)) {
            return ConfigManager.samsaraVariables[variableId] || 0;
        }
        return _Game_Variables_value.call(this, variableId);
    };

    var _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function(variableId, value) {
        // Аналогично: обновляем локальное состояние для триггеров на карте
        _Game_Variables_setValue.call(this, variableId, value);
        
        // И жестко записываем в глобальную карму
        if (globalVariables.includes(variableId)) {
            ConfigManager.samsaraVariables[variableId] = value;
            ConfigManager.save();
        }
    };

    // ======================================================================
    // 2. СИСТЕМА ПЕРЕРОЖДЕНИЯ (ТЕНЕВОЙ СЛОТ 777)
    // ======================================================================

    function saveToSamsara() {
        if ($gameSystem) $gameSystem.onBeforeSave();
        
        // Делаем снимок экрана для теневого слота, если используется диктофон (на всякий случай)
        if (typeof pSnapW !== 'undefined' && typeof pSnapH !== 'undefined' && pSnapW > 0 && pSnapH > 0) {
            var bgBmp = SceneManager.backgroundBitmap();
            if (bgBmp) {
                var snapBmp = new Bitmap(pSnapW, pSnapH);
                snapBmp.blt(bgBmp, 0, 0, bgBmp.width, bgBmp.height, 0, 0, pSnapW, pSnapH);
                if (!$gameTemp) $gameTemp = {};
                $gameTemp._sdsSnapUrl = snapBmp.canvas.toDataURL('image/jpeg', typeof pSnapQ !== 'undefined' ? pSnapQ : 0.7);
            }
        }

        if (DataManager.saveGame(SAMSARA_SLOT)) {
            console.log("SuperDuperSamsara: Shadow save successfully created in slot 777.");
        } else {
            console.warn("SuperDuperSamsara: Shadow save failed.");
        }
        
        // Очищаем временный снимок экрана
        if ($gameTemp && $gameTemp._sdsSnapUrl) {
            $gameTemp._sdsSnapUrl = null;
        }
    }

    function loadFromSamsara() {
        // Проверяем, существует ли этот файл физически
        if (DataManager.isThisGameFile(SAMSARA_SLOT)) {
            AudioManager.stopAll();
            
            var executeGoto = function() {
                if ($gameSystem.onAfterLoad) {
                    $gameSystem.onAfterLoad();
                }
                // Для совместимости с диктофоном даем команду на плавное появление
                SceneManager._sdsNeedsFadeIn = true; 
                SceneManager.goto(Scene_Map);
            };

            // Обработка загрузки в зависимости от версии мейкера
            if (Utils.RPGMAKER_NAME === 'MZ') {
                DataManager.loadGame(SAMSARA_SLOT).then(executeGoto).catch(function() {
                    SoundManager.playBuzzer();
                });
            } else {
                if (DataManager.loadGame(SAMSARA_SLOT)) {
                    executeGoto();
                } else {
                    SoundManager.playBuzzer();
                }
            }
        } else {
            // Файла Самсары нет - воспроизводим звук ошибки
            SoundManager.playBuzzer();
        }
    }

    // ======================================================================
    // 3. РЕГИСТРАЦИЯ КОМАНД ПЛАГИНА (MV И MZ)
    // ======================================================================

    // Регистрация Команды Плагина (Поддержка MV)
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'SaveToSamsara') {
            saveToSamsara();
        }
        if (command === 'LoadFromSamsara') {
            loadFromSamsara();
        }
    };

    // Регистрация Команды Плагина (Поддержка MZ)
    if (Utils.RPGMAKER_NAME === 'MZ') {
        PluginManager.registerCommand('SuperDuperSamsara', 'SaveToSamsara', function() {
            saveToSamsara();
        });
        PluginManager.registerCommand('SuperDuperSamsara', 'LoadFromSamsara', function() {
            loadFromSamsara();
        });
    }

})();