// Where an Info popover or an Art preview goes (CONTEXT.md), from rects
// already read off the DOM by view/domPosition.ts's measureOverlay: the
// target's, its screen's root's (the positioning root, getScreenRoot) and the
// Visible band's. All three are viewport-relative; each rule decides on-screen
// room in those coordinates and only then re-bases its answer against the
// root, since both boxes are `position: absolute` inside it (Obsidian's
// `.workspace-leaf` has `contain: strict`, which makes it the containing
// block for a `position: fixed` box, so a fixed box placed from a raw
// viewport rect lands off by the tab bar's height). Pure and DOM-free so the
// flip and the clamp are tested here; which band and which window the rects
// come from is the reader's (measureOverlay, visibleBand).

// The parts of a DOMRect the rules read, so measureOverlay hands
// getBoundingClientRect() over as it is and a test passes a plain object.
export interface Rect {
	top: number;
	bottom: number;
	left: number;
	right: number;
	height: number;
}

// The Visible band: viewport-relative top and bottom of the room a box may
// use (view/domPosition.ts's visibleBand).
export interface Band {
	top: number;
	bottom: number;
}

// `root` undefined (not yet bound) places against the viewport's origin.
export interface OverlayMeasure {
	target: Rect;
	root: Rect | undefined;
	band: Band;
}

export type InfoPopoverSide = "below" | "above";

export interface InfoPopoverPosition {
	top: number;
	left: number;
	side: InfoPopoverSide;
}

// Below this much room (px) between the target's bottom edge and the bottom
// of the Visible band, a popover underneath would run off the band (or under
// Obsidian's status bar), so it opens above the target instead. A fixed
// threshold rather than the popover's rendered height, which is only known
// after it renders, while this decision is made before anything is drawn.
export const MIN_SPACE_BELOW = 120;

// The Info popover's corner: under the target's bottom-left, or, short of
// MIN_SPACE_BELOW, at its top-left. Above, it is anchored to the target's own
// top edge, not "top - popover height" (unknown here): it grows upward from
// that point via `transform: translateY(-100%)` in InfoPopoverBox's CSS.
export function infoPopoverPosition(m: OverlayMeasure, offsetY: number): InfoPopoverPosition {
	const room = m.band.bottom - m.target.bottom;
	const side: InfoPopoverSide = room < MIN_SPACE_BELOW ? "above" : "below";
	const rootTop = m.root?.top ?? 0;
	const left = m.target.left - (m.root?.left ?? 0);
	return side === "below"
		? { top: m.target.bottom - rootTop + offsetY, left, side }
		: { top: m.target.top - rootTop - offsetY, left, side };
}

const PREVIEW_LEFT_OFFSET = 6;

// The Art preview's anchor: right of the target, vertically centred on it,
// with that centre clamped into the Visible band so a target near the band's
// top or bottom edge does not centre the preview off it. The preview is
// centred on its anchor by `translateY(-50%)`; `halfHeight` is half its
// fixed height (TableGrid's sprite preview, DetailScreen's portrait preview).
export function artPreviewPosition(m: OverlayMeasure, halfHeight: number): { top: number; left: number } {
	const { target, band } = m;
	const desiredCenter = target.top + target.height / 2;
	const clampedCenter = Math.min(Math.max(desiredCenter, band.top + halfHeight), band.bottom - halfHeight);
	const shift = clampedCenter - desiredCenter;
	return {
		top: target.top - (m.root?.top ?? 0) + target.height / 2 + shift,
		left: target.right - (m.root?.left ?? 0) + PREVIEW_LEFT_OFFSET,
	};
}
