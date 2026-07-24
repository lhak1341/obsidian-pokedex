<script lang="ts">
	import type { PokedexTableRow } from "../../data/types";

	// Unlike Mega (a same-row data overlay, see VarietyFormToggle), a regional
	// form is a genuinely separate row with its own id — "switching" here
	// means navigating to that sibling row's own detail page via onSelect,
	// the same callback the evolution cards already use, not swapping data
	// in place.
	let { rows, currentId, dexNumber, onSelect }: {
		rows: PokedexTableRow[];
		currentId: number;
		dexNumber: number;
		onSelect: (id: number) => void;
	} = $props();

	const siblings = $derived(
		rows
			.filter((r) => r.dexNumber === dexNumber)
			.sort((a, b) => a.id - b.id), // base variety's own id always sorts first
	);
</script>

{#if siblings.length > 1}
	<div class="regional-form-nav">
		{#each siblings as sibling (sibling.id)}
			<button
				type="button"
				class="form-tab"
				class:active={sibling.id === currentId}
				disabled={sibling.id === currentId}
				onclick={() => onSelect(sibling.id)}
			>
				{sibling.formLabel ?? "Original"}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* Same segmented-pill visual language as MoveBrowser's version tabs and
	the old Mega pill-tab bar this mirrors — duplicated rather than shared
	since extracting shared CSS across Svelte components loses scoping (see
	this repo's CLAUDE.md gotcha on that). */
	.regional-form-nav {
		/* Gained flex-wrap — fine as a single non-wrapping row for 2 short
		siblings (Alolan/Galarian/Hisuian, one word each), but Tauros' 4
		Paldean-breed siblings have long labels ("Paldean (Combat Breed)")
		that don't fit the identity column's fixed 240px width; without wrap
		the whole box grew wider than its column and visibly overflowed into
		core-col next to it. max-width keeps it from doing that even before
		wrapping kicks in (identity-col itself has no overflow clipping).
		Stays inline-flex (not flex) so the 2-sibling case keeps shrink-
		wrapping to its own content instead of stretching to the column's
		full width. */
		display: inline-flex;
		flex-wrap: wrap;
		max-width: 100%;
		gap: 4px;
		padding: 4px;
		margin-top: 8px;
		background: var(--background-primary-alt);
		border: 1px solid var(--background-modifier-border);
		border-radius: 10px;
	}
	.form-tab {
		flex: none;
		background: transparent;
		border: none;
		border-radius: 7px;
		height: auto;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 0.85em;
		font-weight: 500;
		color: var(--text-normal);
		text-transform: capitalize;
		transition: background 100ms ease-out, color 100ms ease-out;
	}
	.form-tab:hover:not(.active) {
		background: var(--background-modifier-hover);
	}
	.form-tab.active {
		background: var(--background-primary);
		box-shadow: var(--shadow-s);
		cursor: default;
	}
</style>
