//=============================================================================
// SuperDuper_Keyboard.js
//=============================================================================

/*:
 * @plugindesc v1.7.1 Абсолютный AAA-плагин настройки управления. Удобный список клавиш в параметрах.
 * @author Korolev
 *
 * @param UI Settings
 * @text Настройки интерфейса
 * @default
 *
 * @param Command Name
 * @parent UI Settings
 * @text Название в меню
 * @desc Название опции в меню настроек игры.
 * @default Управление
 *
 * @param Color_Conflict
 * @parent UI Settings
 * @text Цвет конфликта
 * @desc Номер цвета для дублирующихся кнопок (от 0 до 31).
 * @type number
 * @default 2
 *
 * @param Common Events
 * @text Общие события
 * @desc Список общих событий, которые можно назначить на кнопки.
 * @type struct<CEntry>[]
 * @default []
 *
 * @help
 * ============================================================================
 * Введение
 * ============================================================================
 * SuperDuper_Keyboard - это минималистичная AAA-замена стандартным 
 * плагинам настройки клавиатуры. 
 * Управление в меню осуществляется как мышью (с плавным hover-эффектом),
 * так и стрелочками с клавиатуры (бесшовный переход).
 *
 * ============================================================================
 * Общие события (Замена YEP_ButtonCommonEvents)
 * ============================================================================
 * Плагин полностью заменяет сторонние плагины на вызов событий.
 * Если вы назначаете кнопку (например, Пробел) на Общее событие, 
 * ее старая, системная функция (ОК) полностью стирается из памяти игры,
 * уступая место вашему событию.
 *
 * ============================================================================
 * Особенности (Input Locking)
 * ============================================================================
 * Плагин решает классическую проблему RPG Maker MV — рывки при одновременном
 * нажатии стрелок и WASD.
 * Если вы зажали 'W' (Слот 1), любые сигналы направления из Слота 2 (Стрелки)
 * будут блокироваться на системном уровне, пока вы не отпустите 'W'. 
 */

/*~struct~CEntry:
 * @param id
 * @text ID Общего события
 * @type common_event
 *
 * @param name
 * @text Отображаемое имя
 * @type text
 *
 * @param defaultKey
 * @text Кнопка по умолчанию
 * @desc Выберите клавишу для этого события из списка.
 * @type select
 * @option [ Нет ]
 * @value 0
 * @option ЛКМ (Мышь)
 * @value 253
 * @option ПКМ (Мышь)
 * @value 254
 * @option СКМ (Мышь)
 * @value 255
 * @option Пробел (Space)
 * @value 32
 * @option Enter
 * @value 13
 * @option Shift
 * @value 16
 * @option Ctrl
 * @value 17
 * @option Alt
 * @value 18
 * @option Esc
 * @value 27
 * @option Tab
 * @value 9
 * @option Q
 * @value 81
 * @option W
 * @value 87
 * @option E
 * @value 69
 * @option R
 * @value 82
 * @option T
 * @value 84
 * @option Y
 * @value 89
 * @option U
 * @value 85
 * @option I
 * @value 73
 * @option O
 * @value 79
 * @option P
 * @value 80
 * @option A
 * @value 65
 * @option S
 * @value 83
 * @option D
 * @value 68
 * @option F
 * @value 70
 * @option G
 * @value 71
 * @option H
 * @value 72
 * @option J
 * @value 74
 * @option K
 * @value 75
 * @option L
 * @value 76
 * @option Z
 * @value 90
 * @option X
 * @value 88
 * @option C
 * @value 67
 * @option V
 * @value 86
 * @option B
 * @value 66
 * @option N
 * @value 78
 * @option M
 * @value 77
 * @option 1
 * @value 49
 * @option 2
 * @value 50
 * @option 3
 * @value 51
 * @option 4
 * @value 52
 * @option 5
 * @value 53
 * @option 6
 * @value 54
 * @option 7
 * @value 55
 * @option 8
 * @value 56
 * @option 9
 * @value 57
 * @option 0
 * @value 48
 * @default 0
 */

var Imported = Imported || {};
Imported.SuperDuper_Keyboard = true;

var SuperDuper = SuperDuper || {};
SuperDuper.Keyboard = SuperDuper.Keyboard || {};

//=============================================================================
// Parameters Setup
//=============================================================================
SuperDuper.Parameters = PluginManager.parameters('SuperDuper_Keyboard');
SuperDuper.Keyboard.CommandName = String(SuperDuper.Parameters['Command Name'] || 'Управление');
SuperDuper.Keyboard.ColorConflict = Number(SuperDuper.Parameters['Color_Conflict'] || 2);

SuperDuper.Keyboard.CommonEvents = [];
try {
    var ceParam = SuperDuper.Parameters['Common Events'];
    if (ceParam) {
        var ceList = JSON.parse(ceParam);
        if (ceList && ceList.length) {
            for (var i = 0; i < ceList.length; i++) {
                var parsed = JSON.parse(ceList[i]);
                SuperDuper.Keyboard.CommonEvents.push({
                    id: Number(parsed.id),
                    name: String(parsed.name),
                    defaultKey: Number(parsed.defaultKey || 0)
                });
            }
        }
    }
} catch (e) {
    console.warn("SuperDuper_Keyboard: Ошибка парсинга Общих Событий.", e);
}

// Словарь названий кнопок (включая мышь)
SuperDuper.Keyboard.KeyNames = {
    8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt',
    20: 'Caps Lock', 27: 'Esc', 32: 'Space', 33: 'Page Up', 34: 'Page Down',
    35: 'End', 36: 'Home', 37: '←', 38: '↑', 39: '→', 40: '↓',
    45: 'Insert', 46: 'Delete',
    48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
    65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I',
    74: 'J', 75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R',
    83: 'S', 84: 'T', 85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
    96: 'Num 0', 97: 'Num 1', 98: 'Num 2', 99: 'Num 3', 100: 'Num 4', 101: 'Num 5',
    102: 'Num 6', 103: 'Num 7', 104: 'Num 8', 105: 'Num 9',
    106: 'Num *', 107: 'Num +', 109: 'Num -', 110: 'Num .', 111: 'Num /',
    186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '~',
    219: '[', 220: '\\', 221: ']', 222: "'",
    253: 'ЛКМ', 254: 'ПКМ', 255: 'СКМ'
};

// Список действий
SuperDuper.Keyboard.Actions = [
    { action: 'up', name: 'Движение вверх' },
    { action: 'down', name: 'Движение вниз' },
    { action: 'left', name: 'Движение влево' },
    { action: 'right', name: 'Движение вправо' },
    { action: 'shift', name: 'Бег' },
    { action: 'ok', name: 'Взаимодействие' }
];

for (var i = 0; i < SuperDuper.Keyboard.CommonEvents.length; i++) {
    var ce = SuperDuper.Keyboard.CommonEvents[i];
    SuperDuper.Keyboard.Actions.push({
        action: 'common_' + ce.id,
        name: ce.name
    });
}

// Направления для системы блокировки
SuperDuper.Keyboard.DirectionalActions = ['up', 'down', 'left', 'right'];

//=============================================================================
// ConfigManager & Core Logic
//=============================================================================
ConfigManager.superDuperKeyMap = {};

SuperDuper.Keyboard.makeDefaultMap = function() {
    var map = {
        'up': [87, 38],       
        'down': [83, 40],     
        'left': [65, 37],     
        'right': [68, 39],    
        'shift': [16, 0],     
        'ok': [13, 32]
    };
    
    // Интеграция назначений общих событий с "вырезанием" их из системных кнопок
    for (var i = 0; i < SuperDuper.Keyboard.CommonEvents.length; i++) {
        var ce = SuperDuper.Keyboard.CommonEvents[i];
        var defaultKey = ce.defaultKey;
        
        if (defaultKey > 0) {
            // Если кнопка назначена на Событие, она теряет свою старую роль (например, 32 стирается из 'ok')
            for (var sysAct in map) {
                if (map[sysAct]) {
                    if (map[sysAct][0] === defaultKey) map[sysAct][0] = 0;
                    if (map[sysAct][1] === defaultKey) map[sysAct][1] = 0;
                }
            }
        }
        
        map['common_' + ce.id] = [defaultKey, 0];
    }
    return map;
};

var _ConfigManager_makeData = ConfigManager.makeData;
ConfigManager.makeData = function() {
    var config = _ConfigManager_makeData.call(this);
    config.superDuperKeyMap = this.superDuperKeyMap;
    return config;
};

var _ConfigManager_applyData = ConfigManager.applyData;
ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.call(this, config);
    if (config.superDuperKeyMap && Object.keys(config.superDuperKeyMap).length > 0) {
        this.superDuperKeyMap = config.superDuperKeyMap;
        for (var i = 0; i < SuperDuper.Keyboard.CommonEvents.length; i++) {
            var ceAction = 'common_' + SuperDuper.Keyboard.CommonEvents[i].id;
            if (!this.superDuperKeyMap[ceAction]) {
                this.superDuperKeyMap[ceAction] = [SuperDuper.Keyboard.CommonEvents[i].defaultKey, 0];
            }
        }
    } else {
        this.superDuperKeyMap = SuperDuper.Keyboard.makeDefaultMap();
    }
    SuperDuper.Keyboard.applyToSystem();
};

SuperDuper.Keyboard.applyToSystem = function() {
    // Базовые системные клавиши для предотвращения крашей
    Input.keyMapper = {
        9: 'tab', 17: 'control', 18: 'control', 27: 'escape', 
        33: 'pageup', 34: 'pagedown', 45: 'escape', 81: 'pageup', 
        88: 'escape', 96: 'escape', 116: 'F5', 119: 'F8', 120: 'debug'
    };
    
    // Дублируем маппинг в базу движка (на всякий случай для сторонних плагинов)
    for (var action in ConfigManager.superDuperKeyMap) {
        var slots = ConfigManager.superDuperKeyMap[action];
        if (slots && slots[0] > 0) Input.keyMapper[slots[0]] = action;
        if (slots && slots[1] > 0) Input.keyMapper[slots[1]] = action;
    }
    Input.update();
    Input.clear();
};

SuperDuper.Keyboard.hasConflicts = function() {
    var counts = {};
    for (var action in ConfigManager.superDuperKeyMap) {
        if (!ConfigManager.superDuperKeyMap.hasOwnProperty(action)) continue;
        var slots = ConfigManager.superDuperKeyMap[action];
        if (slots && slots[0] > 0) counts[slots[0]] = (counts[slots[0]] || 0) + 1;
        if (slots && slots[1] > 0) counts[slots[1]] = (counts[slots[1]] || 0) + 1;
    }
    for (var key in counts) {
        if (counts[key] > 1) return true;
    }
    return false;
};

SuperDuper.Keyboard.getConflictKeys = function() {
    var counts = {};
    var conflicts = {};
    for (var action in ConfigManager.superDuperKeyMap) {
        if (!ConfigManager.superDuperKeyMap.hasOwnProperty(action)) continue;
        var slots = ConfigManager.superDuperKeyMap[action];
        if (slots && slots[0] > 0) counts[slots[0]] = (counts[slots[0]] || 0) + 1;
        if (slots && slots[1] > 0) counts[slots[1]] = (counts[slots[1]] || 0) + 1;
    }
    for (var key in counts) {
        if (counts[key] > 1) conflicts[key] = true;
    }
    return conflicts;
};

//=============================================================================
// Input Core & Locking Mechanism (Direct State Projection + Isolation)
//=============================================================================
SuperDuper.Keyboard.CaptureMode = false;
SuperDuper.Keyboard.CaptureCallback = null;

Input._physicalKeys = {};
Input._currentLockSlot = null;

// Перехватываем каждый кадр перед обработкой логики игры
var _Input_update = Input.update;
Input.update = function() {
    if (!SuperDuper.Keyboard.CaptureMode) {
        var dirs = SuperDuper.Keyboard.DirectionalActions;
        var activeSlot = null;
        var pressedSlots = { 0: false, 1: false };
        
        // 1. Вычисляем, в каких слотах сейчас физически зажаты направления
        for (var i = 0; i < dirs.length; i++) {
            var action = dirs[i];
            var mapSlots = ConfigManager.superDuperKeyMap[action];
            if (mapSlots) {
                if (mapSlots[0] > 0 && Input._physicalKeys[mapSlots[0]]) pressedSlots[0] = true;
                if (mapSlots[1] > 0 && Input._physicalKeys[mapSlots[1]]) pressedSlots[1] = true;
            }
        }

        // 2. Логика удержания приоритетного слота (защита от рывков)
        if (Input._currentLockSlot !== null && pressedSlots[Input._currentLockSlot]) {
            activeSlot = Input._currentLockSlot;
        } else if (pressedSlots[0]) {
            activeSlot = 0;
        } else if (pressedSlots[1]) {
            activeSlot = 1;
        }
        Input._currentLockSlot = activeSlot;

        // 3. Прямая проекция: насильно прописываем состояния в движок, игнорируя его внутренний маппер
        for (var actionName in ConfigManager.superDuperKeyMap) {
            var mSlots = ConfigManager.superDuperKeyMap[actionName];
            var isPressed = false;
            
            if (mSlots) {
                if (dirs.contains(actionName)) {
                    // Для направлений движения строго слушаемся приоритетного слота
                    if (activeSlot === 0 && mSlots[0] > 0 && Input._physicalKeys[mSlots[0]]) isPressed = true;
                    if (activeSlot === 1 && mSlots[1] > 0 && Input._physicalKeys[mSlots[1]]) isPressed = true;
                } else {
                    // Для остальных действий (бег, ок, события) срабатывает из любого слота
                    if (mSlots[0] > 0 && Input._physicalKeys[mSlots[0]]) isPressed = true;
                    if (mSlots[1] > 0 && Input._physicalKeys[mSlots[1]]) isPressed = true;
                }
            }
            
            Input._currentState[actionName] = isPressed;
        }
    }
    
    // Вызываем оригинальный апдейт, чтобы движок посчитал таймеры нажатий (для isTriggered / isRepeated)
    _Input_update.call(this);
};

// --- Глобальный перехват движения мыши для идеального Hover ---
var _TouchInput_onMouseMove = TouchInput._onMouseMove;
TouchInput._onMouseMove = function(event) {
    if (_TouchInput_onMouseMove) _TouchInput_onMouseMove.call(this, event);
    TouchInput._mouseX = Graphics.pageToCanvasX(event.pageX);
    TouchInput._mouseY = Graphics.pageToCanvasY(event.pageY);
};

// --- Перехват Клавиатуры (Изоляция от фантомных состояний MV) ---
var _Input_onKeyDown = Input._onKeyDown;
Input._onKeyDown = function(event) {
    if (SuperDuper.Keyboard.CaptureMode) {
        event.preventDefault();
        event.stopPropagation();
        if (SuperDuper.Keyboard.CaptureCallback) {
            SuperDuper.Keyboard.CaptureCallback(event.keyCode);
        }
        return;
    }

    if ([32, 37, 38, 39, 40].contains(event.keyCode)) {
        event.preventDefault(); // Только для стрелок и пробела (защита от скролла страницы)
    }

    Input._physicalKeys[event.keyCode] = true;
    
    // Проверка: назначена ли эта кнопка в нашем плагине?
    var isOurs = false;
    for (var action in ConfigManager.superDuperKeyMap) {
        var slots = ConfigManager.superDuperKeyMap[action];
        if (slots && (slots[0] === event.keyCode || slots[1] === event.keyCode)) {
            isOurs = true;
            break;
        }
    }
    
    // Если кнопка наша, мы полностью блокируем ее проброс в родной код MV.
    // Это гарантирует, что старые системные функции мертвы.
    if (isOurs) return;

    _Input_onKeyDown.call(this, event); 
};

var _Input_onKeyUp = Input._onKeyUp;
Input._onKeyUp = function(event) {
    if (SuperDuper.Keyboard.CaptureMode) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    Input._physicalKeys[event.keyCode] = false;
    
    var isOurs = false;
    for (var action in ConfigManager.superDuperKeyMap) {
        var slots = ConfigManager.superDuperKeyMap[action];
        if (slots && (slots[0] === event.keyCode || slots[1] === event.keyCode)) {
            isOurs = true;
            break;
        }
    }
    
    if (isOurs) return;

    _Input_onKeyUp.call(this, event); 
};

// --- Перехват Мыши ---
var _TouchInput_onMouseDown = TouchInput._onMouseDown;
TouchInput._onMouseDown = function(event) {
    var mouseKey = event.button === 0 ? 253 : (event.button === 2 ? 254 : (event.button === 1 ? 255 : 0));
    
    if (SuperDuper.Keyboard.CaptureMode) {
        if (mouseKey > 0 && SuperDuper.Keyboard.CaptureCallback) {
            SuperDuper.Keyboard.CaptureCallback(mouseKey);
        }
        return;
    }

    if (mouseKey > 0) Input._physicalKeys[mouseKey] = true;
    _TouchInput_onMouseDown.call(this, event);
};

var _TouchInput_onMouseUp = TouchInput._onMouseUp;
TouchInput._onMouseUp = function(event) {
    if (SuperDuper.Keyboard.CaptureMode) return;
    
    var mouseKey = event.button === 0 ? 253 : (event.button === 2 ? 254 : (event.button === 1 ? 255 : 0));
    if (mouseKey > 0) Input._physicalKeys[mouseKey] = false;
    
    _TouchInput_onMouseUp.call(this, event);
};

var _TouchInput_onRightButtonDown = TouchInput._onRightButtonDown;
TouchInput._onRightButtonDown = function(event) {
    if (SuperDuper.Keyboard.CaptureMode) return;
    var action = Input.keyMapper[254]; // ПКМ
    if (action && action !== 'cancel') {
        return; 
    }
    _TouchInput_onRightButtonDown.call(this, event);
};

var _Input_clear = Input.clear;
Input.clear = function() {
    _Input_clear.call(this);
    Input._physicalKeys = {};
    Input._currentLockSlot = null;
};

//=============================================================================
// Scene_Map Integration (Общие события по кнопке)
//=============================================================================
var _Scene_Map_updateScene = Scene_Map.prototype.updateScene;
Scene_Map.prototype.updateScene = function() {
    _Scene_Map_updateScene.call(this);
    
    // Блокировка SceneManager осталась, но $gameMap.isEventRunning() вырезано.
    // Теперь события будут вызываться мгновенно даже в движении.
    if (!SceneManager.isSceneChanging()) {
        for (var i = 0; i < SuperDuper.Keyboard.CommonEvents.length; i++) {
            var ceId = SuperDuper.Keyboard.CommonEvents[i].id;
            if (Input.isTriggered('common_' + ceId)) {
                $gameTemp.reserveCommonEvent(ceId);
                break;
            }
        }
    }
};

//=============================================================================
// Window_Options
//=============================================================================
var _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.call(this);
    if (!Imported.YEP_OptionsCore) {
        this.addCommand(SuperDuper.Keyboard.CommandName, 'keyConfig', true);
    }
};

var _Window_Options_processOk = Window_Options.prototype.processOk;
Window_Options.prototype.processOk = function() {
    if (this.commandSymbol(this.index()) === 'keyConfig') {
        Window_Command.prototype.processOk.call(this);
        SceneManager.push(Scene_SuperDuper_KeyConfig);
    } else {
        _Window_Options_processOk.call(this);
    }
};

//=============================================================================
// Scene_SuperDuper_KeyConfig
//=============================================================================
function Scene_SuperDuper_KeyConfig() {
    this.initialize.apply(this, arguments);
}

Scene_SuperDuper_KeyConfig.prototype = Object.create(Scene_MenuBase.prototype);
Scene_SuperDuper_KeyConfig.prototype.constructor = Scene_SuperDuper_KeyConfig;

Scene_SuperDuper_KeyConfig.prototype.create = function() {
    Scene_MenuBase.prototype.create.call(this);
    
    if (!ConfigManager.superDuperKeyMap || Object.keys(ConfigManager.superDuperKeyMap).length === 0) {
        ConfigManager.superDuperKeyMap = SuperDuper.Keyboard.makeDefaultMap();
    }
    
    var winWidth = Math.floor(Graphics.boxWidth * 0.6);
    var winHeight = Math.floor(Graphics.boxHeight * 0.85);
    var wx = (Graphics.boxWidth - winWidth) / 2;
    var wy = (Graphics.boxHeight - winHeight) / 2;
    
    var headHeight = 72;
    var footHeight = 72;
    var listHeight = winHeight - headHeight - footHeight;

    this._headerWindow = new Window_SuperDuper_KeyHeader(wx, wy, winWidth, headHeight);
    this.addWindow(this._headerWindow);

    this._listWindow = new Window_SuperDuper_KeyList(wx, wy + headHeight, winWidth, listHeight);
    this._listWindow.setHandler('capture', this.onStartCapture.bind(this));
    this._listWindow.setHandler('down_to_footer', this.onDownToFooter.bind(this));
    this._listWindow.setHandler('cancel', this.onBack.bind(this));
    this.addWindow(this._listWindow);

    this._footerWindow = new Window_SuperDuper_KeyFooter(wx, wy + headHeight + listHeight, winWidth, footHeight);
    this._footerWindow.setHandler('reset', this.onReset.bind(this));
    this._footerWindow.setHandler('back', this.onBack.bind(this));
    this._footerWindow.setHandler('save', this.onSave.bind(this));
    this._footerWindow.setHandler('up_to_list', this.onUpToList.bind(this));
    this.addWindow(this._footerWindow);

    this._captureWindow = new Window_SuperDuper_KeyCapture();
    this._captureWindow.hide();
    this.addWindow(this._captureWindow);

    // Первоначальный фокус на список
    this._listWindow.activate();
    this._listWindow._hoverIndex = 0;
    this._listWindow._hoverSlot = 0;
    this._footerWindow.deactivate();
};

Scene_SuperDuper_KeyConfig.prototype.onDownToFooter = function() {
    this._listWindow.deactivate();
    this._listWindow.clearHover();
    this._footerWindow.activate();
    this._footerWindow._hoverSlot = 1; // Фокус по центру (Назад)
    this._footerWindow.refresh();
    SoundManager.playCursor();
};

Scene_SuperDuper_KeyConfig.prototype.onUpToList = function() {
    this._footerWindow.deactivate();
    this._footerWindow.clearHover();
    this._listWindow.activate();
    this._listWindow._hoverIndex = this._listWindow.maxItems() - 1;
    this._listWindow._hoverSlot = 0;
    this._listWindow._index = this._listWindow._hoverIndex;
    this._listWindow.ensureCursorVisible();
    this._listWindow.refresh();
    SoundManager.playCursor();
};

Scene_SuperDuper_KeyConfig.prototype.onStartCapture = function(index, slot) {
    var action = this._listWindow.getAction(index);
    if (!action) return;

    this._captureWindow.show();
    SuperDuper.Keyboard.CaptureMode = true;
    
    var self = this;
    SuperDuper.Keyboard.CaptureCallback = function(keyCode) {
        if (keyCode === 27) { // Esc - СБРОС (Clear)
            SoundManager.playCancel();
            ConfigManager.superDuperKeyMap[action][slot] = 0;
        } else if (keyCode === 46 || keyCode === 8) { // Delete / Backspace
            SoundManager.playCancel();
            ConfigManager.superDuperKeyMap[action][slot] = 0;
        } else {
            SoundManager.playEquip();
            ConfigManager.superDuperKeyMap[action][slot] = keyCode;
        }
        SuperDuper.Keyboard.CaptureMode = false;
        SuperDuper.Keyboard.CaptureCallback = null;
        self._captureWindow.hide();
        self._listWindow.refresh();
        self._footerWindow.refresh();
    };
};

Scene_SuperDuper_KeyConfig.prototype.onReset = function() {
    ConfigManager.superDuperKeyMap = SuperDuper.Keyboard.makeDefaultMap();
    this._listWindow.refresh();
};

Scene_SuperDuper_KeyConfig.prototype.onBack = function() {
    this.popScene(); // Выход без сохранения, возврат к старым настройкам
};

Scene_SuperDuper_KeyConfig.prototype.onSave = function() {
    if (SuperDuper.Keyboard.hasConflicts()) {
        SoundManager.playBuzzer();
    } else {
        ConfigManager.save();
        SuperDuper.Keyboard.applyToSystem();
        this.popScene();
    }
};

//=============================================================================
// Window_SuperDuper_KeyCapture (Всплывающее окно)
//=============================================================================
function Window_SuperDuper_KeyCapture() {
    this.initialize.apply(this, arguments);
}
Window_SuperDuper_KeyCapture.prototype = Object.create(Window_Base.prototype);
Window_SuperDuper_KeyCapture.prototype.constructor = Window_SuperDuper_KeyCapture;

Window_SuperDuper_KeyCapture.prototype.initialize = function() {
    var width = 450;
    var height = 150;
    var x = (Graphics.boxWidth - width) / 2;
    var y = (Graphics.boxHeight - height) / 2;
    Window_Base.prototype.initialize.call(this, x, y, width, height);
    this.refresh();
};

Window_SuperDuper_KeyCapture.prototype.refresh = function() {
    this.contents.clear();
    var text1 = "Нажмите любую кнопку";
    var text2 = "Нажмите ESC для отмены";
    var y1 = (this.contentsHeight() / 2) - this.lineHeight();
    var y2 = (this.contentsHeight() / 2);
    
    this.changeTextColor(this.systemColor());
    this.drawText(text1, 0, y1, this.contentsWidth(), 'center');
    this.resetTextColor();
    this.drawText(text2, 0, y2, this.contentsWidth(), 'center');
};

//=============================================================================
// Window_SuperDuper_KeyHeader
//=============================================================================
function Window_SuperDuper_KeyHeader() {
    this.initialize.apply(this, arguments);
}
Window_SuperDuper_KeyHeader.prototype = Object.create(Window_Base.prototype);
Window_SuperDuper_KeyHeader.prototype.constructor = Window_SuperDuper_KeyHeader;

Window_SuperDuper_KeyHeader.prototype.initialize = function(x, y, width, height) {
    Window_Base.prototype.initialize.call(this, x, y, width, height);
    this.refresh();
};

Window_SuperDuper_KeyHeader.prototype.refresh = function() {
    this.contents.clear();
    this.changeTextColor(this.systemColor());
    
    var cw = this.contentsWidth();
    var col1 = cw * 0.4;
    var col2 = cw * 0.3;
    var col3 = cw * 0.3;
    var cy = (this.contentsHeight() - this.lineHeight()) / 2;
    
    this.drawText("Действия:", 0, cy, col1, 'left');
    this.drawText("Осн.", col1, cy, col2, 'center');
    this.drawText("Альт.", col1 + col2, cy, col3, 'center');
    
    this.resetTextColor();
};

//=============================================================================
// Window_SuperDuper_KeyFooter
//=============================================================================
function Window_SuperDuper_KeyFooter() {
    this.initialize.apply(this, arguments);
}
Window_SuperDuper_KeyFooter.prototype = Object.create(Window_Selectable.prototype);
Window_SuperDuper_KeyFooter.prototype.constructor = Window_SuperDuper_KeyFooter;

Window_SuperDuper_KeyFooter.prototype.initialize = function(x, y, width, height) {
    Window_Selectable.prototype.initialize.call(this, x, y, width, height);
    this._handlers = {};
    this._hoverSlot = -1;
    this._lastMouseX = -1;
    this._lastMouseY = -1;
    this.refresh();
};

Window_SuperDuper_KeyFooter.prototype.setHandler = function(symbol, method) {
    this._handlers[symbol] = method;
};

Window_SuperDuper_KeyFooter.prototype.callHandler = function(symbol) {
    if (this._handlers[symbol]) this._handlers[symbol]();
};

Window_SuperDuper_KeyFooter.prototype.clearHover = function() {
    this._hoverSlot = -1;
    this.refresh();
};

Window_SuperDuper_KeyFooter.prototype.refresh = function() {
    this.contents.clear();
    
    var btnW = 120;
    var spacing = 20;
    var totalW = btnW * 3 + spacing * 2;
    var startX = (this.contentsWidth() - totalW) / 2;
    var btnH = 40;
    var btnY = (this.contentsHeight() - btnH) / 2;

    this.drawButton(startX, btnY, btnW, btnH, "Сброс", this._hoverSlot === 0);
    this.drawButton(startX + btnW + spacing, btnY, btnW, btnH, "Назад", this._hoverSlot === 1);
    this.drawButton(startX + (btnW + spacing) * 2, btnY, btnW, btnH, "Сохранить", this._hoverSlot === 2);
};

Window_SuperDuper_KeyFooter.prototype.drawButton = function(x, y, width, height, text, isHovered) {
    var bgColor = isHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.4)';
    this.contents.fillRect(x, y, width, height, bgColor);
    var textY = y + (height - this.lineHeight()) / 2;
    this.drawText(text, x, textY, width, 'center');
};

Window_SuperDuper_KeyFooter.prototype.update = function() {
    Window_Selectable.prototype.update.call(this);
    if (!SuperDuper.Keyboard.CaptureMode) {
        this.updateKeyboard();
        this.updateHover();
    }
};

Window_SuperDuper_KeyFooter.prototype.processCursorMove = function() {}; // Отключаем стандартный
Window_SuperDuper_KeyFooter.prototype.processHandling = function() {}; // Отключаем стандартный

Window_SuperDuper_KeyFooter.prototype.updateKeyboard = function() {
    if (!this.active) return;
    var lastSlot = this._hoverSlot;

    if (Input.isRepeated('up')) {
        this.callHandler('up_to_list');
    } else if (Input.isRepeated('right')) {
        if (this._hoverSlot < 2) {
            this._hoverSlot++;
            SoundManager.playCursor();
        }
    } else if (Input.isRepeated('left')) {
        if (this._hoverSlot > 0) {
            this._hoverSlot--;
            SoundManager.playCursor();
        }
    } else if (Input.isTriggered('ok')) {
        if (this._hoverSlot === 0) { SoundManager.playOk(); this.callHandler('reset'); }
        if (this._hoverSlot === 1) { SoundManager.playOk(); this.callHandler('back'); }
        if (this._hoverSlot === 2) { SoundManager.playOk(); this.callHandler('save'); }
    } else if (Input.isTriggered('cancel')) {
        SoundManager.playCancel();
        this.callHandler('back');
    }

    if (this._hoverSlot !== lastSlot) {
        this.refresh();
    }
};

Window_SuperDuper_KeyFooter.prototype.updateHover = function() {
    var mx = TouchInput._mouseX !== undefined ? TouchInput._mouseX : TouchInput.x;
    var my = TouchInput._mouseY !== undefined ? TouchInput._mouseY : TouchInput.y;
    
    if (this._lastMouseX === mx && this._lastMouseY === my) return;
    this._lastMouseX = mx;
    this._lastMouseY = my;

    var localX = this.canvasToLocalX(mx) - this.padding;
    var localY = this.canvasToLocalY(my) - this.padding;
    
    var newHoverSlot = -1;
    
    if (localX >= 0 && localY >= 0 && localX <= this.contentsWidth() && localY <= this.contentsHeight()) {
        var btnW = 120;
        var spacing = 20;
        var totalW = btnW * 3 + spacing * 2;
        var startX = (this.contentsWidth() - totalW) / 2;
        var btnH = 40;
        var btnY = (this.contentsHeight() - btnH) / 2;

        if (localY >= btnY && localY <= btnY + btnH) {
            if (localX >= startX && localX <= startX + btnW) {
                newHoverSlot = 0;
            } else if (localX >= startX + btnW + spacing && localX <= startX + btnW * 2 + spacing) {
                newHoverSlot = 1;
            } else if (localX >= startX + (btnW + spacing) * 2 && localX <= startX + btnW * 3 + spacing * 2) {
                newHoverSlot = 2;
            }
        }
    }

    if (this._hoverSlot !== newHoverSlot) {
        this._hoverSlot = newHoverSlot;
        
        if (newHoverSlot !== -1) {
            var scene = SceneManager._scene;
            if (scene && scene instanceof Scene_SuperDuper_KeyConfig && !this.active) {
                this.activate();
                scene._listWindow.deactivate();
                scene._listWindow.clearHover();
            }
        }
        this.refresh();
    }
};

var _Window_SuperDuper_KeyFooter_processTouch = Window_Selectable.prototype.processTouch;
Window_SuperDuper_KeyFooter.prototype.processTouch = function() {
    if (SuperDuper.Keyboard.CaptureMode) return;
    
    if (this.isOpenAndActive() && TouchInput.isTriggered()) {
        if (this._hoverSlot === 0) {
            SoundManager.playOk();
            this.callHandler('reset');
            return;
        } else if (this._hoverSlot === 1) {
            SoundManager.playOk();
            this.callHandler('back');
            return;
        } else if (this._hoverSlot === 2) {
            SoundManager.playOk();
            this.callHandler('save');
            return;
        }
    }
    _Window_SuperDuper_KeyFooter_processTouch.call(this);
};

//=============================================================================
// Window_SuperDuper_KeyList
//=============================================================================
function Window_SuperDuper_KeyList() {
    this.initialize.apply(this, arguments);
}
Window_SuperDuper_KeyList.prototype = Object.create(Window_Selectable.prototype);
Window_SuperDuper_KeyList.prototype.constructor = Window_SuperDuper_KeyList;

Window_SuperDuper_KeyList.prototype.initialize = function(x, y, width, height) {
    Window_Selectable.prototype.initialize.call(this, x, y, width, height);
    this._list = SuperDuper.Keyboard.Actions;
    this._hoverIndex = -1;
    this._hoverSlot = -1;
    this._lastMouseX = -1;
    this._lastMouseY = -1;
    this._handlers = {};
    this.refresh();
};

Window_SuperDuper_KeyList.prototype.setHandler = function(symbol, method) {
    this._handlers[symbol] = method;
};

Window_SuperDuper_KeyList.prototype.callHandler = function(symbol, index, slot) {
    if (this._handlers[symbol]) this._handlers[symbol](index, slot);
};

Window_SuperDuper_KeyList.prototype.getAction = function(index) {
    if (this._list && this._list[index]) return this._list[index].action;
    return null;
};

Window_SuperDuper_KeyList.prototype.clearHover = function() {
    this._hoverIndex = -1;
    this._hoverSlot = -1;
    this.refresh();
};

Window_SuperDuper_KeyList.prototype.maxCols = function() { return 1; };
Window_SuperDuper_KeyList.prototype.maxItems = function() { return this._list ? this._list.length : 0; };
Window_SuperDuper_KeyList.prototype.itemHeight = function() { return 56; };
Window_SuperDuper_KeyList.prototype.updateCursor = function() { this.setCursorRect(0, 0, 0, 0); };

Window_SuperDuper_KeyList.prototype.processCursorMove = function() {}; // Отключаем стандартный
Window_SuperDuper_KeyList.prototype.processHandling = function() {}; // Отключаем стандартный

Window_SuperDuper_KeyList.prototype.update = function() {
    Window_Selectable.prototype.update.call(this);
    if (!SuperDuper.Keyboard.CaptureMode) {
        this.updateKeyboard();
        this.updateHover();
    }
};

Window_SuperDuper_KeyList.prototype.updateKeyboard = function() {
    if (!this.active) return;
    var lastIndex = this._hoverIndex;
    var lastSlot = this._hoverSlot;

    if (Input.isRepeated('down')) {
        if (this._hoverIndex < this.maxItems() - 1) {
            this._hoverIndex++;
            SoundManager.playCursor();
        } else {
            this.callHandler('down_to_footer');
        }
    } else if (Input.isRepeated('up')) {
        if (this._hoverIndex > 0) {
            this._hoverIndex--;
            SoundManager.playCursor();
        }
    } else if (Input.isRepeated('right')) {
        if (this._hoverSlot === 0) {
            this._hoverSlot = 1;
            SoundManager.playCursor();
        }
    } else if (Input.isRepeated('left')) {
        if (this._hoverSlot === 1) {
            this._hoverSlot = 0;
            SoundManager.playCursor();
        }
    } else if (Input.isTriggered('ok')) {
        if (this._hoverIndex >= 0 && this._hoverSlot >= 0) {
            SoundManager.playOk();
            this.callHandler('capture', this._hoverIndex, this._hoverSlot);
        }
    } else if (Input.isTriggered('cancel')) {
        SoundManager.playCancel();
        this.callHandler('cancel');
    }

    if (this._hoverIndex !== lastIndex || this._hoverSlot !== lastSlot) {
        this._index = this._hoverIndex; // Синхронизация стандартного скролла
        this.ensureCursorVisible();
        this.refresh();
    }
};

Window_SuperDuper_KeyList.prototype.updateHover = function() {
    var mx = TouchInput._mouseX !== undefined ? TouchInput._mouseX : TouchInput.x;
    var my = TouchInput._mouseY !== undefined ? TouchInput._mouseY : TouchInput.y;
    
    if (this._lastMouseX === mx && this._lastMouseY === my) return;
    this._lastMouseX = mx;
    this._lastMouseY = my;

    var localX = this.canvasToLocalX(mx) - this.padding;
    var localY = this.canvasToLocalY(my) - this.padding;
    
    var newHoverIndex = -1;
    var newHoverSlot = -1;

    if (localX >= 0 && localY >= 0 && localX <= this.contentsWidth() && localY <= this.contentsHeight()) {
        for (var i = 0; i < this.maxItems(); i++) {
            var rect = this.itemRect(i); 
            
            if (localY >= rect.y && localY <= rect.y + rect.height) {
                var col1 = rect.width * 0.4;
                var col2 = rect.width * 0.3;
                var col3 = rect.width * 0.3;
                var btnWidth = 90;
                var btn0_x = rect.x + col1 + (col2 - btnWidth) / 2;
                var btn1_x = rect.x + col1 + col2 + (col3 - btnWidth) / 2;

                if (localX >= btn0_x && localX <= btn0_x + btnWidth) {
                    newHoverIndex = i;
                    newHoverSlot = 0;
                } else if (localX >= btn1_x && localX <= btn1_x + btnWidth) {
                    newHoverIndex = i;
                    newHoverSlot = 1;
                }
                break;
            }
        }
    }

    if (this._hoverIndex !== newHoverIndex || this._hoverSlot !== newHoverSlot) {
        this._hoverIndex = newHoverIndex;
        this._hoverSlot = newHoverSlot;

        if (newHoverIndex !== -1 && newHoverSlot !== -1) {
            var scene = SceneManager._scene;
            if (scene && scene instanceof Scene_SuperDuper_KeyConfig && !this.active) {
                this.activate();
                scene._footerWindow.deactivate();
                scene._footerWindow.clearHover();
                this._index = this._hoverIndex;
            }
        }
        this.refresh();
    }
};

Window_SuperDuper_KeyList.prototype.drawItem = function(index) {
    if (!this._list || index < 0 || index >= this._list.length) return;
    
    var item = this._list[index];
    var rect = this.itemRect(index);
    
    this.resetTextColor();
    this.changePaintOpacity(true);

    var col1 = rect.width * 0.4;
    var col2 = rect.width * 0.3;
    var col3 = rect.width * 0.3;

    var textY = rect.y + (rect.height - this.lineHeight()) / 2;
    this.drawText(item.name, rect.x, textY, col1, 'left');

    var map = ConfigManager.superDuperKeyMap[item.action];
    var keyCode0 = map ? map[0] : 0;
    var keyCode1 = map ? map[1] : 0;

    var keyName0 = keyCode0 > 0 ? (SuperDuper.Keyboard.KeyNames[keyCode0] || 'K' + keyCode0) : '';
    var keyName1 = keyCode1 > 0 ? (SuperDuper.Keyboard.KeyNames[keyCode1] || 'K' + keyCode1) : '';

    var conflicts = SuperDuper.Keyboard.getConflictKeys();
    var hasConflict0 = conflicts[keyCode0];
    var hasConflict1 = conflicts[keyCode1];

    var hover0 = (this._hoverIndex === index && this._hoverSlot === 0);
    var hover1 = (this._hoverIndex === index && this._hoverSlot === 1);

    var btnWidth = 90;
    var btnHeight = 36;
    var btnY = rect.y + (rect.height - btnHeight) / 2;
    var btn0_x = rect.x + col1 + (col2 - btnWidth) / 2;
    var btn1_x = rect.x + col1 + col2 + (col3 - btnWidth) / 2;

    this.drawKeyButton(btn0_x, btnY, btnWidth, btnHeight, keyName0, hasConflict0, hover0);
    this.drawKeyButton(btn1_x, btnY, btnWidth, btnHeight, keyName1, hasConflict1, hover1);
};

Window_SuperDuper_KeyList.prototype.drawKeyButton = function(x, y, width, height, text, hasConflict, isHovered) {
    var bgColor = isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.3)';
    this.contents.fillRect(x, y, width, height, bgColor);

    if (hasConflict) {
        this.changeTextColor(this.textColor(SuperDuper.Keyboard.ColorConflict));
    } else {
        this.resetTextColor();
    }

    var textY = y + (height - this.lineHeight()) / 2;
    this.drawText(text, x, textY, width, 'center');
};

var _Window_SuperDuper_KeyList_processTouch = Window_Selectable.prototype.processTouch;
Window_SuperDuper_KeyList.prototype.processTouch = function() {
    if (SuperDuper.Keyboard.CaptureMode) return;
    
    if (this.isOpenAndActive() && TouchInput.isTriggered()) {
        if (this._hoverIndex >= 0 && this._hoverSlot >= 0) {
            SoundManager.playOk();
            this.callHandler('capture', this._hoverIndex, this._hoverSlot);
            return;
        }
    }
    
    _Window_SuperDuper_KeyList_processTouch.call(this);
};

//=============================================================================
// End of File
//=============================================================================