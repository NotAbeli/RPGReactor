//=============================================================================
// SRD_LightEditor — Live Light Editor (вкладка в F12 Super Tools Engine)
// SRD_LightEditor.js
// Version: 1.0
//=============================================================================
/*:
 * @plugindesc v1.0 Добавляет вкладку "Light Editor" в SRD Super Tools Engine (F12) для живой настройки SDLight: свет игрока, tint, vignette, flashlight + экспорт значений.
 * @author Super Duper Team
 *
 * @help
 * ============================================================================
 * SRD_LightEditor
 * ============================================================================
 *
 * Companion-плагин к SRD Super Tools Engine. Добавляет новую кнопку
 * "Light Editor" в Tool Kit (открывается по F12 во время playtest).
 *
 * ТРЕБОВАНИЯ:
 *   - SRD_SuperToolsEngine.js  (ядро F12-редактора)
 *   - SDLight.js               (собственно освещение + публичный SDLightAPI)
 *
 * Что внутри (3 вкладки):
 *
 *   1. PLAYER — свет игрока (живые слайдеры + color picker):
 *        radius, color, brightness, smoothness, preset,
 *        flashlight (on/off + length/width), fire-flicker, vignette multiplier.
 *
 *   2. GLOBAL — атмосфера карты:
 *        master opacity (переменная), tint (туман), vignette (края),
 *        отключение виньетки (switch), дебаг сенсоров (switch).
 *
 *   3. EXPORT — снимок всех текущих значений + кнопка "Скопировать":
 *        готовые Plugin Command-ы (Light radius / Tint set / Vignette color),
 *        чтобы перенести подобранные значения в редактор RPG Maker.
 *
 * Все изменения применяются мгновенно (SDLight читает $gameVariables каждый
 * кадр). Значения НЕ сохраняются в save автоматически — это инструмент для
 * подбора баланса вживую.
 *
 * ============================================================================
 */
var Imported = Imported || {};
Imported.SRD_LightEditor = 1.0;

(function() {
    "use strict";

    // -------------------------------------------------------------------------
    // Guards: ядро SRD и SDLight должны быть загружены.
    // -------------------------------------------------------------------------
    console.log('[SRD_LightEditor] IIFE start: MakerManager=' + (typeof MakerManager !== 'undefined') + ' SDLight=' + (!!Imported.SDLight) + ' SDLightAPI=' + (typeof window.SDLightAPI !== 'undefined'));
    if (typeof MakerManager === 'undefined') {
        console.warn('[SRD_LightEditor] SRD_SuperToolsEngine не найден — плагин отключён.');
        return;
    }
    if (!Imported.SDLight || typeof window.SDLightAPI === 'undefined') {
        console.warn('[SRD_LightEditor] SDLight / SDLightAPI не найден — плагин отключён.');
        return;
    }

    var _ = {};  // приватные ссылки на оригинальные методы (для alias)
    var API = window.SDLightAPI;

    // =========================================================================
    // LightEditorManager — статический "менеджер" вкладки (как DebugManager).
    // Его методы вызываются как из окна игры, так и из HTML-окон F12.
    // =========================================================================
    function LightEditorManager() {
        throw new Error('LightEditorManager — статический класс');
    }
    window.LightEditorManager = LightEditorManager;

    // Кеш конфига SDLight (switch/variable ID и т.д.)
    LightEditorManager._cfg = null;
    LightEditorManager._tab = 0;

    // -------------------------------------------------------------------------
    // Форматирование
    // -------------------------------------------------------------------------
    function fmt(n, d) {
        d = (d === undefined) ? 2 : d;
        if (n === undefined || n === null || isNaN(n)) n = 0;
        return Number(n).toFixed(d);
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function boolRu(b) { return b ? 'ВКЛ' : 'ВЫКЛ'; }

    // -------------------------------------------------------------------------
    // DOM-хелперы (работают с документом ОКНА F12, а не игры)
    // -------------------------------------------------------------------------
    LightEditorManager.setText = function(id, text) {
        var el = MakerManager.document.getElementById(id);
        if (el) el.textContent = text;
    };
    LightEditorManager.setSwatch = function(id, color) {
        var el = MakerManager.document.getElementById(id);
        if (el) el.style.backgroundColor = color;
    };
    // Возвращает значение инпута из окна F12 по id
    LightEditorManager.getVal = function(id) {
        var el = MakerManager.document.getElementById(id);
        return el ? el.value : null;
    };
    LightEditorManager.getChecked = function(id) {
        var el = MakerManager.document.getElementById(id);
        return el ? !!el.checked : false;
    };

    // =========================================================================
    // ИНТЕГРАЦИЯ С SRD (как в SRD_HUDMaker): добавляем кнопку и exposes объект.
    // =========================================================================

    // 1. Экспонируем LightEditorManager в окно F12 после его создания.
    _.MakerManager_assignWindow = MakerManager.assignWindow;
    MakerManager.assignWindow = function() {
        _.MakerManager_assignWindow.apply(this, arguments);
        this._window.window.LightEditorManager = LightEditorManager;
    };

    // 2. Добавляем кнопку в Tool Kit.
    _.MakerManager_getLauncherButtonsRaw = MakerManager.getLauncherButtonsRaw;
    MakerManager.getLauncherButtonsRaw = function() {
        var result = _.MakerManager_getLauncherButtonsRaw.apply(this, arguments);
        result.push(this.generateLauncherRow(
            "Light Editor",
            "Живой редактор освещения SDLight: свет игрока, тинт, виньетка, фонарик + экспорт значений.",
            "LightEditorManager.setupWindowHtml()",
            "#f4a31f"
        ));
        return result;
    };

    // 3. Очистка при закрытии F12 (опционально — просто сбрасываем вкладку).
    _.MakerManager_onFinish = MakerManager.onFinish;
    MakerManager.onFinish = function() {
        if (MakerManager.mode === 'light') {
            LightEditorManager._tab = 0;
            // Закрытие F12 — снять авто-оверлей источников
            if (LightEditorManager._autoPick) {
                LightEditorManager.disablePickOverlay();
                LightEditorManager._autoPick = false;
            }
        }
        if (_.MakerManager_onFinish) _.MakerManager_onFinish.apply(this, arguments);
    };

    // =========================================================================
    // ТОЧКА ВХОДА
    // =========================================================================
    LightEditorManager.setupWindowHtml = function() {
        this._cfg = API.getConfig();
        MakerManager.window.title = "Super Tools Engine  -  Light Editor";
        MakerManager.mode = 'light';
        this.setPlayerPage();
        this._autoPick = true;
        this.enablePickOverlay();
    };

    LightEditorManager.returnToMaker = function() {
        // Выход из Light Editor — снять авто-оверлей (если не ручной)
        if (this._autoPick) { this.disablePickOverlay(); this._autoPick = false; }
        MakerManager.setupWindowHtml();
    };

    // -------------------------------------------------------------------------
    // Вкладки
    // -------------------------------------------------------------------------
    LightEditorManager.setPlayerPage = function() {
        this._tab = 0;
        MakerManager.mainHTML = this.topBar(0) + this.getStyles() + this.getSaveBar() + this.getPlayerHtml();
    };
    LightEditorManager.setGlobalPage = function() {
        this._tab = 1;
        MakerManager.mainHTML = this.topBar(1) + this.getStyles() + this.getSaveBar() + this.getGlobalHtml();
    };
    LightEditorManager.setSourcesPage = function() {
        this._tab = 2;
        MakerManager.mainHTML = this.topBar(2) + this.getStyles() + this.getSaveBar() + this.getSourcesHtml();
    };
    LightEditorManager.setPresetsPage = function() {
        this._tab = 3;
        MakerManager.mainHTML = this.topBar(3) + this.getStyles() + this.getSaveBar() + this.getPresetsHtml();
        // После вставки HTML в DOM — заполнить точки, canvas и навесить интеракции
        this.renderPresetEditor();
        this.attachPresetCanvasHandlers();
    };
    LightEditorManager.setExportPage = function() {
        this._tab = 4;
        MakerManager.mainHTML = this.topBar(4) + this.getStyles() + this.getSaveBar() + this.getExportHtml();
    };
    LightEditorManager.setLibraryPage = function() {
        this._tab = 5;
        MakerManager.mainHTML = this.topBar(5) + this.getStyles() + this.getSaveBar() + this.getLibraryHtml();
    };

    LightEditorManager.topBar = function(index) {
        var a = ['', '', '', '', ''];
        a[index] = 'class="active"';
        return '<ul style="cursor:pointer">' +
            '<li><a ' + a[0] + ' onclick="LightEditorManager.setPlayerPage()">Игрок</a></li>' +
            '<li><a ' + a[1] + ' onclick="LightEditorManager.setGlobalPage()">Глобал</a></li>' +
            '<li><a ' + a[2] + ' onclick="LightEditorManager.setSourcesPage()">Источники</a></li>' +
            '<li><a ' + a[3] + ' onclick="LightEditorManager.setPresetsPage()">Пресеты</a></li>' +
            '<li><a ' + a[4] + ' onclick="LightEditorManager.setExportPage()">Экспорт</a></li>' +
            '<li style="float:right"><a onclick="LightEditorManager.returnToMaker()">Назад</a></li>' +
            '</ul>';
    };

    // -------------------------------------------------------------------------
    // Стили для слайдеров/пикеров (дополняют тему SRD)
    // -------------------------------------------------------------------------
    LightEditorManager.getStyles = function() {
        return '<style>' +
            '.le-wrap { padding: 8px 14px 60px 14px; }' +
            '.le-row { display:flex; align-items:center; gap:10px; margin:10px 0; }' +
            '.le-label { width: 170px; font-size: 13px; }' +
            '.le-val { width: 60px; text-align:right; font-family:monospace; font-size:13px; }' +
            '.le-slider { flex: 1; }' +
            '.le-color { width: 60px; height: 30px; border:none; background:none; cursor:pointer; }' +
            '.le-swatch { display:inline-block; width:22px; height:22px; border:1px solid #888; vertical-align:middle; }' +
            '.le-h2 { font-size:15px; margin:18px 0 6px 0; padding-bottom:4px; border-bottom:1px solid ' +
                (MakerManager.colors ? MakerManager.colors[8] : '#444') + '; }' +
            '.le-btn-row { margin: 18px 0 8px 0; }' +
            '.le-hint { font-size:12px; opacity:0.75; margin:4px 0 0 0; }' +
            'select.le-select { flex:1; }' +
            'pre.le-pre { white-space:pre-wrap; word-wrap:break-word; background:' +
                (MakerManager.colors ? MakerManager.colors[3] : '#222') + ';' +
                ' padding:10px; border:1px solid #444; font-size:12px; max-height:320px; overflow:auto; }' +
            '.le-canvas { display:block; width:100%; height:180px; border:1px solid #555; background:#111; margin:8px 0; cursor:crosshair; }' +
            '.le-pt { display:flex; align-items:center; gap:6px; margin:4px 0; font-size:12px; flex-wrap:wrap; padding:3px 6px; border-radius:6px; }' +
            '.le-pt input[type=range] { width:80px; }' +
            '.le-pt input[type=number] { width:54px; background:' + (MakerManager.colors ? MakerManager.colors[13] : '#222') + '; color:inherit; border:1px solid #555; border-radius:4px; padding:2px 4px; font-family:monospace; }' +
            '.le-pt.sel { background:rgba(46,204,113,0.18); outline:1px solid #2ecc71; }' +
            '.le-trend { border:1px dashed #555; border-radius:8px; padding:6px 10px; margin:6px 0; }' +
            '.le-trend .le-row { margin:6px 0; }' +
            '.le-pt .le-ptval { width:42px; text-align:right; font-family:monospace; }' +
            '.le-src-empty { padding:16px; opacity:0.8; font-size:13px; }' +
            '.le-mono { font-family:monospace; font-size:12px; }' +
            '.le-savebar { padding:8px 14px; border-bottom:1px solid ' +
                (MakerManager.colors ? MakerManager.colors[8] : '#444') +
                '; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }' +
            '</style>';
    };

    // -------------------------------------------------------------------------
    // SAVE-BAR (кнопки «Сохранить всё» / «Очистить» + статус)
    // -------------------------------------------------------------------------
    LightEditorManager.getSaveBar = function() {
        var nw = this._isNwjs();
        var status, color;
        if (!nw) {
            status = 'сохранение недоступно (нужен десктоп/NW.js)';
            color = '#e74c3c';
        } else if (this._dirty) {
            status = '● есть несохранённые правки';
            color = '#e74c3c';
        } else if (this._patchLoaded) {
            status = '✓ snapshot загружен — изменения применяются';
            color = '#2ecc71';
        } else {
            status = 'snapshot отсутствует (правки только в памяти)';
            color = '#888';
        }
        return '<div class="le-savebar">' +
            '<button class="button" onclick="LightEditorManager.saveAll()"' + (nw ? '' : ' disabled style="opacity:0.4"') + '>💾 Сохранить всё</button>' +
            '<button class="button" onclick="LightEditorManager.clearPatch()"' + (nw ? '' : ' disabled style="opacity:0.4"') + '>✕ Очистить сохранённое</button>' +
            '<span id="saveStatus" style="color:' + color + '; font-size:12px;">' + status + '</span>' +
            '</div>';
    };

    // =========================================================================
    // ЧТЕНИЕ ТЕКУЩИХ ЗНАЧЕНИЙ
    // =========================================================================
    LightEditorManager.snapshot = function() {
        var cfg = this._cfg || API.getConfig();
        var s = {
            radius:   $gameVariables.GetRadius(),
            color:    $gameVariables.GetPlayerColor() || '#FFFFFF',
            bright:   $gameVariables.GetPlayerBrightness(),
            smooth:   $gameVariables.GetPlayerSmoothness(),
            preset:   $gameVariables.GetPlayerPreset(),
            flash:    !!$gameVariables.GetFlashlight(),
            flashLen: $gameVariables.GetFlashlightLength(),
            flashWid: $gameVariables.GetFlashlightWidth(),
            fire:     !!$gameVariables.GetFire(),
            vignMult: $gameVariables.GetPlayerVignetteMult(),

            master:   API.getMasterOpacity(),
            tint:     API.getTint() || cfg.defaultTint,
            vignette: API.getVignette() || cfg.defaultVignette,
            vigOff:   (cfg.vignetteDisableSwitch > 0) ? !!$gameSwitches.value(cfg.vignetteDisableSwitch) : false,
            dbgOn:    (cfg.sensorDebugSwitch > 0) ? !!$gameSwitches.value(cfg.sensorDebugSwitch) : false,

            cfg: cfg
        };
        // Нормализация
        if (s.vignMult === undefined || s.vignMult === null) s.vignMult = 1.0;
        return s;
    };

    // =========================================================================
    // ВКЛАДКА: ИГРОК
    // =========================================================================
    LightEditorManager.getPlayerHtml = function() {
        if (typeof $gameVariables === 'undefined' || !$gameVariables) {
            return '<div class="le-wrap"><p>Игра ещё не запущена. Зайдите на карту и снова откройте редактор.</p></div>';
        }
        var s = this.snapshot();
        var presets = API.getPresets();
        var presetOpts = '<option value="">(нет / линейный)</option>';
        for (var i = 0; i < presets.length; i++) {
            var p = presets[i];
            presetOpts += '<option value="' + esc(p) + '"' + (p === s.preset ? ' selected' : '') + '>' + esc(p) + '</option>';
        }

        var html = '<div class="le-wrap">';

        // --- Радиус ---
        html += '<div class="le-h2">Свет игрока</div>';
        html += this._sliderRow('radius', 'Радиус', s.radius, 0, 800, 1, 0,
            "LightEditorManager.setRadius(this.value); LightEditorManager.setText('radiusVal', this.value)");
        html += this._colorRow('color', 'Цвет света', s.color,
            "LightEditorManager.setColor(this.value); LightEditorManager.setSwatch('colorSw', this.value)");

        // --- Brightness / Smoothness ---
        html += this._sliderRow('bright', 'Яркость', s.bright, 0, 1, 0.05, 2,
            "LightEditorManager.setBrightness(this.value); LightEditorManager.setText('brightVal', this.value)");
        html += this._sliderRow('smooth', 'Плавность', s.smooth, 0, 1, 0.05, 2,
            "LightEditorManager.setSmoothness(this.value); LightEditorManager.setText('smoothVal', this.value)");

        // --- Пресет ---
        html += '<div class="le-row"><div class="le-label">Пресет затухания</div>' +
            '<select class="le-select" onchange="LightEditorManager.setPreset(this.value)">' + presetOpts + '</select></div>';

        // --- Множитель виньетки ---
        html += this._sliderRow('vignMult', 'Множ. виньетки', s.vignMult, 0, 3, 0.1, 2,
            "LightEditorManager.setVignetteMult(this.value); LightEditorManager.setText('vignMultVal', this.value)");

        // --- Фонарик ---
        html += '<div class="le-h2">Фонарик</div>';
        html += this._checkRow('flash', 'Фонарик вкл.', s.flash,
            "LightEditorManager.setFlashlight(this.checked)");
        html += this._sliderRow('flashLen', 'Длина конуса', s.flashLen, 1, 30, 1, 0,
            "LightEditorManager.setFlashLength(this.value); LightEditorManager.setText('flashLenVal', this.value)");
        html += this._sliderRow('flashWid', 'Ширина конуса', s.flashWid, 1, 40, 1, 0,
            "LightEditorManager.setFlashWidth(this.value); LightEditorManager.setText('flashWidVal', this.value)");

        // --- Мерцание ---
        html += '<div class="le-h2">Эффекты</div>';
        html += this._checkRow('fire', 'Мерцание костра (fire)', s.fire,
            "LightEditorManager.setFire(this.checked)");

        // --- Кнопки ---
        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.resetPlayer()">Сбросить свет игрока</button> ' +
            '<button class="button" onclick="LightEditorManager.setExportPage()">Перейти к экспорту →</button>' +
            '</div>';
        html += '<p class="le-hint">Изменения применяются мгновенно и не сохраняются в save. ' +
            'На вкладке «Экспорт» можно скопировать подобранные значения.</p>';
        html += '</div>';
        return html;
    };

    // =========================================================================
    // ВКЛАДКА: ГЛОБАЛ
    // =========================================================================
    LightEditorManager.getGlobalHtml = function() {
        if (typeof $gameVariables === 'undefined' || !$gameVariables) {
            return '<div class="le-wrap"><p>Игра ещё не запущена.</p></div>';
        }
        var s = this.snapshot();
        var cfg = s.cfg;
        var html = '<div class="le-wrap">';

        html += '<div class="le-h2">Атмосфера карты</div>';

        // Master opacity (переменная)
        var mvLabel = 'Master Opacity (var ' + cfg.masterOpacityVar + ')';
        html += this._sliderRow('master', mvLabel, s.master, 0, 100, 1, 0,
            "LightEditorManager.setMasterOpacity(this.value); LightEditorManager.setText('masterVal', this.value)");
        html += '<p class="le-hint">0 = тьма (норма), 100 = полностью светло (слой освещения скрыт).</p>';

        // Tint
        html += this._colorRow('tint', 'Тинт (туман у игрока)', s.tint,
            "LightEditorManager.setTint(this.value); LightEditorManager.setSwatch('tintSw', this.value)");
        // Vignette color
        html += this._colorRow('vignette', 'Цвет виньетки (края)', s.vignette,
            "LightEditorManager.setVignetteColor(this.value); LightEditorManager.setSwatch('vignetteSw', this.value)");

        // Switches
        html += '<div class="le-h2">Переключатели</div>';
        if (cfg.vignetteDisableSwitch > 0) {
            html += this._checkRow('vigOff', 'Отключить виньетку (SW ' + cfg.vignetteDisableSwitch + ')', s.vigOff,
                "LightEditorManager.toggleVignetteDisable(this.checked)");
        }
        if (cfg.sensorDebugSwitch > 0) {
            html += this._checkRow('dbgOn', 'Дебаг хитбоксов света (SW ' + cfg.sensorDebugSwitch + ')', s.dbgOn,
                "LightEditorManager.toggleSensorDebug(this.checked)");
        }

        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.resetGlobal()">Сбросить глобал</button> ' +
            '<button class="button" onclick="LightEditorManager.setPlayerPage()">← Свет игрока</button>' +
            '</div>';
        html += '<p class="le-hint">Тинт/виньетка применяются сразу. Switch-и сохраняются в save.</p>';
        html += '</div>';
        return html;
    };

    // =========================================================================
    // ВКЛАДКА: ИСТОЧНИКИ (свет событий-объектов на карте)
    // =========================================================================
    LightEditorManager._selSrc = -1;  // индекс выбранного источника в state.lightEvents

    LightEditorManager.getSourcesHtml = function() {
        var html = '<div class="le-wrap">';
        var events = API.getLightEvents();

        html += '<div class="le-h2">Источники света на карте</div>';
        if (!events || events.length === 0) {
            html += '<div class="le-src-empty">На текущей карте нет событий с note-тегами ' +
                '<span class="le-mono">light / fire / flashlight</span>.<br>' +
                'Перейдите на карту с источниками или добавьте их в редакторе RPG Maker.</div>';
            html += '<div class="le-btn-row"><button class="button" onclick="LightEditorManager.refreshSources()">↻ Обновить</button></div>';
            html += '</div>';
            return html;
        }

        // Список источников
        // Если ничего не выбрано / невалидно — автособираем первый ДО построения opts
        if (this._selSrc < 0 || this._selSrc >= events.length) {
            this._selSrc = 0;
        }
        var opts = '';
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            var presetTag = e.presetId ? (' (' + e.presetId + ')') : ' (линейный)';
            var label = '(' + (i + 1) + ') EV' + e.eventId + ' ' + (e.name || '(без имени)') + ' — ' + e.type + presetTag;
            opts += '<option value="' + i + '"' + (i === this._selSrc ? ' selected' : '') + '>' + esc(label) + '</option>';
        }
        html += '<div class="le-row"><div class="le-label">Источник</div>' +
            '<select class="le-select" id="srcSelect" onchange="LightEditorManager.selectSource(Number(this.value))">' + opts + '</select>' +
            '<button class="button" onclick="LightEditorManager.refreshSources()">↻</button></div>';

        var src = events[this._selSrc];
        if (!src) {
            html += '</div>';
            return html;
        }

        // Контролы выбранного источника
        var presets = API.getPresets();
        var presetOpts = '<option value="">(нет / линейный)</option>';
        for (var k = 0; k < presets.length; k++) {
            presetOpts += '<option value="' + esc(presets[k]) + '"' + (presets[k] === src.presetId ? ' selected' : '') + '>' + esc(presets[k]) + '</option>';
        }
        var typeOpts = ['Normal', 'Fire', 'Flashlight'];
        var typeOptHtml = '';
        for (var t = 0; t < typeOpts.length; t++) {
            typeOptHtml += '<option value="' + typeOpts[t] + '"' + (typeOpts[t] === src.type ? ' selected' : '') + '>' + typeOpts[t] + '</option>';
        }

        html += '<div class="le-h2">Параметры: EV' + src.eventId + ' ' + esc(src.name || '') + '</div>';

        // Тип + активность
        html += '<div class="le-row"><div class="le-label">Тип</div>' +
            '<select class="le-select" onchange="LightEditorManager.setSrcType(this.value)">' + typeOptHtml + '</select></div>';
        html += this._checkRow('srcActive', 'Источник активен', src.active,
            "LightEditorManager.setSrcActive(this.checked)");

        // Радиус (для Normal/Fire)
        html += this._sliderRow('srcRadius', 'Радиус', src.radius, 0, 800, 1, 0,
            "LightEditorManager.setSrcRadius(this.value); LightEditorManager.setText('srcRadiusVal', this.value)");
        html += this._sliderRow('srcRadiusY', 'Радиус Y (овал)', src.radiusY, 0, 800, 1, 0,
            "LightEditorManager.setSrcRadiusY(this.value); LightEditorManager.setText('srcRadiusYVal', this.value)");
        // Цвет
        html += this._colorRow('srcColor', 'Цвет', src.color,
            "LightEditorManager.setSrcColor(this.value); LightEditorManager.setSwatch('srcColorSw', this.value)");
        // Яркость / плавность
        html += this._sliderRow('srcBright', 'Яркость', src.brightness, 0, 1, 0.05, 2,
            "LightEditorManager.setSrcBright(this.value); LightEditorManager.setText('srcBrightVal', this.value)");
        html += this._sliderRow('srcFalloff', 'Плавность (falloff)', src.falloff, 0, 1, 0.05, 2,
            "LightEditorManager.setSrcFalloff(this.value); LightEditorManager.setText('srcFalloffVal', this.value)");
        // Пресет
        html += '<div class="le-row"><div class="le-label">Пресет затухания</div>' +
            '<select class="le-select" onchange="LightEditorManager.setSrcPreset(this.value)">' + presetOpts + '</select></div>';

        // Flashlight параметры (показываем всегда — эффект только для Flashlight)
        html += '<div class="le-h2">Flashlight</div>';
        html += this._sliderRow('srcFlashLen', 'Длина конуса', src.flashLength, 1, 30, 1, 0,
            "LightEditorManager.setSrcFlashLen(this.value); LightEditorManager.setText('srcFlashLenVal', this.value)");
        html += this._sliderRow('srcFlashWid', 'Ширина конуса', src.flashWidth, 1, 40, 1, 0,
            "LightEditorManager.setSrcFlashWid(this.value); LightEditorManager.setText('srcFlashWidVal', this.value)");

        // Хитбоксы (sensor debug switch)
        var cfg = this._cfg || API.getConfig();
        var dbg = (cfg.sensorDebugSwitch > 0) ? !!$gameSwitches.value(cfg.sensorDebugSwitch) : false;
        html += '<div class="le-h2">Отладка</div>';
        if (cfg.sensorDebugSwitch > 0) {
            html += this._checkRow('srcDbg', 'Показать хитбоксы света (зоны)', dbg,
                "LightEditorManager.toggleSensorDebug(this.checked)");
        } else {
            html += '<p class="le-hint">Sensor Debug Switch не задан в параметрах SDLight.</p>';
        }

        // Кнопки
        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.deleteSelectedSource()" style="background:#c0392b">🗑 Удалить/погасить</button> ' +
            '<button class="button" onclick="LightEditorManager.duplicateSelectedSource()" style="background:#2c5f8a">⧉ Дублировать</button> ' +
            '<button class="button" onclick="LightEditorManager.resetSource()">↺ Сбросить к Note-тегу</button> ' +
            '<button class="button" onclick="LightEditorManager.setExportPage()">Экспорт →</button> ' +
            '<button class="button" onclick="LightEditorManager.startPlacement()">+ Новый</button> ' +
            '<button class="button" onclick="LightEditorManager.convertEventsToBase()" style="background:#8e44ad">↪ Все → в базу</button>' +
            '</div>';
        html += '<p class="le-hint">Изменения применяются мгновенно. «Сбросить к Note-тегу» перепарсит оригинальный ' +
            'note-тег события (отменяет правки, сделанные здесь).</p>';
        html += '</div>';
        return html;
    };

    // Выбор источника в списке
    LightEditorManager.selectSource = function(idx) {
        this._selSrc = idx;
        this.setSourcesPage();
    };
    LightEditorManager.refreshSources = function() {
        this._selSrc = -1;
        this.setSourcesPage();
    };

    // Сеттеры источников (живая мутация через API) + пометка «грязным» для Save
    LightEditorManager._src = function() { return this._selSrc; };
    // Помечает текущий источник изменённым (для snapshot-сохранения только правок)
    LightEditorManager._markSrcDirty = function() {
        this._markDirty();
        var ev = API.getLightEvent(this._selSrc);
        if (ev) this._dirtySrc[ev.eventId] = true;
    };
    LightEditorManager.setSrcType = function(v) {
        API.setLightProp(this._src(), 'type', v); this._markSrcDirty();
        this.setSourcesPage(); // тип влияет на доступные контролы
    };
    LightEditorManager.setSrcActive = function(b) { API.setLightProp(this._src(), 'active', b); this._markSrcDirty(); };
    LightEditorManager.setSrcRadius = function(v) { API.setLightProp(this._src(), 'radius', v); this._markSrcDirty(); };
    LightEditorManager.setSrcRadiusY = function(v) { API.setLightProp(this._src(), 'radiusY', v); this._markSrcDirty(); };
    LightEditorManager.setSrcColor = function(v) { API.setLightProp(this._src(), 'color', v); this._markSrcDirty(); };
    LightEditorManager.setSrcBright = function(v) { API.setLightProp(this._src(), 'brightness', v); this._markSrcDirty(); };
    LightEditorManager.setSrcFalloff = function(v) { API.setLightProp(this._src(), 'falloff', v); this._markSrcDirty(); };
    LightEditorManager.setSrcPreset = function(v) { API.setLightProp(this._src(), 'presetId', v); this._markSrcDirty(); };
    LightEditorManager.setSrcFlashLen = function(v) { API.setLightProp(this._src(), 'flashLength', v); this._markSrcDirty(); };
    LightEditorManager.setSrcFlashWid = function(v) { API.setLightProp(this._src(), 'flashWidth', v); this._markSrcDirty(); };

    LightEditorManager.resetSource = function() {
        API.reloadEvents();
        this._selSrc = -1;
        this.setSourcesPage();
    };

    // Удалить/погасить выбранный в списке «Источники» источник + обновить вкладку.
    LightEditorManager.deleteSelectedSource = function() {
        if (this._selSrc < 0) return;
        var idx = this._selSrc;
        var e = API.getLightEvent(idx);
        if (!e) return;
        var msg = e.synthetic
            ? 'Удалить источник (синтетика)?'
            : 'Погасить источник EV' + e.eventId + '? (event в RPG Maker не трогается)';
        try { if (!window.confirm(msg)) return; } catch (e2) {}
        this.deleteLightAt(idx);
        this._selSrc = -1;
        this.setSourcesPage();
    };

    // Дублировать выбранный источник (синтетическая копия).
    LightEditorManager.duplicateSelectedSource = function() {
        if (this._selSrc < 0) return;
        this.duplicateLightAt(this._selSrc);
        this.setSourcesPage();
    };

    // =========================================================================
    // РЕЖИМ ВЫБОРА ИСТОЧНИКОВ НА КАРТЕ (in-game overlay)
    // =========================================================================
    // F8 или кнопка в F12 Sources → поверх карты появляются пронумерованные
    // маркеры на каждом источнике + кольца охвата. Клик по маркеру открывает
    // плавающую панель редактирования этого источника (live).
    // =========================================================================
    LightEditorManager._pickMode = false;
    LightEditorManager._pickLayer = null;
    LightEditorManager._pickCanvas = null;
    LightEditorManager._markBox = null;
    LightEditorManager._markers = {};
    LightEditorManager._editPanel = null;
    LightEditorManager._editIdx = -1;
    LightEditorManager._autoPick = false;   // оверлей включён автоматически с F12 Light Editor

    LightEditorManager.enablePickOverlay = function() {
        if (!this._pickMode) {
            this.createPickLayer();
            this._pickMode = true;
            this.updatePickLayer();
            this.createPalette();
            console.log('[SRD_LightEditor] pick overlay ON');
        }
    };
    LightEditorManager.disablePickOverlay = function() {
        if (this._pickMode) {
            this.destroyPickLayer();
            this.destroyPalette();
            this._pickMode = false;
            console.log('[SRD_LightEditor] pick overlay OFF');
        }
    };
    // Ручной тогл (F8 или кнопка) — снимает авто-флаг, чтобы закрытие F12 не снесло оверлей.
    LightEditorManager.togglePickMode = function() {
        this._autoPick = false;
        if (this._pickMode) this.disablePickOverlay(); else this.enablePickOverlay();
    };

    LightEditorManager._ensurePickStyle = function() {
        if (document.getElementById('LE-pickStyle')) return;
        var st = document.createElement('style');
        st.id = 'LE-pickStyle';
        st.textContent =
            '#LE-pickLayer { position:fixed; left:0; top:0; transform-origin:top left; pointer-events:none; z-index:2147483640; overflow:hidden; }' +
            '#LE-pickHint { position:absolute; left:8px; top:8px; background:rgba(0,0,0,0.7); color:#fff; padding:6px 10px; border-radius:6px; font:12px sans-serif; pointer-events:none; }' +
            '.le-pick-mark { position:absolute; transform:translate(-50%,-50%); width:24px; height:24px; border-radius:50%; pointer-events:auto; cursor:pointer; color:#fff; font:bold 12px monospace; text-align:center; line-height:22px; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.85); }' +
            '.le-pick-mark:hover { transform:translate(-50%,-50%) scale(1.35); }' +
            '#LE-editPanel { position:fixed; left:24px; top:24px; width:330px; background:#1f1f24; color:#eee; border:1px solid #444; border-radius:10px; padding:10px 12px 12px; z-index:2147483647; pointer-events:auto; font:12px sans-serif; box-shadow:0 8px 26px rgba(0,0,0,0.7); }' +
            '#LE-addBtn { z-index:2147483646; }' +
            '.le-ep-head { cursor:move; font-weight:bold; padding-bottom:6px; margin-bottom:8px; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center; gap:6px; }' +
            '.le-ep-title { font-size:12px; display:flex; align-items:center; gap:6px; flex:1; min-width:0; }' +
            '.le-ep-close { cursor:pointer; padding:0 4px; font-size:14px; opacity:0.7; }' +
            '.le-ep-close:hover { opacity:1; color:#e74c3c; }' +
            '.le-badge { display:inline-block; padding:1px 7px; border-radius:9px; font-size:9px; font-weight:bold; letter-spacing:0.3px; text-transform:uppercase; }' +
            '.le-badge-normal { background:#3498db; color:#fff; }' +
            '.le-badge-fire { background:#e97451; color:#fff; }' +
            '.le-badge-flashlight { background:#f1c40f; color:#222; }' +
            '.le-ep-actions { display:flex; gap:5px; margin:2px 0 9px 0; flex-wrap:wrap; }' +
            '.le-btn { flex:1; min-width:0; padding:6px 4px; font:11px sans-serif; border:1px solid #555; border-radius:6px; cursor:pointer; background:#333; color:#eee; text-align:center; white-space:nowrap; transition:filter .12s, transform .12s; }' +
            '.le-btn:hover { filter:brightness(1.25); }' +
            '.le-btn:active { transform:scale(0.96); }' +
            '.le-btn-toggle.on { background:#27ae60; border-color:#2ecc71; color:#fff; }' +
            '.le-btn-dup { background:#2c5f8a; border-color:#3a7fb8; color:#fff; }' +
            '.le-btn-del { background:#7a2424; border-color:#a83232; color:#fff; }' +
            '.le-btn-tobase { background:#16a085; border-color:#1abc9c; color:#fff; }' +
            '.le-ep-row { display:flex; align-items:center; gap:8px; margin:6px 0; }' +
            '.le-ep-row label { width:70px; flex-shrink:0; color:#bbb; }' +
            '.le-ep-row input[type=range], .le-ep-range { flex:1; min-width:0; cursor:pointer; }' +
            '.le-ep-row input[type=color], .le-ep-color { width:38px; height:24px; padding:0; border:1px solid #555; border-radius:5px; background:none; cursor:pointer; }' +
            '.le-ep-row select, .le-ep-select { flex:1; min-width:0; background:#2a2a30; color:#eee; border:1px solid #555; border-radius:5px; padding:3px 4px; }' +
            '.le-ep-row input[type=checkbox] { width:18px; height:18px; }' +
            '.le-ep-val { width:40px; text-align:right; font-family:monospace; color:#ffd479; }' +
            '.le-ep-cond { flex:1; min-width:0; background:#2a2a30; color:#eee; border:1px solid #555; border-radius:5px; padding:4px 7px; font-family:monospace; font-size:11px; }' +
            '.le-ep-ls label, .le-ep-lslabel { width:auto !important; flex:1; cursor:pointer; color:#eee; }' +
            '.le-ep-ls input[type=checkbox] { width:18px; height:18px; cursor:pointer; }' +
            '.le-ep-num { width:56px; background:#2a2a30; color:#eee; border:1px solid #555; border-radius:5px; padding:3px 6px; font-family:monospace; text-align:center; }' +
            '.le-ep-section { font-size:11px; font-weight:bold; color:#aaa; margin:10px 0 3px 0; }' +
            '.le-ep-hint { font-size:10px; opacity:0.6; margin:5px 0 0 78px; line-height:1.4; }' +
            '.le-ep-shortcuts { font-size:10px; opacity:0.55; margin:9px 0 0 0; padding-top:7px; border-top:1px solid #3a3a40; font-family:monospace; }' +
            '.le-chain { width:28px; height:24px; padding:0; font-size:13px; line-height:22px; border:1px solid #555; border-radius:5px; background:#333; color:#bbb; cursor:pointer; flex-shrink:0; text-align:center; }' +
            '.le-chain.on { background:#27ae60; border-color:#2ecc71; color:#fff; }' +
            '.le-chain:hover { filter:brightness(1.25); }' +
            '.le-btn-tmpl { background:#8e44ad; border-color:#9b59b6; color:#fff; }' +
            '.le-lib-item { display:flex; align-items:center; gap:8px; padding:8px 10px; margin:7px 0; background:#26262c; border:1px solid #3a3a40; border-radius:7px; flex-wrap:wrap; }' +
            '.le-lib-name { font-weight:bold; flex:1; min-width:120px; }' +
            '.le-lib-desc { font-family:monospace; font-size:11px; opacity:0.65; flex-basis:100%; }' +
            '.le-lib-btns { display:flex; gap:4px; flex-wrap:wrap; }' +
            '#LE-palette { position:fixed; right:14px; top:14px; width:232px; max-height:72vh; overflow:auto; background:#1f1f24; color:#eee; border:1px solid #444; border-radius:10px; z-index:2147483646; pointer-events:auto; font:12px sans-serif; box-shadow:0 8px 26px rgba(0,0,0,0.7); }' +
            '.le-pal-head { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:7px 9px; border-bottom:1px solid #3a3a40; position:sticky; top:0; background:#1f1f24; z-index:1; }' +
            '.le-pal-tabs { display:flex; gap:4px; }' +
            '.le-pal-tab { font:11px sans-serif; padding:3px 8px; border:1px solid #555; border-radius:5px; background:#333; color:#bbb; cursor:pointer; }' +
            '.le-pal-tab.on { background:#3498db; border-color:#5aaae6; color:#fff; }' +
            '.le-pal-collapse { cursor:pointer; padding:0 3px; font-size:13px; opacity:0.7; }' +
            '.le-pal-collapse:hover { opacity:1; }' +
            '.le-pal-body { padding:7px 9px; }' +
            '.le-pal-add { width:100%; margin-bottom:8px; padding:6px; font:11px sans-serif; border:1px solid #27ae60; border-radius:6px; background:#27ae60; color:#fff; cursor:pointer; }' +
            '.le-pal-add:hover { filter:brightness(1.2); }' +
            '.le-pal-item { display:flex; align-items:center; gap:6px; padding:5px 4px; border-radius:6px; }' +
            '.le-pal-item:hover { background:#2a2a32; }' +
            '.le-pal-swatch { width:14px; height:14px; border-radius:50%; border:1px solid #000; flex-shrink:0; }' +
            '.le-pal-name { flex:1; min-width:0; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
            '.le-pal-name:hover { color:#ffd479; }' +
            '.le-pal-mini { width:22px; height:22px; padding:0; font-size:11px; border:1px solid #555; border-radius:4px; background:#333; color:#bbb; cursor:pointer; flex-shrink:0; }' +
            '.le-pal-mini.del { background:#7a2424; color:#fff; }' +
            '.le-pal-mini:hover { filter:brightness(1.25); }' +
            '.le-pal-empty { font-size:11px; opacity:0.6; padding:8px 4px; line-height:1.5; }' +
            '.le-pal-hint { font-size:10px; opacity:0.6; margin-bottom:6px; }';
        document.head.appendChild(st);
    };

    LightEditorManager._typeColor = function(type) {
        return type === 'Fire' ? '#e97451' : (type === 'Flashlight' ? '#f1c40f' : '#3498db');
    };

    LightEditorManager.createPickLayer = function() {
        this._ensurePickStyle();
        var old = document.getElementById('LE-pickLayer');
        if (old) old.parentNode.removeChild(old);
        var layer = document.createElement('div');
        layer.id = 'LE-pickLayer';
        var cv = document.createElement('canvas');
        cv.width = Graphics.boxWidth; cv.height = Graphics.boxHeight;
        cv.style.position = 'absolute'; cv.style.left = '0'; cv.style.top = '0';
        layer.appendChild(cv);
        var box = document.createElement('div');
        box.style.position = 'absolute'; box.style.left = '0'; box.style.top = '0';
        layer.appendChild(box);
        // Полноэкранный слой захвата клика для размещения новых источников (включается в режиме placement)
        var place = document.createElement('div');
        place.id = 'LE-placeCapture';
        place.style.position = 'absolute'; place.style.left = '0'; place.style.top = '0';
        place.style.width = '100%'; place.style.height = '100%';
        place.style.pointerEvents = 'none';
        place.style.cursor = 'crosshair';
        place.style.background = 'rgba(0,0,0,0.0)';
        layer.appendChild(place);
        var hint = document.createElement('div');
        hint.id = 'LE-pickHint';
        hint.innerHTML = '🎯 Тяни маркер — двигать · клик — редактировать · <b>+ Новый</b> внизу справа';
        layer.appendChild(hint);
        document.body.appendChild(layer);
        this._pickLayer = layer;
        this._pickCanvas = cv;
        this._markBox = box;
        this._placeCapture = place;
        this._markers = {};
        // Кнопка «+ Новый источник» — отдельный фиксированный элемент (не масштабируется вместе со слоем)
        var oldBtn = document.getElementById('LE-addBtn');
        if (oldBtn) oldBtn.parentNode.removeChild(oldBtn);
        var addBtn = document.createElement('button');
        addBtn.id = 'LE-addBtn';
        addBtn.textContent = '+ Новый источник';
        addBtn.className = 'button';
        addBtn.style.position = 'fixed';
        addBtn.style.right = '14px'; addBtn.style.bottom = '14px';
        addBtn.style.zIndex = '2147483646';
        addBtn.style.pointerEvents = 'auto';
        addBtn.onmousedown = function(ev) { ev.stopPropagation(); };
        addBtn.onclick = function(ev) { ev.stopPropagation(); LightEditorManager.startPlacement(); };
        document.body.appendChild(addBtn);
    };

    LightEditorManager.destroyPickLayer = function() {
        if (this._pickLayer && this._pickLayer.parentNode) this._pickLayer.parentNode.removeChild(this._pickLayer);
        var addBtn = document.getElementById('LE-addBtn');
        if (addBtn && addBtn.parentNode) addBtn.parentNode.removeChild(addBtn);
        this._pickLayer = null; this._pickCanvas = null; this._markBox = null; this._placeCapture = null;
        this._markers = {};
        this._placing = false;
        this._cancelPlacement();
        this.closeEditPanel();
    };

    // =========================================================================
    // ПАЛИТРА (правый верхний угол) — всегда поверх во время редактирования света.
    // Два режима: 💡 шаблоны источников + ◐ falloff-пресеты.
    // =========================================================================
    LightEditorManager._palMode = 'light';
    LightEditorManager._palCollapsed = false;

    LightEditorManager.createPalette = function() {
        this._ensurePickStyle();
        var old = document.getElementById('LE-palette');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var pal = document.createElement('div');
        pal.id = 'LE-palette';
        document.body.appendChild(pal);
        this._palette = pal;
        this.refreshPalette();
    };
    LightEditorManager.destroyPalette = function() {
        var pal = document.getElementById('LE-palette');
        if (pal && pal.parentNode) pal.parentNode.removeChild(pal);
        this._palette = null;
    };
    LightEditorManager.togglePaletteCollapse = function() {
        this._palCollapsed = !this._palCollapsed;
        this.refreshPalette();
    };
    LightEditorManager.setPaletteMode = function(mode) {
        this._palMode = mode;
        this.refreshPalette();
    };
    LightEditorManager.refreshPalette = function() {
        var pal = this._palette || document.getElementById('LE-palette');
        if (!pal) return;
        var mode = this._palMode || 'light';
        var head = '<div class="le-pal-head">' +
            '<span class="le-pal-tabs">' +
            '<button class="le-pal-tab' + (mode === 'light' ? ' on' : '') + '" onclick="LightEditorManager.setPaletteMode(\'light\')">💡 Источники</button>' +
            '<button class="le-pal-tab' + (mode === 'falloff' ? ' on' : '') + '" onclick="LightEditorManager.setPaletteMode(\'falloff\')">◐ Falloff</button>' +
            '</span>' +
            '<span class="le-pal-collapse" onclick="LightEditorManager.togglePaletteCollapse()" title="Свернуть/развернуть">' + (this._palCollapsed ? '▸' : '▾') + '</span>' +
            '</div>';
        var body = this._palCollapsed ? '' : (mode === 'light' ? this._paletteLightHtml() : this._paletteFalloffHtml());
        pal.innerHTML = head + body;
    };
    LightEditorManager._paletteLightHtml = function() {
        var lib = this._lib();
        var html = '<div class="le-pal-body">';
        html += '<button class="le-pal-add" onclick="LightEditorManager.saveEditedAsTemplate()">＋ из текущего источника</button>';
        if (!lib || lib.length === 0) {
            html += '<div class="le-pal-empty">Шаблонов нет.<br>Кликни источник на карте → «＋ из текущего».</div>';
        } else {
            for (var i = 0; i < lib.length; i++) {
                var t = lib[i];
                var bg = (typeof t.color === 'string') ? t.color : '#fff';
                html += '<div class="le-pal-item">' +
                    '<span class="le-pal-swatch" style="background:' + esc(bg) + '" title="' + esc(t.type || '') + '"></span>' +
                    '<span class="le-pal-name" onclick="LightEditorManager.createLightFromTemplate(' + i + ')" title="Поставить на карте">' + esc(t.name || ('#' + (i + 1))) + '</span>' +
                    '<button class="le-pal-mini" onclick="LightEditorManager.renameTemplate(' + i + ')" title="Переименовать">✎</button>' +
                    '<button class="le-pal-mini del" onclick="LightEditorManager.deleteTemplate(' + i + ')" title="Удалить">🗑</button>' +
                    '</div>';
            }
        }
        html += '</div>';
        return html;
    };
    LightEditorManager._paletteFalloffHtml = function() {
        var ids = API.getPresets();
        var html = '<div class="le-pal-body">';
        html += '<div class="le-pal-hint">Кликни пресет — применится к открытому источнику.</div>';
        if (!ids || ids.length === 0) {
            html += '<div class="le-pal-empty">Пресетов нет.</div>';
        } else {
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                var builtin = API.isPresetBuiltin ? API.isPresetBuiltin(id) : false;
                html += '<div class="le-pal-item">' +
                    '<span class="le-pal-name" onclick="LightEditorManager.applyPresetToCurrent(\'' + esc(id) + '\')" title="Применить к текущему">' + esc(id) + (builtin ? ' ★' : '') + '</span>' +
                    '</div>';
            }
        }
        html += '</div>';
        return html;
    };
    LightEditorManager.applyPresetToCurrent = function(presetId) {
        if (this._editIdx < 0) { this._flashMsg('Сначала кликни источник на карте — откроется панель.'); return; }
        this.setSrcField('presetId', presetId);
    };

    // =========================================================================
    // УСЛОВИЕ: галочка локального переключателя (L1) + доп. условия (через И).
    // =========================================================================
    // Формат cond:  "L1"  |  "L1 && (rest)"  |  "rest"  |  "".
    LightEditorManager._extractLS1 = function(cond) {
        if (!cond || typeof cond !== 'string') return { present: false, rest: '' };
        var s = cond.trim();
        var m = s.match(/^L1\b/);
        if (m) {
            var rest = s.substring(m[0].length).trim().replace(/^&&/, '').trim();
            if (rest.charAt(0) === '(' && rest.charAt(rest.length - 1) === ')') rest = rest.slice(1, -1).trim();
            return { present: true, rest: rest };
        }
        return { present: false, rest: s };
    };
    LightEditorManager._buildCondLS1 = function(present, rest) {
        rest = (rest || '').trim();
        if (present) return rest ? ('L1 && (' + rest + ')') : 'L1';
        return rest;
    };
    LightEditorManager.onLSToggle = function() {
        var chk = document.getElementById('epLSchk');
        this._lsPresent = chk ? chk.checked : false;
        this.setSrcField('cond', this._buildCondLS1(this._lsPresent, this._lsRest || ''));
    };
    LightEditorManager.onLSRestChange = function(text) {
        this._lsRest = (text || '').trim();
        this.setSrcField('cond', this._buildCondLS1(this._lsPresent, this._lsRest));
    };

    // Создание маркера: mousedown → драг (двигать) или клик (редактировать).
    LightEditorManager._mkMarker = function(e) {
        var m = document.createElement('div');
        m.className = 'le-pick-mark';
        m.style.background = this._typeColor(e.type);
        m.title = (e.synthetic ? '(синтетика) ' : (e.name || '(без имени)') + ' — ') + e.type +
            (e.presetId ? ' (' + e.presetId + ')' : ' (линейный)') + ' · тяни, чтобы двигать';
        var info = { idx: e.idx, synthetic: !!e.synthetic, sid: e.sid, eventId: e.eventId };
        m.addEventListener('mousedown', function(ev) {
            ev.stopPropagation(); ev.preventDefault();
            LightEditorManager._beginMarkerDrag(info, ev.clientX, ev.clientY);
        });
        return m;
    };

    // --- Drag маркера (двигать источник) ---
    LightEditorManager._beginMarkerDrag = function(info, sx, sy) {
        var M = LightEditorManager;
        var state0 = { info: info, startX: sx, startY: sy, moved: false };
        M._dragInfo = state0;
        var onMove = function(e2) {
            var dx = e2.clientX - state0.startX, dy = e2.clientY - state0.startY;
            if (!state0.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) state0.moved = true;
            if (state0.moved) M._dragTo(e2.clientX, e2.clientY, info);
        };
        var onUp = function(e2) {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            M._dragInfo = null;
            if (state0.moved) {
                M._endDrag(info);
            } else {
                M.openEditPanel(info.idx); // клик без перетаскивания → редактировать
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    // Живое перемещение во время драга
    LightEditorManager._dragTo = function(clientX, clientY, info) {
        var tile = this._clientToTile(clientX, clientY);
        if (!tile) return;
        if (info.synthetic) {
            // синтетика: меняем x/y напрямую
            API.setLightProp(info.idx, 'x', tile.x);
            API.setLightProp(info.idx, 'y', tile.y);
        } else {
            // реальный event: locate
            var ev = (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.event(info.eventId) : null;
            if (ev && typeof ev.locate === 'function') {
                ev.locate(tile.x, tile.y);
            }
            // запоминаем новую позицию для snapshot
            if (!this._movedPos) this._movedPos = {};
            this._movedPos[info.eventId] = { x: tile.x, y: tile.y };
        }
        this._markDirty();
    };

    LightEditorManager._endDrag = function(info) {
        // ничего доп.: позиция уже живая и помечена dirty → автосохранение сработает
        if (!info.synthetic) {
            var ev = (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.event(info.eventId) : null;
            if (ev) this._markDirty();
        }
    };

    // --- Создание нового источника (placement mode) ---
    LightEditorManager._placing = false;
    LightEditorManager._movedPos = null;  // { eventId: {x,y} } перемещённые реальные источники

    LightEditorManager.startPlacement = function() {
        if (!this._pickLayer) this.enablePickOverlay();
        this._placing = true;
        var hint = document.getElementById('LE-pickHint');
        if (hint) hint.innerHTML = '👆 Кликни по карте, чтобы поставить источник · ESC/ПКМ — отмена';
        if (this._placeCapture) {
            this._placeCapture.style.pointerEvents = 'auto';
            this._placeCapture.style.background = 'rgba(40,80,160,0.08)';
        }
        var M = this;
        var onPlaceClick = function(e2) {
            e2.stopPropagation(); e2.preventDefault();
            var tile = M._clientToTile(e2.clientX, e2.clientY);
            if (!tile) return;
            var sid = API.addSyntheticLight({ x: tile.x, y: tile.y, type: 'Normal', radius: 120, color: '#FFFFFF', brightness: 1, falloff: 1, active: true });
            M._cancelPlacement();
            // открыть панель только что созданного источника
            var all = API.getSyntheticLights();
            for (var i = 0; i < all.length; i++) {
                if (all[i].sid === sid) { M.openEditPanel(all[i].idx); break; }
            }
            M._markDirty();
        };
        var onKey = function(e2) {
            if (e2.keyCode === 27) { M._cancelPlacement(); } // ESC
        };
        var onCtx = function(e2) { e2.preventDefault(); M._cancelPlacement(); };
        this._placeHandlers = { click: onPlaceClick, key: onKey, ctx: onCtx };
        if (this._placeCapture) this._placeCapture.addEventListener('mousedown', onPlaceClick);
        document.addEventListener('keydown', onKey);
        if (this._placeCapture) this._placeCapture.addEventListener('contextmenu', onCtx);
    };

    LightEditorManager._cancelPlacement = function() {
        this._placing = false;
        var hint = document.getElementById('LE-pickHint');
        if (hint) hint.innerHTML = '🎯 Тяни маркер — двигать · клик — редактировать · <b>+ Новый</b> внизу справа';
        if (this._placeCapture) {
            this._placeCapture.style.pointerEvents = 'none';
            this._placeCapture.style.background = 'rgba(0,0,0,0.0)';
        }
        if (this._placeHandlers) {
            if (this._placeCapture) {
                this._placeCapture.removeEventListener('mousedown', this._placeHandlers.click);
                this._placeCapture.removeEventListener('contextmenu', this._placeHandlers.ctx);
            }
            document.removeEventListener('keydown', this._placeHandlers.key);
            this._placeHandlers = null;
        }
    };

    // Текущий зум карты (SuperDuperCamera + нативный MV). 1 = без зума.
    LightEditorManager._zoomScale = function() {
        try {
            if (typeof $gameScreen !== 'undefined' && $gameScreen && $gameScreen.zoomScale) {
                var z = $gameScreen.zoomScale();
                return (z && isFinite(z)) ? z : 1;
            }
        } catch (e) {}
        return 1;
    };

    // Точная отрисованная позиция события на экране (в box-пикселях) С учётом зума,
    // margin и скролла. Берётся из worldTransform спрайта события; fallback — формула
    // зума вокруг точки (zoomX,zoomY).
    LightEditorManager._eventRenderPos = function(eventId) {
        var ev = (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.event(eventId) : null;
        if (!ev) return null;
        // 1) Через спрайт (самый точный — учитывает всё: зум, margin, scroll)
        try {
            var scene = SceneManager._scene;
            var sprites = scene && scene._spriteset && scene._spriteset._characterSprites;
            if (sprites) {
                for (var i = 0; i < sprites.length; i++) {
                    var sp = sprites[i];
                    if (sp && sp._character && sp._character._eventId === eventId) {
                        var wt = sp.worldTransform;
                        if (wt && isFinite(wt.tx) && isFinite(wt.ty)) {
                            return { x: wt.tx, y: wt.ty };
                        }
                    }
                }
            }
        } catch (e) {}
        // 2) Fallback: формула зума вокруг (zoomX,zoomY)
        var scale = this._zoomScale();
        var zx = 0, zy = 0;
        try { zx = $gameScreen.zoomX(); zy = $gameScreen.zoomY(); } catch (e2) {}
        var sx = ev.screenX(), sy = ev.screenY();
        return { x: (sx - zx) * scale + zx, y: (sy - zy) * scale + zy };
    };

    // Позиция источника на overlay (box-пиксели) с учётом зума.
    // Синтетика → из tile-коорд через zoom; реальный → из спрайта.
    LightEditorManager._overlayPos = function(e) {
        if (e && e.synthetic) {
            var scale = this._zoomScale();
            var zx = 0, zy = 0;
            try { zx = $gameScreen.zoomX(); zy = $gameScreen.zoomY(); } catch (err) {}
            var tw = $gameMap.tileWidth(), th = $gameMap.tileHeight();
            var lx = ($gameMap.adjustX(e.x) * tw + tw / 2);
            var ly = ($gameMap.adjustY(e.y) * th + th / 2);
            return { x: (lx - zx) * scale + zx, y: (ly - zy) * scale + zy };
        }
        return this._eventRenderPos(e.eventId);
    };

    // Конвертация курсора (clientX/Y) → tile-координаты с учётом зума и скролла.
    LightEditorManager._clientToTile = function(clientX, clientY) {
        var canvas = Graphics._canvas;
        var rect = canvas.getBoundingClientRect();
        var bw = Graphics.boxWidth;
        var s = (rect.width > 0) ? (rect.width / bw) : 1;
        var bx = (clientX - rect.left) / s;
        var by = (clientY - rect.top) / s;
        var scale = this._zoomScale();
        var zx = 0, zy = 0;
        try { zx = $gameScreen.zoomX(); zy = $gameScreen.zoomY(); } catch (e) {}
        var lx = (bx - zx) / scale + zx;
        var ly = (by - zy) / scale + zy;
        var tx, ty;
        try {
            var tw = $gameMap.tileWidth(), th = $gameMap.tileHeight();
            var dispX = $gameMap.displayX(), dispY = $gameMap.displayY();
            // Снап к ближайшему тайлу, чей центр под курсором (не «левый край» как canvasToMapX)
            tx = Math.round(dispX + lx / tw - 0.5);
            ty = Math.round(dispY + ly / th - 0.5);
            tx = $gameMap.roundX(tx);
            ty = $gameMap.roundY(ty);
            tx = Math.max(0, Math.min($gameMap.width() - 1, tx));
            ty = Math.max(0, Math.min($gameMap.height() - 1, ty));
        } catch (e2) { return null; }
        return { x: tx, y: ty };
    };

    LightEditorManager.updatePickLayer = function() {
        var layer = this._pickLayer;
        if (!layer) return;
        if (!(typeof Scene_Map !== 'undefined' && SceneManager._scene instanceof Scene_Map) || !$gameMap) {
            layer.style.display = 'none';
            return;
        }
        var canvas = Graphics._canvas;
        var rect = canvas.getBoundingClientRect();
        var bw = Graphics.boxWidth, bh = Graphics.boxHeight;
        var s = (rect.width > 0) ? (rect.width / bw) : 1;
        layer.style.display = 'block';
        layer.style.left = rect.left + 'px';
        layer.style.top = rect.top + 'px';
        layer.style.width = bw + 'px';
        layer.style.height = bh + 'px';
        layer.style.transform = 'scale(' + s + ')';

        this._drawPickRings();

        var events = API.getLightEvents();
        var present = {};
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            present[e.idx] = true;
            var pos = this._overlayPos(e);
            if (!pos) continue;
            var sx = pos.x, sy = pos.y;
            var offscreen = (sx < -30 || sy < -30 || sx > bw + 30 || sy > bh + 30);
            var m = this._markers[e.idx];
            if (!m) {
                m = this._mkMarker(e);
                this._markBox.appendChild(m);
                this._markers[e.idx] = m;
            }
            m.style.left = sx + 'px';
            m.style.top = sy + 'px';
            m.style.display = offscreen ? 'none' : 'block';
            m.textContent = String(i + 1);
            m.style.background = this._typeColor(e.type);
        }
        for (var k in this._markers) {
            if (!present[k]) { this._markBox.removeChild(this._markers[k]); delete this._markers[k]; }
        }
        if (this._editIdx >= 0 && !present[this._editIdx]) this.closeEditPanel();
    };

    LightEditorManager._drawPickRings = function() {
        var cv = this._pickCanvas;
        if (!cv || !$gameMap) return;
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        var scale = this._zoomScale();
        var events = API.getLightEvents();
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            var pos = this._overlayPos(e);
            if (!pos) continue;
            var sx = pos.x, sy = pos.y;
            var r = Math.max(0, (e.radius || 0)) * scale;
            ctx.strokeStyle = this._typeColor(e.type);
            ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
            ctx.beginPath();
            if (e.radiusY && e.radiusY !== e.radius) {
                var ry = Math.max(0, e.radiusY) * scale;
                ctx.save(); ctx.translate(sx, sy); ctx.scale(1, ry / (r || 1));
                ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.restore();
            } else {
                ctx.arc(sx, sy, r, 0, 2 * Math.PI);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    };

    // --- Плавающая панель редактирования ---
    // Перенести элемент в конец <body> — DOM-порядком он поверх прочих (страховка z-index).
    LightEditorManager._bringToFront = function(el) {
        if (el && el.parentNode === document.body) {
            document.body.appendChild(el); // ре-аппенд = переместить в конец
        }
    };

    LightEditorManager.openEditPanel = function(idx) {
        var e = API.getLightEvent(idx);
        if (!e) return;
        this._editIdx = idx;
        this._selSrc = idx;
        var panel = this._editPanel;
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'LE-editPanel';
            document.body.appendChild(panel);
            this._editPanel = panel;
        }
        panel.innerHTML = this._editPanelHtml(e);
        panel.style.display = 'block';
        this._bindPanel();
        // Гарантировать, что панель (и оверлей) — последние дети body (поверх).
        this._bringToFront(panel);
        if (this._pickLayer) this._bringToFront(this._pickLayer);
        var addBtn = document.getElementById('LE-addBtn');
        if (addBtn) this._bringToFront(addBtn);
    };

    LightEditorManager.closeEditPanel = function() {
        if (this._editPanel) this._editPanel.style.display = 'none';
        this._editIdx = -1;
    };

    // Единый сеттер для панели (не трогает F12 Sources UI)
    LightEditorManager.setSrcField = function(field, value) {
        if (this._editIdx < 0) return;
        API.setLightProp(this._editIdx, field, value);
        this._markDirty();
        var ev = API.getLightEvent(this._editIdx);
        if (ev) this._dirtySrc[ev.eventId] = true;
    };

    LightEditorManager._epSetText = function(id, val, dec) {
        var el = document.getElementById(id);
        if (el) el.textContent = dec ? fmt(Number(val), dec) : String(Math.round(Number(val)));
    };

    LightEditorManager._editPanelHtml = function(e) {
        var presets = API.getPresets();
        var pOpts = '<option value="">(линейный)</option>';
        for (var i = 0; i < presets.length; i++) {
            pOpts += '<option value="' + esc(presets[i]) + '"' + (presets[i] === e.presetId ? ' selected' : '') + '>' + esc(presets[i]) + '</option>';
        }
        var types = ['Normal', 'Fire', 'Flashlight'];
        var typeOpts = '';
        for (var t = 0; t < types.length; t++) {
            typeOpts += '<option value="' + types[t] + '"' + (types[t] === e.type ? ' selected' : '') + '>' + types[t] + '</option>';
        }
        var row = function(label, inner) { return '<div class="le-ep-row"><label>' + label + '</label>' + inner + '</div>'; };
        var slider = function(id, field, val, min, max, step, dec) {
            var disp = dec ? fmt(val, dec) : Math.round(val);
            return '<input type="range" class="le-ep-range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" ' +
                'oninput="LightEditorManager.setSrcField(\'' + field + '\',this.value); LightEditorManager._epSetText(\'' + id + 'V\',this.value,' + (dec ? dec : 0) + ')">' +
                '<span class="le-ep-val" id="' + id + 'V">' + disp + '</span>';
        };
        var headTitle = e.synthetic
            ? ('#' + (e.idx + 1) + ' · синтетика')
            : ('#' + (e.idx + 1) + ' EV' + e.eventId + ' ' + esc(e.name || ''));
        var tlow = (e.type || 'Normal').toLowerCase();

        var html = '<div class="le-ep-head" id="LEepHead">' +
            '<span class="le-ep-title">' + headTitle + ' <span class="le-badge le-badge-' + tlow + '">' + esc(e.type) + '</span></span>' +
            '<span id="LEepClose" class="le-ep-close" title="Закрыть (Esc)">✕</span></div>';

        // Панель быстрых действий
        html += '<div class="le-ep-actions">';
        html += '<button class="le-btn le-btn-toggle' + (e.active ? ' on' : '') + '" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();LightEditorManager.toggleActiveAt(' + e.idx + ');LightEditorManager.openEditPanel(' + e.idx + ')" title="Вкл/выкл (Space)">' + (e.active ? '● горит' : '○ выключен') + '</button>';
        html += '<button class="le-btn le-btn-dup" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();LightEditorManager.duplicateLightAt(' + e.idx + ')" title="Дублировать (D)">⧉ дубль</button>';
        html += '<button class="le-btn le-btn-tmpl" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();LightEditorManager.saveEditedAsTemplate()" title="Сохранить как шаблон">💾 в шаблон</button>';
        html += '<button class="le-btn le-btn-del" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();LightEditorManager._confirmDelete(' + e.idx + ')" title="Удалить (Del)">🗑 удалить</button>';
        html += '</div>';
        // Сохранить в базу (только для реальных event'ов) — чтобы потом удалить event в RPG Maker.
        if (!e.synthetic) {
            html += '<div class="le-ep-actions">' +
                '<button class="le-btn le-btn-tobase" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();LightEditorManager._saveSourceBtn()" title="Сохранить копию в snapshot и погасить оригинал — event можно будет удалить в RPG Maker">💾 в базу (удалить event с карты)</button>' +
                '</div>';
        }

        html += row('тип', '<select class="le-ep-select" onchange="LightEditorManager.setSrcField(\'type\',this.value);LightEditorManager.openEditPanel(' + e.idx + ')">' + typeOpts + '</select>');
        // Радиус с цепью X/Y: 🔗 — круг (X и Y связаны), 🔓 — овал (независимо).
        var linked = (this._radiusLinked === undefined) ? (e.radius === e.radiusY) : this._radiusLinked;
        this._radiusLinked = linked;
        html += '<div class="le-ep-row"><label>радиус</label>' +
            '<input type="range" id="epRslider" class="le-ep-range" min="0" max="800" step="1" value="' + e.radius + '" ' +
            'oninput="LightEditorManager.setRadiusLinkedValue(this.value); LightEditorManager._epSetText(\'epRV\',this.value,0)">' +
            '<button class="le-chain' + (linked ? ' on' : '') + '" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();LightEditorManager.toggleChain()" title="Связать X/Y (круг)">' + (linked ? '🔗' : '🔓') + '</button>' +
            '<span class="le-ep-val" id="epRV">' + Math.round(e.radius) + '</span></div>';
        html += '<div class="le-ep-row"><label>радиус Y</label>' +
            '<input type="range" id="epRYslider" class="le-ep-range" min="0" max="800" step="1" value="' + e.radiusY + '"' +
            (linked ? ' disabled style="opacity:0.4"' : '') +
            ' oninput="LightEditorManager.setSrcField(\'radiusY\',this.value); LightEditorManager._epSetText(\'epRYV\',this.value,0)">' +
            '<span class="le-ep-val" id="epRYV">' + Math.round(e.radiusY) + '</span></div>';
        html += row('цвет', '<input type="color" class="le-ep-color" value="' + esc(e.color) + '" oninput="LightEditorManager.setSrcField(\'color\',this.value)">');
        html += row('яркость', slider('epB', 'brightness', e.brightness, 0, 1, 0.05, 2));
        html += row('плавность', slider('epF', 'falloff', e.falloff, 0, 1, 0.05, 2));
        html += row('пресет', '<select class="le-ep-select" onchange="LightEditorManager.setSrcField(\'presetId\',this.value)">' + pOpts + '</select>');
        if (e.type === 'Flashlight') {
            html += row('flash L', slider('epFL', 'flashLength', e.flashLength, 1, 30, 1, 0));
            html += row('flash W', slider('epFW', 'flashWidth', e.flashWidth, 1, 40, 1, 0));
        }
        // Условие: галочка лок. переключателя (L1) + доп. условия (через И).
        var ls = this._extractLS1(e.cond);
        this._lsPresent = ls.present;
        this._lsRest = ls.rest || '';
        var _mapId = (typeof $gameMap !== 'undefined' && $gameMap) ? $gameMap.mapId() : 0;
        var gid = (window.SDMapSwitch && SDMapSwitch.globalId) ? SDMapSwitch.globalId(_mapId, 1) : 0;
        html += '<div class="le-ep-section">Условие свечения</div>';
        html += '<div class="le-ep-row le-ep-ls">' +
            '<input type="checkbox" id="epLSchk" ' + (ls.present ? 'checked' : '') + ' onchange="LightEditorManager.onLSToggle()">' +
            '<label for="epLSchk" class="le-ep-lslabel">Лок. переключатель этой карты</label>' +
            '</div>';
        html += '<div class="le-ep-row"><label>доп. условия</label>' +
            '<input type="text" class="le-ep-cond" id="epCondRest" value="' + esc(ls.rest || '') + '" placeholder="(пусто = только галочка; S5/V12/&&…)" onchange="LightEditorManager.onLSRestChange(this.value)"></div>';
        if (gid > 0) {
            html += '<div class="le-ep-hint">Галочка = глоб. переключатель №<b>' + gid + '</b> (можно ставить в условие страницы события). Доп. условия прибавляются через И.</div>';
        } else {
            html += '<div class="le-ep-hint">Галочка и доп. условия (S5/V12/&&) объединяются через И.</div>';
        }
        html += '<div class="le-ep-shortcuts">⌨ Del — удалить · D — дубль · Space — вкл/выкл · Esc — закрыть</div>';
        return html;
    };

    // Удаление синтетического источника по idx
    // Принудительное сохранение текущего источника в базу (синтетику).
    // Если источник — реальный event, конвертирует его в синтетический + гасит оригинал.
    LightEditorManager._saveSourceBtn = function() {
        var e = API.getLightEvent(this._editIdx);
        if (!e) return;
        if (!e.synthetic) {
            // Конвертируем реальный event в синтетический + гасим оригинал.
            var ev = $gameMap.event(e.eventId);
            if (!ev) return;
            var mapId = String($gameMap.mapId());
            if (!this._suppressedEvents) this._suppressedEvents = {};
            if (!this._suppressedEvents[mapId]) this._suppressedEvents[mapId] = {};
            var sid = API.addSyntheticLight({
                x: ev._realX, y: ev._realY,
                type: e.type, radius: e.radius, radiusY: (e.radiusY !== undefined ? e.radiusY : e.radius),
                color: e.color,
                brightness: e.brightness, falloff: e.falloff, presetId: e.presetId,
                active: e.active, flashLength: e.flashLength, flashWidth: e.flashWidth,
                direction: e.direction || 0, cond: e.cond
            });
            API.setLightProp(e.idx, 'active', false);
            this._suppressedEvents[mapId][e.eventId] = true;
            this.saveAll();
            // открыть панель новой синтетики (оригинал погашен)
            var all = API.getSyntheticLights();
            for (var i = 0; i < all.length; i++) {
                if (all[i].sid === sid) { this.openEditPanel(all[i].idx); break; }
            }
        } else {
            this.saveAll();
        }
    };

    LightEditorManager.deleteSyntheticAt = function(idx) {
        var e = API.getLightEvent(idx);
        if (!e || !e.synthetic) return;
        API.removeSyntheticLight(e.sid);
        this.closeEditPanel();
        this._markDirty();
    };

    // --- Единое «удаление» источника (для реальных событий — погасить + запомнить,
    //     для синтетики — убрать). С автосохранением в snapshot. ---
    LightEditorManager.deleteLightAt = function(idx) {
        var e = API.getLightEvent(idx);
        if (!e) return;
        if (e.synthetic) {
            API.removeSyntheticLight(e.sid);
        } else {
            var mapId = String($gameMap.mapId());
            if (!this._suppressedEvents) this._suppressedEvents = {};
            if (!this._suppressedEvents[mapId]) this._suppressedEvents[mapId] = {};
            API.setLightProp(idx, 'active', false);
            this._suppressedEvents[mapId][e.eventId] = true;
        }
        this.closeEditPanel();
        this._markDirty();
        this.saveAll();
    };

    LightEditorManager._confirmDelete = function(idx) {
        var e = API.getLightEvent(idx);
        if (!e) return;
        var msg = e.synthetic
            ? 'Удалить источник (синтетика)?'
            : 'Погасить источник EV' + e.eventId + '?\nСвет выключится и сохранится. Сам event в RPG Maker не трогается — его можно удалить вручную.';
        try { if (!window.confirm(msg)) return; } catch (e2) { /* confirm недоступен — удаляем без вопроса */ }
        this.deleteLightAt(idx);
    };

    // --- Дублировать источник (синтетическая копия в той же точке). ---
    LightEditorManager.duplicateLightAt = function(idx) {
        var e = API.getLightEvent(idx);
        if (!e) return;
        var x = e.x, y = e.y;
        if (x === undefined || y === undefined) {
            var ev = $gameMap.event(e.eventId);
            if (ev) { x = ev._realX; y = ev._realY; } else { x = 0; y = 0; }
        }
        var sid = API.addSyntheticLight({
            x: x, y: y, type: e.type, radius: e.radius, radiusY: (e.radiusY !== undefined ? e.radiusY : e.radius),
            color: e.color,
            brightness: e.brightness, falloff: e.falloff, presetId: e.presetId,
            active: e.active, flashLength: e.flashLength, flashWidth: e.flashWidth,
            direction: e.direction || 0, cond: e.cond
        });
        this._markDirty();
        this.saveAll();
        var all = API.getSyntheticLights();
        for (var i = 0; i < all.length; i++) {
            if (all[i].sid === sid) { this.openEditPanel(all[i].idx); break; }
        }
    };

    // --- Быстрое переключение активности + обновить панель. ---
    LightEditorManager.toggleActiveAt = function(idx) {
        var e = API.getLightEvent(idx);
        if (!e) return;
        API.setLightProp(idx, 'active', !e.active);
        this._markDirty();
        if (!e.synthetic && this._dirtySrc) this._dirtySrc[e.eventId] = true;
    };

    // =========================================================================
    // ЦЕПЬ РАДИУСОВ X/Y (🔗 — круг, связаны; 🔓 — овал, независимо)
    // =========================================================================
    LightEditorManager.setRadiusLinkedValue = function(v) {
        this.setSrcField('radius', v);
        if (this._radiusLinked) {
            this.setSrcField('radiusY', v);
            var s = document.getElementById('epRYslider'); if (s) s.value = v;
            this._epSetText('epRYV', v, 0);
        }
    };
    LightEditorManager.toggleChain = function() {
        this._radiusLinked = !this._radiusLinked;
        if (this._radiusLinked) {
            var e = API.getLightEvent(this._editIdx);
            if (e) this.setSrcField('radiusY', e.radius); // снаппим в круг
        }
        if (this._editIdx >= 0) this.openEditPanel(this._editIdx);
    };

    // =========================================================================
    // БИБЛИОТЕКА ШАБЛОНОВ источников (сохраняем/переименовываем/удаляем/ставим)
    // =========================================================================
    LightEditorManager._lib = function() {
        if (!this._patch) this._patch = { library: [] };
        if (!Array.isArray(this._patch.library)) this._patch.library = [];
        return this._patch.library;
    };
    LightEditorManager._promptName = function(dflt) {
        try { return window.prompt('Имя шаблона:', dflt || 'шаблон'); } catch (e) { return dflt || 'шаблон'; }
    };
    LightEditorManager._pushTemplate = function(e, name) {
        if (!e) return;
        this._lib().push({
            name: name || 'шаблон',
            type: e.type,
            radius: e.radius,
            radiusY: (e.radiusY !== undefined ? e.radiusY : e.radius),
            color: e.color,
            brightness: e.brightness,
            falloff: e.falloff,
            presetId: e.presetId,
            flashLength: e.flashLength,
            flashWidth: e.flashWidth,
            cond: e.cond || null
        });
        this.saveAll();
        this.refreshPalette();
    };
    LightEditorManager.saveEditedAsTemplate = function() {
        if (this._editIdx < 0) { this._flashMsg('Сначала кликни источник на карте — откроется панель.'); return; }
        var e = API.getLightEvent(this._editIdx);
        var nm = this._promptName(e && e.name ? e.name : 'шаблон');
        if (nm === null) return;
        this._pushTemplate(e, nm);
    };
    LightEditorManager.saveSelectedAsTemplate = function() {
        if (this._selSrc < 0) { this._flashMsg('Выбери источник в кладке «Источники».'); return; }
        var e = API.getLightEvent(this._selSrc);
        var nm = this._promptName(e && e.name ? e.name : 'шаблон');
        if (nm === null) return;
        this._pushTemplate(e, nm);
    };
    LightEditorManager.deleteTemplate = function(i) {
        var lib = this._lib();
        if (i < 0 || i >= lib.length) return;
        try { if (!window.confirm('Удалить шаблон «' + (lib[i].name || '') + '»?')) return; } catch (e2) {}
        lib.splice(i, 1);
        this.saveAll();
        this.refreshPalette();
    };
    LightEditorManager.renameTemplate = function(i) {
        var lib = this._lib();
        if (i < 0 || i >= lib.length) return;
        var nm;
        try { nm = window.prompt('Новое имя:', lib[i].name || 'шаблон'); } catch (e) { nm = 'шаблон'; }
        if (nm === null) return;
        lib[i].name = nm;
        this.saveAll();
        this.refreshPalette();
    };
    LightEditorManager.createLightFromTemplate = function(i) {
        var lib = this._lib();
        if (i < 0 || i >= lib.length) return;
        var t = lib[i];
        var x = 0, y = 0;
        try {
            if (typeof $gamePlayer !== 'undefined' && $gamePlayer) { x = $gamePlayer._realX; y = $gamePlayer._realY; }
        } catch (e) {}
        var sid = API.addSyntheticLight({
            x: x, y: y, type: t.type, radius: t.radius, radiusY: (t.radiusY !== undefined ? t.radiusY : t.radius),
            color: t.color,
            brightness: t.brightness, falloff: t.falloff, presetId: t.presetId,
            active: true, flashLength: t.flashLength, flashWidth: t.flashWidth, cond: t.cond
        });
        this._markDirty();
        this.saveAll();
        if (!this._pickMode) this.enablePickOverlay();
        var all = API.getSyntheticLights();
        for (var k = 0; k < all.length; k++) {
            if (all[k].sid === sid) { this.openEditPanel(all[k].idx); break; }
        }
    };
    LightEditorManager._flashMsg = function(msg) {
        console.log('[SRD_LightEditor] ' + msg);
        try {
            var t = document.createElement('div');
            t.textContent = msg;
            t.style.cssText = 'position:fixed;left:50%;top:64px;transform:translateX(-50%);background:rgba(40,40,48,0.96);color:#fff;padding:8px 16px;border-radius:8px;font:13px sans-serif;z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,0.6);pointer-events:none;';
            document.body.appendChild(t);
            setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 2200);
        } catch (e) {}
    };

    // Перенос всех источников-событий текущей карты в «базу» (синтетику) + гашение оригиналов.
    LightEditorManager.convertEventsToBase = function() {
        if (typeof $gameMap === 'undefined' || !$gameMap) return;
        var mapId = String($gameMap.mapId());
        var events = API.getLightEvents();
        var realCount = 0;
        if (!this._suppressedEvents) this._suppressedEvents = {};
        if (!this._suppressedEvents[mapId]) this._suppressedEvents[mapId] = {};
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (e.synthetic) continue; // синтетику не конвертируем
            if (this._suppressedEvents[mapId][e.eventId]) continue; // уже погашен
            // 1) создаём синтетический источник с параметрами оригинала
            var ev = $gameMap.event(e.eventId);
            if (!ev) continue;
            API.addSyntheticLight({
                x: ev._realX, y: ev._realY,
                type: e.type, radius: e.radius, color: e.color,
                brightness: e.brightness, falloff: e.falloff, presetId: e.presetId,
                active: e.active, flashLength: e.flashLength, flashWidth: e.flashWidth
            });
            // 2) гасим оригинал
            API.setLightProp(e.idx, 'active', false);
            this._suppressedEvents[mapId][e.eventId] = true;
            realCount++;
        }
        this._markDirty();
        var msg = realCount > 0 ? ('Перенесено ' + realCount + ' ист. в базу. Теперь можно удалить event\'ы в RPG Maker — свет останется.') : 'Нет источников-событий для переноса.';
        this._flashMsg(msg);
    };

    LightEditorManager._bindPanel = function() {
        var panel = this._editPanel;
        if (!panel) return;
        var M = this;
        var close = document.getElementById('LEepClose');
        if (close) close.onmousedown = function(ev) { ev.stopPropagation(); M.closeEditPanel(); };
        var head = document.getElementById('LEepHead');
        if (head) head.onmousedown = function(ev) {
            if (ev.target.id === 'LEepClose') return;
            var rect = panel.getBoundingClientRect();
            var offX = ev.clientX - rect.left, offY = ev.clientY - rect.top;
            var move = function(e2) {
                panel.style.left = (e2.clientX - offX) + 'px';
                panel.style.top = (e2.clientY - offY) + 'px';
            };
            var up = function() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
            ev.preventDefault();
        };
        // Горячие клавиши (пока панель открыта). Перевешиваем заново, чтобы не копить слушатели.
        if (M._epKey) document.removeEventListener('keydown', M._epKey, true);
        M._epKey = function(ev) {
            if (M._editIdx < 0) return;
            var tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : '';
            if (tag === 'input' && ev.target.type === 'text') return;   // не мешать вводу условия
            if (tag === 'select' || tag === 'textarea') return;
            if (ev.keyCode === 27) { M.closeEditPanel(); ev.preventDefault(); }                          // Esc
            else if (ev.keyCode === 46) { M._confirmDelete(M._editIdx); ev.preventDefault(); }           // Del
            else if (ev.keyCode === 32) { M.toggleActiveAt(M._editIdx); M.openEditPanel(M._editIdx); ev.preventDefault(); } // Space
            else if (ev.keyCode === 68) { M.duplicateLightAt(M._editIdx); ev.preventDefault(); }         // D
        };
        document.addEventListener('keydown', M._epKey, true);
    };

    // --- Хук рендера (оверлей обновляется каждый кадр) ---
    // --- Хук рендера (оверлей обновляется каждый кадр) ---
    try { (function() {
        if (typeof Spriteset_Map !== 'undefined' && Spriteset_Map.prototype.update) {
            var _ssUpdate = Spriteset_Map.prototype.update;
            Spriteset_Map.prototype.update = function() {
                _ssUpdate.apply(this, arguments);
                if (LightEditorManager._pickMode) {
                    try { LightEditorManager.updatePickLayer(); } catch (e) {}
                }
            };
        }
        if (typeof SceneManager !== 'undefined' && SceneManager.update) {
            var _smUpdate = SceneManager.update;
            SceneManager.update = function() {
                _smUpdate.apply(this, arguments);
                try {
                    if (LightEditorManager._pickMode && LightEditorManager._pickLayer &&
                        !(SceneManager._scene instanceof Scene_Map)) {
                        LightEditorManager._pickLayer.style.display = 'none';
                    }
                } catch (e) {}
            };
        }
    })(); } catch (hookErr) { console.error('[SRD_LightEditor] render hook FAILED:', hookErr); }

    // =========================================================================
    // ВКЛАДКА: ПРЕЕТЫ (визуальный редактор falloff)
    // =========================================================================
    LightEditorManager._selPreset = null;   // ID выбранного пресета
    LightEditorManager._presetSteps = [];   // рабочая копия [{pos,alpha}, ...]
    LightEditorManager._trendBase = [];     // базовая кривая для trend-превью
    LightEditorManager._trend = { gain: 100, gamma: 1, shift: 0 }; // текущие значения тенденции
    LightEditorManager._selPt = -1;         // выбранная/перетаскиваемая точка (для подсветки)
    LightEditorManager._dragIdx = -1;       // индекс точки в режиме перетаскивания с canvas

    // --- Геометрия canvas (единый источник истины для отрисовки и хит-теста) ---
    LightEditorManager._presetGeom = function() { return { padL: 28, padR: 10, padT: 10, padB: 22 }; };
    LightEditorManager._posToX = function(pos, W) {
        var g = this._presetGeom(); return g.padL + (W - g.padL - g.padR) * pos;
    };
    LightEditorManager._alphaToY = function(alpha, H) {
        var g = this._presetGeom(); return g.padT + (H - g.padT - g.padB) * (1 - alpha);
    };
    LightEditorManager._xToPos = function(x, W) {
        var g = this._presetGeom();
        return Math.max(0, Math.min(1, (x - g.padL) / (W - g.padL - g.padR)));
    };
    LightEditorManager._yToAlpha = function(y, H) {
        var g = this._presetGeom();
        return Math.max(0, Math.min(1, 1 - (y - g.padT) / (H - g.padT - g.padB)));
    };

    // DOM-хелпер: задать значение инпута в окне F12
    LightEditorManager._setInput = function(id, val) {
        var el = MakerManager.document.getElementById(id);
        if (el) el.value = val;
    };

    // Интерполяция alpha по текущей кривой в заданной pos (для dbl-click добавления)
    LightEditorManager._sampleCurve = function(pos) {
        var s = this._presetSteps.slice().sort(function(a, b) { return a.pos - b.pos; });
        if (s.length === 0) return 1;
        if (pos <= s[0].pos) return s[0].alpha;
        if (pos >= s[s.length - 1].pos) return s[s.length - 1].alpha;
        for (var i = 0; i < s.length - 1; i++) {
            if (pos >= s[i].pos && pos <= s[i + 1].pos) {
                var span = (s[i + 1].pos - s[i].pos) || 1;
                var t = (pos - s[i].pos) / span;
                return s[i].alpha + (s[i + 1].alpha - s[i].alpha) * t;
            }
        }
        return 1;
    };

    // Выбор точки (клик по строке / по точке на canvas)
    LightEditorManager.selectPoint = function(idx) {
        this._selPt = idx;
        this.renderPresetEditor();
    };

    // --- ТЕНДЕНЦИЯ (недеструктивная: base → preview → apply/reset) ---
    // Фиксирует базовую кривую = текущие точки; сбрасывает слайдеры в нейтраль.
    LightEditorManager._rebaselineTrend = function() {
        this._trendBase = this._presetSteps.map(function(p) { return { pos: p.pos, alpha: p.alpha }; });
        this._trend = { gain: 100, gamma: 1, shift: 0 };
        this._resetTrendSliders();
    };
    LightEditorManager._resetTrendSliders = function() {
        this._setInput('trGain', 100); this.setText('trGainV', '100%');
        this._setInput('trGamma', 1);  this.setText('trGammaV', '1.00');
        this._setInput('trShift', 0);  this.setText('trShiftV', '0.00');
    };
    // oninput слайдера тенденции
    LightEditorManager._setTrendField = function(name, value) {
        var v = Number(value);
        if (isNaN(v)) return;
        this._trend[name] = v;
        var idMap = { gain: 'trGainV', gamma: 'trGammaV', shift: 'trShiftV' };
        this.setText(idMap[name], (name === 'gain') ? (v + '%') : fmt(v, 2));
        this._applyTrend();
    };
    // Пересчёт _presetSteps из базы по текущим gain/gamma/shift + live-регистрация
    LightEditorManager._applyTrend = function() {
        var t = this._trend;
        var gain = t.gain / 100, gamma = t.gamma, shift = t.shift;
        this._presetSteps = this._trendBase.map(function(p) {
            var a = Math.max(0, Math.min(1, p.alpha * gain));
            a = Math.max(0, Math.min(1, Math.pow(a, gamma)));
            return { pos: Math.max(0, Math.min(1, p.pos + shift)), alpha: a };
        });
        this.commitPreset();
        this.renderPresetEditor();
    };
    // Вшить превью в базу
    LightEditorManager.applyTrend = function() {
        this._trendBase = this._presetSteps.map(function(p) { return { pos: p.pos, alpha: p.alpha }; });
        this._trend = { gain: 100, gamma: 1, shift: 0 };
        this._resetTrendSliders();
        this.renderPresetEditor();
    };
    // Откатить к базе
    LightEditorManager.resetTrend = function() {
        this._presetSteps = this._trendBase.map(function(p) { return { pos: p.pos, alpha: p.alpha }; });
        this._trend = { gain: 100, gamma: 1, shift: 0 };
        this._resetTrendSliders();
        this.commitPreset();
        this.renderPresetEditor();
    };

    // --- CANVAS: drag / dbl-click / right-click (вешаются после создания canvas) ---
    LightEditorManager.attachPresetCanvasHandlers = function() {
        var canvas = MakerManager.document.getElementById('presetCanvas');
        if (!canvas || canvas._leBound) return;
        canvas._leBound = true;
        var M = LightEditorManager;

        function evtPos(e) {
            var rect = canvas.getBoundingClientRect();
            var cx = (e.clientX - rect.left) * (canvas.width / rect.width);
            var cy = (e.clientY - rect.top) * (canvas.height / rect.height);
            return { x: cx, y: cy };
        }
        function hitTest(cx, cy) {
            var W = canvas.width, H = canvas.height;
            var best = -1, bestD = 12;
            var steps = M._presetSteps;
            for (var i = 0; i < steps.length; i++) {
                var px = M._posToX(steps[i].pos, W), py = M._alphaToY(steps[i].alpha, H);
                var d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
                if (d < bestD) { bestD = d; best = i; }
            }
            return best;
        }

        canvas.addEventListener('mousedown', function(e) {
            var p = evtPos(e);
            var idx = hitTest(p.x, p.y);
            if (idx >= 0) {
                M._dragIdx = idx;
                M._selPt = idx;
                e.preventDefault();
                canvas.style.cursor = 'grabbing';
                M.redrawPresetCanvas();
            }
        });
        canvas.addEventListener('mousemove', function(e) {
            if (M._dragIdx < 0) {
                var h = evtPos(e);
                canvas.style.cursor = (hitTest(h.x, h.y) >= 0) ? 'grab' : 'crosshair';
                return;
            }
            var p = evtPos(e);
            var pos = M._xToPos(p.x, canvas.width);
            var alpha = M._yToAlpha(p.y, canvas.height);
            M._presetSteps[M._dragIdx].pos = pos;
            M._presetSteps[M._dragIdx].alpha = alpha;
            M.commitPreset();
            M._setInput('ptposR_' + M._dragIdx, pos);
            M._setInput('ptpos_' + M._dragIdx, pos);
            M._setInput('ptalphaR_' + M._dragIdx, alpha);
            M._setInput('ptalpha_' + M._dragIdx, alpha);
            M.redrawPresetCanvas();
        });
        var endDrag = function() {
            if (M._dragIdx >= 0) {
                M._dragIdx = -1;
                canvas.style.cursor = 'crosshair';
                M._rebaselineTrend();
                M.redrawPresetCanvas();
            }
        };
        canvas.addEventListener('mouseup', endDrag);
        canvas.addEventListener('mouseleave', endDrag);

        canvas.addEventListener('dblclick', function(e) {
            var p = evtPos(e);
            if (hitTest(p.x, p.y) >= 0) return; // dbl-click по точке — не добавляем
            var pos = M._xToPos(p.x, canvas.width);
            M.addPresetPoint(pos, M._sampleCurve(pos));
        });
        canvas.addEventListener('contextmenu', function(e) {
            var p = evtPos(e);
            var idx = hitTest(p.x, p.y);
            if (idx >= 0) { e.preventDefault(); M.removePresetPoint(idx); }
        });
    };

    LightEditorManager.getPresetsHtml = function() {
        var html = '<div class="le-wrap">';
        var ids = API.getPresets();

        html += '<div class="le-h2">Пресеты затухания</div>';
        if (!ids || ids.length === 0) {
            html += '<div class="le-src-empty">Пресеты не найдены.</div></div>';
            return html;
        }

        // Выбор пресета + кнопки управления
        if (!this._selPreset || ids.indexOf(this._selPreset) < 0) {
            this._selPreset = ids[0];
        }
        var opts = '';
        for (var i = 0; i < ids.length; i++) {
            var tag = API.isPresetBuiltin(ids[i]) ? '' : ' (свой)';
            opts += '<option value="' + esc(ids[i]) + '"' + (ids[i] === this._selPreset ? ' selected' : '') + '>' +
                esc(ids[i]) + tag + '</option>';
        }
        var canDelete = !API.isPresetBuiltin(this._selPreset);

        html += '<div class="le-row"><div class="le-label">Пресет</div>' +
            '<select class="le-select" id="presetSelect" onchange="LightEditorManager.selectPreset(this.value)">' + opts + '</select></div>';

        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.addPreset()">＋ Новый</button> ' +
            '<button class="button" onclick="LightEditorManager.duplicatePreset()">⎘ Дублировать</button> ' +
            '<button class="button" id="delPresetBtn" onclick="LightEditorManager.removePreset()"' +
                (canDelete ? '' : ' disabled style="opacity:0.4" title="Встроенные пресеты удалять нельзя"') +
                '>✕ Удалить</button>' +
            '</div>';

        // Загрузить рабочую копию + зафиксировать базу для тенденции
        var loaded = API.getPreset(this._selPreset);
        this._presetSteps = loaded ? loaded : [{ pos: 0, alpha: 1 }, { pos: 1, alpha: 0 }];
        this._trendBase = this._presetSteps.map(function(p) { return { pos: p.pos, alpha: p.alpha }; });
        this._trend = { gain: 100, gamma: 1, shift: 0 };
        this._selPt = -1; this._dragIdx = -1;

        // Canvas-превью кривой
        html += '<div class="le-h2">Кривая затухания</div>';
        html += '<canvas class="le-canvas" id="presetCanvas" width="560" height="180"></canvas>';
        html += '<p class="le-hint">Ось X — расстояние от центра (0→1). Ось Y — непрозрачность света (0→1). ' +
            'Левая точка = центр источника. <b>Тяните точки мышью</b> · <b>двойной клик</b> — добавить · ' +
            '<b>правый клик по точке</b> — удалить.</p>';

        // Тенденция (общие преобразования кривой)
        html += '<div class="le-h2">Тенденция (для всей кривой)</div>';
        html += '<div class="le-trend">';
        html += '<div class="le-row"><div class="le-label">Gain (яркость)</div>' +
            '<input class="le-slider" type="range" id="trGain" min="0" max="200" step="1" value="100" ' +
            'oninput="LightEditorManager._setTrendField(\'gain\',this.value)">' +
            '<div class="le-val" id="trGainV">100%</div></div>';
        html += '<div class="le-row"><div class="le-label">Gamma (кривизна)</div>' +
            '<input class="le-slider" type="range" id="trGamma" min="0.3" max="3" step="0.05" value="1" ' +
            'oninput="LightEditorManager._setTrendField(\'gamma\',this.value)">' +
            '<div class="le-val" id="trGammaV">1.00</div></div>';
        html += '<div class="le-row"><div class="le-label">Shift (сдвиг pos)</div>' +
            '<input class="le-slider" type="range" id="trShift" min="-0.5" max="0.5" step="0.01" value="0" ' +
            'oninput="LightEditorManager._setTrendField(\'shift\',this.value)">' +
            '<div class="le-val" id="trShiftV">0.00</div></div>';
        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.applyTrend()">Применить</button> ' +
            '<button class="button" onclick="LightEditorManager.resetTrend()">Сбросить</button></div>';
        html += '<p class="le-hint">Слайдеры — живой ПРЕДПРОСМОТР от базовой кривой. ' +
            '«Применить» вшивает результат, «Сбросить» откатывает.</p>';
        html += '</div>';

        // Контейнер точек (заполняется в renderPresetEditor после вставки в DOM)
        html += '<div class="le-h2">Точки</div>';
        html += '<div id="presetPoints"></div>';
        html += '<div class="le-btn-row"><button class="button" onclick="LightEditorManager.addPresetPoint()">＋ Добавить точку</button></div>';

        html += '<p class="le-hint">Изменения применяются ко всем источникам с этим пресетом мгновенно. ' +
            'Встроенные пресеты можно править, но не удалять.</p>';
        html += '</div>';
        return html;
    };

    // После рендера страницы вызвать, чтобы заполнить точки + canvas
    LightEditorManager.afterPresetsRender = function() {
        this.renderPresetEditor();
    };

    LightEditorManager.selectPreset = function(id) {
        this._selPreset = id;
        this.setPresetsPage();
        this.renderPresetEditor();
    };

    // Заполняет блок точек + перерисовывает canvas
    LightEditorManager.renderPresetEditor = function() {
        var doc = MakerManager.document;
        var cont = doc.getElementById('presetPoints');
        if (!cont) return;
        var html = '';
        var steps = this._presetSteps;
        for (var i = 0; i < steps.length; i++) {
            var pt = steps[i];
            var sel = (i === this._selPt) ? ' sel' : '';
            html += '<div class="le-pt' + sel + '">' +
                '<b style="cursor:pointer" onclick="LightEditorManager.selectPoint(' + i + ')" title="Выбрать точку">#' + (i + 1) + '</b>' +
                '<label>pos</label>' +
                '<input type="range" id="ptposR_' + i + '" min="0" max="1" step="0.01" value="' + pt.pos + '" ' +
                'oninput="LightEditorManager.setPresetPoint(' + i + ',\'pos\',this.value)">' +
                '<input type="number" id="ptpos_' + i + '" min="0" max="1" step="0.01" value="' + fmt(pt.pos, 2) + '" ' +
                'oninput="LightEditorManager.setPresetPoint(' + i + ',\'pos\',this.value)">' +
                '<label>α</label>' +
                '<input type="range" id="ptalphaR_' + i + '" min="0" max="1" step="0.01" value="' + pt.alpha + '" ' +
                'oninput="LightEditorManager.setPresetPoint(' + i + ',\'alpha\',this.value)">' +
                '<input type="number" id="ptalpha_' + i + '" min="0" max="1" step="0.01" value="' + fmt(pt.alpha, 2) + '" ' +
                'oninput="LightEditorManager.setPresetPoint(' + i + ',\'alpha\',this.value)">' +
                '<button class="button" onclick="event.stopPropagation();LightEditorManager.removePresetPoint(' + i + ')" ' +
                'style="padding:2px 8px;" title="Удалить точку">✕</button>' +
                '</div>';
        }
        cont.innerHTML = html;
        this.redrawPresetCanvas();
    };

    // Живое изменение точки (из слайдера ИЛИ числового поля)
    LightEditorManager.setPresetPoint = function(idx, field, value) {
        if (!this._presetSteps[idx]) return;
        var v = Number(value);
        if (isNaN(v)) return;
        v = Math.max(0, Math.min(1, v)); // кламп 0..1
        this._presetSteps[idx][field] = v;
        this.commitPreset();
        // синхронизировать оба контрола (slider + number)
        if (field === 'pos') {
            this._setInput('ptposR_' + idx, v);
            this._setInput('ptpos_' + idx, v);
        } else {
            this._setInput('ptalphaR_' + idx, v);
            this._setInput('ptalpha_' + idx, v);
        }
        this._rebaselineTrend();
        this.redrawPresetCanvas();
    };

    LightEditorManager.addPresetPoint = function(pos, alpha) {
        var steps = this._presetSteps;
        if (pos === undefined) {
            // Вставляем точку посередине между двумя соседями с наибольшим разрывом
            if (steps.length === 0) { steps.push({ pos: 0.5, alpha: 0.5 }); }
            else {
                var sorted = steps.slice().sort(function(a, b) { return a.pos - b.pos; });
                var bestGap = -1, bestPos = 0.5, bestAlpha = 0.5;
                for (var i = 0; i < sorted.length - 1; i++) {
                    var gap = sorted[i + 1].pos - sorted[i].pos;
                    if (gap > bestGap) {
                        bestGap = gap;
                        bestPos = (sorted[i].pos + sorted[i + 1].pos) / 2;
                        bestAlpha = (sorted[i].alpha + sorted[i + 1].alpha) / 2;
                    }
                }
                steps.push({ pos: bestPos, alpha: bestAlpha });
            }
        } else {
            // dbl-click: позиция задана, alpha интерполирована вызвавшим
            steps.push({ pos: Math.max(0, Math.min(1, pos)), alpha: (alpha === undefined ? 0.5 : alpha) });
            // пересортируем по pos, чтобы порядок строк был осмысленным
            steps.sort(function(a, b) { return a.pos - b.pos; });
            this._selPt = -1;
        }
        this.commitPreset();
        this._rebaselineTrend();
        this.renderPresetEditor();
    };
    LightEditorManager.removePresetPoint = function(idx) {
        if (this._presetSteps.length <= 2) return; // минимум 2 точки
        this._presetSteps.splice(idx, 1);
        if (this._selPt === idx) this._selPt = -1;
        this.commitPreset();
        this._rebaselineTrend();
        this.renderPresetEditor();
    };

    // Коммит рабочей копии в SDLight (живой рендер)
    LightEditorManager.commitPreset = function() {
        if (!this._selPreset) return;
        // сортируем копию по pos перед отправкой
        var sorted = this._presetSteps.slice().sort(function(a, b) { return a.pos - b.pos; });
        API.registerPreset(this._selPreset, sorted);
        this._markDirty(); // пресет изменён → пометить для Save
    };

    // Управление списком пресетов
    LightEditorManager.addPreset = function() {
        var name = window.prompt('Имя нового пресета:', 'mypreset');
        if (!name) return;
        name = String(name).trim();
        if (!name) return;
        if (API.hasPreset(name)) { window.alert('Пресет «' + name + '» уже существует.'); return; }
        API.addPreset(name);
        this._selPreset = name;
        this._presetSteps = [{ pos: 0, alpha: 1 }, { pos: 1, alpha: 0 }];
        this.commitPreset();
        this.setPresetsPage();
        this.renderPresetEditor();
    };
    LightEditorManager.duplicatePreset = function() {
        if (!this._selPreset) return;
        var name = window.prompt('Имя копии (из «' + this._selPreset + '»):', this._selPreset + '_copy');
        if (!name) return;
        name = String(name).trim();
        if (!name) return;
        if (API.hasPreset(name)) { window.alert('Пресет «' + name + '» уже существует.'); return; }
        var src = API.getPreset(this._selPreset) || [{ pos: 0, alpha: 1 }, { pos: 1, alpha: 0 }];
        API.registerPreset(name, src);
        this._selPreset = name;
        this._presetSteps = src;
        this.setPresetsPage();
        this.renderPresetEditor();
    };
    LightEditorManager.removePreset = function() {
        if (!this._selPreset) return;
        if (API.isPresetBuiltin(this._selPreset)) return;
        if (!window.confirm('Удалить пресет «' + this._selPreset + '»?')) return;
        API.removePreset(this._selPreset);
        this._selPreset = null;
        this._presetSteps = [];
        this.setPresetsPage();
        this.renderPresetEditor();
    };

    // Рисует кривую пресета на canvas окна F12
    LightEditorManager.redrawPresetCanvas = function() {
        var canvas = MakerManager.document.getElementById('presetCanvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var W = canvas.width, H = canvas.height;
        var G = this._presetGeom();
        var padL = G.padL, padR = G.padR, padT = G.padT, padB = G.padB;
        var pw = W - padL - padR, ph = H - padT - padB;
        var M = this;
        var xOf = function(p) { return M._posToX(p, W); };
        var yOf = function(a) { return M._alphaToY(a, H); };

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);

        // Сетка
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.fillStyle = '#888';
        for (var g = 0; g <= 4; g++) {
            var yy = padT + (ph * g / 4);
            ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
            ctx.fillText((1 - g / 4).toFixed(2), 4, yy + 3);
            var xx = padL + (pw * g / 4);
            ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, H - padB); ctx.stroke();
            ctx.fillText((g / 4).toFixed(2), xx - 8, H - 6);
        }

        // Точки (сортированная копия)
        var steps = this._presetSteps.slice().sort(function(a, b) { return a.pos - b.pos; });
        if (steps.length === 0) return;

        // Заливка под кривой
        var grad = ctx.createLinearGradient(0, padT, 0, H - padB);
        grad.addColorStop(0, 'rgba(244,163,31,0.55)');
        grad.addColorStop(1, 'rgba(244,163,31,0.05)');
        ctx.beginPath();
        ctx.moveTo(xOf(steps[0].pos), H - padB);
        for (var i = 0; i < steps.length; i++) ctx.lineTo(xOf(steps[i].pos), yOf(steps[i].alpha));
        ctx.lineTo(xOf(steps[steps.length - 1].pos), H - padB);
        ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();

        // Линия кривой
        ctx.strokeStyle = '#f4a31f'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xOf(steps[0].pos), yOf(steps[0].alpha));
        for (var j = 1; j < steps.length; j++) ctx.lineTo(xOf(steps[j].pos), yOf(steps[j].alpha));
        ctx.stroke();

        // Точки-маркеры
        ctx.fillStyle = '#fff';
        for (var k = 0; k < steps.length; k++) {
            ctx.beginPath();
            ctx.arc(xOf(steps[k].pos), yOf(steps[k].alpha), 3.5, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Подсветка выбранной/перетаскиваемой точки
        var hl = (this._dragIdx >= 0) ? this._dragIdx : this._selPt;
        if (hl >= 0 && this._presetSteps[hl]) {
            var hp = this._presetSteps[hl];
            ctx.strokeStyle = (this._dragIdx >= 0) ? '#2ecc71' : '#3498db';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(xOf(hp.pos), yOf(hp.alpha), 7.5, 0, 2 * Math.PI);
            ctx.stroke();
        }
    };

    // =========================================================================
    // ВКЛАДКА: ЭКСПОРТ
    // =========================================================================
    LightEditorManager.getExportHtml = function() {
        var html = '<div class="le-wrap">';
        html += '<div class="le-h2">Снимок текущих значений</div>';
        html += '<p class="le-hint">Готовые Plugin Command-ы и параметры, чтобы перенести подобранные ' +
            'значения в редактор RPG Maker (событие → Plugin Command или параметры плагина SDLight).</p>';
        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.refreshExport()">↻ Обновить</button> ' +
            '<button class="button" onclick="LightEditorManager.copyExport()">📋 Скопировать значения</button>' +
            '</div>';
        html += '<div id="exportStatus" style="font-size:13px; margin:6px 0;"></div>';
        html += '<pre class="le-pre" id="exportPre">' + esc(this.buildExportText()) + '</pre>';
        html += '</div>';
        return html;
    };

    // =========================================================================
    // ВКЛАДКА: ШАБЛОНЫ (библиотека источников)
    // =========================================================================
    LightEditorManager.getLibraryHtml = function() {
        var lib = this._lib();
        var html = '<div class="le-wrap">';
        html += '<div class="le-h2">Библиотека шаблонов</div>';
        html += '<p class="le-hint">Сохрани любой источник как шаблон — и быстро расставляй такие же ' +
            'на любой карте. Шаблоны хранятся в snapshot (data/SDE_LightEditor.json).</p>';

        if (!lib || lib.length === 0) {
            html += '<div class="le-src-empty">Пока пусто. Кликни источник на карте (в панели «Источники» ' +
                'появятся маркеры) и нажми «💾 в шаблон», либо сохрани выбранный ниже.</div>';
        } else {
            for (var i = 0; i < lib.length; i++) {
                var t = lib[i];
                var desc = esc(t.type) + ' · r=' + Math.round(t.radius) +
                    (t.radiusY !== t.radius ? (':' + Math.round(t.radiusY)) : '') +
                    ' · ' + esc(t.color) + ' · яр.' + (t.brightness !== undefined ? Number(t.brightness).toFixed(2) : '1.00') +
                    (t.presetId ? ' · ' + esc(t.presetId) : '');
                html += '<div class="le-lib-item">';
                html += '<span class="le-lib-name">#' + (i + 1) + ' · ' + esc(t.name || ('шаблон ' + (i + 1))) + '</span>';
                html += '<span class="le-lib-desc">' + desc + '</span>';
                html += '<span class="le-lib-btns">' +
                    '<button class="button" onclick="LightEditorManager.createLightFromTemplate(' + i + ')">+ Поставить</button> ' +
                    '<button class="button" onclick="LightEditorManager.renameTemplate(' + i + ')">✎ Переименовать</button> ' +
                    '<button class="button" onclick="LightEditorManager.deleteTemplate(' + i + ')" style="background:#c0392b">🗑</button>' +
                    '</span>';
                html += '</div>';
            }
        }

        html += '<div class="le-h2">Сохранить как шаблон</div>';
        html += '<div class="le-btn-row">' +
            '<button class="button" onclick="LightEditorManager.saveEditedAsTemplate()" style="background:#27ae60">💾 Из текущей панели (на карте)</button> ' +
            '<button class="button" onclick="LightEditorManager.saveSelectedAsTemplate()">💾 Из выбранного во вкладке «Источники»</button>' +
            '</div>';
        html += '<p class="le-hint">«Из текущей панели» — источник, открытый в плавающей панели на карте. ' +
            'После сохранения шаблон появится в списке выше — жми «+ Поставить», чтобы создать такой же.</p>';
        html += '</div>';
        return html;
    };

    LightEditorManager.refreshExport = function() {
        var pre = MakerManager.document.getElementById('exportPre');
        if (pre) pre.textContent = this.buildExportText();
        var st = MakerManager.document.getElementById('exportStatus');
        if (st) st.textContent = 'Обновлено.';
    };

    LightEditorManager.buildExportText = function() {
        if (typeof $gameVariables === 'undefined' || !$gameVariables) {
            return 'Игра не запущена — экспорт невозможен.';
        }
        var s = this.snapshot();
        var cfg = s.cfg;
        var L = [];

        L.push('========================================');
        L.push(' SDLight — снимок освещения (экспорт)');
        L.push('========================================');
        L.push('');

        // --- Свет игрока: Plugin Command ---
        L.push('— СВЕТ ИГРОКА —');
        var cmd = 'Light radius ' + s.radius + ' ' + s.color;
        if (s.preset) cmd += ' ' + s.preset;
        cmd += ' ' + fmt(s.vignMult, 2) + ' ' + fmt(s.bright, 2) + ' ' + fmt(s.smooth, 2);
        L.push('Plugin Command (событие → Plugin Command...):');
        L.push('  ' + cmd);
        L.push('');
        L.push('Фактические значения:');
        L.push('  Радиус (radius)         : ' + s.radius);
        L.push('  Цвет (color)            : ' + s.color);
        L.push('  Яркость (brightness)    : ' + fmt(s.bright, 2));
        L.push('  Плавность (smoothness)  : ' + fmt(s.smooth, 2));
        L.push('  Пресет (preset)         : ' + (s.preset || '(нет)'));
        L.push('  Множитель виньетки       : ' + fmt(s.vignMult, 2));
        if (s.flash) {
            L.push('  Фонарик (flashlight)   : ВКЛ  (len=' + s.flashLen + ', wid=' + s.flashWid + ')');
            L.push('    → Plugin Command: Flashlight on ' + s.flashLen + ' ' + s.flashWid + ' ' + s.color);
        } else {
            L.push('  Фонарик (flashlight)   : ВЫКЛ');
        }
        L.push('  Мерцание (fire)         : ' + boolRu(s.fire));
        L.push('');

        // --- Глобально ---
        L.push('— ГЛОБАЛЬНО —');
        L.push('  Master Opacity (var ' + cfg.masterOpacityVar + ') : ' + s.master +
            '   →  $gameVariables.setValue(' + cfg.masterOpacityVar + ', ' + s.master + ')');
        L.push('  Tint (туман)   : ' + s.tint + '   →  Plugin Command: Tint set ' + s.tint);
        L.push('  Vignette (края): ' + s.vignette + '   →  Plugin Command: Vignette color ' + s.vignette);
        if (cfg.vignetteDisableSwitch > 0) {
            L.push('  Виньетка выкл (SW ' + cfg.vignetteDisableSwitch + ') : ' + boolRu(s.vigOff));
        }
        if (cfg.sensorDebugSwitch > 0) {
            L.push('  Дебаг сенсора (SW ' + cfg.sensorDebugSwitch + ') : ' + boolRu(s.dbgOn));
        }
        L.push('');

        // --- Источники-события (note-теги) ---
        var events = API.getLightEvents();
        L.push('— ИСТОЧНИКИ СОБЫТИЙ (' + events.length + ') —');
        if (events.length === 0) {
            L.push('  (на карте нет источников)');
        }
        for (var ei = 0; ei < events.length; ei++) {
            var e = events[ei];
            var tag = '';
            if (e.type === 'Flashlight') {
                tag = 'flashlight ' + e.flashLength + ' ' + e.flashWidth + ' ' + e.color +
                    ' ' + fmt(e.brightness, 2);
            } else {
                var cmd2 = (e.type === 'Fire') ? 'fire ' : 'light ';
                var radTok = (e.radiusY && e.radiusY !== e.radius) ? (e.radius + ':' + e.radiusY) : ('' + e.radius);
                cmd2 += radTok + ' ' + e.color;
                if (e.presetId) cmd2 += ' ' + e.presetId;
                cmd2 += ' ' + fmt(e.brightness, 2) + ' ' + fmt(e.falloff, 2);
                tag = cmd2;
            }
            L.push('  EV' + e.eventId + ' ' + (e.name || '') + '  →  ' + tag);
            L.push('     активен: ' + boolRu(e.active) +
                (e.presetId ? ', preset: ' + e.presetId : '') +
                (e.customId ? ', customId: ' + e.customId : ''));
        }
        L.push('');

        // --- Пресеты затухания (JSON для Plugin Manager) ---
        var pids = API.getPresets();
        L.push('— ПРЕСЕТЫ ЗАТУХАНИЯ (' + pids.length + ') —');
        L.push('Вставьте нужные в Plugin Manager → SDLight → «Falloff Presets».');
        for (var pi = 0; pi < pids.length; pi++) {
            var pid = pids[pi];
            var steps = API.getPreset(pid) || [];
            // Формат структур SDLight: строки Percent/Opacity
            var stepsJson = '[';
            for (var si = 0; si < steps.length; si++) {
                if (si > 0) stepsJson += ',';
                stepsJson += '{"Percent":"' + fmt(steps[si].pos, 2) + '","Opacity":"' + fmt(steps[si].alpha, 2) + '"}';
            }
            stepsJson += ']';
            var mark = API.isPresetBuiltin(pid) ? ' (встроенный)' : ' (свой)';
            L.push('  [' + pid + ']' + mark + ' Steps: ' + stepsJson);
        }
        L.push('');

        // --- Параметры плагина (defaults для переноса в Plugin Manager) ---
        L.push('— ПАРАМЕТРЫ ПЛАГИНА SDLight (по умолчанию) —');
        L.push('  Player radius         : ' + s.radius);
        L.push('  Default Tint          : ' + s.tint);
        L.push('  Vignette Color        : ' + s.vignette);
        L.push('  Master Opacity Variable: ' + cfg.masterOpacityVar);
        L.push('');

        L.push('— СОВЕТ —');
        L.push('Свет СОБЫТИЙ задаётся note-тегом в событии:');
        L.push('  light <RADIUS> <#COLOR> <PRESET> <MULT> <BRIGHT> <SMOOTH>');
        L.push('  fire  <RADIUS> <#COLOR> ...      — с мерцанием');
        L.push('  flashlight <LEN> <WID> <#COLOR>  — конус');

        return L.join('\n');
    };

    LightEditorManager.copyExport = function() {
        var text = this.buildExportText();
        var doc = MakerManager.document;
        var status = doc.getElementById('exportStatus');
        try {
            var ta = doc.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            doc.body.appendChild(ta);
            ta.focus();
            ta.select();
            var ok = false;
            try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
            doc.body.removeChild(ta);
            // Fallback через NW.js clipboard
            if (!ok && typeof require === 'function') {
                try {
                    var gui = require('nw.gui');
                    var clip = gui.Clipboard.get();
                    clip.set(text, 'text');
                    ok = true;
                } catch (e2) { /* ignore */ }
            }
            if (status) status.textContent = ok ? '✓ Скопировано в буфер обмена!' : 'Не удалось скопировать — выделите текст вручную.';
        } catch (e) {
            if (status) status.textContent = 'Ошибка: ' + e.message;
        }
    };

    // =========================================================================
    // СЕТТЕРЫ — ИГРОК (вызываются из oninput/onchange окна F12)
    // =========================================================================
    LightEditorManager.setRadius = function(v) {
        var n = Number(v) || 0;
        $gameVariables.SetRadiusSpeed(0);
        $gameVariables.SetRadius(n);
        $gameVariables.SetRadiusTarget(n);
        this._markDirty();
    };
    LightEditorManager.setColor = function(v) {
        $gameVariables.SetPlayerColor(v);
        this._markDirty();
    };
    LightEditorManager.setBrightness = function(v) {
        $gameVariables.SetPlayerBrightness(Number(v) || 0);
        this._markDirty();
    };
    LightEditorManager.setSmoothness = function(v) {
        $gameVariables.SetPlayerSmoothness(Number(v) || 0);
        this._markDirty();
    };
    LightEditorManager.setPreset = function(v) {
        if (!v || v === '' || v === 'none') {
            $gameVariables.SetPlayerPreset(null);
        } else {
            $gameVariables.SetPlayerPreset(v);
        }
        this._markDirty();
    };
    LightEditorManager.setVignetteMult = function(v) {
        $gameVariables.SetPlayerVignetteMult(Number(v) || 0);
        this._markDirty();
    };
    LightEditorManager.setFlashlight = function(b) {
        $gameVariables.SetFlashlight(b === true || b === 'true');
        this._markDirty();
    };
    LightEditorManager.setFlashLength = function(v) {
        $gameVariables.SetFlashlightLength(Math.max(1, Number(v) || 0));
        this._markDirty();
    };
    LightEditorManager.setFlashWidth = function(v) {
        $gameVariables.SetFlashlightWidth(Math.max(1, Number(v) || 0));
        this._markDirty();
    };
    LightEditorManager.setFire = function(b) {
        $gameVariables.SetFire(b === true || b === 'true');
        this._markDirty();
    };

    // =========================================================================
    // СЕТТЕРЫ — ГЛОБАЛ
    // =========================================================================
    LightEditorManager.setMasterOpacity = function(v) {
        API.setMasterOpacity(Number(v) || 0);
        this._markDirty();
    };
    LightEditorManager.setTint = function(v) {
        API.setTint(v);
        this._markDirty();
    };
    LightEditorManager.setVignetteColor = function(v) {
        API.setVignette(v);
        this._markDirty();
    };
    LightEditorManager.toggleVignetteDisable = function(b) {
        var cfg = this._cfg || API.getConfig();
        if (cfg.vignetteDisableSwitch > 0 && typeof $gameSwitches !== 'undefined') {
            $gameSwitches.setValue(cfg.vignetteDisableSwitch, b === true || b === 'true');
        }
        this._markDirty();
    };
    LightEditorManager.toggleSensorDebug = function(b) {
        var cfg = this._cfg || API.getConfig();
        if (cfg.sensorDebugSwitch > 0 && typeof $gameSwitches !== 'undefined') {
            $gameSwitches.setValue(cfg.sensorDebugSwitch, b === true || b === 'true');
        }
    };

    // =========================================================================
    // СБРОС
    // =========================================================================
    LightEditorManager.resetPlayer = function() {
        var cfg = this._cfg || API.getConfig();
        $gameVariables.SetRadiusSpeed(0);
        $gameVariables.SetRadius(cfg.playerRadiusDefault || 0);
        $gameVariables.SetRadiusTarget(cfg.playerRadiusDefault || 0);
        $gameVariables.SetPlayerColor('#FFFFFF');
        $gameVariables.SetPlayerBrightness(1.0);
        $gameVariables.SetPlayerSmoothness(1.0);
        $gameVariables.SetPlayerPreset(null);
        $gameVariables.SetPlayerVignetteMult(1.0);
        $gameVariables.SetFlashlight(false);
        $gameVariables.SetFlashlightLength(8);
        $gameVariables.SetFlashlightWidth(12);
        $gameVariables.SetFire(false);
        this._markDirty();
        this.setPlayerPage(); // перерисовать с новыми значениями
    };
    LightEditorManager.resetGlobal = function() {
        var cfg = this._cfg || API.getConfig();
        API.setMasterOpacity(0);
        API.setTint(cfg.defaultTint || '#161616');
        API.setVignette(cfg.defaultVignette || '#000000');
        if (cfg.vignetteDisableSwitch > 0 && typeof $gameSwitches !== 'undefined') {
            $gameSwitches.setValue(cfg.vignetteDisableSwitch, false);
        }
        this._markDirty();
        this.setGlobalPage();
    };

    // =========================================================================
    // ШАБЛОНЫ СТРОК UI
    // =========================================================================
    LightEditorManager._sliderRow = function(id, label, value, min, max, step, decimals, oninput) {
        var display = (decimals === 0) ? Math.round(value) : fmt(value, decimals);
        return '<div class="le-row">' +
            '<div class="le-label">' + esc(label) + '</div>' +
            '<input class="le-slider" type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" oninput="' + oninput + '">' +
            '<div class="le-val" id="' + id + 'Val">' + display + '</div>' +
            '</div>';
    };
    LightEditorManager._colorRow = function(id, label, value, oninput) {
        return '<div class="le-row">' +
            '<div class="le-label">' + esc(label) + '</div>' +
            '<input class="le-color" type="color" id="' + id + '" value="' + esc(value) + '" oninput="' + oninput + '">' +
            '<span class="le-swatch" id="' + id + 'Sw" style="background-color:' + esc(value) + '"></span>' +
            '<div class="le-val" id="' + id + 'Val" style="width:auto; min-width:90px">' + esc(value) + '</div>' +
            '</div>';
    };
    LightEditorManager._checkRow = function(id, label, checked, onchange) {
        return '<div class="le-row">' +
            '<div class="le-label">' + esc(label) + '</div>' +
            '<input type="checkbox" id="' + id + '" style="width:20px; height:20px;" ' + (checked ? 'checked' : '') + ' onchange="' + onchange + '">' +
            '</div>';
    };

    // =========================================================================
    // ПЕРСИСТЕНТНОСТЬ — snapshot в data/SDE_LightEditor.json + авто-применение
    // =========================================================================
    //
    // Файл хранит: player / global(визуал) / presets / sources(per-map overrides).
    // Сохраняем только ИЗМЕНЁННЫЕ источники (по _dirtySrc), чтобы не морозить
    // нетронутые note-теги. Switch-и НЕ пишем (ими управляет игра/сейв).
    //
    // Авто-применение: пресеты — на буте; player/global/sources — на каждой
    // перезагрузке источников (событие SDLightAPI 'eventsReloaded').
    // =========================================================================
    LightEditorManager._dirty = false;
    LightEditorManager._dirtySrc = {};     // { eventId: true } на текущей карте
    LightEditorManager._patch = null;      // распарсенный snapshot
    LightEditorManager._patchLoaded = false;
    LightEditorManager._applyDepth = 0;    // защита от реентерабельности
    LightEditorManager._sessionApplied = false; // player/global применяем 1 раз за сессию
    LightEditorManager._saveTimer = null;  // debounce-таймер автосохранения

    // Пометить «есть правки» + запланировать автосохранение (debounce).
    LightEditorManager._markDirty = function() {
        this["_dirty"] = true;  // через скобки — чтобы replaceAll не подставил рекурсивно
        this._scheduleSave();
    };
    LightEditorManager._scheduleSave = function() {
        if (!this._isNwjs()) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        var M = this;
        this._saveTimer = setTimeout(function() {
            M._saveTimer = null;
            try {
                if (M._dirty && typeof $gameMap !== 'undefined' && $gameMap) M.saveAll();
            } catch (e) { /* ignore */ }
        }, 600);
    };

    LightEditorManager._isNwjs = function() {
        if (typeof Utils !== 'undefined' && Utils.isNwjs) return Utils.isNwjs();
        return (typeof require === 'function');
    };

    LightEditorManager._patchPath = function() {
        try {
            if (typeof FileManager !== 'undefined' && FileManager.filePath) {
                return FileManager.filePath('data/SDE_LightEditor.json');
            }
        } catch (e) { /* fallback ниже */ }
        var path = require('path');
        var base = path.dirname(process.mainModule.filename);
        return path.join(base, 'data', 'SDE_LightEditor.json');
    };

    LightEditorManager._setSaveStatus = function(text, color) {
        var doc = MakerManager.document;
        if (!doc) return; // F12 закрыт — статус обновлять некуда
        var el = doc.getElementById('saveStatus');
        if (el) { el.textContent = text; if (color) el.style.color = color; }
    };

    // --- Чтение snapshot ---
    LightEditorManager.loadPatch = function() {
        if (!this._isNwjs()) return;
        try {
            var fs = require('fs');
            var p = this._patchPath();
            if (fs.existsSync(p)) {
                this._patch = JSON.parse(fs.readFileSync(p, 'utf-8'));
                this._patchLoaded = true;
            } else {
                this._patch = null;
                this._patchLoaded = false;
            }
        } catch (e) {
            console.warn('[SRD_LightEditor] loadPatch error:', e);
            this._patch = null;
            this._patchLoaded = false;
        }
    };

    // --- Сохранить всё одной кнопкой ---
    LightEditorManager.saveAll = function() {
        if (!this._isNwjs()) { this._setSaveStatus('сохранение недоступно (нужен NW.js)', '#e74c3c'); return; }
        if (typeof $gameVariables === 'undefined' || !$gameVariables || !$gameMap) {
            this._setSaveStatus('игра не запущена — войдите на карту', '#e74c3c');
            return;
        }
        try {
            var fs = require('fs');
            var p = this._patchPath();
            var patch = this._patch && typeof this._patch === 'object'
                ? this._patch
                : { version: 1, savedAt: 0, player: null, global: null, presets: null, sources: {} };
            if (!patch.sources) patch.sources = {};

            // --- player ---
            var s = LightEditorManager.snapshot();
            patch.player = {
                radius: s.radius, color: s.color, brightness: s.bright, smoothness: s.smooth,
                preset: s.preset || null, flashlight: s.flash, flashLen: s.flashLen, flashWid: s.flashWid,
                fire: s.fire, vignMult: s.vignMult
            };
            // --- global (только визуал; switch-и НЕ пишем) ---
            patch.global = { masterOpacity: s.master, tint: s.tint, vignette: s.vignette };
            // --- presets (все текущие) ---
            var pmap = {};
            var ids = API.getPresets();
            for (var i = 0; i < ids.length; i++) pmap[ids[i]] = API.getPreset(ids[i]);
            patch.presets = pmap;
            // --- sources: только изменённые на текущей карте ---
            var mapId = String($gameMap.mapId());
            var dirtyMap = {};
            var events = API.getLightEvents();
            for (var j = 0; j < events.length; j++) {
                var ev = events[j];
                if (this._dirtySrc[ev.eventId]) {
                    dirtyMap[String(ev.eventId)] = {
                        type: ev.type, radius: ev.radius, radiusY: ev.radiusY, color: ev.color,
                        brightness: ev.brightness, falloff: ev.falloff, presetId: ev.presetId,
                        active: ev.active, flashLength: ev.flashLength, flashWidth: ev.flashWidth,
                        cond: ev.cond || null
                    };
                }
            }
            patch.sources[mapId] = dirtyMap; // прочие карты не трогаем

            // --- синтетические источники (только текущая карта) ---
            if (!patch.syntheticLights) patch.syntheticLights = {};
            var syn = API.getSyntheticLights();
            patch.syntheticLights[mapId] = syn;

            // --- перемещённые реальные источники (только текущая карта) ---
            if (!patch.movedPositions) patch.movedPositions = {};
            patch.movedPositions[mapId] = this._movedPos || {};

            // --- погашенные реальные источники (после конвертации в базу) ---
            if (!patch.suppressedEvents) patch.suppressedEvents = {};
            patch.suppressedEvents[mapId] = this._suppressedEvents && this._suppressedEvents[mapId] ? this._suppressedEvents[mapId] : {};

            // --- условия свечения (в синтетических + в overrides) ---
            // cond для синтетики уже в syn (getSyntheticLights включает cond).
            // cond для реальных — в source overrides (через setLightProp 'cond').

            patch.savedAt = Date.now();

            // бэкап
            try {
                if (fs.existsSync(p)) fs.writeFileSync(p + '.bak', fs.readFileSync(p, 'utf-8'));
            } catch (eb) { /* ignore */ }

            fs.writeFileSync(p, JSON.stringify(patch));
            this._patch = patch;
            this._patchLoaded = true;
            this._dirty = false;
            this._dirtySrc = {};
            this._setSaveStatus('✓ сохранено (' + new Date().toLocaleTimeString() + ')', '#2ecc71');
            console.log('[SRD_LightEditor] snapshot saved →', p);
        } catch (e) {
            console.warn('[SRD_LightEditor] saveAll error:', e);
            this._setSaveStatus('ошибка: ' + e.message, '#e74c3c');
        }
    };

    // --- Очистить snapshot ---
    LightEditorManager.clearPatch = function() {
        if (!this._isNwjs()) return;
        if (!window.confirm('Удалить snapshot-файл?\nИсточники вернутся к исходным Note-тегам, пресеты — к дефолтам SDLight.')) return;
        try {
            var fs = require('fs');
            var p = this._patchPath();
            if (fs.existsSync(p)) fs.unlinkSync(p);
            // .bak оставляем как резервную копию
        } catch (e) { /* ignore */ }
        this._patch = null;
        this._patchLoaded = false;
        this._dirty = false;
        this._dirtySrc = {};
        API.reloadEvents(); // перепарсить note-теги (отменить оверрайды источников)
        this._setSaveStatus('snapshot очищен', '#888');
    };

    // --- Применить пресеты (на буте) ---
    LightEditorManager.applyPatchPresets = function() {
        var patch = LightEditorManager._patch;
        if (!patch || !patch.presets) return;
        for (var id in patch.presets) {
            if (patch.presets.hasOwnProperty(id) && Array.isArray(patch.presets[id])) {
                API.registerPreset(id, patch.presets[id]);
            }
        }
    };

    // --- Применить player/global/sources (колбэк на 'eventsReloaded').
    //     Внимание: вызывается без this — используем LightEditorManager.* напрямую.
    //     player/global — ОДИН раз за сессию (чтобы не конфликтовать с plugin commands).
    //     sources — на каждой загрузке карты (state.lightEvents пересобирается).
    LightEditorManager.applyPatchMap = function() {
        var M = LightEditorManager;
        if (typeof $gameVariables === 'undefined' || !$gameVariables) return;

        // Safety — на КАЖДОМ входе карты (не только один раз): brightness игрока
        // никогда не должен быть <= 0. Покрывает старые сейвы с _txPlayerBrightness=0,
        // случайные обнуления и т.п. Иначе свет игрока рисуется с alpha 0 (невидим).
        var _curBright = $gameVariables.GetPlayerBrightness();
        if (!_curBright || _curBright <= 0) {
            console.log('[SRD_LightEditor] brightness=' + _curBright + ' → восстанавливаю 1.0');
            $gameVariables.SetPlayerBrightness(1.0);
        }

        var patch = M._patch;
        if (!patch || M._applyDepth) return;
        M._applyDepth = 1;
        try {
            // global (атмосфера карты) — один раз за сессию.
            //
            // ВНИМАНИЕ: секцию patch.player БОЛЬШЕ НЕ применяем автоматически.
            // Snapshot — это сохранённое состояние live-редактора F12. Применять его
            // при каждом запуске значило перетирать команды игры (color/preset/
            // smoothness/radius), что вызывало гонку на первом кадре карты
            // («работало через раз»): авторан-команда лампы выставляла preset/colour,
            // а applyPatchMap тут же перетирал их значениями из snapshot
            // (color=#FFFFFF, preset=null, и т.д.). Player-настройки должны жить в
            // игровых командах; F12-редактор — для подсбора с последующим экспортом
            // (см. вкладку «Экспорт»).
            if (!M._sessionApplied) {
                if (patch.global) {
                    if (patch.global.masterOpacity !== undefined) API.setMasterOpacity(patch.global.masterOpacity);
                    if (patch.global.tint) API.setTint(patch.global.tint);
                    if (patch.global.vignette) API.setVignette(patch.global.vignette);
                }
                M._sessionApplied = true;
            }
            // sources текущей карты — всегда (пересобираются каждый раз)
            if (patch.sources && typeof $gameMap !== 'undefined' && $gameMap) {
                var ov = patch.sources[String($gameMap.mapId())];
                if (ov) {
                    var events = API.getLightEvents();
                    var fields = ['type','radius','radiusY','color','brightness','falloff','presetId','active','flashLength','flashWidth','cond'];
                    for (var i = 0; i < events.length; i++) {
                        var o = ov[String(events[i].eventId)];
                        if (!o) continue;
                        for (var k = 0; k < fields.length; k++) {
                            if (o[fields[k]] !== undefined) API.setLightProp(events[i].idx, fields[k], o[fields[k]]);
                        }
                    }
                }
            }
            // перемещённые реальные источники (locate)
            if (patch.movedPositions && typeof $gameMap !== 'undefined' && $gameMap) {
                var mp = patch.movedPositions[String($gameMap.mapId())];
                M._movedPos = mp || {}; // сброс per-map
                if (mp) {
                    for (var eid in mp) {
                        if (!mp.hasOwnProperty(eid)) continue;
                        var evx = $gameMap.event(Number(eid));
                        if (evx && typeof evx.locate === 'function') {
                            evx.locate(mp[eid].x, mp[eid].y);
                        }
                    }
                }
            }
            // синтетические источники (пере-создать после reloadLightEvents)
            if (patch.syntheticLights && typeof $gameMap !== 'undefined' && $gameMap) {
                var syns = patch.syntheticLights[String($gameMap.mapId())];
                if (syns && syns.length) {
                    var cur = API.getSyntheticLights();
                    for (var ci = 0; ci < cur.length; ci++) API.removeSyntheticLight(cur[ci].sid);
                    for (var si = 0; si < syns.length; si++) {
                        var d = syns[si];
                        API.addSyntheticLight({
                            x: d.x, y: d.y, type: d.type, radius: d.radius, color: d.color,
                            brightness: d.brightness, falloff: d.falloff, presetId: d.presetId,
                            active: d.active, flashLength: d.flashLength, flashWidth: d.flashWidth, direction: d.direction,
                            cond: d.cond
                        });
                    }
                }
            }
            // погасить реальные источники, перенесённые в базу
            if (patch.suppressedEvents && typeof $gameMap !== 'undefined' && $gameMap) {
                var supp = patch.suppressedEvents[String($gameMap.mapId())];
                if (supp) {
                    if (!M._suppressedEvents) M._suppressedEvents = {};
                    M._suppressedEvents[String($gameMap.mapId())] = supp;
                    var allEv = API.getLightEvents();
                    for (var sei = 0; sei < allEv.length; sei++) {
                        if (!allEv[sei].synthetic && supp[String(allEv[sei].eventId)]) {
                            API.setLightProp(allEv[sei].idx, 'active', false);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[SRD_LightEditor] applyPatchMap error:', e);
        } finally {
            M._applyDepth = 0;
        }
    };

    // --- Инициализация персистентности (вызывается при загрузке плагина) ---
    LightEditorManager.initPersistence = function() {
        if (!this._isNwjs()) {
            console.log('[SRD_LightEditor] не NW.js — snapshot отключён (только live-правка).');
            return;
        }
        this.loadPatch();
        this.applyPatchPresets();              // пресеты применяем сразу
        API.on('eventsReloaded', LightEditorManager.applyPatchMap); // player/global/sources — на каждой загрузке карты
        console.log('[SRD_LightEditor] persistence init; patch loaded:', this._patchLoaded);
    };

    // Запуск персистентности при загрузке плагина
    LightEditorManager.initPersistence();

})();
