//===================================================================
// YuryolStealth.js
//===================================================================
/*:ru

 * @plugindesc Стелс (зрение событий)
 * @author Yuryol
 * @help

 * @param circle
 * @desc Включить зрение полукруг?
 * @type Boolean
 * @default false

 * @help
 * ### Информация о плагине ###
 * 
 * Название: YuryolStealth
 * Автор: YuryOl
 * 
 * ### Справка ###
 *
 * Позволяет задать "зрение" событию, т.е. событие будет активировать
 * определенную локальную вкладку (по умолчанию - вкладку 'A') только
 * если герой находится на определенном расстоянии от него и при этом
 * герой стоит не позади события.
  
 * По умолчанию поле зрения события будет прямоугольным.
 * Чтобы поле зрение было полукругом, следует изменить параметр плагина 
 * "circle" в положение "false"
  
 * Чтобы сделать событию "зрение" следует:
     
 * 1) Если требуется вызвать событие из другого события, то в команде 
 * "скрипт" ввести:
 * $gameMap.event(id).YurStealth(distance, switch)

 * , где:
 * id - id события,
 * distance - расстояние от героя до события, на котором 
 * sw - локальный переключатель, который активируется, когда враг "увидит" героя.
 *      если параметр не указан, то включится переключатель 'A'
 *   
 * 2) Также можно ввести скрипт в маршрут события командой "скрипт":
 * $gameMap.event(id).YurStealth(distance, switch)
 * 
 * Если требуется включить "зрение" в том же событии, в маршруте которого и вызван
 * скрипт, ты можем написать просто:
 * this.YurStealth(distance, switch) 
 *
 * ### Лицензии и правила использования плагина ###
 * 
 * Вы можете:
 * -Бесплатно использовать данный плагин в некоммерческих и коммерческих проектах
 * -Переводить плагин на другие языки
 * -Изменять код плагина, но Вы обязаны указать ссылку на оригинальный плагин
 * 
 * Вы не можете:
 * -Убирать или изменять любую информацию о плагине (название, авторство) 
 */

(function(){
    const parameters = PluginManager.parameters('YuryolStealth'),
        circle = parameters['circle'],
        list = []; // хранение событий, которые следят за героем

    // P24: вотчеры привязаны к событиям КОНКРЕТНОЙ карты — при переносе
    // героя список обязан сбрасываться, иначе $gameMap.event(id) со старой
    // карты = undefined и чтение _x роняло Scene_Map.update каждый кадр.
    if (typeof Game_Map !== 'undefined' && Game_Map.prototype) {
        var _YurS_Game_Map_setup = Game_Map.prototype.setup;
        Game_Map.prototype.setup = function(mapId) {
            list.length = 0;
            return _YurS_Game_Map_setup.apply(this, arguments);
        };
    }

    //апдейт
    var YuryolStealthUpdate = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        YuryolStealthUpdate.call(this);
        if (list) this.YuryolStealthCoordinate();
    };

    //добавление события (P24: перерегистрация того же id заменяет запись —
    // повторные вызовы скелета больше не раздувают список)
    Game_Character.prototype.YurStealth = function(dist, sw) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === this._eventId) {
                list[i].dist = dist;
                list[i].sw = sw;
                return;
            }
        }
        list.push({
            id: this._eventId, 
            dist: dist,
            sw: sw
        });
    };

    //рассчеты
    Scene_Map.prototype.YuryolStealthCoordinate = function() {
        
        for(var i = 0; i < list.length; i++){
            
            let id = list[i].id,
                dist = list[i].dist,
                sw = (list[i].sw) ? list[i].sw : 'A';

            // P24: события больше нет на карте (перенос/стёрт) — убрать
            // вотчера, а не ронять кадр
            let ev = null;
            try { ev = $gameMap.event(id); } catch (e) { ev = null; }
            if (!ev) {
                list.splice(i, 1);
                i--;
                continue;
            }

            let distX = ev._x - $gamePlayer.x,
                distY = ev._y - $gamePlayer.y;
            
            //проверка расстояния от события до героя
            if (circle) {
                if (Math.abs(distX) > dist || Math.abs(distY) > dist) continue;
            }
            else {
                if (distX*distX + distY*distY > dist*dist) continue;
            };
            
        
            //проверка стоит ли событие спиной к герою
            switch(ev.direction()) {
                case 2:
                    if (distY > 0) continue;
                    break;
                case 4:
                    if (distX < 0) continue;
                    break;
                case 6:
                    if (distX > 0) continue;
                    break;
                case 8:
                    if (distY < 0) continue;
                    break;
            }

            //включение лок. страницы "А"
            $gameSelfSwitches.setValue([$gameMap.mapId(), id, sw], true);
        }
    };
})();