<script lang="ts">
	import type { PluginSettings, PokedexEntry, PortraitImageSource } from "../../data/types";
	import { formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import { resolvePortrait, resolvePortraitScale } from "../../utils/portrait";
	import { onDestroy } from "svelte";
	import { createPortraitPress } from "../portraitPress";
	import Icon from "./Icon.svelte";
	import VarietyFormToggle from "./VarietyFormToggle.svelte";

	// Owns which image renders (base species vs Mega vs Gigantamax, shiny vs
	// not) and the shiny-crop scale correction (see imageBounds.ts) — the
	// piece of DetailScreen's identity column that was tangled with 5
	// unrelated concerns before being split out (architecture review
	// candidate 1). Deliberately does NOT own the hover-to-enlarge preview:
	// that overlay must render as a sibling of .detail-grid at the
	// .detail-screen root (see DetailScreen.svelte's own comment on
	// .portrait-preview) because .identity-col (and #33's .detail-rail-identity) is
	// position: sticky, which would make IT the
	// containing block for a position: absolute descendant nested here
	// instead of .detail-screen — silently mispositioning the overlay on
	// every normal desktop-width pane. DetailScreen derives portraitSource
	// and portraitUri itself (it owns every input) and hands them down;
	// portraitScale is async, so it is surfaced back via $bindable; onHoverPortrait/onLeavePortrait
	// forward the raw hover events up for the same reason. artPreview (a touch
	// held on the portrait, #31) is bound back up too: below a 760px leaf the
	// identity overlay DetailScreen draws over this box fades with it.
	let {
		entry,
		portraitSource,
		portraitUri,
		spriteStyle,
		showShiny,
		onToggleShiny,
		activeMegaKey,
		onSelectMega,
		activeGigantamaxKey,
		onSelectGigantamax,
		onHoverPortrait,
		onLeavePortrait,
		measure,
		portraitScale = $bindable(),
		artPreview = $bindable(false),
	}: {
		entry: PokedexEntry;
		// Which image set renders: the active Mega/Gigantamax form, else the
		// entry itself (Mega and Gigantamax are mutually exclusive, enforced
		// by VarietyToggleState) — chosen once in DetailScreen.
		portraitSource: PortraitImageSource;
		portraitUri: string | null;
		spriteStyle: PluginSettings["spriteStyle"];
		showShiny: boolean;
		onToggleShiny: () => void;
		activeMegaKey: string | null;
		onSelectMega: (key: string | null) => void;
		activeGigantamaxKey: string | null;
		onSelectGigantamax: (key: string | null) => void;
		onHoverPortrait: (target: EventTarget | null) => void;
		onLeavePortrait: () => void;
		// imageBounds.ts's contentScale, keyed by the image's cache path —
		// DetailScreen builds it, since it holds the repository that maps a
		// URL back to its path.
		measure: (uri: string) => Promise<number>;
		portraitScale: number;
		artPreview?: boolean;
	} = $props();

	const hasShiny = $derived(Boolean(portraitSource?.shinyDataUri || portraitSource?.shinyArtworkDataUri));

	// Press and hold to see the art alone, any width, touch only (rules:
	// stepPortraitPress in utils/pressHold.ts).
	const press = createPortraitPress((show) => (artPreview = show));
	onDestroy(() => press.destroy());

	// Always the non-shiny render — resolvePortrait(..., false) is the same
	// "official-artwork falls back to spriteDataUri" logic portraitUri itself
	// uses, just pinned to showShiny=false so it stays a stable reference
	// point regardless of the toggle. See imageBounds.ts's comment: some
	// official-artwork shiny PNGs crop tighter than their non-shiny
	// counterpart, so this is what the scale effect below normalizes against.
	const basePortraitUri = $derived(
		portraitSource ? resolvePortrait(portraitSource, spriteStyle, false) : null,
	);

	// 1 unless the currently-shown render's own artwork crops noticeably
	// tighter than basePortraitUri's (rule and rationale: resolvePortraitScale
	// in utils/portrait.ts). A null result means "no usable measurement" and
	// keeps the previous scale.
	$effect(() => {
		let cancelled = false;
		resolvePortraitScale({
			style: spriteStyle,
			baseUri: basePortraitUri,
			currentUri: portraitUri,
			measure,
		}).then((scale) => {
			if (!cancelled && scale !== null) portraitScale = scale;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<!-- Hover-to-enlarge is mouse only: a tap sends a compatibility mouseenter
that would otherwise open it, and touch has the hold instead. -->
<div
	class="portrait-panel"
	class:art-preview={artPreview}
	class:has-shiny={hasShiny}
	role="note"
	onpointerenter={(e) => {
		if (e.pointerType === "mouse") onHoverPortrait(e.currentTarget);
	}}
	onpointerleave={onLeavePortrait}
	{...press.props}
>
	<img
		src={portraitUri ?? ""}
		alt={formatPokemonDisplayName(entry)}
		class="portrait-image"
		draggable="false"
		style:transform="scale({portraitScale})"
	/>
	<!-- Below a 760px leaf the identity overlay sits on this fade (CSS shows it
	there only). -->
	<div class="portrait-fade"></div>
	{#if hasShiny}
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
		/* Capped (both axes, so it stays square) for any column wider than
		the box should get. The three columns' identity column is a fixed 240px
		and the rail (#33) 232px, both under this cap, so there the square
		fills the column and shares its left edge. */
		max-width: 260px;
		max-height: 260px;
		align-self: center;
		background:
			radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--pkdx-accent) 24%, transparent), transparent 70%),
			var(--lk-surface-chrome);
		border: 1px solid var(--lk-border);
		border-radius: var(--lk-radius-l);
		/* A held touch must not select text or open iOS's image callout. */
		user-select: none;
		-webkit-touch-callout: none;
	}
	.portrait-image {
		width: 76%;
		height: 76%;
		object-fit: contain;
		image-rendering: pixelated;
		filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--lk-scrim) 60%, transparent));
		transition: width var(--lk-duration-base) var(--lk-ease-standard), height var(--lk-duration-base) var(--lk-ease-standard);
	}
	.portrait-fade {
		display: none;
	}
	.shiny-toggle,
	.portrait-panel :global(.variety-form-toggle) {
		transition: opacity var(--lk-duration-base) var(--lk-ease-standard);
	}
	/* The art alone: toggles out, art grown to fill the box. */
	.art-preview .portrait-image {
		width: 92%;
		height: 92%;
	}
	.art-preview .shiny-toggle,
	.art-preview :global(.variety-form-toggle) {
		opacity: 0;
		pointer-events: none;
	}

	/* Phone hero (#31), below a 760px leaf (the `pane` container): full
	width, 250px tall, the art in its upper part above DetailScreen's identity
	overlay, which sits on a fade into the panel colour. Mega X/Y move to the
	top-left; Gigantamax sits beside the shiny toggle top-right. */
	@container pane (width < 760px) {
		.portrait-panel {
			align-items: flex-start;
			max-width: none;
			max-height: none;
			height: 250px;
			aspect-ratio: auto;
			overflow: hidden;
		}
		.portrait-image {
			width: 100%;
			height: 168px;
			margin-top: 10px;
		}
		.art-preview .portrait-image {
			width: 100%;
			height: 230px;
		}
		.portrait-fade {
			display: block;
			position: absolute;
			inset: auto 0 0;
			height: 110px;
			background: linear-gradient(to bottom, transparent, var(--lk-surface-chrome) 72%);
			pointer-events: none;
			transition: opacity var(--lk-duration-base) var(--lk-ease-standard);
		}
		.art-preview .portrait-fade {
			opacity: 0;
		}
		.portrait-panel :global(.variety-form-toggle) {
			top: 8px;
			bottom: auto;
		}
		.portrait-panel.has-shiny :global(.variety-form-toggle.corner-right) {
			right: 38px;
		}
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
		background: var(--lk-surface);
		border: 1px solid var(--lk-border);
		border-radius: var(--lk-radius-s);
		color: var(--lk-text-muted);
		cursor: pointer;
		box-shadow: var(--lk-shadow-s);
	}
	.shiny-toggle:hover {
		color: var(--lk-text);
		background: var(--lk-surface-hover);
	}
	/* Shiny = gold, a domain cue: the one control coloured by a hue rather than
	the accent (user decision, lhak-style-adoption 07; SPEC story 15 otherwise
	keeps hues for categories). */
	.shiny-toggle.active {
		color: var(--lk-yellow);
		border-color: var(--lk-yellow);
	}
</style>
