/*:
 * @plugindesc (v41.0 GLOBAL SOUNDS) Общие звуки и звук ошибки крафта.
 * @author Korolev
 *
 * @param Recipes
 * @text Список Рецептов
 * @type struct<Recipe>[]
 * @desc Настройка рецептов.
 * @default []
 *
 * @param Background Image
 * @text Картинка Фона
 * @type file
 * @dir img/pictures
 * @desc Имя картинки.
 * @default 
 *
 * @param --- SLOT VISUALS ---
 * @default 
 *
 * @param Slot Size
 * @text Размер Ячейки (Хитбокс)
 * @parent --- SLOT VISUALS ---
 * @type number
 * @desc Размер ячейки. Рекомендуется 40 (как в SDI).
 * @default 40
 *
 * @param Slot Bg Image
 * @text Картинка Слота (Обычная)
 * @parent --- SLOT VISUALS ---
 * @type file
 * @dir img/pictures
 * @desc Картинка пустой ячейки.
 * @default 
 *
 * @param Slot Hover Image
 * @text Картинка Слота (Активная)
 * @parent --- SLOT VISUALS ---
 * @type file
 * @dir img/pictures
 * @desc Картинка, наслаиваемая поверх обычной при наведении.
 * @default 
 *
 * @param Icon Offset X
 * @text Смещение Иконки X
 * @parent --- SLOT VISUALS ---
 * @type number
 * @min -1000
 * @max 1000
 * @desc Сдвиг иконки по горизонтали (0 = строго по центру).
 * @default 0
 *
 * @param Icon Offset Y
 * @text Смещение Иконки Y
 * @parent --- SLOT VISUALS ---
 * @type number
 * @min -1000
 * @max 1000
 * @desc Сдвиг иконки по вертикали (0 = строго по центру).
 * @default 0
 *
 * @param --- HINT 1 SETTINGS ---
 * @default 
 *
 * @param Hint Text
 * @text Текст Подсказки 1
 * @parent --- HINT 1 SETTINGS ---
 * @type string
 * @desc Основной текст.
 * @default ENTER - Создать | ESC - Выход | Клик по результату - Забрать
 *
 * @param Hint X
 * @text Координата X (1)
 * @parent --- HINT 1 SETTINGS ---
 * @type number
 * @min 0
 * @default 0
 *
 * @param Hint Y
 * @text Координата Y (1)
 * @parent --- HINT 1 SETTINGS ---
 * @type number
 * @min 0
 * @default 60
 *
 * @param Hint Size
 * @text Размер Шрифта (1)
 * @parent --- HINT 1 SETTINGS ---
 * @type number
 * @min 1
 * @default 18
 *
 * @param --- HINT 2 SETTINGS ---
 * @default 
 *
 * @param Hint 2 Text
 * @text Текст Подсказки 2
 * @parent --- HINT 2 SETTINGS ---
 * @type string
 * @desc Дополнительный текст.
 * @default 
 *
 * @param Hint 2 X
 * @text Координата X (2)
 * @parent --- HINT 2 SETTINGS ---
 * @type number
 * @min 0
 * @default 0
 *
 * @param Hint 2 Y
 * @text Координата Y (2)
 * @parent --- HINT 2 SETTINGS ---
 * @type number
 * @min 0
 * @default 100
 *
 * @param Hint 2 Size
 * @text Размер Шрифта (2)
 * @parent --- HINT 2 SETTINGS ---
 * @type number
 * @min 1
 * @default 18
 *
 * @param --- PREVIEW HINT SETTINGS ---
 * @default
 *
 * @param Preview Format
 * @text Формат текста (Превью)
 * @parent --- PREVIEW HINT SETTINGS ---
 * @type string
 * @desc Текст подсказки. %1 будет заменено на имя предмета.
 * @default Будет создано: %1
 *
 * @param Preview Color
 * @text Цвет Текста (Превью)
 * @parent --- PREVIEW HINT SETTINGS ---
 * @type string
 * @desc Цвет в формате HEX (например, #FFFF00). Если пусто, будет белый.
 * @default #FFFF00
 *
 * @param Preview X
 * @text Координата X (Превью)
 * @parent --- PREVIEW HINT SETTINGS ---
 * @type number
 * @min 0
 * @default 0
 *
 * @param Preview Y
 * @text Координата Y (Превью)
 * @parent --- PREVIEW HINT SETTINGS ---
 * @type number
 * @min 0
 * @default 140
 *
 * @param Preview Size
 * @text Размер Шрифта (Превью)
 * @parent --- PREVIEW HINT SETTINGS ---
 * @type number
 * @min 1
 * @default 20
 *
 * @param --- SOUND SETTINGS ---
 * @default 
 *
 * @param Global Interact Sound
 * @text Общий Звук Взаимодействия
 * @parent --- SOUND SETTINGS ---
 * @type file
 * @dir audio/se
 * @desc Проигрывается, если не задан специфичный звук.
 * @default Switch1
 *
 * @param Global Interact Volume
 * @text Громкость Общего Звука
 * @parent --- SOUND SETTINGS ---
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param Error Sound
 * @text Звук Ошибки
 * @parent --- SOUND SETTINGS ---
 * @type file
 * @dir audio/se
 * @desc Когда нельзя скрафтить или слот занят.
 * @default Buzzer1
 *
 * @param Error Volume
 * @text Громкость Ошибки
 * @parent --- SOUND SETTINGS ---
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param Craft Sound
 * @text Звук Крафта
 * @parent --- SOUND SETTINGS ---
 * @type file
 * @dir audio/se
 * @default Hammer
 *
 * @param Craft Volume
 * @text Громкость Крафта
 * @parent --- SOUND SETTINGS ---
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param Pickup Sound
 * @text Звук Забора
 * @parent --- SOUND SETTINGS ---
 * @type file
 * @dir audio/se
 * @default Item1
 *
 * @param Pickup Volume
 * @text Громкость Забора
 * @parent --- SOUND SETTINGS ---
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param Open Sound
 * @text Звук Открытия
 * @parent --- SOUND SETTINGS ---
 * @type file
 * @dir audio/se
 * @default Book2
 *
 * @param Open Volume
 * @text Громкость Открытия
 * @parent --- SOUND SETTINGS ---
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param Close Sound
 * @text Звук Закрытия
 * @parent --- SOUND SETTINGS ---
 * @type file
 * @dir audio/se
 * @default Book2
 *
 * @param Close Volume
 * @text Громкость Закрытия
 * @parent --- SOUND SETTINGS ---
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param --- UI POSITIONS ---
 * @default 
 *
 * @param Slot 1 X
 * @text Слот 1 X
 * @parent --- UI POSITIONS ---
 * @type number
 * @min 0
 * @default 300
 *
 * @param Slot 1 Y
 * @text Слот 1 Y
 * @parent --- UI POSITIONS ---
 * @type number
 * @min 0
 * @default 100
 *
 * @param Slot Spacing
 * @text Расстояние между слотами
 * @parent --- UI POSITIONS ---
 * @type number
 * @desc Расстояние в пикселях между слотами ингредиентов.
 * @default 60
 *
 * @param Result Slot X
 * @text Слот Результата X
 * @parent --- UI POSITIONS ---
 * @type number
 * @min 0
 * @default 550
 *
 * @param Result Slot Y
 * @text Слот Результата Y
 * @parent --- UI POSITIONS ---
 * @type number
 * @min 0
 * @default 100
 *
 * @help
 * ============================================================================
 * CRAFT SYSTEM (v41.0)
 * ============================================================================
 * ЛОГИКА:
 * 1. Ингредиенты кладутся в слоты перетаскиванием, двойным кликом / ПКМ.
 * 2. При успешном крафте предмет появляется в слоте результата.
 * 3. Чтобы получить предмет, нужно перетащить его или кликнуть по нему.
 * 4. ESC закрывает всё.
 * 5. ВИЗУАЛ: Подсказки. Активный слот (прозрачность 150) наслаивается.
 * 6. ВИЗУАЛ: Глобальный рендер перетаскивания (всегда поверх инвентаря).
 * 7. Адаптировано для полной Drag & Drop работы с Super Duper Inventory.
 * 8. ЗВУКИ: Добавлен общий звук и звук ошибки.
 * 9. ЗАЩИТА: Блокирует выброс предметов на землю при открытом крафте.
 */

/*~struct~Recipe:
 * @param ResultItemID
 * @text ID Результата
 * @type item
 *
 * @param Ingredients
 * @text ID Ингредиентов
 * @type item[]
 * @desc Компоненты (до 3 шт).
 */

(function() {
    'use strict';

    if (typeof SDI_Controller === 'undefined') {
        console.error("SimpleCraftSystem: Требуется плагин SuperDuperInventory!");
        return;
    }

    // --- Parsing Parameters ---
    var parameters = PluginManager.parameters('SimpleCraftSystem');

    var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
    var scrW = core ? core.screen.width : 1280;
    var scrH = core ? core.screen.height : 720;
    function pctX(p) { return Math.round(scrW * p / 100); }
    function pctY(p) { return Math.round(scrH * p / 100); }

    // Slot Visuals
    var slotBgImage = parameters['Slot Bg Image'] || '';
    var slotHoverImage = parameters['Slot Hover Image'] || '';
    var HIT_SIZE = Number(parameters['Slot Size'] || 40);
    var iconOffsetX = Number(parameters['Icon Offset X'] || 0);
    var iconOffsetY = Number(parameters['Icon Offset Y'] || 0);

    // Hint 1 Settings (дефолт: 0%, 8%)
    var hintTextStr = parameters['Hint Text'] || "ENTER - Создать | ESC - Выход | Клик по результату - Забрать";
    var hintX = parameters['Hint X'] ? Number(parameters['Hint X']) : pctX(0);
    var hintY = parameters['Hint Y'] ? Number(parameters['Hint Y']) : pctY(8);
    var hintSize = Number(parameters['Hint Size'] || 18);

    // Hint 2 Settings (дефолт: 0%, 14%)
    var hint2TextStr = parameters['Hint 2 Text'] || "";
    var hint2X = parameters['Hint 2 X'] ? Number(parameters['Hint 2 X']) : pctX(0);
    var hint2Y = parameters['Hint 2 Y'] ? Number(parameters['Hint 2 Y']) : pctY(14);
    var hint2Size = Number(parameters['Hint 2 Size'] || 18);

    // Preview Settings (дефолт: 0%, 19%)
    var previewFormat = parameters['Preview Format'] || "Будет создано: %1";
    var previewColor = parameters['Preview Color'] || "";
    var previewX = parameters['Preview X'] ? Number(parameters['Preview X']) : pctX(0);
    var previewY = parameters['Preview Y'] ? Number(parameters['Preview Y']) : pctY(19);
    var previewSize = Number(parameters['Preview Size'] || 20);

    // Sound Settings
    var globalInteractSound = parameters['Global Interact Sound'] || 'Switch1';
    var globalInteractVol = Number(parameters['Global Interact Volume'] || 90);

    var errorSound = parameters['Error Sound'] || 'Buzzer1';
    var errorVol = Number(parameters['Error Volume'] || 90);

    var craftSound = parameters['Craft Sound'] || '';
    var craftVol = Number(parameters['Craft Volume'] || 90);
    
    var pickupSound = parameters['Pickup Sound'] || '';
    var pickupVol = Number(parameters['Pickup Volume'] || 90);
    
    var openSound = parameters['Open Sound'] || '';
    var openVol = Number(parameters['Open Volume'] || 90);
    
    var closeSound = parameters['Close Sound'] || '';
    var closeVol = Number(parameters['Close Volume'] || 90);

    var bgImageName = parameters['Background Image'] || '';
    
    // Слоты в % (дефолт: слот1=23%,14% | результат=43%,14% | шаг=5%)
    var slot1X = parameters['Slot 1 X'] ? Number(parameters['Slot 1 X']) : pctX(23);
    var slotY = parameters['Slot 1 Y'] ? Number(parameters['Slot 1 Y']) : pctY(14);
    var slotSpacing = parameters['Slot Spacing'] ? Number(parameters['Slot Spacing']) : Math.round(scrW * 5 / 100);
    var resSlotX = parameters['Result Slot X'] ? Number(parameters['Result Slot X']) : pctX(43);
    var resSlotY = parameters['Result Slot Y'] ? Number(parameters['Result Slot Y']) : pctY(14);

    var coords = [
        { x: slot1X,                       y: slotY },
        { x: slot1X + slotSpacing,         y: slotY },
        { x: slot1X + (slotSpacing * 2),   y: slotY },
        { x: resSlotX,                     y: resSlotY }
    ];

    var parsedRecipes = [];
    try {
        var recipesRaw = JSON.parse(parameters['Recipes'] || '[]');
        parsedRecipes = recipesRaw.map(function(json) {
            var data = JSON.parse(json);
            var ingredients = JSON.parse(data.Ingredients).map(Number);
            ingredients.sort(function(a, b) { return a - b; });
            return {
                resultId: Number(data.ResultItemID),
                ingredients: ingredients
            };
        });
    } catch (e) {
        console.error("SimpleCraftSystem: Recipe parsing error:", e);
    }

    // ==============================================================================
    // ** Utils (Color Extraction)
    // ==============================================================================
    var UtilsHelper = {
        getNormalColor: function() {
            if (typeof ColorManager !== 'undefined' && ColorManager.normalColor) {
                return ColorManager.normalColor();
            } else {
                var dummyWindow = new Window_Base(0, 0, 0, 0);
                return dummyWindow.normalColor(); 
            }
        }
    };

    // ==============================================================================
    // ** Sound Helper
    // ==============================================================================
    var SoundHelper = {
        _lastCloseSound: 0,
        
        play: function(name, vol, pitch, pan) {
            if (!name) return;
            AudioManager.playSe({ name: name, volume: vol !== undefined ? vol : 90, pitch: pitch || 100, pan: pan || 0 });
        },

        playInteract: function(specificName, specificVol) {
            if (specificName) {
                this.play(specificName, specificVol);
            } else {
                this.play(globalInteractSound, globalInteractVol);
            }
        },

        playError: function() {
            this.play(errorSound, errorVol);
        },

        playClose: function() {
            var now = Date.now();
            if (now - this._lastCloseSound < 200) return;
            this._lastCloseSound = now;
            this.playInteract(closeSound, closeVol);
        },
        
        playOpen: function() { 
            this.playInteract(openSound, openVol); 
        }
    };

    // ==============================================================================
    // ** Craft Manager
    // ==============================================================================
    function CraftManager() { throw new Error('Static class'); }

    CraftManager.isActive = false;
    CraftManager.slots = [null, null, null];
    CraftManager.craftedItem = null;
    CraftManager.currentMatch = null;
    CraftManager._uiLayer = null;
    CraftManager._isProcessing = false;

    CraftManager.start = function() {
        if (this.isActive) return;
        this.isActive = true;
        this.slots = [null, null, null];
        this.craftedItem = null;
        this.currentMatch = null;
        this._isProcessing = false;
        
        if (!SDI_Controller.isOpen()) {
            SDI_Controller.togglePlayer();
        }
        
        this.checkRecipeMatch();
        this.createUI();
    };

    CraftManager.stop = function() {
        if (!this.isActive) return;
        
        if (SDI_Controller.isOpen()) {
            SDI_Controller.closeAll();
        } else {
            this.pickupCraftedItem();
            this.returnIngredients();
            this.isActive = false;
            this._isProcessing = false;
            this.currentMatch = null;
            this.removeUI();
        }
    };

    CraftManager.returnIngredients = function() {
        for (var i = 0; i < 3; i++) {
            if (this.slots[i]) {
                $gameParty.gainItem(this.slots[i], 1);
                this.slots[i] = null;
            }
        }
        this.checkRecipeMatch();
        try { SDI_Controller.refreshAll(); } catch(e) {}
    };

    CraftManager.createUI = function() {
        if (this._uiLayer) return;
        var scene = SceneManager._scene;
        if (scene instanceof Scene_Map) {
            this._uiLayer = new Sprite_CraftOverlay();
            scene.addChild(this._uiLayer);
        }
    };

    CraftManager.removeUI = function() {
        if (this._uiLayer && this._uiLayer.parent) {
            this._uiLayer.parent.removeChild(this._uiLayer);
        }
        this._uiLayer = null;
    };

    CraftManager.checkRecipeMatch = function() {
        var currentIds = [];
        for (var i = 0; i < 3; i++) {
            if (this.slots[i]) currentIds.push(this.slots[i].id);
        }
        
        if (currentIds.length === 0) {
            this.currentMatch = null;
            return;
        }
        currentIds.sort(function(a, b) { return a - b; });

        var match = null;
        for (var j = 0; j < parsedRecipes.length; j++) {
            var r = parsedRecipes[j];
            if (JSON.stringify(r.ingredients) === JSON.stringify(currentIds)) {
                match = r;
                break;
            }
        }

        this.currentMatch = match ? $dataItems[match.resultId] : null;
    };

    CraftManager.checkHit = function(x, y) {
        for (var i = 0; i < 3; i++) {
            var sx = coords[i].x;
            var sy = coords[i].y;
            if (x >= sx && x < sx + HIT_SIZE && y >= sy && y < sy + HIT_SIZE) {
                return i;
            }
        }
        var rx = coords[3].x;
        var ry = coords[3].y;
        if (x >= rx && x < rx + HIT_SIZE && y >= ry && y < ry + HIT_SIZE) {
            return 3;
        }
        return -1;
    };

    CraftManager.addItemToSlot = function(item) {
        if (!item) return;
        if (this.craftedItem) {
            SoundHelper.playError();
            return;
        }
        var emptyIndex = -1;
        for (var i = 0; i < 3; i++) {
            if (this.slots[i] === null) {
                emptyIndex = i;
                break;
            }
        }
        if (emptyIndex !== -1) {
            $gameParty.loseItem(item, 1);
            this.slots[emptyIndex] = item;
            this.checkRecipeMatch();
            this.refreshAll();
            SoundHelper.playInteract(globalInteractSound, globalInteractVol);
        } else {
            SoundHelper.playError();
        }
    };

    CraftManager.handleSwap = function(srcType, srcIdx, tgtType, tgtIdx) {
        if (srcType === 'player' && tgtType === 'craft') {
            var item = $gameParty._sdiGrid[srcIdx];
            if (!item) return;
            if (this.craftedItem) { SoundHelper.playError(); return; } 
            
            var existingInCraft = this.slots[tgtIdx];
            
            // ЗАПРЕТ ЗАМЕНЫ: Если слот крафта уже занят, выдаем ошибку и не даем положить предмет
            if (existingInCraft) {
                SoundHelper.playError();
                return;
            }
            
            $gameParty.loseItem(item, 1);
            this.slots[tgtIdx] = item;
            
            this.checkRecipeMatch();
            this.refreshAll();
            SoundHelper.playInteract(globalInteractSound, globalInteractVol);
        }
        else if (srcType === 'craft' && tgtType === 'craft') {
            if (srcIdx === 3) return; 
            var temp = this.slots[tgtIdx];
            this.slots[tgtIdx] = this.slots[srcIdx];
            this.slots[srcIdx] = temp;
            
            this.checkRecipeMatch();
            this.refreshAll();
            SoundHelper.playInteract(globalInteractSound, globalInteractVol);
        }
    };

    CraftManager.onIngredientClick = function(index) {
        if (this.craftedItem) {
            SoundHelper.playError();
            return false;
        }
        if (this.slots[index]) {
            $gameParty.gainItem(this.slots[index], 1);
            this.slots[index] = null;
            this.checkRecipeMatch();
            this.refreshAll();
            SoundHelper.playInteract(globalInteractSound, globalInteractVol);
            return true;
        }
        return false;
    };

    CraftManager.onResultClick = function() {
        if (this.craftedItem) return this.pickupCraftedItem();
        return false;
    };

    CraftManager.pickupCraftedItem = function() {
        if (this.craftedItem) {
            $gameParty.gainItem(this.craftedItem, 1);
            this.craftedItem = null;
            this.checkRecipeMatch();
            this.refreshAll();
            SoundHelper.playInteract(pickupSound, pickupVol);
            try { SDI_Controller.refreshAll(); } catch(e) {}
            return true;
        }
        return false;
    };

    CraftManager.tryCraft = function() {
        if (this._isProcessing) return;
        this._isProcessing = true;
        try {
            if (this.craftedItem) {
                SoundHelper.playError();
                return;
            }
            if (!this.currentMatch) {
                SoundHelper.playError();
                return;
            }

            this.slots = [null, null, null];
            this.craftedItem = this.currentMatch;
            this.checkRecipeMatch();
            this.refreshAll();
            SoundHelper.playInteract(craftSound, craftVol);
            try { SDI_Controller.refreshAll(); } catch(e) {}
        } finally {
            this._isProcessing = false;
        }
    };

    CraftManager.refreshAll = function() {
        if (this._uiLayer && this._uiLayer.refresh) this._uiLayer.refresh();
        try { SDI_Controller.refreshAll(); } catch(e) {}
    };

    // ==============================================================================
    // ** UI Classes
    // ==============================================================================
    function Sprite_CraftOverlay() { this.initialize.apply(this, arguments); }
    Sprite_CraftOverlay.prototype = Object.create(Sprite.prototype);
    Sprite_CraftOverlay.prototype.constructor = Sprite_CraftOverlay;

    Sprite_CraftOverlay.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.createBackground();
        this.createSlots();
        this.createHint();
        this.refresh();
    };

    Sprite_CraftOverlay.prototype.createBackground = function() {
        if (bgImageName) {
            this._bgSprite = new Sprite(ImageManager.loadPicture(bgImageName));
            var self = this;
            this._bgSprite.bitmap.addLoadListener(function() {
                if (self._bgSprite.bitmap && self._bgSprite.bitmap.width > 0) {
                    self._bgSprite.scale.x = Graphics.boxWidth / self._bgSprite.bitmap.width;
                    self._bgSprite.scale.y = Graphics.boxHeight / self._bgSprite.bitmap.height;
                }
            });
            this.addChild(this._bgSprite);
        }
    };

    Sprite_CraftOverlay.prototype.createSlots = function() {
        this._slotSprites = [];
        for (var i = 0; i < 4; i++) {
            var s = new Sprite_CraftSlot();
            s.x = coords[i].x;
            s.y = coords[i].y;
            this.addChild(s);
            this._slotSprites.push(s);
        }
    };

    Sprite_CraftOverlay.prototype.createHint = function() {
        var normalColor = UtilsHelper.getNormalColor();

        this._hintText = new Sprite(new Bitmap(Graphics.boxWidth, 40));
        this._hintText.x = hintX;
        this._hintText.y = hintY;
        this._hintText.bitmap.fontSize = hintSize;
        this._hintText.bitmap.textColor = normalColor;
        this._hintText.bitmap.outlineColor = 'black';
        this._hintText.bitmap.outlineWidth = 3;
        this._hintText.bitmap.drawText(hintTextStr, 0, 0, Graphics.boxWidth, 40, 'center');
        this.addChild(this._hintText);

        if (hint2TextStr) {
            this._hint2Text = new Sprite(new Bitmap(Graphics.boxWidth, 40));
            this._hint2Text.x = hint2X;
            this._hint2Text.y = hint2Y;
            this._hint2Text.bitmap.fontSize = hint2Size;
            this._hint2Text.bitmap.textColor = normalColor;
            this._hint2Text.bitmap.outlineColor = 'black';
            this._hint2Text.bitmap.outlineWidth = 3;
            this._hint2Text.bitmap.drawText(hint2TextStr, 0, 0, Graphics.boxWidth, 40, 'center');
            this.addChild(this._hint2Text);
        }
        
        this._previewText = new Sprite(new Bitmap(Graphics.boxWidth, 40));
        this._previewText.x = previewX;
        this._previewText.y = previewY;
        this._previewText.bitmap.fontSize = previewSize;
        this._previewText.bitmap.textColor = previewColor || normalColor;
        this._previewText.bitmap.outlineColor = 'black';
        this._previewText.bitmap.outlineWidth = 3;
        this.addChild(this._previewText);
    };

    Sprite_CraftOverlay.prototype.refresh = function() {
        if (!this._slotSprites) return;
        
        for (var i = 0; i < 3; i++) {
            if (this._slotSprites[i]) this._slotSprites[i].setItem(CraftManager.slots[i], false, i);
        }
        if (this._slotSprites[3]) this._slotSprites[3].setItem(CraftManager.craftedItem, true, 3);
        
        if (this._previewText) {
            this._previewText.bitmap.clear();
            if (CraftManager.currentMatch && !CraftManager.craftedItem) {
                var text = previewFormat.replace('%1', CraftManager.currentMatch.name);
                this._previewText.bitmap.drawText(text, 0, 0, Graphics.boxWidth, 40, 'center');
            }
        }
    };

    Sprite_CraftOverlay.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (!CraftManager.isActive) return;
        if (Input.isTriggered('ok')) CraftManager.tryCraft();
        if (Input.isTriggered('cancel') || Input.isTriggered('escape')) CraftManager.stop();
    };

    // ==============================================================================
    // ** Sprite_CraftSlot
    // ==============================================================================
    function Sprite_CraftSlot() { this.initialize.apply(this, arguments); }
    Sprite_CraftSlot.prototype = Object.create(Sprite.prototype);
    Sprite_CraftSlot.prototype.constructor = Sprite_CraftSlot;

    Sprite_CraftSlot.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        
        this._bgSprite = new Sprite();
        this._bgSprite.anchor.x = 0;
        this._bgSprite.anchor.y = 0;
        this.addChild(this._bgSprite);

        this._hoverSprite = new Sprite();
        this._hoverSprite.anchor.x = 0;
        this._hoverSprite.anchor.y = 0;
        this._hoverSprite.opacity = 150; // Прозрачность как в SDI
        this._hoverSprite.visible = false;
        this.addChild(this._hoverSprite);

        this._fallbackBitmap = new Bitmap(HIT_SIZE, HIT_SIZE);
        this._fallbackSprite = new Sprite(this._fallbackBitmap);
        this.addChild(this._fallbackSprite);

        this._icon = new Sprite();
        // Центрируем иконку (32x32) внутри ячейки размером HIT_SIZE с учетом пользовательских смещений
        this._icon.x = (HIT_SIZE - 32) / 2 + iconOffsetX;
        this._icon.y = (HIT_SIZE - 32) / 2 + iconOffsetY;
        this.addChild(this._icon);

        this._isHovered = false;
        this._hasItem = false;
        this._isResult = false;
        this._slotIndex = -1;
        
        this.refreshVisuals();
    };

    Sprite_CraftSlot.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (CraftManager.isActive) {
            this.updateHover();
        }
    };

    Sprite_CraftSlot.prototype.updateHover = function() {
        var tx = window.SDI_NativeMouse ? window.SDI_NativeMouse.x : TouchInput.x;
        var ty = window.SDI_NativeMouse ? window.SDI_NativeMouse.y : TouchInput.y;
        
        var inside = (tx >= this.x && tx < this.x + HIT_SIZE &&
                      ty >= this.y && ty < this.y + HIT_SIZE);
        
        if (this._isHovered !== inside) {
            this._isHovered = inside;
            this.refreshVisuals();
        }
    };

    Sprite_CraftSlot.prototype.refreshVisuals = function() {
        if (slotBgImage || slotHoverImage) {
            this._fallbackSprite.visible = false;
            this._bgSprite.visible = !!slotBgImage;
            this._hoverSprite.visible = this._isHovered && !!slotHoverImage;
            
            if (slotBgImage && !this._bgSprite.bitmap) {
                this._bgSprite.bitmap = ImageManager.loadPicture(slotBgImage);
                var self = this;
                this._bgSprite.bitmap.addLoadListener(function() {
                    if (self._bgSprite.bitmap.width > 0) {
                        self._bgSprite.scale.x = HIT_SIZE / self._bgSprite.bitmap.width;
                        self._bgSprite.scale.y = HIT_SIZE / self._bgSprite.bitmap.height;
                    }
                });
            }
            
            if (slotHoverImage && !this._hoverSprite.bitmap) {
                this._hoverSprite.bitmap = ImageManager.loadPicture(slotHoverImage);
                var selfHover = this;
                this._hoverSprite.bitmap.addLoadListener(function() {
                    if (selfHover._hoverSprite.bitmap.width > 0) {
                        selfHover._hoverSprite.scale.x = HIT_SIZE / selfHover._hoverSprite.bitmap.width;
                        selfHover._hoverSprite.scale.y = HIT_SIZE / selfHover._hoverSprite.bitmap.height;
                    }
                });
            }

        } else {
            this._bgSprite.visible = false;
            this._hoverSprite.visible = false;
            this._fallbackSprite.visible = true;
            this.drawFallbackRect();
        }
    };

    Sprite_CraftSlot.prototype.drawFallbackRect = function() {
        this._fallbackBitmap.clear();
        this._fallbackBitmap.fillAll('rgba(0, 0, 0, 0.5)');
        var ctx = this._fallbackBitmap._context;
        if (ctx) {
            if (this._isResult) {
                ctx.strokeStyle = this._hasItem ? '#FFFF00' : '#888888';
                ctx.lineWidth = this._hasItem ? 4 : 2;
            } else {
                ctx.strokeStyle = this._isHovered ? '#00FF00' : '#FFFFFF';
                ctx.lineWidth = 2;
            }
            ctx.strokeRect(1, 1, HIT_SIZE - 2, HIT_SIZE - 2);
        }
    };

    Sprite_CraftSlot.prototype.setItem = function(item, isResult, slotIndex) {
        this._hasItem = !!item;
        this._isResult = isResult;
        this._slotIndex = slotIndex;
        
        var isDragged = (SDI_Controller.dragSourceType === 'craft' && SDI_Controller.dragSourceIdx === this._slotIndex);
        
        this.refreshVisuals(); 
        
        if (!item || isDragged) {
            this._icon.bitmap = null;
            return;
        }
        this._icon.bitmap = ImageManager.loadSystem('IconSet');
        var pw = 32;
        var ph = 32;
        var sx = (item.iconIndex % 16) * pw;
        var sy = Math.floor(item.iconIndex / 16) * ph;
        this._icon.setFrame(sx, sy, pw, ph);
    };

    // ==============================================================================
    // ** Global Drag Manager (Fixing Depth/Overlap bugs)
    // ==============================================================================
    var GlobalDragManager = {
        sprite: null,
        update: function() {
            var scene = SceneManager._scene;
            if (!scene || !(scene instanceof Scene_Map)) return;
            
            if (!this.sprite) {
                this.sprite = new Sprite();
                scene.addChild(this.sprite);
            }
            
            // Гарантируем, что этот спрайт - ВСЕГДА самый верхний (даже поверх крафта)
            var children = scene.children;
            if (children[children.length - 1] !== this.sprite) {
                scene.addChild(this.sprite);
            }
            
            if (CraftManager.isActive && typeof SDI_Controller !== 'undefined' && SDI_Controller.dragItem) {
                var item = SDI_Controller.dragItem;
                if (!this.sprite.bitmap) {
                    this.sprite.bitmap = ImageManager.loadSystem('IconSet');
                }
                var pw = 32;
                var ph = 32;
                var sx = (item.iconIndex % 16) * pw;
                var sy = Math.floor(item.iconIndex / 16) * ph;
                this.sprite.setFrame(sx, sy, pw, ph);
                
                var tx = typeof window.SDI_NativeMouse !== 'undefined' ? window.SDI_NativeMouse.x : TouchInput.x;
                var ty = typeof window.SDI_NativeMouse !== 'undefined' ? window.SDI_NativeMouse.y : TouchInput.y;
                
                this.sprite.x = tx - 16;
                this.sprite.y = ty - 16;
                this.sprite.visible = true;
                
                // Скрываем родную иконку SDI (чтобы не было раздвоения под слоем крафта)
                if (SDI_Controller.dragIconIndex !== 0) {
                    SDI_Controller._craftHiddenDragIcon = SDI_Controller.dragIconIndex;
                    SDI_Controller.dragIconIndex = 0; 
                }
            } else {
                this.sprite.visible = false;
                if (typeof SDI_Controller !== 'undefined' && SDI_Controller._craftHiddenDragIcon !== undefined) {
                    SDI_Controller.dragIconIndex = SDI_Controller._craftHiddenDragIcon;
                    SDI_Controller._craftHiddenDragIcon = undefined;
                }
            }
        }
    };

    // ==============================================================================
    // ** Hooks (Integration with Super Duper Inventory Drag & Drop)
    // ==============================================================================

    var _SceneMap_updateSDITouch = Scene_Map.prototype.updateSDITouch;
    Scene_Map.prototype.updateSDITouch = function() {
        var x = TouchInput.x;
        var y = TouchInput.y;
        var wasDragging = this._sdiDragging;

        if (CraftManager.isActive && SDI_Controller.isOpen()) {
            
            // 1. Отслеживание клика по Крафту
            if (TouchInput.isTriggered()) {
                var hit = CraftManager.checkHit(x, y);
                if (hit >= 0) {
                    this._craftDragOriginX = x;
                    this._craftDragOriginY = y;
                    this._craftDragSlot = hit;
                } else {
                    this._craftDragSlot = -1;
                }
            }

            // 2. Начало перетаскивания предмета ИЗ Крафта
            if (TouchInput.isPressed() && this._craftDragSlot >= 0 && !this._sdiDragging) {
                var dx = x - this._craftDragOriginX;
                var dy = y - this._craftDragOriginY;
                var thresh = SDI_Controller.dragThreshold || 12;
                if (Math.sqrt(dx*dx + dy*dy) > thresh) {
                    var item = (this._craftDragSlot === 3) ? CraftManager.craftedItem : CraftManager.slots[this._craftDragSlot];
                    if (item) {
                        this._sdiDragging = true;
                        SDI_Controller.dragItem = item;
                        SDI_Controller.dragSourceType = 'craft';
                        SDI_Controller.dragSourceIdx = this._craftDragSlot;
                        SDI_Controller.dragIconIndex = item.iconIndex;
                        SoundHelper.playInteract(pickupSound, pickupVol);
                        CraftManager.refreshAll();
                    }
                    this._craftDragSlot = -1;
                }
            }

            // 3. Отпускание предмета В Крафт (Drag Drop)
            if (this._sdiDragging && TouchInput.isReleased() && SDI_Controller.dragItem) {
                var targetCraftSlot = CraftManager.checkHit(x, y);
                if (targetCraftSlot >= 0) {
                    if (targetCraftSlot < 3) {
                        CraftManager.handleSwap(SDI_Controller.dragSourceType, SDI_Controller.dragSourceIdx, 'craft', targetCraftSlot);
                    } else {
                        SoundHelper.playError();
                    }
                    SDI_Controller.cancelDrag();
                    this._sdiDragging = false;
                    this._sdiClickConsumed = true; // Защита от лишних фантомных кликов
                    return; // Блокируем стандартную логику отпускания SDI
                }
            }
        }

        // Вызов стандартной логики SDI для всего остального
        _SceneMap_updateSDITouch.call(this);

        // 4. Обычные клики по Крафту (если не было Drag'а и SDI не "съел" клик)
        if (CraftManager.isActive && TouchInput.isReleased() && !wasDragging && !this._sdiDragging && !this._sdiClickConsumed) {
            var clickHit = CraftManager.checkHit(x, y);
            if (clickHit >= 0) {
                if (clickHit < 3) CraftManager.onIngredientClick(clickHit);
                else CraftManager.onResultClick();
                this._sdiClickConsumed = true;
            }
        }
    };

    // Перехват бросания предмета ИЗ Крафта В Инвентарь
    var _SDI_swap = SDI_Controller.swap;
    SDI_Controller.swap = function(sourceType, sourceIdx, targetType, targetIdx) {
        if (sourceType === 'craft' && targetType === 'player') {
            var item = (sourceIdx === 3) ? CraftManager.craftedItem : CraftManager.slots[sourceIdx];
            if (!item) return;
            
            var tgtItem = $gameParty._sdiGrid[targetIdx];
            
            // Проверяем, есть ли уже этот предмет в сетке инвентаря
            var existingIdx = -1;
            for (var i = 0; i < $gameParty._sdiGrid.length; i++) {
                var chk = $gameParty._sdiGrid[i];
                if (chk && chk.id === item.id && 
                   ((DataManager.isItem(chk) && DataManager.isItem(item)) ||
                    (DataManager.isWeapon(chk) && DataManager.isWeapon(item)) ||
                    (DataManager.isArmor(chk) && DataManager.isArmor(item)))) {
                    existingIdx = i;
                    break;
                }
            }
            
            if (sourceIdx === 3) { // Из слота результата
                if (tgtItem && tgtItem.id !== item.id) { SoundHelper.playError(); return; } 
                
                if (existingIdx !== -1) {
                    // Предмет уже есть - просто отдаем его движку (стакнется автоматически)
                    $gameParty.gainItem(item, 1);
                } else {
                    // Предмета нет - морозим сетку и кладем в конкретную ячейку
                    var oldGrid = $gameParty._sdiGrid ? $gameParty._sdiGrid.slice() : [];
                    $gameParty.gainItem(item, 1);
                    if ($gameParty._sdiGrid) $gameParty._sdiGrid = oldGrid;
                    $gameParty._sdiGrid[targetIdx] = item;
                }
                CraftManager.craftedItem = null;
            } else { // Из слота ингредиента
                if (existingIdx !== -1) {
                    // Предмет уже есть - вливаемся в существующий стак
                    $gameParty.gainItem(item, 1);
                    CraftManager.slots[sourceIdx] = null; // Просто освобождаем слот крафта
                } else {
                    // Предмета нет - создаем новую ячейку
                    var oldGrid = $gameParty._sdiGrid ? $gameParty._sdiGrid.slice() : [];
                    $gameParty.gainItem(item, 1);
                    if ($gameParty._sdiGrid) $gameParty._sdiGrid = oldGrid;
                    
                    if (tgtItem) {
                        $gameParty.loseItem(tgtItem, 1);
                    }
                    
                    $gameParty._sdiGrid[targetIdx] = item;
                    CraftManager.slots[sourceIdx] = tgtItem;
                }
            }
            
            CraftManager.checkRecipeMatch();
            CraftManager.refreshAll(); 
            return;
        }
        _SDI_swap.call(this, sourceType, sourceIdx, targetType, targetIdx);
    };

    // ЗАЩИТА ОТ КРАША: Если выбросили мимо всего и плагин SuperDuperDrop пытается прочитать список 'craft'
    var _SDI_Controller_getList = SDI_Controller.getList;
    SDI_Controller.getList = function(type) {
        if (type === 'craft') {
            return [];
        }
        return _SDI_Controller_getList.call(this, type);
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        GlobalDragManager.update();
    };

    // Перехват ДаблКлика / Shift+Click из инвентаря
    var _SDI_Controller_quickTransfer = SDI_Controller.quickTransfer;
    SDI_Controller.quickTransfer = function(sourceType, sourceIdx) {
        if (CraftManager.isActive && sourceType === 'player') {
            var list = this.getList(sourceType);
            if (list && list[sourceIdx]) {
                CraftManager.addItemToSlot(list[sourceIdx]);
            }
            return;
        }
        _SDI_Controller_quickTransfer.call(this, sourceType, sourceIdx);
    };

    // Перехват ПКМ из инвентаря
    var _SDI_Controller_onRmbClick = SDI_Controller.onRmbClick;
    SDI_Controller.onRmbClick = function(index) {
        if (CraftManager.isActive) {
            var list = this.getList('player');
            if (list && list[index]) {
                CraftManager.addItemToSlot(list[index]);
            }
            return;
        }
        _SDI_Controller_onRmbClick.call(this, index);
    };

    // Закрытие при закрытии SDI
    var _SDI_Controller_closeAll = SDI_Controller.closeAll;
    SDI_Controller.closeAll = function() {
        if (CraftManager.isActive) {
            CraftManager.pickupCraftedItem();
            CraftManager.returnIngredients();
            CraftManager.isActive = false;
            CraftManager._isProcessing = false;
            CraftManager.currentMatch = null;
            CraftManager.removeUI();
            SoundHelper.playClose();
        }
        _SDI_Controller_closeAll.call(this);
    };

    // Синхронизация обновления визуала
    var _SDI_refreshAll = SDI_Controller.refreshAll;
    SDI_Controller.refreshAll = function() {
        _SDI_refreshAll.call(this);
        if (CraftManager.isActive && CraftManager._uiLayer) {
            CraftManager._uiLayer.refresh();
        }
    };

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'CraftSystem' && args[0] === 'open') {
            CraftManager.start();
        }
    };
    
    // ==============================================================================
    // ** ЗАЩИТА ОТ ВЫБРОСА ПРЕДМЕТОВ (Интеграция с SuperDuperDrop)
    // ==============================================================================
    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        if (_Scene_Boot_start) _Scene_Boot_start.call(this);
        
        // Хук встраивается после того, как все плагины были загружены и инициализированы
        if (typeof SDI_DropController !== 'undefined' && !SDI_DropController._craftDropHooked) {
            var _origDropOnMap = SDI_DropController.dropOnMap;
            SDI_DropController.dropOnMap = function() {
                // Если открыто меню крафта, блокируем любой сброс предмета на землю
                if (CraftManager.isActive) {
                    SoundHelper.playError();
                    if (typeof SDI_Controller !== 'undefined') SDI_Controller.refreshAll();
                    return; 
                }
                // Прокидываем ВСЕ аргументы (включая cursorX, cursorY) в оригинальный dropOnMap
                if (_origDropOnMap) _origDropOnMap.apply(this, arguments);
            };
            SDI_DropController._craftDropHooked = true;
        }
    };

    window.CraftManager = CraftManager;

})();