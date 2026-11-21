import { describe, expect, it, vi } from "vitest";
import type { PortraitRender } from "../data/imageSet";
import { GenerationCacheController, type GenerationCacheRepository } from "./GenerationCacheController";

const GEN = { id: 1, name: "Test Gen", start: 1, end: 3 };
const artwork = (): PortraitRender => "official-artwork";

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
		const controller = new GenerationCacheController(makeRepository(), GEN, artwork);
		expect(controller.actionKind).toBe("cache");
	});

	it("refreshStatus() sets actionKind to refresh once fully cached", async () => {
		const repository = makeRepository({
			getCacheStatus: vi.fn().mockResolvedValue({ cached: 3, total: 3 }),
		});
		const controller = new GenerationCacheController(repository, GEN, artwork);

		await controller.refreshStatus();

		expect(controller.status).toEqual({ cached: 3, total: 3 });
		expect(controller.actionKind).toBe("refresh");
	});

	it("actionKind stays cache when partially cached", async () => {
		const repository = makeRepository({
			getCacheStatus: vi.fn().mockResolvedValue({ cached: 1, total: 3 }),
		});
		const controller = new GenerationCacheController(repository, GEN, artwork);

		await controller.refreshStatus();

		expect(controller.actionKind).toBe("cache");
	});

	it("run() calls cacheRange when not fully cached, then refreshes status", async () => {
		const repository = makeRepository({
			getCacheStatus: vi.fn().mockResolvedValue({ cached: 3, total: 3 }),
		});
		const controller = new GenerationCacheController(repository, GEN, artwork);

		await controller.run();

		expect(repository.cacheRange).toHaveBeenCalledWith(
			GEN,
			"official-artwork",
			undefined,
			undefined,
		);
		expect(repository.refreshRange).not.toHaveBeenCalled();
		expect(repository.getCacheStatus).toHaveBeenCalledTimes(1);
	});

	it("reads the render on every call, so a Sprite style switch reaches the next status and run", async () => {
		const repository = makeRepository();
		let render: PortraitRender = "official-artwork";
		const controller = new GenerationCacheController(repository, GEN, () => render);

		await controller.refreshStatus();
		render = "home";
		await controller.refreshStatus();
		await controller.run();

		expect(vi.mocked(repository.getCacheStatus).mock.calls.map(([, r]) => r)).toEqual([
			"official-artwork",
			"home",
			"home",
		]);
		expect(repository.cacheRange).toHaveBeenCalledWith(GEN, "home", undefined, undefined);
	});

	it("run() calls refreshRange once actionKind is refresh", async () => {
		const repository = makeRepository();
		const controller = new GenerationCacheController(repository, GEN, artwork);
		controller.status = { cached: 3, total: 3 };

		await controller.run();

		expect(repository.refreshRange).toHaveBeenCalledWith(
			GEN,
			"official-artwork",
			undefined,
			undefined,
		);
		expect(repository.cacheRange).not.toHaveBeenCalled();
	});

	it("run() forwards isCancelled through to cacheRange/refreshRange", async () => {
		const repository = makeRepository();
		const controller = new GenerationCacheController(repository, GEN, artwork);
		const isCancelled = () => true;

		await controller.run(undefined, isCancelled);

		expect(repository.cacheRange).toHaveBeenCalledWith(
			GEN,
			"official-artwork",
			undefined,
			isCancelled,
		);

		controller.status = { cached: 3, total: 3 };
		await controller.run(undefined, isCancelled);

		expect(repository.refreshRange).toHaveBeenCalledWith(
			GEN,
			"official-artwork",
			undefined,
			isCancelled,
		);
	});

	it("run() propagates a rejected repository call without refreshing status", async () => {
		const repository = makeRepository({
			cacheRange: vi.fn().mockRejectedValue(new Error("network down")),
		});
		const controller = new GenerationCacheController(repository, GEN, artwork);

		await expect(controller.run()).rejects.toThrow("network down");

		expect(repository.getCacheStatus).not.toHaveBeenCalled();
	});

	it("clear() propagates a rejected clearRange without refreshing status", async () => {
		const repository = makeRepository({
			clearRange: vi.fn().mockRejectedValue(new Error("disk error")),
		});
		const controller = new GenerationCacheController(repository, GEN, artwork);

		await expect(controller.clear()).rejects.toThrow("disk error");

		expect(repository.getCacheStatus).not.toHaveBeenCalled();
	});

	it("clear() refreshes status after a successful clear", async () => {
		const repository = makeRepository();
		const controller = new GenerationCacheController(repository, GEN, artwork);

		await controller.clear();

		expect(repository.clearRange).toHaveBeenCalledWith(GEN);
		expect(repository.getCacheStatus).toHaveBeenCalledTimes(1);
	});
});
