import type { ContentBounds } from "../utils/cardView";
import { memoizeByCachePath } from "../utils/memoizeByCachePath";

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
// match its non-shiny counterpart (see resolvePortraitScale in utils/portrait.ts).
// The same decode serves Card view's tile (cardView.ts fitSprite), which
// centres a sprite on its opaque box rather than its canvas. null: nothing
// opaque in the image.
function decode(url: string): Promise<ContentBounds | null> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve(null);
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
				resolve(null);
				return;
			}
			resolve({
				x: minX,
				y: minY,
				width: maxX - minX + 1,
				height: maxY - minY + 1,
				canvasWidth: canvas.width,
				canvasHeight: canvas.height,
			});
		};
		img.onerror = () => reject(new Error("image decode failed"));
		img.src = url;
	});
}

// Memoized by image cache path, never by URL (see memoizeByCachePath).
export const contentBounds = memoizeByCachePath(decode);

// How much of its own canvas the content fills (1 when nothing is opaque, or
// no 2D context): the portrait's shrink-only correction reads this.
export function contentScale(cachePath: string, url: string): Promise<number> {
	return contentBounds(cachePath, url).then((b) =>
		b ? Math.max(b.width, b.height) / Math.max(b.canvasWidth, b.canvasHeight) : 1
	);
}
