//=============================================================================
// SuperDuperSave.js
//=============================================================================

/*:
 * @plugindesc Единый интерфейс сохранения/загрузки в стиле "Диктофон". Содержит визуальный редактор.
 * @author Korolev
 *
 * @param --- SuperDuperCore ---
 * @default
 *
 * @note
 * Если установлен SuperDuperCore, все координаты X/Y могут быть пустыми —
 * они автоматически рассчитаются как проценты от ширины/высоты экрана из Core.
 * Чтобы переопределить — просто укажите своё значение в пикселях.
 *
 * @param --- Основные Настройки ---
 * @default
 *
 * @param Enable Editor
 * @parent --- Основные Настройки ---
 * @desc Включить режим визуального редактора? (Работает только в режиме Playtest).
 * @type boolean
 * @on Включен
 * @off Выключен
 * @default true
 *
 * @param Max Slots
 * @parent --- Основные Настройки ---
 * @desc Максимальное количество слотов (кассет).
 * @type number
 * @min 1
 * @default 10
 *
 * @param Fade In Duration
 * @parent --- Основные Настройки ---
 * @desc Скорость появления сцены из темноты (в кадрах, 60 = 1 секунда).
 * @type number
 * @default 60
 *
 * @param Intro Fade Out Duration
 * @parent --- Основные Настройки ---
 * @desc Скорость затемнения карты перед появлением сцены (в кадрах).
 * @type number
 * @default 60
 *
 * @param Fade Out Duration
 * @parent --- Основные Настройки ---
 * @desc Скорость ухода в темноту при закрытии/загрузке (в кадрах).
 * @type number
 * @default 60
 *
 * @param Backdrop Image
 * @parent --- Основные Настройки ---
 * @desc Самый дальний задний фон (подложка под диктофоном).
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Background Image
 * @parent --- Основные Настройки ---
 * @desc Фоновое изображение (сам диктофон или фон над подложкой).
 * @type file
 * @dir img/pictures
 * @default
 * * @param --- Аудио: Фон ---
 * @default
 * * @param Background BGM
 * @parent --- Аудио: Фон ---
 * @desc Фоновая музыка (оставьте пустым, чтобы играла музыка карты)
 * @type file
 * @dir audio/bgm
 * @default
 * * @param BGM Volume
 * @parent --- Аудио: Фон ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param BGM Pitch
 * @parent --- Аудио: Фон ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Кнопка: Запись (Save) ---
 * @default
 *
 * @param Rec X
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Позиция X
 * @type number
 * @default 100
 *
 * @param Rec Y
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Позиция Y
 * @type number
 * @default 100
 *
 * @param Rec Img Norm
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Картинка: Спокойствие
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Rec Img Hov
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Картинка: Нажатая кнопка
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Rec Img Dis
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Картинка: Заблокировано
 * @type file
 * @dir img/pictures
 * @default
 * * @param Rec SE
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Звук при нажатии
 * @type file
 * @dir audio/se
 * @default Save
 * * @param Rec SE Vol
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param Rec SE Pitch
 * @parent --- Кнопка: Запись (Save) ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Кнопка: Воспроизведение (Load) ---
 * @default
 *
 * @param Play X
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Позиция X
 * @type number
 * @default 200
 *
 * @param Play Y
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Позиция Y
 * @type number
 * @default 100
 *
 * @param Play Img Norm
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Картинка: Спокойствие
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Play Img Hov
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Картинка: Нажатая кнопка
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Play Img Dis
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Картинка: Заблокировано
 * @type file
 * @dir img/pictures
 * @default
 * * @param Play SE
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Звук при нажатии
 * @type file
 * @dir audio/se
 * @default Load
 * * @param Play SE Vol
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param Play SE Pitch
 * @parent --- Кнопка: Воспроизведение (Load) ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @default
 *
 * @param Prev X
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Позиция X
 * @type number
 * @default 100
 *
 * @param Prev Y
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Позиция Y
 * @type number
 * @default 200
 *
 * @param Prev Img Norm
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Картинка: Спокойствие
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Prev Img Hov
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Картинка: Нажатая кнопка
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Prev Img Dis
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Картинка: Заблокировано
 * @type file
 * @dir img/pictures
 * @default
 * * @param Prev SE
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Звук при нажатии
 * @type file
 * @dir audio/se
 * @default Cursor1
 * * @param Prev SE Vol
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param Prev SE Pitch
 * @parent --- Кнопка: Перемотка Назад (Пред. Слот) ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @default
 *
 * @param Next X
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Позиция X
 * @type number
 * @default 200
 *
 * @param Next Y
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Позиция Y
 * @type number
 * @default 200
 *
 * @param Next Img Norm
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Картинка: Спокойствие
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Next Img Hov
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Картинка: Нажатая кнопка
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Next Img Dis
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Картинка: Заблокировано
 * @type file
 * @dir img/pictures
 * @default
 * * @param Next SE
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Звук при нажатии
 * @type file
 * @dir audio/se
 * @default Cursor1
 * * @param Next SE Vol
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param Next SE Pitch
 * @parent --- Кнопка: Перемотка Вперед (След. Слот) ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Кнопка: Стоп (Закрыть Меню) ---
 * @default
 *
 * @param Stop X
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Позиция X
 * @type number
 * @default 300
 *
 * @param Stop Y
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Позиция Y
 * @type number
 * @default 100
 *
 * @param Stop Img Norm
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Картинка: Спокойствие
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Stop Img Hov
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Картинка: Нажатая кнопка
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Stop Img Dis
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Картинка: Заблокировано
 * @type file
 * @dir img/pictures
 * @default
 * * @param Stop SE
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Звук при нажатии
 * @type file
 * @dir audio/se
 * @default Cancel1
 * * @param Stop SE Vol
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param Stop SE Pitch
 * @parent --- Кнопка: Стоп (Закрыть Меню) ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Кнопка: Назад (Выход в Главное Меню) ---
 * @default
 *
 * @param Back X
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Позиция X
 * @type number
 * @default 300
 *
 * @param Back Y
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Позиция Y
 * @type number
 * @default 200
 *
 * @param Back Img Norm
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Картинка: Спокойствие
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Back Img Hov
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Картинка: Нажатая кнопка
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Back Img Dis
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Картинка: Заблокировано
 * @type file
 * @dir img/pictures
 * @default
 * * @param Back SE
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Звук при нажатии
 * @type file
 * @dir audio/se
 * @default Cancel2
 * * @param Back SE Vol
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param Back SE Pitch
 * @parent --- Кнопка: Назад (Выход в Главное Меню) ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @param --- Экран Диктофона (Текст) ---
 * @default
 *
 * @param Text X
 * @parent --- Экран Диктофона (Текст) ---
 * @desc Позиция X для дисплея с информацией.
 * @type number
 * @default 400
 *
 * @param Text Y
 * @parent --- Экран Диктофона (Текст) ---
 * @desc Позиция Y для дисплея с информацией.
 * @type number
 * @default 150
 *
 * @param Text Font Size
 * @parent --- Экран Диктофона (Текст) ---
 * @desc Размер шрифта на дисплее
 * @type number
 * @default 24
 *
 * @param Text Color
 * @parent --- Экран Диктофона (Текст) ---
 * @desc Цвет текста (HEX, например #00ff00 для зеленого)
 * @default #00ff00
 *
 * @param --- Декорации ---
 * @default
 *
 * @param Diary X
 * @parent --- Декорации ---
 * @desc Дневник: Позиция X
 * @type number
 * @default 150
 *
 * @param Diary Y
 * @parent --- Декорации ---
 * @desc Дневник: Позиция Y
 * @type number
 * @default 300
 *
 * @param Diary Img
 * @parent --- Декорации ---
 * @desc Дневник: Картинка (из img/pictures)
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param Cassette X
 * @parent --- Декорации ---
 * @desc Кассета: Позиция X
 * @type number
 * @default 650
 *
 * @param Cassette Y
 * @parent --- Декорации ---
 * @desc Кассета: Позиция Y
 * @type number
 * @default 300
 *
 * @param Cassette Img
 * @parent --- Декорации ---
 * @desc Кассета: Картинка (из img/pictures)
 * @type file
 * @dir img/pictures
 * @default
 * * @param Cover X
 * @parent --- Декорации ---
 * @desc Крышка диктофона: Позиция X
 * @type number
 * @default 400
 *
 * @param Cover Y
 * @parent --- Декорации ---
 * @desc Крышка диктофона: Позиция Y
 * @type number
 * @default 300
 *
 * @param Cover Img
 * @parent --- Декорации ---
 * @desc Крышка диктофона: Картинка (из img/pictures)
 * @type file
 * @dir img/pictures
 * @default
 * * @param Clip X
 * @parent --- Декорации ---
 * @desc Скрепка: Позиция X
 * @type number
 * @default 200
 *
 * @param Clip Y
 * @parent --- Декорации ---
 * @desc Скрепка: Позиция Y
 * @type number
 * @default 100
 *
 * @param Clip Img
 * @parent --- Декорации ---
 * @desc Скрепка: Картинка (из img/pictures)
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param --- Скриншоты ---
 * @default
 * @param Snap X
 * @parent --- Скриншоты ---
 * @desc Позиция X скриншота на экране
 * @type number
 * @default 600
 * @param Snap Y
 * @parent --- Скриншоты ---
 * @desc Позиция Y скриншота на экране
 * @type number
 * @default 150
 * @param Snap Width
 * @parent --- Скриншоты ---
 * @desc Ширина скриншота (px)
 * @type number
 * @default 320
 * @param Snap Height
 * @parent --- Скриншоты ---
 * @desc Высота скриншота (px)
 * @type number
 * @default 180
 * @param Snap Quality
 * @parent --- Скриншоты ---
 * @desc Качество JPEG сжатия (1 - 100). Меньше = меньше лагов.
 * @type number
 * @default 70
 *
 * @param --- Список Сохранений ---
 * @default
 * @param List X
 * @parent --- Список Сохранений ---
 * @desc Позиция X списка на экране
 * @type number
 * @default 150
 * @param List Y
 * @parent --- Список Сохранений ---
 * @desc Позиция Y списка на экране
 * @type number
 * @default 450
 * @param List Width
 * @parent --- Список Сохранений ---
 * @desc Ширина списка (px)
 * @type number
 * @default 500
 * @param List Visible
 * @parent --- Список Сохранений ---
 * @desc Количество одновременно отображаемых строк
 * @type number
 * @default 5
 * @param List Font Size
 * @parent --- Список Сохранений ---
 * @desc Размер шрифта
 * @type number
 * @default 22
 * @param List Font Bold
 * @parent --- Список Сохранений ---
 * @desc Использовать жирный шрифт для списка?
 * @type boolean
 * @on Да
 * @off Нет
 * @default true
 * @param List Spacing
 * @parent --- Список Сохранений ---
 * @desc Отступ между строками в списке (px)
 * @type number
 * @default 10
 * @param List Color
 * @parent --- Список Сохранений ---
 * @desc Цвет обычного слота
 * @default #ffffff
 * @param List Highlight Color
 * @parent --- Список Сохранений ---
 * @desc Цвет выбранного слота
 * @default #ffff00
 * @param List Highlight Outline Color
 * @parent --- Список Сохранений ---
 * @desc Цвет обводки выбранного слота (HEX, например #000000)
 * @default #000000
 * @param List Highlight Outline Width
 * @parent --- Список Сохранений ---
 * @desc Толщина обводки выбранного слота
 * @type number
 * @default 4
 * @param Scroll Sensitivity
 * @parent --- Список Сохранений ---
 * @desc Чувствительность колесика мыши (чем меньше, тем чувствительнее). Стандарт: 20
 * @type number
 * @default 20
 * * @param List Select SE
 * @parent --- Список Сохранений ---
 * @desc Звук при выборе слота кликом
 * @type file
 * @dir audio/se
 * @default Cursor1
 * * @param List Select SE Vol
 * @parent --- Список Сохранений ---
 * @desc Громкость (0-100)
 * @type number
 * @default 90
 * * @param List Select SE Pitch
 * @parent --- Список Сохранений ---
 * @desc Тон (50-150)
 * @type number
 * @default 100
 *
 * @command SetSaveName
 * @text Установить имя сохранения
 * @desc Устанавливает имя для следующего сохранения (работает для MZ).
 *
 * @arg name
 * @text Имя кассеты
 * @desc Текст, который будет отображаться в списке сохранений
 * @type string
 *
 * @help
 * ============================================================================
 * SUPER DUPER SAVE (Dictaphone Edition)
 * ============================================================================
 * Это полностью кастомный интерфейс сохранения и загрузки.
 * * * КОМАНДА ПЛАГИНА (MV):
 * DictaphoneName [Ваш Текст]
 * Пример: DictaphoneName Психиатрическая больница, 1 этаж
 * Устанавливает собственное название для СЛЕДУЮЩЕГО сохранения.
 * (Для MZ используйте встроенную команду плагина в редакторе).
 *
 * * * РЕЖИМ РЕДАКТИРОВАНИЯ (ДРАГ-Н-ДРОП):
 * 1. Убедитесь, что параметр "Enable Editor" включен.
 * 2. Запустите игру из редактора (Playtest).
 * 3. Зайдите в меню сохранения/загрузки. Сверху появится панель с координатами.
 * 4. Хватайте любые кнопки или текст мышью и перетаскивайте куда нужно.
 * 5. Координаты на экране будут обновляться в реальном времени.
 * 6. Скопируйте нужные значения в настройки плагина.
 * 7. Выключите параметр "Enable Editor", когда закончите настройку.
 *
 * ЛОГИКА КНОПОК И УПРАВЛЕНИЯ:
 * - Запись (Record) [Клавиша: Enter]: Сохраняет игру один раз. Доступна только из игры.
 * - Воспроизведение (Play) [Клавиша: Enter]: Загружает игру. Блокируется, если 
 * слот пуст ИЛИ при входе из активной игры (до момента сохранения).
 * - Перемотка Назад (Prev) [Стрелки Влево/Вверх/Колесико Вверх]: Блокируется на 1-м слоте.
 * - Перемотка Вперед (Next) [Стрелки Вправо/Вниз/Колесико Вниз]: Блокируется на последнем слоте.
 * - Стоп (Stop) [Клавиша: Esc]: Возвращает обратно на карту. Блокируется из Титула.
 * - Назад (Back): Выход в Титульный экран. Если открыто из игры, 
 * активируется только после записи (сохранения).
 * ПРИМЕЧАНИЕ: Если Стоп заблокирован, нажатие ESC автоматически активирует Назад (Back).
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('SuperDuperSave');

    // --- Извлечение параметров ---
    var pEnableEditor = String(parameters['Enable Editor'] || 'true') === 'true';
    // Подключаем Core
    var core = (typeof SuperDuper !== 'undefined' && SuperDuper.Core) ? SuperDuper.Core : null;
    var scrW = core ? core.screen.width : 1280;
    var scrH = core ? core.screen.height : 720;

    // Процентные дефолты для координат (относительно 1280×720)
    function pctX(p) { return Math.round(scrW * p / 100); }
    function pctY(p) { return Math.round(scrH * p / 100); }

    var pMaxSlots = Number(parameters['Max Slots'] || 10);
    var pFadeInSpeed = Number(parameters['Fade In Duration'] || 60);
    var pIntroFadeOutSpeed = Number(parameters['Intro Fade Out Duration'] || 60);
    var pFadeOutSpeed = Number(parameters['Fade Out Duration'] || 60);
    
    // Музыка
    var pBackdropImage = String(parameters['Backdrop Image'] || '');
    var pBgImage = String(parameters['Background Image'] || '');
    var pBgBgm = String(parameters['Background BGM'] || '');
    var pBgmVol = Number(parameters['BGM Volume'] || 90);
    var pBgmPitch = Number(parameters['BGM Pitch'] || 100);

    // Скриншоты и Список (проценты: Snap ~47%,21%; List ~12%,63%)
    var pSnapX = parameters['Snap X'] ? Number(parameters['Snap X']) : pctX(47);
    var pSnapY = parameters['Snap Y'] ? Number(parameters['Snap Y']) : pctY(21);
    var pSnapW = Number(parameters['Snap Width'] || 320);
    var pSnapH = Number(parameters['Snap Height'] || 180);
    var pSnapQ = Number(parameters['Snap Quality'] || 70) / 100;

    var pListX = parameters['List X'] ? Number(parameters['List X']) : pctX(12);
    var pListY = parameters['List Y'] ? Number(parameters['List Y']) : pctY(63);
    var pListW = Number(parameters['List Width'] || 500);
    var pListVis = Number(parameters['List Visible'] || 5);
    var pListFontSize = Number(parameters['List Font Size'] || 22);
    var pListFontBold = String(parameters['List Font Bold'] || 'true') === 'true';
    var pListSpacing = Number(parameters['List Spacing'] || 10);
    var pListColor = String(parameters['List Color'] || '#ffffff');
    var pListHiColor = String(parameters['List Highlight Color'] || '#ffff00');
    var pListHiOutlineColor = String(parameters['List Highlight Outline Color'] || '#000000');
    var pListHiOutlineWidth = Number(parameters['List Highlight Outline Width'] || 4);
    var pScrollSens = Number(parameters['Scroll Sensitivity'] || 20);
    
    // Аудио для списка
    var pListSelectSe = String(parameters['List Select SE'] || '');
    var pListSelectSeVol = Number(parameters['List Select SE Vol'] || 90);
    var pListSelectSePitch = Number(parameters['List Select SE Pitch'] || 100);

    // Структура данных для парсинга параметров кнопок и звуков
    function parseBtnParams(prefix, pctXdef, pctYdef) {
        var rawX = parameters[prefix + ' X'];
        var rawY = parameters[prefix + ' Y'];
        return {
            x: rawX ? Number(rawX) : pctX(pctXdef),
            y: rawY ? Number(rawY) : pctY(pctYdef),
            imgNorm: String(parameters[prefix + ' Img Norm'] || ''),
            imgHov: String(parameters[prefix + ' Img Hov'] || ''),
            imgDis: String(parameters[prefix + ' Img Dis'] || ''),
            se: String(parameters[prefix + ' SE'] || ''),
            seVol: Number(parameters[prefix + ' SE Vol'] || 90),
            sePitch: Number(parameters[prefix + ' SE Pitch'] || 100)
        };
    }

    var cfgRecord = parseBtnParams('Rec', 55, 78);
    var cfgPlay = parseBtnParams('Play', 62, 78);
    var cfgPrev = parseBtnParams('Prev', 58, 78);
    var cfgNext = parseBtnParams('Next', 65, 78);
    var cfgStop = parseBtnParams('Stop', 68, 78);
    var cfgBack = parseBtnParams('Back', 72, 78);

    var pTextX = parameters['Text X'] ? Number(parameters['Text X']) : pctX(64);
    var pTextY = parameters['Text Y'] ? Number(parameters['Text Y']) : pctY(50);
    var pTextFontSize = Number(parameters['Text Font Size'] || 24);
    var pTextColor = String(parameters['Text Color'] || '#00ff00');

    // Параметры декораций (проценты: Diary 50,42 | Cassette 50,21 | Cover 31,42 | Clip 16,14)
    var cfgDiary = {
        x: parameters['Diary X'] ? Number(parameters['Diary X']) : pctX(50),
        y: parameters['Diary Y'] ? Number(parameters['Diary Y']) : pctY(42),
        img: String(parameters['Diary Img'] || '')
    };

    var cfgCassette = {
        x: parameters['Cassette X'] ? Number(parameters['Cassette X']) : pctX(50),
        y: parameters['Cassette Y'] ? Number(parameters['Cassette Y']) : pctY(21),
        img: String(parameters['Cassette Img'] || '')
    };

    var cfgCover = {
        x: parameters['Cover X'] ? Number(parameters['Cover X']) : pctX(31),
        y: parameters['Cover Y'] ? Number(parameters['Cover Y']) : pctY(42),
        img: String(parameters['Cover Img'] || '')
    };

    var cfgClip = {
        x: parameters['Clip X'] ? Number(parameters['Clip X']) : pctX(16),
        y: parameters['Clip Y'] ? Number(parameters['Clip Y']) : pctY(14),
        img: String(parameters['Clip Img'] || '')
    };

    // Воспроизведение звука кнопки
    function playBtnSe(cfg) {
        if (cfg && cfg.se) {
            AudioManager.playSe({ name: cfg.se, volume: cfg.seVol, pitch: cfg.sePitch, pan: 0 });
        }
    }

    // ======================================================================
    // 1. DATA MANAGER, SYSTEM & PLUGIN COMMANDS OVERRIDES
    // ======================================================================
    
    // Регистрация Команды Плагина (Поддержка MV)
    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'DictaphoneName') {
            $gameSystem._sdsCustomName = args.join(' ');
        }
    };

    // Регистрация Команды Плагина (Поддержка MZ)
    if (Utils.RPGMAKER_NAME === 'MZ') {
        PluginManager.registerCommand('SuperDuperSave', 'SetSaveName', function(args) {
            $gameSystem._sdsCustomName = args.name;
        });
    }

    var _DataManager_maxSavefiles = DataManager.maxSavefiles;
    DataManager.maxSavefiles = function() {
        return pMaxSlots;
    };

    var _DataManager_makeSavefileInfo = DataManager.makeSavefileInfo;
    DataManager.makeSavefileInfo = function() {
        var info = _DataManager_makeSavefileInfo.call(this);
        
        // Записываем кастомное имя (если задано), иначе имя карты, иначе имя игры
        var saveName = $gameSystem._sdsCustomName;
        if (!saveName) {
            saveName = $gameMap ? $gameMap.displayName() : '';
        }
        if (!saveName) {
            saveName = $dataSystem ? $dataSystem.gameTitle : "Сохранение";
        }
        info.title = saveName;

        // Зашиваем скриншот в файл сохранения, если он был сделан
        if ($gameTemp && $gameTemp._sdsSnapUrl) {
            info.snapUrl = $gameTemp._sdsSnapUrl;
        }
        return info;
    };

    // ОЧИСТИТЕЛЬ СОХРАНЕНИЙ (Санитайзер)
    // Лечим битые сохранения, созданные в предыдущих версиях плагина
    var _Game_System_onAfterLoad = Game_System.prototype.onAfterLoad;
    Game_System.prototype.onAfterLoad = function() {
        // Если сохранилась музыка диктофона - стираем её имя
        if (this._bgmOnSave && pBgBgm && this._bgmOnSave.name === pBgBgm) {
            this._bgmOnSave.name = '';
        }
        
        // Восстанавливаем объекты из небытия (null) в пустые болванки,
        // чтобы движок и аудио-плагины не падали при чтении свойств
        if (!this._bgmOnSave) {
            this._bgmOnSave = { name: '', volume: 100, pitch: 100, pan: 0 };
        }
        if (!this._bgsOnSave) {
            this._bgsOnSave = { name: '', volume: 100, pitch: 100, pan: 0 };
        }
        
        // ХИРУРГИЯ ДЛЯ OCRAM: Инъекция массива AEX, чтобы .forEach не падал
        if (typeof this._bgmOnSave.AEX === 'undefined') {
            this._bgmOnSave.AEX = [];
        }
        if (typeof this._bgsOnSave.AEX === 'undefined') {
            this._bgsOnSave.AEX = [];
        }

        // ЭКСТРЕННАЯ ЗАЩИТА: OcRam ожидает массив _bgsBuffers_OC в сохранении.
        // Если его нет (в старых или битых файлах) - создаем пустой, иначе краш.
        if (typeof this._bgsBuffers_OC === 'undefined' || this._bgsBuffers_OC === null) {
            this._bgsBuffers_OC = [];
        }

        _Game_System_onAfterLoad.call(this);
    };

    // Защита от движка при сохранении: Спуфинг (Подмена) текущего аудио
    // Вместо жесткого переписывания переменных после сохранения, мы обманываем движок до него.
    var _Game_System_onBeforeSave = Game_System.prototype.onBeforeSave;
    Game_System.prototype.onBeforeSave = function() {
        var spoofed = false;
        var tempBgm = null;
        var tempBgs = null;

        if (SceneManager._scene && SceneManager._scene instanceof Scene_Dictaphone) {
            if (SceneManager._scene._playCustomBgm) {
                spoofed = true;
                tempBgm = AudioManager._currentBgm;
                tempBgs = AudioManager._currentBgs;

                // Подставляем оригинальные треки с карты (со всеми метаданными)
                AudioManager._currentBgm = SceneManager._scene._lastBgm;
                AudioManager._currentBgs = SceneManager._scene._lastBgs;
            }
        }

        // Вызов стандартного сохранения (и плагина OcRam, который теперь видит правильную музыку)
        _Game_System_onBeforeSave.call(this);

        if (spoofed) {
            // Возвращаем диктофону его музыку для продолжения работы
            AudioManager._currentBgm = tempBgm;
            AudioManager._currentBgs = tempBgs;
        }
    };

    // ======================================================================
    // 1.5 SPRITE_DICTAPHONE_DECO (Класс Декораций)
    // ======================================================================
    function Sprite_DictaphoneDeco() {
        this.initialize.apply(this, arguments);
    }

    Sprite_DictaphoneDeco.prototype = Object.create(Sprite.prototype);
    Sprite_DictaphoneDeco.prototype.constructor = Sprite_DictaphoneDeco;

    Sprite_DictaphoneDeco.prototype.initialize = function(config, name, isLocked) {
        Sprite.prototype.initialize.call(this);
        this._btnName = name; // Имя для консоли (режим редактора)
        this._locked = isLocked; // Запрет на перетаскивание
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.x = config.x;
        this.y = config.y;

        if (config.img) {
            this.bitmap = ImageManager.loadPicture(config.img);
        } else {
            // Заглушка, если картинка не назначена
            this.bitmap = new Bitmap(100, 100);
            this.bitmap.fillAll('rgba(100, 100, 100, 0.5)');
            this.bitmap.drawText(name, 0, 0, 100, 100, 'center');
        }
    };

    Sprite_DictaphoneDeco.prototype.isHovered = function() {
        if (!this.bitmap || !this.bitmap.isReady()) return false;
        var w = this.bitmap.width;
        var h = this.bitmap.height;
        var left = this.x - w * this.anchor.x;
        var right = left + w;
        var top = this.y - h * this.anchor.y;
        var bottom = top + h;
        return TouchInput.x >= left && TouchInput.x <= right && TouchInput.y >= top && TouchInput.y <= bottom;
    };

    // ======================================================================
    // 2. SPRITE_DICTAPHONE_BUTTON (Класс Кнопки)
    // ======================================================================
    function Sprite_DictaphoneButton() {
        this.initialize.apply(this, arguments);
    }

    Sprite_DictaphoneButton.prototype = Object.create(Sprite.prototype);
    Sprite_DictaphoneButton.prototype.constructor = Sprite_DictaphoneButton;

    Sprite_DictaphoneButton.prototype.initialize = function(config, name) {
        Sprite.prototype.initialize.call(this);
        this._config = config;
        this._btnName = name; // Имя для консоли (режим редактора)
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        
        // Загружаем битмапы
        this._bmpNorm = config.imgNorm ? ImageManager.loadPicture(config.imgNorm) : new Bitmap(48, 48);
        this._bmpHov = config.imgHov ? ImageManager.loadPicture(config.imgHov) : this._bmpNorm;
        this._bmpDis = config.imgDis ? ImageManager.loadPicture(config.imgDis) : this._bmpNorm;

        if (!config.imgNorm) {
            // Заглушка, если картинки не назначены
            this._bmpNorm.fillAll('gray');
            this._bmpNorm.fontBold = true;
            this._bmpNorm.outlineWidth = 0;
            this._bmpNorm.drawText(name, 0, 0, 48, 48, 'center');
        }

        this.x = config.x;
        this.y = config.y;
        
        this._state = 0; // 0: Normal, 1: Pressed, 2: Disabled
        this._clickHandler = null;
        this._isDisabledFunc = null;
        
        this._hotkeys = [];
        this._pressTimer = 0;

        this.updateBitmap();
    };

    Sprite_DictaphoneButton.prototype.setClickHandler = function(method) {
        this._clickHandler = method;
    };

    Sprite_DictaphoneButton.prototype.setDisabledCondition = function(method) {
        this._isDisabledFunc = method;
    };
    
    Sprite_DictaphoneButton.prototype.setHotkeys = function(keysArray) {
        this._hotkeys = keysArray;
    };

    Sprite_DictaphoneButton.prototype.update = function() {
        Sprite.prototype.update.call(this);
        if (this.parent && this.parent._editorMode) return; // В режиме редактора логика кликов отключена
        
        this.updateClick();
        this.updateState();
    };

    Sprite_DictaphoneButton.prototype.updateState = function() {
        if (this._pressTimer > 0) {
            this._pressTimer--;
        }

        var wasState = this._state;

        if (this._isDisabledFunc && this._isDisabledFunc()) {
            this._state = 2; // Disabled
        } else if (this._pressTimer > 0) {
            this._state = 1; // Строго нажатие (на считанные тики)
        } else {
            this._state = 0; // Normal
        }

        if (wasState !== this._state) {
            this.updateBitmap();
        }
    };

    Sprite_DictaphoneButton.prototype.updateBitmap = function() {
        if (this._state === 2) {
            this.bitmap = this._bmpDis;
            this.opacity = 255;
        } else if (this._state === 1) {
            this.bitmap = this._bmpHov;
            this.opacity = 255;
        } else {
            this.bitmap = this._bmpNorm;
            this.opacity = 255;
        }
    };

    Sprite_DictaphoneButton.prototype.isHovered = function() {
        if (!this.bitmap || !this.bitmap.isReady()) return false;
        var w = this.bitmap.width;
        var h = this.bitmap.height;
        var left = this.x - w * this.anchor.x;
        var right = left + w;
        var top = this.y - h * this.anchor.y;
        var bottom = top + h;
        return TouchInput.x >= left && TouchInput.x <= right && TouchInput.y >= top && TouchInput.y <= bottom;
    };

    Sprite_DictaphoneButton.prototype.updateClick = function() {
        // Блокируем клики, если сцена находится в процессе затемнения (исправление бага переходов)
        if (SceneManager._scene && SceneManager._scene._isFadingAction) return;
        // Блокируем клики, если идет интро-затемнение
        if (SceneManager._scene && SceneManager._scene._introPhase > 0) return;

        var triggered = false;

        // Клик мышкой
        if (this.isHovered() && TouchInput.isTriggered()) {
            triggered = true;
        }

        // Горячие клавиши
        if (!triggered && this._hotkeys && this._hotkeys.length > 0) {
            for (var i = 0; i < this._hotkeys.length; i++) {
                var key = this._hotkeys[i];
                if (Input.isTriggered(key) || Input.isRepeated(key)) {
                    // Разрешаем зажатие только для стрелочек (для перемотки)
                    if (key === 'left' || key === 'right' || key === 'up' || key === 'down') {
                        triggered = true;
                        break;
                    } else if (Input.isTriggered(key)) {
                        triggered = true;
                        
                        // УМНЫЙ ESC: Если нажали cancel (ESC), но кнопка заблокирована (напр. мы в меню загрузки),
                        // передаем сигнал на кнопку Back, если это кнопка Stop.
                        if (key === 'cancel' && this._btnName === "Stop" && this._isDisabledFunc && this._isDisabledFunc()) {
                            triggered = false; // Отменяем нажатие на Стоп
                            if (SceneManager._scene._btnBack && !SceneManager._scene._btnBack._isDisabledFunc()) {
                                SceneManager._scene._btnBack._pressTimer = 10;
                                if (SceneManager._scene._btnBack._clickHandler) {
                                    SceneManager._scene._btnBack._clickHandler();
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }

        if (this._state !== 2 && triggered) {
            this._pressTimer = 10; // 10 кадров визуального нажатия
            if (this._clickHandler) {
                this._clickHandler();
            }
        }
    };

    // ======================================================================
    // 3. SPRITE_DICTAPHONE_DISPLAY (Дисплей на кассете)
    // ======================================================================
    function Sprite_DictaphoneDisplay() {
        this.initialize.apply(this, arguments);
    }

    Sprite_DictaphoneDisplay.prototype = Object.create(Sprite.prototype);
    Sprite_DictaphoneDisplay.prototype.constructor = Sprite_DictaphoneDisplay;

    Sprite_DictaphoneDisplay.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(400, 200);
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.x = pTextX;
        this.y = pTextY;
        this._btnName = "TextDisplay"; // Для редактора
    };

    Sprite_DictaphoneDisplay.prototype.refresh = function() {
        this.bitmap.clear();
        this.bitmap.fontBold = true;
        this.bitmap.outlineWidth = 0;
        this.bitmap.fontSize = pTextFontSize;
        this.bitmap.textColor = pTextColor;

        var title = $dataSystem ? $dataSystem.gameTitle : "Диктофон";
        var lh = pTextFontSize + 8;
        var yOffset = (this.bitmap.height - lh) / 2; // Строго по центру

        this.bitmap.drawText(title, 0, yOffset, 400, lh, 'center');
    };

    Sprite_DictaphoneDisplay.prototype.isHovered = function() {
        var w = this.bitmap.width;
        var h = this.bitmap.height;
        var left = this.x - w * this.anchor.x;
        var right = left + w;
        var top = this.y - h * this.anchor.y;
        var bottom = top + h;
        return TouchInput.x >= left && TouchInput.x <= right && TouchInput.y >= top && TouchInput.y <= bottom;
    };

    // ======================================================================
    // 3.1 SPRITE_DICTAPHONE_SNAP (Скриншот)
    // ======================================================================
    function Sprite_DictaphoneSnap() {
        this.initialize.apply(this, arguments);
    }

    Sprite_DictaphoneSnap.prototype = Object.create(Sprite.prototype);
    Sprite_DictaphoneSnap.prototype.constructor = Sprite_DictaphoneSnap;

    Sprite_DictaphoneSnap.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this.bitmap = new Bitmap(pSnapW, pSnapH);
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.x = pSnapX;
        this.y = pSnapY;
        this._btnName = "Screenshot"; // Для редактора
        this._drawFrame();
    };

    Sprite_DictaphoneSnap.prototype._drawFrame = function() {
        this.bitmap.clear();
        this.bitmap.fillAll('rgba(0, 0, 0, 0.5)');
        this.bitmap.fontBold = true;
        this.bitmap.outlineWidth = 0;
        this.bitmap.fontSize = 24;
        this.bitmap.textColor = '#ffffff';
        this.bitmap.drawText("Нет фото", 0, 0, pSnapW, pSnapH, 'center');
    };

    Sprite_DictaphoneSnap.prototype.refresh = function(info) {
        this.bitmap.clear();
        if (info && info.snapUrl) {
            var img = new Image();
            var bmp = this.bitmap;
            var w = pSnapW;
            var h = pSnapH;
            img.onload = function() {
                bmp.context.drawImage(img, 0, 0, w, h);
                bmp._setDirty();
            };
            img.src = info.snapUrl;
        } else {
            this._drawFrame();
        }
    };

    Sprite_DictaphoneSnap.prototype.isHovered = function() {
        var w = this.bitmap.width;
        var h = this.bitmap.height;
        var left = this.x - w * this.anchor.x;
        var right = left + w;
        var top = this.y - h * this.anchor.y;
        var bottom = top + h;
        return TouchInput.x >= left && TouchInput.x <= right && TouchInput.y >= top && TouchInput.y <= bottom;
    };

    // ======================================================================
    // 3.2 SPRITE_DICTAPHONE_LIST (Список Сохранений)
    // ======================================================================
    function Sprite_DictaphoneList() {
        this.initialize.apply(this, arguments);
    }

    Sprite_DictaphoneList.prototype = Object.create(Sprite.prototype);
    Sprite_DictaphoneList.prototype.constructor = Sprite_DictaphoneList;

    Sprite_DictaphoneList.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        var h = pListVis * (pListFontSize + pListSpacing); // Используем настраиваемую высоту и отступы
        this.bitmap = new Bitmap(pListW, h); // Используем настраиваемую ширину
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.x = pListX;
        this.y = pListY;
        this._btnName = "SaveList"; // Для редактора
        
        this._slotRects = []; // Хранит прямоугольники клика для каждого слота
    };

    Sprite_DictaphoneList.prototype.refresh = function(currentSlot, cachedInfo) {
        this.bitmap.clear();
        this.bitmap.fontBold = pListFontBold; // Применяем параметр жирности шрифта
        this.bitmap.fontSize = pListFontSize;
        
        var lh = pListFontSize + pListSpacing; // Высота строки с учетом отступа
        var w = this.bitmap.width;
        this._slotRects = [];
        
        // Рассчитываем, какие слоты показывать (центрируем текущий, если возможно)
        var startSlot = Math.max(1, currentSlot - Math.floor(pListVis / 2));
        if (startSlot + pListVis - 1 > pMaxSlots) {
            startSlot = Math.max(1, pMaxSlots - pListVis + 1);
        }
        
        var yy = 0;
        for (var i = 0; i < pListVis; i++) {
            var slotId = startSlot + i;
            if (slotId > pMaxSlots) break;
            
            // Сохраняем зону для клика мышью
            this._slotRects.push({
                id: slotId,
                y: yy,
                h: lh
            });

            var isValid = !!(cachedInfo && cachedInfo[slotId]);
            var info = isValid ? cachedInfo[slotId] : null;
            
            // Жестко стабилизируем параметры рендера для предотвращения утечек Canvas-кисти
            this.bitmap.paintOpacity = 255;
            
            if (slotId === currentSlot) {
                this.bitmap.textColor = pListHiColor;
                this.bitmap.outlineColor = pListHiOutlineColor;
                this.bitmap.outlineWidth = pListHiOutlineWidth;
            } else {
                this.bitmap.textColor = pListColor;
                this.bitmap.outlineColor = 'rgba(0, 0, 0, 0)'; // ПРИНУДИТЕЛЬНО прозрачный контур
                this.bitmap.outlineWidth = 0; // И нулевая ширина
            }
            
            var textLeft = "";
            var textRight = "";

            if (isValid && info) {
                var title = info.title || "Слот " + slotId;
                var time = info.playtime || "00:00:00";
                textLeft = slotId + ". " + title;
                textRight = "[" + time + "]";
            } else {
                textLeft = slotId + ". [ ПУСТО ]";
                textRight = "";
            }
            
            // Отрисовка названия слота по левому краю
            this.bitmap.drawText(textLeft, 0, yy, w, lh, 'left');
            // Отрисовка времени слота по правому краю
            if (textRight !== "") {
                this.bitmap.drawText(textRight, 0, yy, w, lh, 'right');
            }

            yy += lh;
        }
    };

    Sprite_DictaphoneList.prototype.isHovered = function() {
        var w = this.bitmap.width;
        var h = this.bitmap.height;
        var left = this.x - w * this.anchor.x;
        var right = left + w;
        var top = this.y - h * this.anchor.y;
        var bottom = top + h;
        return TouchInput.x >= left && TouchInput.x <= right && TouchInput.y >= top && TouchInput.y <= bottom;
    };
    
    // Проверка клика по конкретному слоту
    Sprite_DictaphoneList.prototype.getClickedSlotId = function() {
        if (!this.isHovered()) return null;
        var localY = TouchInput.y - (this.y - this.bitmap.height * this.anchor.y);
        for (var i = 0; i < this._slotRects.length; i++) {
            var rect = this._slotRects[i];
            if (localY >= rect.y && localY < rect.y + rect.h) {
                return rect.id;
            }
        }
        return null;
    };

    // ======================================================================
    // 4. SCENE_DICTAPHONE (Основная сцена)
    // ======================================================================
    function Scene_Dictaphone() {
        this.initialize.apply(this, arguments);
    }

    Scene_Dictaphone.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Dictaphone.prototype.constructor = Scene_Dictaphone;

    Scene_Dictaphone.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
        this._currentSlot = DataManager.lastAccessedSavefileId() || 1;
        this._editorMode = pEnableEditor && Utils.isOptionValid('test');
        this._draggedSprite = null;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._isFadingAction = false;
        this._actionCallback = null;
        
        // Флаги состояния для правильного управления логикой
        this._playCustomBgm = false; // Флаг: играем ли мы кастомный BGM?
        this._isGameLoaded = false;
        this._isExitingToTitle = false;
        this._hasSaved = false; // Блокировка повторного сохранения
        
        // Фаза кастомного появления
        this._introPhase = 0; 
        this._customFadeTimer = 0;
    };

    Scene_Dictaphone.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this._cachedGlobalInfo = DataManager.loadGlobalInfo();
        this._currentSlot = this.findLatestSaveSlot();
        this.createBackground();
        this.createDictaphoneUI();
        this.createEditorText();
        
        // --- СЛОИ ДЛЯ ПЛАВНОГО ПЕРЕХОДА (ИСПРАВЛЕНИЕ АРХИТЕКТУРНОЙ ШИЗЫ) ---
        // 1. Абсолютно черный фон, который перекроет UI диктофона в начале
        this._blackScreenSprite = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        this._blackScreenSprite.bitmap.fillAll('black');
        this.addChild(this._blackScreenSprite);

        // 2. Снимок предыдущей сцены поверх черного фона
        var bgBmp = SceneManager.backgroundBitmap();
        if (bgBmp) {
            this._prevScreenSprite = new Sprite(bgBmp);
        } else {
            this._prevScreenSprite = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
            this._prevScreenSprite.bitmap.fillAll('black');
        }
        this.addChild(this._prevScreenSprite);
    };

    Scene_Dictaphone.prototype.start = function() {
        Scene_MenuBase.prototype.start.call(this);

        // Гасим стандартный костыль движка, который вызывает мгновенный черный экран
        if (this._fadeSprite) {
            this._fadeSprite.opacity = 0; 
        }

        // Проверяем, зашли ли мы из игры (а не из Титула)
        var isFromGame = $gameParty && $gameParty.members().length > 0 && $gameMap.mapId() > 0;
        this._playCustomBgm = isFromGame; // Включаем музыку диктофона ТОЛЬКО если зашли из игры

        // Сохраняем текущую музыку (карты или титула) ДО того, как включим музыку диктофона
        this._lastBgm = AudioManager.saveBgm();
        this._lastBgs = AudioManager.saveBgs();
        
        // Запускаем BGM диктофона если указан и если мы из игры
        if (this._playCustomBgm) {
            // Жестко останавливаем звуки карты (BGM и BGS), чтобы они не мешали
            AudioManager.stopBgm();
            AudioManager.stopBgs(); 
            
            if (pBgBgm) {
                AudioManager.playBgm({ name: pBgBgm, volume: pBgmVol, pitch: pBgmPitch, pan: 0 });
            }
        }
        
        // Запуск элегантной двухэтапной процедуры появления
        this._introPhase = 1;
        this._customFadeTimer = Math.max(1, pIntroFadeOutSpeed);
    };

    Scene_Dictaphone.prototype.terminate = function() {
        Scene_MenuBase.prototype.terminate.call(this);
        
        // Возвращаем старую музыку только в том случае, если МЫ ЕЕ МЕНЯЛИ (зашли из игры),
        // и если мы не загружаем игру, и не выходим в главное меню (иначе музыка наложится)
        if (this._playCustomBgm && !this._isGameLoaded && !this._isExitingToTitle) {
            AudioManager.stopBgm(); // Останавливаем трек диктофона
            if (this._lastBgm && this._lastBgm.name) AudioManager.replayBgm(this._lastBgm);
            if (this._lastBgs && this._lastBgs.name) AudioManager.replayBgs(this._lastBgs);
        }
    };

    Scene_Dictaphone.prototype.reloadCachedInfo = function() {
        this._cachedGlobalInfo = DataManager.loadGlobalInfo();
    };

    Scene_Dictaphone.prototype.isSlotValid = function(slotId) {
        return !!(this._cachedGlobalInfo && this._cachedGlobalInfo[slotId]);
    };

    Scene_Dictaphone.prototype.getSlotInfo = function(slotId) {
        return (this._cachedGlobalInfo && this._cachedGlobalInfo[slotId])
            ? this._cachedGlobalInfo[slotId]
            : null;
    };

    Scene_Dictaphone.prototype.findLatestSaveSlot = function() {
        var latestSlot = 0;
        var latestTimestamp = 0;
        if (this._cachedGlobalInfo) {
            for (var i = 1; i <= pMaxSlots; i++) {
                var info = this._cachedGlobalInfo[i];
                if (info && info.timestamp > latestTimestamp) {
                    latestTimestamp = info.timestamp;
                    latestSlot = i;
                }
            }
        }
        return latestSlot > 0 ? latestSlot : (DataManager.lastAccessedSavefileId() || 1);
    };

    Scene_Dictaphone.prototype.createBackground = function() {
        // 1. Создаем самый дальний фон (Backdrop)
        this._backdropSprite = new Sprite();
        if (pBackdropImage) {
            this._backdropSprite.bitmap = ImageManager.loadPicture(pBackdropImage);
        } else {
            // Если картинки нет, заливаем черным
            this._backdropSprite.bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
            this._backdropSprite.bitmap.fillAll('black');
        }
        this.addChild(this._backdropSprite);

        // 2. Создаем фон самого диктофона (ложится поверх Backdrop)
        this._bgSprite = new Sprite();
        if (pBgImage) {
            this._bgSprite.bitmap = ImageManager.loadPicture(pBgImage);
            this.addChild(this._bgSprite);
        }
        // Если pBgImage не задано, мы просто не добавляем его на сцену, 
        // так как backdrop уже перекрыл пустоту черным фоном (или текстурой).
    };

    Scene_Dictaphone.prototype.createDictaphoneUI = function() {
        this._uiSprites = []; // Массив для редактора
        
        // Определяем режим сцены (передано из классов-наследников)
        var isLoadMode = (this._dictaphoneMode === 'load');
        var self = this;

        // Дневник (Декорация) - СЛОЙ НИЖЕ (Заблокирован)
        this._spriteDiary = new Sprite_DictaphoneDeco(cfgDiary, "Diary", true);
        this.addChild(this._spriteDiary);
        this._uiSprites.push(this._spriteDiary);

        // Кассета (Декорация) - СЛОЙ НИЖЕ (Заблокирован)
        this._spriteCassette = new Sprite_DictaphoneDeco(cfgCassette, "Cassette", true);
        this.addChild(this._spriteCassette);
        this._uiSprites.push(this._spriteCassette);

        // Скриншот - СЛОЙ ВЫШЕ
        this._spriteSnap = new Sprite_DictaphoneSnap();
        this.addChild(this._spriteSnap);
        this._uiSprites.push(this._spriteSnap);

        // Список сохранений - СЛОЙ ВЫШЕ
        this._spriteList = new Sprite_DictaphoneList();
        this.addChild(this._spriteList);
        this._uiSprites.push(this._spriteList);

        // Текстовый дисплей на кассете
        this._textDisplay = new Sprite_DictaphoneDisplay();
        this.addChild(this._textDisplay);
        this._uiSprites.push(this._textDisplay);

        // Кнопка: Запись (SAVE)
        this._btnRecord = new Sprite_DictaphoneButton(cfgRecord, "Record");
        this._btnRecord.setClickHandler(this.onRecordClick.bind(this));
        this._btnRecord.setHotkeys(['ok']); // Enter
        this._btnRecord.setDisabledCondition(function() {
            // Заблокировано в режиме загрузки ИЛИ если мы уже сохранились
            return isLoadMode || self._hasSaved;
        });
        this.addChild(this._btnRecord);
        this._uiSprites.push(this._btnRecord);

        // Кнопка: Воспроизведение (LOAD)
        this._btnPlay = new Sprite_DictaphoneButton(cfgPlay, "Play");
        this._btnPlay.setClickHandler(this.onPlayClick.bind(this));
        this._btnPlay.setHotkeys(['ok']); // Enter
        this._btnPlay.setDisabledCondition(function() {
            // Заблокировано, если слот пустой ИЛИ если мы в меню сохранения (до момента сохранения)
            var isEmpty = !self.isSlotValid(self._currentSlot);
            return isEmpty || (!isLoadMode && !self._hasSaved);
        });
        this.addChild(this._btnPlay);
        this._uiSprites.push(this._btnPlay);

        // Кнопка: Предыдущий слот
        this._btnPrev = new Sprite_DictaphoneButton(cfgPrev, "Prev");
        this._btnPrev.setClickHandler(this.onPrevClick.bind(this));
        this._btnPrev.setHotkeys(['left', 'up', 'pageup']); // Перемотка назад (стрелки)
        this._btnPrev.setDisabledCondition(function() {
            // Заблокировано, если мы на первом слоте
            return self._currentSlot <= 1;
        });
        this.addChild(this._btnPrev);
        this._uiSprites.push(this._btnPrev);

        // Кнопка: Следующий слот
        this._btnNext = new Sprite_DictaphoneButton(cfgNext, "Next");
        this._btnNext.setClickHandler(this.onNextClick.bind(this));
        this._btnNext.setHotkeys(['right', 'down', 'pagedown']); // Перемотка вперед (стрелки)
        this._btnNext.setDisabledCondition(function() {
            // Заблокировано, если мы на последнем слоте
            return self._currentSlot >= pMaxSlots;
        });
        this.addChild(this._btnNext);
        this._uiSprites.push(this._btnNext);

        // Кнопка: Стоп (Закрыть меню)
        this._btnStop = new Sprite_DictaphoneButton(cfgStop, "Stop");
        this._btnStop.setClickHandler(this.onStopClick.bind(this));
        this._btnStop.setHotkeys(['cancel']); // ESC / Num0
        this._btnStop.setDisabledCondition(function() {
            // Заблокировано, если зашли из главного меню (режим загрузки)
            return isLoadMode;
        });
        this.addChild(this._btnStop);
        this._uiSprites.push(this._btnStop);

        // Кнопка: Назад (Выход в Титул)
        this._btnBack = new Sprite_DictaphoneButton(cfgBack, "Back");
        this._btnBack.setClickHandler(this.onBackClick.bind(this));
        this._btnBack.setDisabledCondition(function() {
            // Заблокировано, если мы из игры (!isLoadMode) И еще не сохранились (!self._hasSaved)
            return !isLoadMode && !self._hasSaved;
        });
        this.addChild(this._btnBack);
        this._uiSprites.push(this._btnBack);

        // Крышка диктофона (Декорация) - СЛОЙ ВЫШЕ ВСЕГО (Подвижно)
        this._spriteCover = new Sprite_DictaphoneDeco(cfgCover, "Cover", false);
        this.addChild(this._spriteCover);
        this._uiSprites.push(this._spriteCover);

        // Скрепка (Декорация) - СЛОЙ ВЫШЕ ВСЕГО (Подвижно)
        this._spriteClip = new Sprite_DictaphoneDeco(cfgClip, "Clip", false);
        this.addChild(this._spriteClip);
        this._uiSprites.push(this._spriteClip);

        this.refreshDisplay();
    };

    Scene_Dictaphone.prototype.createEditorText = function() {
        this._editorText = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
        this._editorText.visible = this._editorMode;
        this.addChild(this._editorText);
        
        if (this._editorMode) {
            this.refreshEditorText();
        }
    };

    Scene_Dictaphone.prototype.refreshEditorText = function() {
        var bmp = this._editorText.bitmap;
        bmp.clear();

        if (!this._editorMode) return;

        var lh = 28;
        var startY = 10;
        var totalHeight = 40 + this._uiSprites.length * lh;

        // Рисуем полупрозрачный фон-подложку по центру сверху, чтобы текст был всегда читаемым
        bmp.fillRect(Graphics.boxWidth / 2 - 200, startY, 400, totalHeight, 'rgba(0, 0, 0, 0.6)');

        // Заголовок
        bmp.fontSize = 28;
        bmp.textColor = '#ff0000'; // Красный цвет
        bmp.drawText("[ РЕЖИМ РЕДАКТИРОВАНИЯ ]", 0, startY + 5, Graphics.boxWidth, 32, 'center');

        // Список координат элементов
        bmp.fontSize = 22;
        bmp.textColor = '#ffff00'; // Желтый цвет
        var yy = startY + 40;
        for (var i = 0; i < this._uiSprites.length; i++) {
            var spr = this._uiSprites[i];
            var text = spr._btnName + " => X: " + spr.x + " | Y: " + spr.y;
            bmp.drawText(text, 0, yy, Graphics.boxWidth, lh, 'center');
            yy += lh;
        }
    };

    Scene_Dictaphone.prototype.refreshDisplay = function() {
        var info = this.getSlotInfo(this._currentSlot);
        
        // Обновляем все информационные модули
        this._textDisplay.refresh();
        this._spriteSnap.refresh(info);
        this._spriteList.refresh(this._currentSlot, this._cachedGlobalInfo);
    };

    // --- Действия кнопок ---
    
    // Вспомогательная функция для плавного затемнения перед переходом
    Scene_Dictaphone.prototype.fadeOutAndAction = function(actionCallback) {
        if (this._isFadingAction) return;
        this._isFadingAction = true;
        this._actionCallback = actionCallback;
        this.startFadeOut(pFadeOutSpeed, false);
    };

    Scene_Dictaphone.prototype.onRecordClick = function() {
        if (this._isFadingAction || this._hasSaved) return; // Защита от двойного нажатия
        
        // Генерируем скриншот игры
        if (pSnapW > 0 && pSnapH > 0) {
            var bgBmp = SceneManager.backgroundBitmap();
            if (bgBmp) {
                var capW = pSnapW * 2, capH = pSnapH * 2;
                var snapBmp = new Bitmap(capW, capH);
                snapBmp.blt(bgBmp, 0, 0, bgBmp.width, bgBmp.height, 0, 0, capW, capH);
                if (!$gameTemp) $gameTemp = {};
                $gameTemp._sdsSnapUrl = snapBmp.canvas.toDataURL('image/jpeg', pSnapQ);
            }
        }
        
        if (DataManager.saveGame(this._currentSlot)) {
            playBtnSe(cfgRecord);
            this._hasSaved = true; // Блокируем кнопку Record и разблокируем Back и Play
            this.reloadCachedInfo();
            this.refreshDisplay();
        } else {
            SoundManager.playBuzzer();
        }

        // Очищаем буфер снимка
        if ($gameTemp) $gameTemp._sdsSnapUrl = null;
    };

    Scene_Dictaphone.prototype.onPlayClick = function() {
        if (this._isFadingAction) return;
        playBtnSe(cfgPlay);
        
        // Гасим аудио параллельно с затуханием экрана
        var time = pFadeOutSpeed / 60;
        if (this._playCustomBgm && pBgBgm) {
            AudioManager.fadeOutBgm(time);
        }

        this.fadeOutAndAction(function() {
            // Перед самой загрузкой полностью очищаем все потоки
            AudioManager.stopAll();

            var savefileId = this._currentSlot;
            
            // Функция перехода после успешной подгрузки данных
            var executeGoto = function() {
                this._isGameLoaded = true;
                if ($gameSystem.onAfterLoad) {
                    $gameSystem.onAfterLoad();
                }
                SceneManager._sdsNeedsFadeIn = true; // Заряжаем осветление для карты
                SceneManager.goto(Scene_Map);
            }.bind(this);

            // Обработка асинхронности (MZ) и синхронности (MV) загрузки
            var result = DataManager.loadGame(savefileId);
            if (result && typeof result.then === 'function') {
                // Поддержка RPG Maker MZ (Асинхронные промисы)
                result.then(executeGoto).catch(function() {
                    SoundManager.playBuzzer();
                    this._isFadingAction = false;
                    // Восстанавливаем из тьмы
                    this._introPhase = 2; 
                    this._blackScreenSprite.visible = true;
                    this._blackScreenSprite.opacity = 255;
                    this._customFadeTimer = Math.max(1, pFadeInSpeed);
                }.bind(this));
            } else if (result) {
                // Поддержка RPG Maker MV (Синхронный метод)
                executeGoto();
            } else {
                // Провал загрузки MV
                SoundManager.playBuzzer();
                this._isFadingAction = false;
                this._introPhase = 2;
                this._blackScreenSprite.visible = true;
                this._blackScreenSprite.opacity = 255;
                this._customFadeTimer = Math.max(1, pFadeInSpeed);
            }
        }.bind(this));
    };

    Scene_Dictaphone.prototype.onPrevClick = function() {
        if (this._isFadingAction) return;
        playBtnSe(cfgPrev);
        this._currentSlot--;
        this.refreshDisplay();
    };

    Scene_Dictaphone.prototype.onNextClick = function() {
        if (this._isFadingAction) return;
        playBtnSe(cfgNext);
        this._currentSlot++;
        this.refreshDisplay();
    };

    Scene_Dictaphone.prototype.onStopClick = function() {
        if (this._isFadingAction) return;
        playBtnSe(cfgStop);
        
        // Плавно гасим музыку меню при выходе обратно в игру
        if (this._playCustomBgm && pBgBgm) {
            var time = pFadeOutSpeed / 60;
            AudioManager.fadeOutBgm(time);
        }

        this.fadeOutAndAction(function() {
            SceneManager._sdsNeedsFadeIn = true; // Заряжаем осветление для предыдущей сцены
            this.popScene();
        }.bind(this));
    };

    Scene_Dictaphone.prototype.onBackClick = function() {
        if (this._isFadingAction) return;
        playBtnSe(cfgBack);
        
        var time = pFadeOutSpeed / 60;
        
        if (this._playCustomBgm) {
            AudioManager.fadeOutBgm(time);
            AudioManager.fadeOutBgs(time);
            AudioManager.fadeOutMe(time);
        }

        this.fadeOutAndAction(function() {
            if (this._playCustomBgm) {
                AudioManager.stopAll();
            }
            this._isExitingToTitle = true;
            SceneManager._sdsNeedsFadeIn = true; // Заряжаем осветление
            SceneManager.goto(Scene_Title);
        }.bind(this));
    };

    // --- Обновление кадра (Update) ---

    Scene_Dictaphone.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);

        var speedIn = Math.max(1, pFadeInSpeed);
        var speedIntroOut = Math.max(1, pIntroFadeOutSpeed);

        // --- ДВУХЭТАПНОЕ ПОЯВЛЕНИЕ ---
        if (this._introPhase === 1) {
            // Этап 1: Растворение старой сцены в темноту
            this._customFadeTimer--;
            this._prevScreenSprite.opacity = (this._customFadeTimer / speedIntroOut) * 255;
            if (this._customFadeTimer <= 0) {
                this._introPhase = 2;
                this._customFadeTimer = speedIn;
            }
            return; // Блокируем остальной апдейт
        } else if (this._introPhase === 2) {
            // Этап 2: Проявление диктофона из темноты
            this._customFadeTimer--;
            this._blackScreenSprite.opacity = (this._customFadeTimer / speedIn) * 255;
            if (this._customFadeTimer <= 0) {
                this._introPhase = 0; // Конец интро
                this._prevScreenSprite.visible = false;
                this._blackScreenSprite.visible = false;
            }
            return; // Все еще блокируем
        }

        // Логика перехода: ждем полного завершения затемнения при выходе
        if (this._isFadingAction && (!this._fadeDuration || this._fadeDuration === 0)) {
            if (this._actionCallback) {
                var callback = this._actionCallback;
                this._actionCallback = null;
                callback.call(this);
            }
        } else if (!this._isFadingAction) {
            if (this._editorMode) {
                this.updateEditorDrag();
            }
            // Всегда разрешаем работу со списком (скролл и клики), если не тащим элемент в редакторе
            if (!this._draggedSprite) {
                this.updateListInput();
            }
        }
    };
    
    Scene_Dictaphone.prototype.updateListInput = function() {
        // Скролл колесиком
        if (TouchInput.wheelY >= pScrollSens) { // Вниз
            if (this._currentSlot < pMaxSlots && !this._btnNext._isDisabledFunc()) {
                // Имитируем нажатие кнопки Next
                this._btnNext._pressTimer = 10;
                this._btnNext._clickHandler();
            }
        } else if (TouchInput.wheelY <= -pScrollSens) { // Вверх
            if (this._currentSlot > 1 && !this._btnPrev._isDisabledFunc()) {
                // Имитируем нажатие кнопки Prev
                this._btnPrev._pressTimer = 10;
                this._btnPrev._clickHandler();
            }
        }

        // Клик по элементу списка
        if (TouchInput.isTriggered() && this._spriteList) {
            var clickedSlot = this._spriteList.getClickedSlotId();
            if (clickedSlot !== null && clickedSlot !== this._currentSlot) {
                if (pListSelectSe) {
                    AudioManager.playSe({ name: pListSelectSe, volume: pListSelectSeVol, pitch: pListSelectSePitch, pan: 0 });
                } else {
                    SoundManager.playCursor(); // Резервный звук
                }
                this._currentSlot = clickedSlot;
                this.refreshDisplay();
            }
        }
    };

    // --- Логика Режима Редактора ---

    Scene_Dictaphone.prototype.updateEditorDrag = function() {
        if (TouchInput.isTriggered()) {
            // Ищем спрайт под курсором (с конца, чтобы брать верхние)
            for (var i = this._uiSprites.length - 1; i >= 0; i--) {
                var spr = this._uiSprites[i];
                if (spr._locked) continue; // Пропускаем заблокированные элементы (блокнот, кассета)
                if (spr.isHovered && spr.isHovered()) {
                    this._draggedSprite = spr;
                    this._dragOffsetX = spr.x - TouchInput.x;
                    this._dragOffsetY = spr.y - TouchInput.y;
                    spr.opacity = 150; // Визуально выделяем
                    break;
                }
            }
        } else if (TouchInput.isPressed() && this._draggedSprite) {
            this._draggedSprite.x = Math.round(TouchInput.x + this._dragOffsetX);
            this._draggedSprite.y = Math.round(TouchInput.y + this._dragOffsetY);
            this.refreshEditorText(); // Обновляем координаты в реальном времени при перетаскивании
        } else if (!TouchInput.isPressed() && this._draggedSprite) {
            this._draggedSprite.opacity = 255; // Возвращаем нормальный вид
            this._draggedSprite = null;
            this.refreshEditorText(); // Финальное обновление при отпускании
            this.printCoordinatesToConsole();
        }
    };

    Scene_Dictaphone.prototype.printCoordinatesToConsole = function() {
        console.log("=========================================");
        console.log("=== КООРДИНАТЫ ДЛЯ SuperDuperSave.js ===");
        console.log("=========================================");
        
        for (var i = 0; i < this._uiSprites.length; i++) {
            var spr = this._uiSprites[i];
            console.log(spr._btnName + " X: " + spr.x);
            console.log(spr._btnName + " Y: " + spr.y);
            console.log("-----------------------------------------");
        }
        console.log("Скопируйте эти значения в параметры плагина!");
        console.log("=========================================");
    };

    // ======================================================================
    // 5. ПОЛНАЯ ПОДМЕНА СТАНДАРТНЫХ СЦЕН
    // ======================================================================
    
    // Перехватываем стандартную сцену сохранения и заставляем её использовать Диктофон
    Scene_Save.prototype = Object.create(Scene_Dictaphone.prototype);
    Scene_Save.prototype.constructor = Scene_Save;
    Scene_Save.prototype.initialize = function() {
        Scene_Dictaphone.prototype.initialize.call(this);
        this._dictaphoneMode = 'save'; // Идентификатор режима
    };

    // Перехватываем стандартную сцену загрузки и заставляем её использовать Диктофон
    Scene_Load.prototype = Object.create(Scene_Dictaphone.prototype);
    Scene_Load.prototype.constructor = Scene_Load;
    Scene_Load.prototype.initialize = function() {
        Scene_Dictaphone.prototype.initialize.call(this);
        this._dictaphoneMode = 'load'; // Идентификатор режима
    };

    // ======================================================================
    // 6. ИНЪЕКЦИЯ ВОЗВРАТНОГО ОСВЕТЛЕНИЯ В БАЗОВУЮ СЦЕНУ
    // ======================================================================
    var _Scene_Base_start = Scene_Base.prototype.start;
    Scene_Base.prototype.start = function() {
        _Scene_Base_start.call(this);
        // Если мы закрыли диктофон, следующая сцена получит приказ плавно проявиться из темноты
        if (SceneManager._sdsNeedsFadeIn) {
            var speed = Number(PluginManager.parameters('SuperDuperSave')['Fade Out Duration'] || 60);
            this.startFadeIn(speed, false);
            SceneManager._sdsNeedsFadeIn = false;
        }
    };

})();