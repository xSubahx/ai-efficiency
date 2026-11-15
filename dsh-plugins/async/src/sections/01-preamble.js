/**
 * Async — constants, locale dictionary, and formatting helpers.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

const NS = 'async'
const PANEL_ID = 'async'
const NSCHED = 'async.tasks'

/** Locale dictionary. Every visible string in this bundle is one of these keys. */
const EN = {
  'panel.title': 'Async',
  'panel.subtitle': 'One-time and recurring work, and what is running right now',
  'panel.board': 'Board',
  'panel.timeline': 'Timeline',
  'panel.new': 'New async work',
  'panel.refresh': 'Refresh',
  'panel.loading': 'Loading async work…',
  'panel.count': '{n} items',
  'panel.empty': 'No async work yet. Schedule something, or start an agent and leave it running.',

  'col.upcoming': 'Upcoming',
  'col.running': 'Running',
  'col.needs': 'Needs you',
  'col.settled': 'Settled',
  'col.upcoming.empty': 'Nothing scheduled',
  'col.running.empty': 'Nothing running',
  'col.needs.empty': 'Nothing waiting on you',
  'col.settled.empty': 'Nothing settled recently',

  'filter.all': 'All',
  'filter.schedule': 'Scheduled',
  'filter.session': 'Agents',
  'filter.job': 'Jobs',
  'filter.team': 'Team',

  'source.schedule': 'Schedule',
  'source.session': 'Agent',
  'source.job': 'Job',
  'source.team': 'Team task',
  'source.subagent': 'Subagent',

  'badge.local': 'Local',
  'badge.native': 'Native',
  'badge.child': 'Child',
  'badge.team': 'Team',
  'badge.paused': 'Paused',
  'badge.ended': 'Ended',
  'badge.failed': 'Failed',
  'badge.done': 'Done',
  'badge.unread': 'New',
  'badge.queued': 'Queued',
  'badge.live': 'Observed',

  'time.in': 'in {when}',
  'time.ago': '{when} ago',
  'time.overdue': 'due now',
  'time.now': 'now',
  'time.waiting': 'Waiting for you',
  'time.running': 'running {when}',
  'time.runningShort': 'running',
  'time.took': 'took {when}',
  'time.every': 'every {when}',
  'time.at': 'at {when}',
  'time.on': 'on {when}',

  'freq.every.n': 'Every {n}',
  'freq.every.m': 'Every {n} min',
  'freq.hourly': 'Hourly',
  'freq.daily': 'Daily at {time}',
  'freq.weekly': 'Weekly on {day} at {time}',
  'freq.cron': 'Cron {expr}',
  'freq.rrule': 'Repeating rule',
  'freq.once': 'Once',

  'action.open': 'Open session',
  'action.run': 'Run now',
  'action.pause': 'Pause',
  'action.resume': 'Resume',
  'action.delete': 'Delete',
  'action.confirm': 'Confirm delete',
  'action.stop': 'Stop',
  'action.kill': 'Stop job',
  'action.dismiss': 'Dismiss',
  'action.newSession': 'Open a new session',

  'create.title': 'New async work',
  'create.prompt': 'What should the agent do?',
  'create.promptPlaceholder': 'Write the instruction that each run receives…',
  'create.name': 'Name',
  'create.namePlaceholder': 'Optional — defaults to the first line of the instruction',
  'create.when': 'When',
  'create.mode.now': 'Run now',
  'create.mode.later': 'Once at',
  'create.mode.repeat': 'Repeat',
  'create.laterLabel': 'Start at',
  'create.repeat': 'Repeat',
  'create.repeat.every': 'Every N minutes',
  'create.repeat.daily': 'Daily',
  'create.repeat.weekly': 'Weekly',
  'create.repeat.cron': 'Cron expression',
  'create.minutes': 'Minutes',
  'create.time': 'Time',
  'create.weekday': 'Day',
  'create.cronExpr': 'Expression',
  'create.executor': 'Run with',
  'create.executorDefault': 'Host default model',
  'create.workspace': 'Workspace',
  'create.workspaceDefault': 'Host project directory',
  'create.submitNow': 'Run now',
  'create.submitSchedule': 'Schedule',
  'create.cancel': 'Cancel',
  'create.workerNote': 'A worker session is created for this model and named after the task.',
  'create.zone': 'Times use {zone}',
  'create.needPrompt': 'Write an instruction first.',
  'create.needTime': 'Pick a date and time.',
  'create.needCron': 'Write a five-field cron expression.',
  'create.needMinutes': 'Enter a positive number of minutes.',
  'create.ok.now': 'Started a session.',
  'create.ok.scheduled': 'Scheduled.',
  'create.willRepeat': 'Repeating',
  'create.willOnce': 'One-time',

  'weekday.1': 'Monday',
  'weekday.2': 'Tuesday',
  'weekday.3': 'Wednesday',
  'weekday.4': 'Thursday',
  'weekday.5': 'Friday',
  'weekday.6': 'Saturday',
  'weekday.7': 'Sunday',

  'timeline.window': 'Window',
  'timeline.6h': '6h',
  'timeline.24h': '24h',
  'timeline.7d': '7d',
  'timeline.30d': '30d',
  'timeline.group': 'Group by',
  'timeline.bySource': 'Source',
  'timeline.byExecutor': 'Executor',
  'timeline.byWorkspace': 'Workspace',
  'timeline.lane.schedule': 'Schedules',
  'timeline.lane.session': 'Agents',
  'timeline.lane.job': 'Jobs',
  'timeline.lane.native': 'DeepSeek native',
  'timeline.lane.local': 'Local / other',
  'timeline.lane.none': 'No workspace',
  'timeline.empty': 'Nothing in this window',
  'timeline.item': 'Item',
  'timeline.past': 'Delivered',
  'timeline.future': 'Scheduled',
  'timeline.note': 'Future runs are projected from the timing rule; past runs are saved deliveries. Agent bars start when this page first observed them running.',

  'error.refresh': 'Could not load async work.',
  'error.action': 'That action did not complete.',
  'error.dismiss': 'Dismiss',
  'error.history': 'Could not read delivery history.',

  'job.output': '{bytes} B of output',
}

/** Milliseconds per unit. */
const MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
/** Ticking clock resolution for countdowns. */
const TICK_MS = 1000
/** Sessions whose job rosters are watched at once. */
const WATCH_LIMIT = 8
/** Schedules whose delivery history the timeline reads at once. */
const HISTORY_LIMIT = 40
/** Delivery-history cache lifetime. */
const HISTORY_TTL = 60000
/** Two-press confirmation window for destructive card actions. */
const ARM_MS = 3000
/** Schedule catalog re-read coalescing. */
const REFRESH_COALESCE = 400

/** Board columns, in display order. */
const COLUMNS = ['upcoming', 'running', 'needs', 'settled']

/**
 * Two-digit clock padding.
 * @param {number} n - non-negative integer.
 * @returns {string} padded value.
 */
function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Compact duration without words: 45s, 12m, 3h 4m, 2d.
 * @param {number} ms - duration in milliseconds.
 * @returns {string} compact duration.
 */
function fmtDuration(ms) {
  const v = Math.max(0, Math.round(ms / 1000))
  if (v < 60) return `${v}s`
  const m = Math.floor(v / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 === 0 ? `${h}h` : `${h}h ${pad2(m % 60)}m`
  const d = Math.floor(h / 24)
  return h % 24 === 0 ? `${d}d` : `${d}d ${h % 24}h`
}

/**
 * Elapsed duration with seconds under a minute: 8s, 12m 04s, 3h 12m.
 * @param {number} ms - duration in milliseconds.
 * @returns {string} elapsed duration.
 */
function fmtElapsed(ms) {
  const v = Math.max(0, Math.round(ms / 1000))
  if (v < 60) return `${v}s`
  const m = Math.floor(v / 60)
  if (m < 60) return `${m}m ${pad2(v % 60)}s`
  const h = Math.floor(m / 60)
  return `${h}h ${pad2(m % 60)}m`
}

/** Browser-resolved IANA zone, falling back to UTC. */
function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
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

/**
 * Wall-clock calendar date and clock of one instant in a zone.
 * @param {number} ms - UTC instant.
 * @param {string} zone - IANA zone.
 * @returns {{y: number, mo: number, d: number, hh: number, mm: number}} wall-clock parts.
 */
function zoneParts(ms, zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(ms))
    const value = {}
    for (const part of parts) if (part.type !== 'literal') value[part.type] = part.value
    return {
      y: Number(value.year), mo: Number(value.month), d: Number(value.day),
      hh: Number(value.hour) % 24, mm: Number(value.minute),
    }
  } catch {
    const date = new Date(ms)
    return { y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate(), hh: date.getUTCHours(), mm: date.getUTCMinutes() }
  }
}

/** Short clock label for a timestamp. */
function fmtClock(ms) {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Short weekday label for a timestamp. */
function fmtWeekday(ms) {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(ms))
  } catch {
    return ''
  }
}

/** Day + clock label, e.g. `Mon 14:05`. */
function fmtDayClock(ms) {
  const d = new Date(ms)
  return `${fmtWeekday(ms)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Month + day label, e.g. `18 Nov`. */
function fmtDate(ms) {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(ms))
  } catch {
    return fmtDayClock(ms)
  }
}

/** `YYYY-MM-DD` in local time, for datetime-local inputs. */
function fmtDateInput(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** `HH:MM` in local time, for time inputs. */
function fmtTimeInput(ms) {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Whether one schedule occurrence is in the past.
 * @param {number} at - occurrence instant.
 * @param {number} now - current instant.
 * @returns {boolean} true when due or overdue.
 */
function isPast(at, now) {
  return at <= now
}
