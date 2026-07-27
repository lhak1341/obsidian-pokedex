const SYMBOLS: [number, string][] = [
	[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
	[100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
	[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

// Standard greedy symbol-pair conversion, 1-3999 — used by DetailScreen's
// generation display so a new GENERATIONS entry (data/constants.ts) never
// needs a matching hand-authored numeral; it used to (ROMAN_NUMERALS, a
// bare array that silently drifted out of sync with GENERATIONS once — see
// CLAUDE.md history). No validation: only ever called with a valid
// generationId sourced from GENERATIONS, always a positive integer.
export function romanNumeral(n: number): string {
	let remaining = n;
	let result = "";
	for (const [value, symbol] of SYMBOLS) {
		while (remaining >= value) {
			result += symbol;
			remaining -= value;
		}
	}
	return result;
}
