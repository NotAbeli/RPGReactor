/*:
 * @plugindesc Super Duper Gifts - система подарков на основе тегов и списков.
 * @author Korolev
 *
 * @param Characters
 * @text Список персонажей
 * @desc Настройте персонажей, их переменные отношений, любимые теги и заготовленные предметы.
 * @type struct<Character>[]
 * @default []
 *
 * @help
 * ============================================================================
 * Описание
 * ============================================================================
 * Этот плагин работает в связке с "SuperDuperItemTags". Он позволяет
 * дарить предметы персонажам, начисляя очки в указанную переменную.
 * * Логика начисления очков:
 * 1. Проверяются "Запрещенные предметы" и "Запрещенные теги". Если предмет
 * находится в них, дарение прерывается и возвращается код -11.
 * 2. Если предмет разрешен, плагин ищет его в "Заготовленных предметах".
 * Если находит - дает фиксированное количество очков из списка.
 * 3. Если предмета в списке нет, проверяются "Любимые теги" (настройки тегов).
 * Если у предмета есть нужный тег, очки рассчитываются по формуле: 
 * (Цена предмета * Индивидуальный множитель тега).
 * 4. Если ничего не совпало, начисляются "Очки по умолчанию".
 * 5. При успешном дарении предмет пропадает из инвентаря (1 шт.).
 *
 * ============================================================================
 * Использование в скриптах (API)
 * ============================================================================
 * Вставьте эту команду в ивент -> Выполнить скрипт (Script)
 *
 * СПОСОБ 1 (С отдельной переменной результата):
 * gift("Имя_Персонажа", ПеременнаяПредмета, ПеременнаяРезультата)
 * Пример: gift("Алиса", 18, 3) 
 * -> Берет предмет из 18 переменной, дарит Алисе, результат пишет в 3.
 *
 * СПОСОБ 2 (В одну переменную):
 * gift("Имя_Персонажа", ПеременнаяПредмета)
 * Пример: gift("Алиса", 19)
 * -> Плагин прочитает ID предмета из 19 переменной, подарит его, 
 * и ТУДА ЖЕ (в 19-ю переменную) запишет результат.
 *
 * КОДЫ РЕЗУЛЬТАТОВ:
 * > 0  : Подарок успешно подарен, очки начислены.
 * 0  : Подарок принят, но не вызвал восторга (0 очков). Предмет исчезает.
 * -11  : Персонаж отказался от подарка (черный список). Предмет остается.
 * -12  : Вы ничего не выбрали или предмета нет в инвентаре.
 */

/*~struct~Character:
 * @param Id
 * @text Идентификатор (Имя)
 * @desc Уникальное имя или ID персонажа для вызова в скриптах (например: Алиса, npc1).
 * @type string
 * * @param VariableId
 * @text Переменная отношений
 * @desc ID переменной, к которой будут прибавляться/отниматься очки.
 * @type variable
 * @default 1
 * * @param SpecificItems
 * @text Заготовленные предметы
 * @desc Список конкретных предметов и очков за них (игнорируют теги и цены).
 * @type struct<SpecificItem>[]
 * @default []
 * * @param TagSettings
 * @text Настройки любимых тегов
 * @desc Список тегов и множителей цены для каждого из них.
 * @type struct<TagSetting>[]
 * @default []
 *
 * @param DisallowedItems
 * @text Запрещенные предметы (ID)
 * @desc Список обычных предметов, которые этот персонаж откажется брать.
 * @type item[]
 * @default []
 *
 * @param DisallowedTags
 * @text Запрещенные теги
 * @desc Предметы с этими тегами персонаж откажется брать.
 * @type string[]
 * @default []
 *
 * @param DefaultPoints
 * @text Очки по умолчанию
 * @desc Сколько очков дать, если предмет можно подарить, но его нет в списках?
 * @type number
 * @min -9999
 * @default 0
 */

/*~struct~SpecificItem:
 * @param ItemId
 * @text Предмет
 * @desc Выберите обычный предмет из базы данных.
 * @type item
 * @default 1
 * * @param Points
 * @text Очки отношений
 * @desc Сколько очков дает этот предмет.
 * @type number
 * @min -9999
 * @default 10
 */

/*~struct~TagSetting:
 * @param Tag
 * @text Тег
 * @desc Тег, который любит персонаж (например: сладости, оружие).
 * @type string
 * * @param Multiplier
 * @text Множитель стоимости
 * @desc Сколько очков дать от цены предмета с этим тегом? (1.0 = 100%, 0.5 = 50%)
 * @type number
 * @decimals 2
 * @default 1.00
 */

var Imported = Imported || {};
Imported.SuperDuperGifts = true;

var SuperDuperGifts = SuperDuperGifts || {};

(function() {
    'use strict';

    //=============================================================================
    // Инициализация параметров
    //=============================================================================
    var parameters = PluginManager.parameters('SuperDuperGifts');
    SuperDuperGifts.characters = [];

    // Парсинг сложной структуры данных персонажей
    try {
        var rawChars = JSON.parse(parameters['Characters'] || '[]');
        for (var i = 0; i < rawChars.length; i++) {
            var charData = JSON.parse(rawChars[i]);
            
            // Парсим заготовленные предметы
            var specificItemsRaw = JSON.parse(charData.SpecificItems || '[]');
            var specificItems = specificItemsRaw.map(function(itemStr) {
                var itemData = JSON.parse(itemStr);
                return {
                    itemId: Number(itemData.ItemId),
                    points: Number(itemData.Points)
                };
            });
            
            // Парсим настройки тегов с индивидуальными множителями (отсекаем пустые)
            var tagSettingsRaw = JSON.parse(charData.TagSettings || '[]');
            var tagSettings = tagSettingsRaw.map(function(tsStr) {
                var tsData = JSON.parse(tsStr);
                return {
                    tag: String(tsData.Tag).trim().toLowerCase(),
                    multiplier: Number(tsData.Multiplier || 1.0)
                };
            }).filter(function(ts) { return ts.tag !== ""; });

            // Парсим запрещенные предметы и теги (отсекаем пустые)
            var disallowedItemsRaw = JSON.parse(charData.DisallowedItems || '[]');
            var disallowedItems = disallowedItemsRaw.map(Number).filter(function(id) { return id > 0; });

            var disallowedTagsRaw = JSON.parse(charData.DisallowedTags || '[]');
            var disallowedTags = disallowedTagsRaw.map(function(t) {
                return String(t).trim().toLowerCase();
            }).filter(function(t) { return t !== ""; });
            
            SuperDuperGifts.characters.push({
                id: String(charData.Id).trim(),
                variableId: Number(charData.VariableId || 1),
                specificItems: specificItems,
                tagSettings: tagSettings,
                disallowedItems: disallowedItems,
                disallowedTags: disallowedTags,
                defaultPoints: Number(charData.DefaultPoints || 0)
            });
        }
        console.log("SuperDuperGifts: Успешно загружено персонажей: " + SuperDuperGifts.characters.length);
    } catch (e) {
        console.error("SuperDuperGifts: Ошибка при чтении параметров персонажей. Проверьте настройки плагина!", e);
    }

    //=============================================================================
    // Внутренние функции
    //=============================================================================
    SuperDuperGifts.getCharacter = function(characterId) {
        for (var i = 0; i < this.characters.length; i++) {
            if (this.characters[i].id === characterId) {
                return this.characters[i];
            }
        }
        return null;
    };

    /**
     * Основная логика обработки подарка.
     * @param {string} characterId - Идентификатор персонажа из настроек.
     * @param {object} item - Объект предмета из базы данных.
     * @param {number} [resultVarId] - ID переменной для записи результата.
     * @returns {number} Количество начисленных очков или отрицательный код ошибки.
     */
    SuperDuperGifts.processGift = function(characterId, item, resultVarId) {
        if (!item) {
            if (resultVarId) $gameVariables.setValue(resultVarId, -12);
            return -12;
        }
        var charData = this.getCharacter(characterId);
        if (!charData) {
            console.warn("SuperDuperGifts: Персонаж с ID '" + characterId + "' не найден в настройках плагина!");
            if (resultVarId) $gameVariables.setValue(resultVarId, -12);
            return -12;
        }

        // 1. Проверка на ЗАПРЕЩЕННЫЕ ПРЕДМЕТЫ (Строгий отказ = -11)
        if (DataManager.isItem(item) && charData.disallowedItems.indexOf(item.id) >= 0) {
            if (resultVarId) $gameVariables.setValue(resultVarId, -11);
            return -11;
        }

        // 2. Проверка на ЗАПРЕЩЕННЫЕ ТЕГИ (Строгий отказ = -11)
        if (Imported.SuperDuperItemTags && charData.disallowedTags.length > 0) {
            for (var d = 0; d < charData.disallowedTags.length; d++) {
                if (SuperDuperItemTags.hasTag(item, charData.disallowedTags[d])) {
                    if (resultVarId) $gameVariables.setValue(resultVarId, -11);
                    return -11;
                }
            }
        }

        var points = charData.defaultPoints;
        var matched = false;

        // 3. Проверяем заготовленные предметы
        if (DataManager.isItem(item) && charData.specificItems.length > 0) {
            for (var i = 0; i < charData.specificItems.length; i++) {
                if (charData.specificItems[i].itemId === item.id) {
                    points = charData.specificItems[i].points;
                    matched = true;
                    break;
                }
            }
        }

        // 4. Проверяем любимые теги с индивидуальными множителями
        if (!matched && Imported.SuperDuperItemTags && charData.tagSettings.length > 0) {
            for (var j = 0; j < charData.tagSettings.length; j++) {
                if (SuperDuperItemTags.hasTag(item, charData.tagSettings[j].tag)) {
                    points = Math.floor((item.price || 0) * charData.tagSettings[j].multiplier);
                    matched = true;
                    break;
                }
            }
        }

        // 5. Начисляем очки в переменную отношений
        var currentPoints = $gameVariables.value(charData.variableId);
        $gameVariables.setValue(charData.variableId, currentPoints + points);

        // 6. Записываем результат в указанную переменную, если она передана
        if (resultVarId) {
            $gameVariables.setValue(resultVarId, points);
        }

        // 7. Уничтожаем предмет (подарок принят, даже если дал 0 очков)
        this.removeItemSafely(item);

        return points;
    };

    /**
     * Безопасное удаление предмета с полной поддержкой Super Duper Inventory.
     * @param {object} item - Объект предмета.
     */
    SuperDuperGifts.removeItemSafely = function(item) {
        // Стандартное удаление из движка (удаляется строго 1 штука)
        $gameParty.loseItem(item, 1);

        // Проверяем, сколько таких предметов осталось в инвентаре
        var itemsLeft = $gameParty.numItems(item);

        // Если это была последняя штука, только тогда стираем ячейку и курсор
        if (itemsLeft <= 0) {
            // Фикс для Super Duper Inventory: удаляем "призрак" из ячейки инвентаря
            if ($gameParty._sdiGrid) {
                var index = $gameParty._sdiGrid.indexOf(item);
                if (index !== -1) {
                    $gameParty._sdiGrid[index] = null;
                }
            }

            // Очистка курсора и принудительное обновление, если инвентарь или сундук активны
            if (typeof SDI_Controller !== 'undefined') {
                if (SDI_Controller.heldItem) {
                    if (SDI_Controller.heldItem === item || SDI_Controller.heldItem.item === item) {
                        SDI_Controller.heldItem = null;
                    }
                }
            }
        }

        // Обновляем визуал в любом случае, чтобы обновилась цифра количества
        if (typeof SDI_Controller !== 'undefined' && typeof SDI_Controller.refreshAll === 'function') {
            SDI_Controller.refreshAll();
        }
    };

    //=============================================================================
    // API для использования в ивентах
    //=============================================================================

    /**
     * Основная команда дарения для вызова из ивентов.
     * @param {string} characterId - Имя персонажа.
     * @param {number} itemVarId - Переменная с ID предмета.
     * @param {number} [resultVarId] - (Опционально) Переменная для записи результата.
     */
    SuperDuperGifts.gift = function(characterId, itemVarId, resultVarId) {
        // Если третья переменная не указана, используем вторую для записи результата
        var targetVarId = resultVarId || itemVarId;
        
        // ЗАЩИТА ОТ ПОЛОМКИ ИНВЕНТАРЯ:
        // Если переменная результата совпадает с переменной "Предмет в руках" из первого плагина,
        // инвентарь сойдет с ума, получив туда отрицательный код. Мы блокируем такую перезапись.
        if (Imported.SuperDuperItemTags && targetVarId === SuperDuperItemTags.heldItemVarId) {
            console.warn("SuperDuperGifts: ОШИБКА! Вы пытаетесь записать результат в переменную предмета в руках! Это ломает инвентарь и заставляет его выкидывать предметы. Используйте разные переменные, например gift('Алиса', 19, 20)");
            targetVarId = null;
        }

        var itemId = $gameVariables.value(itemVarId);
        
        // Если передали 0 или ничего (нет предмета в руках/в выборе)
        if (itemId <= 0) {
            if (targetVarId) $gameVariables.setValue(targetVarId, -12); // -12 означает отсутствие выбора
            return -12;
        }
        
        var item = $dataItems[itemId];
        
        // Проверяем, есть ли предмет у партии. 
        // Добавлен обход для предметов, которые сейчас висят на курсоре в SDI.
        var hasItem = $gameParty.hasItem(item);
        if (!hasItem && typeof SDI_Controller !== 'undefined' && SDI_Controller.heldItem) {
            var heldObj = SDI_Controller.heldItem;
            if (heldObj === item || heldObj.item === item) {
                hasItem = true;
            }
        }

        // Если предмета всё равно нет (игрок мог потратить его перед выбором), возвращаем -12
        if (!hasItem) {
            if (targetVarId) $gameVariables.setValue(targetVarId, -12);
            return -12;
        }

        return this.processGift(characterId, item, targetVarId);
    };

    // Оставлены для обратной совместимости или прямого вызова
    SuperDuperGifts.giveItemGift = function(characterId, itemId) {
        var item = $dataItems[itemId];
        if (!item || !$gameParty.hasItem(item)) return -12;
        return this.processGift(characterId, item);
    };

    SuperDuperGifts.giveHeldItemGift = function(characterId) {
        if (!Imported.SuperDuperItemTags) return -12;
        var itemId = $gameVariables.value(SuperDuperItemTags.heldItemVarId);
        if (itemId <= 0) return -12;
        
        var item = $dataItems[itemId];
        if (!$gameParty.hasItem(item)) return -12;

        return this.processGift(characterId, item);
    };

    //=============================================================================
    // Глобальные сокращения (алиасы)
    //=============================================================================
    window.gift = function(characterId, itemVarId, resultVarId) {
        return SuperDuperGifts.gift(characterId, itemVarId, resultVarId);
    };

})();