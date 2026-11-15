/**
 * Off-peak — the composer control that queues the draft for the next off-peak
 * start. It appears only while the chat is off-peak-only and the calendar is in
 * a peak window; otherwise the ordinary Send is already immediate.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/** Minimum distance to the boundary before queueing is worth offering. */
const MIN_DELAY_MS = 60000

/**
 * Composer control beside Send.
 * @param {object} props - session, input snapshot and actions, store hook, copy, and operations.
 * @returns {object | null} the control, or null when it has nothing to offer.
 */
function OffpeakSendControl(props) {
  const { sessionId, t, useInput, inputActions, useSession, useOffpeak, actions } = props
  useTicker(TICK_MS)
  const draft = useInput((state) => state.draft)
  const phase = useInput((state) => state.phase)
  const attachmentCount = useInput((state) => state.attachmentIds.length)
  // The Host refuses a Session target that is a delegated child.
  const isChild = useSession((snapshot) => snapshot.subagent != null)
  const state = useOffpeak((snapshot) => snapshot)
  const [pending, setPending] = React.useState(false)
  const [outcome, setOutcome] = React.useState(null)

  // The confirmation retires on its own, and immediately once the user starts
  // the next prompt.
  React.useEffect(() => {
    if (outcome === null || outcome.tone !== 'queued') return
    if (draft.length > 0) { setOutcome(null); return }
    const id = setTimeout(() => { setOutcome(null) }, QUEUED_MS)
    return () => { clearTimeout(id) }
  }, [outcome, draft])

  const enabled = effectiveEnabled(state, sessionId)
  const now = Date.now()
  const boundary = enabled ? nextOffPeakStart(now) : null
  const peak = boundary !== null && boundary - now >= MIN_DELAY_MS
  if (!peak || isChild) return null

  const text = draft.trim()
  const isCommand = text.startsWith('/')
  const busy = phase !== 'plain'
  const queueable = text.length > 0 && !isCommand && !busy && attachmentCount === 0 && !pending
  const disabledReason = attachmentCount > 0
    ? t('send.disabledAttachments')
    : isCommand
      ? t('send.disabledCommand')
      : busy
        ? t('send.disabledBusy')
        : t('send.title')

  const queue = async () => {
    if (!queueable) return
    setPending(true)
    setOutcome(null)
    try {
      const result = await actions.queue({ sessionId, text: draft })
      if (!result.ok) {
        setOutcome({ tone: 'error', detail: result.message })
        return
      }
      inputActions.setDraft('')
      inputActions.persistDraft()
      setOutcome({ tone: 'queued', at: result.at })
    } finally {
      setPending(false)
    }
  }

  const queued = outcome !== null && outcome.tone === 'queued'
  const failed = outcome !== null && outcome.tone === 'error'
  const label = queued
    ? t('send.queued', { time: fmtZoneClock(outcome.at) })
    : failed
      ? t('send.failed')
      : t('send.action', { time: fmtZoneClock(boundary) })
  const title = queued
    ? t('send.title')
    : failed
      ? `${t('send.failed')}${outcome.detail === undefined ? '' : ` (${outcome.detail})`}`
      : disabledReason

  return h(Sheet, null, h('button', {
    type: 'button',
    className: 'ofp-send',
    'data-tone': queued ? 'queued' : failed ? 'error' : undefined,
    disabled: !queueable,
    title,
    'aria-label': label,
    onClick: (event) => { event.preventDefault(); event.stopPropagation(); void queue() },
  },
  h('span', { className: 'ofp-sendGlyph' }, h(MoonGlyph, { size: 13 })),
  h('span', null, label),
  ))
}
