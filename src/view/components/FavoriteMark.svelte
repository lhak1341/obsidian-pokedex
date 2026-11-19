<script lang="ts">
	import Icon from "./Icon.svelte";

	// A list's favourite marker (table rows, Card view tiles): the accent
	// asterisk, drawn only on a favourite and never a tap target, so a tap on
	// it does what the row or tile does. Lists toggle through the favourites
	// menu (view/favoriteMenu.ts); the single-Pokémon views keep
	// FavoriteToggle (#35).
	let { size = 13 }: { size?: number } = $props();
</script>

<span class="favorite-mark" role="img" aria-label="Favorite"><Icon name="asterisk" {size} strokeWidth={2.5} /></span>

<style>
	.favorite-mark {
		display: inline-flex;
		vertical-align: middle;
		color: var(--lk-accent);
	}
</style>
