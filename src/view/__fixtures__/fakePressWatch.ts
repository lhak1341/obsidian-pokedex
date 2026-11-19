import type { PressWatch } from "../pressWatch";

// The second PressWatch adapter: the tests fire the hold timer and a scroll by
// hand. Like the real one, a stopped watch fires nothing, so a binding that
// forgets to stop it (or a destroy() that doesn't) is visible as a late fire.
export function createFakePressWatch() {
	let live: { holdMs: number; onTimer: (t: number, doc: Document) => void; onScroll: () => void } | null = null;
	const doc = {} as Document;
	const watch: PressWatch = {
		start(_e, holdMs, { onTimer, onScroll }) {
			live = { holdMs, onTimer, onScroll };
		},
		stop() {
			live = null;
		},
	};
	return {
		watch,
		doc,
		isLive: () => live !== null,
		holdMs: () => live?.holdMs ?? null,
		fireTimer: (t: number) => live?.onTimer(t, doc),
		scroll: () => live?.onScroll(),
	};
}
