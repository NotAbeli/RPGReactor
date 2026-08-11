# Handoff - 0.98.1 In Progress

Last updated 2026-08-10.

## Release State

- 0.98.0 is tagged and published at
  <https://github.com/Psychronic-Games/RPGReactor/releases/tag/v0.98.0>.
- 0.98.1 is open in package metadata, application startup surfaces, both
  READMEs, and `[Unreleased - 0.98.1]` sections in both changelogs.
- 0.98.1 contains the Web 3D dependency-loader fix, the desktop 3D crash-loop,
  Windows native-crash and lifecycle hotfixes, and the PIXI 8 legacy-filter
  shader and camera-pan tilemap fixes. None is part of the immutable `v0.98.0`
  tag or an artifact built from it.
- Current validation is **1,304 passing tests** with no failures, skips, or
  TODOs. Syntax and `git diff --check` also pass.

## Web 3D Fix

The Web checkbox was not disabled. It was checked and immediately rolled back
because `MapEditor3D.ensureLibraries()` only knew how to find a desktop
filesystem `runtime/` directory. WebHost has no Node `process`, and its immutable
runtime scripts are URL-addressable rather than available through synchronous
`readFileSync()`.

The Web package already ships the required canonical files under the bundled
project:

- `project/js/libs/three.js`
- `project/js/reactor_3d.js`

`MapEditor3D` now detects WebHost and loads those classic scripts lazily and in
order through `host.assetUrl()`. Desktop keeps the existing filesystem loader.
The in-flight promise is shared so rapid toggles cannot append duplicate scripts,
and a failed request clears the promise so a transient failure can be retried.

Regression coverage verifies:

- construction does not eagerly load three.js;
- WebHost requests both project runtime URLs in order without consulting the
  desktop runtime path;
- a second activation reuses the loaded globals;
- a failed dependency names its project path and remains retryable;
- a freshly built Web archive contains byte-identical copies of both canonical
  runtime files while the outer editor page does not load three.js eagerly.

## Desktop 3D Startup Recovery

0.98.0 persisted `map3DView: true` before renderer initialization. The setting
is global to the NW.js profile, so deleting the project does not remove it. Any
later project load retries 3D, and the old failure path changed the setting only
in memory. This explains reports that enabling 3D once makes every later project
open crash.

The post-release fix fails closed:

- a new process clears any saved 3D preference before auto-opening a project;
- durable state is false before any library, geometry, or WebGL work and becomes
  true only after a successful initial render;
- activation is single-flight and can be cancelled while libraries load;
- exceptions roll back to 2D instead of becoming unhandled rejections;
- Three.js shares PIXI's existing WebGL2 context instead of creating a second
  context that can terminate the Windows ANGLE path;
- teardown disposes Three-owned resources without losing PIXI's context, resets
  PIXI's GL state and dimensions, and resumes its ticker;
- stale asynchronous rebuilds cannot commit after teardown;
- project close tears down 3D before destroying the PIXI map;
- a render exception stops the frame loop and clears the preference; and
- maps above 40,000 cells or 400,000 estimated source quads are refused before
  full-scene allocation. The verified 200x200 production map remains supported.

The immediate Windows failure was reproduced by its platform boundary: native
Linux used its own EGL/GLES path successfully, while the Windows executable used
the Windows ANGLE/D3D path even under Wine. A real NW.js WebDriver smoke test now
opens a disposable copy of Reactor One, enables 3D, renders the complete 50x50
scene (10 sheets, 3 map meshes, and 63 events), disables 3D, and confirms PIXI's
canvas and ticker are restored. The same test passes in native Linux NW.js and in
the Windows NW.js binary under Wine.

## Project3 Legacy Filter Fix

The ten Haven screenshots are one incident shown at different scroll positions.
Project3's bundled Pixelate filter declares PIXI 4/5's `filterArea` uniform and
uses `.xy` for the logical input size and `.zw` for the filter-frame origin. The
PIXI 8 bridge removed the declaration and translated only `.xy`, leaving the
undeclared `.zw` reads that fail shader compilation. `Bitmap.snap()` lazily
compiled that filter while capturing the battle background, after which PIXI
repeatedly attempted to bind the invalid program.

The bridge now:

- maps `filterArea.xy` to `uInputSize.xy` and `filterArea.zw` to
  `uOutputFrame.xy`;
- maps legacy `filterClamp` to `uInputClamp`;
- accepts low, medium, and high precision uniform declarations; and
- excludes all PIXI 8 filter globals from plugin-owned uniform discovery so
  zero defaults cannot overwrite PIXI's live frame values.

The runtime sync updated Demo plus the six local templates carrying this core.
A real NW.js Project3 render instantiated its bundled `PixelateFilter`, rendered
it through PIXI 8, and completed with no captured shader errors or warnings and
`glError: 0`.

For someone still running the affected 0.98.0 package, open Developer Tools at
the welcome screen and run:

```js
const s = JSON.parse(localStorage.getItem('rr-settings') || '{}');
s.map3DView = false;
localStorage.setItem('rr-settings', JSON.stringify(s));
location.reload();
```

If the last project auto-opens too quickly, temporarily rename that project
folder first. As a fallback, close every Reactor process and rename the NW.js
profile directory so a clean profile is created. Project files are not stored
in that profile.

## Project3 Camera-Pan Flicker Fix

The PIXI 8 tilemap update synchronized its transform and mesh before
`Spriteset_Map.update()` assigned the current camera origin. A later
render-transform pass could notice the new origin, call `_addAllSpots()`, clear
the visible mesh, and leave the replacement commands dirty until the following
frame. Diagonal movement made those one-frame gaps recur as flicker.

`Spriteset_Map` now assigns the current origin before the child update cascade.
Every repaint immediately synchronizes all tile layers, including plugin-added
layers, before returning. Regression coverage checks both ordering and atomic
repaint behavior.

Project3 still showed smaller distortions along object seams because the PIXI 8
compatibility bridge also invoked the complete plugin-wrapped tilemap transform
from `onRender`. Live instrumentation measured two or three preparations in one
frame. This matters for `TF_Billboard`, which composes tall objects from 19
independently positioned and sorted row layers. Tilemap preparation now runs
exactly once from `Tilemap.update()` before rendering; Window and TilingSprite
retain their required render hooks. A rebuilt Project3 smoke test drove 23 mesh
layers through a 360-frame diagonal out-and-back pan with one preparation per
frame and no hidden, dirty, fallback, or missing-layer frame.

## Deployment Note

Publishing the 0.98.1 source does not modify the 0.98.0 Web ZIP or an itch.io Web
channel. Build and deploy a new 0.98.1 Web artifact from the patch tag. Browsers
may retain an older service worker briefly; after deployment, reload the page
once (or clear the site's service worker/cache) before testing the checkbox.

## Remaining Manual Gates

- Open the rebuilt Web package over HTTPS or localhost and confirm the 3D
  checkbox stays checked, the canvas appears, and switching back restores the
  2D map.
- On physical Windows, open Reactor One, enable 3D, orbit the map, disable and
  re-enable 3D, and confirm the editor process and 2D map remain intact.
- Run Windows launch and Authenticode checks on Windows with release credentials.
- Run macOS launch, signing, notarization, stapling, and Gatekeeper checks on
  macOS with release credentials.
- Region and object-designation overlays remain absent from the 3D viewport;
  this is an existing editor affordance gap, not part of the Web loading bug.
