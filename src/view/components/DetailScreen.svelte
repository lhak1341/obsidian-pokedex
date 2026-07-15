<script lang="ts">
	import { Notice } from "obsidian";
	import { onDestroy } from "svelte";
	import { TYPE_COLORS } from "../../data/constants";
	import { nextEvolutionLevels } from "../../data/normalize";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { MoveDetail, PokedexEntry, PokedexTableRow, PluginSettings } from "../../data/types";
	import AbilitiesPanel from "./AbilitiesPanel.svelte";
	import BarRow from "./BarRow.svelte";
	import { DetailLoadState } from "../DetailLoadState";
	import { mirrorInto } from "../../utils/mirrorState";
	import EvolutionTree from "./EvolutionTree.svelte";
	import FlavorTextPanel from "./FlavorTextPanel.svelte";
	import Icon from "./Icon.svelte";
	import MoveBrowser from "./MoveBrowser.svelte";
	import QuickSearch from "./QuickSearch.svelte";
	import StatBars from "./StatBars.svelte";
	import TypeBadge from "./TypeBadge.svelte";
	import { resolveStatsForGen } from "../../utils/stats";
	import { formatItemName } from "../../utils/tableColumns";

	// True game ceilings (unlike StatBars' MAX_STAT, not compressed) —
	// catch rate hits 255 for plenty of common early-route Pokemon (Caterpie,
	// Pidgey, Rattata...) and hatch counter hits 120 for every
	// Legendary/Mythical (e.g. Mewtwo), so both are commonly-reached, not
	// rare outliers worth clipping.
	const MAX_CATCH_RATE = 255;
	const MAX_HATCH_COUNTER = 120;

	let { repository, id, rows, spriteStyle, useTypeIcons, activeGen, onBack, onSelect }: {
		repository: PokedexRepository;
		id: number;
		rows: PokedexTableRow[];
		spriteStyle: PluginSettings["spriteStyle"];
		useTypeIcons: boolean;
		activeGen: number;
		onBack: () => void;
		onSelect: (id: number) => void;
	} = $props();

	// DetailLoadState is a plain, non-reactive class (tested with plain
	// vitest, see DetailLoadState.test.ts) — Svelte 5's $state only
	// deep-proxies plain objects/arrays, not class instances, so mutations
	// to its fields wouldn't be visible to the template. entryLoad is the
	// reactive boundary instead, mirrored wholesale from DetailLoadState's
	// onUpdate callback via mirrorInto (see PokedexApp.svelte for the same
	// pattern applied to the browse table's load state).
	// $derived (not a plain const) so Svelte doesn't warn about capturing the
	// `repository` prop outside a reactive scope — it never actually changes
	// across this component's lifetime (see PokedexApp's template, which
	// remounts DetailScreen only via `selectedId`/`screen`, never a new
	// `repository`), so this evaluates exactly once in practice.
	const loadState = $derived(new DetailLoadState(repository));
	onDestroy(() => loadState.cancel());

	// Keyed by dex id, filled in once the evolution chain arrives. Every id
	// in a chain was already fetched for the table load that got the user
	// here, so this resolves from mem cache — not a second round of real
	// network requests.
	let entryLoad = $state<{
		entry: PokedexEntry | null;
		loading: boolean;
		error: string | null;
		evolutionSprites: Record<number, string | null>;
		evolutionTypes: Record<number, string[]>;
	}>({
		entry: null,
		loading: true,
		error: null,
		evolutionSprites: {},
		evolutionTypes: {},
	});
	// Re-mirrors every DetailLoadState field wholesale via mirrorInto — cheap
	// (a handful of small objects), and simpler than a dedicated callback per
	// field since these fields only ever change at 2-3 discrete points per
	// load rather than streaming (unlike moveDetails, which gets its own
	// callback in startLoad below).
	const entryLoadKeys = ["entry", "loading", "error", "evolutionSprites", "evolutionTypes"] as const;
	function mirror() {
		mirrorInto(entryLoad, loadState, entryLoadKeys);
	}

	// Reset per-entry (see startLoad below) so switching Pokemon never
	// leaves a previous one's shiny toggle silently applied.
	let showShiny = $state(false);

	// Not reset on id change — moves repeat heavily across species (nearly
	// everything learns Tackle or Growl), so this accumulates across every
	// entry viewed this session rather than discarding what's already been
	// fetched each time `id` changes. Fed by startLoad's onMoveDetail
	// callback below (streaming, one move at a time — not part of
	// entryLoad's wholesale mirror, see mirror()/entryLoadKeys above), and
	// passed down to MoveBrowser as a read-only snapshot; MoveBrowser owns
	// its own tab-selection state but never triggers a fetch itself, since
	// DetailLoadState.load() already fetches the whole movepool up front.
	let moveDetails = $state<Record<string, MoveDetail>>({});

	const basePortraitUri = $derived(
		(spriteStyle === "official-artwork" ? entryLoad.entry?.artworkDataUri : entryLoad.entry?.spriteDataUri) ??
			entryLoad.entry?.spriteDataUri ??
			null,
	);
	// Match the shiny variant to spriteStyle so toggling doesn't jump between
	// art styles (e.g. artwork -> regular-sprite shiny). Falls back to the
	// regular shiny sprite when spriteStyle is "official-artwork" but that
	// particular Pokemon has no shiny artwork render on PokeAPI (rare, but
	// happens) — still a visible shiny swap, just not artwork-styled.
	const shinyPortraitUri = $derived(
		spriteStyle === "official-artwork"
			? entryLoad.entry?.shinyArtworkDataUri ?? entryLoad.entry?.shinyDataUri ?? null
			: entryLoad.entry?.shinyDataUri ?? null,
	);
	const portraitUri = $derived(showShiny ? shinyPortraitUri ?? basePortraitUri : basePortraitUri);

	// genderRate is eighths-female (0 = always male, 8 = always female);
	// -1 means genderless. Eighths of 100 (12.5, 37.5, ...) are exact in
	// binary floating point, so no rounding needed for display.
	const femalePct = $derived(
		entryLoad.entry && entryLoad.entry.genderRate >= 0 ? (entryLoad.entry.genderRate / 8) * 100 : null,
	);
	const malePct = $derived(femalePct === null ? null : 100 - femalePct);

	// Every entry gets its own accent, drawn from its primary type's existing
	// badge color (see TypeBadge/constants.ts) rather than one fixed brand
	// color — the identity column is themed per-Pokemon, not per-plugin. Only
	// ever used decoratively (glow, accent rule, eyebrow) — never as body
	// text color — so it can't create a contrast problem in a theme it
	// happens to clash with.
	const accentColor = $derived(TYPE_COLORS[entryLoad.entry?.types[0] ?? ""] ?? "var(--interactive-accent)");

	// Level(s) at which the CURRENTLY VIEWED entry itself next evolves — not
	// the chain root's own level, see nextEvolutionLevels. Empty for a
	// final-stage member or one whose next evolution is item/trade-driven
	// (no level threshold to show).
	const evolvesAtLevels = $derived(
		entryLoad.entry?.evolutionChain
			? nextEvolutionLevels(entryLoad.entry.evolutionChain, entryLoad.entry.id)
			: [],
	);

	function startLoad(currentId: number) {
		showShiny = false;
		const result = loadState.load(currentId, mirror, (name, moveDetail) => {
			moveDetails = { ...moveDetails, [name]: moveDetail };
		});
		// The synchronous prefix of load() (up to its first await) has
		// already run by the time it returns a pending promise, so this
		// captures the "loading, nothing rendered yet" reset immediately
		// rather than waiting a tick.
		mirror();
		// `id !== currentId` guards against a stale response landing after
		// the user has since clicked through to another entry (e.g. from
		// the evolution chain) before this one settled — load() itself
		// never rejects, it records failure on `error` instead.
		result.then(() => {
			if (id !== currentId || loadState.cancelled || !loadState.error) return;
			new Notice(`Pokedex: couldn't load #${currentId} (${loadState.error})`);
		});
	}

	$effect(() => {
		startLoad(id);
	});

	function retry() {
		startLoad(id);
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

		{#if entryLoad.loading}
			<p>Loading #{String(id).padStart(3, "0")}...</p>
		{:else if entryLoad.error && !entryLoad.entry}
			<p class="error">Couldn't load this Pokemon: {entryLoad.error}</p>
			<button onclick={retry}>Retry</button>
		{:else if entryLoad.entry}
			{@const entry = entryLoad.entry}
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
					<div class="type-row">
						{#each entry.types as type (type)}
							<TypeBadge {type} useIcon={useTypeIcons} />
						{/each}
					</div>
				</div>
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
				<FlavorTextPanel flavorTexts={entry.flavorTexts} {activeGen} />
			</aside>

			<div class="core-col">
				{#if entry.evolutionChain}
					<section class="panel">
						<h3 class="section-heading">Evolution</h3>
						<EvolutionTree
						chain={entry.evolutionChain}
						{onSelect}
						sprites={entryLoad.evolutionSprites}
						types={entryLoad.evolutionTypes}
						{useTypeIcons}
					/>
					</section>
				{/if}

				<div class="stats-abilities-row">
					<section class="panel stats-panel">
						<h3 class="section-heading">Base stats</h3>
						<StatBars stats={resolveStatsForGen(entry.stats, entry.id, activeGen)} />
					</section>

					<section class="panel abilities-panel">
						<h3 class="section-heading">Abilities</h3>
						<AbilitiesPanel
							abilities={entry.abilities}
							getDescription={(name) => repository.getAbilityDescription(name)}
						/>
					</section>
				</div>

				<section class="panel">
					<h3 class="section-heading">Breeding & Capture</h3>
					<p class="breeding-line">Egg groups: {entry.eggGroups.join(", ") || "None"}</p>
					{#if entry.heldItems.length > 0}
						<p class="breeding-line">
							Wild held item:
							{entry.heldItems.map((h) => `${formatItemName(h.name)} (${h.rarities.join("/")}%)`).join(", ")}
						</p>
					{/if}
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
					<MoveBrowser moves={entry.moves} {moveDetails} {useTypeIcons} {evolvesAtLevels} {activeGen} />
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
	.stats-abilities-row {
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
			/* Fixed identity rail; core and moves split the rest 1.15:1.15 —
			was 1.3:1 (core getting more room since stat bars/ability text/
			evolution nodes read better with breathing room than a 3-column
			move table needs), narrowed toward moves so its 6-column table has
			more room. Both fr-based, not a fixed max-width, so the two
			columns always consume exactly the remaining row width — a
			minmax(min, Npx) pair stops growing once each hits its own cap and
			leaves whatever's left unclaimed, which is what stranded ~70px of
			dead space after the moves column instead of it being real,
			usable margin. */
			grid-template-columns: 240px minmax(300px, 1.15fr) minmax(260px, 1.15fr);
			align-items: start;
			gap: 24px;
		}
		.identity-col {
			position: sticky;
			top: 0;
		}
	}

	/* Separate, higher breakpoint than the 920px 3-column switch above —
	core-col is only ~357px wide right at 920px (920 - 240px identity rail -
	48px gaps, split 1.3:1 with moves-col), too cramped to fit stat bars and
	the ability list side by side without wrapping. Row layout waits for
	genuine breathing room instead of triggering right at the column split. */
	@container detail (min-width: 1100px) {
		.stats-abilities-row {
			flex-direction: row;
		}
		.stats-panel, .abilities-panel {
			flex: 1;
			min-width: 0;
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
		/* A bit more separation than the number/name lines share (their 3px
		.name-block gap already applies here too, as the third child) — enough
		to read as its own line, not run together with the name. */
		margin-top: 5px;
	}
	.physical-readout {
		/* Two equal columns (not flex + gap) so Weight's box always starts
		exactly at the column's halfway point, independent of how wide
		Height's own value happens to render. */
		display: grid;
		grid-template-columns: 1fr 1fr;
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

	.error {
		color: var(--text-error);
	}
</style>
