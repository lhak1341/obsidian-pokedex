import { describe, expect, it } from "vitest";
import { mimeOf } from "./mime";

describe("mimeOf", () => {
	it("picks the MIME type from the key's extension, png by default", () => {
		expect(mimeOf("images/1-sprite.png")).toBe("image/png");
		expect(mimeOf("images/1-artwork.jpg")).toBe("image/jpeg");
		expect(mimeOf("images/1-artwork.JPEG")).toBe("image/jpeg");
		expect(mimeOf("images/1-artwork.webp")).toBe("image/png");
	});
});
