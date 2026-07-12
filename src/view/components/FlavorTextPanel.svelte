<script lang="ts">
	import { FLAVOR_TEXT_TABS } from "../../data/constants";
	import Icon from "./Icon.svelte";

	let { flavorTexts }: { flavorTexts: Record<string, string> } = $props();

	// Not reset on id change (this component instance persists across
	// Pokemon navigation — see DetailScreen, which doesn't remount this
	// panel when `id` changes, only when entry itself becomes null) — stays
	// on e.g. "Emerald" while browsing several Pokemon. Falls back to the
	// first tab this entry actually has data for (see flavorTabs) if the
	// remembered key isn't among them, so this never needs a null case.
	let activeFlavorVersion = $state<string>(FLAVOR_TEXT_TABS[0].key);

	// Only tabs this species actually has flavor text for (every Gen 1-3 dex
	// entry has all four in practice — see FLAVOR_TEXT_TABS — but a cache
	// written before a tab existed can still be missing one until the user
	// clears the cache, see PokedexRepository.getOrFetchSpecies).
	const flavorTabs = $derived(FLAVOR_TEXT_TABS.filter((tab) => flavorTexts[tab.key]));
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
