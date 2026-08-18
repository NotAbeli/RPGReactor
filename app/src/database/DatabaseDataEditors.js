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
        const wrapper = this._div('display:flex;flex-direction:column;height:100%;overflow:hidden;');
        wrapper.appendChild(this._stdBanner('Крафт', 'Рецепты верстака. Открытие меню — натив 734'));

        const content = this._div('flex:1;overflow-y:auto;padding:0 16px 16px;');
        content.className = 'agonia-content';
        wrapper.appendChild(content);
        container.appendChild(wrapper);

        const section = this.getSection('craft');
        this._renderCards(content, section, 'Recipes', {
            countLabel: 'рецептов',
            addLabel: 'Добавить рецепт',
            blank: { ResultItemID: '1', Ingredients: '[]' },
            headline: entry => this._itemName(entry.ResultItemID),
            summary: entry => {
                const ings = AgoniaCardEditorBase.decodeNested(entry.Ingredients);
                return ings.length + ' ' + this._tt('ингредиентов');
            },
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px 12px;');
                const resultWrap = this._fieldLabel('Результат', 'Предмет, создаваемый рецептом');
                resultWrap.appendChild(this._select(this.itemOptions('item'), entry.ResultItemID, v => { entry.ResultItemID = v; }));
                grid.appendChild(resultWrap);
                grid.appendChild(this._renderIngredients(entry));
                card.appendChild(grid);
            }
        });
    }

    _itemName(id) {
        const list = this.databaseManager.getItems ? this.databaseManager.getItems() : [];
        const it = list[Number(id)];
        return it && it.name ? it.name : ('#' + (id || '?'));
    }

    _renderIngredients(entry) {
        const wrap = this._fieldLabel('Ингредиенты', 'ID предметов, из которых собирается крафт');
        const list = AgoniaCardEditorBase.decodeNested(entry.Ingredients);
        const host = this._div('display:flex;flex-direction:column;gap:6px;');
        const rerender = () => {
            entry.Ingredients = AgoniaCardEditorBase.encodeNested(list);
            host.replaceWith(this._renderIngredients.call(this, entry));
        };
        list.forEach((id, i) => {
            const row = this._div('display:flex;gap:6px;align-items:center;');
            row.appendChild(this._select(this.itemOptions('item'), id, v => {
                if (v) list[i] = v; else list.splice(i, 1);
                entry.Ingredients = AgoniaCardEditorBase.encodeNested(list);
            }));
            row.appendChild(this._button('✕', () => { list.splice(i, 1); rerender(); }, 'danger'));
            host.appendChild(row);
        });
        const addRow = this._div('display:flex;gap:6px;');
        addRow.appendChild(this._button('+ Ингредиент', () => {
            list.push('1');
            entry.Ingredients = AgoniaCardEditorBase.encodeNested(list);
            host.replaceWith(this._renderIngredients.call(this, entry));
        }));
        host.appendChild(addRow);
        wrap.appendChild(host);
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
        // --- hint presets ---
        contentHost.appendChild(this._sectionTitle('Пресеты хинтов (натив 735)'));
        const hintHost = this._div('padding:0 16px;');
        contentHost.appendChild(hintHost);
        this._renderCards(hintHost, hints, 'Presets', {
            countLabel: 'пресетов',
            addLabel: 'Добавить пресет',
            blank: {
                Name: 'Новый', 'Icon Index': 0, 'Font Size': 24, 'Icon Size': 38,
                Centered: 'true', X: 0, Y: 610, Duration: 350,
                'Hide on Transfer': 'true', 'SE Name': '', 'SE Volume': 90, 'SE Pitch': 100
            },
            headline: entry => entry.Name || '—',
            summary: entry => 'Y=' + entry.Y + (entry['SE Name'] ? ' · SE ' + entry['SE Name'] : ''),
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 12px;');
                const mk = (label, key, type) => {
                    const w = this._fieldLabel(label);
                    w.appendChild(this._input(entry[key], v => { entry[key] = v; }, type));
                    return w;
                };
                grid.appendChild(mk('Имя', 'Name'));
                grid.appendChild(mk('Иконка', 'Icon Index', 'number'));
                grid.appendChild(mk('Шрифт', 'Font Size', 'number'));
                grid.appendChild(mk('Размер иконки', 'Icon Size', 'number'));
                grid.appendChild(mk('X', 'X', 'number'));
                grid.appendChild(mk('Y', 'Y', 'number'));
                grid.appendChild(mk('Длительность (f)', 'Duration', 'number'));
                grid.appendChild(mk('SE', 'SE Name'));
                const centered = this._fieldLabel('По центру');
                centered.appendChild(this._checkbox(entry.Centered, v => { entry.Centered = String(v); }));
                grid.appendChild(centered);
                const hide = this._fieldLabel('Скрыть при переходе');
                hide.appendChild(this._checkbox(entry['Hide on Transfer'], v => { entry['Hide on Transfer'] = String(v); }));
                grid.appendChild(hide);
                card.appendChild(grid);
            }
        });

        // --- title presets ---
        contentHost.appendChild(this._sectionTitle('Пресеты титулов (натив 737)'));
        const titleHost = this._div('padding:0 16px;');
        contentHost.appendChild(titleHost);
        this._renderCards(titleHost, hints, 'Title Presets', {
            countLabel: 'пресетов',
            addLabel: 'Добавить титул',
            blank: {
                Name: 'Новый', 'Font Size': 72, 'Outline Width': 8,
                'Centered X': 'true', 'Centered Y': 'true', 'X Offset': 0, 'Y Offset': 0,
                'Appear Type': 'Typewriter', 'Typewriter Center': 'true',
                'Disappear Type': 'Fade', 'Typewriter Delay': 3,
                'Fade In Time': 60, 'Hold Time': 180, 'Fade Out Time': 60
            },
            headline: entry => entry.Name || '—',
            summary: entry => (entry['Appear Type'] || '') + ' · ' + (entry['Font Size'] || '') + 'px',
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 12px;');
                const mk = (label, key, type) => {
                    const w = this._fieldLabel(label);
                    w.appendChild(this._input(entry[key], v => { entry[key] = v; }, type));
                    return w;
                };
                grid.appendChild(mk('Имя', 'Name'));
                grid.appendChild(mk('Шрифт', 'Font Size', 'number'));
                grid.appendChild(mk('Обводка', 'Outline Width', 'number'));
                grid.appendChild(mk('Смещение X', 'X Offset', 'number'));
                grid.appendChild(mk('Смещение Y', 'Y Offset', 'number'));
                const types = [
                    { value: 'Typewriter', label: 'Печатная машинка' },
                    { value: 'Fade', label: 'Проявление' },
                    { value: 'Slide', label: 'Сдвиг' }
                ];
                const appear = this._fieldLabel('Появление');
                appear.appendChild(this._select(types, entry['Appear Type'], v => { entry['Appear Type'] = v; }));
                grid.appendChild(appear);
                const disappear = this._fieldLabel('Исчезновение');
                disappear.appendChild(this._select(types, entry['Disappear Type'], v => { entry['Disappear Type'] = v; }));
                grid.appendChild(disappear);
                const cx = this._fieldLabel('Центр X');
                cx.appendChild(this._checkbox(entry['Centered X'], v => { entry['Centered X'] = String(v); }));
                grid.appendChild(cx);
                const cy = this._fieldLabel('Центр Y');
                cy.appendChild(this._checkbox(entry['Centered Y'], v => { entry['Centered Y'] = String(v); }));
                grid.appendChild(cy);
                card.appendChild(grid);
            }
        });

        // --- treasure popup ---
        contentHost.appendChild(this._sectionTitle('Попапы добычи (натив 729)'));
        const popupPanel = this._panel();
        popupPanel.style.margin = '0 16px 16px';
        const popupGrid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 12px;');
        const popupFields = [
            ['Duration', 'Длительность (f)', 'number'],
            ['Fade Speed', 'Скорость фейда', 'number'],
            ['X - Axis', 'Смещение X', 'number'],
            ['Y - Axis', 'Смещение Y', 'number'],
            ['X Speed', 'Скорость X', 'number'],
            ['Y Speed', 'Скорость Y', 'number'],
            ['Font Size', 'Шрифт', 'number'],
            ['Treasure Space Y-Axis', 'Отступ между', 'number'],
            ['Gold Icon Index', 'Иконка золота', 'number']
        ];
        for (const [key, label, type] of popupFields) {
            const w = this._fieldLabel(label);
            w.appendChild(this._input(popup[key], v => { popup[key] = v; }, type));
            popupGrid.appendChild(w);
        }
        const scaleWrap = this._fieldLabel('Масштаб иконки');
        scaleWrap.appendChild(this._input(popup['Icon Scale'], v => { popup['Icon Scale'] = v; }, 'number'));
        popupGrid.appendChild(scaleWrap);
        const flags = this._div('display:flex;gap:16px;align-items:center;flex-wrap:wrap;');
        const rm = this._fieldLabel('Случайное движение');
        rm.appendChild(this._checkbox(popup['Random Movement'], v => { popup['Random Movement'] = v; }));
        flags.appendChild(rm);
        const zoom = this._fieldLabel('Зум-эффект');
        zoom.appendChild(this._checkbox(popup['Zoom Effect'], v => { popup['Zoom Effect'] = v; }));
        flags.appendChild(zoom);
        const gold = this._fieldLabel('Попап золота');
        gold.appendChild(this._checkbox(popup['Gold Popup'], v => { popup['Gold Popup'] = v; }));
        flags.appendChild(gold);
        popupGrid.appendChild(flags);
        popupPanel.appendChild(popupGrid);
        contentHost.appendChild(popupPanel);

        // --- notifications (S15-B) ---
        contentHost.appendChild(this._sectionTitle('Уведомления переменных (SuperDuperNotification)'));
        const nHost = this._div('padding:0 16px;');
        contentHost.appendChild(nHost);
        this._renderCards(nHost, notif, 'Monitored Variables', {
            countLabel: 'переменных',
            addLabel: 'Добавить переменную',
            blank: {
                variableId: 1, variableName: 'Имя', nameColor: '#3498db',
                displayName: '%name: %val', positiveColor: '#2ecc71', negativeColor: '#e74c3c'
            },
            headline: entry => (entry.variableName || '—') + ' (var ' + entry.variableId + ')',
            summary: entry => entry.displayName || '',
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 12px;');
                const mk = (label, key, type) => {
                    const w = this._fieldLabel(label);
                    w.appendChild(this._input(entry[key], v => { entry[key] = v; }, type));
                    return w;
                };
                grid.appendChild(mk('Переменная', 'variableId', 'number'));
                grid.appendChild(mk('Имя', 'variableName'));
                grid.appendChild(mk('Цвет имени', 'nameColor'));
                grid.appendChild(mk('Шаблон текста', 'displayName'));
                grid.appendChild(mk('Цвет роста', 'positiveColor'));
                grid.appendChild(mk('Цвет падения', 'negativeColor'));
                card.appendChild(grid);
            }
        });
        const nPanel = this._panel();
        nPanel.style.margin = '8px 16px 16px';
        const nGrid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px 12px;');
        const nFlat = [
            ['Default X', 'X'], ['Default Y', 'Y'], ['Spacing Y', 'Отступ Y'],
            ['Spawn Delay', 'Задержка (f)'], ['Wait Time', 'Пауза (f)'],
            ['Fade In Speed', 'Фейд-в'], ['Fade Out Speed', 'Фейд-аут'],
            ['Slide In X', 'Сдвиг в X'], ['Slide In Y', 'Сдвиг в Y'],
            ['Slide Out X', 'Сдвиг из X'], ['Slide Out Y', 'Сдвиг из Y'],
            ['Slide Smoothness', 'Плавность']
        ];
        for (const [key, label] of nFlat) {
            const w = this._fieldLabel(label);
            w.appendChild(this._input(notif[key], v => { notif[key] = v; }, 'number'));
            nGrid.appendChild(w);
        }
        nPanel.appendChild(nGrid);
        contentHost.appendChild(nPanel);
    }
}

// ======================================================================
// Loot (SuperDuperLoot) - inventory sub-mode
// ======================================================================

class DatabaseLootEditor extends AgoniaCardEditorBase {
    showLootDetail(container) {
        const section = this.getSection('loot');
        const hint = this._div('font-size:11px;color:var(--color-text-dim);padding:0 0 10px;line-height:1.5;');
        hint.textContent = this._tt('Категории лута для нативов 720 (выдать) и 724 (наполнить сундук): имя + пул предметов с весом (Price) и размером (Size).');
        container.appendChild(hint);
        this._renderCards(container, section, 'Categories', {
            countLabel: 'категорий',
            addLabel: 'Добавить категорию',
            blank: { Name: 'Новая', Items: '[]' },
            headline: entry => entry.Name || '—',
            summary: entry => AgoniaCardEditorBase.decodeNested(entry.Items).length + ' ' + this._tt('предметов'),
            renderBody: (card, entry) => {
                const items = AgoniaCardEditorBase.decodeNested(entry.Items);
                const host = this._div('display:flex;flex-direction:column;gap:6px;');
                const rerender = () => {
                    entry.Items = AgoniaCardEditorBase.encodeNested(items);
                    const fresh = this._renderLootItems(entry, items);
                    host.replaceWith(fresh);
                };
                const rendered = this._renderLootItems(entry, items, rerender);
                host.appendChild(rendered);
                card.appendChild(host);
            }
        });
    }

    _renderLootItems(entry, items, rerender) {
        const wrap = this._div('display:flex;flex-direction:column;gap:6px;');
        const label = this._fieldLabel('Предметы пула', 'ItemId · вес (шанс) · размер (кол-во)');
        wrap.appendChild(label);
        items.forEach((it, i) => {
            const row = this._div('display:grid;grid-template-columns:2fr 80px 80px auto;gap:6px;align-items:end;');
            row.appendChild(this._select(this.itemOptions('item'), it.ItemId, v => {
                if (v) it.ItemId = v; else items.splice(i, 1);
                entry.Items = AgoniaCardEditorBase.encodeNested(items);
            }));
            const pw = this._fieldLabel('Вес');
            pw.appendChild(this._input(it.Price, v => { it.Price = v; }, 'number'));
            row.appendChild(pw);
            const sw = this._fieldLabel('Размер');
            sw.appendChild(this._input(it.Size, v => { it.Size = v; }, 'number'));
            row.appendChild(sw);
            row.appendChild(this._button('✕', () => { items.splice(i, 1); rerender(); }, 'danger'));
            wrap.appendChild(row);
        });
        wrap.appendChild(this._button('+ Предмет', () => {
            items.push({ ItemId: '1', Price: 1, Size: 1 });
            entry.Items = AgoniaCardEditorBase.encodeNested(items);
            rerender();
        }));
        return wrap;
    }
}

// ======================================================================
// Gifts (SuperDuperGifts) - inventory sub-mode
// ======================================================================

class DatabaseGiftsEditor extends AgoniaCardEditorBase {
    showGiftsDetail(container) {
        const section = this.getSection('gifts');
        const hint = this._div('font-size:11px;color:var(--color-text-dim);padding:0 0 10px;line-height:1.5;');
        hint.textContent = this._tt('Персонажи и их предпочтения для натива 751: кому что нравится (очки за предмет), множители по тегам, запрещённое. Имена персонажей увидит диалог 751.');
        container.appendChild(hint);
        this._renderCards(container, section, 'Characters', {
            countLabel: 'персонажей',
            addLabel: 'Добавить персонажа',
            blank: {
                Id: 'Новый', VariableId: 0, SpecificItems: '[]', TagSettings: '[]',
                DisallowedItems: '[]', DisallowedTags: '[]', DefaultPoints: 1
            },
            headline: entry => entry.Id || '—',
            summary: entry => 'var ' + entry.VariableId + ' · ' + (entry.DefaultPoints || 0) + ' ' + this._tt('очков по умолчанию'),
            renderBody: (card, entry) => {
                const top = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px 12px;');
                const idw = this._fieldLabel('Имя персонажа (ID)');
                idw.appendChild(this._input(entry.Id, v => { entry.Id = v; }));
                top.appendChild(idw);
                const vw = this._fieldLabel('Переменная');
                vw.appendChild(this._input(entry.VariableId, v => { entry.VariableId = v; }, 'number'));
                top.appendChild(vw);
                const dw = this._fieldLabel('Очки по умолчанию');
                dw.appendChild(this._input(entry.DefaultPoints, v => { entry.DefaultPoints = v; }, 'number'));
                top.appendChild(dw);
                card.appendChild(top);

                card.appendChild(this._renderPointList(entry, 'SpecificItems', 'Любимые предметы (очки)',
                    'Сколько очков даёт предмет', () => ({ ItemId: '1', Points: 10 }), true));
                card.appendChild(this._renderPointList(entry, 'TagSettings', 'Множители тегов',
                    'Тег предмета → множитель очков', () => ({ Tag: '', Multiplier: 2 }), false));
                card.appendChild(this._renderIdTags(entry));
            }
        });
    }

    _renderPointList(entry, key, label, hint, blank, isItem) {
        const wrap = this._div('display:flex;flex-direction:column;gap:6px;');
        const head = this._fieldLabel(label, hint);
        wrap.appendChild(head);
        const list = AgoniaCardEditorBase.decodeNested(entry[key]);
        const rerender = () => {
            entry[key] = AgoniaCardEditorBase.encodeNested(list);
            wrap.replaceWith(this._renderPointList.call(this, entry, key, label, hint, blank, isItem));
        };
        list.forEach((it, i) => {
            const row = this._div('display:grid;grid-template-columns:2fr 120px auto;gap:6px;align-items:end;');
            if (isItem) {
                row.appendChild(this._select(this.itemOptions('item'), it.ItemId, v => {
                    if (v) it.ItemId = v; else list.splice(i, 1);
                    entry[key] = AgoniaCardEditorBase.encodeNested(list);
                }));
                const pw = this._fieldLabel('Очки');
                pw.appendChild(this._input(it.Points, v => { it.Points = v; }, 'number'));
                row.appendChild(pw);
            } else {
                const tw = this._fieldLabel('Тег');
                tw.appendChild(this._input(it.Tag, v => { it.Tag = v; }));
                row.appendChild(tw);
                const mw = this._fieldLabel('Множитель');
                mw.appendChild(this._input(it.Multiplier, v => { it.Multiplier = v; }, 'number'));
                row.appendChild(mw);
            }
            row.appendChild(this._button('✕', () => { list.splice(i, 1); rerender(); }, 'danger'));
            wrap.appendChild(row);
        });
        wrap.appendChild(this._button('+', () => {
            list.push(JSON.parse(JSON.stringify(blank)));
            entry[key] = AgoniaCardEditorBase.encodeNested(list);
            rerender();
        }));
        return wrap;
    }

    _renderIdTags(entry) {
        const wrap = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 12px;');
        const items = AgoniaCardEditorBase.decodeNested(entry.DisallowedItems);
        const tags = AgoniaCardEditorBase.decodeNested(entry.DisallowedTags);
        const iw = this._fieldLabel('Запрещённые предметы (ID)', 'Через запятую — подарок не понравится');
        iw.appendChild(this._input(items.join(', '), v => {
            entry.DisallowedItems = AgoniaCardEditorBase.encodeNested(
                v.split(',').map(s => s.trim()).filter(Boolean));
        }));
        wrap.appendChild(iw);
        const tw = this._fieldLabel('Запрещённые теги', 'Через запятую');
        tw.appendChild(this._input(tags.join(', '), v => {
            entry.DisallowedTags = AgoniaCardEditorBase.encodeNested(
                v.split(',').map(s => s.trim()).filter(Boolean));
        }));
        wrap.appendChild(tw);
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
        content.appendChild(this._sectionTitle('Шаги по поверхностям'));
        const hint = this._div('font-size:11px;color:var(--color-text-dim);padding-bottom:8px;line-height:1.5;');
        hint.textContent = this._tt('Террейн-ID карты (RPG Maker тайлсет → Terrain tag) выбирает пул звуков шагов. Playback: sequential по кругу / random случайно.');
        content.appendChild(hint);

        this._renderCards(content, s, 'Terrain Configurations', {
            countLabel: 'поверхностей',
            addLabel: 'Добавить поверхность',
            blank: { 'Terrain ID': 1, 'Playback Mode': 'random', 'Sound Pool': '[]' },
            headline: entry => 'Террейн ' + entry['Terrain ID'],
            summary: entry => (entry['Playback Mode'] === 'sequential' ? 'по кругу' : 'случайно') + ' · ' + AgoniaCardEditorBase.decodeNested(entry['Sound Pool']).length + ' звуков',
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:120px 170px 1fr;gap:10px 12px;align-items:start;');
                const tw = this._fieldLabel('Террейн ID');
                tw.appendChild(this._input(entry['Terrain ID'], v => { entry['Terrain ID'] = v; }, 'number'));
                grid.appendChild(tw);
                const mw = this._fieldLabel('Воспроизведение');
                mw.appendChild(this._select([
                    { value: 'random', label: 'Случайно' },
                    { value: 'sequential', label: 'По кругу' }
                ], entry['Playback Mode'], v => { entry['Playback Mode'] = v; }));
                grid.appendChild(mw);
                grid.appendChild(this._renderSoundPool(entry));
                card.appendChild(grid);
            }
        });

        content.appendChild(this._sectionTitle('Настройки шагов'));
        const panel = this._panel();
        const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 12px;');
        const flat = [
            ['Base Step Interval', 'Интервал шага (f)', 'number'],
            ['Max Hearing Distance', 'Слышимость (тайлы)', 'number'],
            ['Min Audible Volume', 'Мин. громкость', 'number'],
            ['Player Speed Variable', 'Переменная скорости', 'number'],
            ['Run Interval Mod', 'Бег: интервал', 'number'],
            ['Run Volume Mod', 'Бег: громкость', 'number'],
            ['Run Pitch Mod', 'Бег: питч', 'number'],
            ['Slow Interval Mod', 'Крадусь: интервал', 'number'],
            ['Slow Volume Mod', 'Крадусь: громкость', 'number'],
            ['Slow Pitch Mod', 'Крадусь: питч', 'number'],
            ['Volume Fade Type', 'Кривая затухания', 'text']
        ];
        for (const [key, label, type] of flat) {
            const w = this._fieldLabel(label);
            w.appendChild(this._input(s[key], v => { s[key] = v; }, type));
            grid.appendChild(w);
        }
        const evw = this._fieldLabel('События тоже шагают');
        evw.appendChild(this._checkbox(s.Events, v => { s.Events = v; }));
        grid.appendChild(evw);
        panel.appendChild(grid);
        content.appendChild(panel);
    }

    _renderSoundPool(entry) {
        const pool = AgoniaCardEditorBase.decodeNested(entry['Sound Pool']);
        const wrap = this._fieldLabel('Пул звуков', 'Файл (audio/se) · громкость · питч');
        const host = this._div('display:flex;flex-direction:column;gap:6px;');
        const rerender = () => {
            entry['Sound Pool'] = AgoniaCardEditorBase.encodeNested(pool);
            wrap.replaceWith(this._renderSoundPool.call(this, entry));
        };
        pool.forEach((snd, i) => {
            const row = this._div('display:grid;grid-template-columns:1fr 70px 70px auto;gap:6px;align-items:end;');
            const fw = this._fieldLabel('Файл');
            fw.appendChild(this._input(snd.Filename, v => { snd.Filename = v; }));
            row.appendChild(fw);
            const vw = this._fieldLabel('Громк.');
            vw.appendChild(this._input(snd.Volume, v => { snd.Volume = v; }, 'number'));
            row.appendChild(vw);
            const pw = this._fieldLabel('Питч');
            pw.appendChild(this._input(snd.Pitch, v => { snd.Pitch = v; }, 'number'));
            row.appendChild(pw);
            row.appendChild(this._button('✕', () => { pool.splice(i, 1); rerender(); }, 'danger'));
            host.appendChild(row);
        });
        host.appendChild(this._button('+ Звук', () => {
            pool.push({ Filename: '', Volume: 90, Pitch: 100 });
            entry['Sound Pool'] = AgoniaCardEditorBase.encodeNested(pool);
            rerender();
        }));
        wrap.appendChild(host);
        return wrap;
    }

    // -- Variables ------------------------------------------------------
    _renderVariables(content) {
        const s = this.getSection('variables');
        content.appendChild(this._sectionTitle('Реактор переменных (SuperDuperVariables)'));
        const hint = this._div('font-size:11px;color:var(--color-text-dim);padding-bottom:8px;line-height:1.5;');
        hint.textContent = this._tt('Reactor-группы следят за переменными и при срабатывании условия меняют свитчи/переменные. Decay гасит переменные со временем; AutoOff выключает свитчи/переменные через N секунд.');
        content.appendChild(hint);

        const top = this._panel();
        const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px 12px;');
        const mv = this._fieldLabel('Переменная «в руке»', 'ItemTags/Спрайтер следят за ней');
        mv.appendChild(this._input(s.Hand_MonitorVar, v => { s.Hand_MonitorVar = v; }, 'number'));
        grid.appendChild(mv);
        const az = this._fieldLabel('Авто-обнуление руки');
        az.appendChild(this._checkbox(s.Hand_AutoZero, v => { s.Hand_AutoZero = v; }));
        grid.appendChild(az);
        const dbg = this._fieldLabel('Режим отладки');
        dbg.appendChild(this._checkbox(s.Debug_Mode, v => { s.Debug_Mode = v; }));
        grid.appendChild(dbg);
        top.appendChild(grid);
        content.appendChild(top);

        content.appendChild(this._sectionTitle('Reactor-группы'));
        const rgHost = this._div('');
        content.appendChild(rgHost);
        this._renderCards(rgHost, s, 'Reactor_Groups', {
            countLabel: 'групп',
            addLabel: 'Добавить группу',
            blank: { Name: 'Новая группа', Reactions: '[]' },
            headline: entry => entry.Name || '—',
            summary: entry => AgoniaCardEditorBase.decodeNested(entry.Reactions).length + ' ' + this._tt('реакций'),
            renderBody: (card, entry) => {
                const nameWrap = this._fieldLabel('Имя группы');
                nameWrap.appendChild(this._input(entry.Name, v => { entry.Name = v; }));
                card.appendChild(nameWrap);
                card.appendChild(this._renderReactions(entry));
            }
        });

        content.appendChild(this._sectionTitle('Затухание переменных (Decay)'));
        const decayHost = this._div('');
        content.appendChild(decayHost);
        this._renderCards(decayHost, s, 'Decay_Variables', {
            countLabel: 'переменных',
            addLabel: 'Добавить',
            blank: { VariableID: 1, TickInterval: 10 },
            headline: entry => 'var ' + entry.VariableID,
            summary: entry => '−1 каждые ' + entry.TickInterval + ' тиков',
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 12px;');
                const vw = this._fieldLabel('Переменная');
                vw.appendChild(this._input(entry.VariableID, v => { entry.VariableID = v; }, 'number'));
                grid.appendChild(vw);
                const tw = this._fieldLabel('Тик-интервал');
                tw.appendChild(this._input(entry.TickInterval, v => { entry.TickInterval = v; }, 'number'));
                grid.appendChild(tw);
                card.appendChild(grid);
            }
        });

        const row = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 12px;');
        const swHost = this._div('');
        row.appendChild(swHost);
        const vrHost = this._div('');
        row.appendChild(vrHost);
        content.appendChild(this._sectionTitle('Авто-выключение'));
        content.appendChild(row);
        this._renderCards(swHost, s, 'AutoOff_Switches', {
            countLabel: 'свитчей', addLabel: '+ Свитч',
            blank: { switchId: 1, duration: 1 },
            headline: entry => 'sw ' + entry.switchId,
            summary: entry => 'выкл через ' + entry.duration + ' с',
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 12px;');
                const w1 = this._fieldLabel('Свитч');
                w1.appendChild(this._input(entry.switchId, v => { entry.switchId = v; }, 'number'));
                grid.appendChild(w1);
                const w2 = this._fieldLabel('Секунд');
                w2.appendChild(this._input(entry.duration, v => { entry.duration = v; }, 'number'));
                grid.appendChild(w2);
                card.appendChild(grid);
            }
        });
        this._renderCards(vrHost, s, 'AutoOff_Variables', {
            countLabel: 'переменных', addLabel: '+ Переменную',
            blank: { variableId: 1, duration: 1 },
            headline: entry => 'var ' + entry.variableId,
            summary: entry => '= 0 через ' + entry.duration + ' с',
            renderBody: (card, entry) => {
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px 12px;');
                const w1 = this._fieldLabel('Переменная');
                w1.appendChild(this._input(entry.variableId, v => { entry.variableId = v; }, 'number'));
                grid.appendChild(w1);
                const w2 = this._fieldLabel('Секунд');
                w2.appendChild(this._input(entry.duration, v => { entry.duration = v; }, 'number'));
                grid.appendChild(w2);
                card.appendChild(grid);
            }
        });
    }

    _renderReactions(entry) {
        const list = AgoniaCardEditorBase.decodeNested(entry.Reactions);
        const wrap = this._fieldLabel('Реactions', 'При срабатывании условия меняют свитчи/переменные (ID:значение через запятую)');
        const host = this._div('display:flex;flex-direction:column;gap:6px;');
        const rerender = () => {
            entry.Reactions = AgoniaCardEditorBase.encodeNested(list);
            wrap.replaceWith(this._renderReactions.call(this, entry));
        };
        list.forEach((r, i) => {
            const row = this._div('display:grid;grid-template-columns:90px 110px 90px 1fr 1fr auto;gap:6px;align-items:end;');
            const tv = this._fieldLabel('Var');
            tv.appendChild(this._input(r.TriggerVarId, v => { r.TriggerVarId = v; }, 'number'));
            row.appendChild(tv);
            const cw = this._fieldLabel('Условие');
            cw.appendChild(this._select([
                { value: 'equal', label: '=' }, { value: 'greater', label: '>' },
                { value: 'less', label: '<' }, { value: 'notEqual', label: '≠' }
            ], r.Condition, v => { r.Condition = v; }));
            row.appendChild(cw);
            const vw = this._fieldLabel('Знач.');
            vw.appendChild(this._input(r.Value, v => { r.Value = v; }, 'number'));
            row.appendChild(vw);
            const sw = this._fieldLabel('Свитчи');
            sw.appendChild(this._input(r.SwitchesToChange, v => { r.SwitchesToChange = v; }));
            row.appendChild(sw);
            const vrw = this._fieldLabel('Переменные');
            vrw.appendChild(this._input(r.VariablesToChange, v => { r.VariablesToChange = v; }));
            row.appendChild(vrw);
            row.appendChild(this._button('✕', () => { list.splice(i, 1); rerender(); }, 'danger'));
            host.appendChild(row);
        });
        host.appendChild(this._button('+ Реакция', () => {
            list.push({ TriggerVarId: 1, Condition: 'equal', Value: 0, SwitchesToChange: '', VariablesToChange: '' });
            entry.Reactions = AgoniaCardEditorBase.encodeNested(list);
            rerender();
        }));
        wrap.appendChild(host);
        return wrap;
    }

    // -- Drop -----------------------------------------------------------
    _renderDrop(content) {
        const s = this.getSection('drop');
        content.appendChild(this._sectionTitle('Выпаденные предметы (SuperDuperDrop)'));
        const panel = this._panel();
        const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 12px;');
        const fields = [
            ['Drop Char File', 'Спрайт предмета', 'text'],
            ['Drop Char Index', 'Индекс спрайта', 'number'],
            ['Drop Priority', 'Приоритет', 'number'],
            ['Drop Radius', 'Радиус подбора', 'number'],
            ['Icon Scale', 'Масштаб иконки', 'number'],
            ['Icon Y Offset', 'Иконка: смещение Y', 'number'],
            ['Icon Blink Min', 'Мигание мин', 'number'],
            ['Icon Blink Max', 'Мигание макс', 'number'],
            ['Icon Blink Period', 'Мигание период', 'number'],
            ['Drop Sound', 'Звук выброса', 'text'],
            ['Drop Sound Vol', 'Громкость выброса', 'number'],
            ['Drop Pickup Sound', 'Звук подбора', 'text'],
            ['Drop Pickup Vol', 'Громкость подбора', 'number'],
            ['Block Sound', 'Звук блокировки', 'text'],
            ['Block Sound Vol', 'Громкость блока', 'number'],
            ['Pickup Delay', 'Задержка подбора (f)', 'number'],
            ['Stack Pickup Delay', 'Задержка стака (f)', 'number'],
            ['Error Plugin Command', 'Команда ошибки (переполнение)', 'text']
        ];
        for (const [key, label, type] of fields) {
            const w = this._fieldLabel(label);
            w.appendChild(this._input(s[key], v => { s[key] = v; }, type));
            grid.appendChild(w);
        }
        for (const [key, label] of [['Drop Step Anime', 'Анимация стоя'], ['Drop Walk Anime', 'Анимация ходьбы'], ['Drop Dir Fix', 'Фикс. направление']]) {
            const w = this._fieldLabel(label);
            w.appendChild(this._checkbox(s[key], v => { s[key] = v; }));
            grid.appendChild(w);
        }
        panel.appendChild(grid);
        content.appendChild(panel);
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
