import { describe, expect, it } from "vitest";
import { romanNumeral } from "./romanNumeral";

describe("romanNumeral", () => {
	it("converts every generation id 1-9 (the range this app actually uses)", () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(romanNumeral)).toEqual([
			"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX",
		]);
	});

	it("handles subtractive pairs beyond the current generation range", () => {
		expect(romanNumeral(14)).toBe("XIV");
		expect(romanNumeral(40)).toBe("XL");
		expect(romanNumeral(90)).toBe("XC");
		expect(romanNumeral(400)).toBe("CD");
		expect(romanNumeral(900)).toBe("CM");
	});

	it("handles a large composite value", () => {
		expect(romanNumeral(1994)).toBe("MCMXCIV");
		expect(romanNumeral(3999)).toBe("MMMCMXCIX");
	});
});
