<script lang="ts">
	import { Notice, Platform } from "obsidian";
	import { onDestroy, onMount, setContext, tick, untrack } from "svelte";
	import type { PokedexRepository } from "../data/PokedexRepository";
	import type { PluginSettings } from "../data/types";
	import type { BrowseLayout } from "../utils/browseLayout";
	import type { CardSize } from "../utils/cardView";
	import { paneWidth } from "../utils/paneWidth";
	import type { LocalPreferences, LocalPreferenceValues } from "../utils/localPreferences";
	import { resolveGenerationScope } from "../utils/generationScope";
	import { describePartialLoadOutcome, describeRetryOutcome } from "../utils/loadNotices";
	import type { DetailNavigationState, NavRecord, ScrollInstruction } from "./DetailNavigationState";
	import { LEAF_COMMANDS_CONTEXT, type LeafCommandRegistry } from "./LeafCommandRegistry";
	import DetailScreen from "./components/DetailScreen.svelte";
	import { emptyLoadSnapshot, type LoadOutcome, type LoadSnapshot, PokedexLoadState } from "./PokedexLoadState";
	import BrowseScreen from "./components/BrowseScreen.svelte";
	import { SCROLLER_CONTEXT, type ScrollerGetter } from "./viewportWatch";
	import Icon from "./components/Icon.svelte";

	let {
		repository, initialSettings, leafEl, preferences, navState, commands, onNavigate,
	}: {
		repository: PokedexRepository;
		// The settings at mount. Later changes arrive through applySettings.
		initialSettings: PluginSettings;
		// The Pokedex leaf, whose width decides the width class.
		leafEl: HTMLElement;
		preferences: LocalPreferences;
		navState: DetailNavigationState;
		// The leaf's Leaf hotkey handlers (LeafCommandRegistry.ts), owned by
		// PokedexView so an app mounted again on the same leaf keeps the same
		// registry. The screens register into it through context.
		commands: LeafCommandRegistry;
		onNavigate: (record: NavRecord) => void;
	} = $props();
	setContext(LEAF_COMMANDS_CONTEXT, untrack(() => commands));

	// A settings change reaches the mounted app through applySettings, called
	// by PokedexView.refresh: nothing remounts, so filters, sort, scroll and the
	// open screen survive it. Each call is a fresh copy, since the settings tab
	// changes the plugin's settings object in place and handing over the same
	// object again would change nothing here. Only the generation scope reloads
	// rows (the scope effect below); every other setting is a prop.
	let settings = $state.raw<PluginSettings>(untrack(() => initialSettings));

	export function applySettings(next: PluginSettings): void {
		settings = next;
	}

	// Favourites, Fields and the layout per width class live in the plugin's
	// one LocalPreferences (ADR-0012), shared by every open Pokedex leaf. This
	// is the reactive mirror: it writes through the holder and re-reads on
	// every change from any leaf, so a favourite toggled in a sidebar leaf
	// shows in the main pane at once, and neither saves over the other.
	// $state.raw: only ever reassigned, and its arrays are the plugin's own.
	let prefs = $state.raw<LocalPreferenceValues>(untrack(() => preferences.get()));
	onMount(() => preferences.subscribe((values) => (prefs = values)));

	// Favourites sit above both screens: the table, Card view and the detail
	// screen read one set.
	const favoriteIds = $derived<ReadonlySet<number>>(new Set(prefs.favoritePokemonIds));
	const toggleFavorite = (id: number) => preferences.toggleFavorite(id);

	// The browse layout follows the Pokedex leaf's width, not the device's: a
	// ResizeObserver on the leaf feeds pane, and each width class shows its own
	// saved choice, so resizing across 600px switches to that class's layout.
	// The toggle writes only the current class. pane also holds the detail
	// screen's band (phone, rail, three columns: #32, #33). Measured at mount,
	// so a Narrow pane never draws the table first; a hidden leaf's fallback
	// and the keep-on-0 rule are paneWidth's (utils/paneWidth.ts). $state.raw:
	// paneWidth returns the same object when nothing changed, so reassigning
	// it every resize re-renders nothing.
	let pane = $state.raw(untrack(() => paneWidth(leafEl.getBoundingClientRect().width)));
	const layout = $derived(prefs.layoutByWidthClass[pane.widthClass]);

	const cardSize = $derived(prefs.cardSizeByWidthClass[pane.widthClass]);
	function setCardSize(next: CardSize) {
		preferences.setCardSize(pane.widthClass, next);
	}
	function setLayout(next: BrowseLayout) {
		preferences.setLayout(pane.widthClass, next);
	}

	function onLeafResize(width: number) {
		pane = paneWidth(width, pane);
	}

	onMount(() => {
		const observer = new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];
			onLeafResize(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
		});
		observer.observe(leafEl);
		return () => observer.disconnect();
	});

	// View history is the tab's own Obsidian navigation history (CONTEXT.md).
	// PokedexView owns navState and the leaf: a new screen goes out through
	// onNavigate, and every entry (new, back/forward, restart) comes back in
	// through show() below. navState is a plain, non-reactive class (same
	// reason as PokedexLoadState below), so screen/selectedId are the reactive
	// mirror, re-assigned after every call. Seeded from it, so an app that
	// mounts again on the same leaf (onOpen firing twice) keeps the screen.
	let screen = $state<"table" | "detail">(untrack(() => navState.screen));
	let selectedId = $state<number | null>(untrack(() => navState.selectedId));

	// PokedexLoadState is a plain, non-reactive class (tested with plain
	// vitest, see PokedexLoadState.test.ts) — Svelte 5's $state only
	// deep-proxies plain objects/arrays, not class instances, so mutations
	// to its fields wouldn't be visible to the template. `view` is the reactive
	// boundary instead, reassigned wholesale from the snapshot the class hands
	// its onUpdate callback after every change (same shape as DetailScreen's
	// entryLoad). The class owns the rows, failed ids and outcome counts; this
	// component only renders them and shows the Notices. `$state.raw`: nothing
	// here changes a snapshot in place, and a deep `$state` would wrap each
	// update anew (Svelte's proxy() keeps no per-object cache), handing
	// BrowseScreen a new `rows` even when the class shared its array.
	let view = $state.raw<LoadSnapshot>(emptyLoadSnapshot());

	const loadState = new PokedexLoadState(
		untrack(() => repository),
		resolveGenerationScope(untrack(() => settings.enabledGenerations)),
		(snapshot) => (view = snapshot),
	);

	function noticePartialLoad(outcome: LoadOutcome | null) {
		if (outcome) new Notice(describePartialLoadOutcome(outcome.loaded, outcome.failed));
	}

	// The app unmounts when its leaf closes, or when Obsidian calls onOpen
	// again for the same leaf (PokedexView.mountApp). Without cancelling here, a
	// load still in flight keeps running in the background, and if a new app
	// mounts, every id the old one hadn't reached yet gets fetched twice. A
	// cancelled load also stops calling onUpdate and returns a null outcome,
	// so nothing below needs its own cancelled check.
	onDestroy(() => loadState.cancel());

	// Render the table as soon as the first row lands instead of blocking on
	// the whole batch — the rest streams in behind a slim progress indicator
	// (see the template) rather than a full-screen loader.
	onMount(() => {
		void loadState.load().then(noticePartialLoad);
	});

	// Every applySettings re-runs this, and setScope ignores a scope with the
	// same key, so only enabling or disabling a generation reloads (in place,
	// keeping the table mounted: see setScope).
	$effect(() => {
		const scope = resolveGenerationScope(settings.enabledGenerations);
		untrack(() => void loadState.setScope(scope).then(noticePartialLoad));
	});

	function retryFailed() {
		void loadState.retry().then((outcome) => {
			if (outcome) {
				new Notice(describeRetryOutcome(outcome.attempted, outcome.recovered, outcome.stillFailing));
			}
		});
	}

	// This root div is the actual scroll container (Obsidian's own contentEl
	// wrapping it fits exactly to the leaf and never overflows — verified via
	// dev tools: contentEl's scrollHeight === clientHeight, while this element's
	// doesn't). Table and detail share it, so entering/leaving detail has to
	// manage scroll position explicitly rather than letting whatever position
	// the table was left at carry straight over. The screens read it through
	// SCROLLER_CONTEXT (viewportWatch.ts); $state so an effect that read it
	// before the bind re-runs once it binds.
	let rootEl = $state<HTMLDivElement | undefined>();
	setContext<ScrollerGetter>(SCROLLER_CONTEXT, () => rootEl);

	// The Scroll-to-top button (CONTEXT.md): mobile only, on the browse screen,
	// once the list is scrolled more than a screen down. A desktop has the
	// scrollbar and the Home key; a phone's list of 1,082 has neither.
	const mobile = Platform.isMobile;
	let scrolledFar = $state(false);
	function onScroll() {
		if (rootEl) scrolledFar = rootEl.scrollTop > rootEl.clientHeight;
	}
	// Smooth unless Reduce motion is on (the setting or the OS): both zero
	// --lk-duration-base on the root (styles.src.css), so one read covers both.
	function scrollToTop() {
		if (!rootEl) return;
		const instant = getComputedStyle(rootEl).getPropertyValue("--lk-duration-base").trim() === "0s";
		rootEl.scrollTo({ top: 0, behavior: instant ? "instant" : "smooth" });
	}

	// Mirrors screen/selectedId from navState, then executes the returned
	// ScrollInstruction — the one piece of work navState can't do itself
	// since it stays DOM-free on purpose (see DetailNavigationState.ts).
	// BrowseScreen stays mounted (see template — it's hidden via CSS while
	// viewing detail, not destroyed, so its filters/sort/column state
	// survive) but restoring a non-zero scroll position still needs the DOM
	// to have un-hidden it first, or the browser clamps the scrollTop write
	// to whatever the still-collapsed height allows.
	async function applyNavigation(instruction: ScrollInstruction) {
		screen = navState.screen;
		selectedId = navState.selectedId;
		if (instruction.kind === "reset") {
			rootEl?.scrollTo(0, 0);
		} else if (instruction.kind === "restore") {
			await tick();
			rootEl?.scrollTo(0, instruction.top);
		}
	}

	// Called by PokedexView.setState for every history entry; its return
	// tells the view whether the record changed anything (an entry or not).
	export function show(record: NavRecord): ScrollInstruction {
		const instruction = navState.setState(record, rootEl?.scrollTop ?? 0);
		void applyNavigation(instruction);
		return instruction;
	}

	function openDetail(id: number) {
		onNavigate({ screen: "detail", pokemonId: id });
	}

	function backToTable() {
		onNavigate(navState.backToTable());
	}
</script>

<div class="pokedex-view" bind:this={rootEl} onscroll={mobile ? onScroll : undefined}>
	{#if view.loading}
		<div class="loading-panel">
			<p>Loading Pokedex&hellip; {view.progress.loaded}/{view.progress.total || "?"}</p>
			<div class="loading-track">
				<div
					class="loading-fill"
					style:width="{view.progress.total ? (view.progress.loaded / view.progress.total) * 100 : 0}%"
				></div>
			</div>
		</div>
	{:else}
		<!-- BrowseScreen stays mounted under both screens (display:none rather
		than an {#if}/{:else if} swap) so its local filter/sort/column-visibility
		state survives a round trip through the detail view instead of resetting
		every time. -->
		<div class:hidden-screen={screen !== "table"}>
			{#if view.progress.loaded < view.progress.total}
				<div class="loading-more-banner">
					Loading more Pokemon&hellip; {view.progress.loaded}/{view.progress.total}
				</div>
			{/if}
			{#if view.failedIds.length > 0}
				<div class="fetch-failure-banner">
					<span>{view.failedIds.length} Pokemon couldn't be fetched.</span>
					<button onclick={retryFailed} disabled={view.retrying}>
						{view.retrying ? "Retrying..." : `Retry ${view.failedIds.length}`}
					</button>
				</div>
			{/if}
			<BrowseScreen
				rows={view.rows}
				density={settings.gridDensity}
				defaultSortColumn={settings.defaultSortColumn}
				visibleFields={prefs.visibleFields}
				cardFields={prefs.cardFields}
				useTypeIcons={settings.useTypeIcons}
				{repository}
				activeGen={settings.activeGen}
				{favoriteIds}
				{layout}
				narrow={pane.widthClass === "narrow"}
				onLayoutChange={setLayout}
				{cardSize}
				onCardSizeChange={setCardSize}
				onToggleField={(key) => preferences.toggleField(key)}
				onToggleCardField={(key) => preferences.toggleCardField(key)}
				onToggleFavorite={toggleFavorite}
				onSelect={openDetail}
			/>
		</div>
		{#if screen === "detail" && selectedId !== null}
			<DetailScreen
				{repository}
				id={selectedId}
				rows={view.rows}
				spriteStyle={settings.spriteStyle}
				useTypeIcons={settings.useTypeIcons}
				activeGen={settings.activeGen}
				band={pane.band}
				isFavorite={favoriteIds.has(selectedId)}
				onToggleFavorite={toggleFavorite}
				onBack={backToTable}
				onSelect={openDetail}
			/>
		{/if}
		{#if mobile && screen === "table"}
			<!-- Sticky at the scroller's bottom padding edge, which already clears
			Obsidian's floating phone nav bar (--view-bottom-spacing). A zero-height
			anchor, so it adds nothing to the list's height. -->
			<div class="scroll-top-anchor">
				<button
					type="button"
					class="lk-button lk-button--icon-only scroll-top"
					class:shown={scrolledFar}
					aria-label="Scroll to top"
					aria-hidden={!scrolledFar}
					tabindex={scrolledFar ? 0 : -1}
					onclick={scrollToTop}
				>
					<Icon name="arrow-up" size={20} strokeWidth={2.25} />
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.loading-panel {
		max-width: 360px;
		margin: 15vh auto 0;
		text-align: center;
		color: var(--lk-text-muted);
	}
	.loading-track {
		height: 6px;
		border-radius: 3px;
		background: var(--lk-border);
		overflow: hidden;
	}
	.loading-fill {
		height: 100%;
		background: var(--lk-accent);
		transition: width var(--lk-duration-fast) ease-out;
	}
	.hidden-screen {
		display: none;
	}
	.scroll-top-anchor {
		position: sticky;
		bottom: 0;
		z-index: 20;
		height: 0;
	}
	/* button.scroll-top: Obsidian's own `button` rules otherwise win the rest
	state (root CLAUDE.md, Styles). Round, raised off the list by a shadow and
	the strong border (a surface fill alone vanishes against the view). */
	button.scroll-top {
		position: absolute;
		right: 0;
		bottom: var(--lk-space-2);
		width: 44px;
		height: 44px;
		border: 1px solid var(--lk-border-strong);
		border-radius: 50%;
		background: var(--lk-surface);
		box-shadow: var(--lk-shadow-s);
		color: var(--lk-text);
		opacity: 0;
		visibility: hidden;
		transform: translateY(8px);
		transition:
			opacity var(--lk-duration-base) ease-out,
			transform var(--lk-duration-base) ease-out,
			visibility var(--lk-duration-base);
	}
	button.scroll-top.shown {
		opacity: 1;
		visibility: visible;
		transform: none;
	}
	.loading-more-banner {
		padding: 4px 10px;
		margin-bottom: var(--lk-space-3);
		color: var(--lk-text-muted);
		font-size: 0.85em;
	}
	.fetch-failure-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		margin-bottom: var(--lk-space-3);
		background: var(--lk-danger-soft);
		border: 1px solid var(--lk-border);
		border-radius: 4px;
		font-size: 0.85em;
	}
</style>
