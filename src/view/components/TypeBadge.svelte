<script lang="ts">
	import { TYPE_COLORS } from "../../data/constants";

	let { type }: { type: string } = $props();
</script>

<span class="type-badge" style:background-color={TYPE_COLORS[type] ?? "#777"}>
	{type}
</span>

<style>
	.type-badge {
		display: inline-block;
		padding: 1px 8px;
		margin-right: 4px;
		border-radius: 10px;
		font-size: 0.75em;
		font-weight: 600;
		color: white;
		text-transform: capitalize;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
	}
</style>
