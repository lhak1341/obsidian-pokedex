import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type { PokedexRepository } from "../data/PokedexRepository";
import type { PluginSettings } from "../data/types";
import PokedexApp from "./PokedexApp.svelte";

export const VIEW_TYPE_POKEDEX = "pokedex-view";

export class PokedexView extends ItemView {
	private appInstance: unknown;

	constructor(
		leaf: WorkspaceLeaf,
		private repository: PokedexRepository,
		private getSettings: () => PluginSettings,
		private onColumnsChange: (columns: string[]) => void,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_POKEDEX;
	}

	// Active Gen is a Settings-tab control (see PokedexSettingTab), not an
	// in-view one — showing it here instead of a persistent toolbar keeps
	// the main UI free of a control aimed at "occasionally switch which
	// era's data you're browsing" rather than "flip constantly mid-session".
	getDisplayText(): string {
		return `Pokedex • Gen ${this.getSettings().activeGen}`;
	}

	getIcon(): string {
		return "table-2";
	}

	async onOpen(): Promise<void> {
		this.mountApp();
	}

	async onClose(): Promise<void> {
		if (this.appInstance) await unmount(this.appInstance);
	}

	// Called after settings change (e.g. dex range, Active Gen) so the table
	// reloads with the new configuration instead of requiring the tab to be
	// closed and reopened. Two separate title surfaces need refreshing, and
	// neither is covered by re-mounting the Svelte content (which only
	// touches `contentEl`, not the header bar that lives alongside it in
	// `containerEl`):
	//  - the tab-strip chip, refreshed by leaf.updateHeader() (not part of
	//    Obsidian's public API surface / obsidian.d.ts, but a long-standing,
	//    widely-relied-on method — verified live that it exists and works)
	//  - the larger `.view-header-title` shown when the pane is focused,
	//    which updateHeader() does NOT touch (confirmed live: after an
	//    Active Gen change, the tab chip updated but this element stayed on
	//    the old value) — set directly instead.
	refresh(): void {
		this.mountApp();
		(this.leaf as unknown as { updateHeader: () => void }).updateHeader();
		const titleEl = this.containerEl.querySelector(".view-header-title");
		if (titleEl) titleEl.textContent = this.getDisplayText();
	}

	// Defensively unmounts any existing instance first — Obsidian can call
	// onOpen() more than once for the same leaf (e.g. during workspace layout
	// restoration), and without this guard that second call would leave the
	// first instance's fetch loop running invisibly in the background while a
	// second one starts from scratch, which looks like the load restarting
	// partway through.
	private mountApp(): void {
		if (this.appInstance) {
			void unmount(this.appInstance);
			this.appInstance = undefined;
		}
		this.contentEl.empty();
		this.appInstance = mount(PokedexApp, {
			target: this.contentEl,
			props: {
				repository: this.repository,
				settings: this.getSettings(),
				onColumnsChange: this.onColumnsChange,
			},
		});
	}
}
