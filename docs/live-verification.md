# Live verification recipes

How to drive and read the running plugin through `obsidian eval` when checking a `src/view`
change live. Emulated mobile and the iPhone loop are in `docs/mobile-verification.md` (the CLI
targets `pokedex-test-vault`; a hidden window throttles timers, so evals stall and Notices never
time out (clear `.notice` before checking one shows); `dev:mobile` is global, turn it off).

## Setting up

- Focus first: `getLeavesOfType('pokedex-view')` + `setActiveLeaf(leaf, {focus:true})`. For a genuinely fresh Svelte
  mount, swap the same leaf's view: `setViewState({type:'empty'})`, then `setViewState({type:'pokedex-view',active:true})`.
  Detaching breaks emulated mobile (`docs/mobile-verification.md` step 5). A setting changed in memory shows after
  `plugin.saveSettings()`, whose `refresh` pushes a copy into every leaf's app without remounting it (only a generation
  scope change reloads rows), or after that remount: mutating `plugin.settings.X` in place changes nothing on screen.
- Fake the plugin's slow or persistent I/O on the live instance, restored in a `finally` by `delete`-ing the own property
  (the prototype method shows through): `repo.getTableRows`/`retryRows` for the load, banner and Notice paths, since a
  real-vault load once took over 90 s (rows render, `.loading-more-banner` stays up, so a few-second sleep reads the
  banner and Notices as absent); `plugin.loadData`/`saveData` for a settings path or any control that persists (a
  favourite asterisk tap saves settings) (return the old-shape data, capture writes, `await plugin.loadSettings()`, then
  the leaf swap above), so `data.json` is never written. Poll for the banner to clear only when the real load is the
  thing under test.
- A live read can describe a state other than the one you set up, so return the setup's own value with every
  measurement and read only after an `await`: rows stream in after a reload (poll `tbody tr` until two reads 1.5s
  apart match), Svelte applies a dispatched event's state change on a later microtask (a same-tick read returned the
  old class), and a window reload clears an inline width override (a hold check ran at the wide layout unnoticed until
  its 181px image gave it away; return the leaf or container width with each read). A window reload can bring the
  window back hidden, and a hidden window runs no ResizeObserver, so a leaf width set inline moves every `pane` query but
  not the JS width class or detail band (#33: a 768px leaf drew three columns). Re-run mobile-verification step 2's
  `show()` after each reload and return the mounted layout with each read. The running code and its log can be older than your
  change: after copying a build, `plugin:reload` and return a new symbol's `typeof` (a reopened window ran the old build), and
  read a `dev:errors` entry's timestamp before diagnosing it (a 404 from an earlier session's eval probe read as a plugin bug).
- Narrow-pane width budget: a 390px leaf leaves the browse content 319px (12px `.view-content` + 16px `.pokedex-view`
  padding a side, and a 15px scrollbar gutter that `dev:mobile` keeps). `.pokedex-view` (not `.workspace-leaf-content`
  or `.table-wrap`, which merely wrap it) is the scroll container. A real Narrow pane needs no emulation:
  `await app.workspace.getRightLeaf(false).setViewState({type:'pokedex-view'})`, then `rightSplit.expand()` and
  `revealLeaf` it, gives a ~300px leaf beside the wide one (detach it after). Unrevealed it measures 0 and shows the wide
  layout, and JS clicks still land in it, so a check against it silently tests the wrong width class. In a desktop
  window the ribbon eats ~44px: collapse both splits and `resizeTo(390 + (390 − leafWidth), h)` for a 390px leaf.
  Restore with `require('electron').remote.getCurrentWindow().setSize(1440, 870)` and read it back: the size persists
  across reopens, and a `resizeTo` right after a leaf swap read back unchanged twice.
- Drive saved preferences through `plugin.preferences` (`toggleFavorite(id)`, `setLayout('narrow'|'wide', layout)`)
  rather than the UI, and restore both after: each width class keeps its own layout (the test vault's narrow one is
  Card view).
- The dev machine has the OS Reduce Motion on, so every transition reads 0s live (it is not a broken token): to see
  real timing, set `--lk-duration-base` inline on the leaf's `contentEl` in a `try`/`finally`.

## Finding and reading elements

- Both screens' DOM stay mounted. `.pokedex-view > div`'s `className` contains `hidden-screen` when the table is hidden
  (viewing detail); `.dex-eyebrow`'s `textContent` (`"No. 004"`) says which Pokemon. A class reused across screens
  (`.held-item-name` in `TableScreen.svelte` and `HeldItemsPanel.svelte`, `.info-popover-box`) matches the hidden
  screen's element unless the selector is scoped to `.table-screen`/`.detail-screen` first, and state held outside a
  screen outlives it (a pin on the hidden table suppressed every hover preview until `infoPopover.svelte.ts` began
  dropping a pin whose target has no client rects). If the leaf is on the detail screen (a window reload restores it),
  the table is `display: none`: it measures 0px and every timed action skips style/layout (a favourite toggle read
  22 ms against a real 153 ms). Click `.detail-screen .back-button` and check `hidden-screen` is gone in the same eval
  as the probe.
- Names are capitalized by CSS `text-transform`: `.textContent` is the raw lowercase value (`"ivysaur"`), so match
  lowercase. Open a detail page by clicking the row's `.name-cell`. Toggle `aria-label`s flip with state ("Show shiny
  sprite" / "Show normal sprite", "Show Mega X form" / "Show base Mega X form"), so find a button by its current label
  or the click throws.
- FilterBar's Type/Gen/Ability/Stats/Rarity/EV/Quirks dropdowns are native `<details>`/`<summary>`, not JS popovers:
  click the `<summary>` (match trimmed text with `startsWith`; some carry a live count badge like "Gen 1").
- Info popovers (`.info-popover-box`, `.pinned` when pinned; targets are `.pkdx-info-target`): preview with
  `new PointerEvent('pointerenter', {pointerType:'mouse'})` on the target (a `MouseEvent('mouseenter')` no longer opens
  it, and `pointerType:'touch'` must not); pin with `el.click()`; close with a `keydown` `Escape` on `document.body`.
  The body fills after an async fetch, so wait ~2s. Only one box is open across every instance (module-level pin
  state). Scroll the target into view before `focus()` + Enter: with an off-screen target, Enter's pin read as closed
  (inferred: `focus()` scrolled it into view and that scroll closed the pin; in view, 0 scrolls fired and it pinned).
- Truncation, wrapping or touching text across every row or tile:
  `[...containerEl.querySelectorAll('.name-cell')].filter(c => c.scrollWidth > c.clientWidth)`, compare
  `getBoundingClientRect().top` across a flex-wrap container's children, and for neighbours running together compare
  each text's `Range.getBoundingClientRect()` with the previous one (Card view's `.strip-col b`). A screenshot only
  covers visible rows. A cell's `scrollHeight`/`scrollWidth` counts absolutely positioned overflow, so a `td.info-target-cell` (tap area 64px past it) reads ~100px tall: measure a cell's content with a `Range` over it.
  A `Range` is the line box, not the ink: for a mark beside text, take the last glyph's ink from a canvas
  `measureText(c)` (`actualBoundingBoxAscent`/`Right`, `ctx.font` from the element's computed font) against a
  zero-size `inline-block` baseline probe span inserted after the text (#35's dot clearances).
- The favourites menu is a native macOS popup on desktop, so a DOM probe never sees it: use the throwaway
  `setUseNativeMenu(false)` build in obsidian-plugin-dev's debugging.md. A `contextmenu` reaching the document closes an
  open DOM menu, which is why `favoriteMenu.ts` stops a long-press's duplicate one.
- `obsidian eval` cannot reach the `obsidian` module (`require('obsidian')` throws; there is no global
  `getIcon`/`setIcon`). To verify a Lucide name, render `<Icon name=… />` in a live component and check
  `el.querySelector('svg')?.innerHTML` is non-empty; an overlay takes icon SVGs from rendered table headers, inlines
  them, or harvests them from a remount with the setting flipped in memory only (`useTypeIcons` for type icons: badge
  mode renders none).
- A synthetic event's options default to inert, so a check on its effect can pass without testing anything: a `KeyboardEvent` without `cancelable: true` always reads `defaultPrevented === false`. Dispatch keys as `new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true})` on `document.body`. For a multi-leaf check, save `app.workspace.getLayout()` first, open the extra leaves with `getLeaf('split', 'vertical')`, and restore with `changeLayout(saved)`. A leaf in a background tab measures 0 wide, and `focus()` on its inputs does nothing.
- View history: read `leaf.history.backHistory`/`forwardHistory` (each entry's `state.state` is a `NavRecord`) and
  `leaf.view.getState()`. Step with the header arrows (`leaf.containerEl` `.view-header-nav-buttons button`), a
  `keydown` `[`/`]` on `document.body` (focused Pokédex tab only), or, in emulated mobile,
  `app.mobileNavbar.backButtonEl`/`forwardButtonEl`.click(): a `document.querySelector('[aria-label="Navigate back"]')`
  finds the tab header's arrow first, and the bar's `.mobile-navbar-action-back` wrapper ignores a click. The bar's
  dimming is its buttons' `aria-disabled`.

## Fixtures

- Venusaur has both Mega (single "M" badge) and Gigantamax ("G"). Charizard's Mega splits into X/Y badges and is the
  `portraitScale` fixture: Mega X + shiny reads `scale(0.907)` on `.portrait-image` and `.portrait-preview` (shiny
  crops ~9% tighter).
- Gen 9 data is missing whole categories, so an empty Gen 9 read proves nothing: no held items (probed ids 1–200), no
  tutor moves (ids 1–160), no encounters (`encounterLocations.json` covers Gen 3–8, so every Capture cell is `-`). Set
  Active Gen in memory first: ≤ 7 for held items or tutors (Butterfree: Silver Powder; Infernape: 2 tutor moves), 3–8
  for Capture (Gen 4 Pikachu: "Wild, Trade"). Farfetch'd always holds an item (Stick, 5%).

## Proving and showing

- A "no visible change" refactor is proved by A/B against HEAD, not by eye: `git archive HEAD | tar -x -C <scratch>`,
  symlink `node_modules`, `bun run build`; copy each build into `pokedex-test-vault`, reload the window (`plugin:reload`
  keeps the old CSS), and compare. Data: a hash of
  `JSON.stringify((await plugin.repository.getTableRows({start:1,end:1025})).rows)` with each `spriteDataUri`
  replaced by `plugin.repository.imagePathOf(it)` (blob URLs differ per load; a warm cache keeps it offline).
  Layout: dump every element's rect relative to the screen at several leaf widths and diff the lists, skipping only
  the wrapper elements the change adds (#31: 4 species × 4 widths, 0 diffs).
  Run both builds in one window state: `dev:mobile` changes the leaf width and base font (16px emulated, 15px desktop), so an emulated baseline never matches a desktop run of the same build.
- A slowdown is located by timing one load at each layer and subtracting, in-app (`performance.now()` plus
  `PerformanceObserver({type:'longtask'})`, read once): the repository alone (a fresh
  `new plugin.repository.constructor(client, plugin.cache)`, the `src/data/CLAUDE.md` recipe), then through the UI by
  setting `plugin.repository` to it before the leaf swap (restore in a `finally`, swap again), then with one of its
  callbacks changed (rows held to the end, progress only). That split found the 24 s load was per-update rendering, not
  row count (1.7 s repository, 1.85 s rows handed over once). Each fresh repository leaves its sprite blob URLs live
  until a window reload. After the load, time each action (sort, clear search, favourites-only off) on all rows and on a
  subset (favourites-only) at `obsidian vault=pokedex-test-vault dev:cdp method=Emulation.setCPUThrottlingRate 'params={"rate":4}'`
  (a phone stand-in, not a measurement; set `rate` 1 after), and split each slow frame with
  `PerformanceObserver({type:'long-animation-frame'})` (`scripts[].duration` vs `styleAndLayoutStart`): that found
  ADR-0016's per-tile cost, half script, half style/layout. Let a reload's background sprite decode settle first
  (inferred: a run a minute after one doubled a sort's time).
- A speed-up credited to a mechanism is proved by observing the mechanism, not frame times: `content-visibility` on Card tiles "passed" a worst-frame A/B while `contentvisibilityautostatechange` showed 0 of 144 skips (ADR-0016). At 4× a sort or clear varies 2–3× between passes, so alternate builds (A B A B, three or more each), and remember `long-animation-frame` lists only frames of 50 ms or more: "script 0" means a short frame, so record the total too.
- Price a rendering choice before coding it by applying it to the DOM directly, with no Svelte: it is the lower bound of the Svelte version (ADR-0017's dot insert vs `visibility`; ADR-0016's un-hiding of filtered rows still took 1.1 s, which ruled that candidate out).
- A windowed list (the Card window) is proved by its invariants, not by eye: at many offsets, a tile still drawn after
  a scroll moved by exactly the scroll delta (no jump), and the list's total height stays constant over a full walk. A
  hit-test for empty viewport (`elementFromPoint`) lands in the grid's column and row gaps, so sample inside a column
  and count a point as empty only when no tile is within a gap of it.
- A cold measurement reloads the plugin (`disablePlugin`/`enablePlugin`) after emptying every Pokédex leaf: a leaf swap keeps module memos (`contentBounds`) and the repository's mem caches, and a leaf left open starts its own load, which warms them (and runs any cache self-heal) before the probe. Time what the user sees, a full first screen, not the last off-screen item: Card view's 7.3 s "all measured" was 0.4 s to a usable screen (ADR-0014).
- A Narrow pane is a leaf width, and both screens read the leaf: PokedexApp's ResizeObserver and the `pane` container
  (`styles.src.css`) that every Narrow pane query uses (`@container pane (width < 600px)`, pinned by
  `src/view/paneBreakpoint.test.ts`). So drive it by the leaf: `leaf.view.containerEl.style.width = '390px'` (clear it
  after) switches both screens, measured identical at 599/600 (#31). Inside the leaf, padding and the scrollbar gutter
  take ~71px on desktop (12px `.view-content` + 16px `.pokedex-view` a side + a 15px gutter; less where scrollbars
  overlay), so a 390px leaf leaves the detail screen 319px. Setting `.pokedex-view`'s width instead moves only the
  inner `detail` container (its one query is Base stats beside Abilities at 1100px) and never a `pane` query.
- Phone-width design needs no emulator: inject a throwaway overlay into the live `pokedex-view` leaf inside a
  fixed-width column (any width), take row
  order/filter/sort from the table DOM and raw records from `plugin.repository.pokemonMemCache` (by id, all 6 stats) /
  `speciesMemCache` (`capture_rate`), then remove it. To show motion, pause it at a set point with
  `animation-play-state: paused` plus a negative `animation-delay`, screenshot each frame (`dev:screenshot` takes
  seconds, too slow for a live animation), and combine frames with `ffmpeg` `hstack`/`vstack` (no PIL or `magick`
  here). Shots are in device pixels (2880 wide for a 1440 window), so `crop` a leaf at 2× its client rect. The user
  may click the live overlay between shots, so return its state from each eval and check it before trusting a frame.
