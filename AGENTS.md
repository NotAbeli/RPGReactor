# AGENTS.md — Agonia Engine (RPG Reactor fork)

Форк [RPG Reactor](https://github.com/Psychronic-Games/RPGReactor) v0.96.0 (MIT). Редактор + рантайм RPG-движка, совместимый с проектами RPG Maker MV/MZ. Стек: NW.js, PixiJS v8, three.js (3D-редактор, лениво), Effekseer. Node >= 22.

## Команды (из `app/`)

- `npm test` — node:test (93 теста), сьюты в `app/test/`
- `npm run dev` — запуск редактора в NW.js (единственная живая сборка: дистрибутивной нет)
- `npm run build:win|build:mac|build:linux` — дистрибутив
- `node build-scripts/generate-plugin-catalog.js` — регенерация `app/plugins/catalog.json` (обязательно после добавления/удаления плагинов; тест упадёт, если забыть)
- `node build-scripts/convert-plugin-commands.js <проект> [флаги]` — мигратор легаси-команд (356/357 → нативные 700+) и утилиты проекта: `--plugin <имя>` (скоуп), `--dry-run`, `--reseed-agonia` (пересобрать `data/AgoniaEngine.json` из тюнинга engineModules), `--harvest-all` (все остатки манифеста → engineModules/disabledPlugins), `--print-order` (порядок загрузки без запуска игры)
- `node build-scripts/restore-mv-runtime.js <проект>` — вернуть MV-corescript из `rpgmaker-runtime-backup.zip` и перепатчить мост v2 (идемпотентен)

## Структура

- `app/src/` — редактор (ProjectManager, ProjectController, MapEditor, MapEditor3D, TilemapManager, PluginManager, LightManager, DatabaseAgoniaEditor, ...)
- `app/src/event/commands/agonia/` — реестр нативных команд (`NativeCommands.js`) + schema-driven диалог (`NativeCommandDialog.js`)
- `app/runtime/` — reactor-рантайм (**спящий**: проект на нём не запускается, но зеркальные command7XX поддерживаются)
- `app/plugins/` — каталог плагинов движка (50 .js + `catalog.json`)
- `app/build-scripts/` — сборка (worker_threads), генераторы, миграторы
- `specs/` — спецификации фич (см. `engine-plugin-catalog.md`)
- `AGONIA ENGINE/` — упакованная NW.js-сборка (в git не входит; **устарела** — не содержит фиксов моста)
- `Право на Жизнь - Актуал/` — игровой проект MV, **отдельный git-репозиторий**

## Архитектура: проект на MV-рантайме + мост Agonia (v2)

Игра работает на **родном MV-corescript** (Pixi 4, оригинальный ФПС/визуалы). В конец `js/rpg_managers.js` вшит сниппет `ProjectManager.MV_CATALOG_LOADER_SNIPPET` (маркер `__rpgReactorCatalogV2`):

1. Каталог плагинов: `<проект>/js/plugins/<name>.js` (override) → каталог движка по `file:///`. Резолв: env `RPGREACTOR_PLUGINS_DIR` → `enginePluginsDir` из `project.rpgreactor`.
2. Wrap `PluginManager.setup`: мерж `engineModules` из `project.rpgreactor` в `$plugins` (порядок сохранён: якоря только на status:true + dep-sort pending; разделители/выключенные записи не якорят) + мерж `data/AgoniaEngine.json` поверх параметров модулей (строкификация MV). Манифест проекта **пуст** — все 49 плагинов живут в конфиге проекта под git.
3. Нативные команды `Game_Interpreter.command700..751` (48 шт.): свет (700–709), камера (710–714), сундуки (715–719), лут (720/724), враги (721–723/749), движение (725/726), утилиты (730–733/747/748), крафт/подсказки/метки (734–736/750), титулы/презентация (737/740–746/751). Делегируют в живую MV-цепочку `pluginCommand`.
4. **MV-контракт вызова**: `executeCommand` кладёт параметры в `this._params` и зовёт хендлер **без аргументов** — каждый command7XX обёрнут адаптером (`rrAdapt`), резолвящим params из `this._params`. Тесты зовут команды так же (без аргументов) — иначе регрессия не ловится.
5. Input-харднинг: пад-кнопка должна прожить 2 опроса (дрейф-спайк → фантомное «ok» на титуле), синтетические (`!isTrusted`) события стопаются на capture, при фантомном OK — разовый warn в консоль.
6. Спрайты презентации: Text Pop (740, цвета `\c[n]` из windowskin) и Слайды (741–745, wait-mode `agoniaSlide`).

БД «Движок Agonia» (`data/AgoniaEngine.json`, редактор в `DatabaseAgoniaEditor`): секции `stamina` → SuperDuperMovement, `lighting` → SDLight. Сид: engineModules → манифест → дефолты (`agoniaSeedValues`); normalizeDataSystem добивает MZ-блоки MV-проектам (advanced/titleCommandWindow + ранний resize — MV-splash-плагины не зовут Scene_Boot.start).

Reactor-рантайм (Pixi 8) — **не выкатывать на проект**: опробован, ломает ФПС/визуалы (CRT-шейдер, legacy super-вызовы). Правки зеркалятся туда для будущего, но рабочий путь — MV-мост.

## Готчи (проверено на этой машине)

- **«Два значения 48»**: 48 — размер тайла в px (менять можно) и формат tile ID автотайлов (`(tileId - 2048)/48`, `% 48` — менять НЕЛЬЗЯ).
- `fs.rmSync` оставляет файл в листинге (delete-pending) — использовать `fs.unlinkSync` с rmSync-fallback.
- Кириллица в `node -e` из PowerShell ломается — пути передавать через UTF-8 файл-скрипт; .ps1 с кириллицей — UTF-8 **с BOM**.
- `app/src` и `app/runtime` — браузерные глобальные скрипты; тестировать через `node:vm` с моками `document`/`process`/`require` (см. `app/test/mv-native-bridge.test.js`).
- Мост-сниппет правится в `ProjectManager.MV_CATALOG_LOADER_SNIPPET`, **не** в патченном `js/rpg_managers.js` проекта; деплой — `restore-mv-runtime.js` (перепатчивает идемпотентно).
- Не параллелить NW-плейтесты с правками файлов проекта: старые окна держат прежний код в памяти и врут в консоли (стек-номера строк от прежней версии файла).
- Дистрибутивная сборка редактора устарела/удалена; **БД «Движок Agonia» открывать только из `npm run dev`**, пока сборка не пересоздана (старый сид перезаписывал AgoniaEngine.json дефолтами).

## Git

- Теги: `fork-baseline` (f281fbb), `pre-plugin-migration` (4e5e2ab), `pre-native-commands` (= fork-база перед командами), `native-commands-baseline` (bbff1cd: мост v2 + input-харднинг, 93 теста).
- История откатов через `git reset --hard` — перед крупными правками фиксировать тег/коммит.
- Память проекта: глобальный vault `~/loam-memory` (qmd `global-memory`), страницы `agonia-*`.

## GitHub

- Remotes: `origin` = NotAbeli/RPGReactor (main — канон Agonia Engine), `upstream` = Psychronic-Games/RPGReactor (жив, 0.98.1 при нашей базе 0.96.0 — cherry-pick выборочно).
- Аутентификация HTTPS: Git Credential Manager. `gh` CLI не залогинен; `$env:GH_TOKEN` через `"protocol=https`nhost=github.com`n`n" | git credential fill`.
- Сеть сбоит перемежающе (DPI) — ретраи; запасной транспорт SSH-over-443 в `~/.ssh/config`.
- Коммитить только по явной просьбе; пушить в origin после завершённых блоков работы.
