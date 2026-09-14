// PokeAPI's own item effect text spells out the in-game currency by name
// ("Sell for 5000 Pokédollars, or to Ore Collector for 10000 Pokédollars." —
// Nugget's actual short_effect, verified live) rather than using a symbol.
// The games themselves render a stylized "P" with a double horizontal
// strikethrough; ₱ (Philippine peso sign, U+20B1) is the closest existing
// Unicode glyph to that design and is what fan references commonly use as a
// stand-in. Moves the symbol in FRONT of the amount, matching normal
// currency notation ("₱5000"), and falls back to a bare symbol for the rare
// mention with no adjacent number.
export function formatPokedollarSigns(text: string): string {
	return text
		.replace(/(\d[\d,]*)\s*Pok[eé]dollars?/gi, "₱$1")
		.replace(/Pok[eé]dollars?/gi, "₱");
}
