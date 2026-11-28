import { describe, expect, it } from "vitest";
import { artPreviewPosition, infoPopoverPosition, MIN_SPACE_BELOW, type Rect } from "./overlayPosition";

// A viewport-relative rect: `top`, `height` and `left` given, the rest
// derived.
function rect(top: number, height: number, left = 0, width = 0): Rect {
	return { top, bottom: top + height, left, right: left + width, height };
}

describe("artPreviewPosition", () => {
	it("centers on the target unshifted when the center fits within the band", () => {
		// desiredCenter 310, well within [50, 550]
		const m = { target: rect(300, 20, 0, 100), root: rect(0, 0), band: { top: 0, bottom: 600 } };
		expect(artPreviewPosition(m, 50)).toEqual({ top: 310, left: 106 });
	});

	it("clamps to the band's top + halfHeight when the target is near the band's top", () => {
		// desiredCenter 20, below halfHeight 50 -> shift down to 50
		const m = { target: rect(10, 20, 0, 100), root: rect(0, 0), band: { top: 0, bottom: 600 } };
		expect(artPreviewPosition(m, 50)).toEqual({ top: 50, left: 106 });
	});

	it("clamps to the band's bottom - halfHeight when the target is near the band's bottom", () => {
		// desiredCenter 600, past 600-50=550 -> shift up to 550
		const m = { target: rect(590, 20, 0, 100), root: rect(0, 0), band: { top: 0, bottom: 600 } };
		expect(artPreviewPosition(m, 50)).toEqual({ top: 550, left: 106 });
	});

	// A leaf in the top half of a split: its scroller ends at 403 while the
	// window runs to 870, and the scroller clips the preview (probed live).
	it("clamps against a band that ends well above the window", () => {
		// desiredCenter 360 + 96 runs past 403 -> center 307, shift -53;
		// root at 90, so 250 + 20 - 53 against it
		const m = { target: rect(340, 40, 0, 100), root: rect(90, 0), band: { top: 88, bottom: 403 } };
		expect(artPreviewPosition(m, 96)).toEqual({ top: 217, left: 106 });
	});

	// A leaf in the bottom half: the band starts below the window's top.
	it("clamps against a band that starts well below the window's top", () => {
		// desiredCenter 520, under 475 + 96 = 571 -> shift +51; root at 470
		const m = { target: rect(500, 40, 0, 100), root: rect(470, 0), band: { top: 475, bottom: 830 } };
		expect(artPreviewPosition(m, 96)).toEqual({ top: 101, left: 106 });
	});

	it("re-bases its left edge against the root's left", () => {
		const m = { target: rect(300, 20, 250, 100), root: rect(0, 0, 40), band: { top: 0, bottom: 600 } };
		expect(artPreviewPosition(m, 50).left).toBe(250 + 100 - 40 + 6);
	});

	it("places against the viewport's origin while the root is unbound", () => {
		const m = { target: rect(300, 20, 250, 100), root: undefined, band: { top: 0, bottom: 600 } };
		expect(artPreviewPosition(m, 50)).toEqual({ top: 310, left: 356 });
	});
});

describe("infoPopoverPosition", () => {
	const band = { top: 90, bottom: 838 };

	it("opens below with exactly MIN_SPACE_BELOW of room", () => {
		const target = rect(band.bottom - MIN_SPACE_BELOW - 20, 20);
		expect(infoPopoverPosition({ target, root: undefined, band }, 6).side).toBe("below");
	});

	it("flips above with one pixel less room", () => {
		const target = rect(band.bottom - MIN_SPACE_BELOW - 20 + 1, 20);
		expect(infoPopoverPosition({ target, root: undefined, band }, 6).side).toBe("above");
	});

	// Room is the band's, not the window's: the top half of a split ends at 403.
	it("flips against a band that ends well above the window", () => {
		const target = rect(300, 28);
		expect(infoPopoverPosition({ target, root: undefined, band: { top: 88, bottom: 403 } }, 6).side).toBe("above");
		expect(infoPopoverPosition({ target, root: undefined, band: { top: 88, bottom: 870 } }, 6).side).toBe("below");
	});

	it("below: under the target's bottom-left by offsetY, re-based against the root", () => {
		const m = { target: rect(200, 30, 400), root: rect(80, 500, 30), band };
		expect(infoPopoverPosition(m, 6)).toEqual({ top: 230 - 80 + 6, left: 370, side: "below" });
	});

	it("above: at the target's top-left less offsetY, re-based against the root", () => {
		const m = { target: rect(780, 30, 400), root: rect(80, 500, 30), band };
		expect(infoPopoverPosition(m, 6)).toEqual({ top: 780 - 80 - 6, left: 370, side: "above" });
	});

	it("places against the viewport's origin while the root is unbound", () => {
		const m = { target: rect(200, 30, 400), root: undefined, band };
		expect(infoPopoverPosition(m, 4)).toEqual({ top: 234, left: 400, side: "below" });
	});
});
