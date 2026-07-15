import { describe, expect, it } from "vitest";
import { formatBytes } from "./formatBytes";

describe("formatBytes", () => {
	it("formats under 1024 bytes as B", () => {
		expect(formatBytes(500)).toBe("500 B");
	});

	it("formats 1024 and above as KB, below 1024 KB", () => {
		expect(formatBytes(1024)).toBe("1.0 KB");
		expect(formatBytes(1536)).toBe("1.5 KB");
	});

	it("formats 1024*1024 and above as MB", () => {
		expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
		expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
	});
});
