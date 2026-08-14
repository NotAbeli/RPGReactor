//=============================================================================
// SuperDuperChoices.js
//=============================================================================

/*:
 * @plugindesc (v4.3) SuperDuperChoices. Кинематографичные выборы с авто-шрифтом, хитбоксами и аудио.
 * @author Korolev
 *
 * @param Visual Settings
 * @text === ВИЗУАЛ ===
 * @default 
 *
 * @param Gradient Align
 * @parent Visual Settings
 * @text Позиция градиента
 * @desc Откуда начинается черный градиент (Left - слева, Right - справа).
 * @type select
 * @option Left
 * @value Left
 * @option Right
 * @value Right
 * @default Right
 *
 * @param Gradient Width Percent
 * @parent Visual Settings
 * @text Ширина всей тьмы (%)
 * @desc Общая часть экрана, охваченная фоном (сплошная зона + сам градиент).
 * @type number
 * @default 50
 *
 * @param Gradient Solid Percent
 * @parent Visual Settings
 * @text Сплошная тьма (%)
 * @desc С какого процента экрана тьма начинает рассеиваться (абсолютно плотная зона).
 * @type number
 * @default 25
 *
 * @param Gradient Opacity
 * @parent Visual Settings
 * @text Плотность фона
 * @desc Максимальная непрозрачность градиента (0.0 - 1.0).
 * @type number
 * @decimals 2
 * @default 0.85
 *
 * @param Layout Settings
 * @text === РАСПОЛОЖЕНИЕ ===
 * @default 
 *
 * @param Frame Y Start
 * @parent Layout Settings
 * @text Начало рамки (Y)
 * @desc Верхняя граница зоны выборов. Работает ТОЛЬКО если есть сообщение.
 * @type number
 * @default 0
 *
 * @param Frame Y End
 * @parent Layout Settings
 * @text Конец рамки (Y)
 * @desc Нижняя граница зоны выборов. 0 = до самого низа экрана.
 * @type number
 * @default 0
 *
 * @param Debug Mode
 * @parent Layout Settings
 * @text Режим Дебага
 * @desc Включите, чтобы увидеть границы рамки (Y) красным цветом.
 * @type boolean
 * @default false
 *
 * @param Layout Mode
 * @parent Layout Settings
 * @text Режим по вертикали
 * @desc Как варианты распределяются внутри заданных рамок Y.
 * @type select
 * @option Равномерно по зоне (Делят на трети/четверти)
 * @value Equidistant
 * @option Списком по центру (Статично)
 * @value List
 * @default Equidistant
 *
 * @param Max Visible
 * @parent Layout Settings
 * @text Максимум на экране
 * @desc Сколько вариантов видно одновременно. Остальные скроллятся.
 * @type number
 * @default 6
 *
 * @param Choices Offset X
 * @parent Layout Settings
 * @text Смещение по X
 * @desc Ручная корректировка позиции текстов влево/вправо (в пикселях). 0 = ровно по центру тьмы.
 * @type number
 * @default 0
 *
 * @param Choice Spacing
 * @parent Layout Settings
 * @text Отступ (только для Списка)
 * @desc Расстояние между вариантами, если выбран режим "Списком".
 * @type number
 * @default 70
 *
 * @param Text Settings
 * @text === ТЕКСТ ===
 * @default 
 *
 * @param Symbol Settings
 * @text === СИМВОЛЫ И ЦВЕТ ===
 * @default 
 *
 * @param Symbol Active
 * @parent Symbol Settings
 * @text Символ выбранного
 * @desc Символ перед выбранным вариантом.
 * @type string
 * @default ♦
 *
 * @param Symbol Inactive
 * @parent Symbol Settings
 * @text Символ остальных
 * @desc Символ перед неактивными вариантами.
 * @type string
 * @default ♢
 *
 * @param Symbol Color Active
 * @parent Symbol Settings
 * @text Цвет символа (Выбран)
 * @desc HEX код цвета.
 * @type string
 * @default #ffaa00
 *
 * @param Symbol Color Inactive
 * @parent Symbol Settings
 * @text Цвет символа (Неактивен)
 * @desc HEX код цвета.
 * @type string
 * @default #888888
 *
 * @param Text Color Active
 * @parent Symbol Settings
 * @text Цвет текста (Выбран)
 * @desc HEX код цвета.
 * @type string
 * @default #ffffff
 *
 * @param Text Color Inactive
 * @parent Symbol Settings
 * @text Цвет текста (Неактивен)
 * @desc HEX код цвета.
 * @type string
 * @default #cccccc
 *
 * @param Animation Settings
 * @text === АНИМАЦИИ ===
 * @default 
 *
 * @param Scale Active
 * @parent Animation Settings
 * @text Масштаб выбранного
 * @desc Множитель размера для выбранного варианта.
 * @type number
 * @decimals 2
 * @default 1.15
 *
 * @param Scale Inactive
 * @parent Animation Settings
 * @text Масштаб остальных
 * @desc Множитель размера для неактивных вариантов.
 * @type number
 * @decimals 2
 * @default 0.85
 *
 * @param Opacity Inactive
 * @parent Animation Settings
 * @text Прозрачность остальных
 * @desc Прозрачность невыбранных вариантов (0 - 255).
 * @type number
 * @default 120
 *
 * @param Shift X
 * @parent Animation Settings
 * @text Сдвиг по X
 * @desc На сколько пикселей выдвигается выбранный вариант.
 * @type number
 * @default 30
 *
 * @param Audio Settings
 * @text === ЗВУКИ ===
 * @default 
 *
 * @param Cursor SE Name
 * @parent Audio Settings
 * @text Звук курсора (SE)
 * @desc Звук при наведении на вариант (мышь, колесо, стрелки). Оставьте пустым для стандартного.
 * @type file
 * @dir audio/se
 * @default Cursor1
 *
 * @param Cursor SE Volume
 * @parent Audio Settings
 * @text Громкость (Курсор)
 * @type number
 * @default 90
 *
 * @param Cursor SE Pitch
 * @parent Audio Settings
 * @text Тон (Курсор)
 * @type number
 * @default 100
 *
 * @param Cursor SE Pan
 * @parent Audio Settings
 * @text Панорама (Курсор)
 * @type number
 * @default 0
 *
 * @param Confirm SE Name
 * @parent Audio Settings
 * @text Звук выбора (SE)
 * @desc Звук при подтверждении выбора. Оставьте пустым для тишины.
 * @type file
 * @dir audio/se
 * @default Decision1
 *
 * @param Confirm SE Volume
 * @parent Audio Settings
 * @text Громкость (Выбор)
 * @type number
 * @default 90
 *
 * @param Confirm SE Pitch
 * @parent Audio Settings
 * @text Тон (Выбор)
 * @type number
 * @default 100
 *
 * @param Confirm SE Pan
 * @parent Audio Settings
 * @text Панорама (Выбор)
 * @type number
 * @default 0
 *
 * @param Cancel SE Name
 * @parent Audio Settings
 * @text Звук отмены (SE)
 * @desc Звук при отмене выбора. Оставьте пустым для тишины.
 * @type file
 * @dir audio/se
 * @default Cancel2
 *
 * @param Cancel SE Volume
 * @parent Audio Settings
 * @text Громкость (Отмена)
 * @type number
 * @default 90
 *
 * @param Cancel SE Pitch
 * @parent Audio Settings
 * @text Тон (Отмена)
 * @type number
 * @default 100
 *
 * @param Cancel SE Pan
 * @parent Audio Settings
 * @text Панорама (Отмена)
 * @type number
 * @default 0
 *
 * @param Timing Settings
 * @text === ТАЙМИНГИ И ОГРАНИЧЕНИЯ ===
 * @default 
 *
 * @param Wait Before
 * @parent Timing Settings
 * @text Пауза до появления
 * @desc Время (в кадрах) перед тем, как окно выборов начнет появляться. (60 кадров = 1 сек)
 * @type number
 * @default 0
 *
 * @param Wait After
 * @parent Timing Settings
 * @text Пауза после выбора
 * @desc Время (в кадрах) после исчезновения окна, перед продолжением игры.
 * @type number
 * @default 0
 *
 * @param Wheel Cooldown
 * @parent Timing Settings
 * @text Скорость колеса (Задержка)
 * @desc Ограничитель макс. скорости колесика в кадрах. Больше число = медленнее прокрутка. Рекомендуется 6-12.
 * @type number
 * @default 8
 *
 * @help
 * ============================================================================
 * SuperDuperChoices v4.3
 * ============================================================================
 * НОВОВВЕДЕНИЯ В v4.3:
 * 1. Добавлена возможность настраивать или полностью отключать звук при отмене 
 * выбора (нажатие Esc/ПКМ). Настройки добавлены в секцию "=== ЗВУКИ ===".
 * * НОВОВВЕДЕНИЯ В v4.2:
 * 1. Аппаратный Глушитель Звука (Global SoundManager Override): плагин теперь
 * жестко блокирует системные звуки движка во время кинематографичных выборов.
 * Это гарантирует, что стрелочки клавиатуры будут звучать абсолютно идентично
 * мыши и колесику, используя один общий настраиваемый аудио-контроллер.
 * 2. Очищена логика кулдауна колеса: исправлен баг двойного вычитания таймера,
 * который заставлял барабан дергаться при агрессивном скролле.
 */

var Imported = Imported || {};
Imported.SuperDuperChoices = true;

var SDC = SDC || {};
SDC.Params = PluginManager.parameters('SuperDuperChoices');

SDC.GradAlign = String(SDC.Params['Gradient Align'] || 'Right');
SDC.GradWidthPct = Number(SDC.Params['Gradient Width Percent'] || 50) / 100;
SDC.GradSolidPct = Number(SDC.Params['Gradient Solid Percent'] || 25) / 100;
SDC.GradOpac = Number(SDC.Params['Gradient Opacity'] || 0.85);

SDC.FrameY1 = Number(SDC.Params['Frame Y Start'] || 0);
SDC.FrameY2 = Number(SDC.Params['Frame Y End'] || 0);
SDC.DebugMode = String(SDC.Params['Debug Mode']) === 'true';

SDC.LayoutMode = String(SDC.Params['Layout Mode'] || 'Equidistant');
SDC.MaxVisible = Number(SDC.Params['Max Visible'] || 6);
SDC.ChoicesOffsetX = Number(SDC.Params['Choices Offset X'] || 0);
SDC.Spacing = Number(SDC.Params['Choice Spacing'] || 70);

SDC.SymAct = String(SDC.Params['Symbol Active'] || '♦');
SDC.SymInact = String(SDC.Params['Symbol Inactive'] || '♢');
SDC.SymColorAct = String(SDC.Params['Symbol Color Active'] || '#ffaa00');
SDC.SymColorInact = String(SDC.Params['Symbol Color Inactive'] || '#888888');
SDC.TxtColorAct = String(SDC.Params['Text Color Active'] || '#ffffff');
SDC.TxtColorInact = String(SDC.Params['Text Color Inactive'] || '#cccccc');

SDC.ScaleAct = Number(SDC.Params['Scale Active'] || 1.15);
SDC.ScaleInact = Number(SDC.Params['Scale Inactive'] || 0.85);
SDC.OpacInact = Number(SDC.Params['Opacity Inactive'] || 120);
SDC.ShiftX = Number(SDC.Params['Shift X'] || 30);

SDC.CursorSeName = String(SDC.Params['Cursor SE Name'] || '');
SDC.CursorSeVol = Number(SDC.Params['Cursor SE Volume'] || 90);
SDC.CursorSePitch = Number(SDC.Params['Cursor SE Pitch'] || 100);
SDC.CursorSePan = Number(SDC.Params['Cursor SE Pan'] || 0);

SDC.ConfirmSeName = String(SDC.Params['Confirm SE Name'] || '');
SDC.ConfirmSeVol = Number(SDC.Params['Confirm SE Volume'] || 90);
SDC.ConfirmSePitch = Number(SDC.Params['Confirm SE Pitch'] || 100);
SDC.ConfirmSePan = Number(SDC.Params['Confirm SE Pan'] || 0);

SDC.CancelSeName = String(SDC.Params['Cancel SE Name'] || '');
SDC.CancelSeVol = Number(SDC.Params['Cancel SE Volume'] || 90);
SDC.CancelSePitch = Number(SDC.Params['Cancel SE Pitch'] || 100);
SDC.CancelSePan = Number(SDC.Params['Cancel SE Pan'] || 0);

SDC.WaitBefore = Number(SDC.Params['Wait Before'] || 0);
SDC.WaitAfter = Number(SDC.Params['Wait After'] || 0);
SDC.WheelCooldown = Number(SDC.Params['Wheel Cooldown'] || 8);

SDC.getFrame = function() {
    var hasMsg = $gameMessage.hasText();
    var start = hasMsg ? SDC.FrameY1 : 0;
    var defaultEnd = SDC.FrameY2 > 0 ? SDC.FrameY2 : Graphics.boxHeight;
    var end = hasMsg ? defaultEnd : Graphics.boxHeight;
    return { y: start, h: end - start, end: end };
};

// ============================================================================
// ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК ЗВУКОВ ДВИЖКА (АППАРАТНЫЙ ГЛУШИТЕЛЬ)
// ============================================================================
var _SoundManager_playCursor = SoundManager.playCursor;
SoundManager.playCursor = function() {
    // Если активно кинематографичное окно выборов, мы БЛОКИРУЕМ оригинальный звук движка,
    // чтобы он не накладывался на наш кастомный контроллер.
    if ($gameMessage && $gameMessage.isChoice() && SceneManager._scene && SceneManager._scene._messageWindow && SceneManager._scene._messageWindow._choiceWindow) {
        if (SceneManager._scene._messageWindow._choiceWindow.isOpenAndActive() && !SceneManager._scene._messageWindow._choiceWindow._isDefaultMode) {
            return; // Глушим оригинальный вызов
        }
    }
    _SoundManager_playCursor.call(this);
};

var _SoundManager_playCancel = SoundManager.playCancel;
SoundManager.playCancel = function() {
    // Аналогичный перехватчик для звука отмены.
    if ($gameMessage && $gameMessage.isChoice() && SceneManager._scene && SceneManager._scene._messageWindow && SceneManager._scene._messageWindow._choiceWindow) {
        if (SceneManager._scene._messageWindow._choiceWindow.isOpenAndActive() && !SceneManager._scene._messageWindow._choiceWindow._isDefaultMode) {
            // Если звук отмены установлен - играем его, если пусто - полная тишина
            if (SDC.CancelSeName && SDC.CancelSeName.toLowerCase() !== 'none') {
                AudioManager.playSe({
                    name: SDC.CancelSeName,
                    volume: SDC.CancelSeVol,
                    pitch: SDC.CancelSePitch,
                    pan: SDC.CancelSePan
                });
            }
            return; // Глушим оригинальный вызов движка в любом случае
        }
    }
    _SoundManager_playCancel.call(this);
};

SDC.playCursorSe = function() {
    if (SDC.CursorSeName && SDC.CursorSeName.toLowerCase() !== 'none') {
        AudioManager.playSe({
            name: SDC.CursorSeName,
            volume: SDC.CursorSeVol,
            pitch: SDC.CursorSePitch,
            pan: SDC.CursorSePan
        });
    } else if (!SDC.CursorSeName) {
        // Если имя звука не задано, проигрываем стандартный, минуя наш же блок
        _SoundManager_playCursor.call(SoundManager);
    }
};

//=============================================================================
// НИЗКОУРОВНЕВЫЙ ПЕРЕХВАТ МЫШИ
//=============================================================================
(function() {
    TouchInput._sdcHoverX = 0;
    TouchInput._sdcHoverY = 0;
    
    document.addEventListener('mousemove', function(event) {
        TouchInput._sdcHoverX = Graphics.pageToCanvasX(event.pageX);
        TouchInput._sdcHoverY = Graphics.pageToCanvasY(event.pageY);
    });
})();

//=============================================================================
// ПЕРЕХВАТ ИНТЕРПРЕТАТОРА (Wait After)
//=============================================================================
(function() {
    var _SDC_Game_Interpreter_setupChoices = Game_Interpreter.prototype.setupChoices;
    Game_Interpreter.prototype.setupChoices = function(params) {
        if (_SDC_Game_Interpreter_setupChoices) _SDC_Game_Interpreter_setupChoices.call(this, params);
        
        if ($gameMessage._choiceCallback) {
            var originalCallback = $gameMessage._choiceCallback;
            var interpreter = this;
            $gameMessage.setChoiceCallback(function(n) {
                originalCallback.call(interpreter, n);
                if (SDC.WaitAfter > 0) {
                    interpreter.wait(SDC.WaitAfter); 
                } else {
                    interpreter.wait(1); 
                }
            });
        }
    };
})();

//=============================================================================
// WINDOW_CHOICELIST
//=============================================================================

(function() {

    var _Window_ChoiceList_start = Window_ChoiceList.prototype.start;
    Window_ChoiceList.prototype.start = function() {
        this._isDefaultMode = ($gameMessage.choicePositionType() === 1);
        
        this.openness = 0; 
        this._opening = false;
        this._closing = false;
        
        if (_Window_ChoiceList_start) _Window_ChoiceList_start.call(this);

        this._waitBeforeTimer = SDC.WaitBefore;
        this._isWaitingBefore = (this._waitBeforeTimer > 0);
        this._cinematicFade = 0; 
        
        this._sdcTopIdx = 0;
        this._lastIndex = 0;
        this._sdcIsProcessingOk = false;
        this._sdcHoverSelectFlag = false; 
        this._cursorSoundBlock = 0; 
        this._wheelScrollBlock = 0;

        if (this._isDefaultMode) {
            if (this._isWaitingBefore) {
                this.opacity = 0;
                this.contentsOpacity = 0;
            } else {
                this.opacity = 255;
                this.contentsOpacity = 255;
            }
            if (this._cineBg) this._cineBg.opacity = 0;
            if (this._cineSprites) {
                this._cineSprites.forEach(function(s) { this.removeChild(s); }, this);
                this._cineSprites = [];
            }
            return;
        }

        this.opacity = 0; 
        this.backOpacity = 0;
        this.frameOpacity = 0;
        this.contentsOpacity = 0; 
        
        this.downArrowVisible = false;
        this.upArrowVisible = false;
        
        this._lastTx = -1;
        this._lastTy = -1;
        this._sdcStartX = 0;
        this._sdcBlockWidth = 0;

        this.createCinematicBackground();
        this.createCinematicChoices();
    };

    Window_ChoiceList.prototype.isOpenAndActive = function() {
        if (!this._isDefaultMode) {
            return this.isOpen() && this.active && !this._opening && !this._closing && !this._isWaitingBefore && this._cinematicFade >= 255;
        }
        return Window_Selectable.prototype.isOpenAndActive.call(this) && !this._isWaitingBefore;
    };

    Window_ChoiceList.prototype.scrollDown = function() {
        if (this._isDefaultMode) { Window_Selectable.prototype.scrollDown.call(this); }
    };

    Window_ChoiceList.prototype.scrollUp = function() {
        if (this._isDefaultMode) { Window_Selectable.prototype.scrollUp.call(this); }
    };

    Window_ChoiceList.prototype.processWheel = function() {
        if (this._isDefaultMode) {
            Window_Selectable.prototype.processWheel.call(this);
            return;
        }
        
        if (this.isOpenAndActive() && this._wheelScrollBlock <= 0) {
            var N = this.maxItems();
            if (N <= SDC.MaxVisible) return;
            var V = Math.min(N, SDC.MaxVisible);

            var threshold = 20; 
            if (TouchInput.wheelY >= threshold) {
                this._sdcTopIdx = (this._sdcTopIdx + 1) % N;
                this.playCursorSound();
                this._wheelScrollBlock = SDC.WheelCooldown;
                
                var currentRel = this.getChoiceRelIndex(this.index());
                if (currentRel === N - 1) { 
                    this._sdcHoverSelectFlag = true;
                    this.select(this._sdcTopIdx);
                    this._sdcHoverSelectFlag = false;
                }

            } else if (TouchInput.wheelY <= -threshold) {
                this._sdcTopIdx = (this._sdcTopIdx - 1 + N) % N;
                this.playCursorSound();
                this._wheelScrollBlock = SDC.WheelCooldown;
                
                var currentRel = this.getChoiceRelIndex(this.index());
                if (currentRel === V) {
                    this._sdcHoverSelectFlag = true;
                    this.select((this._sdcTopIdx + V - 1) % N);
                    this._sdcHoverSelectFlag = false;
                }
            }
        }
    };
    
    var _Window_ChoiceList_processOk = Window_ChoiceList.prototype.processOk;
    Window_ChoiceList.prototype.processOk = function() {
        if (!this._isDefaultMode && this._sdcIsProcessingOk) return;
        if (!this._isDefaultMode) this._sdcIsProcessingOk = true;
        
        if (_Window_ChoiceList_processOk) {
            _Window_ChoiceList_processOk.call(this);
        } else {
            Window_Selectable.prototype.processOk.call(this);
        }
    };

    Window_ChoiceList.prototype.playOkSound = function() {
        if (this._isDefaultMode) {
            SoundManager.playOk();
            return;
        }
        
        if (SDC.ConfirmSeName) {
            AudioManager.playSe({
                name: SDC.ConfirmSeName,
                volume: SDC.ConfirmSeVol,
                pitch: SDC.ConfirmSePitch,
                pan: SDC.ConfirmSePan
            });
        }
    };
    
    // Единый контроллер звука для всех типов ввода (Стрелки, Колесо, Мышь)
    Window_ChoiceList.prototype.playCursorSound = function() {
        if (this._isDefaultMode) {
            if (Window_Selectable.prototype.playCursorSound) Window_Selectable.prototype.playCursorSound.call(this);
            return;
        }
        // Воспроизводим звук только если прошел кулдаун в 3 кадра, чтобы исключить заикания
        if (this._cursorSoundBlock <= 0) {
            SDC.playCursorSe();
            this._cursorSoundBlock = 3; 
        }
    };

    var _Window_ChoiceList_maxPageRows = Window_ChoiceList.prototype.maxPageRows;
    Window_ChoiceList.prototype.maxPageRows = function() {
        if (!this._isDefaultMode && SDC.MaxVisible > 0) {
            return SDC.MaxVisible; 
        }
        return _Window_ChoiceList_maxPageRows ? _Window_ChoiceList_maxPageRows.call(this) : 4;
    };

    var _Window_ChoiceList_updatePlacement = Window_ChoiceList.prototype.updatePlacement;
    Window_ChoiceList.prototype.updatePlacement = function() {
        if (this._isDefaultMode) {
            if (_Window_ChoiceList_updatePlacement) _Window_ChoiceList_updatePlacement.call(this);
        } else {
            this.width = 1;
            this.height = 1;
            this.x = 0;
            this.y = 0;
        }
    };

    var _Window_ChoiceList_itemRect = Window_ChoiceList.prototype.itemRect;
    Window_ChoiceList.prototype.itemRect = function(index) {
        if (this._isDefaultMode) {
            return _Window_ChoiceList_itemRect ? _Window_ChoiceList_itemRect.call(this, index) : new Rectangle(0,0,0,0);
        }
        return new Rectangle(0, 0, 0, 0); 
    };

    var _Window_ChoiceList_updateCursor = Window_ChoiceList.prototype.updateCursor;
    Window_ChoiceList.prototype.updateCursor = function() {
        if (this._isDefaultMode) {
            if (_Window_ChoiceList_updateCursor) _Window_ChoiceList_updateCursor.call(this);
        } else {
            this.setCursorRect(0, 0, 0, 0); 
        }
    };

    var _Window_ChoiceList_drawItem = Window_ChoiceList.prototype.drawItem;
    Window_ChoiceList.prototype.drawItem = function(index) {
        if (this._isDefaultMode) {
            if (_Window_ChoiceList_drawItem) _Window_ChoiceList_drawItem.call(this, index);
        }
    };

    var _Window_ChoiceList_drawAllItems = Window_ChoiceList.prototype.drawAllItems;
    Window_ChoiceList.prototype.drawAllItems = function() {
        if (this._isDefaultMode) {
            if (_Window_ChoiceList_drawAllItems) _Window_ChoiceList_drawAllItems.call(this);
        }
    };

    // --- INFINITE SCROLL LOGIC ---
    Window_ChoiceList.prototype.getChoiceRelIndex = function(index) {
        var N = this.maxItems();
        var V = Math.min(N, SDC.MaxVisible);
        if (N <= V) return index;
        return (index - this._sdcTopIdx + N) % N;
    };

    var _Window_ChoiceList_ensureCursorVisible = Window_ChoiceList.prototype.ensureCursorVisible;
    Window_ChoiceList.prototype.ensureCursorVisible = function() {
        if (this._isDefaultMode) {
            if (_Window_ChoiceList_ensureCursorVisible) {
                _Window_ChoiceList_ensureCursorVisible.call(this);
            } else if (Window_Selectable.prototype.ensureCursorVisible) {
                Window_Selectable.prototype.ensureCursorVisible.call(this);
            }
            return;
        }
        
        if (this._sdcHoverSelectFlag) {
            this._lastIndex = this.index();
            return;
        }
        
        var N = this.maxItems();
        var V = Math.min(N, SDC.MaxVisible);
        if (N <= V) return;
        
        var idx = this.index();
        if (idx < 0) return;
        
        if (this._lastIndex === undefined) this._lastIndex = 0;
        var diff = idx - this._lastIndex;
        var rel = (idx - this._sdcTopIdx + N) % N;
        
        if (rel >= V) {
            if (diff === 1 || diff === -(N - 1)) {
                this._sdcTopIdx = (this._sdcTopIdx + 1) % N; 
            } else if (diff === -1 || diff === (N - 1)) {
                this._sdcTopIdx = (this._sdcTopIdx - 1 + N) % N; 
            } else {
                this._sdcTopIdx = idx; 
            }
        }
        this._lastIndex = idx;
    };
    // -----------------------------

    var _Window_ChoiceList_update = Window_ChoiceList.prototype.update;
    Window_ChoiceList.prototype.update = function() {
        if (_Window_ChoiceList_update) _Window_ChoiceList_update.call(this);
        
        if (this._isDefaultMode) return;

        if (this._cursorSoundBlock > 0) this._cursorSoundBlock--;
        if (this._wheelScrollBlock > 0) this._wheelScrollBlock--; // Таймер колеса теперь корректно тикает в основном цикле

        this.opacity = 0;
        this.backOpacity = 0;
        this.frameOpacity = 0;
        this.contentsOpacity = 0;
        
        if (this._cineBg) {
            this._cineBg.opacity = this._isWaitingBefore ? 0 : this._cinematicFade;
        }
        
        if (this._cineSprites) {
            var masterOpacity = this._isWaitingBefore ? 0 : this._cinematicFade;
            this._cineSprites.forEach(function(s) {
                s.updateAnimation(masterOpacity);
            });
        }

        if (!this._closing && this.isOpenAndActive() && !this._sdcIsProcessingOk) {
            var tx = TouchInput._sdcHoverX;
            var ty = TouchInput._sdcHoverY;
            var hoveredIndex = -1;

            if (tx !== undefined && ty !== undefined) {
                var padX = 50 + Math.abs(SDC.ShiftX); 
                var isWithinX = (tx >= this._sdcStartX - padX && tx <= this._sdcStartX + this._sdcBlockWidth + padX);

                if (isWithinX) {
                    var num = this.maxItems();
                    var frame = SDC.getFrame(); 
                    var visibleCount = Math.min(num, SDC.MaxVisible);
                    
                    for (var i = 0; i < num; i++) {
                        var relIndex = this.getChoiceRelIndex(i);
                        if (relIndex < 0 || relIndex >= SDC.MaxVisible) continue;
                        
                        var itemY;
                        if (SDC.LayoutMode === 'Equidistant') {
                            itemY = frame.y + frame.h * (relIndex + 1) / (visibleCount + 1);
                        } else {
                            var startY = frame.y + (frame.h - visibleCount * SDC.Spacing) / 2;
                            itemY = startY + relIndex * SDC.Spacing + (SDC.Spacing / 2);
                        }
                        
                        var allowedDistY = (SDC.LayoutMode === 'Equidistant') ? (frame.h / (visibleCount + 1) / 2) : (SDC.Spacing / 2);
                        
                        if (Math.abs(ty - itemY) <= allowedDistY) {
                            hoveredIndex = i;
                            break;
                        }
                    }
                }
            }

            var mouseMoved = (this._lastTx !== tx || this._lastTy !== ty);
            
            if (mouseMoved) {
                this._lastTx = tx;
                this._lastTy = ty;
            }
            
            if (mouseMoved && hoveredIndex >= 0 && this.index() !== hoveredIndex) {
                this._sdcHoverSelectFlag = true; 
                this.select(hoveredIndex);
                this._sdcHoverSelectFlag = false;
                this.playCursorSound(); // Звук мыши тоже проходит через единый контроллер
            }

            if (TouchInput.isTriggered() && hoveredIndex >= 0) {
                if (this.index() !== hoveredIndex) {
                    this._sdcHoverSelectFlag = true;
                    this.select(hoveredIndex);
                    this._sdcHoverSelectFlag = false;
                }
                TouchInput.clear(); 
                this.processOk();
            }
        }
    };

    Window_ChoiceList.prototype.updateOpen = function() {
        if (this._opening) {
            if (this._waitBeforeTimer > 0) {
                this._waitBeforeTimer--;
                return;
            }
            this._isWaitingBefore = false;

            if (!this._isDefaultMode) {
                this.openness = 255;
                this._cinematicFade += 15;
                if (this._cinematicFade >= 255) {
                    this._cinematicFade = 255;
                    this._opening = false;
                }
            } else {
                this.opacity = 255;
                this.contentsOpacity = 255;
                this.openness += 32;
                if (this.openness >= 255) {
                    this.openness = 255;
                    this._opening = false;
                }
            }
        }
    };

    Window_ChoiceList.prototype.updateClose = function() {
        if (this._closing) {
            if (!this._isDefaultMode) {
                this.openness = 255; 
                this._cinematicFade -= 15;
                if (this._cinematicFade <= 0) {
                    this._cinematicFade = 0;
                    this._closing = false;
                    this.openness = 0; 
                }
            } else {
                this.openness -= 32;
                if (this.openness <= 0) {
                    this._closing = false;
                    this.openness = 0;
                }
            }
        }
    };

    Window_ChoiceList.prototype.createCinematicBackground = function() {
        if (!this._cineBg) {
            this._cineBg = new Sprite();
            this._cineBg.bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
            this._cineBg.opacity = 0;
        }
        
        this._cineBg.bitmap.clear();
        
        var W = Graphics.boxWidth;
        var H = Graphics.boxHeight;
        var totalW = Math.floor(W * SDC.GradWidthPct);
        var solidW = Math.floor(W * SDC.GradSolidPct);
        var fadeW = totalW - solidW;
        
        var colorEnd = 'rgba(0, 0, 0, ' + SDC.GradOpac + ')';
        var colorTransparent = 'rgba(0,0,0,0)';
        
        if (SDC.GradAlign === 'Left') {
            if (solidW > 0) this._cineBg.bitmap.fillRect(0, 0, solidW, H, colorEnd);
            if (fadeW > 0) this._cineBg.bitmap.gradientFillRect(solidW, 0, fadeW, H, colorEnd, colorTransparent, false);
        } else {
            if (fadeW > 0) this._cineBg.bitmap.gradientFillRect(W - totalW, 0, fadeW, H, colorTransparent, colorEnd, false);
            if (solidW > 0) this._cineBg.bitmap.fillRect(W - solidW, 0, solidW, H, colorEnd);
        }

        if (SDC.DebugMode) {
            var frame = SDC.getFrame();
            this._cineBg.bitmap.fillRect(0, frame.y, W, frame.h, 'rgba(255, 0, 0, 0.2)');
            this._cineBg.bitmap.fillRect(0, frame.y, W, 2, 'rgba(255, 0, 0, 0.9)');
            this._cineBg.bitmap.fillRect(0, frame.end - 2, W, 2, 'rgba(255, 0, 0, 0.9)');
        }

        var scene = SceneManager._scene;
        if (scene) {
            if (this._cineBg.parent) this._cineBg.parent.removeChild(this._cineBg);
            
            if (scene._msgBgSprite && scene.children.indexOf(scene._msgBgSprite) >= 0) {
                scene.addChildAt(this._cineBg, scene.children.indexOf(scene._msgBgSprite));
            } else if (scene._windowLayer && scene.children.indexOf(scene._windowLayer) >= 0) {
                scene.addChildAt(this._cineBg, scene.children.indexOf(scene._windowLayer));
            } else {
                scene.addChild(this._cineBg);
            }
        }
    };

    Window_ChoiceList.prototype.createCinematicChoices = function() {
        if (this._cineSprites) {
            this._cineSprites.forEach(function(s) { this.removeChild(s); }, this);
        }
        
        this._cineSprites = [];
        var choices = this._list; 
        var num = choices.length;

        var temp = new Bitmap(1, 1);
        temp.fontSize = this.standardFontSize(); 
        var maxSymW = Math.max(
            SDC.SymAct ? temp.measureTextWidth(SDC.SymAct + " ") : 0,
            SDC.SymInact ? temp.measureTextWidth(SDC.SymInact + " ") : 0
        );
        var maxTextW = 0;
        for (var i = 0; i < num; i++) {
            var cleanText = choices[i].name.replace(/\\C\[(\d+)\]/gi, "");
            var tw = temp.measureTextWidth(cleanText);
            if (tw > maxTextW) maxTextW = tw;
        }
        var totalBlockWidth = maxTextW + maxSymW + 10; 

        var W = Graphics.boxWidth;
        var solidW = Math.floor(W * SDC.GradSolidPct);
        var centerSolidX = (SDC.GradAlign === 'Left') ? (solidW / 2) : (W - (solidW / 2));
        var startBaseX = centerSolidX - (totalBlockWidth / 2) + SDC.ChoicesOffsetX;

        this._sdcStartX = startBaseX;
        this._sdcBlockWidth = totalBlockWidth;

        for (var i = 0; i < num; i++) {
            var sprite = new Sprite_CinematicChoice(this, i, choices[i].name, startBaseX);
            this._cineSprites.push(sprite);
            this.addChild(sprite); 
        }
    };

})();

//=============================================================================
// SPRITE_CINEMATICCHOICE (Спрайт отдельного варианта)
//=============================================================================

function Sprite_CinematicChoice() {
    this.initialize.apply(this, arguments);
}

Sprite_CinematicChoice.prototype = Object.create(Sprite.prototype);
Sprite_CinematicChoice.prototype.constructor = Sprite_CinematicChoice;

Sprite_CinematicChoice.prototype.initialize = function(windowObj, index, text, baseX) {
    Sprite.prototype.initialize.call(this);
    this._window = windowObj;
    this._index = index;
    this._text = text;
    this._isActive = null; 
    this._wasVisible = false;
    
    this.anchor.x = 0;   
    this.anchor.y = 0.5; 
    
    this._baseX = baseX;
    this._startXOffset = (SDC.GradAlign === 'Left') ? -40 : 40; 
    this.x = this._baseX + this._startXOffset;
    
    this.scale.x = SDC.ScaleInact;
    this.scale.y = SDC.ScaleInact;
    this.opacity = 0; 
    
    var N = this._window.maxItems();
    var V = Math.min(N, SDC.MaxVisible);
    var relIndex = this._window.getChoiceRelIndex(this._index);
    
    if (relIndex < V) {
        this._logicalIndex = relIndex;
    } else {
        var dTop = N - relIndex;
        var dBot = relIndex - V + 1;
        this._logicalIndex = (dTop <= dBot) ? -1 : V;
    }
    
    this.y = this.getLogicalY(this._logicalIndex); 
    
    var visIndex = Math.min(relIndex, SDC.MaxVisible);
    this._introDelay = visIndex * 5; 
    
    this.createBitmap();
};

Sprite_CinematicChoice.prototype.createBitmap = function() {
    var temp = new Bitmap(1, 1);
    var fSize = this._window.standardFontSize(); 
    temp.fontSize = fSize;
    
    this._colorCode = null;
    this._cleanText = this._text.replace(/\\C\[(\d+)\]/gi, function(match, p1) {
        this._colorCode = parseInt(p1);
        return "";
    }.bind(this));
    
    this._textW = temp.measureTextWidth(this._cleanText);
    this._symW1 = SDC.SymAct ? temp.measureTextWidth(SDC.SymAct + " ") : 0;
    this._symW2 = SDC.SymInact ? temp.measureTextWidth(SDC.SymInact + " ") : 0;
    
    this._maxSymW = Math.max(this._symW1, this._symW2);
    var maxW = this._textW + this._maxSymW;
    
    this.bitmap = new Bitmap(maxW + 40, fSize + 20);
};

Sprite_CinematicChoice.prototype.redrawBitmap = function() {
    this.bitmap.clear();
    var fSize = this._window.standardFontSize(); 
    this.bitmap.fontSize = fSize;
    this.bitmap.outlineWidth = 4;
    this.bitmap.outlineColor = 'rgba(0, 0, 0, 0.8)';
    
    var symStr = this._isActive ? (SDC.SymAct ? SDC.SymAct + " " : "") : (SDC.SymInact ? SDC.SymInact + " " : "");
    var symW = this._isActive ? this._symW1 : this._symW2;
    
    var symColor = this._isActive ? SDC.SymColorAct : SDC.SymColorInact;
    var txtColor = this._isActive ? SDC.TxtColorAct : SDC.TxtColorInact;
    
    if (this._colorCode !== null) {
        var overrideColor = this._window.textColor(this._colorCode);
        txtColor = overrideColor;
    }
    
    var textY = (this.bitmap.height - fSize) / 2;
    
    if (symStr) {
        this.bitmap.textColor = symColor;
        this.bitmap.drawText(symStr, 0, textY, this._maxSymW, fSize, 'left');
    }
    
    this.bitmap.textColor = txtColor;
    this.bitmap.drawText(this._cleanText, this._maxSymW, textY, this._textW + 10, fSize, 'left');
};

Sprite_CinematicChoice.prototype.getLogicalY = function(logicalIndex) {
    var N = this._window.maxItems();
    var V = Math.min(N, SDC.MaxVisible);
    var frame = SDC.getFrame(); 
    if (SDC.LayoutMode === 'Equidistant') {
        return frame.y + frame.h * (logicalIndex + 1) / (V + 1);
    } else {
        var startY = frame.y + (frame.h - V * SDC.Spacing) / 2;
        return startY + logicalIndex * SDC.Spacing + (SDC.Spacing / 2);
    }
};

Sprite_CinematicChoice.prototype.updateAnimation = function(masterOpacity) {
    var N = this._window.maxItems();
    var V = Math.min(N, SDC.MaxVisible);
    var relIndex = this._window.getChoiceRelIndex(this._index);
    var isVisible = (relIndex >= 0 && relIndex < V);
    
    var isSelected = (this._window.index() === this._index);
    var isClosing = this._window._closing;

    if (this._isActive !== isSelected) {
        this._isActive = isSelected;
        this.redrawBitmap();
    }

    if (this._prevRelIndex === undefined) {
        this._prevRelIndex = relIndex;
    }

    var diff = relIndex - this._prevRelIndex;
    if (diff < -N / 2) diff += N;
    else if (diff > N / 2) diff -= N;

    if (isVisible) {
        this._logicalIndex = relIndex;
        if (!this._wasVisible && !this._window._opening && !isClosing) {
            if (diff > 0) this.y = this.getLogicalY(-1);
            else if (diff < 0) this.y = this.getLogicalY(V);
        }
    } else {
        if (this._wasVisible) {
            if (diff > 0) this._logicalIndex = V;
            else if (diff < 0) this._logicalIndex = -1;
        }
    }

    this._wasVisible = isVisible;
    this._prevRelIndex = relIndex;

    var targetY = this.getLogicalY(this._logicalIndex);
    var targetScale = isSelected ? SDC.ScaleAct : SDC.ScaleInact;
    var targetOpacity = isSelected ? 255 : SDC.OpacInact;
    var targetX = isSelected ? (this._baseX + SDC.ShiftX) : this._baseX;

    if (!isVisible) {
        targetOpacity = 0;
    }

    if (this._window._opening && !isClosing) {
        if (this._introDelay > 0) {
            this._introDelay--;
            this.opacity = 0;
            this.x = this._baseX + this._startXOffset; 
            return; 
        }
    }

    if (isClosing) {
        targetOpacity = 0;
        targetX = this._baseX + this._startXOffset; 
    }

    targetOpacity = Math.min(targetOpacity, masterOpacity);

    var speedX = this._window._opening ? 0.08 : 0.2; 
    var speedY = 0.2;
    var speedScale = 0.2;
    var speedOpac = this._window._opening ? 0.08 : ((!isVisible || isClosing) ? 0.6 : 0.2); 

    this.scale.x += (targetScale - this.scale.x) * speedScale;
    this.scale.y = this.scale.x;
    this.opacity += (targetOpacity - this.opacity) * speedOpac;
    this.x += (targetX - this.x) * speedX;
    this.y += (targetY - this.y) * speedY; 
};