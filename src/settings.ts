import { Notice, PluginSettingTab, type ButtonComponent, type Setting, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import { DEFAULT_ENABLED_GENERATIONS, GENERATIONS } from "./data/constants";
import { portraitRenderFor } from "./data/imageSet";
import { DEFAULT_LAYOUT_BY_WIDTH_CLASS } from "./utils/browseLayout";
import { DEFAULT_CARD_SIZE_BY_WIDTH_CLASS } from "./utils/cardView";
import { DEFAULT_CARD_FIELDS, DEFAULT_VISIBLE_FIELDS } from "./utils/fields";
import { DEFAULT_FONT_ROLE_SETTINGS, FONT_ROLE_KEYS, fontSourceOptions, type FontRole } from "@lhak/style/obsidian-helpers";
import type { PluginSettings } from "./data/types";
import type PokedexPlugin from "./main";
import { describeGenerationAction, describeGenerationStatus } from "./utils/generationCacheDescription";
import { formatBytes } from "./utils/formatBytes";
import { resolveGenerationToggle } from "./utils/generationToggle";
import { GenerationCacheController } from "./view/GenerationCacheController";

export const DEFAULT_SETTINGS: PluginSettings = {
	...DEFAULT_FONT_ROLE_SETTINGS,
	enabledGenerations: DEFAULT_ENABLED_GENERATIONS,
	spriteStyle: "official-artwork",
	gridDensity: "comfortable",
	defaultSortColumn: "id",
	visibleFields: DEFAULT_VISIBLE_FIELDS,
	cardFields: DEFAULT_CARD_FIELDS,
	useTypeIcons: false,
	// Latest supported generation by default, so a fresh install (or anyone
	// who never touches the Active Gen selector) sees exactly the same
	// stats/moves/flavor text as before this setting existed.
	activeGen: Math.max(...GENERATIONS.map((g) => g.id)),
	favoritePokemonIds: [],
	reduceMotion: false,
	layoutByWidthClass: { ...DEFAULT_LAYOUT_BY_WIDTH_CLASS },
	cardSizeByWidthClass: { ...DEFAULT_CARD_SIZE_BY_WIDTH_CLASS },
};

export class PokedexSettingTab extends PluginSettingTab {
	constructor(app: import("obsidian").App, private plugin: PokedexPlugin) {
		super(app, plugin);
	}

	// Per-generation cache/refresh runs (see the "Cache"/"Refresh" button in
	// generationRow) are network-bound and can outlive this tab being open: closing
	// Settings (or switching to another tab) doesn't stop them by itself.
	// hide() cancels whatever's in flight so a stale run doesn't keep going in
	// the background and race a fresh one started after reopening. Only covers
	// cache/refresh, not the Delete button: clearRange has no isCancelled hook,
	// since it's a bounded local disk sweep, not a network fetch loop.
	private cancelActiveRuns: (() => void)[] = [];
	// Each generation's status re-read, for a Sprite style switch: which large
	// images count as cached depends on the render (see getCacheStatus), so
	// "151/151" for artwork reads 0/151 for HOME.
	private refreshCacheStatuses: (() => void)[] = [];

	hide(): void {
		for (const cancel of this.cancelActiveRuns) cancel();
		this.cancelActiveRuns = [];
	}

	// The tab is declarative (Obsidian 1.13+): plain controls bind through
	// getControlValue/setControlValue below, and the rows that need live state
	// (cache progress, cache size) are `render` rows. update() re-reads all of
	// this, which is how the Clear cache button refreshes the statuses.
	getSettingDefinitions(): SettingDefinitionItem[] {
		// A render row is rebuilt on every update(), so the registries restart here.
		this.refreshCacheStatuses = [];
		return [
			{ type: "group", heading: "Generations", items: GENERATIONS.map((gen) => this.generationRow(gen)) },
			{
				type: "group",
				heading: "Display",
				items: [
					{
						name: "Active gen",
						desc: "Which generation's stats, moves and flavor text to prioritize, for example Gen 3 for the FireRed, LeafGreen and Emerald data. Falls back to the latest generation wherever the chosen one has nothing of its own for a species. Independent of which generations are enabled above.",
						control: {
							type: "dropdown",
							key: "activeGen",
							options: Object.fromEntries(GENERATIONS.map((gen) => [String(gen.id), gen.name])),
						},
					},
					{
						name: "Sprite style",
						desc: "Which artwork to feature in the detail view header.",
						control: {
							type: "dropdown",
							key: "spriteStyle",
							options: { "official-artwork": "Official artwork", home: "3D model render", sprite: "In-game sprite" },
						},
					},
					{
						name: "Grid density",
						desc: "Row height/sprite size in the browse table.",
						control: { type: "dropdown", key: "gridDensity", options: { comfortable: "Comfortable", compact: "Compact" } },
					},
					{
						name: "Type icons",
						desc: "Show an icon instead of the type name on type badges.",
						control: { type: "toggle", key: "useTypeIcons" },
					},
					{
						name: "Default sort column",
						control: { type: "dropdown", key: "defaultSortColumn", options: { id: "Dex number", name: "Name" } },
					},
				],
			},
			{
				type: "group",
				heading: "Appearance",
				items: [
					...this.fontRows("heading", "Heading font", "Font for the table, section headers, and hover-popover text."),
					...this.fontRows("body", "Body font", "Font for the detail screen's flavor text."),
					...this.fontRows("mono", "Monospace font", "Font for stats and other numeric/data-style text."),
					{
						name: "Reduce motion",
						desc: "Make hover fades and other transitions instant. Your system's reduce-motion setting does this too.",
						control: { type: "toggle", key: "reduceMotion" },
					},
				],
			},
			{
				type: "group",
				heading: "Cache",
				items: [
					{
						name: "Cached data",
						desc: "Loading...",
						render: (setting) => {
							void this.plugin.cache.getSizeBytes().then((bytes) => {
								setting.setDesc(`${formatBytes(bytes)} of PokeAPI JSON and images cached on this device.`);
							}, () => setting.setDesc("Couldn't read the cache size."));
						},
					},
					{
						name: "Clear cache",
						desc: "Deletes all cached PokeAPI JSON and images; they'll be re-fetched next time you browse.",
						render: (setting) => {
							setting.addButton((button) =>
								button
									.setButtonText("Clear cache")
									.setDestructive()
									.onClick(async () => {
										await this.plugin.repository.clearAll();
										new Notice("Pokedex: cache cleared.");
										this.update();
									}),
							);
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		const value = this.settingsRecord()[key];
		// The dropdown's option keys are strings; activeGen is stored as a number.
		return key === "activeGen" ? String(value) : value;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.settingsRecord();
		if (key === "activeGen") settings[key] = Number(value);
		else if (typeof value === "string" && this.isCustomFontKey(key)) settings[key] = value.trim();
		else settings[key] = value;
		await this.plugin.saveSettings();
		if (key === "spriteStyle") for (const refresh of this.refreshCacheStatuses) refresh();
		// A font source switch shows or hides its custom-family row.
		if (this.isFontSourceKey(key)) this.refreshDomState();
	}

	private settingsRecord(): Record<string, unknown> {
		return this.plugin.settings as unknown as Record<string, unknown>;
	}

	private isFontSourceKey(key: string): boolean {
		return (Object.keys(FONT_ROLE_KEYS) as FontRole[]).some((role) => FONT_ROLE_KEYS[role].source === key);
	}

	private isCustomFontKey(key: string): boolean {
		return (Object.keys(FONT_ROLE_KEYS) as FontRole[]).some((role) => FONT_ROLE_KEYS[role].custom === key);
	}

	// The @lhak/style font-role pair: a source dropdown, and the custom family
	// field shown only while "Custom" is chosen. The field saves on every
	// keystroke; saveSettings re-applies the roles on each open view's
	// contentEl (PokedexView.refresh) without remounting it.
	private fontRows(role: FontRole, name: string, desc: string): SettingGroupItem[] {
		const keys = FONT_ROLE_KEYS[role];
		return [
			{
				name,
				desc,
				control: { type: "dropdown", key: keys.source, options: fontSourceOptions("Pokedex default (theme fonts)") },
			},
			{
				name: `${name} family`,
				control: { type: "text", key: keys.custom, placeholder: "Font family name" },
				visible: () => this.settingsRecord()[keys.source] === "custom",
			},
		];
	}

	private generationRow(gen: (typeof GENERATIONS)[number]): SettingGroupItem {
		const baseDesc = `National dex #${gen.start}-${gen.end}.`;
		return {
			name: gen.name,
			desc: baseDesc,
			render: (setting: Setting) => {
				let actionButton: ButtonComponent | undefined;
				let deleteButton: ButtonComponent | undefined;
				const controller = new GenerationCacheController(this.plugin.repository, gen, () =>
					portraitRenderFor(this.plugin.settings.spriteStyle),
				);
				let cancelled = false;
				const cancel = () => {
					cancelled = true;
				};
				this.cancelActiveRuns.push(cancel);

				const applyActionButtonIcon = () => {
					const { icon, tooltip } = describeGenerationAction(controller.actionKind);
					actionButton?.setIcon(icon).setTooltip(tooltip);
				};

				const applyDesc = () => {
					setting.setDesc(describeGenerationStatus(baseDesc, controller.status, null));
					applyActionButtonIcon();
				};

				// Cache status is a disk-existence check per id (see
				// getCacheStatus), not free: fetched once on open and again after
				// this generation's own action/delete button finishes, not on every
				// re-render of the tab.
				const refreshCacheDesc = async () => {
					await controller.refreshStatus();
					applyDesc();
				};
				void refreshCacheDesc();
				this.refreshCacheStatuses.push(() => void refreshCacheDesc());

				// Shared disable-during-run bookkeeping for both buttons below:
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
						}),
				);

				// A re-render (update()) drops this row; stop its run with it.
				return cancel;
			},
		};
	}
}
