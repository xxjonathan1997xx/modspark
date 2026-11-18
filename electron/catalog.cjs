// Signed community catalog: loading, validation, verified package install, prerequisite detection.
// Plain Node module (no Electron imports) so it can be tested and used by the maintainer CLI.
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

const SCHEMA_VERSION = 1
const MAX_CATALOG_BYTES = 5 * 1024 * 1024
const MAX_FILE_BYTES = 1024 * 1024 * 1024
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/
const GAME_RE = /^(steam:\d{1,12}|epic:[A-Za-z0-9._-]{1,128})$/
const SHA256_RE = /^[a-f0-9]{64}$/
const SEGMENT_RE = /^[A-Za-z0-9._ ()-]{1,128}$/
const RESERVED_RE = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

// ---------- keys and signatures ----------

function publicKeyFrom(base64) {
  let key
  try { key = crypto.createPublicKey({ key: Buffer.from(String(base64).trim(), 'base64'), format: 'der', type: 'spki' }) }
  catch { throw new Error('Public key is not a valid base64 Ed25519 key') }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Catalog keys must be Ed25519')
  return key
}

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  }
}

function signBytes(bytes, privateKeyPem) {
  return crypto.sign(null, bytes, crypto.createPrivateKey(privateKeyPem)).toString('base64')
}

function verifyBytes(bytes, signatureBase64, publicKeyBase64) {
  const signature = Buffer.from(String(signatureBase64).trim(), 'base64')
  if (signature.length !== 64) return false
  return crypto.verify(null, bytes, publicKeyFrom(publicKeyBase64), signature)
}

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

// ---------- validation ----------

function checkUrl(value, where, errors, options) {
  let url
  try { url = new URL(value) } catch { errors.push(`${where}: not a valid URL`); return }
  if (url.protocol === 'https:') return
  if (url.protocol === 'file:' && options.allowFileUrls) return
  errors.push(`${where}: must be an https:// URL`)
}

function checkRelativePath(value, where, errors) {
  if (typeof value !== 'string' || !value) { errors.push(`${where}: path is required`); return }
  if (value.includes('\\')) { errors.push(`${where}: use forward slashes`); return }
  for (const segment of value.split('/')) {
    if (!SEGMENT_RE.test(segment) || segment === '.' || segment === '..' || /[. ]$/.test(segment) || RESERVED_RE.test(segment)) {
      errors.push(`${where}: unsafe path segment "${segment}"`)
      return
    }
  }
}

function validateCatalog(catalog, options = {}) {
  const errors = []
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Catalog must be a JSON object')
  if (catalog.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`)
  if (typeof catalog.name !== 'string' || !catalog.name.trim()) errors.push('name is required')
  if (!Array.isArray(catalog.packages)) errors.push('packages must be an array')
  const prerequisites = Array.isArray(catalog.prerequisites) ? catalog.prerequisites : []
  if (catalog.prerequisites !== undefined && !Array.isArray(catalog.prerequisites)) errors.push('prerequisites must be an array')

  const prereqIds = new Set()
  prerequisites.forEach((p, i) => {
    const where = `prerequisites[${i}]`
    if (!ID_RE.test(p?.id ?? '')) errors.push(`${where}.id is invalid`)
    else if (prereqIds.has(p.id)) errors.push(`${where}.id "${p.id}" is duplicated`)
    else prereqIds.add(p.id)
    if (typeof p?.name !== 'string' || !p.name) errors.push(`${where}.name is required`)
    const files = p?.detect?.anyFile
    if (!Array.isArray(files) || !files.length || files.some(f => typeof f !== 'string' || !f)) errors.push(`${where}.detect.anyFile must list at least one path`)
    if (p?.installer !== undefined) {
      const inst = p.installer
      checkUrl(inst?.url, `${where}.installer.url`, errors, options)
      if (!SHA256_RE.test(inst?.sha256 ?? '')) errors.push(`${where}.installer.sha256 must be 64 lowercase hex chars`)
      if (!Number.isInteger(inst?.size) || inst.size < 1 || inst.size > MAX_FILE_BYTES) errors.push(`${where}.installer.size is invalid`)
      if (inst?.args !== undefined && (!Array.isArray(inst.args) || inst.args.some(a => typeof a !== 'string'))) errors.push(`${where}.installer.args must be strings`)
    }
  })

  const packageIds = new Set()
  ;(Array.isArray(catalog.packages) ? catalog.packages : []).forEach((pkg, i) => {
    const where = `packages[${i}]`
    if (!ID_RE.test(pkg?.id ?? '')) errors.push(`${where}.id is invalid`)
    else if (packageIds.has(pkg.id)) errors.push(`${where}.id "${pkg.id}" is duplicated`)
    else packageIds.add(pkg.id)
    if (typeof pkg?.name !== 'string' || !pkg.name) errors.push(`${where}.name is required`)
    if (!VERSION_RE.test(pkg?.version ?? '')) errors.push(`${where}.version is invalid`)
    for (const field of ['author', 'license']) if (typeof pkg?.[field] !== 'string' || !pkg[field]) errors.push(`${where}.${field} is required`)
    if (pkg?.homepage !== undefined) checkUrl(pkg.homepage, `${where}.homepage`, errors, { allowFileUrls: false })
    if (!Array.isArray(pkg?.games) || !pkg.games.length || pkg.games.some(g => !GAME_RE.test(g))) errors.push(`${where}.games must list ids like "steam:1091500" or "epic:AppName"`)
    if (pkg?.gameVersions !== undefined && (!Array.isArray(pkg.gameVersions) || pkg.gameVersions.some(v => typeof v !== 'string'))) errors.push(`${where}.gameVersions must be strings`)
    if (pkg?.gameBuilds !== undefined && (!Array.isArray(pkg.gameBuilds) || pkg.gameBuilds.some(v => typeof v !== 'string' || !v))) errors.push(`${where}.gameBuilds must be non-empty strings`)
    if (pkg?.requires !== undefined) {
      if (!Array.isArray(pkg.requires)) errors.push(`${where}.requires must be an array`)
      else for (const req of pkg.requires) if (!prereqIds.has(req)) errors.push(`${where}.requires references unknown prerequisite "${req}"`)
    }
    if (!Array.isArray(pkg?.files) || !pkg.files.length) { errors.push(`${where}.files must list at least one file`); return }
    const seen = new Set()
    pkg.files.forEach((file, j) => {
      const fw = `${where}.files[${j}]`
      checkRelativePath(file?.path, `${fw}.path`, errors)
      const key = String(file?.path).toLowerCase()
      if (seen.has(key)) errors.push(`${fw}.path duplicates another file`)
      seen.add(key)
      checkUrl(file?.url, `${fw}.url`, errors, options)
      if (!SHA256_RE.test(file?.sha256 ?? '')) errors.push(`${fw}.sha256 must be 64 lowercase hex chars`)
      if (!Number.isInteger(file?.size) || file.size < 1 || file.size > MAX_FILE_BYTES) errors.push(`${fw}.size is invalid`)
    })
    if (pkg?.launch !== undefined) {
      const target = pkg.launch?.path
      if (typeof target !== 'string' || !/\.exe$/i.test(target)) errors.push(`${where}.launch.path must name an .exe`)
      else if (!pkg.files.some(f => String(f?.path).toLowerCase() === target.toLowerCase())) errors.push(`${where}.launch.path must be one of the package's files`)
      if (pkg.launch?.args !== undefined && (!Array.isArray(pkg.launch.args) || pkg.launch.args.some(a => typeof a !== 'string'))) errors.push(`${where}.launch.args must be strings`)
    }
  })

  if (errors.length) throw new Error(`Catalog is invalid:\n- ${errors.join('\n- ')}`)
  return { ...catalog, prerequisites }
}

// ---------- fetching ----------

async function* openChunks(url, options = {}) {
  const parsed = new URL(url)
  if (parsed.protocol === 'file:' && options.allowFileUrls) {
    yield* fs.createReadStream(fileURLToPath(parsed))
    return
  }
  if (parsed.protocol !== 'https:') throw new Error(`Refusing non-https URL: ${parsed.protocol}`)
  const response = await fetch(parsed, { redirect: 'follow' })
  if (new URL(response.url || parsed).protocol !== 'https:') throw new Error('Download was redirected away from https')
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${parsed.host}`)
  for await (const chunk of response.body) yield chunk
}

async function readUrl(url, maxBytes, options) {
  const chunks = []
  let total = 0
  for await (const chunk of openChunks(url, options)) {
    total += chunk.length
    if (total > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`)
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// Streams url to dest, enforcing the declared size and SHA-256. Deletes dest on failure.
async function downloadVerified(url, dest, expected, options) {
  const hash = crypto.createHash('sha256')
  let total = 0
  const handle = await fsp.open(dest, 'wx')
  try {
    for await (const chunk of openChunks(url, options)) {
      total += chunk.length
      if (total > expected.size) throw new Error(`${path.basename(dest)} is larger than its catalog size`)
      hash.update(chunk)
      await handle.write(chunk)
      options?.onChunk?.(chunk.length)
    }
    if (total !== expected.size) throw new Error(`${path.basename(dest)} size ${total} does not match catalog size ${expected.size}`)
    const digest = hash.digest('hex')
    if (digest !== expected.sha256) throw new Error(`${path.basename(dest)} checksum mismatch (got ${digest.slice(0, 12)}…)`)
  } catch (error) {
    await handle.close().catch(() => {})
    await fsp.rm(dest, { force: true })
    throw error
  }
  await handle.close()
}

const sourceIdFor = url => sha256(Buffer.from(url)).slice(0, 12)

// Fetches catalog + detached signature (`<url>.sig`), verifies, validates.
async function loadCatalog(source, options = {}) {
  const bytes = await readUrl(source.url, MAX_CATALOG_BYTES, options)
  const signature = (await readUrl(source.signatureUrl || `${source.url}.sig`, 1024, options)).toString('utf8')
  if (!verifyBytes(bytes, signature, source.publicKey)) throw new Error('Catalog signature does not match the trusted key')
  let parsed
  try { parsed = JSON.parse(bytes.toString('utf8')) } catch { throw new Error('Catalog is not valid JSON') }
  return validateCatalog(parsed, options)
}

// ---------- install / uninstall ----------

function containedPath(root, relative) {
  const resolved = path.resolve(root, ...relative.split('/'))
  const rel = path.relative(root, resolved)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path escapes install folder: ${relative}`)
  return resolved
}

async function installPackage({ packagesRoot, pkg, source, catalogName, options = {} }) {
  if (!ID_RE.test(pkg.id) || !VERSION_RE.test(pkg.version)) throw new Error('Invalid package id or version')
  await fsp.mkdir(packagesRoot, { recursive: true })
  const finalDir = containedPath(packagesRoot, pkg.id)
  const existing = await fsp.readFile(path.join(finalDir, 'modspark-install.json'), 'utf8').then(JSON.parse, () => null)
  if (existing && existing.source?.id !== source.id) {
    throw new Error(`"${existing.name}" (${pkg.id}) is already installed from ${existing.catalogName}. Uninstall it before installing the same id from ${catalogName}.`)
  }
  const total = pkg.files.reduce((sum, f) => sum + f.size, 0)
  let done = 0
  const fileOptions = { ...options, onChunk: n => { done += n; options.onProgress?.({ done, total }) } }
  const staging = await fsp.mkdtemp(path.join(packagesRoot, '.staging-'))
  try {
    for (const file of pkg.files) {
      const dest = containedPath(staging, file.path)
      await fsp.mkdir(path.dirname(dest), { recursive: true })
      await downloadVerified(file.url, dest, file, fileOptions)
    }
    const record = {
      id: pkg.id, name: pkg.name, version: pkg.version, games: pkg.games,
      source: { id: source.id, url: source.url }, catalogName,
      files: pkg.files.map(f => ({ path: f.path, sha256: f.sha256, size: f.size })),
      launch: pkg.launch,
      installedAt: new Date().toISOString(),
    }
    await fsp.writeFile(path.join(staging, 'modspark-install.json'), JSON.stringify(record, null, 2))
    const previous = `${finalDir}.old-${Date.now()}`
    const hadPrevious = await fsp.rename(finalDir, previous).then(() => true, () => false)
    try {
      await fsp.rename(staging, finalDir)
    } catch (error) {
      if (hadPrevious) await fsp.rename(previous, finalDir).catch(() => {})
      throw error
    }
    if (hadPrevious) await fsp.rm(previous, { recursive: true, force: true })
    return { ...record, path: finalDir }
  } catch (error) {
    await fsp.rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function listInstalled(packagesRoot) {
  const entries = await fsp.readdir(packagesRoot, { withFileTypes: true }).catch(() => [])
  const installed = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue
    const dir = path.join(packagesRoot, entry.name)
    try {
      const record = JSON.parse(await fsp.readFile(path.join(dir, 'modspark-install.json'), 'utf8'))
      if (record.id === entry.name) installed.push({ ...record, path: dir })
    } catch {}
  }
  return installed
}

async function uninstallPackage(packagesRoot, id) {
  if (!ID_RE.test(id)) throw new Error('Invalid package id')
  const dir = containedPath(packagesRoot, id)
  await fsp.access(path.join(dir, 'modspark-install.json'))
  await fsp.rm(dir, { recursive: true, force: true })
}

// Re-hashes every installed file against the install record. Returns the record and folder.
async function verifyInstalled(packagesRoot, id) {
  if (!ID_RE.test(id)) throw new Error('Invalid package id')
  const dir = containedPath(packagesRoot, id)
  const record = JSON.parse(await fsp.readFile(path.join(dir, 'modspark-install.json'), 'utf8'))
  for (const file of record.files) {
    const bytes = await fsp.readFile(containedPath(dir, file.path)).catch(() => null)
    if (!bytes) throw new Error(`${file.path} is missing. Reinstall the package.`)
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw new Error(`${file.path} has changed since install. Reinstall the package.`)
  }
  return { record, dir }
}

// Resolves the launch executable for an installed package after verifying its files.
async function resolveLaunch(packagesRoot, id) {
  const { record, dir } = await verifyInstalled(packagesRoot, id)
  if (!record.launch?.path) throw new Error(`${record.name} has no launch target. Open its folder instead.`)
  return { exe: containedPath(dir, record.launch.path), args: record.launch.args ?? [], cwd: dir, record }
}

// Compatibility of a package with a detected game build: 'tested', 'untested', or 'unknown'.
function compatibility(pkg, build) {
  if (!pkg.gameBuilds?.length || !build) return 'unknown'
  return pkg.gameBuilds.includes(String(build)) ? 'tested' : 'untested'
}

// ---------- prerequisites ----------

function expandEnv(value, env = process.env) {
  return value.replace(/%([A-Za-z0-9_()]+)%/g, (match, name) => {
    const key = Object.keys(env).find(k => k.toLowerCase() === name.toLowerCase())
    return key ? env[key] : match
  })
}

async function detectPrerequisite(prereq, env) {
  for (const candidate of prereq.detect.anyFile) {
    const expanded = expandEnv(candidate, env)
    if (expanded.includes('%') || !path.isAbsolute(expanded)) continue
    if (await fsp.stat(expanded).then(s => s.isFile(), () => false)) return true
  }
  return false
}

module.exports = {
  SCHEMA_VERSION, generateKeyPair, signBytes, verifyBytes, sha256, validateCatalog,
  loadCatalog, sourceIdFor, installPackage, listInstalled, uninstallPackage,
  detectPrerequisite, downloadVerified, expandEnv, publicKeyFrom, verifyInstalled, resolveLaunch, compatibility,
}
