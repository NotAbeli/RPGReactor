/*:ru
 * @target MV MZ
 * @plugindesc (v8.9) Комбайн спрайтов: ГГ + Библиотека NPC + Fallback + Индекс-Анимация.
 * @author Korolev
 *
 * @help
 * ============================================================================
 * SUPER DUPER SPRITER (v8.9)
 * ============================================================================
 * НОВОЕ В ВЕРСИИ 8.9:
 * - Добавлен глобальный переключатель "Включить систему Поз" для временного
 * отключения функционала поз (удобно, пока рисуются спрайты).
 *
 * НОВОЕ В ВЕРСИИ 8.8 DEBUG:
 * - Внедрены инструменты глубокого логирования для отслеживания шагов,
 * смены кадров и направлений. Включите параметр Debug Console и нажмите F8.
 *
 * НОВОЕ В ВЕРСИИ 8.7:
 * - Режим "Туда-сюда" (PingPong) переписан на строгую, прямолинейную 
 * математику без независимых таймеров. Кадры гарантированно идут 
 * 1 -> 2 -> 3 -> 4 -> 3 -> 2 -> 1 без пропусков и повторений одной ноги 
 * при непрерывном беге.
 *
 * НОВОЕ В ВЕРСИИ 8.6:
 * - Заменен хрупкий счетчик направления на независимый тикер.
 *
 * НОВОЕ В ВЕРСИИ 8.5:
 * - Добавлен новый "Ритмичный" режим анимации (0-1-3-2) для 4-кадровых 
 * спрайтов, у которых кадры шагов расположены по краям, а кадры покоя -
 * в центре.
 *
 * НОВОЕ В ВЕРСИИ 8.4:
 * - Исправлен баг сброса на 0-й кадр при остановке для 4+ кадровых спрайтов.
 *
 * НОВОЕ В ВЕРСИИ 8.3:
 * - Исправлена логика анимации «Туда-сюда» (PingPong).
 *
 * НОВОЕ В ВЕРСИИ 8.2:
 * - Позы работают исключительно по точным координатам сетки (Колонка/Ряд).
 *
 * НОВОЕ В ВЕРСИИ 8.1:
 * - РАЗДЕЛЕНИЕ БАЗ ДАННЫХ: Настройки Спрайтов и Настройки Поз разделены.
 *
 * ============================================================================
 * БЫСТРЫЙ СТАРТ (NPC)
 * ============================================================================
 * 1. В "Библиотеке NPC" создайте пресет (например, Fire).
 * 2. В Note события напишите: <sds:Fire>
 *
 * ============================================================================
 *
 * @param VariableId
 * @text [ГГ] Основная Переменная
 * @type variable
 * @desc Переменная состояния игрока.
 * @default 1
 *
 * @param SpriteMappings
 * @text [ГГ] Настройки Спрайтов
 * @type struct<SpriteMapping>[]
 * @desc Правила смены внешности (скины/анимации) для Главного Героя.
 * @default []
 *
 * @param EnablePoses
 * @text Включить систему Поз?
 * @type boolean
 * @on Да
 * @off Нет
 * @desc Если выключено, настройки поз полностью игнорируются.
 * @default true
 *
 * @param PoseMappings
 * @text [ГГ] Настройки Поз (Рывки/Действия)
 * @type struct<PoseMapping>[]
 * @desc Статичные позы. Перекрывают "Настройки Спрайтов", когда активны.
 * @default []
 *
 * @param NPCMappings
 * @text [NPC] Библиотека Настроек
 * @type struct<NPCSetting>[]
 * @desc Пресеты для событий.
 * @default []
 *
 * @param ApplyToActor
 * @text Обновлять Лидера?
 * @type boolean
 * @on Да
 * @off Нет
 * @desc Менять иконку в меню.
 * @default true
 *
 * @param Debug
 * @text Debug Console
 * @type boolean
 * @default false
 */

/*~struct~SpriteMapping:
 * @param Name
 * @text Название
 * @default Config
 *
 * @param Priority
 * @text Приоритет
 * @type number
 * @min 0
 * @default 0
 *
 * @param Conditions
 * @text Условия
 * @type struct<ConditionSet>
 * @default {"MainValue":"0"}
 *
 * @param Visuals
 * @text Визуал и FPS
 * @type struct<VisualSet>
 * @default {"CharacterName":""}
 */

/*~struct~PoseMapping:
 * @param Name
 * @text Название
 * @default Pose
 *
 * @param Priority
 * @text Приоритет
 * @type number
 * @min 0
 * @default 0
 *
 * @param Conditions
 * @text Условия
 * @type struct<ConditionSet>
 * @default {"MainValue":"0"}
 *
 * @param Visuals
 * @text Визуал Позы
 * @type struct<PoseVisuals>
 * @default {"GridX":"0","GridY":"0","Width":"48","Height":"48"}
 */

/*~struct~NPCSetting:
 * @param IdName
 * @text ID Название (для тега)
 * @desc Писать в Note события: <sds:ЭтоИмя>.
 * @default NPC1
 *
 * @param Visuals
 * @text Визуал и FPS
 * @type struct<VisualSetNPC>
 * @default {"Frames":"3"}
 */

/*~struct~ConditionSet:
 * @param MainValue
 * @text Значение Переменной
 * @type number
 * @min -1
 * @desc Значение для срабатывания. Укажите -1, чтобы сделать этот спрайт "базовым" (для всех остальных значений).
 * @default 0
 *
 * @param Checks
 * @text Проверки (JSON)
 * @desc Массив проверок, все должны выполняться (И): [{"type":"switch","id":3},{"type":"var","id":20,"op":"greater","val":10}]
 * @type string
 * @default []
 *
 * @param SwitchId1
 * @text Свитч 1 (ВКЛ)
 * @type switch
 * @default 0
 *
 * @param SwitchId2
 * @text Свитч 2 (ВКЛ)
 * @type switch
 * @default 0
 *
 * @param SwitchId3
 * @text Свитч 3 (Доигрывание)
 * @type switch
 * @default 0
 *
 * @param ExtVarId
 * @text Доп. Переменная (ID)
 * @type variable
 * @default 0
 *
 * @param ExtVarOp
 * @text Сравнение
 * @type select
 * @option Равно (=)
 * @value equal
 * @option Больше (>)
 * @value greater
 * @option Меньше (<)
 * @value less
 * @option Не равно (!=)
 * @value notEqual
 * @default equal
 *
 * @param ExtVarVal
 * @text Значение Доп.
 * @type number
 * @default 0
 */

/*~struct~VisualSet:
 * @param CharacterName
 * @text Файл
 * @type file
 * @dir img/characters/
 *
 * @param CharacterIndex
 * @text Индекс (0-7)
 * @type number
 * @default 0
 *
 * @param ---Tile Settings---
 * @text [ НАСТРОЙКИ ТАЙЛА ]
 *
 * @param Frames
 * @parent ---Tile Settings---
 * @text Кадров (в ряду)
 * @type number
 * @min 3
 * @default 3
 *
 * @param StepMode
 * @parent ---Tile Settings---
 * @text Режим Покоя
 * @type select
 * @option Классика (Движение = Аним)
 * @value 0
 * @option Шаг на месте (Всегда Аним)
 * @value 1
 * @default 0
 *
 * @param Directions
 * @parent ---Tile Settings---
 * @text Направления
 * @type select
 * @option 4 (Крутится)
 * @value 4
 * @option 1 (Фиксировано)
 * @value 1
 * @default 4
 *
 * @param FPS
 * @parent ---Tile Settings---
 * @text FPS (Кадров/сек)
 * @type number
 * @desc Сколько кадров показывать в секунду. 0 = Авто (движок).
 * @default 0
 *
 * @param Pattern
 * @parent ---Tile Settings---
 * @text Режим Анимации
 * @type select
 * @option Loop (По кругу 0-1-2-3)
 * @value 0
 * @option PingPong (Туда-сюда 0-1-2-1)
 * @value 1
 * @option Ритмичный (Шаги по краям 0-1-3-2)
 * @value 2
 * @default 0
 *
 * @param IdleIndex
 * @parent ---Tile Settings---
 * @text Idle Индекс (0-7)
 * @type number
 * @min -1
 * @desc Индекс графики при простое. -1 = Выключено.
 * @default -1
 *
 * @param IdleAnimSpeed
 * @parent ---Tile Settings---
 * @text Анимация Idle
 * @type number
 * @min -1
 * @desc Скорость кадров простоя: 0 (Выкл), -1 (Стандарт движка), или свой FPS (например, 5).
 * @default 0
 *
 * @param Width
 * @parent ---Tile Settings---
 * @text Ширина (px)
 * @type number
 * @desc 0 = Авто.
 * @default 0
 *
 * @param Height
 * @parent ---Tile Settings---
 * @text Высота (px)
 * @type number
 * @desc 0 = Авто.
 * @default 0
 *
 * @param ---Manual Anim---
 * @text [ РУЧНАЯ СМЕНА ИНДЕКСОВ ]
 *
 * @param AnimationIndices
 * @parent ---Manual Anim---
 * @text Массив Индексов (0-7)
 * @type number[]
 * @desc Укажите индексы графики, которые будут меняться по кругу.
 * @default []
 *
 * @param AnimationDelay
 * @parent ---Manual Anim---
 * @text Задержка (тики)
 * @type number
 * @default 3
 */

/*~struct~PoseVisuals:
 * @param CharacterName
 * @text Файл
 * @type file
 * @dir img/characters/
 * @desc Оставьте пустым, чтобы вырезать позу из теку файла графики героя.
 *
 * @param GridX
 * @text Колонка (X)
 * @type number
 * @min 0
 * @default 0
 * @desc Координата колонки (счет с 0). Например, 3-й тайл слева = 2.
 *
 * @param GridY
 * @text Ряд (Y)
 * @type number
 * @min 0
 * @default 0
 * @desc Координата ряда (счет с 0). Например, 1-й ряд сверху = 0.
 *
 * @param Width
 * @text Ширина тайла (px)
 * @type number
 * @default 48
 * @desc Точная ширина одного вырезаемого тайла.
 *
 * @param Height
 * @text Высота тайла (px)
 * @type number
 * @default 48
 * @desc Точная высота одного вырезаемого тайла.
 */

/*~struct~VisualSetNPC:
 * @param Frames
 * @text Кадров (в ряду)
 * @type number
 * @min 3
 * @default 3
 *
 * @param StepMode
 * @text Режим Покоя
 * @type select
 * @option Классика (Движение = Аним)
 * @value 0
 * @option Шаг на месте (Всегда Аним)
 * @value 1
 * @default 0
 *
 * @param Directions
 * @text Направления
 * @type select
 * @option 4 (Крутится)
 * @value 4
 * @option 1 (Фиксировано)
 * @value 1
 * @default 4
 *
 * @param FPS
 * @text FPS (Кадров/сек)
 * @type number
 * @desc Сколько кадров показывать в секунду. 0 = Авто.
 * @default 0
 *
 * @param Pattern
 * @text Режим Анимации
 * @type select
 * @option Loop (По кругу 0-1-2-3)
 * @value 0
 * @option PingPong (Туда-сюда 0-1-2-1)
 * @value 1
 * @option Ритмичный (Шаги по краям 0-1-3-2)
 * @value 2
 * @default 0
 *
 * @param IdleIndex
 * @text Idle Индекс (0-7)
 * @type number
 * @min -1
 * @desc Индекс графики при простое. -1 = Выключено.
 * @default -1
 *
 * @param IdleAnimSpeed
 * @text Анимация Idle
 * @type number
 * @min -1
 * @desc Скорость кадров простоя: 0 (Выкл), -1 (Стандарт движка), или свой FPS (например, 5).
 * @default 0
 *
 * @param Width
 * @text Ширина (px)
 * @type number
 * @desc 0 = Авто.
 * @default 0
 *
 * @param Height
 * @text Высота (px)
 * @type number
 * @desc 0 = Авто.
 * @default 0
 */

(function(){
    'use strict';

    function resolvePluginParams() {
        var candidates = ['SuperDuperSpriter', 'VariableSpriteSwitcher'];
        for (var i = 0; i < candidates.length; i++) {
            var prm = PluginManager.parameters(candidates[i]);
            if (prm && Object.keys(prm).length) return prm;
        }
        return {};
    }

    function safeParse(str) { try { return JSON.parse(str); } catch (e) { return {}; } }
    function safeParseArray(str) { try { var res = JSON.parse(str); return Array.isArray(res) ? res : []; } catch (e) { return []; } }

    function parseIndices(raw) {
        if (!raw) return [];
        try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.map(Number);
        } catch (e) {}
        var matches = String(raw).match(/\d+/g);
        return matches ? matches.map(Number) : [];
    }

    /**
     * S32: normalize conditions into a flat checks list. New format:
     *   cond.Checks = [{type:'switch',id} | {type:'var',id,op,val}, ...]
     * (all must pass - AND). Legacy fields (SwitchId1..3, ExtVarId/Op/Val)
     * are appended so old data keeps working unchanged.
     */
    function normalizeChecks(cond) {
        var checks = [];
        try {
            var raw = cond.Checks;
            var arr = null;
            if (typeof raw === 'string') {
                arr = JSON.parse(raw || '[]');
            } else if (raw && typeof raw === 'object' && Array.isArray(raw)) {
                arr = raw;
            } else if (raw && typeof raw === 'object') {
                // Decoded struct<string> from the MV bridge: Checks holds a
                // JSON string; also tolerate {list:[...]}.
                var inner = raw.list !== undefined ? raw.list : raw;
                arr = (typeof inner === 'string') ? JSON.parse(inner || '[]') : inner;
            }
            if (Array.isArray(arr)) {
                for (var i = 0; i < arr.length; i++) {
                    var c = arr[i] || {};
                    if (c.type === 'switch' && Number(c.id) > 0) {
                        checks.push({ type: 'switch', id: Number(c.id) });
                    } else if (c.type === 'var' && Number(c.id) > 0) {
                        checks.push({ type: 'var', id: Number(c.id), op: String(c.op || 'equal'), val: Number(c.val || 0) });
                    }
                }
            }
        } catch (e) { /* malformed Checks fall back to legacy fields */ }
        // Legacy single extra variable and switch slots append as checks.
        var extVId = Number(cond.ExtVarId || 0);
        if (extVId > 0) {
            checks.push({ type: 'var', id: extVId, op: String(cond.ExtVarOp || 'equal'), val: Number(cond.ExtVarVal || 0) });
        }
        for (var s = 1; s <= 3; s++) {
            var swId = Number(cond['SwitchId' + s] || 0);
            if (swId > 0) checks.push({ type: 'switch', id: swId });
        }
        return checks;
    }

    var params = resolvePluginParams();
    var mainVarId = Number(params['VariableId'] || 1);
    var applyToActor = String(params['ApplyToActor'] || 'true') === 'true';
    var debug = String(params['Debug'] || 'false') === 'true';
    var enablePoses = String(params['EnablePoses'] || 'true') === 'true';

    function log() { if (debug) console.log.apply(console, ['[SDS DEBUG]'].concat([].slice.call(arguments))); }

    var watchedVars = [mainVarId];

    // --- Parsing Mappings (Hero Skins) ---
    var rawMappings = safeParseArray(params['SpriteMappings']);
    var mappings = rawMappings.map(function(jsonStr) {
        var obj = safeParse(jsonStr);
        var cond = safeParse(obj.Conditions || '{}');
        var vis = safeParse(obj.Visuals || '{}');

        var gFrames = Number(vis.Frames || obj.GalvFrames || 3);
        if (gFrames < 1) gFrames = 3;
        var gDirs = Number(vis.Directions || obj.GalvDirections || 4);
        if (gDirs !== 1 && gDirs !== 4) gDirs = 4;
        
        var extVId = Number(cond.ExtVarId || 0);
        if (extVId > 0 && watchedVars.indexOf(extVId) === -1) {
            watchedVars.push(extVId);
        }
        var checks = normalizeChecks(cond);
        for (var ci = 0; ci < checks.length; ci++) {
            if (checks[ci].type === 'var' && watchedVars.indexOf(checks[ci].id) === -1) {
                watchedVars.push(checks[ci].id);
            }
        }

        return {
            priority: Number(obj.Priority || 0),
            mainVal: Number(cond.MainValue !== undefined ? cond.MainValue : (obj.Value || 0)),
            checks: checks,
            // P31: «Свитч 3 (Доигрывание)» — легаси-поле SwitchId3 оживляет
            // механику checkSpecialSwitch/anim.lock: выключение этого свитча
            // НЕ обрывает скин — анимация доигрывает до полного круга.
            sw3: Number(cond.SwitchId3 || 0),
            name: String(vis.CharacterName || obj.CharacterName || '').trim(),
            index: Number(vis.CharacterIndex || obj.CharacterIndex || 0),
            sdsFrames: gFrames,
            sdsDirs: gDirs,
            sdsStep: Number(vis.StepMode || 0),
            sdsW: Number(vis.Width || obj.GalvWidth || 0),
            sdsH: Number(vis.Height || obj.GalvHeight || 0),
            sdsFps: Number(vis.FPS || 0),
            sdsPattern: Number(vis.Pattern || obj.GalvPattern || 0),
            sdsIdleIndex: (vis.IdleIndex !== undefined && vis.IdleIndex !== "") ? Number(vis.IdleIndex) : -1,
            sdsIdleAnimSpeed: (vis.IdleAnimSpeed !== undefined && vis.IdleAnimSpeed !== "") ? Number(vis.IdleAnimSpeed) : 0,
            manualIndexes: parseIndices(vis.AnimationIndices || obj.AnimationIndices),
            manualDelay: Math.max(1, Number(vis.AnimationDelay || obj.AnimationDelay || 3))
        };
    });

    // --- Parsing Pose Mappings (Hero Poses) ---
    var rawPoses = safeParseArray(params['PoseMappings']);
    var poseMappings = rawPoses.map(function(jsonStr) {
        var obj = safeParse(jsonStr);
        var cond = safeParse(obj.Conditions || '{}');
        var vis = safeParse(obj.Visuals || '{}');
        
        var extVId = Number(cond.ExtVarId || 0);
        if (extVId > 0 && watchedVars.indexOf(extVId) === -1) {
            watchedVars.push(extVId);
        }
        var checks = normalizeChecks(cond);
        for (var ci = 0; ci < checks.length; ci++) {
            if (checks[ci].type === 'var' && watchedVars.indexOf(checks[ci].id) === -1) {
                watchedVars.push(checks[ci].id);
            }
        }

        return {
            priority: Number(obj.Priority || 0),
            mainVal: Number(cond.MainValue !== undefined ? cond.MainValue : (obj.Value || 0)),
            checks: checks,
            name: String(vis.CharacterName || '').trim(),
            gridX: Number(vis.GridX || 0),
            gridY: Number(vis.GridY || 0),
            w: Number(vis.Width || 48),
            h: Number(vis.Height || 48)
        };
    });

    // --- Parsing NPC Configs ---
    var npcConfigs = {};
    var rawNPCs = safeParseArray(params['NPCMappings']);
    rawNPCs.forEach(function(jsonStr) {
        var obj = safeParse(jsonStr);
        var idName = String(obj.IdName || "").trim();
        var vis = safeParse(obj.Visuals || '{}');
        if (idName) {
            npcConfigs[idName] = {
                frames: Math.max(3, Number(vis.Frames || 3)),
                dirs: (Number(vis.Directions || 4) === 1) ? 1 : 4,
                stepMode: Number(vis.StepMode || 0),
                w: Number(vis.Width || 0),
                h: Number(vis.Height || 0),
                fps: Number(vis.FPS || 0),
                patternMode: Number(vis.Pattern || 0),
                idleIndex: (vis.IdleIndex !== undefined && vis.IdleIndex !== "") ? Number(vis.IdleIndex) : -1,
                idleAnimSpeed: (vis.IdleAnimSpeed !== undefined && vis.IdleAnimSpeed !== "") ? Number(vis.IdleAnimSpeed) : 0
            };
        }
    });

    // ======================================================================
    // ЧАСТЬ 1: ЛОГИКА ГГ
    // ======================================================================

    function checkSwitch(id) { return (!id || id <= 0) ? true : $gameSwitches.value(id); }
    function checkExtraVar(id, op, targetVal) {
        if (!id || id <= 0) return true;
        var cur = $gameVariables.value(id);
        if (op === 'equal') return cur === targetVal;
        if (op === 'greater') return cur > targetVal;
        if (op === 'less') return cur < targetVal;
        if (op === 'notEqual') return cur !== targetVal;
        return true;
    }
    /** S32: every check in the list must pass (AND). */
    function checkAll(checks) {
        if (!checks || !checks.length) return true;
        for (var i = 0; i < checks.length; i++) {
            var c = checks[i];
            if (c.type === 'switch') {
                if (!checkSwitch(c.id)) return false;
            } else if (c.type === 'var') {
                if (!checkExtraVar(c.id, c.op, c.val)) return false;
            }
        }
        return true;
    }

    function findBestMatch(list) {
        var val = $gameVariables.value(mainVarId);
        var candidates = list.filter(function(m) {
            if (m.mainVal !== val && m.mainVal !== -1) return false;
            if (!checkAll(m.checks)) return false;
            return true;
        });
        
        if (!candidates.length) return null;
        
        candidates.sort(function(a, b) {
            if (b.priority !== a.priority) return b.priority - a.priority;
            var aExact = (a.mainVal === val) ? 1 : 0;
            var bExact = (b.mainVal === val) ? 1 : 0;
            return bExact - aExact;
        });
        
        return candidates[0];
    }

    function pickMapping() { return findBestMatch(mappings); }
    function pickPose() { 
        if (!enablePoses) return null;
        return findBestMatch(poseMappings); 
    }

    function applyVisuals(mapping) {
        var config = {
            frames: mapping.sdsFrames,
            dirs: mapping.sdsDirs,
            stepMode: mapping.sdsStep,
            w: mapping.sdsW,
            h: mapping.sdsH,
            fps: mapping.sdsFps,
            patternMode: mapping.sdsPattern,
            idleIndex: mapping.sdsIdleIndex,
            idleAnimSpeed: mapping.sdsIdleAnimSpeed
        };

        if ($gamePlayer) {
            $gamePlayer._sdsConfig = config;
        }
        if (applyToActor) {
            var leader = $gameParty.leader();
            if (leader) leader._sdsConfig = config;
        }
    }

    function applyPoseConfig(pose) {
        var poseConfig = pose ? {
            gridX: pose.gridX,
            gridY: pose.gridY,
            w: pose.w,
            h: pose.h
        } : null;

        if ($gamePlayer) $gamePlayer._sdsPose = poseConfig;
        if (applyToActor) {
            var leader = $gameParty.leader();
            if (leader) leader._sdsPose = poseConfig;
        }
    }

    // --- State Machine ---
    var anim = { active: null, activePose: null, lock: false, manual: false, ticker: 0, idx: 0 };

    function startMapping(m) {
        anim.active = m;
        anim.lock = false;
        applyVisuals(m);

        if ($gamePlayer) $gamePlayer.resetPattern();

        if (m.manualIndexes && m.manualIndexes.length > 0) {
            anim.manual = true;
            anim.ticker = 0;
            anim.idx = 0;
            if ($gamePlayer) $gamePlayer._characterIndex = m.manualIndexes[0];
        } else {
            anim.manual = false;
        }
    }

    function updateCharacterGraphics() {
        if (!$gamePlayer) return;

        // Если активна поза - она диктует файл графики (если указан)
        if (anim.activePose) {
            var targetNamePose = anim.activePose.name !== "" ? anim.activePose.name : (anim.active && anim.active.name !== "" ? anim.active.name : $gamePlayer._characterName);
            // Если для позы указан новый файл, подставляем движку индекс 0, иначе сохраняем индекс от основного скина
            var targetIndexPose = anim.activePose.name !== "" ? 0 : (anim.active && anim.active.name !== "" ? (anim.manual ? anim.active.manualIndexes[anim.idx] : anim.active.index) : $gamePlayer._characterIndex);

            if ($gamePlayer.characterName() !== targetNamePose || $gamePlayer.characterIndex() !== targetIndexPose) {
                $gamePlayer.setImage(targetNamePose, targetIndexPose);
                if (applyToActor && $gameParty.leader()) $gameParty.leader().setCharacterImage(targetNamePose, targetIndexPose);
            }
        } 
        // Иначе обычная логика скинов
        else if (anim.active) {
            var targetName = anim.active.name !== "" ? anim.active.name : $gamePlayer._characterName;
            var targetIndex = anim.active.name !== "" ? (anim.manual ? anim.active.manualIndexes[anim.idx] : anim.active.index) : $gamePlayer._characterIndex;

            if ($gamePlayer.characterName() !== targetName || $gamePlayer.characterIndex() !== targetIndex) {
                $gamePlayer.setImage(targetName, targetIndex);
                if (applyToActor && $gameParty.leader()) $gameParty.leader().setCharacterImage(targetName, targetIndex);
            }
        }
    }

    function reevaluate() {
        if (!$gameVariables || anim.lock) return;
        
        var m = pickMapping();
        var p = pickPose();
        var changed = false;

        if (m && anim.active !== m) {
            startMapping(m);
            changed = true;
        }

        if (anim.activePose !== p) {
            anim.activePose = p;
            applyPoseConfig(p);
            changed = true;
        }

        if (changed) updateCharacterGraphics();
    }

    function checkSpecialSwitch(id, val) {
        if (anim.active && anim.active.sw3 === id && !val) {
            anim.lock = true;
            return true; 
        }
        return false;
    }

    // ======================================================================
    // ЧАСТЬ 2: ЛОГИКА NPC
    // ======================================================================

    var _Game_Event_setupPage = Game_Event.prototype.setupPage;
    Game_Event.prototype.setupPage = function() {
        _Game_Event_setupPage.call(this);
        this.setupSDS();
    };

    Game_Event.prototype.setupSDS = function() {
        this._sdsConfig = null;

        var data = this.event();
        if (!data || !data.meta) return;

        var configName = data.meta.sds;
        if (configName) {
            if (typeof configName === 'string') configName = configName.trim();
            else configName = String(configName);
            
            if (npcConfigs[configName]) {
                this._sdsConfig = npcConfigs[configName];
                this.resetPattern();
                log('Event ID ' + this.eventId() + ' applied config: ' + configName);
            }
        }
    };

    // ======================================================================
    // ЧАСТЬ 3: ДВИЖОК РЕНДЕРА
    // ======================================================================

    var _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function() {
        _Game_CharacterBase_initMembers.call(this);
        this._sdsConfig = null;
        this._sdsPose = null;
        this._sdsAnimTicker = 0; 
        this._sdsAnimDir = 1; // Для надежного пинг-понга
    };

    Game_CharacterBase.prototype.sdsFrames = function() { return (this._sdsConfig) ? this._sdsConfig.frames : 3; };
    Game_CharacterBase.prototype.sdsDirs = function() { return (this._sdsConfig) ? this._sdsConfig.dirs : 4; };

    var _Game_CharacterBase_hasStepAnime = Game_CharacterBase.prototype.hasStepAnime;
    Game_CharacterBase.prototype.hasStepAnime = function() {
        if (this._sdsPose) return false; // В позе нет анимации шага
        
        if (this._sdsConfig) {
            if (this._sdsConfig.stepMode === 1) return true;
            if (!this.isMoving() && this._sdsConfig.idleIndex >= 0 && this._sdsConfig.idleAnimSpeed !== 0) {
                return true;
            }
        }
        return _Game_CharacterBase_hasStepAnime.call(this);
    };

    var _Game_CharacterBase_characterIndex = Game_CharacterBase.prototype.characterIndex;
    Game_CharacterBase.prototype.characterIndex = function() {
        if (this._sdsPose) return this._characterIndex; // Поза сама перекрывает рендер, индекс движка не важен
        if (this._sdsConfig && this._sdsConfig.idleIndex >= 0 && !this.isMoving()) {
            return this._sdsConfig.idleIndex;
        }
        return _Game_CharacterBase_characterIndex.call(this);
    };

    var _Sprite_Character_patternWidth = Sprite_Character.prototype.patternWidth;
    Sprite_Character.prototype.patternWidth = function() {
        if (this._character._sdsPose) return this._character._sdsPose.w;
        if (this._character._sdsConfig && this._character._sdsConfig.w > 0) return this._character._sdsConfig.w;
        
        var frames = this._character.sdsFrames();
        if (frames !== 3) {
            if (this._isBigCharacter) {
                return this.bitmap.width / frames;
            } else {
                return this.bitmap.width / (frames * 4);
            }
        }
        return _Sprite_Character_patternWidth.call(this);
    };

    var _Sprite_Character_patternHeight = Sprite_Character.prototype.patternHeight;
    Sprite_Character.prototype.patternHeight = function() {
        if (this._character._sdsPose) return this._character._sdsPose.h;
        if (this._character._sdsConfig && this._character._sdsConfig.h > 0) return this._character._sdsConfig.h;
        return _Sprite_Character_patternHeight.call(this);
    };

    var _Sprite_Character_characterBlockX = Sprite_Character.prototype.characterBlockX;
    Sprite_Character.prototype.characterBlockX = function() {
        if (this._character._sdsPose) return 0;
        var frames = this._character.sdsFrames();
        if (frames !== 3) {
            if (this._isBigCharacter) return 0;
            var index = this._character.characterIndex();
            return (index % 4) * frames;
        }
        return _Sprite_Character_characterBlockX.call(this);
    };

    var _Sprite_Character_characterPatternX = Sprite_Character.prototype.characterPatternX;
    Sprite_Character.prototype.characterPatternX = function() {
        if (this._character._sdsPose) return 0;
        if (this._character._sdsConfig) {
            if (this._character.sdsFrames() !== 3) {
                return this._character.pattern();
            }
        }
        return _Sprite_Character_characterPatternX.call(this);
    };

    var _Sprite_Character_characterPatternY = Sprite_Character.prototype.characterPatternY;
    Sprite_Character.prototype.characterPatternY = function() {
        if (this._character._sdsPose) return 0;
        if (this._character._sdsConfig && this._character.sdsDirs() === 1) return 0;
        return _Sprite_Character_characterPatternY.call(this);
    };

    // --- V8.1 ЯДЕРНЫЙ ПЕРЕХВАТ РЕНДЕРА ПОЗЫ (Nuclear Override) ---
    var _Sprite_Character_updateCharacterFrame = Sprite_Character.prototype.updateCharacterFrame;
    Sprite_Character.prototype.updateCharacterFrame = function() {
        // Если активна ПОЗА - мы вырезаем точный кусок по X и Y и игнорируем RPG Maker полностью
        if (this._character._sdsPose) {
            var pw = this.patternWidth();
            var ph = this.patternHeight();
            
            var sx = this._character._sdsPose.gridX * pw;
            var sy = this._character._sdsPose.gridY * ph;
            
            this.updateHalfBodySprites();
            if (this._bushDepth > 0) {
                var d = this._bushDepth;
                if (this._upperBody && this._lowerBody) {
                    this._upperBody.setFrame(sx, sy, pw, ph - d);
                    this._lowerBody.setFrame(sx, sy + ph - d, pw, d);
                }
                this.setFrame(sx, sy, 0, ph);
            } else {
                this.setFrame(sx, sy, pw, ph);
            }
            return; // Выходим. Базовый код движка даже не запускается.
        }
        
        // Для обычных анимаций скинов пускаем по стандарту
        _Sprite_Character_updateCharacterFrame.call(this);
    };
    // --------------------------------------------------------

    Game_CharacterBase.prototype.updatePattern = function() {
        if (this._sdsPose) return; // Замораживаем анимацию во время рывков/действий

        if (!this.hasStepAnime() && this._stopCount > 0) {
            this.resetPattern();
        } else {
            if (!this._sdsConfig) {
                this._pattern = (this._pattern + 1) % this.maxPattern();
                return;
            }

            var frames = this.sdsFrames();
            var mode = this._sdsConfig.patternMode;
            
            var isPlayer = (this === $gamePlayer);
            var oldPattern = this._pattern;
            var oldDir = this._sdsAnimDir;

            if (this._sdsAnimDir === undefined) {
                this._sdsAnimDir = 1;
            }

            // РЕЖИМ 2: Специальный "Ритмичный" режим для 4-кадровых (Шаги по краям)
            if (mode === 2 && frames === 4) {
                if (this._sdsAnimTicker === undefined) this._sdsAnimTicker = 0;
                this._sdsAnimTicker++;
                var seq = [1, 3, 2, 0];
                this._pattern = seq[this._sdsAnimTicker % 4];
            } 
            // РЕЖИМ 1: Пинг-понг (Туда-сюда). Строго +1/-1 без таймеров
            else if (mode === 1 || (frames === 3 && mode !== 2)) {
                // Защита от смены скина с большим кол-вом кадров на меньшее
                if (this._pattern >= frames) this._pattern = frames - 1;
                
                if (this._sdsAnimDir === 1) {
                    this._pattern++;
                    if (this._pattern >= frames - 1) {
                        this._pattern = frames - 1;
                        this._sdsAnimDir = -1;
                    }
                } else {
                    this._pattern--;
                    if (this._pattern <= 0) {
                        this._pattern = 0;
                        this._sdsAnimDir = 1;
                    }
                }
            } 
            // РЕЖИМ 0: По кругу (Loop).
            else { 
                this._pattern = (this._pattern + 1) % frames;
            }

            if (isPlayer && debug) {
                log("UPDATE_PATTERN | Frame: " + oldPattern + " -> " + this._pattern + " | Dir: " + oldDir + " -> " + this._sdsAnimDir + " | Mode: " + mode);
            }
        }
    };

    Game_CharacterBase.prototype.resetPattern = function() {
        if (this._sdsPose) return;
        
        var isPlayer = (this === $gamePlayer);
        var oldPattern = this._pattern;

        // Визуально возвращаем персонажа в кадр простоя
        if (this._sdsConfig && this._sdsConfig.idleIndex >= 0) {
            this._pattern = this._sdsConfig.idleIndex;
        } else {
            this._pattern = 1; 
        }
        
        if (isPlayer && debug) {
            log("RESET_PATTERN | Forced Frame: " + oldPattern + " -> " + this._pattern + " | Saved Dir: " + this._sdsAnimDir);
        }
        
        // Не сбрасываем this._sdsAnimDir, чтобы следующий шаг 
        // плавно продолжил начатое движение с нужной ноги.
    };

    Game_CharacterBase.prototype.maxPattern = function() {
        return this._sdsConfig ? this.sdsFrames() : 4; 
    };
    
    Game_CharacterBase.prototype.pattern = function() {
        if (this._sdsPose) return 0;
        if (this._sdsConfig) {
            return this._pattern < this.sdsFrames() ? this._pattern : 0;
        }
        return this._pattern < 3 ? this._pattern : 1; 
    };

    var _Game_CharacterBase_animationWait = Game_CharacterBase.prototype.animationWait;
    Game_CharacterBase.prototype.animationWait = function() {
        if (this._sdsPose) return 1000; // Поза заморожена

        if (this._sdsConfig) {
            if (!this.isMoving() && this._sdsConfig.idleIndex >= 0 && this._sdsConfig.idleAnimSpeed > 0) {
                return 60 / this._sdsConfig.idleAnimSpeed;
            }

            if (this._sdsConfig.fps > 0) {
                var baseInterval = 60 / this._sdsConfig.fps;
                
                if (this.isMoving()) {
                    return baseInterval * 1.5; 
                } else {
                    return baseInterval;
                }
            }
        }
        
        var base = _Game_CharacterBase_animationWait.call(this);
        if (this.sdsFrames() > 3) {
            return base - (this.sdsFrames() * 0.8);
        }
        return base;
    };

    // ======================================================================
    // ЧАСТЬ 4: ХУКИ
    // ======================================================================

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        updateManualAnim();
    };

    function updateManualAnim() {
        if (!anim.active || !anim.manual || !$gamePlayer) return;
        
        anim.ticker++;
        if (anim.ticker >= anim.active.manualDelay) {
            anim.ticker = 0;
            anim.idx = (anim.idx + 1) % anim.active.manualIndexes.length;
            var newIndex = anim.active.manualIndexes[anim.idx];
            
            if (!anim.activePose && $gamePlayer.characterIndex() !== newIndex) {
                var cName = anim.active.name !== "" ? anim.active.name : $gamePlayer.characterName();
                $gamePlayer._characterIndex = newIndex;
                $gamePlayer._characterName = cName;
                
                if (applyToActor) {
                    var leader = $gameParty.leader();
                    if (leader) {
                        leader._characterIndex = newIndex;
                        leader._characterName = cName;
                    }
                }
            }
            
            if (anim.idx === 0 && anim.lock) {
                anim.lock = false;
                reevaluate();
            }
        }
    }

    var _Game_Player_refresh = Game_Player.prototype.refresh;
    Game_Player.prototype.refresh = function() {
        _Game_Player_refresh.call(this);

        if (!anim.active && $gameVariables && $gameVariables.value(mainVarId) !== undefined) {
            var m = pickMapping();
            if (m) {
                anim.active = m;
                anim.lock = false;
                this._sdsConfig = {
                    frames: m.sdsFrames,
                    dirs: m.sdsDirs,
                    stepMode: m.sdsStep,
                    w: m.sdsW,
                    h: m.sdsH,
                    fps: m.sdsFps,
                    patternMode: m.sdsPattern,
                    idleIndex: m.sdsIdleIndex,
                    idleAnimSpeed: m.sdsIdleAnimSpeed
                };
            }
        }

        updateCharacterGraphics();
    };

    var _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function(id, value) {
        _Game_Variables_setValue.call(this, id, value);
        if (watchedVars.indexOf(id) !== -1) reevaluate();
    };

    var _Game_Switches_setValue = Game_Switches.prototype.setValue;
    Game_Switches.prototype.setValue = function(id, value) {
        _Game_Switches_setValue.call(this, id, value);
        if (!checkSpecialSwitch(id, value)) reevaluate();
    };

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        reevaluate();
    };

    // Test seam (S32): expose the pure matching core for unit tests.
    try {
        var _export = { findBestMatch: findBestMatch, pickMapping: pickMapping, pickPose: pickPose, watchedVars: watchedVars, normalizeChecks: normalizeChecks };
        if (typeof module !== 'undefined' && module.exports) module.exports = _export;
        if (typeof window !== 'undefined' && !window.__SDS_TEST) window.__SDS_TEST = _export;
    } catch (e) { /* runtime never lands here */ }

})();