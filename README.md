# RPG Reactor

RPG Reactor 0.97.0 is an open-source, cross-platform RPG game editor and runtime for RPG Maker MV/MZ-compatible projects. RPG Reactor provides its own modern PIXI 8-based runtime while preserving compatibility with RPG Maker project data and targeting backwards compatibility with both RPG Maker MZ and MV plugins, including mixing plugins from both engines within a single project through complementary MZ and MV compatibility layers.

Use RPG Reactor to create, edit, playtest, and package 2D RPGs with familiar RPG Maker-style maps, events, database records, plugins, and deployment workflows, without depending on the original RPG Maker runtime or editor.

Pre-built download binaries are available at <https://psychronic.itch.io/rpg-reactor>. The current development version is 0.97.0 and is not published yet; the latest tagged source release is [0.96.0](https://github.com/Psychronic-Games/RPGReactor/releases/tag/v0.96.0).

## Repository Layout

```text
RPGReactor/
├── editor/   # RPG Reactor editor app source
├── runtime/  # Game runtime corescript copied into new projects
├── template/Demo/ # Bundled Reactor One starter project
├── docs/     # Maintainer workflows and project notes
├── RPGReactor.sh / .bat / .command
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Documentation

- [Editor README](editor/README.md): detailed feature list, source launch steps, project structure, shortcuts, and technical notes.
- [Changelog](CHANGELOG.md): GitHub-facing release progress and links to the detailed editor changelog.
- [Handoff notes](docs/HANDOFF.md): what is in flight in the current cycle, what still needs testing against a real project, and where the unfinished 3D work stands.
- [RPG Reactor 0.96.0 overview](docs/devlogs/2026-07-25-rpg-reactor-0.96.0.md): release explanation of the deep correctness audit, the authored-data oracle, the event-command and database fixes it produced, the 3D map renderer, and a closing section on what in 3D is not finished.
- [RPG Reactor 0.95.0 overview](docs/devlogs/2026-07-18-rpg-reactor-0.95.0.md): prior-cycle explanation, including source-audited localization, expanded database workspaces, complete Conditional Branch editing, safer large-map workflows, and restored MV/YEP save compatibility.
- [Maintainer docs](docs/README.md): workflows that are useful for project maintenance but are not required for normal editor use.
- [Release checklist](docs/RELEASE-CHECKLIST.md): exact maintainer commands for validated, signed GitHub and optional itch.io publication.

## Feature Overview

- **Full RPG Maker-style editor**: map editing with four tile layers, autotiles, shadow pen, and region painting; a visual event editor with 100+ commands, multi-page events, every MZ Conditional Branch form, collapsible block structures with persisted fold state, and optional advanced expressions, loops, input conditions, event calls, and picture controls beyond the stock MV/MZ editors; complete database editors with dense Types and Terms workspaces; a multi-channel audio player; and multi-instance editing with a cross-window typed clipboard.
- **Modern PIXI 8 runtime**: the game runtime (`runtime/`) is a fully migrated PIXI v8 corescript. Tilemaps, UltraMode7, Effekseer particle effects, video, and shaders all run on current PixiJS instead of the legacy renderer RPG Maker ships.
- **MZ + MV plugin compatibility**: complementary MZ and MV compatibility layers let existing RPG Maker plugins run unmodified on the new runtime, including mixing plugins from both engines in a single project. Stock MV/YEP LZString saves, MOG interfaces, video parallaxes, and custom local/browser save keys are supported. Validated against a large commercial MV game running a 168-plugin stack (Yanfly, Victor Engine, MOG, SRD, and the LeTBS tactical battle system).
- **Resilient resource loading**: the runtime watchdogs every database, image, and audio load from its own frame tick. Silently-dying requests (slow disks, cloud-synced folders) retry automatically, and genuinely missing files degrade gracefully with a clear console error instead of hanging the game on a black screen.
- **The Forge, in-editor asset generators**:
  - **Animation Generator**: 76 procedural 2D animations across four categories, including Portal, with layered composition, per-layer keyframe timelines, a 3D shape pipeline, custom textures, and export to bake-ready sprite sheets or animated GIFs.
  - **Effekseer Animation Generator**: create native Effekseer particle effects (`.efkefc`) from 106 recipes across nine categories without the external Effekseer editor: 21 sci-fi interface instruments with user-typed text, physical battle hits, 15 energy recipes, elements, a custom-effect Composer, and more; wireframe or solid-textured rendering with custom texture upload; layers, keyframes with texture cross-fades, live in-editor preview through the game's own Effekseer runtime, and one-click export. The tracked suite validates generated format/model round trips, every recipe at default/extreme/swept values, composition, and real-WASM playback.
  - **Character Generator**: bundled Psychronic and Looseleaf styles plus procedural Outfit Forge and Hair Forge tools that generate RPG Maker-style walking-sheet parts, with live 4-direction walk previews, multiple hair styles, palette systems, and save-to-library output. Psychronic remains the default style.
  - **Sound Effect Generator**: procedural sfxr-style sound design on Web Audio, baked to 16-bit WAV in the project's `audio/se/`. 29 archetypes across RPG SFX and tuned instruments, six waveforms including a physically modelled Karplus-Strong pluck, 27 parameters, live waveform/envelope/pitch visualizers, and a 16-step sequencer for jingles and stingers.
- **Build & deploy**: one-click isolated playtests; cross-platform game packaging for Windows, macOS, Linux, and Web; optional Linux AppImages for games and the editor; configurable NW.js releases and runtime locales; optional staged PNG/OGG optimization; and an editor distribution builder with SHA-256 checksums.
- **Source-audited 18-language localization** across editor-generated interface text, with locale-key and placeholder validation, Arabic right-to-left direction, and project-authored game content deliberately left untouched; plus a theme system with multiple color palettes in light and dark modes.

## What's New in 0.97.0

The full list is in the [changelog](CHANGELOG.md); the 3D work is written up in
[docs/devlogs](docs/devlogs/2026-08-02-3d-objects-on-the-map.md).

0.97.0 is a 3D cycle. 0.96.0 introduced HD-2D maps — ground flat, walls and
buildings standing, characters as 2D sprites on the same grid — and this is the
release that makes them authorable.

- **3D objects are declared on the map.** A tileset can say what a *tile* is and no more: an autotile id is a corner arrangement shared by forty-eight shapes, so every shop built from one wall kind is the same tile as every other, and an autotile has no place in a drawing for a declared rectangle to point at. Which cells make up one building is a fact about a placement, so there is now an **Objects** tab beside Regions where object numbers are painted onto the map. Cells sharing a number are one object however they are arranged, with a **Footing** brush for the rows that are the ground it stands on rather than courses of its height. This is what holds a sign still against the wall it is painted on.
- **Buildings are solid.** Wall runs build as boxes rather than a single plane facing south, so walking round a shop no longer thins it to a line, and a raised wall is capped with the roof its tileset pairs with it. A new **Panel** shape covers things with a front — a gate, a door, a shopfront — which stand still and face a direction instead of swinging to follow the camera.
- **Lights are lights, not pictures of light.** Reactor reads the lights a lighting plugin owns and puts them in the 3D scene, so a lantern pools on the ground and climbs the walls. **MVNovaLighting** and **PSYCHRONIC_RaveLighting** are covered, neither is modified, and it is opted into per map with `<3d lights>`.
- **Characters walk behind things**, are sized by depth so they share the map's perspective, and stand on whatever their cell's art was stood up into — including scenery events with move routes that never leave home.
- **Editing in 3D**: fly the camera with WASD, see which cell the cursor is over, drag events, and read them at a glance from the boxes drawn round them. Escape lets go of whatever is held.
- **Tile sizes other than 48** are honoured across every editor surface, and a page set to Custom movement can finally be given a route.

## Development Launchers

The root launcher scripts are for opening RPG Reactor from a source checkout while developing or testing the app. They are not the final packaged game/editor executables; they start the editor through a local NW.js runtime that you download separately.

| File | Platform | Purpose |
|------|----------|---------|
| `RPGReactor.sh` | Linux | Opens the editor with `nwjs-linux/nw` |
| `RPGReactor.bat` | Windows | Opens the editor with `nwjs-win/nw.exe` |
| `RPGReactor.command` | macOS | Opens the editor with `nwjs-mac/nwjs.app` |

Each script looks for the matching `nwjs-*` folder at the repository root or inside `editor/`, then launches the app from `editor/`.

## Run From Source

RPG Reactor runs as an NW.js desktop app. Source development and release tooling require Node.js 22 or newer. Source checkouts include the bundled Reactor One Demo, but do not include NW.js platform binaries, `node_modules/`, build output, saves, or other local project templates.

1. Clone the repository:

```bash
git clone https://github.com/Psychronic-Games/RPGReactor.git
cd RPGReactor
```

2. Install the editor dependency:

```bash
cd editor
npm ci
cd ..
```

3. Download NW.js for your platform from <https://dl.nwjs.io/>. Use the normal or SDK build for your OS and CPU architecture.

4. Extract NW.js and rename/place the extracted folder at the repository root:

```text
RPGReactor/
├── editor/
├── runtime/
├── nwjs-linux/   # Linux: contains the nw executable
├── nwjs-win/     # Windows: contains nw.exe
└── nwjs-mac/     # macOS: contains nwjs.app
```

You can also place the same `nwjs-*` folder inside `editor/`; the launchers check both locations.

5. Launch RPG Reactor:

```bash
# Linux
chmod +x RPGReactor.sh
./RPGReactor.sh

# Windows
RPGReactor.bat

# macOS
chmod +x RPGReactor.command
./RPGReactor.command
```

For direct NW.js launch during development:

```bash
cd editor
../nwjs-linux/nw .
```

## Tests

```bash
cd editor
npm test
```

GitHub Actions runs the same suite from a clean checkout, including syntax, project scaffolding, runtime manifests, save safety, localization no-fallback checks, cross-instance clipboard transport, database and event-command serialization, map sampling and exact autotile placement, picture extensions, project lifecycle security, runtime compatibility, deployment, and release policy/signing gates. Current 0.97.0 validation completed with **1,057 passing tests and no failures**.

## Runtime

The `runtime/` folder contains the player-facing corescript (`reactor_*.js`) and runtime libraries. The editor copies this folder into newly created game projects under `js/`.

## License

RPG Reactor-owned code is licensed under the MIT License in [LICENSE](LICENSE).
Bundled third-party components remain under their respective licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No single license is asserted
for third-party files or user/project content.

## Cutting a release

One command, from the repository root. It is the whole process — there is no
separate `git push`, and nothing else needs remembering.

```
node editor/build-scripts/cut-release.cjs 0.97.0
```

Git asks for a GitHub username and password during the push. The password is a
personal access token, not an account password; GitHub stopped accepting those
years ago. Any token with `repo` scope works, or a fine-grained one with
`Contents: read and write`.

It runs the editor test suite, rolls the version surfaces (changelog heading,
README, `editor/package.json`), commits, tags, pushes the branch and tag, and
then prints a link to publish the release — because a tag on its own is not a
release, and its absence looks exactly like the push having failed.

`--dry-run` reports what it would do and leaves the tree untouched. `--no-push`
stops after tagging.

### Publishing without the click

Set `GITHUB_TOKEN` and the release is created as well, with that version's
changelog section as its body:

```
GITHUB_TOKEN=ghp_yourtoken node editor/build-scripts/cut-release.cjs 0.97.0
```

In fish, `set -x GITHUB_TOKEN ghp_yourtoken` on its own line first. Git still
prompts for the push unless a credential helper is configured; this one hands it
the same token and writes nothing to disk:

```
git config --local credential.helper '!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'
```

### Downloads are a separate step

This publishes the tag and the release notes. It does not build or sign
binaries: `release-candidate.yml` builds and signs the native artifacts and
`release.yml` attaches them and pushes to itch.io. Both are GitHub Actions
workflows, started from the repository's Actions tab. A release without them is
a source release — it exists and is marked latest, with no files attached. See
[docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) sections 5 to 8.
