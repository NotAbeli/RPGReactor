/*:
 * @plugindesc [RU] v12.5.0 Super Duper Enemies. Ультимативный Движок Правил ИИ (Optimized).
 * @author Korolev
 *
 * @help
 * ============================================================================
 * SUPER DUPER ENEMIES (ULTIMATE RULE ENGINE v12.5.0)
 * ============================================================================
 * Этот плагин полностью построен на гибридной системе правил.
 * Вы сами конструируете логику. Вы можете создавать любые свои флаги 
 * или перенастраивать системные (combat, calm, panic, zona, hearing).
 *
 * ============================================================================
 * ГИБРИДНЫЙ РЕЖИМ (ПРАВИЛО ПЕРЕОПРЕДЕЛЕНИЯ)
 * ============================================================================
 * По умолчанию плагин использует старую "классическую" логику для всех
 * системных флагов (combat включается от zona, calm включается по таймеру,
 * panic выключается по таймерам).
 * * НО! Как только вы создаете кастомное правило с Именем системного флага 
 * (например, создаете правило "combat"), старая логика для него ПОЛНОСТЬЮ 
 * ОТКЛЮЧАЕТСЯ. Теперь этот флаг работает только по вашим правилам.
 * Системные флаги, для которых вы не создали правил, продолжат работать как раньше.
 *
 * ============================================================================
 * СЕНСОРЫ (ВШИТЫЕ ФЛАЖКИ - ИСПОЛЬЗУЙТЕ ИХ КАК УСЛОВИЯ)
 * ============================================================================
 * - zona          : Игрок находится в радиусе атаки (Attack Radius).
 * - contact       : Прямой зрительный контакт (Raycasting без стен).
 * - hearing       : Игрок шумит в радиусе слуха (Шум >= Порога).
 * - light_actual  : Враг/Игрок в фактической зоне света.
 * - light_tangent : Враг/Игрок в касательной зоне света.
 * - light_bright  : Враг/Игрок в яркой зоне света.
 * - scope         : Включен глобальный переключатель прицеливания (18).
 * - gun           : В руках дальнобойное оружие (настройки Gun Condition).
 * - melee         : В руках оружие ближнего боя (настройки Melee Condition).
 * - dead          : HP врага меньше или равно 0.
 *
 * ============================================================================
 * ПРОДВИНУТАЯ ЛОГИКА "ИЛИ" (|) В УСЛОВИЯХ:
 * ============================================================================
 * В поле "Условия Флагов" вы можете использовать знак трубы "|" (ИЛИ).
 * Запятая (,) работает как И. Знак трубы (|) разбивает условия на блоки.
 * * Пример: zona, contact | hearing, !light_bright
 * Расшифровка: Активировать флаг, если:
 * (В зоне атаки И видит) ИЛИ (Слышит И НЕ на ярком свете).
 *
 * ============================================================================
 * ПЛАГИН-КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ:
 * ============================================================================
 * SDE SET_FLAG [EventID] [FlagName] [ON/OFF]  - Жестко включить/выкл флаг.
 * SDE RESET_ALL [EventID]                     - Сбросить все флаги события.
 * Пример: SDE SET_FLAG SELF panic ON
 *
 * @param EnemyDatabase
 * @text База Врагов
 * @type struct<EnemyDef>[]
 * @default []
 *
 * @param Optimization
 * @text --- Оптимизация ---
 * @default 
 *
 * @param TickRate
 * @parent Optimization
 * @text Tick Rate (Кадры)
 * @desc Как часто обновлять логику ИИ. 1 = каждый кадр, 3 = раз в 3 кадра (Оптимально).
 * @type number
 * @min 1
 * @default 3
 *
 * @param VariableBaseId
 * @parent Optimization
 * @text Variable Base ID
 * @desc Стартовый ID переменной для хранения локальных HP.
 * @type variable
 * @default 1000
 *
 * @param GlobalSettings
 * @text --- Глобальные Настройки ---
 * @default
 *
 * @param HearingVariable
 * @parent GlobalSettings
 * @text Переменная Шума
 * @desc ID переменной для уровня шума от игрока.
 * @type variable
 * @default 0
 *
 * @param GunCondition
 * @parent GlobalSettings
 * @text Глобальное Оружие (Gun)
 * @desc Условия активации базового сенсора дальнего боя 'gun'.
 * @type struct<WeaponConfig>
 * @default {"switchId":"30","variableId":"0","variableValues":""}
 *
 * @param MeleeCondition
 * @parent GlobalSettings
 * @text Глобальное Оружие (Melee)
 * @desc Условия активации базового сенсора ближнего боя 'melee'.
 * @type struct<WeaponConfig>
 * @default {"switchId":"0","variableId":"0","variableValues":""}
 *
 * @param NoCombatSwitch
 * @parent GlobalSettings
 * @text Переключатель "Вне Боя"
 * @desc Включается, когда на карте ни у кого нет флага 'combat'.
 * @type switch
 * @default 0
 *
 * @param CombatCountVariable
 * @parent GlobalSettings
 * @text Переменная "Счетчик Боя"
 * @desc Хранит количество врагов с активным флагом 'combat'.
 * @type variable
 * @default 0
 *
 * @param GlobalResetSwitch
 * @parent GlobalSettings
 * @text Переключатель "Глобальный Сброс"
 * @desc При включении принудительно сбрасывает ИИ всех врагов на карте.
 * @type switch
 * @default 0
 */

/*~struct~EnemyDef:
 * @param id
 * @text EnemyID
 * @default
 *
 * @param match
 * @text Match (Текст в заметках)
 * @desc Текст в заметке события, чтобы привязать эту логику.
 * @default
 *
 * @param hp
 * @text Макс. HP
 * @type number
 * @min 1
 * @default 100
 *
 * @param scope
 * @text Тип памяти (Scope)
 * @desc Global запоминает состояние и HP даже при уходе с карты.
 * @type select
 * @option global
 * @option local
 * @default local
 *
 * @param --- Базовые Сенсоры ---
 * @default
 *
 * @param attackRadius
 * @parent --- Базовые Сенсоры ---
 * @text Радиус Атаки (zona)
 * @desc Дистанция для активации сенсора 'zona' (в клетках).
 * @type number
 * @min 0
 * @default 0
 *
 * @param calmRadius
 * @parent --- Базовые Сенсоры ---
 * @text Радиус Покоя (calm)
 * @desc Дистанция, при которой враг успокаивается, если потерял вас.
 * @type number
 * @min 0
 * @default 0
 *
 * @param calmTime
 * @parent --- Базовые Сенсоры ---
 * @text Время до покоя (кадры)
 * @desc Таймер для автоматического включения флага calm.
 * @type number
 * @min 0
 * @default 180
 *
 * @param hearingRadius
 * @parent --- Базовые Сенсоры ---
 * @text Радиус Слуха (hearing)
 * @desc Дистанция для активации сенсора 'hearing'.
 * @type number
 * @min 0
 * @default 0
 *
 * @param hearingThreshold
 * @parent --- Базовые Сенсоры ---
 * @text Порог Шума
 * @desc Сколько шума должен издать игрок, чтобы включить 'hearing'.
 * @type number
 * @min 0
 * @default 10
 *
 * @param panicContactTime
 * @parent --- Базовые Сенсоры ---
 * @text Таймер паники (Контакт)
 * @desc Таймер выключения паники без контакта.
 * @type number
 * @min 0
 * @default 180
 *
 * @param panicTotalTime
 * @parent --- Базовые Сенсоры ---
 * @text Общий таймер паники
 * @desc Максимальное время длительности паники.
 * @type number
 * @min 0
 * @default 300
 *
 * @param customRules
 * @text Правила Логики ИИ (Rules)
 * @desc Конструктор поведений. Создав здесь флаг (напр. calm), вы перепишете его системную логику.
 * @type struct<CustomFlagRule>[]
 * @default []
 */

/*~struct~CustomFlagRule:
 * @param flag
 * @text Имя Флага (Результат)
 * @desc Имя флага, который включится (например: combat, panic, hungry).
 * @type text
 * @default my_flag
 *
 * @param conditions
 * @text Условия Флагов (Сенсоров)
 * @desc Список флагов. Запятая = И, знак трубы (|) = ИЛИ. Пример: zona, contact | hearing
 * @type text
 * @default 
 *
 * @param activationDelay
 * @text Задержка включения (кадры)
 * @desc Сколько кадров (тиков) условия должны непрерывно выполняться для включения.
 * @type number
 * @min 0
 * @default 0
 *
 * @param holdTime
 * @text Время удержания (кадры)
 * @desc Сколько кадров флаг останется ВКЛЮЧЕННЫМ после потери условий (Задержка выключения).
 * @type number
 * @min 0
 * @default 0
 *
 * @param moveSpeed
 * @text Скорость (Move Speed)
 * @desc Скорость во время действия флага. Можно дробную (напр. 3.5). 0 = не менять.
 * @type number
 * @decimals 2
 * @min 0
 * @default 0
 *
 * @param hpMinPct
 * @text Мин. Порог HP (%)
 * @desc 0 = выкл. Флаг включится только если HP больше или равно этому %.
 * @type number
 * @max 100
 * @default 0
 *
 * @param hpMaxPct
 * @text Макс. Порог HP (%)
 * @desc 0 = выкл. Флаг включится только если HP меньше или равно этому %.
 * @type number
 * @max 100
 * @default 0
 *
 * @param reqSwitch
 * @text Требуемый Переключатель
 * @type switch
 * @default 0
 *
 * @param reqVarId
 * @text Требуемая Переменная
 * @type variable
 * @default 0
 *
 * @param reqVarVal
 * @text Значение Переменной >=
 * @type number
 * @default 0
 */

/*~struct~WeaponConfig:
 * @param switchId
 * @text Switch ID
 * @desc ID переключателя. Если включен -> Оружие в руках. (0 = откл)
 * @type switch
 * @default 0
 *
 * @param variableId
 * @text Variable ID
 * @desc ID переменной (напр. ID экипированного оружия). (0 = откл)
 * @type variable
 * @default 0
 *
 * @param variableValues
 * @text Список ID Оружия
 * @desc ID через запятую (точное совпадение). Пример: 1, 5, 12
 * @type text
 * @default 
 */

(function(){
  'use strict';
  
  var pluginName = 'SuperDuperEnemies';
  
  var params = PluginManager.parameters(pluginName) || {};
  if (Object.keys(params).length === 0) params = PluginManager.parameters('SuperDuperEnemiesHPDB') || {};
  if (Object.keys(params).length === 0) params = PluginManager.parameters('MapEnemiesHPDB') || {};

  var MEHP_DB = [];
  try {
    if (params['EnemyDatabase']) {
      var arr = JSON.parse(params['EnemyDatabase']);
      MEHP_DB = arr.map(function(e){ 
          var parsed = JSON.parse(e);
          if (parsed.customRules) {
              var rulesArr = JSON.parse(parsed.customRules);
              parsed.parsedRules = rulesArr.map(function(r) { 
                  var rule = JSON.parse(r);
                  rule.activationDelay = Number(rule.activationDelay || 0);
                  rule.holdTime = Number(rule.holdTime || 0);
                  rule.moveSpeed = Number(rule.moveSpeed || 0);
                  rule.hpMinPct = Number(rule.hpMinPct || 0);
                  rule.hpMaxPct = Number(rule.hpMaxPct || 0);
                  rule.reqSwitch = Number(rule.reqSwitch || 0);
                  rule.reqVarId = Number(rule.reqVarId || 0);
                  rule.reqVarVal = Number(rule.reqVarVal || 0);
                  rule.conditions = rule.conditions ? rule.conditions.trim() : '';
                  
                  // ОПТИМИЗАЦИЯ: Предварительный парсинг строковых условий (Pre-parsing)
                  rule.parsedConditions = [];
                  if (rule.conditions) {
                      var orGroups = rule.conditions.split('|');
                      for (var o = 0; o < orGroups.length; o++) {
                          var andConds = orGroups[o].split(',');
                          var group = [];
                          for (var c = 0; c < andConds.length; c++) {
                              var cName = andConds[c].trim().toLowerCase();
                              if (!cName) continue;
                              var negated = false;
                              if (cName.charAt(0) === '!') {
                                  negated = true;
                                  cName = cName.substring(1).trim();
                              }
                              group.push({ type: cName, negated: negated });
                          }
                          if (group.length > 0) rule.parsedConditions.push(group);
                      }
                  }
                  rule.flagClean = rule.flag ? rule.flag.toLowerCase().trim() : '';
                  
                  return rule;
              });
          } else {
              parsed.parsedRules = [];
          }
          return parsed;
      });
    }
  } catch(e){ console.error("SDE: Error parsing DB", e); }

  // --- Global Configs ---
  function parseWeaponConfig(paramString, defaultSwitch) {
      var config = { switchId: defaultSwitch, variableId: 0, variableValues: [] };
      try {
          if (paramString) {
              var gc = JSON.parse(paramString);
              config.switchId = Number(gc.switchId || defaultSwitch);
              config.variableId = Number(gc.variableId || 0);
              if (gc.variableValues && gc.variableValues.trim() !== '') {
                  config.variableValues = gc.variableValues.split(',').map(function(n) { return Number(n.trim()); });
              } else if (gc.variableValue) { 
                  config.variableValues = [Number(gc.variableValue)];
              }
          }
      } catch(e) { console.error("SDE: Error parsing WeaponConfig", e); }
      return config;
  }

  var gunConfig = parseWeaponConfig(params['GunCondition'], 30);
  var meleeConfig = parseWeaponConfig(params['MeleeCondition'], 0);

  var hearingVariable = Number(params['HearingVariable'] || 0);
  var noCombatSwitch = Number(params['NoCombatSwitch'] || 0);
  var combatCountVariable = Number(params['CombatCountVariable'] || 0);
  var globalResetSwitch = Number(params['GlobalResetSwitch'] || 0);
  
  var TICK_RATE = Math.max(1, Number(params['TickRate'] || 3));
  var VARIABLE_BASE_ID = Number(params['VariableBaseId'] || 1000);

  // Списки системных флагов
  var AUTO_SENSORS = ['dead', 'zona', 'hearing', 'contact', 'light_actual', 'light_tangent', 'light_bright', 'scope', 'gun', 'melee'];
  var CLASSIC_FLAGS = ['calm', 'combat', 'warning', 'panic', 'shot', 'loch'];
  
  var VALID_FLAGS = new Set([
      'dead', 'ondeath', 'zona', 'hearing', 'contact', 
      'light_actual', 'light_tangent', 'light_bright', 
      'combat', 'calm', 'alert', 'scope', 'gun', 'melee', 'warning', 
      'shot', 'loch', 'panic', 'remembergun', 'wound', 'flee'
  ]);

  for (var i = 0; i < MEHP_DB.length; i++) {
      var rules = MEHP_DB[i].parsedRules;
      if (rules) {
          for (var j = 0; j < rules.length; j++) {
              if (rules[j].flagClean) VALID_FLAGS.add(rules[j].flagClean);
          }
      }
  }

  // ===========================================================================
  // ДАННЫЕ И СОСТОЯНИЯ
  // ===========================================================================
  
  var _eventData = {};
  var _eventVariables = {};
  var _pageConditionCache = new Map(); 

  function findRuleByNote(note){
    if (!note) return null;
    for (var i=0;i<MEHP_DB.length;i++){
      var rule = MEHP_DB[i];
      if (rule.match && note.indexOf(rule.match) >= 0) return rule;
    }
    return null;
  }

  function getEventData(mapId, eventId) {
    if (!eventId) return null;
    var key = mapId + '_' + eventId;
    return _eventData[key] || null;
  }

  function createEventData(mapId, eventId, rule) {
    var key = mapId + '_' + eventId;
    if (_eventData[key]) return _eventData[key];
    
    // Предварительно кэшируем массив имен кастомных флагов
    var cNames = [];
    if (rule.parsedRules) {
        for (var i = 0; i < rule.parsedRules.length; i++) {
            if (rule.parsedRules[i].flagClean) cNames.push(rule.parsedRules[i].flagClean);
        }
    }

    _eventData[key] = {
        hp: Number(rule.hp) || 100,
        maxHp: Number(rule.hp) || 100,
        enemyId: rule.id,
        mapId: mapId,
        eventId: eventId,
        scope: rule.scope || 'local',
        
        attackRadius: Number(rule.attackRadius) || 0,
        hearingRadius: Number(rule.hearingRadius) || 0,
        hearingThreshold: (rule.hearingThreshold !== undefined && rule.hearingThreshold !== '') ? Number(rule.hearingThreshold) : 10,
        
        calmRadius: Number(rule.calmRadius) || 0,
        calmTime: Number(rule.calmTime) || 180,
        panicContactTime: Number(rule.panicContactTime) || 180,
        panicTotalTime: Number(rule.panicTotalTime) || 300,
        
        flags: { dead: false },
        timers: {},
        activationTimers: {}, 
        manualFlags: {}, 
        baseMoveSpeed: 0, 
        
        calmTimer: 0,
        calmCounting: false,
        calmCanActivate: true,
        panicContactTimer: 0,
        panicTotalTimer: 0,
        shotTimer: 0,
        lochTimer: 0,
        
        customRules: rule.parsedRules || [],
        customFlagNames: cNames // ОПТИМИЗАЦИЯ: Предкэшированный массив имен
    };
    return _eventData[key];
  }

  function updateHP(mapId, evId, newHP) {
    var entry = getEventData(mapId, evId);
    if (!entry) return false;
    
    var wasDead = !!entry.flags['dead'];
    entry.hp = Math.max(0, newHP);
    entry.flags['dead'] = (entry.hp <= 0);
    
    if (entry.scope === 'global') {
        syncGlobalEnemies(mapId, entry.enemyId, entry.hp, entry.flags['dead']);
    }
    
    if (entry.flags['dead']) {
        entry.flags = { dead: true };
        entry.timers = {};
        entry.activationTimers = {};
        entry.manualFlags = {};
    }
    
    if (wasDead !== !!entry.flags['dead']) {
        updateEventDisplay(evId);
        CentralizedManager.updateCombatTracking();
    }
    
    if (entry.hp <= 0) CentralizedManager.unregister(evId);
    return true;
  }

  function syncGlobalEnemies(mapId, enemyId, hp, dead) {
    CentralizedManager._registeredObjects.forEach(function(obj) {
        var data = getEventData(mapId, obj.eventId);
        if (data && data.enemyId === enemyId && data.scope === 'global') {
            data.hp = hp;
            data.flags['dead'] = dead;
            if (dead) {
                data.flags = { dead: true };
                data.timers = {};
                data.activationTimers = {};
                data.manualFlags = {};
            }
            updateEventDisplay(obj.eventId);
        }
    });
  }

  // ===========================================================================
  // P2: ШАБЛОНЫ ВРАГОВ — компиляция 17-страничного скелета из карточки БД
  // ===========================================================================
  // Карточка EnemyDatabase с template='true' разворачивается в полный
  // поведенческий автомат (скелет «бибы» с карты «тест боевки», ивент 12):
  // покой -> тревога -> выстрел/бой -> паника/погоня -> бегство -> атака
  // рывком -> раны -> смерть. На карте лежит заглушка: событие с note-тегом
  // карточки и одной страницей; страницы генерируются на setup карты
  // (идемпотентно: $dataMap каждый раз перечитывается с диска, скелет
  // пересобирается с чистого листа; порядок страниц фиксирован, поэтому
  // селф-свитчи A/B/C/D в сейвах выживают).

  function _sdeNum(v, dflt) { var n = Number(v); return isFinite(n) ? n : dflt; }
  function _sdeTplString(v, dflt) { return (v === undefined || v === null || v === '') ? dflt : String(v); }

  function _sdeCmd(code, indent, parameters) {
      return { code: code, indent: indent, parameters: parameters || [] };
  }
  function _sdeCond(selfCh, selfValid) {
      return { actorId: 1, actorValid: false, itemId: 1, itemValid: false,
          selfSwitchCh: selfCh, selfSwitchValid: selfValid,
          switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
          variableId: 1, variableValid: false, variableValue: 0 };
  }
  function _sdeImg(tpl, empty) {
      if (empty) return { characterIndex: 0, characterName: '', direction: 2, pattern: 0, tileId: 0 };
      return { tileId: 0, characterName: _sdeTplString(tpl.spriteName, 'Enemy 1'),
          direction: 2, pattern: 1, characterIndex: _sdeNum(tpl.spriteIndex, 0) };
  }
  function _sdeRoute(items) {
      return { list: items, repeat: true, skippable: false, wait: false };
  }
  function _sdeMr(code, params, indent) {
      var o = { code: code, indent: (indent === undefined ? null : indent) };
      if (params) o.parameters = params;
      return o;
  }
  function _sdeMrEnd() { return { code: 0, parameters: [] }; }
  function _sdePage(o) {
      return {
          conditions: o.cond, directionFix: !!o.dirFix, image: o.image,
          list: o.list, moveFrequency: o.freq, moveRoute: _sdeRoute(o.route || [{ code: 0, parameters: [] }]),
          moveSpeed: o.speed, moveType: o.moveType, priorityType: o.prio,
          stepAnime: false, through: false, trigger: o.trigger, walkAnime: true
      };
  }
  function _sdeColliderComments(tpl) {
      var inner = _sdeTplString(tpl.collider, "<circle cx='0.5' cy='0.7' r='0.25' />");
      return [
          _sdeCmd(108, 0, ['<collider>']),
          _sdeCmd(408, 0, ['interaction: ' + inner]),
          _sdeCmd(408, 0, ['</collider> '])
      ];
  }
  function _sdeTagCmd(tag) { return _sdeCmd(108, 0, [tag]); }
  function _sdeEnd(indent) { return _sdeCmd(0, indent || 0, []); }

  /**
   * Скелет бибы: 17 страниц. Параметры шаблона подставляются в спрайт,
   * коллайдер, атаки (трассер/меле/рывок), пороги погони/приседания и
   * таблицу урона (стр. 14).
   */
  function sdeBuildEnemyPages(tpl) {
      var tracer = _sdeNum(tpl.tracerId, 1);
      var melee = _sdeNum(tpl.meleeId, 2);
      // Три-стейт: undefined/null -> дефолт «РывокВрага», '' -> БЕЗ рывка.
      var dashName = (tpl.dashName === undefined || tpl.dashName === null) ? 'РывокВрага' : String(tpl.dashName);
      var chase = _sdeNum(tpl.chaseThreshold, 2);
      var cower = _sdeNum(tpl.cowerThreshold, 3);
      var dmgMeleeVar = _sdeNum(tpl.damageMeleeVar, 2);
      var dmgGunVar = _sdeNum(tpl.damageGunVar, 37);
      var dmgMelee = _sdeNum(tpl.damageMelee, -100);
      var dmgFists = _sdeNum(tpl.damageFists, -20);
      var seName = _sdeTplString(tpl.damageSE, 'Damage2');
      var sneak = _sdeTplString(tpl.sneakKill, 'true') === 'true' ? 0 : 1;
      var se = function () { return _sdeCmd(250, 2, [{ name: seName, volume: 90, pitch: 100, pan: 0 }]); };

      // S52: поведенческий конструктор — характер, способности, скорости.
      // Дефолты воспроизводят эталонный скелет бибы бит-в-бит.
      var peaceful = _sdeTplString(tpl.disposition, 'aggressive') === 'peaceful';
      var canPanic = _sdeTplString(tpl.canPanic, 'true') === 'true';
      var rememberGun = _sdeTplString(tpl.rememberGun, 'true') === 'true';
      var canFlee = _sdeTplString(tpl.canFlee, 'true') === 'true';
      var speedCalm = _sdeNum(tpl.speedCalm, 3);
      var speedCombat = _sdeNum(tpl.speedCombat, 4);
      // Атакная страница P12 нужна только злому и только с хоть какой-то атакой.
      var hasAttack = !peaceful && (dashName !== '' || melee > 0);

      var chaseRoute = function () {
          // 205: шаг вперёд + погоня за игроком (wait)
          return [_sdeCmd(205, 1, [0, {
              list: [{ code: 36, indent: null }, { code: 45, parameters: ['this.smartMoveToPlayer()'], indent: null }, { code: 0 }],
              repeat: false, skippable: false, wait: true
          }]), _sdeCmd(505, 1, [{ code: 36, indent: null }]),
          _sdeCmd(505, 1, [{ code: 45, parameters: ['this.smartMoveToPlayer()'], indent: null }]),
          _sdeEnd(1)];
      };

      var pages = [];

      // P0: покой — стелс-детектор игрока в маршруте
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 4,
          speed: speedCalm, moveType: 3, prio: 1, trigger: 0,
          list: [_sdeTagCmd('<projEffect>')].concat(_sdeColliderComments(tpl), [_sdeEnd()]),
          route: [_sdeMr(45, ["this.YurStealth(8, 'A')"]), _sdeMrEnd()] }));

      // P1: тревога (услышал шум)
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 4,
          speed: speedCalm, moveType: 3, prio: 1, trigger: 0,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Warning>')]
              .concat(_sdeColliderComments(tpl), [_sdeEnd()]),
          route: [_sdeMr(9), _sdeMr(45, ["this.YurStealth(8, 'A')"]), _sdeMrEnd()] }));

      // P2: (A) выстрел трассером, лач A — только злому с трассером
      if (!peaceful && tracer > 0) {
      pages.push(_sdePage({ cond: _sdeCond('A', true), image: _sdeImg(tpl), freq: 5,
          speed: speedCalm, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>')].concat(_sdeColliderComments(tpl), [
              _sdeCmd(355, 0, ['this.performTracer(' + tracer + ');']),
              _sdeCmd(123, 0, ['A', 1]), _sdeEnd()]),
          route: [_sdeMr(15, [40]), _sdeMr(9), _sdeMrEnd()] }));
      }

      // P3: (C) принудительный бой (без projEffect — как в оригинале)
      pages.push(_sdePage({ cond: _sdeCond('C', true), image: _sdeImg(tpl), freq: 1,
          speed: speedCalm, moveType: 3, prio: 1, trigger: 4,
          list: _sdeColliderComments(tpl).concat([_sdeCmd(721, 0, ['combat', 1]), _sdeEnd()]),
          route: [_sdeMr(25), _sdeMr(15, [60]), _sdeMrEnd()] }));

      // P4: <Shot> — по нему выстрелили
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Shot>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(721, 0, ['loch', 0]), _sdeCmd(721, 0, ['combat', 1]), _sdeCmd(721, 0, ['shot', 0]), _sdeEnd()]),
          route: [_sdeMr(45, ['this.smartMoveToPlayer()']), _sdeMrEnd()] }));

      // P5: <Combat> — вход в бой: лач C + заморозка
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 3, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Combat>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(123, 0, ['C', 1]), _sdeCmd(112, 0, []), _sdeCmd(230, 1, [999]),
                  _sdeEnd(1), _sdeCmd(413, 0, []), _sdeEnd()]),
          route: [_sdeMr(45, ['this.smartMoveToPlayer()']), _sdeMrEnd()] }));

      // P6: <Panic>+<Combat>+<Gun>+<!Loch> — паника: погоня при >= chase
      if (canPanic) {
      pages.push(_sdePage({ cond: _sdeCond('A', false), dirFix: true, image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Condition: AND>'), _sdeTagCmd('<Panic>'),
              _sdeTagCmd('<Combat>'), _sdeTagCmd('<Gun>'), _sdeTagCmd('<!Loch>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(111, 0, [1, 59, 0, chase, 1])], chaseRoute(), [
                  _sdeCmd(412, 0, []), _sdeEnd()]),
          route: [_sdeMr(45, ['this.smartMoveToPlayer()']), _sdeMrEnd()] }));

      // P7: <Contact>+<Scope>+<Combat>+<Gun>+<!Loch> — видит прицел: паника,
      // погоня при >= cower, иначе прячется
      pages.push(_sdePage({ cond: _sdeCond('A', false), dirFix: true, image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Condition: AND>'), _sdeTagCmd('<Contact>'),
              _sdeTagCmd('<Scope>'), _sdeTagCmd('<Combat>'), _sdeTagCmd('<Gun>'), _sdeTagCmd('<!Loch>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(721, 0, ['panic', 1]), _sdeCmd(111, 0, [1, 59, 0, cower, 1])],
                  chaseRoute(), [
                  _sdeCmd(411, 0, []), _sdeCmd(205, 1, [0, {
                      list: [{ code: 25, indent: 0 }, { code: 35, indent: 0 },
                          { code: 15, parameters: [20], indent: 0 }, { code: 11, indent: 0 },
                          { code: 15, parameters: [20], indent: null }, { code: 0 }],
                      repeat: false, skippable: false, wait: true
                  }]),
                  _sdeCmd(505, 1, [{ code: 25, indent: 0 }]), _sdeCmd(505, 1, [{ code: 35, indent: 0 }]),
                  _sdeCmd(505, 1, [{ code: 15, parameters: [20], indent: 0 }]), _sdeCmd(505, 1, [{ code: 11, indent: 0 }]),
                  _sdeCmd(505, 1, [{ code: 15, parameters: [20], indent: null }]), _sdeEnd(1),
                  _sdeCmd(412, 0, []), _sdeEnd()]),
          route: [{ code: 0, parameters: [] }] }));
      }

      // P8: <RememberGun>+<Combat>+<Gun> — запомнил ствол: бегство
      if (rememberGun) {
      pages.push(_sdePage({ cond: _sdeCond('A', false), dirFix: true, image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 3, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Condition: AND>'), _sdeTagCmd('<RememberGun> '),
              _sdeTagCmd('<Combat>'), _sdeTagCmd('<Gun>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(721, 0, ['flee', 1]), _sdeCmd(111, 0, [1, 59, 0, cower, 1]),
                  _sdeCmd(205, 1, [0, {
                      list: [{ code: 36, indent: null }, { code: 10, indent: null }, { code: 0 }],
                      repeat: false, skippable: false, wait: true
                  }]),
                  _sdeCmd(505, 1, [{ code: 36, indent: null }]), _sdeCmd(505, 1, [{ code: 10, indent: null }]),
                  _sdeEnd(1), _sdeCmd(411, 0, []), _sdeEnd(1), _sdeCmd(412, 0, []), _sdeEnd()]),
          route: [_sdeMr(25, null, 0), _sdeMr(35), _sdeMr(15, [20], 0), _sdeMr(11), _sdeMrEnd()] }));
      }

      // P9: <Combat>+<Shot> — под огнём в бою
      if (canFlee) {
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Condition: AND>'), _sdeTagCmd('<Combat>'),
              _sdeTagCmd('<Shot>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(721, 0, ['loch', 0]), _sdeCmd(721, 0, ['flee', 1]), _sdeCmd(721, 0, ['shot', 0]), _sdeEnd()]),
          route: [_sdeMr(10), _sdeMrEnd()] }));

      // P10: <Flee> — бегство
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Flee>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(111, 0, [1, 59, 0, cower, 1]),
                  _sdeCmd(205, 1, [0, {
                      list: [{ code: 36, indent: null }, { code: 10, indent: null }, { code: 0 }],
                      repeat: false, skippable: false, wait: true
                  }]),
                  _sdeCmd(505, 1, [{ code: 36, indent: null }]), _sdeCmd(505, 1, [{ code: 10, indent: null }]),
                  _sdeEnd(1), _sdeCmd(411, 0, []),
                  _sdeCmd(205, 1, [0, {
                      list: [{ code: 11, indent: null }, { code: 0 }],
                      repeat: false, skippable: false, wait: true
                  }]),
                  _sdeCmd(505, 1, [{ code: 11, indent: null }]), _sdeEnd(1),
                  _sdeCmd(412, 0, []), _sdeEnd()]),
          route: [{ code: 0, parameters: [] }] }));
      }

      // P11: <Calm>+<Combat> — успокоился: полный сброс ИИ
      pages.push(_sdePage({ cond: _sdeCond('A', false), dirFix: true, image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Condition: AND>'), _sdeTagCmd('<Calm>'),
              _sdeTagCmd('<Combat>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(230, 0, [90]), _sdeCmd(721, 0, ['combat', 0]),
                  _sdeCmd(721, 0, ['flee', 0]), _sdeCmd(721, 0, ['__reset_all', 1]), _sdeEnd()]),
          route: [_sdeMr(10), _sdeMrEnd()] }));

      // P12: <Zona>+<Combat> — атака: рывок + удар (злым с хоть какой-то атакой)
      if (hasAttack) {
      var p12list = [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Condition: AND>'), _sdeTagCmd('<Zona>'),
          _sdeTagCmd('<Combat>')]
          .concat(_sdeColliderComments(tpl));
      if (dashName !== '') {
          p12list.push(_sdeCmd(726, 0, [0, 0, dashName]));
          p12list.push(_sdeCmd(230, 0, [8]));
      }
      if (melee > 0) {
          p12list.push(_sdeCmd(355, 0, ['this.performMelee(' + melee + ')']));
          p12list.push(_sdeCmd(230, 0, [45]));
      }
      p12list.push(_sdeEnd());
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 3, prio: 1, trigger: 4,
          list: p12list,
          route: [_sdeMr(45, ['this.smartMoveToPlayer()']), _sdeMrEnd()] }));
      }

      // P13: <Wound> — ранен: сняли рану через 20 кадров
      pages.push(_sdePage({ cond: _sdeCond('D', false), image: _sdeImg(tpl), freq: 5,
          speed: speedCombat, moveType: 0, prio: 1, trigger: 4,
          list: [_sdeTagCmd('<projEffect>'), _sdeTagCmd('<Wound>')]
              .concat(_sdeColliderComments(tpl), [
                  _sdeCmd(230, 0, [20]), _sdeCmd(721, 0, ['wound', 0]), _sdeEnd()]),
          route: [_sdeMr(35), _sdeMr(15, [7]), _sdeMr(11), _sdeMr(15, [60]), _sdeMrEnd()] }));

      // P14: (D) получение урона — таблица по оружию ГГ (var 17)
      pages.push(_sdePage({ cond: _sdeCond('D', true), image: _sdeImg(tpl), freq: 3,
          speed: speedCalm, moveType: 0, prio: 1, trigger: 3,
          list: [_sdeTagCmd('<projEffect>')].concat(_sdeColliderComments(tpl), [
              _sdeCmd(111, 0, [1, 17, 0, dmgMeleeVar, 0]),
              _sdeCmd(111, 1, [0, 41, sneak]),
              _sdeCmd(722, 2, [0, dmgMelee, 0]), se(), _sdeEnd(2),
              _sdeCmd(411, 1, []),
              _sdeCmd(731, 2, [0, 0, 0]), _sdeCmd(722, 2, [0, dmgFists, 0]), se(),
              _sdeCmd(721, 2, ['wound', 1]), _sdeEnd(2),
              _sdeCmd(412, 1, []), _sdeEnd(1),
              _sdeCmd(411, 0, []),
              _sdeCmd(111, 1, [1, 17, 0, dmgGunVar, 0]),
              _sdeCmd(722, 2, [0, dmgMelee, 0]), _sdeEnd(2),
              _sdeCmd(411, 1, []), _sdeEnd(2), _sdeCmd(412, 1, []), _sdeEnd(1),
              _sdeCmd(412, 0, []),
              _sdeCmd(721, 0, ['combat', 1]), _sdeCmd(123, 0, ['D', 1]), _sdeEnd()]),
          route: [{ code: 0, parameters: [] }] }));

      // P15: <OnDeath> — смерть
      pages.push(_sdePage({ cond: _sdeCond('A', false), image: _sdeImg(tpl, true), freq: 3,
          speed: 3, moveType: 0, prio: 0, trigger: 0,
          list: [_sdeTagCmd('<OnDeath>'), _sdeEnd()],
          route: [{ code: 0, parameters: [] }] }));

      // P16: (B) пустая страница-заглушка
      pages.push(_sdePage({ cond: _sdeCond('B', true), image: _sdeImg(tpl, true), freq: 3,
          speed: 3, moveType: 0, prio: 0, trigger: 0,
          list: [_sdeEnd()],
          route: [{ code: 0, parameters: [] }] }));

      return pages;
  }

  /** Найти template-карточку по note-тегу события (тот же match, что у правил). */
  function sdeFindTemplateByNote(note) {
      if (!note || !MEHP_DB.length) return null;
      for (var i = 0; i < MEHP_DB.length; i++) {
          var r = MEHP_DB[i];
          if (r && r.match && String(r.template) === 'true' && note.indexOf(r.match) >= 0) return r;
      }
      return null;
  }

  /**
   * Развернуть все заглушки <тег> на текущей $dataMap в полные автоматы.
   * Вызывается ДО оригинального Game_Map.setup: когда setup исполняется,
   * $dataMap уже загружен, а события ещё не созданы — они instantiate
   * со сгенерированными страницами. Идемпотентно: скелет всегда
   * пересобирается с чистого листа.
   */
  function sdeExpandMapTemplates() {
      if (typeof $dataMap === 'undefined' || !$dataMap || !$dataMap.events) return 0;
      var expanded = 0;
      for (var i = 1; i < $dataMap.events.length; i++) {
          var ev = $dataMap.events[i];
          if (!ev) continue;
          var tpl = sdeFindTemplateByNote(ev.note);
          if (!tpl) continue;
          var pages = sdeBuildEnemyPages(tpl);
          if (pages && pages.length) { ev.pages = pages; expanded++; }
      }
      return expanded;
  }

  // ===========================================================================
  // СБОРКА МУСОРА
  // ===========================================================================

  var _Game_Map_setup = Game_Map.prototype.setup;
  Game_Map.prototype.setup = function(mapId){
    sdeExpandMapTemplates(); // P2: заглушки шаблонов -> полные автоматы (до создания событий)
    _Game_Map_setup.call(this,mapId);
    
    _pageConditionCache.clear();
    CentralizedManager.clear();
    
    var keysToDelete = [];
    for (var key in _eventData) {
        var entry = _eventData[key];
        if (entry.mapId !== mapId && (!entry.scope || entry.scope === 'local')) {
            keysToDelete.push(key);
        }
    }
    for (var i = 0; i < keysToDelete.length; i++) delete _eventData[keysToDelete[i]];
    
    if ($dataMap && $dataMap.events){
        for (var i=1;i<$dataMap.events.length;i++){
            var ev = $dataMap.events[i];
            if (!ev) continue;
            var rule = findRuleByNote(ev.note);
            if (rule) {
                createEventData(mapId, i, rule);
                CentralizedManager.register(i);
            }
        }
    }
    CentralizedManager.updateCombatTracking();
  };

  // ===========================================================================
  // ОПТИМИЗИРОВАННЫЙ RAYCASTING
  // ===========================================================================
  
  function hasLineOfSight(x1, y1, x2, y2) {
      if (Math.abs(x1 - x2) > 20 || Math.abs(y1 - y2) > 20) return false;

      var x = x1;
      var y = y1;
      var dx = Math.abs(x2 - x1);
      var dy = Math.abs(y2 - y1);
      var sx = (x1 < x2) ? 1 : -1;
      var sy = (y1 < y2) ? 1 : -1;
      var err = dx - dy;
      var loops = 0;
      
      while (!((Math.abs(x - x2) < 0.5) && (Math.abs(y - y2) < 0.5)) && loops < 50) {
          loops++;
          if (loops > 1) {
             var fx = Math.floor(x);
             var fy = Math.floor(y);
             
             var passX = true, passY = true;
             if (sx > 0 && !$gameMap.isPassable(fx, fy, 6)) passX = false;
             if (sx < 0 && !$gameMap.isPassable(fx, fy, 4)) passX = false;
             if (sy > 0 && !$gameMap.isPassable(fx, fy, 2)) passY = false;
             if (sy < 0 && !$gameMap.isPassable(fx, fy, 8)) passY = false;
             
             if (!passX && !passY) return false; 
             if ($gameMap.regionId(fx, fy) === 1) return false;
          }

          var e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x += sx; }
          if (e2 < dx) { err += dx; y += sy; }
      }
      return true;
  }

  function checkMutualGaze(event, player) {
    if (!event || !player) return false;
    var ex = event._realX, ey = event._realY;
    var px = player._realX, py = player._realY;
    
    // ОПТИМИЗАЦИЯ ЗРЕНИЯ: Прерываем просчеты, если игрок слишком далеко
    if (Math.abs(ex - px) > 20 || Math.abs(ey - py) > 20) return false;
    
    var dist = Math.sqrt(Math.pow(ex - px, 2) + Math.pow(ey - py, 2));
    if (dist < 1.2) return true;

    var eventDir = event.direction();
    var playerDir = player.direction();
    var gazeMatch = false;
    var threshold = 0.8; 

    switch(eventDir) {
        case 2: gazeMatch = (playerDir === 8 && py >= ey && Math.abs(px - ex) <= threshold); break;
        case 4: gazeMatch = (playerDir === 6 && px <= ex && Math.abs(py - ey) <= threshold); break;
        case 6: gazeMatch = (playerDir === 4 && px >= ex && Math.abs(py - ey) <= threshold); break;
        case 8: gazeMatch = (playerDir === 2 && py <= ey && Math.abs(px - ex) <= threshold); break;
    }
    
    if (!gazeMatch) return false;
    return hasLineOfSight(ex, ey, px, py);
  }

  // ===========================================================================
  // ДИНАМИЧЕСКОЕ КЭШИРОВАНИЕ УСЛОВИЙ (DYNAMIC CACHE)
  // ===========================================================================
  
  function analyzePage(page) {
      if (!page || !page.list) return null;
      var config = { hasPluginConditions: false, operator: 'AND', conditions: [] };
      
      for (var i = 0; i < page.list.length; i++) {
          var cmd = page.list[i];
          if (cmd.code !== 108 && cmd.code !== 408) continue;
          
          var comment = String(cmd.parameters[0] || '').trim();
          var opMatch = comment.match(/<Condition:\s*(AND|OR|NOT)\s*>/i);
          if (opMatch) {
              config.operator = opMatch[1].toUpperCase();
              continue;
          }
          
          var tagMatch = comment.match(/<!?([a-zA-Z0-9_]+)>/i);
          if (tagMatch && comment.toLowerCase().indexOf('<condition:') === -1) {
              var parsedTag = tagMatch[1].toLowerCase();
              if (parsedTag === 'ondeath') parsedTag = 'dead'; 
              
              if (VALID_FLAGS.has(parsedTag)) {
                  config.hasPluginConditions = true;
                  var negated = (comment.indexOf('<!') >= 0);
                  config.conditions.push({ type: parsedTag, negated: negated });
              }
          }
      }
      return config;
  }

  var _Game_Event_setupPage = Game_Event.prototype.setupPage;
  Game_Event.prototype.setupPage = function() {
      _Game_Event_setupPage.call(this);
      if (this._pageIndex >= 0) {
          this._mehp_pageConfig = analyzePage(this.page());
          
          if (this.page() && $gameMap) {
              var mapId = $gameMap.mapId();
              var data = getEventData(mapId, this.eventId());
              if (data) {
                  data.baseMoveSpeed = this.page().moveSpeed;
              }
          }
      } else {
          this._mehp_pageConfig = null;
      }
  };

  var _Game_Event_meetsConditions = Game_Event.prototype.meetsConditions;
  Game_Event.prototype.meetsConditions = function(page){
      if (!_Game_Event_meetsConditions.call(this, page)) return false;
      
      var config = (this.page() === page && this._mehp_pageConfig) ? this._mehp_pageConfig : analyzePage(page);
      if (!config || !config.hasPluginConditions) return true;
      
      var entry = getEventData($gameMap.mapId(), this.eventId());
      if (!entry) return true;
      
      var result = (config.operator === 'AND');
      if (config.operator === 'OR') result = false;
      
      for (var i = 0; i < config.conditions.length; i++) {
          var cond = config.conditions[i];
          var val = !!entry.flags[cond.type];
          
          if (cond.negated) val = !val;
          
          if (config.operator === 'AND') {
              if (!val) return false;
          } else if (config.operator === 'OR') {
              if (val) return true;
          } else if (config.operator === 'NOT') {
               if (val) return false;
          }
      }
      
      if (config.operator === 'NOT') return true;
      return result;
  };

  // ===========================================================================
  // ДВИЖОК ПРАВИЛ ИИ (ULTIMATE RULE ENGINE)
  // ===========================================================================
  
  var CentralizedManager = {
      _registeredObjects: new Map(),
      _tickCounter: 0,
      
      register: function(eventId) { this._registeredObjects.set(eventId, { eventId: eventId }); },
      unregister: function(eventId) { this._registeredObjects.delete(eventId); },
      clear: function() { this._registeredObjects.clear(); },
      
      update: function() {
          if (globalResetSwitch > 0 && $gameSwitches.value(globalResetSwitch)) {
              this.resetAllStates();
              $gameSwitches.setValue(globalResetSwitch, false);
          }
          
          this._tickCounter = (this._tickCounter + 1) % TICK_RATE;
          
          this._registeredObjects.forEach(function(obj) {
              if (obj.eventId % TICK_RATE === this._tickCounter) {
                  this.updateSingleObject(obj);
              }
          }, this);
          
          if (this._tickCounter === 0) {
              this.updateCombatTracking();
          }
      },
      
      updateCombatTracking: function() {
          if (noCombatSwitch === 0 && combatCountVariable === 0) return;
          var currentMapId = $gameMap.mapId();
          var combatCount = 0;
          this._registeredObjects.forEach(function(obj) {
              var data = getEventData(currentMapId, obj.eventId);
              if (data && !data.flags['dead'] && data.flags['combat']) combatCount++;
          });
          if (noCombatSwitch > 0) $gameSwitches.setValue(noCombatSwitch, combatCount === 0);
          if (combatCountVariable > 0) $gameVariables.setValue(combatCountVariable, combatCount);
      },
      
      resetAllStates: function() {
        var currentMapId = $gameMap.mapId();
        this._registeredObjects.forEach(function(obj) {
             var data = getEventData(currentMapId, obj.eventId);
             if (!data) return;
             data.manualFlags = {};
             
             // ОПТИМИЗАЦИЯ: Используем кэшированный массив имен
             var hasCustom = function(name) { return data.customFlagNames.indexOf(name) >= 0; };
             
             for (var key in data.flags) {
                 if (AUTO_SENSORS.includes(key) && !hasCustom(key)) continue;
                 if (CLASSIC_FLAGS.includes(key) && !hasCustom(key)) continue;
                 data.flags[key] = false;
             }
             
             data.calmTimer = 0;
             data.panicContactTimer = 0;
             data.panicTotalTimer = 0;
             
             updateEventDisplay(data.eventId);
        });
      },
      
      updateSingleObject: function(obj) {
          var event = $gameMap.event(obj.eventId);
          if (!event) { this.unregister(obj.eventId); return; }
          
          var data = getEventData($gameMap.mapId(), obj.eventId);
          if (!data || data.flags['dead']) { this.unregister(obj.eventId); return; }
          
          this.processAI(event, data);
      },
      
      processAI: function(event, data) {
          var player = $gamePlayer;
          var dx = event._realX - player._realX;
          var dy = event._realY - player._realY;
          var distance = Math.sqrt(dx * dx + dy * dy); 
          
          var wasInCombat = !!data.flags['combat'];
          var oldFlagsStr = JSON.stringify(data.flags);
          
          if (data.baseMoveSpeed === 0) data.baseMoveSpeed = event._moveSpeed;
          
          // ОПТИМИЗАЦИЯ: Используем закэшированный массив кастомных имен
          var hasCustom = function(name) { return data.customFlagNames.indexOf(name) >= 0; };
          
          function checkWeaponActive(config) {
              if (config.switchId > 0 && $gameSwitches.value(config.switchId)) return true;
              if (config.variableId > 0 && config.variableValues && config.variableValues.length > 0) {
                  var val = $gameVariables.value(config.variableId);
                  if (config.variableValues.indexOf(val) >= 0) return true;
              }
              return false;
          }

          // 1. АВТОМАТИЧЕСКИЕ СЕНСОРЫ (Выполняются, только если нет одноименного правила)
          if (!hasCustom('zona') && !data.manualFlags['zona']) {
              data.flags['zona'] = (data.attackRadius > 0 && distance <= data.attackRadius);
          }
          if (!hasCustom('hearing') && !data.manualFlags['hearing']) {
              var noise = hearingVariable > 0 ? $gameVariables.value(hearingVariable) : 0;
              data.flags['hearing'] = (data.hearingRadius > 0 && distance <= data.hearingRadius && noise >= data.hearingThreshold);
          }
          if (!hasCustom('contact') && !data.manualFlags['contact']) {
              data.flags['contact'] = checkMutualGaze(event, player);
          }
          if (!hasCustom('light_actual') && !data.manualFlags['light_actual']) {
              var zone = typeof event.getLightZone === 'function' ? event.getLightZone() : 0;
              data.flags['light_actual'] = (zone >= 1);
              data.flags['light_tangent'] = (zone >= 2);
              data.flags['light_bright'] = (zone >= 3);
          }
          if (!hasCustom('scope') && !data.manualFlags['scope']) {
              data.flags['scope'] = $gameSwitches.value(18); 
          }
          if (!hasCustom('gun') && !data.manualFlags['gun']) {
              data.flags['gun'] = checkWeaponActive(gunConfig);
          }
          if (!hasCustom('melee') && !data.manualFlags['melee']) {
              data.flags['melee'] = checkWeaponActive(meleeConfig);
          }

          var newFlagsTarget = {};

          // 1.5. КЛАССИЧЕСКОЕ ПОВЕДЕНИЕ
          if (!hasCustom('calm') && !data.manualFlags['calm']) {
              if (data.calmRadius > 0) {
                  var inCalmRadius = (distance <= data.calmRadius);
                  if (data.flags['zona'] || inCalmRadius) {
                      if (data.flags['calm'] || data.calmCounting) {
                          data.flags['calm'] = false;
                          data.calmTimer = 0;
                          data.calmCounting = false;
                          data.calmCanActivate = true;
                      }
                  } else if (data.calmCanActivate) {
                      if (!data.calmCounting) { data.calmCounting = true; data.calmTimer = 0; }
                      data.calmTimer += TICK_RATE;
                      if (data.calmTimer >= data.calmTime && !data.flags['calm']) {
                          data.flags['calm'] = true;
                          data.calmCounting = false;
                          data.calmCanActivate = false;
                      }
                  }
              }
          }
          
          if (!hasCustom('panic') && !data.manualFlags['panic']) {
              if (data.flags['panic']) {
                  data.panicTotalTimer += TICK_RATE;
                  if (!data.flags['contact']) data.panicContactTimer += TICK_RATE;
                  else data.panicContactTimer = 0;

                  if ((data.panicTotalTime > 0 && data.panicTotalTimer >= data.panicTotalTime) ||
                      (data.panicContactTime > 0 && data.panicContactTimer >= data.panicContactTime)) {
                      data.flags['panic'] = false;
                      data.panicContactTimer = 0;
                      data.panicTotalTimer = 0;
                  }
              }
          }
          
          if (!hasCustom('combat') && !data.manualFlags['combat']) {
              if (data.flags['zona'] || data.flags['hearing']) {
                  data.flags['combat'] = true;
                  data.timers['combat'] = 180; 
              } else {
                  if (data.flags['calm']) {
                      data.flags['combat'] = false;
                      data.timers['combat'] = 0;
                  } else if (data.timers['combat'] > 0) {
                      data.timers['combat'] -= TICK_RATE;
                      if (data.timers['combat'] <= 0) {
                          data.flags['combat'] = false;
                          data.timers['combat'] = 0;
                      }
                  } else {
                      data.flags['combat'] = false;
                  }
              }
          }
          
          if (!hasCustom('warning') && !data.manualFlags['warning']) {
              if (data.flags['hearing']) {
                  data.flags['warning'] = true;
                  data.timers['warning'] = 180;
              } else {
                  if (data.flags['calm']) {
                      data.flags['warning'] = false;
                      data.timers['warning'] = 0;
                  } else if (data.timers['warning'] > 0) {
                      data.timers['warning'] -= TICK_RATE;
                      if (data.timers['warning'] <= 0) {
                          data.flags['warning'] = false;
                          data.timers['warning'] = 0;
                      }
                  } else {
                      data.flags['warning'] = false;
                  }
              }
          }
          
          if (!hasCustom('shot') && !data.manualFlags['shot'] && data.flags['shot']) {
              data.shotTimer += TICK_RATE;
              if (data.shotTimer >= 10) { data.flags['shot'] = false; data.shotTimer = 0; }
          }
          if (!hasCustom('loch') && !data.manualFlags['loch'] && data.flags['loch']) {
              data.lochTimer += TICK_RATE;
              if (data.lochTimer >= 10) { data.flags['loch'] = false; data.lochTimer = 0; }
          }

          // 2. ПОЛЬЗОВАТЕЛЬСКИЕ ПРАВИЛА (Оптимизированный обход препарсенных условий)
          for (var r = 0; r < data.customRules.length; r++) {
              var rule = data.customRules[r];
              var flagName = rule.flagClean;
              if (!flagName || data.manualFlags[flagName]) continue;
              
              var isMet = true;
              
              var hpPct = (data.hp / data.maxHp) * 100;
              if (rule.hpMinPct > 0 && hpPct < rule.hpMinPct) isMet = false;
              if (rule.hpMaxPct > 0 && hpPct > rule.hpMaxPct) isMet = false;
              
              if (isMet && rule.reqSwitch > 0 && !$gameSwitches.value(rule.reqSwitch)) isMet = false;
              if (isMet && rule.reqVarId > 0 && $gameVariables.value(rule.reqVarId) < rule.reqVarVal) isMet = false;
              
              // ОПТИМИЗАЦИЯ: Читаем готовые массивы вместо split/trim
              if (isMet && rule.parsedConditions.length > 0) {
                  var conditionsMet = false;
                  for (var o = 0; o < rule.parsedConditions.length; o++) {
                      var group = rule.parsedConditions[o];
                      var groupMet = true;
                      
                      for (var c = 0; c < group.length; c++) {
                          var cond = group[c];
                          var val = !!data.flags[cond.type];
                          if (cond.negated ? val : !val) { 
                              groupMet = false;
                              break; 
                          }
                      }
                      if (groupMet) {
                          conditionsMet = true;
                          break;
                      }
                  }
                  if (!conditionsMet) isMet = false;
              }
              
              if (isMet) {
                  if (data.activationTimers[flagName] === undefined) data.activationTimers[flagName] = 0;
                  data.activationTimers[flagName] += TICK_RATE;
                  
                  if (data.activationTimers[flagName] >= rule.activationDelay) {
                      newFlagsTarget[flagName] = true;
                      data.timers[flagName] = rule.holdTime || 0;
                  }
              } else {
                  data.activationTimers[flagName] = 0;
              }
          }

          // 3. ПРИМЕНЕНИЕ И ТАЙМЕРЫ УДЕРЖАНИЯ
          for (var key in data.flags) {
              if (AUTO_SENSORS.includes(key) && !hasCustom(key)) continue;
              if (CLASSIC_FLAGS.includes(key) && !hasCustom(key)) continue;
              if (data.manualFlags[key]) continue;
              
              if (newFlagsTarget[key]) {
                  data.flags[key] = true;
              } else {
                  if (data.timers[key] > 0) {
                      data.timers[key] -= TICK_RATE;
                      if (data.timers[key] <= 0) {
                          data.flags[key] = false;
                          data.timers[key] = 0;
                      }
                  } else {
                      data.flags[key] = false;
                  }
              }
          }
          
          for (var key in newFlagsTarget) {
              if (!data.flags[key] && !data.manualFlags[key]) {
                  data.flags[key] = true;
              }
          }
          
          // 4. ПЕРЕОПРЕДЕЛЕНИЕ СКОРОСТИ
          var highestSpeed = 0;
          for (var r = 0; r < data.customRules.length; r++) {
              var rule = data.customRules[r];
              var fn = rule.flagClean;
              if (data.flags[fn] && rule.moveSpeed > 0) {
                  if (rule.moveSpeed > highestSpeed) highestSpeed = rule.moveSpeed;
              }
          }

          if (highestSpeed > 0) {
              if (event._moveSpeed !== highestSpeed) event.setMoveSpeed(highestSpeed);
          } else {
              if (data.baseMoveSpeed > 0 && event._moveSpeed !== data.baseMoveSpeed) {
                  event.setMoveSpeed(data.baseMoveSpeed);
              }
          }

          // 5. ОБНОВЛЕНИЯ И ТРЕКИНГ
          if (oldFlagsStr !== JSON.stringify(data.flags)) {
              updateEventDisplay(data.eventId);
          }
          if (wasInCombat !== !!data.flags['combat']) {
              this.updateCombatTracking();
          }
      }
  };
  
  function updateEventDisplay(eventId) {
    if (!eventId) return;
    var event = $gameMap.event(eventId);
    if (event) event.refresh(); 
  }

  // ===========================================================================
  // ПЛАГИН-КОМАНДЫ (УНИВЕРСАЛЬНЫЕ)
  // ===========================================================================

  var _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
      _Scene_Map_update.call(this);
      CentralizedManager.update();
  };

  function setGenericMode(mapId, evId, flagName, state) {
      var data = getEventData(mapId, evId);
      if (!data) return;
      data.flags[flagName] = state;
      data.manualFlags[flagName] = true; // Защита от авто-сброса
      updateEventDisplay(evId);
      if (flagName === 'combat') CentralizedManager.updateCombatTracking();
  }

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args){
    _Game_Interpreter_pluginCommand.call(this,command,args);
    if (!command) return;
    var cmd = command.toUpperCase();
    var mapId = $gameMap.mapId();
    var eventId = this.eventId(); 
    
    if (cmd === 'SDE') {
        var action = args[0] ? args[0].toUpperCase() : '';
        var evId = args[1] === 'SELF' ? eventId : Number(args[1]);
        var flagName = args[2] ? args[2].toLowerCase() : '';
        var state = args[3] ? args[3].toUpperCase() === 'ON' : false;

        var data = getEventData(mapId, evId);
        if (!data) return;

        if (action === 'SET_FLAG' && flagName) {
            setGenericMode(mapId, evId, flagName, state);
        } else if (action === 'RESET_ALL') {
            data.manualFlags = {};
            
            var hasCustom = function(name) { return data.customFlagNames.indexOf(name) >= 0; };
            
            for (var k in data.flags) {
                if (AUTO_SENSORS.includes(k) && !hasCustom(k)) continue;
                if (CLASSIC_FLAGS.includes(k) && !hasCustom(k)) continue;
                data.flags[k] = false;
            }
            
            data.calmTimer = 0;
            data.panicContactTimer = 0;
            data.panicTotalTimer = 0;
             
            updateEventDisplay(evId);
            CentralizedManager.updateCombatTracking();
        }
        return;
    }
    
    // Поддержка старых команд плагинов (Legacy Support & HP Commands)
    if (!eventId) return;
    var data = getEventData(mapId, eventId);
    if (!data) return;

    switch(cmd) {
        case 'MEHP_SETUP':
            var varId = Number(args[0]) || 1;
            _eventVariables[eventId] = varId;
            updateEventVariable(eventId, data.hp);
            updateEventDisplay(eventId);
            break;
        case 'MEHP_ADD':
            updateHP(mapId, eventId, data.hp + (Number(args[0]) || 0));
            updateEventVariable(eventId, data.hp);
            break;
        case 'MEHP_SET':
            updateHP(mapId, eventId, Number(args[0]) || 0);
            updateEventVariable(eventId, data.hp);
            break;
        case 'MEHP_GET': 
            $gameVariables.setValue(Number(args[0]) || 1, data.hp); 
            break;
        case 'MEHP_COMBAT_START': setGenericMode(mapId, eventId, 'combat', true); break;
        case 'MEHP_COMBAT_END': setGenericMode(mapId, eventId, 'combat', false); break;
        case 'MEHP_PANIC_START': setGenericMode(mapId, eventId, 'panic', true); break;
        case 'MEHP_PANIC_END': setGenericMode(mapId, eventId, 'panic', false); break;
        case 'MEHP_FLEE_START': setGenericMode(mapId, eventId, 'flee', true); break;
        case 'MEHP_FLEE_END': setGenericMode(mapId, eventId, 'flee', false); break;
        case 'MEHP_ALERT_START': setGenericMode(mapId, eventId, 'alert', true); break;
        case 'MEHP_ALERT_END': setGenericMode(mapId, eventId, 'alert', false); break;
    }
  };

  function updateEventVariable(eventId, hp) {
    var varId = getEventVariableId(eventId);
    if (varId > 0) $gameVariables.setValue(varId, hp);
  }
  
  function getEventVariableId(eventId) {
      if (!_eventVariables[eventId]) {
          _eventVariables[eventId] = VARIABLE_BASE_ID + (eventId % 900);
      }
      return _eventVariables[eventId];
  }

  // ===========================================================================
  // СОХРАНЕНИЯ & МИГРАЦИЯ ДАННЫХ
  // ===========================================================================

  var _DataManager_makeSaveContents = DataManager.makeSaveContents;
  DataManager.makeSaveContents = function() {
      var contents = _DataManager_makeSaveContents.call(this);
      var currentMapId = $gameMap ? $gameMap.mapId() : 0;
      var cleanData = {};
      
      for (var key in _eventData) {
          var entry = _eventData[key];
          if (entry.scope === 'global' || (entry.mapId === currentMapId && !entry.flags['dead'])) {
              cleanData[key] = entry;
          }
      }
      contents.system._mehpEventData = cleanData;
      contents.system._mehpEventVariables = _eventVariables;
      return contents;
  };

  var _DataManager_extractSaveContents = DataManager.extractSaveContents;
  DataManager.extractSaveContents = function(contents) {
      _DataManager_extractSaveContents.call(this, contents);
      _eventData = contents.system._mehpEventData || {};
      _eventVariables = contents.system._mehpEventVariables || {};
      
      for (var key in _eventData) {
          var entry = _eventData[key];
          if (!entry.flags) {
              entry.flags = { dead: !!entry.dead };
              entry.timers = {};
              entry.activationTimers = {};
              entry.manualFlags = {};
              entry.baseMoveSpeed = 0;
              
              var oldStates = ['inCombat', 'inZona', 'inCalm', 'inHearing', 'inContact', 'inAlert', 'inScope', 'inGun', 'inWarning', 'inShot', 'inLoch', 'inPanic', 'inRememberGun', 'inWound', 'inFlee', 'inLightActual', 'inLightTangent', 'inLightBright'];
              for (var i = 0; i < oldStates.length; i++) {
                  var s = oldStates[i];
                  if (entry[s]) {
                      var fn = s.replace(/^in/, '');
                      fn = fn.charAt(0).toLowerCase() + fn.slice(1);
                      if (fn === 'lightActual') fn = 'light_actual';
                      if (fn === 'lightTangent') fn = 'light_tangent';
                      if (fn === 'lightBright') fn = 'light_bright';
                      entry.flags[fn] = true;
                  }
              }
          }
          if (!entry.activationTimers) entry.activationTimers = {};
          if (entry.baseMoveSpeed === undefined) entry.baseMoveSpeed = 0;
          if (entry.calmTimer === undefined) entry.calmTimer = 0;
          if (!entry.customFlagNames) {
              entry.customFlagNames = entry.customRules ? entry.customRules.map(function(r) { return r.flag.toLowerCase().trim(); }) : [];
          }
      }
  };

  // ===========================================================================
  // ПУБЛИЧНЫЙ API ДЛЯ ВНЕШНИХ ПЛАГИНОВ (SDE_API)
  // ===========================================================================
  // Открывает минимальный read-only доступ к данным ИИ врагов/НПС для других
  // плагинов (например, SuperDuperNpcPaths). Никаких правок приватного
  // состояния — только чтение текущих флагов/типов/реестра.
  window.SDE_API = {
      version: '1.0',

      // Флаги конкретного НПС (combat/calm/panic/scope/gun/melee/...). Возвращает
      // копию объекта, чтобы внешние плагины не могли повредить внутреннее
      // состояние. null — если событие не зарегистрировано как враг/НПС.
      getFlags: function(mapId, evId) {
          var data = getEventData(mapId, evId);
          if (!data || !data.flags) return null;
          var copy = {};
          for (var k in data.flags) {
              if (data.flags.hasOwnProperty(k)) copy[k] = !!data.flags[k];
          }
          return copy;
      },

      // Полная запись _eventData (копия). null, если событие не НПС.
      getEventData: function(mapId, evId) {
          var data = getEventData(mapId, evId);
          if (!data) return null;
          return {
              enemyId: data.enemyId,
              mapId: data.mapId,
              eventId: data.eventId,
              scope: data.scope,
              hp: data.hp,
              maxHp: data.maxHp,
              flags: this.getFlags(mapId, evId),
              customFlagNames: (data.customFlagNames || []).slice()
          };
      },

      // Зарегистрирован ли eventId как враг/НПС на текущей карте.
      isRegistered: function(mapId, evId) {
          return !!getEventData(mapId, evId);
      },

      // Список всех eventId-ов, зарегистрированных как НПС на текущей карте.
      // CentralizedManager.clear() сбрасывает реестр на каждой новой карте
      // (см. Game_Map.setup), поэтому после загрузки карты здесь только её события.
      getRegisteredEventIds: function() {
          if (!CentralizedManager || !CentralizedManager._registeredObjects) return [];
          var result = [];
          CentralizedManager._registeredObjects.forEach(function(obj) {
              if (obj && obj.eventId) result.push(obj.eventId);
          });
          return result;
      },

      // Полный список имён флагов, которые могут встретиться у НПС (сенсорные +
      // классические + кастомные из VALID_FLAGS).
      getKnownFlagNames: function() {
          var set = {};
          AUTO_SENSORS.forEach(function(f) { set[f] = true; });
          CLASSIC_FLAGS.forEach(function(f) { set[f] = true; });
          VALID_FLAGS.forEach(function(f) { set[f] = true; });
          return Object.keys(set);
      }
  };

  // P2: тест-хук (на поведение игры не влияет)
  if (typeof window !== 'undefined' && !window.__SDE_TEST) {
      window.__SDE_TEST = {
          buildEnemyPages: sdeBuildEnemyPages,
          findTemplateByNote: sdeFindTemplateByNote,
          expandMapTemplates: sdeExpandMapTemplates,
          MEHP_DB: MEHP_DB
      };
  }

})();