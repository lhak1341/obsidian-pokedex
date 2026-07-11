<script lang="ts">
	import { Notice } from "obsidian";
	import { onMount } from "svelte";
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

	onMount(() => {
		const { fetchRange, includes } = resolveGenerationScope(settings.enabledGenerations);
		loadState = new PokedexLoadState(repository, fetchRange, includes);
		loadState.load((loaded, total) => (progress = { loaded, total })).then(() => {
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
			if (!result) return;
			rows = loadState.rows;
			failedIds = loadState.failedIds;
			if (result.failedIds.length > 0) {
				new Notice(`Pokedex: ${result.rows.length} of ${attempted} retried entries loaded; ${result.failedIds.length} still unreachable.`);
			} else {
				new Notice("Pokedex: all entries loaded.");
			}
		});
	}

	function openDetail(id: number) {
		selectedId = id;
		screen = "detail";
	}

	function backToTable() {
		screen = "table";
	}
</script>

<div class="pokedex-view">
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
	{:else if screen === "table"}
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
			{onColumnsChange}
			onSelect={openDetail}
		/>
	{:else if screen === "detail" && selectedId !== null}
		<DetailScreen
			{repository}
			id={selectedId}
			spriteStyle={settings.spriteStyle}
			onBack={backToTable}
			onSelect={openDetail}
		/>
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
