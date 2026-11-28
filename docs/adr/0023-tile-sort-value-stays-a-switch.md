# The tile Sort value stays a switch in cardView

An architecture review (2026-11-24, candidate 4) proposed that a sortable Field carry its own Card view tile value: a `compact?: (row) => string` on `Field` in `fields.ts`, with `tileSortValue` (`src/utils/cardView.ts`) reduced to a lookup by `sortKey` (`compact ?? render`, plus the Field's icon). Its reason was that a new sortable Field needs both a `FIELDS` entry and a matching case in `tileSortValue`, and typecheck forces the case to exist but not to agree with `render`. It found no bug.

On inspection:

- **The one way the two could drift was the number format.** Catch rate and Hatch counter's cases were already `render`'s `String(…)`; height and weight restated `formatHeight`/`formatWeight`'s `(x / 10).toFixed(1)` without the unit. That is fixed instead: `formatHeightValue`/`formatWeightValue` in `pokemonDisplay.ts` feed both, and `cardView.test.ts` pins that every non-stat tile Sort value plus its unit equals the Field's `render`.
- **The unit drop is a tile rule.** It exists to fit a ~75px tile (CONTEXT.md, "Sort value"; Cosmoem's 999.9 kg). A `compact` on `Field` would put a Card view presentation choice in the list both layouts read.
- **Folding one switch away leaves the structure.** `SortColumn` (`sortPokemon.ts`) is a closed union written apart from `FIELDS`, and `sortPokemon`'s `valueOf` switches over it too. A new sortable Field still touches `FIELDS`, `SortColumn` and `valueOf`; the proposal removed one of four places.

**Decision:** keep `tileSortValue`'s switch over `SortColumn`, its number formatting shared with `render` through `pokemonDisplay.ts`.

**Rejected:** `compact` on `Field` (above).

**Reopen when** `SortColumn` is derived from `FIELDS[].sortKey` (then every per-column switch could become a lookup on the Field, and that is the decision to make, not this one), or the tile needs a value that is not `render` less a unit.

**Addendum (2026-11-28, architecture review candidate 3):** the first reopen condition is now met. A text Field that sorts carries `sortBy` (the raw number its `render` formats) in `fields.ts`, `sortKey` is gone, and `SortColumn` is `"id" | "name" | SortableFieldKey`, derived from the Fields that have a `sortBy`; `sortPokemon`'s `valueOf` is a lookup on it. `tileSortValue` kept its switch anyway: the unit drop is still a tile rule (the second bullet above), and the switch over the derived `SortColumn` is what makes typecheck demand a tile case for each new sortable Field ("lacks ending return statement"). A new sortable Field is now its `FIELDS` entry plus that case. Folding the switch into a lookup on the Field is the `compact` proposal again, rejected above; reopen only on the second condition.
