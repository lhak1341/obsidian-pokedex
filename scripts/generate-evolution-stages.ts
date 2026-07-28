// Regenerates src/data/evolutionStages.json — see EVOLUTION_STAGES in
// data/constants.ts for what the output means and why it's a static table
// rather than a runtime fetch. Rerun this after a generation ships new
// evolution chains (a new dex range on its own never changes an EXISTING
// chain's depth, but a fresh generation always adds new chains of its own).
//
// Reuses the real evolutionFamilyDepth from src/data/normalize.ts rather
// than reimplementing the walk here, so this script can never silently drift
// from what the app itself considers "one evolution stage" — see this
// repo's CLAUDE.md gotcha on writing a standalone script against the real
// source file instead of hand-tracing/re-deriving logic.
//
// Usage: bun run scripts/generate-evolution-stages.ts

import { writeFileSync } from "node:fs";
import { evolutionFamilyDepth } from "../src/data/normalize";
import type { RawEvolutionChain, RawEvolutionChainLink } from "../src/data/types";
import { mapWithConcurrency } from "../src/utils/concurrency";
import { withRetry } from "../src/utils/retry";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const MAX_DEX_NUMBER = 1025; // bump alongside GENERATIONS' own max end value
const CONCURRENCY = 10; // same PokeAPI-friendly cap as PokeApiClient's own Semaphore

async function fetchJson<T>(url: string): Promise<T> {
	return withRetry(async () => {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url} -> ${res.status}`);
		return (await res.json()) as T;
	});
}

function idFromUrl(url: string): number {
	const match = url.match(/\/(\d+)\/?$/);
	return match ? Number(match[1]) : 0;
}

function collectMemberIds(link: RawEvolutionChainLink, out: number[] = []): number[] {
	out.push(idFromUrl(link.species.url));
	for (const child of link.evolves_to) collectMemberIds(child, out);
	return out;
}

async function main() {
	const list = await fetchJson<{ results: { url: string }[] }>(`${POKEAPI_BASE}/evolution-chain?limit=600`);
	console.log(`fetched ${list.results.length} evolution-chain resources`);

	const table = new Array<number>(MAX_DEX_NUMBER + 1).fill(0);
	const seen = new Set<number>();
	const failures: { url: string; error: unknown }[] = [];

	await mapWithConcurrency(
		list.results,
		CONCURRENCY,
		async (r) => {
			const chain = await fetchJson<RawEvolutionChain>(r.url);
			const depth = evolutionFamilyDepth(chain.chain);
			for (const id of collectMemberIds(chain.chain)) {
				if (id >= 1 && id <= MAX_DEX_NUMBER) {
					table[id] = depth;
					seen.add(id);
				}
			}
		},
		(result) => {
			if ("error" in result) failures.push({ url: list.results[result.index].url, error: result.error });
		},
	);

	if (failures.length > 0) {
		const detail = failures.map((f) => `${f.url}: ${String(f.error)}`).join("\n");
		throw new Error(`${failures.length} evolution-chain fetch(es) failed:\n${detail}`);
	}

	const missing: number[] = [];
	for (let id = 1; id <= MAX_DEX_NUMBER; id++) if (!seen.has(id)) missing.push(id);
	if (missing.length > 0) {
		throw new Error(`missing evolution-chain data for dex numbers: ${missing.join(", ")}`);
	}

	const outPath = new URL("../src/data/evolutionStages.json", import.meta.url);
	writeFileSync(outPath, JSON.stringify(table));
	console.log(`wrote ${outPath.pathname} (${table.length} entries)`);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
