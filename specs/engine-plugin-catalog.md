---
title: Engine-managed plugin catalog (move project plugins into the engine)
slug: engine-plugin-catalog
status: approved # approved by user via clarification answers (2026-08-14)
created_at: 2026-08-14 12:00:00 +03:00
updated_at: 2026-08-14 12:00:00 +03:00
approved_at: 2026-08-14 12:30:00 +03:00
research: []
---

# Engine-managed plugin catalog (move project plugins into the engine)

## Problem

The game project «Право на Жизнь - Актуал» carries all RPG Maker MV plugins in `js/plugins/` (50 active files + a large inactive archive). The user wants plugins to live in the engine (RPG Reactor / Agonia Engine), be managed, configured and loaded directly by the engine, with the project's plugin files removed.

## Clarifications

- Q: How should the game find plugins when they are absent from the project's `js/plugins/`?
  A: User chose: load from the engine by absolute path (`js/plugins` of the project stays empty; the engine loader falls back to the engine plugin catalog).
  Status: answered
- Q: What to do with the inactive plugin archive (`js/старые/`, ~120 files)?
  A: User chose: move only the 50 active plugins into the engine catalog. The archive stays in the project untouched.
  Status: answered
- Q: Which engine binary does the user run for «Право на жизнь»?
  A: The packaged Windows build (`AGONIA ENGINE/RPG Reactor.exe`), not `nw .` from `app/`. The catalog must therefore ship with the distribution as a real folder next to the executable (the Windows build packs editor JS inside the exe itself, so files inside the package are not addressable as stable absolute paths for other processes).
  Status: answered
- Q: Where does the runtime learn the engine catalog path at playtest time?
  A: Assumed design: playtest spawn passes `RPGREACTOR_PLUGINS_DIR` env var (primary); `project.rpgreactor` may carry `enginePluginsDir` as fallback for launching the project NW process directly without the editor.
  Status: assumed
- Q: Does deployment (game build) still need plugin files inside the output?
  A: Yes — deployed games must be self-contained; the build materializes enabled plugins from the engine catalog into the staged project `js/plugins/` (web builds cannot use absolute file paths at all).
  Status: assumed

## Scenarios

### Scenario: catalog is the source of available plugins in the editor

- Given the engine has `app/plugins/` (+ `catalog.json`) and a project is open
- When the user opens the Plugin Manager
- Then the "available plugins" list comes from the engine catalog, merged with any leftover local `js/plugins` files (local wins on name collision)
- And plugin metadata (description/help/author/struct definitions) is read from the catalog when no local file exists
- Verify with: manual — open Plugin Manager on «Право на жизнь» after migration; all 50 plugins listed with parameters

### Scenario: playtest loads plugins from the engine catalog

- Given a project whose `js/plugins/` is empty and whose manifest (`plugins.js`/`reactor_plugins.js`) enables plugins present in the engine catalog
- When the user starts playtest from the editor
- Then the playtest NW process receives the engine catalog path and the runtime plugin loader resolves each enabled plugin: local `js/plugins/<name>.js` if present, else the engine catalog absolute path
- And the game boots with all enabled plugins active
- Verify with: manual playtest; no "Failed to load" plugin errors

### Scenario: direct project launch without the editor (fallback)

- Given a migrated project with `enginePluginsDir` recorded in `project.rpgreactor` and the engine installed at that path
- When the user launches the project's NW process directly (not via editor)
- Then the loader uses the recorded path and plugins still load
- Verify with: manual — run nw.exe in the project folder

### Scenario: MV-corescript project support («Право на жизнь»)

- Given the project runs the MV corescript (`js/rpg_*.js`), whose `PluginManager` is defined in the project's `js/rpg_managers.js`
- When the migration command runs
- Then the engine applies an idempotent loader wrapper into `js/rpg_managers.js` (marked block) implementing the same catalog fallback as the Reactor loader
- And the project's `js/plugins/*.js` active plugin files are deleted (manifest `plugins.js` with parameters kept)
- Verify with: manual playtest from editor and direct launch

### Scenario: deploy stays self-contained — failure path avoided

- Given a migrated project and a deploy request
- When the build stages the project
- Then enabled plugins are copied from the engine catalog into the staged `js/plugins/` so the deployed game needs no engine installation
- Verify with: manual deploy then run the built game without the engine

### Scenario: engine distribution ships the catalog

- Given a Windows editor distribution build
- When the build finishes
- Then a real `plugins/` folder exists next to `RPG Reactor.exe` (not only inside the packed exe payload)
- Verify with: build + `Test-Path <dist>/plugins`

### Scenario: missing plugin in both locations — edge path

- Given an enabled manifest entry whose file exists neither in the project nor in the catalog
- When plugins load
- Then the existing error behavior is preserved (script load error surfaces), and the Plugin Manager marks the entry as missing but keeps it
- Verify with: manual — disable a catalog file temporarily

## Scope

### In

- Engine plugin catalog at `app/plugins/` with `catalog.json` (50 active plugins; already staged)
- Runtime loader fallback to the catalog (Reactor corescript `reactor_managers.js` + MV wrapper patch for the MV project)
- Editor `PluginManager` (src) resolves available plugins/metadata from the catalog
- Playtest passes the catalog path to the child process; `project.rpgreactor` fallback field
- Migration command in the editor that: patches MV loader, removes project plugin files, records fallback path
- Deployment materializes enabled plugins into the staged build
- Distribution build includes `plugins/` next to the exe (win/linux) and inside app payload (mac)

### Out

- Moving the inactive archive (`js/старые/`) into the engine
- Renaming/rewriting plugin sources themselves
- Web editor mode playtest changes (web builds get plugins via deployment materialization only)
- Plugin parameter editor UI redesign

## Constraints

- No destructive operations on the project without a prior backup of removed plugin files (move to a backup folder or zip before deletion)
- The manifest file name the project already uses (`plugins.js` for MV, `reactor_plugins.js` for Reactor projects) keeps working; editor keeps writing to the same file
- Loader changes must be idempotent and marked so repeated migrations do not double-wrap
- Windows paths with spaces (e.g. `AGONIA ENGINE`) and Cyrillic project paths must work (proper `file:///` URL encoding)
- `app/plugins` files must not be modified by project operations (read-only master copies)

## Acceptance criteria

- [ ] Editor Plugin Manager lists catalog plugins as available when project `js/plugins` is empty (Scenario 1)
- [ ] Playtest of «Право на жизнь» boots with `js/plugins/` empty, loading all enabled plugins from the engine catalog (Scenario 2)
- [ ] Direct NW launch of the project loads plugins via the recorded `enginePluginsDir` fallback (Scenario 3)
- [ ] Migration patches MV `rpg_managers.js` idempotently and removes project plugin files after backing them up (Scenario 4)
- [ ] Deployed build contains materialized `js/plugins` and runs standalone (Scenario 5)
- [ ] Editor distribution ships `plugins/` as a real folder next to the executable (Scenario 6)
- [ ] Missing-plugin error behavior unchanged (Scenario 7)

## Decision

Engine-owned plugin catalog with absolute-path loading:

1. `app/plugins/` + `catalog.json` is the single master library (already staged by a previous session; `generate-plugin-catalog.js` regenerates).
2. Resolution chain at plugin load time (both Reactor and MV-patched loaders): project `js/plugins/<name>.js` (local override) → engine catalog absolute path. Catalog path resolution: `RPGREACTOR_PLUGINS_DIR` env → `project.rpgreactor:enginePluginsDir` → give up (local-only behavior).
3. Editor resolves the catalog directory the same way `ProjectManager.getRuntimePath()` does (cwd-based candidates + packaged-distribution candidate next to the exe) and passes it to the playtest child process.
4. Migration is an editor command, per project, with backup before file removal.
5. Deployment copies enabled plugins into the staged build; distributions ship the catalog folder next to the exe.

## Rejected alternatives

- Auto-syncing `js/plugins` in the project before every playtest/save (user explicitly chose the absolute-path model; also pollutes the project and VCS)
- Moving all ~120 archive plugins into the catalog (user chose active-only)
- Patching only the Reactor corescript loader (would not serve «Право на жизнь», which still boots the MV corescript)

## Key files / modules

- `app/plugins/` + `app/plugins/catalog.json` + `app/build-scripts/generate-plugin-catalog.js` (catalog)
- `app/runtime/reactor_managers.js` (runtime PluginManager loader)
- `app/src/PluginManager.js` (editor UI; available-plugins scan, metadata, struct source paths)
- `app/src/PlaytestManager.js` (spawn env)
- `app/src/ProjectManager.js` (+ catalog dir resolver, migration helpers, project.rpgreactor field)
- `app/src/ProjectController.js` (menu command for migration)
- `app/build-scripts/build.js` / `build-worker.js` (deploy materialization)
- `app/build-scripts/dist-editor-worker.js` (INCLUDE_DIRS + real folder next to exe)
- `Право на Жизнь - Актуал/js/rpg_managers.js`, `js/plugins.js`, `js/plugins/` (migration target)

## Completeness checklist

| Area | Status | Notes |
| ---- | ------ | ----- |
| Behavior | pass | loader fallback, editor sources, deploy, migration defined |
| Scenarios | pass | 7 scenarios incl. failure/edge |
| Scope | pass | in/out explicit |
| Constraints | pass | backup, idempotency, path encoding, read-only catalog |
| Interfaces / contracts | pass | env var name, project.rpgreactor field, catalog dir candidates |
| Data / migration | pass | manifest kept; plugin files removed after backup; idempotent patch |
| Errors / edge cases | pass | missing plugin, dead engine path, name collisions |
| Security / privacy | n/a | local desktop app, no secrets |
| Integrations | pass | NW.js child process env, packaged distribution layout |
| Operations / rollout | pass | migration is opt-in per project; old behavior preserved when catalog absent |
| Verification | pass | manual checks named per scenario; `npm test` where applicable |
| Planning inputs | pass | key files listed |
| Open questions | pass | none blocking |

## Open questions

- none
