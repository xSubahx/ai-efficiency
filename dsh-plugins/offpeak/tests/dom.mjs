/**
 * Off-peak interaction test: mount the real components in jsdom with React DOM
 * and drive them — queue a draft from the composer control, watch the
 * confirmation, and flip the two switches.
 *
 * Run with `node tests/dom.mjs`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Point DSH_REPO at a built DeepSeek Harness checkout (and DSH_PROFILE at a profile dir).
const DSH_REPO = process.env.DSH_REPO ?? new URL('../../../../deepseek-harness', import.meta.url).pathname
const DSH_PROFILE = process.env.DSH_PROFILE ?? (process.env.HOME + '/.dsh/profiles/web')
const requireFrom = createRequire(DSH_REPO + '/packages/client/ui-jobs/')
const { JSDOM } = requireFrom('jsdom')
const React = requireFrom('react')
const ReactDOM = requireFrom('react-dom/client')
const { act } = requireFrom('react-dom/test-utils')
const h = React.createElement

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.Event = window.Event
globalThis.MouseEvent = window.MouseEvent
globalThis.getComputedStyle = window.getComputedStyle
globalThis.requestAnimationFrame = window.requestAnimationFrame
globalThis.cancelAnimationFrame = window.cancelAnimationFrame
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.localStorage = { getItem: () => null, setItem: () => {} }

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  .replace('return { inject, apply }', 'return { inject, apply, __test: { OffpeakMenuRow, OffpeakSendControl, OffpeakSettingsRow } }')
let plugin
globalThis.window.__ModuleLoader__ = { load(entry) { plugin = entry.factory(() => React) } }
new Function('window', source)(globalThis.window)
const t = (key, params) => {
  const templates = {
    'menu.label': 'Off-peak only',
    'menu.state.peak': 'Peak now — sends can wait until {time}',
    'menu.state.offpeak': 'Off-peak now — sends go immediately',
    'menu.state.off': 'Sends go immediately',
    'menu.switchLabel': 'Off-peak only for this chat',
    'menu.description': 'During peak hours…',
    'send.action': 'Send at {time}',
    'send.title': 'Queue this prompt for the next off-peak window',
    'send.disabledAttachments': 'Attachments can’t be queued for off-peak',
    'send.disabledCommand': 'Commands run immediately',
    'send.disabledBusy': 'Wait for the current send to finish',
    'send.queued': 'Queued for {time}',
    'send.failed': 'Could not queue this prompt',
    'settings.title': 'Off-peak only',
    'settings.description': 'Weekday peak hours are {windows} ({zone}).',
    'settings.status.peak': 'Peak right now · next off-peak at {time}',
    'settings.status.offpeak': 'Off-peak right now',
    'settings.switchLabel': 'Off-peak only by default',
    'settings.on': 'On',
    'settings.off': 'Off',
    'window.range': '{start}–{end}',
    'window.separator': ', ',
  }
  const template = templates[key] ?? key
  return params === undefined ? template : template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))
}

// --- fake preference store with real subscriptions -----------------------
function createStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    set: (next) => { snapshot = next; for (const listener of [...listeners]) listener() },
  }
}
const prefs = createStore({ defaultEnabled: true, overrides: {} })
const useOffpeak = (selector) => React.useSyncExternalStore(
  (notify) => prefs.subscribe(notify),
  () => selector(prefs.getSnapshot()),
)

// --- fake composer input -------------------------------------------------
const input = createStore({ draft: 'Write the weekly digest.', phase: 'plain', attachmentIds: [] })
const draftsWritten = []
const inputActions = {
  setDraft: (text) => {
    draftsWritten.push(text)
    const current = input.getSnapshot()
    input.set({ ...current, draft: text })
  },
  persistDraft: () => {},
}
const useInput = (selector) => React.useSyncExternalStore(
  (notify) => input.subscribe(notify),
  () => selector(input.getSnapshot()),
)
const useSession = (selector) => selector({ subagent: null })

// --- fixed clock: Monday 05:00 Riyadh (peak) ----------------------------
const realNow = Date.now
Date.now = () => Date.parse('2026-11-16T05:00:00+03:00')

// --- actions under test --------------------------------------------------
const calls = []
let queueResult = { ok: true, at: Date.parse('2026-11-16T07:00:00+03:00') }
const actions = {
  queue: async (request) => { calls.push(['queue', request]); return queueResult },
  toggleSession: (sessionId) => { calls.push(['toggleSession', sessionId]) },
  setDefault: (enabled) => { calls.push(['setDefault', enabled]) },
}

const container = document.getElementById('root')
const root = ReactDOM.createRoot(container)
const button = (label) => [...container.querySelectorAll('button')].find((node) => (node.textContent ?? '').includes(label))
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) }) }

// --- composer control: queue --------------------------------------------
await act(async () => {
  root.render(h(plugin.__test.OffpeakSendControl, {
    sessionId: 'sess-1', t, useInput, inputActions, useSession, useOffpeak, actions,
  }))
})
await flush()
const send = button('Send at 07:00')
assert.ok(send, 'composer control missing')
assert.equal(send.disabled, false, 'control must be enabled for a plain draft')

await act(async () => { send.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush()
assert.deepEqual(calls.at(-1), ['queue', { sessionId: 'sess-1', text: 'Write the weekly digest.' }])
assert.deepEqual(draftsWritten, [''])
assert.match(container.textContent ?? '', /Queued for 07:00/, 'confirmation missing after queueing')
assert.equal(button('Queued for 07:00')?.disabled, true, 'after clearing, the control must be inert')

// --- composer control: failure keeps the draft --------------------------
await act(async () => { input.set({ draft: 'Another prompt', phase: 'plain', attachmentIds: [] }) })
queueResult = { ok: false, message: 'schedule/input-invalid' }
await flush()
const retry = button('Send at 07:00')
assert.ok(retry, 'control missing for the second attempt')
await act(async () => { retry.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush()
assert.match(container.textContent ?? '', /Could not queue this prompt/, 'failure label missing')
assert.equal(input.getSnapshot().draft, 'Another prompt', 'a failed queue must keep the draft')

// --- menu row switch ----------------------------------------------------
await act(async () => {
  root.render(h(plugin.__test.OffpeakMenuRow, { sessionId: 'sess-1', t, useOffpeak, actions }))
})
await flush()
const menuSwitch = container.querySelector('.ofp-switch')
assert.ok(menuSwitch, 'menu switch missing')
assert.equal(menuSwitch.getAttribute('aria-checked'), 'true')
await act(async () => { menuSwitch.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush()
assert.deepEqual(calls.at(-1), ['toggleSession', 'sess-1'])

// --- settings row switch ------------------------------------------------
await act(async () => {
  root.render(h(plugin.__test.OffpeakSettingsRow, { t, useOffpeak, actions }))
})
await flush()
const settingsSwitch = container.querySelector('.ofp-switch')
assert.ok(settingsSwitch, 'settings switch missing')
await act(async () => { settingsSwitch.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush()
assert.deepEqual(calls.at(-1), ['setDefault', false])

await act(async () => { root.unmount() })
Date.now = realNow
console.log('DOM OK')
console.log(`  calls: ${calls.map(([name]) => name).join(', ')}`)
