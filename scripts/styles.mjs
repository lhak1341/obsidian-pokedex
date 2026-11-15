// esbuild options for the stylesheet: styles.src.css -> styles.css.
// The source @imports the @lhak/style plugin alias layer and chip pattern, and
// PKDX's type and stat colours, which esbuild inlines, so deploy and the
// release keep shipping one self-contained styles.css.
// Shared by esbuild.config.mjs and src/styles.test.ts.

/** @type {import('esbuild').BuildOptions} */
export const stylesOptions = {
	entryPoints: ["styles.src.css"],
	bundle: true,
	outfile: "styles.css",
	logLevel: "info",
};
