# Keep dex-range and row-generationId membership checks separate

`isIdInGenerations` (`src/utils/filterPokemon.ts`) checks a bare dex number against a generation's numeric range; `matchesGenerations` checks a row's actual `generationId` field. An architecture review flagged these as one concept split in two, risking silent disagreement — `PokedexLoadState.ts` uses `isIdInGenerations` for `failedIds`, while `generationScope.ts`'s row-visibility `includes` uses `matchesGenerations`.

On inspection this is not accidental duplication: `failedIds` only ever contains base fetch ids (a regional-form fetch failure is caught upstream in `PokedexRepository.getRowsForIds` and never reaches `failedIds` — see `PokedexLoadState.ts:69-75`'s own comment), so a dex-range check is correct and sufficient there. Row visibility, by contrast, must check a regional-form row's actual `generationId`, since that can diverge from what its dex number's range would imply (see `PokedexTableRow.generationId`'s doc comment) — a range check would be wrong for that case.

**Decision:** keep the two predicates separate. Rejected alternative: unify into one predicate — would require either fabricating a fake row to check bare failed ids, or incorrectly range-checking a regional-form row's dex number instead of its real `generationId`. Don't re-merge these without re-deriving this invariant first.
