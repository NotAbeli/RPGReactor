# RPG Reactor 0.96.0: A Deep Correctness Audit

RPG Reactor-owned code is MIT-licensed. Bundled third-party components retain
their respective licenses as recorded in `THIRD_PARTY_NOTICES.md`; the project
does not claim one uniform license for third-party or user/project content.

The 0.96.0 cycle began as a correctness audit and ended up carrying the largest
feature Reactor has taken on: a 3D renderer for ordinary RPG Maker maps.

The audit came first and remains the larger share of the work — a sustained,
file-by-file pass over the editor, the runtime, the build tooling and the asset
generators, with the test infrastructure needed to keep the results from
regressing. Roughly forty verified bugs were fixed, most of them silent:
commands that quietly rewrote themselves when reopened, records created without
fields the engine reads unconditionally, and editor arithmetic that disagreed
with the runtime performing the same calculation.

Then came tileset sheets F and G, and after them the HD-2D work described below.
Test coverage grew from 452 to 777 passing tests. Two editing features also
landed — collapsible event blocks and a non-destructive map resize — alongside
localization, performance and MV-compatibility work. This document remains a
draft until 0.96.0 is tagged and published.

## The bundled projects became an oracle

The single most productive change in this cycle was methodological. Reactor
ships and develops against real RPG Maker-authored projects, and those projects
are an authoritative description of the data format Reactor targets — far more
reliable than reading a specification or reasoning from memory.

Field sets, event-command parameter shapes, per-slot value types and value
ranges are now derived from that corpus: 1,300 maps, 37,000 events, 49,000 event
pages, and every database record across four projects. The derived shapes are
vendored into `editor/tests/helpers/authored-data-shapes.json` and regenerated
with a committed script, because most of those projects are private and absent
in CI. Two sweeps then run on every test invocation: every editor's emitted
parameter count is checked against the highest `params[n]` the matching
`Game_Interpreter.commandNNN` actually reads, and every new-record template is
checked against the fields authored records always carry.

That approach found bugs that no amount of reading would have. When 2,570 out of
2,570 authored `When [Choice]` markers carry two parameters and Reactor emits
one, there is nothing left to argue about.

## Commands no longer rewrite themselves when you open them

A recurring defect shape ran through the event command editors: a parameter slot
was written but never read back on load, or was read through `||`, which
discards a legitimate zero. Opening such a command and pressing OK silently
changed it.

`Game_Interpreter.iterateActorId` treats actor id `0` as *the entire party*.
Nine editors loaded that slot as `params[1] || 1`, so every party-wide command
collapsed onto the first actor the moment it was opened — 284 of 284 Change HP
commands and 376 of 379 Recover All commands in the bundled projects. The actor
dropdowns also began at index 1, so the value could not be expressed at all.
Both are fixed, and **Entire Party** is now selectable, translated across all
17 non-English locales.

Show Text lost a Top window position the same way: position `0` is Top and is
falsy, and 946 of 18,520 authored Show Text commands use it. Fadeout BGM and BGS
were authored in frames while `AudioManager.fadeOutBgm` hands the value to Web
Audio's `linearRampToValueAtTime`, which takes seconds — the default "1 second"
fade actually ran for a minute. Plugin commands lost their readable display
label, Scroll Map had no Wait for Completion control at all, and Set Event
Location's exchange mode parsed the partner character's id as a map id while
truncating the direction slot away.

## New database records now work in game

`getDefaultTemplates` was diffed against the corpus and four record types were
short of fields the runtime reads without checking. Each failed differently and
silently. A new **skill** could not be used by any actor, because
`isSkillWtypeOk` opens with `requiredWtypeId1 === 0 && requiredWtypeId2 === 0`
and `undefined === 0` is false. A new **weapon** never appeared in the equip
list, because `changeEquip` compares `equipSlots()[slotId] === item.etypeId`. A
new **item** set the user's TP to `NaN` for the rest of the battle, because
`applyItemUserEffect` computes `Math.floor(item.tpGain * tcr)`. A new **state**
produced no battler pose and no overlay. A new **animation** played once at the
centroid of the target group instead of once per target.

Because `createBlankDatabaseEntry` also backs the Clear action and the null-slot
repair pass, these reached existing projects, not only new records.

## The editor and the runtime are checked against each other

Where the editor computes something the game also computes, divergence is a bug
by construction — the editor's preview stops describing what will happen. Three
such pairs are now pinned by tests that lift the runtime implementation out of
`reactor_objects.js` and run both over a shared input matrix.

Actor stat curves and EXP curves agree across eight curve shapes and fifteen
levels, including Reactor's extension past the stock level-99 ceiling. Tileset
terrain tags are read and written the way `Game_Map.terrainTag` reads them: an
unmasked `flag >> 12`. That last one uncovered a real defect — setting a terrain
tag on a flag with bits above 15 set produced a value the editor displayed as 3
and the engine read as 11443, so the control appeared to work and changed
nothing the game could see.

## Data safety and shipping hygiene

`Tilesets.json` and `System.json` were still being written with a plain
truncate-in-place `writeFileSync`, which destroys the previous good file if the
process dies mid-write. `FsAtomic.js` exists precisely for this and names both
files in its own header. Both now use the shared atomic wrapper, and a sweep
walks every `writeFileSync` in the editor source, resolves its target through
nearby assignments, and fails on any that names a critical project file without
going through it.

Battle Test leaves a `Test_`-prefixed copy of all fourteen database files in
`data/` and never removes them. Neither deployment path excluded them, so every
release carried a complete duplicate of the database — 15 MB on one bundled
project, 13 MB on another — along with the developer's saved test party.

An event's Name and Note were interpolated into the editor's own interface
without escaping. In an NW.js window with Node enabled, markup from an imported
project would execute with full filesystem access. A durable sweep now parses
every template literal assigned to `innerHTML` across the editor source and
fails on any interpolation of user-authored text that does not pass through an
escape helper.

## Two failures that were invisible locally

The bundled Demo could not boot from a clean checkout. Two of its sixteen
startup scripts existed on disk but had never been committed, and the loader
only advances its counter on success — so the Demo stopped on the loading
spinner rather than degrading. It worked on the machine that wrote the files and
was broken for everyone else. Two editor sources referenced by `index.html` were
in the same state. Both `index.html` files are now swept for local `src`/`href`
targets that exist but are untracked.

The window title showed the bundled demo's name for every project. Reactor draws
its own titlebar under the Wine/Proton compatibility path, and that titlebar was
built from a literal string and never updated. A normal framed window keeps the
native titlebar, which is why the defect only appeared for packaged users.

## Mutation testing, and a fix that was left half-done

The audit's own guards were checked by mutation: sixteen deliberate breakages
were introduced into core logic to confirm the suite noticed. Fourteen were
caught. One survivor was an equivalent mutant — two independent path-traversal
guards, each sufficient alone — which was verified empirically rather than
assumed, and both are now pinned.

The other survivor was a real gap. The SE volume slider's `parseInt(...) || 90`
had been fixed on the save path earlier in the cycle, but the *preview* path
still carried it: dragging the volume to silence and pressing Play previewed at
90%. A file-wide sweep for the same shape now runs as a test, with an explicit
allowlist for the two sliders whose range cannot reach zero.

## Long event pages fold to their structure

Conditional Branch, Show Choices and Loop collapse from the arrow beside them,
with a badge showing the hidden line count so a folded row is never mistaken for
an empty branch.

Two decisions made it trustworthy. `findBlockEndIndex` matches a block's
terminator on indent rather than by counting openers, so a nested branch that
closes first cannot be read as the outer block's end. And fold state lives in a
`WeakSet` keyed on the opening command **object**, not its index — inserting a
command earlier in the page shifts every later index, which would leave the fold
on an unrelated command.

Persistence cannot use object identity, since commands are rebuilt from JSON on
load, so stored entries pin `index:code:indent`. A page edited since its fold
was saved fails to match and renders expanded rather than folding whatever moved
into that slot. Folds are scoped per project, map, event and page, and a fully
expanded page deletes its record, which keeps "everything open" the real default.

## Resizing a map stopped being destructive

Changing a map's dimensions discarded tiles and events silently, and events
outside the new bounds were not removed — they were left at coordinates the map
no longer had, invisible to the editor but still in the file.

`analyzeMapResize` now counts the tiles and names the events that would be lost,
and `saveMapProperties` changes nothing until that is confirmed. Stranded events
are removed.

The anchor picker came out of the same work: a nine-cell control chooses which
corner or edge content keeps, so a map can grow from the top or left.
`computeResizeOffset` turns the anchor into a tile offset that `resizeMapData`
walks, so one expression serves every anchor, and `top-left` is a zero offset —
byte-identical to the old behaviour. Events move with tiles, Set Event Location
commands on the map shift, `System.json` starts update, and Transfer Player and
Set Vehicle Location commands elsewhere that target the map are found and
offered for adjustment. Variable-designation commands resolve at runtime and are
left alone.

Map Properties was rebuilt to hold it: a fixed `85vh` regardless of content
became content-sized, with panels packed into two CSS multi-column columns. Two,
not three — General Settings is one indivisible tall panel, so a third column
strands a short panel beside a full-height gap.

## Beside the audit

Seven languages were showing large parts of the editor in English. Chinese
(Traditional and Simplified), Russian, Portuguese, German, French and Greek
inherited the English table, leaving roughly a third of the interface
untranslated — the entire Effekseer Forge, event page fields, toolbar tooltips.
All are complete, and the build now fails when a key ships without translations.

Two runtime defects shared one symptom. Drawing to a bitmap uploaded the whole
canvas to the graphics card on every draw operation, and window text colours
were re-read from the windowskin a pixel at a time on every use. Anything
redrawing text each frame paid both — the victory aftermath EXP count-up most
visibly. Uploads are batched and colours cached; that was the aftermath stutter.

Three MV compatibility fixes came from `Star Shift Rebellion`. MV animations on
actors are no longer mirrored (MZ flips them, MV never did — obvious on any
animation containing words), a choice arriving on a plugin-created message
window falls back to the scene's real choice window instead of crashing on null,
and a Set Movement Route with Wait no longer finishes a later event's route
instantly by watching a character that had already stopped.

## HD-2D: a 3D view of an ordinary map

The 3D renderer is a *view*. `Game_Map`, `Game_Character`, passability, regions
and the event interpreter are untouched and keep operating on the same
`width * height * 6` planes; nothing in the 3D path feeds back into game logic.
`Map###.json` is never rewritten, so a 3D map remains valid RPG Maker data
describing its 2D footprint, with elevation and camera in a `Map###.r3d.json`
sidecar. Three.js is fetched on first entry to a 3D map and appears in no
manifest, so a project with no 3D maps never downloads it. Compositing is by
stacked canvases — the arrangement the runtime already ships for Effekseer —
so PIXI keeps drawing windows, pictures, weather and plugin sprites unchanged.

### Classification is authored, because it cannot be derived

The first version guessed which tiles stand up from the 2D flags: impassable, or
draws-above-characters. That is wrong in both directions, and a world map shows
why. Mountains and forests are impassable, so they stood on end; and because a
standing run is drawn as a single plane at its southern edge, everything behind
that plane vanished. The same map gained scenery the author never placed and
lost scenery they did.

So it is authored, per tileset — a tile is the same kind of thing wherever it is
painted — in `Tilesets.r3d.json`. Guessing is now off by default; an
unclassified map renders flat, which is at least the map the author drew.

Three classes were needed, not two. **Upright** collapses a column of cells into
one facade as tall as the run, which is correct for a building drawn as a single
perspective prop — one bundled tileset draws towers fifty-one tiles high that
way. Applying that to terrain produced a fifty-eight tile wall of trees, because
a forest is the same tile repeated over an *area* rather than one tall picture.
**Scenery** raises the ground it sits on instead and takes its cliff faces from
the existing wall code, so a mountain range reads as a mass.

### The corpus settled the autotile edge rule

A user reported that a wall autotile painted against the map edge lost its end
cap, while the same wall one tile inward kept it. Reactor treated everything off
the map as more of the same tile, for every autotile. The authored maps in the
bundled projects decided it: of 8,455 wall autotiles sitting on a map edge,
91.3% store the capped shape and 2.4% the connected one — while 82.9% of the
83,674 floor autotiles on an edge store shape 0, the fully connected interior.
Ground and roofs run on past the edge; walls are closed off. The fix is scoped
to walls, and the counts are recorded in the test as the reason.

### A module that only worked inside a running game

Two defects shared one cause, and it is the lesson worth keeping. The geometry
builder read MZ's autotile shape tables from the global `Tilemap`, and the tile
classification from an XHR relative to the running game. Neither exists in the
editor. The tables silently degraded to `null`, and every autotile fell back to
blitting the top-left corner of its block: on a world map, 63,620 interior tiles
that should have been seamless rendered as a grid of bordered squares. The
classification simply never loaded, so every wall was guessed, rejected by the
height cap for being too tall, and then laid flat on the floor as ground texture.

A test had pinned the first of these as correct. It was named "without the
tables an autotile still draws something" and asserted the whole-tile fallback —
the bug, written down as the contract. The tables now ship inside the module,
extracted from `reactor_core.js` and pinned against it, and the editor hands the
runtime its classification directly.

The renderer was developed against a software rasteriser that runs the same
geometry and camera code offline, and against the editor itself driven by an
NW.js harness. Both earned their place. A numeric check reported no missing
ground while the picture plainly showed holes; rendering the sky in magenta
proved the quads existed and their texture was transparent, which located the
real fault — a lookup taking the top of a cell's layer stack, usually a
see-through decoration, where it wanted the floor at the bottom.

## Deferred, and recorded rather than silently fixed

Two findings are authored-data problems in the bundled projects rather than code
defects, and rewriting them is an authoring decision:

- Three animations in `template/Complex` (ids 386, 387, 388) have 18-cell
  frames. The 16-cell limit is stock RPG Maker behaviour, identical in MV and
  MZ, so their last two layers never render in any engine.
- Five tilesets in `Star Shift Rebellion` carry roughly 6,000 flags written by
  `Cyclone-Map-Editor-MV` with values above 16 bits, which the engine reads as
  nonsense terrain tags and garbage passage bits. Editing a tile's terrain tag
  now normalises it; no mass rewrite was performed.

One judgement call is recorded in the tests themselves. The `When Cancel` (403)
marker carries two parameters in authored data and Reactor emits none, but the
single authored instance holds `[6, null]`, whose leading value matches neither
the choice count nor the cancel setting. The interpreter reads nothing from it.
Emitting a guessed number would be worse than emitting none, so the check is
excluded with that reasoning written down rather than quietly skipped.
