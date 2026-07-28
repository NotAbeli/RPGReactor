# Handoff — 0.97.0 in progress

Last updated 2026-07-27. Delete or rewrite this when the items below are closed.

0.96.0 is tagged, released and pushed. Everything since is on `main` locally and
**not pushed** at the time of writing: `4770f28`, `f7df96f`, `7286a9f`,
`3b75b3c`, `e5e2524`. Push with `git push origin main`.

## Needs testing before it can be called done

Two fixes landed with their plumbing under test but nothing having actually run
them. Both were found from a user report rather than from the suite, so the
suite passing means little here.

**Non-48 tile sizes.** MZ lets a project choose 48, 32, 24 or 16 pixel tiles and
records it in `System.json`; Reactor's Database always offered the setting, the
runtime always read it, and the editor never did — every surface sampled sheets
in 48-pixel steps, so a 32-pixel project drew a mosaic of unrelated art.

- Test project: `/home/doug/Desktop/Project3` — "Haven: Secret of Caledria",
  `tileSize: 32`. Map 024 (Intro - Citadel Entrance) is the one that was
  reported. Compare against RPG Maker MZ's own rendering of the same map.
- What to check: map view, tile palette, tileset editor, the hover preview when
  painting, and the 3D view. Then change the size in Database → System 2 and
  confirm the open map redraws rather than waiting for a restart.
- Also open a 48-pixel project and confirm nothing moved. That is the whole
  installed base, and the conversion touched six renderers.
- If something is still wrong it should be *localised* now rather than the whole
  map, which points at a site classified as format when it was really pixels.
  `editor/tests/tile-size.test.cjs` has a sweep that fails on any bare pixel 48;
  extend the file list rather than fixing by hand.

**The web build not booting.** `EditorInstanceBroker` required `os` in its
constructor and the web host throws for anything but `fs`, `path` and `url`, so
the editor died before drawing. Load the web build and confirm it starts.

- Related and *not* addressed: `PlaytestManager`, `ReactorClipboard` and
  `ProjectController` also require `os`, but from inside methods rather than
  constructors. They will not stop boot, and they will throw if those paths are
  reached in a browser. Deciding which features should be reachable on web at
  all is the real question there.

## 3D, still a first pass

The full list is in the 0.96.0 changelog under "Still in progress" and at the
end of `docs/devlogs/2026-07-25-rpg-reactor-0.96.0.md`. In rough order of how
much they hurt:

1. **Interior wall tops take the wall's own face art.** A wall autotile is a
   picture of a wall face and has no top. The fix is to pair an A4 roof kind
   with the wall kind eight rows below it — the sheet layout guarantees that
   pairing exists, so this is derivable rather than authored.
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
- Scratch harnesses used for the 3D work (offline rasteriser, 2D-vs-3D
  comparison, eight-angle turntable) live in the session scratchpad and are not
  committed. They were worth having; rebuild them rather than eyeballing.

## Posts ready to publish

- `docs/posts/itch-devlog-0.96.0-plain.txt` — the itch.io devlog, plain text,
  paragraphs unwrapped so a paste does not break into lines.
- `docs/posts/release-notes-0.96.0.md` — already used as the GitHub release body.
