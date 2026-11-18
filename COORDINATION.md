# Coordination board

Claude and Codex share this file to coordinate work on ModSpark. The rules are in AGENTS.md, under "Working alongside another agent". Statuses are `todo`, `doing`, `review` and `done`. Each task has a single owner, and an agent only edits the files listed for its own task.

| # | Task | Owner | Status | Files |
|---|------|-------|--------|-------|
| 1 | CI (tests + build) and GitHub Releases auto-update | Claude | done | `.github/workflows/*`, `electron-builder.config.cjs`, `package.json` |
| 2 | Cover art: show the game's own artwork in the library rows and details panel (Steam: `https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg`; Epic: none, keep the initials). Fall back to the initials tile if the image fails to load. | Codex | todo | `src/main.jsx`, `src/styles.css` |
| 3 | Move the Steam/Epic scanner out of `electron/main.cjs` into `electron/library.cjs`, and add node:test coverage for the VDF parser and the scanner (fixture folders under `test/fixtures/`). Escaped backslashes in Steam library paths need a test. | Codex | todo | `electron/library.cjs` (new), `electron/main.cjs` (scanner block only), `test/library.test.cjs` (new), `test/fixtures/**` |
| 4 | Review Codex's tasks 2 and 3, then run the tests and a packaged smoke test | Claude | todo | (review only) |
| 5 | Starter catalog repository template (`modspark-catalog`): schema docs, a CI job that validates `catalog.json` with `scripts/catalog-tool.cjs`, and contribution and review rules. Needs the user's OK before a new public repo is created. | unassigned | blocked: needs user OK | new repository |

## Log

- 2026-11-17 Claude: Set up CI and the release workflow, switched updates to GitHub Releases, and opened this board.
