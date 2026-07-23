import {
	EVOLUTION_STAGES,
	FLAVOR_TEXT_TABS_BY_GEN,
	FLAVOR_TEXT_VERSION_GROUPS,
	MEGA_VARIETY_KEYS,
	MOVE_DESCRIPTION_VERSION_GROUPS,
	MOVE_VERSION_GROUPS,
	REGIONAL_FORMS,
	resolveGenerationId,
} from "./constants";
import type {
	EvolutionNode,
	EvYieldEntry,
	GigantamaxFormDetail,
	GigantamaxFormSummary,
	MegaFormDetail,
	MegaFormSummary,
	MoveDetail,
	MoveEntry,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChainLink,
	RawMove,
	RawPokemon,
	RawSpecies,
	StatBlock,
} from "./types";

const STAT_KEY_MAP: Record<string, keyof StatBlock> = {
	hp: "hp",
	attack: "attack",
	defense: "defense",
	"special-attack": "specialAttack",
	"special-defense": "specialDefense",
	speed: "speed",
};

export function normalizeStats(rawStats: RawPokemon["stats"]): StatBlock {
	const stats: StatBlock = {
		hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
	};
	for (const entry of rawStats) {
		const key = STAT_KEY_MAP[entry.stat.name];
		if (key) stats[key] = entry.base_stat;
	}
	return stats;
}

export function normalizeMoves(
	rawMoves: RawPokemon["moves"],
	versionGroups: readonly string[] = MOVE_VERSION_GROUPS,
): MoveEntry[] {
	// Dedupe key includes versionGroup — FRLG and Emerald can teach the same
	// move at *different* levels, and collapsing those into one row hid
	// whichever group's level lost the race (see DetailScreen's version
	// toggle, which needs each group's own entries to filter correctly).
	// This only catches true duplicates: the same move/method/level/group
	// appearing twice raw (e.g. PokeAPI listing a version group more than
	// once for a move).
	const seen = new Set<string>();
	const moves: MoveEntry[] = [];
	for (const entry of rawMoves) {
		for (const detail of entry.version_group_details) {
			if (!versionGroups.includes(detail.version_group.name)) continue;
			const dedupeKey = `${entry.move.name}|${detail.move_learn_method.name}|${detail.level_learned_at}|${detail.version_group.name}`;
			if (seen.has(dedupeKey)) continue;
			seen.add(dedupeKey);
			moves.push({
				name: entry.move.name,
				levelLearnedAt: detail.level_learned_at,
				learnMethod: detail.move_learn_method.name,
				versionGroup: detail.version_group.name,
			});
		}
	}
	// Level-up moves first in learn order, then everything else alphabetically.
	moves.sort((a, b) => {
		if (a.learnMethod === "level-up" && b.learnMethod === "level-up") {
			return a.levelLearnedAt - b.levelLearnedAt;
		}
		if (a.learnMethod === "level-up") return -1;
		if (b.learnMethod === "level-up") return 1;
		return a.name.localeCompare(b.name);
	});
	return moves;
}

// PokeAPI's `moves` array carries every version group the move has ever
// appeared in (20+ games) — `normalizeMoves` only ever reads the couple this
// plugin cares about (MOVE_VERSION_GROUPS). Trimming it down to just those
// before a raw pokemon response is cached cuts a ~260KB moves array (out of
// ~263KB total) down to a few KB, since that's ~99% of what makes
// `pokemon/<id>.json` slow to read and parse on every table load.
export function trimMovesToVersionGroups(
	rawMoves: RawPokemon["moves"],
	versionGroups: readonly string[] = MOVE_VERSION_GROUPS,
): RawPokemon["moves"] {
	return rawMoves
		.map((entry) => ({
			...entry,
			version_group_details: entry.version_group_details.filter((d) =>
				versionGroups.includes(d.version_group.name),
			),
		}))
		.filter((entry) => entry.version_group_details.length > 0);
}

export function normalizeMoveDetail(raw: RawMove): MoveDetail {
	let entry: RawMove["flavor_text_entries"][number] | undefined;
	for (const group of MOVE_DESCRIPTION_VERSION_GROUPS) {
		entry = raw.flavor_text_entries.find((e) => e.language.name === "en" && e.version_group.name === group);
		if (entry) break;
	}
	const description = entry?.flavor_text.replace(/[\n\f\r]+/g, " ").trim() ?? null;
	return { type: raw.type.name, power: raw.power, accuracy: raw.accuracy, pp: raw.pp, description };
}

function idFromUrl(url: string): number {
	const match = url.match(/\/(\d+)\/?$/);
	return match ? Number(match[1]) : 0;
}

// "rattata-alola" against species name "rattata" -> "alola". undefined if
// varietyName isn't literally "{speciesName}-{suffix}" (e.g. a Mega variety,
// or "raticate-totem-alola" — that one exact-matching against "raticate"
// fails since the real suffix segment is "totem-alola", not one this app
// models, which is exactly the point: this is a strict prefix match, not
// `.endsWith()`, so a Totem variant can never be mistaken for a regional one
// just because its name happens to also end in "-alola").
function extractFormSuffix(varietyName: string, speciesName: string): string | undefined {
	const prefix = `${speciesName}-`;
	return varietyName.startsWith(prefix) ? varietyName.slice(prefix.length) : undefined;
}

// The inverse of deriveRegionalForms below: deriveRegionalForms lists every
// regional variety a species *has*; this asks whether a specific
// already-fetched `pokemon` *is* one of them, and if so which suffix — used
// both by toTableRow (to compute dexNumber/formLabel/generationId) and by
// PokedexRepository when building the `context` passed into
// normalizeEvolutionChain for a regional-form row's own detail page.
export function resolveRegionalFormSuffix(pokemon: RawPokemon, species: RawSpecies): string | undefined {
	if (pokemon.name === species.name) return undefined;
	const suffix = extractFormSuffix(pokemon.name, species.name);
	return suffix !== undefined && suffix in REGIONAL_FORMS ? suffix : undefined;
}

// Obstagoon/Cursola/Perrserker/Runerigus/Sirfetch'd/Mr. Rime shape: a species
// with no suffixed name of its own (pokemon.name === species.name, so
// resolveRegionalFormSuffix returns undefined for it) that's nonetheless only
// reachable through a specific regional-variant ancestor — Obstagoon only
// evolves from Linoone-Galar, never plain Linoone. Without this, viewing one
// of these species passes no context into normalizeEvolutionChain at all,
// which falls into buildEvolutionNode's contextless "default view" branch —
// exactly the branch built to drop a variant-gated edge as unrelated (see the
// Corsola/Cursola comment below) — so the viewed species' own only edge gets
// dropped from its own detail page. Walks the raw chain for the edge leading
// to `speciesName`: if it's reachable unconditionally (the common case) or
// isn't found at all, returns undefined (no special handling needed); if
// every entry on that edge requires a specific base_form, returns that
// variety's suffix, filtered through REGIONAL_FORMS the same way
// resolveRegionalFormSuffix is, so an unrelated base_form-tagged edge (were
// one to exist) can't be mistaken for a modeled regional variant.
export function inferAncestorFormSuffix(link: RawEvolutionChainLink, speciesName: string): string | undefined {
	for (const child of link.evolves_to) {
		if (child.species.name === speciesName) {
			if (child.evolution_details.some((d) => !d.base_form)) return undefined;
			for (const d of child.evolution_details) {
				if (!d.base_form) continue;
				const suffix = extractFormSuffix(d.base_form.name, link.species.name);
				if (suffix !== undefined && suffix in REGIONAL_FORMS) return suffix;
			}
			return undefined;
		}
		const found = inferAncestorFormSuffix(child, speciesName);
		if (found !== undefined) return found;
	}
	return undefined;
}

function buildEvolutionNode(
	link: RawEvolutionChainLink,
	id: number,
	detail: RawEvolutionChainLink["evolution_details"][number] | undefined,
	formSuffix: string | undefined,
	// `formSuffix` on context drives which BRANCH this function walks toward
	// the viewed species (see targetSuffix below) — `ownFormSuffix` is what
	// the viewed node itself displays as its own variety label. These differ
	// exactly in the inferAncestorFormSuffix case above: Obstagoon's context
	// carries formSuffix "galar" (so the Zigzagoon/Linoone ancestors resolve
	// down the Galar branch) but ownFormSuffix undefined (Obstagoon itself
	// isn't a variety — there's no "Galarian Obstagoon" to label it as).
	context?: { formSuffix: string; ownFormSuffix?: string; rootId: number; speciesName: string },
): EvolutionNode {
	// The viewed row's own id/formSuffix only ever belongs on the node whose
	// species actually matches it — the old code stamped it on whichever
	// link normalizeEvolutionChain was first called with (the chain's
	// structural root), which is wrong for any species where the Alolan
	// variety is an evolved stage rather than the base stage (Muk,
	// Exeggutor, Marowak): the root (Grimer/Exeggcute/Cubone) isn't the
	// viewed pokemon at all, so forcing the viewed id onto it produced two
	// chain nodes sharing one id (duplicate sprite, no connector) or a
	// mislabeled node showing the wrong sprite.
	const isViewedNode = context !== undefined && link.species.name === context.speciesName;
	if (isViewedNode) {
		id = context.rootId;
		formSuffix = context.ownFormSuffix;
	}

	// The suffix that decides which BRANCH/entry to walk toward is normally
	// the globally viewed one (context.formSuffix), not this node's own
	// possibly still-unresolved `formSuffix` — for a Muk-shaped chain, Grimer
	// doesn't know it's Alolan yet at this point, but still has to pick the
	// edge that leads to Muk-Alola specifically. Falls back to this node's own
	// `formSuffix` when there's no outer context at all: a Mime-Jr-shaped
	// child, having just been placed on its region branch by the pluralization
	// below (see `regionOnlyBranches`), needs to keep walking that SAME region
	// for its own children (Mr. Rime) even though no context object exists for
	// a true default-view walk — `formSuffix` is how that region survives one
	// level of recursion without a context to carry it. formSuffix (mutable)
	// stays this node's own DISPLAY state; targetSuffix (constant) drives edge
	// selection.
	const targetSuffix = context?.formSuffix ?? formSuffix;

	// Which suffixes some sibling of this link's children exclusively claims
	// via an exact base_form-tagged entry — e.g. Yamask's `evolves_to` has
	// both Cofagrigus (plain, no base_form entry at all) and Runerigus
	// (base_form "yamask-galar" only): once Runerigus claims "galar", a
	// Galarian-viewed Yamask must not also fall through to Cofagrigus's
	// unconditional entry, and a plain-viewed Yamask must not fall through to
	// Runerigus's (which has no unconditional entry to fall through on
	// anyway). Empty for the common case (no regional branching at this
	// node at all, e.g. Eevee's many evolutions) — nothing gets dropped then.
	const dedicatedSuffixes = new Set<string>();
	for (const c of link.evolves_to) {
		for (const d of c.evolution_details) {
			if (d.base_form) {
				const s = extractFormSuffix(d.base_form.name, link.species.name);
				if (s !== undefined) dedicatedSuffixes.add(s);
			}
		}
	}

	const children = link.evolves_to.flatMap((child) => {
		// A child that IS the viewed species is matched directly by which
		// entry's own evolved_form or region carries the viewed suffix — not
		// by this (possibly still-unresolved) node's own form, since for
		// Muk-shaped chains this node's own Alolan-ness is exactly what we're
		// trying to learn by looking at this edge. `region` (rather than
		// evolved_form) is how Mime Jr. -> Mr. Mime/Galarian Mr. Mime is
		// disambiguated — Mime Jr. itself has no Galarian variety, so neither
		// entry has a base_form, and only the Galarian entry names a region.
		const isViewedChild = context !== undefined && child.species.name === context.speciesName;
		const viewedDetail = isViewedChild
			? child.evolution_details.find(
					(d) =>
						(!!d.evolved_form && extractFormSuffix(d.evolved_form.name, child.species.name) === targetSuffix) ||
						(!!d.region && d.region.name === targetSuffix),
				)
			: undefined;

		const exactDetail = targetSuffix
			? child.evolution_details.find(
					(d) => !!d.base_form && extractFormSuffix(d.base_form.name, link.species.name) === targetSuffix,
				)
			: undefined;
		const unconditionalDetail = child.evolution_details.find((d) => !d.base_form);

		// Usually exactly one entry describes how to reach this child — the
		// one exception is a true default view (no targetSuffix at all) of a
		// Mime-Jr-shaped bucket: every entry agrees the PARENT carries no
		// variety of its own (no base_form anywhere), so there's nothing to
		// scope by, unlike Zigzagoon/Corsola/Yamask (where the parent itself
		// has a variety, and default view correctly shows only that variety's
		// own evolution). Picking just one there hid a real branch of the
		// family — viewing Mime Jr.'s own page showed no hint it can ever
		// reach Mr. Rime, since the Kanto path is a dead end and the only
		// route to Mr. Rime is through the region-gated Galar entry. Show
		// every distinct outcome (deduped by evolved_form, since redundant
		// entries across old/new version groups for the identical evolution
		// are common) as a sibling branch instead of arbitrarily dropping the
		// others.
		let selectedDetails: RawEvolutionChainLink["evolution_details"];
		if (viewedDetail) {
			selectedDetails = [viewedDetail];
		} else if (exactDetail) {
			selectedDetails = [exactDetail];
		} else if (targetSuffix !== undefined && dedicatedSuffixes.has(targetSuffix)) {
			// A sibling exactly owns this suffix; this branch doesn't apply to
			// it even though it has an otherwise-unconditional entry (Yamask
			// viewed as Galarian: Cofagrigus is dropped here).
			return [];
		} else if (targetSuffix === undefined && !child.evolution_details.some((d) => !!d.base_form)) {
			const seen = new Set<string>();
			selectedDetails = child.evolution_details.filter((d) => {
				const key = d.evolved_form?.name ?? "default";
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
		} else if (unconditionalDetail) {
			selectedDetails = [unconditionalDetail];
		} else if (targetSuffix === undefined) {
			// Base/default view, and every entry on this branch requires some
			// specific form we're not viewing (Corsola viewed as base: Cursola
			// is dropped here, fixing a pre-existing bug where this used to
			// fall through to evolution_details[0] regardless).
			return [];
		} else {
			selectedDetails = [child.evolution_details[0]];
		}

		return selectedDetails.map((childDetail) => {
			// This node only finds out it's itself a regional variant by seeing
			// which entry leads to the retained child, since PokeAPI never marks
			// a pre-evolution's own variety on its own link — only the matched
			// entry's base_form names it. Not gated on isViewedChild: a
			// grandparent two-plus hops from the viewed species (Zigzagoon,
			// viewing Obstagoon: Zigzagoon -> Linoone -> Obstagoon) needs this
			// exactly as much as a direct parent (Grimer, viewing Muk) —
			// childDetail only ever reaches here already resolved via
			// viewedDetail/exactDetail/unconditionalDetail, so a base_form on it
			// always describes *this* node's own required variety regardless of
			// how far down the chain the ultimately-viewed species sits. Absent
			// for a Mime-Jr-shaped child (region-only, no base_form): there's
			// genuinely nothing to infer, since Mime Jr. itself has no Galarian
			// variety. Mutates the enclosing `id`/`formSuffix` directly (not a
			// per-iteration copy) — safe even though this runs inside a `.map`
			// over possibly-multiple selectedDetails, since the pluralized-
			// branches case (multiple selectedDetails) only ever occurs when
			// NONE of them carry a base_form (that's the precondition for
			// pluralizing at all — see selectedDetails above), so this block
			// never fires more than once per node regardless of how many
			// children the bucket produces.
			if (!isViewedNode && childDetail?.base_form) {
				const ancestorSuffix = extractFormSuffix(childDetail.base_form.name, link.species.name);
				if (ancestorSuffix !== undefined) {
					formSuffix = ancestorSuffix;
					id = idFromUrl(childDetail.base_form.url);
				}
			}

			// The child's own id/form still follows the matched entry's
			// evolved_form when present — resetting to the *default* variety
			// when it's absent, unless the child is itself the viewed species,
			// in which case its id/form are exactly context's regardless: 2 of
			// the currently-modeled Alolan species (Exeggutor, Marowak) have a
			// region-gated, not form-gated, evolution that PokeAPI's
			// evolution_details can't disambiguate at all (both entries are
			// identical, no base_form/evolved_form difference) — this still
			// shows the correct viewed variety for that node itself, it just
			// can't recover the *ancestor's* own variety from that same gap
			// (see the `!isViewedNode &&` guard above). A known, documented
			// half-gap, not a silent bug.
			const childId = isViewedChild
				? context.rootId
				: childDetail?.evolved_form
					? idFromUrl(childDetail.evolved_form.url)
					: idFromUrl(child.species.url);
			const childFormSuffix = isViewedChild
				? context.ownFormSuffix
				: childDetail?.evolved_form
					? extractFormSuffix(childDetail.evolved_form.name, child.species.name)
					: undefined;
			return buildEvolutionNode(child, childId, childDetail, childFormSuffix, context);
		});
	});

	return {
		id,
		dexNumber: idFromUrl(link.species.url),
		name: link.species.name,
		formLabel: formSuffix ? REGIONAL_FORMS[formSuffix]?.label ?? null : null,
		minLevel: detail?.min_level ?? null,
		trigger: detail?.trigger?.name ?? null,
		item: detail?.item?.name ?? null,
		minHappiness: detail?.min_happiness ?? null,
		timeOfDay: detail?.time_of_day || null,
		heldItem: detail?.held_item?.name ?? null,
		minBeauty: detail?.min_beauty ?? null,
		relativePhysicalStats: detail?.relative_physical_stats ?? null,
		location: detail?.location?.name ?? null,
		knownMove: detail?.known_move?.name ?? null,
		partySpecies: detail?.party_species?.name ?? null,
		gender: detail?.gender ?? null,
		tradeSpecies: detail?.trade_species?.name ?? null,
		needsOverworldRain: detail?.needs_overworld_rain ?? false,
		turnUpsideDown: detail?.turn_upside_down ?? false,
		region: detail?.region?.name ?? null,
		minDamageTaken: detail?.min_damage_taken ?? null,
		usedMove: detail?.used_move?.name ?? null,
		minMoveCount: detail?.min_move_count ?? null,
		minSteps: detail?.min_steps ?? null,
		needsMultiplayer: detail?.needs_multiplayer ?? false,
		children,
	};
}

// `context` scopes the whole chain to a specific row's own variety (e.g.
// { formSuffix: "alola", ownFormSuffix: "alola", rootId: 10103, speciesName:
// "vulpix" } when viewing Alolan Vulpix's detail page) — omit it for a
// species' default/base row, which reproduces the original
// (pre-regional-forms) behavior exactly. `formSuffix` and `ownFormSuffix` are
// usually the same value; they diverge for a species like Obstagoon that's
// only reachable via a regional-variant ancestor but isn't itself a named
// variety — see inferAncestorFormSuffix and buildEvolutionNode's own comment
// on the split. `rootId` is passed in rather than derived, since
// PokedexRepository already knows it precisely (it's the same numeric id
// used to fetch whichever row is being viewed) — avoids this function ever
// having to guess a variety's own id. `speciesName` (the row's *base* species
// name, e.g. "muk") is what locates the viewed node within the chain — it's
// not always the chain's structural root, e.g. Muk/Exeggutor/Marowak are all
// evolved stages.
export function normalizeEvolutionChain(
	link: RawEvolutionChainLink,
	context?: { formSuffix: string; ownFormSuffix?: string; rootId: number; speciesName: string },
): EvolutionNode {
	return buildEvolutionNode(link, idFromUrl(link.species.url), undefined, undefined, context);
}

// Flattens an evolution chain tree down to the ids of every member (the
// currently-viewed Pokemon and every branch of its evolution family) — used
// to fetch sprites for the evolution tree display (see
// PokedexRepository.getEntrySprites).
export function collectChainIds(node: EvolutionNode, ids: number[] = []): number[] {
	ids.push(node.id);
	for (const child of node.children) collectChainIds(child, ids);
	return ids;
}

function findEvolutionNode(node: EvolutionNode, id: number): EvolutionNode | null {
	if (node.id === id) return node;
	for (const child of node.children) {
		const found = findEvolutionNode(child, id);
		if (found) return found;
	}
	return null;
}

// Level(s) at which `id` next evolves, read off the matching node's own
// children within the whole-family `root` tree — each child's minLevel
// describes how IT was reached from its parent (see normalizeEvolutionChain),
// not how `id` itself was reached. Empty for a final-stage member, or one
// that only evolves via item/trade (no level threshold to show). Deduped and
// sorted ascending since a branching evolution (e.g. Tyrogue) can have
// several children sharing the same level.
export function nextEvolutionLevels(root: EvolutionNode, id: number): number[] {
	const node = findEvolutionNode(root, id);
	if (!node) return [];
	const levels = node.children
		.map((child) => child.minLevel)
		.filter((level): level is number => level != null);
	return [...new Set(levels)].sort((a, b) => a - b);
}

// Max depth (number of evolution "levels" from the family's root to its
// deepest branch, NOT the count of species in it) of the WHOLE family
// tree — every member of a family reports the same value regardless of
// which stage it itself is (see QUIRKS' no-evolution/one-evolution/
// two-plus-evolutions options and PokedexTableRow.evolutionStages).
// Branching width (e.g. Eevee's 8 evolutions) doesn't add depth, only extra
// branches at the same level — Eevee and every Eeveelution alike report
// depth 1.
//
// Deliberately operates on the RAW chain (RawEvolutionChainLink), not a
// normalized EvolutionNode from buildEvolutionNode — that function has to
// pick exactly ONE coherent path to label a specific viewed form (dropping
// every branch that requires a different, unviewed base_form/region), which
// is right for rendering one Pokemon's own evolution card but wrong here:
// walking `evolves_to` directly and counting every distinct child species,
// with no base_form/region branch-selection at all, avoids a real
// undercount buildEvolutionNode's default (no-context) view has for a
// species whose ONLY evolution route is entirely form-gated with no
// unconditional sibling entry to fall back to — e.g. plain Farfetch'd has no
// evolution of its own; only Galarian Farfetch'd evolves into Sirfetch'd,
// gated on a single base_form-only entry (verified live against
// /evolution-chain for Farfetch'd) — buildEvolutionNode's default view
// drops that branch entirely (same "base/default view drops a
// form-exclusive branch" rule Corsola/Cursola relies on), which would
// wrongly report depth 0 for the whole family. Recursing over `evolves_to`
// (distinct child species) rather than `evolution_details` (alternate
// requirement entries for reaching the SAME child, e.g. Meowth-shaped
// dual-entry branches) still counts each real evolution event exactly once.
export function evolutionFamilyDepth(link: RawEvolutionChainLink): number {
	if (link.evolves_to.length === 0) return 0;
	return 1 + Math.max(...link.evolves_to.map(evolutionFamilyDepth));
}

// Human-readable label for what triggers `node`'s own evolution (e.g. "Lv.
// 16", "Thunder Stone", "Trade (metal-coat)") — used as the method line on
// EvolutionChain's card for this node. Priority-ordered: the base label
// checks minLevel > item > minHappiness > minBeauty > knownMove >
// partySpecies > location > trigger (excluding level-up, which needs no
// label of its own), first match wins. relativePhysicalStats, gender, and
// timeOfDay are independent suffixes layered on top of whichever base label
// (if any) matched. trigger==="trade" && heldItem, and trigger==="trade" &&
// tradeSpecies, are hard overrides — they replace the base label entirely
// rather than layering, since "Trade (item)"/"Trade (for X)" is a more
// complete description than whatever base branch also happened to match
// (e.g. a trade evolution can carry a minHappiness value on some species
// without happiness actually being the real requirement). heldItem and
// tradeSpecies are mutually exclusive in practice (Gen 5's Karrablast/Shelmet
// pair is trade_species-only, no held item).
export function describeEvolutionRequirement(node: EvolutionNode): string {
	let base = "";
	if (node.minLevel) base = `Lv. ${node.minLevel}`;
	else if (node.item) base = node.item.replace(/-/g, " ");
	else if (node.minHappiness) base = "Friendship";
	else if (node.minBeauty) base = "Beauty";
	else if (node.knownMove) base = `Knows ${node.knownMove.replace(/-/g, " ")}`;
	else if (node.partySpecies) base = `${node.partySpecies.replace(/-/g, " ")} in party`;
	else if (node.location) base = node.location.replace(/-/g, " ");
	// Gen 8+: Runerigus's take-damage trigger carries its own threshold
	// (min_damage_taken), worth showing over the generic trigger-name
	// fallback below ("Take damage" alone doesn't say how much).
	else if (node.minDamageTaken) base = `Take ${node.minDamageTaken}+ dmg`;
	// Hisuian Qwilfish -> Overqwil: use a specific move a set number of times
	// (Barb Barrage x20), worth showing over the generic trigger-name fallback
	// below ("strong style move" alone doesn't say which move or how many).
	else if (node.usedMove && node.minMoveCount) {
		base = `${node.usedMove.replace(/-/g, " ")} x${node.minMoveCount}`;
	}
	// Gen 9: Pawmot/Rabsca/Brambleghast's only condition (level-up trigger, no
	// level/item/happiness of its own) — worth showing over the generic
	// trigger-name fallback below, same reasoning as minDamageTaken/usedMove.
	else if (node.minSteps) base = `Walk ${node.minSteps} steps`;
	// Gen 9: two new named triggers with no other condition attached (neither
	// carries a level/item), so the generic trigger.replace(/-/g, " ") fallback
	// below would otherwise show an awkward literal ("three defeated bisharp",
	// "gimmighoul coins") — same "worth a real label" treatment as every other
	// hard-to-read trigger name already gets above.
	else if (node.trigger === "three-defeated-bisharp") base = "Defeat 3 Bisharp";
	else if (node.trigger === "gimmighoul-coins") base = "Full Coin Hoard";
	else if (node.trigger && node.trigger !== "level-up") base = node.trigger.replace(/-/g, " ");

	if (node.relativePhysicalStats === 1) base = base ? `${base} (Atk > Def)` : "Atk > Def";
	else if (node.relativePhysicalStats === -1) base = base ? `${base} (Def > Atk)` : "Def > Atk";
	else if (node.relativePhysicalStats === 0) base = base ? `${base} (Atk = Def)` : "Atk = Def";

	if (node.needsOverworldRain) base = base ? `${base} (Rain)` : "Rain";
	if (node.turnUpsideDown) base = base ? `${base} (Upside-down)` : "Upside-down";
	if (node.needsMultiplayer) base = base ? `${base} (Multiplayer)` : "Multiplayer";

	if (node.trigger === "trade" && node.heldItem) {
		base = `Trade (${node.heldItem.replace(/-/g, " ")})`;
	} else if (node.trigger === "trade" && node.tradeSpecies) {
		base = `Trade (for ${node.tradeSpecies.replace(/-/g, " ")})`;
	}

	if (node.gender === 1) base = base ? `${base} (Female)` : "Female";
	else if (node.gender === 2) base = base ? `${base} (Male)` : "Male";

	// Gen 8+: an evolution that only happens "in Galar" (e.g. Mime Jr. ->
	// Galarian Mr. Mime) regardless of the parent's own variety — distinct
	// from formLabel, which describes THIS node's own variety, not where its
	// evolution happened.
	if (node.region) {
		const regionLabel = node.region.charAt(0).toUpperCase() + node.region.slice(1);
		base = base ? `${base} (in ${regionLabel})` : `In ${regionLabel}`;
	}

	if (!node.timeOfDay) return base;
	const timeLabel = node.timeOfDay === "day" ? "Day" : node.timeOfDay === "night" ? "Night" : node.timeOfDay;
	return base ? `${base} (${timeLabel})` : timeLabel;
}

// One entry per tab (across every generation's FLAVOR_TEXT_TABS_BY_GEN
// entry) that has a matching version in this species' data — missing for a
// tab only if the species genuinely never appeared in that game (always
// true for a species older than the tab's generation, e.g. a Gen 1-3 mon
// has no diamond-pearl entry). DetailScreen's version cycler filters this
// map's keys down to whichever generation is currently active.
export function extractFlavorTexts(
	species: RawSpecies,
	tabs: readonly {
		key: string;
		versions: readonly string[];
	}[] = Object.values(FLAVOR_TEXT_TABS_BY_GEN).flat(),
): Record<string, string> {
	const english = species.flavor_text_entries.filter((e) => e.language.name === "en");
	const texts: Record<string, string> = {};
	for (const tab of tabs) {
		for (const version of tab.versions) {
			const match = english.find((e) => e.version.name === version);
			if (match) {
				texts[tab.key] = match.flavor_text.replace(/[\n\f\r]+/g, " ").trim();
				break;
			}
		}
	}
	return texts;
}

// PokeAPI's `flavor_text_entries` carries every language and every game the
// species has ever appeared in — extractFlavorTexts only ever reads English
// entries from FLAVOR_TEXT_VERSION_GROUPS. Trimming it down before a raw
// species response is cached keeps a table load of ~400 rows from parsing a
// field that's only read once the detail view opens.
export function trimFlavorTextEntries(
	entries: RawSpecies["flavor_text_entries"],
	versionGroups: readonly string[] = FLAVOR_TEXT_VERSION_GROUPS,
): RawSpecies["flavor_text_entries"] {
	return entries.filter(
		(e) => e.language.name === "en" && versionGroups.includes(e.version.name),
	);
}

// Rarity is per game version, scoped down to `supportedVersions` (defaults
// to every version this app currently supports across all generations) so
// an item only appearing in an out-of-scope game (a spinoff like
// Colosseum/XD, or a future generation not yet added — e.g. Parasect's
// Balm Mushroom, Gen 5 (Black/White) only) doesn't show at all while this
// app is capped at Gen 4, and doesn't pollute an in-scope item's rarity
// with that other game's possibly-different number. An item with no
// version_details left after filtering is dropped entirely.
export function normalizeHeldItemDetails(
	heldItems: RawPokemon["held_items"],
	supportedVersions: readonly string[] = FLAVOR_TEXT_VERSION_GROUPS,
): { name: string; rarities: number[] }[] {
	return heldItems
		.map((h) => ({
			name: h.item.name,
			rarities: [...new Set(
				h.version_details
					.filter((v) => supportedVersions.includes(v.version.name))
					.map((v) => v.rarity),
			)].sort((a, b) => a - b),
		}))
		.filter((h) => h.rarities.length > 0);
}

// Table-column shape (see PokedexTableRow.heldItemNames) — same era scope as
// normalizeHeldItemDetails above, just names instead of rarity.
export function normalizeHeldItems(
	heldItems: RawPokemon["held_items"],
	supportedVersions: readonly string[] = FLAVOR_TEXT_VERSION_GROUPS,
): string[] {
	return normalizeHeldItemDetails(heldItems, supportedVersions).map((h) => h.name);
}

export function normalizeEvYield(rawStats: RawPokemon["stats"]): EvYieldEntry[] {
	const yields: EvYieldEntry[] = [];
	for (const entry of rawStats) {
		if (entry.effort <= 0) continue;
		const key = STAT_KEY_MAP[entry.stat.name];
		if (key) yields.push({ stat: key, amount: entry.effort });
	}
	return yields;
}

// Regional-form varieties show up in species.varieties the same way Mega
// ones do, exact-matching "{species}-{suffix}" for every suffix this app
// currently knows about (see REGIONAL_FORMS) — unlike Mega, a match here
// means a genuinely separate browsable row (see PokedexRepository's
// fetchRow), not a same-row detail-page toggle, so this returns enough to
// build one: `key` for the /pokemon/{key} fetch, `suffix` to thread into
// normalizeEvolutionChain's context, `label` for display.
export function deriveRegionalForms(
	species: RawSpecies,
): { key: string; suffix: string; label: string }[] {
	return species.varieties.flatMap((v) => {
		const suffix = extractFormSuffix(v.pokemon.name, species.name);
		if (suffix === undefined || !(suffix in REGIONAL_FORMS)) return [];
		return [{ key: v.pokemon.name, suffix, label: REGIONAL_FORMS[suffix].label }];
	});
}

// Mega/Gigantamax varieties show up in species.varieties as extra
// non-default entries named "{species}-mega", "{species}-mega-x/-y", or
// "{species}-gmax" (verified live against several species' varieties — no
// PokeAPI field marks "is this a Mega" directly without an extra
// pokemon-form fetch per candidate, but the naming convention is exact and
// stable). Filtered to "-mega" only — see deriveGigantamaxForms below for
// Gigantamax. Gated on `pokemon.name === species.name` (the viewed row being
// the species' own default/base variety) since Mega Evolution only ever
// attaches to the base form — caught live as a real bug: Galarian Slowbro
// was inheriting Slowbro's own Mega Evolution just because both rows share
// one `species` record, even though only Kantonian Slowbro can actually Mega
// Evolve in-game. Every curated `MEGA_VARIETY_KEYS` entry is itself always
// `{base-species-name}-mega...`, never a regional-form-prefixed variant, so
// this check alone is sufficient — no regional form needs its own entry.
export function deriveMegaForms(pokemon: RawPokemon, species: RawSpecies): MegaFormSummary[] {
	if (pokemon.name !== species.name) return [];
	const prefix = `${species.name}-mega`;
	return species.varieties
		.filter((v) => v.pokemon.name.startsWith(prefix) && MEGA_VARIETY_KEYS.has(v.pokemon.name))
		.map((v) => {
			const suffix = v.pokemon.name.slice(prefix.length);
			const label = suffix === "-x" ? "Mega X" : suffix === "-y" ? "Mega Y" : "Mega";
			return { key: v.pokemon.name, label };
		});
}

// Unlike Mega, matched against the CURRENTLY VIEWED variety's own name
// (`pokemon.name`), not the bare species name — verified live that a
// species with multiple non-Gigantamax varieties of its own (Toxtricity:
// "toxtricity-amped"/"toxtricity-low-key"; Urshifu:
// "urshifu-single-strike"/"urshifu-rapid-strike") gets a SEPARATE Gigantamax
// variety per one ("toxtricity-amped-gmax", "toxtricity-low-key-gmax", ...),
// not one shared "{species}-gmax". Since this app only ever browses a
// species' `is_default` variety (the other personality/strike variants
// aren't separately browsable, a pre-existing gap, not a new one), this
// naturally only ever surfaces the one Gigantamax form relevant to whichever
// row is actually being viewed.
export function deriveGigantamaxForms(pokemon: RawPokemon, species: RawSpecies): GigantamaxFormSummary[] {
	const gmaxName = `${pokemon.name}-gmax`;
	return species.varieties
		.filter((v) => v.pokemon.name === gmaxName)
		.map((v) => ({ key: v.pokemon.name, label: "Gigantamax" }));
}

// A Gigantamax form's own images, fetched from its /pokemon/{key} response
// (see PokedexRepository.getGigantamaxForm) — Gigantamax changes no
// stats/types/abilities (verified live comparing Gengar vs. gengar-gmax),
// only the sprite/artwork, so there's nothing else to normalize here unlike
// toMegaFormDetail.
export function toGigantamaxFormDetail(images: {
	sprite: string | null;
	artwork: string | null;
	shiny: string | null;
	shinyArtwork: string | null;
}): GigantamaxFormDetail {
	return {
		spriteDataUri: images.sprite,
		artworkDataUri: images.artwork,
		shinyDataUri: images.shiny,
		shinyArtworkDataUri: images.shinyArtwork,
	};
}

// Types/abilities/stats for a Mega form, fetched from its own /pokemon/{key}
// response (see PokedexRepository.getMegaForm) — everything else about a
// Mega (breeding, moves, evolution, flavor text) stays the base species'
// own data, since Mega is a battle-only transform, not a distinct entry.
export function toMegaFormDetail(
	pokemon: RawPokemon,
	images: { sprite: string | null; artwork: string | null; shiny: string | null; shinyArtwork: string | null },
): MegaFormDetail {
	return {
		types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
		abilities: pokemon.abilities
			.sort((a, b) => a.slot - b.slot)
			.map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
		stats: normalizeStats(pokemon.stats),
		spriteDataUri: images.sprite,
		artworkDataUri: images.artwork,
		shinyDataUri: images.shiny,
		shinyArtworkDataUri: images.shinyArtwork,
	};
}

export function toTableRow(
	pokemon: RawPokemon,
	species: RawSpecies,
	spriteDataUri: string | null,
): PokedexTableRow {
	const formSuffix = resolveRegionalFormSuffix(pokemon, species);
	const form = formSuffix ? REGIONAL_FORMS[formSuffix] : undefined;
	return {
		id: pokemon.id,
		dexNumber: species.id,
		formLabel: form?.label ?? null,
		generationId: form?.generationId ?? resolveGenerationId(species.id),
		// Always the clean base species name ("rattata"), identical across a
		// species' default row and every regional-form row it has — pokemon.name
		// is the raw variety slug ("rattata-alola") instead, unsuited for
		// display; see utils/pokemonDisplay.ts's formatPokemonDisplayName for
		// how formLabel composes back in for the UI.
		name: species.name,
		types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
		stats: normalizeStats(pokemon.stats),
		evYield: normalizeEvYield(pokemon.stats),
		abilityNames: pokemon.abilities.sort((a, b) => a.slot - b.slot).map((a) => a.ability.name),
		levelUpMoveNames: [...new Set(
			normalizeMoves(pokemon.moves)
				.filter((m) => m.learnMethod === "level-up")
				.map((m) => m.name),
		)],
		heldItemNames: normalizeHeldItems(pokemon.held_items),
		spriteDataUri,
		height: pokemon.height,
		weight: pokemon.weight,
		catchRate: species.capture_rate,
		hatchCounter: species.hatch_counter,
		rarity: species.is_mythical ? "mythical" : species.is_legendary ? "legendary" : "normal",
		isBaby: species.is_baby,
		canMegaEvolve: deriveMegaForms(pokemon, species).length > 0,
		canGigantamax: deriveGigantamaxForms(pokemon, species).length > 0,
		// Static lookup, not a fetch — see EVOLUTION_STAGES in constants.ts.
		evolutionStages: EVOLUTION_STAGES[species.id] ?? 0,
	};
}

export function toEntry(
	pokemon: RawPokemon,
	species: RawSpecies,
	evolutionChain: EvolutionNode | null,
	images: { sprite: string | null; artwork: string | null; shiny: string | null; shinyArtwork: string | null },
): PokedexEntry {
	return {
		...toTableRow(pokemon, species, images.sprite),
		abilities: pokemon.abilities
			.sort((a, b) => a.slot - b.slot)
			.map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
		artworkDataUri: images.artwork,
		shinyDataUri: images.shiny,
		shinyArtworkDataUri: images.shinyArtwork,
		flavorTexts: extractFlavorTexts(species),
		eggGroups: species.egg_groups.map((g) => g.name),
		genderRate: species.gender_rate,
		moves: normalizeMoves(pokemon.moves),
		evolutionChain,
		heldItems: normalizeHeldItemDetails(pokemon.held_items),
		megaForms: deriveMegaForms(pokemon, species),
		gigantamaxForms: deriveGigantamaxForms(pokemon, species),
	};
}
