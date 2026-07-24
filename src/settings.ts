import { Notice, PluginSettingTab, Setting, type ButtonComponent, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, GENERATIONS } from "./data/constants";
import type { PluginSettings } from "./data/types";
import type PokedexPlugin from "./main";
import { formatBytes } from "./utils/formatBytes";
import { resolveGenerationToggle } from "./utils/generationToggle";
import { GenerationCacheController } from "./view/GenerationCacheController";

export const DEFAULT_SETTINGS: PluginSettings = {
	enabledGenerations: DEFAULT_ENABLED_GENERATIONS,
	spriteStyle: "official-artwork",
	gridDensity: "comfortable",
	defaultSortColumn: "id",
	visibleColumns: DEFAULT_VISIBLE_COLUMNS,
	useTypeIcons: false,
	// Latest supported generation by default, so a fresh install (or anyone
	// who never touches the Active Gen selector) sees exactly the same
	// stats/moves/flavor text as before this setting existed.
	activeGen: Math.max(...GENERATIONS.map((g) => g.id)),
};

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
			const controller = new GenerationCacheController(this.plugin.repository, range);

			const applyActionButtonIcon = () => {
				const isFullyCached = controller.actionKind === "refresh";
				actionButton
					?.setIcon(isFullyCached ? "refresh-cw" : "download")
					.setTooltip(
						isFullyCached
							? "Re-fetch this generation from PokeAPI, bypassing the cache"
							: "Prefetch this generation so browsing it is instant",
					);
			};

			const applyDesc = () => {
				const status = controller.status;
				setting.setDesc(status ? `${baseDesc} ${status.cached}/${status.total} cached.` : baseDesc);
				applyActionButtonIcon();
			};

			// Cache status is a disk-existence check per id (see
			// getCacheStatus), not free — fetched once on open and again after
			// this generation's own action/delete button finishes, not on every
			// re-render of the tab.
			const refreshCacheDesc = async () => {
				await controller.refreshStatus();
				applyDesc();
			};
			void refreshCacheDesc();

			setting.addButton((button) => {
				actionButton = button;
				button.setCta().onClick(async () => {
					const kind = controller.actionKind;
					actionButton?.setDisabled(true);
					deleteButton?.setDisabled(true);
					try {
						await controller.run((loaded, total) => {
							setting.setDesc(
								`${baseDesc} ${kind === "refresh" ? "Refreshing" : "Caching"}... ${loaded}/${total}.`,
							);
						});
						new Notice(`Pokedex: ${gen.name} ${kind === "refresh" ? "refreshed" : "cached"}.`);
					} finally {
						actionButton?.setDisabled(false);
						deleteButton?.setDisabled(false);
					}
					applyDesc();
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
						try {
							await controller.clear();
							new Notice(`Pokedex: ${gen.name} cache cleared.`);
						} finally {
							actionButton?.setDisabled(false);
							deleteButton?.setDisabled(false);
						}
						applyDesc();
					});
			});

			setting.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabledGenerations.includes(gen.id))
					.onChange(async (value) => {
						const result = resolveGenerationToggle(this.plugin.settings.enabledGenerations, gen.id, value);
						if (!result.allowed) {
							new Notice("Pokedex: at least one generation must stay enabled.");
							toggle.setValue(true);
							return;
						}
						this.plugin.settings.enabledGenerations = result.enabled;
						await this.plugin.saveSettings();
					})
			);
		}

		new Setting(containerEl).setName("Display").setHeading();
		const displayItems = containerEl.createDiv("setting-group").createDiv("setting-items");

		new Setting(displayItems)
			.setName("Active gen")
			.setDesc(
				"Which generation's stats/moves/flavor text to prioritize (e.g. set to Gen 3 to see FireRed/LeafGreen/Emerald-era data). Falls back to the latest generation wherever the chosen one has nothing of its own for a species. Independent of which generations are enabled above.",
			)
			.addDropdown((dropdown) => {
				for (const gen of GENERATIONS) dropdown.addOption(String(gen.id), gen.name);
				dropdown.setValue(String(this.plugin.settings.activeGen)).onChange(async (value) => {
					this.plugin.settings.activeGen = Number(value);
					await this.plugin.saveSettings();
				});
			});

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
