# ModSpark agent notes

This file is for coding agents (Codex, Claude) working on this repo. User-facing docs are in README.md and docs/CATALOG.md.

## What this is

ModSpark is a clean-room, MIT-licensed Windows manager for community game-trainer packages, built with Electron 33, React 18 and Vite 6. It contains no code or assets from WeMod. Don't add any, and don't base features on decompiled WeMod internals.

## Layout

- `electron/catalog.cjs`: all trust logic, as a plain Node module with no Electron imports so it can be tested. It covers Ed25519 catalog signatures, schema validation, streaming size- and SHA-256-checked downloads, staged installs, the re-check before launch, and prerequisite detection.
- `electron/main.cjs`: Steam and Epic library scan (it emits `steam:<appid>` and `epic:<AppName>` ids plus a `build`), IPC handlers, the updater, and native dialogs for anything that executes code.
- `electron/preload.cjs`: the only bridge to the renderer (`window.modSpark`). The renderer passes ids, never URLs or paths to execute.
- `src/main.jsx`: the whole UI.
- `scripts/catalog-tool.cjs`: maintainer CLI (keygen, hash, sign, verify).
- `electron-builder.config.cjs`: NSIS installer. An update feed is baked in only when `MODSPARK_UPDATE_URL` is set at build time.

## Commands

- `npm test`: node:test suite in `test/`. Keep it green, and add a test with every change to `catalog.cjs`.
- `npm run dev`: Vite plus Electron. In dev, `file://` catalogs are allowed.
- `npm run build`: renderer only.
- `npm run dist`: installer into `release/`.

## Rules that keep it safe

- Anything that runs code (prerequisite installers, package launch) goes through a native `dialog.showMessageBox` in the main process, never a renderer-only confirm.
- Never loosen https-only or contained paths in packaged builds. `allowFileUrls` exists for dev and tests only.
- Renderer and catalog input is untrusted. Validate it in `catalog.cjs`, not in the UI.

## Open items (need people or accounts, not code)

- A public catalog repository and its signing key.
- A release host for `MODSPARK_UPDATE_URL`.
- A code-signing certificate.

## History

- 2026-11-17: Codex scaffolded the app. Claude then added the signed catalog, verified installs, prerequisites, build compatibility, launch, the Settings tab and installer packaging, with 12 tests.
