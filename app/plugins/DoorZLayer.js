/*:ru
 * @target MV MZ
 * @plugindesc v1.2 Dynamic Door Z-Layer — дверь над/под героем по Y
 * @author 
 *
 * @help
 * ============================================================================
 * Dynamic Door Z-Layer
 * ============================================================================
 *
 * Помечайте двери тегом <door> в поле "Примечание" (Note) события.
 * Плагин автоматически определяет, где находится герой относительно двери,
 * и меняет слой отрисовки:
 *
 *   • Герой ВЫШЕ порога двери  → дверь рисуется НАД героем (Z=5)
 *   • Герой НИЖЕ порога двери  → дверь рисуется ПОД героем (Z=1)
 *
 * ============================================================================
 * Использование
 * ============================================================================
 *
 * 1. Создайте событие-дверь на карте.
 * 2. В поле "Примечание" (Note) события добавьте: <door>
 * 3. Приоритет события: "Одинаковый с персонажами".
 * 4. Готово!
 *
 * ============================================================================
 * Debug Mode
 * ============================================================================
 *
 * Включите Debug Mode — на тайле двери появится кружок:
 *   Зелёный = дверь поверх героя (Z=5)
 *   Красный = дверь под героем (Z=1)
 *
 * @param Debug Mode
 * @desc true — кружок + логи, false — тихий режим
 * @type boolean
 * @default false
 *
 * @param Threshold
 * @desc Порог в тайлах. Положительный = ниже центра двери, отрицательный = выше.
 * @type number
 * @min -2
 * @max 2
 * @default 0.2
 *
 * @param Player Hitbox Y Center
 * @desc Центр хитбокса ГГ по Y (0=верх, 1=низ тайла). cy из коллайдера.
 * @type number
 * @min 0
 * @max 1
 * @default 0.65
 *
 * @param Hitbox Y Offset
 * @desc Доп. сдвиг центра хитбокса по Y (тайлы). Суммируется с Player Hitbox Y Center. Отрицательные = выше, положительные = ниже.
 * @type number
 * @min -1
 * @max 1
 * @default 0.3
 */

(function() {
    'use strict';

    var params = PluginManager.parameters('DoorZLayer');
    var debugMode = params['Debug Mode'] === 'true';
    var threshold = Number(params['Threshold'] || 0.2);
    var hitboxCenter = Number(params['Player Hitbox Y Center'] || 0.65);
    var hitboxYOffset = Number(params['Hitbox Y Offset'] || 0.3);
    var effectiveCenter = hitboxCenter + hitboxYOffset;
    var hitboxOffset = 1 - effectiveCenter;

    Game_CharacterBase.prototype.screenZ = function() {
        if (typeof this.event === 'function') {
            var eventData = this.event();
            if (eventData && eventData.note && eventData.note.indexOf('<door>') >= 0) {
                if ($gamePlayer) {
                    var playerY = $gamePlayer._y - hitboxOffset;
                    var t = this._y + threshold;
                    if (playerY < t) {
                        return 5;
                    } else {
                        return 1;
                    }
                }
            }
        }
        return this._priorityType * 2 + 1;
    };

    if (debugMode) {
        var _Sprite_Character_update = Sprite_Character.prototype.update;
        Sprite_Character.prototype.update = function() {
            _Sprite_Character_update.call(this);
            if (!this._character) return;

            var isPlayer = this._character === $gamePlayer;
            var isDoor = !isPlayer && typeof this._character.event === 'function' &&
                this._character.event() && this._character.event().note &&
                this._character.event().note.indexOf('<door>') >= 0;

            if (!isPlayer && !isDoor) return;

            var th = $gameMap ? $gameMap.tileHeight() : 48;
            if (!this._dbg) {
                this._dbg = new PIXI.Graphics();
                this.addChild(this._dbg);
            }
            var g = this._dbg;
            g.clear();

            if (isDoor) {
                // Кружок статуса над дверью
                g.beginFill(this.z === 5 ? 0x00ff00 : 0xff0000);
                g.drawCircle(0, -48, 5);
                g.endFill();

                // Чёрточка порога (на позиции реального переключения Z)
                var dashY = threshold * th;
                g.lineStyle(2, 0xffff00);
                g.moveTo(-14, dashY);
                g.lineTo(14, dashY);
                g.lineStyle(0);
            }

            if ($gamePlayer) {
                var playerCtr = $gamePlayer._y - hitboxOffset;
                var pColor = 0x00ccff;

                if (isDoor) {
                    var relY = (playerCtr - this._character._y) * th;
                    g.beginFill(this.z === 5 ? 0x00ff00 : 0xff0000);
                    g.drawCircle(0, relY, 3);
                    g.endFill();
                    pColor = 0x888888;
                }

                if (isPlayer) {
                    g.beginFill(pColor);
                    g.drawCircle(0, -hitboxOffset * th, 3);
                    g.endFill();
                }
            }
        };
    }
})();
