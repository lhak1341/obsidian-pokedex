# Browse layouts stay mounted one at a time

An architecture review (2026-11-25, candidate 7) proposed keeping both browse layouts mounted, with the one not shown under `display: none`, and deleting `TableMemory` (`utils/tableColumns.ts`). `TableMemory` exists only because a layout switch remounts the grid: `BrowseScreen` draws `{#if layout === "card"} <CardGrid> {:else} <TableGrid>`. `TableGrid` copies four of its fields into its own `$state` and writes each change back. Card view keeps nothing between switches. A hidden layout's window already freezes (ADR-0016, ADR-0019), so the review expected the hidden copy to cost little. That was never measured. The pass mark was set before measuring: the hidden layout may add at most 10% or 20 ms, whichever is larger, to a search, sort or favourite on the Narrow pane.

**Measured** (2026-11-26) in `pokedex-test-vault`: all 9 generations (1,082 rows), CPU throttled 4× over CDP. The leaves were a 390px Narrow pane and a 1,396px wide table. Two builds alternated, A B A B A B, three samples an action per pass, so nine samples per cell. A was the code as it is; B kept both layouts mounted, each in a wrapper `<div>` with `style:display` set to `none` when not shown. Each action was timed from the input to the next frame (`requestAnimationFrame`, then `setTimeout(0)`):
- clearing a one-letter search (an `input` event on the search box);
- sorting by Name (the header, or Card view's sort chip);
- toggling one favourite (`plugin.preferences.toggleFavorite`, with `saveData` stubbed);
- switching the layout (`setLayout`).

A fresh mount was timed from a leaf swap until "1082 of 1082" showed with no loading banner.

| Median ms at 4× (A → B) | Search | Sort | Favourite | Switch away | Switch back | Fresh mount |
|---|---|---|---|---|---|---|
| Narrow, Card view shown | 53 → 79 (+49%) | 83 → 160 (+93%) | 15 → 26 | 284 → 153 | 190 → 74 | 1,186 → 1,237 |
| Narrow, table shown | 135 → 146 | 207 → 225 | 25 → 26 | 204 → 76 | 225 → 136 | 1,304 → 1,260 |
| Wide, table shown | 124 → 141 | 200 → 275 (+38%) | 23 → 29 | 529 → 146 | 213 → 137 | 1,225 → 1,317 |

The hidden table costs Card view the most: a search half again as long and a sort nearly twice as long. Each filtered or sorted row list still reaches the hidden table's props. `tableWidestRows` and `tableEntries` run again, and Svelte updates the rows it last drew, though nothing is laid out (inferred from the props; frames were not split with `long-animation-frame`). A hidden Card view costs the table less (+11/+18 ms on the Narrow pane), but the wide table's sort still rose 75 ms. A switch got 90–380 ms faster, and a fresh mount moved within its own pass-to-pass spread (about ±150 ms).

**Decision:** one layout is mounted at a time, and `TableMemory` stays. Search, sort and favourites happen many times a session; a switch is rare. B misses the pass mark on three actions.

**Consequences:** a switch stays the slow action: 190–530 ms at 4×, the wide table to Card view the slowest (above ADR-0019's ~300 ms reopen line, on a desktop, where a switch is rarest). Card view still starts each mount from its estimated tile heights.

**Rejected:** both layouts mounted with the one not shown under `display: none` (above).

**Reopen when** a layout switch becomes the complaint, or a hidden layout can skip its updates. One variant has not been tried: hand the hidden layout the rows it last showed, frozen, so only the switch pays to catch it up. Measure it against this table before deleting `TableMemory`.
