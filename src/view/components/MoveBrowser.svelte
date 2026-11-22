<script lang="ts">
	import type { MoveDetail, MoveEntry } from "../../data/types";
	import { createInfoPopover } from "../infoPopover.svelte";
	import { getScroller } from "../viewportWatch";
	import { resolveMoveView } from "../../utils/moveRows";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let { moves, moveDetails, useTypeIcons, evolvesAtLevels, activeGen }: {
		moves: MoveEntry[];
		moveDetails: Record<string, MoveDetail>;
		useTypeIcons: boolean;
		// Level(s) at which this entry itself next evolves — see
		// nextEvolutionLevels in data/normalize.ts. Empty for a final-stage
		// member or an item/trade-driven evolution (no level to show).
		evolvesAtLevels: number[];
		activeGen: number;
	} = $props();

	// Unlike AbilitiesPanel's popover, no fetch-on-hover/loading state here —
	// DetailLoadState.load() already prefetches the whole movepool up front,
	// so moveDetails[name].description (or its absence) is already known by
	// the time a row can be hovered.
	const popover = createInfoPopover(".detail-screen");

	// Not reset on id change (this component instance persists across
	// Pokemon navigation — see DetailScreen, which doesn't remount this
	// panel when `id` changes, only when entry itself becomes null) — lets
	// a user stay on e.g. "Machine" while browsing several Pokemon.
	let activeMoveMethod = $state<string>("level-up");
	// Remembered raw key (not derived from any one generation's tab set) —
	// resolveMoveView shows it when this entry/generation has the game,
	// else the first one, and never rewrites it.
	let activeMoveVersion = $state<string>("firered-leafgreen");

	const view = $derived(
		resolveMoveView(moves, activeGen, { version: activeMoveVersion, method: activeMoveMethod }, evolvesAtLevels),
	);

	// In the phone band the list under the method tabs is at least one
	// scroller viewport tall (the `.move-list` pane query below). A browser
	// cannot scroll past the content's end, so switching to a short list
	// (Egg's 4 rows after Level-Up's 16, scrolled to the tabs) shrank the page
	// under the scroll position: it was pulled back (to 0 on a 387px phone
	// detail screen) and the tabs jumped ~210px under the finger. With this
	// room the tabs stay put through every method and version switch; a short
	// list leaves blank space below it, seen only by scrolling past it. Phone
	// band only: from 760 Moves is a bordered card beside other sections, and
	// the room showed as ~330px of empty card under a short list.
	// The scroller is PokedexApp's (getScroller). A hidden screen reads 0, so
	// the last real height is kept (src/view/CLAUDE.md).
	const scrollerOf = getScroller();
	let viewportHeight = $state(0);
	$effect(() => {
		const scroller = scrollerOf();
		if (!scroller) return;
		const ro = new ResizeObserver(() => {
			if (scroller.clientHeight > 0) viewportHeight = scroller.clientHeight;
		});
		ro.observe(scroller);
		return () => ro.disconnect();
	});
</script>

<!-- The section's own width, not the pane's, decides the narrow form: the
Moves panel is a tab of the whole screen on the phone, a tab beside the
identity rail from 760px and a column from 1100px. -->
<div class="move-browser">
	<div class="moves-heading-row">
		<h3 class="section-heading">Moves (G{view.shownGen}{view.shownGen !== activeGen ? ` · no G${activeGen} data` : ""})</h3>
		<div class="move-tabs move-version-tabs">
			{#each view.versionTabs as tab (tab.key)}
				<button
					type="button"
					class="move-tab"
					class:active={view.version === tab.key}
					onclick={() => (activeMoveVersion = tab.key)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>
	{#if moves.length === 0}
		<p class="text-muted">No move data for this version group.</p>
	{:else}
		<div class="move-tabs">
			{#each view.methodTabs as tab (tab.key)}
				<button
					type="button"
					class="move-tab"
					class:active={view.method === tab.key}
					onclick={() => (activeMoveMethod = tab.key)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
		<div
			class="move-list"
			style:--pkdx-moves-room={viewportHeight > 0 ? `${viewportHeight}px` : undefined}
		>
			{#if view.rows.length === 0}
				<p class="text-muted">No moves for this game.</p>
			{:else}
				<!-- A column's header at each width (see the moves container
				queries); the th's title spells it out. -->
				{#snippet columnLabel(wide: string, narrow: string, narrowest: string)}
					<span class="label-wide">{wide}</span><span class="label-narrow" aria-hidden="true">{narrow}</span><span
						class="label-narrowest"
						aria-hidden="true">{narrowest}</span
					>
				{/snippet}
				<table class="move-table">
					<thead>
						<tr>
							<th>Move</th>
							{#if view.method === "level-up"}<th class="col-right" title="Level"
									>{@render columnLabel("Level", "Lv", "L")}</th
								>{/if}
							<th class="col-center" title="Type">{@render columnLabel("Type", "Type", "T")}</th>
							<th class="col-right" title="Power">{@render columnLabel("Pow", "Pow", "P")}</th>
							<th class="col-right col-acc" title="Accuracy">{@render columnLabel("Acc", "Acc", "A")}</th>
							<th class="col-right">PP</th>
						</tr>
					</thead>
					<tbody>
						{#each view.rows as row (row.kind === "move" ? row.move.name + row.move.levelLearnedAt : `divider-${row.level}`)}
							{#if row.kind === "divider"}
								<tr class="evolve-divider-row">
									<td colspan={6}>
										<svg class="evolve-divider-line" width="100%" height="6">
											<line x1="0" y1="3" x2="100%" y2="3" />
										</svg>
									</td>
								</tr>
							{:else}
								{@const move = row.move}
								{@const detail = moveDetails[move.name]}
								<tr class:row-shaded={row.moveIndex % 2 === 0}>
									<td class="move-name-cell"><span class="pkdx-info-target" {...popover.target(move.name)}>{move.name}</span></td>
									{#if view.method === "level-up"}<td class="col-right num">{move.levelLearnedAt}</td>{/if}
									<td class="col-center">
										{#if detail}
											<!-- Narrow, the name gives way to the type's icon (the
											Type icons setting's look, with the name as its
											tooltip): "Electric" alone took a quarter of the
											table. -->
											<span class="type-wide"><TypeBadge type={detail.type} useIcon={useTypeIcons} /></span
											><span class="type-narrow"><TypeBadge type={detail.type} useIcon small /></span>
										{:else}
											…
										{/if}
									</td>
									<td class="col-right num">{detail ? (detail.power ?? "-") : "…"}</td>
									<td class="col-right num col-acc">{detail ? (detail.accuracy ?? "-") : "…"}</td>
									<td class="col-right num">{detail ? detail.pp : "…"}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>

<InfoPopoverBox popover={popover}>
	{#if popover.open}
		{moveDetails[popover.open]?.description ?? "No description available."}
	{/if}
</InfoPopoverBox>

<style>
	/* Duplicated from DetailScreen's own .section-heading rule — Svelte
	scopes <style> selectors per component, so DetailScreen's copy doesn't
	match this <h3> once it's rendered from here instead (see DetailScreen,
	which still owns .section-heading for every other panel's heading). */
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
	/* Wraps once the game toggle no longer fits beside the heading: Gen 9's
	three games (S/V, Legends: Z-A, Champions) take 249px. */
	.moves-heading-row {
		display: flex;
		flex-wrap: wrap;
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
		background: var(--lk-surface-sunken);
		border: 1px solid var(--lk-border);
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
		color: var(--lk-text);
		transition: background var(--lk-duration-fast) ease-out, color var(--lk-duration-fast) ease-out;
	}
	.move-tab:hover:not(.active) {
		background: var(--lk-surface-hover);
	}
	.move-tab.active {
		background: var(--lk-surface);
		box-shadow: var(--lk-shadow-s);
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
	/* Numbers as Base Stats draws them (BarRow's .bar-value). */
	.move-table td.num {
		font-family: var(--lk-font-code);
		font-size: 0.85em;
	}
	.move-browser {
		container: moves / inline-size;
	}
	.label-narrow,
	.label-narrowest,
	.type-narrow {
		display: none;
	}
	/* Narrow: a 390px phone pane leaves the section 293px and a 1100px leaf's
	third column 337px, where the full table (368px) ran past the panel and
	hid Pow, Acc and PP. */
	@container moves (width < 400px) {
		.move-version-tabs .move-tab {
			padding: 4px 6px;
		}
		.move-table th,
		.move-table td {
			padding: 2px 4px;
		}
		.move-table th {
			font-size: 0.85em;
		}
		.label-wide,
		.type-wide {
			display: none;
		}
		.label-narrow,
		.type-narrow {
			display: inline;
		}
	}
	/* Narrowest: a 320px phone pane leaves 223px; the old 600px rail's 239px
	Moves tab still ran 8px over.
	Headers drop to a letter (L, T, P, A; PP stays), so the numbers set the
	column widths. */
	@container moves (width < 280px) {
		.move-table th,
		.move-table td {
			padding: 2px;
		}
		.label-narrow {
			display: none;
		}
		.label-narrowest {
			display: inline;
		}
		/* With 2px between columns, "40 100 30" read as one number: a tint
		on the middle number column sets Pow, Acc and PP apart. It is
		translucent, so the row stripes still show through it. */
		.move-table .col-acc {
			background-color: color-mix(in srgb, var(--lk-text) 7%, transparent);
		}
	}
	/* The name is the Info popover target: its tap area (styles.src.css,
	.pkdx-info-target::before) reaches past the row and the cell clips it, so
	it spans the row's height at the name's own width, as in TableScreen. */
	.move-name-cell {
		--pkdx-tap-pad-y: 64px;
		overflow: hidden;
	}
	.move-table th.col-right, .move-table td.col-right {
		text-align: right;
	}
	.move-table th.col-center, .move-table td.col-center {
		text-align: center;
	}
	/* Driven by moveIndex (see view.rows), not `tr:nth-child(odd)` — a
	divider row sits between real move rows and would otherwise count toward
	the alternation, shifting every row after it out of sync. */
	.row-shaded {
		background: var(--lk-surface);
	}
	/* The row/cell collapse to zero height — an absolutely positioned child
	doesn't contribute to its container's auto height, so this adds no
	spacing to the move list at all. The line floats on top of the boundary
	between the two surrounding rows instead of occupying a row of its own. */
	.evolve-divider-row {
		height: 0;
	}
	.evolve-divider-row td {
		height: 0;
		padding: 0;
		border: none;
		position: relative;
		overflow: visible;
	}
	.evolve-divider-line {
		position: absolute;
		left: 0;
		top: -3px;
		width: 100%;
		display: block;
		overflow: visible;
		pointer-events: none;
	}
	/* Exactly EvolutionTree's own connector-line style — same element (an
	SVG line), same numbers, reused rather than approximated. CSS border/
	gradient tricks can't reproduce stroke-linecap's rounded dash caps, which
	is what makes this read as small rounded-rect dots rather than a plain
	dashed line. */
	.evolve-divider-line line {
		stroke: var(--lk-text-muted);
		stroke-width: 3;
		stroke-dasharray: 2 6;
		stroke-linecap: round;
		opacity: 0.3;
	}
	/* The phone band's room under the method tabs (see the script): the
	scroller's height, measured. DETAIL_PHONE_MAX_WIDTH. */
	@container pane (width < 760px) {
		.move-list {
			min-height: var(--pkdx-moves-room, 0);
		}
	}
</style>
