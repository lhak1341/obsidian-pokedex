// Registers a capture-phase window listener for Cmd/Ctrl+Shift+<letter> and
// calls onTrigger when it fires. Capture phase + stopPropagation is
// load-bearing: plain Mod+<letter> is unusable for a global app hotkey here
// because Electron's native application menu binds several
// CommandOrControl+<letter> chords (e.g. Cmd+L to Insert Link), an
// OS/main-process-level accelerator no renderer JS can intercept. Adding
// Shift sidesteps that menu collision, but Obsidian's own HotkeyManager
// separately bakes some Mod+Shift+<letter> chords (e.g. Mod+Shift+L to
// editor:insert-embed) and listens on `document` during the capture phase —
// registering on `window` with capture:true fires ahead of that listener,
// and stopPropagation stops it from also firing.
//
// Returns an unregister function — callers can pass it straight back from
// onMount, since Svelte treats a function returned from onMount's callback
// as its own cleanup (no separate onDestroy needed).
export function registerGlobalHotkey(letter: string, onTrigger: () => void): () => void {
	const handler = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === letter.toLowerCase()) {
			e.preventDefault();
			e.stopPropagation();
			onTrigger();
		}
	};
	window.addEventListener("keydown", handler, true);
	return () => window.removeEventListener("keydown", handler, true);
}
