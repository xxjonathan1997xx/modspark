const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const catalog = require('./catalog.cjs')
const { scanInstalledGames } = require('./library.cjs')

const isDev = !app.isPackaged
let updateState = { phase: 'unconfigured', message: 'No release feed is configured.' }

function publishUpdate(state) {
  updateState = state
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('updates:state', updateState)
}

// A feed baked in at build time (resources/app-update.yml, written by electron-builder when
// MODSPARK_UPDATE_URL is set during `npm run dist`) or a runtime override via the same variable.
const updateFeedConfigured = () => Boolean(process.env.MODSPARK_UPDATE_URL) ||
  (app.isPackaged && require('node:fs').existsSync(path.join(process.resourcesPath, 'app-update.yml')))

function configureUpdater() {
  const feedUrl = process.env.MODSPARK_UPDATE_URL
  if (!app.isPackaged || !updateFeedConfigured()) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => publishUpdate({ phase: 'checking', message: 'Checking for updates…' }))
  autoUpdater.on('update-available', info => publishUpdate({ phase: 'downloading', message: `Downloading version ${info.version}` }))
  autoUpdater.on('update-not-available', () => publishUpdate({ phase: 'current', message: 'You are up to date.' }))
  autoUpdater.on('download-progress', progress => publishUpdate({ phase: 'downloading', message: `Downloading update · ${Math.round(progress.percent)}%` }))
  autoUpdater.on('update-downloaded', info => publishUpdate({ phase: 'ready', message: `Version ${info.version} will install when ModSpark closes.` }))
  autoUpdater.on('error', error => publishUpdate({ phase: 'error', message: `Update check failed: ${error.message}` }))
  try {
    if (feedUrl) autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
    publishUpdate({ phase: 'checking', message: 'Checking for updates…' })
    autoUpdater.checkForUpdates()
  } catch (error) {
    publishUpdate({ phase: 'error', message: `Update feed is invalid: ${error.message}` })
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1220, height: 800, minWidth: 980, minHeight: 640,
    backgroundColor: '#101312', title: 'ModSpark',
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#131614', symbolColor: '#aeb7b0', height: 52 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  })
  if (isDev) window.loadURL('http://127.0.0.1:5173')
  else window.loadFile(path.join(__dirname, '../dist/index.html'))
}

const gamesCacheFile = () => path.join(app.getPath('userData'), 'games.json')
ipcMain.handle('games:scan', async () => {
  const games = await scanInstalledGames()
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(gamesCacheFile(), JSON.stringify({ scannedAt: new Date().toISOString(), games }, null, 2))
  return games
})
// Last scan result, or null if the library was never scanned on this PC.
ipcMain.handle('games:cached', () => fs.readFile(gamesCacheFile(), 'utf8').then(JSON.parse, () => null))
ipcMain.handle('system:open-folder', async (_event, folderPath) => {
  if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) return false
  await shell.openPath(folderPath)
  return true
})
ipcMain.handle('system:info', () => ({
  platform: process.platform, architecture: os.arch(), appVersion: app.getVersion(),
  dataPath: app.getPath('userData'), packagesPath: packagesRoot(), updateFeed: updateFeedConfigured(), packaged: app.isPackaged,
}))
ipcMain.handle('updates:get-state', () => updateState)
ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged || !updateFeedConfigured()) {
    publishUpdate({ phase: 'unconfigured', message: 'No release feed is configured.' })
    return updateState
  }
  await autoUpdater.checkForUpdates()
  return updateState
})

// ---------- community catalog ----------

const allowFileUrls = !app.isPackaged || process.env.MODSPARK_ALLOW_FILE_CATALOGS === '1'
const sourcesFile = () => path.join(app.getPath('userData'), 'catalog-sources.json')
const packagesRoot = () => path.join(app.getPath('userData'), 'packages')
const loaded = new Map() // sourceId -> { catalog?, error? }

async function readSources() {
  try {
    const list = JSON.parse(await fs.readFile(sourcesFile(), 'utf8'))
    return Array.isArray(list) ? list.filter(s => s && typeof s.url === 'string' && typeof s.publicKey === 'string') : []
  } catch { return [] }
}

async function writeSources(list) {
  await fs.mkdir(path.dirname(sourcesFile()), { recursive: true })
  await fs.writeFile(sourcesFile(), JSON.stringify(list, null, 2))
}

async function refreshCatalogs() {
  loaded.clear()
  for (const source of await readSources()) {
    try { loaded.set(source.id, { catalog: await catalog.loadCatalog(source, { allowFileUrls }) }) }
    catch (error) { loaded.set(source.id, { error: error.message }) }
  }
}

async function catalogState() {
  const sources = await readSources()
  const packages = []
  const prerequisites = []
  for (const source of sources) {
    const entry = loaded.get(source.id)
    if (!entry?.catalog) continue
    for (const pkg of entry.catalog.packages) packages.push({ ...pkg, sourceId: source.id, catalogName: entry.catalog.name })
    for (const prereq of entry.catalog.prerequisites) {
      prerequisites.push({ id: prereq.id, name: prereq.name, sourceId: source.id, canInstall: Boolean(prereq.installer), installed: await catalog.detectPrerequisite(prereq) })
    }
  }
  return {
    sources: sources.map(s => ({ id: s.id, url: s.url, name: loaded.get(s.id)?.catalog?.name, error: loaded.get(s.id)?.error, packageCount: loaded.get(s.id)?.catalog?.packages.length ?? 0 })),
    packages, prerequisites, installed: await catalog.listInstalled(packagesRoot()),
  }
}

function findInCatalog(sourceId, kind, id) {
  const item = loaded.get(sourceId)?.catalog?.[kind].find(x => x.id === id)
  if (!item) throw new Error(`Not found in the loaded catalog: ${id}`)
  return item
}

ipcMain.handle('catalog:get-state', catalogState)
ipcMain.handle('catalog:refresh', async () => { await refreshCatalogs(); return catalogState() })
ipcMain.handle('catalog:add-source', async (_event, { url, publicKey } = {}) => {
  const parsed = new URL(String(url).trim())
  if (parsed.protocol !== 'https:' && !(allowFileUrls && parsed.protocol === 'file:')) throw new Error('Catalog URL must use https://')
  catalog.publicKeyFrom(publicKey) // throws on malformed or non-Ed25519 keys
  const source = { id: catalog.sourceIdFor(parsed.href), url: parsed.href, publicKey: String(publicKey).trim() }
  await catalog.loadCatalog(source, { allowFileUrls }) // only save sources that verify
  const sources = (await readSources()).filter(s => s.id !== source.id)
  await writeSources([...sources, source])
  await refreshCatalogs()
  return catalogState()
})
ipcMain.handle('catalog:remove-source', async (_event, id) => {
  await writeSources((await readSources()).filter(s => s.id !== id))
  await refreshCatalogs()
  return catalogState()
})
ipcMain.handle('catalog:install', async (event, { sourceId, packageId } = {}) => {
  const pkg = findInCatalog(sourceId, 'packages', packageId)
  const source = (await readSources()).find(s => s.id === sourceId)
  let last = 0
  const onProgress = ({ done, total }) => {
    const now = Date.now()
    if (done < total && now - last < 100) return
    last = now
    if (!event.sender.isDestroyed()) event.sender.send('catalog:progress', { packageId, done, total })
  }
  await catalog.installPackage({ packagesRoot: packagesRoot(), pkg, source, catalogName: loaded.get(sourceId).catalog.name, options: { allowFileUrls, onProgress } })
  return catalogState()
})
ipcMain.handle('catalog:uninstall', async (_event, id) => {
  await catalog.uninstallPackage(packagesRoot(), id)
  return catalogState()
})
ipcMain.handle('catalog:launch', async (event, id) => {
  const { exe, args, cwd, record } = await catalog.resolveLaunch(packagesRoot(), String(id))
  const { response } = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: 'question', buttons: ['Launch', 'Cancel'], defaultId: 0, cancelId: 1,
    message: `Launch ${record.name}?`,
    detail: `${path.basename(exe)} from "${record.catalogName}". Its files were re-checked against their SHA-256 just now. Trainers usually need the game running first.`,
  })
  if (response !== 0) return false
  const child = spawn(exe, args, { cwd, detached: true, stdio: 'ignore', windowsHide: false })
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
  child.unref()
  return true
})
ipcMain.handle('catalog:install-prerequisite', async (event, { sourceId, id } = {}) => {
  const prereq = findInCatalog(sourceId, 'prerequisites', id)
  if (!prereq.installer) throw new Error(`${prereq.name} has no installer in the catalog; install it manually.`)
  if (await catalog.detectPrerequisite(prereq)) return catalogState()
  const host = new URL(prereq.installer.url).host
  const { response } = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: 'question', buttons: ['Install', 'Cancel'], defaultId: 1, cancelId: 1,
    message: `Install ${prereq.name}?`,
    detail: `ModSpark will download the installer from ${host}, check its SHA-256 (${prereq.installer.sha256.slice(0, 16)}…), and run it. Windows may ask for administrator permission.`,
  })
  if (response !== 0) return catalogState()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modspark-prereq-'))
  try {
    const exe = path.join(dir, `${prereq.id}-installer${path.extname(new URL(prereq.installer.url).pathname) || '.exe'}`)
    await catalog.downloadVerified(prereq.installer.url, exe, prereq.installer, { allowFileUrls })
    const code = await new Promise((resolve, reject) => {
      const child = spawn(exe, prereq.installer.args ?? [], { windowsHide: false })
      child.on('error', reject)
      child.on('exit', resolve)
    })
    if (!(await catalog.detectPrerequisite(prereq))) throw new Error(`${prereq.name} installer exited with code ${code}, and it still isn't detected.`)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
  return catalogState()
})

app.whenReady().then(() => {
  refreshCatalogs().catch(() => {})
  createWindow()
  configureUpdater()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
