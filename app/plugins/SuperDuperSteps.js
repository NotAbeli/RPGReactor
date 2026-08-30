//-----------------------------------------------------------------------------
//  Super Duper Steps (Advanced Step SE)
//-----------------------------------------------------------------------------
//  For: RPGMAKER MV (v1.5.0+) & MZ
//  SuperDuperSteps.js
//-----------------------------------------------------------------------------
//  2026-03-07 - Version 3.1 - FIX: Prevent step sound on teleport/transfer (by Korolev)
//  2024-02-XX - Version 3.0 - FIX: Added stop-buffer to prevent machine-gun steps on turn
//  2024-02-XX - Version 2.9 - Reorganized UI: Frequency settings moved to Speed Modifiers
//  2024-02-XX - Version 2.8 - Pure Tick Timer Mode (Configurable Ticks)
//  2024-02-XX - Version 2.7 - Altimit Fix (Removed isMoving dependency)
//  2024-02-XX - Version 2.6 - Full Altimit Fix (Distance-based Tracking)
//  2024-02-XX - Version 2.5 - Fix for Altimit/Pixel Movement (Coordinate Rounding)
//  2024-02-XX - Version 2.4 - Added Timer-based triggering (Ticks vs Frames)
//  2024-02-XX - Version 2.3 - Added Speed Variable Logging (Supports float)
//  2024-02-XX - Version 2.2 - Added Dynamic Speed Modifiers (Run/Sneak)
//  2024-02-XX - Version 2.1 - Renamed to SuperDuperSteps. Added Sequence Mode.
//  2024-02-XX - Version 2.0 - Replaced text params with Struct/JSON Database
//  2024-01-15 - Version 1.4 - Added sound pools for each terrain type
//  2017-03-16 - Version 1.0 - release
//-----------------------------------------------------------------------------
//  Terms can be found at:
//  galvs-scripts.com
//-----------------------------------------------------------------------------

var Imported = Imported || {};
Imported.SuperDuperSteps = true;

var Galv = Galv || {};           // Galv's main object
Galv.CFSTEP = Galv.CFSTEP || {}; // Galv's stuff

//-----------------------------------------------------------------------------
/*:
 * @plugindesc (v.3.1) Super Duper Steps - Teleport Fix Version
 * @author Korolev
 *
 * @param Base Step Interval
 * @desc Базовая пауза между шагами в ТИКАХ (кадрах) при нормальной скорости (4).
 * @type number
 * @min 1
 * @default 25
 *
 * @param Events
 * @desc Включить звуки шагов для событий? (true/false)
 * @type boolean
 * @default true
 *
 * @param Max Hearing Distance
 * @desc Максимальная дистанция (в тайлах), на которой слышны шаги событий. 0 = бесконечно.
 * @type number
 * @default 8
 *
 * @param Volume Fade Type
 * @desc Тип затухания громкости по дистанции.
 * @type select
 * @option Linear (Равномерное)
 * @value linear
 * @option Quadratic (Реалистичное)
 * @value quadratic
 * @option Cubic (Быстрое)
 * @value cubic
 * @default linear
 *
 * @param Min Audible Volume
 * @desc Минимальная громкость (0-100%) на границе слышимости.
 * @type number
 * @min 0
 * @max 100
 * @default 20
 *
 * @param Player Speed Variable
 * @desc ID переменной, в которую будет записываться точная скорость игрока (float) при шаге. 0 = выкл.
 * @type variable
 * @default 0
 *
 * @param --- Speed Modifiers ---
 * @default
 *
 * @param Run Interval Mod
 * @desc Частота (Интервал) при беге (Скорость >= 5). Отрицательное = чаще.
 * @parent --- Speed Modifiers ---
 * @type number
 * @min -100
 * @max 100
 * @default -5
 *
 * @param Run Volume Mod
 * @desc Изменение громкости при беге (Скорость >= 5).
 * @parent --- Speed Modifiers ---
 * @type number
 * @min -100
 * @max 100
 * @default 20
 *
 * @param Run Pitch Mod
 * @desc Изменение питча при беге (Скорость >= 5).
 * @parent --- Speed Modifiers ---
 * @type number
 * @min -100
 * @max 100
 * @default 10
 *
 * @param Slow Interval Mod
 * @desc Частота (Интервал) при медленной ходьбе (Скорость <= 3). Положительное = реже.
 * @parent --- Speed Modifiers ---
 * @type number
 * @min -100
 * @max 100
 * @default 10
 *
 * @param Slow Volume Mod
 * @desc Изменение громкости при скрытности (Скорость <= 3).
 * @parent --- Speed Modifiers ---
 * @type number
 * @min -100
 * @max 100
 * @default -20
 *
 * @param Slow Pitch Mod
 * @desc Изменение питча при скрытности (Скорость <= 3).
 * @parent --- Speed Modifiers ---
 * @type number
 * @min -100
 * @max 100
 * @default -10
 *
 * @param --- Database ---
 * @default
 *
 * @param Terrain Configurations
 * @desc Список настроек для разных типов местности (Terrain Tags).
 * @type struct<TerrainConfig>[]
 * @default []
 *
 * @help
 * Super Duper Steps (v3.1 - Teleport Fix Version)
 * ----------------------------------------------------------------------------
 * ИСПРАВЛЕНИЕ (v3.1 - Korolev):
 * Устранен баг, при котором воспроизводился звук шага во время телепортации
 * игрока или принудительного перемещения событий. Теперь при вызове команды 
 * Set Position (Установить позицию) пройденная дистанция обнуляется.
 *
 * ИСПРАВЛЕНИЕ (v3.0):
 * Добавлен буфер остановки. Теперь при смене направления или краткой остановке
 * таймер шага не сбрасывается мгновенно. Это предотвращает "пулеметную очередь"
 * звуков (наложение звуков друг на друга).
 * Таймер сбросится в начальное состояние только если персонаж стоит на месте
 * более 10 кадров (ок. 0.16 сек).
 *
 * ----------------------------------------------------------------------------
 * РЕЖИМ ТАЙМЕРА (TICK TIMER):
 * В этой версии полностью удалены привязки к кадрам анимации.
 * Звук шага воспроизводится строго по таймеру (в тиках/кадрах игры),
 * пока персонаж движется.
 *
 * СОВМЕСТИМОСТЬ С ALTIMIT:
 * Плагин определяет движение, сравнивая реальные координаты X/Y с предыдущим
 * кадром. Если координаты изменились > 0.001, таймер тикает.
 * ----------------------------------------------------------------------------
 */

/*~struct~TerrainConfig:
 * @param Terrain ID
 * @desc ID террейна (из вкладки Tilesets), для которого действуют эти звуки.
 * @type number
 * @min 0
 * @max 255
 * @default 1
 *
 * @param Playback Mode
 * @desc Как проигрывать звуки из пула?
 * @type select
 * @option Random (Случайно)
 * @value random
 * @option Sequential (По порядку)
 * @value sequential
 * @default random
 *
 * @param Sound Pool
 * @desc Список звуков для этого террейна.
 * @type struct<StepSound>[]
 * @default []
 */

/*~struct~StepSound:
 * @param Filename
 * @desc Файл звукового эффекта (SE).
 * @type file
 * @dir audio/se/
 * @require 1
 *
 * @param Volume
 * @desc Громкость звука (0-100).
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @param Pitch
 * @desc Тон/Скорость звука (50-150). 100 = норма.
 * @type number
 * @min 50
 * @max 150
 * @default 100
 */

//-----------------------------------------------------------------------------
//  CODE STUFFS
//-----------------------------------------------------------------------------

(function() {
    
    var params = PluginManager.parameters('SuperDuperSteps');
    
    // Config: Timer settings
    Galv.CFSTEP.baseInterval = Number(params["Base Step Interval"] || 25);
    
    // Interval Modifiers (Ticks) - Now located in Speed Modifiers group in Editor
    Galv.CFSTEP.runInt = Number(params["Run Interval Mod"] || -5);
    Galv.CFSTEP.slowInt = Number(params["Slow Interval Mod"] || 10);
    
    Galv.CFSTEP.events = params["Events"] === 'true' || params["Events"] === true;
    Galv.CFSTEP.maxDistance = Number(params["Max Hearing Distance"] || 8);
    Galv.CFSTEP.fadeType = String(params["Volume Fade Type"] || "linear").toLowerCase();
    Galv.CFSTEP.minVolume = Number(params["Min Audible Volume"] || 20) / 100;
    
    // Speed Variable
    Galv.CFSTEP.speedVarId = Number(params["Player Speed Variable"] || 0);

    // Audio Modifiers
    Galv.CFSTEP.runVol = Number(params["Run Volume Mod"] || 20);
    Galv.CFSTEP.runPitch = Number(params["Run Pitch Mod"] || 10);
    Galv.CFSTEP.slowVol = Number(params["Slow Volume Mod"] || -20);
    Galv.CFSTEP.slowPitch = Number(params["Slow Pitch Mod"] || -10);

    // --- JSON PARSING LOGIC ---

    Galv.CFSTEP.terrainConfig = {}; 

    Galv.CFSTEP.parseConfig = function() {
        var rawConfig = params["Terrain Configurations"];
        if (!rawConfig) return;

        try {
            var parsedConfig = JSON.parse(rawConfig);
            
            for (var i = 0; i < parsedConfig.length; i++) {
                var terrainData = JSON.parse(parsedConfig[i]);
                var tId = Number(terrainData["Terrain ID"]);
                var mode = terrainData["Playback Mode"] || "random";
                var rawSounds = JSON.parse(terrainData["Sound Pool"]);
                
                var soundList = [];
                
                for (var j = 0; j < rawSounds.length; j++) {
                    var sData = JSON.parse(rawSounds[j]);
                    soundList.push({
                        name: sData["Filename"],
                        volume: Number(sData["Volume"]),
                        pitch: Number(sData["Pitch"]),
                        pan: 0
                    });
                }

                if (soundList.length > 0) {
                    Galv.CFSTEP.terrainConfig[tId] = {
                        sounds: soundList,
                        mode: mode
                    };
                }
            }
        } catch (e) {
            console.error("SuperDuperSteps: Error parsing Terrain Database parameters!", e);
        }
    };

    Galv.CFSTEP.parseConfig();

    // Calculate volume based on distance
    Galv.CFSTEP.calculateDistanceVolume = function(sourceX, sourceY, baseVolume) {
        if (Galv.CFSTEP.maxDistance <= 0) return baseVolume;
        
        var player = $gamePlayer;
        if (!player) return baseVolume;
        
        var dx = Math.abs(sourceX - player.x);
        var dy = Math.abs(sourceY - player.y);
        var distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > Galv.CFSTEP.maxDistance) return 0;
        
        var ratio = distance / Galv.CFSTEP.maxDistance;
        var volumeRatio;
        
        switch(Galv.CFSTEP.fadeType) {
            case "quadratic":
                volumeRatio = 1 - (ratio * ratio);
                break;
            case "cubic":
                volumeRatio = 1 - (ratio * ratio * ratio);
                break;
            case "linear":
            default:
                volumeRatio = 1 - ratio;
                break;
        }
        
        volumeRatio = Math.max(volumeRatio, Galv.CFSTEP.minVolume);
        return baseVolume * volumeRatio;
    };


    //-----------------------------------------------------------------------------
    //  GAME CHARACTERBASE
    //-----------------------------------------------------------------------------

    Galv.CFSTEP.Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        this.stepSeInit();
        Galv.CFSTEP.Game_CharacterBase_initMembers.call(this);
    };

    Game_CharacterBase.prototype.stepSeInit = function() {
        // Timer Logic
        this._stepTimer = 0;
        this._stopCount = 0; // NEW: Counter for stop duration
        this._lastStepX = this._x;
        this._lastStepY = this._y;
        
        // Keep track of sequential steps
        this._stepSequence = {}; 
    };

    // FIX v3.1: Reset step positions upon teleportation / position set
    Galv.CFSTEP.Game_CharacterBase_setPosition = Game_CharacterBase.prototype.setPosition;
    Game_CharacterBase.prototype.setPosition = function(x, y) {
        Galv.CFSTEP.Game_CharacterBase_setPosition.call(this, x, y);
        this._lastStepX = this._x;
        this._lastStepY = this._y;
        this._stepTimer = 1; // Готовность к шагу, но без ложного срабатывания
        this._stopCount = 15; // Эмуляция остановки для дебаунс-логики
    };

    Game_CharacterBase.prototype.getStepSound = function(terrainTag) {
        var config = Galv.CFSTEP.terrainConfig[terrainTag];
        // P28: персональный пул звуков шагов (<step_snds:...> в note события)
        // — заменяет пул террейна; работает и на террейне без своих звуков
        var hasOverride = !!(this._stepPoolOverride && this._stepPoolOverride.length);
        var pool = hasOverride ? this._stepPoolOverride
            : ((config && config.sounds && config.sounds.length) ? config.sounds : null);
        if (!pool) return null;

        var mode = (config && config.mode) || 'random';
        var selectedSound = null;

        if (mode === 'sequential') {
            if (this._stepSequence[terrainTag] === undefined) {
                this._stepSequence[terrainTag] = 0;
            }
            var currentIndex = this._stepSequence[terrainTag];
            if (currentIndex >= pool.length) currentIndex = 0;
            selectedSound = pool[currentIndex];
            this._stepSequence[terrainTag] = (currentIndex + 1) % pool.length;
        } else {
            var randomIndex = Math.floor(Math.random() * pool.length);
            selectedSound = pool[randomIndex];
        }

        if (selectedSound) {
            return {
                name: selectedSound.name,
                pan: selectedSound.pan,
                pitch: selectedSound.pitch,
                volume: selectedSound.volume
            };
        }
        return null;
    };

    Game_CharacterBase.prototype.playStepSE = function(volMod) {
        // Find approximate tile center for terrain lookup
        var x = Math.floor(this._x + 0.5);
        var y = Math.floor(this._y + 0.5);
        
        var terrainTag = $gameMap.terrainTag(x, y);
        var sound = this.getStepSound(terrainTag);
        
        var speed = this.realMoveSpeed();
        
        // Log variable
        if (this === $gamePlayer && Galv.CFSTEP.speedVarId > 0) {
            $gameVariables.setValue(Galv.CFSTEP.speedVarId, speed);
        }

        if (sound && sound.name) {
            if (volMod) sound.volume = sound.volume * volMod;

            if (speed >= 5) {
                sound.volume += Galv.CFSTEP.runVol;
                sound.pitch += Galv.CFSTEP.runPitch;
            } else if (speed <= 3) {
                sound.volume += Galv.CFSTEP.slowVol;
                sound.pitch += Galv.CFSTEP.slowPitch;
            }
            
            if (this !== $gamePlayer && this._eventId !== undefined) {
                var distanceVolume = Galv.CFSTEP.calculateDistanceVolume(this._x, this._y, sound.volume);
                if (distanceVolume <= 0) return;
                sound.volume = distanceVolume;
            }
            
            var volumeVariation = (Math.random() * 20) - 10; 
            var pitchVariation = (Math.random() * 20) - 10; 
            
            sound.volume = Math.max(1, Math.min(150, sound.volume + volumeVariation));
            sound.pitch = Math.max(50, Math.min(150, sound.pitch + pitchVariation));
            
            AudioManager.playSe(sound);
        }
    };

    // Calculate the delay for the NEXT step based on current speed settings
    Game_CharacterBase.prototype.getStepInterval = function() {
        var speed = this.realMoveSpeed();
        var interval = Galv.CFSTEP.baseInterval;
        
        // Apply Modifiers (Ticks)
        if (speed >= 5) {
            interval += Galv.CFSTEP.runInt;
        } else if (speed <= 3) {
            interval += Galv.CFSTEP.slowInt;
        }
        
        // Safety min interval
        return Math.max(1, interval);
    };

    //-----------------------------------------------------------------------------
    //  GAME PLAYER
    //-----------------------------------------------------------------------------

    Galv.CFSTEP.Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        Galv.CFSTEP.Game_Player_update.call(this,sceneActive);
        this.updateStepSe();
    };

    Game_Player.prototype.updateStepSe = function() {
        // Init last pos if needed
        if (this._lastStepX === undefined) this._lastStepX = this._x;
        if (this._lastStepY === undefined) this._lastStepY = this._y;

        // Check if actually moved (Altimit compatible check)
        var dx = this._x - this._lastStepX;
        var dy = this._y - this._lastStepY;
        var moved = (dx * dx + dy * dy) > 0.000001; // Tiny threshold for float precision

        if (moved) {
            this._stopCount = 0; // Reset stop counter
            this._stepTimer--;
            if (this._stepTimer <= 0) {
                this.playStepSE();
                this._stepTimer = this.getStepInterval();
            }
        } else {
            // FIX START: Debounce logic
            // Don't reset timer immediately. Wait until player is stopped for ~10 frames.
            this._stopCount = (this._stopCount || 0) + 1;
            
            if (this._stopCount > 10) {
                // Only now reset to "Ready for immediate step"
                this._stepTimer = 1;
            }
            // FIX END
        }

        // Update last pos
        this._lastStepX = this._x;
        this._lastStepY = this._y;
    };


    //-----------------------------------------------------------------------------
    //  GAME EVENT
    //-----------------------------------------------------------------------------

    if (Galv.CFSTEP.events) {
        Galv.CFSTEP.Game_Event_refresh = Game_Event.prototype.refresh;
        Game_Event.prototype.refresh = function() {
            Galv.CFSTEP.Game_Event_refresh.call(this);
            this.setStepSe();
        };
        
        Game_Event.prototype.setStepSe = function() {
            // P5: <step_se> или <step_se:VOL> (громкость 0–150% на этого врага;
            // дистанционный фейд до игрока применяется как обычно).
            // P28: <step_snds:A,B,C> — персональный пул звуков шагов этого
            // врага (заменяет пул террейна; громкость/транскрипция — общие).
            this._stepSeVol = 1;
            this._stepPoolOverride = null;
            var noteStr = String(this.event().note);
            var mSnd = noteStr.match(/<step_snds:([^>]*)>/);
            if (mSnd && mSnd[1]) {
                var names = mSnd[1].split(',').map(function(s) { return s.trim(); })
                    .filter(function(s) { return s !== ''; });
                if (names.length) {
                    this._stepPoolOverride = names.map(function(n) {
                        return { name: n, volume: 90, pitch: 100, pan: 0 };
                    });
                }
            }
            var mNote = noteStr.match(/<step_se(?::(\d+))?>/);
            if (mNote && this._characterName != "") {
                this._stepSeOn = true;
                if (mNote[1]) this._stepSeVol = Math.max(0, Math.min(150, Number(mNote[1]))) / 100;
            } else {
                var page = this.page();
                var stepSe = false;
                var vol = 1;
                if (page) {
                    for (var i = 0; i < page.list.length; i++) {
                        if (page.list[i].code == 108) {
                            var cmt = String(page.list[i].parameters[0]);
                            var m = cmt.match(/<step_se(?::(\d+))?>/);
                            if (m) {
                                stepSe = true;
                                if (m[1]) vol = Math.max(0, Math.min(150, Number(m[1]))) / 100;
                            }
                            var m2 = cmt.match(/<step_snds:([^>]*)>/);
                            if (m2 && m2[1]) {
                                var names2 = m2[1].split(',').map(function(s) { return s.trim(); })
                                    .filter(function(s) { return s !== ''; });
                                if (names2.length) {
                                    this._stepPoolOverride = names2.map(function(n) {
                                        return { name: n, volume: 90, pitch: 100, pan: 0 };
                                    });
                                }
                            }
                        };
                    };
                };
                this._stepSeOn = stepSe;
                this._stepSeVol = vol;
            };
        };
        
        Galv.CFSTEP.Game_Event_update = Game_Event.prototype.update;
        Game_Event.prototype.update = function(sceneActive) {
            Galv.CFSTEP.Game_Event_update.call(this,sceneActive);
            this.updateStepSe();
        };
        
        Game_Event.prototype.updateStepSe = function() {
            if (!this._stepSeOn) return;

            if (this._lastStepX === undefined) this._lastStepX = this._x;
            if (this._lastStepY === undefined) this._lastStepY = this._y;

            var dx = this._x - this._lastStepX;
            var dy = this._y - this._lastStepY;
            var moved = (dx * dx + dy * dy) > 0.000001;

            if (moved) {
                this._stopCount = 0; // Reset stop counter
                this._stepTimer--;
                if (this._stepTimer <= 0) {
                    this.playStepSE(this._stepSeVol);
                    this._stepTimer = this.getStepInterval();
                }
            } else {
                // FIX START: Debounce logic for Events too
                this._stopCount = (this._stopCount || 0) + 1;
                if (this._stopCount > 10) {
                    this._stepTimer = 1;
                }
                // FIX END
            }

            this._lastStepX = this._x;
            this._lastStepY = this._y;
        };
    }; // end if (Galv.CFSTEP.events)

})();