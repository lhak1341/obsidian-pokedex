# Press-and-hold bindings stay two, over one injected PressWatch

The favourites menu (`src/view/favoriteMenu.ts`, #35) and the portrait's art preview (`src/view/portraitPress.ts`, #31) each bind press and hold to the DOM. An architecture review (2026-11-19, candidate 3) proposed merging them into one binding factory because their four pointer handlers repeat line for line.

**Decision:** keep two bindings. Each takes its `PressWatch` (`src/view/pressWatch.ts`) as an optional parameter, and the favourites menu also takes its Menu opener, both defaulting to the real ones. `favoriteMenu.test.ts` and `portraitPress.test.ts` drive the wiring with a fake watch (`src/view/__fixtures__/fakePressWatch.ts`), which makes the watch a real seam with two adapters. The rules stay in `utils/pressHold.ts` and its tests.

- The shared part is about 20 lines of forwarding pointer events into a step function. Everything else differs: `contextmenu` (the menu opens or swallows it; the portrait only blocks it during a press), the down event (the portrait adds `onToggle`), the stop point (the menu stops watching at the hold, the portrait at idle, since a scroll ends its preview), the shape (`target(id)` per row vs. one `props`) and the effects (a Menu vs. `artPreview`). A merged factory would take all five as parameters, an interface about as wide as the code it hides.
- The review's real finding was a lifecycle bug: the favourites menu had no `destroy()`, so a hold still pending when the view remounts (any settings change) could open a Menu from the old instance. `destroy()` now exists, TableScreen calls it, and a test pins it.

**Rejected:** the merged factory (above), and a fake `Menu` in `src/data/__fixtures__/obsidian-stub.ts`, which would make the shared stub stateful for one test.

**Reopen when** a third press-and-hold binding appears, or the two bindings' differences shrink to one parameter.
