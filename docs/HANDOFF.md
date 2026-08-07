# Handoff — 0.98.0 in progress

Last updated 2026-08-06. Delete or rewrite this when the items below are closed.

**0.97.0 shipped on 2026-08-03** — tagged, pushed, and published at
<https://github.com/Psychronic-Games/RPGReactor/releases/tag/v0.97.0>, source
only with no attached binaries. 0.98.0 is open: version surfaces bumped,
`[Unreleased - 0.98.0]` sections at the top of both changelogs.

Eight commits are **not pushed**, deliberately — the plan is to push once at the
end of the weekend with the rest of 0.98.0 rather than in pieces. Oldest first:

```
d9bb943  audio player list sizing, and 0.98.0 opened
cba16de  this handoff, rewritten for a cold start
bdf4b77  3D maps drawn from parallaxes
6a24450  <3d ground> / <no 3d object>
2a4cb5a  window contents clipped where the window is        (PIXI 8)
6d551af  stripped plugins' settings read from their shape
019ca35  every tile layer gets the tileset                  (PIXI 8)
5cbceaa  ParticleContainer draws its sprites                (PIXI 8)
```

Push with `git push origin main` — git will ask for a username and a personal
access token, since the remote is HTTPS and there is no credential helper. `gh`
is not installed.

Releasing is now one command and is documented in the README:

```
node editor/build-scripts/cut-release.cjs 0.98.0
```

Pushing the tag is what publishes the release — `publish-release.yml` builds the
notes from that version's changelog section and creates it with the token GitHub
gives the run. Nothing to remember, no token to hold. Give the Actions run a
minute before concluding it failed; that cost an hour on 0.97.0.

## Start here, 2026-08-06

Three PIXI 8 compatibility bugs closed, and they turned out to be the same bug
three times, which is the useful part to carry forward: **v8 removed shared,
globally mutable renderer state, and plugins had been depending on it without
ever naming it.**

- One implicit filter coordinate space became per-container, so `filterArea` is
  read as *local* and multiplied by the world transform. Every plugin that
  reimplements `Window._updateFilterArea` writes the screen-space rect the
  engine documented, so the clip region landed off screen and every window's
  contents vanished while its frame kept drawing. Fixed by writing world space
  on all versions and converting afterwards, so a plugin's version lands right
  without cooperating.
- One global batcher and one stencil state became per-pipe, so no `WindowLayer`
  subclass's `render` may run on v8 at all — the rule is the class, not the
  missing call.
- One shared tile atlas became per-layer image lists, so a tile layer a plugin
  adds to the tilemap draws nothing unless `_updateBitmaps` hands it the
  tileset. TF_Billboard puts every ☆ tile that also has passage flags on its own
  layer; on a wooded map that is the trees, and each lost exactly those tiles.

`PIXI.ParticleContainer` was closed pre-emptively on the same reasoning: v8 kept
the name and renders only `particleChildren`, so `addChild(sprite)` draws
nothing. Found by inventorying every `PIXI.*` member the runtime and bundled
projects reference against what v8 provides and what the shim restores. That
scan **cannot see obfuscated plugins** — they address PIXI through string
arrays — so it is a floor, not a clean bill of health.

Two more v8 divergences are real but have no confirmed caller here, and were
deliberately left alone rather than shimmed on spec: `extract` /
`generateTexture` given a display object rather than a render texture (v8
computes no bounds for containers that render through sub-layers, so the result
comes back empty), and filters on containers Reactor rebuilds.

### Two heuristics that would have saved hours

- **The editor runs no plugins.** "Correct in the editor, wrong in the game" for
  anything drawn on a map means a plugin first, not tile logic. A long detour
  went into diffing tile formulas and sheet bounds before that landed.
- **Ask the user to paste a console snippet from their own playtest.** The CDP
  harness could not reach Project 3's maps at all: the pre-title plugin owns the
  scene, autorun events transfer the player straight back out, `SceneManager.goto`
  never completes behind those plugins, and a minimized NW.js window dies at
  `Scene_Boot` with a 0×0 canvas so it cannot be hidden. It also kept putting
  windows on the user's screen. One snippet that ran `_addSpot` per cell inside a
  try/catch and dumped each layer's `_elements` answered in a single round trip
  what six harness runs had not.

### Project 3 (Haven), the MZ compatibility test bed

Its plugins were run through an annotation stripper — every `/*:` and
`/*~struct~` block removed, ordinary comments left intact — so the Plugin
Manager had no schema to show for 41 VisuStella files and 9 others. Not
VisuStella's doing: for six plugins where both copies are the same version,
deleting only those blocks from a fresh download reproduces the shipped file
byte for byte.

27 of 41 are now restored from the user's own downloads, 8 of them upgraded,
with their `[Version]` tokens in `reactor_plugins.js` synced to match — VisuStella
halts the game on a mismatch, which reads as a freeze. Originals are in
`template/Project3/plugins-stripped-backup/`. The remaining 14 fall back to a
schema inferred from the saved values' shape, gated so a parameter is only
offered as structured when saving it reproduces the stored text byte for byte.

**Removing a still-stripped plugin in the Plugin Manager destroys its settings
permanently** — no schema to rebuild the form and no defaults in the file.
`reactor_plugins.js` is the only copy of that game's configuration.

Also worth knowing: the project runs **32px tiles** (`tileSize: 32`), which is
unusual enough to be worth suspecting whenever something there measures wrong.

### Still open from this session

- Regions and object designations are not drawn in the 3D map view. Acknowledged
  gap, not started.

## 3D map objects — the open edges, 2026-08-03

The 3D map-object system landed and is the thing with unfinished edges. In
rough order of value:

1. **Per-object 3D shape override.** A painted map object inherits its shape
   from the tiles it contains, and there is no way to say "this whole group is
   a panel" or "…is scenery" outright. The control is trivial and the plumbing
   is not: cut-outs, panels and masses take genuinely different paths through
   the renderer, so a dropdown writing a field nothing reads would be worse
   than no dropdown. This is the last piece of the feature.
2. **A wall box has no top.** What covers a wall is a roof, and the tileset's
   wall→roof pairing already names the tile — but that pairing is wired into
   the mass path, not the cut-out path. Looking down at an Upright wall from a
   high angle shows through it.
3. **Cross-sheet draw order.** Cut-outs are emitted north to south, which fixes
   ordering within a merged buffer, but geometry is merged *per sheet* and
   three.js sorts those meshes by distance. Two overlapping things drawn from
   different sheets can still order wrongly.
4. **The gateway on map 596 of Star Shift Rebellion** is still declared 7x7
   with every role `S`. Now that the map-object tab exists it is the better fix
   than editing roles: group it and mark its ground rows Footing. That project
   is gitignored, so its data is local only — and it already carries one hand
   edit, `data/Tilesets.r3d.json`, backed up beside itself as
   `.bak-before-role-fix`.

## How to work on the 3D geometry

Do not reason from screenshots. `Reactor3D.Geometry` is pure and runs in plain
Node against real project data, and every 3D fix this cycle came from measuring
it rather than looking at it:

```js
const Reactor3D = require('./runtime/reactor_3d.js');
Reactor3D._classification = JSON.parse(fs.readFileSync('<project>/data/Tilesets.r3d.json'));
const built = Reactor3D.Geometry.build(map, { /* predicates */ });
```

Anchors, footings, facade planes and quad counts all fall out of `built`, and a
wrong answer is obvious in a way it never is on screen. `pngjs` under
`editor/node_modules` renders sheet art when the question is about the picture
rather than the geometry.

## Needs testing before it can be called done

**Non-48 tile sizes — the arithmetic is now covered by test at all four sizes;
what remains is a look at a real project.** Project3 was opened and the map
itself renders correctly. Two things were still wrong and are now fixed, both
of them sites the original sweep did not cover:

- The tile palette kept the *previous* project's tile size. The map canvas is
  constructed per project and reads the size on the way up; the palette is built
  once and kept, and only ever refreshed at that first construction. Opening
  Project3 from a 48-pixel project gave a correct map beside a palette measured
  in 48s. `loadTilesetForMap` re-reads it now, so every map load covers it.
- Event graphics were fitted to a hardcoded 48 and overflowed their tile. Fixed
  in `EventManager`, `EventPageEditor` and `TransferPlayerEditor`; the sweep's
  file list now includes all three.

**Since covered by test, at 48, 32, 24 and 16:**

- The map rendering itself. `tile-size-rendering.test.cjs` runs the real
  `TilemapManager` over every autotile kind and shape, every A1 animation
  frame, A5 and all six B–G sheets. The assertion that matters is the last:
  the rectangle read at a smaller size *equals the rectangle read at 48 scaled
  by the same ratio the sheets are*, so a smaller project reads the same cells
  of the same layout. A wrong formula built out of `TILE_WIDTH` passes the
  source sweep and fails this.
- A 48-pixel project moving. It cannot: the scale is exactly 1 there, and the
  same test pins 48 as the reference every other size is compared against.
- The tileset editor's overlay marks, which did **not** fit below 32 and now
  do — see the changelog. `markScale` is capped at 1, so 48 and 32 are
  untouched.

Still worth a human eye on Project3, with the editor **restarted**:

- Map 024 (Intro - Citadel Entrance), the originally reported map, against RPG
  Maker MZ's own rendering. The test proves the sampling is self-consistent and
  correctly scaled; it does not prove it matches MZ, which only the corpus and
  an eye can do.
- Database → System 2: change the size with a map open and confirm it redraws.
- An event whose graphic is a *tile* rather than a character, taken from the
  right-hand half of a B–E sheet — that sampling was wrong in every project,
  not only 32-pixel ones, and the fix is untested against a real sheet.

Two sweeps guard this, and they answer different questions. `tile-size.test.cjs`
sweeps nine files for bare pixel 48s — extend the file list rather than fixing
by hand. `tile-size-rendering.test.cjs` runs the arithmetic. Neither alone is
enough: the first cannot tell a right formula from a wrong one, and the second
only sees the files it drives.

Known and deliberate: `Game_Map.tileWidth` returns `$dataSystem.tileSize`
unvalidated while the editor coerces an unrecognised value to 48, so a damaged
`System.json` saying 64 would draw at 64 in game and 48 in the editor. That is
MZ's own behaviour on the runtime side and the editor being defensive on the
other; it is left alone.

**The web build not booting.** `EditorInstanceBroker` required `os` in its
constructor and the web host throws for anything but `fs`, `path` and `url`, so
the editor died before drawing. Load the web build and confirm it starts.

- Related and *not* addressed: `PlaytestManager`, `ReactorClipboard` and
  `ProjectController` also require `os`, but from inside methods rather than
  constructors. They will not stop boot, and they will throw if those paths are
  reached in a browser. Deciding which features should be reachable on web at
  all is the real question there.

## The 3D Shape editor

Had a legibility pass this session, from a report that selecting an object was
confusing. Three boxes were being drawn at once — the object's outline, the
selection tracing the same rectangle, and the per-cell highlight the other edit
modes use — and a multi-cell object was marked in its top-left corner, so it
read as one corner standing up. Now: one box and a wash for a selected object,
the class drawn in the middle of what it describes, and the selection dropped
when the tileset or the mode changes.

Covered by `editor/tests/tileset-3d-overlay.test.cjs`, which drives the real
`drawTile3DOverlay` through a recording canvas. The scratch renderer that turns
those recorded operations into an SVG is worth rebuilding before touching this
again — the flat-bar collision it caught was invisible to the assertions.

Still open here:

- The tool buttons, the key and the preview panel are hardcoded English,
  pending the translation pass noted under 0.96.0.
- Declaring an object is a two-step corner click on the sheet but a drag with
  the Object tool; the two paths are easy to confuse and only one is hinted.
- Nothing shows which tiles of the open tileset are still unclassified, so
  there is no way to tell a deliberate Auto from one never looked at.

## 3D in game: working, first time ever

It renders. Star Shift Rebellion's 200x200 world map draws at ~180 FPS.

Getting there took six fixes in a chain, each hidden behind the next, because
every one of them failed as an identical black screen. In order:

1. three.js never finished loading — the scene was built in the same tick the
   fetch started, so `shouldRender3D` was always false.
2. The scene was then built from tileset bitmaps that had not loaded.
3. A throw while building left `Scene_Map.isReady` reloading the map every
   frame forever, taking a WebGL context each time.
4. `Reactor3D.isSupported` took a WebGL context per call and never gave one
   back — and every character sprite calls it every frame.
5. The game canvas had no alpha channel: PIXI decides that once, at init.
6. `Spriteset_Base`'s `_blackScreen` — a full-screen opaque sprite in every
   scene — was painted over the 3D canvas before anything else.

The lesson worth keeping: **instrument before inferring.** The report in
`createReactor3D` (meshes, textures, camera, canvas, scene bounds) and the
`Viewport.probe()` pixel read settled in one run each what several rounds of
reading code did not. Both are still in the runtime; keep them.

Known and not addressed:

- The screen tone and colour filter live on `_baseSprite`, so they do not
  reach the 3D ground. Tinting a 3D map does nothing to the terrain.
- Lighting plugins draw into the PIXI scene and so sit over the 3D ground
  rather than interacting with it.
- The 3D canvas renders at the game's logical resolution and is scaled up by
  CSS, matching the 2D canvas. Fullscreen is therefore soft rather than crisp.

## 3D, day two: driven from the running game

Everything below was measured against Star Shift Rebellion on map 612
(Moletown) with save 10, not inferred from screenshots. That change of method
is the main thing to carry forward: several rounds earlier in the day were
spent reasoning from pasted images and each produced a fix that broke something
else.

**The harness is in `scratchpad/`** and has no dependencies — node 26 has a
WebSocket, and there is a small PNG decoder for reading pixels back.

| Script | Answers |
|---|---|
| `cdp.mjs` | launches the bundled NW.js with devtools and drives it |
| `moletown.mjs` | boot, load a save, wait for the map to *actually* be there |
| `compare.mjs` | the same spot in 3D and in 2D, side by side |
| `region.mjs` | what plane and lift every cell's art was built at |
| `aligned.mjs` | a sign's top edge against the wall course it should meet, along a walk |
| `marker.mjs` | one known light, hidden everything else: does the pipeline land where it predicts |
| `signs.mjs` | every sign against the art around it |

Three traps cost real time and will cost it again:

- **Waiting for the wrong thing.** `$gameMap.mapId()` flips before the transfer
  completes and `$dataMap` is swapped in separately, so checking the id alone
  reads the *previous* map — a 3D map reports itself flat and the wrong size,
  which looks exactly like a rendering bug.
- **Loading a save while another map is live.** `$gameMap` and `$dataMap` then
  disagree, `YEP_SaveEventLocations` throws every frame from inside the
  outgoing scene's update, the fade never finishes and the scene change is
  refused forever. It presents as "the game hangs".
- **Chromium stops animating a window nobody is looking at.** Screenshots come
  back black or stale. `--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding` and `--disable-background-timer-throttling`
  are in the launch flags for this reason.

### Verified, with numbers

- A known marker lands within 0.8 px of where the projection says, at five
  camera positions, walking both axes. The camera and the canvas compositing
  are exact, so any remaining drift is a *placement* disagreement rather than a
  projection one.
- A sign's top edge meets the wall course above it to 0.0 px across a full walk
  up the y axis, and the gap does not change.
- Eight of the nine signs on Moletown share a plane with everything around
  them.

### Known and open

- **MOLE TOWN's sign sits one plane in front of part of its scaffolding**, so it
  still creeps slightly against its posts. It is the single case the shipped
  footing rule gets wrong; see *Where one structure ends* in
  `docs/DESIGN-3D-WORLDS.md` for the five rules tried and why this one was
  chosen anyway.
- **Light cones lie on their surface**, so a searchlight pointing up a tower
  reads as pointing along the ground. Placement is right; direction in the
  vertical is not modelled.
- **The screen tone still does not reach the 3D ground**, unchanged from
  yesterday.

### Do not re-fight these

- The merge rule. Five variants were tried and each fixed one case while
  breaking another; the table in the design doc records what each broke. If a
  sixth idea appears, test it against the *shopfronts* at (12, 12) as well as
  the gateway — that pair is what every rule failed on.
- Sizing a sprite from one tile and multiplying. Perspective is not linear;
  measure across the sprite's own frame.
- Combining a wall's footing and the lift up it into one number. The lift runs
  along an axis that leans with the camera.

## Pairing a wall autotile with its roof — done, but read this

**Implemented as the Roof tool**, after the attempt that surfaced it: selecting
a wall kind and a roof kind on A3 and declaring them one object, with the roof
laid flat. Objects are rectangles *of a sheet*, and an autotile id is a corner
arrangement rather than a position in a drawing, so A1–A4 still refuse that —
the refusal is visible now rather than silent. Pairing is a different statement
and has its own tool.

It is stored in a new `materials` map in `Tilesets.r3d.json` — `{ top: tileId }`
per wall kind — rather than in `standIns`, which stays what it was: where a
foliage cut-out takes its picture from. `Reactor3D.topFaceFor` reads the
authored pairing first and falls back to the A4 derivation, so a stock tileset
needs no authoring at all and Infernis-style A3 roofs can be named.

Not done: `side` and `edge` materials. Only `top` is read, because only the top
had a case that could not be derived. The rest of the plan's material record is
still a plan.

## 3D, still a first pass

The full list is in the 0.96.0 changelog under "Still in progress" and at the
end of `docs/devlogs/2026-07-25-rpg-reactor-0.96.0.md`. In rough order of how
much they hurt:

1. ~~**Interior wall tops take the wall's own face art.**~~ Fixed — see the
   roof section above.
2. **Forests read as cover rather than as individual trees**, and ranges as
   texture rather than peaks. The source is right (the terrain's lone variant,
   autotile shape 46); the arrangement is not settled.
3. **Pits stand up.** Their art blocks movement exactly like a rock, and nothing
   in a tileset separates a hole from an object. Set those tiles to Flat in the
   3D Shape editor, once per tileset — or find a better signal.
4. **No parallax or sky.** `parallaxName` is ignored; the editor paints a flat
   theme colour and the runtime clears opaque black.
5. **Painting rebuilds the whole scene.** Fine at 101x51, noticeable at 200x200.
   Incremental rebuild is the fix.
6. Event dragging, region overlays and layer highlighting are absent from the 3D
   view. Battles are 2D and unchanged.

Declared objects and roles are new and only lightly used: the generator seeds a
declaration per solid rectangular block of prop art, which on the bundled world
map is eight. Most props still fall back to the adjacency guess, which is known
to weld two objects that sit side by side on the sheet *and* on the map.

## Tools worth knowing about

- `node editor/build-scripts/cut-release.cjs <x.y.z>` — one command from a clean
  tree to a published release. `--dry-run` reverts its own edits.
- `node editor/build-scripts/derive-tileset-3d-classes.cjs <project>` — fills in
  a project's 3D tile classification from how its maps are painted.
- `scratchpad/` — the harness that drives the real game over devtools: load a
  save, walk the camera, screenshot, and measure. See *3D, day two* above. It is
  gitignored (it had grown to 58MB and was about to be committed) and has no
  dependencies; it is worth rebuilding rather than eyeballing screenshots, which
  is how most of a day went.

## Posts ready to publish

- `docs/posts/itch-devlog-0.96.0-plain.txt` — the itch.io devlog, plain text,
  paragraphs unwrapped so a paste does not break into lines.
- `docs/posts/release-notes-0.96.0.md` — already used as the GitHub release body.
