import { Notice, PluginSettingTab, Setting, type ButtonComponent, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, GENERATIONS } from "./data/constants";
import type { PluginSettings } from "./data/types";
import type PokedexPlugin from "./main";

export const DEFAULT_SETTINGS: PluginSettings = {
	enabledGenerations: DEFAULT_ENABLED_GENERATIONS,
	spriteStyle: "official-artwork",
	gridDensity: "comfortable",
	defaultSortColumn: "id",
	visibleColumns: DEFAULT_VISIBLE_COLUMNS,
	useTypeIcons: false,
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class PokedexSettingTab extends PluginSettingTab {
	constructor(app: import("obsidian").App, private plugin: PokedexPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Generations").setHeading();
		const generationItems = containerEl.createDiv("setting-group").createDiv("setting-items");

		for (const gen of GENERATIONS) {
			const range = { start: gen.start, end: gen.end };
			const baseDesc = `National dex #${gen.start}-${gen.end}.`;
			const setting = new Setting(generationItems).setName(gen.name).setDesc(baseDesc);

			let actionButton: ButtonComponent | undefined;
			let deleteButton: ButtonComponent | undefined;
			// Drives which action the single action button performs — not
			// fully cached means there's something worth prefetching (download),
			// fully cached means the only useful action left is a forced
			// re-fetch (refresh). Recomputed by refreshCacheDesc, never toggled
			// directly by the click handler, so it can't drift from the actual
			// on-disk state.
			let isFullyCached = false;

			const applyActionButtonIcon = () => {
				actionButton
					?.setIcon(isFullyCached ? "refresh-cw" : "download")
					.setTooltip(
						isFullyCached
							? "Re-fetch this generation from PokeAPI, bypassing the cache"
							: "Prefetch this generation so browsing it is instant",
					);
			};

			// Cache status is a disk-existence check per id (see
			// getCacheStatus), not free — fetched once on open and again after
			// this generation's own action/delete button finishes, not on every
			// re-render of the tab.
			const refreshCacheDesc = async () => {
				const status = await this.plugin.repository.getCacheStatus(range);
				isFullyCached = status.total > 0 && status.cached === status.total;
				setting.setDesc(`${baseDesc} ${status.cached}/${status.total} cached.`);
				applyActionButtonIcon();
			};
			void refreshCacheDesc();

			setting.addButton((button) => {
				actionButton = button;
				button.setCta().onClick(async () => {
					actionButton?.setDisabled(true);
					deleteButton?.setDisabled(true);
					if (isFullyCached) {
						await this.plugin.repository.refreshRange(range, (loaded, total) => {
							setting.setDesc(`${baseDesc} Refreshing... ${loaded}/${total}.`);
						});
						new Notice(`Pokedex: ${gen.name} refreshed.`);
					} else {
						await this.plugin.repository.cacheRange(range, (loaded, total) => {
							setting.setDesc(`${baseDesc} Caching... ${loaded}/${total}.`);
						});
						new Notice(`Pokedex: ${gen.name} cached.`);
					}
					actionButton?.setDisabled(false);
					deleteButton?.setDisabled(false);
					await refreshCacheDesc();
				});
				applyActionButtonIcon();
			});

			setting.addButton((button) => {
				deleteButton = button;
				button
					.setIcon("trash-2")
					.setTooltip("Delete this generation's cached data")
					.setDestructive()
					.onClick(async () => {
						actionButton?.setDisabled(true);
						deleteButton?.setDisabled(true);
						await this.plugin.repository.clearRange(range);
						new Notice(`Pokedex: ${gen.name} cache cleared.`);
						actionButton?.setDisabled(false);
						deleteButton?.setDisabled(false);
						await refreshCacheDesc();
					});
			});

			setting.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabledGenerations.includes(gen.id))
					.onChange(async (value) => {
						const enabled = new Set(this.plugin.settings.enabledGenerations);
						if (value) {
							enabled.add(gen.id);
						} else if (enabled.size === 1) {
							new Notice("Pokedex: at least one generation must stay enabled.");
							toggle.setValue(true);
							return;
						} else {
							enabled.delete(gen.id);
						}
						this.plugin.settings.enabledGenerations = [...enabled].sort((a, b) => a - b);
						await this.plugin.saveSettings();
					})
			);
		}

		new Setting(containerEl).setName("Display").setHeading();
		const displayItems = containerEl.createDiv("setting-group").createDiv("setting-items");

		new Setting(displayItems)
			.setName("Sprite style")
			.setDesc("Which artwork to feature in the detail view header.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("official-artwork", "Official artwork")
					.addOption("sprite", "In-game sprite")
					.setValue(this.plugin.settings.spriteStyle)
					.onChange(async (value) => {
						this.plugin.settings.spriteStyle = value as PluginSettings["spriteStyle"];
						await this.plugin.saveSettings();
					})
			);

		new Setting(displayItems)
			.setName("Grid density")
			.setDesc("Row height/sprite size in the browse table.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("comfortable", "Comfortable")
					.addOption("compact", "Compact")
					.setValue(this.plugin.settings.gridDensity)
					.onChange(async (value) => {
						this.plugin.settings.gridDensity = value as PluginSettings["gridDensity"];
						await this.plugin.saveSettings();
					})
			);

		new Setting(displayItems)
			.setName("Type icons")
			.setDesc("Show a Lucide icon instead of the type name on type badges.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useTypeIcons)
					.onChange(async (value) => {
						this.plugin.settings.useTypeIcons = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(displayItems)
			.setName("Default sort column")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("id", "Dex number")
					.addOption("name", "Name")
					.setValue(this.plugin.settings.defaultSortColumn)
					.onChange(async (value) => {
						this.plugin.settings.defaultSortColumn = value as PluginSettings["defaultSortColumn"];
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Cache").setHeading();
		const cacheItems = containerEl.createDiv("setting-group").createDiv("setting-items");

		const cacheSizeSetting = new Setting(cacheItems)
			.setName("Cached data")
			.setDesc("Loading...");
		void this.plugin.cache.getSizeBytes().then((bytes) => {
			cacheSizeSetting.setDesc(`${formatBytes(bytes)} of PokeAPI JSON and images cached on disk.`);
		});

		new Setting(cacheItems)
			.setName("Clear cache")
			.setDesc("Deletes all cached PokeAPI JSON and images; they'll be re-fetched next time you browse.")
			.addButton((button) =>
				button
					.setButtonText("Clear cache")
					.setDestructive()
					.onClick(async () => {
						await this.plugin.cache.clear();
						new Notice("Pokedex: cache cleared.");
						this.display();
					})
			);
	}
}
