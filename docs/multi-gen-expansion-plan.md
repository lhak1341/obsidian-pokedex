# Multi-Generation Expansion Plan

## Goal

End state: full Gen 1-9 dex support, with the ability to view any single generation's data (starting with Gen 3 / FRLG-RSE, the current baseline) independent of which generations are enabled overall — a "classic mode" toggle that never goes away as later gens are added.

## Current state (baseline)

- Dex #1-386 (Gen 1-3) only, defined by `GENERATIONS` / `DEFAULT_ENABLED_GENERATIONS` in `src/data/constants.ts`.
- Movepool filtered to `firered-leafgreen` + `emerald` version groups (`MOVE_VERSION_GROUPS`).
- Flavor text: 4 tabs, Gen 3 games only (`FLAVOR_TEXT_TABS`).
- Evolution conditions cover every Gen 1-3 method: level, item, trade, trade + held item, friendship, friendship + time-of-day, beauty, relative physical stats. (Fixed 2026-07-15 — see Log.)
- No regional forms / Mega Evolution / Gigantamax / alternate varieties — one species = one dex row, 1:1.

## Resolved — "Active Gen" setting, global, independent of dex-range filter

**Mechanism**: a single-select "Active Gen" control (not a binary Gen3-vs-latest toggle) — pick any generation the app currently supports, and stats/moves/flavor text everywhere prioritize that generation's data, falling back to the latest supported generation's data when the active generation has no divergent record for a given species. Lives in the plugin's Settings tab, not an in-view control — see the 2026-07-15 "relocated to Settings" log entry for why. The main view shows the current choice passively, as `Pokedex • Gen N` in place of the plain `Pokedex` title.

**Stats**: `/pokemon/{id}.stats` only returns the **current** (latest-game) base stat line — there's no per-version-group stats field the way movepools have `version_group_details`. But most species' current stats *are* what their era actually used; the only known divergence so far is the list of species Gen 6 (X/Y) buffed (e.g. Butterfree, Beedrill, Pidgeot, Arbok, and others — exact list to verify at implementation time). Decision: a small hardcoded override table, same pattern as `FOSSIL_IDS` in `constants.ts` — `{ pokemonId: { validThroughGen: N, stats: {...} } }`. Lookup: if Active Gen ≤ `validThroughGen` for that species, use the override; otherwise fall back to current-gen `/pokemon` stats. For every species not in the table, the fallback already *is* correct data for every generation (nothing ever changed) — not a compromise. Extend the table whenever a later phase introduces a further divergence (Gen 6 itself will, once Phase 3 lands).

**Moves/flavor text**: same Active Gen selection drives which generation's version-group tabs show (the existing FRLG/RSE and per-game flavor tabs are the *game* level, nested one level below the *generation* Active Gen picks — Gen 4 gets its own Diamond/Pearl-Platinum-HGSS tabs under "Gen 4", same pattern, not a flat new tab row bolted alongside FRLG/RSE).

**Scope — independent of the existing row-visibility filter**: Active Gen is a separate axis from the existing multi-select `GENERATIONS` filter (which controls which dex rows/Pokemon are visible at all). Picking "Gen 3" as Active Gen does not restrict the dex range — you can browse a Gen 7 Pokemon while Active Gen is set to Gen 3; its stats/moves/flavor simply fall back to latest since Gen 3 predates it. This keeps the two concerns (row visibility vs. data-era preference) uncoupled.

## Design principle: generation is a first-class axis, not bolted on later

Reuse and extend existing precedent rather than inventing a new mechanism:

- `GENERATIONS` (`constants.ts`) — already a table of gen → dex range; adding Gen 4-9 entries is additive.
- `MOVE_VERSION_GROUPS` filter pattern — the same filtering approach extends to any future per-gen moveset toggle.
- `FLAVOR_TEXT_TABS` — the same tab pattern extends to new games per generation.

Any "view as Gen X" toggle should compose these four filters (dex range, moveset version group, flavor version, stat-override lookup) rather than a one-off mechanism per generation.

## Recipe: adding the next generation

Repeatable steps, extracted from how Phase 1 (Gen 4) actually got built — follow in order, each is independently testable:

1. **Dex range**: add an entry to `GENERATIONS` in `constants.ts` (id, name, start/end dex number). `DEFAULT_ENABLED_GENERATIONS` picks it up automatically.
2. **Move/flavor tables**: add the new generation's key to `MOVE_VERSION_TABS_BY_GEN` (game version-group names, e.g. `"black-white"`) and `FLAVOR_TEXT_TABS_BY_GEN` (game version names, grouping identical-text games into one tab like the existing Ruby/Sapphire and Diamond/Pearl pairs). Source names from PokeAPI's `version-group`/`version` endpoints, not memory. **This step alone re-scopes every other version-filtered field for free** — `FLAVOR_TEXT_VERSION_GROUPS` (derived from the table above) is the one shared "games this app currently supports" list, reused by held items (`normalizeHeldItemDetails`/`normalizeHeldItems`) and anything future added the same way. Don't invent a second version list for a new per-species, per-game field — filter it against this one, same as held items does.
3. **New evolution conditions**: check whether this generation introduces evolution triggers not yet modeled (see each phase's bullet list above — e.g. Gen 5 adds `trade_species`, Gen 8 adds `needs_overworld_rain`/`turn_upside_down`). Extend `RawEvolutionChainLink`/`EvolutionNode` in `types.ts` and `normalizeEvolutionChain`/`describeEvolutionRequirement` in `normalize.ts` — same pattern each time (raw field → normalized field → label branch). `describeEvolutionRequirement` (the evolution-card label logic, moved here from `EvolutionChain.svelte` during a 2026-07-15 architecture pass — that component is render-only now) has its own test fixtures in `normalize.test.ts` via a local `node(overrides)` helper, separate from `nextEvolutionLevels`'s inline literal `EvolutionNode` objects — a new field needs updating both.
4. **Stat overrides**: research (don't assume from memory — verified live fetch + parse caught a real bug last time) whether this generation's release included a base-stat rebalance for any dex #1-N species already in scope. Extend `STAT_OVERRIDES` in `constants.ts` if so, using `validThroughGen` to mark the last generation still using the old value.
5. **Sprites**: spot-check that PokeAPI actually has sprite data for the new dex range (`sprites.versions['generation-<n>']` etc.) — no code change expected, this has been a non-issue so far, but confirm before assuming.
6. **Verify**: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run lint`, then live-verify in the vault per this repo's CLAUDE.md gotchas (deploy → disable/enable → drive it via `obsidian-cli eval`) — at minimum, one Pokemon per new evolution condition and per new stat override, the Active Gen setting actually switching the new generation's move/flavor tabs in, and a species with wild held items to confirm nothing from the *next* out-of-scope generation leaks in (the Parasect/Balm Mushroom bug).
7. **Log it**: append a dated entry to this doc's Log section — what shipped, what was scoped out, anything non-obvious hit along the way (a wrong assumption caught, an API quirk, etc.) — same as every entry below.

## Phased rollout

### Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax
- Add a Gen 4 entry to `GENERATIONS` (dex range 387-493).
- Add Gen 4 move-version-group entries (`diamond-pearl` / `platinum` / `heartgold-soulsilver`) as their own game-tab set, nested under Gen 4 in the Active Gen dropdown (see "Active Gen dropdown" section above).
- Add Gen 4 `FLAVOR_TEXT_TABS` entries.
- New evolution conditions introduced in Gen 4: location-based (e.g. Magneton → Magnezone), known-move, party-species/held-item combos (e.g. Mantyke). Extend `EvolutionNode`/`detailLabel` the same way the min-beauty/relative-physical-stats work did.
- Sprites: confirm PokeAPI's Gen 4 sprite paths (`sprites.versions['generation-iv']`) cover what's needed.
- No regional forms yet — none exist before Gen 5, moot for this phase.
- Resolve the stats risk above (at minimum: explicit decision + this doc updated) before calling Phase 1 done.

### Phase 2 — Gen 5 (Unova, #494-649)
- New evolution trigger: `trade_species` (Karrablast ↔ Shelmet).
- No new form complexity.

### Phase 3 — Gen 6 (Kalos, #650-721)
- Mega Evolution introduced — first real forms/varieties problem. Needs an explicit scope decision: skip entirely, or model as a toggle/badge on the base species rather than a separate dex row (Mega isn't a permanent evolution and has no natural dex number of its own).
- This is also where several Gen 1-3 species got the base-stat buffs referenced in the stats risk above.

### Phase 4 — Gen 7 (Alola, #722-809)
- Regional forms (Alolan) introduced — same species, alternate `pokemon` variety/form in PokeAPI, not a new species id. Needs a decision: separate browsable rows, or a form-switcher on one row. This affects table/search/filter architecture directly, since dex id is no longer 1:1 with a table row once it ships.
- Z-Moves are a battle mechanic, not dex data — likely permanently out of scope.

### Phase 5 — Gen 8 (Galar, #810-905)
- Gigantamax — same forms problem as Mega, an additional layer on top.
- Two new evolution conditions: `needs_overworld_rain` (Sliggoo → Goodra), `turn_upside_down` (Inkay → Malamar).
- Regional forms (Galarian) — same architecture question as Alolan above.

### Phase 6 — Gen 9 (Paldea, #906-1025ish)
- Terastallization is a battle mechanic — likely out of scope, not a dex-level trait.
- Paldean forms (e.g. Tauros variants).
- Confirm final dex count, including any DLC additions.

## Explicitly deferred — needs its own go/no-go, not a default yes

Mega Evolution, Gigantamax, regional forms, and Terastallization are all real architecture changes (species stops being 1:1 with a dex row). None of these should be folded silently into a phase — each needs its own decision before work starts.

Z-Moves and Dynamax are battle-only mechanics, not dex traits, and are likely permanently out of scope for a dex reference tool.

## Open questions — none blocking Phase 1 start

All three original open questions (stats source, moveset toggle UI, global-vs-per-Pokemon scope) resolved into the single "Active Gen dropdown" design above. Remaining open items are the per-phase go/no-go decisions already called out under "Explicitly deferred" (Mega, Gigantamax, regional forms, Terastallization) — those stay pending until their respective phase is actually reached, by design.

## Log

- 2026-07-15: Gen 1-3 evolution-condition gaps fixed (friendship, friendship + time-of-day, trade + held item, beauty, relative physical stats). Baseline for future gens' evolution work.
- 2026-07-15: This plan created.
- 2026-07-15: Active Gen dropdown design agreed — global, single-select across all supported generations, independent of the existing dex-row-visibility filter; stats resolved via curated override table with fallback to latest; moves/flavor game-tabs nest under whichever generation is active.
- 2026-07-15: **Phase 1 shipped.** `GENERATIONS` extended with Gen 4 (#387-493); `MOVE_VERSION_GROUPS`/`FLAVOR_TEXT_TABS` restructured into per-generation tables (`MOVE_VERSION_TABS_BY_GEN`, `FLAVOR_TEXT_TABS_BY_GEN`); new Gen 4 evolution conditions added (location, known-move, party-species, gender — gender wasn't in the original Phase 1 bullet list but is the same category of gap as the Gen 1-3 fixes, so folded in); `STAT_OVERRIDES` curated table built from Bulbapedia's Gen 6 stat-buff list (22 species, dex #1-493 in scope, sourced via live fetch + parse rather than memory — the naive parse mis-indexed single-type rows against the Total column, caught by sanity-checking known values, fixed by anchoring from the row's end instead of a fixed offset); Active Gen wired into stats/moves/flavor text with fallback-to-latest-generation behavior verified for a genuine no-data case (Turtwig at Active Gen 3). Not done in this phase: browse-table stat columns still show current-gen stats unconditionally (Active Gen only affects the detail screen) — a known, intentionally-scoped gap, not an oversight.
- 2026-07-15: Active Gen control relocated to the Settings tab (not an in-view dropdown) — a "flip constantly mid-session" control didn't fit; opening Settings to occasionally switch eras does. The main view instead shows a passive `Pokedex • Gen N` indicator in place of the plain `Pokedex` title, read from `PluginSettings.activeGen` at each `getDisplayText()` call. This meant reverting the lightweight non-remounting persistence path built earlier in favor of the existing `saveSettings()`/full-remount convention every other setting already uses — an accepted tradeoff now that quick in-session flipping isn't the goal. Surfaced two separate, undocumented title-refresh surfaces in Obsidian's `WorkspaceLeaf`/`ItemView` (`leaf.updateHeader()` for the tab-strip chip, `containerEl.querySelector(".view-header-title")` for the larger pane title shown when focused) — verified live that a naive implementation using only `updateHeader()` left the pane title stale; both are now patched in `PokedexView.refresh()`.
- 2026-07-15: Wild-encounter held items added — a toggleable table column (name only) and a richer detail-page line (name + rarity %), from `RawPokemon.held_items`. This is data-completeness work spanning every currently-supported generation, not gen-specific, so it lives outside the phase numbering above. Two things worth remembering for the next data field like this: (1) a brand-new field on an already-cached raw response needs the `isStale`-refetch precedent (see `getOrFetchPokemon`'s `held_items`-presence check), not just a "Clear cache" suggestion — a cache-cleared session masked this the first time, only caught because a second disable/enable cycle hit genuinely-stale cache; (2) PokeAPI's per-item `version_details` must be filtered to `FLAVOR_TEXT_VERSION_GROUPS` (this app's already-supported-games list) or a later generation's item leaks into an earlier-generation-scoped view — caught live via Parasect showing Gen 5's Balm Mushroom while capped at Gen 4.
