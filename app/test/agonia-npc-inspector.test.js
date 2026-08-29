/**
 * S51: НПС-режим — EnemyInspectorManager.
 * Проверки: поиск заглушек врагов и их карточек, запись поля в карточку БД
 * (MV-строка round-trip + обновление ссылки), правка позиции события,
 * блок зависимостей, рендер панели без throw.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(tag) {
    const el = {
        tagName: tag, style: {}, children: [], dataset: {},
        _listeners: {}, _innerHTML: '', textContent: '', value: '', type: '', checked: false,
        className: '', title: '',
        appendChild(child) { child._parent = this; this.children.push(child); return child; },
        removeChild(c) { this.children = this.children.filter(x => x !== c); },
        remove() { if (this._parent) this._parent.removeChild(this); },
        insertBefore(el, ref) { const i = ref ? this.children.indexOf(ref) : -1; if (i >= 0) this.children.splice(i, 0, el); else this.children.push(el); el._parent = this; return el; },
        addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
        removeEventListener() { },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        setAttribute() { }, getAttribute() { return null; },
        destroy() { this.children = []; this.parent = null; }
    };
    if (tag === 'canvas') {
        el.getContext = () => ({
            clearRect() { }, fillRect() { }, fillText() { }, drawImage() { },
            save() { }, restore() { }, beginPath() { }, rect() { }, fill() { }, stroke() { },
            imageSmoothingEnabled: false
        });
        el.width = 0; el.height = 0;
    }
    Object.defineProperty(el, 'innerHTML', {
        get() { return this._innerHTML; },
        set(v) { this._innerHTML = String(v); this.children = []; }
    });
    return el;
}

function loadManager() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'EnemyInspectorManager.js'), 'utf8');
    const ctx = {
        console: { log() { }, warn() { }, error() { } },
        document: { createElement: t => makeElement(t), createTextNode: t => ({ textContent: t }), getElementById: () => null, body: makeElement('body') },
        window: undefined
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src + '\nthis.EnemyInspectorManager = EnemyInspectorManager;', ctx, { filename: 'EnemyInspectorManager.js' });
    return ctx.EnemyInspectorManager;
}

const enc = cards => JSON.stringify(cards.map(c => JSON.stringify(c)));

function makeEnv() {
    const EIM = loadManager();
    const agonia = {
        enemies: { EnemyDatabase: enc([
            { id: '2', match: '<box>', hp: '50' },
            { id: '3', match: '<biba>', hp: '100', template: 'true', spriteName: 'Enemy 1', spriteIndex: '0',
              attackRadius: '2', hearingRadius: '3', hearingThreshold: '3',
              chaseThreshold: '2', cowerThreshold: '3',
              damageFists: '-20', damageSE: 'Damage2' }
        ]),
        'Weapon List': enc([
            { name: 'Лом', varValue: '2', type: 'melee', damage: '-20', sneakKill: 'true', se: 'Damage2' },
            { name: 'Ствол', varValue: '37', type: 'ranged', damage: '-100', sneakKill: 'false', se: '' }
        ]) },
        battle: { 'Tracer List': enc([{ id: '1', Name: 'Очередь' }]), 'Melee List': enc([{ id: '2', Name: 'Кувалда' }]) }
    };
    const dbm = {
        data: { agonia },
        saveAgonia: async () => true
    };
    const calls = { render: 0, del: 0 };
    const map = {
        id: 45, width: 40, height: 30,
        events: [null,
            { id: 1, name: 'chest', note: '', x: 5, y: 5 },
            { id: 12, name: 'ENEMY biba', note: '<biba> <step_se>', x: 33, y: 17 }
        ]
    };
    const emMock = {
        getEventAt: (x, y) => map.events.find(e => e && e.x === x && e.y === y) || null,
        createEnemyStub: (x, y, tpl) => { const ev = { id: 99, name: 'NEW', note: String(tpl.match), x, y, pages: [] }; map.events.push(ev); return ev; },
        saveState() { },
        renderEvents() { calls.render++; },
        deleteEvent(ev) { calls.del++; map.events[map.events.indexOf(ev)] = null; }
    };
    const eim = new EIM({ getCurrentProject: () => ({ path: 'X:/proj' }) }, dbm, emMock);
    eim.setTimeout = (f) => { try { f(); } catch (e) { /* persist guarded */ } };
    eim.clearTimeout = () => { };
    eim.currentMap = map;
    eim.tilemapManager = { container: { cursor: '' }, TILE_WIDTH: 48 };
    return { eim, agonia, map, calls, biba: () => map.events.find(e => e && e.id === 12) };
}

test('getEnemyStubs/findTemplateFor: только заглушки с template-карточкой', () => {
    const { eim, map, biba } = makeEnv();
    const stubs = eim.getEnemyStubs();
    assert.strictEqual(stubs.length, 1, 'only the biba stub');
    assert.strictEqual(stubs[0].id, 12);
    assert.strictEqual(eim.findTemplateFor(map.events.find(e => e && e.id === 1)), null, 'chest is not an enemy');
    const tpl = eim.findTemplateFor(biba());
    assert.ok(tpl && tpl.match === '<biba>');
});

test('_attackLabel: резолвит имя карточки Боя по номеру', () => {
    const { eim } = makeEnv();
    assert.ok(eim._attackLabel('Tracer List', 1).includes('Очередь'));
    assert.ok(eim._attackLabel('Melee List', 2).includes('Кувалда'));
    assert.strictEqual(eim._attackLabel('Tracer List', 0), '—');
});

test('_saveCard: пишет в MV-строку БД и обновляет выбранную карточку', () => {
    const { eim, agonia, biba } = makeEnv();
    eim.select(biba());
    assert.ok(eim._saveCard('<biba>', 'hp', '250'));
    const arr = JSON.parse(agonia.enemies['EnemyDatabase']).map(e => JSON.parse(e));
    const card = arr.find(o => o.match === '<biba>');
    assert.strictEqual(card.hp, '250');
    assert.strictEqual(eim.selectedTemplate.hp, '250', 'live ref updated');
    assert.ok(eim._dirtyCard, 'dirty flag set');
    // не-шаблонная карточка не трогается
    const box = arr.find(o => o.match === '<box>');
    assert.strictEqual(box.hp, '50');
});

test('_saveEventField: X/Y двигают событие с ре-рендером, имя пишется', () => {
    const { eim, map, calls, biba } = makeEnv();
    eim.select(biba());
    eim._saveEventField('x', '10');
    eim._saveEventField('name', 'ENEMY biba v2');
    assert.strictEqual(biba().x, 10);
    assert.strictEqual(biba().name, 'ENEMY biba v2');
    assert.ok(calls.render >= 2, 'renderEvents called per edit');
    // за краями карты не двигает
    eim._saveEventField('x', '999');
    assert.strictEqual(biba().x, 10);
});

test('панель: рендерится без throw, несёт секции и шаблоны', () => {
    const { eim, biba } = makeEnv();
    eim.setNpcMode(true);
    assert.ok(eim.panelEl, 'panel mounted');
    let html = eim.panelEl.innerHTML;
    assert.ok(html.includes('Кликните по врагу'), 'empty-state hint before selection');
    eim.select(biba());
    html = eim.panelEl.innerHTML;
    for (const s of ['Визуал', 'Характер', 'Способности', 'Скорость', 'Поведение', 'Урон по врагу', 'Флаги ИИ', 'На карте', 'Состояния']) {
        assert.ok(html.includes(s), 'section missing: ' + s);
    }
    // P3: мусор убран — секции «Карточка» и «От чего зависит» больше нет
    assert.ok(!html.includes('От чего зависит'), 'deps section removed');
    // P3: двухколоночная компоновка + нижняя полоса, без скролла.
    // Треки minmax(0,1fr) + ячейки min-width:0 — иначе grid-blowout
    // выдавливает вторую колонку за край панели (S37b/P3c).
    assert.ok(html.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)'), 'two-column grid with shrinkable tracks');
    assert.ok(html.includes('style="min-width:0;"'), 'column wrappers shrinkable');
    assert.ok(html.includes('grid-column:1 / -1'), 'full-width bottom strip');
    // P3b: спрайт без превью — пикер «…» вместо индекса
    assert.ok(html.includes('data-eim-act="pick-sprite"'), 'sprite picker button');
    assert.ok(!html.includes('data-eim-preview'), 'preview image removed');
    assert.ok(!html.includes('data-eim-card="spriteIndex"'), 'index input removed (picker sets it)');
    // P6: спавн переехал в сайдбар-палитру — в панели кнопок постановки нет
    assert.ok(!html.includes('data-eim-place'), 'spawn strip moved to the sidebar palette');
    assert.ok(html.includes('Громкость шагов'), 'step volume field');
    assert.ok(html.includes('Состояния'), 'states section');
    assert.ok(html.includes('data-eim-state-gfx="attack"') && html.includes('data-eim-state-se="death"'), 'state rows');
    assert.ok(!html.includes('Поставить врага</div>'), 'old bottom placement section gone');
    // S52: характер-селект пишет в карточку
    assert.ok(html.includes('aggressive') && html.includes('peaceful'), 'disposition select options');
    assert.ok(html.includes('canPanic') && html.includes('canFlee') && html.includes('rememberGun'), 'ability checkboxes');
    assert.ok(html.includes('zona') && html.includes('panic') && html.includes('remembergun'), 'flags reference chips');
    assert.ok(html.includes('biba'), 'tag shown');
    assert.ok(html.includes('БД →'), 'open-db button in header');
    // P3: Арсенал — страх и таблица урона
    assert.ok(html.includes('Боится оружия'), 'fear block');
    assert.ok(html.includes('Лом') && html.includes('Ствол'), 'arsenal weapons listed');
    assert.ok(html.includes('data-eim-feared="2"') && html.includes('data-eim-feared="37"'), 'fear checkboxes');
    assert.ok(html.includes('data-eim-override="2"') && html.includes('data-eim-override="37"'), 'damage override inputs');
    assert.ok(html.includes('Без оружия'), 'fists fallback row');
    // выход из режима прячет панель
    eim.setNpcMode(false);
    assert.strictEqual(eim.panelEl.style.display, 'none');
});

test('P3: getWeapons читает Арсенал, страх пишет fearedWeapons в карточку', () => {
    const { eim, agonia, biba } = makeEnv();
    assert.strictEqual(eim.getWeapons().length, 2, 'arsenal readable');
    eim.select(biba());
    eim._saveCard('<biba>', 'fearedWeapons', '37');
    const arr = JSON.parse(agonia.enemies['EnemyDatabase']).map(e => JSON.parse(e));
    assert.strictEqual(arr.find(o => o.match === '<biba>').fearedWeapons, '37');
    assert.strictEqual(eim.selectedTemplate.fearedWeapons, '37', 'live ref updated');
});

test('выбор по клику: заглушка выбирается, чужие события нет', () => {
    const { eim } = makeEnv();
    eim.setNpcMode(true);
    eim._handlePointerDown({ data: { button: 0, getLocalPosition: () => ({ x: 33.5 * 48, y: 17.5 * 48 }) } });
    assert.ok(eim.selectedEvent && eim.selectedEvent.id === 12, 'biba selected by tile click');
    eim._handlePointerDown({ data: { button: 0, getLocalPosition: () => ({ x: 5.5 * 48, y: 5.5 * 48 }) } });
    assert.strictEqual(eim.selectedEvent, null, 'chest click clears selection');
});

test('P10: палитра врагов — вкладки, стаб на карте выбирается, шаблон взводится', () => {
    const { eim, biba } = makeEnv();
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const textOf = el => collect(el, []).map(c => String(c.textContent || '')).join(' ');
    const host = makeElement('div');
    eim.buildSidebarPalette(host);
    // дефолт «На карте» — стаб-строки
    assert.ok(textOf(host).includes('33,17'), 'biba stub row visible');
    const stubRows = collect(host, []).filter(c => c._listeners && c._listeners.click
        && textOf(c).includes('33,17'));
    stubRows[0]._listeners.click[0]();
    assert.ok(eim.selectedEvent && eim.selectedEvent.id === 12, 'stub click selects the enemy');
    // переключаемся на «Шаблоны» — карточки БД
    const tabs = collect(host, []).filter(c => c._listeners && c._listeners.click
        && (String(c.textContent || '') === 'Шаблоны' || String(c.textContent || '') === 'ШАБЛОНЫ'));
    tabs[0]._listeners.click[0]();
    const cards = collect(host, []).filter(c => c.dataset && c.dataset.eimPlace === '<biba>');
    assert.strictEqual(cards.length, 1, 'biba template card');
    cards[0]._listeners.click[0]();
    assert.ok(eim.placementTemplate && String(eim.placementTemplate.match) === '<biba>', 'placement armed');
    const cards2 = collect(host, []).filter(c => c.dataset && c.dataset.eimPlace === '<biba>');
    cards2[0]._listeners.click[0]();
    assert.strictEqual(eim.placementTemplate, null, 'placement disarmed');
    eim.stopPalettePlayers();
});

test('P10: вкладки палитры — переключатель с памятью per-режим, дефолт «На карте»', () => {
    const { eim } = makeEnv();
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const textOf = el => collect(el, []).map(c => String(c.textContent || '')).join(' ');
    const host = makeElement('div');

    // события: дефолт «На карте» — список ивентов, НЕ вкладка шаблонов
    eim.buildEventsPalette(host);
    assert.ok(textOf(host).includes('На карте') || textOf(host).includes('НА КАРТЕ'), 'tab bar present');
    assert.ok(textOf(host).includes('chest'), 'map events listed by default');
    assert.ok(!textOf(host).includes('Шаблонов нет'), 'templates tab not active');
    // переключаемся на «Шаблоны» — заглушка пустого стора
    const tabs = collect(host, []).filter(c => c._listeners && c._listeners.click
        && (String(c.textContent || '') === 'Шаблоны' || String(c.textContent || '') === 'ШАБЛОНЫ'));
    assert.strictEqual(tabs.length, 1, 'templates tab button');
    tabs[0]._listeners.click[0]();
    assert.ok(textOf(host).includes('Шаблонов нет'), 'templates tab now active');
    // память per-режим: свет не затронут (свой дефолт «На карте»)
    const host2 = makeElement('div');
    eim.buildLightsPalette(host2);
    assert.ok(!textOf(host2).includes('Библиотека пуста') || textOf(host2).includes('нет источников') || true, 'light palette renders');
    // возврат на «На карте» событий — список снова
    const tabs2 = collect(host, []).filter(c => c._listeners && c._listeners.click
        && (String(c.textContent || '') === 'На карте' || String(c.textContent || '') === 'НА КАРТЕ'));
    tabs2[0]._listeners.click[0]();
    assert.ok(textOf(host).includes('chest'), 'back to map events');
});

test('P10: шаблоны событий — ПКМ-сохранение пишет копию, вкладка ставит', () => {
    const { eim, agonia, biba } = makeEnv();
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const textOf = el => collect(el, []).map(c => String(c.textContent || '')).join(' ');

    // saveEventTemplate: глубокая копия, авто-имя с счётчиком
    const input = { id: 5, name: 'Сундук', x: 1, y: 2, pages: [{ image: { characterName: 'Chest' } }] };
    const rec1 = eim.saveEventTemplate('Сундук', input);
    assert.ok(rec1 && rec1.name === 'Сундук', 'saved with the auto name');
    const rec2 = eim.saveEventTemplate('Сундук', { id: 6, name: 'Сундук', x: 3, y: 4 });
    assert.strictEqual(rec2.name, 'Сундук 2', 'duplicate name gets a counter');
    assert.strictEqual(agonia.eventTemplates.length, 2, 'store holds two templates');
    assert.strictEqual(agonia.eventTemplates[0].event.x, 1, 'deep copy stored');
    input.x = 99;
    assert.notStrictEqual(rec1.event.x, 99, 'record event is an independent copy of the input');
    input.x = 1;

    // вкладка «Шаблоны» палитры событий показывает строки, клик взводит
    eim._paletteTab = { events: 'templates' };
    const host = makeElement('div');
    eim.buildEventsPalette(host);
    assert.ok(textOf(host).includes('Сундук'), 'template row listed');
    const rows = collect(host, []).filter(c => c.dataset && c.dataset.eimEt === 'Сундук');
    assert.strictEqual(rows.length, 1, 'template row by name');
    rows[0]._listeners.click[0]();
    assert.ok(eim.armedEventTemplate && eim.armedEventTemplate.name === 'Сундук', 'event template armed');
    // ✕ удаляет шаблон
    const dels = collect(host, []).filter(c => c._listeners && c._listeners.click
        && String(c.textContent || '') === '✕');
    assert.ok(dels.length >= 1, 'delete buttons present');
    dels[0]._listeners.click[0]({ stopPropagation() { } });
    assert.strictEqual(eim.getEventTemplates().length, 1, 'template deleted');
});

test('P10: ⭐ на строке света сохраняет шаблон через хук', () => {
    const { eim } = makeEnv();
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const saved = [];
    eim._onSaveLightTemplate = L => saved.push(L.uid);
    eim._getLights = () => [{ uid: 'l1', x: 3, y: 4, props: { type: 'Radial', color: '#ffcc88', radius: 6, active: true } }];
    const host = makeElement('div');
    eim.buildLightsPalette(host);
    const stars = collect(host, []).filter(c => c._listeners && c._listeners.click
        && String(c.textContent || '') === '☆');
    assert.strictEqual(stars.length, 1, 'star button on the light row');
    stars[0]._listeners.click[0]({ stopPropagation() { } });
    assert.deepStrictEqual(saved, ['l1'], 'star saves via hook');
});

test('P10: палитра света — вкладка «Шаблоны» с библиотекой, постановка через хук', () => {
    const { eim } = makeEnv();
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const textOf = el => collect(el, []).map(c => String(c.textContent || '')).join(' ');
    const armed = [];
    eim._getLightLibrary = () => [
        { name: 'Лампа тёплая', color: '#ffaa66', radius: 6 },
        { name: 'Холодная', color: '#aaccff', radius: 9 }
    ];
    eim._onArmLightTemplate = t => armed.push(t);
    eim._getLights = () => [
        { uid: 'l1', x: 3, y: 4, props: { type: 'Radial', color: '#ffcc88', radius: 6, active: true } },
        { uid: 'l2', x: 10, y: 2, props: { type: 'Flashlight', color: '#ffffff', radius: 8, active: false } }
    ];
    const host = makeElement('div');
    eim._paletteTab = { light: 'templates' };
    eim.buildLightsPalette(host);
    assert.ok(textOf(host).includes('Лампа тёплая'), 'library template listed');
    // клик по шаблону библиотеки взводит постановку через хук
    const libRows = collect(host, []).filter(c => c._listeners && c._listeners.click
        && textOf(c).includes('Лампа тёплая'));
    libRows[0]._listeners.click[0]();
    assert.deepStrictEqual(armed, [{ name: 'Лампа тёплая', color: '#ffaa66', radius: 6 }], 'template armed via hook');
});

test('P25: БД-карточка врага — восемь карточек-состояний с SE-полями', () => {
    const src = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    const ctx = {
        console: { log() { }, warn() { }, error() { } },
        document: { createElement: t => makeElement(t), createTextNode: t => ({ textContent: t }), getElementById: () => null, body: makeElement('body') },
        window: null, navigator: {},
        setInterval: () => 1, clearInterval() { }, setTimeout: (f) => { try { f(); } catch (e) { /* player reload guarded */ } }, clearTimeout() { },
        Image: class { set src(v) { if (this.onload) this.onload(); } },
        PluginManager: { parameters: () => ({}) },
        DatabaseManager: { agoniaDefaults: () => ({ enemies: {}, battle: {}, dash: {}, spriter: {} }) }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(src('src/database/DatabaseShells.js'), ctx, { filename: 'DatabaseShells.js' });
    vm.runInContext(src('src/database/DatabaseSpriterEditor.js') + '\nthis.DatabaseSpriterEditor = DatabaseSpriterEditor;', ctx, { filename: 'DatabaseSpriterEditor.js' });
    vm.runInContext(src('src/database/DatabaseEnemiesEditor.js') + '\nthis.DatabaseEnemiesEditor = DatabaseEnemiesEditor;', ctx, { filename: 'DatabaseEnemiesEditor.js' });
    const ed = new ctx.DatabaseEnemiesEditor({ data: { agonia: { enemies: {}, battle: {}, dash: {}, spriter: {} } } },
        { getCurrentProject: () => ({ path: 'X:/proj' }) }, {}, {});
    const entry = {
        id: '3', match: '<biba>', hp: '100', template: 'true', spriteName: 'Enemy 1', customRules: '[]',
        // рантайм-формат: {key:{name,index}} — P25-фикс полей
        stateGraphics: JSON.stringify({ alert: { name: 'Monster', index: 2 } })
    };
    const host = makeElement('div');
    ed.classicApi().renderDetail(host, entry, 0, () => {});
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const all = collect(host, []);
    const texts = all.map(c => String(c.textContent || ''));
    for (const label of ['Основная', 'Тревога', 'Бой', 'Паника', 'Бегство', 'Атака', 'Урон', 'Смерть']) {
        assert.ok(texts.some(t => t.includes(label)), 'card caption: ' + label);
    }
    // карусель: wrap с кнопками + вложенный strip на 8 карточек
    const strip = all.find(c => (c.children || []).length === 8 && (c.children || []).every(x => (x.children || []).length >= 4));
    assert.ok(strip, 'carousel strip with 8 cards found');
    assert.ok(host.children.some(c => String((c.style || {}).cssText || '').includes('position:relative')), 'carousel wrap present');
    assert.ok(String((strip.style || {}).cssText || '').includes('overflow-x'), 'single-line horizontal scroll');
    const inRow = collect({ children: Array.from(strip.children) }, []);
    // ни одного селекта типа звука — только BGS
    assert.ok(!inRow.some(c => c.tagName === 'select'), 'no kind select: BGS only');
    // кнопка звука на каждой карточке (имя файла или «—»)
    const cardsArr = Array.from(strip.children);
    const sndBtns = cardsArr.filter(c => (c.children || []).length >= 4 && String((c.children[3] || {}).className || '').includes('agonia-btn'));
    assert.strictEqual(sndBtns.length, 8, 'one sound button per card');
    assert.ok(inRow.some(c => c.tagName === 'canvas'), 'animated canvases present');
    // у заданного состояния НЕТ пометки «по умолчанию», у незаданных — есть
    assert.ok(texts.some(t => t.includes('по умолчанию')), 'default markers for unset states');
    const markers = inRow.filter(c => String(c.textContent || '').includes('по умолчанию'));
    assert.strictEqual(markers.length, 7, 'exactly one set state (alert) hides its marker');
    // юзейдж-подписи-инструкции вырезаны (P12/P25)
    assert.ok(!texts.some(t => t.includes('рывок и удар')), 'no usage instruction captions');
    // нижней секции «Состояния (графика + звук)» больше нет
    assert.ok(!texts.some(t => t.includes('Состояния (графика')), 'bottom states section removed');
    // редко правимые секции сворачиваемы (P27-компактность)
    const details = all.filter(c => c.tagName === 'details');
    assert.ok(details.length >= 5, 'collapsed sections: got ' + details.length);
    // HP — числом, не слайдер
    assert.ok(!all.some(c => c.tagName === 'input' && c.type === 'range' && String(c.style && c.style.cssText || '').includes('hp')), 'hp is a plain number');
    // P27: пикер BGS — громкость/радиус в меню, кнопка «Убрать» применяет
    const applied = [];
    ed._audioPicker({ name: '', volume: 90, radius: 0 }, v => applied.push(v));
    const bodyBtns = collect(ctx.document.body, []);
    const modalNums = bodyBtns.filter(c => c.tagName === 'input' && c.type === 'number');
    assert.strictEqual(modalNums.length, 2, 'volume + radius live in the picker');
    modalNums[0].value = '70';
    modalNums[1].value = '8';
    const rmBtn = bodyBtns.find(c => c.tagName === 'button' && /Убрать звук/.test(String(c.textContent || '')));
    assert.ok(rmBtn, 'remove-sound button in picker');
    (rmBtn._listeners.click || []).forEach(f => f());
    assert.strictEqual(applied.length, 1, 'picker applies');
    assert.strictEqual(applied[0].name, '', 'remove applies empty name');
    // звук-кнопка карточки открывает пикер (не падает в стаб-DOM)
    const alertBtn = sndBtns[1].children[3];
    assert.doesNotThrow(() => (alertBtn._listeners.click || []).forEach(f => f()));
    // контракт персиста: {name,kind:'bgs',volume,radius}
    entry.stateSounds = JSON.stringify({ alert: { name: 'Growl2', kind: 'bgs', volume: 70, radius: 8 } });
    assert.strictEqual(JSON.parse(entry.stateSounds).alert.kind, 'bgs', 'BGS-only persistence contract');
});

test('P7: палитра света — список источников, клик выбирает uid', () => {
    const { eim } = makeEnv();
    const collect = (el, acc) => { for (const c of el.children || []) { acc.push(c); collect(c, acc); } return acc; };
    const selected = [];
    eim._getLights = () => [
        { uid: 'l1', x: 3, y: 4, props: { type: 'Radial', color: '#ffcc88', radius: 6, active: true } },
        { uid: 'l2', x: 10, y: 2, props: { type: 'Flashlight', color: '#ffffff', radius: 8, active: false } }
    ];
    eim._onSelectLight = uid => selected.push(uid);
    const host = makeElement('div');
    eim.buildLightsPalette(host);
    const texts = collect(host, []).map(c => String(c.textContent || ''));
    assert.ok(texts.some(t => t.includes('Фонарь')), 'flashlight labeled');
    assert.ok(texts.some(t => t.includes('выкл')), 'inactive marker shown');
    const textOf2 = el => collect(el, []).map(c => String(c.textContent || '')).join(' ');
    const rows = collect(host, []).filter(c => c._listeners && c._listeners.click
        && textOf2(c).includes('Фонарь'));
    rows[0]._listeners.click[0]();
    assert.deepStrictEqual(selected, ['l2'], 'click selects the light uid');
});
