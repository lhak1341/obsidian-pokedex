<script lang="ts">
	import { FLAVOR_TEXT_TABS_BY_GEN, GENERATIONS } from "../../data/constants";
	import Icon from "./Icon.svelte";

	const LATEST_GEN = Math.max(...GENERATIONS.map((g) => g.id));

	let { flavorTexts, activeGen }: { flavorTexts: Record<string, string>; activeGen: number } = $props();

	// Not reset on id change (this component instance persists across
	// Pokemon navigation — see DetailScreen, which doesn't remount this
	// panel when `id` changes, only when entry itself becomes null) — stays
	// on e.g. "Emerald" while browsing several Pokemon, and also survives an
	// Active Gen switch. Falls back to the first tab this entry actually has
	// data for (see flavorTabs) if the remembered key isn't among them, so
	// this never needs a null case.
	let activeFlavorVersion = $state<string>("");

	// Tabs for the active generation that this species actually has flavor
	// text for (a cache written before a tab existed can be missing one
	// until the user clears the cache, see PokedexRepository.getOrFetchSpecies)
	// — falling back to the latest supported generation's tabs when the
	// active generation predates this species (e.g. viewing a Gen 4 mon with
	// Active Gen set to Gen 3, which has no data for it at all), same
	// "prioritize active gen, fall back to latest" rule as resolveStatsForGen.
	const flavorTabs = $derived.by(() => {
		const primary = (FLAVOR_TEXT_TABS_BY_GEN[activeGen] ?? []).filter((tab) => flavorTexts[tab.key]);
		if (primary.length > 0) return primary;
		return (FLAVOR_TEXT_TABS_BY_GEN[LATEST_GEN] ?? []).filter((tab) => flavorTexts[tab.key]);
	});
	const activeFlavorIndex = $derived(
		Math.max(0, flavorTabs.findIndex((tab) => tab.key === activeFlavorVersion)),
	);
	const currentFlavorTab = $derived(flavorTabs[activeFlavorIndex] ?? null);
	const currentFlavorText = $derived(currentFlavorTab ? flavorTexts[currentFlavorTab.key] ?? null : null);

	function cycleFlavorVersion(direction: 1 | -1) {
		if (flavorTabs.length === 0) return;
		const nextIndex = (activeFlavorIndex + direction + flavorTabs.length) % flavorTabs.length;
		activeFlavorVersion = flavorTabs[nextIndex].key;
	}
</script>

{#if currentFlavorText}
	<div class="flavor-block">
		<div class="flavor-version-toggle">
			<button
				type="button"
				class="flavor-version-arrow"
				onclick={() => cycleFlavorVersion(-1)}
				disabled={flavorTabs.length < 2}
				aria-label="Previous game version"
			>
				<Icon name="chevron-left" size={12} strokeWidth={2.5} />
			</button>
			<span class="flavor-version-label">{currentFlavorTab?.label}</span>
			<button
				type="button"
				class="flavor-version-arrow"
				onclick={() => cycleFlavorVersion(1)}
				disabled={flavorTabs.length < 2}
				aria-label="Next game version"
			>
				<Icon name="chevron-right" size={12} strokeWidth={2.5} />
			</button>
		</div>
		<p class="flavor-text">{currentFlavorText}</p>
	</div>
{/if}

<style>
	/* Toggle + description grouped in their own tight column so they read as
	one unit, independent of identity-col's larger 20px rhythm between major
	blocks (portrait / name / height-weight / description) in DetailScreen. */
	.flavor-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.flavor-text {
		margin: 0;
		padding-left: 10px;
		border-left: 2px solid var(--background-modifier-border);
		color: var(--text-muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}
	/* Spans the identity column's full width, like a carousel control —
	arrows pinned to the edges, label centered between them. Text styling
	matches BarRow's .bar-label (the HP/Atk/... stat labels) rather than
	inventing a new one, since this plays the same "small muted caption"
	role. */
	.flavor-version-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.flavor-version-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: auto;
		height: auto;
		padding: 2px;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		opacity: 0.7;
		transition: opacity 100ms ease-out;
	}
	.flavor-version-arrow:hover:not(:disabled) {
		opacity: 1;
	}
	.flavor-version-arrow:disabled {
		visibility: hidden;
	}
	.flavor-version-label {
		flex: 1;
		text-align: center;
		font-weight: 600;
		color: var(--text-muted);
		font-size: 0.85em;
	}
</style>
