import { describe, expect, it } from "vitest";
import { sideAnchoredPreviewPosition } from "./previewPosition";

describe("sideAnchoredPreviewPosition", () => {
	it("centers on the target unshifted when the center fits within the viewport", () => {
		// viewportTop 300, height 20 -> desiredCenter 310, well within [50, 550]
		const result = sideAnchoredPreviewPosition(300, 100, 20, 300, 20, 50, 600);
		expect(result).toEqual({ top: 310, left: 106 });
	});

	it("clamps to halfHeight when the target is near the top of the viewport", () => {
		// viewportTop 10, height 20 -> desiredCenter 20, below halfHeight 50 -> shift up to 50
		const result = sideAnchoredPreviewPosition(10, 100, 20, 10, 20, 50, 600);
		expect(result).toEqual({ top: 50, left: 106 });
	});

	it("clamps to innerHeight - halfHeight when the target is near the bottom of the viewport", () => {
		// viewportTop 590, height 20 -> desiredCenter 600, above 600-50=550 -> shift down to 550
		const result = sideAnchoredPreviewPosition(590, 100, 20, 590, 20, 50, 600);
		expect(result).toEqual({ top: 550, left: 106 });
	});
});
