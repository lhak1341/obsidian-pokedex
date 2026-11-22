# Card view has its own Fields; its tap panel shows every Field

Until now there was one Fields selection, shared by both layouts: switching between the table and Card view changed how the chosen Fields were drawn, never which ones (CONTEXT.md, "Fields", before this ADR). In Card view that one selection answered two questions at once: what fits on an ~75px tile, and what the tap panel shows. Tapping a tile is already a request for more about that one Pokemon, so hiding part of it there because the grid looked crowded worked against the request. And the two layouts have very different room: the strip drops its values past four stats, while the table has space for all fourteen Fields, so someone who wants three stats on tiles likely still wants six columns.

**Decision:**

- **Each layout has its own selection.** `visibleFields` stays the table's; `cardFields` is Card view's. Both live in `LocalPreferences` (ADR-0012), shared by every open leaf. The Fields menu edits the shown layout's selection.
- **Card view's menu offers only the Tile Fields** (CONTEXT.md): the six stats, Total and EV yield, which are everything the tile can draw.
- **The tap panel shows every Field**, whatever is chosen: six stat columns with Total after them, then every other Field as a chip. Its fixed/stretched column modes and the "Total becomes a chip with no stat row" fallback are gone.
- **Card view sorts by every sortable Field** (13 chips; the row already scrolls sideways). "Never sorted by a Field you can't see" still holds, because Card view shows every Field: `fieldsShown("card", …)` is all of them. The table keeps the old rule, so switching to it from a sort its selection lacks resets to No. ascending.
- **The tile shows the value the list is sorted by** in its top-left corner, in place of the dex number: the Sort value (CONTEXT.md). Without it, a list sorted by Catch rate looks unsorted. A stat gets its colour dot and the strip dims the other stats; another Field gets its menu icon. Sorted by Total, the Σ corner shows even when unchosen. Height and weight drop the unit and keep one decimal: "999.9 kg" fit a 75px well (66px chip) but covered the sprite's top, and rounding printed Cosmoem's 999.9 as 1000.

**Migration:** an older `data.json` has no `cardFields`. Before this, the tile drew the Tile Fields of the shared selection, so `hydrateSettings` seeds `cardFields` from the saved `visibleFields` (or `visibleColumns`) filtered to the Tile Fields, and the upgrading user's tiles look as they did. A fresh install gets all eight.

**Rejected:** keeping one shared selection while Card view's menu shows a subset. The Other Fields' checkbox states would still be there, invisible in Card view, and unchoosing Speed for the tile would also drop the table's Speed column. Putting the Sort value in the bottom-right corner, with Σ giving way while it shows, was rejected because a user who chose Σ would lose it whenever they sort by another Field.

**Consequences:** the tap panel is a constant height for a given width (two chip rows at a 390px pane, 160px measured), so the open-panel room in the Card window (ADR-0016) no longer varies with the selection. The top-left corner varies in width with the sort (51px for "999.9" with its icon, in a 75px well), never in height, so the two grid row heights the Card window measures are unchanged.
