/*:
 * @plugindesc (v3.5) Super Duper Drop - Физика предметов. Анти-сдвиг (Фикс ползающих предметов).
 * @author Korolev
 *
 * @help
 * Данный плагин работает в связке с Super Duper Inventory.
 * Оптимизирован для работы ТОЛЬКО с типом "Предметы" (Items).
 *
 * --- Интеграция с MOG_TreasurePopup ---
 * Плагин автоматически поддерживает всплывающие подсказки. При подборе кучи
 * звук срабатывает единожды, а уведомления появляются по очереди для
 * каждого предмета (каскадный эффект с задержкой и смещением по высоте).
 *
 * --- Ручные события подбора ---
 * 1. Способ (Авто): Добавьте тег <sdi_drop> в Note или Comment и используйте
 * команду "Изменить предметы" внутри события.
 * 2. Способ (Ручной): Добавьте тег <sdi_drop: id, amount> (например <sdi_drop: 1, 5>).
 *
 * --- ЛОГИКА ПОДБОРА ---
 * Плагин заранее просчитывает, сколько предметов влезет в инвентарь.
 * Если место заканчивается на середине кучи, плагин забирает часть, 
 * а остатки оставляет лежать в ТОМ ЖЕ событии на полу (без моргания графики).
 *
 * @param --- Drop Settings ---
 *
 * @param Drop Char File
 * @parent --- Drop Settings ---
 * @text Стандартная Графика (Файл)
 * @type file
 * @dir img/characters
 * @default !Chest
 *
 * @param Drop Char Index
 * @parent --- Drop Settings ---
 * @text Стандартная Графика (Индекс)
 * @desc Индекс персонажа в файле (0-7).
 * @type number
 * @default 0
 *
 * @param Drop Priority
 * @parent --- Drop Settings ---
 * @text Приоритет события
 * @desc 0 - Под персонажем, 1 - На уровне.
 * @type select
 * @option Под персонажем
 * @value 0
 * @option На уровне
 * @value 1
 * @option Над персонажем
 * @value 2
 * @default 0
 *
 * @param Drop Step Anime
 * @parent --- Drop Settings ---
 * @text Анимация на месте
 * @type boolean
 * @default false
 *
 * @param Drop Walk Anime
 * @parent --- Drop Settings ---
 * @text Анимация шага
 * @type boolean
 * @default false
 *
 * @param Drop Dir Fix
 * @parent --- Drop Settings ---
 * @text Фиксация направления
 * @type boolean
 * @default true
 *
 * @param Drop Radius
 * @parent --- Drop Settings ---
 * @text Радиус стыковки
 * @desc Радиус в клетках, в котором одинаковые предметы сливаются в одну кучу.
 * @type number
 * @default 1
 *
 * @param Icon Scale
 * @parent --- Drop Settings ---
 * @text Масштаб иконки на карте
 * @desc Множитель размера иконки выброшенного предмета (1.0 = 32x32 px, 0.75 = 24x24).
 * @type number
 * @decimals 2
 * @default 0.75
 *
 * @param Icon Y Offset
 * @parent --- Drop Settings ---
 * @text Сдвиг иконки по Y
 * @desc Доп. ручная коррекция позиции иконки по вертикали (px). По умолчанию авто-центр тайла.
 * @type number
 * @default 0
 *
 * @param Icon Blink Min
 * @parent --- Drop Settings ---
 * @text Мин. прозрачность мигания
 * @desc Нижняя граница opacity при мерцании иконки (0-255).
 * @type number
 * @min 0
 * @max 255
 * @default 180
 *
 * @param Icon Blink Max
 * @parent --- Drop Settings ---
 * @text Макс. прозрачность мигания
 * @desc Верхняя граница opacity при мерцании иконки (0-255).
 * @type number
 * @min 0
 * @max 255
 * @default 255
 *
 * @param Icon Blink Period
 * @parent --- Drop Settings ---
 * @text Период мигания (сек)
 * @desc Длительность одного цикла мерцания в секундах (min→max→min).
 * @type number
 * @decimals 2
 * @default 1.00
 *
 * @param Drop Sound
 * @parent --- Drop Settings ---
 * @text Звук падения
 * @type file
 * @dir audio/se
 * @default Equip1
 *
 * @param Drop Sound Vol
 * @parent --- Drop Settings ---
 * @text Громкость падения
 * @type number
 * @default 90
 *
 * @param Drop Pickup Sound
 * @parent --- Drop Settings ---
 * @text Звук подбора предмета
 * @type file
 * @dir audio/se
 * @default Item3
 *
 * @param Drop Pickup Vol
 * @parent --- Drop Settings ---
 * @text Громкость подбора
 * @type number
 * @default 90
 *
 * @param Block Sound
 * @parent --- Drop Settings ---
 * @text Звук запрета выброса
 * @desc Проигрывается при попытке выбросить предмет, когда это запрещено (например, во время диалога).
 * @type file
 * @dir audio/se
 * @default Buzzer1
 *
 * @param Block Sound Vol
 * @parent --- Drop Settings ---
 * @text Громкость запрета
 * @type number
 * @default 80
 *
 * @param Pickup Delay
 * @parent --- Drop Settings ---
 * @text Задержка подбора (Разные)
 * @desc Задержка между подбором РАЗНЫХ вещей из кучи (60 кадр = 1 сек).
 * @type number
 * @default 30
 *
 * @param Stack Pickup Delay
 * @parent --- Drop Settings ---
 * @text Задержка подбора (Стак)
 * @desc Задержка между подбором ОДИНАКОВЫХ вещей (0 - мгновенно).
 * @type number
 * @default 0
 *
 * @param Error Plugin Command
 * @parent --- Drop Settings ---
 * @text Команда плагина при ошибке
 * @desc Выполняется, если нет места. Пример: Hint show_preset default Инвентарь переполнен!
 * @type string
 * @default Hint show_preset default Инвентарь переполнен!
 *
 * @command SDI_ClearRoundItems
 * @text Очистить предметы раунда
 * @desc Удаляет все предметы с тегом <sdi_roundstart> из мира.
 */

/*~struct~CustomGraphic:
 * @param Item ID
 * @text ID предмета
 * @type number
 * @default 1
 *
 * @param Char File
 * @text Файл графики
 * @type file
 * @dir img/characters
 *
 * @param Char Index
 * @text Индекс в файле (0-7)
 * @type number
 * @default 0
 */
// --- Custom Graphics временно отключён (графика берётся из иконки предмета) ---
// /*~struct~CustomGraphic: ... (оригинал сохранён выше для отката)

(function() {
    var parameters = PluginManager.parameters('SuperDuperDrop');
    
    var Config = {
        dropCharName: String(parameters['Drop Char File'] || '!Chest'),
        dropCharIdx: Number(parameters['Drop Char Index'] || 0),
        dropPriority: Number(parameters['Drop Priority'] || 0),
        dropStepAnime: String(parameters['Drop Step Anime']) === 'true',
        dropWalkAnime: String(parameters['Drop Walk Anime']) === 'true',
        dropDirFix: String(parameters['Drop Dir Fix']) !== 'false',
        dropRadius: Number(parameters['Drop Radius'] || 1),
        dropSound: String(parameters['Drop Sound'] || 'Equip1'),
        dropSoundVol: Number(parameters['Drop Sound Vol'] || 90),
        dropPickupSound: String(parameters['Drop Pickup Sound'] || 'Item3'),
        dropPickupVol: Number(parameters['Drop Pickup Vol'] || 90),
        blockSound: String(parameters['Block Sound'] || 'Buzzer1'),
        blockSoundVol: Number(parameters['Block Sound Vol'] || 80),
        errorCmd: String(parameters['Error Plugin Command'] || ''),
        pickupDelay: Number(parameters['Pickup Delay'] || 30),
        stackPickupDelay: Number(parameters['Stack Pickup Delay'] || 0),
        iconScale: Number(parameters['Icon Scale'] || 0.75),
        iconYOffset: Number(parameters['Icon Y Offset'] || 0),
        iconBlinkMin: Number(parameters['Icon Blink Min'] || 180),
        iconBlinkMax: Number(parameters['Icon Blink Max'] || 255),
        iconBlinkPeriod: Number(parameters['Icon Blink Period'] || 1)
        // --- Custom Graphics временно отключён ---
        // , customGraphics: (function() {
        //     var arr = [];
        //     try {
        //         var parsed = JSON.parse(parameters['Custom Graphics'] || '[]');
        //         for(var i=0; i<parsed.length; i++) {
        //             var c = JSON.parse(parsed[i]);
        //             arr.push({
        //                 id: Number(c['Item ID'] || 1),
        //                 name: c['Char File'] || '',
        //                 index: Number(c['Char Index'] || 0)
        //             });
        //         }
        //     } catch(e) {}
        //     return arr;
        // })()
    };

    function playDropSound(isPickup) {
        var snd = isPickup ? Config.dropPickupSound : Config.dropSound;
        var vol = isPickup ? Config.dropPickupVol : Config.dropSoundVol;
        if (snd) {
            AudioManager.playSe({ name: snd, volume: vol, pitch: 100, pan: 0 });
        }
    }

    // ======================================================================
    // COMPATIBILITY & STABILITY PATCHES (Safety Guards)
    // ======================================================================

    var _Game_Event_event = Game_Event.prototype.event;
    Game_Event.prototype.event = function() {
        var eventData = _Game_Event_event.call(this);
        // УЛЬТИМАТИВНЫЙ ФИКС: Если данных нет (при переходе), возвращаем 
        // пустой объект-заглушку, чтобы сторонние плагины не падали на .note или .pages
        if (!eventData && this._eventId > 0) {
            return { note: '', meta: {}, pages: [{list:[], conditions:{}, image:{}}] };
        }
        return eventData;
    };

    var _Game_Event_page = Game_Event.prototype.page;
    Game_Event.prototype.page = function() {
        if (!this.event()) return null; 
        return _Game_Event_page.call(this);
    };

    var _Game_Event_list = Game_Event.prototype.list;
    Game_Event.prototype.list = function() {
        var page = this.page();
        return page ? page.list : []; 
    };

    var _Game_Event_refresh = Game_Event.prototype.refresh;
    Game_Event.prototype.refresh = function() {
        if (this._eventId > 0 && !this.event()) return;
        _Game_Event_refresh.call(this);
    };

    // ======================================================================
    // DROP LOGIC CONTROLLER
    // ======================================================================
    
    window.SDI_DropController = {
        pickupBuffer: [], 
        isProcessingBuffer: false,
        lastQueueTime: 0,
        currentPickupUid: null,
        lastItemId: -1,
        
        popupQueue: [],
        lastPopupTime: 0,
        popupCombo: 0,

        fireErrorCommand: function() {
            if (Config.errorCmd && Config.errorCmd.trim() !== '') {
                var args = Config.errorCmd.split(" ");
                var command = args.shift();
                if ($gameMap && $gameMap._interpreter) {
                    $gameMap._interpreter.pluginCommand(command, args);
                } else {
                    var interpreter = new Game_Interpreter();
                    interpreter.pluginCommand(command, args);
                }
            }
        },

        getDropGraphic: function(item) {
            // Custom Graphics отключён — всегда возвращаем дефолт (фолбэк для предметов без иконки)
            return { name: Config.dropCharName, index: Config.dropCharIdx };
        },

        _iconCache: {},

        getIconBitmap: function(iconIndex) {
            if (this._iconCache[iconIndex]) return this._iconCache[iconIndex];
            var pw = Window_Base._iconWidth;
            var ph = Window_Base._iconHeight;
            var sx = iconIndex % 16 * pw;
            var sy = Math.floor(iconIndex / 16) * ph;
            var bmp = new Bitmap(pw, ph);
            var iconSet = ImageManager.loadSystem('IconSet');
            var draw = function() { bmp.blt(iconSet, sx, sy, pw, ph, 0, 0); };
            if (iconSet.isReady()) draw();
            else iconSet.addLoadListener(draw);
            this._iconCache[iconIndex] = bmp;
            return bmp;
        },

        findValidDropPosition: function(startX, startY) {
            // ОДНА проверка, ОДИН сдвиг. Без циклов.
            // Проверяем тайл прямо снизу (tx, ty+1). Если там хитбкс (стена/объект) —
            // сдвигаем y на -0.3 тайла вверх. Возвращаем результат.
            var x = startX, y = startY;
            var tx = Math.floor(x), ty = Math.floor(y);

            // Проверка одного тайла: стена? объект? край карты?
            // Объекты — через РЕАЛЬНЫЙ коллайдер (ev.collider().aabbox), не через тайл-позицию.
            // Это ловит столы с кастомными хитбоксами, частично заходящими на тайл.
            var isBlocked = function(btx, bty) {
                if (!$gameMap.isValid(btx, bty)) return true;
                if (!$gameMap.checkPassage(btx, bty, 0x0f)) return true;  // стена

                // Тайл как 1×1 box: (btx, bty) → (btx+1, bty+1)
                var tileLeft = btx, tileRight = btx + 1;
                var tileTop = bty, tileBottom = bty + 1;

                var events = $gameMap.events();
                for (var i = 0; i < events.length; i++) {
                    var ev = events[i];
                    if (!ev) continue;
                    var name = (ev.event && ev.event().name) || '';
                    if (name.indexOf('SDI_Dropped_') === 0) continue;  // пропускаем свои дропы

                    // Пробуем коллайдер ивента (точная проверка через AABB)
                    var collider = ev.collider ? ev.collider() : null;
                    if (collider && collider.aabbox) {
                        var a = collider.aabbox;
                        var evLeft = ev._x + a.left;
                        var evRight = ev._x + a.right;
                        var evTop = ev._y + a.top;
                        var evBottom = ev._y + a.bottom;
                        // Стандартный AABB overlap test
                        if (tileLeft < evRight && tileRight > evLeft && tileTop < evBottom && tileBottom > evTop) {
                            return true;
                        }
                    } else {
                        // Fallback: нет коллайдера — тайл-позиция
                        if (Math.floor(ev._x) === btx && Math.floor(ev._y) === bty) return true;
                    }
                }
                return false;
            };

            // Один тайл ниже. Один сдвиг вверх.
            if (isBlocked(tx, ty + 1)) {
                y -= 0.3;
            }

            return {x: x, y: y};
        },

        isPosPassable: function(x, y) {
            // Комбинированная проверка: 3×3 окрестность + circle r=0.5 (матч с иконкой).
            // Ловит ВСЕ стены в радиусе 1 тайла от предмета, включая случаи, когда
            // иконка только визуально касается стены.
            var HasCollider = (typeof Collider !== 'undefined') || (typeof window !== 'undefined' && typeof window.Collider !== 'undefined');
            var Col = (typeof Collider !== 'undefined') ? Collider : (window && window.Collider);

            // 3×3 проверка вокруг центра тайла
            var tileX = Math.floor(x);
            var tileY = Math.floor(y);
            for (var dx = -1; dx <= 1; dx++) {
                for (var dy = -1; dy <= 1; dy++) {
                    var tx = tileX + dx;
                    var ty = tileY + dy;
                    if (!$gameMap.isValid(tx, ty)) return false;
                    if (!$gameMap.checkPassage(tx, ty, 0x0f)) return false;
                    // Ивенты на этом тайле (столы, мебель). Ловим ВСЕ не-through.
                    if ($gameMap.eventsXy) {
                        var events = $gameMap.eventsXy(tx, ty);
                        for (var i = 0; i < events.length; i++) {
                            var ev = events[i];
                            if (ev && !ev.isThrough()) return false;
                        }
                    }
                }
            }

            // Дополнительная тонкая проверка через Altimit Collider (если доступен).
            // Ловит препятствия внутри одного тайла (частичные коллайдеры и т.д.).
            if (HasCollider && Col) {
                try {
                    var tempCollider = Col.createCircle(0, 0, 0.5);
                    var bbox = tempCollider.aabbox;
                    var mesh = $gameMap.collisionMesh ? $gameMap.collisionMesh() : null;
                    if (mesh) {
                        var mapColliders = Col.polygonsWithinColliderList(x, y, bbox, 0, 0, mesh);
                        if (mapColliders && mapColliders.length > 0) {
                            for (var i = 0; i < mapColliders.length; i++) {
                                if (Col.intersect(x, y, tempCollider, 0, 0, mapColliders[i])) return false;
                            }
                        }
                    }
                } catch (e) {
                    // Тихо игнорируем
                }
            }
            return true;
        },

        spawnOrSnapDrop: function(itemData, amountData, exactX, exactY, isSnapAllowed = true, isTemp = false) {
            // ВАЖНО: не округляем координаты! Altimit даёт дробные _realX/Y у игрока,
            // и предметы должны лежать с пиксельной точностью.
            
            var graphic = this.getDropGraphic(itemData);
            var iconIdx = (itemData && itemData.iconIndex) ? itemData.iconIndex : 0;
            var mapId = $gameMap.mapId();

            // --- Стаканье отключено: каждый дроп создаёт своё событие ---
            // Оригинальная логика слияния в existingPile удалена.

            // Проверяем позицию: если пересекает стену — отодвигаемся от неё.
            // Координаты остаются дробными (без округлений).
            var pos = this.findValidDropPosition(exactX, exactY);
            var uid = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var dropData = {
                uid: uid,
                x: pos.x, y: pos.y,
                graphic: graphic,
                iconIndex: iconIdx,
                items: [{item: itemData, amount: amountData}],
                isRound: isTemp
            };
            $gameSystem.addDroppedItem(mapId, dropData);
            this.spawnEventDynamically(dropData);
        },

        dropOnMap: function(sourceType, sourceIdx) {
            if (typeof SDI_Controller === 'undefined') return;
            
            // Абсолютная защита: запрет выброса во время работы выбора предмета или диалогов
            var isItemChoice = $gameMessage && $gameMessage.isItemChoice();
            var isSelection = SDI_Controller.selectionMode;

            if (isItemChoice || isSelection) {
                if (Config.blockSound) {
                    AudioManager.playSe({ name: Config.blockSound, volume: Config.blockSoundVol, pitch: 100, pan: 0 });
                }
                
                // Сбрасываем курсор инвентаря на корню, чтобы иконка не залипала
                SDI_Controller.cancelDrag();
                return;
            }

            var list = SDI_Controller.getList(sourceType);
            var srcObj = list[sourceIdx];
            if (!srcObj) return;
            var itemData, amountData;
            if (sourceType === 'player') {
                itemData = srcObj; amountData = $gameParty.numItems(itemData);
                $gameParty.loseItem(itemData, amountData); $gameParty._sdiGrid[sourceIdx] = null;
            } else {
                itemData = srcObj.item; amountData = srcObj.amount; list[sourceIdx] = null;
            }
            // Предмет всегда падает под ноги ГГ.
            var exactX = ($gamePlayer._realX != null) ? $gamePlayer._realX : $gamePlayer.x;
            var exactY = ($gamePlayer._realY != null) ? $gamePlayer._realY : $gamePlayer.y;
            this.spawnOrSnapDrop(itemData, amountData, exactX, exactY);
            playDropSound(false);
            SDI_Controller.refreshAll();
        },

        // Проверка: есть ли уже дроп-событие в заданном радиусе (по умолч. 0.5 тайла).
        // Нужно чтобы несколько бросков не легли друг на друга.
        hasDropEventAt: function(x, y, radius) {
            if (radius === undefined) radius = 0.5;
            var drops = $gameSystem.getDroppedItems($gameMap.mapId());
            for (var i = 0; i < drops.length; i++) {
                if (Math.abs(drops[i].x - x) <= radius && Math.abs(drops[i].y - y) <= radius) return true;
            }
            return false;
        },

        findFreeEventId: function() {
            for (var i = 1; i < $dataMap.events.length; i++) { if (!$dataMap.events[i]) return i; }
            return $dataMap.events.length;
        },

        createDropEventJSON: function(eventId, drop) {
            var iconIdx = drop.iconIndex;
            if (iconIdx === undefined || iconIdx === null) {
                iconIdx = (drop.items && drop.items[0] && drop.items[0].item && drop.items[0].item.iconIndex) ? drop.items[0].item.iconIndex : 0;
            }
            var useIcon = iconIdx > 0;
            var cName = useIcon ? '' : (drop.graphic ? drop.graphic.name : Config.dropCharName);
            var cIdx  = useIcon ? 0  : (drop.graphic ? drop.graphic.index : Config.dropCharIdx);
            
            // Вшиваем теги для блокировки коллизий и сдвигов от сторонних плагинов
            var baseNote = drop.isRound ? "<sdi_roundstart>" : "<sdi_drop>";
            var fullNote = baseNote + "\n<No Event Overlap>\n<No Collision>";
            if (useIcon) fullNote += "\n<sdi_icon_drop>";
            
            var meta = { sdi_drop: true, sdi_roundstart: drop.isRound };
            if (useIcon) meta.sdi_icon = iconIdx;
            // Сохраняем точную дробную позицию для рендера иконки (минуя _realX, который
            // может быть округлён сторонними плагинами вроде Altimit).
            meta.sdi_exact_x = drop.x;
            meta.sdi_exact_y = drop.y;

            return {
                "id": eventId, "name": "SDI_Dropped_" + drop.uid, "note": fullNote,
                "pages": [{
                    "conditions": { "actorId": 1, "actorValid": false, "itemId": 1, "itemValid": false, "switch1Id": 1, "switch1Valid": false, "switch2Id": 1, "switch2Valid": false, "variableId": 1, "variableValid": false, "variableValue": 0 },
                    "directionFix": Config.dropDirFix, "image": { "characterIndex": cIdx, "characterName": cName, "direction": 2, "pattern": 1, "tileId": 0 },
                    "list": [
                        { "code": 355, "indent": 0, "parameters": ["if (typeof SDI_DropController !== 'undefined') SDI_DropController.tryPickupDroppedItem('" + drop.uid + "', this.eventId());"] },
                        { "code": 0, "indent": 0, "parameters": [] }
                    ],
                    "moveFrequency": 3, "moveRoute": { "list": [{ "code": 0, "parameters": [] }], "repeat": true, "skippable": false, "wait": false },
                    "moveSpeed": 3, "moveType": 0, "priorityType": Config.dropPriority, "stepAnime": useIcon ? false : Config.dropStepAnime, "through": true, "trigger": 0, "walkAnime": useIcon ? false : Config.dropWalkAnime
                }],
                "x": drop.x, "y": drop.y, "meta": meta
            };
        },

        injectDroppedItems: function(mapId) {
            var items = $gameSystem.getDroppedItems(mapId);
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                var drop = items[i]; var eventId = this.findFreeEventId();
                drop.eventId = eventId; $dataMap.events[eventId] = this.createDropEventJSON(eventId, drop);
            }
        },

        spawnEventDynamically: function(drop) {
            var eventId = this.findFreeEventId(); drop.eventId = eventId;
            var json = this.createDropEventJSON(eventId, drop); $dataMap.events[eventId] = json;
            var gameEvent = new Game_Event($gameMap.mapId(), eventId);
            gameEvent._realX = drop.x; gameEvent._realY = drop.y;
            // _x — ДРОБНОЕ, как _realX. На статичных событий Altimit не округляет,
            // а aabbox-проверка подбора работает корректно с дробными координатами.
            gameEvent._x = drop.x; gameEvent._y = drop.y;
            
            // Жесткая привязка при спавне
            gameEvent._sdiDropPosLocked = true;
            gameEvent._sdiLockedX = drop.x;
            gameEvent._sdiLockedY = drop.y;
            // Точная дробная позиция для рендера иконки (вне очереди _realX)
            gameEvent._sdiExactX = drop.x;
            gameEvent._sdiExactY = drop.y;
            
            // Флаг иконки для рендера (дублирующая установка — на случай если setupPageSettings уже отработал)
            var iconIdx = drop.iconIndex;
            if (iconIdx === undefined || iconIdx === null) {
                iconIdx = (drop.items && drop.items[0] && drop.items[0].item && drop.items[0].item.iconIndex) ? drop.items[0].item.iconIndex : 0;
            }
            if (iconIdx > 0) gameEvent._sdiIconIndex = iconIdx;
            
            $gameMap._events[eventId] = gameEvent;
            if (SceneManager._scene instanceof Scene_Map) {
                var spriteset = SceneManager._scene._spriteset;
                if (spriteset && spriteset._characterSprites && spriteset._tilemap) {
                    var sprite = new Sprite_Character(gameEvent);
                    spriteset._characterSprites.push(sprite); spriteset._tilemap.addChild(sprite);
                }
            }
        },

        partitionDropItems: function(itemsList) {
            var result = { toPickup: [], toLeave: [] };
            if (typeof SDI_Controller === 'undefined') {
                result.toPickup = itemsList.slice();
                return result;
            }

            SDI_Controller.updateFreeSlotsVariable();
            var sdiParams = PluginManager.parameters('SuperDuperInventory');
            var freeSlotsVarId = Number(sdiParams['Free Slots Variable'] || 0);
            var freeSlots = freeSlotsVarId > 0 ? $gameVariables.value(freeSlotsVarId) : 1;

            var grid = $gameParty._sdiGrid ? $gameParty._sdiGrid.slice() : [];

            if (this.pickupBuffer && this.pickupBuffer.length > 0) {
                for (var b = 0; b < this.pickupBuffer.length; b++) {
                    var bItem = this.pickupBuffer[b].item;
                    if (grid.indexOf(bItem) === -1) {
                        grid.push(bItem);
                        freeSlots--;
                    }
                }
            }

            for (var i = 0; i < itemsList.length; i++) {
                var entry = itemsList[i];
                var item = entry.item;

                if (grid.indexOf(item) !== -1 || freeSlots > 0) {
                    result.toPickup.push(entry);
                    if (grid.indexOf(item) === -1) {
                        grid.push(item);
                        freeSlots--;
                    }
                } else {
                    result.toLeave.push(entry);
                }
            }
            return result;
        },
        
        triggerPopup: function(item, amount, mapX, mapY) {
            if (!this.popupQueue) this.popupQueue = [];
            this.popupQueue.push({item: item, amount: amount, x: mapX, y: mapY});
        },
        
        updatePopupQueue: function() {
            if (this.popupQueue && this.popupQueue.length > 0) {
                var now = Date.now();
                if (now - this.lastPopupTime >= 300) { 
                    var data = this.popupQueue.shift();
                    if (now - this.lastPopupTime > 1500) {
                        this.popupCombo = 0;
                    } else {
                        this.popupCombo++;
                        if (this.popupCombo > 5) this.popupCombo = 0; 
                    }
                    this.lastPopupTime = now;

                    if ($gameSystem._trspupData && typeof $gameSystem._trspupVisible !== 'undefined' && $gameSystem._trspupVisible) {
                        var tw = $gameMap.tileWidth();
                        var th = $gameMap.tileHeight();
                        var px = Math.round(($gameMap.adjustX(data.x) + 0.5) * tw);
                        var py = Math.round(($gameMap.adjustY(data.y) + 1) * th);
                        var spaceY = (typeof Moghunter !== 'undefined' && Moghunter.trpopup_ItemSpace) ? Moghunter.trpopup_ItemSpace : 24;
                        py -= (this.popupCombo * spaceY);
                        $gameSystem._trspupData.push([data.item, data.amount, px, py]);
                    }
                }
            }
        },

        tryPickupDroppedItem: function(uid, eventId) {
            // Защита: если уже идёт подбор — второй предмет не подбираем
            // (предотвращает двойной лут при стоянии между двумя дропами).
            if (this.isProcessingBuffer) return;
            var mapId = $gameMap.mapId(); 
            var drop = $gameSystem.getDroppedItemByUid(mapId, uid);
            if (!drop || !drop.items || drop.items.length === 0) { 
                if ($gameMap.event(eventId)) $gameMap.eraseEvent(eventId); 
                return; 
            }
            if (this.isProcessingBuffer && this.currentPickupUid === uid) return;
            
            var partition = this.partitionDropItems(drop.items);

            if (partition.toPickup.length === 0) {
                this.fireErrorCommand();
                return;
            }

            if (!this.pickupBuffer) this.pickupBuffer = [];
            for (var i = 0; i < partition.toPickup.length; i++) {
                var itm = partition.toPickup[i];
                this.pickupBuffer.push({ item: itm.item, amount: itm.amount, originalX: drop.x, originalY: drop.y, isRound: drop.isRound });
            }

            if (partition.toLeave.length > 0) {
                drop.items = partition.toLeave;
                this.fireErrorCommand();
            } else {
                $gameMap.eraseEvent(eventId); 
                $gameSystem.removeDroppedItem(mapId, uid);
            }
            
            this.isProcessingBuffer = true; 
            this.currentPickupUid = uid; 
            this.lastQueueTime = 0; 
            this.lastItemId = -1;
            playDropSound(true);
        },

        tryPickupManualDrop: function(eventId) {
            // Защита: если уже идёт подбор — второй предмет не подбираем
            if (this.isProcessingBuffer) return;
            var ev = $gameMap.event(eventId); if (!ev) return;
            var data = ev.sdiDropData(); if (!data) return;
            var mapId = $gameMap.mapId();
            if ($gameSystem.isManualDropPickedUp(mapId, eventId)) return;

            var itemsList = [{item: $dataItems[data.id], amount: data.amount}];
            var partition = this.partitionDropItems(itemsList);

            if (partition.toPickup.length === 0) {
                this.fireErrorCommand();
                return;
            }

            if (!this.pickupBuffer) this.pickupBuffer = [];
            for (var i = 0; i < partition.toPickup.length; i++) {
                var itm = partition.toPickup[i];
                this.pickupBuffer.push({ item: itm.item, amount: itm.amount, originalX: ev._x, originalY: ev._y, isRound: data.isRound, isManual: true, manualEventId: eventId });
            }
            
            $gameMap.eraseEvent(eventId); 
            $gameSystem.setManualDropPickedUp(mapId, eventId);
            
            this.isProcessingBuffer = true; 
            this.currentPickupUid = 'manual_' + eventId;
            this.lastQueueTime = 0; 
            this.lastItemId = -1;
            playDropSound(true);
        },

        updateQueue: function() {
            if (this.isProcessingBuffer && this.pickupBuffer && this.pickupBuffer.length > 0) {
                var entry = this.pickupBuffer[0]; var now = Date.now();
                var isNewItem = (this.lastItemId !== entry.item.id);
                var delayInFrames = isNewItem ? Config.pickupDelay : Config.stackPickupDelay;
                var delayInMs = delayInFrames * (1000 / 60);

                if (now - this.lastQueueTime >= delayInMs) {
                    this.lastQueueTime = now; this.pickupBuffer.shift(); 
                    if (!entry || !entry.item || entry.amount <= 0) return;

                    if (this.partitionDropItems([entry]).toPickup.length > 0) {
                        $gameParty.gainItem(entry.item, entry.amount);
                        this.lastItemId = entry.item.id;
                        this.triggerPopup(entry.item, entry.amount, entry.originalX, entry.originalY);
                        if (typeof SDI_Controller !== 'undefined') SDI_Controller.refreshAll();
                    } else {
                        this.spawnOrSnapDrop(entry.item, entry.amount, entry.originalX, entry.originalY, true, entry.isRound);
                    }
                }
            } else if (this.isProcessingBuffer) {
                this.isProcessingBuffer = false; this.currentPickupUid = null; this.lastItemId = -1;
            }
        },

        checkAndCleanEmptyDrops: function() {
            var mapId = $gameMap.mapId();
            var items = $gameSystem.getDroppedItems(mapId);
            for (var i = items.length - 1; i >= 0; i--) {
                var d = items[i];
                d.items = d.items.filter(function(e) { return e !== null && e.amount > 0; });
                if (d.items.length === 0) {
                    var mapEvents = $gameMap.events();
                    for (var j = 0; j < mapEvents.length; j++) {
                        if (mapEvents[j] && mapEvents[j].name() === "SDI_Dropped_" + d.uid) {
                            $gameMap.eraseEvent(mapEvents[j].eventId());
                        }
                    }
                    $gameSystem.removeDroppedItem(mapId, d.uid);
                }
            }
        }
    };

    // ======================================================================
    // AUTO-DROP ON GAIN OVERFLOW
    // ======================================================================
    
    var _Game_Party_gainItem_sdd = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
        if (item && amount > 0 && typeof SDI_Controller !== 'undefined' && !$gameTemp._sdiSuppressMog) {
            if (SDI_Controller.activeChestId === null && !SDI_Controller.isInternalMove && !SDI_DropController.isProcessingBuffer) {
                if (SDI_DropController.partitionDropItems([{item: item}]).toPickup.length === 0) {
                    var exactX = ($gamePlayer._realX !== undefined) ? $gamePlayer._realX : $gamePlayer.x;
                    var exactY = ($gamePlayer._realY !== undefined) ? $gamePlayer._realY : $gamePlayer.y;
                    SDI_DropController.spawnOrSnapDrop(item, amount, exactX, exactY);
                    playDropSound(false);
                    SDI_DropController.fireErrorCommand();
                    return; 
                }
            }
        }
        _Game_Party_gainItem_sdd.call(this, item, amount, includeEquip);
    };

    // ======================================================================
    // RPG MAKER CORE INJECTIONS
    // ======================================================================

    var _Game_Map_setupEvents = Game_Map.prototype.setupEvents;
    Game_Map.prototype.setupEvents = function() {
        if ($dataMap && $dataMap.events) {
            for (var i = 1; i < $dataMap.events.length; i++) {
                if ($dataMap.events[i] && $dataMap.events[i].name && $dataMap.events[i].name.indexOf("SDI_Dropped_") !== -1) {
                    $dataMap.events[i] = null;
                }
            }
            SDI_DropController.injectDroppedItems(this._mapId);
        }
        _Game_Map_setupEvents.call(this);
    };

    Game_Event.prototype.sdiDropData = function() {
        if (!this.event()) return null; 
        var page = this.page(); if (!page) return null;
        var list = page.list; var isRound = false; var res = null; var hasTag = false;
        var note = this.event() ? this.event().note : "";
        var meta = this.event() ? this.event().meta : {};
        
        if (meta.sdi_drop !== undefined) {
            hasTag = true;
            if (typeof meta.sdi_drop === 'string') {
                var m = meta.sdi_drop.match(/(?:item\s*,\s*)?(\d+)(?:\s*,\s*(\d+))?/i);
                if (m) res = { id: parseInt(m[1]), amount: parseInt(m[2] || 1) };
            }
        }
        for (var i = 0; i < list.length; i++) {
            if (list[i].code === 108 || list[i].code === 408) {
                var comment = list[i].parameters[0];
                if (comment.contains('<sdi_drop>')) hasTag = true;
                if (comment.contains('<sdi_roundstart>')) isRound = true;
            }
        }
        if (hasTag && !res) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].code === 126) { res = { id: list[i].parameters[0], amount: list[i].parameters[3] }; break; }
            }
        }
        if (res && res.id > 0) { res.isRound = isRound || (note.indexOf('<sdi_roundstart>') !== -1); return res; }
        return null;
    };

    var _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
    Game_Event.prototype.setupPageSettings = function() {
        _Game_Event_setupPageSettings.call(this);
        var data = this.sdiDropData();
        if (data) {
            if ($gameSystem.isManualDropPickedUp($gameMap.mapId(), this.eventId())) { this.erase(); return; }
            if (this._priorityType !== 1) this._priorityType = Config.dropPriority;
            this._stepAnime = Config.dropStepAnime;
            this._walkAnime = Config.dropWalkAnime;
            this._directionFix = Config.dropDirFix;
            
            // Жесткий лок позиции от сдвигов движком или сторонними плагинами
            this._sdiDropPosLocked = true;
            this._sdiLockedX = this.event().x;
            this._sdiLockedY = this.event().y;
        }
        // Распознавание динамического дропа с иконкой (meta.sdi_icon проставляется в createDropEventJSON)
        var ev = this.event();
        if (ev && ev.meta && ev.meta.sdi_icon !== undefined && ev.meta.sdi_icon !== null) {
            this._sdiIconIndex = Number(ev.meta.sdi_icon);
        } else if (ev && ev.note && ev.note.indexOf('<sdi_icon_drop>') !== -1) {
            // Фолбэк: читаем из note (на случай если meta не сохранена)
            var m = ev.note.match(/<sdi_icon:(\d+)>/);
            if (m) this._sdiIconIndex = Number(m[1]);
        }
        // Точная дробная позиция для рендера иконки (минуя _realX, который может округляться)
        if (ev && ev.meta && ev.meta.sdi_exact_x !== undefined && ev.meta.sdi_exact_y !== undefined) {
            this._sdiExactX = Number(ev.meta.sdi_exact_x);
            this._sdiExactY = Number(ev.meta.sdi_exact_y);
        }
    };

    var _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        if (this.sdiDropData()) { SDI_DropController.tryPickupManualDrop(this.eventId()); return; }
        _Game_Event_start.call(this);
    };

    var _Game_Event_update_sdd = Game_Event.prototype.update;
    Game_Event.prototype.update = function() {
        _Game_Event_update_sdd.call(this);
        // Каждый кадр принудительно возвращаем событие на место, если оно заблокировано.
        // _x и _realX — ДРОБНЫЕ (синхронно с игроком для корректной aabbox-проверки подбора).
        if (this._sdiDropPosLocked) {
            this._x = this._sdiLockedX;
            this._y = this._sdiLockedY;
            this._realX = this._sdiLockedX;
            this._realY = this._sdiLockedY;
        }
    };

    // Фикс: при erase события (например, после подбора) сбрасываем флаг иконки,
    // иначе Sprite_Character продолжит рисовать иконку поверх пустого characterName.
    var _Game_Event_erase_sdd = Game_Event.prototype.erase;
    Game_Event.prototype.erase = function() {
        _Game_Event_erase_sdd.call(this);
        this._sdiIconIndex = null;
    };

    // ======================================================================
    // SPRITE_CHARACTER: РЕНДЕР ИКОНКИ ВМЕСТО CHARACTER-ГРАФИКИ
    // ======================================================================

    Sprite_Character.prototype.isSdiIconDrop = function() {
        return !!(this._character && this._character._sdiIconIndex !== undefined && this._character._sdiIconIndex !== null);
    };

    var _Sprite_Character_updateBitmap_sdd = Sprite_Character.prototype.updateBitmap;
    Sprite_Character.prototype.updateBitmap = function() {
        if (this.isSdiIconDrop()) {
            var idx = this._character._sdiIconIndex;
            if (this._sdiIconCacheKey !== idx) {
                this._sdiIconCacheKey = idx;
                this.bitmap = SDI_DropController.getIconBitmap(idx);
                // Иконка крепится по центру тайла
                this.anchor.x = 0.5;
                this.anchor.y = 0.5;
                var s = Config.iconScale;
                this.scale.x = s;
                this.scale.y = s;
            }
            return;
        }
        _Sprite_Character_updateBitmap_sdd.call(this);
    };

    var _Sprite_Character_updateCharacterFrame_sdd = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function() {
        if (this.isSdiIconDrop()) {
            var pw = Window_Base._iconWidth;
            var ph = Window_Base._iconHeight;
            this.setFrame(0, 0, pw, ph);
            return;
        }
        _Sprite_Character_updateCharacterFrame_sdd.call(this);
    };

    // Иконка рендерится по ТОЧНОЙ дробной позиции из _sdiExactX/Y — это обходит
    // любые округления _realX, которые могут делать сторонние плагины (Altimit и т.д.).
    // Формула как у стандартного screenX/Y, но берём позицию из нашего поля.
    // z=0 хардкодно — иконка всегда под всеми спрайтами (включая игрока).
    var _Sprite_Character_updatePosition_sdd = Sprite_Character.prototype.updatePosition;
    Sprite_Character.prototype.updatePosition = function() {
        if (this.isSdiIconDrop() && this._character._sdiExactX != null && this._character._sdiExactY != null) {
            var tw = $gameMap.tileWidth();
            var th = $gameMap.tileHeight();
            var dx = $gameMap.displayX();
            var dy = $gameMap.displayY();
            var shiftY = (typeof this._character.shiftY === 'function') ? this._character.shiftY() : 6;
            // (realX - displayX) * tw + tw/2  — стандартная формула screenX
            this.x = (this._character._sdiExactX - dx) * tw + tw / 2;
            this.y = (this._character._sdiExactY - dy) * th + th - shiftY;
            this.y += Config.iconYOffset;
            this.z = 0;
        } else {
            _Sprite_Character_updatePosition_sdd.call(this);
            if (this.isSdiIconDrop() && Config.iconYOffset) {
                this.y += Config.iconYOffset;
            }
        }
    };

    // Лёгкое мерцание иконки на полу. Синусоида между Icon Blink Min и Max.
    var _Sprite_Character_update_sdd_icon = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        _Sprite_Character_update_sdd_icon.call(this);
        if (this.isSdiIconDrop()) {
            var min = Config.iconBlinkMin;
            var max = Config.iconBlinkMax;
            var period = Math.max(0.1, Config.iconBlinkPeriod);
            var mid = (min + max) / 2;
            var amp = (max - min) / 2;
            // Date.now() в мс; период — в секундах
            var phase = (Date.now() / 1000) * (2 * Math.PI) / period;
            this.opacity = Math.round(mid + Math.sin(phase) * amp);
        }
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (typeof SDI_DropController !== 'undefined') {
            SDI_DropController.updateQueue();
            SDI_DropController.updatePopupQueue();
        }
    };

    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function() {
        _Game_System_initialize.call(this);
        this._sdiDroppedItems = {};
        this._sdiManualPickedUp = {};
    };

    Game_System.prototype.addDroppedItem = function(mapId, dropData) {
        this._sdiDroppedItems = this._sdiDroppedItems || {};
        if (!this._sdiDroppedItems[mapId]) this._sdiDroppedItems[mapId] = [];
        this._sdiDroppedItems[mapId].push(dropData);
    };

    Game_System.prototype.getDroppedItems = function(mapId) {
        this._sdiDroppedItems = this._sdiDroppedItems || {};
        return this._sdiDroppedItems[mapId] || [];
    };

    Game_System.prototype.getDroppedItemByUid = function(mapId, uid) {
        var items = this.getDroppedItems(mapId);
        for (var i = 0; i < items.length; i++) { if (items[i].uid === uid) return items[i]; }
        return null;
    };

    Game_System.prototype.removeDroppedItem = function(mapId, uid) {
        if (!this._sdiDroppedItems || !this._sdiDroppedItems[mapId]) return;
        this._sdiDroppedItems[mapId] = this._sdiDroppedItems[mapId].filter(function(d) { return d.uid !== uid; });
    };

    Game_System.prototype.clearRoundDroppedItems = function() {
        this._sdiDroppedItems = this._sdiDroppedItems || {};
        for (var mapId in this._sdiDroppedItems) {
            this._sdiDroppedItems[mapId] = this._sdiDroppedItems[mapId].filter(function(d) { return !d.isRound; });
        }
        this._sdiManualPickedUp = {}; 
        if (SceneManager._scene instanceof Scene_Map) SceneManager._scene.requestMapReload();
    };

    Game_System.prototype.isManualDropPickedUp = function(mapId, eventId) {
        this._sdiManualPickedUp = this._sdiManualPickedUp || {};
        if (!this._sdiManualPickedUp[mapId]) return false;
        return this._sdiManualPickedUp[mapId].indexOf(eventId) !== -1;
    };

    Game_System.prototype.setManualDropPickedUp = function(mapId, eventId) {
        this._sdiManualPickedUp = this._sdiManualPickedUp || {};
        if (!this._sdiManualPickedUp[mapId]) this._sdiManualPickedUp[mapId] = [];
        if (this._sdiManualPickedUp[mapId].indexOf(eventId) === -1) this._sdiManualPickedUp[mapId].push(eventId);
    };

    Scene_Map.prototype.requestMapReload = function() {
        $gamePlayer.reserveTransfer($gameMap.mapId(), $gamePlayer.x, $gamePlayer.y, $gamePlayer.direction(), 2);
    };

})();