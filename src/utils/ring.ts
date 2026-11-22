// The dial both Capture & Breeding rings draw (Ring.svelte, GenderRing.svelte):
// a 44px circle with a 5px stroke. Each component keeps its own markup,
// colours, caps and text (ADR-0018); only the geometry lives here.
export const RING_SIZE = 44;
export const RING_STROKE = 5;
export const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

// How much of a Capture & Breeding ring (Ring.svelte) is drawn: value/max,
// clamped to [0, 1] so an out-of-range value never overdraws the circle.
export function ringFill(value: number, max: number): number {
	if (!(max > 0)) return 0;
	return clamp01(value / max);
}

// The stroke-dasharray drawing one arc of the dial, `start` and `length` as
// fractions of the circle measured clockwise from 12 o'clock (the circle is
// rotated -90° in the markup). Null when the arc is empty, so the component
// draws no circle for it. An arc from 12 o'clock gets the plain "dash gap"
// form, with no leading zero-length dash: a zero-length dash under Ring's
// round caps would draw a dot. The trailing gap is a full circumference, so
// the pattern never repeats onto the circle.
export function arcDasharray(start: number, length: number): string | null {
	const from = clamp01(start);
	const len = Math.min(clamp01(length), 1 - from);
	if (len <= 0) return null;
	const dash = len * RING_CIRCUMFERENCE;
	if (from === 0) return `${dash} ${RING_CIRCUMFERENCE}`;
	return `0 ${from * RING_CIRCUMFERENCE} ${dash} ${RING_CIRCUMFERENCE}`;
}
