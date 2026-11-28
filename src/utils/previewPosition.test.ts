import { describe, expect, it } from "vitest";
import { sideAnchoredPreviewPosition } from "./previewPosition";

describe("sideAnchoredPreviewPosition", () => {
	it("centers on the target unshifted when the center fits within the viewport", () => {
		// viewportTop 300, height 20 -> desiredCenter 310, well within [50, 550]
		const result = sideAnchoredPreviewPosition(300, 100, 20, 300, 20, 50, { top: 0, bottom: 600 });
		expect(result).toEqual({ top: 310, left: 106 });
	});

	it("clamps to the band's top + halfHeight when the target is near the band's top", () => {
		// viewportTop 10, height 20 -> desiredCenter 20, below halfHeight 50 -> shift down to 50
		const result = sideAnchoredPreviewPosition(10, 100, 20, 10, 20, 50, { top: 0, bottom: 600 });
		expect(result).toEqual({ top: 50, left: 106 });
	});

	it("clamps to the band's bottom - halfHeight when the target is near the band's bottom", () => {
		// viewportTop 590, height 20 -> desiredCenter 600, past 600-50=550 -> shift up to 550
		const result = sideAnchoredPreviewPosition(590, 100, 20, 590, 20, 50, { top: 0, bottom: 600 });
		expect(result).toEqual({ top: 550, left: 106 });
	});

	// A leaf in the top half of a split: its scroller ends at 403 while the
	// window runs to 870, and the scroller clips the preview (probed live).
	it("clamps against a band that ends well above the window", () => {
		// desiredCenter 360 + 96 runs past 403 -> center 307, shift -53
		const result = sideAnchoredPreviewPosition(250, 100, 40, 340, 40, 96, { top: 88, bottom: 403 });
		expect(result).toEqual({ top: 217, left: 106 });
	});

	// A leaf in the bottom half: the band starts below the window's top.
	it("clamps against a band that starts well below the window's top", () => {
		// desiredCenter 520, under 475 + 96 = 571 -> shift +51
		const result = sideAnchoredPreviewPosition(30, 100, 40, 500, 40, 96, { top: 475, bottom: 830 });
		expect(result).toEqual({ top: 101, left: 106 });
	});
});
