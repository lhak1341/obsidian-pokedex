import type { PortraitRender } from "../data/imageSet";
import type { PokedexRepository } from "../data/PokedexRepository";
import type { GigantamaxFormDetail, MegaFormDetail } from "../data/types";

// Owns which Mega/Gigantamax variety (if any) DetailScreen currently shows,
// and the session-lifetime cache of forms already fetched (refreshed on each
// select, see selectMega). Plain,
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
	// Per variety key, only the newest request's answer is stored, so a form
	// asked for in the old render never lands after a Sprite style switch's
	// newer request. Keyed, not one counter: an answer for another form
	// (Mega, then G-Max before it landed) is still a valid cache fill.
	private requests = new Map<string, number>();

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
	// apply at once.
	//
	// A form already in the cache is still asked for again: its image URLs
	// are blob URLs the repository's LRU may have evicted (and revoked) since,
	// and a revoked URL never loads. The repository answers from memory, so
	// this costs no fetch; the cached detail shows until the fresh one lands.
	//
	// A failed load clears the selection and calls `onFailed` (DetailScreen
	// raises a Notice), so a selected badge always means its form loaded for
	// the current request and one more click retries (the badge's click on a
	// selected form deselects it, so a failure left selected took two). Only
	// the newest request for a still-selected key does this: a failure that
	// lands after a newer click, a switch to the other form or a deselect is
	// dropped, silently. It reverts even with an earlier answer in the cache,
	// whose large images may be revoked blob URLs by then.
	selectMega(key: string | null, render: PortraitRender, onUpdate?: () => void, onFailed?: (key: string) => void): void {
		this.activeMegaKey = key;
		if (key) this.activeGigantamaxKey = null;
		const request = key ? this.nextRequest(key) : 0;
		onUpdate?.();
		if (!key) return;
		this.repository.getMegaForm(key, render).then(
			(detail) => {
				if (request !== this.requests.get(key)) return;
				this.megaFormCache = { ...this.megaFormCache, [key]: detail };
				onUpdate?.();
			},
			() => {
				if (request !== this.requests.get(key) || this.activeMegaKey !== key) return;
				this.activeMegaKey = null;
				onUpdate?.();
				onFailed?.(key);
			},
		);
	}

	// A Sprite style switch: the selected form asks again for its images in
	// the new render (the repository answers from memory for everything else),
	// superseding any select still in flight.
	reselect(render: PortraitRender, onUpdate?: () => void, onFailed?: (key: string) => void): void {
		if (this.activeMegaKey) this.selectMega(this.activeMegaKey, render, onUpdate, onFailed);
		else if (this.activeGigantamaxKey) this.selectGigantamax(this.activeGigantamaxKey, render, onUpdate, onFailed);
	}

	selectGigantamax(key: string | null, render: PortraitRender, onUpdate?: () => void, onFailed?: (key: string) => void): void {
		this.activeGigantamaxKey = key;
		if (key) this.activeMegaKey = null;
		const request = key ? this.nextRequest(key) : 0;
		onUpdate?.();
		if (!key) return;
		this.repository.getGigantamaxForm(key, render).then(
			(detail) => {
				if (request !== this.requests.get(key)) return;
				this.gigantamaxFormCache = { ...this.gigantamaxFormCache, [key]: detail };
				onUpdate?.();
			},
			() => {
				if (request !== this.requests.get(key) || this.activeGigantamaxKey !== key) return;
				this.activeGigantamaxKey = null;
				onUpdate?.();
				onFailed?.(key);
			},
		);
	}

	private nextRequest(key: string): number {
		const request = (this.requests.get(key) ?? 0) + 1;
		this.requests.set(key, request);
		return request;
	}
}
