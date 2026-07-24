import { describe, expect, it, vi } from "vitest";
import { GenerationCacheController, type GenerationCacheRepository } from "./GenerationCacheController";

function makeRepository(overrides: Partial<GenerationCacheRepository> = {}): GenerationCacheRepository {
	return {
		getCacheStatus: vi.fn().mockResolvedValue({ cached: 0, total: 3 }),
		cacheRange: vi.fn().mockResolvedValue(undefined),
		refreshRange: vi.fn().mockResolvedValue(undefined),
		clearRange: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("GenerationCacheController", () => {
	it("actionKind defaults to cache before status is loaded", () => {
		const controller = new GenerationCacheController(makeRepository(), { start: 1, end: 3 });
		expect(controller.actionKind).toBe("cache");
	});

	it("refreshStatus() sets actionKind to refresh once fully cached", async () => {
		const repository = makeRepository({
			getCacheStatus: vi.fn().mockResolvedValue({ cached: 3, total: 3 }),
		});
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });

		await controller.refreshStatus();

		expect(controller.status).toEqual({ cached: 3, total: 3 });
		expect(controller.actionKind).toBe("refresh");
	});

	it("actionKind stays cache when partially cached", async () => {
		const repository = makeRepository({
			getCacheStatus: vi.fn().mockResolvedValue({ cached: 1, total: 3 }),
		});
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });

		await controller.refreshStatus();

		expect(controller.actionKind).toBe("cache");
	});

	it("run() calls cacheRange when not fully cached, then refreshes status", async () => {
		const repository = makeRepository({
			getCacheStatus: vi.fn().mockResolvedValue({ cached: 3, total: 3 }),
		});
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });

		await controller.run();

		expect(repository.cacheRange).toHaveBeenCalledWith({ start: 1, end: 3 }, undefined);
		expect(repository.refreshRange).not.toHaveBeenCalled();
		expect(repository.getCacheStatus).toHaveBeenCalledTimes(1);
	});

	it("run() calls refreshRange once actionKind is refresh", async () => {
		const repository = makeRepository();
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });
		controller.status = { cached: 3, total: 3 };

		await controller.run();

		expect(repository.refreshRange).toHaveBeenCalledWith({ start: 1, end: 3 }, undefined);
		expect(repository.cacheRange).not.toHaveBeenCalled();
	});

	it("run() resets running to false even when the repository call rejects", async () => {
		const repository = makeRepository({
			cacheRange: vi.fn().mockRejectedValue(new Error("network down")),
		});
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });

		await expect(controller.run()).rejects.toThrow("network down");

		expect(controller.running).toBe(false);
	});

	it("clear() calls clearRange, refreshes status, and resets running on throw", async () => {
		const repository = makeRepository({
			clearRange: vi.fn().mockRejectedValue(new Error("disk error")),
		});
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });

		await expect(controller.clear()).rejects.toThrow("disk error");

		expect(controller.running).toBe(false);
		expect(repository.getCacheStatus).not.toHaveBeenCalled();
	});

	it("clear() refreshes status after a successful clear", async () => {
		const repository = makeRepository();
		const controller = new GenerationCacheController(repository, { start: 1, end: 3 });

		await controller.clear();

		expect(repository.clearRange).toHaveBeenCalledWith({ start: 1, end: 3 });
		expect(repository.getCacheStatus).toHaveBeenCalledTimes(1);
	});
});
