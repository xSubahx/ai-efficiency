/**
 * Off-peak — the peak/off-peak calendar.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/** Short English weekday labels, indexed by ISO weekday minus one. */
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * ISO weekday (Monday 1 … Sunday 7) of one instant in a zone.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @returns {number} ISO weekday.
 */
function zoneWeekday(ms, zone) {
  const parts = zoneParts(ms, zone)
  const day = new Date(Date.UTC(parts.y, parts.mo - 1, parts.d)).getUTCDay()
  return day === 0 ? 7 : day
}

/**
 * Minutes since local midnight of one instant in a zone.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @returns {number} minute of day.
 */
function zoneMinuteOfDay(ms, zone) {
  const parts = zoneParts(ms, zone)
  return parts.hh * 60 + parts.mm
}

/**
 * The peak window containing one instant, if any.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @param {Array} windows - peak windows.
 * @returns {object | null} containing window.
 */
function peakWindowAt(ms, zone = ZONE, windows = PEAK_WINDOWS) {
  const weekday = zoneWeekday(ms, zone)
  const minute = zoneMinuteOfDay(ms, zone)
  for (const window of windows) {
    if (!window.days.includes(weekday)) continue
    if (minute >= window.start && minute < window.end) return window
  }
  return null
}

/**
 * Whether one instant falls inside a weekday peak window.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @param {Array} windows - peak windows.
 * @returns {boolean} true during peak.
 */
function isPeakAt(ms, zone = ZONE, windows = PEAK_WINDOWS) {
  return peakWindowAt(ms, zone, windows) !== null
}

/**
 * First instant after `ms` that is off-peak, or null when `ms` is already
 * off-peak. A peak window never crosses midnight in this configuration, so the
 * answer is always the end of the window that contains `ms`.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @param {Array} windows - peak windows.
 * @returns {number | null} next off-peak start.
 */
function nextOffPeakStart(ms, zone = ZONE, windows = PEAK_WINDOWS) {
  const window = peakWindowAt(ms, zone, windows)
  if (window === null) return null
  const parts = zoneParts(ms, zone)
  const boundary = zonedToUtc(parts.y, parts.mo, parts.d, Math.floor(window.end / 60), window.end % 60, zone)
  // A daylight-saving shift can put the boundary before `ms` on the same day;
  // the window's end then belongs to the following day.
  if (boundary > ms) return boundary
  const next = new Date(Date.UTC(parts.y, parts.mo - 1, parts.d + 1))
  return zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(),
    Math.floor(window.end / 60), window.end % 60, zone)
}

/**
 * Human label of one window's day set.
 * @param {number[]} days - ISO weekdays.
 * @returns {string} label.
 */
function describeDays(days) {
  if (days.length === 5 && days.join(',') === '1,2,3,4,5') return 'Mon–Fri'
  if (days.length === 7) return 'Every day'
  return days.map((day) => WEEKDAY_NAMES[day - 1]).join(', ')
}

/** `HH:MM` of one minute-of-day. */
function minuteLabel(minute) {
  return `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`
}

/**
 * Human label of the peak windows, groups of days collapsed into one phrase.
 * @param {Array} windows - peak windows.
 * @param {Function} t - translator.
 * @returns {string} e.g. `Mon–Fri 04:00–07:00, 09:00–13:00`.
 */
function describeWindows(windows, t) {
  const byDays = new Map()
  for (const window of windows) {
    const key = window.days.join(',')
    if (!byDays.has(key)) byDays.set(key, { days: window.days, ranges: [] })
    byDays.get(key).ranges.push(t('window.range', { start: minuteLabel(window.start), end: minuteLabel(window.end) }))
  }
  return [...byDays.values()]
    .map((group) => `${describeDays(group.days)} ${group.ranges.join(t('window.separator'))}`)
    .join(t('window.separator'))
}
