# RPG Reactor 0.96.0: A Deep Correctness Audit

RPG Reactor-owned code is MIT-licensed. Bundled third-party components retain
their respective licenses as recorded in `THIRD_PARTY_NOTICES.md`; the project
does not claim one uniform license for third-party or user/project content.

The 0.96.0 development cycle is not a feature release. It is a sustained,
file-by-file correctness audit of the editor, the runtime, the build tooling and
the asset generators, together with the test infrastructure needed to keep the
results from regressing. Roughly forty verified bugs were fixed. Most were
silent: commands that quietly rewrote themselves when reopened, records created
without fields the engine reads unconditionally, and editor arithmetic that
disagreed with the runtime performing the same calculation. Test coverage grew
from 452 to 579 passing tests. This document remains a draft until 0.96.0 is
tagged and published.

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
