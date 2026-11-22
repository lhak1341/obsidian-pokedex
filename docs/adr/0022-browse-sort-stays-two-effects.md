# The browse sort stays two effects over tested helpers

An architecture review (2026-11-22, candidate 4) proposed one pure `browseSort` module for the browse screen's sort: a `resolveSort(prev, { layout, shownFields, defaultSortColumn, seeded })` and the sortable set per layout, with `TableScreen.svelte`'s two `$effect.pre` blocks reduced to one call. Its reasons were that the rule "never sorted by a Field you can't see, re-seed on the setting" lived as two effects whose order and composition no test reaches, and that three lists said which columns sort. It found no bug.

On inspection:

- **The two effects cannot interact, so their order does not matter.** The seed effect only ever writes `{ column: defaultSortColumn, direction: "asc" }`, and `defaultSortColumn` is `"id" | "name"` (`PluginSettings` in `src/data/types.ts`; `settingsHydrate.ts` clamps a saved value to those two). No. and Name are not Fields, so `sortAfterFieldsChange` never resets them. The reset effect reads `sort` untracked, so the seed's write does not re-run it.
- **Every rule is already in a tested helper.** `fieldsShown` (Card view shows every Field, ADR-0020) and `sortAfterFieldsChange` are in `fields.test.ts`, `nextSort` in `sortPokemon.test.ts`, `SORT_CHIPS` in `cardView.test.ts`. What is left in the component is the one-line composition `sortAfterFieldsChange(sort, fieldsShown(layout, visibleFieldKeys))`.
- **There is one sortable list, not three.** Card view's chips and the table's headers both take the Fields that sort from `FIELDS[].sortKey`; only No. and Name are written out, as the table's two pinned columns with their own widths.
- **`resolveSort` would be shallow.** It has to take the seeded column in and hand it back, so its interface is as wide as the eight lines it replaces.

**Decision:** keep the two effects in `TableScreen.svelte` over the tested helpers. A comment at the effects states why they are independent.

**Rejected:** the `browseSort` module (above). A test of the two effects in sequence needs Svelte under vitest, which ADR-0003 covers.

**Reopen when** `defaultSortColumn` can name a Field (the seed could then be reset, and the effects' order would start to matter), or a third effect starts writing the sort.
