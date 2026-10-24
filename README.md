# Super Pin

Keep chosen notes pinned as tabs in the right sidebar. They are never replaced, and you can optionally force them to stay in reading view.

## Why

Obsidian lets you pin a note in the sidebar, but it doesn't stay put. If you click a link inside it, open something from the quick switcher, or use a plugin while that tab is focused, Obsidian often reuses the sidebar tab or opens a new tab inside the sidebar. Eventually your reference note is gone.

Super Pin guards the tabs you choose:

- **Opens go to the main area.** Links, the quick switcher, the file explorer, backlinks, graph clicks and "open in new tab" all open in the main editor area when a pinned tab is focused. The pinned tab keeps its note.
- **Links inside the note still work.** Heading and block links to the pinned note itself scroll within the pinned tab.
- **Several pins at once.** Each pinned note gets its own tab in the right sidebar.
- **Reading view (optional).** Pinned notes snap back to reading view. You can turn this off globally or per note.
- **Survives restarts and renames.** Pins are reattached to their tabs on startup, follow renamed files and are removed when the file is deleted.

Super Pin is different from plugins like Pinned Files, which keep a *list of links* in a sidebar panel. Super Pin keeps the *note itself* open and readable in the sidebar.

## Usage

Pin a note in any of these ways:

- Command palette: **Super Pin: Pin current note to right sidebar**
- Command palette: **Super Pin: Pick a note to pin**
- Right-click a file in the file explorer, or a tab header: **Pin to right sidebar**
- Settings → Super Pin → **+** (Add note)

To unpin, use **Super Pin: Unpin current note**, **Remove pin from right sidebar** in the file menu, or delete the pin in settings. By default, closing a pinned tab also removes the pin.

### Commands

| Command | Description |
| --- | --- |
| Pin current note to right sidebar | Pins the active note. |
| Unpin current note | Removes the pin and closes its tab. |
| Toggle reading view enforcement for current pin | Overrides the global reading view setting for this pin. |
| Pick a note to pin | Fuzzy search for a note to pin. |
| Restore all pins | Reopens any pinned notes whose tabs are missing. |

No hotkeys are set by default. Assign your own under Settings → Hotkeys.

### Settings

- **Enforce reading view by default**: on by default. Each pin can override it with *default*, *always* or *off*.
- **Closing a tab removes the pin**: on by default. When off, closing a pinned tab reopens it.
- **Restore pins on startup**: on by default.

## How it works

The native pin flag alone isn't enough, because several of Obsidian's code paths ignore it. Super Pin wraps these methods using [monkey-around](https://github.com/pjeby/monkey-around):

- `Workspace.getLeaf`: when a Super Pin tab is focused, the main area is made active first, so new and reused tabs land there.
- `Workspace.openLinkText`: links that point at the pinned note itself are opened inside the pinned tab, for heading and block navigation.
- `WorkspaceLeaf.openFile` / `WorkspaceLeaf.setViewState`: anything that tries to put a different file or view into a pinned tab is redirected to the main area.
- `MarkdownView.setState`: keeps enforced pins in reading view.

A `layout-change` safety net also re-pins and restores any pinned tab that changed anyway.

All wrappers only act on tabs Super Pin manages. They are removed when the plugin is disabled, and your tabs are left where they are.

## Installation

### From the community plugins browser

Once the plugin is listed: Settings → Community plugins → Browse → search for "Super Pin", or [open Super Pin in Obsidian](https://obsidian.md/plugins?id=super-pin).

### Manually

Copy `main.js`, `manifest.json` and `styles.css` from the latest release into `<vault>/.obsidian/plugins/super-pin/`, then enable Super Pin under Settings → Community plugins.

## Development

```sh
npm install
npm run dev     # watch build
npm run build   # type check and production build
npm run lint    # eslint with eslint-plugin-obsidianmd
```

For live testing, symlink this folder into a test vault at `.obsidian/plugins/super-pin`.

### Releasing

1. Update `minAppVersion` in `manifest.json` if needed.
2. Run `npm version patch` (or `minor` / `major`). This bumps `manifest.json`, `package.json` and `versions.json`.
3. `git push --follow-tags`. The release workflow builds the plugin and attaches `main.js`, `manifest.json` and `styles.css` to a GitHub release named after the tag.

Release tags have no `v` prefix.

## License

[MIT](LICENSE)
