/**
 * Async — Host wiring: dictionaries, data acquisition, operations, and slot
 * registration. The Host half of this bundle is a no-op; everything here runs
 * in the browser against existing Remote namespaces.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/** Sidebar panel glyph; the sidebar owns the accessible navigation label. */
function PanelIcon(props) {
  return h(Glyph, { name: 'schedule', size: props.size })
}

/** A never-changing observable, used when an optional service is absent. */
function inertObservable(value) {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

const EMPTY_ROSTER = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} }
const EMPTY_STATUS = new Map()

/**
 * Register the panel with the live client.
 * @param {object} ctx - the browser Cordis context.
 * @returns {void}
 */
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'async: dictionaries')
  const t = ctx.locale.bind(NS)

  const remote = ctx.remote
  const sessionsService = ctx.get('sessions')
  const uiSession = ctx.get('uiSession')
  const uiWorkspace = ctx.get('uiWorkspace')
  const jobsService = ctx.get('jobs')
  const sessionApi = remote?.session
  const scheduleApi = remote?.schedule
  const projectApi = remote?.workspace
  const sessionStatus = uiSession?.sessionStatus ?? inertObservable(EMPTY_STATUS)
  const rosterSource = sessionsService?.list ?? inertObservable(EMPTY_ROSTER)
  const jobsSource = jobsService?.state ?? inertObservable({ rows: {}, observed: {} })

  const store = createStore({
    status: 'loading',
    schedules: [],
    workspaces: null,
    history: {},
    groups: [],
    ran: {},
    hidden: new Set(),
    notice: null,
  })
  const snapshot = () => store.getSnapshot()

  /** Sessions observed running while this page has been open. */
  const ran = new Map()
  /** Delivery-history read timestamps, to bound repeated timeline reads. */
  const historyRead = new Map()
  let started = false
  let lastRefresh = 0
  let refreshTimer = null
  let workspaceAbort = null
  let noticeTimer = null
  let disposed = false

  /** Show one notice; a success notice clears itself so it never becomes furniture. */
  const notify = (tone, text) => {
    if (noticeTimer !== null) { clearTimeout(noticeTimer); noticeTimer = null }
    store.patch({ notice: { tone, text } })
    if (tone !== 'ok') return
    noticeTimer = setTimeout(() => {
      noticeTimer = null
      if (store.getSnapshot().notice?.tone === 'ok') store.patch({ notice: null })
    }, 4000)
  }

  /** Read every durable task. */
  async function refreshSchedules() {
    if (scheduleApi === undefined) {
      store.patch({ status: 'ready' })
      return
    }
    lastRefresh = Date.now()
    try {
      const entries = await callRemote(() => scheduleApi.catalog())
      if (disposed) return
      store.patch({ schedules: Array.isArray(entries) ? entries : [], status: 'ready' })
    } catch (error) {
      if (disposed) return
      store.patch({ status: 'error' })
      notify('error', errorText(error, t, 'error.refresh'))
    }
  }

  /** Read the routable model catalog, which supplies the executor choices. */
  async function loadRoutes() {
    if (sessionApi === undefined) return
    try {
      const catalog = await callRemote(() => sessionApi.modelCatalog())
      if (disposed || catalog === undefined || catalog === null) return
      const groups = (catalog.groups ?? []).filter((group) => (group.models ?? []).length > 0)
      store.patch({ groups })
    } catch {
      // The executor picker falls back to the Host default without a catalog.
    }
  }

  /** Follow the Workspace roster so the form can name destinations. */
  function startWorkspaces() {
    if (workspaceAbort !== null || projectApi?.follow === undefined) return
    workspaceAbort = new AbortController()
    const signal = workspaceAbort.signal
    void (async () => {
      try {
        for await (const frame of projectApi.follow(signal)) {
          if (disposed) return
          if (frame.type === 'baseline' || frame.type === 'replace') {
            store.patch({ workspaces: frame.value })
            continue
          }
          const current = snapshot().workspaces
          if (current === null || current === undefined) continue
          if (frame.type === 'upsert') {
            const items = current.items.filter((item) => item.workspaceId !== frame.workspace.workspaceId)
            items.push(frame.workspace)
            store.patch({ workspaces: { ...current, items } })
          } else if (frame.type === 'remove') {
            store.patch({ workspaces: { ...current, items: current.items.filter((item) => item.workspaceId !== frame.workspaceId) } })
          }
        }
      } catch {
        // A closed or refused stream leaves the last roster in place.
      }
    })()
  }

  /** Read saved deliveries for the schedules a timeline is showing. */
  async function loadHistory(ids) {
    if (scheduleApi === undefined) return
    const now = Date.now()
    const todo = ids.filter((id) => {
      const read = historyRead.get(id)
      return read === undefined || now - read > HISTORY_TTL
    }).slice(0, 12)
    if (todo.length === 0) return
    for (const id of todo) historyRead.set(id, now)
    const next = { ...snapshot().history }
    let changed = false
    await Promise.all(todo.map(async (id) => {
      try {
        const page = await callRemote(() => scheduleApi.history({ id, limit: 20 }))
        if (page !== undefined && page !== null && Array.isArray(page.records)) {
          next[id] = page.records
          changed = true
        }
      } catch {
        // Delivery history is decoration on the timeline; the row still renders.
      }
    }))
    if (changed && !disposed) store.patch({ history: next })
  }

  /** Record run spans from the status source, so the board can show elapsed time. */
  function observeRuns() {
    const record = () => {
      const now = Date.now()
      let changed = false
      for (const [id, status] of sessionStatus.getSnapshot()) {
        const entry = ran.get(id)
        if (status.running === true) {
          if (entry === undefined || entry.end !== undefined) { ran.set(id, { start: now, end: undefined }); changed = true }
        } else if (entry !== undefined && entry.end === undefined) {
          ran.set(id, { start: entry.start, end: now })
          changed = true
        }
      }
      for (const [id, entry] of ran) {
        if (entry.end !== undefined && now - entry.end > 2 * MS.h) { ran.delete(id); changed = true }
      }
      if (changed) store.patch({ ran: Object.fromEntries(ran) })
    }
    // Seed from the live snapshot so work that was already running when this
    // page opened still gets an observed span.
    record()
    return sessionStatus.subscribe(record)
  }

  /** Open one session and return to the conversation view. */
  function openSession(sessionId) {
    try { ctx.layout.selectPanel(null) } catch { /* the panel seat may be unavailable */ }
    if (uiWorkspace?.openSession !== undefined) uiWorkspace.openSession(sessionId)
    else if (uiWorkspace?.openWorkspace === undefined) notify('error', t('error.action'))
  }

  /** Dismiss a settled row from this page's board. */
  function hide(key) {
    const hidden = new Set(snapshot().hidden)
    hidden.add(key)
    store.patch({ hidden })
  }

  /** Run one card verb. */
  async function act(item, verb) {
    try {
      if (verb === 'open') {
        if (item.sessionId !== undefined) openSession(item.sessionId)
        return
      }
      if (verb === 'dismiss') { hide(item.key); return }
      if (verb === 'stop') {
        await callRemote(() => sessionApi.cancel({ sessionId: item.sessionId }))
        return
      }
      if (verb === 'kill') {
        const result = await jobsService.kill(item.sessionId, item.jobId)
        if (result !== undefined && result.ok !== true) throw Object.assign(new Error('kill failed'), { code: result.error?.code })
        return
      }
      if (verb === 'run') {
        const outcome = await callRemote(() => scheduleApi.run({ id: item.id }))
        if (outcome !== undefined && outcome !== null && outcome.code === 'schedule_execution_pending') {
          notify('error', `${t('action.run')} · ${outcome.code}`)
          return
        }
        await refreshSchedules()
        return
      }
      if (verb === 'pause' || verb === 'resume') {
        const edited = await callRemote(() => scheduleApi.edit({
          id: item.id,
          action: 'update',
          patch: { active: verb === 'resume' },
          expectedUpdatedAt: item.record?.updatedAt ?? null,
        }))
        await refreshSchedules()
        if (edited !== undefined && edited !== null && edited.code === 'schedule_conflict') {
          notify('error', `${t('error.action')} (schedule_conflict)`)
        }
        return
      }
      if (verb === 'delete') {
        const deleted = await callRemote(() => scheduleApi.edit({
          id: item.id,
          action: 'delete',
          expectedUpdatedAt: item.record?.updatedAt ?? null,
        }))
        if (deleted !== undefined && deleted !== null && deleted.code === 'schedule_conflict') {
          notify('error', `${t('error.action')} (schedule_conflict)`)
          await refreshSchedules()
          return
        }
        hide(item.key)
        await refreshSchedules()
      }
    } catch (error) {
      notify('error', errorText(error, t, 'error.action'))
    }
  }

  /** Create one immediate run or one durable task. */
  async function create(payload) {
    const { title, prompt, mode, timing, route, workspaceId } = payload
    if (sessionApi === undefined) return { ok: false, message: t('error.action') }
    try {
      const workspacePath = workspaceId === undefined
        ? undefined
        : (snapshot().workspaces?.items ?? []).find((entry) => entry.workspaceId === workspaceId)?.path
      if (mode === 'now') {
        const created = await callRemote(() => sessionApi.create(workspaceId === undefined ? {} : { workspaceId }))
        const sessionId = created?.sessionId
        if (sessionId === undefined) return { ok: false, message: t('error.action') }
        try { await callRemote(() => sessionApi.rename({ sessionId, title })) } catch { /* the title is cosmetic */ }
        if (route !== undefined) {
          try {
            await callRemote(() => sessionApi.selectModel({ sessionId, provider: route.provider, model: route.model }))
          } catch { /* keep the Host default model when the route is refused */ }
        }
        await callRemote(() => sessionApi.prompt({
          requestId: nextRequestId(),
          sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: prompt }],
        }))
        notify('ok', t('create.ok.now'))
        return { ok: true }
      }
      if (scheduleApi === undefined) return { ok: false, message: t('error.action') }
      let target
      if (route !== undefined) {
        const created = await callRemote(() => sessionApi.create(workspaceId === undefined ? {} : { workspaceId }))
        const sessionId = created?.sessionId
        if (sessionId === undefined) return { ok: false, message: t('error.action') }
        try { await callRemote(() => sessionApi.rename({ sessionId, title })) } catch { /* cosmetic */ }
        try {
          await callRemote(() => sessionApi.selectModel({ sessionId, provider: route.provider, model: route.model }))
        } catch { /* keep the Host default model */ }
        target = { kind: 'session', sessionId }
      } else if (timing.kind === 'at' || timing.kind === 'after') {
        target = workspacePath === undefined ? { kind: 'new_once' } : { kind: 'new_once', create: { cwd: workspacePath } }
      } else {
        target = workspacePath === undefined ? { kind: 'new' } : { kind: 'new', create: { cwd: workspacePath } }
      }
      await callRemote(() => scheduleApi.create({ title, prompt, timing, target }))
      notify('ok', t('create.ok.scheduled'))
      await refreshSchedules()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: errorText(error, t, 'error.action') }
    }
  }

  const actions = {
    enter() {
      startWorkspaces()
      loadRoutes()
      if (!started) {
        started = true
        void refreshSchedules()
        return
      }
      if (Date.now() - lastRefresh > 15000) void refreshSchedules()
    },
    refresh() { void refreshSchedules() },
    dismissNotice() { store.patch({ notice: null }) },
    watchJobs(sessionId) {
      if (jobsService === undefined) return () => {}
      return jobsService.watchRows(sessionId)
    },
    loadHistory(ids) { void loadHistory(ids) },
    act,
    create,
  }

  ctx.effect(() => observeRuns(), 'async: run observation')
  ctx.effect(() => {
    if (remote?.$on === undefined) return () => {}
    try {
      return remote.$on('schedule/changed', () => {
        if (!started) return
        if (refreshTimer !== null) return
        refreshTimer = setTimeout(() => {
          refreshTimer = null
          void refreshSchedules()
        }, REFRESH_COALESCE)
      })
    } catch {
      return () => {}
    }
  }, 'async: schedule invalidation')
  ctx.effect(() => () => {
    disposed = true
    if (refreshTimer !== null) { clearTimeout(refreshTimer); refreshTimer = null }
    if (noticeTimer !== null) { clearTimeout(noticeTimer); noticeTimer = null }
    if (workspaceAbort !== null) { workspaceAbort.abort(); workspaceAbort = null }
  }, 'async: teardown')

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => ({
      hooks: { async: store, roster: rosterSource, status: sessionStatus, jobs: jobsSource },
      actions,
    }),
  }, Panel))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 12,
    locale: NS,
    label: () => t('panel.title'),
  }, PanelIcon))
}

/**
 * Required client services. Cordis refuses reading a namespace off the `remote`
 * proxy unless it is declared here, so every namespace this module calls —
 * session, schedule and workspace — is part of the contract.
 */
const inject = [
  'slots', 'locale', 'layout',
  'remote', 'remote.session', 'remote.schedule', 'remote.workspace',
  'sessions', 'uiSession', 'uiWorkspace', 'jobs',
]

return { inject, apply }
