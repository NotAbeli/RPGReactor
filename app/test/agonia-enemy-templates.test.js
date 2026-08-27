/**
 * P2: шаблоны врагов — компиляция 17-страничного автомата из карточки БД.
 * Скелет = разобранный эталон «бибы» (карта «тест боевки», ивент 12).
 * Проверки: структура скелета и подстановки параметров, поиск шаблона по
 * note-тегу, экспансия заглушек на $dataMap, незатрагивание обычных
 * событий, дефолты карточки в редакторе.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'SuperDuperEnemies.js'), 'utf8');

function makeEnv(pluginParams = {}) {
    const ctx = {
        console: { log() { }, warn() { }, error() { } },
        PluginManager: { parameters: () => pluginParams, registerCommand() { } },
        Imported: {},
        window: null, navigator: {},
        $gameSwitches: { value: () => false, setValue() { } },
        $gameVariables: { value: () => 0, setValue() { } },
        $gameSelfSwitches: { value: () => false, setValue() { } },
        $gameMap: null, $gamePlayer: null, $dataMap: null, $dataCommonEvents: [],
        Game_Player: function () { }, Game_Event: function () { }, Game_Follower: function () { },
        Game_Character: function () { }, Game_CharacterBase: function () { }, Game_Map: function () { },
        Game_Interpreter: function () { }, Game_Switches: function () { }, Game_Variables: function () { },
        Game_SelfSwitches: function () { }, Game_System: function () { }, Game_Screen: function () { },
        Game_Action: function () { }, Game_Battler: function () { }, Game_Actor: function () { },
        DataManager: {}, SceneManager: {}, Input: {}, TouchInput: {},
        Scene_Map: function () { }, Scene_Title: function () { }, Scene_Base: function () { },
        JsonEx: { makeDeepCopy: o => JSON.parse(JSON.stringify(o)) },
        setInterval: () => 1, clearInterval() { }, requestAnimationFrame() { },
        document: undefined
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(pluginSrc, ctx, { filename: 'SuperDuperEnemies.js' });
    const sde = ctx.__SDE_TEST;
    if (!sde) throw new Error('test seam __SDE_TEST missing');
    return { ctx, sde };
}

const BIBA = {
    template: 'true', match: '<biba>', spriteName: 'Enemy 1', spriteIndex: 0,
    tracerId: 1, meleeId: 2, dashName: 'РывокВрага',
    chaseThreshold: 2, cowerThreshold: 3,
    damageMeleeVar: 2, damageGunVar: 37, damageMelee: -100, damageFists: -20,
    damageSE: 'Damage2', sneakKill: 'true'
};

const flat = p => JSON.stringify({ list: p.list, route: p.moveRoute });
const has = (p, needle) => flat(p).indexOf(needle) >= 0;

test('скелет: 17 страниц с эталонной структурой состояний', () => {
    const { sde } = makeEnv();
    const pages = sde.buildEnemyPages(BIBA);
    assert.strictEqual(pages.length, 17, '17 страниц');

    // P0 покой: стелс-детектор в маршруте
    assert.strictEqual(pages[0].trigger, 0);
    assert.ok(has(pages[0], "this.YurStealth(8, 'A')"), 'stealth detector in route');
    // P1 тревога
    assert.ok(has(pages[1], '<Warning>'));
    // P2 (A): выстрел трассером + лач A
    assert.strictEqual(pages[2].conditions.selfSwitchCh, 'A');
    assert.ok(pages[2].conditions.selfSwitchValid);
    assert.ok(has(pages[2], 'this.performTracer(1);'));
    assert.ok(has(pages[2], '"A",1'));
    // P3 (C): принудительный бой, БЕЗ projEffect (как в оригинале)
    assert.ok(pages[3].conditions.selfSwitchValid && pages[3].conditions.selfSwitchCh === 'C');
    assert.ok(!has(pages[3], '<projEffect>'));
    assert.ok(has(pages[3], '"combat",1'));
    // P4 <Shot>
    assert.ok(has(pages[4], '<Shot>') && has(pages[4], '"shot",0'));
    // P5 <Combat>: лач C + заморозка wait 999
    assert.ok(has(pages[5], '"C",1') && has(pages[5], '999'));
    // P6 паника: погоня от chaseThreshold
    assert.ok(has(pages[6], '<Panic>') && has(pages[6], '<!Loch>'));
    assert.ok(has(pages[6], '[1,59,0,2,1]'), 'chase threshold var 59 >= 2');
    // P7 контакт+прицел: паника, cower-ветка
    assert.ok(has(pages[7], '<Contact>') && has(pages[7], '<Scope>') && has(pages[7], '"panic",1'));
    assert.ok(has(pages[7], '[1,59,0,3,1]'), 'cower threshold var 59 >= 3');
    // P8 RememberGun -> flee
    assert.ok(has(pages[8], '<RememberGun> ') && has(pages[8], '"flee",1'));
    // P9 под огнём
    assert.ok(has(pages[9], '<Shot>') && has(pages[9], '"flee",1'));
    // P10 бегство
    assert.ok(has(pages[10], '<Flee>'));
    // P11 успокоился: полный сброс
    assert.ok(has(pages[11], '<Calm>') && has(pages[11], '"__reset_all",1'));
    // P12 атака: рывок + меле
    assert.ok(has(pages[12], '<Zona>') && has(pages[12], '"РывокВрага"') && has(pages[12], 'this.performMelee(2)'));
    // P13 рана
    assert.ok(has(pages[13], '<Wound>') && has(pages[13], '"wound",0'));
    // P14 (D) урон: таблица оружия + лач D
    assert.strictEqual(pages[14].conditions.selfSwitchCh, 'D');
    assert.ok(pages[14].conditions.selfSwitchValid);
    assert.ok(has(pages[14], '[1,17,0,2,0]') && has(pages[14], '[1,17,0,37,0]'));
    assert.ok(has(pages[14], '-100') && has(pages[14], '-20') && has(pages[14], 'Damage2'));
    assert.ok(has(pages[14], '"D",1'));
    // P15 смерть / P16 заглушка B
    assert.ok(has(pages[15], '<OnDeath>') && pages[15].image.characterName === '' && pages[15].priorityType === 0);
    assert.ok(pages[16].conditions.selfSwitchCh === 'B' && pages[16].conditions.selfSwitchValid);
});

test('подстановки: параметры карточки едут в команды скелета', () => {
    const { sde } = makeEnv();
    const tpl = Object.assign({}, BIBA, {
        spriteName: 'Monster', spriteIndex: 3, tracerId: 7, meleeId: 5,
        dashName: 'Прыжок', chaseThreshold: 4, cowerThreshold: 6,
        damageMeleeVar: 11, damageGunVar: 22, damageMelee: -250, damageFists: -5,
        damageSE: 'Hit3', sneakKill: 'false'
    });
    const pages = sde.buildEnemyPages(tpl);
    assert.ok(pages[0].image.characterName === 'Monster' && pages[0].image.characterIndex === 3);
    assert.ok(has(pages[2], 'this.performTracer(7);'), 'tracer id substituted');
    assert.ok(has(pages[12], '"Прыжок"') && has(pages[12], 'this.performMelee(5)'), 'dash + melee substituted');
    assert.ok(has(pages[6], '[1,59,0,4,1]'), 'chase threshold substituted');
    assert.ok(has(pages[7], '[1,59,0,6,1]'), 'cower threshold substituted');
    assert.ok(has(pages[14], '[1,17,0,11,0]') && has(pages[14], '[1,17,0,22,0]'), 'damage weapon vars substituted');
    assert.ok(has(pages[14], '-250') && has(pages[14], '-5') && has(pages[14], 'Hit3'));
    // sneakKill false -> проверка свитча 41 инвертирована (значение 1 = ВЫКЛ)
    assert.ok(has(pages[14], '[0,41,1]'), 'sneak kill inverted');
});

test('findTemplateByNote: только template-карточки, по тем же тегам, что и правила', () => {
    const box = { match: '<box>', hp: '50' };
    const { sde } = makeEnv();
    sde.MEHP_DB.length = 0;
    sde.MEHP_DB.push(box, Object.assign({}, BIBA));
    assert.ok(sde.findTemplateByNote('<biba> <step_se>'));
    assert.strictEqual(sde.findTemplateByNote('<box>'), null, 'не-шаблон не матчится');
    assert.strictEqual(sde.findTemplateByNote(''), null);
});

test('expandMapTemplates: заглушки разворачиваются, обычные события не тронуты', () => {
    const { ctx, sde } = makeEnv();
    sde.MEHP_DB.length = 0;
    sde.MEHP_DB.push(Object.assign({}, BIBA));
    const stubPages = [{ conditions: { selfSwitchCh: 'A', selfSwitchValid: false }, list: [{ code: 0, indent: 0, parameters: [] }] }];
    const plainPages = [{ list: [{ code: 101, indent: 0, parameters: ['hello'] }] }];
    ctx.$dataMap = { events: [null,
        { id: 1, name: 'ENEMY biba', note: '<biba> <step_se>', pages: JSON.parse(JSON.stringify(stubPages)) },
        { id: 2, name: 'chest', note: '', pages: JSON.parse(JSON.stringify(plainPages)) }
    ] };
    const n = sde.expandMapTemplates();
    assert.strictEqual(n, 1, 'one stub expanded');
    assert.strictEqual(ctx.$dataMap.events[1].pages.length, 17, 'stub got the full skeleton');
    assert.strictEqual(ctx.$dataMap.events[1].pages[2].image.characterName, 'Enemy 1');
    // обычное событие не тронуто
    assert.deepStrictEqual(ctx.$dataMap.events[2].pages, plainPages);
    // идемпотентность: повторная экспансия пересобирает скелет без накопления
    const n2 = sde.expandMapTemplates();
    assert.strictEqual(n2, 1);
    assert.strictEqual(ctx.$dataMap.events[1].pages.length, 17);
});

test('редактор: blankEnemy несёт поля шаблона', () => {
    const Editor = require(path.join(__dirname, '..', 'src', 'database', 'DatabaseEnemiesEditor.js'));
    const blank = Editor.blankEnemy();
    for (const k of ['template', 'spriteName', 'spriteIndex', 'collider', 'tracerId', 'meleeId', 'dashName',
        'chaseThreshold', 'cowerThreshold', 'damageMeleeVar', 'damageGunVar', 'damageMelee', 'damageFists',
        'damageSE', 'sneakKill']) {
        assert.ok(k in blank, 'blank enemy missing key ' + k);
    }
    assert.strictEqual(blank.template, 'true');
});
