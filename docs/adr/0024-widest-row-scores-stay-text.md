# The widest-row scores stay text measures

An architecture review (2026-11-25, candidate 5) proposed that each content-sized table column have one cell description in `tableColumns.ts`: its text runs, separators and per-run box padding, with `TableGrid` drawing the cell from it and `tableWidestRows` deriving the score from it. Its reason: the scores restate in TypeScript what each cell draws in markup and CSS. Name is drawn bold and capitalised but scored as plain text. Type badges and EV chips add padding, a margin, a dot and a smaller font that the score leaves out. The held-item separator is CSS `::after` in the cell and `.join(", ")` in the score. Typecheck forces each custom cell to have a score branch, but not to agree with the cell. The review guessed, without probing, that under a wide font a dual type could out-draw a longer single type.

On inspection:

- **The ranking matches what is drawn.** In `pokedex-test-vault` (all 9 generations, 1,082 rows, a 1,396px leaf, Type as text, default Fields), the table was scrolled through every row, once in the default font and once with `font-family: Verdana` set inline on the table. Each row's drawn width was compared with its score: Name's `.marked-name` rect; Type's badge rects plus their `margin-right`; EV's `.ev-chip` rects plus the 4px gaps between them. The scores were measured as `tableWidestRows` does, with canvas `measureText` in the table's computed font. In both fonts, the two rows each score picks include the widest drawn row, so no pixel is lost:

  | Column | Widest drawn (default / Verdana) | Next drawn row that ties neither |
  |---|---|---|
  | Name | Paldean (Combat Breed) Tauros, 227.59 / 270.23px | 17.65px narrower (Blaze Breed) |
  | Type as text | Fighting Psychic, 145.84 / 157.86px | ties (Psychic Fighting); under the column's 168px floor anyway |
  | EV yield | 1 SpA, 1 SpD, 1 Spe, 188.14 / 205.01px | 2.65px narrower (1 Atk, 1 SpA, 1 SpD) |

  Within a column, every run gets the same padding and a proportional font, so the plain-text order is the drawn order. The widest rows also lead by a margin that weight and case do not close.
- **The padding is not the table's to own.** `TypeBadge.svelte` and `EvChips.svelte` hold it in their own `<style>`, and the detail screen and the evolution cards draw them too. A description in `tableColumns.ts` would be a second copy of that CSS, not a replacement for it. The only way to keep a score in step with CSS is to read the drawn cells at runtime, which is what the scores exist to avoid (ADR-0019: a measured width needs every row's content).

**Decision:** each `tableWidestRows` score stays the cell's plain text, measured in the table's font. EV still ranks by chip count first (`length * 10_000`, pinned in `tableColumns.test.ts`).

**Rejected:** a per-column cell description shared by the cell and its score (above). Widening `widestRows` to rank by two values instead of EV's `10_000`: one column's tie-break does not justify the churn.

**Reopen when** a cell gets a run whose box differs from row to row, rather than one fixed padding per run, or the walk above finds a column's widest and next-widest rows within about 1px of each other.
