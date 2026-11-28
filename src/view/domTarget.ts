// DOM-touching (checks HTMLElement/isContentEditable), so this lives in
// view/ rather than utils/ and stays untested — same convention as
// domPosition.ts's measureOverlay (no jsdom in vitest.config.ts). PokedexView
// feeds it to resolveLeafHotkey as `editable`, so "[", "]" and the arrows
// don't fire while the user is typing in a text input.
export function isEditableTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLElement &&
		(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}
