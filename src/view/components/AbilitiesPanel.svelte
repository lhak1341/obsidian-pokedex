<script lang="ts">
	import { relativeRect } from "../domPosition";

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
	// round-trip).
	let abilityDescriptions = $state<Record<string, { text: string | null } | { error: true }>>({});
	let hoveredAbility = $state<string | null>(null);
	let abilityPopoverPos = $state<{ top: number; left: number } | null>(null);

	function showAbilityPopover(name: string, target: EventTarget | null) {
		hoveredAbility = name;
		// Positioned relative to .detail-screen (position: absolute, not
		// fixed — see DetailScreen's .detail-screen CSS comment for why), not
		// the raw viewport rect.
		const r = relativeRect(target as HTMLElement, ".detail-screen");
		abilityPopoverPos = { top: r.bottom + 6, left: r.left };
		if (!(name in abilityDescriptions)) {
			getDescription(name)
				.then((text) => {
					abilityDescriptions = { ...abilityDescriptions, [name]: { text } };
				})
				.catch(() => {
					abilityDescriptions = { ...abilityDescriptions, [name]: { error: true } };
				});
		}
	}

	function hideAbilityPopover() {
		hoveredAbility = null;
		abilityPopoverPos = null;
	}
</script>

<ul class="ability-list">
	{#each abilities.filter((a) => !a.isHidden) as ability (ability.name)}
		<li
			onmouseenter={(e) => showAbilityPopover(ability.name, e.currentTarget)}
			onmouseleave={hideAbilityPopover}
		>
			{ability.name}
		</li>
	{/each}
</ul>
{#each abilities.filter((a) => a.isHidden) as ability (ability.name)}
	<div class="hidden-ability-block">
		<p class="hidden-ability-label">Hidden Ability</p>
		<p
			class="hidden-ability-name"
			onmouseenter={(e) => showAbilityPopover(ability.name, e.currentTarget)}
			onmouseleave={hideAbilityPopover}
		>
			{ability.name}
		</p>
	</div>
{/each}

{#if hoveredAbility && abilityPopoverPos}
	{@const state = abilityDescriptions[hoveredAbility]}
	<div class="ability-popover" style="top: {abilityPopoverPos.top}px; left: {abilityPopoverPos.left}px;">
		{#if !state}
			Loading…
		{:else if "error" in state}
			Couldn't load description.
		{:else}
			{state.text ?? "No description available."}
		{/if}
	</div>
{/if}

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
	.ability-popover {
		position: absolute;
		z-index: 50;
		max-width: 260px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		box-shadow: var(--shadow-s);
		padding: 8px 10px;
		font-size: 0.85em;
		color: var(--text-normal);
		pointer-events: none;
	}
</style>
