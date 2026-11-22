# Card view draws a window; the table still draws every row

Supersedes ADR-0014's Card view decision. Its table decision, restated below, is superseded in turn by ADR-0019.

ADR-0014 timed only the cold open. After it, a phone was still laggy at 1,082 rows, and decent with a subset (favourites). A second performance review (2026-11-21) timed what happens after the load, in `pokedex-test-vault` with the CPU throttled 4× over CDP (`Emulation.setCPUThrottlingRate`, a stand-in for a phone, not a measurement of one) and a 390px leaf. Each action that redraws or reorders the list cost about per drawn row, roughly half script and half style/layout (split from `long-animation-frame` entries):

| Narrow Card view, 4× | 1,082 rows, every tile drawn | 25 favourites | 1,082 rows, Card window |
|---|---|---|---|
| Clear a 1-letter search | 1,287 ms | 90 ms | 228 ms |
| Sort by Name | 1,432 ms | 34 ms | 124 ms |
| Favourites-only off | 1,389 ms | | 83 ms |
| Toggle one favourite | 124 ms | 30 ms | 60 ms |
| Scroll 250px a frame, worst frame | 434 ms | 42 ms | 75–214 ms |
| DOM nodes under the leaf | 24,977 | 724 | 1,780 |

**Decision:** Card view draws only the tiles near the viewport: the Card window (CONTEXT.md), `cardWindow` in `utils/cardView.ts`, drawn by `CardGrid.svelte`.

- **One viewport of overscan above and below, in whole grid rows.** The undrawn rows are the grid's own `padding-top`/`padding-bottom`, so the row gap stays out of the sums.
- **Spacers are exact, never estimated.** A grid row is one of two heights: tall when any tile in it has a form line (`isTallCardRow`, read from the rows), plain otherwise. Both are measured from drawn tiles (a tile stretches to its grid row's height) by a `ResizeObserver`, so a font, Fields or width change re-measures. Back-to-list's restored `scrollTop` and the tapped-tile correction in `toggle()` therefore land where they did. Estimates serve only a fresh mount's first draw, at the top.
- **The open tap panel's room** (its height plus the panel gap) stays in the spacer while its row is outside the window. The panel remounts at full height when its row comes back; only a tap grows it (`CardPanel`'s `grow`, read once).
- **The window freezes while the table screen is hidden** (the detail screen owns `.pokedex-view` then, and the grid measures 0): the scroll offset, viewport and grid width ignore the hidden reads.
- **Sprite boxes are still decoded for every row**, in the background as before, so a tile scrolled into view shows its sprite at once.

Probed live: total grid height constant over a 52-step walk to Pecharunt; at 27 offsets a 700px scroll moved a still-drawn tile exactly 700px; back from a detail screen restored the same tile at the same offset.

**Consequences:** Tab stops at the last drawn tile, so a keyboard user scrolls to reach the rest (Card view is the touch layout; a wide pane opens on the table). A 250px-a-frame fling still runs at a 23–24 ms median frame against 17 ms at 60px a frame, mostly style/layout of newly drawn tiles. A real iPhone is not measured yet: the user checks it after this ships.

**The table stays unwindowed** (ADR-0014): `table-layout: auto` sizes columns from every row, and `content-visibility: auto` on `<tr>` gave no style/layout gain when injected live (899 vs 909 ms). The narrow table stays slow at 1,082 rows (3.4 s to clear a search at 4×). Keeping every row mounted and hiding filtered ones (`display: none`) instead of destroying them was also rejected (2026-11-21, review candidate 4): un-hiding the 876 rows a one-letter search removes, done straight on the DOM with no Svelte, still took 1,100–1,258 ms (691–763 ms style/layout, the auto table laying the returning rows out), against about 1,900 ms for Svelte's re-create. Sort gains nothing, since a `<tr>` moves only by moving its node.

**Rejected:** `content-visibility: auto` on `.card-tile` alone. It cut style/layout by about 80% (697 → 128 ms on a sort) but left the script half, and its estimated sizes would be a second source of scroll height beside the window's spacers. Nor does it help alongside the window (tried 2026-11-21, with each kind's measured row height as the placeholder): Blink renders everything the window draws, since the one-viewport overscan sits inside its own render-ahead margin (0 of 144 `contentvisibilityautostatechange` events skipped a tile, the first drawn tile 798px above a 748px viewport), so nothing is left to skip. Its paint containment also clipped the focus ring, which sits outside the full-width well. Worth retrying only if a WebKit reading shows a smaller margin.

**Reopen when** the iPhone shows a Card view action over about 300 ms, or the narrow table's lag becomes the complaint (that needs the table off `table-layout: auto`).
