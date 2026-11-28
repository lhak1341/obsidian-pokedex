<script lang="ts">
	import { Notice } from "obsidian";
	import { getContext, onDestroy, onMount, untrack } from "svelte";
	import { TYPE_COLORS } from "../../data/constants";
	import { getAdjacentDexEntries } from "../../utils/dexNav";
	import { nextEvolutionLevels } from "../../data/normalize";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { MoveDetail, PokedexTableRow, PluginSettings } from "../../data/types";
	import AbilitiesPanel from "./AbilitiesPanel.svelte";
	import EvChips from "./EvChips.svelte";
	import FavoriteToggle from "./FavoriteToggle.svelte";
	import { DetailLoadState, type DetailEntrySnapshot } from "../DetailLoadState";
	import { computeSideAnchoredPreviewPosition, provideScreenRoot } from "../domPosition";
	import { LEAF_COMMANDS_CONTEXT, type LeafCommandRegistry } from "../LeafCommandRegistry";
	import { contentScale } from "../imageBounds";
	import { getScroller } from "../viewportWatch";
	import EvolutionTree from "./EvolutionTree.svelte";
	import FlavorTextPanel from "./FlavorTextPanel.svelte";
	import HeldItemsPanel from "./HeldItemsPanel.svelte";
	import Icon from "./Icon.svelte";
	import MoveBrowser from "./MoveBrowser.svelte";
	import PortraitPanel from "./PortraitPanel.svelte";
	import QuickSearch from "./QuickSearch.svelte";
	import GenderRing from "./GenderRing.svelte";
	import Ring from "./Ring.svelte";
	import RegionalFormNav from "./RegionalFormNav.svelte";
	import StatBars from "./StatBars.svelte";
	import TypeBadge from "./TypeBadge.svelte";
	import { describeEncounters } from "../../utils/encounters";
	import { resolvePortrait } from "../../utils/portrait";
	import { portraitRenderFor } from "../../data/imageSet";
	import { scopeToActiveGen } from "../../utils/activeGenScope";
	import { formatDexNumber, formatHeight, formatPokemonDisplayName, formatWeight } from "../../utils/pokemonDisplay";
	import { romanNumeral } from "../../utils/romanNumeral";
	import { shownDetailTab, tabsForBand, type DetailBand, type DetailTab } from "../../utils/detailBand";
	import { VarietyToggleState, type VarietyToggleSnapshot } from "../VarietyToggleState";

	// True game ceilings (unlike StatBars' MAX_STAT, not compressed) —
	// catch rate hits 255 for plenty of common early-route Pokemon (Caterpie,
	// Pidgey, Rattata...) and hatch counter hits 120 for every
	// Legendary/Mythical (e.g. Mewtwo), so both are commonly-reached, not
	// rare outliers worth clipping.
	const MAX_CATCH_RATE = 255;
	const MAX_HATCH_COUNTER = 120;

	let {
		repository, id, rows, spriteStyle, useTypeIcons, activeGen, band, isFavorite, onToggleFavorite, onBack, onSelect,
	}: {
		repository: PokedexRepository;
		id: number;
		rows: PokedexTableRow[];
		spriteStyle: PluginSettings["spriteStyle"];
		useTypeIcons: boolean;
		activeGen: number;
		// From the leaf width (PokedexApp's ResizeObserver, the same leaf the
		// `pane` container queries read): the phone tabs below 760px (#32), the
		// identity rail to 1100px (#33), three columns from there.
		band: DetailBand;
		isFavorite: boolean;
		onToggleFavorite: (id: number) => void;
		onBack: () => void;
		onSelect: (id: number) => void;
	} = $props();

	// DetailLoadState is a plain, non-reactive class (tested with plain
	// vitest, see DetailLoadState.test.ts) — Svelte 5's $state only
	// deep-proxies plain objects/arrays, not class instances, so mutations
	// to its fields wouldn't be visible to the template. entryLoad is the
	// reactive boundary instead, reassigned wholesale from loadState.snapshot()
	// on every onUpdate callback. PokedexLoadState (the browse table's
	// equivalent, see PokedexApp.svelte) uses the same shape: its onUpdate
	// callback carries a snapshot() that PokedexApp assigns into one $state.
	// $derived (not a plain const) so Svelte doesn't warn about capturing the
	// `repository` prop outside a reactive scope — it never actually changes
	// across this component's lifetime (see PokedexApp's template, which
	// remounts DetailScreen only via `selectedId`/`screen`, never a new
	// `repository`), so this evaluates exactly once in practice.
	const loadState = $derived(new DetailLoadState(repository));
	onDestroy(() => loadState.cancel());

	// chainMembers: the Chain members (CONTEXT.md), keyed by id, filled in
	// after the evolution chain arrives. A member outside the browsed range
	// is fetched then, so this can take a real request.
	let entryLoad = $state<DetailEntrySnapshot>({
		entry: null,
		loading: true,
		error: null,
		chainMembers: {},
	});
	function mirror() {
		entryLoad = loadState.snapshot();
	}

	// The phone (#32) and rail (#33) tabs. One selection across both bands:
	// shownDetailTab shows it where the band has it, else the band's first tab
	// (so Moves survives a resize across 760, and Stats comes back after a
	// visit to the rail). Not reset in startLoad, so prev/next keeps the tab
	// (compare Stats down the dex); leaving for the list unmounts this screen,
	// so a fresh visit opens on the first tab.
	let selectedTab = $state<DetailTab>("about");
	const tabs = $derived(tabsForBand(band));
	const shownTab = $derived(shownDetailTab(selectedTab, band));

	// Reset per-entry (see startLoad below) so switching Pokemon never
	// leaves a previous one's shiny toggle silently applied.
	let showShiny = $state(false);

	// loadState.moveDetails is the real accumulator (not reset on id change —
	// moves repeat heavily across species, nearly everything learns Tackle or
	// Growl — see DetailLoadState.ts's own comment) and the only place that
	// invariant is unit-tested (DetailLoadState.test.ts). This is a bare
	// mirror of it, reassigned wholesale by reference in startLoad's
	// onMoveDetail callback below — not a second accumulator. Fed streaming,
	// one move at a time (not part of entryLoad's wholesale mirror, since
	// DetailLoadState.load() already fetches the whole movepool up front),
	// and passed down to MoveBrowser as a read-only snapshot; MoveBrowser
	// owns its own tab-selection state but never triggers a fetch itself.
	let moveDetails = $state<Record<string, MoveDetail>>({});

	// Owns which Mega/Gigantamax variety (if any) is currently displayed and
	// the session-lifetime cache of forms already fetched — see
	// VarietyToggleState's own comment for why it stays a plain class
	// (same "mirror into $state" reasoning as loadState/entryLoad above).
	// $derived for the same never-changes-across-lifetime reason as
	// loadState above.
	const varietyToggle = $derived(new VarietyToggleState(repository));
	let varietySnapshot = $state<VarietyToggleSnapshot>({
		activeMegaKey: null,
		activeGigantamaxKey: null,
		megaFormCache: {},
		gigantamaxFormCache: {},
	});
	function mirrorVariety() {
		varietySnapshot = varietyToggle.snapshot();
	}
	const activeMegaData = $derived(
		varietySnapshot.activeMegaKey ? varietySnapshot.megaFormCache[varietySnapshot.activeMegaKey] ?? null : null,
	);
	const activeGigantamaxData = $derived(
		varietySnapshot.activeGigantamaxKey
			? varietySnapshot.gigantamaxFormCache[varietySnapshot.activeGigantamaxKey] ?? null
			: null,
	);
	// Which large render the detail screen loads (artwork or HOME): passed
	// with every load and select, never set on the repository.
	const portraitRender = $derived(portraitRenderFor(spriteStyle));
	function selectMegaForm(key: string | null) {
		varietyToggle.selectMega(key, portraitRender, mirrorVariety, reportFormFailure);
	}
	function selectGigantamaxForm(key: string | null) {
		varietyToggle.selectGigantamax(key, portraitRender, mirrorVariety, reportFormFailure);
	}
	// The toggle has already cleared the selection (VarietyToggleState), so
	// the badge reads unselected and one click retries; this says why.
	function reportFormFailure(key: string) {
		const forms = [...(entryLoad.entry?.megaForms ?? []), ...(entryLoad.entry?.gigantamaxForms ?? [])];
		const label = forms.find((form) => form.key === key)?.label ?? "variety";
		new Notice(`Pokedex: couldn't load the ${label} form.`);
	}

	// Image resolution (base/Mega/Gigantamax, shiny toggle) and the
	// shiny-crop scale correction (see imageBounds.ts) live in PortraitPanel
	// now (architecture review candidate 1). portraitUri is derived here
	// because every input is owned here, and the hover-preview overlay below
	// must render at this component's own root (see its comment), not nested
	// inside PortraitPanel. portraitScale is async (it decodes the images), so
	// PortraitPanel reports it back through a bindable.
	const portraitUri = $derived.by(() => {
		const source = activeMegaData ?? activeGigantamaxData ?? entryLoad.entry;
		return source ? resolvePortrait(source, spriteStyle, showShiny) : null;
	});
	let portraitScale = $state(1);
	// A touch held on the portrait (#31; PortraitPanel runs the hold): below
	// a 760px leaf the identity overlay fades with the toggles.
	let artPreview = $state(false);
	// contentScale's memo is keyed by cache path, which only the repository
	// can recover from a blob URL (see imageBounds.ts). An evicted URL has no
	// path any more; keying it by itself is harmless, as its decode fails and
	// is not memoized.
	const measurePortrait = (uri: string) => contentScale(repository.imagePathOf(uri) ?? uri, uri);

	// Hover-to-enlarge for the portrait, mirroring TableGrid's
	// sprite-preview (same side-anchored-with-vertical-clamp shape, shared
	// via domPosition.ts's computeSideAnchoredPreviewPosition) rather than
	// the ability/move popovers' above/below flip — this is a magnified copy
	// of the same image, not a text panel.
	let portraitPreviewPos = $state<{ top: number; left: number } | null>(null);
	// This screen's root: the positioning root its Info popovers (abilities,
	// held items, moves) and the portrait preview are placed against
	// (getScreenRoot, domPosition.ts).
	let rootEl = $state<HTMLDivElement | undefined>();
	provideScreenRoot(() => rootEl);
	const PORTRAIT_PREVIEW_HALF_HEIGHT = 160;
	// The scroller clips the preview, so its clamp reads the scroller's band
	// (visibleBand, domPosition.ts).
	const scrollerOf = getScroller();
	function showPortraitPreview(target: EventTarget | null) {
		const targetEl = target as HTMLElement;
		portraitPreviewPos = computeSideAnchoredPreviewPosition(targetEl, rootEl, scrollerOf(), PORTRAIT_PREVIEW_HALF_HEIGHT);
	}
	function hidePortraitPreview() {
		portraitPreviewPos = null;
	}

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
	const accentColor = $derived(
		TYPE_COLORS[(activeMegaData ?? entryLoad.entry)?.types[0] ?? ""] ?? "var(--lk-accent)",
	);

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
		// A hold cut short by a remount (the grid swaps out while loading)
		// sends no lift, so the next entry must not open with its overlay hidden.
		artPreview = false;
		varietyToggle.resetSelection();
		mirrorVariety();
		// Untracked: startLoad runs inside the id effect, and a render switch
		// is the effect below (new images, not a whole new load).
		const render = untrack(() => portraitRender);
		const result = loadState.load(currentId, render, mirror, () => {
			moveDetails = loadState.moveDetails;
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

	// A style switch between artwork and HOME: the open entry and the
	// selected form ask again in the new render, and each state class drops
	// whatever it still had in flight for the old one. Both ignore the render
	// they already have, so the first run (and "sprite" ⇄ artwork, the same
	// render) asks nothing.
	$effect(() => {
		const render = portraitRender;
		untrack(() => {
			void loadState.setRender(render, mirror);
			varietyToggle.reselect(render, mirrorVariety, reportFormFailure);
		});
	});

	function retry() {
		startLoad(id);
	}

	// Prev/next by National Dex number — stays on the same regional-form line
	// (e.g. Hisuian Growlithe -> Hisuian Arcanine) when the currently viewed
	// row is itself a variant and the neighboring species has one too, else
	// falls back to the neighbor's default row. See getAdjacentDexEntries.
	// `rows` only holds whatever generations are currently enabled/loaded, so
	// a disabled generation's gap is skipped rather than surfaced as a target.
	const adjacent = $derived(
		entryLoad.entry
			? getAdjacentDexEntries(rows, entryLoad.entry.dexNumber, entryLoad.entry.formLabel)
			: { prev: null, next: null },
	);

	// ←/→ are leaf hotkeys (utils/leafHotkeys.ts): PokedexView decides the
	// key and the active leaf, and this answers whether there was a neighbour.
	const commands = getContext<LeafCommandRegistry>(LEAF_COMMANDS_CONTEXT);
	onMount(() => commands.register("detail", "adjacent", (command) => {
		if (command.kind !== "adjacent") return false;
		const target = command.dir === "prev" ? adjacent.prev : adjacent.next;
		if (!target) return false;
		onSelect(target.id);
		return true;
	}));
</script>

<div class="detail-screen" bind:this={rootEl}>
	<!-- Back-button and the grid both live inside .page so they share the
	same centered max-width box — the grid alone previously got margin:auto
	while this button didn't, so its left edge drifted away from the
	identity column's once the grid was wide enough to center. -->
	<div class="page">
		<div class="detail-header">
			<button class="back-button" onclick={onBack}>&larr; Back to list</button>
			<div class="dex-nav">
				<div class="dex-nav-side dex-nav-side-prev">
					{#if adjacent.prev}
						{@const prev = adjacent.prev}
						<button type="button" class="dex-nav-button dex-nav-prev" onclick={() => onSelect(prev.id)}>
							<Icon name="chevron-left" size={14} strokeWidth={2.5} />
							{#if prev.spriteDataUri}
								<img src={prev.spriteDataUri} alt="" class="dex-nav-sprite" />
							{/if}
							<span class="dex-nav-label"><span class="dex-nav-num">#{formatDexNumber(prev.dexNumber)}</span> <span class="dex-nav-name">{formatPokemonDisplayName(prev)}</span></span>
						</button>
					{/if}
				</div>
				{#if adjacent.prev && adjacent.next}
					<span class="dex-nav-divider">|</span>
				{:else}
					<span></span>
				{/if}
				<div class="dex-nav-side dex-nav-side-next">
					{#if adjacent.next}
						{@const next = adjacent.next}
						<button type="button" class="dex-nav-button dex-nav-next" onclick={() => onSelect(next.id)}>
							<span class="dex-nav-label"><span class="dex-nav-num">#{formatDexNumber(next.dexNumber)}</span> <span class="dex-nav-name">{formatPokemonDisplayName(next)}</span></span>
							{#if next.spriteDataUri}
								<img src={next.spriteDataUri} alt="" class="dex-nav-sprite" />
							{/if}
							<Icon name="chevron-right" size={14} strokeWidth={2.5} />
						</button>
					{/if}
				</div>
			</div>
			<QuickSearch {rows} {onSelect} />
		</div>

		{#if entryLoad.loading}
			<!-- `rows` (already in hand — the browse table that got us here) has
			this row's dexNumber before the entry itself finishes loading; a
			regional-form row's own `id` (e.g. 10091) would otherwise flash as
			the "No." briefly, which isn't what a user typed/clicked to get here. -->
			<p>Loading #{formatDexNumber(rows.find((r) => r.id === id)?.dexNumber ?? id)}...</p>
		{:else if entryLoad.error && !entryLoad.entry}
			<p class="error">Couldn't load this Pokemon: {entryLoad.error}</p>
			<button onclick={retry}>Retry</button>
		{:else if entryLoad.entry}
			{@const entry = entryLoad.entry}
			<!-- The Active Gen's stats, held items and capture locations
			(activeGenScope.ts): the same scoping the table's rows get. -->
			{@const scopedEntry = scopeToActiveGen(entry, activeGen)}
			{@const activeHeldItems = scopedEntry.heldItems}
			{@const encounters = describeEncounters(scopedEntry.encounterLocations)}
			<!-- Each group is a snippet, so the phone tabs (#32), the rail
			(#33) and the three columns lay out the same panels without a second
			copy of any. -->
			{#snippet hero()}
				<!-- The phone hero (#31): below a 760px leaf the number, name,
				asterisk and types sit over the portrait's bottom edge. From 760 .hero is
				display: contents, so the rail and the identity column stack the
				square portrait, then the name block. -->
				<div class="hero" class:art-preview={artPreview}>
					<PortraitPanel
						{entry}
						portraitSource={activeMegaData ?? activeGigantamaxData ?? entry}
						{portraitUri}
						{spriteStyle}
						{showShiny}
						onToggleShiny={() => (showShiny = !showShiny)}
						activeMegaKey={varietySnapshot.activeMegaKey}
						onSelectMega={selectMegaForm}
						activeGigantamaxKey={varietySnapshot.activeGigantamaxKey}
						onSelectGigantamax={selectGigantamaxForm}
						onHoverPortrait={showPortraitPreview}
						onLeavePortrait={hidePortraitPreview}
						measure={measurePortrait}
						bind:portraitScale
						bind:artPreview
					/>

					<div class="name-block">
						<p class="dex-eyebrow">No. {formatDexNumber(entry.dexNumber)} ({romanNumeral(entry.generationId)})</p>
						<div class="name-line">
							<p class="mon-name" role="heading" aria-level="2">{formatPokemonDisplayName(entry)}</p>
							<FavoriteToggle active={isFavorite} onToggle={() => onToggleFavorite(entry.id)} size={18} />
						</div>
						<div class="type-row">
							{#each (activeMegaData ?? entry).types as type (type)}
								<TypeBadge {type} useIcon={useTypeIcons} />
							{/each}
						</div>
						<RegionalFormNav {rows} currentId={entry.id} dexNumber={entry.dexNumber} {onSelect} />
					</div>
				</div>
			{/snippet}

			{#snippet facts()}
				<dl class="physical-readout">
					<div>
						<dt>Height</dt>
						<dd>{formatHeight(entry.height)}</dd>
					</div>
					<div>
						<dt>Weight</dt>
						<dd>{formatWeight(entry.weight)}</dd>
					</div>
					<div class="ev-readout">
						<dt>EV yield</dt>
						<dd><EvChips evYield={entry.evYield} /></dd>
					</div>
				</dl>
			{/snippet}

			{#snippet flavor()}
				<FlavorTextPanel flavorTexts={entry.flavorTexts} {activeGen} />
			{/snippet}

			{#snippet evolution(compact: boolean)}
				{#if entry.evolutionChain}
					<section class="panel">
						<h3 class="section-heading">Evolution</h3>
						<EvolutionTree
							chain={entry.evolutionChain}
							{onSelect}
							chainMembers={entryLoad.chainMembers}
							{useTypeIcons}
							{compact}
						/>
					</section>
				{/if}
			{/snippet}

			{#snippet baseStats()}
				<section class="panel stats-panel">
					<h3 class="section-heading">Base stats</h3>
					<!-- Mega stats are PokeAPI's current value for that variety
					already — no historical divergence is possible (Mega Evolution
					has only ever existed since its Gen 6 introduction), so unlike
					the base species this skips the Active Gen stat overlay
					(scopeToActiveGen) entirely. -->
					<StatBars stats={activeMegaData ? activeMegaData.stats : scopedEntry.stats} />
				</section>
			{/snippet}

			{#snippet abilities()}
				<section class="panel abilities-panel">
					<h3 class="section-heading">Abilities</h3>
					<AbilitiesPanel
						abilities={activeMegaData ? activeMegaData.abilities : entry.abilities}
						getDescription={(name) => repository.getAbilityDescription(name)}
					/>
				</section>
			{/snippet}

			<!-- Encounters and held items as text, then one line of gender, catch
			rate and hatch counter rings and the egg groups (the CSS below lays
			that line out by the panel's own width). -->
			{#snippet capture()}
				<section class="panel capture-panel">
					<h3 class="section-heading">Capture & Breeding</h3>
					{#if !encounters.isEmpty}
						{#if encounters.groups.length > 1}
							<ul class="breeding-line capture-locations">
								{#each encounters.groups as group (group.text)}
									<li>{#if encounters.showRegion && group.region}<b>{group.region}:</b>{/if} {group.text}</li>
								{/each}
							</ul>
						{:else}
							<p class="breeding-line">{encounters.groups[0].text}</p>
						{/if}
					{/if}
					{#if activeHeldItems.length > 0}
						<p class="breeding-line">
							Wild held item:
							<HeldItemsPanel
								heldItems={activeHeldItems}
								getDescription={(name) => repository.getItemDescription(name)}
							/>
						</p>
					{/if}
					<div class="breeding-rings">
						<div class="cap-item cap-gender"><GenderRing {malePct} {femalePct} /></div>
						<div class="cap-item cap-catch"><Ring label="Catch rate" value={entry.catchRate} max={MAX_CATCH_RATE} /></div>
						<div class="cap-item cap-hatch"><Ring label="Hatch counter" value={entry.hatchCounter} max={MAX_HATCH_COUNTER} /></div>
						<div class="cap-item egg-groups">
							<span class="egg-groups-label">Egg groups</span>
							<span class="egg-group">{entry.eggGroups.join(", ") || "None"}</span>
						</div>
					</div>
				</section>
			{/snippet}

			{#snippet moves()}
				<section class="panel moves-panel">
					<MoveBrowser moves={entry.moves} {moveDetails} {useTypeIcons} {evolvesAtLevels} {activeGen} />
				</section>
			{/snippet}

			{#snippet tabBar()}
				<div class="detail-tabs-bar">
					<!-- A button group, like MoveBrowser's method tabs, not an ARIA
					tablist: that promises arrow keys between tabs, and ←/→ already
					step to the previous/next Pokemon window-wide (onKeydown). -->
					<div class="detail-tabs" role="group" aria-label="Detail sections">
						{#each tabs as tab (tab.key)}
							<button
								type="button"
								class="detail-tab"
								class:active={shownTab === tab.key}
								aria-pressed={shownTab === tab.key}
								onclick={() => (selectedTab = tab.key)}
							>{tab.label}</button>
						{/each}
					</div>
				</div>
			{/snippet}

			<!-- Base stats beside Abilities (60/40), then Capture & Breeding: the
			rail's Overview and the three columns' middle column. The phone's
			Stats tab leaves Abilities out (it is on About there). -->
			{#snippet pairedStats(withAbilities: boolean)}
				<div class="stats-group">
					<div class="paired-stats-wrap">
						<div class="paired-stats">
							{@render baseStats()}
							{#if withAbilities}{@render abilities()}{/if}
						</div>
					</div>
					<div class="capture-wrap">{@render capture()}</div>
				</div>
			{/snippet}

			{#if band === "phone"}
				<!-- Phone layout (#32), below a 760px leaf: the hero, then one group
				at a time under a sticky segmented control. -->
				<div class="detail-phone" style:--pkdx-accent={accentColor}>
					{@render hero()}
					{@render tabBar()}
					<div class="detail-tab-body">
						{#if shownTab === "about"}
							{@render facts()}
							{@render flavor()}
							{@render abilities()}
						{:else if shownTab === "evolution"}
							{#if entry.evolutionChain}
								{@render evolution(true)}
							{:else}
								<p class="phone-empty">Doesn't evolve.</p>
							{/if}
						{:else if shownTab === "stats"}
							{@render pairedStats(false)}
						{:else if shownTab === "moves"}
							{@render moves()}
						{/if}
					</div>
				</div>
			{:else if band === "rail"}
				<!-- Rail layout (#33), a 760-1100px leaf (tablets, splits): a sticky
				232px identity rail, and Overview · Moves tabs beside it. The hero is
				display: contents here, so the portrait is a plain square. -->
				<div class="detail-rail" style:--pkdx-accent={accentColor}>
					<aside class="detail-rail-identity">
						{@render hero()}
						{@render facts()}
						{@render flavor()}
					</aside>
					<div class="detail-rail-main">
						{@render tabBar()}
						<div class="detail-tab-body">
							{#if shownTab === "overview"}
								{@render evolution(false)}
								{@render pairedStats(true)}
							{:else if shownTab === "moves"}
								{@render moves()}
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<!-- Three columns from a 1100px leaf (#33; was a 920px `detail`
				container): identity | evolution/stats/abilities/breeding | moves. -->
				<div class="detail-grid" style:--pkdx-accent={accentColor}>
					<aside class="identity-col">
						{@render hero()}
						{@render facts()}
						{@render flavor()}
					</aside>

					<div class="core-col">
						{@render evolution(false)}

						{@render pairedStats(true)}
					</div>

					<div class="moves-col">
						{@render moves()}
					</div>
				</div>
			{/if}

		{#if portraitPreviewPos && portraitUri}
			<img
				src={portraitUri}
				alt=""
				class="portrait-preview"
				style="top: {portraitPreviewPos.top}px; left: {portraitPreviewPos.left}px; transform: translateY(-50%) scale({portraitScale});"
			/>
		{/if}
		{/if}
	</div>
</div>

<style>
	.detail-screen {
		/* The Info popover's positioning root (see InfoPopoverBox.svelte):
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
		margin-bottom: var(--lk-space-2);
		/* Above the rail's tab bar (z-index 5), whose fill reaches 14px up
		into this row at rest (.detail-rail-main .detail-tabs-bar) and covered Quick check's
		lower edge in a one-row header. Once the bar sticks the header has
		already scrolled off, so it never covers the stuck bar. */
		position: relative;
		z-index: 6;
	}
	.dex-nav {
		/* Grid (not a centered flex row) so the "|" divider sits at a fixed
		midpoint of this fixed-width flex:1 box, independent of how long
		either name is — prev/next each get an equal 1fr side instead of the
		whole group re-centering as its natural content width changes. */
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		column-gap: 10px;
		flex: 1;
		min-width: 0;
	}
	.dex-nav-side {
		display: flex;
		min-width: 0;
	}
	.dex-nav-side-prev {
		justify-content: flex-end;
	}
	.dex-nav-side-next {
		justify-content: flex-start;
	}
	.dex-nav-divider {
		color: var(--lk-border);
	}
	.dex-nav-button {
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		min-width: 0;
		height: auto;
		min-height: 28px;
		line-height: 1;
		padding: 4px 6px;
		background: transparent;
		border: none;
		box-shadow: none;
		border-radius: var(--lk-radius-s);
		color: var(--lk-text-muted);
		cursor: pointer;
	}
	.dex-nav-button:hover {
		color: var(--lk-text);
		background: var(--lk-surface-hover);
	}
	.dex-nav-sprite {
		width: 36px;
		height: 36px;
		object-fit: contain;
		image-rendering: pixelated;
		flex-shrink: 0;
		display: block;
	}
	.dex-nav-label {
		/* min-width:0 lets this shrink with an ellipsis as a last resort in a
		genuinely narrow pane, but otherwise renders the full name — the
		chevron/sprite's fixed size (not this label) is what keeps them
		pinned at the button's edge, so there's no need to force truncation
		just to hold that anchor. */
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-transform: capitalize;
		font-size: 0.95em;
		font-weight: 700;
		line-height: 1;
	}

	/* Two-row header below a 780px leaf (#31 for the phone, #33 for the rail
	band; the `pane` container is the leaf, styles.src.css): Back to list and
	Quick check on one row, prev/next across the full width under them, so
	neighbour names keep their full length. 780 is its own breakpoint, not the
	rail's 760: one row of "#740 Crabominable" either side fits from there. */
	@container pane (width < 780px) {
		.detail-header {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-areas: "back search" "nav nav";
			row-gap: 6px;
		}
		.back-button {
			grid-area: back;
		}
		.detail-header > :global(.quick-search) {
			grid-area: search;
			justify-self: end;
			width: 100%;
		}
		.dex-nav {
			grid-area: nav;
		}
	}
	/* One row from 780 (#33). The nav's basis is its full labels (both
	sides at the longer label's width), and Quick check, shrinking 20x as
	fast, gives way first, down to 120px: at 780 that leaves it ~160px beside
	"#740 Crabominable" either side, where its own 260px cap otherwise left
	the nav 319px and cut both names. Past that floor the nav shrinks and the
	labels' ellipsis (min-width: 0 above) is the last resort, never overflow. */
	@container pane (width >= 780px) {
		.dex-nav {
			flex: 1 1 auto;
		}
		.detail-header > :global(.quick-search) {
			flex-shrink: 20;
			min-width: 120px;
		}
	}
	/* The phone's tighter nav (#31). */
	@container pane (width < 760px) {
		.dex-nav {
			column-gap: 4px;
		}
		.dex-nav-button {
			gap: 4px;
			padding: 4px;
		}
		.dex-nav-sprite {
			width: 28px;
			height: 28px;
		}
		/* Number over name: a 390px phone leaves each side ~150px, and
		"#740 Crabominable" on one line needs ~120px of text beside the
		chevron and sprite. */
		.dex-nav-label {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.dex-nav-prev .dex-nav-label {
			align-items: flex-start;
		}
		.dex-nav-next .dex-nav-label {
			align-items: flex-end;
		}
		.dex-nav-num {
			font-family: var(--lk-font-code);
			font-size: 0.8em;
			font-weight: 600;
		}
		.dex-nav-name {
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	.hero {
		display: contents;
	}
	/* Phone hero (#31): the portrait (PortraitPanel draws its 250px box, fade
	and toggle corners) fills rows 1-3; the identity overlays rows 2-3, number
	and name left, types bottom-right; a regional-form switcher gets row 4,
	below the box. .name-block becomes display: contents so its children are
	the grid's items. The overlay passes presses through to the portrait (its
	hold) except on the favourite asterisk. */
	@container pane (width < 760px) {
		.hero {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-rows: 1fr auto auto auto;
			column-gap: 10px;
		}
		.hero > :global(.portrait-panel) {
			grid-area: 1 / 1 / 4 / 3;
		}
		.hero .name-block {
			display: contents;
		}
		/* position: relative so they paint above the (positioned) portrait. */
		.hero .dex-eyebrow,
		.hero .name-line,
		.hero .type-row {
			position: relative;
			pointer-events: none;
			transition: opacity var(--lk-duration-base) var(--lk-ease-standard);
		}
		.hero .dex-eyebrow {
			grid-area: 2 / 1;
			padding-left: 14px;
		}
		.hero .name-line {
			grid-area: 3 / 1;
			min-width: 0;
			padding: 2px 0 12px 14px;
		}
		.hero .name-line :global(.favorite-toggle) {
			pointer-events: auto;
		}
		.hero .type-row {
			grid-area: 2 / 2 / 4 / 3;
			align-self: end;
			display: flex;
			gap: 4px;
			margin-top: 0;
			padding: 0 14px 14px 0;
		}
		.hero .name-block > :global(.regional-form-nav) {
			grid-area: 4 / 1 / 5 / 3;
			justify-self: start;
		}
		.hero.art-preview .dex-eyebrow,
		.hero.art-preview .name-line,
		.hero.art-preview .type-row {
			opacity: 0;
		}
		.hero.art-preview .name-line :global(.favorite-toggle) {
			pointer-events: none;
		}
		/* No hover-to-enlarge in the phone hero; touch has the hold. */
		.portrait-preview {
			display: none;
		}
	}

	/* Below a 420px leaf the hero's type badges stack, so a two-type badge
	row no longer covers the name (Grass over "Venusaur" at 320). */
	@container pane (width < 420px) {
		.hero .type-row {
			flex-direction: column;
			align-items: flex-end;
		}
	}

	/* Capped and centered on .page (back-button + grid together), not just
	.detail-grid — otherwise only the grid recenters on a wide pane and the
	back-button (which has no such margin) is left behind at the raw
	container edge, so their left edges no longer line up. The cap only binds
	in three columns. */
	.page {
		max-width: 1160px;
		margin: 0 auto;
	}
	.identity-col, .core-col, .moves-col {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* Three columns, rendered only from a 1100px leaf (the `band` prop), so
	no container query switches them on. */
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

	/* Hover-to-enlarge, same shape as TableGrid's .sprite-preview: fixed
	size, side-anchored with vertical clamp via relativeRect against this screen's root,
	position: absolute (not fixed — .workspace-leaf's `contain: strict` would
	otherwise make it the fixed-positioning containing block instead of the
	viewport, landing the popover off by the tab-bar's height). !important
	needed for the same reason as .sprite-preview: Obsidian's own
	`body:not(.zoom-off) .view-content img { max-width: 100% }` outranks a
	plain single-class selector on specificity. Deliberately rendered here
	(root-level sibling of .detail-grid), not inside PortraitPanel, even
	though the hover trigger lives on PortraitPanel's own box: .identity-col
	(and the rail, #33) is position: sticky,
	which would make IT the containing block for a position: absolute
	descendant nested inside it instead of .detail-screen — silently
	mispositioning this overlay on every normal desktop-width pane. */
	.portrait-preview {
		width: 320px;
		height: 320px;
		max-width: none !important;
		max-height: none !important;
		position: absolute;
		z-index: 50;
		object-fit: contain;
		image-rendering: pixelated;
		background: var(--lk-surface-chrome);
		border: 1px solid var(--lk-border);
		border-radius: var(--lk-radius-l);
		box-shadow: var(--lk-shadow-s);
		padding: 12px;
		pointer-events: none;
	}

	.name-block {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-bottom: 8px;
	}
	.dex-eyebrow {
		margin: 0;
		font-family: var(--lk-font-code);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.2;
		color: var(--pkdx-accent);
	}
	.name-line {
		/* No gap: FavoriteToggle carries its own spacing after the name, the
		same in the table's name cell. */
		display: flex;
		align-items: center;
	}
	.mon-name {
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.2;
		font-weight: 700;
		text-transform: capitalize;
		color: var(--lk-text);
	}
	.type-row {
		/* A bit more separation than the number/name lines share (their 3px
		.name-block gap already applies here too, as the third child) — enough
		to read as its own line, not run together with the name. */
		margin-top: 5px;
	}
	.physical-readout {
		/* Height and Weight size to their short values; EV yield takes the rest
		of the row, its chips wrapping inside it (a three-stat yield needs more
		than a third of the 240px identity rail). */
		display: grid;
		grid-template-columns: auto auto 1fr;
		column-gap: 16px;
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
		color: var(--lk-text-muted);
	}
	.physical-readout dd {
		margin: 0;
		font-family: var(--lk-font-code);
		font-size: 0.92rem;
		color: var(--lk-text);
	}

	.panel {
		background: var(--lk-surface-chrome);
		border: 1px solid var(--lk-border);
		border-radius: var(--lk-radius-m);
		padding: 14px 16px;
	}
	.section-heading {
		margin: 0 0 10px;
		padding-left: 9px;
		border-left: 3px solid var(--pkdx-accent);
		font-family: var(--lk-font-code);
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--lk-text-muted);
		line-height: 1.3;
	}

	.breeding-line {
		margin: 0 0 6px;
	}
	.capture-locations {
		/* list-style-position: inside keeps the bullet in the text's own flow
		instead of floating it in a separate marker box to the left of
		padding-left — the default "outside" combo reads as double-indented
		next to this panel's other flush-left breeding-line text. Zero
		padding-left puts the bullet glyph itself flush with that same left
		edge, rather than adding its own extra indent on top. */
		padding-left: 0;
		list-style-position: inside;
	}
	.capture-locations li {
		margin: 0;
	}
	.error {
		color: var(--lk-danger);
	}

	/* Phone layout (#32). Rendered only below a 760px leaf (the `band` prop),
	so these need no container query. */
	.detail-phone {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* The phone and rail tab bar. Opaque, so the panels scroll under it; the
	segmented pill matches MoveBrowser's method tabs. A sticky top of 0 sits inside the scroller's
	(.pokedex-view) --lk-space-4 padding, and rows showed through that band
	above it: the bar sticks at the scroller's edge instead and fills the
	band itself, and the negative margin keeps its resting place unchanged. */
	.detail-tabs-bar {
		position: sticky;
		top: calc(-1 * var(--lk-space-4));
		z-index: 5;
		margin-top: calc(-1 * var(--lk-space-4));
		padding: calc(var(--lk-space-4) + 6px) 0 6px;
		background: var(--lk-surface);
	}
	.detail-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--lk-surface-sunken);
		border: 1px solid var(--lk-border);
		border-radius: 10px;
	}
	.detail-tab {
		flex: 1;
		min-width: 0;
		height: auto;
		padding: 6px 2px;
		background: transparent;
		border: none;
		box-shadow: none;
		border-radius: 7px;
		cursor: pointer;
		font-size: 0.85em;
		font-weight: 500;
		color: var(--lk-text);
		transition: background var(--lk-duration-fast) ease-out;
	}
	.detail-tab:hover:not(.active) {
		background: var(--lk-surface-hover);
	}
	.detail-tab.active {
		background: var(--lk-surface);
		box-shadow: var(--lk-shadow-s);
		font-weight: 600;
	}
	.detail-tab-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.phone-empty {
		margin: 0;
		color: var(--lk-text-muted);
	}
	.detail-phone .panel {
		padding: 12px;
	}
	/* About's fact line: Height, Weight and EV yield on one row, spread edge
	to edge. A pane too narrow for it moves EV yield to its own row whole,
	never splitting the chips. A three-stat yield (Infernape) fits a 390px
	pane's 319px only with the chips' padding trimmed: measured 312px, against
	332px at the table's chip size. */
	.detail-phone .physical-readout {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		column-gap: 8px;
		row-gap: 8px;
	}
	.detail-phone .ev-readout :global(.ev-chips) {
		flex-wrap: nowrap;
	}
	.detail-phone .ev-readout :global(.ev-chip) {
		gap: 4px;
		padding: 2px 6px 2px 5px;
	}
	/* pairedStats: its parts join the column's own flex gap. Both containers
	answer a component's own width (paneBreakpoint.test.ts lists them): the
	middle column is 337px at a 1100px leaf and 829px in the rail at 900, so
	no leaf width stands for either. */
	.stats-group {
		display: contents;
	}
	.paired-stats-wrap {
		container: paired / inline-size;
	}
	.capture-wrap {
		container: capture / inline-size;
	}
	.paired-stats {
		display: flex;
		gap: 8px;
		align-items: stretch;
	}
	/* Base stats keeps most of the width but never dwarfs Abilities. */
	.paired-stats > :global(.stats-panel) {
		flex: 3 1 0;
		min-width: 0;
	}
	.paired-stats > .abilities-panel {
		flex: 2 1 0;
		min-width: 0;
	}
	/* Capture's four items on one line: each ring's label beside it from a
	540px panel (Ring.svelte, GenderRing.svelte), under it below that, and a
	2x2 grid below 360px with gender and egg groups first. Under their labels
	the four take ~312px with egg groups wrapping at 96px, so a 1100px leaf's
	371px panel (323px inside) keeps one line. Items on one line
	share a height, so their rings line up whatever their labels wrap to
	(Gender's runs to three lines). */
	.breeding-rings {
		display: flex;
		justify-content: space-between;
		align-items: stretch;
		gap: 12px 16px;
		margin: 10px 0 4px;
	}
	.cap-item {
		display: flex;
	}
	.cap-item > :global(.ring) {
		flex: 1;
	}
	.egg-groups {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
	}
	.egg-groups-label {
		font-weight: 600;
		color: var(--lk-text-muted);
		font-size: 0.78em;
	}
	.egg-group {
		text-transform: capitalize;
		font-size: 0.95em;
	}
	@container paired (width < 360px) {
		.paired-stats {
			flex-direction: column;
		}
	}
	@container capture (width < 540px) {
		.breeding-rings {
			justify-content: space-around;
			gap: 12px 8px;
		}
		.egg-groups {
			align-items: center;
			text-align: center;
			max-width: 96px;
		}
	}
	@container capture (width < 360px) {
		.breeding-rings {
			display: grid;
			grid-template-columns: 1fr 1fr;
			justify-items: center;
			align-items: stretch;
			row-gap: 16px;
		}
		.cap-gender { order: 1; }
		.egg-groups { order: 2; }
		.cap-catch { order: 3; }
		.cap-hatch { order: 4; }
	}
	/* A move table wider than the phone or the rail's tab column scrolls
	inside its panel, never the page. The Info popover is positioned from
	.detail-screen, outside this scroller, so it is not clipped. */
	.detail-phone .moves-panel,
	.detail-rail .moves-panel {
		overflow-x: auto;
	}

	/* Rail layout (#33). Rendered only in a 760-1100px leaf (the `band`
	prop). The rail sticks like the three columns' identity column; the tab
	bar beside it sticks at the scroller's edge (.detail-tabs-bar). */
	.detail-rail {
		display: grid;
		grid-template-columns: 232px minmax(0, 1fr);
		align-items: start;
		gap: 24px;
	}
	.detail-rail-identity {
		position: sticky;
		top: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.detail-rail-identity .name-block {
		margin-bottom: 0;
	}
	/* Height · Weight, then EV yield on its own row. */
	.detail-rail .physical-readout {
		grid-template-columns: auto auto;
		justify-content: start;
		column-gap: 24px;
		row-gap: 10px;
	}
	.detail-rail .ev-readout {
		grid-column: 1 / -1;
	}
	.detail-rail-main {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	/* At rest the pill's top lines up with the portrait's (the bar's own top
	padding is the scroller's band plus 6px). The tighter gaps here and below
	keep Infernape's Overview inside a 768px leaf without scrolling. */
	.detail-rail-main .detail-tabs-bar {
		margin-top: calc(-1 * var(--lk-space-4) - 6px);
	}
	.detail-rail-main .detail-tab-body {
		gap: 12px;
	}
</style>
