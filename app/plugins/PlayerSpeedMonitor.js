/*:
 * @plugindesc Player speed monitor (автоматическое ВКЛЮЧЕНИЕ переключателя по скорости, после таймера; включает переключатель при старте сцены карты). 
 * @author ...
 *
 * @param Speed Variable ID
 * @type variable
 * @desc ID переменной, куда писать скорость игрока (пиксели за кадр).
 * @default 0
 *
 * @param Control Switch ID
 * @type switch
 * @desc ID переключателя, который автоматически включать (0 = не использовать).
 * @default 0
 *
 * @param Speed-On Rules
 * @type struct<SpeedOn>[]
 * @desc Таблица правил: диапазон скоростей и задержка (в тиках) для ВКЛЮЧЕНИЯ переключателя.
 * @default []
 */

/*~struct~SpeedOn:
 * @param Min Speed
 * @type number
 * @decimals 2
 * @desc Минимальная скорость (включительно).
 * @default 0
 *
 * @param Max Speed
 * @type number
 * @decimals 2
 * @desc Максимальная скорость (включительно).
 * @default 999
 *
 * @param Delay Ticks
 * @type number
 * @desc Через сколько тиков ВКЛЮЧИТЬ переключатель.
 * @default 60
 */

(function() {
    const pluginName = 'PlayerSpeedMonitor';
    const params = PluginManager.parameters(pluginName);
    const speedVarId = Number(params['Speed Variable ID'] || 0);
    const controlSwitchId = Number(params['Control Switch ID'] || 0);

    function parseRules(raw) {
        try {
            const arr = JSON.parse(raw);
            return arr.map(r => JSON.parse(r));
        } catch(e) { return []; }
    }
    const rules = parseRules(params['Speed-On Rules'] || params['Speed-Off Rules'] || '[]');

    let lastX = 0, lastY = 0;
    let timer = 0;

    const tw = () => $gameMap ? $gameMap.tileWidth() : 48;
    const th = () => $gameMap ? $gameMap.tileHeight() : 48;

    function lookupDelayBySpeed(speed) {
        for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            const min = Number(r['Min Speed'] || 0);
            const max = Number(r['Max Speed'] || 999999);
            const delay = Number(r['Delay Ticks'] || 60);
            if (speed >= min && speed <= max) return delay;
        }
        return 60;
    }

    const _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        const dx = (this._realX - lastX) * tw();
        const dy = (this._realY - lastY) * th();
        const speed = Math.sqrt(dx * dx + dy * dy);
        lastX = this._realX;
        lastY = this._realY;
        if (speedVarId > 0 && $gameVariables) {
            $gameVariables.setValue(speedVarId, speed);
        }
        if (controlSwitchId > 0 && $gameSwitches) {
            if (!$gameSwitches.value(controlSwitchId)) { // переключатель выключен
                if (timer <= 0) {
                    timer = lookupDelayBySpeed(speed);
                }
                timer--;
                if (timer <= 0) {
                    $gameSwitches.setValue(controlSwitchId, true); // включаем
                }
            } else {
                timer = 0; // переключатель уже включен — таймер сбрасываем
            }
        }
    };

    // Включаем переключатель при старте сцены карты
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (controlSwitchId > 0 && $gameSwitches) {
            $gameSwitches.setValue(controlSwitchId, true);
        }
    };
})();

