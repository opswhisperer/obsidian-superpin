# Agent notes

Obsidian community plugin "Super Pin" (`super-pin`). TypeScript, bundled with esbuild into `main.js`.

- Source lives in `src/`:
  - `main.ts`: plugin entry, commands, events
  - `pinManager.ts`: pin registry, leaf lifecycle, enforcement, safety net
  - `guard.ts`: monkey-around patches
  - `menus.ts`: file and tab menus
  - `settings.ts`: declarative settings (Obsidian 1.13+)
- Run `npm run build` and `npm run lint` before committing. Lint uses `eslint-plugin-obsidianmd` and must pass cleanly.
- Follow the Obsidian plugin guidelines:
  - use `this.app`; register everything for cleanup
  - don't detach leaves in `onunload`; no default hotkeys
  - sentence-case UI text; no `innerHTML`
- Every patch in `guard.ts` must only change behaviour for leaves `PinManager` guards, and must be registered with `plugin.register(...)` so it's removed on unload.
- Internal (non-public) Obsidian fields used: `WorkspaceLeaf.id`, `WorkspaceLeaf.tabHeaderEl` and `WorkspaceParent.children`. Keep these accesses null-safe.
