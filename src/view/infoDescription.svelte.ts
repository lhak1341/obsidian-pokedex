import { describeHoverStatus, type HoverDescriptionStatus } from "../utils/hoverDescriptionText";
import { createInfoPopover } from "./infoPopover.svelte";

// Shared by BrowseScreen, AbilitiesPanel and HeldItemsPanel: an Info popover
// whose text is fetched once per name, the first time its popover opens, and
// cached for the hook instance's lifetime (never reset — both callers'
// component instances persist across Pokemon navigation, same reasoning as
// the old per-panel abilityDescriptions/itemDescriptions state). A failed
// fetch is cached too and never retried, matching the pre-extraction behavior
// exactly. `body` is the popover's text for the open name (loading, error,
// description or "none available"), see describeHoverStatus — callers render
// it as is.
export function createInfoDescription(
	getDescription: (name: string) => Promise<string | null>,
	offsetY = 6,
) {
	const popover = createInfoPopover(offsetY);
	let descriptions = $state<Record<string, { text: string | null } | { error: true }>>({});

	function fetchOnce(name: string) {
		if (name in descriptions) return;
		getDescription(name)
			.then((text) => {
				descriptions = { ...descriptions, [name]: { text } };
			})
			.catch(() => {
				descriptions = { ...descriptions, [name]: { error: true } };
			});
	}

	return {
		get open() {
			return popover.open;
		},
		get pos() {
			return popover.pos;
		},
		get pinned() {
			return popover.pinned;
		},
		get body(): string {
			const open = popover.open;
			const state = open === null ? undefined : descriptions[open];
			const status: HoverDescriptionStatus = !state ? undefined : "error" in state ? "error" : state;
			return describeHoverStatus(status);
		},
		target(name: string, onOpen?: () => void) {
			return popover.target(name, () => {
				fetchOnce(name);
				onOpen?.();
			});
		},
	};
}
