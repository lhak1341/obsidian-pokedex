// Copies build output into the vault's plugin folder, plus the in-repo test vault.
// Override the plugins directory with OBSIDIAN_VAULT_DIR.
//
// The two targets use different folder names on purpose: the real vault deploys to
// `pokedex`, and the plugin's disk cache is derived from `manifest.dir`, so renaming
// either one strands an existing cache (see Cache.ts's migration logic).
import { access, copyFile, mkdir } from 'fs/promises';
import { basename, join } from 'path';

const VAULT_DIR =
	process.env.OBSIDIAN_VAULT_DIR ??
	'/Users/lhak/Library/Mobile Documents/iCloud~md~obsidian/Documents/lhakZettel/.obsidian/plugins';

const PLUGIN_DIR_NAME = 'pokedex';
const TEST_VAULT_DIR_NAME = 'obsidian-pokedex';

const REQUIRED = ['main.js', 'manifest.json'];
const OPTIONAL = ['styles.css'];

const targets = [
	join('test-vault', '.obsidian', 'plugins', TEST_VAULT_DIR_NAME),
	join(VAULT_DIR, PLUGIN_DIR_NAME),
];

const exists = (path) => access(path).then(() => true, () => false);

for (const src of REQUIRED) {
	if (!(await exists(src))) {
		throw new Error(`Missing build output: ${src} — run "bun run build" first.`);
	}
}

for (const target of targets) {
	await mkdir(target, { recursive: true });
	for (const src of [...REQUIRED, ...OPTIONAL]) {
		if (!(await exists(src))) continue;
		await copyFile(src, join(target, basename(src)));
	}
	console.log(`Deployed to ${target}`);
}
