const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const c = require('../electron/catalog.cjs')

const opts = { allowFileUrls: true }

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modspark-test-'))
  const payload = Buffer.from('hello trainer')
  fs.writeFileSync(path.join(dir, 'payload.bin'), payload)
  const keys = c.generateKeyPair()
  const doc = {
    schemaVersion: 1, name: 'Test catalog',
    prerequisites: [{ id: 'fake-runtime', name: 'Fake runtime', detect: { anyFile: [path.join(dir, 'payload.bin')] } }],
    packages: [{
      id: 'demo-pack', name: 'Demo pack', version: '1.0.0', author: 'tester', license: 'MIT',
      games: ['steam:1091500'], requires: ['fake-runtime'],
      files: [{ path: 'bin/demo.txt', url: pathToFileURL(path.join(dir, 'payload.bin')).href, sha256: c.sha256(payload), size: payload.length }],
    }],
  }
  const write = (d = doc) => {
    const bytes = Buffer.from(JSON.stringify(d, null, 2))
    fs.writeFileSync(path.join(dir, 'catalog.json'), bytes)
    fs.writeFileSync(path.join(dir, 'catalog.json.sig'), c.signBytes(bytes, keys.privateKeyPem))
  }
  write()
  const source = { id: 'src', url: pathToFileURL(path.join(dir, 'catalog.json')).href, publicKey: keys.publicKey }
  return { dir, doc, keys, source, write, root: path.join(dir, 'packages') }
}

test('loads a signed catalog and installs, lists, uninstalls a package', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  assert.equal(cat.packages.length, 1)
  const installed = await c.installPackage({ packagesRoot: f.root, pkg: cat.packages[0], source: f.source, catalogName: cat.name, options: opts })
  assert.equal(fs.readFileSync(path.join(installed.path, 'bin', 'demo.txt'), 'utf8'), 'hello trainer')
  assert.deepEqual((await c.listInstalled(f.root)).map(p => p.id), ['demo-pack'])
  // reinstall replaces cleanly
  await c.installPackage({ packagesRoot: f.root, pkg: cat.packages[0], source: f.source, catalogName: cat.name, options: opts })
  assert.deepEqual(fs.readdirSync(f.root), ['demo-pack'])
  await c.uninstallPackage(f.root, 'demo-pack')
  assert.deepEqual(await c.listInstalled(f.root), [])
  assert.equal(await c.detectPrerequisite(cat.prerequisites[0]), true)
  assert.equal(await c.detectPrerequisite({ detect: { anyFile: ['%NOPE_NOT_SET%\\x.dll', path.join(f.dir, 'missing.dll')] } }), false)
})

test('rejects a tampered catalog', async () => {
  const f = fixture()
  fs.appendFileSync(path.join(f.dir, 'catalog.json'), ' ')
  await assert.rejects(c.loadCatalog(f.source, opts), /signature/)
})

test('rejects a catalog signed by a different key', async () => {
  const f = fixture()
  await assert.rejects(c.loadCatalog({ ...f.source, publicKey: c.generateKeyPair().publicKey }, opts), /signature/)
})

test('rejects file URLs unless explicitly allowed', async () => {
  const f = fixture()
  await assert.rejects(c.loadCatalog(f.source), /non-https/)
})

test('checksum mismatch aborts install and leaves nothing behind', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  const pkg = { ...cat.packages[0], files: [{ ...cat.packages[0].files[0], sha256: '0'.repeat(64) }] }
  await assert.rejects(c.installPackage({ packagesRoot: f.root, pkg, source: f.source, catalogName: 'x', options: opts }), /checksum/)
  assert.deepEqual(fs.readdirSync(f.root), [])
})

test('size mismatch aborts install', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  const pkg = { ...cat.packages[0], files: [{ ...cat.packages[0].files[0], size: 3 }] }
  await assert.rejects(c.installPackage({ packagesRoot: f.root, pkg, source: f.source, catalogName: 'x', options: opts }), /larger/)
})

test('validation rejects unsafe paths, bad ids, http URLs and unknown prerequisites', () => {
  const f = fixture()
  const bad = (mutate, re) => {
    const d = structuredClone(f.doc)
    mutate(d)
    assert.throws(() => c.validateCatalog(d, opts), re)
  }
  bad(d => { d.packages[0].files[0].path = '../evil.exe' }, /unsafe path/)
  bad(d => { d.packages[0].files[0].path = 'C:/evil.exe' }, /unsafe path/)
  bad(d => { d.packages[0].files[0].path = 'bin\\evil.exe' }, /forward slashes/)
  bad(d => { d.packages[0].files[0].path = 'CON.txt' }, /unsafe path/)
  bad(d => { d.packages[0].id = 'Bad ID' }, /id is invalid/)
  bad(d => { d.packages[0].files[0].url = 'http://example.com/x' }, /https/)
  bad(d => { d.packages[0].requires = ['missing'] }, /unknown prerequisite/)
  bad(d => { d.packages[0].games = ['origin:1'] }, /games/)
  bad(d => { d.schemaVersion = 2 }, /schemaVersion/)
  assert.doesNotThrow(() => c.validateCatalog(f.doc, opts))
})

test('uninstall refuses folders ModSpark did not install', async () => {
  const f = fixture()
  fs.mkdirSync(path.join(f.root, 'not-ours'), { recursive: true })
  await assert.rejects(c.uninstallPackage(f.root, 'not-ours'))
  assert.ok(fs.existsSync(path.join(f.root, 'not-ours')))
  await assert.rejects(c.uninstallPackage(f.root, '..'), /Invalid/)
})

test('launch target must be one of the package .exe files', () => {
  const f = fixture()
  const withLaunch = launch => { const d = structuredClone(f.doc); d.packages[0].launch = launch; return d }
  assert.throws(() => c.validateCatalog(withLaunch({ path: 'bin/demo.txt' }), opts), /must name an \.exe/)
  assert.throws(() => c.validateCatalog(withLaunch({ path: 'bin/other.exe' }), opts), /one of the package's files/)
  const d = withLaunch({ path: 'bin/tool.exe', args: ['--x'] })
  d.packages[0].files[0].path = 'bin/tool.exe'
  assert.doesNotThrow(() => c.validateCatalog(d, opts))
})

test('resolveLaunch re-verifies files and catches tampering', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  const pkg = { ...cat.packages[0], files: [{ ...cat.packages[0].files[0], path: 'bin/tool.exe' }], launch: { path: 'bin/tool.exe' } }
  const installed = await c.installPackage({ packagesRoot: f.root, pkg, source: f.source, catalogName: cat.name, options: opts })
  const target = await c.resolveLaunch(f.root, 'demo-pack')
  assert.equal(target.exe, path.join(installed.path, 'bin', 'tool.exe'))
  fs.appendFileSync(target.exe, 'x')
  await assert.rejects(c.resolveLaunch(f.root, 'demo-pack'), /changed since install/)
  fs.rmSync(target.exe)
  await assert.rejects(c.resolveLaunch(f.root, 'demo-pack'), /missing/)
})

test('resolveLaunch refuses packages without a launch target', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  await c.installPackage({ packagesRoot: f.root, pkg: cat.packages[0], source: f.source, catalogName: cat.name, options: opts })
  await assert.rejects(c.resolveLaunch(f.root, 'demo-pack'), /no launch target/)
})

test('compatibility compares declared game builds with the detected build', () => {
  assert.equal(c.compatibility({ gameBuilds: ['123'] }, '123'), 'tested')
  assert.equal(c.compatibility({ gameBuilds: ['123'] }, '456'), 'untested')
  assert.equal(c.compatibility({}, '456'), 'unknown')
  assert.equal(c.compatibility({ gameBuilds: ['123'] }, undefined), 'unknown')
})

test('install reports byte progress up to the package total', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  const events = []
  await c.installPackage({ packagesRoot: f.root, pkg: cat.packages[0], source: f.source, catalogName: cat.name, options: { ...opts, onProgress: e => events.push(e) } })
  const total = cat.packages[0].files[0].size
  assert.ok(events.length > 0)
  assert.deepEqual(events.at(-1), { done: total, total })
})

test('a package id installed from one catalog is not overwritten by another catalog', async () => {
  const f = fixture()
  const cat = await c.loadCatalog(f.source, opts)
  await c.installPackage({ packagesRoot: f.root, pkg: cat.packages[0], source: f.source, catalogName: 'First', options: opts })
  const other = { ...f.source, id: 'other-source' }
  await assert.rejects(c.installPackage({ packagesRoot: f.root, pkg: cat.packages[0], source: other, catalogName: 'Second', options: opts }), /already installed from First/)
  assert.equal((await c.listInstalled(f.root))[0].catalogName, 'First')
})

test('catalog accepts gog: game ids', () => {
  const f = fixture()
  const d = structuredClone(f.doc)
  d.packages[0].games = ['gog:1207658924', 'steam:1']
  assert.doesNotThrow(() => c.validateCatalog(d, opts))
})
