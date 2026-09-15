import { Notice, PluginSettingTab, Setting, type ButtonComponent, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, GENERATIONS } from "./data/constants";
import type { FontChoice, PluginSettings } from "./data/types";
import type PokedexPlugin from "./main";
import { describeGenerationAction, describeGenerationStatus } from "./utils/generationCacheDescription";
import { formatBytes } from "./utils/formatBytes";
import { resolveGenerationToggle } from "./utils/generationToggle";
import { GenerationCacheController } from "./view/GenerationCacheController";

const FONT_OPTIONS: Record<FontChoice, string> = {
	pokedex: "Pokedex default (theme fonts)",
	"obsidian-interface": "Obsidian: Interface font",
	"obsidian-text": "Obsidian: Text font",
	"obsidian-monospace": "Obsidian: Monospace font",
	custom: "Custom…",
};

export const DEFAULT_SETTINGS: PluginSettings = {
	fontHeading: "pokedex",
	fontHeadingCustom: "",
	fontBody: "pokedex",
	fontBodyCustom: "",
	fontMono: "pokedex",
	fontMonoCustom: "",
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
	favoritePokemonIds: [],
};

export class PokedexSettingTab extends PluginSettingTab {
	constructor(app: import("obsidian").App, private plugin: PokedexPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}

	// Per-generation cache/refresh runs (see the "Cache"/"Refresh" button
	// below) are network-bound and can outlive this tab being open — closing
	// Settings (or switching to another tab) doesn't stop them by itself,
	// since display() rebuilds fresh buttons/controllers on next open with no
	// memory of a still-running one. hide() cancels whatever's in flight so a
	// stale run doesn't keep going in the background and race a fresh one
	// started after reopening. Only covers cache/refresh, not the Delete
	// button: clearRange has no isCancelled hook, since it's a bounded local
	// disk sweep, not a network fetch loop.
	private cancelActiveRuns: (() => void)[] = [];

	hide(): void {
		for (const cancel of this.cancelActiveRuns) cancel();
		this.cancelActiveRuns = [];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.cancelActiveRuns = [];

		new Setting(containerEl).setName("Generations").setHeading();
		const generationItems = containerEl.createDiv("setting-group").createDiv("setting-items");

		for (const gen of GENERATIONS) {
			const baseDesc = `National dex #${gen.start}-${gen.end}.`;
			const setting = new Setting(generationItems).setName(gen.name).setDesc(baseDesc);

			let actionButton: ButtonComponent | undefined;
			let deleteButton: ButtonComponent | undefined;
			const controller = new GenerationCacheController(this.plugin.repository, gen);
			let cancelled = false;
			this.cancelActiveRuns.push(() => {
				cancelled = true;
			});

			const applyActionButtonIcon = () => {
				const { icon, tooltip } = describeGenerationAction(controller.actionKind);
				actionButton?.setIcon(icon).setTooltip(tooltip);
			};

			const applyDesc = () => {
				setting.setDesc(describeGenerationStatus(baseDesc, controller.status, null));
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

			// Shared disable-during-run bookkeeping for both buttons below —
			// this is presentation state (ButtonComponent.setDisabled), which is
			// this caller's job, not the controller's (see its own header comment).
			const withButtonsDisabled = async (fn: () => Promise<void>) => {
				actionButton?.setDisabled(true);
				deleteButton?.setDisabled(true);
				try {
					await fn();
				} finally {
					actionButton?.setDisabled(false);
					deleteButton?.setDisabled(false);
				}
				applyDesc();
			};

			setting.addButton((button) => {
				actionButton = button;
				button.setCta().onClick(async () => {
					const kind = controller.actionKind;
					await withButtonsDisabled(async () => {
						await controller.run((loaded, total) => {
							setting.setDesc(describeGenerationStatus(baseDesc, controller.status, { kind, loaded, total }));
						}, () => cancelled);
						new Notice(`Pokedex: ${gen.name} ${kind === "refresh" ? "refreshed" : "cached"}.`);
					});
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
						await withButtonsDisabled(async () => {
							await controller.clear();
							new Notice(`Pokedex: ${gen.name} cache cleared.`);
						});
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

		new Setting(containerEl).setName("Appearance").setHeading();
		const appearanceItems = containerEl.createDiv("setting-group").createDiv("setting-items");

		this.renderFontPicker(appearanceItems, {
			name: "Heading font",
			desc: "Font for the table, section headers, and hover-popover text.",
			getValue: () => this.plugin.settings.fontHeading,
			setValue: (value) => { this.plugin.settings.fontHeading = value; },
			getCustom: () => this.plugin.settings.fontHeadingCustom,
			setCustom: (value) => { this.plugin.settings.fontHeadingCustom = value; },
		});
		this.renderFontPicker(appearanceItems, {
			name: "Body font",
			desc: "Font for the detail screen's flavor text.",
			getValue: () => this.plugin.settings.fontBody,
			setValue: (value) => { this.plugin.settings.fontBody = value; },
			getCustom: () => this.plugin.settings.fontBodyCustom,
			setCustom: (value) => { this.plugin.settings.fontBodyCustom = value; },
		});
		this.renderFontPicker(appearanceItems, {
			name: "Monospace font",
			desc: "Font for stats and other numeric/data-style text.",
			getValue: () => this.plugin.settings.fontMono,
			setValue: (value) => { this.plugin.settings.fontMono = value; },
			getCustom: () => this.plugin.settings.fontMonoCustom,
			setCustom: (value) => { this.plugin.settings.fontMonoCustom = value; },
		});

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

	private renderFontPicker(items: HTMLElement, opts: {
		name: string;
		desc: string;
		getValue: () => FontChoice;
		setValue: (value: FontChoice) => void;
		getCustom: () => string;
		setCustom: (value: string) => void;
	}): void {
		let customFontEl: Setting;
		new Setting(items)
			.setName(opts.name)
			.setDesc(opts.desc)
			.addDropdown((dropdown) => {
				Object.entries(FONT_OPTIONS).forEach(([v, label]) => { dropdown.addOption(v, label); });
				dropdown.setValue(opts.getValue()).onChange(async (value) => {
					opts.setValue(value as FontChoice);
					customFontEl.settingEl.style.display = value === "custom" ? "" : "none";
					await this.plugin.saveSettings();
				});
			});
		customFontEl = new Setting(items)
			.setName("")
			.addText((text) =>
				text
					.setPlaceholder("Font family name")
					.setValue(opts.getCustom())
					.onChange(async (value) => {
						opts.setCustom(value.trim());
						await this.plugin.saveSettings();
					}),
			);
		customFontEl.settingEl.style.display = opts.getValue() === "custom" ? "" : "none";
	}
}
