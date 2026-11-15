/**
 * Async — schedule timing knowledge and the board's item projection.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Human label for one schedule's timing rule.
 * @param {object} record - schedule catalog entry.
 * @param {Function} t - translator.
 * @returns {string} frequency label.
 */
function frequencyLabel(record, t) {
  if (record === undefined || record === null) return ''
  switch (record.kind) {
    case 'after':
    case 'at':
      return t('freq.once')
    case 'every': {
      const seconds = record.everySeconds ?? 0
      if (seconds % 3600 === 0) return t('freq.every.n', { n: `${seconds / 3600}h` })
      if (seconds % 60 === 0) return t('freq.every.m', { n: String(seconds / 60) })
      return t('freq.every.n', { n: `${seconds}s` })
    }
    case 'daily':
      return t('freq.daily', { time: String(record.time ?? '').slice(0, 5) })
    case 'weekly': {
      const days = (record.weekdays ?? []).map((day) => t(`weekday.${day}`)).join(', ')
      return t('freq.weekly', { day: days, time: String(record.time ?? '').slice(0, 5) })
    }
    case 'cron':
      return t('freq.cron', { expr: record.expression ?? '' })
    case 'rrule':
      return t('freq.rrule')
    default:
      return record.kind ?? ''
  }
}

/**
 * Whether a schedule rule recurs beyond its committed next occurrence.
 * @param {object} record - schedule catalog entry.
 * @returns {boolean} true for recurring rules.
 */
function isRecurring(record) {
  return record !== undefined && record !== null && record.kind !== 'after' && record.kind !== 'at'
}

/**
 * Occurrence instants of one schedule inside a window. `every`, `daily` and
 * `weekly` project forward arithmetically; `cron` and `rrule` expose only the
 * Host-committed next occurrence, because re-implementing their evaluator in a
 * view would be a second source of truth.
 * @param {object} record - schedule catalog entry.
 * @param {number} fromMs - inclusive window start.
 * @param {number} toMs - inclusive window end.
 * @param {number} limit - maximum occurrences.
 * @returns {number[]} ascending instants.
 */
function occurrencesOf(record, fromMs, toMs, limit) {
  const out = []
  if (record === undefined || record === null) return out
  const next = Date.parse(record.scheduledAt ?? '')
  const room = () => out.length < limit
  if (record.kind === 'after' || record.kind === 'at') {
    if (Number.isFinite(next) && next >= fromMs - 1000 && next <= toMs) out.push(next)
    return out
  }
  if (record.kind === 'every') {
    const step = Math.max(60000, (record.everySeconds ?? 60) * 1000)
    if (!Number.isFinite(next)) return out
    let at = next
    if (at < fromMs) at += Math.ceil((fromMs - at) / step) * step
    while (at <= toMs && room()) { out.push(at); at += step }
    return out
  }
  if (record.kind === 'daily' || record.kind === 'weekly') {
    const zone = record.timeZone || 'UTC'
    const [hh, mm] = String(record.time ?? '00:00').split(':').map(Number)
    const weekdays = record.kind === 'weekly' ? (record.weekdays ?? []) : null
    const base = zoneParts(fromMs, zone)
    for (let i = 0; i < 400 && room(); i += 1) {
      const day = new Date(Date.UTC(base.y, base.mo - 1, base.d + i))
      const y = day.getUTCFullYear()
      const mo = day.getUTCMonth() + 1
      const d = day.getUTCDate()
      if (weekdays !== null) {
        const iso = day.getUTCDay() === 0 ? 7 : day.getUTCDay()
        if (!weekdays.includes(iso)) continue
      }
      const at = zonedToUtc(y, mo, d, hh, mm, zone)
      if (at > toMs) break
      if (at >= fromMs - 1000) out.push(at)
    }
    if (out.length === 0 && Number.isFinite(next) && next >= fromMs - 1000 && next <= toMs) out.push(next)
    return out
  }
  if (Number.isFinite(next) && next >= fromMs - 1000 && next <= toMs) out.push(next)
  return out
}

/**
 * Session a schedule delivers into, when the target is fixed.
 * @param {object} entry - schedule catalog entry.
 * @returns {string | undefined} session id.
 */
function targetSessionId(entry) {
  const target = entry?.target
  if (target === undefined || target === null) return undefined
  if (target.kind === 'session' || target.kind === 'new_once') return target.sessionId
  return undefined
}

/** `local`, `native`, or `none` classification of a model provider route. */
function providerKind(provider) {
  if (typeof provider !== 'string' || provider.length === 0) return 'none'
  return provider.toLowerCase().startsWith('deepseek') ? 'native' : 'local'
}

/**
 * Display name of one route, preferring the live model catalog.
 * @param {{provider: string, model: string}} selection - route.
 * @param {Array} groups - model catalog provider groups.
 * @returns {string} display name.
 */
function routeName(selection, groups) {
  if (selection === undefined || selection === null) return ''
  const provider = selection.provider ?? ''
  const group = (groups ?? []).find((entry) => entry.id === provider)
  const model = group?.models?.find((entry) => entry.id === selection.model)
  const providerLabel = group?.name ?? provider
  return model === undefined ? `${providerLabel} · ${selection.model}` : `${providerLabel} · ${model.name}`
}

/** Basename of one path. */
function basename(path) {
  if (typeof path !== 'string' || path.length === 0) return ''
  const trimmed = path.replace(/\/+$/, '')
  const index = trimmed.lastIndexOf('/')
  return index === -1 ? trimmed : trimmed.slice(index + 1)
}

/**
 * Build the workspace index: session id to workspace, and the ordered list of
 * selectable workspaces for the creation form.
 * @param {object} workspaces - workspace baseline, if it has arrived.
 * @returns {{bySession: Map<string, object>, list: Array<object>}} index.
 */
function workspaceIndex(workspaces) {
  const bySession = new Map()
  const list = []
  for (const workspace of workspaces?.items ?? []) {
    list.push(workspace)
    for (const sessionId of workspace.sessionIds ?? []) bySession.set(sessionId, workspace)
  }
  return { bySession, list }
}

/**
 * Group the roster's jobs by session for every watched session.
 * @param {object} jobs - client jobs snapshot.
 * @param {Set<string>} watched - sessions whose roster is current.
 * @returns {Array<{sessionId: string, job: object}>} live and recent jobs.
 */
function jobRows(jobs, watched) {
  const rows = []
  const seen = jobs?.rows ?? {}
  for (const sessionId of watched) {
    for (const job of seen[sessionId] ?? []) rows.push({ sessionId, job })
  }
  return rows
}

/**
 * Project every source into board items. Pure: the same inputs produce the
 * same items, and nothing here reads a clock other than the argument.
 * @param {object} input - roster, statuses, jobs, schedules, history, workspaces, running records, hidden keys, now.
 * @returns {{items: Array<object>, byColumn: object, counts: object, summary: object, workspaces: Array<object>}} projection.
 */
function buildBoard(input) {
  const now = input.now
  const statuses = input.statuses ?? new Map()
  const roster = input.roster
  const hidden = input.hidden ?? new Set()
  const workspace = workspaceIndex(input.workspaces)
  const groups = input.groups ?? []
  const items = []

  // --- Schedules -----------------------------------------------------------
  for (const entry of input.schedules ?? []) {
    const status = entry.status ?? 'active'
    const target = targetSessionId(entry)
    const targetWorkspace = target === undefined ? undefined : workspace.bySession.get(target)
    const modelSelection = target === undefined
      ? undefined
      : roster?.projectionsBySession?.[target]?.values?.modelSelection
    const route = modelSelection?.next ?? modelSelection?.lastUsed
    const nextAt = Date.parse(entry.scheduledAt ?? '')
    const lastDeliveredAt = Date.parse(entry.lastDelivery?.deliveredAt ?? '')
    let column = 'settled'
    if (status === 'active') column = 'upcoming'
    else if (status === 'ended') {
      // An ended one-shot decays off the board after a week.
      const age = Number.isFinite(lastDeliveredAt) ? now - lastDeliveredAt : Number.POSITIVE_INFINITY
      if (age > 7 * MS.d) continue
    }
    const key = `schedule:${entry.id}`
    if (hidden.has(key)) continue
    const windowStart = now - MS.h
    const windowEnd = now + MS.d
    // Only active tasks have a timer obligation; a paused record's committed
    // instant is its final occurrence, which is history rather than a plan.
    const future = status !== 'active'
      ? []
      : isRecurring(entry)
        ? occurrencesOf(entry, windowStart, windowEnd, 12)
        : Number.isFinite(nextAt) ? [nextAt] : []
    const marks = []
    if (Number.isFinite(lastDeliveredAt)) marks.push({ t: lastDeliveredAt, solid: true })
    for (const at of future) marks.push({ t: at, solid: false })
    items.push({
      key,
      source: 'schedule',
      id: entry.id,
      column,
      title: entry.title ?? entry.prompt ?? entry.id,
      subtitle: frequencyLabel(entry, input.t),
      at: status === 'active' && Number.isFinite(nextAt) ? nextAt : Number.isFinite(lastDeliveredAt) ? lastDeliveredAt : undefined,
      end: undefined,
      state: status,
      recurring: isRecurring(entry),
      overdue: status === 'active' && Number.isFinite(nextAt) && nextAt < now,
      executing: entry.executionActive === true,
      provider: route?.provider,
      providerKind: providerKind(route?.provider),
      routeLabel: routeName(route, groups),
      sessionId: target,
      workspaceLabel: targetWorkspace?.title ?? basename(targetWorkspace?.path),
      marks,
      lastDeliveryAt: Number.isFinite(lastDeliveredAt) ? lastDeliveredAt : undefined,
      record: entry,
      team: [],
    })
  }

  // --- Sessions ------------------------------------------------------------
  // Host-list membership plus retained rows: a running subagent can be present
  // in `byId` without being a Host-list member, and it is exactly the work this
  // board exists to show.
  const byId = roster?.byId ?? {}
  const ids = [...new Set([...(roster?.ids ?? []), ...Object.keys(byId)])]
  for (const id of ids) {
    const session = byId[id]
    if (session === undefined || session.blank === true) continue
    const status = statuses.get(id)
    const running = status?.running ?? session.running
    const pending = status?.pendingInteraction
    const unread = status?.completionUnread === true
    const ran = input.ran?.[id]
    if (!running && pending === undefined && !unread && ran === undefined) continue
    let column = 'settled'
    if (pending !== undefined) column = 'needs'
    else if (running) column = 'running'
    const key = `session:${id}`
    if (hidden.has(key)) continue
    const modelSelection = roster?.projectionsBySession?.[id]?.values?.modelSelection
    const route = modelSelection?.next ?? modelSelection?.lastUsed
    const parent = session.parentId === undefined ? undefined : roster.byId[session.parentId]
    const ownWorkspace = workspace.bySession.get(id)
    const teamProjection = roster?.projectionsBySession?.[id]?.values?.agentTeam
    const team = (teamProjection?.enabled === true ? teamProjection.tasks ?? [] : [])
      .filter((task) => task.status === 'pending' || task.status === 'in_progress')
      .map((task) => ({ key: `team:${id}:${task.id}`, title: task.subject, status: task.status, owner: task.ownerName }))
    const start = running ? (ran?.start ?? input.runningSince?.get(id)) : ran?.start
    const end = running ? undefined : ran?.end
    items.push({
      key,
      source: 'session',
      id,
      column,
      title: session.displayTitle || session.title || String(id).slice(0, 8),
      subtitle: ownWorkspace?.title ?? basename(session.cwd),
      at: start ?? session.updatedAt,
      end,
      span: start !== undefined,
      state: running ? 'running' : unread ? 'unread' : ran !== undefined ? 'done' : 'idle',
      child: session.parentId !== undefined,
      subagent: session.origin === 'subagent',
      parentTitle: parent?.displayTitle,
      pendingKind: pending?.kind,
      unread,
      provider: route?.provider,
      providerKind: providerKind(route?.provider),
      routeLabel: routeName(route, groups),
      sessionId: id,
      ownerSessionId: id,
      workspaceLabel: ownWorkspace?.title ?? basename(session.cwd),
      marks: start === undefined ? [] : [{ t: start, solid: true, open: running }],
      team,
      teamTotal: team.length,
      updatedAt: session.updatedAt,
    })
  }

  // --- Background jobs -----------------------------------------------------
  const recentFloor = now - 10 * MS.m
  for (const { sessionId, job } of jobRows(input.jobs, input.watched ?? new Set())) {
    const live = job.status === 'running' || job.status === 'stopping'
    const finished = job.finishedAt ?? job.startedAt
    if (!live && finished < recentFloor) continue
    const key = `job:${job.id}`
    if (hidden.has(key)) continue
    const owner = roster?.byId[sessionId]
    items.push({
      key,
      source: 'job',
      id: job.id,
      column: live ? 'running' : 'settled',
      title: job.label ?? job.kind ?? job.id,
      subtitle: job.progress ?? job.detail,
      at: job.startedAt,
      end: job.finishedAt,
      state: job.status,
      progress: job.progress,
      detail: job.detail,
      sessionId,
      ownerSessionId: sessionId,
      jobId: job.id,
      workspaceLabel: owner?.displayTitle,
      marks: [{ t: job.startedAt, solid: true, open: live }],
      team: [],
    })
  }

  const byColumn = { upcoming: [], running: [], needs: [], settled: [] }
  for (const item of items) {
    if (byColumn[item.column] === undefined) byColumn[item.column] = []
    byColumn[item.column].push(item)
  }
  byColumn.upcoming.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || a.title.localeCompare(b.title))
  byColumn.running.sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  byColumn.needs.sort((a, b) => (a.updatedAt ?? a.at ?? 0) - (b.updatedAt ?? b.at ?? 0))
  byColumn.settled.sort((a, b) => (b.end ?? b.at ?? 0) - (a.end ?? a.at ?? 0))

  const counts = {}
  for (const column of COLUMNS) counts[column] = byColumn[column]?.length ?? 0
  return {
    items,
    byColumn,
    counts,
    workspaces: workspace.list,
    summary: {
      running: counts.running,
      upcoming: counts.upcoming,
      needs: counts.needs,
      schedules: byColumn.upcoming.length + byColumn.settled.filter((item) => item.source === 'schedule').length,
    },
  }
}

/**
 * Source filter membership.
 * @param {object} item - board item.
 * @param {string} filter - active filter id.
 * @returns {boolean} true when the item belongs to the filter.
 */
function matchesFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'team') return (item.team?.length ?? 0) > 0
  return item.source === filter
}
