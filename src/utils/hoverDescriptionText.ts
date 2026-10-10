import { formatPokedollarSigns } from "./pokedollar";

// What createHoverDescription knows about the hovered name's description:
// undefined = not requested yet, "error" = the fetch failed, otherwise the
// fetched text (null when PokeAPI has none).
export type HoverDescriptionStatus = undefined | "error" | { text: string | null };

// The one mapping from that status to the popover body, shared by the table's
// held-item popover and the detail page's ability and held-item popovers. An
// empty description counts as missing, and every description gets the
// Pokédollar rewrite (ability text never mentions the currency, so it is a
// no-op there).
export function describeHoverStatus(status: HoverDescriptionStatus): string {
	if (!status) return "Loading…";
	if (status === "error") return "Couldn't load description.";
	return status.text ? formatPokedollarSigns(status.text) : "No description available.";
}
