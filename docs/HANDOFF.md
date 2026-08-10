# Handoff - 0.98.0 Release Candidate

Last updated 2026-08-09. Rewrite this after 0.98.0 is tagged.

## Current State

- 0.97.0 shipped as a source release on 2026-08-03 at
  <https://github.com/Psychronic-Games/RPGReactor/releases/tag/v0.97.0>.
- `editor/package.json` is 0.98.0 and both changelogs are open under
  `[Unreleased - 0.98.0]`.
- The 0.98.0 implementation and tests are present in the working tree but are
  not all committed. A plain `git push origin main` does not upload unstaged or
  untracked files.
- The current suite passes **1,284 tests** with no failures, skips, or TODOs.
  The final post-documentation run completed on 2026-08-09.

## Release Scope

0.98.0 is primarily a map-scale, rendering, and compatibility release:

- Maps are validated from 1x1 through 512x512 before allocation. Large maps use
  a buffered 32-tile-chunk residency window and native PIXI 8 meshes instead of
  map-sized texture caches or hundreds of thousands of sprites.
- The runtime tilemap has a native PIXI 8 mesh backend for ordinary tiles,
  autotiles, A1 animation, and shadows, with diagnostics and an automatic
  fallback to the proven sprite backend.
- Map JSON keeps the large top-level `data` array compact while properties and
  events remain readable. Every map-writing path uses the same format.
- Auto-layer ground replaces the terrain it is painted over and reconnects on
  the correct physical layer. The editor shadow plane now follows both base
  planes and precedes decoration planes, matching RPG Maker.
- Event mode shows its pointer and keyboard target, supports arrow-key movement,
  and pastes only at a visible selected cell.
- PIXI 8 compatibility restores mutable filter arrays and the legacy Point,
  ObservablePoint, Rectangle, and Matrix `copy` methods. MV semantics restore
  plugin-controlled window padding and `gamefont.css` families.
- Source release publication and signed artifact attachment are separate,
  recoverable workflows. Verified candidates attach to the source release
  without discarding its changelog notes.

## Final 3D Composition

The final renderer intentionally has no `_supportMeshes` lower-art duplicate.
Documentation or code changes that reintroduce support copies are regressions.

- Runtime water and waterfalls advance from the tilemap animation clock. The
  editor advances the same animation by elapsed time rather than display frame
  count.
- Multi-cell foliage and mountain stamps emit one authored picture. Their
  quadrants retain physical source layers and incomplete edge stamps reconstruct
  the complete silhouette.
- Transparent silhouette gaps use a separate depthless underlay at 0.6 opacity.
  Ordinary authored terrain is not duplicated beneath every foliage cut-out.
- Declared structures retain one composition frame and pivot across source
  layers and missing cells. Standing rows and flat apron rows keep their roles;
  flat-row hinges are not shifted into their own footing.
- Fully opaque texels draw colour and write depth in an exact-alpha core with
  `alphaTest = 1.0`. Alpha 1-254 remains in the depthless blended pass, preserving
  soft edges without letting transparent mesh centroids own depth.
- Starred geometry contains only authored starred pieces and renders after
  characters. Source map layer remains the coplanar ordering tie-breaker.
- The editor mirrors runtime ordering: lower geometry and events, a depth clear,
  then starred geometry.

## Validation Completed

- Full Node suite: 1,284 passing, zero failing.
- Runtime and editor syntax checks pass.
- All bundled project runtime copies match the canonical `runtime/` directory.
- Star Shift Rebellion map 596, a 200x200 map that would expand to an estimated
  312,141 tile sprites, renders completely through 219 meshes with no WebGL
  error or context loss. A forced runtime scroll measured 5.7 ms p99 on the mesh
  backend versus 22.2 ms on the sprite fallback.
- The Web archive booted over localhost, retained an IndexedDB edit across a
  reload, registered its service worker, and reached `Scene_Title` in Playtest.
- The source editor booted under Linux NW.js. The bundled Demo and external MV,
  MZ, MZ3D, and large-map compatibility projects reached live title/map scenes
  without runtime exceptions.
- An unsigned 0.98.0 Linux candidate built, extracted, and remained running
  through its launch check.

## Remaining Manual Gates

- Compare the 32-pixel project visually against RPG Maker MZ after restarting
  the editor. Automated sampling covers 48, 32, 24, and 16 pixels, but cannot
  replace a source-editor visual comparison.
- Run Windows launch and Authenticode checks on Windows with release credentials.
- Run macOS launch, signing, notarization, stapling, and Gatekeeper checks on
  macOS with release credentials.
- The GitHub CLI (`gh`) is not installed in this Linux source session. Git can
  still push the source branch, but workflow dispatch/watch commands require
  installing and authenticating `gh` or using the GitHub Actions web interface.
- Exercise create, save, reopen, playtest, and desktop deployment from each
  signed packaged editor before publishing binaries.
- Region and object-designation overlays are still absent from the 3D viewport;
  this is a known editor affordance gap, not a release regression.

## Release Flow

Do not create the release tag by hand. From a clean `main` worktree after the
0.98.0 changes are committed:

```bash
node editor/build-scripts/cut-release.cjs 0.98.0 --dry-run
node editor/build-scripts/cut-release.cjs 0.98.0
```

The command runs tests, finalizes both changelogs, creates the release commit
when needed, creates the annotated tag, and pushes the branch and tag. The tag
starts `publish-release.yml`, which creates the source release from the root
changelog. Signed downloads then follow sections 5-8 of
[`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md).

Before any upload, inspect `git status --short`, `git diff --check`, and the full
diff. Stage every intended 0.98.0 file, including the currently untracked test
files, and do not include ignored local projects or scratch captures.
