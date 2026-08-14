/**
 * NativeCommandDialog - Schema-driven parameter editor for Agonia Engine
 * native event commands (codes 700+, registry: NativeCommands.js).
 *
 * show(command, callback):
 *   command  - existing {code, parameters, indent} or null for a new one
 *   callback - receives {code, parameters, indent} or null on cancel
 */
class NativeCommandDialog {
    constructor(databaseManager, projectController) {
        this.databaseManager = databaseManager;
        this.projectController = projectController;
        this.modal = null;
        this.callback = null;
        this.schema = null;
        this.chestIdsCache = null;
        if (typeof nw !== 'undefined') {
            this.fs = require('fs');
            this.path = require('path');
        }
    }

    _t(key, params = {}) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.t(key, params) : key;
    }

    show(command, callback) {
        const code = command ? command.code : this._pendingCode;
        const schema = AgoniaNativeCommands.byCode(code);
        if (!schema) {
            if (callback) callback(null);
            return;
        }
        this.schema = schema;
        this.callback = callback;
        this.values = {};
        for (const field of schema.fields) {
            this.values[field.key] = command && command.parameters
                ? command.parameters[field.index]
                : undefined;
        }
        this.createModal();
        this.modal.style.display = 'flex';
        this.renderBody();
        this.refreshSuggestions();
    }

    showForCode(code, callback) {
        this._pendingCode = code;
        this.show(null, callback);
    }

    createModal() {
        if (this.modal) return;
        this.modal = document.createElement('div');
        this.modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.6); z-index: 10001;
            display: none; align-items: center; justify-content: center;
        `;
        const container = document.createElement('div');
        container.className = 'command-picker-container';
        container.style.cssText = `
            background-color: var(--color-bg-panel); border: 1px solid var(--color-border);
            border-radius: 6px; width: 480px; max-width: 92vw; max-height: 86vh;
            display: flex; flex-direction: column; overflow: hidden;
        `;
        this.body = document.createElement('div');
        this.body.style.cssText = 'padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;';
        container.appendChild(this.body);
        this.modal.appendChild(container);
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close(null);
        });
        document.body.appendChild(this.modal);
    }

    renderBody() {
        const schema = this.schema;
        this.body.innerHTML = '';

        const title = document.createElement('h3');
        title.style.cssText = 'margin: 0; color: var(--color-text-strong); font-size: 15px;';
        title.textContent = window.I18n?.tEventCommandName
            ? window.I18n.tEventCommandName(schema.name)
            : schema.name;
        this.body.appendChild(title);

        if (schema.help) {
            const help = document.createElement('div');
            help.style.cssText = 'color: var(--color-text-dim); font-size: 12px; line-height: 1.5;';
            help.textContent = this._t('agonia.command.help.' + schema.id, { fallbackHelp: schema.help }) === 'agonia.command.help.' + schema.id
                ? schema.help
                : this._t('agonia.command.help.' + schema.id);
            this.body.appendChild(help);
        }

        this.fieldElements = {};
        this.fieldWraps = {};
        this._suggestionDatalists = [];
        for (const field of schema.fields) {
            const wrap = this.renderField(field);
            this.fieldWraps[field.key] = wrap;
            this.body.appendChild(wrap);
            this._applyVisibility(field);
        }

        // Re-evaluate conditional visibility whenever a driving value changes.
        for (const field of schema.fields) {
            const elements = this.fieldElements[field.key];
            if (elements && elements.input) {
                elements.input.addEventListener('change', () => {
                    for (const other of schema.fields) this._applyVisibility(other);
                });
            }
        }

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;';
        const cancel = document.createElement('button');
        cancel.textContent = this._t('common.cancel');
        cancel.style.cssText = this._buttonStyle(false);
        cancel.addEventListener('click', () => this.close(null));
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        ok.style.cssText = this._buttonStyle(true);
        ok.addEventListener('click', () => this.confirm());
        buttons.appendChild(cancel);
        buttons.appendChild(ok);
        this.body.appendChild(buttons);
    }

    _buttonStyle(primary) {
        return `
            padding: 6px 16px; border: none; border-radius: 4px; cursor: pointer;
            font-size: 12px;
            background-color: ${primary ? 'var(--color-accent-bright)' : 'var(--color-bg-input-alt)'};
            color: ${primary ? 'var(--color-accent-on)' : 'var(--color-text-strong)'};
        `;
    }

    renderField(field) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const label = document.createElement('label');
        label.style.cssText = 'color: var(--color-text-strong); font-size: 12px; font-weight: 600;';
        label.textContent = field.label;
        wrap.appendChild(label);

        if (field.type === 'chestId') {
            wrap.appendChild(this.renderChestIdField(field));
        } else if (field.type === 'select') {
            wrap.appendChild(this.renderSelectField(field));
        } else if (field.type === 'itemRef') {
            wrap.appendChild(this.renderItemRefField(field));
        } else if (field.type === 'switchId') {
            wrap.appendChild(this.renderSwitchVariableField(field, 'switch'));
        } else if (field.type === 'variableId') {
            wrap.appendChild(this.renderSwitchVariableField(field, 'variable'));
        } else if (field.type === 'suggestion') {
            wrap.appendChild(this.renderSuggestionField(field));
        } else if (field.type === 'multiline') {
            wrap.appendChild(this.renderMultilineField(field));
        } else if (field.type === 'color') {
            wrap.appendChild(this.renderColorField(field));
        } else {
            wrap.appendChild(this.renderTextField(field));
        }
        return wrap;
    }

    renderColorField(field) {
        const line = document.createElement('div');
        line.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        const current = String(this.values[field.key] !== undefined ? this.values[field.key] : (field.default || ''));
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.value = /^#[0-9a-fA-F]{6}$/.test(current) ? current : '#000000';
        picker.style.cssText = `
            width: 34px; height: 28px; padding: 0;
            border: 1px solid var(--color-border-input);
            border-radius: 4px; background: none; cursor: pointer; flex-shrink: 0;
        `;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.placeholder = '#rrggbb';
        input.style.cssText = this._inputStyle() + ' flex: 1;';
        picker.addEventListener('input', () => {
            input.value = picker.value;
            this.values[field.key] = picker.value;
        });
        input.addEventListener('input', () => {
            this.values[field.key] = input.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(input.value.trim())) picker.value = input.value.trim();
        });
        line.appendChild(picker);
        line.appendChild(input);
        this.fieldElements[field.key] = { input: picker, hexInput: input };
        return line;
    }

    renderSuggestionField(field) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.values[field.key] !== undefined ? this.values[field.key] : '';
        input.style.cssText = this._inputStyle();
        const datalist = document.createElement('datalist');
        datalist.id = 'agonia-suggest-' + field.key;
        input.setAttribute('list', datalist.id);
        this._suggestionDatalists = this._suggestionDatalists || [];
        this._suggestionDatalists.push({ datalist, kind: field.suggestions });
        input.addEventListener('input', () => { this.values[field.key] = input.value; });
        this.fieldElements[field.key] = { input, datalist };
        container.appendChild(input);
        container.appendChild(datalist);
        return container;
    }

    renderMultilineField(field) {
        const textarea = document.createElement('textarea');
        textarea.rows = 3;
        textarea.value = this.values[field.key] !== undefined ? this.values[field.key] : '';
        textarea.style.cssText = this._inputStyle() + ' resize: vertical; min-height: 56px; font-family: inherit;';
        textarea.addEventListener('input', () => { this.values[field.key] = textarea.value; });
        this.fieldElements[field.key] = { input: textarea };
        return textarea;
    }

    renderTextField(field) {
        const input = document.createElement('input');
        input.type = field.type === 'number' ? 'number' : 'text';
        input.value = this.values[field.key] !== undefined ? this.values[field.key] : (field.default !== undefined ? field.default : '');
        input.style.cssText = this._inputStyle();
        input.addEventListener('input', () => { this.values[field.key] = input.value; });
        this.fieldElements[field.key] = { input };
        return input;
    }

    renderSelectField(field) {
        const select = document.createElement('select');
        select.style.cssText = this._inputStyle();
        for (const option of field.options || []) {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            select.appendChild(opt);
        }
        select.value = this.values[field.key] !== undefined ? this.values[field.key] : (field.default !== undefined ? field.default : (field.options && field.options[0] ? field.options[0].value : ''));
        select.addEventListener('change', () => { this.values[field.key] = select.value; });
        this.fieldElements[field.key] = { input: select };
        return select;
    }

    renderChestIdField(field) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const current = this.values[field.key];
        const autoCheckbox = document.createElement('input');
        autoCheckbox.type = 'checkbox';
        autoCheckbox.id = 'agonia-chest-auto';
        autoCheckbox.checked = current === undefined || current === null || String(current).trim() === '';
        const autoLabel = document.createElement('label');
        autoLabel.htmlFor = 'agonia-chest-auto';
        autoLabel.style.cssText = 'color: var(--color-text); font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer;';
        autoLabel.appendChild(autoCheckbox);
        autoLabel.appendChild(document.createTextNode(field.optionalLabel || 'Auto'));

        const inputRow = document.createElement('div');
        inputRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'storage id, e.g. komod';
        input.value = autoCheckbox.checked ? '' : String(current || '');
        input.style.cssText = this._inputStyle();
        this._applyDisabled(input, autoCheckbox.checked);

        const list = document.createElement('datalist');
        list.id = 'agonia-chest-ids';
        input.setAttribute('list', 'agonia-chest-ids');
        inputRow.appendChild(input);
        inputRow.appendChild(list);

        const hint = document.createElement('div');
        hint.style.cssText = 'color: var(--color-text-dim); font-size: 11px;';
        hint.textContent = 'Known IDs are suggested as you type.';

        autoCheckbox.addEventListener('change', () => {
            this._applyDisabled(input, autoCheckbox.checked);
            if (!autoCheckbox.checked) input.focus();
        });
        input.addEventListener('input', () => {
            this.values[field.key] = input.value;
            if (input.value.trim() !== '') autoCheckbox.checked = false;
        });

        container.appendChild(autoLabel);
        container.appendChild(inputRow);
        container.appendChild(hint);
        this.fieldElements[field.key] = { input, autoCheckbox, datalist: list };
        return container;
    }

    renderItemRefField(field) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const select = document.createElement('select');
        select.style.cssText = this._inputStyle();
        this._populateItemOptions(select, this.values.itemType, this.values[field.key]);
        select.addEventListener('change', () => { this.values[field.key] = Number(select.value); });
        this.fieldElements[field.key] = { input: select, itemTypeKey: 'itemType' };
        container.appendChild(select);

        // Keep the list in sync when the item type dropdown changes.
        const typeField = this.fieldElements.itemType;
        if (typeField && typeField.input) {
            typeField.input.addEventListener('change', () => {
                this._populateItemOptions(select, this.values.itemType, undefined);
                this.values[field.key] = Number(select.value);
            });
        }
        return container;
    }

    _populateItemOptions(select, itemType, selectedId) {
        const items = this._databaseEntries(itemType);
        select.innerHTML = '';
        for (const entry of items) {
            const opt = document.createElement('option');
            opt.value = entry.id;
            opt.textContent = `${entry.id}: ${entry.name || '(unnamed)'}`;
            select.appendChild(opt);
        }
        if (selectedId !== undefined && selectedId !== null && select.querySelector(`option[value="${selectedId}"]`)) {
            select.value = String(selectedId);
        }
    }

    _databaseEntries(itemType) {
        const data = this.databaseManager && this.databaseManager.data;
        if (!data) return [];
        const table = Number(itemType) === 1 ? data.weapons : Number(itemType) === 2 ? data.armors : data.items;
        return Array.isArray(table) ? table.filter(Boolean) : [];
    }

    renderSwitchVariableField(field, kind) {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = kind === 'switch' ? 0 : 1;
        input.value = this.values[field.key] !== undefined && this.values[field.key] !== null
            ? this.values[field.key]
            : (field.default !== undefined ? field.default : (kind === 'switch' ? 0 : 1));
        input.style.cssText = this._inputStyle() + ' flex: 1;';
        input.addEventListener('input', () => { this.values[field.key] = Number(input.value); });
        this.fieldElements[field.key] = { input };

        const browse = document.createElement('button');
        browse.textContent = '...';
        browse.style.cssText = this._buttonStyle(false) + ' min-width: 36px;';
        browse.addEventListener('click', () => {
            if (typeof SwitchVariablePicker === 'undefined') return;
            const picker = new SwitchVariablePicker();
            picker.show(kind, Number(input.value) || 1, (pickedId) => {
                if (pickedId !== undefined && pickedId !== null) {
                    input.value = pickedId;
                    this.values[field.key] = Number(pickedId);
                }
            });
        });

        container.appendChild(input);
        container.appendChild(browse);
        return container;
    }

    /** Hide/show fields whose visibleIf condition excludes the current value. */
    _applyVisibility(field) {
        if (!field.visibleIf) return;
        const wrap = this.fieldWraps[field.key];
        if (!wrap) return;
        const current = this.values[field.visibleIf.field];
        const contains = (field.visibleIf.in || []).some(v => String(v) === String(current));
        const excluded = (field.visibleIf.notIn || []).some(v => String(v) === String(current));
        const visible = field.visibleIf.notIn ? !excluded : contains;
        wrap.style.display = visible ? '' : 'none';
    }

    _applyDisabled(input, disabled) {
        input.disabled = disabled;
        input.style.opacity = disabled ? '0.5' : '1';
    }

    _inputStyle() {
        return `
            padding: 7px 9px; border: 1px solid var(--color-border); border-radius: 4px;
            background-color: var(--color-bg-input); color: var(--color-text-strong);
            font-size: 12px; width: 100%; box-sizing: border-box;
        `;
    }

    refreshSuggestions() {
        const ids = this._scanProjectChestIds();
        const suggestionKinds = this._suggestionDatalists || [];
        for (const key of Object.keys(this.fieldElements)) {
            const field = this.fieldElements[key];
            if (field && field.datalist && !(this._suggestionDatalists || []).some(s => s.datalist === field.datalist)) {
                field.datalist.innerHTML = '';
                for (const id of ids) {
                    const opt = document.createElement('option');
                    opt.value = id;
                    field.datalist.appendChild(opt);
                }
            }
        }
        if (!suggestionKinds.length) return;
        const containers = this._scanProjectDataContainers();
        for (const { datalist, kind } of suggestionKinds) {
            datalist.innerHTML = '';
            let values;
            if (kind === 'faceNames') values = this._scanImageFolder('faces');
            else if (kind === 'pictureNames') values = this._scanImageFolder('pictures');
            else values = AgoniaNativeCommands.collectSuggestions(kind, containers);
            for (const value of values) {
                const opt = document.createElement('option');
                opt.value = value;
                datalist.appendChild(opt);
            }
        }
    }

    _scanImageFolder(sub) {
        const names = [];
        try {
            const projectPath = this.projectController && this.projectController.currentProject
                && this.projectController.currentProject.path;
            if (projectPath && this.fs && this.path) {
                const dir = this.path.join(projectPath, 'img', sub);
                if (this.fs.existsSync(dir)) {
                    for (const file of this.fs.readdirSync(dir)) {
                        if (/\.png$/i.test(file)) names.push(file.replace(/\.png$/i, ''));
                    }
                }
            }
        } catch (e) {
            // Suggestions are best-effort; free text still works.
        }
        return names.sort((a, b) => a.localeCompare(b, 'ru'));
    }

    _scanProjectDataContainers() {
        const containers = [];
        try {
            const projectPath = this.projectController && this.projectController.currentProject && this.projectController.currentProject.path;
            if (projectPath && this.fs && this.path) {
                const dataDir = this.path.join(projectPath, 'data');
                if (this.fs.existsSync(dataDir)) {
                    for (const file of this.fs.readdirSync(dataDir)) {
                        if (!file.endsWith('.json')) continue;
                        try {
                            containers.push(JSON.parse(this.fs.readFileSync(this.path.join(dataDir, file), 'utf8')));
                        } catch (e) { /* skip unreadable */ }
                    }
                }
            }
        } catch (e) {
            // Suggestions are best-effort; free text still works.
        }
        return containers;
    }

    _scanProjectChestIds() {
        if (this.chestIdsCache) return this.chestIdsCache;
        const ids = [];
        try {
            const projectPath = this.projectController && this.projectController.currentProject && this.projectController.currentProject.path;
            if (projectPath && this.fs && this.path) {
                const dataDir = this.path.join(projectPath, 'data');
                if (this.fs.existsSync(dataDir)) {
                    const containers = [];
                    for (const file of this.fs.readdirSync(dataDir)) {
                        if (!file.endsWith('.json')) continue;
                        try {
                            containers.push(JSON.parse(this.fs.readFileSync(this.path.join(dataDir, file), 'utf8')));
                        } catch (e) { /* skip unreadable */ }
                    }
                    ids.push(...AgoniaNativeCommands.collectChestIds(containers));
                }
            }
        } catch (e) {
            // Suggestions are best-effort; free text still works.
        }
        this.chestIdsCache = ids;
        return ids;
    }

    confirm() {
        const parameters = [];
        for (const field of this.schema.fields) {
            const elements = this.fieldElements[field.key];
            const wrap = this.fieldWraps[field.key];
            const hidden = wrap && wrap.style.display === 'none';
            let value = hidden ? field.default : this.values[field.key];
            if (field.type === 'chestId') {
                if (elements && elements.autoCheckbox) {
                    value = elements.autoCheckbox.checked ? '' : String(value || '').trim();
                } else {
                    value = String(value !== undefined ? value : '').trim();
                }
            } else if (field.type === 'select') {
                if (value === undefined || value === null) value = field.default !== undefined ? field.default : 0;
                const num = Number(value);
                if (value !== '' && !Number.isNaN(num)) value = num;
            } else if (field.type === 'itemRef') {
                value = value !== undefined ? Number(value) : (field.default !== undefined ? field.default : 1);
            } else if (field.type === 'switchId') {
                value = value !== undefined && value !== null ? Number(value) : 0;
            } else if (field.type === 'variableId') {
                value = value !== undefined && value !== null ? Number(value) : (field.default !== undefined ? field.default : 1);
            } else if (field.type === 'number') {
                if (field.optional && (value === undefined || value === null || value === '')) {
                    value = '';
                } else {
                    value = Number(value !== undefined && value !== '' ? value : (field.default !== undefined ? field.default : 0));
                    if (field.min !== undefined) value = Math.max(field.min, value);
                    if (field.max !== undefined) value = Math.min(field.max, value);
                }
            } else {
                value = String(value !== undefined ? value : '');
            }
            parameters[field.index] = value;
        }
        this.close({ code: this.schema.code, parameters, indent: 0 });
    }

    close(result) {
        if (this.modal) this.modal.style.display = 'none';
        const callback = this.callback;
        this.callback = null;
        if (callback) callback(result);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NativeCommandDialog;
}
