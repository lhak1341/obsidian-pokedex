import type { DataAdapter, PluginManifest } from "obsidian";

// Before ADR-0011 the cache lived in the synced plugin folder: 845 MB in the
// live vault, half of it iCloud conflict copies ("1 2.json"). It is deleted
// once, not imported: an import races other devices deleting the same folder
// and would carry stale JSON with untrimmed `moves`.

export const LEGACY_CACHE_NOTICE =
	"Pokedex: the cache now lives on each device and refills as you browse.";

// `{manifest.dir}/cache` is where the last DiskCache wrote. The id-keyed
// folder is where it wrote before it switched to manifest.dir (its migration
// moved that folder on next run, but an install that skipped that version
// may still have it).
export function legacyDiskCacheDirs(configDir: string, manifest: Pick<PluginManifest, "id" | "dir">): string[] {
	const idDir = `${configDir}/plugins/${manifest.id}/cache`;
	const deployedDir = manifest.dir ? `${manifest.dir}/cache` : idDir;
	return deployedDir === idDir ? [idDir] : [deployedDir, idDir];
}

// True when anything was deleted, which is when the caller shows
// LEGACY_CACHE_NOTICE. No stored "done" flag: the folder's absence is the
// flag, so a folder iCloud resurrects later is still deleted.
export async function deleteLegacyDiskCache(
	adapter: Pick<DataAdapter, "exists" | "rmdir">,
	dirs: string[],
): Promise<boolean> {
	let deleted = false;
	for (const dir of dirs) {
		if (!(await adapter.exists(dir))) continue;
		await adapter.rmdir(dir, true);
		deleted = true;
	}
	return deleted;
}
