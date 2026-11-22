# Browse layouts draw every row, unwindowed

**Card view part superseded by ADR-0016** (Card view draws a window), **table part by ADR-0019** (the table draws a window and its widest rows). Kept for the measurements and the reasoning they replaced.

The browse screen draws every filtered row: the table one `<tr>` per row (`TableScreen.svelte`'s `{#each visibleRows}`), Card view one tile per row (`CardGrid.svelte`), whose effect also decodes every tile's sprite box (`imageBounds.ts`'s `contentBounds`). An architecture review (2026-11-20, performance, candidate 2) proposed one pure visible-window module (scroll position → row slice plus spacer heights) for both layouts, measuring a 7.3 s Card view mount and 25.5k DOM nodes for 1,082 rows.

**Decision:** neither layout is windowed.

- **The table** sizes its columns with `table-layout: auto` from every row's content (`src/view/CLAUDE.md`, "Table layout": `fixed` silently ignores the min-width floors). A windowed table sizes from the slice, so column widths shift while scrolling, or it needs fixed widths and loses that rule.
- **Card view** stopped needing it once table load updates were throttled (`PokedexLoadState`, `UPDATE_INTERVAL_MS`). The review's 7.3 s was measured before that fix and counted the wait until the *last* tile was measured. Probe after the fix, in `pokedex-test-vault`, all 9 generations: reload the plugin (empties the decode memo and the repository's mem caches), stub `saveData`, set both width classes to Card view, run `open-pokedex`, then poll every 30 ms for the time when the tiles reach the scroller's bottom and every on-screen tile has `.tile-sprite.measured`, and for all 1,082 tiles drawn and measured; a `longtask` PerformanceObserver runs throughout.

  | Cold open | Full first screen measured | All tiles drawn | All measured | Longest long task | Nodes |
  |---|---|---|---|---|---|
  | Desktop, 1,396px leaf (85 tiles on screen) | 0.4–0.5 s | 2.6–3.8 s | 3.6–4.0 s | 0.15–0.33 s | 25,539 |
  | Emulated phone (`dev:mobile`), 390px leaf (16 on screen) | 0.38 s | 2.4–3.6 s | 3.4–3.8 s | 0.32–0.62 s | 24,981 |

  The rest is drawn while the view is already usable. Windowing would save that background time and the nodes, and in exchange Card view would carry spacer math, the tap panel's placement under its tile's grid row inside a slice, the scroll correction that keeps a tapped tile under the finger, and keyboard tab order across undrawn tiles.

**Rejected:** the shared visible-window module (above); windowing Card view alone.

**Not measured:** a real iPhone. The emulated phone ran on a Mac's CPU and memory.

**Reopen when** a real iPhone (the loop in `docs/mobile-verification.md`) shows a cold Card view first screen over about 1 s, or a long task over about 1 s while scrolling; or when the table drops `table-layout: auto`.
