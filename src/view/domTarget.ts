// DOM-touching (checks HTMLElement/isContentEditable), so this lives in
// view/ rather than utils/ and stays untested — same convention as
// domPosition.ts's relativeRect (no jsdom in vitest.config.ts). Shared by
// PokedexApp's global "["/"]" history hotkeys and DetailScreen's
// ArrowLeft/ArrowRight nav, both guarding against a hotkey firing while the
// user is typing in a text input.
export function isEditableTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLElement &&
		(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}
