<script lang="ts">
	import type { Snippet } from "svelte";
	import Icon from "./Icon.svelte";

	// Shared by FilterBar's 7 filter groups: the <details>/<summary> shell
	// (icon, label, live count badge, the chevron/open-state chrome), leaving
	// the flyout content to the caller via `children` — same chrome-vs-content
	// split as HoverPopoverBox.svelte, since the content genuinely varies per
	// group (Stats isn't even a .filter-chips, see FilterBar.svelte's own
	// comment on .stat-filters). `ontoggle` stays a caller-supplied callback
	// rather than owned here, since closing sibling groups needs FilterBar's
	// own filterRailEl scope. Every caller used the same Icon size/strokeWidth,
	// so those are hardcoded here rather than threaded through as props.
	let { icon, label, count, ontoggle, children }: {
		icon: string;
		label: string;
		count?: number;
		ontoggle: (e: Event) => void;
		children: Snippet;
	} = $props();
</script>

<details class="filter-group" {ontoggle}>
	<summary>
		<Icon name={icon} size={14} strokeWidth={2} />
		<span>{label}</span>
		{#if count}<span class="filter-count">{count}</span>{/if}
	</summary>
	{@render children()}
</details>

<style>
	.filter-group {
		position: relative;
	}
	.filter-group:not(:last-child) summary {
		border-right: 1px solid var(--background-modifier-border);
	}
	.filter-group:first-child summary {
		border-radius: 6px 0 0 6px;
	}
	.filter-group:last-child summary {
		border-radius: 0 6px 6px 0;
	}
	.filter-group summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		padding: 5px 10px;
		list-style: none;
		user-select: none;
		color: var(--text-muted);
		transition: background-color 100ms ease-out, color 100ms ease-out;
	}
	.filter-group summary::-webkit-details-marker {
		display: none;
	}
	.filter-group summary:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.filter-group summary::after {
		content: "";
		width: 12px;
		height: 12px;
		margin-left: 2px;
		background-color: var(--text-faint);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		transition: transform 100ms ease-out;
	}
	.filter-group[open] summary::after {
		transform: rotate(180deg);
	}
	.filter-group[open] summary {
		background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
		color: var(--interactive-accent);
	}
	.filter-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-size: 0.7em;
		font-weight: 600;
		line-height: 1;
	}
</style>
