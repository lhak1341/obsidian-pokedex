// The @lhak/style adoption check: no raw colours, px font sizes or retired
// prefixes. Linted: styles.src.css and the <style> blocks of every .svelte
// component (read through postcss-html). styles.css is generated, so it is not.
export default {
	extends: ["@lhak/style/stylelint"],
	overrides: [
		{ files: ["**/*.svelte"], customSyntax: "postcss-html" },
		{
			// Named exemption: the Pokémon type and stat colours are canonical domain
			// data, outside the contract (lhak-style-adoption SPEC stories 38-39).
			// Only this file, and only the colour rules; the prefix and font-size
			// rules still apply to it.
			files: ["src/styles/pokemon-colours.css"],
			rules: {
				"color-no-hex": null,
				"color-named": null,
				"declaration-property-value-disallowed-list": null,
			},
		},
	],
};
