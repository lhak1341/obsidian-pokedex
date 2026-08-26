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

- `tsconfig.json` targets ES2020, so `Array.prototype.at()` (ES2022) fails typecheck with a
  misleading "change your target library?" error. Use `arr[arr.length - 1]`; do not bump
  the target (Obsidian runtime compat risk).
- `eslint-comments/no-restricted-disable` blocks disabling **any** rule via inline comment.
  There is no comment escape hatch — fix the underlying issue or leave the warning. This
  also rules out `expect.any(...)` in vitest (typed as `any`, trips
  `no-unsafe-assignment`): assert `Object.keys(...)` plus `typeof x` separately instead.
- `bun run lint` fails repo-wide on a pre-existing ESLint config error (type-info parsing
  on `vitest.config.ts`), confirmed via `git stash` to predate current work. Not your
  regression.
- `svelte-check` crashes with a TypeScript internal error here. The esbuild-svelte step in
  `bun run build` is the real Svelte-compile-error catcher.

`temp/` is gitignored and already used for scratch output — prefer it over the OS tmp dir.
