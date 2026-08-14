/**
 * DatabaseAgoniaEditor - Editor for the Agonia Engine settings sidecar
 * (data/AgoniaEngine.json). Currently exposes the Stamina section; future
 * engine subsystems (lighting presets, etc.) get their blocks here too.
 *
 * Values are written straight into databaseManager.data.agonia; the shared
 * OK/Apply flow persists them through DatabaseManager.saveAgonia.
 */
class DatabaseAgoniaEditor {
    static get STAMINA_NUMBER_FIELDS() {
        return [
            { key: 'Max Stamina', text: 'Max Stamina', min: 1, step: 1 },
            { key: 'Dash Speed Level', text: 'Dash Speed Level', min: 1, max: 6, step: 0.01 },
            { key: 'Horizontal Mult', text: 'Horizontal Mult', step: 0.01 },
            { key: 'Vertical Mult', text: 'Vertical Mult', step: 0.01 },
            { key: 'Diagonal Mult', text: 'Diagonal Mult', step: 0.01 },
            { key: 'Drain Per Frame', text: 'Drain Per Frame', step: 0.01 },
            { key: 'Recover Per Frame', text: 'Recover Per Frame', step: 0.01 }
        ];
    }

    static get STAMINA_REFERENCE_FIELDS() {
        return [
            { key: 'Max Stamina Variable ID', text: 'Max Stamina Variable ID', kind: 'variable' },
            { key: 'Regen Variable ID', text: 'Regen Variable ID', kind: 'variable' },
            { key: 'Stamina Display Variable ID', text: 'Stamina Display Variable ID', kind: 'variable' },
            { key: 'Dash Control Switch ID', text: 'Dash Control Switch ID', kind: 'switch' }
        ];
    }

    constructor(databaseManager, projectManager, commonUI, parentEditor) {
        this.databaseManager = databaseManager;
        this.projectManager = projectManager;
        this.commonUI = commonUI;
        this.parentEditor = parentEditor;
    }

    _tt(text) {
        return typeof window !== 'undefined' && window.I18n ? window.I18n.tText(text) : text;
    }

    getAgonia() {
        const data = this.databaseManager.data;
        if (!data.agonia) data.agonia = DatabaseManager.agoniaDefaults();
        if (!data.agonia.stamina) data.agonia.stamina = DatabaseManager.agoniaDefaults().stamina;
        return data.agonia;
    }

    showAgoniaDetail(container) {
        const agonia = this.getAgonia();

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow-y:auto;';

        const banner = document.createElement('div');
        banner.style.cssText = `
            background-color: var(--color-bg-deep);
            padding: 14px 20px;
            border-bottom: 2px solid var(--color-accent-border-mid);
            font-size: 20px; font-weight: 600;
            color: var(--color-text-strong);
        `;
        banner.textContent = this._tt('Agonia Engine');
        wrapper.appendChild(banner);

        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            padding: 16px;
            flex: 1;
            align-content: start;
        `;

        grid.appendChild(this.createStaminaColumn(agonia.stamina));
        grid.appendChild(this.createReferenceColumn(agonia.stamina));
        grid.appendChild(this.createBlockingColumn(agonia.stamina));

        wrapper.appendChild(grid);
        container.appendChild(wrapper);
    }

    _column(title) {
        const column = document.createElement('div');
        column.style.cssText = `
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border);
            border-radius: 6px;
            padding: 12px;
            display: flex; flex-direction: column; gap: 10px;
        `;
        const header = document.createElement('div');
        header.style.cssText = 'font-weight: 600; font-size: 13px; color: var(--color-text-strong);';
        header.textContent = title;
        column.appendChild(header);
        return column;
    }

    _fieldRow(labelText) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        const label = document.createElement('label');
        label.style.cssText = 'font-size: 11px; color: var(--color-text);';
        label.textContent = labelText;
        row.appendChild(label);
        return row;
    }

    _numberInput(value, min, max, step) {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        if (min !== undefined) input.min = min;
        if (max !== undefined) input.max = max;
        input.step = step !== undefined ? step : 1;
        input.style.cssText = `
            width: 100%; padding: 6px 8px; box-sizing: border-box;
            background-color: var(--color-bg-input);
            border: 1px solid var(--color-border-input);
            border-radius: 4px;
            color: var(--color-text-strong); font-size: 12px;
        `;
        return input;
    }

    createStaminaColumn(stamina) {
        const column = this._column(this._tt('Stamina & Dash'));
        for (const field of DatabaseAgoniaEditor.STAMINA_NUMBER_FIELDS) {
            const row = this._fieldRow(this._tt(field.text));
            const input = this._numberInput(stamina[field.key], field.min, field.max, field.step);
            input.addEventListener('input', () => {
                const value = Number(input.value);
                if (!Number.isNaN(value)) stamina[field.key] = value;
            });
            row.appendChild(input);
            column.appendChild(row);
        }
        return column;
    }

    createReferenceColumn(stamina) {
        const column = this._column(this._tt('Variables & Switches'));
        for (const field of DatabaseAgoniaEditor.STAMINA_REFERENCE_FIELDS) {
            const row = this._fieldRow(this._tt(field.text));
            const rowLine = document.createElement('div');
            rowLine.style.cssText = 'display: flex; gap: 6px;';
            const input = this._numberInput(stamina[field.key], 0, undefined, 1);
            input.addEventListener('input', () => {
                const value = Number(input.value);
                if (!Number.isNaN(value)) stamina[field.key] = value;
            });
            const browse = document.createElement('button');
            browse.textContent = '...';
            browse.style.cssText = `
                min-width: 34px; padding: 6px 8px;
                background-color: var(--color-bg-input-alt);
                color: var(--color-text-strong);
                border: 1px solid var(--color-border-input);
                border-radius: 4px; cursor: pointer; font-size: 12px;
            `;
            browse.addEventListener('click', () => {
                if (typeof SwitchVariablePicker === 'undefined') return;
                const picker = new SwitchVariablePicker();
                picker.show(field.kind, Number(input.value) || 1, (pickedId) => {
                    if (pickedId !== undefined && pickedId !== null) {
                        input.value = pickedId;
                        stamina[field.key] = Number(pickedId);
                    }
                });
            });
            rowLine.appendChild(input);
            rowLine.appendChild(browse);
            row.appendChild(rowLine);
            column.appendChild(row);
        }
        return column;
    }

    createBlockingColumn(stamina) {
        const column = this._column(this._tt('Dash Blocking Switches'));
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size: 11px; color: var(--color-text-dim); line-height: 1.5;';
        hint.textContent = this._tt('Dashing is blocked while any of these switches is ON. Comma-separated switch IDs.');
        column.appendChild(hint);

        const list = Array.isArray(stamina['Dash Blocking Switches'])
            ? stamina['Dash Blocking Switches'] : [];
        const input = document.createElement('input');
        input.type = 'text';
        input.value = list.join(', ');
        input.placeholder = 'e.g. 21, 34';
        input.style.cssText = `
            width: 100%; padding: 6px 8px; box-sizing: border-box;
            background-color: var(--color-bg-input);
            border: 1px solid var(--color-border-input);
            border-radius: 4px;
            color: var(--color-text-strong); font-size: 12px;
        `;
        input.addEventListener('input', () => {
            stamina['Dash Blocking Switches'] = input.value
                .split(',')
                .map(part => Number(part.trim()))
                .filter(n => !Number.isNaN(n) && n > 0);
        });
        column.appendChild(input);
        return column;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseAgoniaEditor;
}
