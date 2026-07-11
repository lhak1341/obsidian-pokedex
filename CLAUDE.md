# Gotchas

- Live-verify via obsidian-cli against vault "lhakZettel" (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/lhakZettel`); deployed plugin folder there is named `pokedex` (intentionally ≠ manifest id `obsidian-pokedex`).
- Svelte5 `css:"injected"` leaves stale `<style id="svelte-HASH">` tags in `document.head` across plugin disable/enable within one Obsidian session — CSS edits won't show until you remove them manually or fully restart Obsidian.
- Svelte5 scopes descendant/element selectors (e.g. `section h3`) via zero-specificity `:where()`, which can lose to Obsidian's theme CSS — target elements with a direct class instead.
- Code shared between Obsidian runtime and vitest can't use `window.setTimeout` (no `window` in vitest) or disable `obsidianmd/prefer-window-timers` (blocked by eslint-comments/no-restricted-disable) — use `typeof window !== "undefined" ? window : globalThis` instead.
