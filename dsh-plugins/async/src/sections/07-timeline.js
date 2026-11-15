/**
 * Async — the timeline view: one gantt row per item, grouped into lanes.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/** Windows the timeline can show. */
const ZOOMS = [
  { id: '6h', span: 6 * MS.h },
  { id: '24h', span: MS.d },
  { id: '7d', span: 7 * MS.d },
  { id: '30d', span: 30 * MS.d },
]

/**
 * Evenly spread axis ticks, aligned to hours for short windows and to local
 * midnights for long ones.
 * @param {number} start - window start.
 * @param {number} end - window end.
 * @returns {number[]} tick instants.
 */
function axisTicks(start, end) {
  const span = end - start
  const ticks = []
  if (span <= 36 * MS.h) {
    const step = span <= 8 * MS.h ? MS.h : 4 * MS.h
    const base = new Date(start)
    base.setMinutes(0, 0, 0)
    let at = base.getTime() + step
    while (at < end) { ticks.push(at); at += step }
    return ticks
  }
  const base = new Date(start)
  base.setHours(0, 0, 0, 0)
  const days = Math.round(span / MS.d)
  const stride = days > 14 ? 7 : days > 7 ? 2 : 1
  let at = base.getTime() + MS.d
  let index = 0
  while (at < end) {
    if (index % stride === 0) ticks.push(at)
    index += 1
    at += MS.d
  }
  return ticks
}

/**
 * Axis label for one tick at the current zoom.
 * @param {number} at - tick instant.
 * @param {number} span - window span.
 * @returns {string} label.
 */
function tickLabel(at, span) {
  if (span <= 36 * MS.h) return fmtClock(at)
  if (span <= 8 * MS.d) return fmtWeekday(at)
  return fmtDate(at)
}

/**
 * Build one timeline row: the item, its continuous bar, and its discrete
 * occurrence blocks from saved deliveries and projected future runs.
 * @param {object} item - board item.
 * @param {number} start - window start.
 * @param {number} end - window end.
 * @param {Array} deliveries - saved deliveries of one schedule.
 * @returns {object | null} row, or null when the window holds nothing.
 */
function timelineRow(item, start, end, deliveries) {
  const blocks = []
  if (item.source === 'schedule') {
    // Without a fetched delivery page the row still shows the one delivery the
    // catalog carries, so history is never a precondition for seeing the item.
    if (deliveries === undefined && item.lastDeliveryAt !== undefined
      && item.lastDeliveryAt >= start && item.lastDeliveryAt <= end) {
      blocks.push({ at: item.lastDeliveryAt, past: true })
    }
    for (const record of deliveries ?? []) {
      const at = Date.parse(record.deliveredAt ?? record.scheduledAt ?? '')
      if (Number.isFinite(at) && at >= start && at <= end) blocks.push({ at, past: true })
    }
    for (const mark of item.marks ?? []) {
      if (mark.solid) continue
      if (mark.t >= start && mark.t <= end) blocks.push({ at: mark.t, past: false })
    }
  }
  let bar
  if (item.source === 'session' && item.span === true && item.at !== undefined) {
    // A run never extends past now: an open bar ends at the present instant.
    bar = { start: Math.max(start, item.at), end: Math.min(item.end ?? Date.now(), end), open: item.end === undefined }
  } else if (item.source === 'job' && item.at !== undefined) {
    bar = { start: Math.max(start, item.at), end: Math.min(item.end ?? Date.now(), end), open: item.end === undefined }
  }
  if (blocks.length === 0 && (bar === undefined || bar.end <= bar.start)) return null
  return { item, blocks, bar }
}

/**
 * Render the timeline.
 * @param {{board: object, data: object, t: Function, selected: string | null, onSelect: Function, actions: object, now: number}} props - projection, delivery history, and handlers.
 * @returns {object} timeline element.
 */
function Timeline(props) {
  const { board, data, t, selected, onSelect, actions, now } = props
  const [zoom, setZoom] = React.useState('24h')
  const [group, setGroup] = React.useState('source')

  const windowSpec = ZOOMS.find((entry) => entry.id === zoom) ?? ZOOMS[1]
  const start = now - windowSpec.span * 0.45
  const end = now + windowSpec.span * 0.55
  const span = end - start

  const lanes = React.useMemo(() => {
    const rows = []
    for (const item of board.items) {
      const deliveries = item.source === 'schedule' ? data.history[item.id] : undefined
      const row = timelineRow(item, start, end, deliveries)
      if (row !== null) rows.push(row)
    }
    const laneOf = (row) => {
      if (group === 'executor') {
        if (row.item.providerKind === 'native') return 'native'
        if (row.item.providerKind === 'local') return 'local'
        return 'none'
      }
      if (group === 'workspace') return row.item.workspaceLabel ?? 'none'
      return row.item.source
    }
    const grouped = new Map()
    for (const row of rows.slice(0, 60)) {
      const lane = laneOf(row)
      if (!grouped.has(lane)) grouped.set(lane, [])
      grouped.get(lane).push(row)
    }
    const label = (id) => {
      if (group === 'source' || group === 'executor') return t(`timeline.lane.${id}`)
      return id === 'none' ? t('timeline.lane.none') : id
    }
    return [...grouped.entries()].map(([id, laneRows]) => ({
      id,
      label: label(id),
      rows: laneRows.sort((a, b) => (a.bar?.start ?? a.blocks[0]?.at ?? 0) - (b.bar?.start ?? b.blocks[0]?.at ?? 0)),
    }))
  }, [board, data.history, group, start, end, t])

  const ticks = React.useMemo(() => axisTicks(start, end), [start, end])
  const pos = (at) => `${Math.max(0, Math.min(100, ((at - start) / span) * 100))}%`
  const gridLines = (labels) => ticks.map((at, index) => h('span', {
    key: `tick-${index}`,
    className: 'asx-tlTick',
    style: { left: pos(at) },
  }, labels ? h('span', { className: 'asx-tlTickLabel' }, tickLabel(at, span)) : null))
  const grid = gridLines(false)
  const nowLine = h('span', { key: 'now', className: 'asx-tlNow', style: { left: pos(now) }, 'aria-hidden': 'true' })

  const laneNodes = []
  let rowIndex = 0
  for (const lane of lanes) {
    laneNodes.push(h('div', { key: `lane-${lane.id}`, className: 'asx-tlLane' },
      h('div', { className: 'asx-tlLaneHead' },
        h('span', { className: 'asx-tlLaneTitle' }, lane.label),
        h('span', { className: 'asx-count' }, lane.rows.length),
      ),
      h('div', { className: 'asx-tlTrack' }, grid, nowLine),
    ))
    for (const row of lane.rows) {
      const item = row.item
      rowIndex += 1
      laneNodes.push(h('div', {
        key: `${item.key}-${rowIndex}`,
        className: 'asx-tlRow',
        'data-selected': selected === item.key ? 'true' : undefined,
        tabIndex: 0,
        onClick: () => { onSelect(item.key) },
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.key) }
        },
      },
      h('div', { className: 'asx-tlRowHead' },
        h('span', { className: 'asx-glyph' }, h(Glyph, { name: itemGlyph(item), size: 12 })),
        h('span', { className: 'asx-tlRowName', title: item.title }, item.title),
      ),
      h('div', { className: 'asx-tlTrack' },
        grid,
        nowLine,
        row.bar === undefined ? null : h('span', {
          key: 'bar',
          className: 'asx-tlBlock',
          'data-open': row.bar.open ? 'true' : undefined,
          'data-past': row.bar.open ? 'open' : 'true',
          style: { left: pos(row.bar.start), width: `${Math.max(0.6, ((row.bar.end - row.bar.start) / span) * 100)}%` },
          title: [item.title, item.routeLabel ?? item.subtitle ?? ''].filter(Boolean).join(' · '),
        }),
        row.blocks.map((block, index) => h('span', {
          key: `block-${index}`,
          className: 'asx-tlBlock',
          'data-past': block.past ? 'true' : 'false',
          style: { left: pos(block.at), width: '2px' },
          title: `${item.title} · ${block.past ? t('timeline.past') : t('timeline.future')} ${fmtDayClock(block.at)}`,
        })),
      ),
      ))
    }
  }

  return h('div', { className: 'asx-tl' },
    h('div', { className: 'asx-tlBar' },
      h('span', { className: 'asx-label' }, t('timeline.window')),
      h('div', { className: 'asx-seg' }, ZOOMS.map((entry) => h('button', {
        key: entry.id,
        type: 'button',
        className: 'asx-segBtn',
        'data-on': zoom === entry.id ? 'true' : 'false',
        onClick: () => { setZoom(entry.id) },
      }, t(`timeline.${entry.id}`)))),
      h('span', { className: 'asx-spacer' }),
      h('span', { className: 'asx-label' }, t('timeline.group')),
      h('div', { className: 'asx-seg' }, ['source', 'executor', 'workspace'].map((id) => h('button', {
        key: id,
        type: 'button',
        className: 'asx-segBtn',
        'data-on': group === id ? 'true' : 'false',
        onClick: () => { setGroup(id) },
      }, t(`timeline.by${id[0].toUpperCase()}${id.slice(1)}`)))),
    ),
    h('div', { className: 'asx-tlNote' }, t('timeline.note')),
    h('div', { className: 'asx-tlScroll' },
      laneNodes.length === 0
        ? h('div', { className: 'asx-tlEmpty' }, t('timeline.empty'))
        : h('div', { className: 'asx-tlGrid' },
          h('div', { className: 'asx-tlHead' },
            h('div', { className: 'asx-tlGutter' }, t('timeline.item')),
            h('div', { className: 'asx-tlTrack' }, gridLines(true), nowLine),
          ),
          laneNodes,
        ),
    ),
  )
}
