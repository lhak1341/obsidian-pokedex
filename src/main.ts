import { Plugin } from "obsidian";
import { DiskCache } from "./data/Cache";
import { PokeApiClient } from "./data/PokeApiClient";
import { PokedexRepository } from "./data/PokedexRepository";
import type { PluginSettings } from "./data/types";
import { DEFAULT_SETTINGS, PokedexSettingTab } from "./settings";
import { PokedexView, VIEW_TYPE_POKEDEX } from "./view/PokedexView";

export default class PokedexPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;
	cache!: DiskCache;
	repository!: PokedexRepository;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.cache = await DiskCache.forPlugin(this.app, this.manifest);
		this.repository = new PokedexRepository(new PokeApiClient(), this.cache);

		this.registerView(
			VIEW_TYPE_POKEDEX,
			(leaf) => new PokedexView(
				leaf,
				this.repository,
				() => this.settings,
				(columns) => void this.setVisibleColumns(columns),
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

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
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
