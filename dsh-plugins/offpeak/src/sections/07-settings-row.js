/**
 * Off-peak — the Settings > General row that owns the default and shows the
 * calendar state.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Settings row: the default switch plus the current calendar state.
 * @param {{t: Function, useOffpeak: Function, actions: object}} props - copy, store hook, and operations.
 * @returns {object} the row.
 */
function OffpeakSettingsRow({ t, useOffpeak, actions }) {
  useTicker(TICK_MS)
  const state = useOffpeak((snapshot) => snapshot)
  const now = Date.now()
  const next = nextOffPeakStart(now)
  const peak = next !== null

  return h(Sheet, null, h('div', { className: 'ofp-settings' },
    h('div', { className: 'ofp-settingsText' },
      h('div', { className: 'ofp-title' }, t('settings.title')),
      h('div', { className: 'ofp-desc' }, t('settings.description', {
        windows: describeWindows(PEAK_WINDOWS, t),
        zone: ZONE,
      })),
      h('div', { className: 'ofp-status', 'data-tone': peak ? 'peak' : undefined },
        peak
          ? t('settings.status.peak', { time: fmtZoneClock(next) })
          : t('settings.status.offpeak')),
    ),
    h('div', { className: 'ofp-settingsControl' },
      h('span', { className: 'ofp-settingsValue' }, state.defaultEnabled ? t('settings.on') : t('settings.off')),
      h(SwitchButton, {
        checked: state.defaultEnabled,
        label: t('settings.switchLabel'),
        onChange: () => { actions.setDefault(!state.defaultEnabled) },
      }),
    ),
  ))
}
