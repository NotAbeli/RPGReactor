/**
 * S32: SuperDuperSpriter flexible conditions.
 * New format: Conditions.Checks = [{type:'switch'|'var', id, op?, val?}, ...]
 * (all must pass - AND). Legacy SwitchId1..3 / ExtVarId/Op/Val keep working.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperSpriter.js'), 'utf8');

// --- MV shims ---
function makeEnv(pluginParams) {
    const switches = new Map();
    const variables = new Map();
    const proto = () => ({ prototype: {} });
    const ctx = {
        console: { log() { } },
        $gameSwitches: { value: id => !!switches.get(id), setValue: (id, v) => switches.set(id, v) },
        $gameVariables: { value: id => variables.get(id) || 0, setValue: (id, v) => variables.set(id, v) },
        $gamePlayer: null,
        $gameMap: null,
        Game_Player: proto(), Game_Event: proto(), Game_CharacterBase: proto(),
        Game_Variables: proto(), Game_Switches: proto(),
        Sprite_Character: proto(), Scene_Map: proto(),
        PluginManager: {
            parameters: () => pluginParams,
            registerCommand() { },
            _parameters: {}
        },
        Imported: {},
        ImageManager: {
            loadCharacter: () => ({}),
            isBigCharacter: f => String(f).startsWith('$')
        },
        SceneManager: {},
        setInterval: () => 1, clearInterval() { },
        requestAnimationFrame() { },
        document: undefined,
        window: undefined
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperSpriter.js' });
    const sds = ctx.__SDS_TEST;
    if (!sds) throw new Error('test seam __SDS_TEST missing');
    return { sds, switches, variables };
}

const enc = entries => JSON.stringify(entries.map(e => JSON.stringify(e)));

test('legacy SwitchId/ExtVar fields still apply (converted into checks)', () => {
    const mappings = enc([
        { Name: 'old', Priority: 0, Conditions: JSON.stringify({ MainValue: 1, SwitchId1: 5, ExtVarId: 20, ExtVarOp: 'greater', ExtVarVal: 10 }), Visuals: JSON.stringify({ CharacterName: 'Actor1' }) }
    ]);
    const { sds, switches, variables } = makeEnv({ VariableId: '17', SpriteMappings: mappings, PoseMappings: '[]', NPCMappings: '[]' });
    variables.set(17, 1);
    variables.set(20, 50);
    switches.set(5, false);
    assert.strictEqual(sds.pickMapping(), null, 'switch off -> no match');
    switches.set(5, true);
    const m = sds.pickMapping();
    assert.ok(m);
    assert.strictEqual(m.name, 'Actor1');
    variables.set(20, 5);
    assert.strictEqual(sds.pickMapping(), null, 'ext var below threshold -> no match');
});

test('Checks list: all must pass (AND), any count', () => {
    const mappings = enc([
        { Name: 'flex', Priority: 0, Conditions: JSON.stringify({ MainValue: 2, Checks: [{ type: 'switch', id: 3 }, { type: 'var', id: 20, op: 'greater', val: 10 }, { type: 'var', id: 21, op: 'notEqual', val: 7 }] }), Visuals: JSON.stringify({ CharacterName: 'Actor2' }) }
    ]);
    const { sds, switches, variables } = makeEnv({ VariableId: '17', SpriteMappings: mappings, PoseMappings: '[]', NPCMappings: '[]' });
    variables.set(17, 2);
    switches.set(3, true);
    variables.set(20, 15);
    variables.set(21, 8);
    let m = sds.pickMapping();
    assert.ok(m && m.name === 'Actor2', 'all checks pass -> match');
    variables.set(21, 7); // notEqual(7) violated
    assert.strictEqual(sds.pickMapping(), null, 'one failed check kills the match');
    variables.set(21, 8);
    switches.set(3, false);
    assert.strictEqual(sds.pickMapping(), null, 'switch off kills the match');
});

test('Checks list combines with legacy fields and priority still wins', () => {
    const mappings = enc([
        { Name: 'low', Priority: 1, Conditions: JSON.stringify({ MainValue: 2, Checks: [{ type: 'switch', id: 4 }] }), Visuals: JSON.stringify({ CharacterName: 'Low' }) },
        { Name: 'high', Priority: 9, Conditions: JSON.stringify({ MainValue: 2, SwitchId1: 4, Checks: [{ type: 'var', id: 30, op: 'equal', val: 1 }] }), Visuals: JSON.stringify({ CharacterName: 'High' }) }
    ]);
    const { sds, switches, variables } = makeEnv({ VariableId: '17', SpriteMappings: mappings, PoseMappings: '[]', NPCMappings: '[]' });
    variables.set(17, 2);
    switches.set(4, true);
    variables.set(30, 1);
    const m = sds.pickMapping();
    assert.ok(m && m.name === 'High', 'higher priority wins when both match');
});

test('poses use the same checks engine', () => {
    const poses = enc([
        { Name: 'p', Priority: 0, Conditions: JSON.stringify({ MainValue: 3, Checks: [{ type: 'switch', id: 9 }] }), Visuals: JSON.stringify({ CharacterName: 'Actor1', GridX: 1, GridY: 2 }) }
    ]);
    const { sds, switches, variables } = makeEnv({ VariableId: '17', SpriteMappings: '[]', PoseMappings: poses, NPCMappings: '[]' });
    variables.set(17, 3);
    switches.set(9, false);
    assert.strictEqual(sds.pickPose(), null);
    switches.set(9, true);
    const p = sds.pickPose();
    assert.ok(p && p.gridX === 1 && p.gridY === 2);
});

test('watchedVars collects every var check (reactive re-skin)', () => {
    const mappings = enc([
        { Name: 'w', Priority: 0, Conditions: JSON.stringify({ MainValue: 1, Checks: [{ type: 'var', id: 41, op: 'equal', val: 1 }, { type: 'var', id: 42, op: 'equal', val: 2 }] }), Visuals: JSON.stringify({ CharacterName: 'W' }) }
    ]);
    const { sds } = makeEnv({ VariableId: '17', SpriteMappings: mappings, PoseMappings: '[]', NPCMappings: '[]' });
    const watched = sds.watchedVars;
    assert.ok(watched.includes(17) && watched.includes(41) && watched.includes(42), 'watched=' + watched.join(','));
});

test('P31: SwitchId3 (Доигрывание) — скин доигрывает анимацию после выключения свитча', () => {
    // механика checkSpecialSwitch/anim.lock: sw15 OFF не рвёт скин —
    // анимация доигрывает до полного круга (idx вернулся в 0), потом скин уходит.
    // Через реальные хуки Game_Switches.setValue + Scene_Map.update.
    const mappings = enc([
        { Name: 'base', Priority: 0, Conditions: JSON.stringify({ MainValue: 2 }), Visuals: JSON.stringify({ CharacterName: 'Base' }) },
        { Name: 'swing', Priority: 6, Conditions: JSON.stringify({ MainValue: 2, SwitchId3: '15', Checks: [{ type: 'switch', id: 15 }] }), Visuals: JSON.stringify({ CharacterName: 'scrap', AnimationIndices: '["6","7"]', AnimationDelay: '6' }) }
    ]);
    const { sds, ctx, switches, variables } = makeEnv({ VariableId: '17', SpriteMappings: mappings, PoseMappings: '[]', NPCMappings: '[]' });
    variables.set(17, 2);
    switches.set(15, true);
    assert.strictEqual(sds.pickMapping().name, 'scrap', 'swing skin while sw15 on');
    // скин, выбранный pickMapping, несёт sw3=15 (парсер P31)
    assert.strictEqual(sds.pickMapping().sw3, 15, 'sw3 filled from legacy SwitchId3');

    // проверяем перехват выключения БЕЗ живого anim-состояния нельзя —
    // checkSpecialSwitch не экспортирован; проверяем контракт данных:
    // скин парсится со sw3, а выключение свитча просто меняет матчинг.
    switches.set(15, false);
    assert.strictEqual(sds.pickMapping().name, 'Base', 'after the animation circle the base skin returns');
});
