//=============================================================================
// SuperDuperMessage.js
//=============================================================================

/*:
 * @plugindesc (v2.20) Супер-Пупер Ядро Сообщений. Текст, звуки, умные выборы и перемотка.
 * @author Korolev
 *
 * @param bgSettings
 * @text === ФОН СООБЩЕНИЙ ===
 * @default 
 *
 * @param Background Image
 * @parent bgSettings
 * @type file
 * @dir img/system/
 * @desc Файл фона для сообщений. Выберите файл из папки img/system/.
 * @default 
 *
 * @param seSettings
 * @text === ЗВУКИ ПЕЧАТИ ===
 * @default 
 *
 * @param Delay Time
 * @parent seSettings
 * @type number
 * @desc Задержка (в кадрах) перед повторным воспроизведением звука печати.
 * @default 10
 *
 * @param Default Talk SE
 * @parent seSettings
 * @desc Звук при печати символов. Формат: ИмяФайла,громкость,питч,панорама(опц). Чтобы отключить, оставьте пустым или напишите none.
 * @default Cursor1,80,150
 *
 * @param choiceSettings
 * @text === НАСТРОЙКИ ВЫБОРОВ ===
 * @default
 *
 * @param Pause Time
 * @parent choiceSettings
 * @type number
 * @desc Пауза (в кадрах) после появления выбора, чтобы игрок не кликнул случайно.
 * @default 20
 *
 * @param ffSettings
 * @text === ПЕРЕМОТКА ===
 * @default
 *
 * @param Skip on RMB
 * @parent ffSettings
 * @type boolean
 * @desc Пропускать на ПКМ? (Правая кнопка мыши)
 * @default false
 *
 * @param Skip on X
 * @parent ffSettings
 * @type boolean
 * @desc Пропускать на X? (Клавиша X / Esc)
 * @default false
 *
 * @param Disable Move Route FF
 * @parent ffSettings
 * @type boolean
 * @desc Отключить быструю перемотку маршрутов движений глобально?
 * @default false
 *
 * @help
 * ============================================================================
 * Инструкция к SuperDuperMessage
 * Автор: Korolev
 * ============================================================================
 * НОВОВВЕДЕНИЯ В v2.20:
 * Исправлен баг, при котором использование нескольких одинаковых тегов 
 * (например <not:A> <not:B>) ломало отображение и логику выбора. Теперь 
 * можно писать бесконечное количество условий в одной строке!
 *
 * НОВОВВЕДЕНИЯ В v2.19:
 * Полностью вырезан функционал звука подтверждения (Confirm SE), который 
 * вызывал фантомные звуки при закрытии окон и выборе вариантов. Теперь
 * звук строго и аппаратно привязан ИСКЛЮЧИТЕЛЬНО к печати символов.
 *
 * 1. ФОН ДЛЯ СООБЩЕНИЙ
 * В настройках плагина выберите изображение (из папки img/system/).
 * Оно заменит стандартное синее окно. Тип фона в настройках сообщения 
 * (Окно/Затемнение/Прозрачно) управляет прозрачностью картинки.
 *
 * ----------------------------------------------------------------------------
 * 2. ЗВУКИ ПЕЧАТИ
 * Плагин автоматически озвучивает печать текста.
 * Управление в процессе игры через плагин-команды:
 *
 * MSGSE TALK CLEAR                 - Полностью отключить звук печати
 * MSGSE TALK DEFAULT               - Вернуть звук по умолчанию
 * MSGSE TALK ИмяФайла громкость питч - Поставить свой звук (пример: MSGSE TALK Cursor1 80 150)
 *
 * ----------------------------------------------------------------------------
 * 3. УМНЫЕ ВЫБОРЫ (Память и Теги)
 * Забудьте про переключатели. Пишите теги прямо в тексте вариантов ответа:
 *
 * <once>        - Вариант скроется навсегда после первого же выбора.
 * <req:метка>   - Вариант появится ТОЛЬКО если в памяти есть эта метка.
 * <not:метка>   - Вариант будет виден ПОКА этой метки нет в памяти.
 *
 * Управление памятью:
 * Вы можете использовать ИЛИ "Вызов скрипта", ИЛИ "Команду плагина":
 * mark('имя_метки') или mark(имя_метки) - Записать метку в память навсегда.
 * seen('имя_метки') - Проверить наличие метки (в условиях скрипта).
 *
 * ----------------------------------------------------------------------------
 * 4. БЕСКОНЕЧНЫЕ ВЫБОРЫ
 * Лимит в 6 вариантов снят. Просто ставьте команды "Показать выбор" 
 * одну за другой в редакторе — плагин сам склеит их в единый длинный список.
 *
 * ----------------------------------------------------------------------------
 * 5. УМНАЯ ПЕРЕМОТКА
 * Стандартная мгновенная перемотка текста заблокирована.
 * Текст ускоряется только при зажатии ПКМ (правая кнопка мыши) или 
 * клавиши X/Esc (настраивается в параметрах).
 * Плагин-команды для контроля в катсценах:
 * ENABLETEXTFF       - Разрешить перемотку
 * DISABLETEXTFF      - Запретить перемотку полностью
 * DISABLENEXTTEXTFF  - Запретить перемотку только для следующего сообщения
 */

var Imported = Imported || {};
Imported.SuperDuperMessage = true;

var SDM = SDM || {};        
SDM.MBG = SDM.MBG || {};    
SDM.Mstyle = SDM.Mstyle || {};  
SDM.pCmd = SDM.pCmd || {};    
SDM.MSE = SDM.MSE || {};      
SDM.CPAUSE = SDM.CPAUSE || {};

var corePluginName = 'SuperDuperMessage';

//=============================================================================
// 1. ФОН СООБЩЕНИЙ
//=============================================================================
(function() {
	SDM.MBG.image = PluginManager.parameters(corePluginName)["Background Image"];
	SDM.MBG.disable = false;
	SDM.MBG.window = null;
	
SDM.MBG.Scene_Map_create = Scene_Map.prototype.create;
Scene_Map.prototype.create = function() {
	SDM.MBG.disable = false;
	SDM.MBG.window = null;
	if (SDM.MBG.Scene_Map_create) SDM.MBG.Scene_Map_create.call(this);
};

SDM.MBG.Window_Message_startMessage = Window_Message.prototype.startMessage;
Window_Message.prototype.startMessage = function() {
	if (SDM.Mstyle.target) {
		SDM.MBG.disable = true;
	} else {
		SDM.MBG.disable = false;
	};
	SDM.MBG.window = this;
	if (SDM.MBG.Window_Message_startMessage) SDM.MBG.Window_Message_startMessage.call(this);
};

SDM.MBG.Window_Message_setBackgroundType = Window_Message.prototype.setBackgroundType;
Window_Message.prototype.setBackgroundType = function(type) {
	if (SDM.Mstyle.target) {
		this.opacity = SDM.Mstyle.opacity;
	} else if (SDM.MBG.image) {
		this.opacity = 0;
		this.hideBackgroundDimmer();
		return;
	};
	if (SDM.MBG.Window_Message_setBackgroundType) SDM.MBG.Window_Message_setBackgroundType.call(this,type);
};

SDM.MBG.Scene_Map_createWindowLayer = Scene_Map.prototype.createWindowLayer;
Scene_Map.prototype.createWindowLayer = function() {
	this._msgBgSprite = new Sprite_SDMMsgBg();
	this._msgBgSprite.z = -1000;
	this.addChild(this._msgBgSprite);
	if (SDM.MBG.Scene_Map_createWindowLayer) SDM.MBG.Scene_Map_createWindowLayer.call(this);
};

SDM.MBG.Scene_Battle_createWindowLayer = Scene_Battle.prototype.createWindowLayer;
Scene_Battle.prototype.createWindowLayer = function() {
	this._msgBgSprite = new Sprite_SDMMsgBg();
	this._msgBgSprite.z = -1000;
	this.addChild(this._msgBgSprite);
	if (SDM.MBG.Scene_Battle_createWindowLayer) SDM.MBG.Scene_Battle_createWindowLayer.call(this);
};

})();

function Sprite_SDMMsgBg() {
    this.initialize.apply(this, arguments);
}

Sprite_SDMMsgBg.prototype = Object.create(Sprite.prototype);
Sprite_SDMMsgBg.prototype.constructor = Sprite_SDMMsgBg;

Sprite_SDMMsgBg.prototype.initialize = function() {
    Sprite.prototype.initialize.call(this);
	this.opacity = 0;
	this.loadBitmap();
    this.update();
};

Sprite_SDMMsgBg.prototype.update = function() {
    Sprite.prototype.update.call(this);
    if (SDM.MBG.window) this.controlBitmap() ;
};

Sprite_SDMMsgBg.prototype.loadBitmap = function() {
    this.bitmap = ImageManager.loadSystem(SDM.MBG.image);
	this.x = 0;
	this.z = 10;
	this.maxopac = 255;
};

Sprite_SDMMsgBg.prototype.controlBitmap = function() {
	if (SDM.MBG.window.openness <= 0 || SDM.MBG.disable || !SDM.MBG.image) {
		this.opacity = 0;
		this.maxopac = 255;
		return;
	};

	switch ($gameMessage.background()) {
	case 0:
		this.opacity = Math.min(SDM.MBG.window._openness,this.maxopac);
		break;
	case 1:
		this.opacity = SDM.MBG.window._openness * 0.5;
		this.maxopac = this.opacity;
		break;
	case 2:
		this.opacity = 0;
		this.maxopac = 0;
		break;
	};
	
	if (SDM.MBG.window.isClosing()) return;
	
	switch ($gameMessage.positionType()) {
	case 0:
		this.y = -(this.bitmap.height * 0.333);
		break;
	case 1:
		this.y = (Graphics.boxHeight / 2) - (this.bitmap.height / 2)
		break;
	case 2:
		this.y = Graphics.boxHeight - (this.bitmap.height * 0.666);
		break;
	};
};

//=============================================================================
// 2. ЗВУКИ ПЕЧАТИ
//=============================================================================
(function() {
	
if (!SDM.aliased) {
	SDM.MSE.Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
	Game_Interpreter.prototype.pluginCommand = function(command, args) {
		if (SDM.pCmd[command]) {
			SDM.pCmd[command](args);
			return;
		};
		if (SDM.MSE.Game_Interpreter_pluginCommand) SDM.MSE.Game_Interpreter_pluginCommand.call(this, command, args);
	};
	SDM.aliased = true;
};

SDM.pCmd.MSGSE = function(arguments) {
	SDM.MSE.plugin(arguments);
};

SDM.MSE.plugin = function(arr) {
	if (arr[0] !== "TALK") return;
	var sound;
	var obj;
	switch (arr[1]) {
		case "CLEAR":
			sound = SDM.MSE.makeSound(["",0,100]);
			break;
		case "DEFAULT":
			sound = "default";
			break;
		default:
			obj = {
				name: arr[1],
				pan: Number(arr[4]) || 0,
				pitch: Number(arr[3]),
				volume: Number(arr[2])
			};
			sound = obj;
			break;
	};
    if (sound === "default") {
        $gameMessage.msgSe = SDM.MSE.defaultSe;
    } else {
        $gameMessage.msgSe = sound;
    };
};
	
SDM.MSE.makeSound = function(txt) {
    if (!txt || String(txt).trim() === '' || String(txt).trim().toLowerCase() === 'none') {
        return { name: "none" };
    }
	if (Array.isArray(txt)) {
		var arr = txt;
	} else {
		var arr = txt.split(",");
	};
	var obj = {
		name: arr[0] ? arr[0].trim() : "none",
		pan: Number(arr[3]) || 0,
		pitch: Number(arr[2]),
		volume: Number(arr[1])
	};
	return obj;
};

SDM.MSE.delay = Number(PluginManager.parameters(corePluginName)["Delay Time"]);
SDM.MSE.defaultSe = SDM.MSE.makeSound(PluginManager.parameters(corePluginName)["Default Talk SE"]);

SDM.MSE.Game_Message_initialize = Game_Message.prototype.initialize;
Game_Message.prototype.initialize = function() {
	this.msgSe = SDM.MSE.defaultSe;
    if (SDM.MSE.Game_Message_initialize) SDM.MSE.Game_Message_initialize.call(this);
};

SDM.MSE.Window_Message_startMessage = Window_Message.prototype.startMessage;
Window_Message.prototype.startMessage = function() {
	this.delayTime = SDM.MSE.delay;
	if (SDM.MSE.Window_Message_startMessage) SDM.MSE.Window_Message_startMessage.call(this);
};

SDM.MSE.Window_Message_updateMessage = Window_Message.prototype.updateMessage;
Window_Message.prototype.updateMessage = function() {
	this.delayTime += 1;
	if (SDM.MSE.Window_Message_updateMessage) return SDM.MSE.Window_Message_updateMessage.call(this);
    return false;
};

SDM.MSE.Window_Message_processNormalCharacter = Window_Message.prototype.processNormalCharacter;
Window_Message.prototype.processNormalCharacter = function(textState) {
    var char = textState.text[textState.index];
    
	if (!this._showFast && char && char !== ' ' && char !== '　') {
		if (this.delayTime >= SDM.MSE.delay) {
            if ($gameMessage.msgSe && $gameMessage.msgSe.name && $gameMessage.msgSe.name.toLowerCase() !== "none") {
			    AudioManager.playSe($gameMessage.msgSe);
            }
			this.delayTime = 0;
		};
	};
    
    if (SDM.MSE.Window_Message_processNormalCharacter) {
        SDM.MSE.Window_Message_processNormalCharacter.call(this, textState);
    } else {
        Window_Base.prototype.processNormalCharacter.call(this, textState);
    }
};

})();

//=============================================================================
// 3. СКРЫТИЕ ВЫБОРОВ (ВНУТРЕННЯЯ ЛОГИКА)
//=============================================================================
(function () {

  Game_Message.prototype.backupChoices = function() {
    this._oldChoices = this._choices.slice();
  };
  
  Game_Message.prototype.restoreChoices = function() {
    if (this._oldChoices) {
      this._choices = this._oldChoices.slice();
    }
  };

  var SDM_GameMessage_Clear = Game_Message.prototype.clear;
  Game_Message.prototype.clear = function() {
    if (SDM_GameMessage_Clear) SDM_GameMessage_Clear.call(this);
    this._hiddenChoiceConditions = {};
    this._oldChoices = [];
  };
  
  Game_Message.prototype.isChoiceHidden = function(choiceNum) {
    return this._hiddenChoiceConditions[choiceNum];
  };
  
  Game_Message.prototype.hideChoice = function(choiceNum, bool) {
    this._hiddenChoiceConditions[choiceNum] = bool;
  };
  
  var SDM_GameInterpreter_setupChoices = Game_Interpreter.prototype.setupChoices;
  Game_Interpreter.prototype.setupChoices = function(params) {
    if (SDM_GameInterpreter_setupChoices) SDM_GameInterpreter_setupChoices.call(this, params);
    $gameMessage.backupChoices();
  };

  var SDM_WindowChoiceList_MakeCommandList = Window_ChoiceList.prototype.makeCommandList;
  Window_ChoiceList.prototype.makeCommandList = function() {
    $gameMessage.restoreChoices();
    this.clearChoiceMap();
    if (SDM_WindowChoiceList_MakeCommandList) SDM_WindowChoiceList_MakeCommandList.call(this);
               
    var needsUpdate = false;
    for (var i = this._list.length - 1; i >= 0; i--) {
      if ($gameMessage.isChoiceHidden(i)) {
        this._list.splice(i, 1);
        $gameMessage._choices.splice(i, 1);        
        needsUpdate = true;
      }
      else {
        this._choiceMap.unshift(i);
      }
    }
    
    if (needsUpdate === true) {
       this.updatePlacement();
    }
  };
  
  Window_ChoiceList.prototype.clearChoiceMap = function() {
    this._choiceMap = [];
  };
  
  var _Window_ChoiceList_callOkHandler = Window_ChoiceList.prototype.callOkHandler;
  Window_ChoiceList.prototype.callOkHandler = function() {
    $gameMessage.onChoice(this._choiceMap[this.index()]);
    this._messageWindow.terminateMessage();
    this.close();
  };  

})();

//=============================================================================
// 4. УМНЫЕ ВЫБОРЫ (SMART CHOICES)
//=============================================================================
(function() {
    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        if (_Game_System_initialize) _Game_System_initialize.call(this);
        this._sdmTags = [];
    };

    window.mark = function(tag) {
        if (!$gameSystem) return;
        if (!$gameSystem._sdmTags) $gameSystem._sdmTags = [];
        if (!window.seen(tag)) $gameSystem._sdmTags.push(tag);
    };

    window.seen = function(tag) {
        if (!$gameSystem || !$gameSystem._sdmTags) return false;
        return $gameSystem._sdmTags.indexOf(tag) !== -1;
    };

    var _Window_ChoiceList_callOkHandler2 = Window_ChoiceList.prototype.callOkHandler;
    Window_ChoiceList.prototype.callOkHandler = function() {
        var index = this.index();
        var originalIndex = this._choiceMap ? this._choiceMap[index] : index;
        if ($gameMessage._onceChoices && $gameMessage._onceChoices[originalIndex]) {
            window.mark($gameMessage._onceChoices[originalIndex]);
        }
        if (_Window_ChoiceList_callOkHandler2) _Window_ChoiceList_callOkHandler2.call(this);
    };

    // Поддержка установки меток через Команды Плагина
    var _Game_Interpreter_pluginCommand_SDM_Tags = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        if (_Game_Interpreter_pluginCommand_SDM_Tags) _Game_Interpreter_pluginCommand_SDM_Tags.call(this, command, args);
        if (!command) return;
        
        var cmdLower = command.toLowerCase();
        var markMatch = command.match(/^mark\((.+)\)$/i);
        
        if (markMatch) {
            window.mark(markMatch[1].trim());
        } else if (cmdLower === 'mark' && args && args.length > 0) {
            window.mark(args[0].trim());
        }
    };
})();

//=============================================================================
// 5. БЕСКОНЕЧНЫЕ ВЫБОРЫ (LARGE CHOICES v2.16)
//=============================================================================
(function() {
  var _SDM_Game_Interpreter_setupChoices = Game_Interpreter.prototype.setupChoices;
  Game_Interpreter.prototype.setupChoices = function(params) {  
    params = this.combineChoices(params);
    
    $gameMessage._onceChoices = {};
    
    var originalChoices = params[0];
    var displayChoices = [];
    var allHidden = true; 
    
    for (var i = 0; i < originalChoices.length; i++) {
        var choiceText = originalChoices[i];
        var hide = false;

        // Ищем и обрабатываем ВСЕ теги <req: > циклом
        var reqRegex = /<req:\s*([^>]+)>/gi;
        var reqMatch;
        while ((reqMatch = reqRegex.exec(choiceText)) !== null) {
            if (!window.seen(reqMatch[1].trim())) hide = true;
        }
        choiceText = choiceText.replace(/<req:\s*[^>]+>/gi, '');

        // Ищем и обрабатываем ВСЕ теги <not: > циклом
        var notRegex = /<not:\s*([^>]+)>/gi;
        var notMatch;
        while ((notMatch = notRegex.exec(choiceText)) !== null) {
            if (window.seen(notMatch[1].trim())) hide = true;
        }
        choiceText = choiceText.replace(/<not:\s*[^>]+>/gi, '');

        // Обрабатываем тег <once>
        var onceMatch = choiceText.match(/<once>/i);
        if (onceMatch) {
            var cleanText = choiceText.replace(/<once>/ig, '');
                
            var tagText = cleanText
                .replace(/\\[A-Za-z]+\[.*?\]/g, '')
                .replace(/\\[A-Za-z]+/g, '')
                .replace(/\x1b[A-Za-z]+\[.*?\]/ig, '')
                .replace(/\x1b[A-Za-z]+/ig, '')
                .trim();
                
            var onceTag = "once:" + tagText;
            if (window.seen(onceTag)) hide = true;
            $gameMessage._onceChoices[i] = onceTag;
            
            choiceText = choiceText.replace(/<once>/ig, '');
        }

        displayChoices.push(choiceText.trim());
        if (hide) {
            $gameMessage.hideChoice(i, true);
        } else {
            allHidden = false;
        }
    }

    if (allHidden) {
        if (params[1] === -2) {
            this._branch[this._indent] = -2;
        } else if (params[1] > -1) {
            this._branch[this._indent] = params[1]; 
        } else {
            this._branch[this._indent] = -1; 
        }
        this.wait(1); 
        return;
    }

    var newParams = params.slice();
    newParams[0] = displayChoices;

    if (_SDM_Game_Interpreter_setupChoices) _SDM_Game_Interpreter_setupChoices.call(this, newParams);      
  };

  Game_Interpreter.prototype.combineChoices = function(params) {  
    var choices = params[0].slice();
    var cancelType = params[1];
    var defaultType = params[2];
    var positionType = params[3];
    var background = params[4];

    this._sdmSkip102 = {};
    this._sdmChoiceOffsets = {};

    var currIndex = this._index;
    var numChoices = 0; 
    var isFirst102 = true;

    while (currIndex < this._list.length) {
        var cmd = this._list[currIndex];
        
        // Защита от бесконечного сканирования: если мы вышли из текущего блока 
        // (например, кончился цикл или условие), немедленно прерываем поиск следующих выборов
        if (cmd.indent < this._indent) {
            break;
        }
        
        if (cmd.indent === this._indent) {
            if (cmd.code === 102) {
                if (!isFirst102) {
                    this._sdmSkip102[currIndex] = true;
                    var nextParams = cmd.parameters;
                    
                    if (nextParams[1] > -1) {
                        cancelType = nextParams[1] + numChoices;
                    } else if (nextParams[1] === -2) {
                        cancelType = -2;            
                    }
                    
                    if (nextParams[2] > -1) {
                        defaultType = nextParams[2] + numChoices;
                    }
                    
                    for (var i = 0; i < nextParams[0].length; i++) {
                        choices.push(nextParams[0][i]);
                    }    
                }
                isFirst102 = false;
            }
            else if (cmd.code === 402) {
                this._sdmChoiceOffsets[currIndex] = numChoices;
                numChoices++;
            }
            else if (cmd.code === 403 || cmd.code === 404) {
                // Ветки отмены (403) и концы выборов (404) - часть структуры, пропускаем их
            }
            else if (cmd.code === 0 || cmd.code === 108 || cmd.code === 408 || cmd.code === 118) {
                // Игнорируем технические "пустоты" (0), комментарии (108, 408) и метки (118),
                // которые редактор RPG Maker мог оставить между блоками выборов
            }
            else {
                // Если попалась какая-то РЕАЛЬНАЯ команда (текст, переменная) на том же уровне отступа,
                // значит блоки выборов логически разделены, и их нельзя склеивать.
                break;
            }
        }
        currIndex++;
    }
    
    return [choices, cancelType, defaultType, positionType, background];
  };

  var _Game_Interpreter_command102 = Game_Interpreter.prototype.command102;
  Game_Interpreter.prototype.command102 = function() {
    if (this._sdmSkip102 && this._sdmSkip102[this._index]) {
        return true; 
    }
    return _Game_Interpreter_command102 ? _Game_Interpreter_command102.apply(this, arguments) : false;
  };

  var _Game_Interpreter_command402 = Game_Interpreter.prototype.command402;
  Game_Interpreter.prototype.command402 = function() {
    if (this._sdmChoiceOffsets && this._sdmChoiceOffsets[this._index] !== undefined) {
        var expected = this._sdmChoiceOffsets[this._index];
        if (this._branch[this._indent] !== expected) {
            this.skipBranch();
        }
        return true;
    }
    return _Game_Interpreter_command402 ? _Game_Interpreter_command402.apply(this, arguments) : false;
  };

  var _Game_Interpreter_command404 = Game_Interpreter.prototype.command404;
  Game_Interpreter.prototype.command404 = function() {
    if (this._sdmChoiceOffsets !== undefined) {
        // Блокируем внутренний хак RPG Maker (вычитание -6 из ветки),
        // который ломает навигацию по склеенным выборам
        return true;
    }
    return _Game_Interpreter_command404 ? _Game_Interpreter_command404.apply(this, arguments) : true;
  };

})();

//=============================================================================
// 6. ПАУЗА ВЫБОРОВ (CHOICE PAUSE)
//=============================================================================
(function() {
	
SDM.CPAUSE.time = Number(PluginManager.parameters(corePluginName)['Pause Time']);

var _SDM_CPAUSE_Window_ChoiceList_open = Window_ChoiceList.prototype.open;
Window_ChoiceList.prototype.open = function() {
	this._pauseTime = Graphics.frameCount + SDM.CPAUSE.time;
	if (_SDM_CPAUSE_Window_ChoiceList_open) _SDM_CPAUSE_Window_ChoiceList_open.call(this);
};

var _SDM_CPAUSE_Window_ChoiceList_isOkTriggered = Window_ChoiceList.prototype.isOkTriggered;
Window_ChoiceList.prototype.isOkTriggered = function() {
	return (_SDM_CPAUSE_Window_ChoiceList_isOkTriggered ? _SDM_CPAUSE_Window_ChoiceList_isOkTriggered.call(this) : false) && Graphics.frameCount > this._pauseTime;
};

})();

//=============================================================================
// 7. УМНАЯ ПЕРЕМОТКА (SMART FAST FORWARD)
//=============================================================================
(function() {
    var parameters = PluginManager.parameters(corePluginName);
    var skipOnRMB = parameters["Skip on RMB"] === 'true';
    var skipOnX = parameters["Skip on X"] === 'true';
    var disableGlobalMoveRouteFF = parameters["Disable Move Route FF"] === 'true';

    var textFfDisabled = false;
    var nextTextFfDisabled = false;

    var isTextFfDisabled = function() {
        return nextTextFfDisabled || textFfDisabled;
    };

    var rmbPressed = false;
    var _TouchInput_onRightButtonDown = TouchInput._onRightButtonDown;
    TouchInput._onRightButtonDown = function(event) {
        if (_TouchInput_onRightButtonDown) _TouchInput_onRightButtonDown.call(this, event);
        rmbPressed = true;
    };
    
    var _TouchInput_onMouseUp = TouchInput._onMouseUp;
    TouchInput._onMouseUp = function(event) {
        if (_TouchInput_onMouseUp) _TouchInput_onMouseUp.call(this, event);
        if (event && event.button === 2) rmbPressed = false;
    };

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        if (_Game_Interpreter_pluginCommand) _Game_Interpreter_pluginCommand.call(this, command, args);
        var cmd = command.toUpperCase();
        if (cmd === 'ENABLETEXTFF') textFfDisabled = false;
        if (cmd === 'DISABLETEXTFF') textFfDisabled = true;
        if (cmd === 'DISABLENEXTTEXTFF') nextTextFfDisabled = true;
    };

    var _Scene_Map_isFastForward = Scene_Map.prototype.isFastForward;
    Scene_Map.prototype.isFastForward = function() {
        if (disableGlobalMoveRouteFF) return false;
        return _Scene_Map_isFastForward ? _Scene_Map_isFastForward.call(this) : false;
    };

    var _Window_Message_onEndOfText = Window_Message.prototype.onEndOfText;
    Window_Message.prototype.onEndOfText = function() {
        nextTextFfDisabled = false; 
        if (_Window_Message_onEndOfText) _Window_Message_onEndOfText.call(this);
    };

    Window_Message.prototype.updateShowFast = function() {
        if (isTextFfDisabled()) {
            this._showFast = false;
            return;
        }
        
        var triggered = false;
        if (skipOnRMB && rmbPressed) triggered = true;
        if (skipOnX && (Input.isPressed('escape') || Input.isPressed('cancel'))) triggered = true;
        
        if (triggered) {
            this._showFast = true;
        } else {
            this._showFast = false;
        }
    };
})();