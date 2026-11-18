<script lang="ts">
	import { Notice } from "obsidian";
	import { onDestroy, onMount, tick, untrack } from "svelte";
	import type { PokedexRepository } from "../data/PokedexRepository";
	import type { PluginSettings } from "../data/types";
	import { resolveGenerationScope } from "../utils/generationScope";
	import { describePartialLoadOutcome, describeRetryOutcome } from "../utils/loadNotices";
	import type { DetailNavigationState, NavRecord, ScrollInstruction } from "./DetailNavigationState";
	import { isEditableTarget } from "./domTarget";
	import DetailScreen from "./components/DetailScreen.svelte";
	import { emptyLoadSnapshot, type LoadSnapshot, PokedexLoadState } from "./PokedexLoadState";
	import TableScreen from "./components/TableScreen.svelte";

	let { repository, settings, onFieldsChange, onFavoritesChange, navState, onNavigate, onStepHistory }: {
		repository: PokedexRepository;
		settings: PluginSettings;
		onFieldsChange: (fields: string[]) => void;
		onFavoritesChange: (ids: number[]) => void;
		navState: DetailNavigationState;
		onNavigate: (record: NavRecord) => void;
		onStepHistory: (direction: "back" | "forward") => void;
	} = $props();

	// Favourites are owned here, above both screens, so the table, the detail
	// screen (and later Card view) read one set and a toggle on either shows on
	// the other at once. Seeded once from settings and never re-seeded: saves go
	// out through onFavoritesChange (PokedexPlugin.setFavorites), which does not
	// remount the view.
	let favoriteIds = $state<ReadonlySet<number>>(new Set(untrack(() => settings.favoritePokemonIds)));

	function toggleFavorite(id: number) {
		const next = new Set(favoriteIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		favoriteIds = next;
		onFavoritesChange([...next]);
	}

	// View history is the tab's own Obsidian navigation history (CONTEXT.md).
	// PokedexView owns navState and the leaf: a new screen goes out through
	// onNavigate, and every entry (new, back/forward, restart) comes back in
	// through show() below. navState is a plain, non-reactive class (same
	// reason as PokedexLoadState below), so screen/selectedId are the reactive
	// mirror, re-assigned after every call. Seeded from it, so a settings
	// refresh remount keeps the screen.
	let screen = $state<"table" | "detail">(untrack(() => navState.screen));
	let selectedId = $state<number | null>(untrack(() => navState.selectedId));

	// PokedexLoadState is a plain, non-reactive class (tested with plain
	// vitest, see PokedexLoadState.test.ts) — Svelte 5's $state only
	// deep-proxies plain objects/arrays, not class instances, so mutations
	// to its fields wouldn't be visible to the template. `view` is the reactive
	// boundary instead, reassigned wholesale from the snapshot the class hands
	// its onUpdate callback after every change (same shape as DetailScreen's
	// entryLoad). The class owns the rows, failed ids and outcome counts; this
	// component only renders them and shows the Notices.
	let view = $state<LoadSnapshot>(emptyLoadSnapshot());

	let loadState: PokedexLoadState;

	// PokedexView.refresh() (fired on any settings change — see main.ts
	// saveSettings) unmounts this component and mounts a fresh one. Without
	// cancelling here, a load still in flight when that happens keeps running
	// in the background while the new instance starts its own load — every id
	// the old one hadn't reached yet gets fetched twice for nothing. A
	// cancelled load also stops calling onUpdate and returns a null outcome,
	// so nothing below needs its own cancelled check.
	onDestroy(() => loadState?.cancel());

	onMount(() => {
		// Render the table as soon as the first row lands instead of blocking on
		// the whole batch — the rest streams in behind a slim progress indicator
		// (see the template) rather than a full-screen loader.
		loadState = new PokedexLoadState(
			repository,
			resolveGenerationScope(settings.enabledGenerations),
			(snapshot) => (view = snapshot),
		);
		void loadState.load().then((outcome) => {
			if (outcome) new Notice(describePartialLoadOutcome(outcome.loaded, outcome.failed));
		});
	});

	function retryFailed() {
		void loadState.retry().then((outcome) => {
			if (outcome) {
				new Notice(describeRetryOutcome(outcome.attempted, outcome.recovered, outcome.stillFailing));
			}
		});
	}

	// This root div is the actual scroll container (Obsidian's own contentEl
	// wrapping it fits exactly to the leaf and never overflows — verified via
	// dev tools: contentEl's scrollHeight === clientHeight, while this element's
	// doesn't). Table and detail share it, so entering/leaving detail has to
	// manage scroll position explicitly rather than letting whatever position
	// the table was left at carry straight over.
	let rootEl: HTMLDivElement | undefined;

	// Mirrors screen/selectedId from navState, then executes the returned
	// ScrollInstruction — the one piece of work navState can't do itself
	// since it stays DOM-free on purpose (see DetailNavigationState.ts).
	// TableScreen stays mounted (see template — it's hidden via CSS while
	// viewing detail, not destroyed, so its filters/sort/column state
	// survive) but restoring a non-zero scroll position still needs the DOM
	// to have un-hidden it first, or the browser clamps the scrollTop write
	// to whatever the still-collapsed height allows.
	async function applyNavigation(instruction: ScrollInstruction) {
		screen = navState.screen;
		selectedId = navState.selectedId;
		if (instruction.kind === "reset") {
			rootEl?.scrollTo(0, 0);
		} else if (instruction.kind === "restore") {
			await tick();
			rootEl?.scrollTo(0, instruction.top);
		}
	}

	// Called by PokedexView.setState for every history entry; its return
	// tells the view whether the record changed anything (an entry or not).
	export function show(record: NavRecord): ScrollInstruction {
		const instruction = navState.setState(record, rootEl?.scrollTop ?? 0);
		void applyNavigation(instruction);
		return instruction;
	}

	function openDetail(id: number) {
		onNavigate({ screen: "detail", pokemonId: id });
	}

	// "[" / "]" step the tab's own history, the same one as the tab header
	// arrows and the mobile navigation bar. No modifier is free of conflict
	// (Cmd+[/Cmd+] collide with Obsidian's/Electron's own bindings; see
	// QuickSearch.svelte's comment). Verified against both Obsidian's
	// HotkeyManager and Electron's native app menu
	// (app.hotkeyManager.bakedHotkeys / Menu.getApplicationMenu()) that plain
	// "[" and "]" have zero existing bindings, so this needs neither the
	// capture-phase trick nor stopPropagation that Mod+Shift+L required.
	function onGlobalKeydown(e: KeyboardEvent) {
		if (isEditableTarget(e.target)) return;
		if (e.key === "[") {
			e.preventDefault();
			onStepHistory("back");
		} else if (e.key === "]") {
			e.preventDefault();
			onStepHistory("forward");
		}
	}

	onMount(() => window.addEventListener("keydown", onGlobalKeydown));
	onDestroy(() => window.removeEventListener("keydown", onGlobalKeydown));

	function backToTable() {
		onNavigate(navState.backToTable());
	}
</script>

<div class="pokedex-view" bind:this={rootEl}>
	{#if view.loading}
		<div class="loading-panel">
			<p>Loading Pokedex&hellip; {view.progress.loaded}/{view.progress.total || "?"}</p>
			<div class="loading-track">
				<div
					class="loading-fill"
					style:width="{view.progress.total ? (view.progress.loaded / view.progress.total) * 100 : 0}%"
				></div>
			</div>
		</div>
	{:else}
		<!-- TableScreen stays mounted under both screens (display:none rather
		than an {#if}/{:else if} swap) so its local filter/sort/column-visibility
		state survives a round trip through the detail view instead of resetting
		every time. -->
		<div class:hidden-screen={screen !== "table"}>
			{#if view.progress.loaded < view.progress.total}
				<div class="loading-more-banner">
					Loading more Pokemon&hellip; {view.progress.loaded}/{view.progress.total}
				</div>
			{/if}
			{#if view.failedIds.length > 0}
				<div class="fetch-failure-banner">
					<span>{view.failedIds.length} Pokemon couldn't be fetched.</span>
					<button onclick={retryFailed} disabled={view.retrying}>
						{view.retrying ? "Retrying..." : `Retry ${view.failedIds.length}`}
					</button>
				</div>
			{/if}
			<TableScreen
				rows={view.rows}
				density={settings.gridDensity}
				defaultSortColumn={settings.defaultSortColumn}
				initialVisibleFields={settings.visibleFields}
				useTypeIcons={settings.useTypeIcons}
				{repository}
				activeGen={settings.activeGen}
				{favoriteIds}
				{onFieldsChange}
				onToggleFavorite={toggleFavorite}
				onSelect={openDetail}
			/>
		</div>
		{#if screen === "detail" && selectedId !== null}
			<DetailScreen
				{repository}
				id={selectedId}
				rows={view.rows}
				spriteStyle={settings.spriteStyle}
				useTypeIcons={settings.useTypeIcons}
				activeGen={settings.activeGen}
				isFavorite={favoriteIds.has(selectedId)}
				onToggleFavorite={toggleFavorite}
				onBack={backToTable}
				onSelect={openDetail}
			/>
		{/if}
	{/if}
</div>

<style>
	.loading-panel {
		max-width: 360px;
		margin: 15vh auto 0;
		text-align: center;
		color: var(--lk-text-muted);
	}
	.loading-track {
		height: 6px;
		border-radius: 3px;
		background: var(--lk-border);
		overflow: hidden;
	}
	.loading-fill {
		height: 100%;
		background: var(--lk-accent);
		transition: width 120ms ease-out;
	}
	.hidden-screen {
		display: none;
	}
	.loading-more-banner {
		padding: 4px 10px;
		margin-bottom: var(--lk-space-3);
		color: var(--lk-text-muted);
		font-size: 0.85em;
	}
	.fetch-failure-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		margin-bottom: var(--lk-space-3);
		background: var(--lk-danger-soft);
		border: 1px solid var(--lk-border);
		border-radius: 4px;
		font-size: 0.85em;
	}
</style>
