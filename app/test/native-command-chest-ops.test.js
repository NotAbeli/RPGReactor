const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RUNTIME = path.join(__dirname, '..', 'runtime', 'reactor_objects.js');

function loadChestCommands() {
    const source = fs.readFileSync(RUNTIME, 'utf8');
    const start = source.indexOf('Game_Interpreter.prototype.command715');
    const marker = source.indexOf('Game_Interpreter.prototype._agoniaSlotItemType');
    assert.ok(start > 0, 'command715 not found');
    assert.ok(marker > start, '_agoniaSlotItemType not found');
    const tail = source.indexOf('};', marker);
    assert.ok(tail > marker, '_agoniaSlotItemType block end not found');
    return source.slice(start, tail + 2);
}

const CHUNK = loadChestCommands();

const CAPACITY = 15;

/**
 * Runtime sandbox: $gameSystem/$gameParty/$dataXxx mocks in the exact shape
 * SuperDuperInventory uses (slot arrays of null | {item, amount}; one stack
 * per slot).
 */
function makeRuntime() {
    const rt = {
        chestSlots: {}, gained: [], switchValues: {}, variableValues: {},
        context: {
            console,
            $gameSystem: {
                getChestItems(id) {
                    if (!rt.chestSlots[id]) rt.chestSlots[id] = new Array(CAPACITY).fill(null);
                    return rt.chestSlots[id];
                },
                addItemToChest(id, item, amount) {
                    const chest = this.getChestItems(id);
                    for (let i = 0; i < chest.length; i++) {
                        if (chest[i] === null) {
                            chest[i] = { item, amount };
                            return true;
                        }
                    }
                    return false;
                }
            },
            $gameParty: {
                gainItem(item, amount) { rt.gained.push({ item, amount }); }
            },
            $gameSwitches: {
                setValue(id, v) { rt.switchValues[id] = v; },
                value(id) { return rt.switchValues[id]; }
            },
            $gameVariables: {
                setValue(id, v) { rt.variableValues[id] = v; },
                value(id) { return rt.variableValues[id]; }
            },
            $dataItems: [null, { id: 1, name: 'Бинт', itypeId: 1 }, { id: 2, name: 'Спичка', itypeId: 1 }],
            $dataWeapons: [null, { id: 1, name: 'Нож' }],
            $dataArmors: [null, { id: 1, name: 'Куртка' }],
            Game_Interpreter: function () { },
        }
    };
    rt.context.Game_Interpreter.prototype = {};
    vm.createContext(rt.context);
    vm.runInContext(CHUNK, rt.context);
    rt.interpreter = () => Object.create(rt.context.Game_Interpreter.prototype);
    return rt;
}

test('command716 adds a stacked slot and reports full when the chest is out of space', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();

    assert.strictEqual(it.command716(['аптека1', 0, 1, 3, 12]), true);
    const chest = rt.chestSlots['аптека1'];
    assert.strictEqual(chest.filter(Boolean).length, 1, 'one stack slot');
    assert.strictEqual(chest[0].amount, 3);
    assert.strictEqual(rt.switchValues[12], false, 'not full');

    // Fill the rest of the capacity with single-slot stacks.
    for (let i = 0; i < CAPACITY - 1; i++) it.command716(['аптека1', 0, 2, 1, 0]);
    assert.strictEqual(chest.filter(Boolean).length, CAPACITY);

    // One more -> no free slot -> full switch turns ON, nothing added.
    assert.strictEqual(it.command716(['аптека1', 0, 1, 1, 12]), true);
    assert.strictEqual(rt.switchValues[12], true, 'full when out of slots');
});

test('command716 warns and flags full when the module is absent', () => {
    const warnings = [];
    const context = {
        console: { warn: msg => warnings.push(msg), log: () => { } },
        $gameSystem: {},
        $gameSwitches: { setValue(id, v) { context.__switch = v; } },
        Game_Interpreter: function () { },
    };
    context.Game_Interpreter.prototype = {};
    vm.createContext(context);
    vm.runInContext(CHUNK, context);
    const it = Object.create(context.Game_Interpreter.prototype);
    assert.strictEqual(it.command716(['x', 0, 1, 1, 5]), true);
    assert.strictEqual(context.__switch, true, 'full flag ON when module missing');
    assert.ok(warnings.some(w => String(w).includes('Add Item to Chest')));
});

test('command717 removes from matching stacks, destroys or moves to inventory', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();

    // Seed: Бинт x5 (item), Спичка x2 (item), Куртка x1 (armor) = 3 stacks.
    it.command716(['комод', 0, 1, 5, 0]);
    it.command716(['комод', 0, 2, 2, 0]);
    it.command716(['комод', 2, 1, 1, 0]);
    const slots = rt.chestSlots['комод'];
    assert.strictEqual(slots.filter(Boolean).length, 3);

    // Remove 1 Бинт -> destroyed (no gainItem), stack keeps 4.
    it.command717(['комод', 0, 1, 1, 0]);
    assert.strictEqual(slots[0].amount, 4);
    assert.strictEqual(rt.gained.length, 0);

    // Remove remaining 4 Бинт -> to inventory, slot cleared.
    it.command717(['комод', 0, 1, 4, 1]);
    assert.strictEqual(slots[0], null, 'stack emptied');
    assert.strictEqual(rt.gained.length, 4, 'moved to party one by one');

    // Over-amount removal of Спичка clears the stack without touching others.
    it.command717(['комод', 0, 2, 9, 0]);
    assert.strictEqual(slots[1], null);
    assert.strictEqual(slots.filter(Boolean).length, 1, 'Куртка (armor) untouched by item removal');
});

test('command718 empties the whole chest', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command716(['склад', 0, 1, 4, 0]);
    it.command718(['склад']);
    assert.ok(rt.chestSlots['склад'].every(slot => slot === null));
});

test('command719 reports total amount, empty flag and used slots', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command716(['проверка', 0, 1, 3, 0]);
    it.command716(['проверка', 0, 2, 2, 0]);

    it.command719(['проверка', 7, 0]);
    assert.strictEqual(rt.variableValues[7], 5, 'total amount');

    it.command719(['проверка', 7, 1]);
    assert.strictEqual(rt.variableValues[7], 0, 'not empty');

    it.command719(['проверка', 7, 2]);
    assert.strictEqual(rt.variableValues[7], 2, 'used stacks');

    it.command718(['проверка']);
    it.command719(['проверка', 7, 1]);
    assert.strictEqual(rt.variableValues[7], 1, 'empty after clear');
});

test('command719 mode 3 counts one item across stacks and separates types with equal ids', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    // Бинт (item 1) x4, Спичка (item 2) x2, Нож (weapon 1) x1 — weapon id
    // collides with Бинт id.
    it.command716(['склад', 0, 1, 4, 0]);
    it.command716(['склад', 0, 2, 2, 0]);
    it.command716(['склад', 1, 1, 1, 0]);

    it.command719(['склад', 7, 3, 0, 1]);
    assert.strictEqual(rt.variableValues[7], 4, 'amount of item id 1');

    it.command719(['склад', 7, 3, 1, 1]);
    assert.strictEqual(rt.variableValues[7], 1, 'weapon id 1 counted separately');

    it.command719(['склад', 7, 3, 0, 2]);
    assert.strictEqual(rt.variableValues[7], 2, 'amount of item id 2');

    it.command719(['склад', 7, 3, 2, 1]);
    assert.strictEqual(rt.variableValues[7], 0, 'armor id 1 absent -> 0');

    // Partial removal shrinks the counted amount.
    it.command717(['склад', 0, 1, 3, 0]);
    it.command719(['склад', 7, 3, 0, 1]);
    assert.strictEqual(rt.variableValues[7], 1, 'after removing 3');
});

test('command719 mode 4 reports presence and flips to 0 after removal', () => {
    const rt = makeRuntime();
    const it = rt.interpreter();
    it.command716(['тайник', 0, 2, 3, 0]);

    it.command719(['тайник', 7, 4, 0, 2]);
    assert.strictEqual(rt.variableValues[7], 1, 'Спичка present');

    it.command719(['тайник', 7, 4, 0, 1]);
    assert.strictEqual(rt.variableValues[7], 0, 'Бинт absent');

    it.command717(['тайник', 0, 2, 3, 0]);
    it.command719(['тайник', 7, 4, 0, 2]);
    assert.strictEqual(rt.variableValues[7], 0, 'present flips to 0 after full removal');
});

test('command719 writes 0 when the module is absent', () => {
    const context = {
        console: { warn: () => { }, log: () => { } },
        $gameSystem: {},
        $gameVariables: { setValue(id, v) { context.__value = v; } },
        Game_Interpreter: function () { },
    };
    context.Game_Interpreter.prototype = {};
    vm.createContext(context);
    vm.runInContext(CHUNK, context);
    const it = Object.create(context.Game_Interpreter.prototype);
    it.command719(['x', 3, 3, 0, 1]);
    assert.strictEqual(context.__value, 0);
});
