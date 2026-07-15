<script lang="ts">
	import { Notice } from "obsidian";
	import { onDestroy, onMount, tick } from "svelte";
	import type { PokedexRepository } from "../data/PokedexRepository";
	import type { PluginSettings, PokedexTableRow } from "../data/types";
	import { resolveGenerationScope } from "../utils/generationScope";
	import DetailScreen from "./components/DetailScreen.svelte";
	import { PokedexLoadState } from "./PokedexLoadState";
	import TableScreen from "./components/TableScreen.svelte";

	let { repository, settings, onColumnsChange }: {
		repository: PokedexRepository;
		settings: PluginSettings;
		onColumnsChange: (columns: string[]) => void;
	} = $props();

	let screen = $state<"table" | "detail">("table");
	let selectedId = $state<number | null>(null);

	// Browser-style back/forward through previously-viewed Pokemon (see
	// openDetail/goBack/goForward below), bound to plain "[" / "]" — no
	// modifier is free of conflict with any existing hotkey (unlike Cmd+L
	// and Cmd+[/Cmd+], which collide with Obsidian's/Electron's own bindings;
	// see QuickSearch.svelte's comment for that whole saga).
	let history = $state<number[]>([]);
	let historyIndex = $state(-1);

	// PokedexLoadState is a plain, non-reactive class (tested with plain
	// vitest, see PokedexLoadState.test.ts) — Svelte 5's $state only
	// deep-proxies plain objects/arrays, not class instances, so mutations
	// to its fields wouldn't be visible to the template. These $state
	// primitives are the reactive boundary instead, explicitly assigned
	// from the worker's results/progress callback.
	let rows = $state<PokedexTableRow[]>([]);
	let failedIds = $state<number[]>([]);
	let loading = $state(true);
	let retrying = $state(false);
	let progress = $state({ loaded: 0, total: 0 });

	let loadState: PokedexLoadState;

	// PokedexView.refresh() (fired on any settings change — see main.ts
	// saveSettings) unmounts this component and mounts a fresh one. Without
	// cancelling here, a load still in flight when that happens keeps running
	// in the background while the new instance starts its own load — every id
	// the old one hadn't reached yet gets fetched twice for nothing.
	onDestroy(() => loadState?.cancel());

	onMount(() => {
		const { fetchRange, includes } = resolveGenerationScope(settings.enabledGenerations);
		loadState = new PokedexLoadState(repository, fetchRange, includes);
		loadState
			.load(
				(loaded, total) => (progress = { loaded, total }),
				// Render the table as soon as the first row lands instead of
				// blocking on the whole batch — the rest streams in behind a slim
				// progress indicator (see the template) rather than a full-screen
				// loader.
				(row) => {
					rows = [...rows, row];
					loading = false;
				},
			)
			.then(() => {
				if (loadState.cancelled) return;
				rows = loadState.rows;
				failedIds = loadState.failedIds;
				loading = false;
				if (failedIds.length > 0) {
					new Notice(
						`Pokedex: showing ${rows.length} of ${rows.length + failedIds.length} ` +
						"Pokemon; some entries couldn't be fetched (offline or PokeAPI unreachable).",
					);
				}
			});
	});

	function retryFailed() {
		const attempted = failedIds.length;
		retrying = true;
		loadState.retry((loaded, total) => (progress = { loaded, total })).then((result) => {
			retrying = false;
			if (!result || loadState.cancelled) return;
			rows = loadState.rows;
			failedIds = loadState.failedIds;
			if (result.failedIds.length > 0) {
				new Notice(`Pokedex: ${result.rows.length} of ${attempted} retried entries loaded; ${result.failedIds.length} still unreachable.`);
			} else {
				new Notice("Pokedex: all entries loaded.");
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
	// Saved the moment the user leaves the table (not on every openDetail
	// call — an evolution-chain click inside the detail view also calls
	// openDetail, and that must not clobber this with the detail view's own
	// scroll position).
	let tableScrollTop = 0;

	function openDetail(id: number) {
		if (screen === "table") tableScrollTop = rootEl?.scrollTop ?? 0;
		selectedId = id;
		screen = "detail";
		rootEl?.scrollTo(0, 0);
		// Same truncate-then-push semantics as a browser's history stack: a
		// fresh navigation (table row, evolution card, quick search, ...)
		// drops any forward entries past the current point rather than
		// leaving them reachable via goForward.
		history = [...history.slice(0, historyIndex + 1), id];
		historyIndex = history.length - 1;
	}

	// Past the oldest viewed Pokemon, "[" steps out one more level to the
	// table itself — same destination as the "Back to list" button, just
	// reusing backToTable() rather than duplicating its scroll-restore logic.
	function goBack() {
		if (historyIndex <= 0) {
			if (screen === "detail") void backToTable();
			return;
		}
		historyIndex -= 1;
		selectedId = history[historyIndex];
		rootEl?.scrollTo(0, 0);
	}

	// Symmetric counterpart: from the table (having arrived there via goBack,
	// not the explicit "Back to list" button), "]" re-enters detail at
	// whatever Pokemon history was last pointing at.
	function goForward() {
		if (screen === "table") {
			if (historyIndex < 0 || historyIndex >= history.length) return;
			selectedId = history[historyIndex];
			screen = "detail";
			rootEl?.scrollTo(0, 0);
			return;
		}
		if (historyIndex >= history.length - 1) return;
		historyIndex += 1;
		selectedId = history[historyIndex];
		rootEl?.scrollTo(0, 0);
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
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

	async function backToTable() {
		screen = "table";
		// TableScreen stays mounted (see template — it's hidden via CSS while
		// viewing detail, not destroyed, so its filters/sort/column state
		// survive) but restoring a non-zero scroll position still needs the
		// DOM to have un-hidden it first, or the browser clamps the scrollTop
		// write to whatever the still-collapsed height allows.
		await tick();
		rootEl?.scrollTo(0, tableScrollTop);
	}
</script>

<div class="pokedex-view" bind:this={rootEl}>
	{#if loading}
		<div class="loading-panel">
			<p>Loading Pokedex&hellip; {progress.loaded}/{progress.total || "?"}</p>
			<div class="loading-track">
				<div
					class="loading-fill"
					style:width="{progress.total ? (progress.loaded / progress.total) * 100 : 0}%"
				></div>
			</div>
		</div>
	{:else}
		<!-- TableScreen stays mounted under both screens (display:none rather
		than an {#if}/{:else if} swap) so its local filter/sort/column-visibility
		state survives a round trip through the detail view instead of resetting
		every time. -->
		<div class:hidden-screen={screen !== "table"}>
			{#if progress.loaded < progress.total}
				<div class="loading-more-banner">
					Loading more Pokemon&hellip; {progress.loaded}/{progress.total}
				</div>
			{/if}
			{#if failedIds.length > 0}
				<div class="fetch-failure-banner">
					<span>{failedIds.length} Pokemon couldn't be fetched.</span>
					<button onclick={retryFailed} disabled={retrying}>
						{retrying ? "Retrying..." : `Retry ${failedIds.length}`}
					</button>
				</div>
			{/if}
			<TableScreen
				{rows}
				density={settings.gridDensity}
				defaultSortColumn={settings.defaultSortColumn}
				initialVisibleColumns={settings.visibleColumns}
				useTypeIcons={settings.useTypeIcons}
				{onColumnsChange}
				onSelect={openDetail}
			/>
		</div>
		{#if screen === "detail" && selectedId !== null}
			<DetailScreen
				{repository}
				id={selectedId}
				{rows}
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
