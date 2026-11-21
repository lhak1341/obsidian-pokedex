<script lang="ts">
	// The table's favourite marker: a 5px accent dot after the name, shown only
	// on a favourite (TableScreen's markedName draws it on every row, hidden)
	// and never a tap target, so a tap on it does what the row does. Card view
	// outlines a favourite's tile instead (a dot there read as an EV dot).
	// Lists toggle through the favourites menu (view/favoriteMenu.ts); the
	// single-Pokémon views keep FavoriteToggle (#35).
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
