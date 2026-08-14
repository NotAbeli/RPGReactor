/*:
 * @plugindesc Super Duper Item Tags - система кастомных свойств и тегов для предметов.
 * @author Korolev
 *
 * @param HeldItemVariable
 * @text Переменная предмета в руках
 * @desc Укажите ID переменной, в которой хранится ID предмета, который герой сейчас держит в руках.
 * @type variable
 * @default 1
 *
 * @help
 * ============================================================================
 * Описание
 * ============================================================================
 * Плагин позволяет назначать предметам, оружию и броне любые текстовые теги,
 * а также указывать, является ли предмет одноразовым. Это служит отличной 
 * базой для будущих систем крафта, взаимодействия с окружением и т.д.
 *
 * ============================================================================
 * Использование (Заметки в Базе Данных)
 * ============================================================================
 * Вставьте эти теги в поле "Заметки" (Note) нужного предмета/оружия/брони:
 *
 * <sptags: тег1, тег2, тег3> 
 * Задает список свойств предмета через запятую.
 * Пример: <sptags: острый, металл, ключ:авыаыа>
 *
 * <spdisposable>
 * Указывает, что данный предмет является одноразовым (исчезает при 
 * успешном использовании в ваших будущих механиках).
 * Примечание: Вы также можете написать spdisposable прямо внутри sptags!
 * Пример: <sptags: острый, spdisposable>
 *
 * ============================================================================
 * Использование в скриптах (API)
 * ============================================================================
 * 1. БАЗОВЫЕ ПРОВЕРКИ:
 * SuperDuperItemTags.hasTag(item, tag)
 * - Проверяет, есть ли у предмета указанный тег. 
 * Пример: SuperDuperItemTags.hasTag($dataItems[5], "острый")
 *
 * SuperDuperItemTags.isDisposable(item)
 * - Проверяет, является ли предмет одноразовым.
 *
 * 2. ПРОВЕРКИ ИНВЕНТАРЯ И ПЕРЕМЕННЫХ (ДЛЯ ИВЕНТОВ):
 * SuperDuperItemTags.hasItemWithTag("острый")
 * - Проверяет, есть ли в инвентаре партии ХОТЬ ОДИН предмет с таким тегом.
 *
 * SuperDuperItemTags.checkItemInVariable(15, "острый")
 * - Проверяет наличие тега "острый" у ОБЫЧНОГО ПРЕДМЕТА, ID которого в перем. 15.
 *
 * SuperDuperItemTags.checkWeaponInVariable(15, "острый")
 * - То же самое, но ищет предмет во вкладке ОРУЖИЕ.
 *
 * SuperDuperItemTags.consumeItemInVariable(15)
 * - Берет ID ОБЫЧНОГО предмета из переменной 15. Если он одноразовый, 
 * забирает одну штуку из инвентаря.
 *
 * 3. БЫСТРЫЕ ФУНКЦИИ ДЛЯ "ПРЕДМЕТА В РУКАХ":
 * (Использует переменную, которую вы указали в настройках плагина)
 *
 * SuperDuperItemTags.heldItemHasTag("острый")
 * - Проверяет тег у ОБЫЧНОГО ПРЕДМЕТА "в руках".
 *
 * SuperDuperItemTags.heldWeaponHasTag("острый")
 * - Проверяет тег у ОРУЖИЯ "в руках".
 *
 * SuperDuperItemTags.consumeHeldItem()
 * - Уничтожает ОБЫЧНЫЙ предмет в руках.
 *
 * SuperDuperItemTags.consumeHeldWeapon()
 * - Уничтожает ОРУЖИЕ в руках.
 */

var Imported = Imported || {};
Imported.SuperDuperItemTags = true;

var SuperDuperItemTags = SuperDuperItemTags || {};

(function() {
    'use strict';

    //=============================================================================
    // Инициализация параметров плагина
    // ВНИМАНИЕ: Имя файла должно быть строго SuperDuperItemTags.js
    //=============================================================================
    var parameters = PluginManager.parameters('SuperDuperItemTags');
    SuperDuperItemTags.heldItemVarId = Number(parameters['HeldItemVariable'] || 1);
    
    // Выводим в консоль для проверки (нажми F8 в игре, чтобы увидеть)
    console.log("SuperDuperItemTags: Плагин запущен. Переменная предмета в руках установлена на ID " + SuperDuperItemTags.heldItemVarId);

    //=============================================================================
    // DataManager
    // Перехватываем загрузку базы данных, чтобы закэшировать наши теги
    //=============================================================================
    var _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        
        if (!SuperDuperItemTags._isLoaded) {
            SuperDuperItemTags.processTags($dataItems);
            SuperDuperItemTags.processTags($dataWeapons);
            SuperDuperItemTags.processTags($dataArmors);
            SuperDuperItemTags._isLoaded = true;
        }
        
        return true;
    };

    /**
     * Проходит по массиву данных и кэширует теги для быстрого доступа.
     */
    SuperDuperItemTags.processTags = function(dataArray) {
        for (var i = 1; i < dataArray.length; i++) {
            var item = dataArray[i];
            if (item) {
                item.sptags = [];
                item.spdisposable = false;

                if (item.meta) {
                    for (var key in item.meta) {
                        var lowerKey = key.trim().toLowerCase();
                        
                        if (lowerKey === 'sptags') {
                            var rawTags = String(item.meta[key]).split(',');
                            for (var j = 0; j < rawTags.length; j++) {
                                var cleanedTag = rawTags[j].trim().toLowerCase();
                                
                                // Если пользователь вписал spdisposable прямо внутрь sptags
                                if (cleanedTag === 'spdisposable') {
                                    item.spdisposable = true;
                                } else if (cleanedTag !== "") {
                                    item.sptags.push(cleanedTag);
                                }
                            }
                        }
                        
                        // Если тег написан отдельно на новой строке, как <spdisposable>
                        if (lowerKey === 'spdisposable') {
                            item.spdisposable = true;
                        }
                    }
                }
            }
        }
    };

    //=============================================================================
    // API функции плагина
    //=============================================================================

    SuperDuperItemTags.hasTag = function(item, tag) {
        if (!item || !item.sptags) return false;
        return item.sptags.indexOf(tag.toLowerCase()) >= 0;
    };

    SuperDuperItemTags.isDisposable = function(item) {
        if (!item) return false;
        return !!item.spdisposable;
    };

    SuperDuperItemTags.hasItemWithTag = function(tag) {
        var allItems = $gameParty.allItems();
        for (var i = 0; i < allItems.length; i++) {
            if (this.hasTag(allItems[i], tag)) {
                return true;
            }
        }
        return false;
    };

    SuperDuperItemTags.checkItemInVariable = function(variableId, tag) {
        var itemId = $gameVariables.value(variableId);
        if (itemId <= 0) return false;
        var item = $dataItems[itemId];
        
        var hasReqTag = this.hasTag(item, tag);
        
        // Если проверка пройдена и предмет одноразовый - сразу ломаем его
        if (hasReqTag && this.isDisposable(item)) {
            $gameParty.loseItem(item, 1);
        }
        
        return hasReqTag;
    };

    SuperDuperItemTags.checkWeaponInVariable = function(variableId, tag) {
        var itemId = $gameVariables.value(variableId);
        if (itemId <= 0) return false;
        var item = $dataWeapons[itemId];
        
        var hasReqTag = this.hasTag(item, tag);
        
        // Если проверка пройдена и оружие одноразовое - сразу ломаем его
        if (hasReqTag && this.isDisposable(item)) {
            $gameParty.loseItem(item, 1);
        }
        
        return hasReqTag;
    };

    SuperDuperItemTags.consumeItemInVariable = function(variableId) {
        var itemId = $gameVariables.value(variableId);
        if (itemId <= 0) return false;
        var item = $dataItems[itemId];
        
        if (this.isDisposable(item)) {
            $gameParty.loseItem(item, 1);
            return true;
        }
        return false;
    };

    SuperDuperItemTags.heldItemHasTag = function(tag) {
        return this.checkItemInVariable(this.heldItemVarId, tag);
    };

    SuperDuperItemTags.heldWeaponHasTag = function(tag) {
        return this.checkWeaponInVariable(this.heldItemVarId, tag);
    };

    SuperDuperItemTags.consumeHeldItem = function() {
        return this.consumeItemInVariable(this.heldItemVarId);
    };

    SuperDuperItemTags.consumeHeldWeapon = function() {
        var itemId = $gameVariables.value(this.heldItemVarId);
        if (itemId <= 0) return false;
        var item = $dataWeapons[itemId];
        
        if (this.isDisposable(item)) {
            $gameParty.loseItem(item, 1);
            return true;
        }
        return false;
    };

})();