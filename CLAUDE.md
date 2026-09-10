# obsidian-pokedex

House conventions for Obsidian plugin repos live in the `obsidian-plugin-dev` skill —
bun, script contract, all Svelte 5 rune and scoping gotchas, `obsidian eval` mechanics,
CSS specificity and containing-block traps, live-verification workflow. Repo-specific
facts are below; deeper domain rules live in `src/data/CLAUDE.md` (fetch/cache/normalize),
`src/view/CLAUDE.md` (UI/table/live-verify), and `docs/multi-gen-expansion-plan.md` (adding
a generation).

Deploys to the vault folder `pokedex` (intentionally ≠ manifest id `obsidian-pokedex`), and
to `test-vault/`.

Inline comments here are unusually thorough and load-bearing. Most "shallow module" or
"duplicate logic" findings from automated architecture review turn out to be deliberate,
already-documented separations once the comments are read (6 of 8 candidates misdiagnosed
in one round, 3 of 5 in another). Reread the full file and check for an existing ADR in
`docs/adr/` before writing a candidate into a report — not only before implementing one.

## Repo-specific toolchain

`bun run check` (typecheck + lint:ratchet + test) is the gate. `.github/workflows/ci.yml`
runs it plus `build` and `verify:release` on every push and PR, and `release.yml` reruns
them before publishing — a tag can be pushed from a commit CI never saw. Nothing below is a
"remember to" any more; it explains why the gate is shaped the way it is.

- `bun run build` transpiles with esbuild and never typechecks, so a green build proves
  nothing about types (verified: a deliberate type error builds clean). It is still a
  required step — esbuild-svelte is the only thing that catches a Svelte compile error, and
  `svelte-check` is not a dependency here.
- `tsconfig.json` targets ES2020, so `Array.prototype.at()` (ES2022) fails typecheck with a
  misleading "change your target library?" error. Use `arr[arr.length - 1]`; do not bump
  the target (Obsidian runtime compat risk).
- `eslint-comments/no-restricted-disable` blocks disabling **any** rule via inline comment.
  There is no comment escape hatch — fix the underlying issue or leave the warning. This
  also rules out `expect.any(...)` in vitest (typed as `any`, trips
  `no-unsafe-assignment`): assert `Object.keys(...)` plus `typeof x` separately instead.
  (Stays prose — the rule is already enforced; what a reader needs here is the workaround.)
- Every obsidianmd rule this repo trips is warn-severity, so `bun run lint` exits 0 however
  many it reports. `bun run lint:ratchet` is the part that can fail: it pins the warning
  count to a baseline in **both** directions, so paying warnings down without lowering
  `BASELINE` in `scripts/lint-ratchet.mjs` fails too, and the number never drifts into a
  ceiling nobody re-checks. Obsidian runtime/UI rules are scoped away from `*.test.ts` in
  `eslint.config.mjs` rather than absorbed into that count.
- `manifest.json` and `versions.json` are checked against each other (and against the tag,
  in `release.yml`) by `bun run verify:release`. Obsidian's catalog reads `versions.json` to
  decide which app versions may install a release, and no build step looks at it. The tag
  itself must be the bare version string (`0.1.1`), not `v`-prefixed — `verify-release.mjs`
  string-matches it exactly against `manifest.json`'s version, and nothing catches a wrong
  format until after that tag is already pushed.

`temp/` is gitignored and already used for scratch output — prefer it over the OS tmp dir.
