import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Download, Folder, Gamepad2, Layers3, Search, Settings, Sparkles, RefreshCw, Check, Circle, ShieldCheck, Trash2, Plus, AlertTriangle, Play } from 'lucide-react'
import './styles.css'

const OFFICIAL_URL = 'https://raw.githubusercontent.com/xxjonathan1997xx/modspark-catalog/main/catalog.json'
const OFFICIAL_KEY = 'MCowBQYDK2VwAyEAZgCVC7ij799AAgYeXIxI5nXWKa8XzlczeaaizWgsd3o='
// Browser-preview rows only. The desktop app replaces them with a real scan.
const demos = [
  { id: 'steam:1091500', title: 'Cyberpunk 2077', source: 'Steam', icon: '2077' },
  { id: 'steam:1245620', title: 'Elden Ring', source: 'Steam', icon: 'ER' },
  { id: 'steam:1086940', title: "Baldur’s Gate 3", source: 'Steam', icon: 'BG3' },
  { id: 'steam:413150', title: 'Stardew Valley', source: 'Steam', icon: 'SV' },
]
const emptyCatalog = { sources: [], packages: [], prerequisites: [], installed: [] }
const cleanError = error => String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const steamCover = game => {
  const appId = /^steam:(\d+)$/.exec(game?.id ?? '')?.[1]
  return appId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg` : null
}

function App() {
  const [games, setGames] = useState(demos)
  const [selectedId, setSelectedId] = useState(demos[0].id)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('Library')
  const [scanning, setScanning] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [cat, setCat] = useState(emptyCatalog)
  const [newSource, setNewSource] = useState({ url: '', publicKey: '' })
  const [info, setInfo] = useState(null)
  const searchRef = useRef(null)
  const [updateState, setUpdateState] = useState({ phase: 'unconfigured', message: 'No release feed is configured.' })
  const api = window.modSpark
  const selected = games.find(game => game.id === selectedId) || games[0]
  const selectedCover = steamCover(selected)
  const filtered = useMemo(() => games.filter(game => game.title.toLowerCase().includes(query.toLowerCase())), [games, query])
  const installedById = useMemo(() => new Map(cat.installed.map(p => [p.id, p])), [cat.installed])
  const packagesFor = game => cat.packages.filter(p => p.games.includes(game?.id))
  const selectedPackage = packagesFor(selected)[0]
  const officialCatalogAdded = cat.sources.some(source => source.url === OFFICIAL_URL)

  useEffect(() => {
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setTab('Library'); searchRef.current?.focus() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!api) return
    api.systemInfo().then(setInfo)
    api.getUpdateState().then(setUpdateState)
    api.catalog.refresh().then(setCat).catch(error => setNotice(cleanError(error)))
    return api.onUpdateState(setUpdateState)
  }, [])

  async function run(label, action, success) {
    if (!api) { setNotice('Preview mode — catalogs and installs run in the desktop app.'); return }
    setBusy(label)
    setNotice('')
    try {
      setCat(await action())
      if (success) setNotice(success)
    } catch (error) {
      setNotice(cleanError(error))
    } finally { setBusy('') }
  }

  const addOfficialCatalog = () => run('official', () => api.catalog.addSource(OFFICIAL_URL, OFFICIAL_KEY), 'Official catalog added and verified.')

  async function scan() {
    setScanning(true)
    setNotice('')
    try {
      const detected = await api?.scanGames()
      if (detected?.length) {
        setGames(detected.map(game => ({ ...game, icon: game.title.slice(0, 2).toUpperCase() })))
        setSelectedId(detected[0].id)
        setNotice(`${detected.length} installed games found`)
      } else {
        setNotice(api ? 'No Steam or Epic games found in the standard library locations' : 'Preview mode — launch the desktop app to scan installed games')
      }
    } catch {
      setNotice('Could not scan Steam libraries')
    } finally { setScanning(false) }
  }

  const packageStatus = game => {
    const pkg = packagesFor(game)[0]
    if (!pkg) return ['none', 'None yet']
    const installed = installedById.get(pkg.id)
    if (!installed) return ['available', 'Available']
    return installed.version === pkg.version ? ['available', 'Installed'] : ['available', 'Update']
  }

  const gameList = <>
    <div className="list-head"><span>GAME</span><span>SOURCE</span><span>PACKAGE</span></div>
    <div className="game-list">
      {filtered.map(game => {
        const [kind, label] = packageStatus(game)
        const cover = steamCover(game)
        return <button key={game.id} className={`game-row ${selectedId === game.id ? 'selected' : ''}`} onClick={() => setSelectedId(game.id)}>
          <span className={`game-icon icon-${game.icon.length > 2 ? 'wide' : ''}`}>
            {cover && <img src={cover} alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true }} />}
            {game.icon}
          </span>
          <span className="game-title">{game.title}</span>
          <span className="source">{game.source || 'Steam'}</span>
          <span className={`availability ${kind}`}><span className="dot" />{label}</span>
        </button>
      })}
      {!filtered.length && <div className="empty">No games match “{query}”</div>}
    </div>
  </>

  const catalogPanel = <div className="panel-scroll">
    <div className="section-title">CATALOG SOURCES</div>
    {!cat.sources.length && <p className="panel-copy">No catalogs yet. Add a catalog URL and the publisher’s public key. ModSpark only loads catalogs whose signature matches that key.</p>}
    {!officialCatalogAdded && <button className="quiet-button official-catalog-button" disabled={!!busy} onClick={addOfficialCatalog}>{busy === 'official' ? 'Adding official catalog…' : 'Add the official catalog'}</button>}
    {cat.sources.map(source => <div key={source.id} className="source-row">
      {source.error ? <AlertTriangle size={15} className="warn" /> : <ShieldCheck size={15} className="ok" />}
      <div className="source-text"><strong>{source.name || source.url}</strong><span>{source.error || `${source.packageCount} package(s) · signature verified`}</span><code>{source.url}</code></div>
      <button className="icon-button" aria-label="Remove catalog" disabled={!!busy} onClick={() => run('remove', () => api.catalog.removeSource(source.id))}><Trash2 size={14} /></button>
    </div>)}
    <form className="source-form" onSubmit={e => { e.preventDefault(); run('add', () => api.catalog.addSource(newSource.url, newSource.publicKey), 'Catalog added and verified.').then(() => setNewSource({ url: '', publicKey: '' })) }}>
      <input aria-label="Catalog URL" placeholder="https://example.org/catalog.json" value={newSource.url} onChange={e => setNewSource({ ...newSource, url: e.target.value })} required />
      <input aria-label="Publisher public key" placeholder="Publisher public key (base64)" value={newSource.publicKey} onChange={e => setNewSource({ ...newSource, publicKey: e.target.value })} required />
      <button className="quiet-button" disabled={!!busy}><Plus size={14} />{busy === 'add' ? 'Verifying…' : 'Add catalog'}</button>
    </form>
    <div className="section-title spaced">PACKAGES ({cat.packages.length})</div>
    {!cat.packages.length && <p className="panel-copy">Packages from your catalogs appear here.</p>}
    {cat.packages.map(pkg => <div key={`${pkg.sourceId}/${pkg.id}`} className="source-row">
      <Layers3 size={15} className="ok" />
      <div className="source-text"><strong>{pkg.name} <em>v{pkg.version}</em></strong><span>{pkg.author} · {pkg.license} · {pkg.games.join(', ')}</span></div>
      {installedById.has(pkg.id) && <span className="ready">Installed</span>}
    </div>)}
  </div>

  const settingsPanel = <div className="panel-scroll">
    <div className="section-title">ABOUT</div>
    <div className="source-row"><Sparkles size={15} className="ok" /><div className="source-text"><strong>ModSpark {info ? `v${info.appVersion}` : ''}</strong><span>MIT licensed. No ads, no account, no telemetry.{info ? ` ${info.platform} ${info.architecture}${info.packaged ? '' : ' · development build'}` : ''}</span></div></div>
    <div className="section-title spaced">STORAGE</div>
    {info ? <>
      <div className="source-row"><Folder size={15} className="ok" /><div className="source-text"><strong>Installed packages</strong><code>{info.packagesPath}</code></div><button className="icon-button" aria-label="Open packages folder" onClick={() => api.openFolder(info.packagesPath)}><Folder size={14} /></button></div>
      <div className="source-row"><Folder size={15} className="ok" /><div className="source-text"><strong>App data (catalog list, settings)</strong><code>{info.dataPath}</code></div><button className="icon-button" aria-label="Open app data folder" onClick={() => api.openFolder(info.dataPath)}><Folder size={14} /></button></div>
    </> : <p className="panel-copy">Folders are shown in the desktop app.</p>}
    <div className="section-title spaced">UPDATES</div>
    <div className="source-row">{info?.updateFeed ? <ShieldCheck size={15} className="ok" /> : <AlertTriangle size={15} className="warn" />}<div className="source-text"><strong>{info?.updateFeed ? 'Automatic updates on' : 'Automatic updates not configured'}</strong><span>{info?.updateFeed ? 'New versions download in the background and install when ModSpark closes.' : 'This build has no release feed. The publisher sets one when building the installer.'}</span></div></div>
    <div className="section-title spaced">CATALOGS</div>
    <p className="panel-copy">{cat.sources.length} catalog(s) · {cat.packages.length} package(s) · {cat.installed.length} installed. Manage them in Packages.</p>
  </div>

  const installedPanel = <div className="panel-scroll">
    <div className="section-title">INSTALLED PACKAGES</div>
    {!cat.installed.length && <p className="panel-copy">Nothing installed yet.</p>}
    {cat.installed.map(pkg => <div key={pkg.id} className="source-row">
      <Check size={15} className="ok" />
      <div className="source-text"><strong>{pkg.name} <em>v{pkg.version}</em></strong><span>From {pkg.catalogName} · {pkg.files.length} file(s), checksums verified</span><code>{pkg.path}</code></div>
      {pkg.launch && <button className="icon-button" aria-label="Launch" disabled={!!busy} onClick={() => launch(pkg)}><Play size={14} /></button>}
      <button className="icon-button" aria-label="Open folder" onClick={() => api?.openFolder(pkg.path)}><Folder size={14} /></button>
      <button className="icon-button" aria-label="Uninstall" disabled={!!busy} onClick={() => run('uninstall', () => api.catalog.uninstall(pkg.id), `${pkg.name} removed.`)}><Trash2 size={14} /></button>
    </div>)}
  </div>

  async function launch(pkg) {
    setNotice('')
    try { if (await api.catalog.launch(pkg.id)) setNotice(`${pkg.name} started.`) }
    catch (error) { setNotice(cleanError(error)) }
  }

  const installed = selectedPackage && installedById.get(selectedPackage.id)
  const compat = !selectedPackage?.gameBuilds?.length || !selected?.build ? 'unknown' : selectedPackage.gameBuilds.includes(String(selected.build)) ? 'tested' : 'untested'
  const requirements = (selectedPackage?.requires ?? []).map(id => cat.prerequisites.find(p => p.id === id && p.sourceId === selectedPackage.sourceId)).filter(Boolean)
  const missing = requirements.filter(r => !r.installed)

  return <div className="window">
    <header className="titlebar"><div className="brand-mark"><Sparkles size={18} /></div><span className="brand">ModSpark</span><span className="titlebar-caption">Community game tools</span></header>
    <div className="shell">
      <aside className="sidebar">
        <div className="nav-group">
          {[['Library', Gamepad2], ['Packages', Layers3], ['Downloads', Download], ['Settings', Settings]].map(([label, Icon]) => <button key={label} className={`nav-item ${tab === label ? 'active' : ''}`} onClick={() => setTab(label)}><Icon size={18} /><span>{label}</span></button>)}
        </div>
        <div className="sidebar-bottom"><div className="open-source"><ShieldCheck size={16} /><span>Open source. No ads.</span></div><span className="version">ModSpark · v0.1.0</span></div>
      </aside>
      <main className="content">
        <div className="searchbar"><Search size={17} /><input ref={searchRef} aria-label="Search games" placeholder="Search your games…" value={query} onChange={e => setQuery(e.target.value)} /><kbd>Ctrl K</kbd></div>
        <div className="heading-row">
          <div><h1>{tab === 'Library' ? 'Your library' : tab}</h1><p>{tab === 'Library' ? 'Pick a game to see its community packages.' : tab === 'Packages' ? 'Signed community catalogs and the packages they offer.' : tab === 'Downloads' ? 'Packages installed on this PC.' : 'Folders, updates and app details.'}</p></div>
          {tab === 'Packages'
            ? <button className="scan-button" onClick={() => run('refresh', () => api.catalog.refresh(), 'Catalogs refreshed.')} disabled={!!busy}><RefreshCw size={15} className={busy === 'refresh' ? 'spin' : ''} />Refresh catalogs</button>
            : <button className="scan-button" onClick={scan} disabled={scanning}><RefreshCw size={15} className={scanning ? 'spin' : ''} />{scanning ? 'Scanning…' : 'Scan for games'}</button>}
        </div>
        {tab === 'Packages' ? catalogPanel : tab === 'Downloads' ? installedPanel : tab === 'Settings' ? settingsPanel : gameList}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
        <div className="list-foot">{games.length} games <span>·</span> {cat.packages.length} catalog packages <span>·</span> Packages are community maintained</div>
      </main>
      <aside className="details">
        {selected ? <>
          <div className="game-art">
            {selectedCover && <img key={selectedCover} className="game-art-cover" src={selectedCover} alt="" onError={e => { e.currentTarget.hidden = true }} />}
            <div className="art-orbit" /><div className="art-initial">{selected.icon}</div><div className="art-caption">{selected.title}</div>
          </div>
          <h2>{selected.title}</h2>
          <div className="meta"><span>Source</span><strong>{selected.source || 'Steam'}</strong></div>
          {selected.build && <div className="meta"><span>Game build</span><strong>{selected.build}</strong></div>}
          {selected.installPath && <button className="path-button" onClick={() => api?.openFolder(selected.installPath)}><Folder size={15} />Open install folder</button>}
          <section className="package-section"><div className="section-title">COMMUNITY PACKAGE</div>
            {selectedPackage ? <>
              <div className="package-name"><Layers3 size={17} /><strong>{selectedPackage.name}</strong><span>v{selectedPackage.version}</span></div>
              <p className="package-copy">By {selectedPackage.author} · {selectedPackage.license} · from “{selectedPackage.catalogName}”.{selectedPackage.gameVersions?.length ? ` Tested with game version ${selectedPackage.gameVersions.join(', ')}.` : ''} {selectedPackage.files.length} file(s), each checked against its SHA-256 before install.</p>
              {compat === 'tested' && <p className="compat ok"><Check size={13} />Tested with your game build ({selected.build}).</p>}
              {compat === 'untested' && <p className="compat warn"><AlertTriangle size={13} />Not tested with your game build ({selected.build}). It may not work after a game update.</p>}
              {installed && installed.version === selectedPackage.version
                ? <div className={`button-pair ${installed.launch ? 'three' : ''}`}>
                    {installed.launch && <button className="install-button" disabled={!!busy} onClick={() => launch(installed)}><Play size={14} />Launch</button>}
                    <button className="quiet-button" onClick={() => api?.openFolder(installed.path)}><Folder size={14} />Open</button>
                    <button className="quiet-button" disabled={!!busy} onClick={() => run('uninstall', () => api.catalog.uninstall(selectedPackage.id), `${selectedPackage.name} removed.`)}><Trash2 size={14} />Uninstall</button>
                  </div>
                : <button className="install-button" disabled={!!busy || missing.length > 0} title={missing.length ? 'Install the missing requirements first' : ''} onClick={() => run('install', () => api.catalog.install(selectedPackage.sourceId, selectedPackage.id), `${selectedPackage.name} installed and verified.`)}><Download size={16} />{busy === 'install' ? 'Downloading and verifying…' : installed ? `Update to v${selectedPackage.version}` : 'Install package'}</button>}
            </> : <>
              <div className="empty-package"><span className="empty-mark"><Layers3 size={17} /></span><strong>No package yet</strong><p>{cat.sources.length ? 'None of your catalogs has a package for this game.' : 'Add a community catalog to find packages.'}</p></div>
              {cat.sources.length
                ? <button className="quiet-button" onClick={() => setTab('Packages')}>Browse packages</button>
                : <button className="quiet-button" disabled={!!busy} onClick={addOfficialCatalog}>{busy === 'official' ? 'Adding official catalog…' : 'Add the official catalog'}</button>}
            </>}
          </section>
          <section className="dependencies"><div className="section-title">REQUIREMENTS</div>
            <div className="dependency-row"><Check size={15} /><span>ModSpark core</span><span className="ready">Ready</span></div>
            {requirements.map(req => <div key={req.id} className="dependency-row">
              {req.installed ? <Check size={15} /> : <Circle size={15} />}<span>{req.name}</span>
              {req.installed ? <span className="ready">Installed</span>
                : req.canInstall ? <button className="link-button" disabled={!!busy} onClick={() => run('prereq', () => api.catalog.installPrerequisite(req.sourceId, req.id))}>Install</button>
                : <span className="pending">Install manually</span>}
            </div>)}
            {selectedPackage && !requirements.length && <div className="dependency-row"><Check size={15} /><span>No extra requirements</span><span className="ready">Ready</span></div>}
          </section>
          <div className="detail-bottom"><p><ShieldCheck size={15} />Catalogs must be signed. Every file is size- and SHA-256-checked before it is installed.</p></div>
        </> : <div className="empty-details">Select a game</div>}
      </aside>
    </div>
    <footer className="statusbar"><span className={updateState.phase === 'current' ? 'status-ok' : 'status-pending'}>{updateState.phase === 'current' ? <Check size={14} /> : <Circle size={12} />}{updateState.phase === 'current' ? 'Up to date' : updateState.phase === 'unconfigured' ? 'Updates not configured' : updateState.message}</span><span className="divider" /><span>App v0.1.0</span><span className="status-spacer" /><button onClick={async () => { const state = await api?.checkUpdates(); if (!api) setNotice('Preview mode — automatic updates run in the packaged desktop app.'); else if (state?.phase === 'unconfigured') setNotice('Automatic updates need a release feed configured by the publisher.') }}><RefreshCw size={13} />Check for updates</button></footer>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
