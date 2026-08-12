# obsidian-pokedex

House conventions for Obsidian plugin repos live in the `obsidian-plugin-dev` skill —
bun, script contract, all Svelte 5 rune and scoping gotchas, `obsidian eval` mechanics,
CSS specificity and containing-block traps, live-verification workflow. Only repo-specific
facts are below.

Has `graphify-out/` and `docs/adr/`. Deploys to the vault folder `pokedex` (intentionally
≠ manifest id `obsidian-pokedex`), and to `test-vault/`.

Inline comments here are unusually thorough and load-bearing. Most "shallow module" or
"duplicate logic" findings from automated architecture review turn out to be deliberate,
already-documented separations once the comments are read (6 of 8 candidates misdiagnosed
in one round, 3 of 5 in another). Reread the full file and check for an existing ADR before
writing a candidate into a report — not only before implementing one.

## Repo-specific toolchain

- `tsconfig.json` targets ES2020, so `Array.prototype.at()` (ES2022) fails typecheck with a
  misleading "change your target library?" error. Use `arr[arr.length - 1]`; do not bump
  the target (Obsidian runtime compat risk).
- `eslint-comments/no-restricted-disable` blocks disabling **any** rule via inline comment.
  There is no comment escape hatch — fix the underlying issue or leave the warning. This
  also rules out `expect.any(...)` in vitest (typed as `any`, trips
  `no-unsafe-assignment`): assert `Object.keys(...)` plus `typeof x` separately instead.
- `bun run lint` fails repo-wide on a pre-existing ESLint config error (type-info parsing
  on `vitest.config.ts`), confirmed via `git stash` to predate current work. Not your
  regression.
- `svelte-check` crashes with a TypeScript internal error here. The esbuild-svelte step in
  `bun run build` is the real Svelte-compile-error catcher.

## Data layer

- `PokeApiClient` owns request throttling via an internal `Semaphore`
  (`NETWORK_CONCURRENCY = 10`) enforced at the HTTP call site. Do not re-add cache-hit /
  cache-miss lane splitting or pre-partitioning in `PokedexRepository` to "protect"
  PokeAPI — that pattern forced a full-range disk scan before the first table row could
  render.
- `mapWithConcurrency` (`src/utils/concurrency.ts`) swallows per-item errors, so
  `cacheRange` / `refreshRange` / `getTableRows` never reject on a single failed id, and
  `FakePokeApiClient.failIds` cannot produce a real rejection through them. For classes
  that only orchestrate repository calls (e.g. `GenerationCacheController`), test against a
  narrow `Pick<PokedexRepository, …>` plus `vi.fn()` stubs; reserve the heavier
  repository + `FakePokeApiClient` stack (`PokedexLoadState.test.ts`,
  `DetailLoadState.test.ts`) for classes that need real fetch/cache behavior.
- Adding a genuinely new field to a raw PokeAPI response (e.g. `held_items` — as opposed to
  a trim-down of something already cached, like `moves`/`flavor_text_entries`) needs a
  matching `isStale` check on its `getOrFetch` call in `PokedexRepository.ts`. Otherwise an
  existing user's disk cache has the field `undefined` and crashes instead of self-healing.
- For a per-row derived value needing more than the already-fetched pokemon+species
  response and stable until the next generation ships (e.g. evolution-family depth), do not
  add a runtime fetch. Generate a static lookup table via `scripts/generate-*.ts`, reusing
  the real exported pure function from `src/data/*.ts` so it cannot drift, writing a
  committed `src/data/*.json` — see `scripts/generate-evolution-stages.ts` and
  `EVOLUTION_STAGES`. This keeps `PokedexTableRow` fields cheap, the invariant a first
  attempt broke by visibly slowing table load.

## Cache

Disk cache lives at `{manifest.dir}/cache` — the vault's deployed folder, not the manifest
id. `DiskCache.forPlugin` derives it from `manifest.dir` specifically because keying off
`manifest.id` used to orphan the cache in a sibling folder; `Cache.ts` holds one-time
migration logic. Inspect from eval via
`app.plugins.plugins['obsidian-pokedex'].manifest.dir + '/cache'`.

Regional forms have two distinct cache keys: the detail view fetches by numeric PokeAPI id
(`pokemon/10229.json` for Hisuian Growlithe) while table load's
`deriveRegionalForms`/`getOrFetchPokemonVariant` writes the name-keyed one
(`pokemon/growlithe-hisui.json`). `cacheRange` prefetches both unconditionally.
`clearRange` sweeps both, but only when the variant's own
`REGIONAL_FORMS[suffix].generationId` matches the generation being cleared — not its base
dex number's range, since those diverge (Alolan Rattata is dex #19 but `generationId: 7`).

Known residual gaps (ADR-0006): `getCacheStatus` does not count variants at all, so its
"X/Y cached" figure undercounts once a generation has regional forms; and because
`clearRange` only visits base ids inside its own range, a variant whose generation differs
from its base species' range survives every per-generation Delete and yields only to the
global "Clear cache".

Gating a cache-eviction sweep on a matching condition can silently make the *correctly*
scoped case unreachable too, if discovery is still keyed by the old range. Live-verify both
directions before calling such a fix done.

## Domain rules

- Never recompute a generation from `dexNumber` via `resolveGenerationId()` in UI code —
  use the row/entry's precomputed `generationId`. `resolveGenerationId(dexNumber)` is wrong
  for every regional form (Alolan Rattata: dexNumber 19/Gen 1, real generationId 7).
  `DetailScreen.svelte` did this and showed the wrong Roman numeral.
- Roman numerals come from `romanNumeral()` (`utils/romanNumeral.ts`) applied to
  `entry.generationId` — a generic algorithm, so it cannot drift the way the old
  hand-curated `ROMAN_NUMERALS` array did (it stopped at "VII" and rendered a blank `()`
  on every Gen 8 detail page).
- Adding a generation still means updating `GENERATIONS` plus the curated tables on
  `docs/multi-gen-expansion-plan.md`'s Recipe checklist: `FOSSIL_IDS`, `REGIONAL_FORMS`,
  `MEGA_VARIETY_KEYS`, `STAT_OVERRIDES`, `QUIRKS`/`TRAITS`.
- Adding a generation also stales cached Moves and Flavor Text for species from *every*
  previously-supported generation: those caches are trimmed to the current
  `MOVE_VERSION_GROUPS`/`FLAVOR_TEXT_TABS_BY_GEN` at fetch time (destructive, one-way) and
  no `isStale` check covers the widening. `resolveTabsForGen` now falls back gracefully
  instead of going blank, but seeing the new gen's data still needs a manual
  Settings → Refresh per generation.
- A regional-form or evolution-chain bug reported against one Pokemon is usually a whole
  category. Chains already group by shape (Muk-shaped, Yamask-shaped, Corsola-shaped,
  Mime-Jr-shaped, Obstagoon-shaped) — check `normalize.ts`'s shape comments for siblings
  before calling a chain fix complete.
- A bulk "does this whole family have property X" computation must walk the **raw**
  evolution chain (`evolves_to`), not `normalizeEvolutionChain`'s default no-context view.
  That view picks one coherent path for a specific viewed form and silently drops a branch
  gated entirely on a regional form with no unconditional sibling — it undercounted
  Farfetch'd (Galarian-only evolution) to 0 stages. See `evolutionFamilyDepth` in
  `normalize.ts`.
- Names are capitalized purely via CSS `text-transform` — `.textContent` returns the raw
  lowercase value (`"ivysaur"`). Match lowercase when locating elements via eval.

## PokeAPI

- `GET /pokemon?limit=N` silently truncates when `N` is below the true count (1351 as of
  Gen 8). Pass `limit=2000` or read the response's own `count`. A `limit=1300` scan once
  hid 46 non-canon fan "-mega" varieties and shipped a real bug.
- Numbered list resources are **not** contiguous — guessing sequential ids 404s (8 of 541
  evolution chains, confirmed live). Paginate the real list endpoint
  (`/evolution-chain?limit=600`) and use `results[].url`.
- Official-artwork shiny PNGs crop up to 31% tighter than non-shiny for ~46 of 97 Mega
  species (classic Gen 6 megas on a 475x475 canvas); newer fan-added megas (534x534) are
  unaffected. `DetailScreen.svelte`'s `portraitScale`, via `imageBounds.ts`'s
  `contentScale`, decodes each render's alpha bbox and scales the outlier down, shrink-only.
  Treat "this sprite looks bigger/smaller" reports as a whole-variety-group bbox scan
  before assuming a plugin bug.

## Table layout

- `table-layout: fixed` breaks "percentage width with a minimum floor" two ways silently:
  its sizing pass ignores `min-width`/`max-width` on `<col>`/`th`/`td` entirely, and it
  ignores `max()`/`calc()` on `<col>` width (falling back to equal splits). Use
  `table-layout: auto` with a plain `width: N%` on `<col>` for the extra-space share and a
  real `min-width` on the `<th>` as the floor — auto layout's never-shrink-below-content
  guarantee does the rest. Do **not** add `overflow: hidden; text-overflow: ellipsis` as a
  safety net: ellipsis collapses intrinsic min-content width to ~1 character and defeats
  that guarantee. Working pattern: `TableScreen.svelte`'s column widths.
- `tr:nth-child(odd)` striping breaks once a row can be conditionally inserted (a divider
  shifts parity for everything after it). Track alternation with an explicit index computed
  over real data rows only, applied as a class.
- A `<tr>`/`<td>` can take `height: 0` (with `position: relative; overflow: visible` on the
  `td`) and still show `position: absolute` content — absolutely positioned children do not
  contribute to auto-height. Used for `MoveBrowser`'s evolution-level divider overlay.
- `stroke-dasharray` with a dash shorter than `stroke-width` plus `stroke-linecap: round`
  (EvolutionTree's connector: width 3, dasharray "2 6") renders pill-shaped blobs, not
  circles — the two round caps overlap. CSS `radial-gradient`/dashed borders cannot
  reproduce it; reuse a real inline `<svg><line>`.

## Live-verify recipes

- Focus first: `getLeavesOfType('pokedex-view')` + `setActiveLeaf(leaf, {focus:true})`. For
  a genuinely fresh Svelte mount, detach and reopen via
  `executeCommandById('obsidian-pokedex:open-pokedex')`.
- `.pokedex-view` — not `.workspace-leaf-content` or `.table-wrap`, both of which merely
  wrap it — is the actual `overflow-y: auto` scroll container for the table screen.
- Current screen: `.pokedex-view > div`'s `className` contains `hidden-screen` when the
  table is hidden (i.e. viewing detail); `.dex-eyebrow`'s `textContent` (`"No. 004"`) says
  which Pokemon.
- FilterBar's Type/Gen/Ability/Stats/Rarity/EV/Quirks dropdowns are native
  `<details>`/`<summary>`, not JS popovers — click the `<summary>` (match trimmed text with
  `startsWith`; some carry a live count badge like "Gen 1").
- Truncation/wrapping across the whole table:
  `[...containerEl.querySelectorAll('.name-cell')].filter(c => c.scrollWidth > c.clientWidth)`,
  and compare `getBoundingClientRect().top` across a flex-wrap container's children. A
  screenshot only covers visible rows.
- Fixtures: Venusaur has both Mega (single "M" badge) and Gigantamax ("G"); Charizard's Mega
  splits into X/Y badges and is the `portraitScale` fixture (shiny crops ~9% tighter);
  Farfetch'd always holds an item (Stick, 5%).
- To verify an unfamiliar Lucide icon name, render it via `<Icon name=… />` in a live
  component and check `el.querySelector('svg')?.innerHTML` (non-empty = valid) — do not
  probe the icon registry from eval.
- To debug a `normalize.ts` discrepancy, do not hand-trace or eval-probe: write a
  standalone script (`bun run /path/to/script.ts`) importing the real source file by
  absolute path, run it against live-fetched PokeAPI data or the plugin's cached JSON, and
  add temporary `console.error` instrumentation in the source, then revert.

`temp/` is gitignored and already used for scratch output — prefer it over the OS tmp dir.
