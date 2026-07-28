import type { Generation } from "../data/constants";
import type { PokedexRepository } from "../data/PokedexRepository";

// The 4 repository methods the Settings tab's per-generation cache/refresh/
// delete buttons drive — narrowed from the full PokedexRepository so this
// class's own tests can stub just these, rather than standing up a real
// repository/disk-cache/network-fake stack to exercise orchestration logic
// that never actually touches caching or network behavior itself.
export type GenerationCacheRepository = Pick<
	PokedexRepository,
	"getCacheStatus" | "cacheRange" | "refreshRange" | "clearRange"
>;

// Owns the Settings tab's per-generation cache-status/action-button state:
// which action (cache vs. refresh) the single action button should perform.
// Plain, non-reactive (same shape as PokedexLoadState) — presentation
// (ButtonComponent.setDisabled, Notice, icon/desc text, and the
// disable-during-run bookkeeping for both buttons) stays the caller's job,
// this class only tracks state and talks to the repository.
export class GenerationCacheController {
	status: { cached: number; total: number } | null = null;

	constructor(
		private repository: GenerationCacheRepository,
		private generation: Generation,
	) {}

	// No status yet fetched defaults to "cache" (download icon), same as the
	// pre-extraction code's `isFullyCached = false` initial value — there's
	// nothing worth refreshing until we know something's cached at all.
	get actionKind(): "cache" | "refresh" {
		if (!this.status) return "cache";
		return this.status.total > 0 && this.status.cached === this.status.total ? "refresh" : "cache";
	}

	async refreshStatus(): Promise<void> {
		this.status = await this.repository.getCacheStatus(this.generation);
	}

	async run(onProgress?: (loaded: number, total: number) => void): Promise<void> {
		if (this.actionKind === "refresh") {
			await this.repository.refreshRange(this.generation, onProgress);
		} else {
			await this.repository.cacheRange(this.generation, onProgress);
		}
		await this.refreshStatus();
	}

	async clear(): Promise<void> {
		await this.repository.clearRange(this.generation);
		await this.refreshStatus();
	}
}
