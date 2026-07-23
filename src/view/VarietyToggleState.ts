import type { PokedexRepository } from "../data/PokedexRepository";
import type { GigantamaxFormDetail, MegaFormDetail } from "../data/types";

// Owns which Mega/Gigantamax variety (if any) DetailScreen currently shows,
// and the session-lifetime cache of forms already fetched. Plain,
// non-reactive class (same shape as DetailLoadState/DetailNavigationState) —
// DetailScreen mirrors these fields into its own $state after every
// onUpdate, since Svelte 5's $state only deep-proxies plain objects/arrays,
// not class instances. One instance is reused across id changes, same
// reasoning as DetailLoadState: resetSelection() clears the active
// selection per entry, but never the caches, since a variety key (e.g.
// "charizard-mega-x") is globally unique and never collides across species.
export interface VarietyToggleSnapshot {
	activeMegaKey: string | null;
	activeGigantamaxKey: string | null;
	megaFormCache: Record<string, MegaFormDetail>;
	gigantamaxFormCache: Record<string, GigantamaxFormDetail>;
}

export class VarietyToggleState {
	activeMegaKey: string | null = null;
	activeGigantamaxKey: string | null = null;
	megaFormCache: Record<string, MegaFormDetail> = {};
	gigantamaxFormCache: Record<string, GigantamaxFormDetail> = {};

	constructor(private repository: PokedexRepository) {}

	snapshot(): VarietyToggleSnapshot {
		return {
			activeMegaKey: this.activeMegaKey,
			activeGigantamaxKey: this.activeGigantamaxKey,
			megaFormCache: this.megaFormCache,
			gigantamaxFormCache: this.gigantamaxFormCache,
		};
	}

	// Clears the active selection (so switching Pokemon never leaves a
	// previous one's Mega/Gigantamax toggle silently applied) without
	// touching either cache — called from DetailScreen's startLoad, same
	// spot showShiny resets.
	resetSelection(): void {
		this.activeMegaKey = null;
		this.activeGigantamaxKey = null;
	}

	// Mega and Gigantamax are mutually exclusive in-game (see DetailScreen's
	// own comment) — selecting one clears the other rather than letting both
	// apply at once. Fetch is fire-and-forget and swallowed on failure: a
	// dropped connection just means the toggle silently doesn't populate
	// until a retry click succeeds, same as a dropped shiny/artwork fetch
	// elsewhere in this view not taking down the rest of the entry — but
	// swallowed explicitly now, rather than left as an unhandled rejection.
	selectMega(key: string | null, onUpdate?: () => void): void {
		this.activeMegaKey = key;
		if (key) this.activeGigantamaxKey = null;
		onUpdate?.();
		if (key && !(key in this.megaFormCache)) {
			this.repository
				.getMegaForm(key)
				.then((detail) => {
					this.megaFormCache = { ...this.megaFormCache, [key]: detail };
					onUpdate?.();
				})
				.catch(() => undefined);
		}
	}

	selectGigantamax(key: string | null, onUpdate?: () => void): void {
		this.activeGigantamaxKey = key;
		if (key) this.activeMegaKey = null;
		onUpdate?.();
		if (key && !(key in this.gigantamaxFormCache)) {
			this.repository
				.getGigantamaxForm(key)
				.then((detail) => {
					this.gigantamaxFormCache = { ...this.gigantamaxFormCache, [key]: detail };
					onUpdate?.();
				})
				.catch(() => undefined);
		}
	}
}
