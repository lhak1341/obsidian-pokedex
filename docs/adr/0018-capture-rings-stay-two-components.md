# Capture & Breeding's rings stay two components; their shared breakpoint is pinned by a test

An architecture review flagged two things in the Capture & Breeding panel: the 540px breakpoint at which each ring's label moves from beside the dial to under it is written in three files (`DetailScreen.svelte`'s `capture` container, `Ring.svelte`, `GenderRing.svelte`) with nothing checking they agree, and `Ring` and `GenderRing` duplicate the dial. It suggested one Capture & Breeding module owning the container and every breakpoint, and one ring taking a list of arcs.

**The rings differ on purpose in four ways**, so a merged ring would carry each difference as a prop or a branch, and its interface would be about as wide as both components together:

- **Arcs and caps.** `Ring` draws one arc with round caps. `GenderRing` draws two arcs that meet, with square caps, because round caps would overlap at the join.
- **Value in the dial.** Below 540px, `Ring` moves its value into the dial. `GenderRing` never does: it has two percentages.
- **Text.** `Ring` shows `value / max`. `GenderRing` shows the male and female shares with icons, or "Genderless" / "None".
- **Fill.** `Ring`'s fill comes from `ringFill(value, max)`. `GenderRing`'s comes from two shares of a ratio.

What they truly share is the dial's geometry. That now lives in `src/utils/ring.ts` (`RING_SIZE`, `RING_STROKE`, `RING_RADIUS`, `RING_CIRCUMFERENCE`, `arcDasharray`), tested in `ring.test.ts`, which also gave `GenderRing`'s two-arc split its first test.

**One breakpoint owner would reach into another component.** A container query cannot read a CSS variable, and Svelte scopes each component's `<style>`, so the 540 can be written once only if the panel styles the rings' internals through `:global(.ring …)`. That moves each ring's narrow layout out of the ring, into a selector that breaks silently when the ring's markup changes, and it widens `DetailScreen` → panel props (`entry`, `encounters`, `activeHeldItems`, `repository`, the gender shares) for no logic gain. Instead `src/view/paneBreakpoint.test.ts` names the capture widths (`CAPTURE_WIDTHS`: 540, 360) and fails when any `@container capture` query uses another width, or when the panel or either ring stops switching at 540. That is the same pattern the leaf widths already follow (`PANE_THRESHOLDS`).

**Decision:** keep `Ring` and `GenderRing` as two components over shared geometry in `utils/ring.ts`. Each keeps its own `@container capture` query, and the test pins the widths. Rejected alternatives: one ring with an `arcs[]` prop, and a Capture & Breeding component that owns the rings' breakpoints through `:global`.

**Reopen when** a third ring joins the panel, or the four differences above go away. Don't re-flag the 540 being written in three files: the test is the guard.
