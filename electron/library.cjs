const fs = require('node:fs/promises')
const path = require('node:path')

function parseVdf(text) {
  const tokens = [...text.matchAll(/"((?:\\.|[^"\\])*)"|\{|\}/g)].map(m => m[1] ?? m[0])
  const parse = (from) => {
    const result = {}
    let i = from
    while (i < tokens.length && tokens[i] !== '}') {
      const key = tokens[i++]
      if (tokens[i] === '{') {
        const nested = parse(i + 1)
        result[key] = nested.value
        i = nested.next
      } else {
        result[key] = tokens[i++] ?? ''
      }
    }
    return { value: result, next: i + 1 }
  }
  return parse(0).value
}

async function readLibraries(steamRoot) {
  const file = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf')
  try {
    const vdf = parseVdf(await fs.readFile(file, 'utf8'))
    return Object.values(vdf.libraryfolders ?? {})
      .map(entry => typeof entry === 'string' ? entry : entry.path)
      .filter(Boolean)
      .map(library => library.replace(/\\\\/g, '\\'))
  } catch {
    return [steamRoot]
  }
}

async function scanInstalledGames({ platform = process.platform, env = process.env, steamRoots, epicManifestDir } = {}) {
  if (platform !== 'win32') return []
  const roots = steamRoots ?? [
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(env.LOCALAPPDATA || '', 'Programs', 'Steam'),
  ]
  const found = new Map()
  for (const root of roots) {
    try {
      await fs.access(path.join(root, 'steamapps'))
      for (const library of await readLibraries(root)) {
        const apps = path.join(library, 'steamapps')
        for (const entry of await fs.readdir(apps, { withFileTypes: true })) {
          const match = entry.name.match(/^appmanifest_(\d+)\.acf$/i)
          if (!match) continue
          try {
            const manifest = parseVdf(await fs.readFile(path.join(apps, entry.name), 'utf8')).AppState
            const installPath = path.join(apps, 'common', manifest.installdir || '')
            found.set(match[1], {
              id: `steam:${match[1]}`, title: manifest.name || `Steam game ${match[1]}`,
              source: 'Steam', installPath, build: manifest.buildid ? String(manifest.buildid) : undefined,
              installed: await fs.stat(installPath).then(s => s.isDirectory()).catch(() => false),
            })
          } catch {}
        }
      }
    } catch {}
  }
  const epicManifests = epicManifestDir ?? path.join(env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  try {
    for (const entry of await fs.readdir(epicManifests, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.item')) continue
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(epicManifests, entry.name), 'utf8'))
        const installPath = manifest.InstallLocation
        if (!installPath) continue
        const installed = await fs.stat(installPath).then(s => s.isDirectory()).catch(() => false)
        if (!installed) continue
        const id = `epic:${manifest.AppName || entry.name}`
        found.set(id, { id, title: manifest.DisplayName || manifest.AppName || 'Epic game', source: 'Epic Games', installPath, installed, build: manifest.AppVersionString || undefined })
      } catch {}
    }
  } catch {}
  return [...found.values()].filter(game => game.installed).sort((a, b) => a.title.localeCompare(b.title))
}

module.exports = { parseVdf, scanInstalledGames }
