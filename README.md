# Pokedex

Browse, search, and inspect Pokemon (Gen 1-9) via [PokeAPI](https://pokeapi.co/), right inside Obsidian.

## Features

- **Sortable, filterable table.** Filter by Type, Generation, Ability, Stats, Rarity, EV yield, and Quirks; quick search with keyboard nav.
- **Detail screen.** Evolution chain, move browser (with per-version move-list toggles), abilities, held items, and flavor text, all with hover previews/descriptions.
- **Mega Evolution & Gigantamax.** Toggle alternate forms where available, including split Mega X/Y variants.
- **Regional forms.** Alolan, Galarian, Hisuian, and Paldean forms surfaced alongside their base species.
- **Shiny toggle** on sprites/artwork.
- **View history** with prev/next navigation between viewed Pokemon.
- **Per-generation caching.** Prefetch, refresh, or delete cached data per generation from the settings tab.

## Disclosures

- **Network use**: this plugin fetches Pokemon data, sprites, and artwork from `pokeapi.co` (a free, public, third-party API) on demand. No other network requests are made.
- **Caching**: fetched JSON and images are cached to disk under the plugin's own data folder so repeat browsing doesn't re-fetch from PokeAPI. This cache is plugin-private and is not written to your vault as notes.
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
bun run test      # vitest
bun run typecheck
bun run build     # typecheck + production bundle
bun run deploy    # build + copy into the configured test/live vaults
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and gotchas if you're working on this plugin.

## License

MIT, © 2026 lhak1341. See [LICENSE](./LICENSE).
