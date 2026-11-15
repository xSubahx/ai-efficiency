/**
 * Async — the board view: four derived lifecycle columns.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Card action dispatcher: destructive verbs need the second press.
 * @param {object} actions - injected operations.
 * @param {object} item - target item.
 * @param {string} verb - action id.
 * @param {Function} setBusy - busy setter.
 * @param {Function} arm - arming call.
 * @returns {Promise<void>} resolution after the attempt.
 */
async function dispatchCardAction(actions, item, verb, setBusy, arm) {
  const destructive = verb === 'delete' || verb === 'stop' || verb === 'kill'
  if (destructive && !arm(`${item.key}:${verb}`)) return
  setBusy(`${item.key}:${verb}`)
  try {
    await actions.act(item, verb)
  } finally {
    setBusy(null)
  }
}

/**
 * Render the four board columns for the current filter.
 * @param {{board: object, t: Function, filter: string, selected: string | null, onSelect: Function, actions: object}} props - projection and handlers.
 * @returns {object} board element.
 */
function Board(props) {
  const { board, t, filter, selected, onSelect, actions } = props
  const { armed, arm } = useArmed(ARM_MS)
  const [busy, setBusy] = React.useState(null)
  const now = Date.now()

  return h('div', { className: 'asx-board' }, COLUMNS.map((column) => {
    const items = (board.byColumn[column] ?? []).filter((item) => matchesFilter(item, filter))
    return h(Column, {
      key: column,
      column,
      label: t(`col.${column}`),
      tone: column,
      count: items.length,
      empty: t(`col.${column}.empty`),
    }, items.map((item) => h(Card, {
      key: item.key,
      item,
      now,
      t,
      selected: selected === item.key,
      busy: busy !== null && busy.startsWith(`${item.key}:`),
      armedKey: armed,
      onSelect,
      onAction: (target, verb) => { dispatchCardAction(actions, target, verb, setBusy, arm) },
    })))
  }))
}
