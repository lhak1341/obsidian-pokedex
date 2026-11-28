# Filter groups stay keyed Records, not one entry per group

An architecture review (2026-11-28, candidate 5) proposed holding each filter group (CONTEXT.md) as one entry carrying its empty value, predicate and count, as `QUIRKS`/`TRAITS` hold each option with its `matches`, with `PokedexFilters` derived from the entries and `filterPokemon` only combining them. Its reason was that one group lived in six places across three files and typecheck forced only some of them, so a group could compile without filtering anything. It found no bug.

On inspection, only one piece was forced. A probe adding a key to `FILTER_GROUP_KEYS` failed typecheck at `FilterBar`'s `GROUP_CHROME` `Record` alone: `filterGroupCount`'s switch returned `undefined` for the missing case, which typecheck allows because its return type includes it, and `filterPokemon`'s chain of `matchesX` calls had no tie to the key at all.

- **The gap is closed with Records over the same key, not a new shape.** `GROUP_MATCHES` (`filterPokemon.ts`) holds each group's predicate and `filterPokemon` runs every entry; `filterGroups.ts`'s counts are a `Record` too, with Stats' entry saying it has no badge. With `GROUP_CHROME`, a new key now fails typecheck in all three places. `GROUP_SAMPLES` (`src/utils/__fixtures__/filterGroupSamples.ts`) is a `Record` as well, so a new group also needs a sample selection, and tests check that it narrows the list and makes only that group active.
- **One entry per group fits these groups badly.** Their values differ in type (string arrays, generation numbers, Stats' per-stat ranges with its own "active" rule), so a derived `PokedexFilters` needs a mapped type over a mixed list. Search and the favourites toggle are filters but not groups, so the derived type would still need them written by hand beside it. The chrome is Svelte snippets that cannot leave `FilterBar`. So an entry would hold predicate, empty value and count, while the chrome, the handlers and two filters stayed elsewhere.
- **The files are cold.** No filter group has been added since #29, and none is planned.

**Decision:** keep `PokedexFilters` as written, with each group's predicate, count and chrome a `Record` over `FilterGroupKey`. ADR-0001's two generation checks are untouched: the `gen` entry calls `matchesGenerations`.

**Rejected:** one filter group entry per group with a derived `PokedexFilters` (above).

**Reopen when** a group needs a fourth per-group piece that cannot be a `Record` over `FilterGroupKey`, or the groups' values converge on one shape so a derived `PokedexFilters` would be a plain mapped type.
