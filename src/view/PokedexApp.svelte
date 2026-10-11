<script lang="ts">
	import { Notice } from "obsidian";
	import { onDestroy, onMount, tick } from "svelte";
	import type { PokedexRepository } from "../data/PokedexRepository";
	import type { PluginSettings } from "../data/types";
	import { resolveGenerationScope } from "../utils/generationScope";
	import { describePartialLoadOutcome, describeRetryOutcome } from "../utils/loadNotices";
	import { DetailNavigationState, type ScrollInstruction } from "./DetailNavigationState";
	import { isEditableTarget } from "./domTarget";
	import DetailScreen from "./components/DetailScreen.svelte";
	import { emptyLoadSnapshot, type LoadSnapshot, PokedexLoadState } from "./PokedexLoadState";
	import TableScreen from "./components/TableScreen.svelte";

	let { repository, settings, onColumnsChange, onFavoritesChange }: {
		repository: PokedexRepository;
		settings: PluginSettings;
		onColumnsChange: (columns: string[]) => void;
		onFavoritesChange: (ids: number[]) => void;
	} = $props();

	let screen = $state<"table" | "detail">("table");
	let selectedId = $state<number | null>(null);

	// Browser-style back/forward through previously-viewed Pokemon (see
	// openDetail/goBack/goForward below), bound to plain "[" / "]" — no
	// modifier is free of conflict with any existing hotkey (unlike Cmd+L
	// and Cmd+[/Cmd+], which collide with Obsidian's/Electron's own bindings;
	// see QuickSearch.svelte's comment for that whole saga). DetailNavigationState
	// is a plain, non-reactive class (same reason as PokedexLoadState below) —
	// screen/selectedId above are the reactive mirror, re-assigned after every
	// call instead of read directly off the instance.
	const navState = new DetailNavigationState();

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

	function openDetail(id: number) {
		void applyNavigation(navState.openDetail(id, rootEl?.scrollTop ?? 0));
	}

	function goBack() {
		void applyNavigation(navState.goBack());
	}

	function goForward() {
		void applyNavigation(navState.goForward());
	}

	// Verified against both Obsidian's HotkeyManager and Electron's native
	// app menu (app.hotkeyManager.bakedHotkeys / Menu.getApplicationMenu())
	// that plain "[" and "]" have zero existing bindings, so this needs
	// neither the capture-phase trick nor stopPropagation that Mod+Shift+L
	// required.
	function onGlobalKeydown(e: KeyboardEvent) {
		if (isEditableTarget(e.target)) return;
		if (e.key === "[") {
			e.preventDefault();
			goBack();
		} else if (e.key === "]") {
			e.preventDefault();
			goForward();
		}
	}

	onMount(() => window.addEventListener("keydown", onGlobalKeydown));
	onDestroy(() => window.removeEventListener("keydown", onGlobalKeydown));

	function backToTable() {
		void applyNavigation(navState.backToTable());
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
				initialVisibleColumns={settings.visibleColumns}
				useTypeIcons={settings.useTypeIcons}
				{repository}
				activeGen={settings.activeGen}
				initialFavoriteIds={settings.favoritePokemonIds}
				{onColumnsChange}
				{onFavoritesChange}
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
		color: var(--text-muted);
	}
	.loading-track {
		height: 6px;
		border-radius: 3px;
		background: var(--background-modifier-border);
		overflow: hidden;
	}
	.loading-fill {
		height: 100%;
		background: var(--interactive-accent);
		transition: width 120ms ease-out;
	}
	.hidden-screen {
		display: none;
	}
	.loading-more-banner {
		padding: 4px 10px;
		margin-bottom: var(--size-4-3);
		color: var(--text-muted);
		font-size: 0.85em;
	}
	.fetch-failure-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		margin-bottom: var(--size-4-3);
		background: var(--background-modifier-error);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		font-size: 0.85em;
	}
</style>
