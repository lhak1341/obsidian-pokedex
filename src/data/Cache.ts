import type { App, DataAdapter } from "obsidian";

const MIME_BY_EXT: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
};

function extOf(path: string): string {
	return path.split(".").pop()?.toLowerCase() ?? "png";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

// Persists PokeAPI JSON + images under the plugin's own folder inside
// .obsidian/plugins/<id>/cache/ — hidden from the vault's note explorer and
// never written as vault files/notes.
export class DiskCache {
	private constructor(private adapter: DataAdapter, private cacheDir: string) {}

	static forPlugin(app: App, pluginId: string): DiskCache {
		const cacheDir = `${app.vault.configDir}/plugins/${pluginId}/cache`;
		return new DiskCache(app.vault.adapter, cacheDir);
	}

	private resolve(relPath: string): string {
		return `${this.cacheDir}/${relPath}`;
	}

	private async ensureParentDir(fullPath: string): Promise<void> {
		const segments = fullPath.split("/").slice(0, -1);
		let current = "";
		for (const segment of segments) {
			current = current ? `${current}/${segment}` : segment;
			if (!(await this.adapter.exists(current))) {
				await this.adapter.mkdir(current);
			}
		}
	}

	async exists(relPath: string): Promise<boolean> {
		return this.adapter.exists(this.resolve(relPath));
	}

	async readJson<T>(relPath: string): Promise<T | null> {
		const path = this.resolve(relPath);
		if (!(await this.adapter.exists(path))) return null;
		try {
			return JSON.parse(await this.adapter.read(path)) as T;
		} catch {
			return null;
		}
	}

	async writeJson(relPath: string, data: unknown): Promise<void> {
		const path = this.resolve(relPath);
		await this.ensureParentDir(path);
		await this.adapter.write(path, JSON.stringify(data));
	}

	async readImageDataUri(relPath: string): Promise<string | null> {
		const path = this.resolve(relPath);
		if (!(await this.adapter.exists(path))) return null;
		const buffer = await this.adapter.readBinary(path);
		const mime = MIME_BY_EXT[extOf(relPath)] ?? "image/png";
		return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
	}

	async writeImageBinary(relPath: string, buffer: ArrayBuffer): Promise<void> {
		const path = this.resolve(relPath);
		await this.ensureParentDir(path);
		await this.adapter.writeBinary(path, buffer);
	}

	async clear(): Promise<void> {
		if (await this.adapter.exists(this.cacheDir)) {
			await this.adapter.rmdir(this.cacheDir, true);
		}
	}

	async getSizeBytes(): Promise<number> {
		if (!(await this.adapter.exists(this.cacheDir))) return 0;
		let total = 0;
		const walk = async (dir: string): Promise<void> => {
			const { files, folders } = await this.adapter.list(dir);
			for (const file of files) {
				const stat = await this.adapter.stat(file);
				total += stat?.size ?? 0;
			}
			for (const folder of folders) await walk(folder);
		};
		await walk(this.cacheDir);
		return total;
	}
}
