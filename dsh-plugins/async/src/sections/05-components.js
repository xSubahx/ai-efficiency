/**
 * Async — presentation primitives: glyphs, badges, ribbons, cards, columns.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

const GLYPHS = {
  schedule: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h5A1.5 1.5 0 0 1 12 6.5v5A1.5 1.5 0 0 1 10.5 13h-5A1.5 1.5 0 0 1 4 11.5zM4 8h8M6.5 3.5v3M9.5 3.5v3',
  agent: 'M5 5.5A1.5 1.5 0 0 1 6.5 4h3A1.5 1.5 0 0 1 11 5.5v3A1.5 1.5 0 0 1 9.5 10h-3A1.5 1.5 0 0 1 5 8.5zM8 4V2.5M6.2 6.9h.01M9.8 6.9h.01M6 12l1.2-2M10 12l-1.2-2',
  job: 'M3.5 4.5 6 8l-2.5 3.5M8 11.5h4.5',
  team: 'M6 6.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM2.5 12.5c0-1.8 1.6-3 3.5-3s3.5 1.2 3.5 3M11 4.2a1.5 1.5 0 0 1 0 3M12 12.5c0-1.4-.7-2.4-1.8-2.9',
  run: 'M6 4.2v7.6L11.4 8z',
  pause: 'M6.2 4.5v7M9.8 4.5v7',
  stop: 'M5.5 5.5h5v5h-5z',
  trash: 'M3.5 5.5h9M6.5 5.5V4h3v1.5M5 5.5l.5 7h5l.5-7',
  open: 'M9 4h3v3M12 4 7.5 8.5M11 10.5v2A1.5 1.5 0 0 1 9.5 14h-5A1.5 1.5 0 0 1 3 12.5v-5A1.5 1.5 0 0 1 4.5 6h2',
  close: 'M5 5l6 6M11 5l-6 6',
  refresh: 'M12.5 8a4.5 4.5 0 1 1-1.4-3.2M12.5 2.6v2.6h-2.6',
  plus: 'M8 3.8v8.4M3.8 8h8.4',
  clock: 'M8 4.2A3.8 3.8 0 1 1 4.2 8 3.8 3.8 0 0 1 8 4.2zM8 6v2.2l1.6 1',
  warn: 'M8 3.4 13 12H3zM8 6.6v2.6M8 10.9h.01',
  check: 'M4 8.4 6.6 11 12 5',
  dots: 'M5 8h.01M8 8h.01M11 8h.01',
}

/**
 * Stroke glyph from the local set.
 * @param {{name: string, size?: number, spin?: boolean, className?: string}} props - glyph choice.
 * @returns {object} svg element.
 */
function Glyph({ name, size = 14, spin = false, className }) {
  const path = GLYPHS[name] ?? GLYPHS.dots
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    className: [spin ? 'asx-glyphSpin' : '', className ?? ''].filter(Boolean).join(' ') || undefined,
  }, h('path', { d: path }))
}

/**
 * One small metadata chip.
 * @param {{kind?: string, title?: string, children: unknown}} props - badge content.
 * @returns {object} span element.
 */
function Badge({ kind, title, children }) {
  return h('span', { className: 'asx-badge', 'data-kind': kind, title }, children)
}

/**
 * Compact one-line time strip: a window, optional solid bar, and occurrence marks.
 * @param {{windowStart: number, windowEnd: number, marks: Array, bar?: object, now: number}} props - strip geometry.
 * @returns {object} div element.
 */
function Ribbon({ windowStart, windowEnd, marks, bar, now }) {
  const span = Math.max(1, windowEnd - windowStart)
  const pos = (at) => Math.max(0, Math.min(100, ((at - windowStart) / span) * 100))
  const nowPos = pos(now)
  const children = [h('span', { key: 'base', className: 'asx-ribbonBase' })]
  if (bar !== undefined && bar !== null) {
    const left = pos(bar.start)
    const right = bar.end === undefined ? 100 : pos(bar.end)
    children.push(h('span', {
      key: 'bar',
      className: 'asx-bar',
      'data-open': bar.end === undefined ? 'true' : undefined,
      style: { left: `${left}%`, width: `${Math.max(1.5, right - left)}%` },
    }))
  }
  let index = 0
  for (const mark of marks ?? []) {
    if (mark.t < windowStart - MS.d || mark.t > windowEnd + MS.d) { index += 1; continue }
    children.push(h('span', {
      key: `mark-${index}`,
      className: 'asx-mark',
      'data-solid': mark.solid ? 'true' : 'false',
      style: { left: `${pos(mark.t)}%` },
    }))
    index += 1
  }
  children.push(h('span', { key: 'now', className: 'asx-markNow', style: { left: `${nowPos}%` } }))
  return h('div', { className: 'asx-ribbon', 'aria-hidden': 'true' }, children)
}

/**
 * Card time line: the one sentence that says when this item happens.
 * @param {object} item - board item.
 * @param {number} now - current instant.
 * @param {Function} t - translator.
 * @returns {{strong: string, soft?: string}} time text.
 */
function timeLine(item, now, t) {
  if (item.source === 'schedule') {
    if (item.state === 'paused') {
      return item.lastDeliveryAt === undefined
        ? { strong: t('badge.paused'), soft: item.subtitle }
        : { strong: t('time.ago', { when: fmtDuration(now - item.lastDeliveryAt) }), soft: item.subtitle }
    }
    if (item.state === 'ended') {
      return item.lastDeliveryAt === undefined
        ? { strong: t('badge.ended'), soft: item.subtitle }
        : { strong: t('time.ago', { when: fmtDuration(now - item.lastDeliveryAt) }), soft: item.subtitle }
    }
    if (item.overdue) return { strong: t('time.overdue'), soft: item.subtitle }
    if (item.at === undefined) return { strong: item.subtitle, soft: undefined }
    return { strong: t('time.in', { when: fmtDuration(item.at - now) }), soft: item.subtitle }
  }
  if (item.source === 'session') {
    if (item.column === 'running') {
      return item.at === undefined
        ? { strong: t('time.runningShort'), soft: item.subtitle }
        : { strong: t('time.running', { when: fmtElapsed(now - item.at) }), soft: item.subtitle }
    }
    if (item.column === 'needs') return { strong: t('time.waiting'), soft: item.subtitle }
    const when = item.end ?? item.at
    return when === undefined
      ? { strong: t('badge.done'), soft: item.subtitle }
      : { strong: t('time.ago', { when: fmtDuration(now - when) }), soft: item.subtitle }
  }
  if (item.source === 'job') {
    const live = item.state === 'running' || item.state === 'stopping'
    if (live) {
      return { strong: t('time.running', { when: fmtElapsed(now - item.at) }), soft: item.progress ?? item.subtitle }
    }
    const end = item.end ?? item.at
    return { strong: t('time.took', { when: fmtDuration(Math.max(0, end - item.at)) }), soft: item.detail ?? item.progress }
  }
  return { strong: '', soft: undefined }
}

/**
 * Column tone of one item.
 * @param {object} item - board item.
 * @returns {string} tone id.
 */
function itemTone(item) {
  if (item.state === 'failed' || item.state === 'killed') return 'failed'
  if (item.column === 'needs') return 'needs'
  if (item.column === 'running') return 'running'
  if (item.column === 'upcoming') return 'upcoming'
  return 'settled'
}

/** Source glyph of one item. */
function itemGlyph(item) {
  if (item.source === 'job') return 'job'
  if (item.source === 'schedule') return item.state === 'paused' ? 'pause' : 'schedule'
  return (item.team?.length ?? 0) > 0 ? 'team' : 'agent'
}

/**
 * One board card.
 * @param {object} props - item plus handlers and copy.
 * @returns {object} article element.
 */
function Card(props) {
  const { item, now, t, selected, busy, armedKey, onSelect, onAction } = props
  const tone = itemTone(item)
  const time = timeLine(item, now, t)
  // One shared time window per column keeps every ribbon comparable: the now
  // marker lands at the same fraction of every card in that column.
  let windowStart = now - 2 * MS.h
  let windowEnd = now + 22 * MS.h
  if (item.column === 'running' || item.column === 'needs') { windowStart = now - 3 * MS.h; windowEnd = now + 3 * MS.h }
  else if (item.column === 'settled') { windowStart = now - 20 * MS.h; windowEnd = now + 4 * MS.h }
  let bar
  if (item.source === 'session' && item.span === true && item.at !== undefined) {
    bar = { start: Math.max(windowStart, item.at), end: item.end ?? now, open: item.end === undefined }
  } else if (item.source === 'job' && item.at !== undefined) {
    bar = { start: Math.max(windowStart, item.at), end: Math.min(windowEnd, item.end ?? now), open: item.end === undefined }
  }
  const badges = []
  const routeLabel = item.routeLabel ?? ''
  if (item.providerKind === 'local' || item.providerKind === 'native') {
    badges.push(h(Badge, { key: 'route', kind: item.providerKind, title: routeLabel },
      item.providerKind === 'local' ? t('badge.local') : t('badge.native')))
  }
  if (item.child === true) badges.push(h(Badge, { key: 'child', kind: 'child', title: item.parentTitle ?? '' }, t('badge.child')))
  if (item.teamTotal > 0) badges.push(h(Badge, { key: 'team', kind: 'team' }, `${t('badge.team')} ${item.teamTotal}`))
  if (item.state === 'paused') badges.push(h(Badge, { key: 'paused', kind: 'paused' }, t('badge.paused')))
  if (item.state === 'ended') badges.push(h(Badge, { key: 'ended', kind: 'ended' }, t('badge.ended')))
  if (item.state === 'failed') badges.push(h(Badge, { key: 'failed', kind: 'failed' }, t('badge.failed')))
  if (item.state === 'killed') badges.push(h(Badge, { key: 'killed', kind: 'failed' }, t('badge.ended')))
  if (item.unread === true) badges.push(h(Badge, { key: 'unread', kind: 'needs' }, t('badge.unread')))
  if (item.workspaceLabel !== undefined && item.workspaceLabel !== '' && item.source !== 'job') {
    badges.push(h(Badge, { key: 'ws', kind: 'ws' }, item.workspaceLabel))
  }

  const actions = []
  const act = (key, label, name, danger) => {
    if (!item.column) return
    const isArmed = armedKey === `${item.key}:${key}`
    actions.push(h('button', {
      key,
      type: 'button',
      className: `asx-btn asx-btnGhost asx-action${danger ? ' asx-btnDanger' : ''}`,
      'data-armed': isArmed ? 'true' : undefined,
      disabled: busy,
      onClick: (event) => { event.stopPropagation(); onAction(item, key) },
    }, isArmed ? t('action.confirm') : label))
  }
  if (item.source === 'schedule') {
    if (item.state === 'active' || item.state === 'paused') act('run', t('action.run'), 'run')
    if (item.state === 'active') act('pause', t('action.pause'), 'pause')
    if (item.state === 'paused') act('resume', t('action.resume'), 'resume')
    if (item.sessionId !== undefined) act('open', t('action.open'), 'open')
    act('delete', t('action.delete'), 'delete', true)
  } else if (item.source === 'session') {
    act('open', t('action.open'), 'open')
    if (item.column === 'running') act('stop', t('action.stop'), 'stop', true)
    if (item.column === 'settled') act('dismiss', t('action.dismiss'), 'dismiss')
  } else if (item.source === 'job') {
    act('open', t('action.open'), 'open')
    if (item.column === 'running') act('kill', t('action.kill'), 'kill', true)
  }

  return h('article', {
    className: 'asx-card',
    'data-tone': tone,
    'data-state': item.state,
    'data-selected': selected ? 'true' : undefined,
    tabIndex: 0,
    onClick: () => { onSelect(item.key) },
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.key) }
    },
  },
  h('div', { className: 'asx-cardTop' },
    h('span', { className: 'asx-glyph' }, h(Glyph, { name: itemGlyph(item), size: 13, spin: item.column === 'running' && item.source === 'session' })),
    h('span', { className: 'asx-cardTitle', title: item.title }, item.title),
  ),
  badges.length > 0 ? h('div', { className: 'asx-badges' }, badges) : null,
  h('div', { className: 'asx-timeRow' },
    h('span', { className: 'asx-timeStrong' }, time.strong),
    time.soft !== undefined && time.soft !== '' ? h('span', { className: 'asx-dotSep' }) : null,
    time.soft !== undefined && time.soft !== '' ? h('span', { className: 'asx-sub', title: time.soft }, time.soft) : null,
  ),
  h(Ribbon, { windowStart, windowEnd, marks: item.marks, bar, now }),
  (item.team?.length ?? 0) > 0 ? h('div', { className: 'asx-team' },
    item.team.slice(0, 4).map((task) => h('div', { key: task.key, className: 'asx-teamRow', title: task.owner ?? task.title },
      h('span', { className: 'asx-teamDot', 'data-s': task.status }),
      h('span', null, task.title),
    )),
  ) : null,
  actions.length > 0 ? h('div', { className: 'asx-actions' }, actions) : null,
  )
}

/**
 * One board column.
 * @param {{column: string, label: string, tone: string, count: number, empty: string, children: unknown}} props - column content.
 * @returns {object} section element.
 */
function Column({ column, label, tone, count, empty, children }) {
  return h('section', { className: 'asx-col', 'data-tone': tone, 'aria-label': label },
    h('header', { className: 'asx-colHead' },
      h('span', { className: 'asx-colDot' }),
      h('span', { className: 'asx-colName' }, label),
      h('span', { className: 'asx-count' }, count),
    ),
    h('div', { className: 'asx-cards' },
      count === 0 ? h('div', { className: 'asx-colEmpty' }, empty) : children,
    ),
  )
}

/**
 * Inline notice strip.
 * @param {{tone: string, text: string, onDismiss: Function, t: Function}} props - notice.
 * @returns {object} div element.
 */
function Banner({ tone, text, onDismiss, t }) {
  return h('div', { className: 'asx-banner', 'data-tone': tone, role: 'status' },
    h(Glyph, { name: tone === 'ok' ? 'check' : 'warn', size: 13 }),
    h('span', { className: 'asx-bannerText' }, text),
    h('button', { type: 'button', className: 'asx-btn asx-btnGhost', onClick: onDismiss, 'aria-label': t('error.dismiss') },
      h(Glyph, { name: 'close', size: 12 })),
  )
}

/**
 * A labelled form field.
 * @returns {object} label wrapper.
 */
function Field({ label, span, children }) {
  return h('label', { className: `asx-field${span === undefined ? '' : ` asx-span-${span}`}` },
    h('span', { className: 'asx-label' }, label),
    children,
  )
}
