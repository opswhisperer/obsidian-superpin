# Submitting Super Pin to the community plugins directory

Checklist for the first submission. Later updates only need a new GitHub release.

New plugins are submitted through the community directory at https://community.obsidian.md, not by a pull request to `obsidianmd/obsidian-releases`. See https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin.

## Before submitting

- [ ] The repository is public on GitHub: `opswhisperer/obsidian-superpin`.
- [ ] `README.md`, `LICENSE` and `manifest.json` are at the repository root on the default branch. The directory reads `manifest.json` from the HEAD of the default branch.
- [ ] `manifest.json`: `id` is `super-pin` (unique, and doesn't contain "obsidian"), `version` matches the release tag, and `minAppVersion` and `description` are correct.
- [ ] `npm run build` and `npm run lint` pass with no warnings.
- [ ] The plugin has been tested in a clean vault (see the manual checks in the README / plan).
- [ ] The plugin follows the [developer policies](https://docs.obsidian.md/Developer+policies).

## Release 0.1.0

```sh
git tag 0.1.0
git push origin 0.1.0
```

The release workflow creates the GitHub release with `main.js`, `manifest.json` and `styles.css` attached as binary assets. Check that the release exists and isn't a draft. The tag must use the `x.y.z` format.

## Submit in the directory

1. Sign in at https://community.obsidian.md with your Obsidian account.
2. Link your GitHub account to your profile so the directory can verify you own the repository.
3. Choose **Add your plugin** and select `opswhisperer/obsidian-superpin`. Follow the "Set up and claim" guide linked from there.

## After submitting

- The directory validates the manifest and the release. Fix anything it reports by publishing a new release.
- A member of the Obsidian team reviews the code. Expect questions about the method patches; the "How it works" section of the README is written to answer them.
- Once approved, the plugin appears under Settings → Community plugins → Browse.
- Announce it in the [forum showcase](https://forum.obsidian.md/c/share-showcase/9) and the Discord `#updates` channel.
