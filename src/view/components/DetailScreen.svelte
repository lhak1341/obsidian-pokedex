<script lang="ts">
	import { Notice } from "obsidian";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexEntry, PluginSettings } from "../../data/types";
	import EvolutionChain from "./EvolutionChain.svelte";
	import StatBars from "./StatBars.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let { repository, id, spriteStyle, onBack, onSelect }: {
		repository: PokedexRepository;
		id: number;
		spriteStyle: PluginSettings["spriteStyle"];
		onBack: () => void;
		onSelect: (id: number) => void;
	} = $props();

	let entry = $state<PokedexEntry | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let retryToken = $state(0);

	$effect(() => {
		const currentId = id;
		void retryToken; // re-run this effect when retry() bumps the token
		loading = true;
		error = null;
		entry = null;
		repository.getEntry(currentId)
			.then((result) => {
				entry = result;
				loading = false;
			})
			.catch((err) => {
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
	<button class="back-button" onclick={onBack}>&larr; Back to list</button>

	{#if loading}
		<p>Loading #{String(id).padStart(3, "0")}...</p>
	{:else if error && !entry}
		<p class="error">Couldn't load this Pokemon: {error}</p>
		<button onclick={retry}>Retry</button>
	{:else if entry}
		<div class="detail-header">
			<img
				src={(spriteStyle === "official-artwork" ? entry.artworkDataUri : entry.spriteDataUri) ?? entry.spriteDataUri ?? ""}
				alt={entry.name}
				class="detail-artwork"
			/>
			<div>
				<h2 class="detail-name">#{String(entry.id).padStart(3, "0")} {entry.name}</h2>
				<div>
					{#each entry.types as type (type)}
						<TypeBadge {type} />
					{/each}
				</div>
				{#if entry.flavorText}
					<p class="flavor-text">{entry.flavorText}</p>
				{/if}
				<p class="physical">
					Height: {(entry.height / 10).toFixed(1)} m &middot; Weight: {(entry.weight / 10).toFixed(1)} kg
				</p>
			</div>
		</div>

		<section>
			<h3 class="section-heading">Base stats</h3>
			<StatBars stats={entry.stats} />
		</section>

		<section>
			<h3 class="section-heading">Abilities</h3>
			<ul class="ability-list">
				{#each entry.abilities as ability (ability.name)}
					<li>{ability.name}{ability.isHidden ? " (hidden)" : ""}</li>
				{/each}
			</ul>
		</section>

		<section>
			<h3 class="section-heading">Breeding</h3>
			<p>Egg groups: {entry.eggGroups.join(", ") || "None"}</p>
			<p>{genderLabel(entry.genderRate)}</p>
			<p>Hatch counter: {entry.hatchCounter}</p>
		</section>

		{#if entry.evolutionChain}
			<section>
				<h3 class="section-heading">Evolution chain</h3>
				<EvolutionChain node={entry.evolutionChain} {onSelect} />
			</section>
		{/if}

		<section>
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

		{#if entry.criesUrl}
			<section>
				<h3 class="section-heading">Cry</h3>
				<audio controls src={entry.criesUrl}></audio>
			</section>
		{/if}
	{/if}
</div>

<style>
	.back-button {
		margin-bottom: var(--size-4-3);
	}
	.detail-header {
		display: flex;
		gap: 20px;
		align-items: flex-start;
		margin-bottom: var(--size-4-4);
		padding: var(--size-4-4);
		background: var(--background-secondary);
		border-radius: var(--radius-m, 8px);
	}
	.detail-artwork {
		width: 160px;
		height: 160px;
		object-fit: contain;
		flex-shrink: 0;
	}
	.detail-name {
		text-transform: capitalize;
		margin: 0 0 6px;
		color: var(--interactive-accent);
	}
	.flavor-text {
		max-width: 480px;
		color: var(--text-muted);
	}
	.physical {
		color: var(--text-muted);
		font-size: 0.9em;
	}
	section {
		margin-bottom: var(--size-4-4);
	}
	.section-heading {
		margin: 0 0 8px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.ability-list {
		text-transform: capitalize;
		margin: 0;
	}
	.move-table {
		width: 100%;
		max-width: 480px;
		border-collapse: collapse;
	}
	.move-table th, .move-table td {
		text-align: left;
		padding: 2px 8px;
		text-transform: capitalize;
	}
	.move-table tbody tr:nth-child(odd) {
		background: var(--background-secondary);
	}
	.error {
		color: var(--text-error);
	}
</style>
