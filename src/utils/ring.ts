// How much of a Capture & Breeding ring (Ring.svelte) is drawn: value/max,
// clamped to [0, 1] so an out-of-range value never overdraws the circle.
export function ringFill(value: number, max: number): number {
	if (!(max > 0)) return 0;
	return Math.min(Math.max(value / max, 0), 1);
}
