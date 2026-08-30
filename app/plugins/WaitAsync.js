/*:
 * @plugindesc Асинхронное ожидание без блокировки игрока, работает даже в параллельных событиях. 
 * @author ChatGPT
 *
 * @command WaitAsync
 * @text Асинхронное ожидание
 * @desc Ждёт указанное количество кадров, не блокируя игрока.
 *
 * @arg frames
 * @type number
 * @min 1
 * @text Количество кадров
 * @desc Сколько кадров ждать (60 кадров = 1 секунда)
 * @default 60
 */

(() => {
    const pluginName = "WaitAsync";

    // [Фикс Korolev]: MV-стиль регистрации (MZ-метод PluginManager.registerCommand отсутствует в MV).
    // Команды плагина диспетчеризуются через Game_Interpreter.prototype.pluginCommand.
    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        if (command === "WaitAsync") {
            const frames = Number(args[0] || 60);
            this._waitAsyncFrames = frames;
            this._waitMode = "waitAsync";
            return;
        }
        _Game_Interpreter_pluginCommand.call(this, command, args);
    };

    const _GameInterpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === "waitAsync") {
            if (this._waitAsyncFrames > 0) {
                this._waitAsyncFrames--;
                return true; // продолжаем ждать
            } else {
                this._waitAsyncFrames = null;
                this._waitMode = "";
                return false; // таймер завершён
            }
        }
        return _GameInterpreter_updateWaitMode.call(this);
    };

    // P32: асинхронное ожидание блокирует ТОЛЬКО выполнение команд события —
    // но не героя. Ядро MV морозит игрока через Game_Player.canMove ->
    // $gameMap.isEventRunning() (интерпретатор с _waitMode всё ещё running).
    // Пока карта ждёт waitAsync — пробиваем ровно этот флаг, сохраняя все
    // прочие блокировки цепочки (дэш, инвентарь, сообщения, маршруты).
    if (typeof Game_Player !== 'undefined' && Game_Player.prototype
        && typeof Game_Map !== 'undefined' && Game_Map.prototype) {
        const _WaitAsync_Game_Player_canMove = Game_Player.prototype.canMove;
        Game_Player.prototype.canMove = function() {
            const interp = (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap._interpreter : null;
            const waitingAsync = (typeof $gameMap !== 'undefined' && $gameMap)
                && $gameMap.isEventRunning()
                && interp && interp._waitMode === "waitAsync"
                && (typeof $gameMessage === 'undefined' || !$gameMessage.isBusy());
            if (!waitingAsync) {
                return _WaitAsync_Game_Player_canMove.call(this);
            }
            const origIsRunning = Game_Map.prototype.isEventRunning;
            Game_Map.prototype.isEventRunning = function() { return false; };
            try {
                return _WaitAsync_Game_Player_canMove.call(this);
            } finally {
                Game_Map.prototype.isEventRunning = origIsRunning;
            }
        };
    }
})();
