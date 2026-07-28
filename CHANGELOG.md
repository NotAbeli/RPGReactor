# Changelog

All notable changes to RPG Reactor will be documented in this file.

This root changelog summarizes public release progress for GitHub; larger releases group their fixes by theme. The detailed editor changelog lives at [`editor/CHANGELOG.md`](editor/CHANGELOG.md).

## [0.96.0] - 2026-07-27

0.95.1 was an internal development version and was never published; its changes ship in 0.96.0.

### Still in progress

3D maps are new in this cycle and are honestly described as a first pass. What
follows is known to be unfinished — it is listed so nobody has to discover it
themselves. Everything here is opt-in: a map is only 3D if its note says `<3d>`,
and a project with no 3D maps is untouched by all of it.

- **Terrain needs authoring to look its best.** Which tiles stand up cannot be
  derived from a tileset — a shopfront wall and a forest are both simply
  impassable — so it is set per tile in the 3D Shape editor, and objects that
  span several tiles are declared there too. `derive-tileset-3d-classes.cjs`
  fills in a reasonable starting point from how your maps are already painted;
  expect to correct it rather than accept it.
- **Forests read as dense cover rather than as individual trees**, and a
  mountain range reads as one texture rather than as peaks. Both are drawn from
  the terrain's own lone variant, which is the right source; the arrangement is
  not settled.
- **Interior walls show the wrong art on top.** A wall autotile is a wall
  *face* and has no top, so a raised wall is capped with its own side art. The
  fix is to pair a wall with the roof drawn for it, which is not implemented.
- **Pits and craters stand up.** Their art blocks movement exactly like a rock
  does, and nothing in the tileset distinguishes a hole from an object. Set
  those tiles to Flat in the 3D Shape editor, once per tileset.
- **No parallax or sky.** A 3D map draws a flat backdrop; `parallaxName` is
  ignored. Battles are 2D, unchanged.
- **Editing a large 3D map is slower than editing it in 2D.** Every paint
  stroke rebuilds the whole scene. Fine at 100x50, noticeable at 200x200.
- The 3D Shape key and preview panels are English-only for now, pending a
  translation pass.

### Added

- **3D maps (HD-2D).** A map can be drawn in 3D: the ground lies flat, walls and buildings stand up, and characters stay as 2D sprites moving on the grid. It is opt-in per map — a map is 3D only if its note contains `<3d>` — and nothing else changes. Event commands, passability, regions and movement keep working on the same grid, and `Map###.json` stays standard RPG Maker data; elevation and camera live in a `Map###.r3d.json` beside it. A project with no 3D maps behaves exactly as before and never downloads the 3D library. Battles are still 2D.

- **Tileset 3D shapes.** Which tiles stand up cannot be derived from map data — a shop wall and a cliff face are both simply impassable — so it is authored. The tileset editor has a new **3D Shape** mode beside passability and terrain: click a tile to cycle it through **Flat**, **Upright** and **Scenery**. Upright treats a column of tiles as one picture and stands it at full height, which suits a building drawn as a single tall prop; Scenery raises the ground instead, which suits a forest or a mountain range, where the same tile repeats across an area. Autotiles are classified once and apply to all their shapes. Stored per tileset in `Tilesets.r3d.json`; a project that never classifies a tile never gets the file, and an unclassified map renders flat rather than guessing.

- **A 3D view in the map editor.** A **3D** checkbox beside the A1 toggle swaps the map canvas for a 3D view of the same map. Drag to orbit, Shift or right-drag to pan, scroll to zoom, and double-click empty space to put the whole map back in view. Events appear as their character graphic on a standing sprite with number and name above, or a coloured cube when they have no graphic. Click to select, double-click to edit, right-click for the same menu the 2D map gives you; selection stays in step with the events panel in both directions. A1 water animates, following the same A1 checkbox as the 2D canvas.

- **Painting works in 3D.** With tiles selected in the palette, dragging paints them exactly as in 2D — same brush, same autotiles, same undo — and the tile under the cursor is reported in the map bar. Without a selection, dragging orbits instead; Ctrl always orbits. Painting shares one implementation with the 2D canvas, so the two views cannot drift apart.


- Two more tileset sheets, **F** and **G**, giving 512 extra tiles on top of B–E's 1,024. They work exactly like B–E — same grid, same passability, ladder, counter and terrain tag settings, same layer stacking — and appear as tabs in the tile palette and slots in the tileset database. They use a range of tile numbers RPG Maker leaves empty, so importing an MZ or MV project can never conflict with them, and a project that doesn't use them saves exactly the same data as before. Maps that do use them still save in the standard format; only the two new sheets would be missing if the project were opened in RPG Maker itself.

- Event editor: Conditional Branch, Show Choices, and Loop can be folded away with the arrow beside them, so a long event no longer has to be scrolled past in full. A folded block shows how many lines it is hiding, nested blocks remember their own state while an outer one is closed, and folding follows the block if you edit commands above it. Folds are remembered per event page and survive closing the editor or restarting, so a page comes back the way you left it. Everything starts expanded, and a page you have never folded stays that way.
- Map properties: resizing a map now warns before it discards anything. Shrinking a map tells you exactly how many tiles will be removed and lists the events that will be deleted, and nothing is changed unless you confirm. Previously both were discarded silently, and events outside the new bounds were left behind invisibly.
- Map properties: a new anchor picker chooses which corner or edge your existing content stays attached to, so a map can grow from the top or left instead of only the bottom-right. Tiles and events move together, Set Event Location commands on the map follow, and the player and vehicle start positions are updated when they are on that map. Reactor also finds Transfer Player and Set Vehicle Location commands elsewhere in the project that jump to fixed coordinates on the resized map, and offers to update them so they still arrive in the right place. Top-left remains the default and behaves exactly as before.

### Removed

- An old tileset editor screen that could never actually open — it tried to build itself from a class that no longer exists, and nothing in the editor linked to it. About 1,300 lines went with it, including a passability overlay that read its markings from the wrong tiles on every sheet. The tileset editor you use in the Database is unaffected.

### Changed

- Bumped the current development version to RPG Reactor 0.96.0.
- The tileset screen in the Database shows all eleven layer slots without scrolling, and an unassigned layer now offers a **Choose Image** button where its tiles would be, instead of empty space. Double-clicking a layer row still works as before.
- Picking a tileset image uses the same modal styling as the rest of the editor, with a proper header and footer, and its file list is searchable like the other image pickers. It opens on the layer's current sheet, offers **(None)** at the top to clear a layer, and Escape, the close button, the footer, and clicking outside all dismiss it.
- Every tileset layer row has a **+** button that opens the picker for that slot, so a sheet can be swapped without hunting for the double-click.
- Every marking in the tileset editor is readable over any artwork. They are drawn straight onto the tiles, so a pale marker on pale ground — or a red X on red brickwork — could disappear into it. The O, X, star, damage and terrain-tag markings now carry a dark outline; the four-direction arrows and blocked dots, the ladder, the bush and the counter bar carry a dark edge. Colours are unchanged, just less washed out.
- Assigning or changing a tileset image now updates the map and the tile palette straight away instead of needing the editor restarted. Only the sheets that actually changed are reloaded, and the map is only redrawn if something on it uses them — adding a new sheet costs nothing.
- Map editing previews are cheaper: the preview used to create a fresh drawing object for every tile under the cursor, every time the mouse moved, on top of a layer type PIXI no longer supports for this. Most noticeable when dragging a large stamp or a wide circle brush across a big map.
- Map Properties now says which map you are editing: the header reads **Map Properties | 0211: Canite City** instead of just "Map Properties", and it updates as you type in the Map Name field. Renaming still only takes effect when you press OK.
- The Tileset dropdown in Map Properties now shows each tileset's number beside its name, so you can tell which database entry you are picking. It matches the numbering the Change Tileset event command already used.
- Map Properties now sizes itself to its contents and rearranges to fit the window. Map Name and Display Name share a row, as do Tileset and Scroll Type, and the panels pack into two balanced columns, dropping to one on a narrow window. The dialog no longer reserves a fixed height with empty space below it, and the whole thing stays visible without scrolling even with the BGM, BGS, and Battleback sections expanded. The Note box can also be dragged taller.

### Changed

- **Standing things in 3D are cut-outs that turn to face you.** They used to be fixed panels facing south, which is only correct from one direction: off that axis a structure read as a sheet of card folded up off the floor, and edge-on it vanished to a line. (A second panel crossing the first used to cover that, and it showed as a seam through the middle of the art.) A cut-out stays upright and spins to face you, exactly as the event sprites always have. Leaning it back towards the camera was tried, to stop cut-outs going edge-on as the camera climbs, and it cost far more than it bought: a leaning cut-out's art tips towards the viewer, so an object hangs off the point it stands on and that overhang swings as you orbit — at a 45 degree camera the top of a six-tile object sat 3.4 tiles from its anchor and travelled 4.8 tiles through a quarter turn. That was the drift, and the same overhang is why things looked lifted off the ground. Upright, the displacement is zero at every angle. Going edge-on is the camera's problem instead: the orbit stops at 72 degrees, short of the angle where standing art has nothing left to show, which is why an HD-2D game does not let you look straight down either. A whole object turns as one piece, about the middle of the row it stands in: a five-wide structure is a single cut-out, not five that fan apart as the camera moves, and it neither drifts off its cells as you orbit nor hangs above the ground in front of it. Walls are the exception and stay fixed, because a wall belongs to a building and faces a particular way.

- **Walls in 3D are solid mass, not standing panels.** A dungeon's walls were each drawn as a panel on the south face of their run, which was wrong in both directions at once: from above the walls vanished and a maze read as open floor, and from an angle a block of wall eight cells deep became an eight-tile tower. A walled area now raises the ground it covers, so the corridors are carved out of it and the wall art reaches the vertical faces through the same code that draws a cliff. Seen from overhead a dungeon matches its 2D map.

- **Almost everything on a B–E sheet stands up now.** A tile that blocks movement or draws above the character is a thing in the world — a tree, a peak, a landed ship, a shrub — not a marking on the floor. Requiring the ★ flag was far too strict, because an author sets it only where a character can walk *behind* something: a lone tree, a mountain and a ship all lay flat on the map while the forest beside them stood up. What stays flat is what is genuinely painted onto the ground — roads, cracks, scorch marks, anything walkable and unstarred. A pit or a crater is the case this gets wrong, since its art blocks the way like an object while being a hole in the ground; set those to Flat in the 3D Shape editor, once per tileset.

- Standing objects turn where they stand. The point a cut-out spins on was the middle of its front row, so a deep object swung around its own front edge as the camera went round instead of turning on the spot. It is the middle of the footprint now; the height it stands at still comes from the ground at its front row, so it stays planted.

- **A prop stands as a whole**, decided per piece of art rather than per tile, so one blocking or starred piece raises the whole picture. The launch gantry in the bundled project is three rows tall and only its top row is starred; read per tile, that stood its head up and left its legs lying on the ground.

- **A forest is drawn as trees now, not as terrain.** A tileset that paints a forest or a mountain range as a repeating texture almost always draws the single tree or the single peak as well — for an autotile that is shape 46, the piece it uses for one isolated cell, and on a B–E sheet it is usually the block directly above the tiling art. Reactor stands *that* on the cell instead of extruding the tiling art, which gave a wall of bark, or raising it, which gave a plateau of bark. Each cell carries one, sized and nudged off centre by a hash of its position, on a forest floor that rises slightly above the land around it, so a wood reads as a wood rather than as an orchard planted on a grid. The tiling art is not also laid flat under them: it is that terrain seen from above, so drawing both draws every cell twice, and at ground level the second copy showed as a mat of canopy around the feet of the trees growing out of it. The scatter is fixed per cell, so it never shifts when you paint elsewhere. Tiles carry a new **Foliage** class in the 3D Shape editor beside Flat, Upright and Scenery, and the stand-in is recorded per tile so it can be pointed somewhere else.

### Fixed

- Trees and mountains in 3D came out darker than the same art on the ground. The cut-outs were drawn by a shader written for them, which skipped the conversion three.js does from the texture's colour space to the screen's — and the fog with it, so distance never faded them either. They use the same material as the flat tiles now, with only the vertex position replaced, so a tree is the colour of the ground it stands on.

- Cliff and step faces in 3D were see-through. A face took its art from the topmost layer of the cell above it, which is usually a decoration — grass over dirt, a tree over grass — and a decoration's art is transparent everywhere the decoration is not, so a raised forest stood on a rim of holes with the sky showing through. Faces now take layer zero, the terrain, which is what the side of a step is made of.

- 3D maps stood forests and mountains on end as walls across the map. Which tiles stand up is authored per tileset, and a project's file could be filled in from the tileset flags — but impassable means a shopfront wall and a forest alike, and a column of forest cells collapses into one facade as tall as the run. On a 200x200 world map that turned a 58x39 forest into facades sixteen tiles high, with 68% of everything standing being terrain that should have been lying down. `editor/build-scripts/derive-tileset-3d-classes.cjs` now fills the file in from the maps instead: a building is one picture spread across its cells, so its tiles are mostly distinct, while a forest is a few tiles repeated over covered ground. Craters and rubble lie flat, water lies flat, blocked ground rises as a mass, and starred tiles stand. Run it per project and commit the result.

- Painting a wall autotile against the edge of the map cut off its end. A wall one tile in from the edge drew its finished edge; the same wall pushed right up against the boundary lost it. Reactor was treating everything off the map as more of the same tile, which is correct for ground and roofs — they carry on past the edge without drawing a border — but wrong for walls, which RPG Maker closes off. Checked against the maps in the bundled projects: of the 8,455 wall autotiles sitting on a map edge, 91% store the capped shape.

- Right-clicking a single autotile now picks the *kind*, so painting with it continues the pattern and works out its own corners and ends. It used to copy that exact piece, so picking the middle of a wall and painting produced a row of middle pieces with no ends. Right-dragging an area still copies it exactly, which is what makes it useful for duplicating a finished piece of map.


- Tile palette: switching to a different tileset layer kept the tiles you had selected on the previous one. The palette showed nothing highlighted, so it looked like no tiles were selected, but clicking the map painted the old layer's tiles anyway. Switching layers now clears the selection to match what the palette is showing.

- Tileset layers F and G painted as an eraser. They appeared correctly in the palette and the hover preview, but placing one wiped the tiles under it instead. The map editor holds two separate routines for turning a palette click into a tile number, and only one of them had been taught about the new sheets; the other returned tile 0, which is what "empty" means, so painting rubbed tiles out. Both now share one definition.

- Database: skills, weapons, items, and states created in the editor were missing fields the game engine expects every record to have, and each one failed differently in play. A new **skill** could not be used by any actor. A new **weapon** never showed up in the equip list and could not be equipped. Using a new **item** in battle corrupted the user's TP for the rest of the fight. A new **state** showed no battler pose and no overlay graphic. Clearing an existing record produced the same incomplete shape. All four templates now match what RPG Maker itself writes, checked against the records in the bundled projects.

- Event editor: the Scroll Map command had no "Wait for Completion" option, so an event could not wait for a scroll to finish. Worse, opening an imported command that already had it set and pressing OK quietly turned it off. The checkbox is now there and the setting is preserved.

- The title bar showed "RPG Reactor | Reactor One" for every project instead of the project you had open. This only affected the Wine/Proton compatibility mode, where Reactor draws its own title bar — that one was built with the demo project's name baked in and never updated. It now tracks the open project.

- Event commands: "Set Event Location → Exchange with another event" was showing and saving the wrong fields, so it swapped with the wrong event and lost the direction setting. It now matches what the game reads.

- Map export: waterfall tiles came out garbled in "Save Map as Image" and in the map-stamp preview for two of the water types.

- Map editor: choosing the eraser together with the bucket fill erased one tile at a time instead of flood-erasing. Flood erase now works.

- Web editor: keyboard shortcuts (Ctrl+S, Ctrl+Z/Y, copy/cut/paste, Delete) did nothing in the browser version. All of them work now.

- Audio player: turning looping off while a track was playing had no effect until the next track started.

- Sidebar: the divider positions you set were saved but never restored.

- Character Generator: imported sheets whose size isn't a clean multiple of 3x4 could jitter by a pixel on the middle walk frame, and "Normalize All Templates" said it had fixed the sheet when it hadn't. Both fixed.

- Map screen: large or edge-anchored plugin windows (HUDs, banners) could vanish while still partly on screen, because the off-screen check looked at the window's corner instead of its full size. Windows that draw only through gauges, names or state icons could also disappear. Both fixed.

- Event commands: opening any "Entire Party" command — Change HP/MP/TP/EXP/Level/Parameter/State/Skill or Recover All — and pressing OK silently retargeted it at the first actor only. Your inn and church heal events were affected. The setting is preserved now, and **Entire Party** is selectable in the dropdown, which it never was before.

- Event commands: a Show Text set to appear at the **Top** of the screen jumped to the bottom if you reopened it and pressed OK.

- Event commands: Fadeout BGM and Fadeout BGS were saved in the wrong unit, so the default "1 second" fade actually took a full minute in game, and a 5-second setting took five minutes. Existing commands imported from RPG Maker were displayed wrongly too.

- Events: creating an event with a graphic from the **bottom half** of a B/C/D/E tileset page saved the wrong tile, so the event showed a different graphic than the one you picked.

- Plugin Manager: adding certain plugins wrote incorrect default values into `plugins.js`, because settings belonging to a plugin's commands were being applied to the plugin's parameters.

- Database → System: Victory ME, Defeat ME, Game Over ME and the Boat/Ship/Airship music were reading and writing the wrong place, so those six rows always showed "(None)" and picking a track did nothing in game. All eight rows now work.

- Database: newly created animations played once in the middle of the enemy group instead of once per target on all-target skills.

- Database: the Traits and Effects lists in the Skill, Item, Weapon, Armor and State editors never refreshed after you added, edited or deleted a row. Beyond looking stale, deleting twice in a row could remove an entry you hadn't selected.

- Event pages: clearing the variable-threshold box on a page condition saved an empty value that the game read as zero, so the page could start running when it shouldn't. The field now keeps its previous value instead. Actor and Item conditions were also being saved as text rather than numbers, which could confuse plugins that read them.

- The Demo project that ships with the editor was missing two of its startup scripts, which would have left it stuck on the loading spinner for anyone who installed a fresh copy. The files existed but had never been committed. Both are now included, and a test checks the whole startup list so it cannot happen again.

- Tilesets: on some tiles, setting a terrain tag appeared to work in the editor but the game still read the old value. This affected tiles whose flags had been written by third-party tools, and Reactor was only clearing part of the value. The tag now applies, and the palette shows the number the game will actually use.

- Web editor: assets stored in a folder named `project` (for example `img/pictures/project/`) failed to load, because the file lookup matched the wrong part of the path. Fixed.

- Deployment: every released game included a complete second copy of the database. Battle Test leaves `Test_`-prefixed copies of all fourteen database files in `data/`, and the deployment step was copying them along with everything else — 15 MB of dead weight on one of the bundled projects, 13 MB on another, plus your saved test party. They are now skipped.

- Database and battle test: `Tilesets.json` and `System.json` were written by overwriting the existing file in place, so a crash or power loss during the save could take out the old copy as well as the new one. Both now write to a temporary file and swap it in, which is what the rest of the editor already did.

- Event editor: opening a plugin command and pressing OK erased its readable name, so `PSYCHRONIC_PTBS: Start PTBS Battle` became `PSYCHRONIC_PTBS: PTBS_StartBattle` in the event list — permanently, in the saved project. The name is now kept, taken from the plugin's own documentation when available, and the list shows it.

- Event editor: choice branches showed as `Choice 1`, `Choice 2` instead of the choice text, because the text was never stored on the branch. New choice commands record it, and the list shows it.

- Event editor: an event's Name and Note were written into the editor's own interface without escaping. A name or note containing HTML broke the fields it was displayed in, and because the editor runs with full system access, opening someone else's project with a crafted event name could have run their code on your machine. Both are now escaped, and a test checks every interface template for the same mistake.

- Event editor: adding a Play BGM/BGS/ME/SE, Fadeout, or Stop SE command inside a Conditional Branch, Loop, or choice branch placed it outside that branch. In the editor it appeared at the wrong nesting level, and in game it played even when the branch condition was false — along with every command after it in that branch. Existing audio commands were unaffected; only newly added ones.

- Animation timings: setting a sound effect's volume to 0 saved it as 90 instead. A silent timing is a legitimate setting and the slider goes down to 0, but the value was being treated as "nothing entered" and replaced with the default.

- Web editor: a save that browser storage rejected — running out of space is the realistic case — was reported as successful. The file looked saved for the rest of the session and then reverted to its previous contents on reload. Saving now reports the failure and names the files that could not be written.

- Undo after resizing a map could corrupt it. Painting, then changing the map size in Map Properties, then pressing Undo restored tile data sized for the old dimensions — the map rendered as garbage, and saving wrote that mismatched data to disk. Paint and event history are now cleared when a map is resized, and a restored snapshot that no longer fits the map is discarded rather than applied.
- Copying between two open editors now writes the shared clipboard atomically, so a large copy cannot be read half-written by the other instance.

- Tile palette: a tile holding only a thin sliver of art — the few pixels that continue an object from the tile above — could not be painted on its own. It counted as an empty tile, which switches the editor into erase mode, so painting with it rubbed tiles out instead of placing them. Selecting it together with the tile above worked, which is why it looked like the tile simply was not recognised. Genuinely empty tiles still switch to erase mode as before.

- Map Properties: the Tileset dropdown could appear as an empty collapsed sliver until a tileset was picked. It happened whenever the map pointed at a tileset that no longer exists — a cleared database entry, or a new map defaulting to Tileset 1 in a project whose tilesets start higher up. The dropdown now selects the first available tileset instead of nothing, and a project with no tilesets at all shows a normal-height control reading "(None)".

- Map Properties: the Battleback selectors were always visible, ignoring the Specify Battleback checkbox, and lost their two-column alignment when toggled.
- Web editor: the textual File/Database/Plugins/Tools/Forge/Help menu now displays clickable dropdowns. Its web-only horizontal scroll container clipped every submenu outside the bar; the menu now wraps on narrow screens while preserving visible overflow. The separate icon toolbar retains horizontal scrolling.
- Map tree: New Map from a map's context menu now inserts the map immediately after that target as a sibling at the same hierarchy level instead of appending it to the bottom of the root list. Creation without an explicit context target uses the currently highlighted map as its insertion anchor.
- Map editor: Auto-layer paint bucket fills now preserve unrelated upper tile planes. Filling a lower floor beneath Layer 4 walls changes and reconnects only the resolved lower destination layer instead of clearing or reshaping the walls above it; explicit Layer 1-4 and eraser behavior remain unchanged.
- Packaged editor: launching the Windows executable, macOS app, or Linux executable again now opens another isolated RPG Reactor process instead of routing the request back into the first instance. Repeated launches receive atomically leased Chromium profile slots, while existing project locks continue preventing two editors from writing the same project.
- Windows editor deployment: interactive developer builds no longer require `resedit` while finalizing the executable. App-owned PE metadata remains mandatory for release builds, but SDK/normal developer packages can now complete from Linux-hosted NW.js workers as intended.
- Database deletion: the toolbar Delete button now matches keyboard Delete and Cut by clearing records to blank templates in place. Tileset IDs, rows, and maximums remain stable even when clearing trailing records; macOS Backspace is accepted as Delete. Previously toolbar deletion stored hidden `null` slots, making packaged-user results appear different depending on input method. Opening any top-level list — Actors, Items, Skills, Weapons, Armors, Enemies, States, Troops, Classes, Animations, Common Events, and Tilesets — repairs those persisted hidden slots into visible blank same-ID records.
- Localization: seven languages showed large parts of the editor in English. Chinese (Traditional and Simplified), Russian, Portuguese, German, French, and Greek inherited the English table, so roughly a third of the interface — the whole Effekseer Forge, event page fields, and toolbar tooltips — was never translated. All are now complete, and a new test fails the build when a key is added without translations instead of letting it quietly render in English.
- Multiple editor launches: two launches starting at the same moment after a crash could both claim the same Chromium profile, which is exactly the collision the isolated-instance support exists to prevent. Slot takeover is now serialized so only one launch can claim a recovered slot.
- Map tree: a new map whose file could not be written no longer stays in the map list. The list is restored to its previous contents and ordering, so a failed save cannot leave behind a map that does not exist on disk.
- Bundled Demo: Deploy Game on the bundled Reactor One Demo failed with "Project runtime is incomplete". The Demo's engine files had fallen behind the current runtime and were missing the picture extensions and LZString entirely, so the Demo also ran an older engine than the editor shipped — without the level-999 support, gamepad input fixes, and save-path handling. Its runtime now matches the engine exactly.
- Runtime performance: drawing to a bitmap no longer sends the whole image to the graphics card on every single operation. Anything that redraws text or images repeatedly — the victory aftermath EXP count-up most visibly — was uploading its entire window hundreds of times per frame; the uploads are now batched and sent once, just before drawing. This was the actual cause of the aftermath stutter.
- Runtime performance: text colours are now read from the windowskin once per colour instead of on every use. Windows that redraw each frame — the victory aftermath EXP count-up most visibly — were performing thousands of one-pixel image reads per second, whose constant memory churn showed up as stuttering.
- MV compatibility: battle animations played on party members are no longer mirrored. MZ flips every animation shown on an actor; MV never did, so MV animations are drawn to play as-is. The reversal was invisible on symmetrical effects but obvious on any animation containing words — Star Shift Rebellion's "Counter" animation read backwards. MZ-authored projects keep MZ's behavior.
- MV compatibility: showing a choice could crash the game with "Cannot read properties of null (reading 'start')". Plugins and custom battle scenes create extra message windows that the scene never wires up, and a choice arriving on one of those had nowhere to go. Choices now fall back to the scene's real choice window, so they still appear and can be answered. Reported in Star Shift Rebellion.
- MV compatibility: a Set Movement Route with Wait in one event could make a later event's move route finish instantly instead of waiting. The character being watched was remembered but never forgotten, so once an event ended, the next one could check the wrong character — one that had already stopped moving. Reported in Star Shift Rebellion as move routes running all at once.

## [0.95.0] - 2026-07-20

Cycle overview: [RPG Reactor 0.95.0: A More Complete Editor](docs/devlogs/2026-07-18-rpg-reactor-0.95.0.md).

0.94.9 was an internal development version and was never published; its changes ship in 0.95.0.

### Added

- Localization now covers statically routed editor text across all 18 supported languages. A generated deep catalog fills database, event-command, Forge, build, project, and web-host surfaces; source-audit tests enforce locale parity, consumed Terms schemas, interpolation placeholders, and Arabic right-to-left document direction without translating project-authored game content.
- Control Variables now presents Game Data through an RPG Maker-style nested selector instead of raw numeric IDs. Items, weapons, armors, and actors use database names; actor, enemy, character, party, Other, and Last Action Data operands expose their stock property choices; the parent command displays a readable summary; and Cancel/Escape remain transactional. Last Action Data and Troop battleback layer labels are translated across every supported language with explicit no-fallback tests.
- Added reproducible release-candidate and publication workflows for Linux x64, Windows x64, Intel macOS, and Web. Public builds pin NW.js 0.107.0 to trusted SHA-256 values, package the tracked Reactor One Demo starter, bind artifacts to their source commit and hashes, require native signing/notarization for publishable Windows/macOS candidates, and publish the inspected candidate bytes to GitHub and optional itch.io channels without rebuilding.
- Security and project lifecycle hardening escapes project-authored content on privileged editor surfaces, rejects unsafe/non-empty project destinations, uses token-owned exclusive project locks, ignores stale asynchronous map loads, and strengthens atomic writes against temp-file collisions and symlink replacement.
- The Database uses nearly the full viewport and gives scrolling to its child panes. Types now presents Elements, Skill Types, Weapon Types, Armor Types, and Equipment Types together in a dense workspace with keyboard/pointer multiselect, Cut/Copy/Paste, custom context menus, ID-preserving bulk clear, Add, and confirmed Change Maximum controls. Terms presents Basic Statuses, Parameters, Commands, and grouped Messages in one compact workspace with native text clipboard menus. Both reflow in the Web editor.
- Multiple Reactor instances can exchange MZ-style authored data through one typed system/shared-file clipboard. Whole maps; single or multi-selected batches of Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Animations, Common Events, and Tilesets; individual trait/effect rows; whole map events; event and troop pages; map/common/troop event-command blocks; movement-route commands; and Plugin Manager groups can be copied between two open projects. Database batch pastes overwrite consecutive destination slots while retaining each destination ID, list selection/scroll position survives refreshes, incompatible categories are rejected, and the newest shared payload wins over stale in-window clipboard state. Trait/effect references to elements, states, skills, types, equipment slots, and Common Events resolve by unique name in the target project; missing or duplicate targets reject the paste instead of retaining an unsafe source ID.
- Conditional Branch now edits every RPG Maker MZ condition type (0-13), including all Actor/Enemy subconditions, character direction, variable operands, equipped-item checks, button modes, and vehicles. Existing arrays remain byte-identical when unchanged, legacy Button arrays remain readable, and new edits serialize in canonical MZ form.
- Event commands now extend beyond the stock MV/MZ authoring surface without changing the project format. Control Variables can build arithmetic, trigonometric, random, bitwise, and min/max expressions; Common Event calls can use a variable ID or invoke a current-map event page; and Conditional Branch can test expanded keyboard states, mouse buttons/wheel, and pointer coordinates. Loop remains the direct stock Loop/Repeat Above structure. Portable forms remain ordinary stock event commands, while Reactor-generated scripts carry strict versioned metadata so only an exact unmodified command reopens in its structured editor.
- Picture commands now support direct or variable picture IDs, variable Move duration, One/Range/All erasure, initial or tweened angle, custom anchors, sine-wave offsets, and Overlay blending. Negative X/Y scale remains the picture-flipping workflow and now supports the full `-2000..2000` editor range, including Quick Setting preview. Dynamic scripts include stock MV/MZ fallbacks; Reactor-only visual state lives in the isolated `reactor_picture_extensions.js` runtime module, and Overlay safely renders as Normal when renderer back-buffer support is unavailable.
- Show Picture now includes RPG Maker-style Quick Setting placement. A responsive grid marks the project's configured screen resolution inside a larger off-screen workspace; the selected picture can be dragged through and beyond that workspace or positioned numerically across the full command range. The modal measures its controls and scales naturally with window/fullscreen dimensions while preserving the project's exact aspect ratio. Origin, X/Y, width/height scale, and opacity are editable in the modal, while the Quick Setting button shares the image row. Move Picture uses the same surface to animate from the latest preceding Show/Move state with live duration-frame entry and the command's easing; a picture with no preceding visible Show remains absent from the preview.
- Map editing now supports MV/MZ-style rectangular sampling: right-drag over the map to capture all four visual tile planes, shadows, and regions, then left-click or drag to stamp the copied patch. A translucent composite preview follows the cursor, reverse drags and map-edge clipping are supported, transparent source cells intentionally clear destination layers, and each placement stroke is one Undo action. Events remain separate, matching RPG Maker behavior.
- Holding Shift while painting A1-A4 autotiles with the Pencil, Rectangle, or Circle tool now places the selected shape exactly without reconnecting it or reshaping neighboring autotiles. Shift-drag remains map panning for other tile layers and tools.
- Map editing now has a persisted A1 autotile-animation preference, enabled by default and available from both File → Options and a compact synchronized checkbox in the map-info strip. Disabling it removes the editor ticker and holds water and waterfalls on their first frame without changing playtests or deployed games.
- Added stock-MV-compatible LZString runtime support and load-order validation for synchronous MV/YEP saves, plus regression coverage for desktop paths, browser keys, Unicode saves, and real `N4Ig...` save payloads from a large MV compatibility fixture.
- Added focused regressions for Unicode Tileset URLs and Audio Player sections, project lock/BOM/retry diagnostics, transactional Event-mode creation/editing, MV package repair, the PIXI 8 start/stop-before-init race, and the ES5 Filter compatibility source contract.
- Added recursive project-asset discovery across audio, animation sheets, Effekseer effects, characters, faces, battlers, tilesets, battlebacks, parallaxes, title images, and plugin file parameters. Pickers store extensionless forward-slash relative names, keep RPG Maker core assets to runtime-safe lowercase `.ogg`/`.png` files, preserve `$`/`!$` character-sheet classification inside subfolders, and resolve encoded preview URLs on desktop and Web hosts.
- Added live name/path search, Unicode grapheme section rails, sticky headers, and keyboard-selectable results to the shared image picker, event character picker, and Show Text face picker. This covers actor character/face/SV graphics, enemies, vehicles, animation sheets, event frames, and facesets; search is case/accent-insensitive and current event frame restoration is guarded against stale image loads.
- Added visual System 1 starting-position selection for the Player, Boat, Ship, and Airship by reusing the Transfer Player map canvas. Map/X/Y commit together only on OK, manual numeric fields remain available, nested map navigation and overlapping preview loads are guarded, and the Title Screen image chooser now uses the searchable Unicode browser with a side-by-side preview.
- Added searchable Plugin Help & Documentation with safe highlighted matches, active/total counts, wraparound previous/next controls, Enter/Shift+Enter and F3/Shift+F3 navigation, plus Plugin Manager-scoped Ctrl/Cmd+F. The main load-order list filters loaded plugins by name, description, or author, and the Add Plugin dialog filters available filenames. Remove Plugin and Save Changes now share a persistent bottom action bar, with Save on the right and available regardless of selection. Help search state is cleared when plugin/project details reload and cannot steal shortcuts from nested parameter dialogs.
- Reworked complex Plugin Parameters around RPG Maker's metadata model: every independent `/*~struct~Name: ... */` block is parsed, nested struct and simple arrays use named list rows instead of numbered JSON dumps, notes use multiline fields, groups and controls align on stable grids, and nested editors reuse the correct plugin schema. Rows support buttons, double-click editing, and direct full-row drag-and-drop reordering with insertion feedback; alternating surfaces and neutral group headers follow the active theme. Element dialogs use an explicit OK action. Schema-guided decoding preserves JSON-looking string leaves; Cancel and Structure/Text switching are transactional; serialization restores RPG Maker's nested JSON strings. Verified against a real nested `YEP_OptionsCore` fixture with an exact byte-for-byte round trip.

### Changed

- Bundled Forge content includes Psychronic and Looseleaf Character Generator styles, with Psychronic as the default. Project JavaScript and PNG styles remain available and load automatically. Portal is available in both animation generators; the registries contain 76 Animation Generator recipes and 106 Effekseer recipes (Energy: 15).
- Bumped RPG Reactor to version 0.95.0.
- System 2 Magic Skills is now an ordered, fillable list of Skill Type IDs, matching MZ's data model and side-view casting behavior instead of presenting independent checkboxes.
- Tightened the Troops and Animations database workspaces for lower-resolution screens. Troops places its runtime-aligned Battle Preview on the left and stacks Battle Test, Members, Battleback, and Note in a compact right sidebar that collapses below the preview on narrow web layouts; Battle Events remains full-width below. Enemy homes, bottom anchors, battle-field offsets, battlebacks, and dragging match runtime screen/UI-area geometry across MZ, converted MV, and widescreen projects. Battle Test equipment follows actor-plus-class equip permissions, omits empty incompatible slots, preserves only actionable stale entries, and leaves scrollbar spacing. The Conditions dialog uses aligned rows with contrasted modal chrome. Animations uses side-by-side sprite properties, a shorter sheet strip, bounded summary/preview surfaces, narrower frame/effect controls, and local scrolling where needed while preserving 960x540 preview data and accurate scaled pointer editing.
- Troop Members now uses the shared searchable Unicode-indexed picker with a battler preview for both Add and Replace. Member rows expose their troop and database numbers, open Replace by double-click or Enter, and support focused Cut/Copy/Paste/Delete shortcuts plus matching right-click actions.

### Fixed

- Editor deployment: ordinary interactive builds no longer apply the immutable public-release hash policy to Latest Stable or user-selected NW.js versions. Windows editor SDK packages can cross-build from Linux without invoking `resedit`'s unsupported ESM loader inside an NW.js worker; app-owned Windows version metadata remains mandatory in the Node-based release pipeline.
- Editor: the File → Options Palette picker no longer falls back to English names and descriptions in Traditional/Simplified Chinese, Russian, Portuguese, German, French, and Greek. Theme choices and the new autotile preference are localized across all 18 supported languages, with regression coverage for every palette description.
- Editor: after selecting an enemy in the Troop preview, Delete now removes that member instead of clearing the entire Troop database entry. The preview owns keyboard focus and consumes Delete even when no member is selected.
- Editor: expanded Plugin Help no longer compresses the Parameters area below the visible detail pane. Documentation remains independently scrollable, can be resized vertically from its lower-right grip like Notes fields, and the overall plugin detail pane scrolls through metadata, help, and every parameter. Help-search navigation uses contrasted theme-aware buttons, while the surrounding search card stays neutral and only the focused text field receives an accent highlight.
- Editor: Actor equipment no longer renders every named global Equipment Type as an unusable row. Actor and Battle Test equipment now treat explicit class slot lists as authoritative, independent of their source, and otherwise use standard engine slots plus actor/class item permissions. Slots without an actor/class-permitted weapon or armor are hidden unless they contain relevant stale data; sparse Weapon/Armor/Equipment Type lists also retain their real IDs when authoring equip traits.
- Runtime: converted MV projects using YEP Save Core load their existing `.rpgsave` files again. The PIXI 8 runtime had retained the LZString fallback code but stopped shipping/loading the decoder, so compressed text reached `JsonEx.parse` unchanged. Reactor now reads and writes stock MV-compatible payloads and honors MV/YEP `localFileDirectoryPath`, `localFilePath`, and `webStorageKey` contracts.
- Runtime: side-view actors in a large MV compatibility fixture now use the same final Victor Engine damage-popup path as enemies. MOG BattleHud had captured the pre-Victor popup method on `Sprite_Actor`, causing actor TP/state/custom popups and some combined results to be consumed without rendering; post-plugin compatibility now delegates dynamically while preserving MOG's front-view face behavior.
- Runtime: MOG Treasure Popup labels and inline icons no longer lose their right and lower portions to MZ's `_clientArea` clip; only that plugin's intentionally full-size contents sprite is restored to MV parentage. Legacy video parallaxes can parent children on PIXI 8 `TilingSprite` without deprecation warnings, and intentional empty-source video teardown no longer logs a false media failure while real missing-video errors remain visible.
- Editor/runtime: Database Change Maximum now displays and enforces workload-aware ceilings instead of accepting values such as 99,999 and synchronously allocating every slot. Reactor retains MZ's 9,999 major-record/Common Event and 1,000 Animation/Tileset capacities; large databases remain one continuous list, rendering the first 250 rows immediately and appending later batches near the bottom. Cancel baselines use compact JSON instead of a duplicate live object graph, and growth reuses one template serialization. Reactor extends Actors to level 999 with finite class-stat extrapolation, raises Skill/Item and Attack Times repeats to 100 with a runtime backstop, supports 2,000 maps across IDs through 9,999, and raises every System Type ceiling above 99. Constant-time numeric fields such as price, costs, speed, success, gain, and variance are no longer clamped merely to match MZ's editor.
- Editor: pasted maps now appear immediately after the currently selected map as its next sibling, preserving that map's hierarchy level and shifting later siblings in place instead of appending every paste to the bottom of the root map list.
- Editor: successful Save All while the Database remains open refreshes the Cancel baseline, so Cancel returns to the latest saved state instead of data from before that save.
- Editor: Tileset A-E previews no longer disappear when the map renderer has not initialized or when project/image paths contain Unicode, spaces, or URL-significant characters. The compact editor now retains its dynamic project context and routes every Tileset image through encoded native/web asset URLs.
- Editor: the Audio Player's left-hand filename index is Unicode-aware. Accented Latin, Greek, Cyrillic, Chinese, Japanese, Korean, and other letter initials receive their own visible sections instead of all falling under `#`; canonically equivalent accents share a section, while numeric and punctuation prefixes remain grouped under `#`.
- Editor: opening a project that is already locked by another Reactor instance now stops after the specific lock warning instead of incorrectly following it with an “invalid project” prompt. Actual project-load failures retry brief partial/locked JSON reads, accept UTF-8 BOMs used by some localized tools, report the failing file/reason, and read controller-owned `MapInfos.json` only once per open.
- Editor: Event Editor sessions now use isolated drafts. Double-clicking an empty in-bounds tile opens a detached default event; Apply or OK inserts it and records one Undo snapshot, while Cancel, X, or backdrop dismissal leaves the map unchanged. Existing-event Apply commits once and refreshes the Cancel baseline, OK commits and closes, and no-op Apply creates no Undo entry.
- Editor: map events visible on the canvas no longer disappear from the left Events list when an imported or third-party map stores a real event at array index 0 instead of RPG Maker's conventional leading null. The sidebar and sprite renderer now use the same truthy-event rule, sparse high IDs remain visible, malformed graphics cannot abort list construction, and creation/deletion safely handles compacted or ID-mismatched arrays.
- Editor: imported MV projects whose existing `package.json` has a missing, non-string, or blank `name` or `main` no longer fail playtest with NW.js's “Required value 'name' is missing or invalid.” Runtime installation and desktop playtest now repair only those launch-critical fields while preserving custom MV window and JavaScript settings; malformed/non-object package files stop before conversion or process launch with the exact path and parse reason.

- Editor: preview surfaces no longer leak browser-capped resources across a long session. Chromium caps live WebGL contexts (~16) and AudioContexts (~6) per page: the animation picker, the Animations database page, and its effect-file picker each created a fresh WebGL + Effekseer context per open and never released it (eventually blanking every 3D preview in the editor), and the System audio picker leaked an AudioContext per open (eventually silencing audio previews). All of them now release their contexts on close. The Animations page also removed none of its document-level keyboard/drag handlers when switching animations — the leaked keyboard handlers kept applying Ctrl+V/Delete shortcuts to previously viewed animations' data — and the actor and event-page character walk previews leaked an animation timer per view, pinning their preview frames in memory forever. The Effekseer Forge's window-level drag handlers similarly retained every discarded preview canvas across remounts.
- Editor: editing an If or Show Choices that contains nested branch structures no longer corrupts the event — the rebuild treated any nested End marker as its own, removing the wrong command range and orphaning markers. Empty branches keep their place so later bodies can't shift into the wrong branch, the cancel-branch body stays bound to the Cancel branch when choices are added or removed, and edited structures keep their indent when nested inside other branches (they were re-inserted at indent 0, which breaks branch routing at runtime). Editing an If also no longer silently adds an Else branch — a new "Create Else Branch" checkbox mirrors the edited command, like MZ. Applies to both the map event editor and the common-events editor, and copy/cut/delete of nested choice structures now selects the correct range.

- Editor: whole-map paint bucket fills apply in a fraction of a second instead of 30-40 seconds — huge tile-update batches now route through the streaming full re-render (which preserves the scroll position) instead of 100k+ incremental sprite updates, and the water-animation bookkeeping in batch updates is no longer quadratic. Undo and redo also keep the current scroll position instead of jumping back to the map origin.

### Fixed — deep audit (editor)

- Critical project writes use randomly named, exclusively created no-follow temporary files, preserve destination permissions, flush file contents before rename, flush the parent directory where supported, and clean failed temporary files. A crash, kill, full disk, stale temp name, or symlink collision can no longer destroy the previous good `project.rpgreactor`, `MapInfos.json`, map, database, or plugin-manifest file.
- Deploying a game saves the project first, like playtest does — builds no longer silently ship whatever was last on disk.
- Editing autotile passability/ladder/counter/terrain flags in the Tileset database works — edits landed on the wrong flag slots (shape slots of the first autotile), so they never took effect in game; they now index by kind and mirror across all 48 shapes like MZ.
- Class parameter curves generate against the right levels (values were shifted one level low, with Lv1 written into an unread slot), enemy action HP/MP conditions survive editing (fractions were truncated to 0 on every OK), and Attack Element traits store the correct element (they were off by one).
- Database Cancel actually reverts everything since the database was opened — switching categories used to re-baseline the snapshot, silently keeping (and later saving) "cancelled" edits.
- Show Choices, If/Else, and inserted/pasted commands get correct MZ indents — branches authored in Reactor previously misrouted at runtime (choice bodies skipped, Else running alongside Then); deleting an If/Loop/Battle header now removes its whole block instead of leaving markers that could loop the interpreter.
- Change Gold wrote its parameters in the wrong order (gaining a variable-amount of gold gave 0), and editing a variable-designated Transfer Player no longer rewrites it into a direct transfer to raw variable IDs.
- Mouse-wheel zoom no longer compounds with every map loaded in the session, middle-mouse/Shift+drag panning works (it was dead code), the region overlay survives map switches, the eraser on the Regions tab erases regions instead of hidden map tiles, and drag-reordering a map "before" a sibling actually reorders it.
- Animation Generator: saved keyframes are no longer wiped on every tool switch (the loader dropped them and the autosave made it permanent), Reset Layer resets the live keyframe instead of orphaning future edits, and a pending autosave can no longer write one project's layers into another.

### Fixed — deep audit (runtime)

- MZ battles show battlers again with the MV-plugin battle-field compatibility active — the early-created battle field rendered UNDER the battlebacks (verified by booting into a battle: field index 1 vs battlebacks 3-4; now above, matching MZ).
- Two unbounded texture leaks fixed: every sprite frame change (walk cycles, blinking pause signs) and every map transfer's tile batch stranded PIXI v8 textures on session-lived texture sources forever; long play sessions now hold steady.
- Balloon cleanup runs again on scene teardown (a duplicate destroy override dropped it), fixing a permanent event soft-lock when a scene change interrupts a balloon wait.
- Event-vs-event collision uses the MZ rule (only normal-priority events block); MV games keep the MV rule via the compat layer.
- Move-route/animation/balloon waits survive save/load in MZ games using MV plugins (a live character reference was being serialized into saves; the loaded clone froze the wait forever), and encrypted MV games detect their encryption again (the flags were captured before encryption info loaded).
- The v8 geometry shim no longer corrupts vertex data on PIXI v5/v6/v7, destroyed audio buffers are no longer re-downloaded ~10s later by the load watchdog, and per-frame sprite refreshes stopped allocating on the unchanged path.

### Fixed — audit backlog cleared

Every remaining Medium and Low finding from the 2026-07-13 deep audit is fixed in this cycle:

- Editor data integrity: audio command editors no longer commit their edits when you press Cancel; Battle Test keeps its preview battlebacks in the Test_ data instead of writing them into the real System.json; removing an interior Element/Skill/Weapon/Armor/Equipment type blanks the entry instead of renumbering every later type reference (the trailing entry still truly removes); clearing an actor's Initial/Max Level or class field no longer writes null into Actors.json; the picture and animation-cell editors preserve legitimate zero opacity/scale values; Show Text keeps interior blank lines; Show Choices remaps its Default/Cancel references when blank choices are filtered out; System 2 Advanced edits work on MV-era projects that have no advanced block; and names, notes, and messages containing quotes, ampersands, or angle brackets survive database editing round-trips (one shared attribute-safe escaper across all database editors — the previous div-based escaping never escaped quotes inside attributes).
- Editor reliability and speed: deleting a map persists MapInfos.json before unlinking the map files, so a failed save can no longer leave phantom entries pointing at deleted maps; the maps sidebar builds its tree in one pass instead of scanning the whole map list per node; saving the database writes System.json once per batch instead of after every single file; the plugin manager no longer writes a manifest (and pops an alert) just from being opened on a manifest-less project, caches plugin metadata by file mtime instead of re-reading and regex-parsing every plugin source on each open, and keeps full @help text out of the boot manifest; palette transparency detection works again, so selecting a transparent B–E tile arms the eraser instead of painting invisible blockers; merged-A palette drags clamp to the sub-layer they started in instead of building out-of-range tile IDs; A1 hover previews show the correct art for kinds 4–7; autotile-graphic event thumbnails render under PIXI v8 instead of blank; opening map properties survives a corrupt map file; playtest survives a failing map-reference repair; and the audio player no longer stacks a scroll listener per tab switch.
- Editor performance: clicking a command in the event editor restyles the selection in place instead of rebuilding the entire list DOM (and re-decoding face thumbnails — those are now cached per face sheet, and the command-name table is built once instead of per row); dragging an event moves its one sprite per tile step instead of rebuilding every event sprite (which also leaked a label texture per rebuild) and no longer resets the sidebar scroll; the Character Generator composes its 12-cell walk sheet once per part change instead of re-rendering all 12 cells on every 170ms animation tick; and Outfit Forge part thumbnails are memoized by spec, so a control change re-renders one thumbnail instead of running the full 12-frame engine ~20 times.
- Forge tools: Outfit/Hair Forge desktop saves land in the project's forge library (they wrote into the editor install tree — lost on packaged installs); direct-to-project part and effect saves ask before overwriting an existing file; the Animation Generator's save dialogs recover from cancel (the GIF button no longer sticks on "Saving…", hidden file inputs no longer orphan); and Character Generator sheet saves fall back to a browser download instead of crashing when no project is open.
- Runtime: the MV-compat battler animation mirror queue stays out of save files and is bounded — saves no longer grow with every battle animation ever played; Window_Command.refresh recreates its contents bitmap only when the window actually changed size (it churned a fresh canvas + texture on every refresh in MZ games); the data-load watchdog can no longer double-fire a live-but-slow download (a generation guard drops superseded arrivals and download progress pushes the stall deadline forward); Ultra Mode 7's v8 renderer reuses scratch uniform buffers instead of allocating ~7 typed arrays per layer per frame; and the texture-compat shim is memoized per texture source instead of building a fresh proxy object on every access. Verified by booting the MZ demo and the 168-plugin MV game to their title scenes on the updated runtime with clean consoles.

The original deferred findings and their resolutions are preserved in [docs/AUDIT-BACKLOG-2026-07-13.md](docs/AUDIT-BACKLOG-2026-07-13.md); all are fixed.

Validation at the 0.95.0 release: **350 passing tests and no failures**.

## [0.94.8] - 2026-07-13

Release overview: [RPG Reactor 0.94.8: Big Maps Without the Wait](docs/devlogs/2026-07-13-rpg-reactor-0.94.8.md).

### Changed

- Bumped RPG Reactor to version 0.94.8.

### Fixed

- Editor: large maps load and edit much faster — a 256×256 compatibility-project map now fully loads in ~2.5s instead of ~10s, and the editor runs at full frame rate afterwards instead of stuttering on maps with water. Off-viewport tiles now stream into detached containers (the growing half-loaded map was re-rendered every frame while loading, which is where the time went), and animated water tiles moved to small dedicated overlay layers so the big static layers can always be cached as textures.
- Editor: repainting shadows no longer stacks invisible duplicate shadow sprites that darkened the quadrants slightly with every paint.
- Editor: animation previews (the Animations database page, the animation picker, and the event editor's picker) play smoothly — playback was paced by a timer that drifted and fired late whenever the editor was busy, reading as judder; it now steps at the exact MV 15fps cadence against the display clock.
- Editor: region painting no longer freezes on large maps — bucket-filling a region across a 256×256 map stalled ~5 seconds because the whole overlay (a fresh number label per cell) was rebuilt after every paint; region cells now share one texture per region ID and paints update only the touched cells.
- Editor: the rectangle and circle tools show a live region-color preview while dragging on the Regions tab (the circle tool previously showed no preview at all).

## [0.94.7] - 2026-07-13

Release overview: [RPG Reactor 0.94.7: Map Editing You Can Trust](docs/devlogs/2026-07-13-rpg-reactor-0.94.7.md). (0.94.6 was an internal development version and was never published; its changes ship here.)

### Changed

- Bumped RPG Reactor to version 0.94.7.

### Fixed

- Editor: the rectangle, circle, and paint bucket tools paint regions when the Regions tab is selected — previously only the pencil handled the region layer, and the area tools painted tiles from the previous palette tab's selection instead.

- Runtime: games no longer crash at startup with `this._app.start is not a function` or hang on a black screen when plugins alias `SceneManager.run`/`initialize` with non-async wrappers (VisuMZ Core Engine among them) — such wrappers drop the promise from PIXI v8's async graphics initialization, letting the game-loop start be reached mid-init; the loop start is now deferred until the renderer is ready, whatever the plugin wrapper timing.
- Runtime: MV-era plugins that construct filters ES5-style (`PIXI.Filter.call(this, vertex, fragment, uniforms)`) work under PIXI v8 instead of throwing "class constructor cannot be invoked without new".
- Web editor: database entry lists show their mini preview icons (skill/item/weapon/armor/state icons, actor face portraits, enemy battler thumbnails) in the browser edition — the renderer bailed without NW.js and painted via CSS `file://` backgrounds the browser host's URL bridge does not rewrite; icons now resolve through the host's project URLs. The character/face/SV-battler/icon picker dialogs also open in the browser edition instead of alerting that NW.js is required.
- Runtime: sprites using multiply or screen blending render correctly under PIXI v8 instead of covering the scene with an opaque quad (reported as the whole screen going dark when toggling Sang Hendrix's parallax collision overlay, alongside a flood of "Blend filter requires backBuffer" warnings). PIXI v8 supports these modes natively; the compat layer's filter-based registration was overriding that native path with a filter that cannot run while the back buffer is off.
- Editor: the paint bucket fills the whole connected region of an autotile terrain instead of stopping at shape variants (edges/corners), and recomputes autotile borders after the fill so filled areas connect cleanly. The eraser's fill mode matches terrain the same way.
- Editor: manual layer selection (L1–L4) strictly confines painting and fill to the chosen layer — ground autotiles previously ignored the layer picker and always cleared layers 2–4 at the painted cell. Auto mode keeps the MZ-style stacking rules.
- Editor: the playtest button saves the project (current map, database, map list) before launching, so playtests run the map as it looks in the editor.
- Runtime: the DevTools Issues tab is clean again — the deprecated `unload` listener is now `pagehide`, and the compat layer no longer touches `window.sharedStorage` while scanning globals (which tripped Chromium's Shared Storage deprecation report).

## [0.94.5] - 2026-07-12

Release overview: [RPG Reactor 0.94.5: The Performance Release](docs/devlogs/2026-07-12-rpg-reactor-0.94.5.md).

### Added

- Runtime: built-in frame profiler on F10 — records per-phase timings for every slow frame and writes `save/reactor-profile.json`; free until activated. Companion console helpers `$reactorAnimStats()` and `$reactorAnimWatch(id)` diagnose live animation sprites across all hosts.
- Build menu: "Install Reactor Runtime..." converts imported RPG Maker projects to the Reactor engine — the old corescript, libs, and `index.html` are archived to `rpgmaker-runtime-backup.zip` in the project root, and the plugin manifest is seeded from `plugins.js`.

### Changed

- Game deployment downloads the FFmpeg optimizer and the NW.js proprietary codec from direct release URLs instead of the GitHub API, eliminating unauthenticated rate-limit (HTTP 403) build failures. Downloads remain verified (pinned SHA-256 hashes for FFmpeg, structural archive validation for the codec).
- The shipped runtime plugin manifest is empty instead of containing development plugin entries.
- Runtime: games boot with a clean console — the compat layers' informational install banners are gated behind a debug switch (`window.$reactorDebugLogs`, `localStorage reactorDebugLogs`, or `?debuglogs`), legacy positional `PIXI.BlurFilter(...)` construction no longer triggers a PixiJS deprecation warning, and the "Save data is too big." web-storage warning no longer fires on desktop.
- Bumped RPG Reactor to version 0.94.5.

### Fixed — performance

- Runtime: object-heavy maps (hundreds of events plus plugin overlay windows) run at full speed again under PIXI v8 — far-offscreen character sprites and dormant plugin windows are detached from the display tree instead of merely hidden (measured 30 → 180 FPS on the heaviest profiled map). Set `window.$reactorDisableCulling = true` to disable for debugging.
- Runtime: scrolling across the tilemap's repaint boundary no longer hitches (was a 77ms spike from rebuilding ~2,000 tile sprites) and no longer leaves bands of stale garbage tiles at the viewport edge — tile sprites are pooled detached between repaints, so only freshly painted tiles are ever in the display tree.
- Runtime: LeTBS enemy AI turns no longer freeze the frame — the compat layer memoizes the AI's AoE evaluation (identical scopes were rebuilt with per-entity `eval()`s for every move-cell × action-cell combination; profiled at 80–146ms per skill) and replaces pathfinding that ran inside a sort comparator (~1,200 whole-map A* runs per move decision) with a single BFS flood fill.
- Runtime: Ultra Mode 7 runs at full speed on large maps (GPU vertex buffers now upload only when geometry changes — was ~135MB re-uploaded per frame on a 256×256 map, 36.8ms → 4ms median) and honors the plugin's `TILEMAP_PIXELATED` setting, removing tile seams in pixel-art games.

### Fixed — Ultra Mode 7 and plugin detection

- Runtime: `Utils.RPGMAKER_NAME` reports `"MZ"` (Reactor's identity moved to `Utils.REACTOR_NAME`) — multi-engine plugins branch on that exact string, and "Reactor" sent them down MV/dead-fallback paths: Ultra Mode 7 rendered nothing, and the Cyclone suite, DK Video Player, and others took wrong branches.
- Runtime: Ultra Mode 7 works with pre-2.2.0 plugin releases — `pixi_compat` supplies the `Tilemap.CombinedLayer` bridge (addRect animation-coordinate forwarding + animationFrame fan-out) that Blizzard added in v2.2.0.
- Runtime: Ultra Mode 7 maps no longer crash the scene — the tilemap's direct `updateTransform` drive now tolerates plugin transform chains ending in the legacy PIXI call (expected to throw on v8), matching the onRender bridge's behavior; the MV project-marker probe also stops logging file-not-found noise in MZ projects.

### Fixed — MV compatibility

- Runtime: the MV compatibility layer is now two-tier. MV plugin API support (the mix-and-match machinery) installs for every game, so MZ projects can use MV plugins; MV game semantics (window geometry, scene layout, battle flow) activate only for games authored in RPG Maker MV. Previously the whole layer applied to MZ projects, squeezing command windows and washing out window backgrounds.
- Runtime: "Set Movement Route" waits work again when an MV plugin overrides the route command (MV's interpreter watches `this._character`, MZ's `this._characterId`; the compat layer now honors both), fixing cutscene move routes that silently did nothing — e.g. YEP Move Route Core's `MOVE TO` marches.
- Runtime: looping MV-format animations (waving flags retriggered every pass) no longer blink out for a frame at the loop point — finished animation sprites get MV's one-tick removal grace, and fresh sprites draw their first frame at creation when their sheets are cached.
- Runtime: LeTBS battle animations no longer ghost — finished/orphaned animation sprites leaked on LeTBS's shared layer (frozen on their last frame, so looping state animations played exactly on top of their own ghost); the compat layer now sweeps the layer every battle tick.
- Runtime: victory triggers immediately when the last enemy falls in MV games; MZ's eager `BattleManager.endAction` cleanup let ATB systems open an actor command window over the dead troop, stalling battle end until one more attack.
- Runtime: MV window contents and main-menu window sizing are MV-verbatim under the MV compatibility layer, so layout plugins (YEP_MainMenuManager, YEP_PartySystem) measure the geometry they were written against; verified against the same game running its genuine MV corescript.
- Runtime: MV plugins customizing menu status drawing (gauges, hidden levels, class rows) apply again — MZ's `Window_StatusBase` intermediate class was shadowing their `Window_Base` patches.
- Runtime: MZ games show their saves again when leftover MV-era `.rpgsave` files sit beside the real `.rmmzsave` saves — save-format resolution is now native-first per game type instead of always preferring `.rpgsave`.
- Runtime: MV games no longer freeze when a plugin's promise rejects unhandled (failing `video.play()` was fatal under MZ semantics; MV ignored it — now logged and play continues).

### Fixed — rendering, effects, and editor

- Runtime: Effekseer battle animations stay round/undistorted at every screen position (off-center targets previously stretched effects radially), and "screen center" animations position correctly under PIXI v8.
- Runtime: plugins that read `PIXI.settings` (removed in PIXI v8) no longer crash the game on startup — a compat bridge maps the common settings to their v8 equivalents.
- Runtime: window skins no longer tile the whole skin sheet (including the text-color palette) behind window contents under PIXI v8; the background pattern quadrant renders correctly again.
- Runtime: the FPS counter (F2) renders with MZ's stock look in every project — its CSS previously only existed in RPG Maker's own `index.html`.
- Forge Effekseer Generator: the frame-count setting now caps exported effects (continuous-spin recipes included) so battle animations end when the Forge says they do; blank duration still exports endless ambience effects.
- Deploying an imported RPG Maker MV/MZ project that still runs on its original corescript no longer fails with "Project runtime is incomplete"; the check now follows what `index.html` boots, and its error explains how to install the Reactor runtime.

## [0.94.4] - 2026-07-11

Release overview: [RPG Reactor 0.94.4: Responsive Web Forge and Reliable Windows Playtests](docs/devlogs/2026-07-11-rpg-reactor-0.94.4.md).

### Added

- Skills, Items, and Weapons assign animations through a searchable picker modal with a live playing preview of both MV sprite-sheet animations and Effekseer effects.
- Database entry lists show a framed mini icon beside each name: database icons for skills, items, weapons, armors, and states; face portraits for actors; battler thumbnails for enemies.

### Changed

- Bumped RPG Reactor to version 0.94.4.

### Fixed

- The Web editor now adapts its sidebar, workspace, toolbars, status bar, database, event editor, image picker, map properties, splash screen, save banner, and Playtest window across desktop, laptop, narrow, and short browser viewports without changing the desktop NW.js layout. Unsupported deployment controls are removed from the Web menu.
- Web Forge tools now bundle their Character Generator engines and built-in style library, then save character sheets, animation sheets/GIFs, sound effects, complete Effekseer effects/resources, outfits, and hair into the active browser project. The files persist across reloads; projectless exports use browser file/directory pickers or a download fallback.
- Browser Playtest now waits for the project-overlay service worker to control the page, using one guarded startup reload when required so edits saved during the first Web-editor session are immediately available.
- Windows playtests now remain detectable as Test or Battle Test when isolated profiles are enabled. Windows NW.js retains `--user-data-dir` as its first application argument, which previously hid the later `test` token from RPG Maker and prevented test-only plugin overlays such as Sang Hendrix editor docks from being created.
- Runtime: battle test launches are now detected when Chromium switches occupy the first application argument on Linux and macOS — `Utils.isOptionValid` scans every argument instead of only the first. Previously Battle Test booted to the title screen.
- Runtime: MV-style damage popups no longer destroy the shared system Damage bitmap when a popup is removed, which crashed the PIXI v8 render pass and blacked out the battle. The renderer also skips live sprites whose texture source has been destroyed, logging the offending class instead of aborting the frame.
- Runtime: window selection cursors are clamped to the window's inner rect (MV behavior), MV battle-window metrics such as `windowWidth` and `numVisibleRows` now gap-fill correctly on subclasses, and the UI box size honors `SceneManager._boxWidth`/`_boxHeight` set by MV plugins so the window layer aligns at the origin as in MV. Together these keep battle command highlights inside their windows and align all windows with screen-anchored HUD art.
- Runtime: Effekseer effects render aspect-correct on widescreen canvases (the projection previously stretched effects horizontally, turning spheres into ovals), and the overlay GL context now re-asserts its render state around every draw so effects survive window blur/focus without back-face artifacts.
- Runtime: `Sprite.setFrame` always refreshes its texture, healing sprites whose shared bitmap had its base texture replaced by image-processing plugins, and windowskin refreshes tolerate MV-style window part structures instead of crashing during bitmap load.

## [0.94.3] - 2026-07-10

Release overview: [RPG Reactor 0.94.3: Web Editor and Reliable Downloads](docs/devlogs/2026-07-10-rpg-reactor-0.94.3.md).

### Added

- Added a provider-neutral Web editor package with Reactor One bundled and opened automatically. Browser edits persist locally, can be reset to the bundled project, and are used by the in-page Playtest.

### Changed

- Bumped RPG Reactor to version 0.94.3.
- AppImage output is now presented as a conditional sub-option directly beneath Linux in both deployment dialogs.

### Fixed

- Large NW.js SDK downloads now tolerate temporary `dl.nwjs.io` stalls, retry transient failures, and clean incomplete cache files instead of failing after 30 seconds.
- Deployment logs now keep a live inline progress bar visible during runtime and tool downloads, including transferred MiB for servers that do not report a total size and retry/completion state in the same row.
- Deployment downloads now prefer native curl when available, avoiding an NW.js worker-thread HTTPS stall where a valid runtime URL opened but delivered no bytes; the Node HTTPS path remains available as fallback.

## [0.94.2] - 2026-07-10

Release overview: [RPG Reactor 0.94.2: Safer Saves and Better Deployments](docs/devlogs/2026-07-10-rpg-reactor-0.94.2.md).

### Added

- The RPG Maker MV compatibility layer (`reactor_mv_compat.js`) now ships in the runtime folder and loads in every project. Previously it lived only in a local test project, so the 0.94.1 MV compatibility work was not actually included in new projects or the public runtime. It is inert in pure-MZ projects: every API it provides is gap-filled only when missing.
- Outfit Forge now always shows part options as permanent dropdowns (and always-visible thumbnail lists), matching Procedural-tab discoverability for materials, accents, and style presets.
- Added clean-checkout GitHub Actions coverage, runtime-manifest checks, generated-project smoke tests, save-safety tests, editor-distribution staging checks, and a no-NW.js web deployment smoke test.
- Added File-menu Save Project and Playtest commands plus visible shortcut indicators and application shortcuts for New (`Ctrl+N`), Open (`Ctrl+O`), Save (`Ctrl+S`), and Playtest (`Ctrl+R`).
- Added `F5` for a confirmed uncached editor reload and `F11` for native NW.js fullscreen.
- Added optional desktop runtime locale filtering with an English fallback, reducing packaged game size without changing project translations.
- Added optional deployment-time asset optimization: staged-only lossless Oxipng recompression and explicit-quality OGG Vorbis re-encoding, with smaller-valid-file replacement, loop-metadata preservation, per-file progress, and pinned SHA-256-verified FFmpeg acquisition.
- Added optional Linux x86_64 AppImage output for both games and the editor. Existing Linux folders and ZIP archives remain available; AppImage tooling and its Type 2 runtime are pinned, verified, cached, and used only when requested on a Linux x86_64 build host.

### Changed

- Bumped RPG Reactor to version 0.94.2.
- Save now persists the current map, all database files, project metadata, and the authoritative map list; map and project transitions prompt to save, discard, or cancel when changes are pending.
- New-project fallback scaffolding is deterministic and runtime-valid, with complete display/font settings and an empty plugin configuration instead of inheriting demo plugins.
- Deployment dialogs now provide themed searchable NW.js release selection, remember game and editor output directories independently, persist asset settings, and use consistent **ZIP archive** labels.

### Fixed

- Character Generator **Parts (PNG)** now scans both `forge/character_generator/styles/<style>/parts/` and the legacy Complex-template `forge/character_generator/parts/` path, with clearer empty-state copy and an Open Folder button.
- Forge tools no longer keep a stale project path after switching or closing projects, so bake/save dialogs (including Animation Generator GIF export) default to the currently open project.
- Hair Forge lower banding and scraggle sliders produce much larger, more visible pixel changes.
- Windows splash startup no longer performs repeated one-pixel window-height nudges, which could appear as a several-pixel bounce after native frame and DPI rounding; Wine also avoids relaunching an already-frameless packaged window.
- Fixed the Demo's New Game crash introduced by MV RenderTexture compatibility forwarding `resolution: undefined` into PixiJS 8.14, producing `NaN` snapshot dimensions and an incomplete framebuffer during `Scene_Title.terminate()`.
- Database and project save failures now propagate to the UI instead of reporting false success, and database saves can no longer overwrite newer `MapInfos.json` data.
- Editor distributions now include the GIF encoder, worker, and decoder dependency closure used by Animation Generator import/export, and fail packaging when required runtime files are absent.
- Game deployment now validates the complete Reactor runtime and excludes development saves and backup directories from packaged output.
- Valid RPG Maker MZ **Skip** commands (`code 109`) now display correctly in Common Events and troop events instead of appearing as unknown commands.
- NW.js deployment now reuses packaged and cached runtimes consistently, searches every cache root before downloading, and supports latest-stable, editor-matched, or manually pinned runtime versions.
- Game and full editor deployments can optionally install a SHA-256-verified, exact-version `nwjs-ffmpeg-prebuilt` codec overlay for additional H.264/AAC playback support.
- Linux editor distributions are now produced as symlink-preserving `.zip` archives instead of `.tar.gz`.
- Effekseer Layers now adapt beside or below the preview, animated opacity is applied correctly, and keyframe selection, add/delete, frame, Start Frame, and layer-timing edits remain synchronized.
- Playtests now use Reactor-owned profiles isolated by project and NW.js version on Windows, macOS, and Linux, so deployed games and other projects cannot block launch.
- Oxipng now initializes its supported single-thread WASM codec directly in NW.js workers instead of selecting an unavailable browser-thread build and reporting every PNG as unsupported.
- Localized About dialogs now display the shared current application version instead of stale hard-coded version text.

## [0.94.1] - 2026-07-05

### Added

- The Effekseer Animation Generator's **Interface** category was rebuilt as true 3D instruments and grown to **21 recipes**, every panel is now world-fixed geometry that rotates truthfully with the orientation gizmo instead of a flat billboard. New instruments include a build-your-own **Orbital Survey** solar system (per-planet sizes and custom planet-texture uploads), a wireframe **Starship Analysis** hull with tracking callouts, a **Reactor Core** wireframe torus, **Circular Gauge** and **Bar Meter** LED meters, a **Behavior Matrix** ternary plot, **Flight Prediction**, a living **Composite Waveform** oscilloscope, and a 3D **Battery** cell, and every interface can now display **user-typed text** (single-line Display Text or scrolling/blinking Paragraph Text) so one recipe reuses across many meanings.
- A full Effekseer **Physical** attack pack for battle effects - Slash, Bite, Punch, Impale, Claw Rake, Crush, Arrow Hit, Parry, Whip Crack, and Blood (with Burst/Spray/Drip splatter patterns and full color control), plus new **Energy** spell effects (Energy Boost, Energy Column, Binding Circle, Hex Forcefield) and **Christian Cross** variants (Latin, Orthodox, Greek, Celtic).
- **MZ-style tile-layer dimming** in the map editor: selecting layer 1–4 fades the other layers so it's obvious which tiles live on the active layer.

### Changed

- Bumped current development version to RPG Reactor 0.94.1.
- Sharpened the Effekseer Magic Circle (legible runes, crisp inner star) and moved the Explosion recipe into the Physical category.

### Fixed

- Fixed Effekseer preview loading in the Database and Event animation pickers, rotation-gizmo jump/reset issues, and several beam/column rendering problems (hollow beam cores, half-circle columns, oversized bases).
- **RPG Maker MV compatibility:** the PIXI8 runtime now boots and plays a large commercial MV project's full 168-plugin stack, intro cutscenes, save/load through the game's own load menu, event-choice menus, and the LeTBS tactical battle system verified all the way into rendered combat turns (positioning, movement grid, turn order, battle HUD). The MV compatibility layer gained MV's `Spriteset_Battle` battleback chain, MV window-internal sprite aliases, MV's battle-field creation order, MV's cell-sheet animation engine restored on `Sprite_Animation` for plugins that subclass it, message sub-window creation chains (run exactly once per scene), character balloons and sprite-hosted animations as functional ports, `ToneFilter`, MV `Bitmap` tone/hue manipulation, the MV gauge/color API on `Window_Base`, `Game_Followers.forEach`, MV save-backup APIs, and ~25 more scan-driven gap-fills, each preserving MV's argument guards verbatim so plugin feature-detection keeps working.
- **Runtime resilience:** resource loads that silently die (no onload, no onerror, common on slow or syncing disks) previously hung the game forever with a black screen and zero console errors. The runtime now watchdogs every database JSON, image, and audio load from the engine's own frame tick, retries stalls in parallel indefinitely, revives buffers that plugin caches still gate on after MZ code destroyed them, and degrades genuinely missing audio/images to silence/blank with a loud console error instead of deadlocking scene startup.
- **PIXI v8:** `getBounds()` returns a `Bounds` object in v8 (v5–v7 returned a `Rectangle`); a `contains()` delegate keeps plugin hit tests working.

## [0.94] - 2026-06-27

### Added

- Effekseer Animation Generator grew into a full composition tool: an Animation-Generator-style **layer system** (stack any animations into one exported .efkefc, with per-layer visibility, opacity, ordering and timing windows) and **keyframes**, parameter states pinned to chosen frames, compiled to native Effekseer curves (colors, size, spin) with **texture cross-fades** between keyframes; plus a master frame-count control, an AG-style layers panel, corrected solid-surface texturing with proper backface culling, and a broad recipe library. The format engine now reads Effekseer binary versions up to 1710.

### Changed

- Bumped current development version to RPG Reactor 0.94.

### Fixed

- Fixed Outfit Forge Mini Skirt cleanup so side-view frames no longer leave orphan leg-palette outline/bridge pixels below the skirt hem.
- Fixed Outfit Forge Mini Skirt `Knee plates` so it now renders separate knee pads at the anatomical knees above the boot/shin band instead of being an ignored segmented-pants-only toggle; the skirt waistband is constrained to one visible row so it cannot consume most of a short skirt.
- Fixed Psychronic Mini Skirt placement by rejecting classifier rows above the real legs anchor, preventing torso/belt rows from being painted as skirt cloth.
- Fixed Forge card number fields feeling laggy while typing by avoiding full preview regeneration on every numeric keystroke.

## [0.93.1] - 2026-06-21

### Changed

- Bumped current development version to RPG Reactor 0.93.1.
- Reworked macOS editor distribution output into a self-contained `RPG Reactor.app` archive with no loose Chromium sidecar files at the zip root.
- Windows editor distribution packages now strip noisy Chromium `--enable-logging` from the packaged editor payload.

### Fixed

- Fixed macOS packaged editor launch and playtest by putting the editor payload in `Contents/Resources/app.nw` and adding an internal clean playtest runtime that symlinks to the bundled NW.js framework instead of duplicating it.
- Fixed macOS playtest runtime resolution across NW.js helper-process paths by searching from `process.execPath`, `__dirname`, `process.cwd()`, and `nw.App.startPath`.
- Fixed Windows playtest selection to prefer the clean adjacent `nw.exe` before stale `nwjs-win` folders, and hid spawned Windows playtest console flicker.
- Fixed erasing imported RPG Maker maps by making auto erase target the topmost actual tile layer instead of depending on the current palette tab.
- Fixed rectangle, circle, fill, and pencil eraser behavior so eraser mode remains active when changing drawing tools, never requires selected palette tiles, and shows outline-only previews while erasing.
- Fixed Plugin Manager saves for existing RPG Maker MV/MZ projects so `js/plugins.js` is written in RPG Maker-compatible four-field format instead of including Reactor-only metadata such as parsed help, author, and URL.
- Fixed the top Database menu's System entry so it opens System 1/System 2 sections instead of dispatching the obsolete `system` database type.

## [0.93.0] - 2026-06-21

### Changed

- Bumped current development version to RPG Reactor 0.93.
- Continued UI polish with a distinct themed Audio Player control card for Volume, Pitch, and Pan.
- Added the Rarely Typical Players Podcast YouTube channel to the Help/About links.
- Updated the editor window title to use `RPG Reactor | <Game Title>` and refresh on project load, close, language changes, and System 1 game-title edits.
- Reworked Windows and Linux platform editor packages so the editor payload is appended to the branded executable while the plain NW.js executable remains clean for playtesting, avoiding duplicate full runtime copies.
- Windows editor packages now use a frameless compatibility mode with RPG Reactor's own title controls, centered startup, and manual maximize/restore behavior for cleaner Proton/Wine behavior on Linux.
- Replaced emoji language flags in Options with SVG flag badges so Windows/Chromium displays real flag icons instead of regional-letter abbreviations.

### Fixed

- Fixed playtest launch from final Windows editor builds by avoiding the editor `package.nw` runtime when opening game projects.
- Fixed macOS editor distribution packaging to keep a clean `nwjs-mac/nwjs.app` runtime for playtesting separate from the editor `.app` bundle.
- Fixed Windows taskbar/app icon handling in packaged editor builds by resolving icons from packaged paths and improving multi-size ICO embedding.
- Fixed Windows editor builds under Proton/Wine showing a white native client-area band and offset mouse hit-testing by using frameless compatibility mode.
- Fixed final editor startup positioning so the splash/editor window opens centered instead of crammed into the upper-left corner.
- Fixed Forge launcher tiles losing their themed title/description styling when the generic localization text pass flattened complex button markup.
- Fixed database list rows not updating live while editing an entry name in the detail panel.
- Fixed actor image preview cards overflowing outside the Images section in the database modal.
- Fixed the actor Traits empty row alignment so it no longer protrudes into the indicator gutter.
- Fixed Forge Character Generator imported body sheets being shifted by procedural body-centering; bulk-imported/custom bodies now preserve their authored cell position. Also fixed normal RPG Maker 12x8 sheet detection.
- Fixed Psychronic female Outfit Forge armor generation with female-specific head/torso/shoulders/arms/hands/gauntlet/belt/legs/boots zone masks, female-safe mask coordinates, normalized Forge gender tags, and Zone Edit reload/export support so male bodies are unaffected.
- Replaced deprecated Pixi `cacheAsBitmap` map-editor cache calls with Pixi v8 `cacheAsTexture` calls.
- Improved procedural Outfit Forge pants and boots shading with pants underfill to prevent skin-colored cracks, plus broader natural shadow/light patches on pants and boots instead of dot-like striping.
- Improved procedural Outfit Forge helmet, torso armor, shoulders, and arms with connected metal volume shading while preserving seams, glow accents, and hard bevel details.
- Refined Psychronic helmet rendering with lower female visor/open-face placement, side respirator grill detail, and reduced isolated bright edge artifacts.
- Refined Outfit Forge pants and armor visuals with tighter front pants upper highlights, added Psychronic side-view helmet/torso panel detail, and stronger outer separation strokes for pauldrons and gauntlets.
- Refined Psychronic torso, arm, and helmet armor with structured panel shading and boundary-only outline strokes.
- Refined Psychronic back torso armor so the center highlight continues upward and paired panel lines arc into the shoulders.
- Updated the Nova Sentinel belt default material/accent pairing to gold/gold.
- Added an initial Hair Forge tab with anchor-based procedural hair generation, shared Forge walk-preview playback, live preview, save-to-library support, and generated hair regression coverage.
- Improved Hair Forge output with layered crown clumps, carved part lines, tapered bangs, side locks, and back-view flow strands instead of a single smooth hair mass.
- Refined Hair Forge internal hair seams to use shaded pixels instead of transparent cuts that created noisy black holes after outlining.
- Refined Hair Forge hair patterns with connected mirrored highlight/shadow lanes and exterior-only outlining for cleaner pixel-art flow.
- Refined Hair Forge long hair with a coherent panel overlay that connects crown shading into bangs, side curtains, and back locks.
- Stabilized Hair Forge side-view animation by anchoring crown/root pixels to the body frame and moving only lower hair tips subtly; side-view long hair now hangs from the back of the head with only short face-side bangs.
- Refined Hair Forge bangs and temple areas with larger polished hair panels, stronger side-lock connectors, and continuity smoothing for less sloppy strand patterns.
- Refined Hair Forge side bangs into shorter tapered clumps and filled small enclosed hair gaps so strands read as connected hair instead of blocky panels with holes.
- Refined Hair Forge silhouettes by trimming blocky side-bang faces and tapering/rounding long back-hair curtains for a more natural hair shape.
- Refined Hair Forge long hair with pixel-fur style finishing: scalloped exterior tuft edges plus connected V-shaped highlight and shadow flows.
- Refined Hair Forge tuft details to stay clipped inside the hair mass and added front-view crown/bang flow lines for less blocky bangs.
- Lowered and softened Hair Forge side-view front hairlines with connected tapered tufts instead of a square forehead edge.
- Reworked Hair Forge side-view bangs into swept overlapping locks and relaxed the forehead carve to avoid exposed bald-looking side hairline gaps.
- Refined Hair Forge side-view silhouettes with a forward-swept forelock, broader light/shadow shapes, and a preserved eye window so side eyes remain visible.
- Lowered Hair Forge side-view hair mass slightly while keeping the side eye-window anchored to the real eye line.
- Refined Hair Forge front-view layered hair with wider wavy side curtains, swept bang clusters, and a cleaner face opening based on imported Psychronic reference-hair flow.
- Fixed Hair Forge side-view hair by replacing the rectangular eye cutout with a tapered slit, filling the rear scalp cap, and removing disconnected lower hair islands.
- Fixed Hair Forge side-view bangs so the Bangs checkbox controls the swept forelock, fills the forward forehead area, and visibly changes side frames.
- Fixed Hair Forge side-view outlines and side locks so late side-only hair additions receive exterior strokes, side locks anchor from the sideburn/temple area, and the Side Locks checkbox visibly changes side frames.
- Fixed Hair Forge frame selection so frame 0 previews correctly, and moved hair color swatches into the color dropdown option rows.
- Stabilized Hair Forge side-view hair horizontally while preserving the intended 1px side walk-frame vertical bob and subtle hair-flow variation.
- Increased Hair Forge side/back walk-frame hair flow and tightened front-view eye-only clearing against visible eye pixels so animated bangs do not cover the eyes without cutting a forehead strip.
- Added an explicit anchor-based front-view eye protection zone for Hair Forge so Psychronic female frame 2 outline spikes do not cover the eye without cutting a rectangular bang hole.
- Added Hair Forge Eye Zone controls for front-view hair protection, with X/Y/width/height adjustment and a lower default Y offset for eye placement.
- Updated the default Hair Forge Eye Zone to X 1, Y 7, Width 3, Height 5 based on visual calibration.
- Added Hair Forge Hair Pattern controls for lower-hair banding and scraggle, with smoother default side-view lower hair and tunable shading variety.
- Strengthened Hair Forge Hair Pattern controls so lower banding and scraggle visibly affect front, side, and back lower hair instead of only subtly changing side strands.
- Added a Short Spiky Hair Forge style with raised crown spikes and a shorter side/front/back silhouette.
- Reworked Short Spiky Hair Forge generation into its own all-around spiky cap/fringe/sideburn style, with length scaling longer spikes instead of falling back to layered-bob locks.
- Fixed Short Spiky front hair so it keeps the central face open and uses short angular sideburn spikes instead of a face-covering lower curtain.
- Made Short Spiky more aggressively spiky all around by breaking up the front brow band, side lower mass, and back lower block into jagged spike teeth.
- Simplified Short Spiky into a head-local spiky style by removing lower tendrils/pattern passes and trimming excess side/back length.
- Simplified Short Spiky further into a compact cap/fringe/sideburn shape, removing the aggressive jagged-teeth experiments that made it visually noisy.
- Refined Short Spiky with style-specific front/side/back spike silhouettes, connected back-view spike roots, side-view spiky bangs, removed horizontal ponytail-like side spikes, and Short Spiky-specific triangular texture controls.
- Added a Center Part Long Hair Forge style with orderly long straight strands, a visible middle part, smooth side-view bangs, an open face-framing front silhouette, rounded long back curtain, and subtle walk-frame hair sway.
- Expanded Hair Forge colors with auburn, platinum, rose, violet, navy, and emerald palettes.
- Shifted right-facing Hair Forge side hair slightly back so rear scalp coverage matches the left-facing side view.
- Recalibrated Psychronic female Outfit Forge side-frame zone masks for the updated horizontal body-frame alignment.
- Added explicit eye-line anchor metadata for generated outfit placement without turning eyes into a paint-blocking clothing zone.

## [0.91] - 2026-06-18

### Added

- Expanded editor localization to ten languages: English, Japanese, Spanish, Traditional Chinese, Simplified Chinese, Russian, Portuguese, German, French, and Greek.
- Added immediate language switching through Options and the top-menu language button.
- Added broad localization coverage for editor chrome, Options, About, Forge, Audio Player, database/event editor surfaces, many fixed event-command forms, and common alert/status text.
- Added root release documentation so GitHub visitors can see progress without opening the editor subfolder.
- Added i18n regression coverage for dictionary completeness, localized key references, and high-visibility labels that should not fall back to English.

### Changed

- Updated RPG Reactor to version 0.91 for this release cycle.
- Improved the Options Palette picker with visible color swatches, high-contrast themed dropdown rows, and selected/hover highlighting that matches the Language dropdown styling.
- Renamed the bundled Pixi runtime path to the canonical `runtime/libs/pixi.js` and updated packaging/runtime references accordingly.
- Refreshed documentation for current localization, theming, Forge, runtime, and test coverage.

### Fixed

- Fixed language-change handling for dynamic editor text and generated modal/chrome surfaces.
- Fixed Palette dropdown swatches being removed by the generic localization text pass.
- Fixed Palette dropdown light/gray-on-gray contrast by moving styling to theme tokens.
- Fixed missing bundled script references for Pixi/GIF loaders in the editor shell.
- Fixed several low-risk Pixi v8 deprecation warnings in editor/runtime code paths.

## [0.9.0] - 2026-05-31

- Completed the major Pixi v8 migration pass, including compatibility shims and visual-fidelity fixes.
- Added the theme token system and broad editor UI token migration.
- Added database, animation, map-editor, and runtime compatibility polish described in the detailed editor changelog.
