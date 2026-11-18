const MIME_BY_EXT: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
};

// A cached image's MIME type from its key's extension, png by default. Shared
// by IndexedDbCacheStore's stored type and ImageMemory's Blob type.
export function mimeOf(path: string): string {
	return MIME_BY_EXT[path.split(".").pop()?.toLowerCase() ?? ""] ?? "image/png";
}
