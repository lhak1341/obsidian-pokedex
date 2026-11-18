<script lang="ts">
	import Icon from "./Icon.svelte";

	// The favourite asterisk after a name: faint when unset, accent when set,
	// toggles on tap or click. Favourite state itself is owned by PokedexApp
	// (shared by the table and the detail screen), so this only draws and asks.
	let { active, onToggle, size = 13 }: { active: boolean; onToggle: () => void; size?: number } = $props();

	function onclick(e: MouseEvent) {
		// Inside a table row whose own click opens the detail screen: the
		// asterisk acts on itself only.
		e.stopPropagation();
		onToggle();
	}
</script>

<button
	type="button"
	class="favorite-toggle"
	class:active
	aria-label={active ? "Remove from favorites" : "Add to favorites"}
	aria-pressed={active}
	{onclick}
>
	<Icon name="asterisk" {size} strokeWidth={2.5} />
</button>

<style>
	/* button.favorite-toggle, not .favorite-toggle: Obsidian's own `button`
	rules (background, shadow, padding, height) otherwise win on the rest
	state, the same trap as the filter chips (root CLAUDE.md, Styles). */
	button.favorite-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		height: auto;
		margin-left: 4px;
		padding: 2px;
		background: transparent;
		border: none;
		box-shadow: none;
		border-radius: var(--lk-radius-s);
		color: var(--lk-text-faint);
		opacity: 0.55;
		cursor: pointer;
		transition: color var(--lk-duration-fast) ease-out, opacity var(--lk-duration-fast) ease-out;
	}
	button.favorite-toggle:hover {
		opacity: 1;
		color: var(--lk-text-muted);
		background: transparent;
	}
	button.favorite-toggle.active {
		opacity: 1;
		color: var(--lk-accent);
	}
</style>
