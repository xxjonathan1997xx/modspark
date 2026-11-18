# ModSpark

ModSpark is a free, open-source Windows app that finds your installed games and installs community-maintained trainer packages from signed catalogs. It has no ads, no account and no telemetry. It isn't affiliated with WeMod and contains no WeMod code or trainer files.

## Download

Get the latest installer from [GitHub Releases](https://github.com/xxjonathan1997xx/modspark/releases/latest) (`ModSpark-Setup-<version>.exe`). Installed copies update themselves from there.

Installers are currently **unsigned**, so Windows SmartScreen may warn you before the first run. See [Code signing policy](#code-signing-policy).

## What it does

- **Library:** scans Steam and Epic installs and shows each game's build number. Steam cover art is optional and off by default.
- **Signed catalogs:** add a catalog URL plus the publisher's Ed25519 key. ModSpark refuses any catalog whose signature doesn't match. New users can add the official catalog in one click.
- **Verified installs:** every file is size- and SHA-256-checked, staged, and kept inside ModSpark's own folder before it's installed.
- **Requirements:** detects runtimes a package needs. An installer runs only after you confirm and its hash checks out.
- **Compatibility:** warns, without blocking, when a package wasn't tested on your game build.
- **Launch:** re-checks a package's files before starting it, behind a confirmation dialog.
- **Uninstall:** remove packages from the Downloads tab, or the app itself from Windows Settings → Apps.

Details of the catalog format are in [docs/CATALOG.md](docs/CATALOG.md).

## Official catalog

The official catalog is [modspark-catalog](https://github.com/xxjonathan1997xx/modspark-catalog). Use **Add the official catalog** in the app, or add it by hand:

- **URL:** `https://raw.githubusercontent.com/xxjonathan1997xx/modspark-catalog/main/catalog.json`
- **Key:** `MCowBQYDK2VwAyEAZgCVC7ij799AAgYeXIxI5nXWKa8XzlczeaaizWgsd3o=`

It starts empty, and packages arrive through reviewed pull requests. Only single-player tools are accepted. Other catalogs can be added the same way.

## Code signing policy

ModSpark intends to sign its Windows releases with free code signing provided by SignPath.io, certificate by SignPath Foundation. **The application is pending**, so current releases are unsigned. This section will be updated when signing is in place.

- **Committers and reviewers:** [xxjonathan1997xx](https://github.com/xxjonathan1997xx). Every outside pull request is reviewed before merging.
- **Approvers:** [xxjonathan1997xx](https://github.com/xxjonathan1997xx). Every release is approved by hand before it's signed.
- **Builds:** release binaries are built only by GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) from a tagged commit in this repository.
- **Privacy:** this program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. See [PRIVACY.md](PRIVACY.md).

## Privacy

ModSpark doesn't collect personal data. It only contacts the catalogs and downloads you choose, GitHub Releases for updates, and, if you turn on cover art, Steam's image server. The full list is in [PRIVACY.md](PRIVACY.md).

## Develop

```powershell
npm install
npm run dev       # Vite + Electron
npm test          # node:test suite
npm run dist      # local installer in release/, nothing is uploaded
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Coding agents should read [AGENTS.md](AGENTS.md).

**Releasing:** bump `version` in `package.json`, commit, then push a matching tag (`git tag v0.2.0` and `git push origin v0.2.0`). GitHub Actions builds the installer and publishes it as a GitHub Release. To use a different update host, set `MODSPARK_UPDATE_URL` when building.

## Roadmap

- Code signing through SignPath Foundation.
- The first reviewed packages in the official catalog.

## License

MIT. See [LICENSE](LICENSE).
