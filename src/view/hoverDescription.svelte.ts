import { describeHoverStatus, type HoverDescriptionStatus } from "../utils/hoverDescriptionText";
import { createHoverPopover } from "./hoverPopover.svelte";

// Shared by TableScreen, AbilitiesPanel and HeldItemsPanel:
// hover-a-name-to-show-a-description popover, fetched once per name and
// cached for the hook
// instance's lifetime (never reset — both callers' component instances
// persist across Pokemon navigation, same reasoning as the old per-panel
// abilityDescriptions/itemDescriptions state). A failed fetch is cached too
// and never retried, matching the pre-extraction behavior exactly. `body` is
// the popover's text for the hovered name (loading, error, description or
// "none available"), see describeHoverStatus — callers render it as is.
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
		get body(): string {
			const hovered = popover.hovered;
			const state = hovered === null ? undefined : descriptions[hovered];
			const status: HoverDescriptionStatus = !state ? undefined : "error" in state ? "error" : state;
			return describeHoverStatus(status);
		},
		show,
		hide: popover.hide,
	};
}
