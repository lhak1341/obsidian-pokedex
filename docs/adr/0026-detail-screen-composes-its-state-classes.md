# The detail screen composes its two state classes itself

An architecture review (2026-11-28, candidate 4) proposed one plain "Detail session" class that would compose `DetailLoadState` and `VarietyToggleState` and own the portrait render, so `DetailScreen.svelte` would mirror one snapshot. Its reasons: each class is tested alone, but their composition lives in the untested component. That composition is a reset on a new id, a Sprite style switch reaching both classes, and a form failure's label read from the entry. It also found the render held in three places under two conventions. It found no bug.

On inspection:

- **The composition is wiring, one call per line.** `startLoad` calls `varietyToggle.resetSelection()` and then `loadState.load(id, render, …)`. The render effect calls `loadState.setRender(render, …)` and `varietyToggle.reselect(render, …)`. `selectMegaForm`/`selectGigantamaxForm` pass the current render. `reportFormFailure` finds the form's label among the entry's `megaForms`/`gigantamaxForms`. A session class would need `open`, `setRender`, `selectMega`, `selectGigantamax`, `retry`, `cancel` and `snapshot`, plus callbacks for updates, move details, a load failure and a form failure: an interface as wide as the lines it replaces. Deleting it would move those lines back, not remove them.
- **The bug the review pointed to lived in the classes.** 834b0b9 ("A Sprite style switch mid-load keeps the new render") fixed a render that sat on the repository, where neither the entry's image reload nor `reselect` superseded a request already in flight. The fix and its tests went into `DetailLoadState` (`setRender` under its own extras counter) and `VarietyToggleState` (newest answer per form key). `DetailScreen` changed only its calls. 2613f94's "a failed form load reverts" is `VarietyToggleState`'s rule too, tested there.
- **The render's two conventions follow when each class reads it.** `DetailLoadState` holds the render because a load in flight reads it when it reaches its extras stage (`render: () => this.render`), after a switch may have changed it. `VarietyToggleState` takes the render with each call because its request starts at the click, and its staleness is a request counter per variety key, not the render. Holding it there too would add state nothing reads later.

**Decision:** `DetailScreen.svelte` keeps composing `DetailLoadState` and `VarietyToggleState`, and `VarietyToggleState` keeps taking the render per call. ADR-0009 covers the derivations and the mirrored snapshots; this covers the composition.

**Rejected:** a Detail session class owning entry, Variety toggle and render (above), and `VarietyToggleState` holding the render the way `DetailLoadState` does.

**Reopen when** a bug's cause is the order or presence of the calls between the two classes (a Sprite style switch reaching only one, a new id not resetting the toggle), or a third state class joins the detail screen's composition.
