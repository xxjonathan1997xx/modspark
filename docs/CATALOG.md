# ModSpark community catalogs

A catalog is a JSON file published together with a detached Ed25519 signature (`catalog.json.sig`). Users add a catalog in **Packages → Add catalog** with its URL and the publisher's public key. ModSpark loads a catalog only if its signature matches that key and it passes validation. Packages are installed only from catalogs that have been loaded this way.

## Trust model

- **Signed index.** The catalog bytes are signed, so a mirror or CDN cannot change URLs, hashes or file lists without the signature failing.
- **Pinned files.** Every file has a declared `size` and `sha256`. Downloads are streamed, capped at the declared size, and hashed. Any mismatch aborts the install and deletes the partial files.
- **Contained paths.** File paths are relative, forward-slash only, with no `..`, drive letters, Windows reserved names or trailing dots/spaces. Files are written to a staging folder under `%APPDATA%\modspark\packages` and moved into place only after every file verifies.
- **https only.** The packaged app rejects `file://` and `http://` URLs, including any redirect to http.
- **No execution on install.** Installing a package only places files. Prerequisite installers run only after the user confirms a native dialog that shows the host and hash.
- **Re-checked before launch.** **Launch** re-hashes every installed file against the install record and refuses if anything changed, then asks for confirmation before starting the declared `.exe`.

The signature proves who published the catalog. It does not prove the publisher is trustworthy. Users should only add catalogs from maintainers they trust.

## Format (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "name": "Example community catalog",
  "prerequisites": [
    {
      "id": "vcredist-x64",
      "name": "Visual C++ 2015-2022 Redistributable (x64)",
      "detect": { "anyFile": ["%SystemRoot%\\System32\\vcruntime140.dll"] },
      "installer": {
        "url": "https://example.org/vc_redist.x64.exe",
        "sha256": "<64 lowercase hex>",
        "size": 25000000,
        "args": ["/install", "/quiet", "/norestart"]
      }
    }
  ],
  "packages": [
    {
      "id": "cyberpunk-tools",
      "name": "Cyberpunk 2077 tools",
      "version": "1.0.0",
      "author": "someone",
      "license": "MIT",
      "homepage": "https://example.org/cyberpunk-tools",
      "games": ["steam:1091500", "epic:Ginger"],
      "gameVersions": ["2.21"],
      "gameBuilds": ["19876543"],
      "launch": { "path": "bin/tool.exe", "args": [] },
      "requires": ["vcredist-x64"],
      "files": [
        { "path": "bin/tool.exe", "url": "https://example.org/tool.exe", "sha256": "<64 lowercase hex>", "size": 123456 }
      ]
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `id` | `a-z0-9._-`, starting with a letter or digit, at most 64 characters, unique within the catalog |
| `version` | `0-9A-Za-z.+-`, at most 32 characters |
| `games` | `steam:<appid>`, `epic:<AppName>` or `gog:<gameID>`, matching what ModSpark's library scan reports |
| `requires` | ids of entries in `prerequisites` |
| `gameVersions` | optional, human-readable versions shown to the user |
| `gameBuilds` | optional. These are exact Steam `buildid` or Epic `AppVersionString` values. ModSpark compares them with the installed game and warns, without blocking, when they don't match. |
| `launch` | optional. `path` must be one of the package's `.exe` files. Without it, the user gets **Open** instead of **Launch**. |
| `prerequisites[].detect.anyFile` | absolute paths, where `%VAR%` expands from the environment. The requirement counts as met if any of the files exists. |
| `prerequisites[].installer` | optional. Without it, the UI tells the user to install the requirement manually. |

## Publishing

```bash
node scripts/catalog-tool.cjs keygen ./keys          # once; keep keys/catalog-key.pem secret
node scripts/catalog-tool.cjs hash ./dist/tool.exe   # sha256 + size for a files entry
node scripts/catalog-tool.cjs sign catalog.json keys/catalog-key.pem
node scripts/catalog-tool.cjs verify catalog.json keys/catalog-key.pub
```

Upload `catalog.json` and `catalog.json.sig` byte for byte, because reformatting the JSON invalidates the signature. Share the base64 public key from `catalog-key.pub` with users.

For local testing, pass `--allow-file-urls` to `sign` and `verify`. The development build (`npm run dev`) also accepts `file://` catalogs.

## Not yet covered

- Attaching to or injecting into a running game. ModSpark only starts the package's own `.exe`, and attaching is left to that tool.
- Key rotation and revocation. To rotate, remove the catalog and add it back with the new key.
