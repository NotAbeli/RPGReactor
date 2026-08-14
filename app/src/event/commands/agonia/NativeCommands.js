/**
 * AgoniaNativeCommands - Registry of engine-native event commands (codes 700+).
 *
 * Each entry describes one built-in command: how it appears in the command
 * picker, how its parameters are edited, and how the command list summarizes
 * it. The runtime counterparts (Game_Interpreter.command<code>) live in
 * app/runtime/reactor_objects.js.
 *
 * field types:
 *   string   - plain text input
 *   number   - numeric input (min/max)
 *   select   - dropdown over options
 *   chestId  - chest storage ID: auto/none toggle + text with suggestions
 */
class AgoniaNativeCommands {
    static get VERSION() {
        return 1;
    }

    static get COMMANDS() {
        return [
            {
                code: 715,
                id: 'openChestStored',
                name: 'Open Chest (Stored)',
                section: 'Inventory',
                help: 'Opens the visual chest window. Items stored under the chest ID persist across maps. Leave empty for a unique per-event chest.',
                fields: [
                    {
                        key: 'chestId',
                        index: 0,
                        type: 'chestId',
                        label: 'Chest ID',
                        optional: true,
                        optionalLabel: 'Auto (unique for this event)',
                        suggestions: true
                    }
                ]
            },
            {
                code: 716,
                id: 'addItemToChest',
                name: 'Add Item to Chest',
                section: 'Inventory',
                help: 'Puts items into the chest storage. Optional switch turns ON when the chest ran out of space.',
                fields: [
                    { key: 'chestId', index: 0, type: 'chestId', label: 'Chest ID', suggestions: true },
                    { key: 'itemType', index: 1, type: 'select', label: 'Item Type', default: 0, options: [
                        { value: 0, label: 'Item' },
                        { value: 1, label: 'Weapon' },
                        { value: 2, label: 'Armor' }
                    ] },
                    { key: 'itemId', index: 2, type: 'itemRef', label: 'Item', default: 1 },
                    { key: 'amount', index: 3, type: 'number', label: 'Amount', default: 1, min: 1, max: 99 },
                    { key: 'fullSwitchId', index: 4, type: 'switchId', label: 'Full Switch', optional: true, optionalLabel: 'No switch' }
                ]
            },
            {
                code: 717,
                id: 'removeItemFromChest',
                name: 'Remove Item from Chest',
                section: 'Inventory',
                help: 'Takes items out of the chest storage. Items are either destroyed or moved to the party inventory.',
                fields: [
                    { key: 'chestId', index: 0, type: 'chestId', label: 'Chest ID', suggestions: true },
                    { key: 'itemType', index: 1, type: 'select', label: 'Item Type', default: 0, options: [
                        { value: 0, label: 'Item' },
                        { value: 1, label: 'Weapon' },
                        { value: 2, label: 'Armor' }
                    ] },
                    { key: 'itemId', index: 2, type: 'itemRef', label: 'Item', default: 1 },
                    { key: 'amount', index: 3, type: 'number', label: 'Amount', default: 1, min: 1, max: 99 },
                    { key: 'toInventory', index: 4, type: 'select', label: 'Destination', default: 0, options: [
                        { value: 0, label: 'Destroy' },
                        { value: 1, label: 'Move to party inventory' }
                    ] }
                ]
            },
            {
                code: 718,
                id: 'clearChest',
                name: 'Clear Chest',
                section: 'Inventory',
                help: 'Empties every slot of the chest storage.',
                fields: [
                    { key: 'chestId', index: 0, type: 'chestId', label: 'Chest ID', suggestions: true }
                ]
            },
            {
                code: 719,
                id: 'checkChest',
                name: 'Check Chest',
                section: 'Inventory',
                help: 'Reads chest contents into a game variable: total item amount, empty flag (1/0), used stacks, or the amount / presence of a specific item. Compare the variable with a Conditional Branch (>=, <=, ==, >, <).',
                fields: [
                    { key: 'chestId', index: 0, type: 'chestId', label: 'Chest ID', suggestions: true },
                    { key: 'variableId', index: 1, type: 'variableId', label: 'Variable', default: 1 },
                    { key: 'mode', index: 2, type: 'select', label: 'Mode', default: 0, options: [
                        { value: 0, label: 'Total item amount' },
                        { value: 1, label: 'Is empty (1/0)' },
                        { value: 2, label: 'Used slots' },
                        { value: 3, label: 'Amount of item' },
                        { value: 4, label: 'Has item (1/0)' }
                    ] },
                    { key: 'itemType', index: 3, type: 'select', label: 'Item Type', default: 0, visibleIf: { field: 'mode', in: [3, 4] }, options: [
                        { value: 0, label: 'Item' },
                        { value: 1, label: 'Weapon' },
                        { value: 2, label: 'Armor' }
                    ] },
                    { key: 'itemId', index: 4, type: 'itemRef', label: 'Item', default: 1, visibleIf: { field: 'mode', in: [3, 4] } }
                ]
            },
            {
                code: 725,
                id: 'staminaControl',
                name: 'Stamina',
                section: 'Movement',
                help: 'Changes the player stamina: add an amount (negative allowed), fully restore, or fully exhaust.',
                fields: [
                    { key: 'operation', index: 0, type: 'select', label: 'Operation', default: 0, options: [
                        { value: 0, label: 'Add amount' },
                        { value: 1, label: 'Fill' },
                        { value: 2, label: 'Exhaust' }
                    ] },
                    { key: 'amount', index: 1, type: 'number', label: 'Amount', default: 0, visibleIf: { field: 'operation', in: [0] } }
                ]
            },
            {
                code: 726,
                id: 'dash',
                name: 'Dash',
                section: 'Movement',
                help: 'Performs a named dash for a character. Dash names are defined by the movement add-on.',
                fields: [
                    { key: 'target', index: 0, type: 'select', label: 'Target', default: 0, options: [
                        { value: 0, label: 'This Event' },
                        { value: 1, label: 'Player' },
                        { value: 2, label: 'Event by ID' }
                    ] },
                    { key: 'eventId', index: 1, type: 'number', label: 'Event ID', default: 1, min: 1, visibleIf: { field: 'target', in: [2] } },
                    { key: 'dashName', index: 2, type: 'suggestion', label: 'Dash Name', suggestions: 'dashNames' }
                ]
            },
            {
                code: 730,
                id: 'waitAsync',
                name: 'Wait Async',
                section: 'Utility',
                help: 'Waits the given number of frames while the rest of the game keeps running.',
                fields: [
                    { key: 'frames', index: 0, type: 'number', label: 'Frames', default: 60, min: 0 }
                ]
            },
            {
                code: 731,
                id: 'damageFlash',
                name: 'Damage Flash',
                section: 'Utility',
                help: 'Flashes a character red as if it took damage.',
                fields: [
                    { key: 'target', index: 0, type: 'select', label: 'Target', default: 0, options: [
                        { value: 0, label: 'This Event' },
                        { value: 1, label: 'Player' },
                        { value: 2, label: 'Event by ID' }
                    ] },
                    { key: 'eventId', index: 1, type: 'number', label: 'Event ID', default: 1, min: 1, visibleIf: { field: 'target', in: [2] } },
                    { key: 'frames', index: 2, type: 'number', label: 'Frames', default: 0, min: 0, optionalLabel: 'Default duration', visibleIf: { field: 'target', in: [0] } }
                ]
            },
            {
                code: 732,
                id: 'saveToSamsara',
                name: 'Save to Samsara',
                section: 'Utility',
                help: 'Writes a snapshot checkpoint (Samsara) of the current game state.',
                fields: []
            },
            {
                code: 733,
                id: 'loadFromSamsara',
                name: 'Load from Samsara',
                section: 'Utility',
                help: 'Restores the latest Samsara checkpoint.',
                fields: []
            },
            {
                code: 734,
                id: 'openCraft',
                name: 'Open Craft',
                section: 'Inventory',
                help: 'Opens the crafting window.',
                fields: []
            },
            {
                code: 735,
                id: 'showHint',
                name: 'Show Hint',
                section: 'Message',
                help: 'Shows a hint popup with the given preset style.',
                fields: [
                    { key: 'preset', index: 0, type: 'suggestion', label: 'Preset', suggestions: 'hintPresets' },
                    { key: 'text', index: 1, type: 'multiline', label: 'Text', default: '' }
                ]
            },
            {
                code: 736,
                id: 'textMark',
                name: 'Text Mark',
                section: 'Message',
                help: 'Marks the current message position for the message system (flow control).',
                fields: [
                    { key: 'markId', index: 0, type: 'suggestion', label: 'Mark ID', suggestions: 'markIds' }
                ]
            },
            {
                code: 737,
                id: 'showTitle',
                name: 'Show Title',
                section: 'Message',
                help: 'Shows a large title card with the given preset style.',
                fields: [
                    { key: 'preset', index: 0, type: 'suggestion', label: 'Preset', suggestions: 'hintPresets' },
                    { key: 'text', index: 1, type: 'suggestion', label: 'Text', suggestions: 'titleTexts' }
                ]
            }
        ];
    }

    static byCode(code) {
        return this.COMMANDS.find(command => command.code === code) || null;
    }

    /**
     * Picker-shaped structure for the "Agonia Engine" tab:
     * { name: '<Section>', commands: [{ name, code }] }
     */
    static pickerSections() {
        const sections = [];
        for (const command of this.COMMANDS) {
            let section = sections.find(s => s.title === command.section);
            if (!section) {
                section = { title: command.section, commands: [] };
                sections.push(section);
            }
            section.commands.push({ name: command.name, code: command.code });
        }
        return sections;
    }

    /**
     * Collect known chest IDs from project data for editor suggestions.
     * Scans event command lists for code 715 parameters and legacy
     * "VisualChestStored <id>" plugin command strings (code 356).
     * Pure function over parsed JSON data — usable from tests.
     */
    static collectChestIds(dataContainers) {
        const ids = new Set();
        const visit = (value) => {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (Array.isArray(value.list)) {
                for (const command of value.list) {
                    this._collectChestIdFromCommand(command, ids);
                }
            }
            Object.values(value).forEach(v => { if (v && typeof v === 'object') visit(v); });
        };
        dataContainers.forEach(visit);
        return [...ids].sort((a, b) => a.localeCompare(b, 'ru'));
    }

    static _collectChestIdFromCommand(command, ids) {
        if (!command || typeof command.code !== 'number') return;
        if (command.code === 715) {
            const id = String((command.parameters || [])[0] || '').trim();
            if (id) ids.add(id);
        } else if (command.code === 356 || command.code === 357) {
            const text = String((command.parameters || [])[0] || '');
            const match = /^VisualChestStored\s+(.+)$/i.exec(text.trim());
            if (match) ids.add(match[1].trim());
        }
    }

    /**
     * Collect known values for suggestion fields. kinds:
     *   dashNames  - dash names (native 726 + legacy AltimitDash 356)
     *   markIds    - text marks (native 736 + legacy mark(...) 356)
     *   hintPresets - hint presets (native 735 + legacy Hint show_preset 356)
     */
    static collectSuggestions(kind, dataContainers) {
        const values = new Set();
        const visit = (value) => {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            if (Array.isArray(value.list)) {
                for (const command of value.list) {
                    this._collectSuggestionFromCommand(kind, command, values);
                }
            }
            Object.values(value).forEach(v => { if (v && typeof v === 'object') visit(v); });
        };
        dataContainers.forEach(visit);
        return [...values].sort((a, b) => a.localeCompare(b, 'ru'));
    }

    static _collectSuggestionFromCommand(kind, command, values) {
        if (!command || typeof command.code !== 'number') return;
        const params = command.parameters || [];
        if (kind === 'dashNames') {
            if (command.code === 726) {
                const name = String(params[2] || '').trim();
                if (name) values.add(name);
            } else if (command.code === 356) {
                const match = /^AltimitDash\s+(?:playerDash|eventDash|\d+\s+)?(?:dash\s+)?(.+)$/i.exec(String(params[0] || '').trim());
                if (match) {
                    const name = match[1].trim();
                    if (name && !/^\d+$/.test(name)) values.add(name);
                }
            }
        } else if (kind === 'markIds') {
            if (command.code === 736) {
                const id = String(params[0] || '').trim();
                if (id) values.add(id);
            } else if (command.code === 356) {
                const match = /^mark\((.+)\)$/i.exec(String(params[0] || '').trim());
                if (match) values.add(match[1].trim());
            }
        } else if (kind === 'hintPresets') {
            if (command.code === 735 || command.code === 737) {
                const preset = String(params[0] || '').trim();
                if (preset) values.add(preset);
            } else if (command.code === 356) {
                const match = /^(?:Hint\s+show_preset(?:_icon)?|Title\s+show)\s+(\S+)/i.exec(String(params[0] || '').trim());
                if (match) values.add(match[1]);
            }
        } else if (kind === 'titleTexts') {
            if (command.code === 737) {
                const text = String(params[1] || '').trim();
                if (text) values.add(text);
            } else if (command.code === 356) {
                const match = /^Title\s+show\s+\S+\s+(.+)$/i.exec(String(params[0] || '').trim());
                if (match) values.add(match[1]);
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgoniaNativeCommands;
}
