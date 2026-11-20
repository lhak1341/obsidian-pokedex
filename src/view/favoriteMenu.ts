import { Menu } from "obsidian";
import { IDLE, MENU_PRESS, stepMenuPress, type MenuPressEvent, type MenuPressStep, type PressState } from "../utils/pressHold";
import { createPressWatch, type PressWatch } from "./pressWatch";

// The favourites menu on a table row or Card view tile: "Add to favorites" /
// "Remove from favorites", opened by a right-click or a ~500ms press and
// hold. The rules (when a press holds, cancels, or swallows the tap after it)
// are utils/pressHold.ts; this is the thin binding that turns DOM events into
// its events, runs the timer (pressWatch.ts) and opens the Menu. The watch and
// the opener are injected, so favoriteMenu.test.ts drives this wiring with
// fakes; the real Menu (defaultOpenMenu) stays untested (no jsdom in
// vitest.config.ts, and the obsidian stub has no Menu).
//
// One per list, not per row: a press is one pointer at a time, and the tap a
// hold swallows can land on a neighbouring row if the finger moved after it.

export interface FavoriteMenuTargetProps {
	onpointerdown: (e: PointerEvent) => void;
	onpointermove: (e: PointerEvent) => void;
	onpointerup: () => void;
	onpointercancel: () => void;
	oncontextmenu: (e: MouseEvent) => void;
	// Capture phase: runs before the row's or tile's own (delegated) click
	// handler and any target inside it, so a swallowed tap reaches neither.
	onclickcapture: (e: MouseEvent) => void;
}

export interface FavoriteMenu {
	target(id: number): FavoriteMenuTargetProps;
	// Stops a live press's timer and scroll watch, so a hold still pending
	// when the list unmounts (the leaf closes) opens nothing.
	destroy(): void;
}

// Where a menu opens: at the press point (a hold) or at the contextmenu event.
export type MenuPlace = { at: "press"; x: number; y: number; doc: Document } | { at: "event"; e: MouseEvent };

export type OpenMenu = (id: number, place: MenuPlace, deps: FavoriteMenuDeps) => void;

export interface FavoriteMenuDeps {
	isFavorite: (id: number) => boolean;
	onToggle: (id: number) => void;
}

// Reads isFavorite when it opens, so the title is never stale. On a phone
// Obsidian draws either placement as a bottom sheet.
const defaultOpenMenu: OpenMenu = (id, place, deps) => {
	const isFavorite = deps.isFavorite(id);
	const menu = new Menu().addItem((item) =>
		item
			.setTitle(isFavorite ? "Remove from favorites" : "Add to favorites")
			.setIcon("asterisk")
			.onClick(() => deps.onToggle(id)),
	);
	if (place.at === "press") menu.showAtPosition({ x: place.x, y: place.y }, place.doc);
	else menu.showAtMouseEvent(place.e);
};

export function createFavoriteMenu(
	deps: FavoriteMenuDeps,
	{ watch = createPressWatch(), openMenu = defaultOpenMenu }: { watch?: PressWatch; openMenu?: OpenMenu } = {},
): FavoriteMenu {
	let state: PressState = IDLE;

	// Steps the rules; a menu it asks for is opened by the caller, since
	// only the timer opens one at the press point and only contextmenu at
	// its own event.
	function dispatch(event: MenuPressEvent): MenuPressStep {
		const step = stepMenuPress(state, event);
		state = step.state;
		if (state.phase !== "pressing") watch.stop();
		return step;
	}

	function onDown(e: PointerEvent, id: number) {
		watch.stop();
		dispatch({
			kind: "down",
			pointerType: e.pointerType,
			isPrimary: e.isPrimary,
			x: e.clientX,
			y: e.clientY,
			t: e.timeStamp,
		});
		if (state.phase !== "pressing") return;
		watch.start(e, MENU_PRESS.holdMs, {
			onTimer: (t, doc) => {
				const { menu } = dispatch({ kind: "timer", t });
				if (menu?.at === "press") openMenu(id, { at: "press", x: menu.x, y: menu.y, doc }, deps);
			},
			onScroll: () => dispatch({ kind: "scroll" }),
		});
	}

	return {
		target: (id) => ({
			onpointerdown: (e) => onDown(e, id),
			onpointermove: (e) => {
				if (state.phase === "pressing") dispatch({ kind: "move", x: e.clientX, y: e.clientY });
			},
			onpointerup: () => dispatch({ kind: "up" }),
			onpointercancel: () => dispatch({ kind: "cancel" }),
			oncontextmenu: (e) => {
				// Never the browser's own menu, whether or not ours opens.
				e.preventDefault();
				const step = dispatch({ kind: "contextmenu" });
				if (step.menu) openMenu(id, { at: "event", e }, deps);
				if (step.swallowed) e.stopPropagation();
			},
			onclickcapture: (e) => {
				if (!dispatch({ kind: "click" }).swallowed) return;
				e.preventDefault();
				e.stopPropagation();
			},
		}),
		destroy: () => watch.stop(),
	};
}
