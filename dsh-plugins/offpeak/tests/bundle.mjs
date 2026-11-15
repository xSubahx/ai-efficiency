/**
 * Bundle contract test: what the Loader and the client module registry read
 * before any plugin code runs, plus resolution through the installed profile.
 *
 * Run with `node tests/bundle.mjs`.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const here = new URL('./', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('../package.json', here), 'utf8'))
const read = (relative) => readFileSync(new URL(relative, here), 'utf8')
const pkgName = pkg.name

assert.equal(pkg.type, 'module')
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (subpath.includes('*')) continue
  assert.ok(existsSync(new URL(`..${target.replace(/^\./, '')}`, here)), `exports '${subpath}' points at a missing file`)
}
for (const required of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'docs/DETAIL.md']) {
  assert.ok(existsSync(new URL(`../${required}`, here)), `missing ${required}`)
}
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'locale/*.json', 'docs', 'icon.svg']) {
  assert.ok((pkg.files ?? []).includes(entry), `package.json files must ship ${entry}`)
}

const client = pkg.dsh?.client
assert.equal(client?.platform, 'web')
assert.equal(client?.immediately, true)
assert.ok(Array.isArray(client?.inject))
assert.ok(client.inject.every((entry) => typeof entry === 'string'))
assert.equal(client.external, undefined)

// Point DSH_REPO at a built DeepSeek Harness checkout (and DSH_PROFILE at a profile dir).
const DSH_REPO = process.env.DSH_REPO ?? new URL('../../../../deepseek-harness', import.meta.url).pathname
const DSH_PROFILE = process.env.DSH_PROFILE ?? (process.env.HOME + '/.dsh/profiles/web')
const requireFromRepo = createRequire(DSH_REPO + '/apps/cli/')
const yaml = requireFromRepo('js-yaml')
const patch = yaml.load(read('../cordis.patch.yml'))
const insert = patch.find((operation) => operation?.insert !== undefined)
assert.equal(insert.insert.length, 1)
assert.equal(insert.insert[0].name, pkgName)
assert.equal(insert.insert[0].id, pkgName)

const artifact = read('../client.js')
const header = artifact.match(/window\.__ModuleLoader__\.load\(\{\s*id: '([^']+)'/)
assert.equal(header?.[1], pkgName, 'the module id must equal the package name')
assert.match(artifact, /\n\s*factory\(require\)/)
assert.match(artifact, /return \{ inject, apply \}/)

const iconBytes = statSync(new URL('../icon.svg', here)).size
assert.ok(iconBytes < 256 * 1024)
assert.match(read('../icon.svg').slice(0, 200), /^<svg[\s>]/)
for (const locale of ['en', 'zh']) {
  const dictionary = JSON.parse(read(`../locale/${locale}.json`))
  assert.equal(typeof dictionary.meta?.title, 'string')
  assert.equal(typeof dictionary.meta?.description, 'string')
  assert.equal(dictionary.meta?.detail, 'docs/DETAIL.md')
}
assert.ok(statSync(new URL('../docs/DETAIL.md', here)).size < 1024 * 1024)

let installed = false
try {
  requireFromRepo('fs').accessSync(DSH_PROFILE + '/node_modules/' + pkgName)
  installed = true
} catch { installed = false }
if (installed) {
  const requireFromProfile = createRequire(DSH_PROFILE + '/')
  assert.equal(requireFromProfile.resolve(pkgName), new URL('../index.js', here).pathname, 'the profile must resolve this directory')
  assert.equal(requireFromProfile.resolve(`${pkgName}/client`), new URL('../client.js', here).pathname)
  const host = await import(pathToFileURL(requireFromProfile.resolve(pkgName)).href)
  assert.equal(typeof host.apply, 'function', 'the Host half must export apply()')
  assert.equal(host.default, undefined)
}

console.log('BUNDLE OK')
console.log(`  ${pkgName}@${pkg.version} · artifact ${artifact.length} bytes · icon ${iconBytes} bytes · installed: ${installed}`)
