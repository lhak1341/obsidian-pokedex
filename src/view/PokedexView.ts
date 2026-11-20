import { applyFontRoles } from "@lhak/style/obsidian-helpers";
import { type Events, ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type { PokedexRepository } from "../data/PokedexRepository";
import type { PluginSettings } from "../data/types";
import type { LocalPreferences } from "../utils/localPreferences";
import { resolveLeafHotkey } from "../utils/leafHotkeys";
import { DetailNavigationState, type NavRecord, parseNavRecord, type ScrollInstruction } from "./DetailNavigationState";
import { isEditableTarget } from "./domTarget";
import { LeafCommandRegistry } from "./LeafCommandRegistry";
import PokedexApp from "./PokedexApp.svelte";

export const VIEW_TYPE_POKEDEX = "pokedex-view";

// PokedexApp's exported `show` (see its comment).
type MountedApp = { show: (record: NavRecord) => ScrollInstruction };

// Not in obsidian.d.ts: the leaf's own back/forward stack, the one the tab
// header arrows and the mobile navigation bar step. Probed live: `back()` and
// `forward()` replay an entry through setViewState with `popstate`, which
// records nothing.
type LeafWithHistory = { history: { back: () => Promise<void>; forward: () => Promise<void> } };

// Not in obsidian.d.ts, and present on mobile only: the ‹ › bar. It re-reads
// the active leaf's history only on `active-leaf-change`; notes refresh it
// through `file-open`, which a Pokedex step never fires, so without a nudge
// its buttons stayed dimmed (aria-disabled) while stepping worked (probed live).
type AppWithMobileNavbar = { mobileNavbar?: { onLeafChange: () => void } };

export class PokedexView extends ItemView {
	private appInstance: MountedApp | undefined;

	// Without this, WorkspaceLeaf.recordHistory ignores the view entirely.
	navigation = true;

	// View history (CONTEXT.md): the screen and Pokemon live here, not in the
	// Svelte app, so a settings refresh (which remounts the app) keeps the
	// screen, and getState can answer before the app has mounted.
	private nav = new DetailNavigationState();

	// Leaf hotkeys whose state lives in a screen component (see
	// LeafCommandRegistry.ts). Here, not in the app, for the same reason as
	// `nav`: a settings remount re-registers into the same registry.
	private commands = new LeafCommandRegistry();

	constructor(
		leaf: WorkspaceLeaf,
		private repository: PokedexRepository,
		private getSettings: () => PluginSettings,
		private preferences: LocalPreferences,
	) {
		super(leaf);
		// The leaf fires history-change on every entry and step; its typed
		// `on` overloads omit it. Registered here, not in onOpen, which can run
		// more than once per leaf (see mountApp).
		this.registerEvent((leaf as Events).on("history-change", () => this.refreshMobileNavbar()));
		// Leaf hotkeys (CONTEXT.md): the one keydown listener this leaf has.
		// Every leaf's listener sees every key, so resolveLeafHotkey returns
		// nothing unless this is the active Pokedex leaf, and an event it
		// returns nothing for is left untouched.
		//
		// Capture phase on `window` is load-bearing for Mod+Shift+L. Plain
		// Mod+<letter> is unusable here because Electron's native application
		// menu binds several CommandOrControl+<letter> chords (e.g. Cmd+L to
		// Insert Link), an OS/main-process accelerator no renderer JS can
		// intercept. Adding Shift sidesteps that, but Obsidian's HotkeyManager
		// bakes some Mod+Shift+<letter> chords too (Mod+Shift+L is
		// editor:insert-embed) and listens on `document` in the capture phase:
		// a capture listener on `window` runs first, and stopPropagation keeps
		// HotkeyManager from also firing. Plain "[", "]" and the arrows have no
		// binding in either (checked against app.hotkeyManager.bakedHotkeys and
		// Menu.getApplicationMenu()), so they need neither.
		this.registerDomEvent(window, "keydown", (e) => this.onKeydown(e), { capture: true });
	}

	private onKeydown(e: KeyboardEvent): void {
		const hotkey = resolveLeafHotkey({
			key: e.key,
			mod: e.metaKey || e.ctrlKey,
			shift: e.shiftKey,
			editable: isEditableTarget(e.target),
			screen: this.nav.screen,
			active: this.app.workspace.getActiveViewOfType(PokedexView) === this,
		});
		if (!hotkey) return;
		const { command } = hotkey;
		if (command.kind === "history") this.stepHistory(command.dir);
		else if (!this.commands.run(this.nav.screen, command)) return;
		e.preventDefault();
		if (hotkey.stopPropagation) e.stopPropagation();
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

	getState(): Record<string, unknown> {
		return { ...super.getState(), ...this.nav.getState() };
	}

	// Obsidian calls this for every entry: a new screen (through navigate), a
	// back/forward step, and the saved state on restart. Back and forward reach
	// the same live view, so the table's filters and scroll survive a step.
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const record = parseNavRecord(state);
		if (record) {
			const instruction = this.appInstance?.show(record) ?? this.nav.setState(record, 0);
			if (instruction.kind !== "none") result.history = true;
		}
		await super.setState(state, result);
	}

	// Each new screen goes through the leaf, so Obsidian records an entry for
	// the screen being left and drops the forward entries.
	private navigate(record: NavRecord): void {
		void this.leaf.setViewState({ type: VIEW_TYPE_POKEDEX, state: record });
	}

	// "[" / "]": the tab's own history, the same one as the tab header arrows
	// and the mobile navigation bar. Only the active leaf gets here
	// (resolveLeafHotkey): a background tab stepping back could leave the
	// Pokedex for whatever note the tab showed before.
	private stepHistory(direction: "back" | "forward"): void {
		const { history } = this.leaf as unknown as LeafWithHistory;
		void (direction === "back" ? history.back() : history.forward());
	}

	private refreshMobileNavbar(): void {
		if (this.app.workspace.getActiveViewOfType(PokedexView) !== this) return;
		(this.app as unknown as AppWithMobileNavbar).mobileNavbar?.onLeafChange();
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
		// lk-root: the @lhak/style alias layer defines the --lk- roles under it.
		this.contentEl.addClasses(["lk-root", "pokedex-outer"]);
		applyFontRoles(this.contentEl, this.getSettings());
		// Zeroes the transition durations (styles.src.css, "Reduce motion").
		this.contentEl.toggleClass("pkdx-reduce-motion", this.getSettings().reduceMotion);
		this.appInstance = mount(PokedexApp, {
			target: this.contentEl,
			props: {
				repository: this.repository,
				settings: this.getSettings(),
				// The leaf's own element, not contentEl: the width class is the
				// pane's width, padding included.
				leafEl: this.containerEl,
				preferences: this.preferences,
				navState: this.nav,
				commands: this.commands,
				onNavigate: (record: NavRecord) => this.navigate(record),
			},
		});
	}
}
