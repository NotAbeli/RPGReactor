/*:
 * @plugindesc [v1.20] Кинематографичный экран Game Over: Самсара, Hover и кастомные звуки меню.
 * @author Korolev
 *
 * @param --- Тексты Меню ---
 * @default
 *
 * @param Text Checkpoint
 * @parent --- Тексты Меню ---
 * @text Текст: Чекпоинт
 * @desc Название первой кнопки.
 * @default Последняя контрольная точка
 *
 * @param Text SaveMenu
 * @parent --- Тексты Меню ---
 * @text Текст: Меню сохранений
 * @desc Название второй кнопки.
 * @default Меню сохранений
 *
 * @param Text Title
 * @parent --- Тексты Меню ---
 * @text Текст: Главное меню
 * @desc Название третьей кнопки.
 * @default Главное меню
 *
 * @param Menu Y Offset
 * @parent --- Тексты Меню ---
 * @text Сдвиг меню по Y
 * @desc На сколько пикселей опустить меню вниз от центра (0 = строго по центру).
 * @type number
 * @default 60
 *
 * @param --- Звуки Интерфейса ---
 * @default
 *
 * @param Cursor Sound File
 * @parent --- Звуки Интерфейса ---
 * @text Звук курсора (SE)
 * @desc Звук при наведении мышью или переключении стрелками. Оставьте пустым, чтобы отключить звук.
 * @type file
 * @dir audio/se/
 * @default Cursor1
 *
 * @param Cursor Volume
 * @parent --- Звуки Интерфейса ---
 * @text Громкость курсора
 * @type number
 * @default 90
 *
 * @param Cursor Pitch
 * @parent --- Звуки Интерфейса ---
 * @text Питч курсора
 * @type number
 * @default 100
 *
 * @param Ok Sound File
 * @parent --- Звуки Интерфейса ---
 * @text Звук подтверждения (SE)
 * @desc Звук при успешном выборе варианта. Оставьте пустым, чтобы отключить звук.
 * @type file
 * @dir audio/se/
 * @default Decision1
 *
 * @param Ok Volume
 * @parent --- Звуки Интерфейса ---
 * @text Громкость подтверждения
 * @type number
 * @default 90
 *
 * @param Ok Pitch
 * @parent --- Звуки Интерфейса ---
 * @text Питч подтверждения
 * @type number
 * @default 100
 *
 * @param Buzzer Sound File
 * @parent --- Звуки Интерфейса ---
 * @text Звук ошибки (SE)
 * @desc Звук при ошибке загрузки (нет сохранения). Оставьте пустым, чтобы отключить звук.
 * @type file
 * @dir audio/se/
 * @default Buzzer1
 *
 * @param Buzzer Volume
 * @parent --- Звуки Интерфейса ---
 * @text Громкость ошибки
 * @type number
 * @default 90
 *
 * @param Buzzer Pitch
 * @parent --- Звуки Интерфейса ---
 * @text Питч ошибки
 * @type number
 * @default 100
 *
 * @param --- Аудио и Анимация ---
 * @default
 *
 * @param Static BGS
 * @parent --- Аудио и Анимация ---
 * @text Звук помех (BGS)
 * @desc Файл BGS для шипения (например, Storm).
 * @type file
 * @dir audio/bgs/
 * @default Storm
 *
 * @param Max BGS Volume
 * @parent --- Аудио и Анимация ---
 * @text Макс. громкость (Пре-фаза)
 * @desc Громкость звука при полном застилании экрана помехами.
 * @type number
 * @default 60
 *
 * @param Menu BGS Volume
 * @parent --- Аудио и Анимация ---
 * @text Громкость в меню
 * @desc До какой громкости звук плавно спадает, когда появляются кнопки.
 * @type number
 * @default 30
 *
 * @param Transition Time
 * @parent --- Аудио и Анимация ---
 * @text Время ухода (кадры)
 * @desc Время нарастания помех. Как только оно истечет, игра полностью остановится.
 * @type number
 * @default 45
 *
 * @param Pre-phase Blackout
 * @parent --- Аудио и Анимация ---
 * @text Поглощение игры (0-255)
 * @desc Насколько сильно черный цвет скрывает игру под помехами. 255 - игра полностью исчезает.
 * @type number
 * @default 255
 *
 * @param Hold Time
 * @parent --- Аудио и Анимация ---
 * @text Время удержания (кадры)
 * @desc Сколько кадров замороженный экран висит в полных помехах ПЕРЕД появлением меню.
 * @type number
 * @default 20
 *
 * @param Shake Intensity
 * @parent --- Аудио и Анимация ---
 * @text Сила тряски
 * @desc Насколько сильно трясется экран при вспышках помех.
 * @type number
 * @default 20
 *
 * @param Background Opacity
 * @parent --- Аудио и Анимация ---
 * @text Затемнение под меню
 * @desc Непрозрачность черной подложки (0-255).
 * @type number
 * @default 180
 *
 * @param --- Настройки Помех (SuperDuperScreen) ---
 * @default
 *
 * @param Max Noise
 * @parent --- Настройки Помех (SuperDuperScreen) ---
 * @text Макс. Шум
 * @desc Максимальная плотность шума на пике.
 * @type number
 * @decimals 1
 * @default 180.0
 *
 * @param Max Scanline
 * @parent --- Настройки Помех (SuperDuperScreen) ---
 * @text Макс. Сканлайны
 * @desc Сила полос на пике.
 * @type number
 * @decimals 1
 * @default 60.0
 *
 * @param Max Chroma
 * @parent --- Настройки Помех (SuperDuperScreen) ---
 * @text Макс. Хромакей
 * @desc Искажение цвета на пике.
 * @type number
 * @decimals 1
 * @default 20.0
 *
 * @help
 * ============================================================================
 * Описание (v1.20)
 * ============================================================================
 * Плагин "SuperDuperGameOver" заменяет стандартный экран смерти.
 * Требует наличия плагина SuperDuperScreen для вывода фильтров!
 *
 * Интегрирован с SuperDuperSamsara: кнопка чекпоинта теперь мгновенно
 * загружает автосохранение из слота 777.
 * * При нажатии на любой пункт меню экран моментально погружается во тьму, 
 * звук глушится и происходит мгновенный переход.
 * * Поддержка "честного" наведения мыши (Hover) переписана: теперь 
 * выделение работает даже без зажатия или клика ЛКМ (считывание пассивных 
 * координат мыши).
 * * Добавлен полный контроль над звуками интерфейса (можно выбрать файл,
 * настроить громкость и питч). Динамическое чтение имени файла спасает 
 * от сбоев при переименовании плагина.
 *
 * ============================================================================
 * Автор: Korolev
 */

(function() {
    'use strict';

    // Динамическое определение имени плагина, чтобы параметры не слетали при переименовании файла
    let pluginName = 'SuperDuperGameOver';
    const script = document.currentScript;
    if (script && script.src) {
        pluginName = script.src.split('/').pop().replace(/\.js$/, '');
    }
    const params = PluginManager.parameters(pluginName);

    // Безопасный парсинг числовых параметров
    function parseNum(val, def) {
        if (val === undefined || val === '') return def;
        const n = Number(val);
        return isNaN(n) ? def : n;
    }

    const config = {
        textCheckpoint: String(params['Text Checkpoint'] || 'Последняя контрольная точка'),
        textSaveMenu: String(params['Text SaveMenu'] || 'Меню сохранений'),
        textTitle: String(params['Text Title'] || 'Главное меню'),
        menuYOffset: parseNum(params['Menu Y Offset'], 60),
        
        cursorSound: String(params['Cursor Sound File'] || ''),
        cursorVol: parseNum(params['Cursor Volume'], 90),
        cursorPitch: parseNum(params['Cursor Pitch'], 100),
        
        okSound: String(params['Ok Sound File'] || ''),
        okVol: parseNum(params['Ok Volume'], 90),
        okPitch: parseNum(params['Ok Pitch'], 100),
        
        buzzerSound: String(params['Buzzer Sound File'] || ''),
        buzzerVol: parseNum(params['Buzzer Volume'], 90),
        buzzerPitch: parseNum(params['Buzzer Pitch'], 100),
        
        bgsName: String(params['Static BGS'] || ''),
        bgsVolume: parseNum(params['Max BGS Volume'], 60),
        bgsMenuVolume: parseNum(params['Menu BGS Volume'], 30),
        transTime: parseNum(params['Transition Time'], 45),
        holdTime: parseNum(params['Hold Time'], 20),
        preBlackout: parseNum(params['Pre-phase Blackout'], 255),
        shakeIntensity: parseNum(params['Shake Intensity'], 20),
        bgOpacity: parseNum(params['Background Opacity'], 180),
        
        maxNoise: String(params['Max Noise'] || '180.0'),
        maxScanline: String(params['Max Scanline'] || '60.0'),
        maxChroma: String(params['Max Chroma'] || '20.0')
    };

    const SAMSARA_SLOT = 777; // Слот для автосохранений из SuperDuperSamsara

    // --- Вспомогательные функции ---

    function playCustomSe(name, vol, pitch) {
        if (name && name.trim() !== '') {
            // Используем StaticSe для системных звуков, чтобы их не обрывало
            AudioManager.playStaticSe({ name: name.trim(), volume: vol, pitch: pitch, pan: 0 });
        }
    }

    function sendScreenCmd(action, args) {
        if (!$gameSystem || !$gameSystem._superDuperConfig) return;
        if (action === 'SET') {
            const param = args[0] ? args[0].toLowerCase() : '';
            const value = Number(args[1]);
            const duration = Number(args[2]) || 0;
            
            if (!isNaN(value) && $gameSystem._superDuperConfig.hasOwnProperty(param)) {
                if (duration > 0) {
                    $gameSystem._superDuperTarget[param] = value;
                    $gameSystem._superDuperFrames[param] = duration;
                } else {
                    $gameSystem._superDuperConfig[param] = value;
                    $gameSystem._superDuperTarget[param] = value;
                    $gameSystem._superDuperFrames[param] = 0;
                }
            }
        }
    }

    // Универсальная функция создания текстуры виньетки
    function createVignetteBitmap() {
        const bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
        const ctx = bitmap.context;
        const cx = Graphics.boxWidth / 2;
        const cy = Graphics.boxHeight / 2;
        const r = Math.max(cx, cy) * 1.2;
        
        const grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
        grd.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grd.addColorStop(1, 'rgba(0, 0, 0, 1)'); // Плотное черное затемнение по краям
        
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, Graphics.boxWidth, Graphics.boxHeight);
        return bitmap;
    }

    //-----------------------------------------------------------------------------
    // ГЛОБАЛЬНЫЙ ПЕРЕХВАТ МЫШИ (ДЛЯ ПАССИВНОГО HOVER)
    //-----------------------------------------------------------------------------
    const _TouchInput_onMouseMove = TouchInput._onMouseMove;
    TouchInput._onMouseMove = function(event) {
        _TouchInput_onMouseMove.apply(this, arguments);
        if (event && event.pageX !== undefined) {
            // Запоминаем реальные пассивные координаты мыши без привязки к кликам
            TouchInput._sdHoverX = Graphics.pageToCanvasX(event.pageX);
            TouchInput._sdHoverY = Graphics.pageToCanvasY(event.pageY);
        }
    };

    //-----------------------------------------------------------------------------
    // ПЕРЕХВАТ И ПРЕ-ФАЗА (Внутри текущей сцены)
    //-----------------------------------------------------------------------------

    const _SceneManager_goto = SceneManager.goto;
    SceneManager.goto = function(sceneClass) {
        if (sceneClass === Scene_Gameover) {
            if (!this._sdGameOverTransition) {
                this._sdGameOverTransition = true;
                this._sdGameOverTimer = config.transTime;
                this._sdFlashCounter = 0; 
                
                this._sdCurrentVol = 0;
                this._sdTargetVol = config.bgsVolume;
                this._sdVolStep = config.bgsVolume / Math.max(1, config.transTime);

                AudioManager.fadeOutBgm(Math.max(1, config.transTime / 60));
                AudioManager.fadeOutMe(Math.max(1, config.transTime / 60));

                if (config.bgsName) {
                    AudioManager.playBgs({ name: config.bgsName, volume: 0, pitch: 100, pan: 0 });
                }

                if (this._scene) {
                    this._sdBlackoutSprite = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
                    this._sdBlackoutSprite.bitmap.fillAll('black');
                    this._sdBlackoutSprite.opacity = 0;
                    this._scene.addChild(this._sdBlackoutSprite);

                    this._sdVignetteSprite = new Sprite(createVignetteBitmap());
                    this._sdVignetteSprite.opacity = 0;
                    this._scene.addChild(this._sdVignetteSprite);
                }

                // Помехи нарастают ровно за время транзита, чтобы игра застыла на самом пике шума
                let noiseTime = Math.max(1, config.transTime);
                sendScreenCmd('SET', ['noise', config.maxNoise, noiseTime]);
                sendScreenCmd('SET', ['scanline', config.maxScanline, noiseTime]);
                sendScreenCmd('SET', ['chroma', config.maxChroma, noiseTime]);
                
                if (this._scene) {
                    this._scene._fadeDuration = 0;
                    if (this._scene._fadeSprite) {
                        this._scene._fadeSprite.opacity = 0;
                    }
                }
            }
            return; // Игра продолжает идти, пока нарастают помехи
        }
        _SceneManager_goto.call(this, sceneClass);
    };

    const _SceneManager_update = SceneManager.update;
    SceneManager.update = function() {
        _SceneManager_update.call(this);
        if (this._sdGameOverTransition && this._scene) {
            this.updateSdGameOverTransition();
        }
    };

    SceneManager.updateSdGameOverTransition = function() {
        if (this._sdGameOverTimer > 0) {
            this._sdGameOverTimer--;
            this._sdFlashCounter++;

            if (this._sdCurrentVol < this._sdTargetVol) {
                this._sdCurrentVol += this._sdVolStep; 
                if (this._sdCurrentVol > this._sdTargetVol) this._sdCurrentVol = this._sdTargetVol;
                
                if (AudioManager._currentBgs && config.bgsName) {
                    AudioManager.updateBgsParameters({ name: config.bgsName, volume: Math.round(this._sdCurrentVol), pitch: 100, pan: 0 });
                }
            }

            if (this._sdBlackoutSprite && this._scene) {
                this._sdBlackoutSprite.opacity += (config.preBlackout / Math.max(1, config.transTime));
                if (this._sdVignetteSprite) {
                    // Виньетка плавно нарастает лишь до 120 (около 50%) во время пре-фазы
                    this._sdVignetteSprite.opacity += (120 / Math.max(1, config.transTime));
                }
                
                if (this._scene.children[this._scene.children.length - 1] !== this._sdVignetteSprite) {
                    this._scene.addChild(this._sdBlackoutSprite); 
                    this._scene.addChild(this._sdVignetteSprite);
                }
            }
            
            // Вспышки ЭЛТ
            if (this._sdFlashCounter % 12 === 0 && this._scene) {
                this._scene.y = (Math.random() - 0.5) * config.shakeIntensity;
                this._scene.x = (Math.random() - 0.5) * (config.shakeIntensity / 2);
                sendScreenCmd('SET', ['brightness', String(0.6 + Math.random() * 1.5)]);
            } else if (this._sdFlashCounter % 12 === 2 && this._scene) {
                this._scene.y = 0;
                this._scene.x = 0;
                sendScreenCmd('SET', ['brightness', '1.0']);
            }

            if (this._sdGameOverTimer <= 0) {
                // Как только таймер = 0 (помехи на максимуме), игра переходит в Scene_Gameover 
                // и полностью замораживает свою логику!
                if (this._scene) {
                    this._scene.x = 0;
                    this._scene.y = 0;
                    this._scene.startFadeOut = function() {};
                    this._scene._fadeDuration = 0;
                    if (this._scene._fadeSprite) {
                        this._scene._fadeSprite.opacity = 0;
                    }
                }

                sendScreenCmd('SET', ['brightness', '1.0']);

                if (this._sdVignetteSprite) this._sdVignetteSprite.visible = false;

                const oldFilters = this._scene ? this._scene.filters : null;
                if (this._scene) this._scene.filters = null;
                this.snapForBackground(); 
                if (this._scene) this._scene.filters = oldFilters;

                this._sdGameOverTransition = false;
                _SceneManager_goto.call(this, Scene_Gameover); // Остановка игры и смена сцены
            }
        }
    };

    //-----------------------------------------------------------------------------
    // Window_GameOverMenu
    //-----------------------------------------------------------------------------
    function Window_GameOverMenu() {
        this.initialize.apply(this, arguments);
    }

    Window_GameOverMenu.prototype = Object.create(Window_Command.prototype);
    Window_GameOverMenu.prototype.constructor = Window_GameOverMenu;

    Window_GameOverMenu.prototype.initialize = function() {
        Window_Command.prototype.initialize.call(this, 0, 0);
        this.updatePlacement();
        this.openness = 0;
        this.opacity = 0; 
        
        // Переменные для отслеживания движения мыши без зажатия ЛКМ
        this._lastMouseX = -1;
        this._lastMouseY = -1;
    };

    Window_GameOverMenu.prototype.update = function() {
        Window_Command.prototype.update.call(this);
        // Если окно активно и готово к вводу, проверяем позицию мыши
        if (this.isOpenAndActive()) {
            this.updateMouseHover();
        }
    };

    Window_GameOverMenu.prototype.updateMouseHover = function() {
        // Используем наши пассивные глобальные координаты (честный hover)
        const hx = TouchInput._sdHoverX;
        const hy = TouchInput._sdHoverY;

        // Если координаты существуют и мышь сдвинулась
        if (hx !== undefined && hy !== undefined && (hx !== this._lastMouseX || hy !== this._lastMouseY)) {
            this._lastMouseX = hx;
            this._lastMouseY = hy;
            
            // Преобразуем глобальные координаты мыши в локальные координаты окна
            const x = this.canvasToLocalX(hx);
            const y = this.canvasToLocalY(hy);
            
            // Проверяем, находится ли курсор над каким-либо пунктом (возвращает индекс или -1)
            const hitIndex = this.hitTest(x, y);
            
            // Если индекс валидный и не совпадает с текущим выбранным
            if (hitIndex >= 0 && hitIndex !== this.index()) {
                this.select(hitIndex);
                this.playCursorSound(); // Наш безопасный вызов
            }
        }
    };

    // --- Переопределение системных звуков для этого окна ---
    Window_GameOverMenu.prototype.playCursorSound = function() {
        playCustomSe(config.cursorSound, config.cursorVol, config.cursorPitch);
    };

    Window_GameOverMenu.prototype.playOkSound = function() {
        // Глушим стандартный звук, чтобы вызывать его вручную в событиях сцены
    };

    Window_GameOverMenu.prototype.playBuzzerSound = function() {
        // Глушим стандартный звук
    };

    Window_GameOverMenu.prototype.windowWidth = function() {
        return 400; 
    };

    Window_GameOverMenu.prototype.updatePlacement = function() {
        this.x = (Graphics.boxWidth - this.windowWidth()) / 2;
        this.y = (Graphics.boxHeight - this.windowHeight()) / 2 + config.menuYOffset;
    };

    Window_GameOverMenu.prototype.makeCommandList = function() {
        // Проверяем наличие файла Самсары в теневом слоте
        const hasSave = DataManager.isThisGameFile(SAMSARA_SLOT);
        
        this.addCommand(config.textCheckpoint, 'checkpoint', hasSave);
        this.addCommand(config.textSaveMenu, 'savemenu');
        this.addCommand(config.textTitle, 'title');
    };

    Window_GameOverMenu.prototype.itemTextAlign = function() {
        return 'center';
    };

    //-----------------------------------------------------------------------------
    // Scene_SuperDuperGameOver (Системная сцена)
    //-----------------------------------------------------------------------------
    function Scene_SuperDuperGameOver() {
        this.initialize.apply(this, arguments);
    }

    Scene_SuperDuperGameOver.prototype = Object.create(Scene_Base.prototype);
    Scene_SuperDuperGameOver.prototype.constructor = Scene_SuperDuperGameOver;

    Scene_SuperDuperGameOver.prototype.initialize = function() {
        Scene_Base.prototype.initialize.call(this);
        
        this._phase = 0; 
        this._holdTimer = config.holdTime;
        this._frameCount = 0;
        
        this._sdCurrentVol = config.bgsVolume;
        this._sdTargetVol = config.bgsVolume; 
    };

    Scene_SuperDuperGameOver.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        
        this._bgContainer = new Sprite();
        this.addChild(this._bgContainer);

        this.createBackground();
        
        // Виньетка стартует с 120 (как в конце пре-фазы)
        this._vignetteSprite = new Sprite(createVignetteBitmap());
        this._vignetteSprite.opacity = 120;
        this.addChild(this._vignetteSprite);

        this.createCommandWindow();
        this.createDarkOverlay();
        
        this.removeChild(this._commandWindow);
        this.addChild(this._commandWindow);
    };

    Scene_SuperDuperGameOver.prototype.createBackground = function() {
        this._backSprite = new Sprite(SceneManager.backgroundBitmap());
        this._bgContainer.addChild(this._backSprite);
    };

    Scene_SuperDuperGameOver.prototype.createDarkOverlay = function() {
        const paddingY = 20; 
        const h = this._commandWindow.windowHeight() + paddingY;
        const w = Graphics.boxWidth; 
        
        const x = 0; 
        const y = this._commandWindow.y - (paddingY / 2);
        
        this._darkOverlay = new Sprite(new Bitmap(w, h));
        this._darkOverlay.bitmap.fillAll('black');
        this._darkOverlay.x = x;
        this._darkOverlay.y = y;
        this._darkOverlay.opacity = 0; 
        
        this.addChild(this._darkOverlay);
    };

    Scene_SuperDuperGameOver.prototype.createCommandWindow = function() {
        this._commandWindow = new Window_GameOverMenu();
        this._commandWindow.setHandler('checkpoint', this.commandCheckpoint.bind(this));
        this._commandWindow.setHandler('savemenu', this.commandSaveMenu.bind(this));
        this._commandWindow.setHandler('title', this.commandTitle.bind(this));
        this.addChild(this._commandWindow);
    };

    Scene_SuperDuperGameOver.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        
        sendScreenCmd('SET', ['noise', config.maxNoise]);
        sendScreenCmd('SET', ['scanline', config.maxScanline]);
        sendScreenCmd('SET', ['chroma', config.maxChroma]);
    };

    Scene_SuperDuperGameOver.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        this._frameCount++;
        
        if (this.filters && this.filters.length > 0) {
            this._bgContainer.filters = this.filters;
            this.filters = null;
        }
        
        if (this._phase === 0) {
            if (this._holdTimer > 0) {
                this._holdTimer--;
            } else {
                this._phase = 1;
                this._sdTargetVol = config.bgsMenuVolume; 
                
                this._commandWindow.open();
                this._commandWindow.activate();
            }
        } else if (this._phase === 1) {
            // Меню и черная подложка плавно появляются
            if (this._darkOverlay.opacity < config.bgOpacity) {
                this._darkOverlay.opacity += 10;
            }
            // Виньетка РЕЗКО ВЫРАСТАЕТ вместе с появлением меню (от 120 до 255)
            if (this._vignetteSprite.opacity < 255) {
                this._vignetteSprite.opacity += 15;
            }
        }

        if (this._frameCount % 12 === 0) {
            sendScreenCmd('SET', ['brightness', String(0.6 + Math.random() * 1.5)]);
            this._bgContainer.y = (Math.random() - 0.5) * config.shakeIntensity;
        } else if (this._frameCount % 12 === 2) {
            sendScreenCmd('SET', ['brightness', '1.0']);
            this._bgContainer.y = 0;
        }

        if (this._sdCurrentVol !== this._sdTargetVol) {
            let diff = this._sdTargetVol - this._sdCurrentVol;
            this._sdCurrentVol += diff * 0.05; 
            if (Math.abs(diff) < 0.5) this._sdCurrentVol = this._sdTargetVol;
            
            if (AudioManager._currentBgs && config.bgsName) {
                AudioManager.updateBgsParameters({ name: config.bgsName, volume: Math.round(this._sdCurrentVol), pitch: 100, pan: 0 });
            }
        }
    };

    Scene_SuperDuperGameOver.prototype.terminate = function() {
        Scene_Base.prototype.terminate.call(this);
        AudioManager.stopBgs(); 
        
        sendScreenCmd('SET', ['noise', '0']);
        sendScreenCmd('SET', ['scanline', '0']);
        sendScreenCmd('SET', ['chroma', '0']);
        sendScreenCmd('SET', ['brightness', '1.0']);
    };

    // --- МОМЕНТАЛЬНЫЙ УХОД ВО ТЬМУ ---
    Scene_SuperDuperGameOver.prototype.instantBlackout = function() {
        AudioManager.stopAll(); // Резко обрубаем весь звук
        
        // Прячем интерфейс
        if (this._commandWindow) {
            this._commandWindow.deactivate();
            this._commandWindow.hide();
            this._commandWindow.visible = false;
        }

        // Заливаем весь экран абсолютным черным цветом поверх всего
        if (!this._instantBlackSprite) {
            this._instantBlackSprite = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
            this._instantBlackSprite.bitmap.fillAll('black');
            this.addChild(this._instantBlackSprite);
        }
        this._instantBlackSprite.opacity = 255;
        
        // Сбрасываем фильтры, чтобы не было визуального мусора
        sendScreenCmd('SET', ['noise', '0']);
        sendScreenCmd('SET', ['scanline', '0']);
        sendScreenCmd('SET', ['chroma', '0']);
        sendScreenCmd('SET', ['brightness', '1.0']);
    };

    // --- ЛОГИКА КНОПОК ---

    Scene_SuperDuperGameOver.prototype.commandCheckpoint = function() {
        if (DataManager.isThisGameFile(SAMSARA_SLOT)) {
            // Играем кастомный звук успешного выбора
            playCustomSe(config.okSound, config.okVol, config.okPitch);
            
            this.instantBlackout(); // Моментальная тьма

            const executeGoto = function() {
                if ($gameSystem.onAfterLoad) {
                    $gameSystem.onAfterLoad();
                }
                if ($gameSystem.versionId() !== $dataSystem.versionId) {
                    if ($gamePlayer) $gamePlayer.reserveTransfer($gameMap.mapId(), $gamePlayer.x, $gamePlayer.y);
                    if ($gameMap) $gameMap.requestRefresh();
                }
                SceneManager._sdsNeedsFadeIn = true; 
                SceneManager.goto(Scene_Map);
            };

            // Поддержка обеих версий загрузки из Самсары (MZ и MV)
            if (Utils.RPGMAKER_NAME === 'MZ') {
                DataManager.loadGame(SAMSARA_SLOT).then(executeGoto).catch(function() {
                    playCustomSe(config.buzzerSound, config.buzzerVol, config.buzzerPitch);
                });
            } else {
                if (DataManager.loadGame(SAMSARA_SLOT)) {
                    executeGoto();
                } else {
                    playCustomSe(config.buzzerSound, config.buzzerVol, config.buzzerPitch);
                }
            }
        } else {
            playCustomSe(config.buzzerSound, config.buzzerVol, config.buzzerPitch);
            this._commandWindow.activate();
        }
    };

    Scene_SuperDuperGameOver.prototype.commandSaveMenu = function() {
        playCustomSe(config.okSound, config.okVol, config.okPitch);
        this.instantBlackout(); // Моментальная тьма
        SceneManager.push(Scene_Load);
    };

    Scene_SuperDuperGameOver.prototype.commandTitle = function() {
        playCustomSe(config.okSound, config.okVol, config.okPitch);
        this.instantBlackout(); // Моментальная тьма
        SceneManager.goto(Scene_Title);
    };

    window.Scene_Gameover = Scene_SuperDuperGameOver;

})();