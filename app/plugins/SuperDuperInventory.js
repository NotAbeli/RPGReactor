/*:
 * @plugindesc (v13.03) Super Duper Inventory - HUD Maker Layer Sync.
 * @author Korolev
 *
 * @param --- SuperDuperCore ---
 * @default
 *
 * @note
 * Все координаты (Player X/Y, Chest X/Y, Hotbar Y, Custom Window X/Y)
 * могут быть пустыми — тогда они автоматически рассчитываются как % от
 * ширины/высоты экрана из плагина SuperDuperCore.
 * Если Core не установлен — используются значения по умолчанию 1280×720.
 *
 * @param --- Main Settings ---
 *
 * @param Open Trigger
 * @text Кнопка открытия
 * @desc Какую кнопку использовать для инвентаря?
 * @type select
 * @option Key "I" (Code 73)
 * @value key_i
 * @option Menu / Escape
 * @value menu
 * @default key_i
 *
 * @param Custom Key Code
 * @parent Open Trigger
 * @text Код клавиши (если "Key I")
 * @type number
 * @default 73
 *
 * @param Use Key
 * @text Кнопка использования
 * @desc Клавиша для использования предмета из активного слота.
 * @type string
 * @default e
 *
 * @param Disable Standard Menu
 * @text Отключить Меню
 * @desc Блокирует стандартное меню на Esc.
 * @type boolean
 * @default false
 *
 * @param RMB Variable ID
 * @text Переменная ПКМ
 * @desc Записывает ID предмета при правом клике (и при нажатии 1-5).
 * @type variable
 * @default 0
 *
 * @param Hotbar Watch Var
 * @text Переменная Хотбара (Опция)
 * @desc Если 0, будет использована переменная ПКМ.
 * @type variable
 * @default 0
 *
 * @param Free Slots Variable
 * @text Переменная Свободных Слотов
 * @desc ID переменной для записи количества пустых ячеек инвентаря.
 * @type variable
 * @default 0
 *
 * @param Max Slots Variable
 * @text Переменная Слотов
 * @desc ID переменной, хранящей лимит слотов.
 * @type variable
 * @default 0
 *
 * @param Default Max Slots
 * @text Слоты по умолчанию
 * @desc Значение, которое запишется в переменную при старте новой игры.
 * @type number
 * @default 10
 *
 * @param Drag Threshold
 * @text Порог перетаскивания
 * @type number
 * @default 12
 *
 * @param Global Volume
 * @text Общая Громкость %
 * @desc Множитель громкости для всех звуков плагина (0-100).
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param --- Configuration Structures ---
 *
 * @param Visual Settings
 * @text Настройки Визуала
 * @desc Настройка картинок, координат, шрифтов, хотбара и доп. окна.
 * @type struct<VisualConfig>
 * @default {"Player Bg":"InvBackground","Player Slot":"InvSlot","Player Cols":"5","Player Rows":"4","Player X":"50","Player Y":"50","Player Spacing":"40","Slot Offset X":"0","Slot Offset Y":"0","Icon Offset X":"0","Icon Offset Y":"0","Font Size":"14","Font Bold":"true","Font Outline":"true","Inv Count X":"12","Inv Count Y":"12","Locked Slot":"InvSlotLocked","Selection":"InvSelection","Active Selection":"InvActive","Hover Opacity":"255","Chest Bg":"ChestBackground","Chest Slot":"InvSlot","Chest Cols":"5","Chest Rows":"3","Chest X":"400","Chest Y":"50","Chest Spacing":"40","Hotbar Switch":"[\"0\"]","Hotbar Fade Speed":"15","Hotbar Y":"500","Hotbar Spacing":"40","Hotbar Scale":"1.2","Hotbar Font Size":"14","Hotbar Font Color":"#ffffff","Hotbar Num X":"-10","Hotbar Num Y":"10","Hotbar Count X":"12","Hotbar Count Y":"12","Custom Window Img":"","Custom Window X":"0","Custom Window Y":"0","Name X":"10","Name Y":"10","Name Align":"left","Name Font Size":"22","Desc X":"10","Desc Y":"40","Desc Width":"200","Desc Font Size":"18"}
 *
 * @param Sound Settings
 * @text Настройки Звука (Детально)
 * @desc Детальная настройка каждого звукового эффекта.
 * @type struct<AudioConfig>
 * @default {"Open":{"Name":"Open1","Volume":"90","Pitch":"100","Pan":"0"},"Close":{"Name":"Close1","Volume":"90","Pitch":"100","Pan":"0"},"Equip":{"Name":"Equip1","Volume":"90","Pitch":"100","Pan":"0"},"Pickup":{"Name":"Item3","Volume":"90","Pitch":"100","Pan":"0"},"Drop":{"Name":"Equip1","Volume":"90","Pitch":"100","Pan":"0"},"Error":{"Name":"Buzzer1","Volume":"90","Pitch":"100","Pan":"0"},"Cancel":{"Name":"Cancel1","Volume":"90","Pitch":"100","Pan":"0"},"Cursor":{"Name":"Cursor1","Volume":"90","Pitch":"100","Pan":"0"}}
 *
 * @command VisualChest
 * @text Открыть Сундук
 * @desc Открывает окно.
 * @arg name
 * @text ID Сундука
 * @type string
 *
 * @command VisualChestStored
 * @text Открыть Сундук (Stored)
 * @desc Открывает окно (аналог).
 * @arg name
 * @text ID Сундука
 * @type string
 */

/*~struct~VisualConfig:
 * @param --- Player ---
 * @param Player Bg
 * @type file
 * @dir img/pictures
 * @default InvBackground
 * @param Player Slot
 * @type file
 * @dir img/pictures
 * @default InvSlot
 * @param Player Cols
 * @type number
 * @default 5
 * @param Player Rows
 * @type number
 * @default 4
 * @param Player X
 * @type number
 * @default 50
 * @param Player Y
 * @type number
 * @default 50
 * @param Player Spacing
 * @type number
 * @default 40
 * @param Slot Offset X
 * @text Сдвиг Сетки X
 * @desc Сдвиг всей сетки слотов относительно фона.
 * @type number
 * @min -9999
 * @default 0
 * @param Slot Offset Y
 * @text Сдвиг Сетки Y
 * @type number
 * @min -9999
 * @default 0
 * @param Icon Offset X
 * @text Сдвиг Иконки X
 * @desc Внутри ячейки.
 * @type number
 * @min -9999
 * @default 0
 * @param Icon Offset Y
 * @text Сдвиг Иконки Y
 * @type number
 * @min -9999
 * @default 0
 * @param Font Size
 * @text Размер Шрифта
 * @type number
 * @default 14
 * @param Font Bold
 * @text Жирный Шрифт
 * @type boolean
 * @default true
 * @param Font Outline
 * @text Обводка Шрифта
 * @type boolean
 * @default true
 *
 * @param Inv Count X
 * @text Сдвиг Кол-ва X (Инвентарь)
 * @desc Сдвиг числа предметов относительно центра иконки.
 * @type number
 * @min -9999
 * @default 12
 *
 * @param Inv Count Y
 * @text Сдвиг Кол-ва Y (Инвентарь)
 * @desc Сдвиг числа предметов относительно центра иконки.
 * @type number
 * @min -9999
 * @default 12
 *
 * @param --- Custom Window ---
 * @param Custom Window Img
 * @text Картинка Доп. Окна
 * @desc PNG файл, отображаемый поверх фона инвентаря игрока.
 * @type file
 * @dir img/pictures
 * @param Custom Window X
 * @text Доп. Окно X
 * @desc Координата X относительно фона инвентаря.
 * @type number
 * @min -9999
 * @default 0
 * @param Custom Window Y
 * @text Доп. Окно Y
 * @desc Координата Y относительно фона инвентаря.
 * @type number
 * @min -9999
 * @default 0
 * @param Name X
 * @text Название X
 * @type number
 * @min -999
 * @default 10
 * @param Name Y
 * @text Название Y
 * @type number
 * @min -999
 * @default 10
 * @param Name Align
 * @text Выравнивание Названия
 * @type select
 * @option Левый край
 * @value left
 * @option По центру
 * @value center
 * @option Правый край
 * @value right
 * @default left
 * @param Name Font Size
 * @text Размер Шрифта Названия
 * @type number
 * @default 22
 * @param Desc X
 * @text Описание X
 * @type number
 * @min -999
 * @default 10
 * @param Desc Y
 * @text Описание Y
 * @type number
 * @min -999
 * @default 40
 * @param Desc Width
 * @text Лимит Строки
 * @desc Ширина текста до переноса.
 * @type number
 * @default 200
 * @param Desc Font Size
 * @text Размер Шрифта Описания
 * @type number
 * @default 18
 *
 * @param --- Chest ---
 * @param Chest Bg
 * @type file
 * @dir img/pictures
 * @default ChestBackground
 * @param Chest Slot
 * @type file
 * @dir img/pictures
 * @default InvSlot
 * @param Chest Cols
 * @type number
 * @default 5
 * @param Chest Rows
 * @type number
 * @default 3
 * @param Chest X
 * @type number
 * @default 400
 * @param Chest Y
 * @type number
 * @default 50
 * @param Chest Spacing
 * @type number
 * @default 40
 *
 * @param --- Hotbar ---
 * @param Hotbar Switch
 * @text Switches ID (Hide)
 * @desc Если хотя бы 1 ВКЛ - хотбар скрыт.
 * @type switch[]
 * @default ["0"]
 * @param Hotbar Fade Speed
 * @text Скорость затухания
 * @desc Скорость появления/исчезновения хотбара (1-255).
 * @type number
 * @min 1
 * @max 255
 * @default 15
 * @param Hotbar Y
 * @type number
 * @default 500
 * @param Hotbar Spacing
 * @type number
 * @default 40
 * @param Hotbar Scale
 * @desc Масштаб хотбара (1.2 = 120%)
 * @type number
 * @decimals 2
 * @default 1.20
 * @param Hotbar Background
 * @type file
 * @dir img/pictures
 * @param Hotbar Font Size
 * @type number
 * @default 14
 * @param Hotbar Font Color
 * @desc Hex код (например #ffffff).
 * @default #ffffff
 * @param Hotbar Num X
 * @text Сдвиг Номера (1-5) X
 * @type number
 * @min -100
 * @default -10
 * @param Hotbar Num Y
 * @text Сдвиг Номера (1-5) Y
 * @type number
 * @min -100
 * @default 10
 * @param Hotbar Count X
 * @text Сдвиг Кол-ва X
 * @type number
 * @min -100
 * @default 0
 * @param Hotbar Count Y
 * @text Сдвиг Кол-ва Y
 * @type number
 * @min -100
 * @default 10
 *
 * @param --- General ---
 * @param Locked Slot
 * @type file
 * @dir img/pictures
 * @default InvSlotLocked
 * @param Selection
 * @type file
 * @dir img/pictures
 * @default InvSelection
 * @param Active Selection
 * @text Активный Слот (ПКМ)
 * @desc Картинка для слота, выбранного на ПКМ.
 * @type file
 * @dir img/pictures
 * @default InvActive
 * @param Hover Opacity
 * @text Прозрачность наведения
 * @desc Прозрачность рамки при наведении курсора (0-255).
 * @type number
 * @min 0
 * @max 255
 * @default 255
 * @param Fade Speed
 * @type number
 * @default 35
 * @param Dimmer Opacity
 * @type number
 * @default 150
 * @param Tooltip Delay
 * @type number
 * @default 30
 * @param Tooltip Bg
 * @type file
 * @dir img/pictures
 */

/*~struct~AudioConfig:
 * @param Open
 * @type struct<SoundParam>
 * @default {"Name":"Open1","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Close
 * @type struct<SoundParam>
 * @default {"Name":"Close1","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Equip
 * @type struct<SoundParam>
 * @default {"Name":"Equip1","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Pickup
 * @type struct<SoundParam>
 * @default {"Name":"Item3","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Drop
 * @type struct<SoundParam>
 * @default {"Name":"Equip1","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Error
 * @type struct<SoundParam>
 * @default {"Name":"Buzzer1","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Cancel
 * @type struct<SoundParam>
 * @default {"Name":"Cancel1","Volume":"90","Pitch":"100","Pan":"0"}
 * @param Cursor
 * @type struct<SoundParam>
 * @default {"Name":"Cursor1","Volume":"90","Pitch":"100","Pan":"0"}
 */

/*~struct~SoundParam:
 * @param Name
 * @type file
 * @dir audio/se
 * @param Volume
 * @type number
 * @min 0
 * @max 100
 * @default 90
 * @param Pitch
 * @type number
 * @min 50
 * @max 150
 * @default 100
 * @param Pan
 * @type number
 * @min -100
 * @max 100
 * @default 0
 */

(function() {
    var parameters = PluginManager.parameters('SuperDuperInventory');

    var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
    var scrW = core ? core.screen.width : 1280;
    var scrH = core ? core.screen.height : 720;
    function pctX(p) { return Math.round(scrW * p / 100); }
    function pctY(p) { return Math.round(scrH * p / 100); }

    function parseStruct(str) {
        try { return JSON.parse(str || '{}'); } catch (e) { return {}; }
    }

    var Visuals = parseStruct(parameters['Visual Settings']);
    var SoundParams = parseStruct(parameters['Sound Settings']);

    function getSound(key) {
        var s = parseStruct(SoundParams[key]);
        return {
            name: s.Name || '',
            volume: Number(s.Volume || 90),
            pitch: Number(s.Pitch || 100),
            pan: Number(s.Pan || 0)
        };
    }

    var hbSwitchesParsed = [];
    if (Visuals['Hotbar Switch']) {
        try {
            var arr = JSON.parse(Visuals['Hotbar Switch']);
            if (Array.isArray(arr)) {
                for (var i = 0; i < arr.length; i++) {
                    var num = Number(arr[i]);
                    if (!isNaN(num) && num > 0) hbSwitchesParsed.push(num);
                }
            } else {
                var single = Number(Visuals['Hotbar Switch']);
                if (!isNaN(single) && single > 0) hbSwitchesParsed.push(single);
            }
        } catch (e) {
            var singleBackup = Number(Visuals['Hotbar Switch']);
            if (!isNaN(singleBackup) && singleBackup > 0) hbSwitchesParsed.push(singleBackup);
        }
    }

    var Config = {
        trigger: String(parameters['Open Trigger'] || 'key_i'),
        keyCode: Number(parameters['Custom Key Code'] || 73),
        useKey: String(parameters['Use Key'] || 'e').toLowerCase(),
        disableMenu: String(parameters['Disable Standard Menu']) === 'true',
        rmbVarId: Number(parameters['RMB Variable ID'] || 0),
        hotbarVarId: Number(parameters['Hotbar Watch Var'] || 0), 
        freeSlotsVarId: Number(parameters['Free Slots Variable'] || 0),
        maxSlotsVar: Number(parameters['Max Slots Variable'] || 0),
        defMaxSlots: Number(parameters['Default Max Slots'] || 10),
        dragThreshold: Number(parameters['Drag Threshold'] || 12),
        globalVolume: Number(parameters['Global Volume'] || 100),

        // Visuals (X/Y опущены → берутся как % от SuperDuperCore)
        pBg: Visuals['Player Bg'] || '',
        pSlot: Visuals['Player Slot'] || '',
        pCols: Number(Visuals['Player Cols'] || 5),
        pRows: Number(Visuals['Player Rows'] || 4),
        pX: Visuals['Player X'] ? Number(Visuals['Player X']) : pctX(4),
        pY: Visuals['Player Y'] ? Number(Visuals['Player Y']) : pctY(7),
        pSpace: Number(Visuals['Player Spacing'] || 40),

        // S43: separated row block - rows 2..4 may sit anywhere. Grid2 Bg
        // stays EMPTY by default: the player background image is sliced
        // fold-style (row 1 keeps the top 1/rows part, Grid2 renders the
        // bottom slice) so nothing duplicates when the blocks split.
        g2X: Visuals['Grid2 X'] ? Number(Visuals['Grid2 X']) :
            (Visuals['Player X'] ? Number(Visuals['Player X']) : pctX(4)),
        g2Y: Visuals['Grid2 Y'] ? Number(Visuals['Grid2 Y']) :
            (Visuals['Player Y'] ? Number(Visuals['Player Y']) : pctY(7)) +
            Number(Visuals['Player Spacing'] || 40),
        g2Bg: Visuals['Grid2 Bg'] || '',
        
        slotOffX: Number(Visuals['Slot Offset X'] || 0),
        slotOffY: Number(Visuals['Slot Offset Y'] || 0),
        iconOffX: Number(Visuals['Icon Offset X'] || 0),
        iconOffY: Number(Visuals['Icon Offset Y'] || 0),
        fontSize: Number(Visuals['Font Size'] || 14),
        fontBold: String(Visuals['Font Bold']) === 'true',
        fontOutline: String(Visuals['Font Outline']) === 'true',
        invCountX: Number(Visuals['Inv Count X'] || 12),
        invCountY: Number(Visuals['Inv Count Y'] || 12),

        // Custom Window
        customWinImg: Visuals['Custom Window Img'] || '',
        customWinX: Visuals['Custom Window X'] ? Number(Visuals['Custom Window X']) : pctX(78),
        customWinY: Visuals['Custom Window Y'] ? Number(Visuals['Custom Window Y']) : pctY(53),
        nameX: Number(Visuals['Name X'] || 10),
        nameY: Number(Visuals['Name Y'] || 10),
        nameAlign: String(Visuals['Name Align'] || 'left'),
        nameSize: Number(Visuals['Name Font Size'] || 22),
        descX: Number(Visuals['Desc X'] || 10),
        descY: Number(Visuals['Desc Y'] || 40),
        descW: Number(Visuals['Desc Width'] || 200),
        descSize: Number(Visuals['Desc Font Size'] || 18),
        
        cBg: Visuals['Chest Bg'] || '',
        cSlot: Visuals['Chest Slot'] || '',
        cCols: Number(Visuals['Chest Cols'] || 5),
        cRows: Number(Visuals['Chest Rows'] || 3),
        cX: Visuals['Chest X'] ? Number(Visuals['Chest X']) : pctX(31),
        cY: Visuals['Chest Y'] ? Number(Visuals['Chest Y']) : pctY(7),
        cSpace: Number(Visuals['Chest Spacing'] || 40),

        hbSwitches: hbSwitchesParsed,
        hbFadeSpeed: Number(Visuals['Hotbar Fade Speed'] || 15),
        hbY: Visuals['Hotbar Y'] ? Number(Visuals['Hotbar Y']) : pctY(69),
        hbSpace: Number(Visuals['Hotbar Spacing'] || 40),
        hbScale: Number(Visuals['Hotbar Scale'] || 1.2),
        hbBg: Visuals['Hotbar Background'] || '', 
        hbFontSize: Number(Visuals['Hotbar Font Size'] || 14),
        hbColor: Visuals['Hotbar Font Color'] || '#ffffff',
        hbNumX: Number(Visuals['Hotbar Num X'] || -10),
        hbNumY: Number(Visuals['Hotbar Num Y'] || 10),
        hbCountX: Number(Visuals['Hotbar Count X'] || 12),
        hbCountY: Number(Visuals['Hotbar Count Y'] || 12),

        locked: Visuals['Locked Slot'] || '',
        select: Visuals['Selection'] || '',
        activeSelect: Visuals['Active Selection'] || Visuals['Selection'] || '',
        hoverOpacity: Number(Visuals['Hover Opacity'] !== undefined ? Visuals['Hover Opacity'] : 255),
        fade: Number(Visuals['Fade Speed'] || 35),
        dimmer: Number(Visuals['Dimmer Opacity'] || 150),
        ttDelay: Number(Visuals['Tooltip Delay'] || 30),
        ttBg: Visuals['Tooltip Bg'] || '',

        // Sounds
        sndOpen:   getSound('Open'),
        sndClose:  getSound('Close'),
        sndEquip:  getSound('Equip'),
        sndPickup:  getSound('Pickup'),
        sndDrop:   getSound('Drop'),
        sndError:  getSound('Error'),
        sndCancel: getSound('Cancel'),
        sndCursor: getSound('Cursor')
    };

    function playSdiSound(type) {
        var s = null;
        switch (type) {
            case 'open': s = Config.sndOpen; break;
            case 'close': s = Config.sndClose; break;
            case 'equip': s = Config.sndEquip; break;
            case 'pickup': s = Config.sndPickup; break;
            case 'drop': s = Config.sndDrop; break;
            case 'error': s = Config.sndError; break;
            case 'cancel': s = Config.sndCancel; break;
            case 'cursor': s = Config.sndCursor; break;
        }
        if (s && s.name) {
            var finalVol = s.volume * (Config.globalVolume / 100);
            var se = {
                name: s.name,
                volume: finalVol,
                pitch: s.pitch,
                pan: s.pan
            };
            AudioManager.playSe(se);
        }
    }

    // ======================================================================
    // MOUSE TRACKER & LISTENER CLEANUP
    // ======================================================================
    
    if (typeof window.SDI_NativeMouse === 'undefined') {
        window.SDI_NativeMouse = { x: 0, y: 0 };
    }
    
    if (typeof window.SDI_MouseMoveHandler === 'function') {
        document.removeEventListener('mousemove', window.SDI_MouseMoveHandler);
    }
    if (typeof window.SDI_KeyDownHandler === 'function') {
        document.removeEventListener('keydown', window.SDI_KeyDownHandler);
    }
    if (typeof window.SDI_MouseDownHandler === 'function') {
        document.removeEventListener('mousedown', window.SDI_MouseDownHandler, true); 
        document.removeEventListener('mousedown', window.SDI_MouseDownHandler, false);
    }
    if (typeof window.SDI_WheelHandler === 'function') {
        document.removeEventListener('wheel', window.SDI_WheelHandler);
    }

    window.SDI_MouseMoveHandler = function(event) {
        var canvas = Graphics._canvas;
        if (canvas) {
            var rect = canvas.getBoundingClientRect();
            var scaleX = canvas.width / rect.width;
            var scaleY = canvas.height / rect.height;
            window.SDI_NativeMouse.x = (event.clientX - rect.left) * scaleX;
            window.SDI_NativeMouse.y = (event.clientY - rect.top) * scaleY;
        }
    };
    
    window.SDI_KeyDownHandler = function(event) {
        if (!SceneManager._scene || !(SceneManager._scene instanceof Scene_Map)) return;
        var key = event.key || ''; 
        var code = event.code || '';
        
        if (['1', '2', '3', '4', '5'].contains(key)) {
            var index = parseInt(key) - 1;
            SDI_Controller.setHotbarVar(index);
        } else if (key.toLowerCase() === Config.useKey || code.toLowerCase() === 'key' + Config.useKey) {
            SDI_Controller.useActiveItem();
        }
    };

    window.SDI_WheelHandler = function(event) {
        if (!SceneManager._scene || !(SceneManager._scene instanceof Scene_Map)) return;
        if (!$gamePlayer || !$gamePlayer.canMove()) return; 
        
        var delta = -Math.sign(event.deltaY); 
        if (delta !== 0) {
            SDI_Controller.scrollHotbar(delta, true);
        }
    };

    var _sdiClickLock = 0; 

    window.SDI_MouseDownHandler = function(event) {
        var now = Date.now();
        if (now - _sdiClickLock < 50) return; 
        _sdiClickLock = now;

        if (!SceneManager._scene || !(SceneManager._scene instanceof Scene_Map)) return;

        // Hotbar Interaction (Highest Priority)
        if (SceneManager._scene._sdiHotbar) {
            var hb = SceneManager._scene._sdiHotbar;
            var slotIdx = hb.checkHit(window.SDI_NativeMouse.x, window.SDI_NativeMouse.y);

            if (slotIdx >= 0) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                // Обработка ЛКМ (0), СКМ (1), ПКМ (2) по хотбару
                if (event.button === 0 || event.button === 1 || event.button === 2) {
                    SDI_Controller.setHotbarVar(slotIdx);
                }
                return;
            }
        }

        // Inventory RMB / Middle Click (Only If Open)
        if ((event.button === 2 || event.button === 1) && SDI_Controller.isOpen()) {
            var hP = -1;
            if (SceneManager._scene._sdiPlayer) {
                hP = SceneManager._scene._sdiPlayer.checkHit(window.SDI_NativeMouse.x, window.SDI_NativeMouse.y);
            }
            if (hP >= 0) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                SDI_Controller.onRmbClick(hP);
                return;
            }
        }
    };

    document.addEventListener('mousemove', window.SDI_MouseMoveHandler);
    document.addEventListener('keydown', window.SDI_KeyDownHandler);
    document.addEventListener('wheel', window.SDI_WheelHandler);
    document.addEventListener('mousedown', window.SDI_MouseDownHandler, true); 

    // ======================================================================
    // RPG MAKER INPUT MAPPING & PROTOTYPE GUARD
    // ======================================================================
    
    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        if (Config.trigger === 'key_i') Input.keyMapper[Config.keyCode] = 'sdi_inv';
    };

    if (!Scene_Map.prototype._sdi_callMenu_Hooked) {
        Scene_Map.prototype._sdi_callMenu_Hooked = true;
        var _Scene_Map_callMenu = Scene_Map.prototype.callMenu;
        Scene_Map.prototype.callMenu = function() {
            this.menuCalling = false; 
            if (Config.disableMenu) {
                return;
            }
            _Scene_Map_callMenu.call(this);
        };
    }

    var _Game_Player_canMove = Game_Player.prototype.canMove;
    Game_Player.prototype.canMove = function() {
        if (SDI_Controller.isOpen()) return false;
        return _Game_Player_canMove.call(this);
    };

    // ======================================================================
    // SELECTION MODE INTERCEPTOR (ГЛУБОКИЙ ПЕРЕХВАТ)
    // ======================================================================

    var _Game_Message_setItemChoice = Game_Message.prototype.setItemChoice;
    Game_Message.prototype.setItemChoice = function(variableId, itemType) {
        // Вызываем оригинал, чтобы Game_Message знал, что выбор идет,
        // это заставит движок ждать и не продолжать ивент.
        _Game_Message_setItemChoice.call(this, variableId, itemType);
        // Активируем наш инвентарь поверх всего
        SDI_Controller.startSelection(variableId, itemType);
    };

    // Блокируем стандартное окно выбора предметов навсегда
    var _Window_EventItem_start = Window_EventItem.prototype.start;
    Window_EventItem.prototype.start = function() {
        this.updatePlacement();
        this.refresh();
        // Мы не вызываем this.open() или this.activate(), окно остается скрытым
    };

    var _Window_EventItem_update = Window_EventItem.prototype.update;
    Window_EventItem.prototype.update = function() {
        _Window_EventItem_update.call(this);
        // Жестко подавляем любую видимость
        if (this.visible || this.active || this.isOpen()) {
            this.visible = false;
            this.active = false;
        }
    };

    // ======================================================================
    // LOGIC CONTROLLER
    // ======================================================================
    
    window.SDI_Controller = {
        isPlayerOpen: false,
        activeChestId: null,
        isInternalMove: false,
        currentOpacity: 0,
        
        activeHotbarSlot: -1, 
        
        dragItem: null,
        dragSourceType: null,
        dragSourceIdx: -1,
        dragIconIndex: 0,
        
        _shiftLock: false, 
        _lastScroll: 0,
        
        selectionMode: false,
        selectionVarId: 0,

        isOpen: function() { return this.isPlayerOpen || this.activeChestId !== null; },

        resetTouchState: function() {
            if (SceneManager._scene && SceneManager._scene._sdiClickConsumed !== undefined) {
                // Принудительно обнуляем состояние клика и координаты
                // чтобы предотвратить фантомные рывки (баг резкого перетаскивания)
                SceneManager._scene._sdiClickConsumed = true;
                SceneManager._scene._sdiDragging = false;
                SceneManager._scene._sdiDragOriginX = TouchInput.x;
                SceneManager._scene._sdiDragOriginY = TouchInput.y;
                if (SceneManager._scene._sdiDragSprite) {
                    SceneManager._scene._sdiDragSprite.visible = false;
                }
            }
        },

        closeAll: function() {
            if (this.isOpen()) playSdiSound('close');
            this.isPlayerOpen = false;
            this.activeChestId = null;
            if (this.selectionMode) {
                // Если закрыли (например, на Esc) без выбора - ставим 0
                $gameVariables.setValue(this.selectionVarId, 0); 
                $gameMessage._itemChoiceVariableId = 0; // Фикс вылета без clearItemChoice
                $gameMessage._itemChoiceItypeId = 0;
                this.selectionMode = false;
            }
            this.cancelDrag();
        },

        togglePlayer: function() {
            this.cancelDrag();
            this.resetTouchState();
            if (!this.isPlayerOpen) this.activeChestId = null;
            this.isPlayerOpen = !this.isPlayerOpen;
            playSdiSound(this.isPlayerOpen ? 'open' : 'close');
        },

        openChest: function(id) {
            this.cancelDrag();
            this.resetTouchState();
            this.activeChestId = id;
            this.isPlayerOpen = true; 
            playSdiSound('open');
        },
        
        startSelection: function(varId, itemType) {
            this.cancelDrag();
            this.resetTouchState();
            this.selectionMode = true;
            this.selectionVarId = varId;
            this.isPlayerOpen = true;
            this.activeChestId = null; 
            playSdiSound('open');
        },

        submitSelection: function(itemIndex) {
            var list = $gameParty._sdiGrid;
            var item = list[itemIndex];
            var val = item ? item.id : 0;
            
            $gameVariables.setValue(this.selectionVarId, val);
            $gameMessage._itemChoiceVariableId = 0; // Фикс вылета без clearItemChoice
            $gameMessage._itemChoiceItypeId = 0;
            this.selectionMode = false; // Отключаем мод ДО closeAll, чтобы он не затер переменную нулем
            this.closeAll();
        },
        
        getList: function(type) {
            if (type === 'player') return $gameParty._sdiGrid;
            if (type === 'chest') return $gameSystem.getChestItems(this.activeChestId);
            return null;
        },

        refreshAll: function() {
            this.sanitizeGrid(); 
            this.updateActiveVariable();
            this.updateFreeSlotsVariable();
            if (SceneManager._scene) {
                if (SceneManager._scene._sdiPlayer) SceneManager._scene._sdiPlayer.refresh();
                if (SceneManager._scene._sdiChest) SceneManager._scene._sdiChest.refresh();
                if (SceneManager._scene._sdiHotbar) SceneManager._scene._sdiHotbar.refresh();
            }
        },

        updateActiveVariable: function() {
            var targetVar = Config.hotbarVarId > 0 ? Config.hotbarVarId : Config.rmbVarId;
            if (targetVar > 0) {
                var grid = $gameParty._sdiGrid || [];
                var val = 0;
                if (this.activeHotbarSlot !== -1 && this.activeHotbarSlot >= 0 && this.activeHotbarSlot < 5) {
                    var item = grid[this.activeHotbarSlot];
                    val = item ? item.id : 0;
                }
                $gameVariables.setValue(targetVar, val);
            }
        },

        updateFreeSlotsVariable: function() {
            if (Config.freeSlotsVarId > 0 && $gameParty && $gameParty._sdiGrid) {
                var limit = $gameParty.sdiMaxUnlocked();
                var freeCount = 0;
                for (var i = 0; i < limit; i++) {
                    if (!$gameParty._sdiGrid[i]) freeCount++;
                }
                $gameVariables.setValue(Config.freeSlotsVarId, freeCount);
            }
        },

        sanitizeGrid: function() {
            if (!$gameParty._sdiGrid) return;
            for (var i = 0; i < $gameParty._sdiGrid.length; i++) {
                var item = $gameParty._sdiGrid[i];
                if (item && DataManager.isItem(item) && item.itypeId > 2) {
                    $gameParty._sdiGrid[i] = null;
                }
            }
        },

        checkTrigger: function() {
            if (Config.trigger === 'key_i') {
                return Input.isTriggered('sdi_inv');
            } else {
                return Input.isTriggered('menu') || (Input.isTriggered('escape') && !this.isOpen()) || TouchInput.isCancelled();
            }
        },

        scrollHotbar: function(direction, isSilent) {
            var now = Date.now();
            if (this._lastScroll && now - this._lastScroll < 50) return;
            this._lastScroll = now;

            var newSlot = this.activeHotbarSlot + direction;
            if (this.activeHotbarSlot === -1) {
                newSlot = direction > 0 ? 0 : 4;
            } else {
                if (newSlot > 4) newSlot = 0;
                if (newSlot < 0) newSlot = 4;
            }
            
            this.forceHotbarVar(newSlot, isSilent);
        },

        forceHotbarVar: function(slotIndex, isSilent) {
            if (slotIndex < 0 || slotIndex > 4) return;
            this.activeHotbarSlot = slotIndex;
            if ($gameSystem) $gameSystem._sdiActiveHotbarSlot = this.activeHotbarSlot;
            if (!isSilent) playSdiSound('cursor');
            this.updateActiveVariable();
            if (SceneManager._scene && SceneManager._scene._sdiHotbar) {
                SceneManager._scene._sdiHotbar.refresh();
            }
            if (SceneManager._scene && SceneManager._scene._sdiPlayer) {
                SceneManager._scene._sdiPlayer.refresh();
            }
        },

        setHotbarVar: function(slotIndex) {
            if (slotIndex < 0 || slotIndex > 4) return;
            
            if (this.activeHotbarSlot === slotIndex) {
                this.activeHotbarSlot = -1;
                if ($gameSystem) $gameSystem._sdiActiveHotbarSlot = -1;
                playSdiSound('cancel');
                this.updateActiveVariable();
                if (SceneManager._scene && SceneManager._scene._sdiHotbar) {
                    SceneManager._scene._sdiHotbar.refresh();
                }
                if (SceneManager._scene && SceneManager._scene._sdiPlayer) {
                    SceneManager._scene._sdiPlayer.refresh();
                }
            } else {
                this.forceHotbarVar(slotIndex, false);
            }
        },

        clearHotbarVar: function() {
            var targetVar = Config.hotbarVarId > 0 ? Config.hotbarVarId : Config.rmbVarId;
            this.activeHotbarSlot = -1;
            if ($gameSystem) $gameSystem._sdiActiveHotbarSlot = -1;
            if (targetVar > 0) {
                $gameVariables.setValue(targetVar, 0);
                playSdiSound('cancel');
            }
        },

        useActiveItem: function() {
            if ($gameMessage.isBusy() || $gameMap.isEventRunning() || this.isOpen()) return;
            if (this.activeHotbarSlot < 0) return; 
            this.useItemFromSlot(this.activeHotbarSlot);
        },
        
        useItemFromSlot: function(index) {
            if ($gameMessage.isBusy() || $gameMap.isEventRunning()) return;
            
            var item = $gameParty._sdiGrid[index];
            if (!item || !DataManager.isItem(item)) {
                playSdiSound('error');
                return;
            }
            
            var user = $gameParty.leader();
            if (!user || !user.canUse(item)) {
                playSdiSound('error');
                return;
            }
            
            var action = new Game_Action(user);
            action.setItemObject(item);
            var canApply = false;
            
            if (action.isForFriend()) {
                if (action.isForAll()) {
                    canApply = $gameParty.members().some(function(target) { return action.testApply(target); });
                } else {
                    canApply = action.testApply(user);
                }
            } else {
                canApply = true;
            }
            
            if (!canApply) {
                playSdiSound('error');
                return;
            }
            
            user.useItem(item); 
            
            if (action.isForFriend()) {
                if (action.isForAll()) {
                    $gameParty.members().forEach(function(target) {
                        action.apply(target);
                    });
                } else {
                    action.apply(user);
                }
            }
            action.applyGlobal(); 
            
            playSdiSound('equip');
            this.refreshAll();
            
            // Закрываем инвентарь, если предмет запускает общее событие
            if (item.effects.some(function(effect) { return effect.code === Game_Action.EFFECT_COMMON_EVENT; })) {
                this.closeAll();
            }
        },
        
        cancelDrag: function() {
            this.dragItem = null;
            this.dragSourceType = null;
            this.dragSourceIdx = -1;
            this.refreshAll();
            
            // Жестко зачищаем фантомные курсоры на сцене
            if (SceneManager._scene && SceneManager._scene._sdiDragging !== undefined) {
                SceneManager._scene._sdiDragging = false;
                if (SceneManager._scene._sdiDragSprite) {
                    SceneManager._scene._sdiDragSprite.visible = false;
                }
            }
        },

        onRmbClick: function(index) {
            if (!$gameParty._sdiGrid || index < 0 || index >= $gameParty._sdiGrid.length) return;
            
            if (index >= Config.pCols) {
                var grid = $gameParty._sdiGrid;
                var itemToInsert = grid[index]; 
                
                if (!itemToInsert) return; 

                grid[index] = null;

                for (var i = 0; i < 5; i++) {
                    var currentItem = grid[i];
                    grid[i] = itemToInsert;
                    if (!currentItem) {
                        itemToInsert = null;
                        break;
                    }
                    itemToInsert = currentItem;
                }

                if (itemToInsert) {
                    grid[index] = itemToInsert;
                }

                SDI_Controller.refreshAll();

            } else {
                this.setHotbarVar(index);
            }
        }
    };

    // ======================================================================
    // DATA MANAGEMENT
    // ======================================================================

    // Функция упаковки предмета для сохранения в файл (облегчает вес сохранения)
    function sdiPackItem(item) {
        if (!item) return null;
        if (DataManager.isWeapon(item)) return { type: 'weapon', id: item.id };
        if (DataManager.isArmor(item)) return { type: 'armor', id: item.id };
        if (DataManager.isItem(item)) return { type: 'item', id: item.id };
        return null;
    }

    // Функция распаковки предмета из файла сохранения (возвращает ссылку из базы)
    function sdiUnpackItem(packed) {
        if (!packed) return null;
        if (packed.name !== undefined && packed.iconIndex !== undefined) return packed; // Старые сохранения без упаковки
        if (packed.type === 'weapon') return $dataWeapons[packed.id] || null;
        if (packed.type === 'armor') return $dataArmors[packed.id] || null;
        if (packed.type === 'item') return $dataItems[packed.id] || null;
        return null;
    }

    var _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function() {
        _DataManager_setupNewGame.call(this);
        if (Config.maxSlotsVar > 0) {
            $gameVariables.setValue(Config.maxSlotsVar, Config.defMaxSlots);
        }
        $gameSystem._sdiChests = {};
        $gameSystem._sdiActiveHotbarSlot = -1;
        SDI_Controller.activeHotbarSlot = -1;
        SDI_Controller.updateFreeSlotsVariable();
        SDI_Controller.updateActiveVariable();
    };

    // Перехватываем процесс сохранения, чтобы запаковать предметы перед записью в файл
    var _DataManager_saveGameWithoutRescue = DataManager.saveGameWithoutRescue;
    DataManager.saveGameWithoutRescue = function(savefileId) {
        var originalGrid = $gameParty ? $gameParty._sdiGrid : null;
        var originalChests = $gameSystem ? $gameSystem._sdiChests : null;

        try {
            if ($gameParty && $gameParty._sdiGrid) {
                $gameParty._sdiGrid = originalGrid.map(sdiPackItem);
            }
            if ($gameSystem && $gameSystem._sdiChests) {
                $gameSystem._sdiChests = {};
                for (var key in originalChests) {
                    $gameSystem._sdiChests[key] = originalChests[key].map(function(slot) {
                        return slot ? { item: sdiPackItem(slot.item), amount: slot.amount } : null;
                    });
                }
            }
            return _DataManager_saveGameWithoutRescue.call(this, savefileId);
        } finally {
            // Обязательно восстанавливаем живые данные в текущей игре, даже если сохранение провалилось
            if ($gameParty) $gameParty._sdiGrid = originalGrid;
            if ($gameSystem) $gameSystem._sdiChests = originalChests;
        }
    };

    var _DataManager_extractSaveContents = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents.call(this, contents);
        
        if ($gameSystem._sdiActiveHotbarSlot !== undefined) {
            SDI_Controller.activeHotbarSlot = $gameSystem._sdiActiveHotbarSlot;
        } else {
            SDI_Controller.activeHotbarSlot = -1;
        }

        // Распаковка сетки игрока при загрузке
        if ($gameParty && $gameParty._sdiGrid) {
            $gameParty._sdiGrid = $gameParty._sdiGrid.map(function(packedItem) {
                return sdiUnpackItem(packedItem);
            });
        }

        // Распаковка сундуков при загрузке
        if ($gameSystem && $gameSystem._sdiChests) {
            for (var key in $gameSystem._sdiChests) {
                var chest = $gameSystem._sdiChests[key];
                if (Array.isArray(chest)) {
                    $gameSystem._sdiChests[key] = chest.map(function(slot) {
                        if (!slot) return null;
                        var unpacked = sdiUnpackItem(slot.item);
                        if (!unpacked) return null; // Если предмет удален из базы, слот станет пустым
                        return { item: unpacked, amount: slot.amount };
                    });
                }
            }
        }

        SDI_Controller.updateFreeSlotsVariable();
        SDI_Controller.updateActiveVariable();
    };

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._sdiChests = {}; 
    };

    Game_System.prototype.getChestItems = function(chestId) {
        if (!this._sdiChests[chestId]) {
            var capacity = Config.cCols * Config.cRows;
            this._sdiChests[chestId] = new Array(capacity).fill(null);
        }
        return this._sdiChests[chestId];
    };

    Game_System.prototype.addItemToChest = function(chestId, item, amount) {
        var chest = this.getChestItems(chestId);
        for (var i = 0; i < chest.length; i++) {
            if (chest[i] === null) {
                chest[i] = { item: item, amount: amount };
                return true;
            }
        }
        return false;
    };

    var _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.call(this);
        this._sdiGrid = [];
        this._sdiCapacity = Config.pCols * Config.pRows;
    };

    Game_Party.prototype.sdiMaxUnlocked = function() {
        if (Config.maxSlotsVar > 0) return $gameVariables.value(Config.maxSlotsVar);
        return Config.defMaxSlots;
    };

    var _Game_Party_gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
        if ($gameTemp._sdiSuppressMog) return;

        if (SDI_Controller.activeChestId !== null && !SDI_Controller.isInternalMove && item && amount > 0) {
            $gameSystem.addItemToChest(SDI_Controller.activeChestId, item, amount);
            SDI_Controller.refreshAll();
            return; 
        }

        _Game_Party_gainItem.call(this, item, amount, includeEquip);
        if (item && amount > 0) this._sdiDistribute(item, amount);
        else if (item && amount < 0) this._sdiRemove(item, Math.abs(amount));
        
        SDI_Controller.updateFreeSlotsVariable();
        SDI_Controller.updateActiveVariable(); 

        if (SceneManager._scene && SceneManager._scene._sdiHotbar) {
            SceneManager._scene._sdiHotbar.refresh();
        }
    };

    Game_Party.prototype._sdiDistribute = function(item, amount) {
        if (DataManager.isItem(item) && item.itypeId > 2) return; 
        
        if (SDI_Controller.isInternalMove) return;

        var alreadyInSlot = -1;
        for (var i = 0; i < this._sdiGrid.length; i++) {
            if (this._sdiGrid[i] && this._sdiGrid[i].id === item.id && 
                this._checkType(this._sdiGrid[i], item)) {
                alreadyInSlot = i;
                break;
            }
        }
        if (alreadyInSlot !== -1) return;

        var limit = Math.min(this.sdiMaxUnlocked(), this._sdiCapacity);
        if (Config.maxSlotsVar === 0) limit = this._sdiCapacity;

        for (var i = 0; i < limit; i++) {
            if (!this._sdiGrid[i]) {
                this._sdiGrid[i] = item;
                return;
            }
        }
    };

    Game_Party.prototype._sdiRemove = function(item, amount) {
        if (this.numItems(item) <= 0) {
            for (var i = 0; i < this._sdiGrid.length; i++) {
                if (this._sdiGrid[i] === item) {
                    this._sdiGrid[i] = null;
                    return;
                }
            }
        }
    };

    Game_Party.prototype._checkType = function(item1, item2) {
        if (DataManager.isItem(item1) && DataManager.isItem(item2)) return true;
        if (DataManager.isWeapon(item1) && DataManager.isWeapon(item2)) return true;
        if (DataManager.isArmor(item1) && DataManager.isArmor(item2)) return true;
        return false;
    };

    // ======================================================================
    // COMMAND INTERCEPTION
    // ======================================================================
    
    function sdi_intercept(type, params) {
        if (SDI_Controller.activeChestId !== null && params[1] === 0) {
            $gameTemp._sdiSuppressMog = true;
            var val = this.operateValue(params[1], params[2], params[3]);
            var item = null;
            if (type === 'item') item = $dataItems[params[0]];
            if (type === 'weapon') item = $dataWeapons[params[0]];
            if (type === 'armor') item = $dataArmors[params[0]];
            
            if (item && val > 0) {
                $gameSystem.addItemToChest(SDI_Controller.activeChestId, item, val);
                SDI_Controller.refreshAll();
            }
            $gameTemp._sdiSuppressMog = false;
            if (!this.sdiCheckNextIsItem()) this.setWaitMode('sdi_chest');
            return true;
        }
        return false;
    }

    var _Game_Interpreter_command126 = Game_Interpreter.prototype.command126;
    Game_Interpreter.prototype.command126 = function() {
        if (sdi_intercept.call(this, 'item', this._params)) return true;
        return _Game_Interpreter_command126.call(this);
    };

    var _Game_Interpreter_command127 = Game_Interpreter.prototype.command127;
    Game_Interpreter.prototype.command127 = function() {
        if (sdi_intercept.call(this, 'weapon', this._params)) return true;
        return _Game_Interpreter_command127.call(this);
    };

    var _Game_Interpreter_command128 = Game_Interpreter.prototype.command128;
    Game_Interpreter.prototype.command128 = function() {
        if (sdi_intercept.call(this, 'armor', this._params)) return true;
        return _Game_Interpreter_command128.call(this);
    };

    Game_Interpreter.prototype.sdiCheckNextIsItem = function() {
        var index = this._index + 1;
        while (index < this._list.length) {
            var c = this._list[index];
            if (c.code === 108 || c.code === 408) index++;
            else if ([126, 127, 128].contains(c.code)) return true;
            else return false;
        }
        return false;
    };

    // ФИКС ОЖИДАНИЯ ИВЕНТОВ
    var _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === 'sdi_chest') {
            if (this.sdiCheckNextIsItem()) { this._waitMode = ''; return false; }
            var waiting = SDI_Controller.isOpen();
            if (!waiting) this._waitMode = '';
            return waiting;
        }
        return _Game_Interpreter_updateWaitMode.call(this);
    };
    
    // ======================================================================
    // TRANSFER LOGIC
    // ======================================================================

    SDI_Controller.swap = function(sourceType, sourceIdx, targetType, targetIdx) {
        if (targetType === 'player' && Config.maxSlotsVar > 0) {
            if (targetIdx >= $gameParty.sdiMaxUnlocked()) {
                playSdiSound('error'); return;
            }
        }

        var sourceList = this.getList(sourceType);
        var targetList = this.getList(targetType);
        var srcObj = sourceList[sourceIdx];
        var tgtObj = targetList[targetIdx];

        if (!srcObj && !tgtObj) return;

        if (sourceType === targetType) {
            sourceList[sourceIdx] = tgtObj;
            sourceList[targetIdx] = srcObj;
            SDI_Controller.refreshAll();
            return;
        }

        this.isInternalMove = true;
        try {
            if (sourceType === 'player' && targetType === 'chest') {
                if (!srcObj) return;
                if (tgtObj) { playSdiSound('error'); return; }

                var amount = $gameParty.numItems(srcObj);
                targetList[targetIdx] = { item: srcObj, amount: amount };
                $gameParty._sdiGrid[sourceIdx] = null;
                $gameParty.loseItem(srcObj, amount);
            }
            else if (sourceType === 'chest' && targetType === 'player') {
                if (!srcObj) return;
                if (tgtObj) { playSdiSound('error'); return; }

                var itemData = srcObj.item;
                var amountData = srcObj.amount;
                
                var existingIdx = $gameParty._sdiGrid.indexOf(itemData);
                sourceList[sourceIdx] = null;
                
                if (existingIdx !== -1) {
                    $gameParty.gainItem(itemData, amountData);
                } else {
                    $gameParty._sdiGrid[targetIdx] = itemData;
                    $gameParty.gainItem(itemData, amountData);
                }
            }
            SDI_Controller.refreshAll();
        } finally {
            this.isInternalMove = false;
        }
    };

    SDI_Controller.quickTransfer = function(sourceType, sourceIdx) {
        if (this.selectionMode) {
            if (sourceType === 'player') {
                this.submitSelection(sourceIdx);
            }
            return;
        }

        if (this._shiftLock) return;
        this._shiftLock = true;
        setTimeout(function() { SDI_Controller._shiftLock = false; }, 200);

        if (this.activeChestId === null) return;

        var targetType = (sourceType === 'player') ? 'chest' : 'player';
        var sourceList = this.getList(sourceType);
        var targetList = this.getList(targetType);
        
        if (!sourceList[sourceIdx]) return;

        var targetIdx = -1;
        var limit = (targetType === 'player') ? $gameParty.sdiMaxUnlocked() : targetList.length;
        if (Config.maxSlotsVar === 0 && targetType === 'player') limit = $gameParty._sdiCapacity;

        for (var i = 0; i < limit; i++) {
            if (!targetList[i]) {
                targetIdx = i;
                break;
            }
        }

        if (targetIdx === -1) {
            playSdiSound('error');
            return;
        }

        this.swap(sourceType, sourceIdx, targetType, targetIdx);
        playSdiSound('equip');
    };

    // ======================================================================
    // SPRITES
    // ======================================================================

    function Sprite_SDI_Inventory() { this.initialize.apply(this, arguments); }
    Sprite_SDI_Inventory.prototype = Object.create(Sprite.prototype);
    Sprite_SDI_Inventory.prototype.constructor = Sprite_SDI_Inventory;

    Sprite_SDI_Inventory.prototype.initialize = function(type) {
        Sprite.prototype.initialize.call(this);
        this._type = type; 
        this.visible = false;
        this.opacity = 0; 
        
        var cols = (type === 'player') ? Config.pCols : Config.cCols;
        var rows = (type === 'player') ? Config.pRows : Config.cRows;
        var space = (type === 'player') ? Config.pSpace : Config.cSpace;
        var baseX = (type === 'player') ? Config.pX : Config.cX;
        var baseY = (type === 'player') ? Config.pY : Config.cY;
        var slotImg = (type === 'player') ? Config.pSlot : Config.cSlot;
        var bgImg = (type === 'player') ? Config.pBg : Config.cBg;

        this._layout = { cols: cols, rows: rows, space: space, x: baseX, y: baseY, slot: slotImg, bg: bgImg };
        
        this.createBackground();
        
        if (type === 'player' && Config.customWinImg) {
            this._customSprite = new Sprite(ImageManager.loadPicture(Config.customWinImg));
            this._customSprite.x = Config.customWinX;
            this._customSprite.y = Config.customWinY;
            this.addChild(this._customSprite);
            
            this._nameSprite = new Sprite(new Bitmap(Config.descW, 40));
            this._nameSprite.x = Config.nameX;
            this._nameSprite.y = Config.nameY;
            this._nameSprite.bitmap.fontSize = Config.nameSize;
            this._customSprite.addChild(this._nameSprite);

            this._descSprite = new Sprite(new Bitmap(Config.descW, 400));
            this._descSprite.x = Config.descX;
            this._descSprite.y = Config.descY;
            this._descSprite.bitmap.fontSize = Config.descSize;
            this._customSprite.addChild(this._descSprite);
        }

        this._slotLayer = new Sprite();
        this.addChild(this._slotLayer);
        
        this._iconLayer = new Sprite();
        this.addChild(this._iconLayer);
        
        this._activeSelectorSprite = new Sprite();
        if (Config.activeSelect) this._activeSelectorSprite.bitmap = ImageManager.loadPicture(Config.activeSelect);
        this._activeSelectorSprite.opacity = 255;
        this._activeSelectorSprite.visible = false;
        this.addChild(this._activeSelectorSprite);

        this._selectorSprite = new Sprite();
        if (Config.select) this._selectorSprite.bitmap = ImageManager.loadPicture(Config.select);
        this._selectorSprite.opacity = Config.hoverOpacity;
        this._selectorSprite.visible = false;
        this.addChild(this._selectorSprite); 

        this._textLayer = new Sprite();
        this.addChild(this._textLayer); 

        this.createSlots();
    };

    Sprite_SDI_Inventory.prototype.createBackground = function() {
        this._bgSprite = new Sprite();
        if (this._layout.bg) {
            this._bgSprite.bitmap = ImageManager.loadPicture(this._layout.bg);
        }
        this._bgSprite.x = this._layout.x;
        this._bgSprite.y = this._layout.y;
        this.addChild(this._bgSprite);

        // S45: the WHOLE player background stays pinned to row 1 (the
        // hotbar row block); rows 2..4 render bare slots unless a custom
        // Grid2 Bg plate is set (drawn whole at Grid2 X/Y).
        if (this._type === 'player' && Config.g2Bg) {
            this._bg2Sprite = new Sprite(ImageManager.loadPicture(Config.g2Bg));
            this._bg2Sprite.x = Config.g2X;
            this._bg2Sprite.y = Config.g2Y;
            this.addChild(this._bg2Sprite);
        }
    };

    Sprite_SDI_Inventory.prototype.createSlots = function() {
        this._slotSprites = [];
        this._iconSprites = [];
        this._textSprites = [];

        var count = this._layout.cols * this._layout.rows;

        for (var i = 0; i < count; i++) {
            var col = i % this._layout.cols;
            var row = Math.floor(i / this._layout.cols);

            // S43: row 0 stays at Player X/Y; rows 1+ render at Grid2 X/Y
            // (defaults keep the stock layout). Slot indices, hit-tests and
            // drag logic are untouched - only sprite coordinates.
            var baseX = (row === 0 || this._type !== 'player') ? this._layout.x : Config.g2X;
            var baseY = (row === 0 || this._type !== 'player') ? this._layout.y
                : Config.g2Y - this._layout.space; // (row - 1) * space
            var x = baseX + (col * this._layout.space) + Config.slotOffX;
            var y = baseY + (row * this._layout.space) + Config.slotOffY;

            var slot = new Sprite();
            if (this._layout.slot) {
                slot.bitmap = ImageManager.loadPicture(this._layout.slot);
            }
            slot.x = x;
            slot.y = y;
            this._slotLayer.addChild(slot);
            this._slotSprites.push(slot);

            var icon = new Sprite();
            var halfSize = this._layout.space / 2;
            icon.anchor.x = 0.5;
            icon.anchor.y = 0.5;
            icon.x = x + halfSize + Config.iconOffX;
            icon.y = y + halfSize + Config.iconOffY;
            this._iconLayer.addChild(icon);
            this._iconSprites.push(icon);

            var txt = new Sprite(new Bitmap(40, 24));
            txt.anchor.x = 0.5;
            txt.anchor.y = 0.5;
            txt.x = icon.x + Config.invCountX;
            txt.y = icon.y + Config.invCountY;
            txt.bitmap.fontSize = Config.fontSize;
            if (Config.fontBold) txt.bitmap.fontBold = true;
            if (Config.fontOutline) txt.bitmap.outlineWidth = 3;
            this._textLayer.addChild(txt);
            this._textSprites.push(txt);
        }
    };

    Sprite_SDI_Inventory.prototype.refresh = function() {
        var list = SDI_Controller.getList(this._type);
        if (!list) return;
        
        var unlockedLimit = (this._type === 'player' && Config.maxSlotsVar > 0) ? $gameParty.sdiMaxUnlocked() : 9999;
        var activeFound = false;

        for (var i = 0; i < this._slotSprites.length; i++) {
            var isLocked = (this._type === 'player' && i >= unlockedLimit);
            
            var bmpName = isLocked ? Config.locked : this._layout.slot;
            if (bmpName) {
                 if (!this._slotSprites[i]._sdiImgName || this._slotSprites[i]._sdiImgName !== bmpName) {
                     this._slotSprites[i].bitmap = ImageManager.loadPicture(bmpName);
                     this._slotSprites[i]._sdiImgName = bmpName;
                 }
            }

            if (isLocked) {
                this._iconSprites[i].visible = false;
                this._textSprites[i].visible = false;
                continue;
            }

            var data = list[i];
            var item = null;
            var amount = 0;

            if (this._type === 'player') {
                item = data;
                amount = item ? $gameParty.numItems(item) : 0;
            } else {
                if (data && data.item) {
                    item = data.item;
                    amount = data.amount;
                }
            }
            
            var isDragged = (SDI_Controller.dragSourceType === this._type && SDI_Controller.dragSourceIdx === i);
            var hasItem = (item && amount > 0);

            if (hasItem && !isDragged) {
                this.drawIcon(this._iconSprites[i], item.iconIndex);
                this._iconSprites[i].visible = true;
                this._textSprites[i].bitmap.clear();
                if (amount > 1) {
                    this._textSprites[i].bitmap.drawText(amount, 0, 0, 40, 24, 'center');
                }
                this._textSprites[i].visible = true;
            } else {
                this._iconSprites[i].visible = false;
                this._textSprites[i].visible = false;
            }
            
            if (this._type === 'player' && i === SDI_Controller.activeHotbarSlot && hasItem) {
                this._activeSelectorSprite.x = this._slotSprites[i].x;
                this._activeSelectorSprite.y = this._slotSprites[i].y;
                this._activeSelectorSprite.visible = true;
                activeFound = true;
            }
        }
        
        if (!activeFound && this._type === 'player') {
            this._activeSelectorSprite.visible = false;
        }
    };

    Sprite_SDI_Inventory.prototype.drawIcon = function(sprite, index) {
        var pw = Window_Base._iconWidth;
        var ph = Window_Base._iconHeight;
        var bitmap = ImageManager.loadSystem('IconSet');
        var sx = index % 16 * pw;
        var sy = Math.floor(index / 16) * ph;
        if (!sprite.bitmap || sprite.bitmap.width !== pw) {
            sprite.bitmap = new Bitmap(pw, ph);
        }
        sprite.bitmap.clear();
        sprite.bitmap.blt(bitmap, sx, sy, pw, ph, 0, 0);
    };

    Sprite_SDI_Inventory.prototype.checkHit = function(x, y) {
        if (!this.visible || this.opacity < 10) return -1;
        for (var i = 0; i < this._slotSprites.length; i++) {
            var s = this._slotSprites[i];
            if (x >= s.x && x < s.x + this._layout.space &&
                y >= s.y && y < s.y + this._layout.space) {
                return i;
            }
        }
        return -1;
    };
    
    Sprite_SDI_Inventory.prototype.getSlotRect = function(index) {
        if (index < 0 || index >= this._slotSprites.length) return null;
        var s = this._slotSprites[index];
        return { x: s.x, y: s.y, width: this._layout.space, height: this._layout.space }; 
    };
    
    Sprite_SDI_Inventory.prototype.setHighlight = function(index, dragMode) {
        if (index >= 0) {
            var rect = this.getSlotRect(index);
            if (rect) {
                this._selectorSprite.x = rect.x;
                this._selectorSprite.y = rect.y;
                this._selectorSprite.visible = true;
                return;
            }
        }
        this._selectorSprite.visible = false;
    };

    Sprite_SDI_Inventory.prototype.updateCustomInfo = function(item) {
        if (!this._descSprite || !this._nameSprite) return; 

        if (!item) {
            this._descSprite.bitmap.clear();
            this._nameSprite.bitmap.clear();
            this._lastDescItem = null; 
            return;
        }

        if (item !== this._lastDescItem) {
            this._nameSprite.bitmap.clear();
            this._nameSprite.bitmap.drawText(item.name, 0, 0, Config.descW, Config.nameSize, Config.nameAlign);

            this._descSprite.bitmap.clear();
            this.drawTextEx(this._descSprite.bitmap, item.description);
            this._lastDescItem = item;
        }
    };

    Sprite_SDI_Inventory.prototype.drawTextEx = function(bitmap, text) {
        if (!text) return;
        var rawText = text.replace(/\\n/g, '\n');
        var lines = rawText.split(/[\r\n]+/);
        var y = 0;
        var lineHeight = Config.descSize + 4;
        
        for (var i = 0; i < lines.length; i++) {
            var words = lines[i].split(' ');
            var currentLine = '';
            
            for(var n = 0; n < words.length; n++) {
                var testLine = currentLine + words[n] + ' ';
                var metrics = bitmap.measureTextWidth(testLine);
                if (metrics > Config.descW && n > 0) {
                    bitmap.drawText(currentLine, 0, y, Config.descW, lineHeight, 'left');
                    currentLine = words[n] + ' ';
                    y += lineHeight;
                } else {
                    currentLine = testLine;
                }
            }
            bitmap.drawText(currentLine, 0, y, Config.descW, lineHeight, 'left');
            y += lineHeight;
        }
    };

    // ======================================================================
    // HOTBAR
    // ======================================================================
    
    function Sprite_SDI_Hotbar() { this.initialize.apply(this, arguments); }
    Sprite_SDI_Hotbar.prototype = Object.create(Sprite.prototype);
    Sprite_SDI_Hotbar.prototype.constructor = Sprite_SDI_Hotbar;
    
    Sprite_SDI_Hotbar.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.x = Graphics.boxWidth / 2;
        this.y = Config.hbY;
        this.opacity = 255;
        this.anchor.x = 0.5; 
        this.anchor.y = 0.5;
        
        if (Config.hbBg) {
            this._bg = new Sprite(ImageManager.loadPicture(Config.hbBg));
            this._bg.anchor.x = 0.5;
            this._bg.anchor.y = 0.5;
            this._bg.y = (Config.hbSpace * Config.hbScale / 2); 
            this.addChild(this._bg);
        }
        
        this._slotLayer = new Sprite();
        this.addChild(this._slotLayer); 

        this._iconLayer = new Sprite();
        this.addChild(this._iconLayer); 

        this._activeSelector = new Sprite();
        if (Config.activeSelect) this._activeSelector.bitmap = ImageManager.loadPicture(Config.activeSelect);
        this._activeSelector.anchor.x = 0.5; 
        this._activeSelector.anchor.y = 0.5;
        this._activeSelector.opacity = 255;
        this._activeSelector.visible = false;
        this.addChild(this._activeSelector); 

        this._textLayer = new Sprite();
        this.addChild(this._textLayer); 

        this.createSlots();
        this.refresh();
    };
    
    Sprite_SDI_Hotbar.prototype.createSlots = function() {
        this._slotSprites = [];
        this._iconSprites = [];
        this._textSprites = [];
        this._contSprites = []; 
        
        var startLocalX = -((5 * Config.hbSpace) / 2) + (Config.hbSpace / 2); 
        for (var i = 0; i < 5; i++) {
            var x = startLocalX + (i * Config.hbSpace);
            var y = 0;
            
            var cont = new Sprite();
            cont.x = x * Config.hbScale; 
            cont.y = y;
            cont.scale.x = Config.hbScale;
            cont.scale.y = Config.hbScale;
            this.addChild(cont); 
            this._contSprites.push(cont);

            var slot = new Sprite();
            slot.anchor.x = 0.5; slot.anchor.y = 0.5;
            slot.x = cont.x; slot.y = cont.y;
            slot.scale.x = Config.hbScale; slot.scale.y = Config.hbScale;
            if (Config.pSlot) slot.bitmap = ImageManager.loadPicture(Config.pSlot);
            this._slotLayer.addChild(slot);

            var icon = new Sprite();
            icon.anchor.x = 0.5; icon.anchor.y = 0.5;
            icon.x = cont.x; icon.y = cont.y; 
            icon.scale.x = Config.hbScale; icon.scale.y = Config.hbScale;
            this._iconLayer.addChild(icon);
            this._iconSprites.push(icon);

            var num = new Sprite(new Bitmap(32, 20));
            num.anchor.x = 0.5; num.anchor.y = 0.5;
            num.x = cont.x + (Config.hbNumX * Config.hbScale); 
            num.y = cont.y + (Config.hbNumY * Config.hbScale);
            num.scale.x = Config.hbScale; num.scale.y = Config.hbScale;
            num.bitmap.fontSize = Config.hbFontSize;
            num.bitmap.textColor = Config.hbColor; 
            if (Config.fontBold) num.bitmap.fontBold = true;
            if (Config.fontOutline) num.bitmap.outlineWidth = 3;
            num.bitmap.drawText(String(i+1), 0, 0, 32, 20, 'left');
            this._textLayer.addChild(num);
            
            var txt = new Sprite(new Bitmap(40, 24));
            txt.anchor.x = 0.5; 
            txt.anchor.y = 0.5;
            txt.x = icon.x + (Config.hbCountX * Config.hbScale);
            txt.y = icon.y + (Config.hbCountY * Config.hbScale);
            txt.scale.x = Config.hbScale; 
            txt.scale.y = Config.hbScale;
            txt.bitmap.fontSize = Config.hbFontSize;
            txt.bitmap.textColor = Config.hbColor;
            if (Config.fontBold) txt.bitmap.fontBold = true;
            if (Config.fontOutline) txt.bitmap.outlineWidth = 3;
            this._textLayer.addChild(txt);
            this._textSprites.push(txt);
        }
    };
    
    Sprite_SDI_Hotbar.prototype.refresh = function() {
        var list = $gameParty._sdiGrid;

        for (var i = 0; i < 5; i++) {
            var item = list[i];
            var amount = item ? $gameParty.numItems(item) : 0;
            
            if (item && amount > 0) {
                this.drawIcon(this._iconSprites[i], item.iconIndex);
                this._iconSprites[i].visible = true;
                this._textSprites[i].bitmap.clear();
                if (amount > 1) {
                    this._textSprites[i].bitmap.drawText(amount, 0, 0, 40, 24, 'center');
                }
                this._textSprites[i].visible = true;
            } else {
                this._iconSprites[i].visible = false;
                this._textSprites[i].visible = false;
            }
        }
        
        var activeIdx = SDI_Controller.activeHotbarSlot;
        if (activeIdx >= 0 && this._contSprites && this._contSprites[activeIdx]) {
            this._activeSelector.x = this._contSprites[activeIdx].x;
            this._activeSelector.y = this._contSprites[activeIdx].y;
            this._activeSelector.scale.x = Config.hbScale;
            this._activeSelector.scale.y = Config.hbScale;
            this._activeSelector.visible = true;
        } else {
            this._activeSelector.visible = false;
        }
    };
    
    Sprite_SDI_Hotbar.prototype.drawIcon = function(sprite, index) {
        var pw = Window_Base._iconWidth;
        var ph = Window_Base._iconHeight;
        var bitmap = ImageManager.loadSystem('IconSet');
        var sx = index % 16 * pw;
        var sy = Math.floor(index / 16) * ph;
        if (!sprite.bitmap || sprite.bitmap.width !== pw) {
            sprite.bitmap = new Bitmap(pw, ph);
        }
        sprite.bitmap.clear();
        sprite.bitmap.blt(bitmap, sx, sy, pw, ph, 0, 0);
    };
    
    Sprite_SDI_Hotbar.prototype.checkHit = function(x, y) {
        if (!this.visible || this.opacity === 0) return -1;
        
        var size = Config.hbSpace * Config.hbScale;
        var half = size / 2;

        for (var i = 0; i < 5; i++) {
            var cont = this._contSprites[i];
            if (!cont) continue;
            
            // Используем абсолютные координаты матрицы PIXI для идеальной точности
            var gx = cont.worldTransform ? cont.worldTransform.tx : (this.x + cont.x);
            var gy = cont.worldTransform ? cont.worldTransform.ty : (this.y + cont.y); 
            
            if (x >= gx - half && x <= gx + half &&
                y >= gy - half && y <= gy + half) {
                return i;
            }
        }
        return -1;
    };

    Sprite_SDI_Hotbar.prototype.update = function() {
        Sprite.prototype.update.call(this);
        
        var shouldHideBySwitch = false;
        if (Config.hbSwitches && Config.hbSwitches.length > 0) {
            for (var s = 0; s < Config.hbSwitches.length; s++) {
                var swId = Config.hbSwitches[s];
                if (swId > 0 && $gameSwitches.value(swId)) {
                    shouldHideBySwitch = true;
                    break;
                }
            }
        }
        
        var targetOpacity = 255;
        if (shouldHideBySwitch) {
            targetOpacity = 0;
        } 
        
        if (this.opacity < targetOpacity) {
            this.opacity = Math.min(this.opacity + Config.hbFadeSpeed, targetOpacity);
        } else if (this.opacity > targetOpacity) {
            this.opacity = Math.max(this.opacity - Config.hbFadeSpeed, targetOpacity);
        }
        
        this.visible = this.opacity > 0;
        
        if (this.visible && Graphics.frameCount % 5 === 0) {
             this.refresh();
        }
    };

    // ======================================================================
    // SCENE MAP INTEGRATION
    // ======================================================================

    // FIX: Интегрируем Хотбар ровно в тот же момент, что и SRD_HUDMaker
    var _Scene_Map_createMapNameWindow = Scene_Map.prototype.createMapNameWindow;
    Scene_Map.prototype.createMapNameWindow = function() {
        _Scene_Map_createMapNameWindow.call(this);
        this._sdiHotbar = new Sprite_SDI_Hotbar();
        this.addChild(this._sdiHotbar);
    };

    // FIX: Приподнимаем слой затемнения, если он есть, как это делает SRD_HUDMaker
    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        // Re-apply the key mapping: config plugins (SuperDuper.Keyboard's
        // ConfigManager.applyData) replace Input.keyMapper wholesale AFTER
        // this module loads, wiping the entry registered at boot time. As a
        // system module we load before every plugin, so re-register on every
        // map start - after ConfigManager.load - to survive the replacement.
        if (Config.trigger === 'key_i') Input.keyMapper[Config.keyCode] = 'sdi_inv';
        // Lift the hotbar above the HUD layer: load order no longer
        // guarantees our addChild lands after SRDuper HUDMaker's _hud (a
        // system module loads before every plugin). start() runs after all
        // create* methods, so re-adding here wins regardless of alias order;
        // the fade sprite below still ends up on top of everything.
        if (this._sdiHotbar) {
            this.removeChild(this._sdiHotbar);
            this.addChild(this._sdiHotbar);
        }
        if (this._fadeSprite) {
            this.removeChild(this._fadeSprite);
            this.addChild(this._fadeSprite);
        }
    };

    var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);

        // Инвентарные окна остаются сразу под системными окнами сообщений
        var winIndex2 = -1;
        if (this._windowLayer) {
            winIndex2 = this.children.indexOf(this._windowLayer);
        }
        
        var insertAt = (winIndex2 >= 0) ? winIndex2 : this.children.length;

        this._sdiDimmer = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        this._sdiDimmer.bitmap.fillAll('black');
        this._sdiDimmer.opacity = 0;
        this.addChildAt(this._sdiDimmer, insertAt++);

        this._sdiPlayer = new Sprite_SDI_Inventory('player');
        this.addChildAt(this._sdiPlayer, insertAt++);

        this._sdiChest = new Sprite_SDI_Inventory('chest');
        this.addChildAt(this._sdiChest, insertAt++);

        this._sdiDragSprite = new Sprite();
        this._sdiDragSprite.anchor.x = 0.5;
        this._sdiDragSprite.anchor.y = 0.5;
        this._sdiDragSprite.opacity = 200;
        this.addChildAt(this._sdiDragSprite, insertAt++);
        
        this._sdiDrag = null; 
        this._sdiDragOriginX = 0; 
        this._sdiDragOriginY = 0;
        this._sdiInputWait = 0;
        this._sdiClickConsumed = false;
        this._sdiDragging = false; 
        this._sdiClickStart = 0;
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this.updateSDI();
    };

    Scene_Map.prototype.updateSDI = function() {
        if (this._sdiInputWait > 0) this._sdiInputWait--;
        else {
            if (SDI_Controller.checkTrigger()) {
                if (SDI_Controller.activeChestId) SDI_Controller.closeAll();
                else SDI_Controller.togglePlayer();
                this._sdiInputWait = 15;
            } else if (Config.trigger === 'key_i' && Input.isTriggered('escape')) {
                if (SDI_Controller.isOpen()) {
                    SDI_Controller.closeAll();
                    this._sdiInputWait = 15;
                }
            }
        }

        var targetOp = SDI_Controller.isOpen() ? 255 : 0;
        if (SDI_Controller.currentOpacity < targetOp) SDI_Controller.currentOpacity = Math.min(SDI_Controller.currentOpacity + Config.fade, 255);
        if (SDI_Controller.currentOpacity > targetOp) SDI_Controller.currentOpacity = Math.max(SDI_Controller.currentOpacity - Config.fade, 0);

        this._sdiPlayer.opacity = SDI_Controller.currentOpacity;
        this._sdiChest.opacity = SDI_Controller.currentOpacity;
        this._sdiDimmer.opacity = (Config.dimmer) * (SDI_Controller.currentOpacity / 255);

        var visible = SDI_Controller.currentOpacity > 0;
        this._sdiChest.visible = visible && (SDI_Controller.activeChestId !== null);
        this._sdiPlayer.visible = visible && (SDI_Controller.isPlayerOpen);
        this._sdiDimmer.visible = visible;

        if (visible) {
            if (SDI_Controller.isOpen()) {
                this._sdiPlayer.refresh();
                if (this._sdiChest.visible) this._sdiChest.refresh();
                this.updateSDIHighlight();
            }
        }
        
        this.updateSDITouch();
    };

    Scene_Map.prototype.updateSDIHighlight = function() {
        var x = window.SDI_NativeMouse.x;
        var y = window.SDI_NativeMouse.y;
        
        var hP = this._sdiPlayer.checkHit(x, y);
        
        if (hP >= 0 && Config.maxSlotsVar > 0) {
            var limit = $gameParty.sdiMaxUnlocked();
            if (hP >= limit) hP = -1;
        }
        
        var hC = this._sdiChest.checkHit(x, y);
        
        var targetItem = null;

        if (hP >= 0 && !SDI_Controller.dragItem) {
            this._sdiPlayer.setHighlight(hP, false);
            var pList = SDI_Controller.getList('player');
            if (pList && pList[hP]) targetItem = pList[hP];
        } else {
            this._sdiPlayer.setHighlight(-1, false);
        }

        if (hC >= 0 && !SDI_Controller.dragItem) {
            this._sdiChest.setHighlight(hC, false);
            var cList = SDI_Controller.getList('chest');
            if (cList && cList[hC] && cList[hC].item) targetItem = cList[hC].item;
        } else {
            this._sdiChest.setHighlight(-1, false);
        }

        this._sdiPlayer.updateCustomInfo(targetItem);
    };

    Scene_Map.prototype.updateSDITouch = function() {
        var x = TouchInput.x;
        var y = TouchInput.y;
        var hP = this._sdiPlayer.checkHit(x, y);
        var hC = this._sdiChest.checkHit(x, y);
        var hHb = this._sdiHotbar ? this._sdiHotbar.checkHit(x, y) : -1; 
        
        var now = Date.now(); 
        var isDoubleClick = false; 
        var clickedSlot = (hP >= 0) ? hP : hC; 
        var clickedSrc = (hP >= 0) ? 'player' : 'chest'; 

        // ЗАЩИТА: Если предмет не перетаскивается системно, принудительно гасим фантомный визуал
        if (!SDI_Controller.dragItem) {
            this._sdiDragging = false;
            this._sdiDragSprite.visible = false;
        }

        if (TouchInput.isTriggered()) {
            this._sdiClickConsumed = false; 

            if (hHb >= 0 && (!SDI_Controller.isOpen() || (hP < 0 && hC < 0))) {
                SDI_Controller.setHotbarVar(hHb);
                this._sdiClickConsumed = true;
                return;
            }

            if (!SDI_Controller.isOpen()) return;

            if (SDI_Controller._lastClickIdx === clickedSlot && SDI_Controller._lastClickSrc === clickedSrc && (now - SDI_Controller._lastClickTime < 300)) {
                isDoubleClick = true;
            }
            if (clickedSlot >= 0) {
                SDI_Controller._lastClickTime = now;
                SDI_Controller._lastClickIdx = clickedSlot;
                SDI_Controller._lastClickSrc = clickedSrc;
            }

            // Обработка двойного клика или Shift+клик
            if (Input.isPressed('shift') || isDoubleClick) {
                var src = null; var idx = -1;
                if (hP >= 0) { src = 'player'; idx = hP; }
                else if (hC >= 0) { src = 'chest'; idx = hC; }
                
                if (src) {
                    if (SDI_Controller.selectionMode) {
                        // В режиме выбора подарка - двойной клик тоже подтверждает выбор
                        if (src === 'player') {
                            SDI_Controller.submitSelection(idx);
                        }
                    } else if (SDI_Controller.activeChestId !== null) {
                        // Сундук открыт - переносим предметы
                        SDI_Controller.quickTransfer(src, idx);
                    } else {
                        // Сундук закрыт - используем предмет
                        if (src === 'player') {
                            SDI_Controller.useItemFromSlot(idx);
                        }
                    }
                    this._sdiInputWait = 10;
                    this._sdiClickConsumed = true; 
                    return; 
                }
            }

            if (hP >= 0 || hC >= 0) {
                this._sdiDragOriginX = x;
                this._sdiDragOriginY = y;
            } else {
                this._sdiClickConsumed = true; 
            }
        }

        if (TouchInput.isPressed() && SDI_Controller.isOpen()) {
            if (!this._sdiClickConsumed && !this._sdiDragging) {
                var dx = x - this._sdiDragOriginX;
                var dy = y - this._sdiDragOriginY;
                var dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > Config.dragThreshold) {
                    this._sdiDragging = true;
                    
                    var src = null; var idx = -1;
                    var oP = this._sdiPlayer.checkHit(this._sdiDragOriginX, this._sdiDragOriginY);
                    var oC = this._sdiChest.checkHit(this._sdiDragOriginX, this._sdiDragOriginY);
                    
                    if (oP >= 0 && Config.maxSlotsVar > 0) {
                         if (oP >= $gameParty.sdiMaxUnlocked()) oP = -1;
                    }

                    if (oP >= 0) { src = 'player'; idx = oP; }
                    else if (oC >= 0) { src = 'chest'; idx = oC; }

                    if (src) {
                        var list = SDI_Controller.getList(src);
                        var item = (src === 'player') ? list[idx] : (list[idx] ? list[idx].item : null);
                        if (item) {
                            SDI_Controller.dragItem = item;
                            SDI_Controller.dragSourceType = src;
                            SDI_Controller.dragSourceIdx = idx;
                            SDI_Controller.dragIconIndex = item.iconIndex;
                            playSdiSound('pickup');
                        } else {
                             this._sdiDragging = false; 
                             this._sdiClickConsumed = true;
                        }
                    } else {
                        this._sdiDragging = false;
                        this._sdiClickConsumed = true;
                    }
                }
            }

            if (this._sdiDragging && SDI_Controller.dragItem) {
                this._sdiDragSprite.visible = true;
                this._sdiDragSprite.x = x;
                this._sdiDragSprite.y = y;
                
                var pw = Window_Base._iconWidth;
                var ph = Window_Base._iconHeight;
                var bitmap = ImageManager.loadSystem('IconSet');
                var sx = SDI_Controller.dragIconIndex % 16 * pw;
                var sy = Math.floor(SDI_Controller.dragIconIndex / 16) * ph;
                if (!this._sdiDragSprite.bitmap) this._sdiDragSprite.bitmap = new Bitmap(pw, ph);
                this._sdiDragSprite.bitmap.clear();
                this._sdiDragSprite.bitmap.blt(bitmap, sx, sy, pw, ph, 0, 0);
            }
        } else {
            this._sdiDragSprite.visible = false;
        }

        if (TouchInput.isReleased() && SDI_Controller.isOpen()) {
            if (this._sdiDragging) {
                if (SDI_Controller.dragItem) {
                    var target = null; var tIdx = -1;
                    
                    var hP_end = this._sdiPlayer.checkHit(x, y);
                    if (hP_end >= 0 && Config.maxSlotsVar > 0) {
                        if (hP_end >= $gameParty.sdiMaxUnlocked()) hP_end = -1;
                    }
                    
                    var hC_end = this._sdiChest.checkHit(x, y);

                    if (hP_end >= 0) { target = 'player'; tIdx = hP_end; }
                    else if (hC_end >= 0) { target = 'chest'; tIdx = hC_end; }
                    
                    if (target) {
                        SDI_Controller.swap(SDI_Controller.dragSourceType, SDI_Controller.dragSourceIdx, target, tIdx);
                        playSdiSound('drop');
                    } else {
                        if (typeof SDI_DropController !== 'undefined') {
                            SDI_DropController.dropOnMap(SDI_Controller.dragSourceType, SDI_Controller.dragSourceIdx);
                        } else {
                            playSdiSound('cancel');
                        }
                    }
                    SDI_Controller.cancelDrag();
                }
                this._sdiDragging = false;
            } else if (!this._sdiClickConsumed) {
                var clickP = this._sdiPlayer.checkHit(x, y);
                var clickC = this._sdiChest.checkHit(x, y);
                
                var src = null; var idx = -1;
                if (clickP >= 0) { src = 'player'; idx = clickP; }
                else if (clickC >= 0) { src = 'chest'; idx = clickC; }
                
                if (src) {
                    SDI_Controller.quickTransfer(src, idx);
                }
            }
            this._sdiClickConsumed = false;
        }
    };
    
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        var cmd = command.toLowerCase();
        if (cmd === 'visualchest' || cmd === 'visualcheststored' || cmd === 'openchest') {
            var name = args[0] || ("Map" + this._mapId + "_Event" + this._eventId);
            SDI_Controller.openChest(name);
            if (!this.sdiCheckNextIsItem()) this.setWaitMode('sdi_chest');
        }
    };

    if (PluginManager.registerCommand) {
        PluginManager.registerCommand('SuperDuperInventory', 'VisualChest', function(args) {
            var name = args.name || ("Map" + this._mapId + "_Event" + this._eventId);
            SDI_Controller.openChest(name);
            if (!this.sdiCheckNextIsItem()) this.setWaitMode('sdi_chest');
        });
        PluginManager.registerCommand('SuperDuperInventory', 'VisualChestStored', function(args) {
            var name = args.name || ("Map" + this._mapId + "_Event" + this._eventId);
            SDI_Controller.openChest(name);
            if (!this.sdiCheckNextIsItem()) this.setWaitMode('sdi_chest');
        });
    }

})();