// Some official-artwork PNGs (PokeAPI's `other.official-artwork` sprites)
// crop shinier and non-shiny renders of the same species differently — e.g.
// Mega Houndoom's shiny artwork bounding-boxes to ~31% more area inside the
// same 475x475 canvas than its default artwork (confirmed by decoding both
// PNGs and comparing non-transparent bounding boxes across all 97 Mega
// varieties live from PokeAPI). Since DetailScreen.svelte's portrait box
// scales both into the same fixed square via object-fit: contain, that
// upstream crop difference shows up as a real "shiny looks bigger" visual —
// nothing wrong in this plugin's own fetch/cache/render path. contentScale
// gives DetailScreen a per-image "how much of its own canvas does the
// character actually fill" number so it can shrink the outlier back down to
// match its non-shiny counterpart (see DetailScreen's portraitScale).
const cache = new Map<string, Promise<number>>();

function decode(dataUri: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve(1);
				return;
			}
			ctx.drawImage(img, 0, 0);
			const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
			let minX = canvas.width;
			let minY = canvas.height;
			let maxX = -1;
			let maxY = -1;
			for (let y = 0; y < canvas.height; y++) {
				for (let x = 0; x < canvas.width; x++) {
					const alpha = data[(y * canvas.width + x) * 4 + 3];
					if (alpha > 10) {
						if (x < minX) minX = x;
						if (x > maxX) maxX = x;
						if (y < minY) minY = y;
						if (y > maxY) maxY = y;
					}
				}
			}
			if (maxX < 0) {
				resolve(1);
				return;
			}
			const contentSize = Math.max(maxX - minX + 1, maxY - minY + 1);
			const canvasSize = Math.max(canvas.width, canvas.height);
			resolve(contentSize / canvasSize);
		};
		img.onerror = () => reject(new Error("image decode failed"));
		img.src = dataUri;
	});
}

// Memoized per data URI (a session-stable string, same identity as the
// mem/disk cache it came from) — avoids re-decoding the same PNG's pixels
// every time a shiny toggle flips back and forth.
export function contentScale(dataUri: string): Promise<number> {
	let pending = cache.get(dataUri);
	if (!pending) {
		pending = decode(dataUri);
		cache.set(dataUri, pending);
	}
	return pending;
}
