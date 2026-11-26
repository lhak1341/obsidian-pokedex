<script lang="ts">
	import { describeEvolutionRequirement } from "../../data/normalize";
	import type { ChainMember, EvolutionNode } from "../../data/types";
	import { canPairBranches } from "../../utils/evolutionLayout";
	import { formatDexNumber, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import EvolutionChain from "./EvolutionChain.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let { node, onSelect, chainMembers, useTypeIcons, evolveLabel, compact = false, splitLabels = false, pairBranches = false, inPairedRow = false, stageWidths = [], depth = 0 }: {
		node: EvolutionNode;
		onSelect: (id: number) => void;
		// The Chain members (CONTEXT.md), keyed by id: each card's sprite and
		// type badges, from the Entry load's chain-members stage rather than a
		// per-node fetch. No loading state of its own: until they land (or for
		// a member that failed) a card shows text only.
		chainMembers: Record<number, ChainMember>;
		useTypeIcons: boolean;
		// The level/item/trigger that led INTO this node — computed by the
		// parent (it's the parent that knows which of its evolution_details
		// produced this child) and passed down rather than recursing on the
		// child's own data, since the child has no way to know how it got
		// here. Undefined for the chain's root.
		evolveLabel?: string;
		// The phone layout's 72px cards with 10px gaps (#32), so a
		// three-stage chain fits one row of a 390px pane.
		compact?: boolean;
		// Compact only: put every card's number and name on separate lines.
		// The Evolution layout decides it for the whole chain (`EvolutionLayout`
		// in utils/evolutionLayout.ts).
		splitLabels?: boolean;
		// The widest card's width at each stage, by depth from the root:
		// EvolutionTree measures it (`EvolutionLayout.stageWidths`) so siblings share
		// one width and their sprites one centre line.
		stageWidths?: number[];
		depth?: number;
		// Lay out a node's evolutions two to a row where canPairBranches
		// allows it. The Evolution layout decides it for the whole chain
		// (`EvolutionLayout.pairBranches`): only when the paired chain fits the pane.
		pairBranches?: boolean;
		// Set by the parent when it lays this node out two to a row: the
		// method then wraps under the sprite (.in-paired-row below).
		inPairedRow?: boolean;
	} = $props();

	const canPair = $derived(canPairBranches(node));
	const member = $derived(chainMembers[node.id]);

</script>

<div class="evo-node" class:compact class:split-labels={splitLabels} class:in-paired-row={inPairedRow}>
	<!-- data-evo-id: the connecting lines are drawn by EvolutionTree (the
	wrapper that mounts this component), which measures card centers by this
	attribute rather than this component tracking its own position — it has
	no way to know where its parent or siblings ended up. -->
	<button
		class="evo-card"
		data-evo-id={node.id}
		style:--pkdx-evo-stage-width={stageWidths[depth] ? `${stageWidths[depth]}px` : null}
		onclick={() => onSelect(node.id)}
	>
		{#if member?.sprite}
			<img src={member.sprite} alt={formatPokemonDisplayName(node)} class="evo-sprite" />
		{/if}
		<!-- Always rendered (even for the root, which has no evolveLabel) so
		every card reserves the same slot height — otherwise the root's
		shorter card (no method line) throws its "No. Name" off the row all
		the other stages line up on. A plain " " collapses to 0 height here
		(whitespace-only inline content gets trimmed away), which silently
		defeated that — a non-breaking space renders like real text instead. -->
		<span class="evo-method"><span class="evo-method-text">{evolveLabel || " "}</span></span>
		<!-- Two spans so the phone layout can give the number and the name a
		line each (see .compact below); inline with a space on desktop. -->
		<span class="evo-label"
			><span class="evo-num">#{formatDexNumber(node.dexNumber)}</span>
			<span class="evo-name">{formatPokemonDisplayName(node)}</span></span
		>
		<span class="evo-types">
			{#each member?.types ?? [] as type (type)}
				<TypeBadge {type} useIcon={useTypeIcons} compact />
			{/each}
		</span>
	</button>

	{#if node.children.length > 0}
		<div class="evo-children" class:paired={pairBranches && canPair}>
			{#each node.children as child (child.id)}
				<div class="evo-branch">
					<EvolutionChain
						node={child}
						{onSelect}
						{chainMembers}
						{useTypeIcons}
						evolveLabel={describeEvolutionRequirement(child)}
						{compact}
						{splitLabels}
						{stageWidths}
						{pairBranches}
						inPairedRow={pairBranches && canPair}
						depth={depth + 1}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.evo-node {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 28px;
	}
	.evo-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		padding: 4px;
		/* Obsidian's own `button { height: var(--input-height) }` otherwise
		clips this to ~30px regardless of the 92px sprite inside — height,
		unlike most of its base button rule, isn't something our higher-
		specificity selector overrides just by existing; only an explicit
		declaration for the same property does. */
		height: auto;
		background: none;
		border: none;
		border-radius: var(--lk-radius-m);
		cursor: pointer;
		flex-shrink: 0;
		min-width: var(--pkdx-evo-stage-width, 0);
		/* Above the SVG connector lines EvolutionTree draws behind this whole
		layout, and above its own background on hover. */
		position: relative;
		z-index: 1;
		transition: background-color var(--lk-duration-fast) ease-out;
	}
	.evo-card:hover {
		background: var(--lk-surface-hover);
	}
	.evo-sprite {
		width: 92px;
		height: 92px;
		image-rendering: pixelated;
	}
	.evo-method {
		font-size: 0.84em;
		font-weight: 700;
		line-height: 1.15;
		color: var(--lk-text-muted);
		text-transform: capitalize;
		white-space: nowrap;
	}
	.evo-label {
		font-size: 0.78em;
		line-height: 1.15;
		text-transform: capitalize;
		text-align: center;
		white-space: nowrap;
	}
	.evo-types {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 3px;
		margin-top: 1px;
	}
	.evo-children {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* Two to a row, with the same gap between the columns as between a card
	and its evolutions, which the Evolution layout's width sum assumes. A paired
	card's method wraps under its sprite, as on the phone
	(.in-paired-row below), or Sylveon's "Friendship (Fairy Move)" alone
	widens both columns past a 402px panel. */
	.evo-children.paired {
		display: grid;
		grid-template-columns: auto auto;
		column-gap: 28px;
	}
	.compact > .evo-children.paired {
		column-gap: 10px;
	}
	.evo-branch {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
	}
	/* Phone (#32): cards at least 72px, 10px gaps. A fixed 72px card wrapped
	the label wherever the text ran out: "#032" alone over "Nidoran♂" but
	"#033 Nidorino" on one line, so the cards' numbers and names fell out of
	line. Now a card grows to its label, which is "#032 Name" on one line on
	every card, or number and name a line each on every card
	(.split-labels: EvolutionTree picks it when the chain wouldn't fit the
	pane on one line). The method and type badges wrap inside the card
	instead of widening it (contain: inline-size), and the method always
	reserves the chain's tallest method (--pkdx-evo-method-height, measured by
	EvolutionTree; two lines until then), so every card's number and name
	land on the same rows. The badge row likewise reserves the chain's
	tallest (--pkdx-evo-types-height): two badges wrap to a second row, one
	doesn't, and a shorter one-type card (Chimchar) centred with its sprite
	below its evolutions'. With every card one height, the cards stay
	centred like the desktop layout, so a parent sits level with the middle
	of its branches (Gloom between Vileplume and Bellossom), not the first. */
	.compact {
		gap: 10px;
	}
	.compact > .evo-card {
		--pkdx-evo-card-floor: 72px;
		min-width: max(var(--pkdx-evo-card-floor), var(--pkdx-evo-stage-width, 0px));
		padding: 2px;
	}
	.compact .evo-sprite {
		width: 64px;
		height: 64px;
	}
	.compact .evo-method,
	.compact .evo-types,
	.in-paired-row > .evo-card > .evo-method {
		contain: inline-size;
		align-self: stretch;
	}
	.compact .evo-method,
	.in-paired-row > .evo-card > .evo-method {
		white-space: normal;
		text-align: center;
		overflow-wrap: anywhere;
		min-height: var(--pkdx-evo-method-height, calc(2em * 1.15));
	}
	.compact .evo-types {
		min-height: var(--pkdx-evo-types-height, 0);
		align-content: flex-start;
	}
	.compact .evo-label {
		display: flex;
		align-items: center;
		justify-content: center;
		column-gap: 0.3em;
	}
	.compact .evo-num,
	.compact .evo-name {
		flex-shrink: 0;
	}
	.split-labels .evo-label {
		flex-direction: column;
	}
	/* Three 72px cards and two 10px gaps take 236px, and a 320px leaf's tree
	is 223px, so a three-stage chain wrapped into a triangle even with
	compact cards. Under 240px of tree they shrink a step (three stages:
	~192px). The tree reads the floor and gap back from computed style. */
	@container evo (width < 240px) {
		.compact {
			gap: 6px;
		}
		.compact > .evo-card {
			--pkdx-evo-card-floor: 60px;
		}
		.compact .evo-sprite {
			width: 56px;
			height: 56px;
		}
	}
</style>
