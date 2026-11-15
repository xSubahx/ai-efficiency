/**
 * Offline smoke test for the Async client module: load the built artifact with
 * a stub loader, run apply() against a fake client context, and render each
 * component with server rendering. Catches runtime errors before an install
 * cycle. Run with `node tests/smoke.mjs`.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

// Point DSH_REPO at a built DeepSeek Harness checkout (and DSH_PROFILE at a profile dir).
const DSH_REPO = process.env.DSH_REPO ?? new URL('../../../../deepseek-harness', import.meta.url).pathname
const DSH_PROFILE = process.env.DSH_PROFILE ?? (process.env.HOME + '/.dsh/profiles/web')
const requireFrom = createRequire(DSH_REPO + '/packages/client/ui-jobs/')
const React = requireFrom('react')
const { renderToString } = requireFrom('react-dom/server')
const h = React.createElement

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  // Test-only: expose the component table the production factory keeps private.
  .replace('return { inject, apply }', 'return { inject, apply, __test: { Panel, Timeline, CreateForm, Board, buildBoard, EN, CSS } }')

let plugin
const windowStub = {
  __ModuleLoader__: {
    load(entry) {
      plugin = entry.factory((name) => {
        if (name === 'react') return React
        throw new Error(`unexpected require: ${name}`)
      })
    },
  },
}
new Function('window', source)(windowStub)
assert.ok(plugin !== undefined, 'module registered no plugin')
assert.deepEqual(plugin.inject.slice(0, 3), ['slots', 'locale', 'layout'])

// --- fake data -------------------------------------------------------------

const now = Date.now()
const sessionId = 's-running'
const childId = 's-child'
const roster = {
  ids: [sessionId, childId],
  byId: {
    [sessionId]: {
      id: sessionId, displayTitle: 'Ship the async board', running: true, blank: false,
      updatedAt: now - 60000, cwd: '/work/dsh-async',
      retainedBy: {}, projectionsBySession: {},
    },
    [childId]: {
      id: childId, displayTitle: 'Reviewer', running: false, blank: false, updatedAt: now - 120000,
      parentId: sessionId, origin: 'subagent', cwd: '/work/dsh-async', retainedBy: {},
    },
  },
  phase: 'ready',
  projectionsBySession: {
    [sessionId]: { values: { modelSelection: { next: { provider: 'dgx-spark', model: 'spark-dual' }, lastUsed: null }, agentTeam: { enabled: true, tasks: [{ id: 't1', subject: 'Write tests', status: 'in_progress' }] } } },
  },
}
const statuses = new Map([
  [sessionId, { running: true, pendingInteraction: undefined, completionUnread: false }],
  [childId, { running: false, pendingInteraction: { kind: 'approval', sessionId: childId, key: 'k' }, completionUnread: false }],
])
const jobs = {
  rows: {
    [sessionId]: [{ id: 'bash-1', kind: 'bash', label: 'pnpm build', status: 'running', startedAt: now - 30000, progress: 'bundling', output: { total: 10, earliest: 0 } }],
  },
  observed: {},
}
const schedules = [
  {
    id: 'sch-1', kind: 'every', title: 'Digest the inbox', prompt: 'Summarize', everySeconds: 900,
    scheduledAt: new Date(now + 300000).toISOString(), status: 'active',
    target: { kind: 'session', sessionId }, createdAt: new Date(now - 86400000).toISOString(),
    lastDelivery: { scheduledAt: new Date(now - 600000).toISOString(), deliveredAt: new Date(now - 599000).toISOString(), messageId: 'm', targetSessionId: sessionId },
  },
  {
    id: 'sch-2', kind: 'daily', title: 'Morning brief', prompt: 'Brief', time: '09:00:00', timeZone: 'Asia/Riyadh',
    scheduledAt: new Date(now + 3600000).toISOString(), status: 'paused', target: { kind: 'new' },
    updatedAt: new Date(now - 5000).toISOString(),
  },
  {
    id: 'sch-3', kind: 'at', title: 'One-off cleanup', prompt: 'Clean', scheduledAt: new Date(now - 400000).toISOString(),
    status: 'ended', target: { kind: 'new_once', sessionId: 's-new' },
    lastDelivery: { scheduledAt: new Date(now - 400000).toISOString(), deliveredAt: new Date(now - 399000).toISOString(), messageId: 'm2', targetSessionId: 's-new' },
  },
]
const workspaces = {
  items: [{ workspaceId: 'ws-1', title: 'deepseek-harness', path: DSH_REPO, sessionIds: [sessionId, childId], createdAt: '', updatedAt: '' }],
  archivedSessionIds: [],
  pinnedSessionIds: [],
}



// --- fake client context ---------------------------------------------------

let dictionary = null
let panelRegistration = null
const registrations = []
const storeSnapshot = () => ({})
const inert = (value) => ({ getSnapshot: () => value, subscribe: () => () => {} })

const remote = {
  $on: () => () => {},
  session: {
    modelCatalog: async () => ({ ok: true, value: { default: { provider: 'deepseek-account', model: 'deepseek-chat' }, routableProviders: ['deepseek-account', 'dgx-spark'], groups: [{ id: 'deepseek-account', name: 'DeepSeek', models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] }, { id: 'dgx-spark', name: 'DGX Spark (local)', models: [{ id: 'spark-dual', name: 'Spark Dual' }] }], failures: [] } }),
    create: async () => ({ ok: true, value: { sessionId: 's-created' } }),
    rename: async () => ({ ok: true, value: {} }),
    selectModel: async () => ({ ok: true, value: {} }),
    prompt: async () => ({ ok: true, value: { accepted: true } }),
    cancel: async () => ({ ok: true, value: {} }),
  },
  schedule: {
    catalog: async () => ({ ok: true, value: schedules }),
    history: async () => ({ ok: true, value: { records: [{ scheduledAt: new Date(now - 600000).toISOString(), deliveredAt: new Date(now - 599000).toISOString() }], retention: {}, earlierRecordsUnavailable: false, earlierRecordsPruned: false } }),
    create: async () => ({ ok: true, value: schedules[0] }),
    edit: async () => ({ ok: true, value: schedules[0] }),
    run: async () => ({ ok: true, value: schedules[0] }),
  },
  workspace: { follow: () => ({ [Symbol.asyncIterator]: async function* () { yield { type: 'baseline', value: workspaces } } }) },
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

const services = {
  sessions: { list: inert(roster) },
  uiSession: { sessionStatus: inert(statuses) },
  uiWorkspace: { openSession: () => {} },
  jobs: {
    state: inert(jobs),
    watchRows: () => () => {},
    kill: async () => ({ ok: true, value: { outcome: 'requested' } }),
  },
  layout: { selectPanel: () => {} },
}

const ctx = {
  effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
  get: (name) => services[name],
  locale: {
    register: (ns, locale, dict) => { dictionary = dict; return () => {} },
    bind: () => (key, params) => {
      const template = dictionary?.[key] ?? key
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (_, name) => (params[name] === undefined ? `{${name}}` : String(params[name])))
    },
  },
  slots: {
    inject: (owner, callback) => { const dispose = callback(); return () => { if (typeof dispose === 'function') dispose() } },
    register: (options, component) => {
      registrations.push({ options, component })
      if (options.name === 'main') panelRegistration = { options, component }
      return () => {}
    },
  },
  remote: remoteProxy,
}

plugin.apply(ctx)
assert.ok(panelRegistration !== null, 'main panel not registered')
assert.equal(panelRegistration.options.key, 'async')
assert.ok(registrations.some((entry) => entry.options.name === 'sidebar.panellist' && entry.options.id === 'async'))
assert.ok(dictionary !== null && dictionary['panel.title'] === 'Async', 'dictionary missing')

// --- render ----------------------------------------------------------------

const t = ctx.locale.bind()
const injected = panelRegistration.options.inject()
const useFrom = (observable) => (selector) => (selector === undefined ? observable.getSnapshot() : selector(observable.getSnapshot()))

// Server rendering never runs effects, so drive the panel's entry action the
// way a mounted panel would, then let its reads settle.
injected.actions.enter()
await new Promise((resolve) => setTimeout(resolve, 150))

const panelProps = {
  ...injected,
  ...injected,
  useAsync: useFrom(injected.hooks.async),
  useRoster: useFrom(injected.hooks.roster),
  useStatus: useFrom(injected.hooks.status),
  useJobs: useFrom(injected.hooks.jobs),
  t,
}
const boardHtml = renderToString(h(panelRegistration.component, panelProps))
assert.ok(boardHtml.includes('Upcoming'), 'board has no Upcoming column')
assert.ok(boardHtml.includes('Digest the inbox'), 'schedule card missing')
assert.ok(boardHtml.includes('Ship the async board'), 'session card missing')
assert.ok(boardHtml.includes('pnpm build'), 'job card missing')
assert.ok(boardHtml.includes('Write tests'), 'team task row missing')
assert.ok(boardHtml.includes('Needs you'), 'needs column missing')

// Timeline: give it the projection the panel builds internally.
const board = plugin.__test.buildBoard({
  now, roster, statuses, jobs, watched: new Set([sessionId]), schedules,
  workspaces, groups: [], ran: {}, hidden: new Set(), t,
})
assert.equal(board.byColumn.upcoming.length, 1)
assert.ok(board.byColumn.running.length >= 2)
assert.equal(board.byColumn.needs.length, 1)
assert.ok(board.byColumn.settled.length >= 1)
const timelineHtml = renderToString(h(plugin.__test.Timeline, {
  board,
  data: {
    schedules, workspaces, groups: [], history: { 'sch-1': [{ deliveredAt: new Date(now - 599000).toISOString(), scheduledAt: new Date(now - 600000).toISOString() }] },
    ran: {}, hidden: new Set(), notice: null, status: 'ready',
  },
  t, selected: null, onSelect: () => {}, actions: injected.actions, now,
}))
assert.ok(timelineHtml.includes('Schedules'), 'timeline lane missing')
assert.ok(timelineHtml.includes('Digest the inbox'), 'timeline row missing')

// Creation form: exercise every timing branch without submitting.
const formHtml = renderToString(h(plugin.__test.CreateForm, {
  actions: injected.actions,
  data: { groups: [{ id: 'dgx-spark', name: 'DGX Spark (local)', models: [{ id: 'spark-dual', name: 'Spark Dual' }] }], workspaces: workspaces.items },
  t,
  onClose: () => {},
}))
assert.ok(formHtml.includes('What should the agent do?'), 'create form missing')

console.log('SMOKE OK')
console.log(`  board html: ${boardHtml.length} bytes`)
console.log(`  timeline html: ${timelineHtml.length} bytes`)
console.log(`  form html: ${formHtml.length} bytes`)
console.log(`  columns: upcoming=${board.byColumn.upcoming.length} running=${board.byColumn.running.length} needs=${board.byColumn.needs.length} settled=${board.byColumn.settled.length}`)

// --- operation wire shapes -------------------------------------------------
// The UI must call the documented Remote methods with the documented request
// shapes; record every call and assert the payloads.
const calls = []
remote.schedule.create = async (request) => { calls.push(['schedule.create', request]); return { ok: true, value: schedules[0] } }
remote.schedule.edit = async (request) => { calls.push(['schedule.edit', request]); return { ok: true, value: schedules[0] } }
remote.schedule.run = async (request) => { calls.push(['schedule.run', request]); return { ok: true, value: schedules[0] } }
remote.schedule.history = async (request) => { calls.push(['schedule.history', request]); return { ok: true, value: { records: [], retention: {}, earlierRecordsUnavailable: false, earlierRecordsPruned: false } } }
remote.session.create = async (request) => { calls.push(['session.create', request]); return { ok: true, value: { sessionId: 's-made' } } }
remote.session.rename = async (request) => { calls.push(['session.rename', request]); return { ok: true, value: {} } }
remote.session.selectModel = async (request) => { calls.push(['session.selectModel', request]); return { ok: true, value: { selected: request } } }
remote.session.prompt = async (request) => { calls.push(['session.prompt', request]); return { ok: true, value: { accepted: true } } }
remote.session.cancel = async (request) => { calls.push(['session.cancel', request]); return { ok: true, value: {} } }
services.uiWorkspace.openSession = (id) => { calls.push(['openSession', id]) }
services.jobs.kill = async (sid, id) => { calls.push(['killJob', { sid, id }]); return { ok: true, value: { outcome: 'requested' } } }
const last = (name) => [...calls].reverse().find(([which]) => which === name)?.[1]

const scheduleItem = board.byColumn.upcoming[0]
const sessionItem = board.byColumn.running.find((item) => item.source === 'session')
const jobItem = board.byColumn.running.find((item) => item.source === 'job')
const needsItem = board.byColumn.needs[0]

await injected.actions.act(scheduleItem, 'pause')
assert.equal(last('schedule.edit').action, 'update')
assert.equal(last('schedule.edit').patch.active, false)
await injected.actions.act(scheduleItem, 'resume')
assert.equal(last('schedule.edit').patch.active, true)
await injected.actions.act(scheduleItem, 'run')
assert.equal(last('schedule.run').id, 'sch-1')
await injected.actions.act(sessionItem, 'stop')
assert.equal(last('session.cancel').sessionId, sessionId)
await injected.actions.act(jobItem, 'kill')
assert.equal(calls.at(-1)[0], 'killJob')
await injected.actions.act(needsItem, 'open')
assert.equal(last('openSession'), childId)
await injected.actions.act(sessionItem, 'dismiss')
assert.ok(injected.hooks.async.getSnapshot().hidden.has(sessionItem.key), 'dismiss did not hide the row')

await injected.actions.act(scheduleItem, 'delete')
assert.equal(last('schedule.edit').action, 'delete')
assert.ok(injected.hooks.async.getSnapshot().hidden.has(scheduleItem.key), 'delete did not hide the row')

const createdNow = await injected.actions.create({
  title: 'Refresh the index', prompt: 'Rebuild the search index.', mode: 'now',
  timing: undefined, route: { provider: 'dgx-spark', model: 'spark-dual' }, workspaceId: 'ws-1',
})
assert.deepEqual(createdNow, { ok: true })
assert.equal(last('session.create').workspaceId, 'ws-1')
assert.equal(last('session.rename').title, 'Refresh the index')
assert.equal(last('session.selectModel').model, 'spark-dual')
assert.equal(last('session.prompt').content[0].text, 'Rebuild the search index.')
assert.equal(last('session.prompt').mode, 'queue')
assert.ok(typeof last('session.prompt').requestId === 'string')

const createdRepeat = await injected.actions.create({
  title: 'Nightly digest', prompt: 'Summarize today.', mode: 'schedule',
  timing: { kind: 'every', every_seconds: 3600 }, route: { provider: 'dgx-spark', model: 'spark-dual' }, workspaceId: undefined,
})
assert.deepEqual(createdRepeat, { ok: true })
assert.equal(last('schedule.create').timing.kind, 'every')
assert.deepEqual(last('schedule.create').target, { kind: 'session', sessionId: 's-made' })

await injected.actions.create({
  title: 'One-off clean', prompt: 'Clean up.', mode: 'schedule',
  timing: { kind: 'at', at: { date: '2026-12-01', time: '09:00:00', time_zone: 'Asia/Riyadh' } },
  route: undefined, workspaceId: 'ws-1',
})
assert.deepEqual(last('schedule.create').target, { kind: 'new_once', create: { cwd: DSH_REPO } })

const createdDaily = await injected.actions.create({
  title: 'Morning brief', prompt: 'Brief me.', mode: 'schedule',
  timing: { kind: 'daily', daily: { time: '09:00:00', time_zone: 'Asia/Riyadh' } },
  route: undefined, workspaceId: undefined,
})
assert.deepEqual(createdDaily, { ok: true })
assert.deepEqual(last('schedule.create').target, { kind: 'new' })
// Streams and history: the workspace follow baseline lands, delivery history
// caches per schedule, and a refused write surfaces as a notice.
const asyncSnapshot = injected.hooks.async.getSnapshot()
assert.equal(asyncSnapshot.workspaces.items.length, 1, 'workspace baseline missing')
assert.equal(asyncSnapshot.groups.length, 2, 'model catalog groups missing')
injected.actions.loadHistory(['sch-1'])
await new Promise((resolve) => setTimeout(resolve, 30))
assert.ok(Array.isArray(injected.hooks.async.getSnapshot().history['sch-1']), 'history not cached')

remote.schedule.create = async () => { throw Object.assign(new Error('nope'), { code: 'schedule/input-invalid' }) }
const refused = await injected.actions.create({
  title: 'Bad', prompt: 'x', mode: 'schedule',
  timing: { kind: 'every', every_seconds: 60 }, route: undefined, workspaceId: undefined,
})
assert.equal(refused.ok, false)
assert.match(refused.message, /schedule\/input-invalid/)
assert.ok(injected.hooks.async.getSnapshot().notice !== null, 'failure did not raise a notice')
injected.actions.dismissNotice()
assert.equal(injected.hooks.async.getSnapshot().notice, null)

console.log('ACTIONS OK')

// --- static previews (opt-in) ---------------------------------------------
// `PREVIEW=1 node tests/smoke.mjs` writes HTML pages that render the real
// theme stylesheet plus the panel's own CSS, for a headless screenshot.
if (process.env.PREVIEW === '1') {
  const { writeFileSync } = await import('node:fs')
  const themeDir = DSH_REPO + '/packages/client/ui-theme/src/styles/'
  const theme = ['base.css', 'design-platform.css', 'scrollbar.css']
    .map((name) => readFileSync(themeDir + name, 'utf8')).join('\n')
  const page = (body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>${theme}</style>
<style>html,body{margin:0;height:100%}body{height:100vh;display:flex;flex-direction:column}</style>
</head><body data-ds-dark-theme>${body}</body></html>`
  writeFileSync(new URL('./preview-board.html', import.meta.url), page(boardHtml))
  const createHtml = renderToString(h('div', { className: 'asx-root' },
    h('header', { className: 'asx-head' },
      h('div', { className: 'asx-headText' },
        h('div', { className: 'asx-title' }, 'Async'),
        h('div', { className: 'asx-subs' }, 'One-time and recurring work, and what is running right now'),
      ),
    ),
    h(plugin.__test.CreateForm, {
      actions: injected.actions,
      data: { groups: [{ id: 'deepseek-account', name: 'DeepSeek', models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] }, { id: 'dgx-spark', name: 'DGX Spark (local)', models: [{ id: 'spark-dual', name: 'Spark Dual' }, { id: 'minicpm', name: 'MiniCPM-V 4.7' }] }], workspaces: workspaces.items },
      t,
      onClose: () => {},
    }),
  ))
  writeFileSync(new URL('./preview-create.html', import.meta.url), page(`<style>${plugin.__test.CSS}</style>` + createHtml))
  const boardWithSpans = plugin.__test.buildBoard({
    now, roster, statuses, jobs, watched: new Set([sessionId]), schedules, workspaces, groups: [], hidden: new Set(),
    ran: { [sessionId]: { start: now - 22 * 60000, end: undefined }, [childId]: { start: now - 8 * 3600000, end: now - 6 * 3600000 } },
    t,
  })
  const timelinePage = renderToString(h('div', { className: 'asx-root' }, h(plugin.__test.Timeline, {
    board: boardWithSpans,
    data: {
      schedules, workspaces, groups: [], history: { 'sch-1': [{ deliveredAt: new Date(now - 599000).toISOString(), scheduledAt: new Date(now - 600000).toISOString() }, { deliveredAt: new Date(now - 1499000).toISOString(), scheduledAt: new Date(now - 1500000).toISOString() }] },
      ran: { [sessionId]: { start: now - 22 * 60000, end: undefined }, [childId]: { start: now - 8 * 3600000, end: now - 6 * 3600000 } }, hidden: new Set(), notice: null, status: 'ready',
    },
    t, selected: null, onSelect: () => {}, actions: injected.actions, now,
  })))
  writeFileSync(new URL('./preview-timeline.html', import.meta.url), page(`<style>${plugin.__test.CSS}</style>` + timelinePage))
  console.log('previews written')
}
