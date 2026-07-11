# Pokedex

Browse, search, and inspect Pokemon (Gen 1-3) via [PokeAPI](https://pokeapi.co/), right inside Obsidian.

## Disclosures

- **Network use**: this plugin fetches Pokemon data, sprites, and artwork from `pokeapi.co` (a free, public, third-party API) on demand. No other network requests are made.
- **Caching**: fetched JSON and images are cached to disk under the plugin's own data folder (`.obsidian/plugins/obsidian-pokedex/cache/`) so repeat browsing doesn't re-fetch from PokeAPI. This cache is plugin-private and is not written to your vault as notes.
- **No telemetry**: this plugin does not collect or transmit any usage analytics.
- **No account or payment required.**
- **No ads.**
- Source is fully open (this repository).

## Usage

Open the Pokedex view via the ribbon icon or the "Pokedex: Open" command. Configure which generations to browse, sprite style, grid density, and cache in the plugin settings tab.
