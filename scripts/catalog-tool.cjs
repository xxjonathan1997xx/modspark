#!/usr/bin/env node
// Maintainer CLI for ModSpark catalogs. See docs/CATALOG.md.
const fs = require('node:fs')
const path = require('node:path')
const catalog = require('../electron/catalog.cjs')

const usage = `Usage:
  node scripts/catalog-tool.cjs keygen <out-dir>                 Create catalog-key.pem (keep secret) and catalog-key.pub
  node scripts/catalog-tool.cjs hash <file>                      Print the sha256 and size for a "files" entry
  node scripts/catalog-tool.cjs sign <catalog.json> <key.pem>    Validate, then write <catalog.json>.sig
  node scripts/catalog-tool.cjs verify <catalog.json> <key.pub>  Check the signature and validate

  --allow-file-urls   accept file:// URLs (local testing only; the packaged app rejects them)`

const allowFileUrls = process.argv.includes('--allow-file-urls')

function main([command, a, b]) {
  switch (command) {
    case 'keygen': {
      if (!a) throw new Error(usage)
      fs.mkdirSync(a, { recursive: true })
      const pem = path.join(a, 'catalog-key.pem')
      if (fs.existsSync(pem)) throw new Error(`${pem} already exists; refusing to overwrite`)
      const keys = catalog.generateKeyPair()
      fs.writeFileSync(pem, keys.privateKeyPem, { mode: 0o600, flag: 'wx' })
      fs.writeFileSync(path.join(a, 'catalog-key.pub'), `${keys.publicKey}\n`)
      console.log(`Private key: ${pem} (never commit this)\nPublic key (give to users): ${keys.publicKey}`)
      return
    }
    case 'hash': {
      if (!a) throw new Error(usage)
      const bytes = fs.readFileSync(a)
      console.log(JSON.stringify({ sha256: catalog.sha256(bytes), size: bytes.length }, null, 2))
      return
    }
    case 'sign': {
      if (!a || !b) throw new Error(usage)
      const bytes = fs.readFileSync(a)
      catalog.validateCatalog(JSON.parse(bytes.toString('utf8')), { allowFileUrls })
      fs.writeFileSync(`${a}.sig`, `${catalog.signBytes(bytes, fs.readFileSync(b, 'utf8'))}\n`)
      console.log(`Signed ${a} -> ${a}.sig. Publish both files byte-for-byte.`)
      return
    }
    case 'verify': {
      if (!a || !b) throw new Error(usage)
      const bytes = fs.readFileSync(a)
      if (!catalog.verifyBytes(bytes, fs.readFileSync(`${a}.sig`, 'utf8'), fs.readFileSync(b, 'utf8'))) throw new Error('Signature does NOT match')
      const parsed = catalog.validateCatalog(JSON.parse(bytes.toString('utf8')), { allowFileUrls })
      console.log(`OK: "${parsed.name}" with ${parsed.packages.length} package(s), ${parsed.prerequisites.length} prerequisite(s)`)
      return
    }
    default:
      throw new Error(usage)
  }
}

try { main(process.argv.slice(2).filter(arg => arg !== '--allow-file-urls')) } catch (error) { console.error(error.message); process.exit(1) }
