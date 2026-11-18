// Copies build output into the vault's plugin folder, plus the in-repo test vault.
// Override the plugins directory with OBSIDIAN_VAULT_DIR.
//
// The two targets use different folder names on purpose: the real vault deploys to
// `pokedex` (≠ manifest id), which keeps legacyDiskCache.ts's two-folder case exercised.
import { access, copyFile, mkdir } from 'fs/promises';
import { basename, join } from 'path';

const VAULT_DIR =
	process.env.OBSIDIAN_VAULT_DIR ??
	'/Users/lhak/Library/Mobile Documents/iCloud~md~obsidian/Documents/lhakZettel/.obsidian/plugins';

const PLUGIN_DIR_NAME = 'pokedex';
const TEST_VAULT_DIR_NAME = 'obsidian-pokedex';

// styles.css is generated (styles.src.css) and carries the @lhak/style roles the
// view reads, so a missing one must fail the deploy, not ship an unstyled view.
const REQUIRED = ['main.js', 'manifest.json', 'styles.css'];
const OPTIONAL = [];

const targets = [
	join('pokedex-test-vault', '.obsidian', 'plugins', TEST_VAULT_DIR_NAME),
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
