<script lang="ts">
	import type { PokedexTableRow } from "../../data/types";
	import { EMPTY_FILTERS, filterPokemon } from "../../utils/filterPokemon";
	import { sortPokemon, type SortColumn, type SortDirection } from "../../utils/sortPokemon";
	import { TOGGLEABLE_COLUMNS } from "../../utils/tableColumns";
	import { untrack } from "svelte";
	import FilterBar from "./FilterBar.svelte";
	import Icon from "./Icon.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let { rows, density, defaultSortColumn, initialVisibleColumns, onColumnsChange, onSelect }: {
		rows: PokedexTableRow[];
		density: "compact" | "comfortable";
		defaultSortColumn: "id" | "name";
		initialVisibleColumns: string[];
		onColumnsChange: (columns: string[]) => void;
		onSelect: (id: number) => void;
	} = $props();

	let filters = $state({ ...EMPTY_FILTERS, statRanges: {} });
	// Only the initial value seeds local state — same reasoning as
	// defaultSortColumn below, this shouldn't get clobbered by prop identity
	// changes once the user starts toggling columns.
	let visibleColumnKeys = $state(new Set(untrack(() => initialVisibleColumns)));
	// Only the initial value of defaultSortColumn seeds local sort state —
	// the user's in-table sort choice shouldn't get clobbered if it changes.
	let sortColumn = $state<SortColumn>(untrack(() => defaultSortColumn));
	let sortDirection = $state<SortDirection>("asc");

	const abilityOptions = $derived(
		[...new Set(rows.flatMap((r) => r.abilityNames))].sort(),
	);
	const visibleRows = $derived(
		sortPokemon(filterPokemon(rows, filters), sortColumn, sortDirection),
	);
	const activeColumns = $derived(
		TOGGLEABLE_COLUMNS.filter((col) => visibleColumnKeys.has(col.key)),
	);

	function setSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === "asc" ? "desc" : "asc";
		} else {
			sortColumn = column;
			sortDirection = "asc";
		}
	}

	function sortIndicator(column: SortColumn): string {
		if (sortColumn !== column) return "";
		return sortDirection === "asc" ? " ^" : " v";
	}

	function toggleColumn(key: string) {
		const next = new Set(visibleColumnKeys);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		visibleColumnKeys = next;
		onColumnsChange([...next]);
	}
</script>

<div class="table-screen">
	<FilterBar bind:filters {abilityOptions} />

	<details class="column-toggle">
		<summary>Columns</summary>
		<div class="column-checkbox-list">
			{#each TOGGLEABLE_COLUMNS as col (col.key)}
				<label class="column-checkbox">
					<input
						type="checkbox"
						checked={visibleColumnKeys.has(col.key)}
						onchange={() => toggleColumn(col.key)}
					/>
					{col.label}
				</label>
			{/each}
		</div>
	</details>

	<p class="result-count">{visibleRows.length} of {rows.length} Pokemon</p>

	<div class="table-wrap">
		<table class:compact={density === "compact"}>
			<thead>
				<tr>
					<th onclick={() => setSort("id")}>No.{sortIndicator("id")}</th>
					<th class="center">Sprite</th>
					<th onclick={() => setSort("name")}>Name{sortIndicator("name")}</th>
					<th>Type</th>
					{#each activeColumns as col (col.key)}
						<th
							class:center={!!col.headerIcon}
							onclick={() => col.sortKey && setSort(col.sortKey)}
							title={col.label}
						>
							{#if col.headerIcon}
								<Icon name={col.headerIcon} />
							{:else}
								{col.label}
							{/if}
							{col.sortKey ? sortIndicator(col.sortKey) : ""}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each visibleRows as row (row.id)}
					<tr onclick={() => onSelect(row.id)}>
						<td>{String(row.id).padStart(3, "0")}</td>
						<td class="center">
							{#if row.spriteDataUri}
								<img src={row.spriteDataUri} alt={row.name} class="sprite-thumb" />
							{/if}
						</td>
						<td class="name-cell">{row.name}</td>
						<td>
							{#each row.types as type (type)}
								<TypeBadge {type} />
							{/each}
						</td>
						{#each activeColumns as col (col.key)}
							<td>{col.render(row)}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.result-count {
		color: var(--text-muted);
		font-size: 0.85em;
		margin: 6px 0;
	}
	.column-toggle {
		margin-bottom: var(--size-4-3);
	}
	.column-toggle summary {
		display: inline-block;
		cursor: pointer;
		padding: 4px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		list-style: none;
		user-select: none;
	}
	.column-toggle summary::-webkit-details-marker {
		display: none;
	}
	.column-toggle summary::after {
		content: "▸";
		float: right;
		margin-left: 8px;
		color: var(--text-faint);
		transition: transform 100ms ease-out;
	}
	.column-toggle[open] summary::after {
		transform: rotate(90deg);
	}
	.column-toggle[open] summary {
		border-color: var(--interactive-accent);
	}
	.column-checkbox-list {
		display: flex;
		flex-wrap: wrap;
		max-width: 420px;
		padding: 6px;
	}
	.column-checkbox {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		font-size: 0.85em;
		cursor: pointer;
	}
	.table-wrap {
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		position: sticky;
		top: 0;
		background: var(--background-primary);
		cursor: pointer;
		text-align: left;
		padding: 6px 8px;
		white-space: nowrap;
		border-bottom: 2px solid var(--background-modifier-border);
	}
	th:hover {
		color: var(--interactive-accent);
	}
	td {
		padding: 4px 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.center {
		text-align: center;
	}
	tbody tr:nth-child(even) {
		background: var(--background-secondary);
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover {
		background: var(--background-modifier-hover);
	}
	.name-cell {
		text-transform: capitalize;
		font-weight: 600;
	}
	.sprite-thumb {
		width: 32px;
		height: 32px;
		image-rendering: pixelated;
	}
	table.compact td, table.compact th {
		padding: 2px 6px;
	}
	table.compact .sprite-thumb {
		width: 24px;
		height: 24px;
	}
</style>
