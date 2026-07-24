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
// which action (cache vs. refresh) the single action button should perform,
// and the disable-during-run bookkeeping for both it and the delete button.
// Plain, non-reactive (same shape as PokedexLoadState) — presentation
// (ButtonComponent.setDisabled, Notice, icon/desc text) stays the caller's
// job, this class only tracks state and talks to the repository. display()
// wraps its own try/finally around the button disable/enable pairing; run()/
// clear() separately wrap `running` in their own try/finally so a thrown
// repository call never leaves this class's own state stuck mid-operation.
export class GenerationCacheController {
	status: { cached: number; total: number } | null = null;
	running = false;

	constructor(
		private repository: GenerationCacheRepository,
		private range: { start: number; end: number },
	) {}

	// No status yet fetched defaults to "cache" (download icon), same as the
	// pre-extraction code's `isFullyCached = false` initial value — there's
	// nothing worth refreshing until we know something's cached at all.
	get actionKind(): "cache" | "refresh" {
		if (!this.status) return "cache";
		return this.status.total > 0 && this.status.cached === this.status.total ? "refresh" : "cache";
	}

	async refreshStatus(): Promise<void> {
		this.status = await this.repository.getCacheStatus(this.range);
	}

	async run(onProgress?: (loaded: number, total: number) => void): Promise<void> {
		this.running = true;
		try {
			if (this.actionKind === "refresh") {
				await this.repository.refreshRange(this.range, onProgress);
			} else {
				await this.repository.cacheRange(this.range, onProgress);
			}
			await this.refreshStatus();
		} finally {
			this.running = false;
		}
	}

	async clear(): Promise<void> {
		this.running = true;
		try {
			await this.repository.clearRange(this.range);
			await this.refreshStatus();
		} finally {
			this.running = false;
		}
	}
}
