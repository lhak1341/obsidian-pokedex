# Pokedex

Browse, search, and inspect Pokemon (Gen 1-9) via [PokeAPI](https://pokeapi.co/), right inside Obsidian.

## Features

- **Sortable, filterable table.** Filter by Type, Generation, Ability, Stats, Rarity, EV yield, and Quirks; quick search with keyboard nav. Choose which Fields show as columns.
- **Card view.** A sprite-tile grid as an alternative to the table, remembered per pane width. Tap a tile for a panel with every Field; tiles come in three sizes and show the value the list is sorted by.
- **Favourites.** Star a Pokemon on its detail screen; favourites are marked in both lists and toggled by right-click or press and hold.
- **Mobile and narrow panes.** Runs on Obsidian mobile; a narrow pane gets a compact toolbar, a sideways-scrolling table with No. and Name pinned, and a detail screen laid out for its width.
- **Detail screen.** Evolution chain, move browser (with per-version move-list toggles), abilities, held items, and flavor text, all with hover previews/descriptions.
- **Mega Evolution & Gigantamax.** Toggle alternate forms where available, including split Mega X/Y variants and Legends: Z-A Megas.
- **Regional forms.** Alolan, Galarian, Hisuian, and Paldean forms surfaced alongside their base species.
- **Shiny toggle** on sprites/artwork.
- **View history** with prev/next navigation between viewed Pokemon.
- **Reduce motion** setting, also following the OS preference.
- **Per-generation caching.** Prefetch, refresh, or delete cached data per generation from the settings tab.

## Disclosures

- **Network use**: this plugin fetches Pokemon data, sprites, and artwork from `pokeapi.co` (a free, public, third-party API) on demand. No other network requests are made.
- **Caching**: fetched JSON and images are cached in a per-device IndexedDB database so repeat browsing doesn't re-fetch from PokeAPI. Nothing is written to your vault, and the cache does not sync between devices. Versions before 0.2.0 cached to a `cache` folder inside the plugin's folder; it is deleted once on first start after updating.
- **No telemetry**: this plugin does not collect or transmit any usage analytics.
- **No account or payment required.**
- **No ads.**
- Source is fully open (this repository).

## Usage

Open the Pokedex view via the ribbon icon or the "Pokedex: Open" command. Configure which generations to browse, sprite style, grid density, and cache in the plugin settings tab.

## Installation

Not on the community plugin store. Either:

- **Manual:** download `main.js`, `styles.css`, and `manifest.json` from a [release](https://github.com/lhak1341/obsidian-pokedex/releases) into `<vault>/.obsidian/plugins/obsidian-pokedex/`, then enable it in Obsidian's Community Plugins settings.
- **BRAT:** add this repo to [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) as a beta plugin.

## Development

```bash
bun install
bun run check     # typecheck + lint + tests: the gate CI and releases run
bun run test      # vitest
bun run typecheck # svelte-check
bun run build     # production bundle (esbuild only; it does not typecheck)
bun run deploy    # typecheck + build + copy into the configured test/live vaults
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and gotchas if you're working on this plugin.

## License

MIT, © 2026 lhak1341. See [LICENSE](./LICENSE).
