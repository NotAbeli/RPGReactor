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
        const el = this._div('padding:12px 0 4px;font-size:15px;font-weight:600;color:var(--color-text-strong);');
        el.textContent = this._tt(text);
        return el;
    }

    _panel() {
        return this._div(`
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border); border-radius: 6px;
            padding: 12px; display: flex; flex-direction: column; gap: 10px;
        `);
    }

    _fieldLabel(text, hint) {
        const wrap = this._div('display:flex;flex-direction:column;gap:2px;');
        const label = document.createElement('label');
        label.style.cssText = 'font-size:11px;color:var(--color-text);font-weight:600;';
        label.textContent = this._tt(text);
        wrap.appendChild(label);
        if (hint) {
            const h = this._div('font-size:10px;color:var(--color-text-dim);line-height:1.4;');
            h.textContent = hint;
            wrap.appendChild(h);
        }
        return wrap;
    }

    _input(value, onChange, type = 'text') {
        const input = document.createElement('input');
        input.type = type;
        input.value = value === undefined || value === null ? '' : value;
        input.style.cssText = `
            width:100%;padding:5px 8px;font-size:12px;box-sizing:border-box;
            background-color:var(--color-bg-deep);color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
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
        sel.style.cssText = `
            padding:4px 6px;font-size:12px;max-width:100%;
            background-color:var(--color-bg-deep);color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
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
        btn.style.cssText = `
            padding:4px 12px;font-size:12px;cursor:pointer;
            background-color:${kind === 'danger' ? 'var(--color-danger, #b33)' : 'var(--color-bg-deep)'};
            color:var(--color-text-strong);
            border:1px solid var(--color-border);border-radius:4px;
        `;
        btn.addEventListener('click', onClick);
        return btn;
    }

    _cardHead(title, summary, actions) {
        const head = this._div('display:flex;align-items:center;gap:10px;flex-wrap:wrap;');
        const name = this._div('font-weight:600;font-size:13px;color:var(--color-text-strong);');
        name.textContent = title;
        head.appendChild(name);
        if (summary) {
            const s = this._div('font-size:11px;color:var(--color-text-dim);');
            s.textContent = summary;
            head.appendChild(s);
        }
        head.appendChild(this._div('flex:1'));
        for (const a of (actions || [])) head.appendChild(a);
        return head;
    }

    /** Render a card list with add/reorder/duplicate/delete wiring. */
    _renderCards(host, section, key, opts) {
        host.innerHTML = '';
        const entries = AgoniaCardEditorBase.decodeCollection(section[key]);

        const header = this._div('display:flex;align-items:center;gap:12px;padding-bottom:10px;flex-wrap:wrap;');
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
            const empty = this._div('color:var(--color-text-muted);text-align:center;padding:30px 0;font-size:13px;');
            empty.textContent = this._tt('Записей нет — нажмите «Добавить»');
            host.appendChild(empty);
            return;
        }

        entries.forEach((entry, idx) => {
            const card = this._panel();
            card.style.marginBottom = '12px';
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
        const banner = this._div(`
            background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px;
        `);
        banner.textContent = this._tt('Крафт');
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
        sub.textContent = this._tt('Рецепты верстака (SimpleCraftSystem). Открытие меню — натив 734');
        banner.appendChild(sub);
        wrapper.appendChild(banner);

        const content = this._div('flex:1;overflow-y:auto;padding:0 16px 16px;');
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
                const grid = this._div('display:grid;grid-template-columns:1fr 2fr;gap:14px;');
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
        const wrapper = this._div('display:flex;flex-direction:column;height:100%;overflow-y:auto;');
        const banner = this._div(`
            background-color: var(--color-bg-deep);
            padding: 14px 20px; border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600; color: var(--color-text-strong);
            display: flex; align-items: baseline; gap: 14px;
        `);
        banner.textContent = this._tt('Надписи на экране');
        const sub = document.createElement('span');
        sub.style.cssText = 'font-size:12px;font-weight:400;color:var(--color-text-dim);';
        sub.textContent = this._tt('Пресеты хинтов и титулов (нативы 735/737) + попапы добычи (729)');
        banner.appendChild(sub);
        wrapper.appendChild(banner);

        const hints = this.getSection('hints');
        const popup = this.getSection('popup');

        // --- hint presets ---
        wrapper.appendChild(this._sectionTitle('Пресеты хинтов (натив 735)'));
        const hintHost = this._div('padding:0 16px;');
        wrapper.appendChild(hintHost);
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
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;');
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
        wrapper.appendChild(this._sectionTitle('Пресеты титулов (натив 737)'));
        const titleHost = this._div('padding:0 16px;');
        wrapper.appendChild(titleHost);
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
                const grid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;');
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
        wrapper.appendChild(this._sectionTitle('Попапы добычи (натив 729)'));
        const popupPanel = this._panel();
        popupPanel.style.margin = '0 16px 16px';
        const popupGrid = this._div('display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;');
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
        wrapper.appendChild(popupPanel);

        container.appendChild(wrapper);
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
                const top = this._div('display:grid;grid-template-columns:1fr 120px 140px;gap:10px;');
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
        const wrap = this._div('display:grid;grid-template-columns:1fr 1fr;gap:10px;');
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

if (typeof window !== 'undefined') {
    window.AgoniaCardEditorBase = AgoniaCardEditorBase;
    window.DatabaseCraftEditor = DatabaseCraftEditor;
    window.DatabaseScreenTextEditor = DatabaseScreenTextEditor;
    window.DatabaseLootEditor = DatabaseLootEditor;
    window.DatabaseGiftsEditor = DatabaseGiftsEditor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AgoniaCardEditorBase, DatabaseCraftEditor, DatabaseScreenTextEditor, DatabaseLootEditor, DatabaseGiftsEditor };
}
