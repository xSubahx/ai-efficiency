/**
 * Bundle contract test: everything the Loader and the client module registry
 * read before a single line of plugin code runs, checked against the rules the
 * running Harness enforces. The package is resolved through the *installed
 * profile* so this also proves the installed link is intact.
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
const fail = (message) => { throw new Error(message) }

// --- manifest ------------------------------------------------------------
assert.equal(pkg.type, 'module', 'the bundle must be ESM')
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'dsh.bundle.patch missing')
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (subpath.includes('*')) continue
  assert.ok(existsSync(new URL(`..${target.replace(/^\./, '')}`, here)), `exports '${subpath}' points at a missing file: ${target}`)
}
assert.ok(pkg.exports['./client'], 'the client subpath export is required for the browser half')
assert.ok(pkg.exports['./locale/*.json'], 'locale exports are required for display metadata')
assert.ok(pkg.exports['./icon'], 'icon export is required for display metadata')
for (const required of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'docs/DETAIL.md']) {
  assert.ok(existsSync(new URL(`../${required}`, here)), `missing ${required}`)
}
const files = pkg.files ?? []
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'locale/*.json', 'docs', 'icon.svg']) {
  assert.ok(files.includes(entry), `package.json files must ship ${entry}`)
}

// --- client declaration --------------------------------------------------
const client = pkg.dsh?.client
assert.ok(client !== undefined, 'dsh.client declaration missing')
assert.equal(typeof client.platform, 'string', 'dsh.client.platform must be a string')
assert.equal(client.platform, 'web', 'this bundle targets the web surface')
assert.ok(client.immediately === true, 'the panel must load in the first boot stage')
assert.ok(Array.isArray(client.inject), 'dsh.client.inject must be a string array')
for (const entry of client.inject) assert.equal(typeof entry, 'string', 'dsh.client.inject entries must be strings')
assert.ok(client.external === undefined, 'this client module needs no extra module-table imports')

// --- loader patch --------------------------------------------------------
// Point DSH_REPO at a built DeepSeek Harness checkout (and DSH_PROFILE at a profile dir).
const DSH_REPO = process.env.DSH_REPO ?? new URL('../../../../deepseek-harness', import.meta.url).pathname
const DSH_PROFILE = process.env.DSH_PROFILE ?? (process.env.HOME + '/.dsh/profiles/web')
const requireFromRepo = createRequire(DSH_REPO + '/apps/cli/')
const yaml = requireFromRepo('js-yaml')
const patch = yaml.load(read('../cordis.patch.yml'))
assert.ok(Array.isArray(patch), 'the patch must be a list of loader operations')
const insert = patch.find((operation) => operation?.insert !== undefined)
assert.ok(insert !== undefined, 'the patch must insert a row')
const rows = insert.insert
assert.equal(rows.length, 1, 'this bundle inserts exactly one row')
assert.equal(rows[0].name, pkg.name, 'the row must name this package')
assert.equal(rows[0].id, pkg.name, 'the row id should be the package name')

// --- browser artifact ----------------------------------------------------
const artifact = read('../client.js')
const header = artifact.match(/window\.__ModuleLoader__\.load\(\{\s*id: '([^']+)'/)
assert.ok(header, 'client.js must register through window.__ModuleLoader__.load')
assert.equal(header[1], pkg.name, 'the module id must equal the package name')
assert.match(artifact, /\n\s*factory\(require\)/)
assert.match(artifact, /return \{ inject, apply \}/, 'the factory must return the plugin object')
assert.equal((artifact.match(/require\('react'\)/g) ?? []).length, 1, 'React is the only module-table import')

// --- display resources ---------------------------------------------------
const iconBytes = statSync(new URL('../icon.svg', here)).size
assert.ok(iconBytes < 256 * 1024, `icon is ${iconBytes} bytes; the limit is 256 KiB`)
assert.match(read('../icon.svg').slice(0, 200), /^<svg[\s>]/, 'the icon must be an SVG document')
for (const locale of ['en', 'zh']) {
  const dictionary = JSON.parse(read(`../locale/${locale}.json`))
  assert.equal(typeof dictionary.meta?.title, 'string', `locale/${locale}.json needs meta.title`)
  assert.equal(typeof dictionary.meta?.description, 'string', `locale/${locale}.json needs meta.description`)
  assert.equal(dictionary.meta?.detail, 'docs/DETAIL.md', `locale/${locale}.json meta.detail must name the detail document`)
}
const detailBytes = statSync(new URL('../docs/DETAIL.md', here)).size
assert.ok(detailBytes < 1024 * 1024, `the detail document is ${detailBytes} bytes; the limit is 1 MiB`)

// --- installed resolution ------------------------------------------------
const requireFromProfile = createRequire(DSH_PROFILE + '/')
const entryPath = requireFromProfile.resolve(pkg.name)
assert.equal(entryPath, new URL('../index.js', here).pathname, 'the profile must resolve this directory')
const clientPath = requireFromProfile.resolve(`${pkg.name}/client`)
assert.equal(clientPath, new URL('../client.js', here).pathname, 'the profile must resolve the client half')
const host = await import(pathToFileURL(entryPath).href)
assert.equal(typeof host.apply, 'function', 'the Host half must export apply()')
assert.equal(host.default, undefined, 'a Host plugin must export one form, not a default class')

console.log('BUNDLE OK')
console.log(`  ${pkg.name}@${pkg.version} resolves from the web profile`)
console.log(`  artifact ${artifact.length} bytes · icon ${iconBytes} bytes · detail ${detailBytes} bytes`)
