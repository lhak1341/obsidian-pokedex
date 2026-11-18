import { describe, expect, it } from "vitest";
import { dataUriFromBuffer } from "./dataUri";

describe("dataUriFromBuffer", () => {
	it("picks the MIME type from the key's extension, png by default", () => {
		const buffer = new Uint8Array([1, 2, 3, 4]).buffer;

		expect(dataUriFromBuffer("images/1-sprite.png", buffer)).toBe("data:image/png;base64,AQIDBA==");
		expect(dataUriFromBuffer("images/1-artwork.jpg", buffer)).toMatch(/^data:image\/jpeg;base64,/);
		expect(dataUriFromBuffer("images/1-artwork.jpeg", buffer)).toMatch(/^data:image\/jpeg;base64,/);
		expect(dataUriFromBuffer("images/1-artwork.webp", buffer)).toMatch(/^data:image\/png;base64,/);
	});

	it("encodes a buffer spanning multiple base64 chunks byte-for-byte", () => {
		// Larger than BASE64_CHUNK_SIZE (0x8000) so the chunked loop in
		// arrayBufferToBase64 has to stitch together more than one chunk —
		// exercises the boundary rather than the single-chunk case.
		const bytes = new Uint8Array(0x8000 * 2 + 137);
		for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;

		const base64 = dataUriFromBuffer("images/1-artwork.png", bytes.buffer).split(",")[1] ?? "";
		const decoded = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

		expect(decoded).toEqual(bytes);
	});
});
