<script lang="ts">
	import type { Snippet } from "svelte";

	interface HoverPopoverState {
		hovered: string | null;
		pos: { top: number; left: number; placement: "below" | "above" } | null;
	}

	// Shared by AbilitiesPanel, HeldItemsPanel and MoveBrowser: the box
	// itself (position, box chrome, above/below flip), leaving content to
	// the caller via `children` — the three panels' content differs (a
	// fetch-driven loading/error/text status vs. a plain prefetched
	// description), only the box around it was ever identical. Because this
	// is a real component (not hoverPopover.svelte.ts's bare runes module),
	// it can own its own scoped styles for markup it renders itself — the
	// above/below position rule no longer needs a per-caller copy.
	let { hoverState, children }: { hoverState: HoverPopoverState; children: Snippet } = $props();
</script>

{#if hoverState.hovered && hoverState.pos}
	<div
		class="hover-popover-box"
		class:flip-above={hoverState.pos.placement === "above"}
		style="top: {hoverState.pos.top}px; left: {hoverState.pos.left}px;"
	>
		{@render children()}
	</div>
{/if}

<style>
	.hover-popover-box {
		position: absolute;
		z-index: 50;
		max-width: 260px;
		background: var(--lk-surface);
		border: 1px solid var(--lk-border);
		border-radius: var(--lk-radius-m);
		box-shadow: var(--lk-shadow-s);
		padding: 8px 10px;
		font-family: var(--lk-font-label);
		font-size: 0.85em;
		color: var(--lk-text);
		pointer-events: none;
	}
	.hover-popover-box.flip-above {
		transform: translateY(-100%);
	}
</style>
