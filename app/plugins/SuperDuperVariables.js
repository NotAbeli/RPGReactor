/*:
 * @target MV MZ
 * @plugindesc (v1.3) Мега-сборник: Реактор + Затухание + Авто-Выкл + Предмет в руке
 * @author Korolev
 *
 * ============================================================================
 * @param --- ПРЕДМЕТ В РУКЕ ---
 * @text --- ПРЕДМЕТ В РУКЕ ---
 * @default ===================================
 *
 * @param Hand_MonitorVar
 * @parent --- ПРЕДМЕТ В РУКЕ ---
 * @text ID Переменной руки
 * @type variable
 * @desc Переменная, которая управляет предметом в руке (и меняет состояния).
 * @default 1
 *
 * @param Hand_AutoZero
 * @parent --- ПРЕДМЕТ В РУКЕ ---
 * @text Авто-сброс на 0 (Нет предмета)
 * @type boolean
 * @on Включено
 * @off Выключено
 * @desc Если переменная > 0, но предмета нет в инвентаре, переменная принудительно станет равна 0.
 * @default true
 *
 * @param Hand_States
 * @parent --- ПРЕДМЕТ В РУКЕ ---
 * @text Состояния (Свитчи/Ивенты)
 * @type struct<HandState>[]
 * @desc Настройка: какие переключатели менять при каком значении переменной руки.
 * @default []
 *
 * ============================================================================
 * @param --- РЕАКТОР СОСТОЯНИЙ ---
 * @text --- РЕАКТОР СОСТОЯНИЙ ---
 * @default ===================================
 *
 * @param Reactor_Groups
 * @parent --- РЕАКТОР СОСТОЯНИЙ ---
 * @text Группы Реакций
 * @type struct<ReactionGroup>[]
 * @desc Автоматическое изменение одних переменных/свитчей при изменении других.
 * @default []
 *
 * ============================================================================
 * @param --- ЗАТУХАНИЕ (DECAY) ---
 * @text --- ЗАТУХАНИЕ (DECAY) ---
 * @default ===================================
 *
 * @param Decay_Variables
 * @parent --- ЗАТУХАНИЕ (DECAY) ---
 * @text Список переменных
 * @type struct<DecayVar>[]
 * @desc Укажите переменные, которые должны автоматически уменьшаться со временем.
 * @default []
 *
 * ============================================================================
 * @param --- АВТО-ВЫКЛЮЧЕНИЕ ---
 * @text --- АВТО-ВЫКЛЮЧЕНИЕ ---
 * @default ===================================
 *
 * @param AutoOff_Switches
 * @parent --- АВТО-ВЫКЛЮЧЕНИЕ ---
 * @text Таймеры переключателей
 * @type struct<SwitchTimer>[]
 * @desc Переключатели, которые выключаются сами через X секунд (когда игрок свободен).
 * @default []
 *
 * @param AutoOff_Variables
 * @parent --- АВТО-ВЫКЛЮЧЕНИЕ ---
 * @text Таймеры переменных
 * @type struct<VarTimer>[]
 * @desc Переменные, которые сбрасываются в 0 через X секунд (когда игрок свободен).
 * @default []
 *
 * ============================================================================
 * @param --- ОТЛАДКА ---
 * @text --- ОТЛАДКА ---
 * @default ===================================
 *
 * @param Debug_Mode
 * @parent --- ОТЛАДКА ---
 * @text Режим отладки (F8)
 * @type boolean
 * @desc Выводить информацию о работе модулей в консоль.
 * @default false
 *
 * @help
 * ============================================================================
 * SUPER DUPER VARIABLES: ВСЁ-В-ОДНОМ
 * ============================================================================
 * Этот плагин объединяет 4 системы в одну для максимальной оптимизации и
 * предотвращения конфликтов.
 *
 * 1. ПРЕДМЕТ В РУКЕ (Hand & Item)
 * Отслеживает переменную. Если переменная меняется, плагин переключает
 * нужные свитчи.
 * ВАЖНО: Если включен "Авто-сброс на 0", плагин проверяет наличие предмета!
 * Если значение переменной = 5, плагин ищет настройку для значения 5.
 * Если настройка требует предмет (или если настройки нет, плагин считает,
 * что ID предмета = 5), и этого предмета НЕТ в инвентаре -> переменная
 * автоматически сбросится на 0.
 *
 * 2. РЕАКТОР СОСТОЯНИЙ (Variable State Reactor)
 * Срабатывает ТОЛЬКО в момент изменения переменной-триггера. Позволяет
 * выключать свитчи или проводить математику (add:5, sub:2) с другими
 * переменными без параллельных событий.
 *
 * 3. АВТО-ЗАТУХАНИЕ ПЕРЕМЕННЫХ (Auto Variable Decay)
 * Указанные переменные будут сами уменьшаться на 1 каждые X тиков (кадров),
 * пока не достигнут нуля.
 *
 * 4. АВТО-ВЫКЛЮЧЕНИЕ СВИТЧЕЙ И ПЕРЕМЕННЫХ (Auto Switch/Var Off)
 * Свитч выключается, а переменная сбрасывается в 0 через X секунд. 
 * Таймер идет ТОЛЬКО когда игрок может ходить (не во время диалогов).
 * НОВОЕ: Если указать время = 0, свитч/переменная сбросятся моментально.
 */

// ============================================================================
// СТРУКТУРЫ ДАННЫХ ДЛЯ ПАРАМЕТРОВ
// ============================================================================

/*~struct~HandState:
 * @param Value
 * @text Значение переменной
 * @type number
 * @min 0
 *
 * @param RequiredItemId
 * @text Требуемый Предмет (ID)
 * @desc ID предмета. Если 0, плагин считает, что ID предмета равен "Значению переменной" (Value).
 * @type number
 * @default 0
 *
 * @param SwitchesOn
 * @text Включить переключатели
 * @type switch[]
 * @default []
 *
 * @param SwitchesOff
 * @text Выключить переключатели
 * @type switch[]
 * @default []
 *
 * @param ExitCommonEventId
 * @text Событие при Деактивации
 * @type common_event
 * @default 0
 */

/*~struct~ReactionGroup:
 * @param Name
 * @text Название группы
 * @type string
 * @default Новая группа
 *
 * @param Reactions
 * @text Реакции (Список)
 * @type struct<Reaction>[]
 * @default []
 */

/*~struct~Reaction:
 * @param TriggerVarId
 * @text ID Переменной-Триггера
 * @type variable
 * @default 1
 *
 * @param Condition
 * @text Условие срабатывания
 * @type select
 * @option Равно (=)
 * @value equal
 * @option Больше (>)
 * @value greater
 * @option Меньше (<)
 * @value less
 * @option Больше или равно (>=)
 * @value greaterOrEqual
 * @option Меньше или равно (<=)
 * @value lessOrEqual
 * @option Не равно (!=)
 * @value notEqual
 * @default equal
 *
 * @param Value
 * @text Значение для сравнения
 * @type number
 * @default 0
 *
 * @param SwitchesToChange
 * @text Изменить переключатели
 * @type struct<SwitchAction>[]
 * @default []
 *
 * @param VariablesToChange
 * @text Изменить переменные
 * @type struct<VarAction>[]
 * @default []
 */

/*~struct~SwitchAction:
 * @param Id
 * @text ID Переключателя
 * @type switch
 * @default 1
 *
 * @param Value
 * @text Новое состояние (true=ВКЛ)
 * @type boolean
 * @default true
 */

/*~struct~VarAction:
 * @param Id
 * @text ID Переменной
 * @type variable
 * @default 1
 *
 * @param Value
 * @text Значение / Формула (add:5)
 * @type string
 * @default 0
 */

/*~struct~DecayVar:
 * @param VariableID
 * @text ID переменной
 * @type variable
 *
 * @param TickInterval
 * @text Интервал (в тиках, 60=1сек)
 * @type number
 * @min 1
 * @default 60
 */

/*~struct~SwitchTimer:
 * @param switchId
 * @text ID Переключателя
 * @type switch
 * @default 1
 *
 * @param duration
 * @text Время (сек)
 * @type number
 * @min 0
 * @default 5
 * @desc 0 = моментальное выключение. Больше 0 = таймер в секундах.
 */

/*~struct~VarTimer:
 * @param variableId
 * @text ID Переменной
 * @type variable
 * @default 1
 *
 * @param duration
 * @text Время (сек)
 * @type number
 * @min 0
 * @default 5
 * @desc 0 = моментальный сброс в 0. Больше 0 = таймер в секундах.
 */

(function() {
    'use strict';

    const pluginName = "SuperDuperVariables";
    const parameters = PluginManager.parameters(pluginName);
    const DebugMode = (String(parameters['Debug_Mode']) === 'true');

    function log(moduleName, ...args) {
        if (DebugMode) console.log(`[SDV:${moduleName}]`, ...args);
    }

    // Универсальный парсер параметров RPG Maker
    function parseJSON(data) {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return parsed.map(parseJSON);
            if (typeof parsed === 'object' && parsed !== null) {
                const newObj = {};
                for (const key in parsed) newObj[key] = parseJSON(parsed[key]);
                return newObj;
            }
            return parsed;
        } catch (e) {
            return data;
        }
    }

    // ============================================================================
    // 1. МОДУЛЬ: ПРЕДМЕТ В РУКЕ (Hand & Item)
    // ============================================================================
    const HandModule = {
        varId: Number(parameters['Hand_MonitorVar'] || 1),
        autoZero: String(parameters['Hand_AutoZero']) === 'true',
        statesMap: {},
        lastActiveValue: null,

        init: function() {
            const rawStates = parseJSON(parameters['Hand_States'] || '[]');
            rawStates.forEach(data => {
                const val = Number(data.Value || 0);
                this.statesMap[val] = {
                    value: val,
                    reqId: Number(data.RequiredItemId || 0),
                    exitEventId: Number(data.ExitCommonEventId || 0),
                    switchesOn: (data.SwitchesOn || []).map(Number),
                    switchesOff: (data.SwitchesOff || []).map(Number)
                };
            });
        },

        checkInventory: function(currentVal, state) {
            // Если state не задан, но авто-зеро включено, предполагаем, что currentVal и есть ItemID
            const reqItemId = (state && state.reqId > 0) ? state.reqId : currentVal;
            
            if (reqItemId === 0) return true; // Не требует предмета

            const item = $dataItems[reqItemId];
            if (!item) return true; // Предмета не существует в БД, пропускаем проверку
            
            return $gameParty.hasItem(item);
        },

        applyState: function(state) {
            if (!state) return;
            state.switchesOff.forEach(swId => {
                if (swId > 0 && $gameSwitches.value(swId) !== false) {
                    log('Hand', "Switch OFF:", swId);
                    $gameSwitches.setValue(swId, false);
                }
            });
            state.switchesOn.forEach(swId => {
                if (swId > 0 && $gameSwitches.value(swId) !== true) {
                    log('Hand', "Switch ON:", swId);
                    $gameSwitches.setValue(swId, true);
                }
            });
        },

        refresh: function() {
            if (!$gameVariables || !$gameParty) return;
            
            const currentVal = $gameVariables.value(this.varId);
            
            // ЛОГИКА АВТО-СБРОСА (АВТО-ЗЕРО)
            if (this.autoZero && currentVal > 0) {
                const stateToCheck = this.statesMap[currentVal];
                if (!this.checkInventory(currentVal, stateToCheck)) {
                    log('Hand', `Требуемый предмет отсутствует. Сброс переменной ${this.varId} на 0.`);
                    // Меняем на 0 и прерываем текущее выполнение (setValue вызовет refresh заново)
                    $gameVariables.setValue(this.varId, 0); 
                    return;
                }
            }

            // Получаем стейт. Если нет в настройках, берем 0 как фоллбэк.
            let stateToApply = this.statesMap[currentVal] || this.statesMap[0];

            if (stateToApply) {
                const newValue = stateToApply.value;

                if (this.lastActiveValue !== null && this.lastActiveValue !== newValue) {
                    log('Hand', "State changed:", this.lastActiveValue, "->", newValue);
                    
                    // Применяем новое состояние
                    this.applyState(stateToApply);
                    
                    // Запускаем ивент старого состояния
                    const oldState = this.statesMap[this.lastActiveValue];
                    if (oldState && oldState.exitEventId > 0) {
                        log('Hand', "Trigger Exit Event:", oldState.exitEventId);
                        $gameTemp.reserveCommonEvent(oldState.exitEventId);
                    }
                } else if (this.lastActiveValue === null) {
                    // Первый запуск при загрузке карты/сохранения
                    this.applyState(stateToApply);
                }
                this.lastActiveValue = newValue;
            }
        }
    };
    HandModule.init();

    // ============================================================================
    // 2. МОДУЛЬ: РЕАКТОР СОСТОЯНИЙ (Variable State Reactor)
    // ============================================================================
    const ReactorModule = {
        groups: parseJSON(parameters['Reactor_Groups'] || '[]'),

        process: function(varId, currentValue) {
            this.groups.forEach(group => {
                if (!group.Reactions) return;
                group.Reactions.forEach(reaction => {
                    const triggerId = Number(reaction.TriggerVarId);
                    if (triggerId === varId) {
                        if (this.checkCondition(currentValue, reaction.Condition, Number(reaction.Value))) {
                            this.execute(reaction, group.Name);
                        }
                    }
                });
            });
        },

        forceCheckAll: function() {
            this.groups.forEach(group => {
                if (!group.Reactions) return;
                group.Reactions.forEach(reaction => {
                    const triggerId = Number(reaction.TriggerVarId);
                    const currentValue = $gameVariables.value(triggerId);
                    if (this.checkCondition(currentValue, reaction.Condition, Number(reaction.Value))) {
                        this.execute(reaction, group.Name);
                    }
                });
            });
        },

        checkCondition: function(current, type, target) {
            switch (type) {
                case 'equal': return current === target;
                case 'greater': return current > target;
                case 'less': return current < target;
                case 'greaterOrEqual': return current >= target;
                case 'lessOrEqual': return current <= target;
                case 'notEqual': return current !== target;
                default: return current === target;
            }
        },

        execute: function(reaction, groupName) {
            if (reaction.SwitchesToChange) {
                reaction.SwitchesToChange.forEach(sw => {
                    const swId = Number(sw.Id);
                    const swVal = (String(sw.Value) === 'true'); 
                    if (swId > 0 && $gameSwitches.value(swId) !== swVal) {
                        $gameSwitches.setValue(swId, swVal);
                        log('Reactor', `[${groupName}] Switch ${swId} -> ${swVal}`);
                    }
                });
            }
            if (reaction.VariablesToChange) {
                reaction.VariablesToChange.forEach(v => {
                    const vId = Number(v.Id);
                    const rawVal = v.Value;
                    if (vId > 0 && rawVal !== undefined) {
                        let finalValue = Number(rawVal);
                        if (typeof rawVal === 'string' && rawVal.includes(':')) {
                            const parts = rawVal.split(':');
                            const op = parts[0];
                            const num = Number(parts[1]);
                            const oldVal = $gameVariables.value(vId);
                            if (op === 'add') finalValue = oldVal + num;
                            if (op === 'sub') finalValue = oldVal - num;
                            if (op === 'mul') finalValue = oldVal * num;
                            if (op === 'div') finalValue = Math.floor(oldVal / num);
                            if (op === 'set') finalValue = num;
                        }
                        if ($gameVariables.value(vId) !== finalValue) {
                            $gameVariables.setValue(vId, finalValue);
                            log('Reactor', `[${groupName}] Variable ${vId} -> ${finalValue}`);
                        }
                    }
                });
            }
        }
    };

    // ============================================================================
    // 3. МОДУЛЬ: АВТО-ЗАТУХАНИЕ (Auto Variable Decay)
    // ============================================================================
    const DecayModule = {
        vars: parseJSON(parameters['Decay_Variables'] || '[]').map(obj => ({
            id: Number(obj.VariableID || 1),
            interval: Number(obj.TickInterval || 60),
            counter: 0
        })),

        update: function() {
            this.vars.forEach(v => {
                const value = $gameVariables.value(v.id);
                if (value > 0) {
                    v.counter++;
                    if (v.counter >= v.interval) {
                        $gameVariables.setValue(v.id, value - 1);
                        v.counter = 0;
                    }
                } else {
                    v.counter = 0;
                }
            });
        }
    };

    // ============================================================================
    // 4. МОДУЛЬ: АВТО-ВЫКЛЮЧЕНИЕ СВИТЧЕЙ И ПЕРЕМЕННЫХ (Auto Switch/Var Off)
    // ============================================================================
    const AutoOffModule = {
        switchConfigs: parseJSON(parameters['AutoOff_Switches'] || '[]').map(s => ({
            id: Number(s.switchId),
            duration: Number(s.duration)
        })),
        varConfigs: parseJSON(parameters['AutoOff_Variables'] || '[]').map(v => ({
            id: Number(v.variableId),
            duration: Number(v.duration)
        })),

        getSwitchDuration: function(switchId) {
            const config = this.switchConfigs.find(c => c.id === switchId);
            return config ? config.duration : null; // Возвращаем null, чтобы отличить от 0
        },

        getVarDuration: function(varId) {
            const config = this.varConfigs.find(c => c.id === varId);
            return config ? config.duration : null; // Возвращаем null, чтобы отличить от 0
        }
    };

    const _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._omniAutoOffTimers = {}; 
        this._omniAutoOffVarTimers = {}; 
    };

    // Методы для таймеров переключателей
    Game_System.prototype.omniStartTimer = function(switchId, seconds) {
        this._omniAutoOffTimers[switchId] = seconds * 60;
    };

    Game_System.prototype.omniStopTimer = function(switchId) {
        if (this._omniAutoOffTimers[switchId] !== undefined) {
            delete this._omniAutoOffTimers[switchId];
        }
    };

    // Методы для таймеров переменных
    Game_System.prototype.omniStartVarTimer = function(varId, seconds) {
        this._omniAutoOffVarTimers[varId] = seconds * 60;
    };

    Game_System.prototype.omniStopVarTimer = function(varId) {
        if (this._omniAutoOffVarTimers[varId] !== undefined) {
            delete this._omniAutoOffVarTimers[varId];
        }
    };

    Game_System.prototype.omniUpdateTimers = function() {
        if ($gameMap.isEventRunning()) return; // Пауза во время ивентов

        // Обновление таймеров переключателей
        for (const switchId in this._omniAutoOffTimers) {
            if (this._omniAutoOffTimers.hasOwnProperty(switchId)) {
                this._omniAutoOffTimers[switchId]--;
                if (this._omniAutoOffTimers[switchId] <= 0) {
                    delete this._omniAutoOffTimers[switchId];
                    $gameSwitches.setValue(Number(switchId), false);
                    log('AutoOff', `Switch ${switchId} auto-disabled by timer.`);
                }
            }
        }

        // Обновление таймеров переменных
        for (const varId in this._omniAutoOffVarTimers) {
            if (this._omniAutoOffVarTimers.hasOwnProperty(varId)) {
                this._omniAutoOffVarTimers[varId]--;
                if (this._omniAutoOffVarTimers[varId] <= 0) {
                    delete this._omniAutoOffVarTimers[varId];
                    $gameVariables.setValue(Number(varId), 0);
                    log('AutoOff', `Variable ${varId} auto-reset to 0 by timer.`);
                }
            }
        }
    };

    // ============================================================================
    // ГЛОБАЛЬНЫЕ ПЕРЕХВАТЫ (HOOKS) ДВИЖКА
    // ============================================================================

    // --- Изменение Переменных ---
    const _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function(variableId, value) {
        _Game_Variables_setValue.call(this, variableId, value);
        
        if (value !== undefined && value !== null) {
            // Reactor hook
            ReactorModule.process(variableId, value);
        }
        
        // Hand hook
        if (variableId === HandModule.varId) {
            HandModule.refresh();
        }

        // AutoOff Hook для переменных
        const duration = AutoOffModule.getVarDuration(variableId);
        if (duration !== null) {
            if (value !== 0) {
                if (duration <= 0) {
                    // Моментальное выключение через Event Loop, чтобы избежать рекурсии
                    setTimeout(() => {
                        if ($gameVariables.value(variableId) !== 0) {
                            $gameVariables.setValue(variableId, 0);
                            log('AutoOff', `Variable ${variableId} auto-reset to 0 instantly (0s).`);
                        }
                    }, 0);
                } else {
                    $gameSystem.omniStartVarTimer(variableId, duration);
                }
            } else {
                $gameSystem.omniStopVarTimer(variableId);
            }
        }
    };

    // --- Изменение Переключателей ---
    const _Game_Switches_setValue = Game_Switches.prototype.setValue;
    Game_Switches.prototype.setValue = function(switchId, value) {
        _Game_Switches_setValue.call(this, switchId, value);
        
        // AutoOff Hook
        const duration = AutoOffModule.getSwitchDuration(switchId);
        if (duration !== null) {
            if (value === true) {
                if (duration <= 0) {
                    // Моментальное выключение через Event Loop, чтобы избежать рекурсии
                    setTimeout(() => {
                        if ($gameSwitches.value(switchId) === true) {
                            $gameSwitches.setValue(switchId, false);
                            log('AutoOff', `Switch ${switchId} auto-disabled instantly (0s).`);
                        }
                    }, 0);
                } else {
                    $gameSystem.omniStartTimer(switchId, duration);
                }
            } else {
                $gameSystem.omniStopTimer(switchId);
            }
        }
    };

    // --- Получение предмета ---
    const _Game_Party_gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
        _Game_Party_gainItem.call(this, item, amount, includeEquip);
        setTimeout(() => HandModule.refresh(), 0);
    };

    // --- Инициализация и Загрузка ---
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame.call(this);
        HandModule.lastActiveValue = null;
        setTimeout(() => {
            ReactorModule.forceCheckAll();
            HandModule.refresh();
        }, 0);
    };

    const _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        HandModule.lastActiveValue = null;
        setTimeout(() => {
            ReactorModule.forceCheckAll();
            HandModule.refresh();
        }, 0);
    };

    // --- Обновление карты ---
    const _Game_Map_update = Game_Map.prototype.update;
    Game_Map.prototype.update = function(sceneActive) {
        _Game_Map_update.call(this, sceneActive);
        
        // Decay hook
        DecayModule.update();
        
        // AutoOff hook
        if (sceneActive) {
            $gameSystem.omniUpdateTimers();
        }
    };

})();