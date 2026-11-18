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

## Build a Windows installer

```powershell
$env:MODSPARK_UPDATE_URL = "https://your-host/modspark/"   # optional: enables auto-update
npm run dist
```

The output goes to `release/`. To ship a version, bump `version` in `package.json`, then run `npm run dist`. Upload `ModSpark Setup <version>.exe`, its `.blockmap`, and `latest.yml` to the update URL. Installed copies pick up the new version on their next start. Set `CSC_LINK` and `CSC_KEY_PASSWORD` to code-sign. Unsigned installers work, but SmartScreen will warn users.

The library uses sample rows in browser preview mode. In the Electron app, **Scan for games** reads Steam's `libraryfolders.vdf` and `appmanifest_*.acf` files and Epic's `.item` manifests from standard Windows locations.

## Roadmap

Done: signed catalog format, verified installs, opt-in catalog sources, prerequisite detection and installers, game-build compatibility hints, launching packages, a Windows installer with an auto-update feed.

Still to do. These steps need people or accounts, not code:

1. Publish a first public catalog repository with contribution and review guidelines, plus its signing key.
2. Pick a release host (GitHub Releases or any static host) and set `MODSPARK_UPDATE_URL`.
3. Get a code-signing certificate.

## License

MIT. See [LICENSE](LICENSE).
