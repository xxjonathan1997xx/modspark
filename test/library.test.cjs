const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { parseVdf, scanInstalledGames } = require('../electron/library.cjs')

const fixtures = path.join(__dirname, 'fixtures')

test('parseVdf keeps nested library entries and escaped Windows paths', async () => {
  const file = path.join(fixtures, 'steam', 'steamapps', 'libraryfolders.vdf')
  const vdf = parseVdf(await fs.readFile(file, 'utf8'))
  const escaped = vdf.libraryfolders['1'].path

  const slash = String.fromCharCode(92)
  assert.equal(escaped, `C:${slash.repeat(2)}Steam Library`)
})

test('scanInstalledGames detects installed Steam and Epic games from fixture manifests', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'modspark-library-'))
  try {
    const steamRoot = path.join(temp, 'Steam')
    const steamApps = path.join(steamRoot, 'steamapps')
    const steamGame = path.join(steamApps, 'common', 'Counter-Strike Global Offensive')
    await fs.mkdir(steamGame, { recursive: true })
    const fixtureSteam = path.join(fixtures, 'steam', 'steamapps')
    const libraryFolders = (await fs.readFile(path.join(fixtureSteam, 'libraryfolders.vdf'), 'utf8'))
      .replace('__STEAM_ROOT__', steamRoot.replace(/\\/g, '\\\\'))
    await fs.writeFile(path.join(steamApps, 'libraryfolders.vdf'), libraryFolders)
    await fs.copyFile(path.join(fixtureSteam, 'appmanifest_730.acf'), path.join(steamApps, 'appmanifest_730.acf'))

    const epicManifestDir = path.join(temp, 'epic-manifests')
    const epicGame = path.join(temp, 'Epic Game')
    await fs.mkdir(epicManifestDir)
    await fs.mkdir(epicGame)
    const epic = JSON.parse(await fs.readFile(path.join(fixtures, 'epic', 'sample.item'), 'utf8'))
    epic.InstallLocation = epicGame
    await fs.writeFile(path.join(epicManifestDir, 'sample.item'), JSON.stringify(epic))

    const games = await scanInstalledGames({ platform: 'win32', steamRoots: [steamRoot], epicManifestDir })
    const steam = games.find(game => game.id === 'steam:730')
    const epicGameRecord = games.find(game => game.id === 'epic:ExampleApp')

    assert.equal(steam?.title, 'Counter-Strike 2')
    assert.equal(steam?.installPath, steamGame)
    assert.equal(steam?.build, '12345678')
    assert.equal(epicGameRecord?.title, 'Example Epic Game')
    assert.equal(epicGameRecord?.installPath, epicGame)
    assert.equal(epicGameRecord?.build, '2.4.1')
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
})

test('scanInstalledGames returns no games on unsupported platforms', async () => {
  assert.deepEqual(await scanInstalledGames({ platform: 'linux' }), [])
})
