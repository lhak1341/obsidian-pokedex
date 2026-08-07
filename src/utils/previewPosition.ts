// Side-anchored hover-preview positioning: given a target's already-computed
// container-relative rect plus its viewport-relative top/height, clamp the
// preview's vertical center into the visible viewport (so a target near the
// top/bottom edge doesn't center the preview off-screen), then express the
// result back in the caller's container-relative coordinate space. Shared by
// TableScreen's sprite preview and DetailScreen's portrait preview — same
// side-anchored-with-vertical-clamp shape, different fixed preview height
// (halfHeight) and container. Pure/DOM-free on purpose: everything here runs
// on numbers already read from the DOM by the caller (see
// view/domPosition.ts's computeSideAnchoredPreviewPosition), not on
// HTMLElement/getBoundingClientRect itself.
const PREVIEW_LEFT_OFFSET = 6;

export function sideAnchoredPreviewPosition(
	rectTop: number,
	rectRight: number,
	rectHeight: number,
	viewportTop: number,
	viewportHeight: number,
	halfHeight: number,
	windowInnerHeight: number,
): { top: number; left: number } {
	const desiredCenter = viewportTop + viewportHeight / 2;
	const clampedCenter = Math.min(Math.max(desiredCenter, halfHeight), windowInnerHeight - halfHeight);
	const shift = clampedCenter - desiredCenter;
	return { top: rectTop + rectHeight / 2 + shift, left: rectRight + PREVIEW_LEFT_OFFSET };
}
