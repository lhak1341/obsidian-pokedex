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

	getDisplayText(): string {
		return "Pokedex";
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

	// Called after settings change (e.g. dex range) so the table reloads
	// with the new configuration instead of requiring the tab to be closed
	// and reopened.
	refresh(): void {
		this.mountApp();
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
