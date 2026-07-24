import { createHoverPopover } from "./hoverPopover.svelte";

// Shared by AbilitiesPanel and HeldItemsPanel: hover-a-name-to-show-a-
// description popover, fetched once per name and cached for the hook
// instance's lifetime (never reset — both callers' component instances
// persist across Pokemon navigation, same reasoning as the old per-panel
// abilityDescriptions/itemDescriptions state). A failed fetch is cached too
// and never retried, matching the pre-extraction behavior exactly.
export function createHoverDescription(
	anchorSelector: string,
	getDescription: (name: string) => Promise<string | null>,
	offsetY = 6,
) {
	const popover = createHoverPopover(anchorSelector, offsetY);
	let descriptions = $state<Record<string, { text: string | null } | { error: true }>>({});

	function show(name: string, target: EventTarget | null) {
		popover.show(name, target);
		if (!(name in descriptions)) {
			getDescription(name)
				.then((text) => {
					descriptions = { ...descriptions, [name]: { text } };
				})
				.catch(() => {
					descriptions = { ...descriptions, [name]: { error: true } };
				});
		}
	}

	return {
		get hovered() {
			return popover.hovered;
		},
		get pos() {
			return popover.pos;
		},
		get status(): undefined | "error" | { text: string | null } {
			const hovered = popover.hovered;
			if (hovered === null) return undefined;
			const state = descriptions[hovered];
			if (!state) return undefined;
			return "error" in state ? "error" : state;
		},
		show,
		hide: popover.hide,
	};
}
