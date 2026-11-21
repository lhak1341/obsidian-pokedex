# Favourites stay one set the list reads

`PokedexApp` turns the preferences mirror into one `favoriteIds` set (`new Set(prefs.favoritePokemonIds)`), and the browse list reads it whole: `TableScreen`'s `visibleRows` passes it to `filterPokemon` even while favourites-only is off, and every row asks it `has(row.id)`. So one toggle re-runs filter and sort and re-checks every row. A performance review (2026-11-21, candidate 3) proposed a per-id membership instead: a row reads only its own id, and `visibleRows` depends on favourites only while favourites-only is on. ADR-0012's one shared holder would have stayed.

**Decision:** keep the one set. Probed in `pokedex-test-vault`, 1,082 rows, CPU throttled 4× over CDP, the list showing (a detail screen hides the table, which makes it skip layout and lowers every number):

| | Total | Script | Style/layout |
|---|---|---|---|
| Toggle one favourite, wide table | 77–100 ms | 18–35 ms | 44–51 ms |
| Toggle one favourite, narrow table | 153–287 ms | 21–62 ms | 65–90 ms |
| Toggle one favourite, narrow Card view | 14–17 ms | no long frame | |
| A preference change that is not a favourite, narrow table | 18–26 ms | no long frame | |

- **The whole-list re-run costs about 20 ms.** A preference change that is not a favourite (`setLayout` to the current layout) still replaces `prefs` and rebuilds `favoriteIds`, so it re-runs filter, sort, the keyed diff and every row's `has`. That is the most per-id membership could save.
- **A table toggle's cost is layout.** The table is `table-layout: auto` (ADR-0014, ADR-0016), so the favourite dot appearing in one name cell lays the table out again. A padding change on one cell, with no Svelte involved, cost 66–73 ms of style/layout in the narrow table. Per-id membership changes none of that.
- **Card view, a phone's default, is already cheap** because it draws only the Card window (ADR-0016).

The dot's layout is a separate question from how favourites are read. Probed by changing one name cell's DOM directly: inserting and removing the dot took 86–406 ms in the narrow table (35–73 ms forced layout), against 28–71 ms (≤ 1 ms layout) for a dot that is always there and only toggles `visibility`. Toggling `opacity` instead was no better than inserting (165–236 ms). So `TableScreen`'s `markedName` now draws the dot on every row and a favourite only shows it (`visibility`). Measured after, same setup: a toggle takes 29–36 ms in the wide table (was 73–274) and 45–90 ms in the narrow one (was 98–259), with no long frame from style or layout. Clearing a search, which draws every row's dot, stayed within noise (median 1,913 vs 1,927 ms). A hidden dot is out of the accessibility tree: with one favourite, Chromium's tree held one "Favorite" node out of 1,082 dots.

**Rejected:** per-id favourite membership (above). It does shrink `TableScreen`'s and `CardGrid`'s interface (`isFavorite(id)` in place of a set), but that alone doesn't justify a second reactive mirror beside `prefs`.

**Reopen when** a favourite toggle's script half, not its layout, is the measured cost: for example, if filtering or sorting grows expensive enough that re-running them on every toggle shows up.
