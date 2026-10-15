# Submitting Super Pin to the community plugins directory

Checklist for the first submission. Later updates only need a new GitHub release.

## Before submitting

- [ ] The repository is public on GitHub: `opswhisperer/obsidian-superpin`.
- [ ] `README.md`, `LICENSE` and `manifest.json` are at the repository root on the default branch.
- [ ] `manifest.json`: `id` is `super-pin`, `version` matches the release tag, and `minAppVersion` and `description` are correct.
- [ ] `npm run build` and `npm run lint` pass with no warnings.
- [ ] The plugin has been tested in a clean vault (see the manual checks in the README / plan).

## Release 0.1.0

```sh
git tag 0.1.0
git push origin 0.1.0
```

The release workflow creates the GitHub release with `main.js`, `manifest.json` and `styles.css` attached. Check that the release exists and isn't a draft.

## Open the pull request

1. Fork https://github.com/obsidianmd/obsidian-releases.
2. Add this entry to the **end** of `community-plugins.json`:

   ```json
   {
   	"id": "super-pin",
   	"name": "Super Pin",
   	"author": "Rob Bell",
   	"description": "Keep chosen notes pinned as tabs in the right sidebar so they are never replaced, with optional enforced reading view.",
   	"repo": "opswhisperer/obsidian-superpin"
   }
   ```

   The `description` must match `manifest.json`.
3. Open a pull request titled `Add plugin: Super Pin` and fill in every checklist item in the template.

## After submitting

- An automated bot validates the entry and the release. Fix anything it reports by publishing a new release, then reply on the PR.
- A member of the Obsidian team reviews the code. Expect questions about the method patches; the "How it works" section of the README is written to answer them.
- Once merged, the plugin appears under Settings → Community plugins → Browse.
