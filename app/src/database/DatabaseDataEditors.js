/**
 * DatabaseDataEditors - S15 data plugin editors (craft / screen text /
 * loot / gifts). All four follow the S7 transitional pattern: the plugins
 * stay live, the DB sections feed their parameters through the bridge
 * merge, collections keep the MV string format (array of JSON-object
 * strings; nested lists like Ingredients/Items/SpecificItems are
 * JSON-string arrays inside the entry - exactly what the plugins parse).
 *
 * Sections: craft(SimpleCraftSystem) hints+popup(SimpleCustomHints +
 * MOG_TreasurePopup, one tab) loot(SuperDuperLoot) gifts(SuperDuperGifts).
 */

/**
 * AgoniaLabels - shared English->Russian label kit for plugin parameter
 * names. Every editor renders field/group labels through translate() so
 * the whole database UI speaks one language (S17).
 */
class AgoniaLabels {
    static get TOKENS() {
        return {
            rec: 'Запись', play: 'Загрузка', prev: 'Пред. слот', next: 'След. слот',
            stop: 'Стоп', back: 'Назад', se: 'Звук', vol: 'Громкость', volume: 'Громкость',
            pitch: 'Темп', pan: 'Панорама', img: 'Картинка', image: 'Картинка',
            norm: 'обычная', hov: 'при наведении', dis: 'неактивная',
            x: 'X', y: 'Y', w: 'Ш', h: 'В', duration: 'Длительность', time: 'Время',
            speed: 'Скорость', color: 'Цвет', width: 'Ширина', height: 'Высота',
            size: 'Размер', slot: 'Слот', slots: 'Слоты', font: 'Шрифт', bold: 'Жирный',
            spacing: 'Отступ', text: 'Текст', diary: 'Дневник', cassette: 'Кассета',
            cover: 'Обложка', clip: 'Клип', snap: 'Скриншот', list: 'Список',
            scroll: 'Прокрутка', select: 'Выбор', highlight: 'Подсветка',
            outline: 'Обводка', fade: 'Фейд', in: 'появления', out: 'исчезновения',
            intro: 'Вступление', background: 'Фон', bgm: 'Музыка', max: 'Макс.',
            min: 'Мин.', enable: 'Включить', editor: 'редактор', mode: 'Режим',
            animation: 'Анимация', duration: 'Длительность', visible: 'Видимо',
            input: 'Ввод', left: 'Влево', right: 'Вправо', fade: 'Фейд',
            axis: 'Ось', slide: 'Сдвиг', zoom: 'Зум', wave: 'Волна',
            rotation: 'Вращение', rotationanimation: 'Вращение', cursor: 'Курсор',
            command: 'Команда', pos: 'Позиция', smart: 'Умный', sprite: 'Спрайт',
            com: 'Заставка', title: 'Титул', phase: 'Фаза', static: 'Статик',
            power: 'Питание', off: 'выкл', vignette: 'Виньетка', radius: 'Радиус',
            softness: 'Мягкость', opacity: 'Прозрачность', sound: 'Звук',
            file: 'Файл', ok: 'Подтверждение', cancel: 'Отмена', buzzer: 'Ошибка',
            transition: 'Переход', hold: 'Удержание', shake: 'Тряска',
            noise: 'Шум', scanline: 'Сканлайн', chroma: 'Цветность', menu: 'Меню',
            pre: 'Пре-', phase0: 'Фаза 0', delay: 'Задержка', talk: 'Речь',
            default: 'По умолчанию', skip: 'Пропуск', disable: 'Отключить',
            move: 'Движение', route: 'Маршрут', ff: 'Быстрый прогон',
            gradient: 'Градиент', align: 'Выравнивание', solid: 'Плотность',
            layout: 'Раскладка', frame: 'Рамка', start: 'Начало', end: 'Конец',
            debug: 'Отладка', equidistant: 'Равномерно', offset: 'Смещение',
            choice: 'Выбор', choices: 'Выборы', symbol: 'Символ', active: 'Активный',
            inactive: 'Неактивный', scale: 'Масштаб', shift: 'Сдвиг',
            audio: 'Звук', wait: 'Пауза', before: 'До', after: 'После',
            wheel: 'Колесо', cooldown: 'Кулдаун', hint: 'Подсказка',
            hints: 'Подсказки', preview: 'Превью', format: 'Формат',
            interact: 'Взаимодействие', global: 'Общий', error: 'Ошибка',
            craft: 'Крафт', pickup: 'Подбор', open: 'Открытие', close: 'Закрытие',
            result: 'Результат', spacing: 'Шаг', sensitivity: 'Чувствительность',
            quality: 'Качество', sensitivity: 'Чувствительность', bold: 'Жирный',
            enable: 'Вкл', fade: 'Фейд', anim: 'Анимация', frames: 'Кадры',
            frame: 'Кадр', total: 'Всего', speed: 'Скорость', splash: 'Заставка',
            logo: 'Логотип', preset: 'Пресет', mouse: 'Мышь', movement: 'Движение',
            direction: 'Направление', fix: 'Фикс', priority: 'Приоритет',
            step: 'Шаг', walk: 'Ходьба', dir: 'Напр.', blink: 'Мигание',
            period: 'Период',             block: 'Блок', stack: 'Стак', threshold: 'Порог',
            player: 'Игрок', chest: 'Сундук', hotbar: 'Хотбар', custom: 'Своё',
            bg: 'фон', cols: 'Колонки', rows: 'Ряды', num: 'Номера',
            count: 'Счётчик', name: 'Имя', index: 'Индекс', icon: 'Иконка',
            on: 'Вкл', transfer: 'переход', hide: 'Скрыть', centered: 'По центру',
            typewriter: 'Машинка', appear: 'Появление', disappear: 'Исчезание',
            random: 'Случайно', movement: 'Движение', gold: 'Золото',
            treasure: 'Добыча', space: 'Отступ', zoom: 'Зум', effect: 'Эффект',
            slide: 'Сдвиг', in: 'в', out: 'из', xaxis: 'Ось X', yaxis: 'Ось Y',
            fadein: 'Фейд-в', fadeout: 'Фейд-аут', checkpoint: 'чекпоинт',
            drop: 'Дроп', pickup: 'подбора', dumbwaiter: 'Лифт'
        };
    }

    /** Exact-phrase overrides (System1 section titles and friends). */
    static get EXACT() {
        return {
            'Game Title': 'Название игры',
            'Starting Party': 'Стартовая партия',
            'Currency & Display': 'Валюта и отображение',
            'Vehicle Images': 'Транспорт — картинки',
            'Starting Positions': 'Стартовые позиции',
            'Title Screen': 'Титульный экран',
            'Options': 'Настройки',
            'Music': 'Музыка',
            'Sound': 'Звуки',
            'Asset Sizes': 'Размеры ассетов',
            'Tile': 'Тайл', 'Icon': 'Иконка', 'Face': 'Лицо',
            'Draw Game Title': 'Рисовать название игры',
            'Command Window Settings': 'Окно команд титула',
            'Type': 'Тип', 'Filename': 'Файл',
            'Main': 'Основное', 'Cursor': 'Курсор', 'Commands': 'Команды',
            'Basic Settings': 'Основные настройки',
            'Audio & Video': 'Аудио и видео', 'Scene Control': 'Управление сценой',
            'System Settings': 'Системные настройки', 'Timing': 'Тайминг',
            'Screen': 'Экран', 'Character': 'Персонаж', 'Picture': 'Картинка',
            'Movement': 'Движение', 'Party': 'Группа', 'Actor': 'Герой',
            'Map & Screen': 'Карта и экран', 'Battle & System': 'Система',
            'Advanced': 'Дополнительно'
        };
    }

    /** 'Rec SE Vol' -> 'Запись · звук · громкость'. */
    static translate(key) {
        const raw = String(key || '').trim();
        if (!raw) return '';
        if (/[а-яё]/i.test(raw)) return raw; // already Russian
        if (AgoniaLabels.EXACT[raw]) return AgoniaLabels.EXACT[raw];
        const words = raw.replace(/_/g, ' ').replace(/-/g, ' ')
            .split(/(?<=[a-z0-9])(?=[A-Z])|\s+|(?<=\d)(?=[A-Z])/)
            .map(w => w.trim()).filter(Boolean);
        const out = words.map((w, i) => {
            // Rejoin split hyphen compounds: fade+in -> fadein
            const joined = (w === 'in' || w === 'out') && i > 0 ? words[i - 1].toLowerCase() + w : null;
            const t = AgoniaLabels.TOKENS[joined || w.toLowerCase().replace(/[^a-z0-9]/gi, '')];
            if (t) return t;
            return w;
        });
        if (!out.length) return raw;
        return out.map((w, i) => i === 0 ? w : (/^[A-ZА-ЯЁ]/.test(w) && w.length <= 2 ? w : w.charAt(0).toLowerCase() + w.slice(1))).join(' · ');
    }

    /** Group headers: strip plugin junk arrows/dashes, translate English. */
    static translateGroup(group) {
        let g = String(group || '').replace(/^[-→> ]+|[-< ]+$/g, '').trim();
        g = g.replace(/---.*$/g, '').replace(/->.*$/g, '').trim();
        if (!g) return 'Настройки';
        return AgoniaLabels.translate(g);
    }
}

/** Shared card-list plumbing for the S15 editors. */
class AgoniaCardEditorBase {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
    }

    _tt(text) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(text) : text;
    }

    /** Standard tab banner (S17: one size across every DB tab). */
    _stdBanner(title, subtitle) {
        const banner = this._div(`
            background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
        `);
        banner.textContent = this._tt(title);
        if (subtitle) {
            const sub = document.createElement('span');
            sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
            sub.textContent = this._tt(subtitle);
            banner.appendChild(sub);
        }
        return banner;
    }

    /** Field label via the shared RU label kit (S17). */
    _fmtLabel(key, hint) {
        return this._fieldLabel(AgoniaLabels.translate(key), hint);
    }

    getSection(name) {
        const data = this.databaseManager.data;
        if (!data.agonia) data.agonia = DatabaseManager.agoniaDefaults();
        const defaults = DatabaseManager.agoniaDefaults();
        if (!data.agonia[name]) data.agonia[name] = defaults[name];
        return data.agonia[name];
    }

    /** MV collection string -> plain entries (nested JSON-string fields
     *  stay strings; editors parse them with decodeNested). */
    static decodeCollection(raw) {
        let arr = [];
        try {
            const parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) arr = parsed;
        } catch (e) { /* fall through */ }
        return arr.map(item => {
            try { return typeof item === 'string' ? JSON.parse(item) : (item || {}); }
            catch (e) { return {}; }
        });
    }

    static encodeCollection(entries) {
        return JSON.stringify((entries || []).map(entry => JSON.stringify(entry || {})));
    }

    /** Nested MV list: '["1","9"]' or '[\"{...}\"]' -> plain array. */
    static decodeNested(raw) {
        try {
            const p = JSON.parse(raw === undefined || raw === null ? '[]' : raw);
            if (!Array.isArray(p)) return [];
            return p.map(x => {
                if (typeof x !== 'string') return x;
                const s = x.trim();
                if (s.startsWith('{')) { try { return JSON.parse(s); } catch (e) { return { }; } }
                return x;
            });
        } catch (e) { return []; }
    }

    static encodeNested(list) {
        return JSON.stringify((list || []).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)));
    }

    // -- item picker options (id + name) -------------------------------
    itemOptions(kind) {
        const dm = this.databaseManager;
        const getter = { item: 'getItems', weapon: 'getWeapons', armor: 'getArmors' }[kind || 'item'];
        const list = dm && dm[getter] ? dm[getter]() : [];
        const out = [{ value: '', label: '—' }];
        for (const it of list) {
            if (it && it.id) out.push({ value: String(it.id), label: it.id + ': ' + (it.name || '—') });
        }
        return out;
    }

    // -- small UI helpers (same idioms as the battle editor) ----------
    _div(css) {
        const el = document.createElement('div');
        el.style.cssText = css || '';
        return el;
    }

    _sectionTitle(text) {
        const el = document.createElement('div');
        el.className = 'agonia-section-header';
        el.style.cssText = 'padding:12px 8px 4px;';
        el.textContent = this._tt(text);
        return el;
    }

    _panel() {
        const el = document.createElement('div');
        el.className = 'agonia-section';
        return el;
    }

    _fieldLabel(text, hint) {
        const wrap = document.createElement('div');
        wrap.className = 'agonia-field';
        const label = document.createElement('label');
        label.title = this._tt(text);
        label.textContent = this._tt(text);
        wrap.appendChild(label);
        if (hint) {
            const h = document.createElement('div');
            h.className = 'agonia-hint';
            h.textContent = hint;
            wrap.appendChild(h);
        }
        return wrap;
    }

    _input(value, onChange, type = 'text') {
        const input = document.createElement('input');
        input.type = type;
        input.value = value === undefined || value === null ? '' : value;
        input.className = 'agonia-input';
        input.addEventListener('input', () => {
            if (type === 'number') {
                const n = Number(input.value);
                if (!Number.isNaN(n)) onChange(n);
            } else {
                onChange(input.value);
            }
        });
        return input;
    }

    _select(options, value, onChange) {
        const sel = document.createElement('select');
        sel.className = 'agonia-select';
        for (const o of options) {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            sel.appendChild(opt);
        }
        sel.value = String(value === undefined ? '' : value);
        sel.addEventListener('change', () => onChange(sel.value));
        return sel;
    }

    _checkbox(value, onChange) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = typeof value === 'string' ? String(value).toLowerCase() === 'true' : !!value;
        box.style.cursor = 'pointer';
        box.addEventListener('change', () => onChange(box.checked));
        return box;
    }

    _button(text, onClick, kind = '') {
        const btn = document.createElement('button');
        btn.textContent = this._tt(text);
        btn.className = 'agonia-btn' + (kind === 'danger' ? ' danger' : '');
        btn.addEventListener('click', onClick);
        return btn;
    }

    _cardHead(title, summary, actions) {
        const head = document.createElement('div');
        head.className = 'agonia-card-head';
        const name = document.createElement('div');
        name.className = 'agonia-card-title';
        name.textContent = title;
        head.appendChild(name);
        if (summary) {
            const s = document.createElement('div');
            s.className = 'agonia-card-sub';
            s.textContent = summary;
            head.appendChild(s);
        }
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        head.appendChild(spacer);
        for (const a of (actions || [])) head.appendChild(a);
        return head;
    }

    /** Render a card list with add/reorder/duplicate/delete wiring. */
    _renderCards(host, section, key, opts) {
        // S17: cap the card column so full-screen doesn't smear one entry
        // into a ribbon (cards read best <=1160px).
        if (host.classList && !host.classList.contains('agonia-cards')) {
            host.classList.add('agonia-cards');
        }
        host.innerHTML = '';
        const entries = AgoniaCardEditorBase.decodeCollection(section[key]);

        const header = document.createElement('div');
        header.className = 'agonia-list-head';
        const count = this._div('font-size:12px;color:var(--color-text-dim);');
        count.textContent = entries.length + ' ' + this._tt(opts.countLabel || 'записей');
        header.appendChild(count);
        header.appendChild(this._div('flex:1'));
        header.appendChild(this._button(opts.addLabel || 'Добавить', () => {
            entries.push(JSON.parse(JSON.stringify(opts.blank)));
            section[key] = AgoniaCardEditorBase.encodeCollection(entries);
            this._renderCards(host, section, key, opts);
        }));
        host.appendChild(header);

        if (!entries.length) {
            const empty = this._div('color:var(--color-text-muted);text-align:center;padding:30px 0;font-size:13px;width:100%;');
            empty.textContent = this._tt('Записей нет — нажмите «Добавить»');
            host.appendChild(empty);
            return;
        }

        entries.forEach((entry, idx) => {
            const card = document.createElement('div');
            card.className = 'agonia-card';
            const rerender = () => this._renderCards(host, section, key, opts);
            const actions = [
                this._button('▲', () => {
                    if (idx === 0) return;
                    entries[idx - 1] = [entries[idx], entries[idx] = entries[idx - 1]][0];
                    section[key] = AgoniaCardEditorBase.encodeCollection(entries);
                    rerender();
                }),
                this._button('▼', () => {
                    if (idx === entries.length - 1) return;
                    entries[idx + 1] = [entries[idx], entries[idx] = entries[idx + 1]][0];
                    section[key] = AgoniaCardEditorBase.encodeCollection(entries);
                    rerender();
                }),
                this._button('Копия', () => {
                    entries.splice(idx + 1, 0, JSON.parse(JSON.stringify(entry)));
                    section[key] = AgoniaCardEditorBase.encodeCollection(entries);
                    rerender();
                }),
                this._button('Удалить', () => {
                    entries.splice(idx, 1);
                    section[key] = AgoniaCardEditorBase.encodeCollection(entries);
                    rerender();
                }, 'danger')
            ];
            card.appendChild(this._cardHead(
                (idx + 1) + '. ' + opts.headline(entry),
                opts.summary ? opts.summary(entry) : '',
                actions
            ));
            opts.renderBody(card, entry, rerender);
            host.appendChild(card);
        });
    }
}

// ======================================================================
// Craft (SimpleCraftSystem) - recipes tab
// ======================================================================

class DatabaseCraftEditor extends AgoniaCardEditorBase {
    showCraftDetail(container) {
        const section = this.getSection('craft');
        const entries = AgoniaCardEditorBase.decodeCollection(section['Recipes']);
        const persist = () => { section['Recipes'] = AgoniaCardEditorBase.encodeCollection(entries); };

        new MasterDetailShell({
            items: entries,
            searchText: r => [this._itemName(r.ResultItemID), r.ResultItemID].join(' '),
            addLabel: 'Добавить рецепт',
            blank: () => ({ ResultItemID: '1', Ingredients: '[]' }),
            onChanged: persist,
            title: (r, i) => (i + 1) + '. ' + this._itemName(r.ResultItemID),
            summary: r => AgoniaCardEditorBase.decodeNested(r.Ingredients).length + ' ' + this._tt('ингредиентов'),
            renderForm: (formCol, entry, idx, api) => {
                const f = new InspectorForm();
                f.head((idx + 1) + '. ' + this._itemName(entry.ResultItemID),
                    AgoniaCardEditorBase.decodeNested(entry.Ingredients).length + ' ингредиентов');
                f.row(this._tt('Результат'),
                    this._select(this.itemOptions('item'), entry.ResultItemID, v => { entry.ResultItemID = v; api.changed(); }),
                    this._tt('Предмет, создаваемый рецептом'));
                f.mount(formCol);
                formCol.appendChild(this._ingredientsTable(entry));
            }
        }).mount(container);
    }

    _itemName(id) {
        const list = this.databaseManager.getItems ? this.databaseManager.getItems() : [];
        const it = list[Number(id)];
        return it && it.name ? it.name : ('#' + (id || '?'));
    }

    _ingredientsTable(entry) {
        const K = AgoniaCardEditorBase;
        const list = K.decodeNested(entry.Ingredients); // string item IDs, NOT objects
        const persist = () => { entry.Ingredients = K.encodeNested(list); };
        const wrap = this._div('padding:4px 0 0;');

        wrap.appendChild(this._sectionTitle('Ингредиенты'));
        const opts = this.itemOptions('item');
        new DataTable({
            items: list,
            countLabel: 'позиций',
            columns: [
                { label: 'Предмет', get: r => this._itemName(r) }
            ],
            expandable: (box, idStr, idx, api) => {
                const f = new InspectorForm();
                f.row(this._tt('Предмет'),
                    this._select(opts, idStr, v => { list[idx] = v; persist(); }),
                    this._tt('ID предмета, из которого собирается крафт'));
                f.mount(box);
            },
            onAdd: () => { list.push('1'); persist(); wrap.replaceWith(this._ingredientsTable(entry)); },
            addLabel: '+ Ингредиент',
            onRemove: idx => { list.splice(idx, 1); persist(); wrap.replaceWith(this._ingredientsTable(entry)); },
            onChanged: persist
        }).mount(wrap);
        return wrap;
    }
}

// ======================================================================
// Screen text (SimpleCustomHints + MOG_TreasurePopup) - one tab
// ======================================================================

class DatabaseScreenTextEditor extends AgoniaCardEditorBase {
    showScreenTextDetail(container) {
        const wrapper = this._div('display:flex;flex-direction:column;height:100%;overflow:hidden;');
        wrapper.appendChild(this._stdBanner('Надписи на экране', 'Пресеты хинтов и титулов (нативы 735/737) + попапы добычи (729)'));
        const content = this._div('flex:1;overflow-y:auto;padding:0 16px 16px;');
        content.className = 'agonia-content';
        wrapper.appendChild(content);
        container.appendChild(wrapper);
        this._renderScreenTextContent(content);
    }

    /** Content without the banner - reused by the World tab (S17). */
    _renderScreenTextContent(content) {
        const hints = this.getSection('hints');
        const popup = this.getSection('popup');
        const notif = this.getSection('notification');
        content.innerHTML = '';
        this._renderScreenBlocks(content, hints, popup, notif);
    }

    _renderScreenBlocks(contentHost, hints, popup, notif) {
        const K = AgoniaCardEditorBase;
        const mkTable = (host, section, key, opts) => {
            const entries = K.decodeCollection(section[key]);
            const persist = () => { section[key] = K.encodeCollection(entries); };
            new DataTable({
                items: entries,
                countLabel: opts.countLabel,
                columns: opts.columns,
                expandable: opts.expandable,
                onAdd: () => { entries.push(JSON.parse(JSON.stringify(opts.blank))); persist(); opts.rerender(host); },
                addLabel: opts.addLabel,
                onRemove: idx => { entries.splice(idx, 1); persist(); opts.rerender(host); },
                onReorder: (a, b) => { const [m] = entries.splice(a, 1); entries.splice(b, 0, m); persist(); opts.rerender(host); },
                onChanged: persist
            }).mount(host);
        };

        // --- hint presets ---
        contentHost.appendChild(this._sectionTitle('Пресеты хинтов (натив 735)'));
        const hintHost = this._div('padding:0 16px 12px;');
        contentHost.appendChild(hintHost);
        mkTable(hintHost, hints, 'Presets', {
            countLabel: 'пресетов',
            addLabel: 'Добавить пресет',
            blank: {
                Name: 'Новый', 'Icon Index': 0, 'Font Size': 24, 'Icon Size': 38,
                Centered: 'true', X: 0, Y: 610, Duration: 350,
                'Hide on Transfer': 'true', 'SE Name': '', 'SE Volume': 90, 'SE Pitch': 100
            },
            columns: [
                { label: 'Имя', key: 'Name', type: 'text' },
                { label: 'Y', key: 'Y', type: 'number', align: 'right', width: '80px' },
                { label: 'Длительность', key: 'Duration', type: 'number', align: 'right', width: '110px' },
                { label: 'SE', key: 'SE Name', type: 'text', width: '18%', dim: true }
            ],
            expandable: (box, entry) => {
                const f = new InspectorForm();
                f.fields([
                    { key: 'Name', label: 'Имя', type: 'text' },
                    { key: 'Icon Index', label: 'Иконка', type: 'number' },
                    { key: 'Font Size', label: 'Шрифт', type: 'slider', min: 8, max: 64 },
                    { key: 'Icon Size', label: 'Размер иконки', type: 'slider', min: 8, max: 96 },
                    { key: 'X', label: 'X', type: 'number' },
                    { key: 'Y', label: 'Y', type: 'slider', min: 0, max: 720, step: 5 },
                    { key: 'Duration', label: 'Длительность (f)', type: 'slider', min: 0, max: 1200, step: 10 },
                    { key: 'SE Name', label: 'SE', type: 'text' },
                    { key: 'Centered', label: 'По центру', type: 'check' },
                    { key: 'Hide on Transfer', label: 'Скрыть при переходе', type: 'check' }
                ], entry, { commit: () => {} });
                f.mount(box);
            },
            rerender: () => this._renderScreenTextContent(contentHost)
        });

        // --- title presets ---
        contentHost.appendChild(this._sectionTitle('Пресеты титулов (натив 737)'));
        const titleHost = this._div('padding:0 16px 12px;');
        contentHost.appendChild(titleHost);
        mkTable(titleHost, hints, 'Title Presets', {
            countLabel: 'пресетов',
            addLabel: 'Добавить титул',
            blank: {
                Name: 'Новый', 'Font Size': 72, 'Outline Width': 8,
                'Centered X': 'true', 'Centered Y': 'true', 'X Offset': 0, 'Y Offset': 0,
                'Appear Type': 'Typewriter', 'Typewriter Center': 'true',
                'Disappear Type': 'Fade', 'Typewriter Delay': 3,
                'Fade In Time': 60, 'Hold Time': 180, 'Fade Out Time': 60
            },
            columns: [
                { label: 'Имя', key: 'Name', type: 'text' },
                { label: 'Появление', key: 'Appear Type', type: 'select', width: '160px',
                    options: [['Typewriter', 'Печатная машинка'], ['Fade', 'Проявление'], ['Slide', 'Сдвиг']] },
                { label: 'Шрифт', key: 'Font Size', type: 'number', align: 'right', width: '90px' }
            ],
            expandable: (box, entry) => {
                const f = new InspectorForm();
                f.fields([
                    { key: 'Name', label: 'Имя', type: 'text' },
                    { key: 'Font Size', label: 'Шрифт', type: 'slider', min: 16, max: 144, step: 2 },
                    { key: 'Outline Width', label: 'Обводка', type: 'slider', min: 0, max: 24 },
                    { key: 'X Offset', label: 'Смещение X', type: 'number' },
                    { key: 'Y Offset', label: 'Смещение Y', type: 'number' },
                    { key: 'Appear Type', label: 'Появление', type: 'select',
                        options: [['Typewriter', 'Печатная машинка'], ['Fade', 'Проявление'], ['Slide', 'Сдвиг']] },
                    { key: 'Disappear Type', label: 'Исчезновение', type: 'select',
                        options: [['Typewriter', 'Печатная машинка'], ['Fade', 'Проявление'], ['Slide', 'Сдвиг']] },
                    { key: 'Centered X', label: 'Центр X', type: 'check' },
                    { key: 'Centered Y', label: 'Центр Y', type: 'check' }
                ], entry, { commit: () => {} });
                f.mount(box);
            },
            rerender: () => this._renderScreenTextContent(contentHost)
        });

        // --- treasure popup (flat inspector) ---
        contentHost.appendChild(this._sectionTitle('Попапы добычи (натив 729)'));
        const popupForm = new InspectorForm();
        const popupFields = [
            ['Duration', 'Длительность (f)', 'number'],
            ['Fade Speed', 'Скорость фейда', 'number'],
            ['X - Axis', 'Смещение X', 'number'],
            ['Y - Axis', 'Смещение Y', 'number'],
            ['X Speed', 'Скорость X', 'number'],
            ['Y Speed', 'Скорость Y', 'number'],
            ['Font Size', 'Шрифт', 'number'],
            ['Treasure Space Y-Axis', 'Отступ между', 'number'],
            ['Gold Icon Index', 'Иконка золота', 'number'],
            ['Icon Scale', 'Масштаб иконки', 'number'],
            ['Random Movement', 'Случайное движение', 'check'],
            ['Zoom Effect', 'Зум-эффект', 'check'],
            ['Gold Popup', 'Попап золота', 'check']
        ];
        for (const [key, label, type] of popupFields) {
            popupForm.field({ key, label: this._tt(label), type }, popup, () => {});
        }
        const popupHost = this._div('padding:0 16px 12px;');
        popupForm.mount(popupHost);
        contentHost.appendChild(popupHost);

        // --- notifications (S15-B) ---
        contentHost.appendChild(this._sectionTitle('Уведомления переменных (SuperDuperNotification)'));
        const nHost = this._div('padding:0 16px 12px;');
        contentHost.appendChild(nHost);
        mkTable(nHost, notif, 'Monitored Variables', {
            countLabel: 'переменных',
            addLabel: 'Добавить переменную',
            blank: {
                variableId: 1, variableName: 'Имя', nameColor: '#3498db',
                displayName: '%name: %val', positiveColor: '#2ecc71', negativeColor: '#e74c3c'
            },
            columns: [
                { label: 'Var', key: 'variableId', type: 'number', align: 'right', width: '80px' },
                { label: 'Имя', key: 'variableName', type: 'text', width: '20%' },
                { label: 'Шаблон', key: 'displayName', type: 'text', dim: true }
            ],
            expandable: (box, entry) => {
                const f = new InspectorForm();
                f.fields([
                    { key: 'variableId', label: 'Переменная', type: 'number' },
                    { key: 'variableName', label: 'Имя', type: 'text' },
                    { key: 'nameColor', label: 'Цвет имени', type: 'text', hint: '#rrggbb' },
                    { key: 'displayName', label: 'Шаблон текста', type: 'text', hint: '%name / %val' },
                    { key: 'positiveColor', label: 'Цвет роста', type: 'text', hint: '#rrggbb' },
                    { key: 'negativeColor', label: 'Цвет падения', type: 'text', hint: '#rrggbb' }
                ], entry, { commit: () => {} });
                f.mount(box);
            },
            rerender: () => this._renderScreenTextContent(contentHost)
        });

        const nForm = new InspectorForm();
        const nFlat = [
            ['Default X', 'X'], ['Default Y', 'Y'], ['Spacing Y', 'Отступ Y'],
            ['Spawn Delay', 'Задержка (f)'], ['Wait Time', 'Пауза (f)'],
            ['Fade In Speed', 'Фейд-в'], ['Fade Out Speed', 'Фейд-аут'],
            ['Slide In X', 'Сдвиг в X'], ['Slide In Y', 'Сдвиг в Y'],
            ['Slide Out X', 'Сдвиг из X'], ['Slide Out Y', 'Сдвиг из Y'],
            ['Slide Smoothness', 'Плавность']
        ];
        for (const [key, label] of nFlat) {
            nForm.field({ key, label: this._tt(label), type: 'number' }, notif, () => {});
        }
        const nPanel = this._div('padding:0 16px 16px;');
        nForm.mount(nPanel);
        contentHost.appendChild(nPanel);
    }
}

// ======================================================================
// Loot (SuperDuperLoot) - inventory sub-mode
// ======================================================================

class DatabaseLootEditor extends AgoniaCardEditorBase {
    showLootDetail(container) {
        const section = this.getSection('loot');
        const entries = AgoniaCardEditorBase.decodeCollection(section['Categories']);
        const persist = () => { section['Categories'] = AgoniaCardEditorBase.encodeCollection(entries); };

        new MasterDetailShell({
            items: entries,
            searchText: r => [r.Name].join(' '),
            addLabel: 'Добавить категорию',
            blank: () => ({ Name: 'Новая', Items: '[]' }),
            onChanged: persist,
            title: (r, i) => (i + 1) + '. ' + (r.Name || '—'),
            summary: r => AgoniaCardEditorBase.decodeNested(r.Items).length + ' ' + this._tt('предметов'),
            renderForm: (formCol, entry, idx, api) => {
                const f = new InspectorForm();
                f.head((idx + 1) + '. ' + (entry.Name || '—'),
                    AgoniaCardEditorBase.decodeNested(entry.Items).length + ' предметов в пуле');
                f.field({ key: 'Name', label: 'Имя категории', type: 'text', hint: 'Нативы 720 (выдать) и 724 (наполнить сундук) выбирают категорию по нему' }, entry, () => api.changed());
                f.mount(formCol);
                formCol.appendChild(this._lootItemsTable(entry));
            }
        }).mount(container);
    }

    _lootItemsTable(entry) {
        const K = AgoniaCardEditorBase;
        const items = K.decodeNested(entry.Items);
        const persist = () => { entry.Items = K.encodeNested(items); };
        const wrap = this._div('padding:4px 0 0;');

        wrap.appendChild(this._sectionTitle('Предметы пула'));
        const itemOpts = this.itemOptions('item').map(o => [o.value, o.label]);
        new DataTable({
            items,
            countLabel: 'предметов',
            columns: [
                { label: 'Предмет', key: 'ItemId', type: 'select', options: itemOpts },
                { label: 'Вес (шанс)', key: 'Price', type: 'number', align: 'right', width: '110px' },
                { label: 'Размер (кол-во)', key: 'Size', type: 'number', align: 'right', width: '120px' }
            ],
            onAdd: () => { items.push({ ItemId: '1', Price: 1, Size: 1 }); persist(); wrap.replaceWith(this._lootItemsTable(entry)); },
            addLabel: '+ Предмет',
            onRemove: idx => { items.splice(idx, 1); persist(); wrap.replaceWith(this._lootItemsTable(entry)); },
            onChanged: persist
        }).mount(wrap);
        return wrap;
    }
}

// ======================================================================
// Gifts (SuperDuperGifts) - inventory sub-mode
// ======================================================================

class DatabaseGiftsEditor extends AgoniaCardEditorBase {
    showGiftsDetail(container) {
        const section = this.getSection('gifts');
        const entries = AgoniaCardEditorBase.decodeCollection(section['Characters']);
        const persist = () => { section['Characters'] = AgoniaCardEditorBase.encodeCollection(entries); };

        new MasterDetailShell({
            items: entries,
            searchText: r => [r.Id, r.VariableId].join(' '),
            addLabel: 'Добавить персонажа',
            blank: () => ({
                Id: 'Новый', VariableId: 0, SpecificItems: '[]', TagSettings: '[]',
                DisallowedItems: '[]', DisallowedTags: '[]', DefaultPoints: 1
            }),
            onChanged: persist,
            title: (r, i) => (i + 1) + '. ' + (r.Id || '—'),
            summary: r => 'var ' + r.VariableId + ' · ' + (r.DefaultPoints || 0) + ' ' + this._tt('очков'),
            renderForm: (formCol, entry, idx, api) => {
                const changed = () => api.changed();
                const f = new InspectorForm();
                f.head((idx + 1) + '. ' + (entry.Id || '—'), 'var ' + entry.VariableId + ' · натив 751');
                f.section(this._tt('Персонаж'));
                f.field({ key: 'Id', label: 'Имя персонажа (ID)', type: 'text' }, entry, changed);
                f.field({ key: 'VariableId', label: 'Переменная', type: 'number' }, entry, changed);
                f.field({ key: 'DefaultPoints', label: 'Очки по умолчанию', type: 'number' }, entry, changed);
                f.mount(formCol);

                formCol.appendChild(this._giftItemsTable(entry, changed));
                formCol.appendChild(this._giftTagsTable(entry, changed));
                formCol.appendChild(this._giftDisallowed(entry));
            }
        }).mount(container);
    }

    _giftItemsTable(entry, changed) {
        const K = AgoniaCardEditorBase;
        const list = K.decodeNested(entry.SpecificItems);
        const persist = () => { entry.SpecificItems = K.encodeNested(list); changed(); };
        const wrap = this._div('padding:4px 0 0;');
        wrap.appendChild(this._sectionTitle('Любимые предметы (очки)'));
        const itemOpts = this.itemOptions('item').map(o => [o.value, o.label]);
        new DataTable({
            items: list,
            countLabel: 'предметов',
            columns: [
                { label: 'Предмет', key: 'ItemId', type: 'select', options: itemOpts },
                { label: 'Очки', key: 'Points', type: 'number', align: 'right', width: '100px' }
            ],
            onAdd: () => { list.push({ ItemId: '1', Points: 10 }); persist(); wrap.replaceWith(this._giftItemsTable(entry, changed)); },
            addLabel: '+ Предмет',
            onRemove: idx => { list.splice(idx, 1); persist(); wrap.replaceWith(this._giftItemsTable(entry, changed)); },
            onChanged: persist
        }).mount(wrap);
        return wrap;
    }

    _giftTagsTable(entry, changed) {
        const K = AgoniaCardEditorBase;
        const list = K.decodeNested(entry.TagSettings);
        const persist = () => { entry.TagSettings = K.encodeNested(list); changed(); };
        const wrap = this._div('padding:4px 0 0;');
        wrap.appendChild(this._sectionTitle('Множители тегов'));
        new DataTable({
            items: list,
            countLabel: 'тегов',
            columns: [
                { label: 'Тег', key: 'Tag', type: 'text' },
                { label: 'Множитель', key: 'Multiplier', type: 'number', align: 'right', width: '110px' }
            ],
            onAdd: () => { list.push({ Tag: '', Multiplier: 2 }); persist(); wrap.replaceWith(this._giftTagsTable(entry, changed)); },
            addLabel: '+ Тег',
            onRemove: idx => { list.splice(idx, 1); persist(); wrap.replaceWith(this._giftTagsTable(entry, changed)); },
            onChanged: persist
        }).mount(wrap);
        return wrap;
    }

    _giftDisallowed(entry) {
        const K = AgoniaCardEditorBase;
        const f = new InspectorForm();
        f.section('Запрещённое');
        const items = K.decodeNested(entry.DisallowedItems);
        const tags = K.decodeNested(entry.DisallowedTags);
        f.field({
            key: '__disItems', label: 'Запрещённые предметы (ID)', type: 'text',
            hint: 'Через запятую — подарок не понравится'
        }, {
            __disItems: items.join(', ')
        }, () => {});
        f.field({
            key: '__disTags', label: 'Запрещённые теги', type: 'text', hint: 'Через запятую'
        }, {
            __disTags: tags.join(', ')
        }, () => {});
        const wrap = this._div('padding:4px 0 0;');
        f.mount(wrap);
        // Wire the two text inputs to encode back (field() wrote static records).
        const inputs = wrap.querySelectorAll ? wrap.querySelectorAll('input[type=text]') : [];
        if (inputs && inputs.length === 2) {
            inputs[0].addEventListener('input', () => {
                entry.DisallowedItems = K.encodeNested(
                    inputs[0].value.split(',').map(s => s.trim()).filter(Boolean));
            });
            inputs[1].addEventListener('input', () => {
                entry.DisallowedTags = K.encodeNested(
                    inputs[1].value.split(',').map(s => s.trim()).filter(Boolean));
            });
        }
        return wrap;
    }
}

// ======================================================================
// World tab (S15-B): steps / variables / drop
// ======================================================================

class DatabaseWorldEditor extends AgoniaCardEditorBase {
    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        super(databaseManager, projectManager, commonUI, parentEditor);
        this._screenText = new DatabaseScreenTextEditor(databaseManager, projectManager, commonUI, parentEditor);
    }

    showWorldDetail(container) {
        const wrapper = this._div('display:flex;flex-direction:column;height:100%;overflow:hidden;');
        wrapper.appendChild(this._stdBanner('Мир', 'Шаги · Реактор переменных · Дроп · Надписи на экране'));

        const tabsRow = this._div('display:flex;gap:8px;padding:10px 16px 0;border-bottom:1px solid var(--color-border);');
        wrapper.appendChild(tabsRow);
        const content = this._div('flex:1;overflow-y:auto;padding:0 16px 16px;');
        content.className = 'agonia-content';
        wrapper.appendChild(content);

        const tabs = [
            { id: 'steps', label: 'Шаги' },
            { id: 'variables', label: 'Переменные' },
            { id: 'drop', label: 'Дроп' },
            { id: 'labels', label: 'Надписи' }
        ];
        let active = 'steps';
        const render = () => {
            content.innerHTML = '';
            if (active === 'steps') this._renderSteps(content);
            else if (active === 'variables') this._renderVariables(content);
            else if (active === 'labels') this._screenText._renderScreenTextContent(content);
            else this._renderDrop(content);
        };
        for (const tab of tabs) {
            const el = this._div(`
                padding: 8px 18px; font-size: 13px; font-weight: 600;
                color: var(--color-text); cursor: pointer; user-select: none;
                border: 1px solid var(--color-border); border-bottom: none;
                border-radius: 6px 6px 0 0; background-color: var(--color-bg-deep);
            `);
            el.textContent = this._tt(tab.label);
            el.addEventListener('click', () => {
                active = tab.id;
                tabsRow.querySelectorAll('div').forEach(t => {
                    t.style.backgroundColor = 'var(--color-bg-deep)';
                    t.style.color = 'var(--color-text)';
                });
                el.style.backgroundColor = 'var(--color-bg-panel)';
                el.style.color = 'var(--color-text-strong)';
                el.style.borderBottom = '2px solid var(--color-accent-border-mid)';
                render();
            });
            if (tab.id === active) setTimeout(() => el.click(), 0);
            tabsRow.appendChild(el);
        }
        container.appendChild(wrapper);
    }

    // -- Steps ----------------------------------------------------------
    _renderSteps(content) {
        const s = this.getSection('steps');
        const K = AgoniaCardEditorBase;

        content.appendChild(this._sectionTitle('Шаги по поверхностям'));
        const hint = this._div('font-size:11px;color:var(--color-text-dim);padding:0 8px 8px;line-height:1.5;');
        hint.textContent = this._tt('Террейн-ID тайлсета выбирает пул звуков шагов.');
        content.appendChild(hint);

        const entries = K.decodeCollection(s['Terrain Configurations']);
        const persist = () => { s['Terrain Configurations'] = K.encodeCollection(entries); };
        const host = this._div('padding:0 8px 12px;');
        content.appendChild(host);

        new DataTable({
            items: entries,
            countLabel: 'поверхностей',
            columns: [
                { label: '№', get: (r, i) => i + 1, align: 'right', width: '40px' },
                { label: 'Террейн ID', key: 'Terrain ID', type: 'number', align: 'right', width: '110px' },
                { label: 'Воспроизведение', key: 'Playback Mode', type: 'select', width: '150px',
                    options: [['random', 'Случайно'], ['sequential', 'По кругу']] },
                { label: 'Звуков', get: e => K.decodeNested(e['Sound Pool']).length, align: 'right', width: '90px' }
            ],
            expandable: (box, entry) => {
                const modeForm = new InspectorForm();
                modeForm.fields([
                    { key: 'Terrain ID', label: 'Террейн ID', type: 'number' },
                    { key: 'Playback Mode', label: 'Воспроизведение', type: 'select',
                        options: [['random', 'Случайно'], ['sequential', 'По кругу']] }
                ], entry, { commit: persist });
                modeForm.mount(box);
                box.appendChild(this._soundPoolTable(entry));
            },
            onAdd: () => {
                entries.push({ 'Terrain ID': entries.length + 1, 'Playback Mode': 'random', 'Sound Pool': '[]' });
                persist();
                this._renderSteps(content);
            },
            addLabel: 'Добавить поверхность',
            onRemove: idx => { entries.splice(idx, 1); persist(); this._renderSteps(content); },
            onReorder: (a, b) => {
                const [m] = entries.splice(a, 1);
                entries.splice(b, 0, m);
                persist(); this._renderSteps(content);
            },
            onChanged: persist
        }).mount(host);

        content.appendChild(this._sectionTitle('Настройки шагов'));
        const form = new InspectorForm();
        const flat = [
            ['Base Step Interval', 'Интервал шага (кадры)'],
            ['Max Hearing Distance', 'Слышимость (тайлы)'],
            ['Min Audible Volume', 'Мин. громкость'],
            ['Player Speed Variable', 'Переменная скорости'],
            ['Run Interval Mod', 'Бег: интервал'],
            ['Run Volume Mod', 'Бег: громкость'],
            ['Run Pitch Mod', 'Бег: темп'],
            ['Slow Interval Mod', 'Крадусь: интервал'],
            ['Slow Volume Mod', 'Крадусь: громкость'],
            ['Slow Pitch Mod', 'Крадусь: темп'],
            ['Volume Fade Type', 'Кривая затухания']
        ];
        for (const [key, label] of flat) {
            form.field({ key, label: this._tt(label), type: 'number' }, s, () => {});
        }
        form.field({ key: 'Events', label: 'События тоже шагают', type: 'check' }, s, () => {});
        const panel = this._div('padding:0 8px 8px;');
        form.mount(panel);
        content.appendChild(panel);
    }

    _soundPoolTable(entry) {
        const K = AgoniaCardEditorBase;
        const pool = K.decodeNested(entry['Sound Pool']);
        const persist = () => { entry['Sound Pool'] = K.encodeNested(pool); };
        const wrap = this._div('padding:8px 0 0;');
        const cap = this._div('font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--color-text-dim);margin:8px 0 6px;');
        cap.textContent = this._tt('Пул звуков');
        wrap.appendChild(cap);

        new DataTable({
            items: pool,
            countLabel: 'звуков',
            columns: [
                { label: 'Файл (audio/se)', key: 'Filename', type: 'text' },
                { label: 'Громкость', key: 'Volume', type: 'number', align: 'right', width: '100px' },
                { label: 'Темп', key: 'Pitch', type: 'number', align: 'right', width: '100px' }
            ],
            onAdd: () => { pool.push({ Filename: '', Volume: 90, Pitch: 100 }); persist(); wrap.replaceWith(this._soundPoolTable(entry)); },
            addLabel: '+ Звук',
            onRemove: idx => { pool.splice(idx, 1); persist(); wrap.replaceWith(this._soundPoolTable(entry)); },
            onChanged: persist
        }).mount(wrap);
        return wrap;
    }

    _renderVariables(content) {
        const s = this.getSection('variables');
        content.appendChild(this._sectionTitle('Реактор переменных (SuperDuperVariables)'));
        const hint = this._div('font-size:11px;color:var(--color-text-dim);padding:0 8px 8px;line-height:1.5;');
        hint.textContent = this._tt('Группы следят за переменными и меняют свитчи/переменные; Decay гасит переменные; AutoOff выключает через N секунд.');
        content.appendChild(hint);

        // Globals (inspector)
        const gform = new InspectorForm();
        gform.field({ key: 'Hand_MonitorVar', label: 'Переменная «в руке»', type: 'number', hint: 'ItemTags/Спрайтер следят за ней' }, s, () => {});
        gform.field({ key: 'Hand_AutoZero', label: 'Авто-обнуление руки', type: 'check' }, s, () => {});
        gform.field({ key: 'Debug_Mode', label: 'Режим отладки', type: 'check' }, s, () => {});
        const gpanel = this._div('padding:0 8px 12px;');
        gform.mount(gpanel);
        content.appendChild(gpanel);

        const K = AgoniaCardEditorBase;
        const rerender = () => this._renderVariables(content);

        // Reactor groups (table, ▶ = reactions)
        content.appendChild(this._sectionTitle('Реактор-группы'));
        const groups = K.decodeCollection(s['Reactor_Groups']);
        this._varTable(content, s, 'Reactor_Groups', groups, {
            countLabel: 'групп',
            addLabel: 'Добавить группу',
            blank: { Name: 'Новая группа', Reactions: '[]' },
            columns: [
                { label: 'Имя', key: 'Name', type: 'text' },
                { label: 'Реакций', get: e => K.decodeNested(e.Reactions).length, align: 'right', width: '90px' }
            ],
            expandable: (box, entry, idx, api, persist) => {
                const f = new InspectorForm();
                f.field({ key: 'Name', label: 'Имя группы', type: 'text' }, entry,
                    () => { persist(); api.refresh(); });
                f.mount(box);
                box.appendChild(this._reactionsTable(entry));
            },
            rerender
        });

        // Decay (table)
        content.appendChild(this._sectionTitle('Затухание переменных (Decay)'));
        this._varTable(content, s, 'Decay_Variables', K.decodeCollection(s['Decay_Variables']), {
            countLabel: 'переменных',
            addLabel: 'Добавить',
            blank: { VariableID: 1, TickInterval: 10 },
            columns: [
                { label: 'Переменная', key: 'VariableID', type: 'number', align: 'right', width: '120px' },
                { label: 'Тик-интервал', key: 'TickInterval', type: 'number', align: 'right', width: '120px' },
                { label: 'Эффект', get: e => '−1 каждые ' + e.TickInterval + ' тиков', dim: true }
            ],
            rerender
        });

        // AutoOff (two tables side by side)
        content.appendChild(this._sectionTitle('Авто-выключение'));
        const row = this._div('display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:0 8px;');
        content.appendChild(row);
        const swHost = this._div('');
        row.appendChild(swHost);
        this._varTable(swHost, s, 'AutoOff_Switches', K.decodeCollection(s['AutoOff_Switches']), {
            countLabel: 'свитчей',
            addLabel: 'Свитч',
            blank: { switchId: 1, duration: 1 },
            columns: [
                { label: 'Свитч', key: 'switchId', type: 'number', align: 'right', width: '90px' },
                { label: 'Секунд', key: 'duration', type: 'number', align: 'right', width: '90px' }
            ],
            rerender
        });
        const vrHost = this._div('');
        row.appendChild(vrHost);
        this._varTable(vrHost, s, 'AutoOff_Variables', K.decodeCollection(s['AutoOff_Variables']), {
            countLabel: 'переменных',
            addLabel: 'Переменную',
            blank: { variableId: 1, duration: 1 },
            columns: [
                { label: 'Переменная', key: 'variableId', type: 'number', align: 'right', width: '100px' },
                { label: 'Секунд', key: 'duration', type: 'number', align: 'right', width: '90px' }
            ],
            rerender
        });
    }

    /** DataTable over an MV collection with add/remove/reorder. */
    _varTable(host, section, key, entries, opts) {
        const K = AgoniaCardEditorBase;
        const persist = () => { section[key] = K.encodeCollection(entries); };
        new DataTable({
            items: entries,
            countLabel: opts.countLabel,
            columns: opts.columns,
            expandable: opts.expandable ? (box, entry, idx, api) => opts.expandable(box, entry, idx, api, persist) : undefined,
            onAdd: () => {
                entries.push(JSON.parse(JSON.stringify(opts.blank)));
                persist();
                opts.rerender();
            },
            addLabel: opts.addLabel,
            onRemove: idx => { entries.splice(idx, 1); persist(); opts.rerender(); },
            onReorder: opts.expandable ? undefined : (a, b) => {
                const [m] = entries.splice(a, 1);
                entries.splice(b, 0, m);
                persist(); opts.rerender();
            },
            onChanged: persist
        }).mount(host);
    }

    _reactionsTable(entry) {
        const K = AgoniaCardEditorBase;
        const list = K.decodeNested(entry.Reactions);
        const persist = () => { entry.Reactions = K.encodeNested(list); };
        const wrap = this._div('padding:8px 0 0;');
        const cap = this._div('font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--color-text-dim);margin:8px 0 6px;');
        cap.textContent = this._tt('Реакции');
        wrap.appendChild(cap);

        new DataTable({
            items: list,
            countLabel: 'реакций',
            columns: [
                { label: 'Переменная', key: 'TriggerVarId', type: 'number', align: 'right', width: '110px' },
                { label: 'Условие', key: 'Condition', type: 'select', width: '90px',
                    options: [['equal', '='], ['greater', '>'], ['less', '<'], ['notEqual', '≠']] },
                { label: 'Значение', key: 'Value', type: 'number', align: 'right', width: '90px' },
                { label: 'Свитчи (id:знач.)', key: 'SwitchesToChange', type: 'text' },
                { label: 'Переменные (id:знач.)', key: 'VariablesToChange', type: 'text' }
            ],
            onAdd: () => {
                list.push({ TriggerVarId: 1, Condition: 'equal', Value: 0, SwitchesToChange: '', VariablesToChange: '' });
                persist();
                wrap.replaceWith(this._reactionsTable(entry));
            },
            addLabel: '+ Реакция',
            onRemove: idx => { list.splice(idx, 1); persist(); wrap.replaceWith(this._reactionsTable(entry)); },
            onChanged: persist
        }).mount(wrap);
        return wrap;
    }

    // -- Drop -----------------------------------------------------------
    _renderDrop(content) {
        const s = this.getSection('drop');
        content.appendChild(this._sectionTitle('Выпаденные предметы (SuperDuperDrop)'));

        const groups = [
            ['Вид', [
                ['Drop Char File', 'Спрайт предмета'],
                ['Drop Char Index', 'Индекс спрайта'],
                ['Drop Priority', 'Приоритет'],
                ['Drop Radius', 'Радиус подбора'],
                ['Icon Scale', 'Масштаб иконки'],
                ['Icon Y Offset', 'Иконка: смещение Y'],
                ['Icon Blink Min', 'Мигание: минимум'],
                ['Icon Blink Max', 'Мигание: максимум'],
                ['Icon Blink Period', 'Мигание: период']
            ], ['Drop Step Anime', 'Анимация стоя'], ['Drop Walk Anime', 'Анимация ходьбы'], ['Drop Dir Fix', 'Фикс. направление']],
            ['Звуки', [
                ['Drop Sound', 'Звук выброса'],
                ['Drop Sound Vol', 'Громкость выброса'],
                ['Drop Pickup Sound', 'Звук подбора'],
                ['Drop Pickup Vol', 'Громкость подбора'],
                ['Block Sound', 'Звук блокировки'],
                ['Block Sound Vol', 'Громкость блока']
            ]],
            ['Поведение подбора', [
                ['Pickup Delay', 'Задержка подбора (кадры)'],
                ['Stack Pickup Delay', 'Задержка стака (кадры)'],
                ['Error Plugin Command', 'Команда при переполнении']
            ]]
        ];

        for (const [title, fields, ...flags] of groups) {
            const form = new InspectorForm();
            form.section(this._tt(title));
            for (const [key, label] of fields) {
                form.field({ key, label: this._tt(label), type: 'text' }, s, () => {});
            }
            for (const [key, label] of flags) {
                form.field({ key, label: this._tt(label), type: 'check' }, s, () => {});
            }
            const panel = this._div('padding:0 8px 12px;');
            form.mount(panel);
            content.appendChild(panel);
        }
    }
}

if (typeof window !== 'undefined') {
    window.AgoniaLabels = AgoniaLabels;
    window.AgoniaCardEditorBase = AgoniaCardEditorBase;
    window.DatabaseCraftEditor = DatabaseCraftEditor;
    window.DatabaseScreenTextEditor = DatabaseScreenTextEditor;
    window.DatabaseLootEditor = DatabaseLootEditor;
    window.DatabaseGiftsEditor = DatabaseGiftsEditor;
    window.DatabaseWorldEditor = DatabaseWorldEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AgoniaLabels, AgoniaCardEditorBase, DatabaseCraftEditor, DatabaseScreenTextEditor, DatabaseLootEditor, DatabaseGiftsEditor, DatabaseWorldEditor };
}
