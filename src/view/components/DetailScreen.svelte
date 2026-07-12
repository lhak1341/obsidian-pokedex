<script lang="ts">
	import { Notice } from "obsidian";
	import { TYPE_COLORS } from "../../data/constants";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { EvolutionNode, PokedexEntry, PluginSettings } from "../../data/types";
	import EvolutionTree from "./EvolutionTree.svelte";
	import StatBars from "./StatBars.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let { repository, id, spriteStyle, useTypeIcons, onBack, onSelect }: {
		repository: PokedexRepository;
		id: number;
		spriteStyle: PluginSettings["spriteStyle"];
		useTypeIcons: boolean;
		onBack: () => void;
		onSelect: (id: number) => void;
	} = $props();

	let entry = $state<PokedexEntry | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let retryToken = $state(0);
	// Keyed by dex id, filled in once the evolution chain arrives (see
	// getEntryExtras below). Every id in a chain was already fetched for the
	// table load that got the user here, so this resolves from mem cache —
	// not a second round of real network requests.
	let evolutionSprites = $state<Record<number, string | null>>({});

	function collectChainIds(node: EvolutionNode, ids: number[] = []): number[] {
		ids.push(node.id);
		for (const child of node.children) collectChainIds(child, ids);
		return ids;
	}

	// Every entry gets its own accent, drawn from its primary type's existing
	// badge color (see TypeBadge/constants.ts) rather than one fixed brand
	// color — the identity column is themed per-Pokemon, not per-plugin. Only
	// ever used decoratively (glow, accent rule, eyebrow) — never as body
	// text color — so it can't create a contrast problem in a theme it
	// happens to clash with.
	const accentColor = $derived(TYPE_COLORS[entry?.types[0] ?? ""] ?? "var(--interactive-accent)");

	$effect(() => {
		const currentId = id;
		void retryToken; // re-run this effect when retry() bumps the token
		loading = true;
		error = null;
		entry = null;
		evolutionSprites = {};
		// Pokemon/species/sprite are already mem-cached from the table load
		// that got the user to this row, so getEntryCore resolves almost
		// immediately — render on that instead of waiting on the genuinely
		// slow, never-cached-until-now parts (evolution chain, official
		// artwork, shiny), which arrive later via getEntryExtras and merge in
		// once ready. `id !== currentId` guards against a stale response
		// landing after the user has since clicked through to another entry
		// (e.g. from the evolution chain) before this one settled.
		repository.getEntryCore(currentId)
			.then((core) => {
				if (id !== currentId) return;
				entry = core;
				loading = false;
				repository.getEntryExtras(currentId).then((extras) => {
					if (id !== currentId || !entry) return;
					entry = { ...entry, ...extras };
					if (!extras.evolutionChain) return;
					const chainIds = collectChainIds(extras.evolutionChain);
					Promise.all(
						chainIds.map((chainId) =>
							repository.getEntryCore(chainId).then((partner) => [chainId, partner.spriteDataUri] as const)
						),
					).then((pairs) => {
						if (id !== currentId) return;
						evolutionSprites = Object.fromEntries(pairs);
					});
				});
			})
			.catch((err) => {
				if (id !== currentId) return;
				error = err instanceof Error ? err.message : String(err);
				loading = false;
				new Notice(`Pokedex: couldn't load #${currentId} (${error})`);
			});
	});

	function retry() {
		retryToken++;
	}

	function genderLabel(rate: number): string {
		if (rate === -1) return "Genderless";
		const femalePct = (rate / 8) * 100;
		return `${100 - femalePct}% male / ${femalePct}% female`;
	}
</script>

<div class="detail-screen">
	<!-- Back-button and the grid both live inside .page so they share the
	same centered max-width box — the grid alone previously got margin:auto
	while this button didn't, so its left edge drifted away from the
	identity column's once the grid was wide enough to center. -->
	<div class="page">
		<button class="back-button" onclick={onBack}>&larr; Back to list</button>

		{#if loading}
			<p>Loading #{String(id).padStart(3, "0")}...</p>
		{:else if error && !entry}
			<p class="error">Couldn't load this Pokemon: {error}</p>
			<button onclick={retry}>Retry</button>
		{:else if entry}
			<!-- container-type (not a viewport media query) because this is an
			Obsidian pane: it can be a narrow sidebar in a wide window or fill a
			whole ultrawide window, independent of the window's own size. Three
			columns on a wide pane — identity | evolution/stats/abilities/breeding
			| moves — collapsing to a single stacked column (same DOM order) on a
			narrow one. -->
			<div class="detail-grid" style:--accent={accentColor}>
				<aside class="identity-col">
				<div class="portrait-panel">
					<img
						src={(spriteStyle === "official-artwork" ? entry.artworkDataUri : entry.spriteDataUri) ?? entry.spriteDataUri ?? ""}
						alt={entry.name}
						class="portrait-image"
					/>
				</div>

				<div class="name-block">
					<p class="dex-eyebrow">No. {String(entry.id).padStart(3, "0")}</p>
					<h2 class="mon-name">{entry.name}</h2>
				</div>
				<div class="type-row">
					{#each entry.types as type (type)}
						<TypeBadge {type} useIcon={useTypeIcons} />
					{/each}
				</div>
				{#if entry.flavorText}
					<p class="flavor-text">{entry.flavorText}</p>
				{/if}
				<dl class="physical-readout">
					<div>
						<dt>Height</dt>
						<dd>{(entry.height / 10).toFixed(1)} m</dd>
					</div>
					<div>
						<dt>Weight</dt>
						<dd>{(entry.weight / 10).toFixed(1)} kg</dd>
					</div>
				</dl>
			</aside>

			<div class="core-col">
				{#if entry.evolutionChain}
					<section class="panel">
						<h3 class="section-heading">Evolution</h3>
						<EvolutionTree chain={entry.evolutionChain} {onSelect} sprites={evolutionSprites} />
					</section>
				{/if}

				<section class="panel">
					<h3 class="section-heading">Base stats</h3>
					<StatBars stats={entry.stats} />
				</section>

				<section class="panel">
					<h3 class="section-heading">Abilities</h3>
					<ul class="ability-list">
						{#each entry.abilities as ability (ability.name)}
							<li>{ability.name}{ability.isHidden ? " (hidden)" : ""}</li>
						{/each}
					</ul>
				</section>

				<section class="panel">
					<h3 class="section-heading">Breeding</h3>
					<p class="breeding-line">Egg groups: {entry.eggGroups.join(", ") || "None"}</p>
					<p class="breeding-line">{genderLabel(entry.genderRate)}</p>
					<p class="breeding-line">Hatch counter: {entry.hatchCounter}</p>
				</section>
			</div>

			<div class="moves-col">
				<section class="panel">
					<h3 class="section-heading">Moves (FireRed/LeafGreen/Emerald)</h3>
					{#if entry.moves.length === 0}
						<p class="text-muted">No move data for this version group.</p>
					{:else}
						<table class="move-table">
							<thead>
								<tr><th>Move</th><th>Method</th><th>Level</th></tr>
							</thead>
							<tbody>
								{#each entry.moves as move (move.name + move.learnMethod + move.levelLearnedAt)}
									<tr>
										<td>{move.name}</td>
										<td>{move.learnMethod}</td>
										<td>{move.learnMethod === "level-up" ? move.levelLearnedAt : "-"}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			</div>
		</div>
		{/if}
	</div>
</div>

<style>
	.detail-screen {
		/* Named container so the query below targets this pane's own resized
		width, not the Obsidian window's — a sidebar-docked pane and a
		maximized ultrawide pane both need the right layout independent of
		how big the window itself is. */
		container-name: detail;
		container-type: inline-size;
	}
	.back-button {
		margin-bottom: var(--size-4-3);
	}

	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.identity-col, .core-col, .moves-col {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	@container detail (min-width: 920px) {
		/* Capped and centered on .page (back-button + grid together), not just
		.detail-grid — otherwise only the grid recenters on a wide pane and the
		back-button (which has no such margin) is left behind at the raw
		container edge, so their left edges no longer line up. */
		.page {
			max-width: 1160px;
			margin: 0 auto;
		}
		.detail-grid {
			display: grid;
			/* Fixed identity rail; core and moves split the rest 1.3:1 (core
			getting more room since stat bars/ability text/evolution nodes read
			better with a bit of breathing room than a 3-column move table
			needs). Both fr-based, not a fixed max-width, so the two columns
			always consume exactly the remaining row width — a minmax(min, Npx)
			pair stops growing once each hits its own cap and leaves whatever's
			left unclaimed, which is what stranded ~70px of dead space after the
			moves column instead of it being real, usable margin. */
			grid-template-columns: 240px minmax(300px, 1.3fr) minmax(260px, 1fr);
			align-items: start;
			gap: 24px;
		}
		.identity-col {
			position: sticky;
			top: 0;
		}
	}

	.portrait-panel {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		width: 100%;
		/* Capped (both axes, so it stays square) so a moderately-narrow-but-
		not-yet-3-column pane (identity column at full container width, still
		under the 920px breakpoint) doesn't turn this into a huge square that
		pushes the name/stats far down. The 3-column layout's identity column
		is a fixed 240px anyway, well under this cap. */
		max-width: 260px;
		max-height: 260px;
		align-self: center;
		background:
			radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%),
			var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-l, 12px);
	}
	.portrait-image {
		width: 76%;
		height: 76%;
		object-fit: contain;
		image-rendering: pixelated;
		filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
	}

	.name-block {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-bottom: 8px;
	}
	.dex-eyebrow {
		margin: 0;
		font-family: var(--font-monospace);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.2;
		color: var(--accent);
	}
	.mon-name {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
		font-weight: 700;
		text-transform: capitalize;
		color: var(--text-normal);
	}
	.type-row {
		margin-bottom: 8px;
	}
	.flavor-text {
		margin: 4px 0 12px;
		padding-left: 10px;
		border-left: 2px solid var(--background-modifier-border);
		color: var(--text-muted);
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.physical-readout {
		display: flex;
		gap: 18px;
		margin: 0;
	}
	.physical-readout div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.physical-readout dt {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.physical-readout dd {
		margin: 0;
		font-family: var(--font-monospace);
		font-size: 0.92rem;
		color: var(--text-normal);
	}

	.panel {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		padding: 14px 16px;
	}
	.section-heading {
		margin: 0 0 10px;
		padding-left: 9px;
		border-left: 3px solid var(--accent);
		font-family: var(--font-monospace);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.ability-list {
		text-transform: capitalize;
		margin: 0;
	}
	.breeding-line {
		margin: 0 0 6px;
	}
	.breeding-line:last-child {
		margin-bottom: 0;
	}

	.move-table {
		width: 100%;
		border-collapse: collapse;
	}
	.move-table th, .move-table td {
		text-align: left;
		padding: 2px 8px;
		text-transform: capitalize;
	}
	.move-table tbody tr:nth-child(odd) {
		background: var(--background-primary);
	}

	.error {
		color: var(--text-error);
	}
</style>
