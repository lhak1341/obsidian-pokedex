import { Notice, Plugin } from "obsidian";
import { IndexedDbCacheStore } from "./data/IndexedDbCacheStore";
import { deleteLegacyDiskCache, LEGACY_CACHE_NOTICE, legacyDiskCacheDirs } from "./data/legacyDiskCache";
import { PokeApiClient } from "./data/PokeApiClient";
import { PokedexRepository } from "./data/PokedexRepository";
import type { PluginSettings } from "./data/types";
import { DEFAULT_SETTINGS, PokedexSettingTab } from "./settings";
import { hydrateSettings } from "./utils/settingsHydrate";
import { PokedexView, VIEW_TYPE_POKEDEX } from "./view/PokedexView";

export default class PokedexPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	cache!: IndexedDbCacheStore;
	repository!: PokedexRepository;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.cache = IndexedDbCacheStore.forVault(this.app);
		this.repository = new PokedexRepository(new PokeApiClient(), this.cache);

		// After layout, so deleting a large synced folder never delays startup.
		this.app.workspace.onLayoutReady(() => void this.removeSyncedCache());

		this.registerView(
			VIEW_TYPE_POKEDEX,
			(leaf) => new PokedexView(
				leaf,
				this.repository,
				() => this.settings,
				(columns) => void this.setVisibleColumns(columns),
				(ids) => void this.setFavorites(ids),
			),
		);

		this.addRibbonIcon("table-2", "Open pokedex", () => void this.activateView());
		this.addCommand({
			id: "open-pokedex",
			name: "Open",
			callback: () => void this.activateView(),
		});

		this.addSettingTab(new PokedexSettingTab(this.app, this));
	}

	private async removeSyncedCache(): Promise<void> {
		const dirs = legacyDiskCacheDirs(this.app.vault.configDir, this.manifest);
		if (await deleteLegacyDiskCache(this.app.vault.adapter, dirs)) new Notice(LEGACY_CACHE_NOTICE);
	}

	async loadSettings(): Promise<void> {
		this.settings = hydrateSettings(await this.loadData(), DEFAULT_SETTINGS);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_POKEDEX)) {
			if (leaf.view instanceof PokedexView) leaf.view.refresh();
		}
	}

	// Column visibility is pure display state, not a "reload the dex range"
	// change — persist it without forcing every open Pokedex tab to remount
	// (which `saveSettings` does, since dex-range/sprite-style changes do
	// need a fresh reload).
	async setVisibleColumns(columns: string[]): Promise<void> {
		this.settings.visibleColumns = columns;
		await this.saveData(this.settings);
	}

	// Same "persist without forcing every open tab to remount" reasoning as
	// setVisibleColumns above — the table already updates its own favorite
	// marker/right-click state locally the instant a row is toggled, so a
	// full saveSettings()-triggered refresh would just be a redundant (and
	// disruptive: it'd reset scroll/sort/filter state) re-render of what's
	// already on screen.
	async setFavorites(ids: number[]): Promise<void> {
		this.settings.favoritePokemonIds = ids;
		await this.saveData(this.settings);
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_POKEDEX);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: VIEW_TYPE_POKEDEX, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
