/**
 * DatabaseAgoniaEditor - Editor for the Agonia Engine settings sidecar
 * (data/AgoniaEngine.json). Sections: Stamina & Dash, Lighting. Future engine
 * subsystems get their blocks here too.
 *
 * Values are written straight into databaseManager.data.agonia; the shared
 * OK/Apply flow persists them through DatabaseManager.saveAgonia.
 */
class DatabaseAgoniaEditor {
    /** Data-driven section layout. field types: number, color, bool, switchId */
    static get SECTIONS() {
        return {
            stamina: {
                title: 'Stamina & Dash',
                columns: [
                    {
                        title: 'Stamina & Dash',
                        fields: [
                            { key: 'Max Stamina', type: 'number', min: 1, step: 1 },
                            { key: 'Dash Speed Level', type: 'number', min: 1, max: 6, step: 0.01 },
                            { key: 'Horizontal Mult', type: 'number', step: 0.01 },
                            { key: 'Vertical Mult', type: 'number', step: 0.01 },
                            { key: 'Diagonal Mult', type: 'number', step: 0.01 },
                            { key: 'Drain Per Frame', type: 'number', step: 0.01 },
                            { key: 'Recover Per Frame', type: 'number', step: 0.01 }
                        ]
                    },
                    {
                        title: 'Variables & Switches',
                        fields: [
                            { key: 'Max Stamina Variable ID', type: 'variableId' },
                            { key: 'Regen Variable ID', type: 'variableId' },
                            { key: 'Stamina Display Variable ID', type: 'variableId' },
                            { key: 'Dash Control Switch ID', type: 'switchId' }
                        ]
                    },
                    {
                        title: 'Dash Blocking Switches',
                        fields: [
                            { key: 'Dash Blocking Switches', type: 'idList' }
                        ]
                    }
                ]
            },
            lighting: {
                title: 'Lighting',
                columns: [
                    {
                        title: 'Player Light',
                        fields: [
                            { key: 'Player radius', type: 'number', min: 0, step: 1 },
                            { key: 'Default Tint', type: 'color' },
                            { key: 'Player Light Influence', type: 'number', step: 0.01 },
                            { key: 'Breathing Speed', type: 'number', step: 0.01 }
                        ]
                    },
                    {
                        title: 'Vignette',
                        fields: [
                            { key: 'Vignette Color', type: 'color' },
                            { key: 'Vignette Scale', type: 'number', step: 0.01 },
                            { key: 'Vignette Sharpness', type: 'number', step: 0.01 },
                            { key: 'Vignette Disable Switch', type: 'switchId' }
                        ]
                    },
                    {
                        title: 'Shadows & Map Switches',
                        fields: [
                            { key: 'Use Real Shadows', type: 'bool' },
                            { key: 'MapSwitch Base', type: 'number', min: 0, step: 1 },
                            { key: 'MapSwitch Stride', type: 'number', min: 0, step: 1 },
                            { key: 'Wall Softness', type: 'number', step: 0.01 }
                        ]
                    }
                ]
            },
            screen: {
                title: 'Screen',
                columns: [
                    {
                        title: 'Resolution',
                        fields: [
                            { key: 'Screen Width', type: 'number', min: 320, step: 1 },
                            { key: 'Screen Height', type: 'number', min: 240, step: 1 },
                            { key: 'Fullscreen', type: 'bool' },
                            { key: 'Window Title', type: 'string' },
                            { key: 'Enabled on Startup', type: 'bool' }
                        ]
                    },
                    {
                        title: 'CRT Effect',
                        fields: [
                            { key: 'Overall Intensity', type: 'number', step: 0.01 },
                            { key: 'Blur Radius', type: 'number', step: 0.01 },
                            { key: 'Sharpening', type: 'number', step: 0.01 },
                            { key: 'Bloom Intensity', type: 'number', step: 0.01 },
                            { key: 'Bloom Threshold', type: 'number', step: 0.01 },
                            { key: 'Color Temperature', type: 'number', step: 0.01 }
                        ]
                    },
                    {
                        title: 'Color & Distortion',
                        fields: [
                            { key: 'Saturation', type: 'number', step: 0.01 },
                            { key: 'Contrast', type: 'number', step: 0.01 },
                            { key: 'Brightness', type: 'number', step: 0.01 },
                            { key: 'Wave Intensity', type: 'number', step: 0.01 },
                            { key: 'Chroma Intensity', type: 'number', step: 0.01 },
                            { key: 'Scanline Intensity', type: 'number', step: 0.01 },
                            { key: 'Noise Intensity', type: 'number', step: 0.01 }
                        ]
                    }
                ]
            },
            camera: {
                title: 'Camera',
                columns: [
                    {
                        title: 'Zoom',
                        fields: [
                            { key: 'Зум по умолчанию', type: 'number', min: 0.1, max: 8, step: 0.05 },
                            { key: 'Зумить картинки', type: 'bool' },
                            { key: 'Свитч отключения', type: 'switchId' }
                        ]
                    },
                    {
                        title: 'Плавность камеры',
                        fields: [
                            { key: 'Инерция', type: 'number', step: 0.01 },
                            { key: 'Сила предсказания', type: 'number', step: 0.01 },
                            { key: 'Макс. скорость', type: 'number', step: 0.01 },
                            { key: 'Ускорение камеры', type: 'number', step: 0.01 },
                            { key: 'Инерция скорости', type: 'number', step: 0.01 },
                            { key: 'Свитч откл. сглаживания', type: 'switchId' }
                        ]
                    },
                    {
                        title: 'Барьеры (регионы)',
                        fields: [
                            { key: 'Включить барьеры', type: 'bool' },
                            { key: 'Активные регионы', type: 'number', min: 1, step: 1 },
                            { key: 'Регионы слева', type: 'number', min: 1, step: 1 },
                            { key: 'Регионы справа', type: 'number', min: 1, step: 1 },
                            { key: 'Регионы сверху', type: 'number', min: 1, step: 1 },
                            { key: 'Регионы снизу', type: 'number', min: 1, step: 1 },
                            { key: 'Хард-точки по краям', type: 'bool' }
                        ]
                    },
                    {
                        title: 'Прицеливание',
                        fields: [
                            { key: 'Свитч прицеливания', type: 'switchId' },
                            { key: 'Поворот за курсором', type: 'bool' },
                            { key: 'Скорость прицеливания', type: 'number', step: 0.1 },
                            { key: 'Макс. сдвиг камеры', type: 'number', step: 1 },
                            { key: 'Плавность прицела', type: 'number', step: 0.01 },
                            { key: 'Возврат в центр', type: 'number', step: 1 },
                            { key: 'Обычный курсор', type: 'string' },
                            { key: 'Курсор прицела', type: 'string' },
                            { key: 'Общее событие', type: 'number', min: 0, step: 1 }
                        ]
                    },
                    {
                        title: 'Рамка камеры',
                        fields: [
                            { key: 'Ширина рамки', type: 'number', step: 1 },
                            { key: 'Высота рамки', type: 'number', step: 1 }
                        ]
                    }
                ]
            },
            inventory: {
                title: 'Inventory',
                columns: [
                    {
                        title: 'Controls',
                        fields: [
                            { key: 'Open Trigger', type: 'string' },
                            { key: 'Use Key', type: 'string' },
                            { key: 'Custom Key Code', type: 'number', min: 0, step: 1 },
                            { key: 'Disable Standard Menu', type: 'bool' },
                            { key: 'RMB Variable ID', type: 'variableId' }
                        ]
                    },
                    {
                        title: 'Slots & Hotbar',
                        fields: [
                            { key: 'Hotbar Watch Var', type: 'variableId' },
                            { key: 'Free Slots Variable', type: 'variableId' },
                            { key: 'Max Slots Variable', type: 'variableId' },
                            { key: 'Default Max Slots', type: 'number', min: 1, step: 1 },
                            { key: 'Drag Threshold', type: 'number', min: 1, step: 1 },
                            { key: 'Global Volume', type: 'number', min: 0, max: 100, step: 1 }
                        ]
                    }
                ]
            }
        };
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
        const defaults = DatabaseManager.agoniaDefaults();
        for (const section of Object.keys(DatabaseAgoniaEditor.SECTIONS)) {
            if (!data.agonia[section]) data.agonia[section] = defaults[section];
        }
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

        for (const sectionKey of Object.keys(DatabaseAgoniaEditor.SECTIONS)) {
            const section = DatabaseAgoniaEditor.SECTIONS[sectionKey];
            const values = agonia[sectionKey] || {};

            const header = document.createElement('div');
            header.style.cssText = `
                padding: 12px 16px 4px;
                font-size: 15px; font-weight: 600;
                color: var(--color-text-strong);
            `;
            header.textContent = this._tt(section.title);
            wrapper.appendChild(header);

            const grid = document.createElement('div');
            grid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(${Math.min(3, section.columns.length)}, 1fr);
                gap: 16px;
                padding: 8px 16px 4px;
            `;
            for (const column of section.columns) {
                grid.appendChild(this.createColumn(column, values));
            }
            wrapper.appendChild(grid);
        }

        container.appendChild(wrapper);
    }

    createColumn(column, values) {
        const columnEl = document.createElement('div');
        columnEl.style.cssText = `
            background-color: var(--color-bg-panel);
            border: 1px solid var(--color-border);
            border-radius: 6px;
            padding: 12px;
            display: flex; flex-direction: column; gap: 10px;
        `;
        const header = document.createElement('div');
        header.style.cssText = 'font-weight: 600; font-size: 13px; color: var(--color-text-strong);';
        header.textContent = this._tt(column.title);
        columnEl.appendChild(header);

        if (column.fields.some(f => f.type === 'idList')) {
            const field = column.fields[0];
            const hint = document.createElement('div');
            hint.style.cssText = 'font-size: 11px; color: var(--color-text-dim); line-height: 1.5;';
            hint.textContent = this._tt('Dashing is blocked while any of these switches is ON. Comma-separated switch IDs.');
            columnEl.appendChild(hint);
            columnEl.appendChild(this.createField(column.fields[0], values));
            return columnEl;
        }

        for (const field of column.fields) {
            columnEl.appendChild(this.createField(field, values));
        }
        return columnEl;
    }

    createField(field, values) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        const label = document.createElement('label');
        label.style.cssText = 'font-size: 11px; color: var(--color-text);';
        label.textContent = this._tt(field.key);
        row.appendChild(label);

        if (field.type === 'number' || field.type === 'variableId' || field.type === 'switchId') {
            const input = this.createNumberInput(values[field.key], field.type === 'variableId' || field.type === 'switchId' ? 0 : field.min, field.step || 1);
            input.addEventListener('input', () => {
                const value = Number(input.value);
                if (!Number.isNaN(value)) values[field.key] = value;
            });
            if (field.type === 'variableId' || field.type === 'switchId') {
                const line = document.createElement('div');
                line.style.cssText = 'display:flex;gap:6px;';
                line.appendChild(input);
                line.appendChild(this.createBrowseButton(field.type, input, values));
                row.appendChild(line);
                return row;
            }
            row.appendChild(input);
        } else if (field.type === 'color') {
            const line = document.createElement('div');
            line.style.cssText = 'display:flex;gap:6px;align-items:center;';
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.value = this.normalizeHex(values[field.key]);
            picker.style.cssText = `
                width: 36px; height: 26px; padding: 0; border: 1px solid var(--color-border-input);
                border-radius: 4px; background: none; cursor: pointer;
            `;
            const hex = document.createElement('input');
            hex.type = 'text';
            hex.value = String(values[field.key] || '');
            hex.style.cssText = this.inputStyle();
            picker.addEventListener('input', () => {
                hex.value = picker.value;
                values[field.key] = picker.value;
            });
            hex.addEventListener('input', () => {
                values[field.key] = hex.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(hex.value.trim())) picker.value = hex.value.trim();
            });
            line.appendChild(picker);
            line.appendChild(hex);
            row.appendChild(line);
        } else if (field.type === 'bool') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!values[field.key];
            checkbox.style.cssText = 'width: 16px; height: 16px; cursor: pointer;';
            checkbox.addEventListener('change', () => { values[field.key] = checkbox.checked; });
            row.appendChild(checkbox);
        } else if (field.type === 'idList') {
            const list = Array.isArray(values[field.key]) ? values[field.key] : [];
            const input = document.createElement('input');
            input.type = 'text';
            input.value = list.join(', ');
            input.placeholder = 'e.g. 21, 34';
            input.style.cssText = this.inputStyle();
            input.addEventListener('input', () => {
                values[field.key] = input.value
                    .split(',')
                    .map(part => Number(part.trim()))
                    .filter(n => !Number.isNaN(n) && n > 0);
            });
            row.appendChild(input);
        } else if (field.type === 'string') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = values[field.key] === undefined || values[field.key] === null
                ? '' : String(values[field.key]);
            input.style.cssText = this.inputStyle();
            input.addEventListener('input', () => { values[field.key] = input.value; });
            row.appendChild(input);
        }
        return row;
    }

    createNumberInput(value, min, step) {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        if (min !== undefined) input.min = min;
        input.step = step !== undefined ? step : 1;
        input.style.cssText = this.inputStyle();
        return input;
    }

    createBrowseButton(kind, input, values) {
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
            const kindName = kind === 'switchId' ? 'switch' : 'variable';
            picker.show(kindName, Number(input.value) || 1, (pickedId) => {
                if (pickedId !== undefined && pickedId !== null) {
                    input.value = pickedId;
                    // The bound input listener writes the value; trigger it.
                    input.dispatchEvent(new Event('input'));
                }
            });
        });
        return browse;
    }

    normalizeHex(value) {
        const text = String(value || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(text) ? text : '#000000';
    }

    inputStyle() {
        return `
            width: 100%; padding: 6px 8px; box-sizing: border-box;
            background-color: var(--color-bg-input);
            border: 1px solid var(--color-border-input);
            border-radius: 4px;
            color: var(--color-text-strong); font-size: 12px;
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseAgoniaEditor;
}
