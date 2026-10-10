// Vite's `?raw` suffix imports a file's text unprocessed. Used by tests that
// scan a .svelte template (tsc cannot see into one); esbuild never bundles
// those imports, only vitest resolves them.
declare module "*?raw" {
	const content: string;
	export default content;
}
