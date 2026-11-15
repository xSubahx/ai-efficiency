/**
 * Off-peak — constants, locale dictionary, and zone/time helpers.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

const NS = 'offpeak'

/** Browser-local preference record; UI preferences follow keybindings and stay origin-local. */
const STORAGE_KEY = 'dsh.offpeak.v1'

/** Zone the peak schedule is written in. Weekday peak windows are wall-clock in this zone. */
const ZONE = 'Asia/Riyadh'

/**
 * Weekday peak windows, as half-open `[start, end)` minutes inside one day.
 * Everything outside them is off-peak; weekends are off-peak all day.
 */
const PEAK_WINDOWS = [
  { days: [1, 2, 3, 4, 5], start: 4 * 60, end: 7 * 60 },
  { days: [1, 2, 3, 4, 5], start: 9 * 60, end: 13 * 60 },
]

/** How often the composer control re-reads the clock while it is mounted. */
const TICK_MS = 30000

/** How long the "queued" confirmation stays on the composer control. */
const QUEUED_MS = 6000

/** Locale dictionary. Every visible string in this bundle is one of these keys. */
const EN = {
  'menu.label': 'Off-peak only',
  'menu.state.peak': 'Peak now — sends can wait until {time}',
  'menu.state.offpeak': 'Off-peak now — sends go immediately',
  'menu.state.off': 'Sends go immediately',
  'menu.description': 'During peak hours, defer this chat’s prompt to the next off-peak start. Switch it off for this chat to send immediately.',
  'menu.switchLabel': 'Off-peak only for this chat',

  'send.action': 'Send at {time}',
  'send.title': 'Queue this prompt for the next off-peak window',
  'send.disabledAttachments': 'Attachments can’t be queued for off-peak',
  'send.disabledCommand': 'Commands run immediately',
  'send.disabledBusy': 'Wait for the current send to finish',
  'send.queued': 'Queued for {time}',
  'send.failed': 'Could not queue this prompt',

  'settings.title': 'Off-peak only',
  'settings.description': 'Weekday peak hours are {windows} ({zone}). During peak, a prompt queued from the composer is delivered at the next off-peak start instead of running immediately. Each chat can switch this off from its model menu.',
  'settings.status.peak': 'Peak right now · next off-peak at {time}',
  'settings.status.offpeak': 'Off-peak right now',
  'settings.switchLabel': 'Off-peak only by default for new and unset chats',
  'settings.on': 'On',
  'settings.off': 'Off',

  'window.weekdays': 'Mon–Fri',
  'window.range': '{start}–{end}',
  'window.separator': ', ',
}

/** Milliseconds per unit. */
const MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 }

/** Two-digit padding. */
function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Zone offset in milliseconds at one instant.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @returns {number} local minus UTC offset.
 */
function zoneOffset(ms, zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms))
    const value = {}
    for (const part of parts) if (part.type !== 'literal') value[part.type] = part.value
    const asUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day),
      Number(value.hour) % 24, Number(value.minute), Number(value.second))
    return asUtc - ms
  } catch {
    return 0
  }
}

/**
 * Wall-clock calendar date and clock of one instant in a zone.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @returns {{y: number, mo: number, d: number, hh: number, mm: number, ss: number}} parts.
 */
function zoneParts(ms, zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms))
    const value = {}
    for (const part of parts) if (part.type !== 'literal') value[part.type] = part.value
    return {
      y: Number(value.year), mo: Number(value.month), d: Number(value.day),
      hh: Number(value.hour) % 24, mm: Number(value.minute), ss: Number(value.second),
    }
  } catch {
    const date = new Date(ms)
    return {
      y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate(),
      hh: date.getUTCHours(), mm: date.getUTCMinutes(), ss: date.getUTCSeconds(),
    }
  }
}

/**
 * Convert one wall-clock time in a zone to a UTC instant.
 * @param {number} y - four-digit year.
 * @param {number} mo - 1-based month.
 * @param {number} d - day of month.
 * @param {number} hh - hour.
 * @param {number} mm - minute.
 * @param {string} zone - IANA zone.
 * @returns {number} UTC instant in milliseconds.
 */
function zonedToUtc(y, mo, d, hh, mm, zone) {
  const guess = Date.UTC(y, mo - 1, d, hh, mm, 0)
  const first = guess - zoneOffset(guess, zone)
  return guess - zoneOffset(first, zone)
}

/** `HH:MM` of one instant in the configured zone. */
function fmtZoneClock(ms, zone = ZONE) {
  const parts = zoneParts(ms, zone)
  return `${pad2(parts.hh)}:${pad2(parts.mm)}`
}

/** `YYYY-MM-DD` of one instant in the configured zone. */
function fmtZoneDate(ms, zone = ZONE) {
  const parts = zoneParts(ms, zone)
  return `${parts.y}-${pad2(parts.mo)}-${pad2(parts.d)}`
}

/** `HH:MM:00` of one instant in the configured zone, for schedule input. */
function fmtZoneTime(ms, zone = ZONE) {
  const parts = zoneParts(ms, zone)
  return `${pad2(parts.hh)}:${pad2(parts.mm)}:00`
}
