/*:
 * @plugindesc (v1.5 RESERVATION FIX) Исправление исчезновения: ресурсы теперь "бронируются" в памяти.
 * @author Gemini AI
 *
 * @param Preload All
 * @text ПОДГРУЖАТЬ ВСЕ
 * @type boolean
 * @desc Пытаться загрузить ВСЕ файлы из папок img/pictures и img/characters (Работает только на ПК/NW.js!).
 * @default false
 *
 * @param Picture List
 * @text Картинки (img/pictures)
 * @type file[]
 * @dir img/pictures
 * @desc Список изображений для кэширования.
 * @default []
 *
 * @param Character List
 * @text Персонажи (img/characters)
 * @type file[]
 * @dir img/characters
 * @desc Список чарсетов/тайлсетов персонажей для кэширования.
 * @default []
 *
 * @help
 * ============================================================================
 * SIMPLE PRELOADER (v1.5 RESERVATION FIX)
 * ============================================================================
 * ПЛАГИН ОБНОВЛЕН:
 * Теперь ресурсы не просто загружаются, а "бронируются" (Reserve) в памяти.
 * Это предотвращает их удаление из кэша при смене карт или сцен.
 *
 * Проблема "исчезновения на секунду" должна быть решена, так как движок
 * будет знать, что эти файлы нужны постоянно.
 *
 * ИНСТРУКЦИЯ:
 * 1. Используйте "ПОДГРУЖАТЬ ВСЕ" (для ПК).
 * 2. ИЛИ настройте списки вручную.
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('SimplePreloader');
    var preloadAll = (parameters['Preload All'] === 'true');
    
    // Специальный ID бронирования, чтобы система не удаляла эти файлы
    // при смене карты (обычно очищаются ID, привязанные к MapID)
    var PRELOAD_RESERVATION_ID = 9999;

    // Парсинг списков
    var pictureList = [];
    var characterList = [];

    try {
        pictureList = JSON.parse(parameters['Picture List'] || '[]');
        characterList = JSON.parse(parameters['Character List'] || '[]');
    } catch (e) {
        console.error("SimplePreloader: Ошибка парсинга параметров!", e);
    }

    // ==============================================================================
    // ** Image Manager Extensions
    // ==============================================================================
    
    // Используем reserve, если доступно (MV), иначе load (MZ)
    // reserve защищает от очистки кэша при переходе между картами
    
    ImageManager.preloadPicture = function(filename) {
        if (this.reservePicture) {
            this.reservePicture(filename, 0, PRELOAD_RESERVATION_ID);
        } else {
            this.loadPicture(filename); // MZ fallback
        }
    };

    ImageManager.preloadCharacter = function(filename) {
        if (this.reserveCharacter) {
            this.reserveCharacter(filename, 0, PRELOAD_RESERVATION_ID);
        } else {
            this.loadCharacter(filename); // MZ fallback
        }
    };

    // ==============================================================================
    // ** File System Scanner (Node.js / NW.js Only)
    // ==============================================================================
    var FileScanner = {
        isNode: function() {
            return typeof require === 'function' && typeof process !== 'undefined';
        },

        getFiles: function(dirPath, extensions) {
            if (!this.isNode()) return [];
            
            var fs = require('fs');
            var path = require('path');
            var base = path.dirname(process.mainModule.filename);
            var fullPath = path.join(base, dirPath);
            
            if (!fs.existsSync(fullPath)) {
                console.warn("SimplePreloader: Папка не найдена:", fullPath);
                return [];
            }

            var files = fs.readdirSync(fullPath);
            var result = [];
            
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var ext = path.extname(file).toLowerCase();
                var name = path.basename(file, ext);
                
                if (extensions.contains(ext)) {
                    result.push(name);
                }
            }
            return result;
        }
    };

    // ==============================================================================
    // ** Scene_Boot Extension
    // ==============================================================================
    
    var _Scene_Boot_create = Scene_Boot.prototype.create;
    Scene_Boot.prototype.create = function() {
        _Scene_Boot_create.call(this);
        this.performPreload();
    };

    Scene_Boot.prototype.performPreload = function() {
        console.log("SimplePreloader: Старт бронирования ресурсов..."); 
        
        var picsToLoad = [];
        var charsToLoad = [];

        if (preloadAll) {
            if (FileScanner.isNode()) {
                console.log("SimplePreloader: Авто-сканирование папок (Node.js).");
                picsToLoad = FileScanner.getFiles('img/pictures', ['.png']);
                charsToLoad = FileScanner.getFiles('img/characters', ['.png']);
            } else {
                console.warn("SimplePreloader: Браузерная среда. Используем списки.");
                picsToLoad = pictureList;
                charsToLoad = characterList;
            }
        } else {
            console.log("SimplePreloader: Использование ручных списков.");
            picsToLoad = pictureList;
            charsToLoad = characterList;
        }

        // 1. Pictures
        if (picsToLoad.length > 0) {
            console.log("SimplePreloader: Бронирование Pictures (" + picsToLoad.length + ")");
            for (var i = 0; i < picsToLoad.length; i++) {
                if (picsToLoad[i]) ImageManager.preloadPicture(picsToLoad[i]);
            }
        }

        // 2. Characters
        if (charsToLoad.length > 0) {
            console.log("SimplePreloader: Бронирование Characters (" + charsToLoad.length + ")");
            for (var k = 0; k < charsToLoad.length; k++) {
                if (charsToLoad[k]) ImageManager.preloadCharacter(charsToLoad[k]);
            }
        }
        
        console.log("SimplePreloader: Очередь сформирована.");
    };

})();