/**
 * Off-peak — the preference store, its browser persistence, and small helpers.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Minimal synchronous observable store; the framework binds a `hooks.*` member
 * into a `use*` selector hook.
 * @param {unknown} initial - first snapshot.
 * @returns {object} store with getSnapshot, subscribe, set, patch.
 */
function createStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      if (Object.is(next, snapshot)) return
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    patch: (fields) => {
      snapshot = { ...snapshot, ...fields }
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Default preference record: off-peak on. */
const DEFAULTS = Object.freeze({ defaultEnabled: true, overrides: Object.freeze({}) })

/**
 * Read the persisted record, tolerating storage absence, malformed JSON, and
 * unknown shapes. A missing or invalid record means the defaults.
 * @returns {{defaultEnabled: boolean, overrides: object}} record.
 */
function loadPreferences() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (typeof raw !== 'string' || raw.length === 0) return { ...DEFAULTS, overrides: {} }
    const parsed = JSON.parse(raw)
    const defaultEnabled = typeof parsed?.defaultEnabled === 'boolean' ? parsed.defaultEnabled : DEFAULTS.defaultEnabled
    const overrides = {}
    if (parsed?.overrides !== null && typeof parsed?.overrides === 'object') {
      for (const [sessionId, value] of Object.entries(parsed.overrides)) {
        if (typeof value === 'boolean' && sessionId.length > 0) overrides[sessionId] = value
      }
    }
    return { defaultEnabled, overrides }
  } catch {
    return { ...DEFAULTS, overrides: {} }
  }
}

/**
 * Persist the record; a refused or unavailable store leaves the in-memory value
 * authoritative for this page.
 * @param {{defaultEnabled: boolean, overrides: object}} value - record.
 * @returns {void}
 */
function savePreferences(value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
      defaultEnabled: value.defaultEnabled,
      overrides: value.overrides,
    }))
  } catch {
    // Private-mode or quota failures keep the preference for this page only.
  }
}

/**
 * Effective off-peak choice of one session.
 * @param {{defaultEnabled: boolean, overrides: object}} state - record.
 * @param {string | undefined} sessionId - chat identity.
 * @returns {boolean} true when sends should defer during peak.
 */
function effectiveEnabled(state, sessionId) {
  if (sessionId !== undefined && Object.prototype.hasOwnProperty.call(state.overrides, sessionId)) {
    return state.overrides[sessionId] === true
  }
  return state.defaultEnabled === true
}

/**
 * Re-render on a fixed cadence so the peak state of the control stays current.
 * @param {number} intervalMs - tick period.
 * @returns {number} tick.
 */
function useTicker(intervalMs) {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => { setTick((value) => value + 1) }, intervalMs)
    return () => { clearInterval(id) }
  }, [intervalMs])
  return Math.floor(Date.now() / intervalMs)
}

/**
 * Unwrap one Remote result into its value, throwing an Error carrying the code.
 * @param {{ok: boolean, value?: unknown, error?: {code: string, message: string}}} result - Remote result.
 * @returns {unknown} value.
 */
function unwrap(result) {
  if (result === undefined) throw new Error('no-result')
  if (result.ok === true) return result.value
  const error = new Error(result.error?.message ?? result.error?.code ?? 'remote-failure')
  error.code = result.error?.code
  throw error
}

/**
 * Run one Remote call, normalizing transport rejections.
 * @param {() => Promise<object>} call - Remote call.
 * @returns {Promise<unknown>} value.
 */
async function callRemote(call) {
  try {
    return unwrap(await call())
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) throw error
    const wrapped = new Error(String(error?.message ?? error))
    wrapped.code = 'transport'
    throw wrapped
  }
}

/**
 * Schedule title from a prompt: its first non-empty line, bounded to the
 * Host's 120-character title limit.
 * @param {string} text - prompt.
 * @returns {string} title.
 */
function titleOf(text) {
  const line = String(text).split('\n').map((part) => part.trim()).find((part) => part.length > 0) ?? ''
  return line.length > 120 ? `${line.slice(0, 117)}…` : line.length > 0 ? line : 'Off-peak prompt'
}
