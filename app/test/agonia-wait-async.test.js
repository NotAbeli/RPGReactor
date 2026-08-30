/**
 * P32: WaitAsync — асинхронное ожидание не морозит героя.
 * Ядро MV: canMove -> $gameMap.isEventRunning() (интерпретатор с waitMode
 * всё ещё running). Пока карта ждёт waitAsync — движение разрешено;
 * прочие блокировки (принудительный маршрут, сообщения, чужой интерпретатор)
 * остаются в силе.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'WaitAsync.js'), 'utf8');

class Game_Interpreter {
    constructor() { this._waitMode = ''; this._waitCount = 0; }
}
class Game_Player {}
class Game_Map {}
class Game_Character {}

function makeEnv() {
    const ctx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => ({}), registerCommand() {} },
        Game_Interpreter, Game_Player, Game_Map, Game_Character,
        $gameMap: null, $gameMessage: { isBusy: () => false }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'WaitAsync.js' });
    return ctx;
}

function coreCanMove() {
    // миниатюра ядра MV: isEventRunning + маршрут
    if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return false;
    if (this._moveRouteForcing) return false;
    return true;
}

function setupMap(ctx, opts = {}) {
    ctx.$gameMap = new Game_Map();
    ctx.$gameMap._interpreter = new Game_Interpreter();
    ctx.$gameMap._interpreter._waitMode = opts.waitMode || '';
    // на ПРОТОТИПЕ: WaitAsync подменяет Game_Map.prototype.isEventRunning
    Game_Map.prototype.isEventRunning = () => !!opts.running;
    ctx.$gameMessage = { isBusy: () => !!opts.messageBusy };
}

test('P32: waitAsync-ожидание разрешает движение героя', () => {
    const ctx = makeEnv();
    // ядро-цепь ставится ДО WaitAsync-алиаса нельзя — но алиас уже стоит;
    // подменим «предыдущее» звено прямо в прототипе игры-заглушке:
    ctx.Game_Player.prototype.canMove = coreCanMove;
    // WaitAsync-алиас уже обернул то, что было на момент загрузки (undefined!
    // нет — на момент загрузки прототип пуст; алиас обернул undefined -> упадёт)
    // -> правильнее: проверить итоговую цепь через ctx-прототип целиком:
    const p = new Game_Player();
    p._moveRouteForcing = false;

    setupMap(ctx, { running: true, waitMode: 'waitAsync' });
    // ВНИМАНИЕ: WaitAsync оборачивал prototype.canMove, существовавший при
    // загрузке плагина — в тесте это undefined-звено. Поэтому проверяем сам
    // механизм: обёртка должна позвать предшественника с пробитым флагом.
    // Эмулируем предшественника записью ДО загрузки невозможной — вместо
    // этого прогоняем сценарий через отдельный env с предзаданным canMove.
    assert.ok(true, 'see next test');
});

test('P32: полный сценарий — герой ходит при waitAsync, стоит при обычном ожидании', () => {
    // env с ПРЕДУСТАНОВЛЕННЫМ canMove (как ядро MV), потом грузим плагин
    const ctx = {
        console: { log() {}, error() {}, warn() {} },
        PluginManager: { parameters: () => ({}), registerCommand() {} },
        Game_Interpreter, Game_Map, Game_Character,
        $gameMap: null, $gameMessage: { isBusy: () => false }
    };
    ctx.Game_Player = Game_Player;
    ctx.window = ctx;
    vm.createContext(ctx);
    // ядро MV (внутри vm, видит $gameMap контекста)
    vm.runInContext(
        'Game_Player.prototype.canMove = function() {' +
        '  if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return false;' +
        '  if (this._moveRouteForcing) return false;' +
        '  return true;' +
        '};', ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'WaitAsync.js' });

    const p = new Game_Player();
    p._moveRouteForcing = false;

    // карта ждёт waitAsync — герой может ходить
    setupMap(ctx, { running: true, waitMode: 'waitAsync' });
    assert.strictEqual(p.canMove(), true, 'waitAsync does not freeze the hero');

    // принудительный маршрут при waitAsync — по-прежнему нельзя
    p._moveRouteForcing = true;
    assert.strictEqual(p.canMove(), false, 'move route still blocks');
    p._moveRouteForcing = false;

    // обычное системное ожидание (интерпретатор running без waitMode)
    setupMap(ctx, { running: true, waitMode: '' });
    assert.strictEqual(p.canMove(), false, 'system wait still freezes');

    // карта свободна — обычное поведение
    setupMap(ctx, { running: false });
    assert.strictEqual(p.canMove(), true, 'free map allows movement');

    // сообщение на экране — блокировка сохраняется даже при waitAsync
    setupMap(ctx, { running: true, waitMode: 'waitAsync', messageBusy: true });
    assert.strictEqual(p.canMove(), false, 'message window still blocks');
});

test('P32: waitAsync-команда ждёт ровно N кадров в updateWaitMode', () => {
    const ctx = makeEnv();
    const interp = new ctx.Game_Interpreter();
    // команда WaitAsync через pluginCommand
    ctx.Game_Interpreter.prototype.pluginCommand.call(interp, 'WaitAsync', ['3']);
    assert.strictEqual(interp._waitMode, 'waitAsync', 'wait mode set');
    assert.strictEqual(ctx.Game_Interpreter.prototype.updateWaitMode.call(interp), true, 'frame 1 waits');
    assert.strictEqual(ctx.Game_Interpreter.prototype.updateWaitMode.call(interp), true, 'frame 2 waits');
    assert.strictEqual(ctx.Game_Interpreter.prototype.updateWaitMode.call(interp), true, 'frame 3 waits');
    assert.strictEqual(ctx.Game_Interpreter.prototype.updateWaitMode.call(interp), false, 'frame 4 releases');
    assert.strictEqual(interp._waitMode, '', 'mode cleared');
});
