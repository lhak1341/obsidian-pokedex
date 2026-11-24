# The table draws a window and its widest rows

Supersedes ADR-0014's and ADR-0016's table decision (the table draws every row).

ADR-0016 reopened the table "when the narrow table's lag becomes the complaint". It did: on a phone, switching from Card view to the table was unusable. Timed in `pokedex-test-vault` (all 9 generations, 1,082 rows), CPU throttled 4× over CDP, a 390px leaf, before the change: the switch took 2.1–2.9 s, a sort by Name 1.7–1.8 s, clearing a one-letter search 2.1–2.2 s, every one a single frame, about half script and half style/layout.

ADR-0014 kept the table unwindowed because `table-layout: auto` sizes each column from every row's content (`src/view/CLAUDE.md`, "Table layout": `fixed` ignores the min-width floors), so a slice alone would resize columns while scrolling.

**Decision:** the table draws only the Table window (CONTEXT.md): `tableWindow`, `widestRows` and `tableEntries` in `utils/tableWindow.ts`, drawn by `TableScreen.svelte`. It stays `table-layout: auto`.

- **The widest rows keep the column widths.** For each content-sized column (Name, Type as text, every text Field, held items, EV), the two rows whose text measures widest (canvas `measureText` with the table's font, cached per row object) are always drawn, as real rows at their own places in the list between spacers. The auto table then sizes every column exactly as it would from all rows. Nothing is hidden, so no engine's handling of collapsed or zero-height rows is involved (WebKit's `visibility: collapse` on rows is not something this repo can check). EV ranks by chip count before text, since each chip adds padding and a dot the text leaves out.
- **Every row is one height** (45px comfortable, 33px compact: the sprite's), so each run of undrawn rows is one spacer row of an exact multiple of it. Two things broke that and were fixed for this: three EV chips wrapped to a second line in the Narrow pane's 204px column (Meloetta and Flutter Mane were 55px), and are now held to one line (the column grows 0.14px); and a row without a sprite now keeps the sprite's box. Under `border-collapse`, row 0 holds half of the header's 2px border (45.5px) and the last row has no border below it (44.5px): both are measured, and the spacer standing in for either adds the difference. A spacer keeps the rows' top border, or the row after it came out 0.5px short.
- **The window is the viewport plus one viewport above and below, moved in steps of 16 rows.** Each move inserts rows and lays the whole auto table out again. Moving it on every row a fling passed cost a long frame each time: at 250px a frame, the median frame was 55–62 ms with steps of 8 and 16–17 ms with steps of 16 (with every row drawn: 16–19). 24 gained nothing more.
- **It freezes while the detail screen hides the table**, as Card view's window does, so back-to-list's restored scroll offset finds the same rows drawn.
- **Rows are striped by list position** (`stripe`), not `nth-child`, which the spacers and the moving start would shift.

Measured after, same setup, two passes alternating with HEAD:

| Narrow table, 4× | Every row drawn | Table window |
|---|---|---|
| Switch from Card view | 2,051–2,922 ms | 135–165 ms |
| Sort by Name | 1,678–1,812 ms | 128–158 ms |
| Clear a one-letter search | 2,082–2,234 ms | 109–141 ms |
| Scroll 60px a frame, median / p90 | 17 / 78 ms | 17 / 18–19 ms |
| Scroll 250px a frame, median / p90 | 16–17 / 82–97 ms | 16–19 / 74–113 ms |
| Rows in the body | 1,082 | about 80 (spacers included) |

Probed live: the header's column widths equal HEAD's (every row drawn, EV chips held to one line by injected CSS) at 390px, 900px and full leaf widths, comfortable and compact, type badges and icons, Active Gen 3, 4, 6 and 7, default Fields and every Field, and stay one value over a full scroll walk. With `widestRows` broken to draw no extra rows, Name narrowed from 243.59 to 205.37px at 900px. Every drawn row sat at its index × 45px from the body's top over a 70-offset walk; the body stayed 48,690px (1,082 × 45); a 350px scroll moved every still-drawn row exactly 350px, except once, by 0.5px, the first time the last row is measured. Back-to-list from a detail screen restored the same row at the same offset.

**Consequences:** the first fling after a mount can drop a few long frames (300–1,300 ms at 4×, in the first runs only, never with more than 114 rows drawn); inferred, not proved, to be sprites decoded as their rows first appear, which the full table did once during its mount. Tab stops at the last drawn row, as in Card view. A probe over `tbody tr` sees the window and the widest rows (`tr[data-index]`), not every row. A new content-sized column needs a score in `TableScreen`'s `widest`, or its width changes as rows scroll in; a cell that can wrap or grow taller than the sprite breaks the spacers. A real iPhone is not measured yet.

**Rejected:**

- **Fixed column widths** (`table-layout: fixed`, or widths measured once and written as px): `fixed` drops the min-width floors, and a measured width needs every row's content anyway.
- **Hidden sizer rows** (the widest rows in a `visibility: collapse` or zero-height row group): `collapse` on rows is unverified on iOS WebKit, and a zero-height row needs every cell's content wrapped, a second copy of the row markup.
- **A running maximum** (columns only grow as wider rows scroll in): columns move while the user scrolls.

**Reopen when** the iPhone shows a table action over about 300 ms, or a fling that stutters past the first one after opening.

**Addendum (2026-11-24):** the scores (which columns get one, from what text) and the per-row width cache moved out of `TableScreen`'s `widest` into `tableWidestRows` and `createRowTextWidths` in `utils/tableColumns.ts`, where they are tested with a fake `measure`. `TableScreen` keeps the canvas and the font read. The decision above is unchanged; where it says "a score in `TableScreen`'s `widest`", read `tableWidestRows`. The table's drawing, its window state and that canvas then moved from `TableScreen` into `TableGrid.svelte`, the table layout beside `CardGrid.svelte`; `TableScreen` stays the browse screen's owner (filters, sort, Fields). Where this ADR says the table is drawn by `TableScreen`, read `TableGrid`. Since `TableGrid` remounts on every switch from Card view, what it measured (row height, the first and last rows' extras, font, text widths) lives in a `TableMemory` its owner holds, so a switch neither re-measures every row nor leaves the spacers half a pixel off.
