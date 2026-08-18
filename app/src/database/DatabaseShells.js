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
                border: 1px solid ${idx === this.selectedIdx ? 'var(--color-accent-border-mid)' : 'transparent'};
                background-color: ${idx === this.selectedIdx ? 'var(--color-bg-deep)' : 'transparent'};
            `;
            const name = document.createElement('div');
            name.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            name.textContent = o.title(item, idx);
            row.appendChild(name);
            if (o.summary) {
                const sub = document.createElement('div');
                sub.style.cssText = 'font-size:10px;color:var(--color-text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                sub.textContent = String(o.summary(item, idx) || '');
                row.appendChild(sub);
            }
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
        o.renderForm(this.formCol, o.items[idx], idx, {
            refreshList: () => this._renderList(),
            changed: () => o.onChanged(o.items)
        });
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

if (typeof window !== 'undefined') {
    window.MasterDetailShell = MasterDetailShell;
    window.AccordionList = AccordionList;
    window.ShellKit = ShellKit;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MasterDetailShell, AccordionList, ShellKit };
}
