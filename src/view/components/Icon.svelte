<script lang="ts">
	import { setIcon } from "obsidian";

	let { name, size = 15, strokeWidth = 2.75 }: { name: string; size?: number; strokeWidth?: number } =
		$props();

	function applyIcon(el: HTMLElement) {
		setIcon(el, name);
		return {
			update(newName: string) {
				setIcon(el, newName);
			},
		};
	}
</script>

<span
	class="pokedex-icon"
	style:width="{size}px"
	style:height="{size}px"
	style:--icon-stroke-width={strokeWidth}
	use:applyIcon={name}
></span>

<style>
	.pokedex-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
	}
	.pokedex-icon :global(svg) {
		width: 100%;
		height: 100%;
		stroke-width: var(--icon-stroke-width);
	}
</style>
