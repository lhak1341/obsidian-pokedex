import type { PluginSettings } from "../data/types";
import { type BrowseLayout, chooseLayout, type WidthClass } from "./browseLayout";
import type { CardSize } from "./cardView";

// The preferences the browse and detail screens change in place: favourites,
// the two Fields selections (the table's and Card view's, ADR-0020), and the
// layout and Card size per width class (ADR-0012). They bypass
// PokedexPlugin.saveSettings: every leaf reads them from this holder's
// subscription, not from the settings copy saveSettings pushes into each app.
//
// One holder per plugin, shared by every open Pokedex leaf. Each write starts
// from the plugin's live settings, never a leaf's copy, and every subscriber
// hears about it: with a sidebar leaf beside a main one, a favourite toggled
// in either shows in both, and neither saves over the other (both happened
// when each leaf kept its own copy).
export type LocalPreferenceValues = Pick<
	PluginSettings,
	"favoritePokemonIds" | "visibleFields" | "cardFields" | "layoutByWidthClass" | "cardSizeByWidthClass"
>;

type Listener = (values: LocalPreferenceValues) => void;

export class LocalPreferences {
	private listeners = new Set<Listener>();

	// `settings` is a getter, not the object: loadSettings replaces the
	// plugin's settings object, and writes must land on the current one.
	constructor(
		private settings: () => LocalPreferenceValues,
		private save: () => Promise<void> | void,
	) {}

	get(): LocalPreferenceValues {
		const { favoritePokemonIds, visibleFields, cardFields, layoutByWidthClass, cardSizeByWidthClass } = this.settings();
		return { favoritePokemonIds, visibleFields, cardFields, layoutByWidthClass, cardSizeByWidthClass };
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	toggleFavorite(id: number): void {
		const s = this.settings();
		s.favoritePokemonIds = toggled(s.favoritePokemonIds, id);
		this.changed();
	}

	toggleField(key: string): void {
		const s = this.settings();
		s.visibleFields = toggled(s.visibleFields, key);
		this.changed();
	}

	toggleCardField(key: string): void {
		const s = this.settings();
		s.cardFields = toggled(s.cardFields, key);
		this.changed();
	}

	setLayout(widthClass: WidthClass, layout: BrowseLayout): void {
		const s = this.settings();
		s.layoutByWidthClass = chooseLayout(s.layoutByWidthClass, widthClass, layout);
		this.changed();
	}

	setCardSize(widthClass: WidthClass, size: CardSize): void {
		const s = this.settings();
		s.cardSizeByWidthClass = { ...s.cardSizeByWidthClass, [widthClass]: size };
		this.changed();
	}

	private changed(): void {
		void this.save();
		const values = this.get();
		for (const listener of this.listeners) listener(values);
	}
}

// A new array (so a Svelte $state reassignment sees the change), with `item`
// removed if present, else appended.
function toggled<T>(list: readonly T[], item: T): T[] {
	return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
