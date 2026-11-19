<script lang="ts">
	// A list's favourite marker (table rows, Card view tiles): a 5px accent
	// dot, drawn only on a favourite and never a tap target, so a tap on it
	// does what the row or tile does. Lists toggle through the favourites menu
	// (view/favoriteMenu.ts); the single-Pokémon views keep FavoriteToggle
	// (#35). Where it sits is the list's call: after the name in the table, a
	// corner on a tile.
</script>

<span class="favorite-mark" role="img" aria-label="Favorite"></span>

<style>
	.favorite-mark {
		display: block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--lk-accent);
	}
</style>
