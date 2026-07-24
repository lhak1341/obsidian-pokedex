<script lang="ts">
	// Purely presentational — fetch/cache state for the selected form lives
	// in DetailScreen (unlike AbilitiesPanel/HeldItemsPanel's self-contained
	// hover popovers), since a Mega/Gigantamax selection needs to drive
	// sibling panels (StatBars, AbilitiesPanel, the portrait itself) outside
	// this component's own tree, not just itself.
	//
	// Shared by DetailScreen's Mega toggle (bottom-left) and Gigantamax
	// toggle (bottom-right) — same badge/toggle shape, differing only in
	// badgeText's rule (Mega: "M", or last letter for the X/Y split; always
	// "G" for Gigantamax) and which corner they occupy.
	let { forms, activeKey, onSelect, badgeText, corner }: {
		forms: { key: string; label: string }[];
		activeKey: string | null;
		onSelect: (key: string | null) => void;
		badgeText: (label: string) => string;
		corner: "left" | "right";
	} = $props();

	// No separate "Base" button — clicking the already-active one toggles
	// back to base, clicking a different one switches to it directly
	// (deactivating whichever was active), same interaction model as the
	// existing shiny-toggle single button, just one instance per form.
	function toggle(key: string) {
		onSelect(activeKey === key ? null : key);
	}
</script>

{#if forms.length > 0}
	<div class="variety-form-toggle" class:corner-left={corner === "left"} class:corner-right={corner === "right"}>
		{#each forms as form (form.key)}
			<button
				type="button"
				class="variety-badge"
				class:active={activeKey === form.key}
				onclick={() => toggle(form.key)}
				aria-label={activeKey === form.key ? `Show base ${form.label} form` : `Show ${form.label} form`}
				title={activeKey === form.key ? "Show base form" : form.label}
			>
				{badgeText(form.label)}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* Same footprint/position family as DetailScreen's .shiny-toggle (top-
	right on the portrait) — Mega takes bottom-left, Gigantamax bottom-right,
	so a species with both (e.g. Venusaur/Charizard/Blastoise) can show both
	toggles without overlap. Multiple forms (Charizard/Mewtwo's Mega X/Y
	pair) lay out left-to-right from the corner. */
	.variety-form-toggle {
		position: absolute;
		bottom: 8px;
		display: flex;
		gap: 4px;
	}
	.variety-form-toggle.corner-left {
		left: 8px;
	}
	.variety-form-toggle.corner-right {
		right: 8px;
	}
	.variety-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s, 6px);
		color: var(--text-muted);
		cursor: pointer;
		box-shadow: var(--shadow-s);
		font-size: 0.8em;
		font-weight: 700;
	}
	.variety-badge:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.variety-badge.active {
		color: var(--interactive-accent);
		border-color: var(--interactive-accent);
	}
</style>
