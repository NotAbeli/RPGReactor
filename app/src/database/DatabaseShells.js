/**
 * DatabaseShells - shared UI shells for the S18 editor rewrite.
 *
 * Two components render every record-based tab in the System1 visual
 * language (bg-panel sections, 13px bold headers, field cells):
 *
 *   MasterDetailShell - a list panel (search, add/copy/delete, name +
 *   summary) on the left and the single-record form on the right.
 *
 *   AccordionList    - rows with an always-visible key-metric header;
 *   clicking expands the full form inline. Nested sub-lists (rules,
 *   sound pools) reuse the same component.
 *
 * Both take plain render callbacks so editors keep their data plumbing.
 */

/** Master-detail: list left, single-record form right. */
class MasterDetailShell {
    /**
     * @param {object} opts
     * opts.items        - array of records
     * opts.key          - (record) => unique id string
     * opts.title        - (record, index) => list label
     * opts.summary      - (record, index) => dim sub-line (optional)
     * opts.blank        - factory for a new record
     * opts.onChanged    - (items) => void, persist after mutations
     * opts.renderForm   - (container, record, index, api) => void
     * opts.searchText   - (record) => searchable text (optional)
     * opts.addLabel     - button caption (default 'Добавить')
     * opts.thumb        - (record) => {url, letter} mini-thumb for list rows (optional)
     */
    constructor(opts) {
        this.o = Object.assign({ addLabel: 'Добавить' }, opts);
        this.selectedIdx = 0;
        this.filter = '';
    }

    mount(container) {
        container.innerHTML = '';
        this.root = document.createElement('div');
        this.root.style.cssText = 'display:flex;gap:12px;height:100%;min-height:0;align-items:stretch;';
        this.listCol = document.createElement('div');
        this.listCol.style.cssText = `
            flex: 0 0 300px; display: flex; flex-direction: column; gap: 8px;
            min-height: 0; max-height: 100%;
        `;
        this.formCol = document.createElement('div');
        this.formCol.style.cssText = 'flex:1;min-width:0;overflow-y:auto;padding:2px 4px 24px 0;';
        this.root.appendChild(this.listCol);
        this.root.appendChild(this.formCol);
        container.appendChild(this.root);
        this._renderList();
        this._renderSelection();
    }

    get visibleItems() {
        const { items, searchText } = this.o;
        const q = this.filter.trim().toLowerCase();
        if (!q || !searchText) return items.map((it, i) => [it, i]);
        return items.map((it, i) => [it, i]).filter(([it]) => String(searchText(it) || '').toLowerCase().includes(q));
    }

    _renderList() {
        const o = this.o;
        this.listCol.innerHTML = '';

        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Поиск...';
        search.className = 'agonia-input';
        search.value = this.filter;
        search.addEventListener('input', () => {
            this.filter = search.value;
            this._renderList();
            this._renderSelection();
        });
        this.listCol.appendChild(search);

        const list = document.createElement('div');
        list.className = 'agonia-md-list';
        list.style.cssText = `
            flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
            background-color: var(--color-bg-surface); border: 1px solid var(--color-border);
            border-radius: 4px; padding: 6px; min-height: 0;
        `;
        const visible = this.visibleItems;
        if (!visible.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:18px 4px;font-size:12px;';
            empty.textContent = visible.length === o.items.length && o.items.length
                ? 'Ничего не найдено' : 'Записей нет';
            list.appendChild(empty);
        }
        for (const [item, idx] of visible) {
            const row = document.createElement('div');
            row.className = 'agonia-md-item' + (idx === this.selectedIdx ? ' active' : '');
            row.style.cssText = `
                padding: 6px 8px; border-radius: 3px; cursor: pointer;
                display: flex; align-items: center; gap: 8px;
                border: 1px solid ${idx === this.selectedIdx ? 'var(--color-accent-border-mid)' : 'transparent'};
                background-color: ${idx === this.selectedIdx ? 'var(--color-bg-deep)' : 'transparent'};
            `;
            if (o.thumb) {
                const th = document.createElement('div');
                const t = o.thumb(item, idx) || {};
                if (t.url) {
                    th.style.cssText = 'flex:none;width:36px;height:44px;background-color:var(--color-bg-deep);border:1px solid var(--color-border);border-radius:3px;overflow:hidden;display:flex;align-items:center;justify-content:center;';
                    const img = document.createElement('img');
                    img.src = t.url;
                    img.style.cssText = 'max-width:100%;max-height:100%;image-rendering:pixelated;';
                    th.appendChild(img);
                } else {
                    th.style.cssText = 'flex:none;width:36px;height:44px;background-color:var(--color-bg-surface);border:1px solid var(--color-border);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--color-text-dim);';
                    th.textContent = t.letter || '·';
                }
                row.appendChild(th);
            }
            const texts = document.createElement('div');
            texts.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;';
            const name = document.createElement('div');
            name.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            name.textContent = o.title(item, idx);
            texts.appendChild(name);
            if (o.summary) {
                const sub = document.createElement('div');
                sub.style.cssText = 'font-size:10px;color:var(--color-text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                sub.textContent = String(o.summary(item, idx) || '');
                texts.appendChild(sub);
            }
            row.appendChild(texts);
            row.addEventListener('click', () => {
                this.selectedIdx = idx;
                this._renderList();
                this._renderSelection();
            });
            list.appendChild(row);
        }
        this.listCol.appendChild(list);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:6px;';
        const add = document.createElement('button');
        add.className = 'agonia-btn';
        add.style.flex = '1';
        add.textContent = typeof window !== 'undefined' && window.I18n ? window.I18n.tText(o.addLabel) : o.addLabel;
        add.addEventListener('click', () => {
            const rec = o.blank();
            o.items.push(rec);
            this.selectedIdx = o.items.length - 1;
            o.onChanged(o.items);
            this._renderList();
            this._renderSelection();
        });
        btns.appendChild(add);

        const dup = document.createElement('button');
        dup.className = 'agonia-btn';
        dup.title = 'Дублировать';
        dup.textContent = '⧉';
        dup.addEventListener('click', () => {
            if (!o.items.length) return;
            const rec = JSON.parse(JSON.stringify(o.items[this.selectedIdx]));
            o.items.splice(this.selectedIdx + 1, 0, rec);
            this.selectedIdx++;
            o.onChanged(o.items);
            this._renderList();
            this._renderSelection();
        });
        btns.appendChild(dup);

        const del = document.createElement('button');
        del.className = 'agonia-btn danger';
        del.title = 'Удалить';
        del.textContent = '−';
        del.addEventListener('click', () => {
            if (!o.items.length) return;
            o.items.splice(this.selectedIdx, 1);
            this.selectedIdx = Math.max(0, this.selectedIdx - 1);
            o.onChanged(o.items);
            this._renderList();
            this._renderSelection();
        });
        btns.appendChild(del);
        this.listCol.appendChild(btns);
    }

    _renderSelection() {
        this.formCol.innerHTML = '';
        const o = this.o;
        if (!o.items.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:60px 0;font-size:13px;';
            empty.textContent = 'Выберите запись слева или добавьте новую';
            this.formCol.appendChild(empty);
            return;
        }
        const idx = Math.min(this.selectedIdx, o.items.length - 1);
        this.selectedIdx = idx;
        try {
            o.renderForm(this.formCol, o.items[idx], idx, {
                refreshList: () => this._renderList(),
                changed: () => o.onChanged(o.items)
            });
        } catch (e) {
            const box = document.createElement('div');
            box.style.cssText = 'margin:12px 0;padding:10px 14px;border:1px solid var(--color-danger,#b33);border-radius:4px;background:rgba(179,51,51,.12);font-size:12px;line-height:1.5;';
            const t = document.createElement('div');
            t.style.fontWeight = '700';
            t.textContent = 'Ошибка отрисовки формы:';
            box.appendChild(t);
            const d = document.createElement('div');
            d.style.cssText = 'font-family:var(--font-mono,monospace);white-space:pre-wrap;color:var(--color-text-dim);';
            d.textContent = String((e && e.stack) || e).split('\n').slice(0, 4).join('\n');
            box.appendChild(d);
            this.formCol.appendChild(box);
        }
    }
}

/** Accordion rows: key metrics always visible, form expands on click. */
class AccordionList {
    /**
     * @param {object} opts
     * opts.items      - array of records
     * opts.header     - (record, index) => text for the always-visible head
     * opts.sub        - (record, index) => dim tail for the head (optional)
     * opts.renderBody - (container, record, index, api) => form body
     * opts.onRemove   - (index) => void (optional; renders ✕ when given)
     * opts.onReorder  - (from, to) => void (optional; renders ▲▼)
     * opts.defaultOpen- index to start expanded (default none)
     */
    constructor(opts) {
        this.o = opts;
        this.open = opts.defaultOpen !== undefined ? opts.defaultOpen : -1;
    }

    mount(container) {
        container.innerHTML = '';
        this.root = document.createElement('div');
        this.root.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        container.appendChild(this.root);
        this._render();
    }

    _render() {
        const o = this.o;
        this.root.innerHTML = '';
        if (!o.items.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:18px 0;font-size:12px;';
            empty.textContent = 'Записей нет';
            this.root.appendChild(empty);
            return;
        }
        o.items.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'agonia-acc';
            row.style.cssText = `
                background-color: var(--color-bg-panel);
                border: 1px solid var(--color-border); border-radius: 4px;
                display: flex; flex-direction: column;
            `;
            const head = document.createElement('div');
            head.style.cssText = `
                display: flex; align-items: center; gap: 10px; padding: 8px 10px;
                cursor: pointer; user-select: none; flex-wrap: wrap;
            `;
            const caret = document.createElement('span');
            caret.textContent = this.open === idx ? '▾' : '▸';
            caret.style.cssText = 'font-size:10px;color:var(--color-text-dim);width:10px;flex:none;';
            head.appendChild(caret);
            const title = document.createElement('span');
            title.className = 'agonia-card-title';
            title.textContent = o.header(item, idx);
            head.appendChild(title);
            if (o.sub) {
                const sub = document.createElement('span');
                sub.className = 'agonia-card-sub';
                sub.textContent = String(o.sub(item, idx) || '');
                head.appendChild(sub);
            }
            head.appendChild((() => { const s = document.createElement('div'); s.style.flex = '1'; return s; })());
            if (o.onReorder) {
                const up = document.createElement('button');
                up.className = 'agonia-btn'; up.textContent = '▲'; up.title = 'Выше';
                up.addEventListener('click', e => { e.stopPropagation(); if (idx > 0) o.onReorder(idx, idx - 1); });
                head.appendChild(up);
                const down = document.createElement('button');
                down.className = 'agonia-btn'; down.textContent = '▼'; down.title = 'Ниже';
                down.addEventListener('click', e => { e.stopPropagation(); if (idx < o.items.length - 1) o.onReorder(idx, idx + 1); });
                head.appendChild(down);
            }
            if (o.onRemove) {
                const del = document.createElement('button');
                del.className = 'agonia-btn danger'; del.textContent = '✕'; del.title = 'Удалить';
                del.addEventListener('click', e => { e.stopPropagation(); o.onRemove(idx); });
                head.appendChild(del);
            }
            head.addEventListener('click', () => {
                this.open = this.open === idx ? -1 : idx;
                this._render();
            });
            row.appendChild(head);

            if (this.open === idx) {
                const body = document.createElement('div');
                body.style.cssText = 'padding: 4px 10px 10px;';
                row.appendChild(body);
                o.renderBody(body, item, idx, {
                    refresh: () => this._render(),
                    collapse: () => { this.open = -1; this._render(); }
                });
            }
            this.root.appendChild(row);
        });
    }
}

/** Field helpers shared by the new editors (kit classes only). */
const ShellKit = {
    section(title, hint) {
        const s = document.createElement('div');
        s.className = 'agonia-section';
        const h = document.createElement('div');
        h.className = 'agonia-section-header';
        h.textContent = title;
        if (hint) h.title = hint;
        s.appendChild(h);
        return s;
    },
    grid() {
        const g = document.createElement('div');
        g.className = 'agonia-field-grid';
        return g;
    },
    field(label, control, hint) {
        const w = document.createElement('div');
        w.className = 'agonia-field';
        const l = document.createElement('label');
        l.textContent = label;
        w.appendChild(l);
        if (hint) w.title = hint;
        if (control) w.appendChild(control);
        return w;
    },
    number(value, onChange, opts = {}) {
        const i = document.createElement('input');
        i.type = 'number';
        i.className = 'agonia-input';
        if (opts.min !== undefined) i.min = opts.min;
        if (opts.max !== undefined) i.max = opts.max;
        if (opts.step !== undefined) i.step = opts.step;
        i.value = value === undefined || value === null || value === '' ? 0 : value;
        i.addEventListener('input', () => {
            const n = Number(i.value);
            if (!Number.isNaN(n)) onChange(n);
        });
        return i;
    },
    text(value, onChange, opts = {}) {
        const i = document.createElement('input');
        i.type = 'text';
        i.className = 'agonia-input';
        if (opts.placeholder) i.placeholder = opts.placeholder;
        i.value = value === undefined || value === null ? '' : String(value);
        i.addEventListener('input', () => onChange(i.value));
        return i;
    },
    select(options, value, onChange) {
        const s = document.createElement('select');
        s.className = 'agonia-select';
        for (const o of options) {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            s.appendChild(opt);
        }
        s.value = String(value === undefined ? '' : value);
        s.addEventListener('change', () => onChange(s.value));
        return s;
    },
    checkbox(value, onChange) {
        const b = document.createElement('input');
        b.type = 'checkbox';
        b.style.cursor = 'pointer';
        b.checked = typeof value === 'string' ? String(value).toLowerCase() === 'true' : !!value;
        b.addEventListener('change', () => onChange(b.checked));
        return b;
    }
};

/** Range + number, kept in sync. Values outside [min,max] are typed freely. */
class SliderNumber {
    /** @param value number, onChange (n)=>void, opts {min,max,step,unit,width} */
    constructor(value, onChange, opts = {}) {
        this.root = document.createElement('div');
        this.root.className = 'agn-slider';
        const min = opts.min !== undefined ? opts.min : 0;
        const max = opts.max !== undefined ? opts.max : 100;
        const step = opts.step !== undefined ? opts.step : 1;
        let v = Number(value);
        if (Number.isNaN(v)) v = min;

        this.range = document.createElement('input');
        this.range.type = 'range';
        this.range.min = min; this.range.max = max; this.range.step = step;
        this.range.value = Math.min(Math.max(v, min), max);
        this.num = document.createElement('input');
        this.num.type = 'number';
        this.num.className = 'agonia-input';
        this.num.min = min; this.num.max = max; this.num.step = step;
        this.num.value = v;

        const commit = (n, fromRange) => {
            if (Number.isNaN(n)) return;
            if (fromRange && n >= min && n <= max) this.num.value = n;
            this.range.value = Math.min(Math.max(n, min), max);
            onChange(n);
        };
        this.range.addEventListener('input', () => commit(Number(this.range.value), true));
        this.num.addEventListener('input', () => {
            const n = Number(this.num.value);
            if (!Number.isNaN(n)) {
                this.range.value = Math.min(Math.max(n, min), max);
                onChange(n);
            }
        });
        this.root.appendChild(this.range);
        this.root.appendChild(this.num);
        if (opts.unit) {
            const u = document.createElement('span');
            u.className = 'agn-slider-unit';
            u.textContent = opts.unit;
            this.root.appendChild(u);
        }
    }
}

/**
 * InspectorForm - one record as label-left / control-right rows.
 * Sections are ruled captions, no nested panels.
 *
 *   const form = new InspectorForm();
 *   form.head('Удар мечом', 'дуга · R1.5');   // optional
 *   form.section('Геометрия');
 *   form.row('Форма', control, hint);
 *   form.field({label, key, type, min, max, step, options, unit, hint}, record, commit);
 *   form.mount(container);
 */
class InspectorForm {
    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'agn-insp';
    }
    head(title, sub) {
        const h = document.createElement('div');
        h.className = 'agn-insp-head';
        const t = document.createElement('div');
        t.className = 'agn-insp-title';
        t.textContent = title;
        h.appendChild(t);
        if (sub) {
            const s = document.createElement('div');
            s.className = 'agn-insp-sub';
            s.textContent = sub;
            h.appendChild(s);
        }
        this.root.appendChild(h);
        return this;
    }
    section(caption) {
        const s = document.createElement('div');
        s.className = 'agn-insp-section';
        const c = document.createElement('span');
        c.className = 'agn-insp-caption';
        c.textContent = caption;
        s.appendChild(c);
        this.root.appendChild(s);
        return this;
    }
    row(label, control, hint) {
        const r = document.createElement('div');
        r.className = 'agn-insp-row';
        const l = document.createElement('div');
        l.className = 'agn-insp-label';
        l.textContent = label;
        if (hint) {
            const small = document.createElement('small');
            small.textContent = hint;
            l.appendChild(small);
        } else {
            l.title = label;
        }
        r.appendChild(l);
        const c = document.createElement('div');
        c.className = 'agn-insp-control';
        if (control) c.appendChild(control);
        r.appendChild(c);
        this.root.appendChild(r);
        return this;
    }
    /** Schema-driven row: def {label,key,type,hint,min,max,step,unit,options,placeholder,textarea} */
    field(def, record, commit) {
        const k = def.key;
        const save = v => { record[k] = v; commit(); };
        if (def.type === 'select') {
            const opts = def.options.map(([v, l]) => ({ value: v, label: l }));
            const cur = record[k] !== undefined && record[k] !== '' ? String(record[k]) : (def.def || def.options[0][0]);
            return this.row(def.label, ShellKit.select(opts, cur, save), def.hint);
        }
        if (def.type === 'check') {
            const w = document.createElement('div');
            w.style.cssText = 'display:flex;align-items:center;gap:8px;';
            w.appendChild(ShellKit.checkbox(record[k], save));
            return this.row(def.label, w, def.hint);
        }
        if (def.type === 'textarea') {
            const t = document.createElement('textarea');
            t.className = 'agonia-input';
            t.style.cssText = 'flex:1 1 100%;min-height:56px;resize:vertical;font-family:var(--font-mono,monospace);';
            if (def.placeholder) t.placeholder = def.placeholder;
            t.value = typeof record[k] === 'string' ? record[k] : JSON.stringify(record[k] || {}, null, 1);
            t.addEventListener('input', () => save(t.value));
            return this.row(def.label, t, def.hint);
        }
        if (def.type === 'number') {
            const n = document.createElement('input');
            n.type = 'number';
            n.className = 'agonia-input';
            if (def.min !== undefined) n.min = def.min;
            if (def.max !== undefined) n.max = def.max;
            if (def.step !== undefined) n.step = def.step;
            n.value = record[k] === undefined || record[k] === null || record[k] === '' ? 0 : record[k];
            n.addEventListener('input', () => {
                const x = Number(n.value);
                if (!Number.isNaN(x)) save(x);
            });
            return this.row(def.label, n, def.hint);
        }
        if (def.type === 'slider') {
            const s = new SliderNumber(record[k] === undefined ? def.min || 0 : Number(record[k]),
                save, { min: def.min, max: def.max, step: def.step, unit: def.unit });
            return this.row(def.label, s.root, def.hint);
        }
        const t = document.createElement('input');
        t.type = 'text';
        t.className = 'agonia-input';
        if (def.placeholder) t.placeholder = def.placeholder;
        t.value = record[k] === undefined || record[k] === null ? '' : String(record[k]);
        t.addEventListener('input', () => save(t.value));
        return this.row(def.label, t, def.hint);
    }
    /** Several schema rows under one section: fieldDefs([defs], record, {section, commit}). */
    fields(defs, record, opts = {}) {
        if (opts.section) this.section(opts.section);
        for (const d of defs) this.field(d, record, opts.commit || (() => {}));
    }
    mount(container) {
        container.appendChild(this.root);
        return this;
    }
}

/**
 * DataTable - records as a spreadsheet: inline cell editing, zebra,
 * sticky header, optional expandable detail rows, add/remove/reorder.
 *
 *   new DataTable({
 *     items, columns: [
 *       { label:'№', get:(r,i)=>i+1, align:'right', width:'40px' },      // computed, read-only
 *       { label:'Название', key:'Name', type:'text' },                    // editable by key
 *       { label:'Режим', key:'Mode', type:'select', options:[[v,l],...] },// always-on select
 *     ],
 *     expandable: (body, item, idx, api) => {...},  // optional ▶ column
 *     onAdd: () => ...,  addLabel: 'Добавить',
 *     onRemove: idx => ...,  onReorder: (from,to) => ...,
 *     onChanged: () => ...  // persist after cell edits
 *   })
 */
class DataTable {
    constructor(opts) {
        this.o = Object.assign({ addLabel: 'Добавить' }, opts);
        this.sortKey = null;
        this.sortDir = 1;
        this.open = new Set(); // real indices with expanded rows
    }
    get order() {
        const o = this.o;
        const idx = o.items.map((it, i) => i);
        if (!this.sortKey) return idx;
        const col = o.columns.find(c => c.key === this.sortKey);
        if (!col) return idx;
        const val = r => {
            const v = r[col.key];
            return v === undefined || v === null ? '' : v;
        };
        return idx.sort((a, b) => {
            const va = val(o.items[a]), vb = val(o.items[b]);
            const na = Number(va), nb = Number(vb);
            const cmp = (!Number.isNaN(na) && !Number.isNaN(nb) && va !== '' && vb !== '')
                ? na - nb : String(va).localeCompare(String(vb), 'ru');
            return cmp * this.sortDir;
        });
    }
    mount(container) {
        container.innerHTML = '';
        this.root = document.createElement('div');
        this.root.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

        // S21: empty collection - one compact line instead of the table
        // skeleton (headers + "Записей нет" row made dead weight).
        if (!this.o.items.length) {
            const line = document.createElement('div');
            line.className = 'agn-table-empty';
            line.style.cssText = 'display:flex;align-items:center;gap:10px;text-align:left;padding:2px 0;';
            const lbl = document.createElement('span');
            lbl.textContent = (this.o.countLabel || 'записей') + ' — пусто';
            line.appendChild(lbl);
            if (this.o.onAdd) {
                const add = document.createElement('button');
                add.className = 'agonia-btn';
                add.textContent = this.o.addLabel;
                add.addEventListener('click', () => this.o.onAdd());
                line.appendChild(add);
            }
            this.root.appendChild(line);
            container.appendChild(this.root);
            return;
        }

        const bar = document.createElement('div');
        bar.className = 'agn-table-bar';
        const count = document.createElement('div');
        count.className = 'agn-table-count';
        count.textContent = this.o.items.length + ' ' + (this.o.countLabel || 'записей');
        bar.appendChild(count);
        bar.appendChild((() => { const s = document.createElement('div'); s.style.flex = '1'; return s; })());
        if (this.o.onAdd) {
            const add = document.createElement('button');
            add.className = 'agonia-btn';
            add.textContent = this.o.addLabel;
            add.addEventListener('click', () => this.o.onAdd());
            bar.appendChild(add);
        }
        this.root.appendChild(bar);

        const wrap = document.createElement('div');
        wrap.className = 'agn-table-wrap';
        this.table = document.createElement('table');
        this.table.className = 'agn-table';
        wrap.appendChild(this.table);
        this.root.appendChild(wrap);
        container.appendChild(this.root);
        this._renderHead();
        this._renderBody();
    }
    _renderHead() {
        const o = this.o;
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        if (o.expandable) {
            const th = document.createElement('th');
            th.style.width = '24px';
            tr.appendChild(th);
        }
        for (const col of o.columns) {
            const th = document.createElement('th');
            th.textContent = col.label;
            if (col.width) th.style.width = col.width;
            if (col.align === 'right') th.style.textAlign = 'right';
            if (col.key) {
                th.classList.add('agn-sortable');
                if (this.sortKey === col.key) th.textContent = col.label + (this.sortDir > 0 ? ' ▲' : ' ▼');
                th.addEventListener('click', () => {
                    if (this.sortKey === col.key) {
                        if (this.sortDir > 0) this.sortDir = -1;
                        else { this.sortKey = null; this.sortDir = 1; }
                    } else { this.sortKey = col.key; this.sortDir = 1; }
                    this._renderHead();
                    this._renderBody();
                });
            }
            tr.appendChild(th);
        }
        if (o.onRemove || o.onReorder) {
            const th = document.createElement('th');
            th.style.width = (o.onRemove && o.onReorder) ? '86px' : '40px';
            tr.appendChild(th);
        }
        thead.appendChild(tr);
        this.table.appendChild(thead);
    }
    _renderBody() {
        const o = this.o;
        if (this.tbody) this.tbody.remove();
        const tbody = document.createElement('tbody');
        this.tbody = tbody;

        if (!o.items.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = (o.expandable ? 1 : 0) + o.columns.length + (o.onRemove || o.onReorder ? 1 : 0);
            const empty = document.createElement('div');
            empty.className = 'agn-table-empty';
            empty.textContent = 'Записей нет';
            td.appendChild(empty);
            tr.appendChild(td);
            tbody.appendChild(tr);
            this.table.appendChild(tbody);
            return;
        }

        for (const realIdx of this.order) {
            const item = o.items[realIdx];
            const tr = document.createElement('tr');
            tr.className = 'agn-data-row' + ((tbody.children.length % 2 === 1) ? ' agn-even' : '');

            if (o.expandable) {
                const td = document.createElement('td');
                td.style.padding = '2px 4px';
                const caret = document.createElement('span');
                caret.className = 'agn-caret';
                caret.textContent = this.open.has(realIdx) ? '▾' : '▸';
                caret.addEventListener('click', () => {
                    if (this.open.has(realIdx)) this.open.delete(realIdx);
                    else this.open.add(realIdx);
                    this._renderHead();
                    this._renderBody();
                });
                td.appendChild(caret);
                tr.appendChild(td);
            }

            for (const col of o.columns) {
                const td = document.createElement('td');
                if (col.align === 'right') td.className = 'agn-num';
                if (col.className) td.classList.add(col.className);
                if (col.type === 'select' && col.key) {
                    const opts = col.options.map(([v, l]) => ({ value: v, label: l }));
                    const cur = item[col.key] !== undefined && item[col.key] !== '' ? String(item[col.key]) : String((col.options[0] || [])[0]);
                    td.appendChild(ShellKit.select(opts, cur, v => {
                        item[col.key] = col.number ? Number(v) : v;
                        if (o.onChanged) o.onChanged();
                    }));
                } else if (col.type === 'check' && col.key) {
                    td.appendChild(ShellKit.checkbox(item[col.key], v => {
                        item[col.key] = v;
                        if (o.onChanged) o.onChanged();
                    }));
                } else if (col.type && col.key) {
                    td.classList.add('agn-editable');
                    const render = () => {
                        td.textContent = '';
                        td.appendChild(document.createTextNode(this._cellText(item, col)));
                    };
                    render();
                    td.addEventListener('click', () => {
                        if (td.querySelector('.agn-cell-input')) return;
                        this._editCell(td, item, col, render);
                    });
                } else {
                    const txt = this._cellText(item, col, realIdx);
                    td.appendChild(document.createTextNode(txt));
                    if (col.dim) td.classList.add('agn-dim');
                }
                tr.appendChild(td);
            }

            if (o.onRemove || o.onReorder) {
                const td = document.createElement('td');
                td.style.whiteSpace = 'nowrap';
                td.style.textAlign = 'right';
                if (o.onReorder && !this.sortKey) {
                    const up = document.createElement('button');
                    up.className = 'agonia-btn agn-rowbtn';
                    up.textContent = '▲'; up.title = 'Выше';
                    up.addEventListener('click', () => { if (realIdx > 0) o.onReorder(realIdx, realIdx - 1); });
                    td.appendChild(up);
                    const down = document.createElement('button');
                    down.className = 'agonia-btn agn-rowbtn';
                    down.textContent = '▼'; down.title = 'Ниже';
                    down.addEventListener('click', () => { if (realIdx < o.items.length - 1) o.onReorder(realIdx, realIdx + 1); });
                    td.appendChild(down);
                }
                if (o.onRemove) {
                    const del = document.createElement('button');
                    del.className = 'agonia-btn danger agn-rowbtn';
                    del.textContent = '✕'; del.title = 'Удалить';
                    del.addEventListener('click', () => o.onRemove(realIdx));
                    td.appendChild(del);
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);

            if (o.expandable && this.open.has(realIdx)) {
                const xtr = document.createElement('tr');
                xtr.className = 'agn-expand-row';
                const xtd = document.createElement('td');
                xtd.colSpan = (o.expandable ? 1 : 0) + o.columns.length + (o.onRemove || o.onReorder ? 1 : 0);
                o.expandable(xtd, item, realIdx, {
                    refresh: () => { this._renderHead(); this._renderBody(); },
                    close: () => { this.open.delete(realIdx); this._renderHead(); this._renderBody(); }
                });
                xtr.appendChild(xtd);
                tbody.appendChild(xtr);
            }
        }
        this.table.appendChild(tbody);
    }
    _cellText(item, col, idx) {
        const v = col.get ? col.get(item, idx) : item[col.key];
        if (v === undefined || v === null || v === '') return '—';
        return String(v);
    }
    _editCell(td, item, col, render) {
        const o = this.o;
        const input = document.createElement('input');
        input.className = 'agn-cell-input';
        if (col.type === 'number') {
            input.type = 'number';
            if (col.min !== undefined) input.min = col.min;
            if (col.max !== undefined) input.max = col.max;
        } else {
            input.type = 'text';
        }
        const raw = col.get ? col.get(item, -1) : item[col.key];
        input.value = raw === undefined || raw === null ? '' : raw;
        td.textContent = '';
        td.appendChild(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (apply) => {
            if (done) return;
            done = true;
            if (apply) {
                // Commit BEFORE re-render so blur cannot swallow the value.
                if (col.key) {
                    if (col.type === 'number') {
                        const n = Number(input.value);
                        if (!Number.isNaN(n)) item[col.key] = n;
                    } else {
                        item[col.key] = input.value;
                    }
                }
                if (o.onChanged) o.onChanged();
            }
            render();
        };
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
            e.stopPropagation();
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('click', e => e.stopPropagation());
    }
}

if (typeof window !== 'undefined') {
    window.MasterDetailShell = MasterDetailShell;
    window.AccordionList = AccordionList;
    window.ShellKit = ShellKit;
    window.SliderNumber = SliderNumber;
    window.InspectorForm = InspectorForm;
    window.DataTable = DataTable;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MasterDetailShell, AccordionList, ShellKit, SliderNumber, InspectorForm, DataTable };
}
