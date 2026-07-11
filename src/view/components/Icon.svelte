<script lang="ts">
	import { setIcon } from "obsidian";

	let { name, size = 15 }: { name: string; size?: number } = $props();

	function applyIcon(el: HTMLElement) {
		setIcon(el, name);
		return {
			update(newName: string) {
				setIcon(el, newName);
			},
		};
	}
</script>

<span class="pokedex-icon" style:width="{size}px" style:height="{size}px" use:applyIcon={name}></span>

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
		/* Lucide's default stroke-width (2) reads as noticeably thinner than
		   the bold sibling text headers (font-weight 700) it sits next to. */
		stroke-width: 2.75;
	}
</style>
