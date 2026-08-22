/**
 * DatabaseUIEditor - the game UI studio tab (S16): every screen's tuning
 * in one place, section per screen, data-driven form rendering.
 *
 * Sub-categories: Инвентарь (Visual/Sound JSON groups of SuperDuperInventory)
 * Сохранение, Титул, Заставка, Гейм-овер, Сообщения, Выборы, Настройки,
 * Крафт UI + a HUD button (HUDMaker edits data/MapHUD.json with its own
 * in-game visual editor - not duplicated here).
 *
 * Field definitions mirror the plugins' @param blocks (key/type/group);
 * rendering is generic: number/bool/string/color/file(text) inputs grouped
 * by the plugin's own parent headers. Sections feed the live plugins via
 * the bridge merge (transitional mode).
 */
class DatabaseUIEditor {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
    }

    _tt(text) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(text) : text;
    }

    getSection(name) {
        const data = this.databaseManager.data;
        if (!data.agonia) data.agonia = DatabaseManager.agoniaDefaults();
        const defaults = DatabaseManager.agoniaDefaults();
        if (!data.agonia[name]) data.agonia[name] = defaults[name];
        return data.agonia[name];
    }

        /** Generated from the plugins' @param blocks (key/type/group). */
    static get FIELD_DEFS() {
        return {
     "save": [
      {
       "key": "Enable Editor",
       "type": "bool",
       "group": "Основные Настройки",
       "file": false
      },
      {
       "key": "Max Slots",
       "type": "number",
       "group": "Основные Настройки",
       "file": false
      },
      {
       "key": "Fade In Duration",
       "type": "number",
       "group": "Основные Настройки",
       "file": false
      },
      {
       "key": "Intro Fade Out Duration",
       "type": "number",
       "group": "Основные Настройки",
       "file": false
      },
      {
       "key": "Fade Out Duration",
       "type": "number",
       "group": "Основные Настройки",
       "file": false
      },
      {
       "key": "BGM Volume",
       "type": "number",
       "group": "Аудио: Фон",
       "file": false
      },
      {
       "key": "BGM Pitch",
       "type": "number",
       "group": "Аудио: Фон",
       "file": false
      },
      {
       "key": "Rec X",
       "type": "number",
       "group": "Кнопка: Запись (Save)",
       "file": false
      },
      {
       "key": "Rec Y",
       "type": "number",
       "group": "Кнопка: Запись (Save)",
       "file": false
      },
      {
       "key": "Rec SE",
       "type": "string",
       "group": "Кнопка: Запись (Save)",
       "file": true
      },
      {
       "key": "Rec SE Vol",
       "type": "number",
       "group": "Кнопка: Запись (Save)",
       "file": false
      },
      {
       "key": "Rec SE Pitch",
       "type": "number",
       "group": "Кнопка: Запись (Save)",
       "file": false
      },
      {
       "key": "Play X",
       "type": "number",
       "group": "Кнопка: Воспроизведение (Load)",
       "file": false
      },
      {
       "key": "Play Y",
       "type": "number",
       "group": "Кнопка: Воспроизведение (Load)",
       "file": false
      },
      {
       "key": "Play SE",
       "type": "string",
       "group": "Кнопка: Воспроизведение (Load)",
       "file": true
      },
      {
       "key": "Play SE Vol",
       "type": "number",
       "group": "Кнопка: Воспроизведение (Load)",
       "file": false
      },
      {
       "key": "Play SE Pitch",
       "type": "number",
       "group": "Кнопка: Воспроизведение (Load)",
       "file": false
      },
      {
       "key": "Prev X",
       "type": "number",
       "group": "Кнопка: Перемотка Назад (Пред. Слот)",
       "file": false
      },
      {
       "key": "Prev Y",
       "type": "number",
       "group": "Кнопка: Перемотка Назад (Пред. Слот)",
       "file": false
      },
      {
       "key": "Prev SE",
       "type": "string",
       "group": "Кнопка: Перемотка Назад (Пред. Слот)",
       "file": true
      },
      {
       "key": "Prev SE Vol",
       "type": "number",
       "group": "Кнопка: Перемотка Назад (Пред. Слот)",
       "file": false
      },
      {
       "key": "Prev SE Pitch",
       "type": "number",
       "group": "Кнопка: Перемотка Назад (Пред. Слот)",
       "file": false
      },
      {
       "key": "Next X",
       "type": "number",
       "group": "Кнопка: Перемотка Вперед (След. Слот)",
       "file": false
      },
      {
       "key": "Next Y",
       "type": "number",
       "group": "Кнопка: Перемотка Вперед (След. Слот)",
       "file": false
      },
      {
       "key": "Next SE",
       "type": "string",
       "group": "Кнопка: Перемотка Вперед (След. Слот)",
       "file": true
      },
      {
       "key": "Next SE Vol",
       "type": "number",
       "group": "Кнопка: Перемотка Вперед (След. Слот)",
       "file": false
      },
      {
       "key": "Next SE Pitch",
       "type": "number",
       "group": "Кнопка: Перемотка Вперед (След. Слот)",
       "file": false
      },
      {
       "key": "Stop X",
       "type": "number",
       "group": "Кнопка: Стоп (Закрыть Меню)",
       "file": false
      },
      {
       "key": "Stop Y",
       "type": "number",
       "group": "Кнопка: Стоп (Закрыть Меню)",
       "file": false
      },
      {
       "key": "Stop SE",
       "type": "string",
       "group": "Кнопка: Стоп (Закрыть Меню)",
       "file": true
      },
      {
       "key": "Stop SE Vol",
       "type": "number",
       "group": "Кнопка: Стоп (Закрыть Меню)",
       "file": false
      },
      {
       "key": "Stop SE Pitch",
       "type": "number",
       "group": "Кнопка: Стоп (Закрыть Меню)",
       "file": false
      },
      {
       "key": "Back X",
       "type": "number",
       "group": "Кнопка: Назад (Выход в Главное Меню)",
       "file": false
      },
      {
       "key": "Back Y",
       "type": "number",
       "group": "Кнопка: Назад (Выход в Главное Меню)",
       "file": false
      },
      {
       "key": "Back SE",
       "type": "string",
       "group": "Кнопка: Назад (Выход в Главное Меню)",
       "file": true
      },
      {
       "key": "Back SE Vol",
       "type": "number",
       "group": "Кнопка: Назад (Выход в Главное Меню)",
       "file": false
      },
      {
       "key": "Back SE Pitch",
       "type": "number",
       "group": "Кнопка: Назад (Выход в Главное Меню)",
       "file": false
      },
      {
       "key": "Text X",
       "type": "number",
       "group": "Экран Диктофона (Текст)",
       "file": false
      },
      {
       "key": "Text Y",
       "type": "number",
       "group": "Экран Диктофона (Текст)",
       "file": false
      },
      {
       "key": "Text Font Size",
       "type": "number",
       "group": "Экран Диктофона (Текст)",
       "file": false
      },
      {
       "key": "Text Color",
       "type": "string",
       "group": "Экран Диктофона (Текст)",
       "file": false
      },
      {
       "key": "Diary X",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Diary Y",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Cassette X",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Cassette Y",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Cover X",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Cover Y",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Clip X",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Clip Y",
       "type": "number",
       "group": "Декорации",
       "file": false
      },
      {
       "key": "Snap X",
       "type": "number",
       "group": "Скриншоты",
       "file": false
      },
      {
       "key": "Snap Y",
       "type": "number",
       "group": "Скриншоты",
       "file": false
      },
      {
       "key": "Snap Width",
       "type": "number",
       "group": "Скриншоты",
       "file": false
      },
      {
       "key": "Snap Height",
       "type": "number",
       "group": "Скриншоты",
       "file": false
      },
      {
       "key": "Snap Quality",
       "type": "number",
       "group": "Скриншоты",
       "file": false
      },
      {
       "key": "List X",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Y",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Width",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Visible",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Font Size",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Font Bold",
       "type": "bool",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Spacing",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Color",
       "type": "string",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Highlight Color",
       "type": "string",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Highlight Outline Color",
       "type": "string",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Highlight Outline Width",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "Scroll Sensitivity",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Select SE",
       "type": "string",
       "group": "Список Сохранений",
       "file": true
      },
      {
       "key": "List Select SE Vol",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      },
      {
       "key": "List Select SE Pitch",
       "type": "number",
       "group": "Список Сохранений",
       "file": false
      }
     ],
     "title": [
      {
       "key": "Animation Mode",
       "type": "string",
       "group": "Main",
       "file": false
      },
      {
       "key": "Left & Right Input",
       "type": "bool",
       "group": "Main",
       "file": false
      },
      {
       "key": "Com Fade-In Duration",
       "type": "number",
       "group": "Main",
       "file": false
      },
      {
       "key": "Slide X-Axis",
       "type": "number",
       "group": "Main",
       "file": false
      },
      {
       "key": "Slide Y-Axis",
       "type": "number",
       "group": "Main",
       "file": false
      },
      {
       "key": "Smart Background",
       "type": "bool",
       "group": "Smart Background",
       "file": false
      },
      {
       "key": "Background X-Axis",
       "type": "number",
       "group": "Smart Background",
       "file": false
      },
      {
       "key": "Background Y-Axis",
       "type": "number",
       "group": "Smart Background",
       "file": false
      },
      {
       "key": "Background Fade-In Duration",
       "type": "number",
       "group": "Smart Background",
       "file": false
      },
      {
       "key": "Title Sprite",
       "type": "bool",
       "group": "Title Sprite",
       "file": false
      },
      {
       "key": "Title Sprite X-Axis",
       "type": "string",
       "group": "Title Sprite",
       "file": false
      },
      {
       "key": "Title Sprite Y-Axis",
       "type": "string",
       "group": "Title Sprite",
       "file": false
      },
      {
       "key": "Fade-In Duration",
       "type": "number",
       "group": "Title Sprite",
       "file": false
      },
      {
       "key": "Zoom Effect",
       "type": "bool",
       "group": "Title Sprite",
       "file": false
      },
      {
       "key": "Zoom Speed",
       "type": "number",
       "group": "Title Sprite",
       "file": false
      },
      {
       "key": "Cursor X-Axis",
       "type": "string",
       "group": "Cursor",
       "file": false
      },
      {
       "key": "Cursor Y-Axis",
       "type": "string",
       "group": "Cursor",
       "file": false
      },
      {
       "key": "Cursor Visible",
       "type": "bool",
       "group": "Cursor",
       "file": false
      },
      {
       "key": "Cursor Wave Animation",
       "type": "bool",
       "group": "Cursor",
       "file": false
      },
      {
       "key": "Cursor Rotation Animation",
       "type": "bool",
       "group": "Cursor",
       "file": false
      },
      {
       "key": "Cursor Rotation Speed",
       "type": "string",
       "group": "Cursor",
       "file": false
      },
      {
       "key": "Command Pos 1",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 2",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 3",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 4",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 5",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 6",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 7",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 8",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 9",
       "type": "string",
       "group": "Commands",
       "file": false
      },
      {
       "key": "Command Pos 10",
       "type": "string",
       "group": "Commands",
       "file": false
      }
     ],
     "splash": [
      {
       "key": "Enable Splash",
       "type": "bool",
       "group": "Настройки",
       "file": false
      },
      {
       "key": "Splash Image",
       "type": "string",
       "group": "Настройки",
       "file": true
      },
      {
       "key": "Logo Preset",
       "type": "string",
       "group": "Настройки",
       "file": false
      },
      {
       "key": "Static Sound",
       "type": "string",
       "group": "Настройки",
       "file": true
      },
      {
       "key": "Power Off SE",
       "type": "string",
       "group": "Настройки",
       "file": true
      },
      {
       "key": "Vignette Radius",
       "type": "number",
       "group": "Настройки Виньетки",
       "file": false
      },
      {
       "key": "Vignette Softness",
       "type": "number",
       "group": "Настройки Виньетки",
       "file": false
      },
      {
       "key": "Vignette Opacity",
       "type": "number",
       "group": "Настройки Виньетки",
       "file": false
      },
      {
       "key": "Phase 0 Time",
       "type": "number",
       "group": "Настройки",
       "file": false
      },
      {
       "key": "Phase 1 Time",
       "type": "number",
       "group": "Настройки",
       "file": false
      },
      {
       "key": "Phase 2 Time",
       "type": "number",
       "group": "Настройки",
       "file": false
      },
      {
       "key": "Phase 3 Time",
       "type": "number",
       "group": "Настройки",
       "file": false
      },
      {
       "key": "Phase 4 Time",
       "type": "number",
       "group": "Настройки",
       "file": false
      }
     ],
     "gameover": [
      {
       "key": "Text Checkpoint",
       "type": "string",
       "group": "Тексты Меню",
       "file": false
      },
      {
       "key": "Text SaveMenu",
       "type": "string",
       "group": "Тексты Меню",
       "file": false
      },
      {
       "key": "Text Title",
       "type": "string",
       "group": "Тексты Меню",
       "file": false
      },
      {
       "key": "Menu Y Offset",
       "type": "number",
       "group": "Тексты Меню",
       "file": false
      },
      {
       "key": "Cursor Sound File",
       "type": "string",
       "group": "Звуки Интерфейса",
       "file": true
      },
      {
       "key": "Cursor Volume",
       "type": "number",
       "group": "Звуки Интерфейса",
       "file": false
      },
      {
       "key": "Cursor Pitch",
       "type": "number",
       "group": "Звуки Интерфейса",
       "file": false
      },
      {
       "key": "Ok Sound File",
       "type": "string",
       "group": "Звуки Интерфейса",
       "file": true
      },
      {
       "key": "Ok Volume",
       "type": "number",
       "group": "Звуки Интерфейса",
       "file": false
      },
      {
       "key": "Ok Pitch",
       "type": "number",
       "group": "Звуки Интерфейса",
       "file": false
      },
      {
       "key": "Buzzer Sound File",
       "type": "string",
       "group": "Звуки Интерфейса",
       "file": true
      },
      {
       "key": "Buzzer Volume",
       "type": "number",
       "group": "Звуки Интерфейса",
       "file": false
      },
      {
       "key": "Buzzer Pitch",
       "type": "number",
       "group": "Звуки Интерфейса",
       "file": false
      },
      {
       "key": "Static BGS",
       "type": "string",
       "group": "Аудио и Анимация",
       "file": true
      },
      {
       "key": "Max BGS Volume",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Menu BGS Volume",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Transition Time",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Pre-phase Blackout",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Hold Time",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Shake Intensity",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Background Opacity",
       "type": "number",
       "group": "Аудио и Анимация",
       "file": false
      },
      {
       "key": "Max Noise",
       "type": "number",
       "group": "Настройки Помех (SuperDuperScreen)",
       "file": false
      },
      {
       "key": "Max Scanline",
       "type": "number",
       "group": "Настройки Помех (SuperDuperScreen)",
       "file": false
      },
      {
       "key": "Max Chroma",
       "type": "number",
       "group": "Настройки Помех (SuperDuperScreen)",
       "file": false
      }
     ],
     "message": [
      {
       "key": "Delay Time",
       "type": "number",
       "group": "seSettings",
       "file": false
      },
      {
       "key": "Default Talk SE",
       "type": "string",
       "group": "seSettings",
       "file": false
      },
      {
       "key": "Pause Time",
       "type": "number",
       "group": "choiceSettings",
       "file": false
      },
      {
       "key": "Skip on RMB",
       "type": "bool",
       "group": "ffSettings",
       "file": false
      },
      {
       "key": "Skip on X",
       "type": "bool",
       "group": "ffSettings",
       "file": false
      },
      {
       "key": "Disable Move Route FF",
       "type": "bool",
       "group": "ffSettings",
       "file": false
      }
     ],
     "choices": [
      {
       "key": "Gradient Align",
       "type": "string",
       "group": "Visual Settings",
       "file": false
      },
      {
       "key": "Gradient Width Percent",
       "type": "number",
       "group": "Visual Settings",
       "file": false
      },
      {
       "key": "Gradient Solid Percent",
       "type": "number",
       "group": "Visual Settings",
       "file": false
      },
      {
       "key": "Gradient Opacity",
       "type": "number",
       "group": "Visual Settings",
       "file": false
      },
      {
       "key": "Frame Y Start",
       "type": "number",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Frame Y End",
       "type": "number",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Debug Mode",
       "type": "bool",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Layout Mode",
       "type": "string",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Max Visible",
       "type": "number",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Choices Offset X",
       "type": "number",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Choice Spacing",
       "type": "number",
       "group": "Layout Settings",
       "file": false
      },
      {
       "key": "Symbol Active",
       "type": "string",
       "group": "Symbol Settings",
       "file": false
      },
      {
       "key": "Symbol Inactive",
       "type": "string",
       "group": "Symbol Settings",
       "file": false
      },
      {
       "key": "Symbol Color Active",
       "type": "string",
       "group": "Symbol Settings",
       "file": false
      },
      {
       "key": "Symbol Color Inactive",
       "type": "string",
       "group": "Symbol Settings",
       "file": false
      },
      {
       "key": "Text Color Active",
       "type": "string",
       "group": "Symbol Settings",
       "file": false
      },
      {
       "key": "Text Color Inactive",
       "type": "string",
       "group": "Symbol Settings",
       "file": false
      },
      {
       "key": "Scale Active",
       "type": "number",
       "group": "Animation Settings",
       "file": false
      },
      {
       "key": "Scale Inactive",
       "type": "number",
       "group": "Animation Settings",
       "file": false
      },
      {
       "key": "Opacity Inactive",
       "type": "number",
       "group": "Animation Settings",
       "file": false
      },
      {
       "key": "Shift X",
       "type": "number",
       "group": "Animation Settings",
       "file": false
      },
      {
       "key": "Cursor SE Name",
       "type": "string",
       "group": "Audio Settings",
       "file": true
      },
      {
       "key": "Cursor SE Volume",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Cursor SE Pitch",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Cursor SE Pan",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Confirm SE Name",
       "type": "string",
       "group": "Audio Settings",
       "file": true
      },
      {
       "key": "Confirm SE Volume",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Confirm SE Pitch",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Confirm SE Pan",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Cancel SE Name",
       "type": "string",
       "group": "Audio Settings",
       "file": true
      },
      {
       "key": "Cancel SE Volume",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Cancel SE Pitch",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Cancel SE Pan",
       "type": "number",
       "group": "Audio Settings",
       "file": false
      },
      {
       "key": "Wait Before",
       "type": "number",
       "group": "Timing Settings",
       "file": false
      },
      {
       "key": "Wait After",
       "type": "number",
       "group": "Timing Settings",
       "file": false
      },
      {
       "key": "Wheel Cooldown",
       "type": "number",
       "group": "Timing Settings",
       "file": false
      }
     ],
     "settings": [
      {
       "key": "Enable Editor",
       "type": "bool",
       "group": "Основные",
       "file": false
      },
      {
       "key": "Fade Speed",
       "type": "number",
       "group": "Основные",
       "file": false
      },
      {
       "key": "Anim X",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      },
      {
       "key": "Anim Y",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      },
      {
       "key": "Frame Width",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      },
      {
       "key": "Frame Height",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      },
      {
       "key": "Total Frames",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      },
      {
       "key": "Anim Speed",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      },
      {
       "key": "Anim Scale",
       "type": "number",
       "group": "Анимация (Гитарист)",
       "file": false
      }
     ],
     "craft": [
      {
       "key": "Recipes",
       "type": "string",
       "group": "Крафт UI"
      },
      {
       "key": "Slot Size",
       "type": "number",
       "group": "SLOT VISUALS ---"
      },
      {
       "key": "Icon Offset X",
       "type": "number",
       "group": "SLOT VISUALS ---"
      },
      {
       "key": "Icon Offset Y",
       "type": "number",
       "group": "SLOT VISUALS ---"
      },
      {
       "key": "Hint Text",
       "type": "string",
       "group": "HINT 1 SETTINGS ---"
      },
      {
       "key": "Hint X",
       "type": "number",
       "group": "HINT 1 SETTINGS ---"
      },
      {
       "key": "Hint Y",
       "type": "number",
       "group": "HINT 1 SETTINGS ---"
      },
      {
       "key": "Hint Size",
       "type": "number",
       "group": "HINT 1 SETTINGS ---"
      },
      {
       "key": "Hint 2 X",
       "type": "number",
       "group": "HINT 2 SETTINGS ---"
      },
      {
       "key": "Hint 2 Y",
       "type": "number",
       "group": "HINT 2 SETTINGS ---"
      },
      {
       "key": "Hint 2 Size",
       "type": "number",
       "group": "HINT 2 SETTINGS ---"
      },
      {
       "key": "Preview Format",
       "type": "string",
       "group": "PREVIEW HINT SETTINGS ---"
      },
      {
       "key": "Preview Color",
       "type": "string",
       "group": "PREVIEW HINT SETTINGS ---"
      },
      {
       "key": "Preview X",
       "type": "number",
       "group": "PREVIEW HINT SETTINGS ---"
      },
      {
       "key": "Preview Y",
       "type": "number",
       "group": "PREVIEW HINT SETTINGS ---"
      },
      {
       "key": "Preview Size",
       "type": "number",
       "group": "PREVIEW HINT SETTINGS ---"
      },
      {
       "key": "Global Interact Sound",
       "type": "string",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Global Interact Volume",
       "type": "number",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Error Sound",
       "type": "string",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Error Volume",
       "type": "number",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Craft Sound",
       "type": "string",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Craft Volume",
       "type": "number",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Pickup Sound",
       "type": "string",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Pickup Volume",
       "type": "number",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Open Sound",
       "type": "string",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Open Volume",
       "type": "number",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Close Sound",
       "type": "string",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Close Volume",
       "type": "number",
       "group": "SOUND SETTINGS ---"
      },
      {
       "key": "Slot 1 X",
       "type": "number",
       "group": "UI POSITIONS ---"
      },
      {
       "key": "Slot 1 Y",
       "type": "number",
       "group": "UI POSITIONS ---"
      },
      {
       "key": "Slot Spacing",
       "type": "number",
       "group": "UI POSITIONS ---"
      },
      {
       "key": "Result Slot X",
       "type": "number",
       "group": "UI POSITIONS ---"
      },
      {
       "key": "Result Slot Y",
       "type": "number",
       "group": "UI POSITIONS ---"
      }
     ]
    };
    }

    static get CATEGORY_META() {
        return {
     save: {
      title: "Сохранение / диктофон",
      hint: "Экран загрузки-сохранения (SuperDuperSave): кнопки, декорации, список слотов, скриншоты."
     },
     title: {
      title: "Титульный экран",
      hint: "MOG Title Picture Command: анимация, фон, спрайт титула, курсор, позиции команд."
     },
     splash: {
      title: "Заставка (за грузкой)",
      hint: "SuperDuperSplash: логотип, звук включения, виньетка, фазы."
     },
     gameover: {
      title: "Гейм-овер",
      hint: "Экран смерти: меню, звуки, помехи CRT."
     },
     message: {
      title: "Сообщения",
      hint: "Окна диалогов (SuperDuperMessage): фон, звуки речи, автопрогон."
     },
     choices: {
      title: "Выборы",
      hint: "Окно выбора (SuperDuperChoices): градиент, символы, анимация, звуки."
     },
     settings: {
      title: "Меню настроек",
      hint: "Экран настроек (SuperDuperSettings): фон, анимация-гитарист."
     },
     craft: {
      title: "Крафт — интерфейс",
      hint: "Верстак SimpleCraftSystem: слоты, хинты, превью, звуки, позиции."
     }
    };
    }

    showUIDetail(container) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

        const banner = document.createElement('div');
        banner.style.cssText = `
            background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px;
        `;
        banner.textContent = this._tt('Интерфейс');
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
        sub.textContent = this._tt('Все экраны игры: инвентарь, сохранение, титул, окна');
        banner.appendChild(sub);
        wrapper.appendChild(banner);

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:6px;padding:10px 16px 0;border-bottom:1px solid var(--color-border);flex-wrap:wrap;';
        wrapper.appendChild(tabsRow);

        const content = document.createElement('div');
        content.className = 'agonia-content';
        content.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px;';
        wrapper.appendChild(content);

        const cats = [
            { id: 'inventory', label: 'Инвентарь' },
            { id: 'save', label: 'Сохранение' },
            { id: 'title', label: 'Титул' },
            { id: 'splash', label: 'Заставка' },
            { id: 'gameover', label: 'Гейм-овер' },
            { id: 'message', label: 'Сообщения' },
            { id: 'choices', label: 'Выборы' },
            { id: 'settings', label: 'Настройки' },
            { id: 'craft', label: 'Крафт' },
            { id: 'hud', label: 'HUD' },
            { id: 'showcase', label: 'Витрина' }
        ];
        let active = 'inventory';
        const render = () => {
            content.innerHTML = '';
            content.style.overflowY = 'auto';
            if (active === 'inventory') this._renderInventory(content);
            else if (active === 'hud') this._renderHud(content);
            else if (active === 'showcase') this._renderShowcase(content);
            else this._renderSection(content, active);
        };
        for (const cat of cats) {
            const el = document.createElement('div');
            el.style.cssText = `
                padding: 8px 16px; font-size: 13px; font-weight: 600;
                color: var(--color-text); cursor: pointer; user-select: none;
                border: 1px solid var(--color-border); border-bottom: none;
                border-radius: 6px 6px 0 0; background-color: var(--color-bg-deep);
            `;
            el.textContent = this._tt(cat.label);
            el.addEventListener('click', () => {
                active = cat.id;
                tabsRow.querySelectorAll('div').forEach(t => {
                    t.style.backgroundColor = 'var(--color-bg-deep)';
                    t.style.color = 'var(--color-text)';
                    t.style.borderBottom = '1px solid var(--color-border)';
                });
                el.style.backgroundColor = 'var(--color-bg-panel)';
                el.style.color = 'var(--color-text-strong)';
                el.style.borderBottom = '2px solid var(--color-accent-border-mid)';
                render();
            });
            if (cat.id === active) setTimeout(() => el.click(), 0);
            tabsRow.appendChild(el);
        }
        container.appendChild(wrapper);
    }

    // ------------------------------------------------------------------
    // Generic section renderer (field defs -> grouped panels)
    // ------------------------------------------------------------------

    _renderSection(content, sectionKey) {
        const meta = (DatabaseUIEditor.CATEGORY_META || {})[sectionKey] || {};
        const title = content.ownerDocument.createElement('div');
        title.style.cssText = 'padding:12px 0 4px;font-size:15px;font-weight:600;color:var(--color-text-strong);';
        title.textContent = this._tt(meta.title || sectionKey);
        content.appendChild(title);
        if (meta.hint) {
            const h = content.ownerDocument.createElement('div');
            h.style.cssText = 'font-size:11px;color:var(--color-text-dim);padding-bottom:8px;line-height:1.5;';
            h.textContent = this._tt(meta.hint);
            content.appendChild(h);
        }

        const section = this.getSection(sectionKey);
        const fields = (DatabaseUIEditor.FIELD_DEFS || {})[sectionKey] || [];
        const groups = new Map();
        for (const f of fields) {
            const g = (typeof AgoniaLabels !== 'undefined' ? AgoniaLabels.translateGroup(f.group) : f.group) || 'Настройки';
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push(f);
        }

        const grid = content.ownerDocument.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;';
        for (const [group, groupFields] of groups) {
            grid.appendChild(this._renderGroup(section, group, groupFields));
        }
        content.appendChild(grid);
    }

    _renderGroup(section, group, fields) {
        const panel = document.createElement('div');
        panel.className = 'agonia-section';
        const head = document.createElement('div');
        head.className = 'agonia-section-header';
        head.textContent = this._tt(group);
        panel.appendChild(head);

        const inner = document.createElement('div');
        inner.className = 'agonia-field-grid';
        for (const f of fields) {
            inner.appendChild(this._renderField(section, f));
        }
        panel.appendChild(inner);
        return panel;
    }

    _renderField(section, f) {
        const wrap = document.createElement('div');
        wrap.className = 'agonia-field';
        const label = document.createElement('label');
        label.title = f.key;
        label.textContent = (typeof AgoniaLabels !== 'undefined' ? AgoniaLabels.translate(f.key) : this._tt(f.key));
        wrap.appendChild(label);

        if (f.type === 'bool') {
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = typeof section[f.key] === 'string' ? String(section[f.key]).toLowerCase() === 'true' : !!section[f.key];
            box.style.cursor = 'pointer';
            box.addEventListener('change', () => { section[f.key] = box.checked; });
            wrap.appendChild(box);
            return wrap;
        }
        const input = document.createElement('input');
        input.type = f.type === 'number' ? 'number' : 'text';
        input.value = section[f.key] === undefined || section[f.key] === null ? '' : section[f.key];
        input.className = 'agonia-input';
        input.addEventListener('input', () => {
            if (f.type === 'number') {
                const n = Number(input.value);
                if (!Number.isNaN(n)) section[f.key] = n;
            } else {
                section[f.key] = input.value;
            }
        });
        wrap.appendChild(input);
        return wrap;
    }

    // ------------------------------------------------------------------
    // Inventory: Visual/Sound Settings JSON blobs flattened into groups
    // ------------------------------------------------------------------

    _renderInventory(content) {
        const title = document.createElement('div');
        title.style.cssText = 'padding:12px 0 4px;font-size:15px;font-weight:600;color:var(--color-text-strong);';
        title.textContent = this._tt('Инвентарь и хотбар');
        content.appendChild(title);
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);padding-bottom:8px;line-height:1.5;';
        hint.textContent = this._tt('Внешний вид окон инвентаря (игрок/сундук) и хотбара + звуки интерфейса. Картинки — файлы из img/pictures, имена скин-групп без пробелов.');
        content.appendChild(hint);

        const section = this.getSection('inventory');
        const blobPanels = [
            ['Visual Settings', 'Внешний вид', this._prefixGroup.bind(this)],
            ['Sound Settings', 'Звуки', this._soundGroup.bind(this)]
        ];
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;';

        for (const [key, label, groupFn] of blobPanels) {
            let blob = {};
            try { blob = JSON.parse(section[key] || '{}'); } catch (e) { blob = {}; }
            const groups = groupFn(blob);
            for (const [groupName, fields] of groups) {
                grid.appendChild(this._renderBlobGroup(blob, groupName, fields, () => {
                    section[key] = JSON.stringify(blob);
                }));
            }
        }
        content.appendChild(grid);
    }

    /** Group Visual Settings keys by their prefix (Player/Chest/Hotbar/Custom). */
    _prefixGroup(blob) {
        const groups = new Map();
        for (const k of Object.keys(blob)) {
            if (typeof blob[k] === 'object') continue;
            const m = k.match(/^(Player|Chest|Hotbar|Custom)\s*(.*)$/);
            const g = m ? (m[1] === 'Custom' ? 'Своё окно' : (m[1] === 'Player' ? 'Окно игрока' : m[1] === 'Chest' ? 'Окно сундука' : 'Хотбар')) : 'Прочее';
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g).push({ key: k, type: /Cols|Rows|X$|Y$|Spacing|Fade/i.test(k) ? 'number' : 'string' });
        }
        return groups;
    }

    _soundGroup(blob) {
        // Sound Settings values are JSON strings {Name,Volume,Pitch,Pan}
        const groups = new Map([['Звуки интерфейса', []]]);
        for (const k of Object.keys(blob)) {
            groups.get('Звуки интерфейса').push({ key: k, type: 'sound' });
        }
        return groups;
    }

    _renderBlobGroup(blob, group, fields, commit) {
        const panel = document.createElement('div');
        panel.className = 'agonia-section';
        const head = document.createElement('div');
        head.className = 'agonia-section-header';
        head.textContent = this._tt(group);
        panel.appendChild(head);
        const inner = document.createElement('div');
        inner.className = 'agonia-field-grid';

        for (const f of fields) {
            if (f.type === 'sound') {
                // value: JSON string or plain name
                inner.appendChild(this._renderSoundField(blob, f.key, commit));
                continue;
            }
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
            const label = document.createElement('label');
            label.style.cssText = 'font-size:11px;color:var(--color-text);font-weight:600;';
            label.textContent = (typeof AgoniaLabels !== 'undefined' ? AgoniaLabels.translate(f.key) : this._tt(f.key));
            wrap.appendChild(label);
            const input = document.createElement('input');
            input.type = f.type === 'number' ? 'number' : 'text';
            input.value = blob[f.key] === undefined ? '' : blob[f.key];
            input.style.cssText = 'width:' + (f.type === 'number' ? '84px' : '100%') + ';padding:5px 8px;font-size:12px;box-sizing:border-box;background-color:var(--color-bg-deep);color:var(--color-text-strong);border:1px solid var(--color-border);border-radius:4px;';
            input.addEventListener('input', () => {
                if (f.type === 'number') {
                    const n = Number(input.value);
                    if (!Number.isNaN(n)) blob[f.key] = n;
                } else blob[f.key] = input.value;
                commit();
            });
            wrap.appendChild(input);
            inner.appendChild(wrap);
        }
        panel.appendChild(inner);
        return panel;
    }

    _renderSoundField(blob, key, commit) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
        const label = document.createElement('label');
        label.style.cssText = 'font-size:11px;color:var(--color-text);font-weight:600;';
        label.textContent = (typeof AgoniaLabels !== 'undefined' ? AgoniaLabels.translate(key) : this._tt(key));
        wrap.appendChild(label);
        let snd = {};
        try { snd = typeof blob[key] === 'string' && blob[key].startsWith('{') ? JSON.parse(blob[key]) : { Name: blob[key] || '' }; }
        catch (e) { snd = { Name: '' }; }
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:4px;';
        const mkInput = (val, css, cb) => {
            const i = document.createElement('input');
            i.value = val;
            i.style.cssText = css;
            i.addEventListener('input', cb);
            return i;
        };
        const base = 'padding:4px 6px;font-size:11px;background-color:var(--color-bg-deep);color:var(--color-text-strong);border:1px solid var(--color-border);border-radius:4px;';
        line.appendChild(mkInput(snd.Name || '', 'flex:1;' + base, e => { snd.Name = e.target.value; blob[key] = JSON.stringify(snd); commit(); }));
        line.appendChild(mkInput(snd.Volume !== undefined ? snd.Volume : 90, 'width:44px;' + base, e => { snd.Volume = Number(e.target.value) || 0; blob[key] = JSON.stringify(snd); commit(); }));
        wrap.appendChild(line);
        return wrap;
    }

    // ------------------------------------------------------------------
    // HUD (S39): the embedded live editor on a checkerboard stage +
    // a mock showcase of the inventory/craft windows drawn by plugins.
    // ------------------------------------------------------------------

    _renderHud(content) {
        // The editor fills the whole tab area - no scroll container inside.
        content.style.overflowY = 'hidden';
        const host = document.createElement('div');
        host.style.cssText = 'height:100%;';
        content.appendChild(host);
        try {
            if (!this._hudEditor) {
                this._hudEditor = new DatabaseHUDEditor(
                    this.databaseManager, this.projectManager, this.commonUI, this.parentEditor);
            }
            this._hudEditor.mount(host);
        } catch (e) {
            content.style.overflowY = 'auto';
            host.innerHTML = '';
            const box = document.createElement('div');
            box.style.cssText = 'margin:12px;padding:10px 14px;border:1px solid var(--color-danger,#b33);border-radius:4px;background:rgba(179,51,51,.12);font-size:12px;';
            box.textContent = String((e && e.stack) || e).split('\n').slice(0, 3).join(' ');
            host.appendChild(box);
            this._renderHudFallback(host);
        }
    }

    _renderHudFallback(host) {
        const btn = document.createElement('button');
        btn.textContent = this._tt('Запустить плейтест (F9 в игре → HUD Maker)');
        btn.className = 'agonia-btn';
        btn.style.margin = '12px';
        btn.addEventListener('click', () => {
            const pm = this.parentEditor && this.parentEditor.playtestManager;
            const project = this.projectManager && this.projectManager.getCurrentProject ? this.projectManager.getCurrentProject() : null;
            if (pm && project) pm.playtest(project.path);
        });
        host.appendChild(btn);
    }

    /** S39: mock showcase of plugin-drawn windows (inventory hotbar/craft)
     *  on the same checkerboard - rendered from their DB parameters. */
    _renderShowcase(content) {
        const title = document.createElement('div');
        title.style.cssText = 'padding:12px 0 4px;font-size:15px;font-weight:600;color:var(--color-text-strong);';
        title.textContent = this._tt('Витрина: инвентарь и крафт');
        content.appendChild(title);
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:11px;color:var(--color-text-dim);line-height:1.5;padding-bottom:8px;';
        hint.textContent = this._tt('Мок-превью из параметров плагинов (позиции/картинки/размеры). Живой рендер — в игре; здесь видно взаимное расположение с HUD.');
        content.appendChild(hint);

        const inv = this.getSection ? this.getSection('inventory') : null;
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 0 0 / 32px 32px;
            border: 1px solid var(--color-border); border-radius: 4px;
            width: 640px; height: 360px; position: relative; max-width: 100%;
        `;
        // hotbar mock: N slots along the bottom (SuperDuperInventory params)
        const slots = inv ? Number(inv['Hotbar Slots'] || inv['Default Max Slots'] || 9) : 9;
        const slotSize = 48;
        const barW = slots * slotSize;
        for (let i = 0; i < slots; i++) {
            const slot = document.createElement('div');
            slot.style.cssText = `
                position:absolute; width:${slotSize - 4}px; height:${slotSize - 4}px;
                left:${(640 - barW) / 2 + i * slotSize + 2}px; bottom:12px;
                border:1px solid rgba(160,160,180,0.8); background:rgba(20,20,28,0.55);
                box-sizing:border-box; border-radius:3px;
                font-size:10px; color:rgba(200,200,220,0.7);
                display:flex; align-items:center; justify-content:center;
            `;
            slot.textContent = String(i + 1);
            panel.appendChild(slot);
        }
        const cap = document.createElement('div');
        cap.style.cssText = 'position:absolute;left:0;right:0;bottom:-22px;font-size:10px;color:var(--color-text-dim);text-align:center;';
        cap.textContent = this._tt('хотбар инвентаря') + ' · ' + slots + ' ' + this._tt('слотов');
        panel.appendChild(cap);
        content.appendChild(panel);
    }
}

if (typeof window !== 'undefined') {
    window.DatabaseUIEditor = DatabaseUIEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseUIEditor;
}
