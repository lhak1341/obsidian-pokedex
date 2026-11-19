import type { LeafCommand } from "../utils/leafHotkeys";

// Leaf hotkeys (CONTEXT.md) whose state lives in a component, not the view:
// DetailScreen owns `adjacent` (ADR-0009 keeps it there; its ‹ › buttons read
// it too), and FilterBar / QuickSearch own their search inputs. Each registers
// a handler under its screen; PokedexView owns one registry per leaf, hands
// it to PokedexApp (which puts it in Svelte context), and runs a command
// against the screen that is showing.
//
// Keyed by screen because TableScreen stays mounted under display:none on the
// detail screen: its FilterBar registers too, and running every handler
// focused every mounted search box (probed live).
//
// Plain and DOM-free, same shape as DetailNavigationState.
export type RoutedCommand = Exclude<LeafCommand, { kind: "history" }>;
type Screen = "table" | "detail";
type Handler = (command: RoutedCommand) => boolean;

export const LEAF_COMMANDS_CONTEXT = Symbol("pkdx-leaf-commands");

export class LeafCommandRegistry {
	private handlers = new Map<string, Handler>();

	// Returns the unregister function, which a component returns from onMount.
	// It removes only its own handler: a settings refresh unmounts the old
	// app without awaiting it, so the old screen's cleanup can run after the
	// new screen has registered under the same key.
	register(screen: Screen, kind: RoutedCommand["kind"], handler: Handler): () => void {
		const key = `${screen}:${kind}`;
		this.handlers.set(key, handler);
		return () => {
			if (this.handlers.get(key) === handler) this.handlers.delete(key);
		};
	}

	// True when a handler acted, so the caller calls preventDefault only then
	// (an arrow at either end of the dex leaves the key alone).
	run(screen: Screen, command: RoutedCommand): boolean {
		return this.handlers.get(`${screen}:${command.kind}`)?.(command) ?? false;
	}
}
