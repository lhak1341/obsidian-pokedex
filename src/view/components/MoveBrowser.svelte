<script lang="ts">
	import type { MoveDetail, MoveEntry } from "../../data/types";
	import { relativeRect } from "../domPosition";
	import TypeBadge from "./TypeBadge.svelte";

	let { moves, moveDetails, useTypeIcons, evolvesAtLevels }: {
		moves: MoveEntry[];
		moveDetails: Record<string, MoveDetail>;
		useTypeIcons: boolean;
		// Level(s) at which this entry itself next evolves — see
		// nextEvolutionLevels in data/normalize.ts. Empty for a final-stage
		// member or an item/trade-driven evolution (no level to show).
		evolvesAtLevels: number[];
	} = $props();

	// Unlike AbilitiesPanel's popover, no fetch-on-hover/loading state here —
	// DetailLoadState.load() already prefetches the whole movepool up front,
	// so moveDetails[name].description (or its absence) is already known by
	// the time a row can be hovered.
	let hoveredMove = $state<string | null>(null);
	let movePopoverPos = $state<{ top: number; left: number } | null>(null);

	function showMovePopover(name: string, target: EventTarget | null) {
		hoveredMove = name;
		// Positioned relative to .detail-screen, same reasoning as
		// AbilitiesPanel's popover — see its comment.
		const r = relativeRect(target as HTMLElement, ".detail-screen");
		movePopoverPos = { top: r.bottom + 6, left: r.left };
	}

	function hideMovePopover() {
		hoveredMove = null;
		movePopoverPos = null;
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

	// Not reset on id change (this component instance persists across
	// Pokemon navigation — see DetailScreen, which doesn't remount this
	// panel when `id` changes, only when entry itself becomes null) — lets
	// a user stay on e.g. "Machine" while browsing several Pokemon.
	let activeMoveMethod = $state<(typeof MOVE_METHOD_TABS)[number]["key"]>("level-up");
	let activeMoveVersion = $state<(typeof MOVE_VERSION_TABS)[number]["key"]>("firered-leafgreen");

	const filteredMoves = $derived(
		moves.filter((m) => m.learnMethod === activeMoveMethod && m.versionGroup === activeMoveVersion),
	);

	// moveIndex (not the raw position in displayRows) drives the alternating
	// row shade below — a plain `tr:nth-child(odd)` would count the divider
	// row too, shifting every real move row's shade by one past it.
	type MoveRow =
		| { kind: "move"; move: MoveEntry; moveIndex: number }
		| { kind: "divider"; level: number };

	// Only meaningful on the Level-Up tab (the only one ordered by level —
	// see normalizeMoves, which sorts level-up moves ascending by
	// levelLearnedAt before anything else). Interleaves a divider row right
	// before the first move learned past each evolution level, so it reads
	// as "these moves came before the evolution, these after" without
	// needing a second pass over the rendered table.
	const displayRows = $derived.by((): MoveRow[] => {
		if (activeMoveMethod !== "level-up" || evolvesAtLevels.length === 0) {
			return filteredMoves.map((move, moveIndex) => ({ kind: "move", move, moveIndex }));
		}
		const remainingLevels = [...evolvesAtLevels];
		const rows: MoveRow[] = [];
		filteredMoves.forEach((move, moveIndex) => {
			while (remainingLevels.length > 0 && move.levelLearnedAt > remainingLevels[0]) {
				rows.push({ kind: "divider", level: remainingLevels.shift()! });
			}
			rows.push({ kind: "move", move, moveIndex });
		});
		for (const level of remainingLevels) rows.push({ kind: "divider", level });
		return rows;
	});
</script>

<div class="moves-heading-row">
	<h3 class="section-heading">Moves (G3)</h3>
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
{#if moves.length === 0}
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
				{#each displayRows as row (row.kind === "move" ? row.move.name + row.move.levelLearnedAt : `divider-${row.level}`)}
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
							<td
								class="move-name-cell"
								onmouseenter={(e) => showMovePopover(move.name, e.currentTarget)}
								onmouseleave={hideMovePopover}
							>
								{move.name}
							</td>
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
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
{/if}

{#if hoveredMove && movePopoverPos}
	{@const description = moveDetails[hoveredMove]?.description}
	<div class="move-popover" style="top: {movePopoverPos.top}px; left: {movePopoverPos.left}px;">
		{description ?? "No description available."}
	</div>
{/if}

<style>
	/* Duplicated from DetailScreen's own .section-heading rule — Svelte
	scopes <style> selectors per component, so DetailScreen's copy doesn't
	match this <h3> once it's rendered from here instead (see DetailScreen,
	which still owns .section-heading for every other panel's heading). */
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
	.move-name-cell {
		cursor: help;
	}
	/* Same popover look as AbilitiesPanel's — positioned relative to
	.detail-screen for the same reason (see showMovePopover). */
	.move-popover {
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
	.move-table th.col-right, .move-table td.col-right {
		text-align: right;
	}
	.move-table th.col-center, .move-table td.col-center {
		text-align: center;
	}
	/* Driven by moveIndex (see displayRows), not `tr:nth-child(odd)` — a
	divider row sits between real move rows and would otherwise count toward
	the alternation, shifting every row after it out of sync. */
	.row-shaded {
		background: var(--background-primary);
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
		stroke: var(--text-muted);
		stroke-width: 3;
		stroke-dasharray: 2 6;
		stroke-linecap: round;
		opacity: 0.3;
	}
</style>
