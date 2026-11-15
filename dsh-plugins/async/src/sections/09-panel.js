/**
 * Async — the panel itself: data composition, header, and view switching.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/** Source filter chips, in display order. */
const FILTERS = ['all', 'schedule', 'session', 'job', 'team']

/**
 * The Async panel.
 * @param {object} props - framework hooks plus the injected business face.
 * @returns {object} panel element.
 */
function Panel(props) {
  const { useAsync, useRoster, useStatus, useJobs, actions, t } = props
  const data = useAsync((snapshot) => snapshot)
  const roster = useRoster((snapshot) => snapshot)
  const statuses = useStatus((snapshot) => snapshot)
  const jobs = useJobs((snapshot) => snapshot)
  const [view, setView] = React.useState('board')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [filter, setFilter] = React.useState('all')
  const [selected, setSelected] = React.useState(null)
  useTicker(TICK_MS)
  const now = Date.now()

  React.useEffect(() => { actions.enter() }, [])

  const runningIds = React.useMemo(() => {
    const out = []
    for (const id of roster?.ids ?? []) {
      if (statuses?.get(id)?.running === true || roster?.byId?.[id]?.running === true) out.push(id)
    }
    return out.slice(0, WATCH_LIMIT)
  }, [roster, statuses])
  const watchedKey = runningIds.join('|')
  React.useEffect(() => {
    const stops = runningIds.map((id) => actions.watchJobs(id)).filter((stop) => typeof stop === 'function')
    return () => { for (const stop of stops) stop() }
  }, [watchedKey])
  const watched = React.useMemo(() => new Set(runningIds), [watchedKey])

  const board = React.useMemo(() => buildBoard({
    now,
    roster,
    statuses,
    jobs,
    watched,
    schedules: data.schedules,
    workspaces: data.workspaces,
    groups: data.groups,
    ran: data.ran,
    hidden: data.hidden,
    t,
  }), [now, roster, statuses, jobs, data, watched])

  const scheduleIds = React.useMemo(() => (data.schedules ?? []).map((entry) => entry.id).slice(0, HISTORY_LIMIT), [data.schedules])
  const historyKey = scheduleIds.join('|')
  React.useEffect(() => {
    if (view !== 'timeline') return
    actions.loadHistory(scheduleIds)
  }, [view, historyKey])

  const select = (key) => { setSelected((current) => (current === key ? null : key)) }
  const summary = board.summary
  const parts = []
  if (summary.running > 0) parts.push(`${summary.running} ${t('col.running').toLowerCase()}`)
  if (summary.upcoming > 0) parts.push(`${summary.upcoming} ${t('col.upcoming').toLowerCase()}`)
  if (summary.needs > 0) parts.push(`${summary.needs} ${t('col.needs').toLowerCase()}`)

  return h('div', { className: 'asx-root' },
    h('style', { key: 'asx-style' }, CSS),
    h('header', { className: 'asx-head' },
      h('div', { className: 'asx-headText' },
        h('div', { className: 'asx-title' },
          h('span', { className: 'asx-glyph' }, h(Glyph, { name: 'schedule', size: 16 })),
          t('panel.title'),
        ),
        h('div', { className: 'asx-subs' },
          h('span', null, t('panel.subtitle')),
          parts.length === 0 ? null : h('span', { className: 'asx-dotSep' }),
          parts.length === 0 ? null : h('span', null, parts.join(' · ')),
        ),
      ),
      h('div', { className: 'asx-headTools' },
        h('div', { className: 'asx-seg' }, [
          ['board', t('panel.board')],
          ['timeline', t('panel.timeline')],
        ].map(([id, label]) => h('button', {
          key: id,
          type: 'button',
          className: 'asx-segBtn',
          'data-on': view === id ? 'true' : 'false',
          onClick: () => { setView(id) },
        }, label))),
        h('button', {
          type: 'button',
          className: 'asx-btn asx-btnGhost',
          title: t('panel.refresh'),
          'aria-label': t('panel.refresh'),
          disabled: data.status === 'loading',
          onClick: () => { actions.refresh() },
        }, h(Glyph, { name: 'refresh', size: 13, spin: data.status === 'loading' })),
        h('button', {
          type: 'button',
          className: 'asx-btn asx-btnPrimary',
          onClick: () => { setCreateOpen((open) => !open) },
        }, h(Glyph, { name: 'plus', size: 12 }), t('panel.new')),
      ),
    ),
    data.notice === null ? null : h(Banner, {
      tone: data.notice.tone,
      text: data.notice.text,
      t,
      onDismiss: () => { actions.dismissNotice() },
    }),
    createOpen ? h(CreateForm, {
      actions,
      data,
      t,
      onClose: () => { setCreateOpen(false) },
    }) : null,
    view === 'board'
      ? h('div', { className: 'asx-toolbar' },
        h('div', { className: 'asx-chips' }, FILTERS.map((id) => h('button', {
          key: id,
          type: 'button',
          className: 'asx-chip',
          'data-on': filter === id ? 'true' : 'false',
          onClick: () => { setFilter(id) },
        }, t(`filter.${id}`)))),
        h('span', { className: 'asx-spacer' }),
        h('span', { className: 'asx-note' }, t('panel.count', { n: board.items.length })),
      )
      : null,
    view === 'board'
      ? (data.status === 'loading' && board.items.length === 0
        ? h('div', { className: 'asx-empty' }, t('panel.loading'))
        : board.items.length === 0
          ? h('div', { className: 'asx-empty' }, t('panel.empty'))
          : h(Board, { board, t, filter, selected, onSelect: select, actions }))
      : h(Timeline, { board, data, t, selected, onSelect: select, actions, now }),
  )
}
