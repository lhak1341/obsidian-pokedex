<script lang="ts">
	import { createInfoDescription } from "../infoDescription.svelte";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";

	let { abilities, getDescription }: {
		abilities: { name: string; isHidden: boolean }[];
		getDescription: (name: string) => Promise<string | null>;
	} = $props();

	// Keyed by ability name, NOT reset on id change (this component instance
	// persists across Pokemon navigation — see DetailScreen, which doesn't
	// remount this panel when `id` changes, only when entry itself becomes
	// null) — abilities repeat heavily across species (e.g. "levitate"), so
	// opening one already seen on a previous Pokemon this session reuses
	// the cached description instead of refetching (getDescription also
	// caches on the repository side, but this avoids even the async
	// round-trip). Positioned relative to .detail-screen (position: absolute,
	// not fixed — see DetailScreen's .detail-screen CSS comment for why), not
	// the raw viewport rect.
	const popover = createInfoDescription((name) => getDescription(name));
</script>

<ul class="ability-list">
	{#each abilities.filter((a) => !a.isHidden) as ability (ability.name)}
		<li class="pkdx-info-target" {...popover.target(ability.name)}>{ability.name}</li>
	{/each}
</ul>
{#each abilities.filter((a) => a.isHidden) as ability (ability.name)}
	<div class="hidden-ability-block">
		<p class="hidden-ability-label">Hidden Ability (G5+)</p>
		<p class="hidden-ability-name pkdx-info-target" {...popover.target(ability.name)}>{ability.name}</p>
	</div>
{/each}

<InfoPopoverBox popover={popover}>
	{popover.body}
</InfoPopoverBox>

<style>
	.ability-list {
		text-transform: capitalize;
		margin: 0;
		/* Default UA/theme bullet indent is 40px — way out of proportion for
		this compact panel (every other line here sits flush left). 18px
		keeps the bullet marker but tightens the indent to match. */
		padding-left: 18px;
	}
	/* A block's box spans the panel; the target is the name's own width. */
	.ability-list li {
		width: fit-content;
	}
	/* Same label/value pairing as DetailScreen's .physical-readout
	HEIGHT/WEIGHT (small uppercase muted label over a value), not an inline
	"(hidden)" suffix — the hidden ability is a distinct fact worth its own
	visual slot, same reasoning that gave height/weight one. */
	.hidden-ability-block {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--lk-border);
	}
	.hidden-ability-label {
		margin: 0 0 2px;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--lk-text-muted);
	}
	.hidden-ability-name {
		margin: 0;
		text-transform: capitalize;
		width: fit-content;
	}
</style>
