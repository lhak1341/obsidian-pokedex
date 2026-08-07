<script lang="ts">
	import type { GigantamaxFormDetail, MegaFormDetail, PluginSettings, PokedexEntry } from "../../data/types";
	import { contentScale } from "../imageBounds";
	import { formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import { resolvePortrait } from "../../utils/portrait";
	import Icon from "./Icon.svelte";
	import VarietyFormToggle from "./VarietyFormToggle.svelte";

	// Owns which image renders (base species vs Mega vs Gigantamax, shiny vs
	// not) and the shiny-crop scale correction (see imageBounds.ts) — the
	// piece of DetailScreen's identity column that was tangled with 5
	// unrelated concerns before being split out (architecture review
	// candidate 1). Deliberately does NOT own the hover-to-enlarge preview:
	// that overlay must render as a sibling of .detail-grid at the
	// .detail-screen root (see DetailScreen.svelte's own comment on
	// .portrait-preview) because .identity-col becomes position: sticky at
	// the ≥920px container-query breakpoint, which would make IT the
	// containing block for a position: absolute descendant nested here
	// instead of .detail-screen — silently mispositioning the overlay on
	// every normal desktop-width pane. portraitUri/portraitScale are
	// surfaced to DetailScreen via $bindable so it can still render that
	// overlay with the right image/scale; onHoverPortrait/onLeavePortrait
	// forward the raw hover events up for the same reason.
	let {
		entry,
		activeMegaData,
		activeGigantamaxData,
		spriteStyle,
		showShiny,
		onToggleShiny,
		activeMegaKey,
		onSelectMega,
		activeGigantamaxKey,
		onSelectGigantamax,
		onHoverPortrait,
		onLeavePortrait,
		portraitUri = $bindable(),
		portraitScale = $bindable(),
	}: {
		entry: PokedexEntry;
		activeMegaData: MegaFormDetail | null;
		activeGigantamaxData: GigantamaxFormDetail | null;
		spriteStyle: PluginSettings["spriteStyle"];
		showShiny: boolean;
		onToggleShiny: () => void;
		activeMegaKey: string | null;
		onSelectMega: (key: string | null) => void;
		activeGigantamaxKey: string | null;
		onSelectGigantamax: (key: string | null) => void;
		onHoverPortrait: (target: EventTarget | null) => void;
		onLeavePortrait: () => void;
		portraitUri: string | null;
		portraitScale: number;
	} = $props();

	// Shared by the base-species, Mega-form, and Gigantamax-form image sets
	// (see MegaFormDetail/GigantamaxFormDetail's comment on why each mirrors
	// PokedexEntry's four image fields) so switching either toggle and the
	// shiny toggle compose freely. Mega and Gigantamax are mutually
	// exclusive (enforced by VarietyToggleState in DetailScreen), so only one
	// of activeMegaData/activeGigantamaxData is ever non-null at once.
	const activePortraitSource = $derived(activeMegaData ?? activeGigantamaxData ?? entry);
	$effect(() => {
		portraitUri = activePortraitSource ? resolvePortrait(activePortraitSource, spriteStyle, showShiny) : null;
	});
	// Always the non-shiny render — resolvePortrait(..., false) is the same
	// "official-artwork falls back to spriteDataUri" logic portraitUri itself
	// uses, just pinned to showShiny=false so it stays a stable reference
	// point regardless of the toggle. See imageBounds.ts's comment: some
	// official-artwork shiny PNGs crop tighter than their non-shiny
	// counterpart, so this is what the scale effect below normalizes against.
	const basePortraitUri = $derived(
		activePortraitSource ? resolvePortrait(activePortraitSource, spriteStyle, false) : null,
	);

	// 1 unless the currently-shown render's own artwork crops noticeably
	// tighter than basePortraitUri's (official-artwork style only — the
	// small game sprites don't exhibit this crop drift). Capped at 1 (never
	// enlarges) so the non-shiny baseline's own on-screen size never changes.
	$effect(() => {
		const base = basePortraitUri;
		const current = portraitUri;
		const style = spriteStyle;
		if (style !== "official-artwork" || !base || !current || base === current) {
			portraitScale = 1;
			return;
		}
		let cancelled = false;
		Promise.all([contentScale(base), contentScale(current)]).then(([baseFill, currentFill]) => {
			if (cancelled || currentFill <= 0) return;
			portraitScale = Math.min(baseFill / currentFill, 1);
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class="portrait-panel"
	role="note"
	onmouseenter={(e) => onHoverPortrait(e.currentTarget)}
	onmouseleave={onLeavePortrait}
>
	<img
		src={portraitUri ?? ""}
		alt={formatPokemonDisplayName(entry)}
		class="portrait-image"
		style:transform="scale({portraitScale})"
	/>
	{#if activePortraitSource?.shinyDataUri || activePortraitSource?.shinyArtworkDataUri}
		<button
			class="shiny-toggle"
			class:active={showShiny}
			onclick={onToggleShiny}
			aria-label={showShiny ? "Show normal sprite" : "Show shiny sprite"}
			title={showShiny ? "Show normal sprite" : "Show shiny sprite"}
		>
			<Icon name="sparkles" size={15} strokeWidth={2.25} />
		</button>
	{/if}
	<VarietyFormToggle
		forms={entry.megaForms}
		activeKey={activeMegaKey}
		onSelect={onSelectMega}
		badgeText={(label) => (label === "Mega" ? "M" : label.slice(-1))}
		corner="left"
	/>
	<VarietyFormToggle
		forms={entry.gigantamaxForms}
		activeKey={activeGigantamaxKey}
		onSelect={onSelectGigantamax}
		badgeText={() => "G"}
		corner="right"
	/>
</div>

<style>
	.portrait-panel {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		width: 100%;
		/* Capped (both axes, so it stays square) so a moderately-narrow-but-
		not-yet-3-column pane (identity column at full container width, still
		under the 920px breakpoint) doesn't turn this into a huge square that
		pushes the name/stats far down. The 3-column layout's identity column
		is a fixed 240px anyway, well under this cap. */
		max-width: 260px;
		max-height: 260px;
		align-self: center;
		background:
			radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%),
			var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-l, 12px);
	}
	.portrait-image {
		width: 76%;
		height: 76%;
		object-fit: contain;
		image-rendering: pixelated;
		filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
	}
	.shiny-toggle {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: auto;
		padding: 5px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s, 6px);
		color: var(--text-muted);
		cursor: pointer;
		box-shadow: var(--shadow-s);
	}
	.shiny-toggle:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.shiny-toggle.active {
		color: var(--color-yellow, gold);
		border-color: var(--color-yellow, gold);
	}
</style>
