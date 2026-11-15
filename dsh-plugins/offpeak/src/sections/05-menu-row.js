/**
 * Off-peak — the model-menu row: the per-chat switch and the peak state.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Wrap one contribution with its stylesheet. The style element is a React
 * element, so it unmounts with the contribution that needed it.
 * @param {{children: unknown}} props - contribution content.
 * @returns {object} fragment carrying the sheet and the content.
 */
function Sheet({ children }) {
  return h(React.Fragment, null, h('style', { key: 'ofp-css' }, CSS), children)
}

/**
 * The shared switch control.
 * @param {{checked: boolean, label: string, disabled?: boolean, onChange: () => void}} props - switch state.
 * @returns {object} button element with switch semantics.
 */
function SwitchButton({ checked, label, disabled, onChange }) {
  return h('button', {
    type: 'button',
    className: 'ofp-switch',
    role: 'switch',
    'aria-checked': checked ? 'true' : 'false',
    'aria-label': label,
    disabled: disabled === true,
    onClick: (event) => { event.stopPropagation(); if (disabled !== true) onChange() },
  })
}

/** Moon glyph for the composer control. */
function MoonGlyph({ size = 13 }) {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.35, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }, h('path', { d: 'M13 9.6A5.2 5.2 0 0 1 6.4 3 5.4 5.4 0 1 0 13 9.6z' }))
}

/**
 * Model-menu row: the per-chat off-peak switch, its persisted choice, and the
 * peak state of the calendar right now.
 * @param {{sessionId: string, t: Function, useOffpeak: Function, actions: object}} props - session, copy, store hook, and operations.
 * @returns {object | null} the row.
 */
function OffpeakMenuRow({ sessionId, t, useOffpeak, actions }) {
  useTicker(TICK_MS)
  const state = useOffpeak((snapshot) => snapshot)
  const enabled = effectiveEnabled(state, sessionId)
  const now = Date.now()
  const next = enabled ? nextOffPeakStart(now) : null
  const peak = enabled && next !== null
  const tone = enabled ? (peak ? 'peak' : 'ok') : 'off'
  const status = !enabled
    ? t('menu.state.off')
    : peak
      ? t('menu.state.peak', { time: fmtZoneClock(next) })
      : t('menu.state.offpeak')
  const toggle = () => { actions.toggleSession(sessionId) }

  return h(Sheet, null, h('div', {
    className: 'ofp-row',
    onClick: toggle,
    title: t('menu.description'),
  },
  h('div', { className: 'ofp-rowText' },
    h('span', { className: 'ofp-rowLabel' }, t('menu.label')),
    h('span', { className: 'ofp-rowState', 'data-tone': tone }, status),
  ),
  h(SwitchButton, {
    checked: enabled,
    label: t('menu.switchLabel'),
    onChange: toggle,
  }),
  ))
}
