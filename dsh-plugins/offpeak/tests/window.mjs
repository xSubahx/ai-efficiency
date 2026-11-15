/**
 * Off-peak calendar logic: the peak windows, the boundary computation, and the
 * preference resolution. Pure functions, fixed instants, no React.
 *
 * Riyadh is UTC+3 all year, so local wall-clock instants are written with an
 * explicit `+03:00` offset and the parser handles the rest.
 *
 * Run with `node tests/window.mjs`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Point DSH_REPO at a built DeepSeek Harness checkout (and DSH_PROFILE at a profile dir).
const DSH_REPO = process.env.DSH_REPO ?? new URL('../../../../deepseek-harness', import.meta.url).pathname
const DSH_PROFILE = process.env.DSH_PROFILE ?? (process.env.HOME + '/.dsh/profiles/web')
const requireFrom = createRequire(DSH_REPO + '/packages/client/ui-jobs/')
const React = requireFrom('react')

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  .replace('return { inject, apply }', 'return { inject, apply, __test: { isPeakAt, nextOffPeakStart, describeWindows, effectiveEnabled, loadPreferences, zoneWeekday, EN } }')
let plugin
globalThis.window = { __ModuleLoader__: { load(entry) { plugin = entry.factory(() => React) } } }
new Function('window', source)(globalThis.window)
const { isPeakAt, nextOffPeakStart, describeWindows, effectiveEnabled, loadPreferences, zoneWeekday } = plugin.__test

const at = (iso) => Date.parse(iso)

// Monday 2026-11-16 anchors the weekday table.
assert.equal(zoneWeekday(at('2026-11-16T12:00:00+03:00'), 'Asia/Riyadh'), 1, '2026-11-16 must be a Monday')

// --- peak windows ---------------------------------------------------------
const cases = [
  ['Mon 03:59', '2026-11-16T03:59:00+03:00', false],
  ['Mon 04:00', '2026-11-16T04:00:00+03:00', true],
  ['Mon 05:30', '2026-11-16T05:30:00+03:00', true],
  ['Mon 06:59', '2026-11-16T06:59:00+03:00', true],
  ['Mon 07:00', '2026-11-16T07:00:00+03:00', false],
  ['Mon 08:59', '2026-11-16T08:59:00+03:00', false],
  ['Mon 09:00', '2026-11-16T09:00:00+03:00', true],
  ['Mon 12:59', '2026-11-16T12:59:00+03:00', true],
  ['Mon 13:00', '2026-11-16T13:00:00+03:00', false],
  ['Mon 23:00', '2026-11-16T23:00:00+03:00', false],
  ['Fri 10:00', '2026-11-20T10:00:00+03:00', true],
  ['Fri 13:30', '2026-11-20T13:30:00+03:00', false],
  ['Sat 05:00', '2026-11-21T05:00:00+03:00', false],
  ['Sat 10:00', '2026-11-21T10:00:00+03:00', false],
  ['Sun 10:00', '2026-11-22T10:00:00+03:00', false],
]
assert.equal(zoneWeekday(at('2026-11-20T12:00:00+03:00'), 'Asia/Riyadh'), 5, '2026-11-20 must be a Friday')
assert.equal(zoneWeekday(at('2026-11-21T12:00:00+03:00'), 'Asia/Riyadh'), 6, '2026-11-21 must be a Saturday')
for (const [label, iso, expected] of cases) {
  assert.equal(isPeakAt(at(iso)), expected, `${label} peak=${expected}`)
}

// --- next off-peak start --------------------------------------------------
assert.equal(nextOffPeakStart(at('2026-11-16T05:00:00+03:00')), at('2026-11-16T07:00:00+03:00'), 'morning window ends at 07:00')
assert.equal(nextOffPeakStart(at('2026-11-16T12:30:00+03:00')), at('2026-11-16T13:00:00+03:00'), 'midday window ends at 13:00')
assert.equal(nextOffPeakStart(at('2026-11-16T09:00:00+03:00')), at('2026-11-16T13:00:00+03:00'), 'window start defers to its own end')
assert.equal(nextOffPeakStart(at('2026-11-20T12:59:00+03:00')), at('2026-11-20T13:00:00+03:00'), 'Friday ends into the weekend')
assert.equal(nextOffPeakStart(at('2026-11-16T03:59:00+03:00')), null, 'off-peak has no boundary')
assert.equal(nextOffPeakStart(at('2026-11-16T07:30:00+03:00')), null, 'between windows is off-peak')
assert.equal(nextOffPeakStart(at('2026-11-21T05:00:00+03:00')), null, 'weekend is off-peak')
// The boundary is strictly in the future, and lands exactly on the window end.
const boundary = nextOffPeakStart(at('2026-11-16T04:00:00+03:00'))
assert.ok(boundary > at('2026-11-16T04:00:00+03:00'), 'boundary must be in the future')

// --- labels ---------------------------------------------------------------
const t = (key, params) => {
  const templates = {
    'window.range': '{start}–{end}',
    'window.separator': ', ',
  }
  const template = templates[key] ?? key
  return params === undefined ? template : template.replace(/\{(\w+)\}/g, (_, name) => String(params[name]))
}
assert.equal(describeWindows([
  { days: [1, 2, 3, 4, 5], start: 240, end: 420 },
  { days: [1, 2, 3, 4, 5], start: 540, end: 780 },
], t), 'Mon–Fri 04:00–07:00, 09:00–13:00')

// --- preference resolution ------------------------------------------------
const state = (defaultEnabled, overrides) => ({ defaultEnabled, overrides })
assert.equal(effectiveEnabled(state(true, {}), 's1'), true, 'default on applies')
assert.equal(effectiveEnabled(state(false, {}), 's1'), false, 'default off applies')
assert.equal(effectiveEnabled(state(true, { s1: false }), 's1'), false, 'override wins when off')
assert.equal(effectiveEnabled(state(false, { s1: true }), 's1'), true, 'override wins when on')
assert.equal(effectiveEnabled(state(false, { s1: true }), 's2'), false, 'other chats keep the default')

// --- persistence ----------------------------------------------------------
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
assert.deepEqual(loadPreferences(), { defaultEnabled: true, overrides: {} }, 'missing record means on by default')
globalThis.localStorage = { getItem: () => '{not json', setItem: () => {} }
assert.deepEqual(loadPreferences(), { defaultEnabled: true, overrides: {} }, 'broken JSON falls back to defaults')
globalThis.localStorage = {
  getItem: () => JSON.stringify({ defaultEnabled: false, overrides: { s1: true, s2: 'yes' } }),
  setItem: () => {},
}
assert.deepEqual(loadPreferences(), { defaultEnabled: false, overrides: { s1: true } }, 'only boolean overrides survive')

console.log('WINDOW OK')
console.log(`  ${cases.length} peak cases · boundaries · labels · preferences`)
