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
Test coverage grew from 452 to 809 passing tests. Two editing features also
landed — collapsible event blocks and a non-destructive map resize — alongside
localization, performance and MV-compatibility work.

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

### The star flag is a lower bound, not a partition

A structure on the world map stood up as one flat cut-out hinged along its
bottom edge, which from an angle reads as card folded off the floor. The obvious
fix was to hinge at the star flag instead — MZ's ★ means "draws above the
character", so stand the starred rows and lay the rest flat — and the art itself
refuted it. The gantry beside the crater is three rows tall and **only its top
row is starred**, because that is the only row that has to overlap a character
standing behind it. Its legs are unstarred and would have lain on the ground
while the top hovered.

So ★ says "this tile is tall" and its absence says nothing at all. It cannot
locate where an object meets the ground, and no other flag can either. Which
means the fix was never a smarter hinge: it was to stop building a fixed plane.
Standing art turns to face the camera now, about the world's up axis, so there
is no wrong angle to be caught at and no need to know which way the object faces.

### An object has to turn as one thing

Cut-outs that turn fixed the folding and broke something else, which the user
spotted before I did: each column pivoted about its own centre, so a five-wide
structure came apart into five cards fanning towards the camera. Turning is only
correct for a whole object.

Grouping by plain adjacency then merged 408 cells of unrelated props across 44
by 27 tiles into one heap, because on a world map the props are dense enough to
form a chain across the region. What separates one picture from two is that a
picture's pieces are adjacent *on the sheet in the same direction* as on the
map: a tile one cell east is one cell east in the art. That test is exact, and
it takes the largest object on the map down to the 7x7 it was drawn as.

Walls are excluded. A wall belongs to a building and faces a particular way, so
it stays a fixed plane; swinging it to the camera would rotate the building.

Where the object turns matters as much as that it turns as one, because the
anchor is what its position reads as. Three points were tried. The southern
edge put a five-wide structure over its cells from the south and a tile clear of
them from the east. The footprint centre stopped the drift and started the base
hanging above the ground in front of it. The middle of the southern row — the
cell the art is drawn standing in — keeps the drift to half a tile and plants
the bottom edge.

### A wall is a mass

Surveying maps other than the one being reported on found the largest error of
the lot. A labyrinth of 4,800 wall autotiles rendered, from above, as bare floor
with a few slivers on it — the maze simply was not there — and obliquely a block
of wall eight cells deep stacked into an eight-tile tower.

Walls had been cut-outs, one per column, standing on the run's southern face.
That is the wrong shape entirely. A walled area is solid: raise the ground it
covers and the corridors are carved out of it, the vertical faces come from the
cliff code, and the overhead view is the map you drew. The rule that a prop is a
picture and terrain is a mass turns out to cover architecture too.

### Some things cannot be inferred, and the fix is to stop trying

The object grouping used a test that felt airtight: two cells belong to one
picture when they are adjacent on the map *and* adjacent the same way on the
sheet. It survived every map in the project — and the user spotted the hole by
reading the rule rather than by looking at a render. Put an ice mountain in
sheet columns 0-1 and a rock mountain in columns 2-3, paint them side by side,
and every neighbouring pair passes: one step apart on the map, one step apart on
the sheet. The two weld into a single four-wide object. A six-line synthetic
case reproduces it; none of the 491 objects on the world map does, which is
exactly why inference is dangerous — it had been right everywhere I had looked.

So objects are declared now. Shift-click two corners in the tileset editor and
those tiles are one thing. It also reaches the case adjacency never could:
autotile terrain, where every cell genuinely is its own tile and there is no
grouping to infer at all.

The second half is a separate flag, because it answers a separate question. A
tile's 3D class says what a loose tile is. A tile's *role* says what it does
inside the object it belongs to — stands, or lies flat. That is what lets a
launch pad stay on the ground while its towers stand, which no amount of reading
the passability flags could ever have told us.

### Height and the axis are different questions

The anchor of a standing cut-out does two jobs, and treating them as one cost
three rounds of getting it wrong. It is the point the billboard turns about, and
it is where the object's base meets the ground.

Anchoring on the southern *edge* put a five-wide structure a tile clear of its
own cells from the east. Moving to the footprint centre fixed that and left the
base hanging above the ground in front at a low camera — so the anchor went to
the middle of the southern row, which looked like a decent compromise and was
not one: a deep object then swung around its own front edge as the camera went
round, orbiting instead of turning on the spot.

They are separate. The axis is the middle of the footprint, because that is
where the object is. The height is the ground at the object's southern row,
because that is the ground it faces. Once the lean was gone, nothing tied them
together at all.

### The lean was the drift

Two complaints that sounded separate — objects sliding off their cells as the
camera orbits, and everything sitting slightly above the ground — turned out to
be one mechanism, and the arithmetic says so without a screenshot. A cut-out
leaning back towards the camera displaces its art horizontally from its anchor
by its height times the horizontal part of its up axis. At three quarters lean
and a 45 degree camera, the top of a six-tile object sits 3.4 tiles from the
point it stands on, and a quarter turn of the camera moves it 4.8 tiles. Upright,
that number is exactly zero at every angle.

The lean existed to stop cut-outs going edge-on as the camera climbs. That is a
real problem and it belongs to the camera: the orbit now stops at 72 degrees.
HD-2D games do not offer the overhead angle either, and this is why. The event
sprites in this same viewport had been yaw-only from the start, with a comment
saying exactly that; the tile cut-outs should have followed them.

### Overhead is where a billboard model is decided

Turning about the world's up axis is the conservative choice and it is wrong.
It holds while the camera is low, and as the pitch steepens every cut-out
approaches edge-on together, so a forest thins to slivers and from directly
overhead a wooded map renders as bare ground.

Facing the camera squarely — tilt included — fixes that and breaks the other
end: from directly above the cut-out lies flat, which reproduces the 2D map
exactly and stops the trees standing up, and standing up is the point.

So it leans part of the way, three quarters by default. Nothing is ever edge-on
and nothing ever lies down; overhead you look at foreshortened trees instead of
at their tops. The same compromise settled the canopy. Dropping the tiling art
from the floor was right from a low camera and wrong from above, where the 2D
canopy is unbroken and cut-outs alone left bare ground showing through — so the
art stays on the floor and the cut-outs stand on it, dense enough that little of
it shows from ground level.

Comparing the two views of the same region side by side is what settled both.
Neither was arguable once the 2D render and the 3D render were stacked.

Then a ground-level screenshot killed the canopy-on-the-floor half of it. The
tiling art of a terrain *is* that terrain seen from above, so drawing it flat
and standing cut-outs on it draws every cell twice, and the second copy shows as
a mat of canopy around the feet of the trees growing out of it.

The obvious repair was to use the autotile rule in three dimensions: a shape is
decided by which neighbours carry the same terrain, so cap the interior of a
mass with the tiling art and stand cut-outs only on its border, where the
silhouette is. Overhead it was ideal. From the ground it was terraces — a fringe
of trees with a flat brown plateau behind them — because a wood needs relief all
the way through, not only at its edge. So every cell stands its own cut-outs and
nothing lies flat. The border test is kept; the edge is still where the
silhouette lives, and something will want it.

### A forest is trees, and the tileset already drew one

Even classified correctly, a forest painted as a repeating texture has no good
reading in 3D. Extrude it and you get a wall of bark; raise it and you get a
plateau of bark. Both are wrong in the same way: tiling art is the *inside* of a
mass and has no silhouette of its own.

The answer was sitting in the tileset. Paint one isolated cell of a forest
autotile and MZ draws a single tree — that is shape 46, the shape with no
neighbours. A range gives a single peak. On a B–E sheet the same pairing is
there by convention: the tiling art at the bottom of an object block, the single
object drawn above it in the same columns. So foliage stands *that* on every
cell and leaves the ground flat underneath.

One detail cost a render to find. A lone variant is usually drawn over a block
rather than a single tile — the tree in `Infernis_World_B` fills 2x2 — so
pointing at its first tile alone stood up the top-left quarter of each tree, and
a hillside came out as a field of spikes. The stand-in records its span.

One tree per cell was still wrong, and for a reason no amount of better art
fixes: dead centre on every square, the eye finds the grid instantly and reads
an orchard. A cell carries a few instead, each scaled a little differently and
nudged off centre by a hash of its position — scattered, but the same scatter
every rebuild, because trees that jump when you paint elsewhere are worse than
trees in rows. The floor rises a fraction of a tile under a wood so it sits on
the land rather than being painted onto it, and the tiling art is no longer laid
flat as well: the ground already under it *is* the forest floor.

### Write the shader and you inherit nothing

The cut-outs came out darker than the same art lying flat beside them. A
`ShaderMaterial` gets what you write and nothing else: three.js converts a texel
from the texture's colour space to the screen's through a chunk the built-in
materials include, and mixes in fog through several more. Skipping them cost
both — the colour and the distance fade the editor's fog was supposed to give.

The fix was to stop writing a shader. `MeshBasicMaterial` with an
`onBeforeCompile` that replaces one chunk keeps every other chunk the flat tiles
use, which is the only way a tree is reliably the same colour as the ground it
stands on.

### Having three classes was not enough; something had to choose between them

Scenery existed and the world map still came up as a wall of bark, because the
project's classification file had been filled in from the tileset flags and the
flags cannot tell a shopfront from a forest. Both are impassable. Every forest
tile came out upright, and an *authored* upright is exempt from the facade cap
on purpose — a tileset may draw a tower fifty tiles tall as one prop — so a
58x39 forest stood up as facades sixteen tiles high. Two thirds of everything
standing on that map was terrain.

What separates them is not in the tileset at all, it is in how the maps are
painted. A building is one picture spread across its cells, so inside its
footprint the tiles are nearly all distinct. A forest is a handful of tiles
repeated over covered ground. `derive-tileset-3d-classes.cjs` judges every
placement in a 5x5 neighbourhood on that basis and writes the file.

Two things it got wrong first, both worth keeping. Judging by connected region
let a crater painted at the edge of a forest join that region and inherit its
verdict, so the crater rose a tile on a plinth of its own; the neighbourhood is
local and does not carry that contagion. And asking each tile to recur on its
own split the canopy — its rows are separate ids — raising four of them and
leaving the other four flat, a forest in corduroy. Repetition has to be measured
across the neighbourhood, not per tile.

The flags still decide one thing: whether a B-E tile is an object at all.
Blocking the way or drawing above the character both mean it is a thing in the
world rather than a marking on the floor, and a thing in the world stands up.

Reading only the star flag was the mistake, and it took a ground-level
screenshot to see it. ★ is set where a character can walk *behind* something,
so everything a character walks in front of — a lone tree, a mountain, a landed
ship — was left lying flat on the map while the forest beside it stood. Pits are
the one case the wider rule gets wrong, since a pit blocks the way like an
object and is a hole in the ground; that is a click in the 3D Shape editor,
once per tileset, which is what authored classification is for.

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

## What is not finished

3D maps are a first pass and this section is the honest edge of it. Everything
below is opt-in twice over: a map renders in 3D only if its note contains
`<3d>`, and a project without such a map never loads the 3D library at all.

**Terrain wants authoring.** The classification cannot be derived from a
tileset, only from how the tileset is used, and `derive-tileset-3d-classes.cjs`
produces a starting point rather than an answer. Correcting it in the 3D Shape
editor is expected work, not a sign something has gone wrong.

**Three known-wrong cases, each for the same reason** — the tileset does not
carry the distinction the renderer needs:

- A wall autotile is a wall *face*. It has no top, so a raised wall is capped
  with its own side art. Pairing an A4 roof kind with the wall kind eight rows
  below it is the fix; the sheet layout guarantees that pairing exists.
- A pit blocks movement exactly like a rock. Nothing separates a hole in the
  ground from an object standing on it, so pits stand up until told otherwise.
- A forest is drawn from its lone variant, which is right, but one cut-out per
  cell reads as cover rather than as trees. The arrangement is unsettled; the
  source is not.

**Performance.** Painting rebuilds the whole scene. Incremental rebuild is the
fix and has not been done.

**Absent.** Parallax and sky in 3D. Event dragging in the 3D view. Region and
layer overlays in the 3D view. Battles, which remain 2D and unchanged.
