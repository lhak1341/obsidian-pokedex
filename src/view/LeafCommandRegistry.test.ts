import { describe, expect, it, vi } from "vitest";
import { LeafCommandRegistry } from "./LeafCommandRegistry";

describe("LeafCommandRegistry", () => {
	// BrowseScreen stays mounted under the detail screen, so FilterBar's search
	// is registered there too; Mod+Shift+L once focused every mounted box.
	it("runs only the showing screen's handler", () => {
		const registry = new LeafCommandRegistry();
		const table = vi.fn(() => true);
		const detail = vi.fn(() => true);
		registry.register("table", "focusSearch", table);
		registry.register("detail", "focusSearch", detail);

		expect(registry.run("detail", { kind: "focusSearch" })).toBe(true);
		expect(detail).toHaveBeenCalledTimes(1);
		expect(table).not.toHaveBeenCalled();
	});

	it("reports not handled when no handler is registered, or the handler declines", () => {
		const registry = new LeafCommandRegistry();
		expect(registry.run("detail", { kind: "adjacent", dir: "next" })).toBe(false);
		// An arrow at the end of the dex: the caller must not preventDefault.
		registry.register("detail", "adjacent", () => false);
		expect(registry.run("detail", { kind: "adjacent", dir: "next" })).toBe(false);
	});

	it("passes the command through to the handler", () => {
		const registry = new LeafCommandRegistry();
		const handler = vi.fn(() => true);
		registry.register("detail", "adjacent", handler);
		registry.run("detail", { kind: "adjacent", dir: "prev" });
		expect(handler).toHaveBeenCalledWith({ kind: "adjacent", dir: "prev" });
	});

	// A settings refresh unmounts the old app without awaiting it, so the old
	// screen's cleanup can land after the new screen registered.
	it("keeps a newer handler when an older one unregisters late", () => {
		const registry = new LeafCommandRegistry();
		const unregisterOld = registry.register("detail", "focusSearch", () => true);
		const fresh = vi.fn(() => true);
		registry.register("detail", "focusSearch", fresh);
		unregisterOld();

		expect(registry.run("detail", { kind: "focusSearch" })).toBe(true);
		expect(fresh).toHaveBeenCalledTimes(1);
	});

	it("drops a handler once it unregisters", () => {
		const registry = new LeafCommandRegistry();
		const unregister = registry.register("detail", "focusSearch", () => true);
		unregister();
		expect(registry.run("detail", { kind: "focusSearch" })).toBe(false);
	});
});
