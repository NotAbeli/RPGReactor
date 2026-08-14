//=============================================================================
// SuperDuperSplash.js
//=============================================================================

/*:
 * @plugindesc [v3.6.2] Кинематографичная заставка "Старый Телевизор" (Линза поверх помех).
 * @author Korolev
 *
 * @param Enable Splash
 * @text Включить заставку
 * @desc Включить/выключить показ этой заставки перед титульным экраном.
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 *
 * @param Splash Image
 * @text Картинка логотипа
 * @desc Изображение, которое будет показано (должно лежать в img/system/).
 * @require 1
 * @dir img/system/
 * @type file
 * @default MadeWithMv
 *
 * @param Logo Preset
 * @text Пресет логотипа
 * @desc Имя пресета из SuperDuperScreen, применяемый на Фазе 2.
 * @type string
 * @default Action
 *
 * @param Static Sound
 * @text Звук помех (BGS)
 * @desc Название фонового звука (BGS) для имитации шипения телевизора.
 * @require 1
 * @dir audio/bgs/
 * @type file
 * @default Storm
 *
 * @param Power Off SE
 * @text Звук выключения (SE)
 * @desc Звуковой эффект (SE), который сработает при схлопывании кинескопа.
 * @require 1
 * @dir audio/se/
 * @type file
 * @default Laser
 *
 * @param --- Настройки Виньетки ---
 * @default
 *
 * @param Vignette Radius
 * @parent --- Настройки Виньетки ---
 * @text Чистота окна (Радиус)
 * @desc Размер дыры в центре (0.0 - 1.0). 0.1 - крошечное окно, 1.0 - на весь экран.
 * @type number
 * @decimals 2
 * @default 0.10
 *
 * @param Vignette Softness
 * @parent --- Настройки Виньетки ---
 * @text Мягкость краев (Размытие)
 * @desc Плавность края дыры (0.0 - 1.0). 0.0 - абсолютно жесткая черная рамка.
 * @type number
 * @decimals 2
 * @default 0.00
 *
 * @param Vignette Opacity
 * @parent --- Настройки Виньетки ---
 * @text Непрозрачность краев
 * @desc Насколько черным будет пластик телевизора (0.0 - 1.0).
 * @type number
 * @decimals 2
 * @default 1.00
 *
 * @param --- Тайминги ---
 * @default
 *
 * @param Phase 0 Time
 * @text Фаза 0: Покой (кадры)
 * @desc Абсолютная тьма и тишина перед началом поиска сигнала.
 * @type number
 * @default 60
 *
 * @param Phase 1 Time
 * @text Фаза 1: Поиск сигнала (кадры)
 * @desc Включение ЭЛТ, дрожание, плотный шум.
 * @type number
 * @default 60
 *
 * @param Phase 2 Time
 * @text Фаза 2: Очистка (кадры)
 * @desc Шум спадает, логотип плавно проявляется.
 * @type number
 * @default 60
 *
 * @param Phase 3 Time
 * @text Фаза 3: Эфир (кадры)
 * @desc Задержка. Логотип висит на экране под легкими помехами.
 * @type number
 * @default 150
 *
 * @param Phase 4 Time
 * @text Фаза 4: Срыв и CRT (кадры)
 * @desc Шквал помех, дрожание и выключение ЭЛТ со звуком.
 * @type number
 * @default 60
 *
 * @help
 * ============================================================================
 * Описание
 * ============================================================================
 * Плагин "Super Duper Splash" v3.6.2
 * Автор: Korolev
 * * Требует "SuperDuperScreen" (v3.5+) в проекте!
 * * Изменения v3.6.2:
 * - Перехват фильтров SuperDuperScreen: помехи переносятся внутрь ЭЛТ-контейнера.
 * Теперь виньетка работает как настоящая чистая линза кинескопа ПОВЕРХ всех искажений.
 * * Изменения v3.6.1:
 * - Исправлен критический баг с невидимой виньеткой. Теперь она 
 * корректно привязывается к сцене и рендерится поверх CRT-контейнера.
 * * Изменения v3.6:
 * - ВИНЬЕТКА ПЕРЕПИСАНА С НУЛЯ: Теперь это физический Hole-Punch в Битмапе.
 * - Принудительное удержание виньетки поверх всех элементов в каждом кадре.
 * - Исправлена математика: Radius 0.1 и Softness 0 теперь ДАЮТ жесткую дыру.
 * - Полностью вырезаны любые заикания про размытие (blur).
 * - Громкость звука: 8 (поиск) / 3 (эфир).
 */

(function() {
    var parameters = PluginManager.parameters('SuperDuperSplash');
    
    var SD_Splash = {
        Enabled: String(parameters['Enable Splash'] || 'true') === 'true',
        Image: String(parameters['Splash Image'] || ''),
        Preset: String(parameters['Logo Preset'] || 'Normal'),
        Sound: String(parameters['Static Sound'] || ''),
        PowerOffSE: String(parameters['Power Off SE'] || ''),
        
        VigRadius: Number(parameters['Vignette Radius'] || 0.10),
        VigSoft: Number(parameters['Vignette Softness'] || 0.00),
        VigOpacity: Number(parameters['Vignette Opacity'] || 1.00),

        Time0: Number(parameters['Phase 0 Time'] || 60),
        Time1: Number(parameters['Phase 1 Time'] || 60),
        Time2: Number(parameters['Phase 2 Time'] || 60),
        Time3: Number(parameters['Phase 3 Time'] || 150),
        Time4: Number(parameters['Phase 4 Time'] || 60)
    };

    //-----------------------------------------------------------------------------
    // Scene_Boot
    //-----------------------------------------------------------------------------
    var _Scene_Boot_loadSystemImages = Scene_Boot.prototype.loadSystemImages;
    Scene_Boot.prototype.loadSystemImages = function() {
        _Scene_Boot_loadSystemImages.call(this);
        if (SD_Splash.Enabled && SD_Splash.Image) {
            ImageManager.loadSystem(SD_Splash.Image);
        }
    };

    var _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        if (SD_Splash.Enabled && !DataManager.isBattleTest() && !DataManager.isEventTest()) {
            SceneManager.goto(Scene_SuperDuperSplash);
        } else {
            _Scene_Boot_start.call(this);
        }
    };

    //-----------------------------------------------------------------------------
    // Scene_SuperDuperSplash
    //-----------------------------------------------------------------------------
    function Scene_SuperDuperSplash() {
        this.initialize.apply(this, arguments);
    }

    Scene_SuperDuperSplash.prototype = Object.create(Scene_Base.prototype);
    Scene_SuperDuperSplash.prototype.constructor = Scene_SuperDuperSplash;

    Scene_SuperDuperSplash.prototype.initialize = function() {
        Scene_Base.prototype.initialize.call(this);
        this._phase = -1;
        this._timer = 0;
        this._frameCount = 0;
        
        this._crtContainer = null;
        this._bgSprite = null;
        this._logoSprite = null;
        this._vignetteSprite = null; // Будет спрайтом поверх всех элементов
        this._trackingLine = null;
        
        this._currentVol = 0;
        this._targetVol = 0;
        this._fadeSpeed = 0;
        this._turnOnStage = -1;
    };

    Scene_SuperDuperSplash.prototype.create = function() {
        Scene_Base.prototype.create.call(this);
        
        if (!$gameSystem) {
            $gameSystem = new Game_System();
        }
        
        this._crtContainer = new Sprite();
        this._crtContainer.pivot.x = Graphics.width / 2;
        this._crtContainer.pivot.y = Graphics.height / 2;
        this._crtContainer.x = Graphics.width / 2;
        this._crtContainer.y = Graphics.height / 2;
        this.addChild(this._crtContainer);
        
        this.createBackground();
        this.createLogo();
        this.createTrackingLine();
        // Виньетку создадим, но добавим в start()
        this.createVignette(); 
    };

    Scene_SuperDuperSplash.prototype.createBackground = function() {
        this._bgSprite = new Sprite(new Bitmap(Graphics.width, Graphics.height));
        this._bgSprite.bitmap.fillAll('#0a0a0a'); 
        this._crtContainer.addChild(this._bgSprite);
    };

    Scene_SuperDuperSplash.prototype.createLogo = function() {
        if (SD_Splash.Image) {
            this._logoSprite = new Sprite(ImageManager.loadSystem(SD_Splash.Image));
            this._logoSprite.opacity = 0; 
            this._logoSprite.x = Graphics.width / 2;
            this._logoSprite.y = Graphics.height / 2;
            this._logoSprite.anchor.x = 0.5;
            this._logoSprite.anchor.y = 0.5;
            this._crtContainer.addChild(this._logoSprite);
        }
    };

    Scene_SuperDuperSplash.prototype.createTrackingLine = function() {
        this._trackingLine = new Sprite(new Bitmap(Graphics.width, 150));
        var ctx = this._trackingLine.bitmap._context;
        var grad = ctx.createLinearGradient(0, 0, 0, 150);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, Graphics.width, 150);
        
        this._trackingLine.y = -200;
        this._trackingLine.visible = false;
        this._crtContainer.addChild(this._trackingLine);
    };

    Scene_SuperDuperSplash.prototype.createVignette = function() {
        var w = Graphics.width;
        var h = Graphics.height;
        // Создаем спрайт на весь экран
        this._vignetteSprite = new Sprite(new Bitmap(w, h));
        this.refreshVignette();
        this._vignetteSprite.visible = false;
    };

    Scene_SuperDuperSplash.prototype.refreshVignette = function() {
        if (!this._vignetteSprite || !this._vignetteSprite.bitmap) return;
        
        var bitmap = this._vignetteSprite.bitmap;
        var ctx = bitmap._context;
        var w = bitmap.width;
        var h = bitmap.height;
        var centerX = w / 2;
        var centerY = h / 2;

        // 1. Очищаем битмап
        bitmap.clear();

        // 2. Рисуем глухую черную заливку (корпус ТВ)
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.globalAlpha = SD_Splash.VigOpacity;
        ctx.fillRect(0, 0, w, h);

        // 3. ПРИНУДИТЕЛЬНО ВЫРЕЗАЕМ ДЫРУ (Hole Punch)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1.0;

        // rStart - диаметр чистого окна, rEnd - зона размытия (softness)
        var maxSide = Math.max(w, h);
        var rStart = maxSide * (SD_Splash.VigRadius * 0.5);
        var rEnd = rStart + (maxSide * (SD_Splash.VigSoft * 0.4));

        if (SD_Splash.VigSoft <= 0) {
            // Идеально острый край
            ctx.beginPath();
            ctx.arc(centerX, centerY, rStart, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Мягкий край через градиент
            var grad = ctx.createRadialGradient(centerX, centerY, rStart, centerX, centerY, rEnd);
            grad.addColorStop(0, 'rgba(255,255,255,1)'); // Полное вырезание
            grad.addColorStop(1, 'rgba(255,255,255,0)'); // Здесь вырезание заканчивается
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, rEnd, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        bitmap._setDirty(); // MV требует уведомления об изменении битмапа
    };

    Scene_SuperDuperSplash.prototype.start = function() {
        Scene_Base.prototype.start.call(this);
        
        // ВАЖНО: Добавляем виньетку напрямую в СЦЕНУ.
        // Это гарантирует ее видимость и независимость от тряски _crtContainer.
        if (this._vignetteSprite) {
            this.addChild(this._vignetteSprite);
        }
        
        SceneManager.clearStack();
        this.startPhase0(); 
    };
    
    Scene_SuperDuperSplash.prototype.terminate = function() {
        Scene_Base.prototype.terminate.call(this);
        // Чистим за собой при выходе, чтобы виньетка не осталась
        if (this._vignetteSprite && this._vignetteSprite.parent) {
            this._vignetteSprite.parent.removeChild(this._vignetteSprite);
        }
    };
    
    Scene_SuperDuperSplash.prototype.playStatic = function(vol) {
        if (!SD_Splash.Sound) return;
        AudioManager.playBgs({ name: SD_Splash.Sound, volume: vol, pitch: 100, pan: 0 });
    };

    Scene_SuperDuperSplash.prototype.cmd = function(action, args) {
        if (!$gameSystem || !$gameSystem._superDuperConfig) return;

        if (action === 'SET') {
            var param = args[0] ? args[0].toLowerCase() : '';
            var value = Number(args[1]);
            var duration = Number(args[2]) || 0;
            
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
        else if (action === 'PRESET') {
            var pName = args[0] ? args[0].toLowerCase() : '';
            var targetPreset = ($gameSystem._superDuperSavedPresets && $gameSystem._superDuperSavedPresets[pName]);
            if (targetPreset) {
                for (var key in targetPreset) {
                    if (targetPreset.hasOwnProperty(key) && $gameSystem._superDuperConfig.hasOwnProperty(key)) {
                        if (Number(args[1]) > 0) {
                            $gameSystem._superDuperTarget[key] = targetPreset[key];
                            $gameSystem._superDuperFrames[key] = Number(args[1]);
                        } else {
                            $gameSystem._superDuperConfig[key] = targetPreset[key];
                            $gameSystem._superDuperTarget[key] = targetPreset[key];
                        }
                    }
                }
            }
        }
    };

    //==============================
    // ФАЗА 0: Покой (Абсолютная тьма)
    //==============================
    Scene_SuperDuperSplash.prototype.startPhase0 = function() {
        this._phase = 0;
        this._timer = SD_Splash.Time0;
        
        this._crtContainer.scale.set(0.0001, 0.0001);
        if (this._vignetteSprite) this._vignetteSprite.visible = false;
        
        this.cmd('SET', ['brightness', '0.0']); 
        this.cmd('SET', ['noise', '0.0']);    
        this.cmd('SET', ['scanline', '0.0']);  
        this.cmd('SET', ['wave', '0.0']);      
        this.cmd('SET', ['chroma', '0.0']);
        
        if (this._logoSprite) this._logoSprite.opacity = 0;
        
        this._targetVol = 0; 
        this._currentVol = 0; 
    };

    //==============================
    // ФАЗА 1: Поиск сигнала (Включение ЭЛТ)
    //==============================
    Scene_SuperDuperSplash.prototype.startPhase1 = function() {
        this._phase = 1;
        this._timer = SD_Splash.Time1;
        this._trackingLine.visible = true;
        
        this._targetVol = 0; 
        this._turnOnStage = 0; 
    };

    //==============================
    // ФАЗА 2: Очистка эфира (Переход к эфиру)
    //==============================
    Scene_SuperDuperSplash.prototype.startPhase2 = function() {
        this._phase = 2;
        this._timer = SD_Splash.Time2;
        this._trackingLine.visible = false;
        
        this.cmd('PRESET', [SD_Splash.Preset, String(SD_Splash.Time2)]);
        
        this.cmd('SET', ['noise', '6.0', String(SD_Splash.Time2)]);
        this.cmd('SET', ['scanline', '5.0', String(SD_Splash.Time2)]);
        this.cmd('SET', ['wave', '0.0', String(SD_Splash.Time2)]); 
        this.cmd('SET', ['chroma', '1.0', String(SD_Splash.Time2)]);
        this.cmd('SET', ['brightness', '1.0', String(SD_Splash.Time2)]);
        
        this._targetVol = 3; 
        this._fadeSpeed = 255 / SD_Splash.Time2; 
    };

    //==============================
    // ФАЗА 3: Ожидание
    //==============================
    Scene_SuperDuperSplash.prototype.startPhase3 = function() {
        this._phase = 3;
        this._timer = SD_Splash.Time3;
    };

    //==============================
    // ФАЗА 4: Срыв и выключение (CRT Collapse)
    //==============================
    Scene_SuperDuperSplash.prototype.startPhase4 = function() {
        this._phase = 4;
        this._timer = SD_Splash.Time4;
        this._trackingLine.visible = true;

        var ripTime = String(Math.floor(SD_Splash.Time4 / 2));
        
        this.cmd('SET', ['noise', '100.0', ripTime]);
        this.cmd('SET', ['scanline', '50.0', ripTime]);
        this.cmd('SET', ['wave', '0.0', ripTime]); 
        this.cmd('SET', ['chroma', '10.0', ripTime]);
        
        this._targetVol = 8; 
    };

    Scene_SuperDuperSplash.prototype.startPhase5 = function() {
        AudioManager.stopBgs(); 
        SoundManager.preloadImportantSounds();
        DataManager.setupNewGame(); 
        SceneManager.goto(Scene_Title);
    };

    Scene_SuperDuperSplash.prototype.update = function() {
        Scene_Base.prototype.update.call(this);
        this._frameCount++;
        
        // ПЕРЕХВАТ ФИЛЬТРОВ: Изолируем помехи внутри телевизора
        // Если плагин SuperDuperScreen повесил фильтры (шум/сканлайны) на всю сцену, 
        // мы забираем их и переносим строго на _crtContainer.
        if (this.filters && this.filters.length > 0) {
            this._crtContainer.filters = this.filters;
            this.filters = null;
        }

        // ПРИНУДИТЕЛЬНОЕ УДЕРЖАНИЕ ВИНЬЕТКИ ПОВЕРХ ВСЕХ ЭЛЕМЕНТОВ СЦЕНЫ
        if (this._vignetteSprite && this.children) {
            if (this.children.indexOf(this._vignetteSprite) === -1) {
                this.addChild(this._vignetteSprite);
            }
            // Выталкиваем виньетку на самый верх (перекрывая _crtContainer)
            this.setChildIndex(this._vignetteSprite, this.children.length - 1);
        }

        if (this._currentVol !== this._targetVol) {
            var diff = this._targetVol - this._currentVol;
            this._currentVol += diff * 0.1; 
            if (Math.abs(diff) < 0.5) this._currentVol = this._targetVol;
            this.playStatic(Math.round(this._currentVol));
        }

        if (this._phase === 0) {
            if (this._timer > 0) {
                this._timer--;
            } else {
                this.startPhase1();
            }
        }
        else if (this._phase === 1) {
            // Анимация включения (Скорость 0.15)
            if (this._turnOnStage === 0) {
                this.cmd('SET', ['brightness', '15.0']);
                this._crtContainer.scale.x += 0.15;
                if (this._crtContainer.scale.x >= 1.0) {
                    this._crtContainer.scale.x = 1.0;
                    this._turnOnStage = 1;
                }
            } else if (this._turnOnStage === 1) {
                this._crtContainer.scale.y += 0.15;
                if (this._crtContainer.scale.y >= 1.0) {
                    this._crtContainer.scale.y = 1.0;
                    this._turnOnStage = 2;
                    // ЭКРАН ВКЛЮЧИЛСЯ: Мгновенное появление виньетки и шума
                    if (this._vignetteSprite) this._vignetteSprite.visible = true; 
                    this._targetVol = 8;
                    this.cmd('SET', ['brightness', '1.2']);
                    this.cmd('SET', ['noise', '100.0']);    
                    this.cmd('SET', ['scanline', '50.0']);  
                    this.cmd('SET', ['chroma', '5.0']);
                }
            } else {
                // Дрожание в фазе поиска
                if (this._frameCount % 3 === 0) {
                    this._crtContainer.y = (Graphics.height / 2) + (Math.random() - 0.5) * 35;
                } else if (this._frameCount % 4 === 0) {
                    this.cmd('SET', ['brightness', String(0.8 + Math.random() * 0.8)]);
                }
            }

            if (this._timer > 0) {
                this._timer--;
            } else {
                this._crtContainer.scale.set(1.0, 1.0);
                this._crtContainer.y = Graphics.height / 2;
                this.cmd('SET', ['brightness', '1.2']); 
                this.startPhase2();
            }
        } 
        else if (this._phase === 2) {
            if (this._logoSprite) {
                this._logoSprite.opacity = Math.min(255, this._logoSprite.opacity + this._fadeSpeed);
            }
            if (this._timer > 0) {
                this._timer--;
            } else {
                this.startPhase3();
            }
        }
        else if (this._phase === 3) {
            if (this._timer > 0) {
                this._timer--;
            } else {
                this.startPhase4();
            }
        }
        else if (this._phase === 4) {
            var halfTime = Math.floor(SD_Splash.Time4 / 2);
            
            if (this._timer > halfTime) {
                if (this._frameCount % 2 === 0) {
                    this._crtContainer.y = (Graphics.height / 2) + (Math.random() - 0.5) * 40;
                    this.cmd('SET', ['brightness', String(0.5 + Math.random() * 2.5)]);
                }
            }
            else if (this._timer === halfTime) {
                this._targetVol = 0; 
                this._crtContainer.y = Graphics.height / 2;
                if (this._vignetteSprite) this._vignetteSprite.visible = false; 

                if (SD_Splash.PowerOffSE) {
                    AudioManager.playSe({ name: SD_Splash.PowerOffSE, volume: 80, pitch: 100, pan: 0 });
                }
                this.cmd('SET', ['noise', '0']);
                this.cmd('SET', ['scanline', '0']);
                this.cmd('SET', ['chroma', '0']);
                this.cmd('SET', ['brightness', '8.0']); 
            }
            // Схлопывание по вертикали
            else if (this._timer <= halfTime && this._timer > 10) {
                this._crtContainer.scale.y = Math.max(0.001, this._crtContainer.scale.y - 0.15);
            }
            // Схлопывание по горизонтали
            else if (this._timer <= 10) {
                this.cmd('SET', ['brightness', '0.0']);
                this._crtContainer.scale.x = Math.max(0, this._crtContainer.scale.x - 0.15);
            }

            if (this._timer > 0) {
                this._timer--;
            } else {
                this.startPhase5();
            }
        }
    };

})();