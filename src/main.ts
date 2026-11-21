import { Notice, Plugin } from "obsidian";
import { IndexedDbCacheStore } from "./data/IndexedDbCacheStore";
import { portraitRenderFor } from "./data/imageSet";
import { deleteLegacyDiskCache, LEGACY_CACHE_NOTICE, legacyDiskCacheDirs } from "./data/legacyDiskCache";
import { PokeApiClient } from "./data/PokeApiClient";
import { PokedexRepository } from "./data/PokedexRepository";
import type { PluginSettings } from "./data/types";
import { DEFAULT_SETTINGS, PokedexSettingTab } from "./settings";
import { LocalPreferences } from "./utils/localPreferences";
import { hydrateSettings } from "./utils/settingsHydrate";
import { PokedexView, VIEW_TYPE_POKEDEX } from "./view/PokedexView";

export default class PokedexPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	cache!: IndexedDbCacheStore;
	repository!: PokedexRepository;
	// Favourites, Fields and the layout per width class: saved without a
	// remount, shared live by every open Pokedex leaf (ADR-0012).
	preferences = new LocalPreferences(() => this.settings, () => this.saveData(this.settings));

	async onload(): Promise<void> {
		await this.loadSettings();

		this.cache = IndexedDbCacheStore.forVault(this.app);
		this.repository = new PokedexRepository(new PokeApiClient(), this.cache);
		this.repository.setPortraitRender(portraitRenderFor(this.settings.spriteStyle));

		// After layout, so deleting a large synced folder never delays startup.
		this.app.workspace.onLayoutReady(() => void this.removeSyncedCache());

		this.registerView(
			VIEW_TYPE_POKEDEX,
			(leaf) => new PokedexView(
				leaf,
				this.repository,
				() => this.settings,
				this.preferences,
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
		this.repository.setPortraitRender(portraitRenderFor(this.settings.spriteStyle));
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_POKEDEX)) {
			if (leaf.view instanceof PokedexView) leaf.view.refresh();
		}
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
