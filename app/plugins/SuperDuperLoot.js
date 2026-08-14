/*:
 * @target MZ MV
 * @plugindesc [v1.7] SuperDuperLoot - Расширенная типизация и выдача лута (включая сундуки).
 * @author Korolev
 *
 * @help SuperDuperLoot.js
 * Плагин-надстройка над вашей стандартной базой данных.
 * * ============================================================================
 * КОМАНДЫ ПЛАГИНА (ВЫДАЧА ЛУТА ИГРОКУ)
 * ============================================================================
 * В RPG Maker MZ: 
 * Используйте стандартный интерфейс команд плагина в событиях.
 * Выберите команду "Выдать случайный лут".
 * * В RPG Maker MV:
 * Используйте текстовую команду плагина в формате:
 * SDL Give [Категория] [Стоимость]
 * Примеры:
 * SDL Give Технические 3     (Выдаст лут ровно на 3 монеты)
 * SDL Give кнцл 1-3          (Выдаст лут на случайную сумму от 1 до 3)
 *
 * Правила выдачи:
 * 1. Выбирается только один тип предмета.
 * 2. Общий размер выданных предметов одного типа не может превышать 4 
 * (исключение: предметы стоимостью 1 игнорируют лимиты и выдаются в 
 * количестве от 1 до 6 штук случайным броском кубика).
 *
 * ============================================================================
 * ИНТЕГРАЦИЯ С SUPER DUPER INVENTORY (ГЕНЕРАЦИЯ В СУНДУКИ)
 * ============================================================================
 * Вы можете генерировать случайный лут сразу внутрь сундука на основе
 * количества вещей (слотов), категории и общего бюджета стоимости.
 *
 * Команда для MV:
 * SDL FillChest [ID Сундука] [Категория] [Кол-во Вещей] [Общая Стоимость] [Макс. Цена 1 вещи (опц.)]
 * * Если вместо [ID Сундука] написать this, лут сгенерируется в сундук
 * текущего события.
 * * Примеры:
 * SDL FillChest this Канцелярия 2 5
 * (Генерирует в этот сундук ровно 2 вещи из Канцелярии на сумму 5)
 * * SDL FillChest this Технические 1-3 10-20
 * (Генерирует от 1 до 3 вещей общей стоимостью от 10 до 20)
 * * SDL FillChest this Метизы 1-5 10 2
 * (Сгенерирует от 1 до 5 вещей на 10 монет, но ни один предмет не будет дороже 2 монет)
 *
 * ВАЖНО: Если вы несколько раз вызываете команду заполнения одного сундука,
 * плагин будет складывать одинаковые предметы в одну ячейку (стакать их),
 * а не дублировать слоты.
 *
 * ============================================================================
 * ИНТЕГРАЦИЯ С SUPER DUPER DROP
 * ============================================================================
 * Если установлен плагин SuperDuperDrop, при выдаче лута автоматически
 * будут появляться всплывающие уведомления над головой персонажа.
 *
 * ============================================================================
 * СКРИПТЫ ДЛЯ ПРОДВИНУТЫХ
 * ============================================================================
 * 1. Получить данные по ID предмета:
 * $gameCustomDB.items[id] 
 * (Вернет объект: { category: "Канцелярия", price: 1, size: 1, data: Object })
 * 2. Проверить категорию предмета:
 * $gameCustomDB.items[id].category
 * 3. Получить массив всех ID предметов в категории:
 * $gameCustomDB.categories["Технические"] 
 * * @command GiveRandomLoot
 * @text Выдать случайный лут
 * @desc Выдает случайный предмет из категории с учетом цены и лимита по размеру.
 *
 * @arg Category
 * @text Категория
 * @type string
 * @desc Название категории (например: Технические).
 *
 * @arg Value
 * @text Стоимость лута
 * @type string
 * @desc Точное число (например: 3) или случайный диапазон (например: 1-3).
 *
 * @command FillChest
 * @text Заполнить сундук
 * @desc Генерирует предметы в указанном сундуке по категории и бюджету.
 *
 * @arg ChestId
 * @text ID Сундука
 * @type string
 * @default this
 * @desc Имя сундука. Введите this, чтобы привязать к текущему событию.
 *
 * @arg Category
 * @text Категория
 * @type string
 * @desc Название категории из SuperDuperLoot (например: Технические).
 *
 * @arg Count
 * @text Количество вещей
 * @type string
 * @default 1-3
 * @desc Количество уникальных вещей (слотов). Число (3) или диапазон (1-3).
 *
 * @arg Value
 * @text Общая стоимость
 * @type string
 * @default 5-10
 * @desc Бюджет на весь сгенерированный лут. Число (10) или диапазон (5-10).
 *
 * @arg MaxItemValue
 * @text Макс. цена предмета
 * @type string
 * @default 
 * @desc (Опционально) Макс. цена за 1 предмет. Оставьте пустым, если лимит не нужен.
 *
 * @param Categories
 * @text Категории сортировки
 * @type struct<Category>[]
 * @default []
 * @desc Список категорий для сортировки предметов из БД.
 */

/*~struct~Category:
 * @param Name
 * @text Название категории
 * @type string
 * @desc Имя группы (например, "Канцелярия", "Технические").
 *
 * @param Items
 * @text Предметы в группе
 * @type struct<Item>[]
 * @default []
 * @desc Выберите предметы из базы данных и задайте им свойства.
 */

/*~struct~Item:
 * @param ItemId
 * @text Предмет из БД
 * @type item
 * @default 1
 * @desc Выберите реальный предмет из вкладки Items.
 *
 * @param Price
 * @text Кастомная цена
 * @type number
 * @min 1
 * @default 1
 * @desc Цена для вашей новой экономики (минимум 1).
 *
 * @param Size
 * @text Размер
 * @type number
 * @min 1
 * @default 1
 * @desc Размер предмета (минимум 1).
 */

var SuperDuperLoot = SuperDuperLoot || {};

(function() {
    'use strict';

    const pluginName = "SuperDuperLoot";
    const parameters = PluginManager.parameters(pluginName);

    // Универсальный глубокий парсер для многослойных JSON от RPG Maker
    SuperDuperLoot.parseDeep = function(data) {
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                return SuperDuperLoot.parseDeep(parsed);
            } catch (e) {
                return data;
            }
        } else if (Array.isArray(data)) {
            return data.map(item => SuperDuperLoot.parseDeep(item));
        } else if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const key in data) {
                result[key] = SuperDuperLoot.parseDeep(data[key]);
            }
            return result;
        }
        return data;
    };

    // Парсер для строк вроде "1-3" или "5"
    SuperDuperLoot.parseRange = function(str) {
        if (typeof str === 'number') return str;
        str = String(str).trim();
        if (str.includes('-')) {
            const parts = str.split('-');
            const min = parseInt(parts[0], 10);
            const max = parseInt(parts[1], 10);
            if (isNaN(min) || isNaN(max)) return 1;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        const val = parseInt(str, 10);
        return isNaN(val) ? 1 : val;
    };

    SuperDuperLoot.rawCategories = SuperDuperLoot.parseDeep(parameters['Categories'] || "[]");

    // Главный объект базы: разделен на категории и быстрый поиск по ID
    window.$gameCustomDB = {
        categories: {},
        items: {}
    };

    // Надежная инициализация: срабатывает, когда база данных движка точно загружена
    const _DataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
        if (!_DataManager_isDatabaseLoaded.call(this)) return false;
        if (!SuperDuperLoot._isInitialized) {
            SuperDuperLoot.initDatabase();
            SuperDuperLoot._isInitialized = true;
        }
        return true;
    };

    SuperDuperLoot.initDatabase = function() {
        window.$gameCustomDB.categories = {};
        window.$gameCustomDB.items = {};
        
        for (const cat of SuperDuperLoot.rawCategories) {
            const catName = cat.Name;
            if (!catName) continue;
            
            window.$gameCustomDB.categories[catName] = [];
            const items = cat.Items || [];
            
            for (const itemEntry of items) {
                const id = Number(itemEntry.ItemId);
                if (!id || !$dataItems[id]) continue;
                
                // Добавляем ID в список категории
                window.$gameCustomDB.categories[catName].push(id);
                
                // Защита от нулевых значений
                let pPrice = Number(itemEntry.Price);
                let pSize = Number(itemEntry.Size);
                
                window.$gameCustomDB.items[id] = {
                    category: catName,
                    price: (isNaN(pPrice) || pPrice <= 0) ? 1 : pPrice,
                    size: (isNaN(pSize) || pSize <= 0) ? 1 : pSize,
                    data: $dataItems[id]
                };
            }
        }
        console.log("SuperDuperLoot: Интеграция с БД завершена.", window.$gameCustomDB);
    };

    SuperDuperLoot.getItemData = function(itemId) {
        return window.$gameCustomDB.items[itemId] || null;
    };

    SuperDuperLoot.isInCategory = function(itemId, categoryName) {
        const item = this.getItemData(itemId);
        return item && item.category.toLowerCase() === categoryName.toLowerCase();
    };

    SuperDuperLoot.giveRandomLoot = function(categoryName, valueStr) {
        if (!$gameParty) return;
        
        let targetValue = 0;
        if (typeof valueStr === 'string' && valueStr.includes('-')) {
            const parts = valueStr.split('-');
            const min = parseInt(parts[0], 10);
            const max = parseInt(parts[1], 10);
            targetValue = Math.floor(Math.random() * (max - min + 1)) + min;
        } else {
            targetValue = parseInt(valueStr, 10);
        }
        
        if (isNaN(targetValue) || targetValue <= 0) {
            console.warn(`SuperDuperLoot: Некорректная стоимость (${valueStr})`);
            return;
        }

        // Поиск категории без учета регистра букв
        const actualCatName = Object.keys(window.$gameCustomDB.categories).find(
            key => key.toLowerCase() === categoryName.toLowerCase()
        );

        const catItems = actualCatName ? window.$gameCustomDB.categories[actualCatName] : null;
        if (!catItems || catItems.length === 0) {
            console.warn(`SuperDuperLoot: Категория "${categoryName}" пуста или не существует.`);
            return;
        }

        const validItemIds = catItems.filter(id => {
            const data = window.$gameCustomDB.items[id];
            return data && data.price <= targetValue && data.size <= 4;
        });

        if (validItemIds.length === 0) {
            console.log(`SuperDuperLoot: В категории "${actualCatName}" нет предметов под бюджет ${targetValue}.`);
            return;
        }

        const randomIndex = Math.floor(Math.random() * validItemIds.length);
        const chosenId = validItemIds[randomIndex];
        const itemData = window.$gameCustomDB.items[chosenId];

        let quantity = 0;
        
        // --- НОВОЕ ПРАВИЛО: Кубики для предметов стоимостью 1 ---
        if (itemData.price === 1) {
            quantity = Math.floor(Math.random() * 6) + 1;
            // Лимиты полностью игнорируются
        } else {
            quantity = Math.floor(targetValue / itemData.price);
            let maxAllowedQtyBySize = Math.floor(4 / itemData.size);
            quantity = Math.min(quantity, maxAllowedQtyBySize);
        }

        if (quantity > 0) {
            var itemObj = $dataItems[chosenId];
            $gameParty.gainItem(itemObj, quantity);
            
            // Вызов всплывающего уведомления из Super Duper Drop
            if (typeof SDI_DropController !== 'undefined' && $gamePlayer) {
                var px = ($gamePlayer._realX !== undefined) ? $gamePlayer._realX : $gamePlayer.x;
                var py = ($gamePlayer._realY !== undefined) ? $gamePlayer._realY : $gamePlayer.y;
                SDI_DropController.triggerPopup(itemObj, quantity, px, py);
            }

            console.log(`SuperDuperLoot: Выдано ${quantity}x [${itemData.data.name}] (Бюджет/Бросок: ${targetValue}, Размер: ${itemData.size})`);
        }
    };

    SuperDuperLoot.fillChestLoot = function(chestId, categoryName, countStr, valueStr, maxItemValueStr) {
        if (!window.$gameCustomDB) return;
        if (!$gameSystem || typeof $gameSystem.addItemToChest !== 'function') {
            console.error("SuperDuperLoot: Плагин SuperDuperInventory не установлен или устарел!");
            return;
        }

        let count = this.parseRange(countStr);
        let budget = this.parseRange(valueStr);
        let maxItemValue = (maxItemValueStr && maxItemValueStr !== "") ? this.parseRange(maxItemValueStr) : Infinity;

        if (count <= 0 || budget <= 0) return;

        // Поиск категории без учета регистра букв
        const actualCatName = Object.keys(window.$gameCustomDB.categories).find(
            key => key.toLowerCase() === categoryName.toLowerCase()
        );

        if (!actualCatName) {
            console.warn(`SuperDuperLoot: Категория "${categoryName}" не найдена.`);
            return;
        }

        const catItems = window.$gameCustomDB.categories[actualCatName];
        
        // Оставляем только те предметы, которые влезают в бюджет, лимит размера и лимит стоимости
        let validIds = catItems.filter(id => {
            const data = window.$gameCustomDB.items[id];
            return data && data.price <= budget && data.size <= 4 && data.price <= maxItemValue;
        });

        if (validIds.length === 0) {
            console.log(`SuperDuperLoot: В категории "${actualCatName}" нет предметов под заданные лимиты бюджета (${budget}) или стоимости (${maxItemValue}).`);
            return;
        }

        // Перемешиваем массив доступных ID
        for (let i = validIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validIds[i], validIds[j]] = [validIds[j], validIds[i]];
        }

        // Ограничиваем желаемое количество вещей реальным количеством подходящих предметов
        count = Math.min(count, validIds.length);

        let selectedSlots = [];
        let currentBudget = budget;

        // ШАГ 1: Выбираем "Count" предметов, гарантируя, что каждому достанется хотя бы 1 штука
        for (let i = 0; i < count; i++) {
            let minRequiredForRest = count - 1 - i;
            let candidateIdx = validIds.findIndex(id => {
                return window.$gameCustomDB.items[id].price <= (currentBudget - minRequiredForRest);
            });

            if (candidateIdx !== -1) {
                let chosenId = validIds.splice(candidateIdx, 1)[0];
                let itemData = window.$gameCustomDB.items[chosenId];

                let maxQty = Math.floor(4 / itemData.size);
                let initialQty = 1;

                // --- НОВОЕ ПРАВИЛО: Кубики для предметов стоимостью 1 в сундуках ---
                if (itemData.price === 1) {
                    initialQty = Math.floor(Math.random() * 6) + 1;
                    maxQty = initialQty; // Запрещаем добавлять в Шаге 2, так как количество уже финальное
                }

                selectedSlots.push({
                    id: chosenId,
                    itemObj: itemData.data,
                    price: itemData.price,
                    size: itemData.size,
                    qty: initialQty, 
                    maxQty: maxQty 
                });
                
                // Вычитаем только базовую стоимость из бюджета. Если предмет стоит 1, 
                // мы тратим 1, а всё остальное - бесплатный бонус от броска кубика.
                currentBudget -= itemData.price; 
            } else {
                break;
            }
        }

        // ШАГ 2: Распределяем оставшийся бюджет
        let activeSlots = selectedSlots.filter(s => s.qty < s.maxQty);

        while (currentBudget > 0 && activeSlots.length > 0) {
            let rIdx = Math.floor(Math.random() * activeSlots.length);
            let slot = activeSlots[rIdx];

            if (slot.price <= currentBudget) {
                slot.qty++;
                currentBudget -= slot.price;
                
                if (slot.qty >= slot.maxQty) {
                    activeSlots.splice(rIdx, 1);
                }
            } else {
                activeSlots.splice(rIdx, 1);
            }
        }

        // ШАГ 3: Закидываем сгенерированные вещи в сундук (С УЧЕТОМ СТАКОВ)
        let chestItems = $gameSystem.getChestItems(chestId);
        
        for (let slot of selectedSlots) {
            let stacked = false;
            
            // Сначала ищем, есть ли уже такой предмет в сундуке
            if (chestItems) {
                for (let i = 0; i < chestItems.length; i++) {
                    if (chestItems[i] && chestItems[i].item && chestItems[i].item.id === slot.itemObj.id) {
                        chestItems[i].amount += slot.qty;
                        stacked = true;
                        break;
                    }
                }
            }
            
            // Если предмет не найден в существующих ячейках, кладем в новую свободную ячейку
            if (!stacked) {
                $gameSystem.addItemToChest(chestId, slot.itemObj, slot.qty);
            }
        }

        console.log(`SuperDuperLoot: Заполнен сундук [${chestId}]. Сгенерировано: ${selectedSlots.length}. Остаток бюджета: ${currentBudget}`);
    };

    if (Utils.RPGMAKER_NAME === "MZ") {
        PluginManager.registerCommand(pluginName, "GiveRandomLoot", args => {
            SuperDuperLoot.giveRandomLoot(args.Category, args.Value);
        });
        
        PluginManager.registerCommand(pluginName, "FillChest", function(args) {
            let chestId = args.ChestId;
            if (chestId.toLowerCase() === "this") {
                chestId = "Map" + this._mapId + "_Event" + this._eventId;
            }
            SuperDuperLoot.fillChestLoot(chestId, args.Category, args.Count, args.Value, args.MaxItemValue);
        });
    }

    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command.toUpperCase() === "SUPERDUPERLOOT" || command.toUpperCase() === "SDL") {
            if (args[0] && args[0].toLowerCase() === "give" && args.length >= 3) {
                SuperDuperLoot.giveRandomLoot(args[1], args[2]);
            } else if (args[0] && args[0].toLowerCase() === "fillchest" && args.length >= 5) {
                let chestId = args[1];
                if (chestId.toLowerCase() === "this") {
                    chestId = "Map" + this._mapId + "_Event" + this._eventId;
                }

                let countStr, valueStr, maxItemValueStr, categoryParts;
                // Проверяем, есть ли 5-й опциональный аргумент для цены (через регулярку на числа/диапазоны)
                let isLastArgNumeric = /^\d+(-\d+)?$/.test(args[args.length - 1]);
                let isPrevArgNumeric = /^\d+(-\d+)?$/.test(args[args.length - 2]);
                let isPrevPrevArgNumeric = /^\d+(-\d+)?$/.test(args[args.length - 3]);

                // Если в конце идут 3 "числа" (например: 1-5 10 2)
                if (args.length >= 6 && isLastArgNumeric && isPrevArgNumeric && isPrevPrevArgNumeric) {
                    maxItemValueStr = args[args.length - 1];
                    valueStr = args[args.length - 2];
                    countStr = args[args.length - 3];
                    categoryParts = args.slice(2, args.length - 3);
                } else {
                    maxItemValueStr = null;
                    valueStr = args[args.length - 1];
                    countStr = args[args.length - 2];
                    categoryParts = args.slice(2, args.length - 2);
                }

                let category = categoryParts.join(" ");
                SuperDuperLoot.fillChestLoot(chestId, category, countStr, valueStr, maxItemValueStr);
            }
        }
    };

})();