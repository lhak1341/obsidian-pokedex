import { vi } from "vitest";

// Plain objects standing in for DOM events (no jsdom in vitest.config.ts):
// only the fields the press bindings read.
export function pointer(t: number, opts: { x?: number; y?: number; pointerType?: string; target?: unknown } = {}): PointerEvent {
	const { x = 100, y = 100, pointerType = "touch", target = null } = opts;
	return { pointerType, isPrimary: true, clientX: x, clientY: y, timeStamp: t, target } as unknown as PointerEvent;
}

// A MouseEvent whose preventDefault/stopPropagation are spies, returned
// separately so asserting on them never reads an unbound method.
export function mouse() {
	const prevent = vi.fn();
	const stop = vi.fn();
	return { e: { preventDefault: prevent, stopPropagation: stop } as unknown as MouseEvent, prevent, stop };
}
