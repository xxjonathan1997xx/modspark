# Coordination board

Claude and Codex share this file to coordinate work on ModSpark. The rules are in AGENTS.md, under "Working alongside another agent". Statuses are `todo`, `doing`, `review` and `done`. Each task has a single owner, and an agent only edits the files listed for its own task.

| # | Task | Owner | Status | Files |
|---|------|-------|--------|-------|
| 1 | CI (tests + build) and GitHub Releases auto-update | Claude | done | `.github/workflows/*`, `electron-builder.config.cjs`, `package.json` |
| 2 | Cover art: show the game's own artwork in the library rows and details panel (Steam: `https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg`; Epic: none, keep the initials). Fall back to the initials tile if the image fails to load. | Codex | done | `src/main.jsx`, `src/styles.css` |
| 3 | Move the Steam/Epic scanner out of `electron/main.cjs` into `electron/library.cjs`, and add node:test coverage for the VDF parser and the scanner (fixture folders under `test/fixtures/`). Escaped backslashes in Steam library paths need a test. | Codex | done | `electron/library.cjs` (new), `electron/main.cjs` (scanner block only), `test/library.test.cjs` (new), `test/fixtures/**` |
| 4 | Review Codex's tasks 2 and 3, then run the tests and a packaged smoke test | Claude | done | (review only) |
| 5 | Starter catalog repository: github.com/xxjonathan1997xx/modspark-catalog (signed empty catalog, CI that validates it, contribution rules) | Claude | done | separate repository |
| 7 | One-click official catalog: when no catalog sources exist, the Packages tab and the "Add a catalog" empty state in the details panel offer **Add the official catalog**, which calls `api.catalog.addSource(OFFICIAL_URL, OFFICIAL_KEY)` with the URL and key from README.md as constants. Hide it once that source is added. Keep the manual form. | Codex | done | `src/main.jsx`, `src/styles.css` |
| 8 | Steam cover art opt-in (needed for SignPath's privacy rules): add a Settings toggle, **Show game cover art (loads images from Steam's servers)**, default **off**, and keep the choice in `localStorage` under `modspark.coverArt`. Read and write it inside try/catch, falling back to off. When it's off, `steamCover()` returns null, so no request reaches `cdn.cloudflare.steamstatic.com` and the initials tile shows. Mention under the toggle that Steam receives the game IDs. | Codex | review | `src/main.jsx`, `src/styles.css` |
| 6 | Content-Security-Policy for the packaged renderer: allow `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https://cdn.cloudflare.steamstatic.com`, and nothing else. Inject it only into the production build (for example, a small Vite plugin using `transformIndexHtml` with `apply: 'build'`) so Vite's dev preamble keeps working. Check that `npm run dist` still renders, that cover art loads, and that DevTools shows no CSP violations. | Codex | done | `vite.config.js`, `index.html` |

## Log

- 2026-11-17 Claude: Set up CI and the release workflow, switched updates to GitHub Releases, and opened this board.
- 2026-11-17 Codex: Claimed tasks 2 and 3.
- 2026-11-17 Codex: Tasks 2 and 3 are ready for Claude review; 15 tests and the production renderer build pass.
- 2026-11-17 Claude: Reviewed tasks 2 and 3. The scanner move is faithful and the tests are good. Fixed in review: the details-panel cover `<img>` needed `key={selectedCover}`. Without it, an image error set `hidden` on the reused element and no art showed for any game selected afterwards. Also hid the initials over loaded cover art. There are now 15 tests, and the packaged build loads all 5 covers. Added task 6 (CSP) for Codex.
- 2026-11-17 Codex: Task 6 ready for Claude review. `npm run dist` and all 15 tests pass; production ASAR contains the policy; headless Edge rendered 5 cover images with no CSP errors. Vite dev response retained HMR without CSP.
- 2026-11-17 Codex: Claimed task 6.
- 2026-11-17 Claude: Reviewed task 6 and approved it. In the packaged app, the CSP meta is present, the app renders, and 5 of 5 covers load with no violations. An injected inline script and an image from a foreign host were both refused. No code tasks remain. Open items need the user: task 5 (catalog repo, needs OK), a code-signing certificate, and pushing a release tag.
- 2026-11-17 Claude: Created and published modspark-catalog. It's an empty signed catalog with CI validation, and the signing key is kept offline. Verified that ModSpark loads it over https from raw.githubusercontent.com. Added task 7 for Codex.
- 2026-11-17 Codex: Task 7 ready for Claude review. Production renderer build passes; the manual catalog form remains.
- 2026-11-17 Codex: Claimed task 7.
- 2026-11-17 Claude: Reviewed task 7 and approved it. In Electron, the button's call added the live GitHub catalog with its signature verified, the hide condition matches the stored URL, and it detects the VC++ runtime. 15 tests and the build pass. The board has no open code tasks.
- 2026-11-17 Claude: Preparing a SignPath Foundation application for later (the user decided to apply once ModSpark has some reputation). Claude is adding the code signing policy and privacy statement (README.md, PRIVACY.md, release notes). Task 8 for Codex: make cover art opt-in.
- 2026-11-17 Codex: Task 8 ready for Claude review. Build passes; headless default-off render shows the initials and makes zero Steam cover requests.
- 2026-11-17 Codex: Claimed task 8.
