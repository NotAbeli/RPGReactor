/*:
 * @target MV MZ
 * @plugindesc (v1.0) Запрещает запуск нескольких событий одновременно при нажатии кнопки действия.
 * @author Gemini Assistant
 *
 * @help
 * Этот плагин решает проблему плагинов на "Pixel Movement" (движение по пикселям).
 * Часто бывает, что стоя между двумя событиями и нажимая кнопку действия,
 * игрок активирует оба сразу.
 *
 * Этот плагин гарантирует, что за один раз сработает только одно событие.
 *
 * Требования:
 * Разместите этот плагин НИЖЕ плагина на движение (Altimit, Galv, DotMove и т.д.)
 * в списке плагинов.
 *
 * Настроек нет. Просто включите.
 */

(() => {
    const alias_Game_Player_triggerButtonAction = Game_Player.prototype.triggerButtonAction;
    
    // Перехватываем момент, когда игрок нажимает кнопку
    Game_Player.prototype.triggerButtonAction = function() {
        // Сбрасываем флаг блокировки перед проверкой событий
        $gameTemp._isEventActivatedThisFrame = false;
        return alias_Game_Player_triggerButtonAction.call(this);
    };

    const alias_Game_Event_start = Game_Event.prototype.start;

    // Перехватываем попытку запуска события
    Game_Event.prototype.start = function() {
        // Если в этом кадре уже кто-то активировался...
        if ($gameTemp._isEventActivatedThisFrame) {
            // Проверяем, что событие запускается по кнопке (0) или касанию игрока (1).
            // Мы не блокируем автозапуск (3) или параллельные события (4).
            if (this._trigger < 2) {
                return; // Прерываем запуск второго события
            }
        }

        // Вызываем стандартный метод запуска
        alias_Game_Event_start.call(this);

        // Если событие действительно запустилось (в нем есть команды и оно не пустое)
        if (this.isStarting()) {
            // Ставим блокировку, чтобы другие события не могли запуститься следом
            $gameTemp._isEventActivatedThisFrame = true;
        }
    };
})();