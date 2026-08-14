/*:
 * @plugindesc [v1.4] Плагин для кинематографичных каскадных уведомлений об изменении переменных.
 * @author Korolev
 *
 * @param Monitored Variables
 * @text Отслеживаемые переменные
 * @type struct<VariableConfig>[]
 * @desc Список переменных, при изменении которых будет появляться уведомление.
 * @default []
 *
 * @param Display Settings
 * @text Настройки отображения
 *
 * @param Default X
 * @parent Display Settings
 * @text Координата X
 * @desc Позиция появления уведомления по горизонтали.
 * @default 20
 *
 * @param Default Y
 * @parent Display Settings
 * @text Координата Y
 * @desc Позиция появления самого свежего уведомления по вертикали.
 * @default 20
 *
 * @param Spacing Y
 * @parent Display Settings
 * @text Отступ по Y (Каскад)
 * @desc На сколько пикселей старые уведомления будут сдвигаться вниз при появлении нового.
 * @default 40
 *
 * @param Spawn Delay
 * @parent Display Settings
 * @text Задержка в очереди
 * @desc Сколько кадров должно пройти между появлением одновременных уведомлений (каскадный эффект).
 * @default 20
 *
 * @param Wait Time
 * @parent Display Settings
 * @text Время показа
 * @desc Сколько кадров уведомление висит на экране до начала исчезновения (60 кадров = 1 сек).
 * @default 180
 *
 * @param Animation Settings
 * @text Настройки анимации
 * * @param Fade In Speed
 * @parent Animation Settings
 * @text Скорость появления
 * @desc На сколько единиц прозрачности (0-255) увеличивается за кадр.
 * @default 10
 *
 * @param Fade Out Speed
 * @parent Animation Settings
 * @text Скорость исчезновения
 * @desc На сколько единиц прозрачности (0-255) уменьшается за кадр.
 * @default 10
 *
 * @param Slide In X
 * @parent Animation Settings
 * @text Сдвиг X (Появление)
 * @desc Стартовое смещение по X (отрицательное - выезжает слева).
 * @default -30
 *
 * @param Slide In Y
 * @parent Animation Settings
 * @text Сдвиг Y (Появление)
 * @desc Стартовое смещение по Y (отрицательное - выезжает сверху).
 * @default 0
 *
 * @param Slide Out X
 * @parent Animation Settings
 * @text Сдвиг X (Исчезновение)
 * @desc Смещение по X при исчезновении.
 * @default 30
 *
 * @param Slide Out Y
 * @parent Animation Settings
 * @text Сдвиг Y (Исчезновение)
 * @desc Смещение по Y при исчезновении.
 * @default 0
 *
 * @param Slide Smoothness
 * @parent Animation Settings
 * @text Плавность движения
 * @desc Насколько плавно едет уведомление (1.0 - моментально, 0.1 - медленно).
 * @type number
 * @decimals 2
 * @default 0.15
 *
 * @help
 * ============================================================================
 * Описание
 * ============================================================================
 * Плагин SuperDuperNotification позволяет выводить красивые уведомления,
 * когда значение определенных переменных меняется. 
 * Идеально подходит для систем отношений, голода, кармы и т.д.
 * * * Если несколько переменных меняются одновременно, плагин выстроит их в 
 * кинематографичную очередь и покажет каскадом с плавным сдвигом.
 * * Если одна и та же переменная меняется несколько раз за долю секунды 
 * (например, +1, +1, +1 в одном событии), плагин автоматически 
 * сложит их и выведет общую сумму (+3).
 * * ============================================================================
 * Настройка текста и цветов
 * ============================================================================
 * Базовый текст всегда берет нулевой цвет (Color 0) из вашего Window.png.
 * * В настройках переменной (Шаблон текста) используйте теги:
 * %name - выведет имя переменной, окрашенное в заданный для нее цвет.
 * %val  - выведет сумму изменения, окрашенную в цвет плюса или минуса.
 * * Пример шаблона: "Отношения с %name : %val"
 * Результат: [Белый]Отношения с [Синий]Эриком [Белый]: [Зеленый]+5
 * * * Автор: Korolev
 */

/*~struct~VariableConfig:
 * @param variableId
 * @text ID Переменной
 * @type variable
 * @default 1
 *
 * @param variableName
 * @text Имя переменной
 * @desc Имя, которое будет подставляться вместо тега %name
 * @default Эрик
 *
 * @param nameColor
 * @text Цвет имени
 * @desc HTML/HEX цвет для имени переменной.
 * @default #3498db
 * * @param displayName
 * @text Шаблон текста
 * @desc Шаблон. %name - имя переменной, %val - разница.
 * @default Отношения с %name: %val
 *
 * @param positiveColor
 * @text Цвет при плюсе
 * @desc Цвет значения (HEX), если переменная выросла.
 * @default #2ecc71
 *
 * @param negativeColor
 * @text Цвет при минусе
 * @desc Цвет значения (HEX), если переменная упала.
 * @default #e74c3c
 */

(function() {
    'use strict';

    const pluginName = 'SuperDuperNotification';
    const params = PluginManager.parameters(pluginName);

    // Безопасный парсинг параметров
    let monitoredVars = [];
    try {
        const rawVars = JSON.parse(params['Monitored Variables'] || '[]');
        monitoredVars = rawVars.map(v => {
            const item = JSON.parse(v);
            return {
                id: Number(item.variableId),
                varName: item.variableName || 'Переменная',
                nameColor: item.nameColor || '#3498db',
                template: item.displayName || 'Изменение %name: %val',
                posColor: item.positiveColor || '#2ecc71',
                negColor: item.negativeColor || '#e74c3c'
            };
        });
    } catch (e) {
        console.error("SuperDuperNotification: Ошибка парсинга параметров переменных", e);
    }

    var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
    var cw = core ? core.screen.width : 1280;
    var ch = core ? core.screen.height : 720;

    const config = {
        x: params['Default X'] ? Number(params['Default X']) : Math.round(cw * 1.5 / 100),
        y: params['Default Y'] ? Number(params['Default Y']) : Math.round(ch * 2.8 / 100),
        spacingY: Number(params['Spacing Y'] || 40),
        spawnDelay: Number(params['Spawn Delay'] || 20),
        wait: Number(params['Wait Time'] || 180),
        
        // Настройки анимации
        fadeInSpeed: Number(params['Fade In Speed'] || 10),
        fadeOutSpeed: Number(params['Fade Out Speed'] || 10),
        slideInX: Number(params['Slide In X'] || -30),
        slideInY: Number(params['Slide In Y'] || 0),
        slideOutX: Number(params['Slide Out X'] || 30),
        slideOutY: Number(params['Slide Out Y'] || 0),
        smoothness: Number(params['Slide Smoothness'] || 0.15)
    };

    // --- Кэширование системного цвета ---
    let cachedSystemColor = null;
    function getSystemColor() {
        if (cachedSystemColor) return cachedSystemColor;
        try {
            // Создаем временное окно, чтобы вытащить нулевой цвет из Window.png
            const tempWindow = new Window_Base(0, 0, 0, 0);
            cachedSystemColor = tempWindow.normalColor();
        } catch (e) {
            cachedSystemColor = '#ffffff'; // Фолбэк на случай, если спрайт окна еще не загружен
        }
        return cachedSystemColor;
    }

    // --- Глобальная очередь уведомлений ---
    const NotificationQueue = [];

    // --- Перехват изменений переменных ---
    const _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function(variableId, value) {
        const oldValue = this.value(variableId);
        _Game_Variables_setValue.call(this, variableId, value);
        
        if (oldValue !== value) {
            const settings = monitoredVars.find(v => v.id === variableId);
            if (settings) {
                const diff = value - oldValue;
                
                const existingIndex = NotificationQueue.findIndex(n => n.variableId === variableId);
                
                if (existingIndex !== -1) {
                    const existing = NotificationQueue[existingIndex];
                    existing.diff += diff;
                    
                    if (existing.diff === 0) {
                        NotificationQueue.splice(existingIndex, 1);
                    } else {
                        existing.valStr = existing.diff > 0 ? '+' + existing.diff : existing.diff.toString();
                        existing.valColor = existing.diff > 0 ? settings.posColor : settings.negColor;
                    }
                } else {
                    const diffStr = diff > 0 ? '+' + diff : diff.toString();
                    const color = diff > 0 ? settings.posColor : settings.negColor;
                    
                    NotificationQueue.push({
                        variableId: variableId,
                        diff: diff,
                        template: settings.template,
                        varName: settings.varName,
                        nameColor: settings.nameColor,
                        valStr: diffStr,
                        valColor: color
                    });
                }
            }
        }
    };

    // --- Спрайт Отдельного Уведомления ---

    function Sprite_SingleNotification() {
        this.initialize.apply(this, arguments);
    }

    Sprite_SingleNotification.prototype = Object.create(Sprite.prototype);
    Sprite_SingleNotification.prototype.constructor = Sprite_SingleNotification;

    Sprite_SingleNotification.prototype.initialize = function(data) {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(Graphics.boxWidth, 60);
        this.opacity = 0;
        
        this._phase = 'fadeIn';
        this._timer = config.wait;
        
        // Стартовая позиция со сдвигом появления
        this.x = config.x + config.slideInX;
        this.y = config.y + config.slideInY;
        this.targetY = config.y;
        this.targetX = config.x;
        
        this._isReadyToDie = false;
        
        this.setupText(data);
    };

    Sprite_SingleNotification.prototype.setupText = function(data) {
        const b = this.bitmap;
        b.clear();
        b.fontSize = 24;
        b.outlineWidth = 4;
        b.outlineColor = 'rgba(0, 0, 0, 0.7)';
        
        const sysColor = getSystemColor();
        let currentDrawX = 0;

        // Разбиваем шаблон на логические куски (имя, значение, остальной текст)
        const parts = data.template.split(/(%name|%val)/g);

        // Отрисовываем каждый кусок со своим цветом, сдвигая курсор (currentDrawX)
        for (const part of parts) {
            if (!part) continue;

            if (part === '%name') {
                b.textColor = data.nameColor;
                b.drawText(data.varName, currentDrawX, 0, Graphics.boxWidth, 40, 'left');
                currentDrawX += b.measureTextWidth(data.varName);
            } else if (part === '%val') {
                b.textColor = data.valColor;
                b.drawText(data.valStr, currentDrawX, 0, Graphics.boxWidth, 40, 'left');
                currentDrawX += b.measureTextWidth(data.valStr);
            } else {
                b.textColor = sysColor;
                b.drawText(part, currentDrawX, 0, Graphics.boxWidth, 40, 'left');
                currentDrawX += b.measureTextWidth(part);
            }
        }
    };

    Sprite_SingleNotification.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this.updatePosition();
        this.updatePhase();
    };

    Sprite_SingleNotification.prototype.updatePosition = function() {
        // Используем параметр smoothness для скорости скольжения
        if (this.y !== this.targetY) {
            const dy = (this.targetY - this.y) * config.smoothness;
            this.y += Math.abs(dy) < 0.5 ? Math.sign(dy) : dy;
            if (Math.abs(this.y - this.targetY) < 1) this.y = this.targetY;
        }

        if (this.x !== this.targetX) {
            const dx = (this.targetX - this.x) * config.smoothness;
            this.x += Math.abs(dx) < 0.5 ? Math.sign(dx) : dx;
            if (Math.abs(this.x - this.targetX) < 1) this.x = this.targetX;
        }
    };

    Sprite_SingleNotification.prototype.updatePhase = function() {
        switch (this._phase) {
            case 'fadeIn':
                this.opacity += config.fadeInSpeed;
                if (this.opacity >= 255) {
                    this.opacity = 255;
                    this._phase = 'wait';
                }
                break;
                
            case 'wait':
                this._timer--;
                if (this._timer <= 0) {
                    this._phase = 'fadeOut';
                    // Устанавливаем целевые координаты для сдвига при исчезновении
                    this.targetX = config.x + config.slideOutX; 
                    this.targetY = this.y + config.slideOutY; 
                }
                break;
                
            case 'fadeOut':
                this.opacity -= config.fadeOutSpeed;
                if (this.opacity <= 0) {
                    this.opacity = 0;
                    this._isReadyToDie = true;
                }
                break;
        }
    };

    // --- Контейнер для всех уведомлений ---

    function Sprite_NotifyContainer() {
        this.initialize.apply(this, arguments);
    }

    Sprite_NotifyContainer.prototype = Object.create(Sprite.prototype);
    Sprite_NotifyContainer.prototype.constructor = Sprite_NotifyContainer;

    Sprite_NotifyContainer.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.z = 100;
        this._spawnDelayTimer = 0;
    };

    Sprite_NotifyContainer.prototype.update = function() {
        Sprite.prototype.update.call(this);
        this.updateQueue();
        this.cleanupChildren();
    };

    Sprite_NotifyContainer.prototype.updateQueue = function() {
        if (this._spawnDelayTimer > 0) {
            this._spawnDelayTimer--;
            return;
        }

        if (NotificationQueue.length > 0) {
            const data = NotificationQueue.shift();
            this.spawnNotification(data);
            this._spawnDelayTimer = config.spawnDelay;
        }
    };

    Sprite_NotifyContainer.prototype.spawnNotification = function(data) {
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            if (child instanceof Sprite_SingleNotification && !child._isReadyToDie) {
                child.targetY += config.spacingY;
            }
        }

        const notification = new Sprite_SingleNotification(data);
        this.addChild(notification);
    };

    Sprite_NotifyContainer.prototype.cleanupChildren = function() {
        for (let i = this.children.length - 1; i >= 0; i--) {
            const child = this.children[i];
            if (child && child._isReadyToDie) {
                this.removeChild(child);
            }
        }
    };

    // --- Интеграция в Сцену Карты ---

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this._notifyContainer = new Sprite_NotifyContainer();
        this.addChild(this._notifyContainer);
    };

})();