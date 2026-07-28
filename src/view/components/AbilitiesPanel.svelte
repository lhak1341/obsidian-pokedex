<script lang="ts">
	import { createHoverDescription } from "../hoverDescription.svelte";
	import HoverPopoverBox from "./HoverPopoverBox.svelte";

	let { abilities, getDescription }: {
		abilities: { name: string; isHidden: boolean }[];
		getDescription: (name: string) => Promise<string | null>;
	} = $props();

	// Keyed by ability name, NOT reset on id change (this component instance
	// persists across Pokemon navigation — see DetailScreen, which doesn't
	// remount this panel when `id` changes, only when entry itself becomes
	// null) — abilities repeat heavily across species (e.g. "levitate"), so
	// hovering one already seen on a previous Pokemon this session reuses
	// the cached description instead of refetching (getDescription also
	// caches on the repository side, but this avoids even the async
	// round-trip). Positioned relative to .detail-screen (position: absolute,
	// not fixed — see DetailScreen's .detail-screen CSS comment for why), not
	// the raw viewport rect.
	const popover = createHoverDescription(".detail-screen", (name) => getDescription(name));
</script>

<ul class="ability-list">
	{#each abilities.filter((a) => !a.isHidden) as ability (ability.name)}
		<li
			onmouseenter={(e) => popover.show(ability.name, e.currentTarget)}
			onmouseleave={popover.hide}
		>
			{ability.name}
		</li>
	{/each}
</ul>
{#each abilities.filter((a) => a.isHidden) as ability (ability.name)}
	<div class="hidden-ability-block">
		<p class="hidden-ability-label">Hidden Ability (G5+)</p>
		<p
			class="hidden-ability-name"
			onmouseenter={(e) => popover.show(ability.name, e.currentTarget)}
			onmouseleave={popover.hide}
		>
			{ability.name}
		</p>
	</div>
{/each}

<HoverPopoverBox hoverState={popover}>
	{#if !popover.status}
		Loading…
	{:else if popover.status === "error"}
		Couldn't load description.
	{:else}
		{popover.status.text ?? "No description available."}
	{/if}
</HoverPopoverBox>

<style>
	.ability-list {
		text-transform: capitalize;
		margin: 0;
		/* Default UA/theme bullet indent is 40px — way out of proportion for
		this compact panel (every other line here sits flush left). 18px
		keeps the bullet marker but tightens the indent to match. */
		padding-left: 18px;
	}
	.ability-list li {
		cursor: help;
	}
	/* Same label/value pairing as DetailScreen's .physical-readout
	HEIGHT/WEIGHT (small uppercase muted label over a value), not an inline
	"(hidden)" suffix — the hidden ability is a distinct fact worth its own
	visual slot, same reasoning that gave height/weight one. */
	.hidden-ability-block {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.hidden-ability-label {
		margin: 0 0 2px;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.hidden-ability-name {
		margin: 0;
		text-transform: capitalize;
		cursor: help;
	}
</style>
