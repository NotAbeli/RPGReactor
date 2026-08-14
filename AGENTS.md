# AGENTS.md — Agonia Engine (RPG Reactor fork)

Форк [RPG Reactor](https://github.com/Psychronic-Games/RPGReactor) v0.96.0 (MIT). Редактор + рантайм RPG-движка, совместимый с проектами RPG Maker MV/MZ. Стек: NW.js, PixiJS v8, three.js (3D-редактор, лениво), Effekseer. Node >= 22.

## Команды (из `app/`)

- `npm test` — node:test, сьюты в `app/test/`
- `npm run dev` — запуск редактора в NW.js
- `npm run build:win|build:mac|build:linux` — дистрибутив
- `node build-scripts/generate-plugin-catalog.js` — регенерация `app/plugins/catalog.json` (обязательно после добавления/удаления плагинов; тест упадёт, если забыть)

## Структура

- `app/src/` — редактор (ProjectManager, ProjectController, MapEditor, MapEditor3D, TilemapManager, PluginManager, LightManager, ...)
- `app/runtime/` — игровой рантайм (`reactor_main`, `reactor_core`, `reactor_managers`, `reactor_objects`, `reactor_scenes`, `reactor_sprites`, `reactor_windows`, `reactor_mv_compat`, `reactor_plugins`)
- `app/plugins/` — каталог плагинов движка (50 .js + `catalog.json`)
- `app/build-scripts/` — сборка (worker_threads) и генераторы
- `specs/` — спецификации фич (см. `engine-plugin-catalog.md`)
- `AGONIA ENGINE/`, `AGONIA ENGINE - PLUGINS/` — упакованные NW.js-сборки (в git не входят)
- `Право на Жизнь - Актуал/` — игровой проект MV, **отдельный git-репозиторий** (в корневое репо не входит)

## Архитектура каталога плагинов

Загрузка: `<проект>/js/plugins/<name>.js` (локальный override) → каталог движка по абсолютному `file:///` URL.
Резолв каталога: env `RPGREACTOR_PLUGINS_DIR` (плейтест) → `enginePluginsDir` в `project.rpgreactor` (прямой запуск). Реализация: `PluginManager.resolveEnginePluginsDir`/`makeUrl` в `app/runtime/reactor_managers.js` (~3299); для MV-проектов — идемпотентный сниппет-патч `ProjectManager.MV_CATALOG_LOADER_SNIPPET` в конец `js/rpg_managers.js`. Тесты: `app/test/`.

Конвенции имён: reactor-`makeUrl(filename)` принимает имя **без** `.js`; MV-сниппет `loadScript(name)` — **с** `.js` (наследие MV `setup`).

## Готчи (проверено на этой машине)

- **«Два значения 48»**: 48 — это и размер тайла в px (менять можно), и формат кодирования tile ID автотайлов (`(tileId - 2048)/48`, `% 48` — менять НЕЛЬЗЯ). Слепой find-and-replace «48 → 24» ломает движок.
- `fs.rmSync` на этой Windows оставляет файл в листинге (POSIX delete-pending при чужих хендлах) — для удаления использовать `fs.unlinkSync` с rmSync-fallback.
- Кириллица в `node -e "..."` из PowerShell ломается (argv ANSI→UTF-8) — пути с кириллицей передавать через UTF-8 файл-скрипт. PowerShell-скрипты с кириллицей — сохранять в UTF-8 **с BOM**.
- `app/src` и `app/runtime` — браузерные глобальные скрипты без module.exports; тестировать через `node:vm` с моками `document`/`process`/`require` (см. `app/test/plugin-resolution.test.js`).

## Git

- Теги точек отката: `fork-baseline` (f281fbb, базовый коммит форка), `pre-plugin-migration` (4e5e2ab), `rollback-before-plugin-migration`.
- История откатов через `git reset --hard` — перед крупными правками фиксировать тег/коммит.
- Память проекта (страницы wiki, сессии): глобальный vault `~/loam-memory` (qmd-коллекция `global-memory`), страницы `agonia-*`.
