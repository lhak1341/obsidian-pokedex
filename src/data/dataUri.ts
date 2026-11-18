const MIME_BY_EXT: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
};

function extOf(path: string): string {
	return path.split(".").pop()?.toLowerCase() ?? "png";
}

// 0x8000 bytes/call comfortably avoids blowing the engine's call-stack limit
// on String.fromCharCode's spread args (unlike a single call over the whole
// buffer), while still converting in large chunks instead of one
// function-call-plus-concat per byte — most noticeable on the official
// artwork/shiny images (detail view), which run tens of KB versus a sprite's
// few KB.
const BASE64_CHUNK_SIZE = 0x8000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
		binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
	}
	return btoa(binary);
}

// Every cached image reaches the UI as a data URI. Encoded by the repository
// from the bytes a CacheStore returns, not by the store, so a store deals
// only in bytes (see CacheStore.ts).
export function dataUriFromBuffer(relPath: string, buffer: ArrayBuffer): string {
	const mime = MIME_BY_EXT[extOf(relPath)] ?? "image/png";
	return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
}
