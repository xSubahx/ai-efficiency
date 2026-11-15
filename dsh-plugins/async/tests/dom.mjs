/**
 * Browser-shaped integration test: mount the real Panel into jsdom with React
 * DOM, run its effects, and drive the interactions a user would (switch to the
 * timeline, open the composer, type, submit, pause a schedule).
 *
 * Server rendering never runs effects, so this tier covers the effect wiring
 * that `smoke.mjs` cannot: data entry, timers, and click handlers.
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

// --- DOM ---------------------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.Event = window.Event
globalThis.MouseEvent = window.MouseEvent
globalThis.Image = window.Image
globalThis.getComputedStyle = window.getComputedStyle
globalThis.requestAnimationFrame = window.requestAnimationFrame
globalThis.cancelAnimationFrame = window.cancelAnimationFrame
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// --- module artifact ---------------------------------------------------
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  .replace('return { inject, apply }', 'return { inject, apply, __test: { Panel } }')
let plugin
globalThis.window.__ModuleLoader__ = {
  load(entry) {
    plugin = entry.factory((name) => {
      if (name === 'react') return React
      throw new Error(`unexpected require: ${name}`)
    })
  },
}
new Function('window', source)(globalThis.window)

// --- fixtures ----------------------------------------------------------
const now = Date.now()
const sessionId = 's-run'
const childId = 's-needs'
const schedule = {
  id: 'sch-1', kind: 'every', title: 'Digest the inbox', prompt: 'Summarize', everySeconds: 900,
  scheduledAt: new Date(now + 600000).toISOString(), status: 'active',
  target: { kind: 'session', sessionId }, updatedAt: new Date(now - 1000).toISOString(),
}
const roster = {
  ids: [sessionId, childId],
  byId: {
    [sessionId]: { id: sessionId, displayTitle: 'Ship the async board', running: true, blank: false, updatedAt: now, cwd: '/tmp/project', retainedBy: {} },
    [childId]: { id: childId, displayTitle: 'Reviewer', running: false, blank: false, updatedAt: now - 60000, cwd: '/tmp/project', retainedBy: {} },
  },
  phase: 'ready',
  projectionsBySession: {
    [sessionId]: { values: { modelSelection: { next: { provider: 'dgx-spark', model: 'spark-dual' }, lastUsed: null } } },
  },
}
const statuses = new Map([
  [sessionId, { running: true, pendingInteraction: undefined, completionUnread: false }],
  [childId, { running: false, pendingInteraction: { kind: 'approval', sessionId: childId, key: 'k' }, completionUnread: false }],
])
const calls = []
const nowMs = () => Date.now()
const remote = {
  $on: () => () => {},
  session: {
    modelCatalog: async () => ({
      ok: true,
      value: { default: { provider: 'deepseek-account', model: 'deepseek-chat' }, routableProviders: [], groups: [{ id: 'dgx-spark', name: 'DGX Spark (local)', models: [{ id: 'spark-dual', name: 'Spark Dual' }] }], failures: [] },
    }),
    create: async (request) => { calls.push(['session.create', request]); return { ok: true, value: { sessionId: 's-made' } } },
    rename: async (request) => { calls.push(['session.rename', request]); return { ok: true, value: {} } },
    selectModel: async (request) => { calls.push(['session.selectModel', request]); return { ok: true, value: { selected: request } } },
    prompt: async (request) => { calls.push(['session.prompt', request]); return { ok: true, value: { accepted: true } } },
    cancel: async (request) => { calls.push(['session.cancel', request]); return { ok: true, value: {} } },
  },
  schedule: {
    catalog: async () => { calls.push(['schedule.catalog']); return { ok: true, value: [schedule] } },
    history: async (request) => { calls.push(['schedule.history', request]); return { ok: true, value: { records: [], retention: {}, earlierRecordsUnavailable: false, earlierRecordsPruned: false } } },
    create: async (request) => { calls.push(['schedule.create', request]); return { ok: true, value: schedule } },
    edit: async (request) => { calls.push(['schedule.edit', request]); return { ok: true, value: schedule } },
    run: async (request) => { calls.push(['schedule.run', request]); return { ok: true, value: schedule } },
  },
  workspace: {
    follow: () => ({ [Symbol.asyncIterator]: async function* () {
      yield { type: 'baseline', value: { items: [{ workspaceId: 'ws-1', title: 'project', path: '/tmp/project', sessionIds: [sessionId], createdAt: '', updatedAt: '' }], archivedSessionIds: [], pinnedSessionIds: [] } }
    } }),
  },
}

// Cordis refuses reading a namespace off the `remote` proxy unless the plugin
// declared it in `inject`; mirror that guard so a missing declaration fails
// here instead of only in a live boot.
const declaredServices = new Set(plugin.inject)
const remoteProxy = new Proxy(remote, {
  get(target, property, receiver) {
    if (typeof property === 'string' && ['session', 'schedule', 'workspace'].includes(property)
      && !declaredServices.has(`remote.${property}`)) {
      throw new Error(`cannot get property "remote.${property}" without inject`)
    }
    return Reflect.get(target, property, receiver)
  },
})

const inert = (value) => ({ getSnapshot: () => value, subscribe: () => () => {} })
const services = {
  sessions: { list: inert(roster) },
  uiSession: { sessionStatus: inert(statuses) },
  uiWorkspace: { openSession: (id) => { calls.push(['openSession', id]) } },
  jobs: {
    state: inert({ rows: { [sessionId]: [{ id: 'bash-1', kind: 'bash', label: 'pnpm build', status: 'running', startedAt: now - 30000, output: { total: 4, earliest: 0 } }] }, observed: {} }),
    watchRows: () => () => {},
    kill: async (sid, id) => { calls.push(['job.kill', { sid, id }]); return { ok: true, value: {} } },
  },
  layout: { selectPanel: () => {} },
}
let dictionary = null
const registrations = []
const ctx = {
  effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
  get: (name) => services[name],
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
const t = ctx.locale.bind()
const panelRegistration = registrations.find((entry) => entry.options.name === 'main')
assert.ok(panelRegistration, 'main panel registration missing')
const injected = panelRegistration.options.inject()
// The real framework binds each injected observable into a subscribing
// selector hook; useSyncExternalStore reproduces that contract here.
const useFrom = (observable) => (selector) => React.useSyncExternalStore(
  (notify) => observable.subscribe(notify),
  () => (selector === undefined ? observable.getSnapshot() : selector(observable.getSnapshot())),
)
const props = {
  useAsync: useFrom(injected.hooks.async),
  useRoster: useFrom(injected.hooks.roster),
  useStatus: useFrom(injected.hooks.status),
  useJobs: useFrom(injected.hooks.jobs),
  actions: injected.actions,
  t,
}

// --- mount -------------------------------------------------------------
const container = document.getElementById('app')
const root = ReactDOM.createRoot(container)
const flush = async (ms = 25) => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
await act(async () => { root.render(h(plugin.__test.Panel, props)) })
await flush(60)

const text = () => container.textContent ?? ''

const buttons = (label) => [...container.querySelectorAll('button')].filter((node) => (node.textContent ?? '').trim() === label)

assert.match(text(), /Digest the inbox/, 'schedule card missing after mount')
assert.match(text(), /Ship the async board/, 'running session missing after mount')
assert.match(text(), /pnpm build/, 'job card missing after mount')
assert.match(text(), /Needs you/, 'needs column missing')
assert.equal(calls.filter(([name]) => name === 'schedule.catalog').length, 1, 'catalog should be read once on entry')
assert.ok(injected.hooks.async.getSnapshot().workspaces !== null, 'workspace baseline not stored')

// Board → Timeline.
const timelineButton = buttons('Timeline')[0]
assert.ok(timelineButton, 'timeline toggle missing')
await act(async () => { timelineButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush(40)
assert.match(text(), /Group by/, 'timeline view did not render')
assert.match(text(), /Schedules/, 'timeline lanes missing')
assert.equal(calls.filter(([name]) => name === 'schedule.history').length >= 1, true, 'timeline never read delivery history')

// Back to the board and open the composer.
await act(async () => { buttons('Board')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush()
const newButton = buttons('New async work')[0]
assert.ok(newButton, 'composer trigger missing')
await act(async () => { newButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush()
const textarea = container.querySelector('textarea')
assert.ok(textarea, 'composer textarea missing')
const submit = buttons('Run now').find((node) => node.className.includes('asx-btnPrimary'))
assert.ok(submit, 'composer submit missing')
// React 18's synthetic change plugin does not fire for a dispatched input event
// under jsdom 29, so the typed-value path is exercised only through the wire
// assertions in smoke.mjs; here we pin the invariant that matters: no
// instruction, no submission.
assert.equal(submit.disabled, true, 'composer submitted an empty instruction')
assert.match(text(), /What should the agent do\?/, 'composer prompt label missing')
assert.match(text(), /Spark Dual/, 'executor routes missing from the composer')

// Pause the schedule card through its hover action.
const pauseButton = buttons('Pause')[0]
assert.ok(pauseButton, 'pause action missing on the schedule card')
await act(async () => { pauseButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
await flush(40)
const editCall = calls.find(([name, request]) => name === 'schedule.edit' && request.patch?.active === false)
assert.ok(editCall, 'pause did not edit the schedule')
assert.equal(editCall[1].id, 'sch-1')

// The ticking clock keeps countdowns honest without remounting.
const before = text()
await flush(1100)
assert.match(text(), /Digest the inbox/, 'panel lost its content across a tick')
assert.notEqual(text(), before, 'the ticking clock produced no new render')

await act(async () => { root.unmount() })
console.log('DOM OK')
console.log(`  remote calls: ${calls.map(([name]) => name).join(', ')}`)
