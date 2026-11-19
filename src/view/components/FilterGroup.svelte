<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import Icon from "./Icon.svelte";

	// Shared by FilterBar's 8 filter groups: the <details>/<summary> shell
	// (icon, label, live count badge, the chevron/open-state chrome), leaving
	// the flyout content to the caller via `children` — same chrome-vs-content
	// split as InfoPopoverBox.svelte, since the content genuinely varies per
	// group (Stats isn't even a .filter-chips, see FilterBar.svelte's own
	// comment on .stat-filters). `ontoggle` stays a caller-supplied callback
	// rather than owned here, since closing sibling groups needs FilterBar's
	// own filterRailEl scope. Every caller used the same Icon size/strokeWidth,
	// so those are hardcoded here rather than threaded through as props.
	//
	// `variant` "rail" is one segment of the wide pane's rail, its content an
	// anchored flyout. "section" is one collapsible row of the Narrow pane's
	// inline Filters panel; several may be open at once, so it takes no
	// `ontoggle`.
	let { icon, label, count, variant = "rail", open = false, ontoggle, children }: {
		icon: string;
		label: string;
		count?: number;
		variant?: "rail" | "section";
		open?: boolean;
		ontoggle?: (e: Event) => void;
		children: Snippet;
	} = $props();

	// `open` is the starting state only, set once at mount by an attachment.
	// As an attribute (even a constant one) Svelte compiles `details.open = …`
	// into the same render effect as the class list, which re-runs on any prop
	// change (the count badge), so tapping a chip collapsed the section the user
	// had just opened (seen live). untrack keeps the attachment from re-running.
	function setStartOpen(el: HTMLDetailsElement) {
		el.open = untrack(() => open);
	}
</script>

<details class="filter-group" class:section={variant === "section"} {@attach setStartOpen} {ontoggle}>
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
	.filter-group:not(.section):not(:last-child) summary {
		border-right: 1px solid var(--lk-border);
	}
	.filter-group:not(.section):first-child summary {
		border-radius: 6px 0 0 6px;
	}
	.filter-group:not(.section):last-child summary {
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
		color: var(--lk-text-muted);
		transition: background-color var(--lk-duration-fast) ease-out, color var(--lk-duration-fast) ease-out;
	}
	.filter-group summary::-webkit-details-marker {
		display: none;
	}
	.filter-group summary:hover {
		background: var(--lk-surface-hover);
		color: var(--lk-text);
	}
	.filter-group summary::after {
		content: "";
		width: 12px;
		height: 12px;
		margin-left: 2px;
		background-color: var(--lk-text-faint);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		transition: transform var(--lk-duration-fast) ease-out;
	}
	.filter-group[open] summary::after {
		transform: rotate(180deg);
	}
	.filter-group:not(.section)[open] summary {
		background: color-mix(in srgb, var(--lk-accent) 12%, transparent);
		color: var(--lk-accent);
	}
	/* A section is a full-width row of the inline panel: its chevron sits at
	the right edge, and its open state reads from the chevron and the content
	below it, not an accent fill (several sections can be open at once). */
	.filter-group.section:not(:first-child) {
		border-top: 1px solid var(--lk-border);
	}
	.filter-group.section summary {
		padding: 8px 10px;
	}
	.filter-group.section summary::after {
		margin-left: auto;
	}
	.filter-group.section[open] summary {
		color: var(--lk-text);
	}
	.filter-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--lk-accent);
		color: var(--lk-text-on-accent);
		font-size: 0.7em;
		font-weight: 600;
		line-height: 1;
	}
</style>
