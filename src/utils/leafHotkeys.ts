// Leaf hotkeys (CONTEXT.md): the keys a Pokedex leaf answers, decided in one
// place. PokedexView owns the only window keydown listener per leaf and asks
// this for a command; nothing else in the plugin listens for keydown on the
// window (pinned by leafHotkeyListener.test.ts).
//
// `active` is part of the input, not a check the caller does first, so the
// rule "a leaf that is not the active one leaves the event alone" is tested
// here: every leaf's listener sees every keydown, and before this module the
// arrows stepped background tabs and Mod+Shift+L focused a search box in
// whichever leaf mounted last (probed live with two leaves).

export type LeafCommand =
	| { kind: "history"; dir: "back" | "forward" }
	| { kind: "adjacent"; dir: "prev" | "next" }
	| { kind: "focusSearch" };

export type LeafHotkeyInput = {
	key: string;
	// Cmd on macOS, Ctrl elsewhere (metaKey || ctrlKey).
	mod: boolean;
	shift: boolean;
	// The event's target is a text input, textarea or contenteditable.
	editable: boolean;
	screen: "table" | "detail";
	// This leaf is the workspace's active Pokedex leaf.
	active: boolean;
};

export type LeafHotkey = {
	command: LeafCommand;
	// Only the Mod+Shift+L chord needs it: Obsidian's HotkeyManager binds that
	// chord (editor:insert-embed) on `document` in the capture phase, and the
	// listener runs on `window` in the capture phase to get there first.
	// "[", "]" and the arrows have no Obsidian binding to beat.
	stopPropagation: boolean;
};

export function resolveLeafHotkey(input: LeafHotkeyInput): LeafHotkey | null {
	if (!input.active) return null;
	const { key, mod, shift, editable, screen } = input;

	// Works from inside an input too: it only refocuses the leaf's own search.
	if (mod && shift && key.toLowerCase() === "l") {
		return { command: { kind: "focusSearch" }, stopPropagation: true };
	}

	// The plain keys never fire while typing, and never with Cmd/Ctrl held:
	// Mod+[ and Mod+] are Obsidian's own back/forward.
	if (editable || mod) return null;
	if (key === "[") return { command: { kind: "history", dir: "back" }, stopPropagation: false };
	if (key === "]") return { command: { kind: "history", dir: "forward" }, stopPropagation: false };
	if (screen !== "detail") return null;
	if (key === "ArrowLeft") return { command: { kind: "adjacent", dir: "prev" }, stopPropagation: false };
	if (key === "ArrowRight") return { command: { kind: "adjacent", dir: "next" }, stopPropagation: false };
	return null;
}
