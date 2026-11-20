# Favourites, Fields and layout live in one plugin-owned holder shared by every leaf

Supersedes [ADR-0007](0007-local-preference-callbacks-stay-plumbed.md).

Three preferences change in place without remounting the view: favourites, the Fields selection, and the browse layout per width class (#27). Each Pokedex leaf used to seed its own copy once at mount and save that copy through a callback chain (`TableScreen`/`PokedexApp` → `PokedexView` → `main.ts`). With two Pokedex leaves open, which the spec designs for (a Narrow pane sidebar beside a wide main pane, stories 45–46), that lost data. Reproduced live with saves stubbed: favouriting Pikachu in the main pane and then Eevee in the sidebar saved `[133]`, and the same happened to Fields. Each leaf also showed only its own changes. This is ADR-0007's reopen condition, "a real persistence bug is observed".

**Decision:** `LocalPreferences` (`src/utils/localPreferences.ts`) is one holder per plugin (`PokedexPlugin.preferences`). It writes each change onto the plugin's live `settings` (through a getter, since `loadSettings` replaces that object), saves with `saveData` (no remount), and tells every subscriber. `PokedexView` passes it to `PokedexApp`, which keeps a `$state.raw` mirror refreshed by `subscribe`, so a change from any leaf shows in every leaf at once. `TableScreen` takes the Fields as a live prop. Its sort resets whenever the sorted Field disappears, whichever leaf unchose it.

- **Fields stay one selection for every leaf**, not one per width class like the layout (#27 grilling, Q3). Per-pane Fields would be new scope.
- **Settings that need a reload** (dex range, Active Gen, sprite style, Reduce motion) stay on `saveSettings`, which remounts every leaf.
  - *Update (2026-11-21):* `saveSettings` no longer remounts. `PokedexView.refresh` hands each app a settings copy (`applySettings`), and only the dex range (enabled generations) reloads rows, in place, through `PokedexLoadState.setScope`. Active Gen, sprite style and Reduce motion never needed a reload. The split this ADR draws stands: these preferences still bypass `saveSettings`, because each leaf mirrors them live from the holder.
- The holder is DOM-free and tested with vitest (`localPreferences.test.ts`). The Svelte wiring is checked live with a second leaf in the right sidebar (`src/view/CLAUDE.md`).

**Rejected:** building each write from the live `settings` but keeping per-leaf copies. That stops the lost saves in about six lines, but the two panes would still disagree on screen about which Pokémon are favourites until a remount.

**Reopen when** a preference needs a different scope (per leaf, or per device through `app.saveLocalStorage`), or a fourth in-place preference doesn't fit the holder's toggle/set shape.
