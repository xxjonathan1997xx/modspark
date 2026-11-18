# Privacy policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

ModSpark has no account, no ads, no analytics and no telemetry. It doesn't collect, store or send personal data.

## Network requests ModSpark makes

ModSpark only contacts these systems, and only for the reasons listed:

| When | Where | What is sent |
|---|---|---|
| You add or refresh a catalog | The catalog URL you entered, and its `.sig` file | A normal HTTPS request for those files |
| You install a package or a requirement | The download URLs listed in a catalog you added | A normal HTTPS request for those files |
| The app starts (installed builds only) | GitHub Releases for `xxjonathan1997xx/modspark` | A request for `latest.yml` to check for updates, and the installer download if there's a newer version |
| Only if you turn on **Show game cover art** in Settings (off by default) | Steam's image server, `cdn.cloudflare.steamstatic.com` | The Steam app IDs of the games in your library, as image requests |

Each of these servers receives the usual information that comes with any web request, such as your IP address. Their own privacy policies apply: [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement), [Valve/Steam](https://store.steampowered.com/privacy_agreement/), and whoever hosts a catalog or package you choose to add.

## Data kept on your PC

- Your list of added catalogs: `%APPDATA%\ModSpark\catalog-sources.json`
- Installed packages and their install records: `%APPDATA%\ModSpark\packages\`
- UI preferences, such as the cover-art setting, in the app's local storage

Uninstalling ModSpark from Windows Settings removes the app. Delete `%APPDATA%\ModSpark` too if you want to remove your catalogs and installed packages.

## Library scan

ModSpark reads Steam's and Epic's local manifest files to list your installed games. That information stays on your PC.

## Contact

Questions or concerns: open an issue at https://github.com/xxjonathan1997xx/modspark/issues.
