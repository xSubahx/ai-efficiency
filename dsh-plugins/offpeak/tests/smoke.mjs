/**
 * Off-peak registration + render smoke test: applies the module against a fake
 * client context, asserts the three slot registrations, renders each component
 * with server rendering at fixed instants, and checks the schedule write shape.
 *
 * Run with `node tests/smoke.mjs`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Point DSH_REPO at a built DeepSeek Harness checkout (and DSH_PROFILE at a profile dir).
const DSH_REPO = process.env.DSH_REPO ?? new URL('../../../../deepseek-harness', import.meta.url).pathname
const DSH_PROFILE = process.env.DSH_PROFILE ?? (process.env.HOME + '/.dsh/profiles/web')
const requireFrom = createRequire(DSH_REPO + '/packages/client/ui-jobs/')
const React = requireFrom('react')
const { renderToString } = requireFrom('react-dom/server')
const h = React.createElement

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  .replace('return { inject, apply }', 'return { inject, apply, __test: { OffpeakMenuRow, OffpeakSendControl, OffpeakSettingsRow, EN, CSS } }')
let plugin
globalThis.window = { __ModuleLoader__: { load(entry) { plugin = entry.factory(() => React) } } }
globalThis.localStorage = { getItem: () => null, setItem: () => {} }
new Function('window', source)(globalThis.window)

// --- fake client context -------------------------------------------------
const calls = []
let dictionary = null
const registrations = []
const remote = {
  schedule: {
    create: async (request) => { calls.push(['schedule.create', request]); return { ok: true, value: {} } },
  },
}
const declared = new Set(plugin.inject)
const remoteProxy = new Proxy(remote, {
  get(target, property, receiver) {
    if (typeof property === 'string' && property === 'schedule' && !declared.has('remote.schedule')) {
      throw new Error('cannot get property "remote.schedule" without inject')
    }
    return Reflect.get(target, property, receiver)
  },
})
const ctx = {
  effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
  get: () => undefined,
  locale: {
    register: (ns, locale, dict) => { dictionary = dict; return () => {} },
    bind: () => (key, params) => {
      const template = dictionary?.[key] ?? key
      return params === undefined ? template : template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))
    },
  },
  slots: {
    inject: (owner, callback) => { const dispose = callback(); return () => { if (typeof dispose === 'function') dispose() } },
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
  remote: remoteProxy,
}
plugin.apply(ctx)

assert.deepEqual(plugin.inject, ['slots', 'locale', 'remote', 'remote.schedule'])
const bySlot = (slot) => registrations.find((entry) => entry.options.name === slot)
assert.equal(registrations.length, 3, 'three contributions')
assert.equal(bySlot('conversation.input.model.options')?.options.id, 'offpeak')
assert.equal(bySlot('conversation.input.right')?.options.id, 'offpeak-send')
assert.equal(bySlot('settings.general.item')?.options.id, 'offpeak')
assert.ok(dictionary !== null && dictionary['menu.label'] === 'Off-peak only')

const t = ctx.locale.bind()
const injected = bySlot('conversation.input.right').options.inject()
const store = injected.hooks.offpeak
const actions = injected.actions
const useOffpeak = (selector) => selector(store.getSnapshot())
const inputOf = (draft, extra = {}) => (selector) => selector({ draft, phase: 'plain', attachmentIds: [], ...extra })
const useSession = (selector) => selector({ subagent: null })

// --- fixed clock ---------------------------------------------------------
const realNow = Date.now
const setClock = (iso) => { const instant = Date.parse(iso); Date.now = () => instant }
const restoreClock = () => { Date.now = realNow }

// --- menu row ------------------------------------------------------------
setClock('2026-11-16T05:00:00+03:00') // Monday peak
const menuOn = renderToString(h(plugin.__test.OffpeakMenuRow, {
  sessionId: 'sess-1', t, useOffpeak, actions,
}))
assert.match(menuOn, /Off-peak only/)
assert.match(menuOn, /Peak now/, 'peak state missing')
assert.match(menuOn, /07:00/, 'next off-peak time missing from the menu state')
assert.match(menuOn, /aria-checked="true"/, 'switch should be on by default')

actions.toggleSession('sess-1')
assert.equal(store.getSnapshot().overrides['sess-1'], false, 'toggle must persist the chat override')
const menuOff = renderToString(h(plugin.__test.OffpeakMenuRow, { sessionId: 'sess-1', t, useOffpeak, actions }))
assert.match(menuOff, /Sends go immediately/)
assert.match(menuOff, /aria-checked="false"/)
actions.toggleSession('sess-1')

// --- composer control ----------------------------------------------------
const sendProps = (draft, extra) => ({
  sessionId: 'sess-1',
  t,
  useInput: inputOf(draft, extra),
  inputActions: { setDraft: () => {}, persistDraft: () => {} },
  useSession,
  useOffpeak,
  actions,
})

const enPeak = renderToString(h(plugin.__test.OffpeakSendControl, sendProps('Write the weekly digest.')))
assert.match(enPeak, /Send at 07:00/, 'composer control missing its boundary label')
assert.doesNotMatch(enPeak, /disabled=""/, 'a draft with no attachments must be queueable')

const emptyPeak = renderToString(h(plugin.__test.OffpeakSendControl, sendProps('   ')))
assert.match(emptyPeak, /disabled/, 'an empty draft must not be queueable')

const withAttachment = renderToString(h(plugin.__test.OffpeakSendControl, sendProps('Look at this', { attachmentIds: ['a1'] })))
assert.match(withAttachment, /disabled/, 'attachments cannot be queued')
assert.match(withAttachment, /Attachments can’t be queued for off-peak/, 'attachment explanation missing')

const command = renderToString(h(plugin.__test.OffpeakSendControl, sendProps('/compact')))
assert.match(command, /disabled/, 'commands cannot be queued')

setClock('2026-11-16T07:30:00+03:00') // Monday off-peak
assert.equal(
  renderToString(h(plugin.__test.OffpeakSendControl, sendProps('Write the weekly digest.'))),
  '',
  'the control must disappear when sends are already immediate',
)
setClock('2026-11-16T05:00:00+03:00')
actions.toggleSession('sess-1')
assert.equal(
  renderToString(h(plugin.__test.OffpeakSendControl, sendProps('Write the weekly digest.'))),
  '',
  'the control must disappear when the chat switched the mode off',
)
actions.toggleSession('sess-1')

// --- settings row --------------------------------------------------------
const settingsHtml = renderToString(h(plugin.__test.OffpeakSettingsRow, { t, useOffpeak, actions }))
assert.match(settingsHtml, /Off-peak only/)
assert.match(settingsHtml, /Mon–Fri 04:00–07:00, 09:00–13:00/, 'peak windows must be stated')
assert.match(settingsHtml, /Asia\/Riyadh/)
assert.match(settingsHtml, /Peak right now/, 'settings status must report peak')
assert.match(settingsHtml, /aria-checked="true"/)

// --- schedule write ------------------------------------------------------
const ok = await actions.queue({ sessionId: 'sess-1', text: 'Write the weekly digest.' })
assert.deepEqual(ok, { ok: true, at: Date.parse('2026-11-16T07:00:00+03:00') })
const [, request] = calls.at(-1)
assert.equal(request.prompt, 'Write the weekly digest.')
assert.equal(request.title, 'Write the weekly digest.')
assert.deepEqual(request.timing, { kind: 'at', at: { date: '2026-11-16', time: '07:00:00', time_zone: 'Asia/Riyadh' } })
assert.deepEqual(request.target, { kind: 'session', sessionId: 'sess-1' })

setClock('2026-11-19T22:00:00+03:00') // Thursday night, off-peak
assert.deepEqual(await actions.queue({ sessionId: 'sess-1', text: 'x' }), { ok: false, message: 'off-peak-now' })

setClock('2026-11-16T06:59:20+03:00') // twenty seconds before the boundary
assert.deepEqual(await actions.queue({ sessionId: 'sess-1', text: 'x' }), { ok: false, message: 'off-peak-now' },
  'a boundary closer than a minute is not worth queueing')

remote.schedule.create = async () => { throw Object.assign(new Error('nope'), { code: 'schedule/input-invalid' }) }
setClock('2026-11-16T05:00:00+03:00')
assert.deepEqual(await actions.queue({ sessionId: 'sess-1', text: 'x' }), { ok: false, message: 'schedule/input-invalid' })

restoreClock()
console.log('SMOKE OK')
console.log(`  registrations: ${registrations.map((entry) => entry.options.name).join(', ')}`)
