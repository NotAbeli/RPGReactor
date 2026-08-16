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
                help: 'Shows, hides or clears hint popups.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Mode', default: 0, options: [
                        { value: 0, label: 'Show' },
                        { value: 1, label: 'Hide' },
                        { value: 2, label: 'Clear' }
                    ] },
                    { key: 'preset', index: 1, type: 'suggestion', label: 'Preset', suggestions: 'hintPresets', visibleIf: { field: 'mode', in: [0] } },
                    { key: 'text', index: 2, type: 'multiline', label: 'Text', default: '', visibleIf: { field: 'mode', in: [0] } },
                    { key: 'iconId', index: 3, type: 'number', label: 'Icon Index', default: '', min: 0, optional: true, optionalLabel: 'No icon', visibleIf: { field: 'mode', in: [0] } }
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
            },
            {
                code: 700,
                id: 'playerLight',
                name: 'Player Light',
                section: 'Lighting',
                help: 'Sets the player light: radius, growth animation, color and falloff preset. Fire type adds flicker. Radius 0 extinguishes.',
                fields: [
                    { key: 'type', index: 0, type: 'select', label: 'Type', default: 0, options: [
                        { value: 0, label: 'Normal' },
                        { value: 1, label: 'Fire (flicker)' }
                    ] },
                    { key: 'radius', index: 1, type: 'number', label: 'Radius', default: 0, min: 0, max: 999 },
                    { key: 'mode', index: 2, type: 'select', label: 'Animation', default: 0, options: [
                        { value: 0, label: 'Instant' },
                        { value: 1, label: 'Grow' }
                    ] },
                    { key: 'duration', index: 3, type: 'number', label: 'Duration (frames)', default: 0, min: 0, optionalLabel: 'Plugin default', visibleIf: { field: 'mode', in: [1] } },
                    { key: 'color', index: 4, type: 'color', label: 'Color', default: '' },
                    { key: 'preset', index: 5, type: 'suggestion', label: 'Falloff Preset', suggestions: 'lightPresets' },
                    { key: 'vignetteMult', index: 6, type: 'number', label: 'Vignette Multiplier', default: '', min: 0, step: 0.01, optional: true, optionalLabel: 'Not set' }
                ]
            },
            {
                code: 701,
                id: 'eventLight',
                name: 'Event Light',
                section: 'Lighting',
                help: 'Turns a map event light source (custom ID) on or off. Player target toggles the player light.',
                fields: [
                    { key: 'state', index: 0, type: 'select', label: 'State', default: 1, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' }
                    ] },
                    { key: 'lightId', index: 1, type: 'number', label: 'Light ID', default: 1, min: 1, visibleIf: { field: 'target', in: [0] } },
                    { key: 'target', index: 2, type: 'select', label: 'Target', default: 0, options: [
                        { value: 0, label: 'Event light' },
                        { value: 1, label: 'Player' }
                    ] }
                ]
            },
            {
                code: 705,
                id: 'lightSetting',
                name: 'Light Setting',
                section: 'Lighting',
                help: 'Changes the player light color, brightness, smoothness or falloff preset.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Setting', default: 0, options: [
                        { value: 0, label: 'Color' },
                        { value: 1, label: 'Brightness' },
                        { value: 2, label: 'Smoothness' },
                        { value: 3, label: 'Falloff Preset' }
                    ] },
                    { key: 'color', index: 1, type: 'color', label: 'Color', default: '#ffffff', visibleIf: { field: 'mode', in: [0] } },
                    { key: 'value', index: 1, type: 'number', label: 'Value', default: 1, min: 0, step: 0.01, visibleIf: { field: 'mode', in: [1, 2] } },
                    { key: 'preset', index: 1, type: 'suggestion', label: 'Falloff Preset', suggestions: 'lightPresets', visibleIf: { field: 'mode', in: [3] } },
                    { key: 'target', index: 2, type: 'select', label: 'Target', default: 0, visibleIf: { field: 'mode', in: [0] }, options: [
                        { value: 0, label: 'Player' },
                        { value: 1, label: 'Event light by ID' }
                    ] },
                    { key: 'eventId', index: 3, type: 'number', label: 'Light ID', default: 1, min: 1, visibleIf: { field: 'target', in: [1] } }
                ]
            },
            {
                code: 706,
                id: 'lightFlicker',
                name: 'Light Flicker',
                section: 'Lighting',
                help: 'Toggles the fire flicker of the player light.',
                fields: [
                    { key: 'state', index: 0, type: 'select', label: 'State', default: 1, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' },
                        { value: 2, label: 'Toggle' }
                    ] }
                ]
            },
            {
                code: 707,
                id: 'flashlight',
                name: 'Flashlight',
                section: 'Lighting',
                help: 'Turns the player flashlight on with an optional brightness.',
                fields: [
                    { key: 'brightness', index: 0, type: 'number', label: 'Brightness', default: '', min: 0, step: 0.01, optional: true, optionalLabel: 'Plugin default' }
                ]
            },
            {
                code: 709,
                id: 'vignetteColor',
                name: 'Vignette Color',
                section: 'Lighting',
                help: 'Sets the color of the screen-edge vignette.',
                fields: [
                    { key: 'color', index: 0, type: 'color', label: 'Color', default: '#000000' }
                ]
            },
            {
                code: 702,
                id: 'regionBlock',
                name: 'Region Block',
                section: 'Lighting',
                help: 'Marks a map region as blocking light (walls) with a shadow color, or removes the block.',
                fields: [
                    { key: 'regionId', index: 0, type: 'number', label: 'Region ID', default: 7, min: 1, max: 255 },
                    { key: 'state', index: 1, type: 'select', label: 'State', default: 1, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' }
                    ] },
                    { key: 'color', index: 2, type: 'color', label: 'Shadow Color', default: '#000000', visibleIf: { field: 'state', in: [1] } }
                ]
            },
            {
                code: 703,
                id: 'darknessTint',
                name: 'Darkness Tint',
                section: 'Lighting',
                help: 'Sets the darkness tint of the whole map, instantly or fading.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Mode', default: 0, options: [
                        { value: 0, label: 'Set (instant)' },
                        { value: 1, label: 'Fade' }
                    ] },
                    { key: 'color', index: 1, type: 'color', label: 'Tint Color', default: '#111111' },
                    { key: 'speed', index: 2, type: 'number', label: 'Speed (frames)', default: 60, min: 1, visibleIf: { field: 'mode', in: [1] } }
                ]
            },
            {
                code: 704,
                id: 'localSwitch',
                name: 'Local Switch',
                section: 'Lighting',
                help: 'A per-map switch (independent from global switches). Can target another map by ID.',
                fields: [
                    { key: 'switchIdx', index: 0, type: 'number', label: 'Switch Index', default: 1, min: 1 },
                    { key: 'state', index: 1, type: 'select', label: 'State', default: 1, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' },
                        { value: 2, label: 'Toggle' }
                    ] },
                    { key: 'mapId', index: 2, type: 'number', label: 'Map ID', default: 0, min: 0, optional: true, optionalLabel: 'Current map' }
                ]
            },
            {
                code: 720,
                id: 'lootGive',
                name: 'Loot Give',
                section: 'Inventory',
                help: 'Gives random loot of a category worth the given coin range.',
                fields: [
                    { key: 'category', index: 0, type: 'suggestion', label: 'Category', suggestions: 'lootCategories' },
                    { key: 'min', index: 1, type: 'number', label: 'Min Coins', default: 1, min: 1 },
                    { key: 'max', index: 2, type: 'number', label: 'Max Coins', default: 1, min: 1 }
                ]
            },
            {
                code: 710,
                id: 'cameraZoom',
                name: 'Camera Zoom',
                section: 'Camera',
                help: 'Zooms the camera. Scale 1 = normal, 2 = twice closer, 0.5 = twice farther.',
                fields: [
                    { key: 'scale', index: 0, type: 'number', label: 'Scale', default: 2, min: 0.1, max: 8, step: 0.1 },
                    { key: 'duration', index: 1, type: 'number', label: 'Duration (frames)', default: 0, min: 0, optionalLabel: 'Instant' },
                    { key: 'wait', index: 2, type: 'select', label: 'Wait for Completion', default: 0, options: [
                        { value: 0, label: 'No' },
                        { value: 1, label: 'Yes' }
                    ] }
                ]
            },
            {
                code: 711,
                id: 'focusCamera',
                name: 'Focus Camera',
                section: 'Camera',
                help: 'Moves the camera focus to the player, an event, or map coordinates.',
                fields: [
                    { key: 'target', index: 0, type: 'select', label: 'Target', default: 0, options: [
                        { value: 0, label: 'Player' },
                        { value: 1, label: 'Event by ID' },
                        { value: 2, label: 'Coordinates' }
                    ] },
                    { key: 'eventId', index: 1, type: 'number', label: 'Event ID', default: 1, min: 1, visibleIf: { field: 'target', in: [1] } },
                    { key: 'x', index: 2, type: 'number', label: 'X', default: 0, visibleIf: { field: 'target', in: [2] } },
                    { key: 'y', index: 3, type: 'number', label: 'Y', default: 0, visibleIf: { field: 'target', in: [2] } },
                    { key: 'duration', index: 4, type: 'number', label: 'Duration (frames)', default: 0, min: 0, optionalLabel: 'Instant' },
                    { key: 'wait', index: 5, type: 'select', label: 'Wait for Completion', default: 0, options: [
                        { value: 0, label: 'No' },
                        { value: 1, label: 'Yes' }
                    ] }
                ]
            },
            {
                code: 712,
                id: 'resetFocus',
                name: 'Reset Focus',
                section: 'Camera',
                help: 'Returns the camera to the player.',
                fields: [
                    { key: 'duration', index: 0, type: 'number', label: 'Duration (frames)', default: 0, min: 0, optionalLabel: 'Instant' }
                ]
            },
            {
                code: 721,
                id: 'enemyPhase',
                name: 'Enemy Phase',
                section: 'Enemies',
                help: 'Sets a behaviour phase flag on this event: combat, panic, flee, alert, shot, loch or wound. "Reset All" clears every phase.',
                fields: [
                    { key: 'phase', index: 0, type: 'select', label: 'Phase', default: 'combat', options: [
                        { value: 'combat', label: 'Combat' },
                        { value: 'panic', label: 'Panic' },
                        { value: 'flee', label: 'Flee' },
                        { value: 'alert', label: 'Alert' },
                        { value: 'shot', label: 'Shot' },
                        { value: 'loch', label: 'Loch (search)' },
                        { value: 'wound', label: 'Wound' },
                        { value: '__reset_all', label: 'Reset All' }
                    ] },
                    { key: 'state', index: 1, type: 'select', label: 'State', default: 1, visibleIf: { field: 'phase', notIn: ['__reset_all'] }, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' }
                    ] }
                ]
            },
            {
                code: 722,
                id: 'enemyHp',
                name: 'Enemy HP',
                section: 'Enemies',
                help: 'Map-enemy HP of this event: add damage, set directly, or read into a variable.',
                fields: [
                    { key: 'op', index: 0, type: 'select', label: 'Operation', default: 0, options: [
                        { value: 0, label: 'Add' },
                        { value: 1, label: 'Set' },
                        { value: 2, label: 'Get' }
                    ] },
                    { key: 'amount', index: 1, type: 'number', label: 'Amount', default: 0, visibleIf: { field: 'op', in: [0, 1] } },
                    { key: 'variableId', index: 2, type: 'variableId', label: 'Variable', default: 1, visibleIf: { field: 'op', in: [2] } }
                ]
            },
            {
                code: 723,
                id: 'allEnemiesPhase',
                name: 'All Enemies Phase',
                section: 'Enemies',
                help: 'Sets a behaviour phase flag on every event of the current map (restored MEHP_*_ALL commands).',
                fields: [
                    { key: 'phase', index: 0, type: 'select', label: 'Phase', default: 'shot', options: [
                        { value: 'combat', label: 'Combat' },
                        { value: 'panic', label: 'Panic' },
                        { value: 'flee', label: 'Flee' },
                        { value: 'alert', label: 'Alert' },
                        { value: 'shot', label: 'Shot' },
                        { value: 'loch', label: 'Loch (search)' },
                        { value: 'wound', label: 'Wound' }
                    ] },
                    { key: 'state', index: 1, type: 'select', label: 'State', default: 1, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' }
                    ] }
                ]
            },
            {
                code: 724,
                id: 'fillChestLoot',
                name: 'Fill Chest with Loot',
                section: 'Inventory',
                help: 'Fills a chest storage with random loot of a category (SuperDuperLoot).',
                fields: [
                    { key: 'chestId', index: 0, type: 'chestId', label: 'Chest ID', suggestions: true },
                    { key: 'category', index: 1, type: 'suggestion', label: 'Category', suggestions: 'lootCategories' },
                    { key: 'minCount', index: 2, type: 'number', label: 'Min Items', default: 1, min: 1 },
                    { key: 'maxCount', index: 3, type: 'number', label: 'Max Items', default: 1, min: 1 },
                    { key: 'value', index: 4, type: 'number', label: 'Total Coins', default: 10, min: 1 },
                    { key: 'maxItemValue', index: 5, type: 'number', label: 'Max Item Value', default: '', min: 1, optional: true, optionalLabel: 'Not set' }
                ]
            },
            {
                code: 740,
                id: 'textPop',
                name: 'Text Pop',
                section: 'Presentation',
                help: 'Shows floating text above a character. Supports \\c[n] color codes.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Target', default: -1, options: [
                        { value: -1, label: 'Player' },
                        { value: 0, label: 'Event by ID' }
                    ] },
                    { key: 'eventId', index: 1, type: 'number', label: 'Event ID', default: 1, min: 1, visibleIf: { field: 'mode', in: [0] } },
                    { key: 'duration', index: 2, type: 'number', label: 'Duration (frames)', default: 60, min: 10 },
                    { key: 'text', index: 3, type: 'multiline', label: 'Text', default: '' }
                ]
            },
            {
                code: 741,
                id: 'slideTitle',
                name: 'Slide Title',
                section: 'Presentation',
                help: 'Sets the title of the intro slide (shown by Show Slide).',
                fields: [
                    { key: 'title', index: 0, type: 'string', label: 'Title', default: '' }
                ]
            },
            {
                code: 742,
                id: 'slideText',
                name: 'Slide Text',
                section: 'Presentation',
                help: 'Sets the body text of the intro slide (shown by Show Slide).',
                fields: [
                    { key: 'text', index: 0, type: 'multiline', label: 'Text', default: '' }
                ]
            },
            {
                code: 743,
                id: 'slideFace',
                name: 'Slide Face',
                section: 'Presentation',
                help: 'Sets the face image of the intro slide.',
                fields: [
                    { key: 'faceName', index: 0, type: 'suggestion', label: 'Face', default: '', suggestions: 'faceNames' },
                    { key: 'faceIndex', index: 1, type: 'number', label: 'Face Index', default: 0, min: 0, max: 7 }
                ]
            },
            {
                code: 744,
                id: 'slideBackground',
                name: 'Slide Background',
                section: 'Presentation',
                help: 'Sets the background picture of the intro slide.',
                fields: [
                    { key: 'bgName', index: 0, type: 'suggestion', label: 'Picture', default: '', suggestions: 'pictureNames' }
                ]
            },
            {
                code: 745,
                id: 'showSlide',
                name: 'Show Slide',
                section: 'Presentation',
                help: 'Shows the configured intro slide full-screen and waits until it finishes.',
                fields: [
                    { key: 'duration', index: 0, type: 'number', label: 'Duration (frames)', default: 300, min: 30 }
                ]
            },
            {
                code: 713,
                id: 'shiftCamera',
                name: 'Shift Camera',
                section: 'Camera',
                help: 'Shifts the camera by tile offsets from its current position.',
                fields: [
                    { key: 'dx', index: 0, type: 'number', label: 'Shift X (tiles)', default: 0, step: 0.5 },
                    { key: 'dy', index: 1, type: 'number', label: 'Shift Y (tiles)', default: 0, step: 0.5 },
                    { key: 'duration', index: 2, type: 'number', label: 'Duration (frames)', default: 0, min: 0, optionalLabel: 'Instant' }
                ]
            },
            {
                code: 714,
                id: 'zoomControl',
                name: 'Zoom Control',
                section: 'Camera',
                help: 'Resets the zoom or changes the default zoom level the camera returns to.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Mode', default: 0, options: [
                        { value: 0, label: 'Reset zoom' },
                        { value: 1, label: 'Set default zoom' }
                    ] },
                    { key: 'value', index: 1, type: 'number', label: 'Scale', default: 1, min: 0.1, max: 8, step: 0.1, visibleIf: { field: 'mode', in: [1] } },
                    { key: 'duration', index: 2, type: 'number', label: 'Duration (frames)', default: 0, min: 0, optionalLabel: 'Instant', visibleIf: { field: 'mode', in: [0] } }
                ]
            },
            {
                code: 727,
                id: 'crtScreen',
                name: 'CRT Screen',
                section: 'Screen',
                help: 'Turns the CRT screen effect on, off or applies a preset.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Mode', default: 1, options: [
                        { value: 1, label: 'ON' },
                        { value: 0, label: 'OFF' },
                        { value: 2, label: 'Preset' }
                    ] },
                    { key: 'preset', index: 1, type: 'suggestion', label: 'Preset', default: '', visibleIf: { field: 'mode', in: [2] } }
                ]
            },
            {
                code: 729,
                id: 'treasurePopup',
                name: 'Treasure Popup',
                section: 'Screen',
                help: 'Shows or hides the item/gold pickup popups.',
                fields: [
                    { key: 'state', index: 0, type: 'select', label: 'State', default: 1, options: [
                        { value: 1, label: 'Show' },
                        { value: 0, label: 'Hide' }
                    ] }
                ]
            },
            {
                code: 728,
                id: 'positionalSound',
                name: 'Positional Sound',
                section: 'Audio',
                help: 'Plays a positioned audio source anchored to an event (OcRam AEX): the volume ramps from full inside the radius to silence at the distance, with auto-pan surround. Stop clears the anchor\'s sources. Without an anchor (common event) it plays map-wide.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Mode', default: 0, options: [
                        { value: 0, label: 'Play BGS source (looping)' },
                        { value: 1, label: 'Play SE (one-shot)' },
                        { value: 2, label: 'Stop sources' }
                    ] },
                    { key: 'anchor', index: 1, type: 'select', label: 'Anchor Event', default: 0, options: [
                        { value: 0, label: 'This Event' },
                        { value: 1, label: 'Event by ID' }
                    ], help: 'The sound source position - the event the volume/pan is measured from.' },
                    { key: 'eventId', index: 2, type: 'number', label: 'Event ID', default: 1, min: 1, visibleIf: { field: 'anchor', in: [1] } },
                    { key: 'bgsFile', index: 3, type: 'suggestion', label: 'BGS File', default: '', suggestions: 'bgsFiles', visibleIf: { field: 'mode', in: [0] } },
                    { key: 'seFile', index: 4, type: 'suggestion', label: 'SE File', default: '', suggestions: 'seFiles', visibleIf: { field: 'mode', in: [1] } },
                    { key: 'volume', index: 5, type: 'number', label: 'Volume', default: 90, min: 0, max: 100, visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'pitch', index: 6, type: 'number', label: 'Pitch', default: 100, min: 50, max: 150, visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'distance', index: 7, type: 'number', label: 'Distance (tiles)', default: 20, min: 0, max: 255, help: 'Full silence at this many tiles from the anchor.', visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'radius', index: 8, type: 'number', label: 'Radius (tiles)', default: 0, min: 0, max: 255, help: '100% volume within this many tiles, then falloff.', visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'fade', index: 9, type: 'number', label: 'Fade (seconds)', default: 2, min: 0, max: 120, visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'type', index: 10, type: 'select', label: 'Falloff Type', default: 0, options: [
                        { value: 0, label: 'd — dynamic (both axes)' },
                        { value: 1, label: 'x — horizontal only' },
                        { value: 2, label: 'y — vertical only' },
                        { value: 3, label: 'bg — background (everywhere)' }
                    ], visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'autopan', index: 11, type: 'select', label: 'Auto-pan', default: 1, options: [
                        { value: 1, label: 'On (surround)' },
                        { value: 0, label: 'Off' }
                    ], visibleIf: { field: 'mode', in: [0, 1] } },
                    { key: 'newBuffer', index: 12, type: 'select', label: 'New Buffer', default: 1, options: [
                        { value: 1, label: 'New (multiple copies)' },
                        { value: 0, label: 'Link (restart existing)' }
                    ], help: 'New plays a separate buffer per call; Link restarts the anchor\'s existing source.', visibleIf: { field: 'mode', in: [0] } }
                ]
            },
            {
                code: 738,
                id: 'textFastForward',
                name: 'Text Fast-Forward',
                section: 'Message',
                help: 'Controls the message fast-forward (FF) behavior.',
                fields: [
                    { key: 'mode', index: 0, type: 'select', label: 'Mode', default: 0, options: [
                        { value: 0, label: 'Enable' },
                        { value: 1, label: 'Disable' },
                        { value: 2, label: 'Disable next message' }
                    ] }
                ]
            },
            {
                code: 746,
                id: 'clearRoundItems',
                name: 'Clear Round Items',
                section: 'Inventory',
                help: 'Removes the round of items lying on the map (drop system).',
                fields: []
            },
            {
                code: 747,
                id: 'setSaveName',
                name: 'Set Save Name',
                section: 'Utility',
                help: 'Sets a fixed name for the next save file.',
                fields: [
                    { key: 'name', index: 0, type: 'string', label: 'Name', default: '' }
                ]
            },
            {
                code: 748,
                id: 'resetEventLocations',
                name: 'Reset Event Locations',
                section: 'Utility',
                help: 'Restores every event on the map to its original position.',
                fields: []
            },
            {
                code: 749,
                id: 'enemyHpVariable',
                name: 'Enemy HP Variable',
                section: 'Enemies',
                help: 'Binds this event\u0027s map-enemy HP to a game variable.',
                fields: [
                    { key: 'variableId', index: 0, type: 'variableId', label: 'Variable', default: 1 }
                ]
            },
            {
                code: 750,
                id: 'hideChoice',
                name: 'Hide Choice',
                section: 'Message',
                help: 'Removes a choice option from the following Show Choices call (optionally only when a switch is ON).',
                fields: [
                    { key: 'choiceIndex', index: 0, type: 'number', label: 'Choice (1-based)', default: 1, min: 1, max: 6 },
                    { key: 'switchId', index: 1, type: 'switchId', label: 'If Switch', default: 0, optional: true, optionalLabel: 'Always' }
                ]
            },
            {
                code: 751,
                id: 'gift',
                name: 'Gift',
                section: 'Party',
                help: 'Gives a gift item to a named actor (SuperDuperGifts).',
                fields: [
                    { key: 'actorName', index: 0, type: 'suggestion', label: 'Actor Name', default: '', suggestions: 'giftCharacters' },
                    { key: 'itemId', index: 1, type: 'itemRef', label: 'Item', default: 1 }
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
            // Agonia sidecar sections (data/AgoniaEngine.json is one of the
            // scanned containers): DB-authored collections suggest too.
            if (kind === 'lootCategories' && value.loot && typeof value.loot.Categories === 'string') {
                for (const entry of this._decodeAgoniaCollection(value.loot.Categories)) {
                    if (entry && entry.Name) values.add(String(entry.Name));
                }
            }
            if (kind === 'giftCharacters' && value.gifts && typeof value.gifts.Characters === 'string') {
                for (const entry of this._decodeAgoniaCollection(value.gifts.Characters)) {
                    if (entry && entry.Id) values.add(String(entry.Id));
                }
            }
            Object.values(value).forEach(v => { if (v && typeof v === 'object') visit(v); });
        };
        dataContainers.forEach(visit);
        return [...values].sort((a, b) => a.localeCompare(b, 'ru'));
    }

    /** MV collection string ('["{\"Name\":...}"]') -> plain entries. */
    static _decodeAgoniaCollection(raw) {
        try {
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr.map(item => {
                try { return typeof item === 'string' ? JSON.parse(item) : item; }
                catch (e) { return null; }
            });
        } catch (e) {
            return [];
        }
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
        } else if (kind === 'lootCategories') {
            if (command.code === 720) {
                const name = String(params[0] || '').trim();
                if (name) values.add(name);
            } else if (command.code === 724) {
                const name = String(params[1] || '').trim();
                if (name) values.add(name);
            }
        } else if (kind === 'giftCharacters') {
            if (command.code === 751) {
                const name = String(params[0] || '').trim();
                if (name) values.add(name);
            }
        } else if (kind === 'lightPresets') {
            // Built-in SDLight falloff presets plus everything used in data.
            ['global', 'global2', 'spichka', 'lamp', '1', '2', '3'].forEach(v => values.add(v));
            if (command.code === 700) {
                const preset = String(params[5] || '').trim();
                if (preset) values.add(preset);
            } else if (command.code === 356) {
                const tokens = String(params[0] || '').trim().split(/\s+/).slice(2);
                // Skip radius value, t<N>, color tokens and numbers.
                for (let i = 1; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (/^t\d+$/i.test(token)) continue;
                    if (/^#?[0-9a-fA-F]{3,8}$/.test(token) && token.includes('#')) continue;
                    if (!Number.isNaN(Number(token))) continue;
                    values.add(token);
                }
            }
        } else if (kind === 'lootCategories') {
            if (command.code === 720) {
                const category = String(params[0] || '').trim();
                if (category) values.add(category);
            } else if (command.code === 356) {
                const match = /^SDL\s+Give\s+(\S+)/i.exec(String(params[0] || '').trim());
                if (match) values.add(match[1]);
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgoniaNativeCommands;
}
