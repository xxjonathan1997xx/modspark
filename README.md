# ModSpark

ModSpark is an open-source Windows desktop app concept for finding installed games and managing community-maintained trainer packages. It is not affiliated with WeMod and does not include WeMod code or trainer files.

## Current MVP

- Electron desktop shell with a hardened preload bridge.
- Scans Steam library folders and installed app manifests, plus Epic Games Launcher manifests on Windows.
- Simple searchable library and package detail view.
- MIT-licensed app with no ads or account requirement.
- Signed community catalogs: add a catalog URL plus the publisher's Ed25519 key, then browse, install, update and uninstall packages. Every file is size- and SHA-256-verified before it's installed. See [docs/CATALOG.md](docs/CATALOG.md).
- Shows each game's detected build and warns when a package wasn't tested with it.
- Launches installed packages after re-checking their files.
- Detects each package's prerequisites (such as the VC++ runtime) and can run a hash-verified installer after the user confirms.
- Automatic app update checks and background downloads when a generic release feed is configured with `MODSPARK_UPDATE_URL`.

No catalog ships with the app. Someone has to publish a signed catalog (see [docs/CATALOG.md](docs/CATALOG.md)) before users have packages to install. Updates require a publisher release feed; none is configured in this starter project. Windows releases also need publisher code signing before distribution. The UI reports the missing feed instead of pretending updates work.

## Run locally

```powershell
npm install
npm run dev
```

Run the catalog tests with `npm test`.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request or publishing a catalog.

## Build a Windows installer

```powershell
npm run dist      # local installer in release/, nothing is uploaded
```

**Releasing:** bump `version` in `package.json`, commit, then push a matching tag (`git tag v0.2.0; git push origin v0.2.0`). GitHub Actions builds the installer and publishes it as a GitHub Release. Installed copies of ModSpark see the new version on their next start and install it when the app closes. To use a different host instead, set `MODSPARK_UPDATE_URL` when building. Set `CSC_LINK` and `CSC_KEY_PASSWORD` to code-sign. Unsigned installers work, but SmartScreen will warn users.

## Roadmap

The app supports signed catalogs, verified installs, opt-in catalog sources, prerequisite detection and installers, game-build compatibility hints, package launch, and a Windows installer with auto-update from GitHub Releases, and CI. The community catalog still needs an owner:

1. Publish a first public catalog repository with contribution and review guidelines, plus its signing key.
2. Publish the repository and push a `v<version>` tag to create a GitHub release and its update feed.
3. Get a code-signing certificate.

## License

MIT. See [LICENSE](LICENSE).
