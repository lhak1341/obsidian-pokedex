import { describe, expect, it } from "vitest";
import { describeHoverStatus } from "./hoverDescriptionText";

describe("describeHoverStatus", () => {
	it("reads Loading… before the description has been requested or returned", () => {
		expect(describeHoverStatus(undefined)).toBe("Loading…");
	});

	it("reports a failed fetch", () => {
		expect(describeHoverStatus("error")).toBe("Couldn't load description.");
	});

	it("returns the fetched text", () => {
		expect(describeHoverStatus({ text: "Raises Speed." })).toBe("Raises Speed.");
	});

	it("rewrites Pokédollars to the ₱ sign", () => {
		expect(describeHoverStatus({ text: "Sell for 5000 Pokédollars." })).toBe("Sell for ₱5000.");
	});

	it("treats null and empty text as missing", () => {
		expect(describeHoverStatus({ text: null })).toBe("No description available.");
		expect(describeHoverStatus({ text: "" })).toBe("No description available.");
	});
});
