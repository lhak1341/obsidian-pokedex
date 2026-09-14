// Regenerates src/data/encounterLocations.json — a static per-base-species
// lookup of wild-encounter location areas, tagged by generation AND region,
// so the browse table's "Capture" column and the detail page's Breeding &
// Capture section can show where a Pokemon is caught in the wild (grouped by
// region for a generation whose games span more than one, e.g. Gen 3's
// FRLG-Kanto + RSE-Hoenn) without a runtime fetch per row (same reasoning as
// EVOLUTION_STAGES in constants.ts: this data is stable until a new
// generation ships, so a committed table beats adding a fetch to
// PokedexRepository's already-hot table-load path).
//
// Region comes from a real PokeAPI field (Location.region), NOT guessed from
// a "kanto-"/"hoenn-" name prefix — PokeAPI only adds that prefix to a
// location-area's own slug when disambiguation is actually needed (Kanto's
// "route-10" vs Hoenn's own "route-110"), so an unambiguously-named Hoenn
// place like "mirage-tower-area" carries no region prefix in its name at
// all and would silently fall out of every region grouping under a
// prefix-guessing approach (caught live: Sandshrew's Gen 3 Hoenn group
// dropped "Mirage Tower" into its own headerless group instead of merging it
// under "Hoenn"). Building areaName -> region from every Location resource's
// own `areas` list sidesteps that entirely.
//
// Scope (v1): base species only (dex numbers 1..MAX_DEX_NUMBER), fetched by
// numeric id the same way PokedexRepository fetches a base row's RawPokemon.
// Regional-form varieties (Alolan/Galarian/Hisuian/Paldean) are NOT covered —
// looking them up requires deriveRegionalForms(species), which needs a
// species fetch per candidate on top of the encounters fetch itself, roughly
// doubling this script's already-3000+-request run. A regional-form row's
// encounterLocations is simply absent from this table and falls back to []
// (renders as "-", same as a Pokemon with no wild encounters at all) — a
// known residual gap, not a crash risk. Extend by keying additional entries
// under a variety's own pokemon.name (e.g. "rattata-alola") if this is worth
// closing later; toTableRow already looks up by pokemon.name, not species.id,
// so no normalize.ts change would be needed.
//
// Usage: bun run scripts/generate-encounters.ts

import { writeFileSync } from "node:fs";
import { VERSION_TO_GENERATION } from "../src/data/constants";
import { mapWithConcurrency } from "../src/utils/concurrency";
import { withRetry } from "../src/utils/retry";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const MAX_DEX_NUMBER = 1025; // same bump-alongside-GENERATIONS reasoning as generate-evolution-stages.ts
const CONCURRENCY = 10; // same PokeAPI-friendly cap as PokeApiClient's own Semaphore

interface RawLocation {
	region: { name: string } | null;
	areas: { name: string }[];
}

interface RawEncounter {
	location_area: { name: string };
	version_details: {
		version: { name: string };
		encounter_details: {
			method: { name: string };
			condition_values: { name: string }[];
		}[];
	}[];
}

// A handful of species aren't found by a wild encounter roll at all — PokeAPI
// tags the location-area "encounter" itself with a non-"walk" method:
// "npc-trade" (Jynx in Gen 1/3: trade a Poliwhirl for it in Cerulean City,
// carrying a condition_value named "trade-{species}" instead of an encounter
// rate), "gift" (a starter or other NPC hand-off — no separate "starter"
// method exists in PokeAPI's encounter-method list, so a starter and an
// ordinary story-gift are indistinguishable from this data alone), and
// "gift-egg" (an NPC hands over an egg, not the Pokemon itself). Every other
// method in PokeAPI's list (fishing rods, surf, headbutt, static, hordes,
// raids, ...) still means "this location is genuinely where you get it," so
// only these three change what the Capture section should say — "Trade
// Poliwhirl @ Cerulean City" / "Gift @ Pallet Town" / "Egg @ Some Town"
// instead of the bare, misleading place name.
function acquisitionFromEncounterDetails(
	encounterDetails: { method: { name: string }; condition_values: { name: string }[] }[],
): { method: "trade" | "gift" | "egg" | null; tradeFor: string | null } {
	for (const detail of encounterDetails) {
		if (detail.method.name === "npc-trade") {
			const tradeCondition = detail.condition_values.find((c) => c.name.startsWith("trade-"));
			if (tradeCondition) return { method: "trade", tradeFor: tradeCondition.name.slice("trade-".length) };
		}
	}
	for (const detail of encounterDetails) {
		if (detail.method.name === "gift-egg") return { method: "egg", tradeFor: null };
	}
	for (const detail of encounterDetails) {
		if (detail.method.name === "gift") return { method: "gift", tradeFor: null };
	}
	return { method: null, tradeFor: null };
}

interface RawPokemonMinimal {
	name: string;
}

async function fetchJson<T>(url: string): Promise<T> {
	return withRetry(async () => {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${url} -> ${res.status}`);
		return (await res.json()) as T;
	});
}

// Every Location resource lists its own region plus the location-areas it
// contains — walking all ~1100 of them once builds a complete areaName ->
// region map with no per-area fetch needed at all.
async function buildAreaRegionMap(): Promise<Map<string, string>> {
	const list = await fetchJson<{ results: { url: string }[] }>(`${POKEAPI_BASE}/location?limit=2000`);
	console.log(`fetched ${list.results.length} location resources`);

	const areaToRegion = new Map<string, string>();
	const failures: { url: string; error: unknown }[] = [];

	await mapWithConcurrency(
		list.results,
		CONCURRENCY,
		async (r) => {
			const location = await fetchJson<RawLocation>(r.url);
			if (!location.region) return; // a handful of PokeAPI locations carry no region at all
			for (const area of location.areas) areaToRegion.set(area.name, location.region.name);
		},
		(result) => {
			if ("error" in result) failures.push({ url: list.results[result.index].url, error: result.error });
		},
	);

	if (failures.length > 0) {
		const detail = failures.map((f) => `${f.url}: ${String(f.error)}`).join("\n");
		throw new Error(`${failures.length} location fetch(es) failed:\n${detail}`);
	}
	return areaToRegion;
}

async function main() {
	const areaToRegion = await buildAreaRegionMap();

	type LocationEntry = {
		name: string;
		generationId: number;
		region: string | null;
		method: "trade" | "gift" | "egg" | null;
		tradeFor: string | null;
	};
	const table: Record<string, LocationEntry[]> = {};
	const failures: { id: number; error: unknown }[] = [];

	const ids = Array.from({ length: MAX_DEX_NUMBER }, (_, i) => i + 1);

	await mapWithConcurrency(
		ids,
		CONCURRENCY,
		async (id) => {
			const [pokemon, encounters] = await Promise.all([
				fetchJson<RawPokemonMinimal>(`${POKEAPI_BASE}/pokemon/${id}`),
				fetchJson<RawEncounter[]>(`${POKEAPI_BASE}/pokemon/${id}/encounters`),
			]);
			const distinct = new Map<string, LocationEntry>();
			for (const enc of encounters) {
				const region = areaToRegion.get(enc.location_area.name) ?? null;
				for (const v of enc.version_details) {
					const generationId = VERSION_TO_GENERATION[v.version.name];
					if (generationId === undefined) continue; // version not in this app's supported set
					const acquisition = acquisitionFromEncounterDetails(v.encounter_details);
					distinct.set(`${enc.location_area.name}:${generationId}`, {
						name: enc.location_area.name,
						generationId,
						region,
						...acquisition,
					});
				}
			}
			if (distinct.size > 0) {
				table[pokemon.name] = [...distinct.values()].sort(
					(a, b) => a.generationId - b.generationId || a.name.localeCompare(b.name),
				);
			}
		},
		(result) => {
			if ("error" in result) failures.push({ id: ids[result.index], error: result.error });
		},
	);

	if (failures.length > 0) {
		const detail = failures.map((f) => `${f.id}: ${String(f.error)}`).join("\n");
		throw new Error(`${failures.length} encounters fetch(es) failed:\n${detail}`);
	}

	const path = new URL("../src/data/encounterLocations.json", import.meta.url);
	writeFileSync(path, JSON.stringify(table) + "\n");
	console.log(`wrote ${path.pathname} (${Object.keys(table).length} species with wild encounters)`);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
