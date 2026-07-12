<script lang="ts">
	import { Notice } from "obsidian";
	import { TYPE_COLORS } from "../../data/constants";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { EvolutionNode, MoveDetail, PokedexEntry, PokedexTableRow, PluginSettings } from "../../data/types";
	import BarRow from "./BarRow.svelte";
	import EvolutionTree from "./EvolutionTree.svelte";
	import Icon from "./Icon.svelte";
	import QuickSearch from "./QuickSearch.svelte";
	import StatBars from "./StatBars.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	// True game ceilings (unlike StatBars' MAX_STAT, not compressed) —
	// catch rate hits 255 for plenty of common early-route Pokemon (Caterpie,
	// Pidgey, Rattata...) and hatch counter hits 120 for every
	// Legendary/Mythical (e.g. Mewtwo), so both are commonly-reached, not
	// rare outliers worth clipping.
	const MAX_CATCH_RATE = 255;
	const MAX_HATCH_COUNTER = 120;

	let { repository, id, rows, spriteStyle, useTypeIcons, onBack, onSelect }: {
		repository: PokedexRepository;
		id: number;
		rows: PokedexTableRow[];
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
	// Reset per-entry (see the id-keyed $effect below) so switching Pokemon
	// never leaves a previous one's shiny toggle silently applied.
	let showShiny = $state(false);

	// Keyed by ability name, NOT reset on id change — abilities repeat
	// heavily across species (e.g. "levitate"), so hovering one already seen
	// on a previous Pokemon this session reuses the cached description
	// instead of refetching (repository.getAbilityDescription also caches,
	// but this avoids even the async round-trip).
	let abilityDescriptions = $state<Record<string, { text: string | null } | { error: true }>>({});
	let hoveredAbility = $state<string | null>(null);
	let abilityPopoverPos = $state<{ top: number; left: number } | null>(null);

	function showAbilityPopover(name: string, target: EventTarget | null) {
		hoveredAbility = name;
		const el = target as HTMLElement;
		const rect = el.getBoundingClientRect();
		// Positioned relative to .detail-screen (position: absolute, not
		// fixed — see its CSS comment for why), so subtract that container's
		// own viewport offset to get coordinates local to it.
		const containerRect = el.closest(".detail-screen")?.getBoundingClientRect();
		abilityPopoverPos = {
			top: rect.bottom - (containerRect?.top ?? 0) + 6,
			left: rect.left - (containerRect?.left ?? 0),
		};
		if (!(name in abilityDescriptions)) {
			repository.getAbilityDescription(name)
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

	const MOVE_METHOD_TABS = [
		{ key: "level-up", label: "Level-Up" },
		{ key: "machine", label: "Machine" },
		{ key: "egg", label: "Egg" },
		{ key: "tutor", label: "Tutor" },
	] as const;

	// Not reset on id change — same reasoning as abilityDescriptions, moves
	// repeat even more heavily across species (nearly everything learns
	// Tackle or Growl), and activeMoveMethod persisting across navigation
	// lets a user stay on e.g. "Machine" while browsing several Pokemon.
	let moveDetails = $state<Record<string, MoveDetail>>({});
	let activeMoveMethod = $state<(typeof MOVE_METHOD_TABS)[number]["key"]>("level-up");

	const basePortraitUri = $derived(
		(spriteStyle === "official-artwork" ? entry?.artworkDataUri : entry?.spriteDataUri) ??
			entry?.spriteDataUri ??
			null,
	);
	// Match the shiny variant to spriteStyle so toggling doesn't jump between
	// art styles (e.g. artwork -> regular-sprite shiny). Falls back to the
	// regular shiny sprite when spriteStyle is "official-artwork" but that
	// particular Pokemon has no shiny artwork render on PokeAPI (rare, but
	// happens) — still a visible shiny swap, just not artwork-styled.
	const shinyPortraitUri = $derived(
		spriteStyle === "official-artwork"
			? entry?.shinyArtworkDataUri ?? entry?.shinyDataUri ?? null
			: entry?.shinyDataUri ?? null,
	);
	const portraitUri = $derived(showShiny ? shinyPortraitUri ?? basePortraitUri : basePortraitUri);

	// genderRate is eighths-female (0 = always male, 8 = always female);
	// -1 means genderless. Eighths of 100 (12.5, 37.5, ...) are exact in
	// binary floating point, so no rounding needed for display.
	const femalePct = $derived(
		entry && entry.genderRate >= 0 ? (entry.genderRate / 8) * 100 : null,
	);
	const malePct = $derived(femalePct === null ? null : 100 - femalePct);

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

	const filteredMoves = $derived(
		entry?.moves.filter((m) => m.learnMethod === activeMoveMethod) ?? [],
	);

	$effect(() => {
		const currentId = id;
		void retryToken; // re-run this effect when retry() bumps the token
		loading = true;
		error = null;
		entry = null;
		evolutionSprites = {};
		showShiny = false;
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
				repository.getMoveDetailsForMoves(
					core.moves.map((m) => m.name),
					(name, detail) => {
						moveDetails = { ...moveDetails, [name]: detail };
					},
				);
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
</script>

<div class="detail-screen">
	<!-- Back-button and the grid both live inside .page so they share the
	same centered max-width box — the grid alone previously got margin:auto
	while this button didn't, so its left edge drifted away from the
	identity column's once the grid was wide enough to center. -->
	<div class="page">
		<div class="detail-header">
			<button class="back-button" onclick={onBack}>&larr; Back to list</button>
			<QuickSearch {rows} {onSelect} />
		</div>

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
					<img src={portraitUri ?? ""} alt={entry.name} class="portrait-image" />
					{#if entry.shinyDataUri || entry.shinyArtworkDataUri}
						<button
							class="shiny-toggle"
							class:active={showShiny}
							onclick={() => (showShiny = !showShiny)}
							aria-label={showShiny ? "Show normal sprite" : "Show shiny sprite"}
							title={showShiny ? "Show normal sprite" : "Show shiny sprite"}
						>
							<Icon name="sparkles" size={15} strokeWidth={2.25} />
						</button>
					{/if}
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
							<li
								onmouseenter={(e) => showAbilityPopover(ability.name, e.currentTarget)}
								onmouseleave={hideAbilityPopover}
							>
								{ability.name}{ability.isHidden ? " (hidden)" : ""}
							</li>
						{/each}
					</ul>
				</section>

				{#if hoveredAbility && abilityPopoverPos}
					{@const state = abilityDescriptions[hoveredAbility]}
					<div
						class="ability-popover"
						style="top: {abilityPopoverPos.top}px; left: {abilityPopoverPos.left}px;"
					>
						{#if !state}
							Loading…
						{:else if "error" in state}
							Couldn't load description.
						{:else}
							{state.text ?? "No description available."}
						{/if}
					</div>
				{/if}

				<section class="panel">
					<h3 class="section-heading">Breeding & Capture</h3>
					<p class="breeding-line">Egg groups: {entry.eggGroups.join(", ") || "None"}</p>
					{#if malePct === null || femalePct === null}
						<p class="breeding-line">Genderless</p>
					{:else}
						<div class="gender-bar">
							<div class="gender-fill-male" style:width="{malePct}%"></div>
							<div class="gender-fill-female" style:width="{femalePct}%"></div>
						</div>
						<div class="gender-labels">
							<span class="gender-male">
								<Icon name="mars" size={13} strokeWidth={2.5} />
								{malePct}%
							</span>
							<span class="gender-female">
								{femalePct}%
								<Icon name="venus" size={13} strokeWidth={2.5} />
							</span>
						</div>
					{/if}
					<div class="breeding-bars">
						<BarRow label="Hatch counter" value={entry.hatchCounter} max={MAX_HATCH_COUNTER} />
						<BarRow label="Catch rate" value={entry.catchRate} max={MAX_CATCH_RATE} />
					</div>
				</section>
			</div>

			<div class="moves-col">
				<section class="panel">
					<h3 class="section-heading">Moves (Gen 3)</h3>
					{#if entry.moves.length === 0}
						<p class="text-muted">No move data for this version group.</p>
					{:else}
						<div class="move-tabs">
							{#each MOVE_METHOD_TABS as tab (tab.key)}
								<button
									type="button"
									class="move-tab"
									class:active={activeMoveMethod === tab.key}
									onclick={() => (activeMoveMethod = tab.key)}
								>
									{tab.label}
								</button>
							{/each}
						</div>
						{#if filteredMoves.length === 0}
							<p class="text-muted">
								No moves learned via {MOVE_METHOD_TABS.find((t) => t.key === activeMoveMethod)?.label}.
							</p>
						{:else}
							<table class="move-table">
								<thead>
									<tr>
										<th>Move</th>
										{#if activeMoveMethod === "level-up"}<th>Level</th>{/if}
										<th>Type</th>
										<th>Power</th>
										<th>Acc.</th>
										<th>PP</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredMoves as move (move.name + move.levelLearnedAt)}
										{@const detail = moveDetails[move.name]}
										<tr>
											<td>{move.name}</td>
											{#if activeMoveMethod === "level-up"}<td>{move.levelLearnedAt}</td>{/if}
											<td>
												{#if detail}
													<TypeBadge type={detail.type} useIcon={useTypeIcons} />
												{:else}
													…
												{/if}
											</td>
											<td>{detail ? (detail.power ?? "-") : "…"}</td>
											<td>{detail ? (detail.accuracy ?? "-") : "…"}</td>
											<td>{detail ? detail.pp : "…"}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
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
		/* Also the ability-popover's positioning root (see .ability-popover):
		Obsidian's .workspace-leaf has `contain: strict`, which (like a
		transform) makes it the containing block for any `position: fixed`
		descendant — so a fixed popover positioned from a viewport-relative
		getBoundingClientRect() lands ~40px off (the tab-bar's height). A
		`position: relative` ancestor we control sidesteps that entirely. */
		position: relative;
	}
	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
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
	.shiny-toggle {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: auto;
		padding: 5px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s, 6px);
		color: var(--text-muted);
		cursor: pointer;
		box-shadow: var(--shadow-s);
	}
	.shiny-toggle:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.shiny-toggle.active {
		color: var(--color-yellow, gold);
		border-color: var(--color-yellow, gold);
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
		/* Default UA/theme bullet indent is 40px — way out of proportion for
		this compact panel (every other line here sits flush left). 18px
		keeps the bullet marker but tightens the indent to match. */
		padding-left: 18px;
	}
	.ability-list li {
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
	.breeding-line {
		margin: 0 0 6px;
	}
	.gender-bar {
		display: flex;
		height: 8px;
		border-radius: 4px;
		overflow: hidden;
		background: var(--background-modifier-border);
	}
	.gender-fill-male {
		background: #4a90d9;
	}
	.gender-fill-female {
		background: #e0609e;
	}
	.gender-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.85em;
		margin-top: 4px;
		margin-bottom: 6px;
	}
	.gender-male,
	.gender-female {
		display: flex;
		align-items: center;
		gap: 3px;
		font-family: var(--font-monospace);
	}
	.gender-male {
		color: #4a90d9;
	}
	.gender-female {
		color: #e0609e;
	}
	.breeding-bars {
		display: grid;
		grid-template-columns: auto 34px 1fr;
		align-items: center;
		row-gap: 4px;
		column-gap: 6px;
		margin-top: 10px;
	}

	.move-tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 10px;
	}
	/* Same chip look as FilterBar's type/generation chips — kept visually
	consistent rather than inventing a separate segmented-control style. */
	.move-tab {
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		height: auto;
		padding: 2px 8px;
		cursor: pointer;
		font-size: 0.85em;
		opacity: 0.6;
		transition: opacity 100ms ease-out, border-color 100ms ease-out;
	}
	.move-tab:hover {
		opacity: 0.85;
	}
	.move-tab.active {
		opacity: 1;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 1px var(--interactive-accent);
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
