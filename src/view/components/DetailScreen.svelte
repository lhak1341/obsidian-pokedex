<script lang="ts">
	import { Notice } from "obsidian";
	import { onDestroy } from "svelte";
	import { FLAVOR_TEXT_TABS, TYPE_COLORS } from "../../data/constants";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { MoveDetail, PokedexEntry, PokedexTableRow, PluginSettings } from "../../data/types";
	import BarRow from "./BarRow.svelte";
	import { DetailLoadState } from "../DetailLoadState";
	import { relativeRect } from "../domPosition";
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

	// DetailLoadState is a plain, non-reactive class (tested with plain
	// vitest, see DetailLoadState.test.ts) — Svelte 5's $state only
	// deep-proxies plain objects/arrays, not class instances, so mutations
	// to its fields wouldn't be visible to the template. These $state
	// primitives are the reactive boundary instead, mirrored from its
	// onUpdate/onMoveDetail callbacks (see PokedexApp.svelte for the same
	// pattern applied to the browse table's load state).
	// $derived (not a plain const) so Svelte doesn't warn about capturing the
	// `repository` prop outside a reactive scope — it never actually changes
	// across this component's lifetime (see PokedexApp's template, which
	// remounts DetailScreen only via `selectedId`/`screen`, never a new
	// `repository`), so this evaluates exactly once in practice.
	const loadState = $derived(new DetailLoadState(repository));
	onDestroy(() => loadState.cancel());

	let entry = $state<PokedexEntry | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	// Keyed by dex id, filled in once the evolution chain arrives. Every id
	// in a chain was already fetched for the table load that got the user
	// here, so this resolves from mem cache — not a second round of real
	// network requests.
	let evolutionSprites = $state<Record<number, string | null>>({});
	let evolutionTypes = $state<Record<number, string[]>>({});
	// Reset per-entry (see startLoad below) so switching Pokemon never
	// leaves a previous one's shiny toggle silently applied.
	let showShiny = $state(false);
	// Not reset on id change, same reasoning as activeMoveMethod below —
	// stays on e.g. "Emerald" while browsing several Pokemon. Falls back to
	// the first tab this entry actually has data for (see flavorTabs) if the
	// remembered key isn't among them, so this never needs a null case.
	let activeFlavorVersion = $state<string>(FLAVOR_TEXT_TABS[0].key);

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
		// Positioned relative to .detail-screen (position: absolute, not
		// fixed — see its CSS comment for why), not the raw viewport rect.
		const r = relativeRect(target as HTMLElement, ".detail-screen");
		abilityPopoverPos = { top: r.bottom + 6, left: r.left };
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

	// FRLG and Emerald sometimes teach the same move at different levels
	// (e.g. a different level-up curve) — normalizeMoves keeps both rows
	// since they're genuinely distinct data, which reads as a duplicate in
	// the table. This toggle scopes the list to one game at a time instead.
	const MOVE_VERSION_TABS = [
		{ key: "firered-leafgreen", label: "FRLG" },
		{ key: "emerald", label: "RSE" },
	] as const;

	// Not reset on id change — same reasoning as abilityDescriptions, moves
	// repeat even more heavily across species (nearly everything learns
	// Tackle or Growl), and activeMoveMethod persisting across navigation
	// lets a user stay on e.g. "Machine" while browsing several Pokemon.
	let moveDetails = $state<Record<string, MoveDetail>>({});
	let activeMoveMethod = $state<(typeof MOVE_METHOD_TABS)[number]["key"]>("level-up");
	let activeMoveVersion =
		$state<(typeof MOVE_VERSION_TABS)[number]["key"]>("firered-leafgreen");

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

	// Every entry gets its own accent, drawn from its primary type's existing
	// badge color (see TypeBadge/constants.ts) rather than one fixed brand
	// color — the identity column is themed per-Pokemon, not per-plugin. Only
	// ever used decoratively (glow, accent rule, eyebrow) — never as body
	// text color — so it can't create a contrast problem in a theme it
	// happens to clash with.
	const accentColor = $derived(TYPE_COLORS[entry?.types[0] ?? ""] ?? "var(--interactive-accent)");

	const filteredMoves = $derived(
		entry?.moves.filter(
			(m) => m.learnMethod === activeMoveMethod && m.versionGroup === activeMoveVersion,
		) ?? [],
	);

	// Only tabs this species actually has flavor text for (every Gen 1-3 dex
	// entry has all four in practice — see FLAVOR_TEXT_TABS — but a cache
	// written before a tab existed can still be missing one until the user
	// clears the cache, see PokedexRepository.getOrFetchSpecies).
	const flavorTabs = $derived(
		entry ? FLAVOR_TEXT_TABS.filter((tab) => entry.flavorTexts[tab.key]) : [],
	);
	const activeFlavorIndex = $derived(
		Math.max(0, flavorTabs.findIndex((tab) => tab.key === activeFlavorVersion)),
	);
	const currentFlavorTab = $derived(flavorTabs[activeFlavorIndex] ?? null);
	const currentFlavorText = $derived(
		currentFlavorTab ? entry?.flavorTexts[currentFlavorTab.key] ?? null : null,
	);

	function cycleFlavorVersion(direction: 1 | -1) {
		if (flavorTabs.length === 0) return;
		const nextIndex = (activeFlavorIndex + direction + flavorTabs.length) % flavorTabs.length;
		activeFlavorVersion = flavorTabs[nextIndex].key;
	}

	// Re-mirrors every DetailLoadState field wholesale — cheap (a handful of
	// small objects), and simpler than a dedicated callback per field since
	// entry/loading/error/evolutionSprites only ever change at 2-3 discrete
	// points per load rather than streaming (unlike moveDetails, which gets
	// its own callback below).
	function mirror() {
		entry = loadState.entry;
		loading = loadState.loading;
		error = loadState.error;
		evolutionSprites = loadState.evolutionSprites;
		evolutionTypes = loadState.evolutionTypes;
	}

	function startLoad(currentId: number) {
		showShiny = false;
		const result = loadState.load(currentId, mirror, (name, detail) => {
			moveDetails = { ...moveDetails, [name]: detail };
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
				{#if currentFlavorText}
					<div class="flavor-block">
						<div class="flavor-version-toggle">
							<button
								type="button"
								class="flavor-version-arrow"
								onclick={() => cycleFlavorVersion(-1)}
								disabled={flavorTabs.length < 2}
								aria-label="Previous game version"
							>
								<Icon name="chevron-left" size={12} strokeWidth={2.5} />
							</button>
							<span class="flavor-version-label">{currentFlavorTab?.label}</span>
							<button
								type="button"
								class="flavor-version-arrow"
								onclick={() => cycleFlavorVersion(1)}
								disabled={flavorTabs.length < 2}
								aria-label="Next game version"
							>
								<Icon name="chevron-right" size={12} strokeWidth={2.5} />
							</button>
						</div>
						<p class="flavor-text">{currentFlavorText}</p>
					</div>
				{/if}
			</aside>

			<div class="core-col">
				{#if entry.evolutionChain}
					<section class="panel">
						<h3 class="section-heading">Evolution</h3>
						<EvolutionTree
						chain={entry.evolutionChain}
						{onSelect}
						sprites={evolutionSprites}
						types={evolutionTypes}
						{useTypeIcons}
					/>
					</section>
				{/if}

				<div class="stats-abilities-row">
					<section class="panel stats-panel">
						<h3 class="section-heading">Base stats</h3>
						<StatBars stats={entry.stats} />
					</section>

					<section class="panel abilities-panel">
						<h3 class="section-heading">Abilities</h3>
						<ul class="ability-list">
							{#each entry.abilities.filter((a) => !a.isHidden) as ability (ability.name)}
								<li
									onmouseenter={(e) => showAbilityPopover(ability.name, e.currentTarget)}
									onmouseleave={hideAbilityPopover}
								>
									{ability.name}
								</li>
							{/each}
						</ul>
						{#each entry.abilities.filter((a) => a.isHidden) as ability (ability.name)}
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
					</section>
				</div>

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
					<div class="moves-heading-row">
						<h3 class="section-heading">Moves (Gen 3)</h3>
						<div class="move-tabs move-version-tabs">
							{#each MOVE_VERSION_TABS as tab (tab.key)}
								<button
									type="button"
									class="move-tab"
									class:active={activeMoveVersion === tab.key}
									onclick={() => (activeMoveVersion = tab.key)}
								>
									{tab.label}
								</button>
							{/each}
						</div>
					</div>
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
										{#if activeMoveMethod === "level-up"}<th class="col-right">Level</th>{/if}
										<th class="col-center">Type</th>
										<th class="col-right">Pow</th>
										<th class="col-right">Acc</th>
										<th class="col-right">PP</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredMoves as move (move.name + move.levelLearnedAt)}
										{@const detail = moveDetails[move.name]}
										<tr>
											<td>{move.name}</td>
											{#if activeMoveMethod === "level-up"}<td class="col-right">{move.levelLearnedAt}</td>{/if}
											<td class="col-center">
												{#if detail}
													<TypeBadge type={detail.type} useIcon={useTypeIcons} />
												{:else}
													…
												{/if}
											</td>
											<td class="col-right">{detail ? (detail.power ?? "-") : "…"}</td>
											<td class="col-right">{detail ? (detail.accuracy ?? "-") : "…"}</td>
											<td class="col-right">{detail ? detail.pp : "…"}</td>
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
	/* Toggle + description grouped in their own tight column so they read as
	one unit, independent of identity-col's larger 20px rhythm between major
	blocks (portrait / name / height-weight / description). */
	.flavor-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.flavor-text {
		margin: 0;
		padding-left: 10px;
		border-left: 2px solid var(--background-modifier-border);
		color: var(--text-muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}
	/* Spans the identity column's full width, like a carousel control —
	arrows pinned to the edges, label centered between them. Text styling
	matches BarRow's .bar-label (the HP/Atk/... stat labels) rather than
	inventing a new one, since this plays the same "small muted caption"
	role. */
	.flavor-version-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.flavor-version-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: auto;
		height: auto;
		padding: 2px;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		opacity: 0.7;
		transition: opacity 100ms ease-out;
	}
	.flavor-version-arrow:hover:not(:disabled) {
		opacity: 1;
	}
	.flavor-version-arrow:disabled {
		visibility: hidden;
	}
	.flavor-version-label {
		flex: 1;
		text-align: center;
		font-weight: 600;
		color: var(--text-muted);
		font-size: 0.85em;
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
	/* Same label/value pairing as .physical-readout's HEIGHT/WEIGHT (small
	uppercase muted label over a value), not an inline "(hidden)" suffix —
	the hidden ability is a distinct fact worth its own visual slot, same
	reasoning that gave height/weight one. */
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

	.moves-heading-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
	}
	/* section-heading's own margin-bottom (used everywhere else it's a
	standalone block) would offset it from center against the version
	toggle's margin-less box here — zero it out and let the row's own
	margin-bottom carry the spacing instead. */
	.moves-heading-row .section-heading {
		margin-bottom: 0;
	}
	/* Segmented-pill control, matching obsidian-calendar-notes'
	GranularitySection tab bar (Daily/Weekly/.../Yearly) rather than the
	outlined-chip look FilterBar uses elsewhere in this plugin — moves' two
	tab rows read as one linked control, closer to a granularity switch than
	a set of independent filter chips. */
	.move-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		margin-bottom: 10px;
		background: var(--background-primary-alt);
		border: 1px solid var(--background-modifier-border);
		border-radius: 10px;
	}
	/* Compact, content-width variant for the FRLG/RSE game toggle — sits in
	the section heading's corner rather than stretching like the method
	tabs below it. */
	.move-version-tabs {
		display: inline-flex;
		margin-bottom: 0;
	}
	.move-version-tabs .move-tab {
		flex: none;
		padding: 4px 10px;
	}
	.move-tab {
		flex: 1;
		background: transparent;
		border: none;
		border-radius: 7px;
		height: auto;
		padding: 6px 4px;
		cursor: pointer;
		font-size: 0.85em;
		font-weight: 500;
		color: var(--text-normal);
		transition: background 100ms ease-out, color 100ms ease-out;
	}
	.move-tab:hover:not(.active) {
		background: var(--background-modifier-hover);
	}
	.move-tab.active {
		background: var(--background-primary);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
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
	.move-table th.col-right, .move-table td.col-right {
		text-align: right;
	}
	.move-table th.col-center, .move-table td.col-center {
		text-align: center;
	}
	.move-table tbody tr:nth-child(odd) {
		background: var(--background-primary);
	}

	.error {
		color: var(--text-error);
	}
</style>
