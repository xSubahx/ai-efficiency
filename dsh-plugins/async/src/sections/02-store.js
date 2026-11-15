/**
 * Async — observable stores and small React conveniences.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Minimal synchronous observable store. The framework binds a `hooks.*` member
 * into a `use*` selector hook, so this only needs getSnapshot + subscribe.
 * @param {unknown} initial - first snapshot.
 * @returns {object} store with getSnapshot, subscribe, set, update.
 */
function createStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  const emit = () => { for (const listener of [...listeners]) listener() }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    /** Replace the snapshot when it is a different reference. */
    set: (next) => {
      if (Object.is(next, snapshot)) return
      snapshot = next
      emit()
    },
    /** Patch the snapshot with a shallow merge. */
    patch: (fields) => {
      const next = { ...snapshot, ...fields }
      snapshot = next
      emit()
    },
  }
}

/**
 * Re-render on a fixed cadence so every countdown on the panel stays honest.
 * @param {number} intervalMs - tick period.
 * @returns {number} monotonically incrementing tick.
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
 * Armable destructive control: the first press arms, the second press within
 * the window runs the action.
 * @param {number} windowMs - confirmation window.
 * @returns {{armed: string | null, arm: (key: string) => boolean, disarm: () => void}} arming state.
 */
function useArmed(windowMs) {
  const [armed, setArmed] = React.useState(null)
  const timer = React.useRef(null)
  const clear = React.useCallback(() => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null }
  }, [])
  const disarm = React.useCallback(() => { clear(); setArmed(null) }, [clear])
  const arm = React.useCallback((key) => {
    if (armed === key) { disarm(); return true }
    clear()
    setArmed(key)
    timer.current = setTimeout(() => { setArmed(null); timer.current = null }, windowMs)
    return false
  }, [armed, clear, disarm, windowMs])
  React.useEffect(() => () => { clear() }, [clear])
  return { armed, arm, disarm }
}

/**
 * Normalize a Remote outcome into a value or a thrown Error with its code.
 * @param {{ok: boolean, value?: unknown, error?: {code: string, message: string}}} result - Remote result.
 * @returns {unknown} the value.
 */
function unwrap(result) {
  if (result === undefined) throw new Error('no-result')
  if (result.ok === true) return result.value
  const error = new Error(result.error?.message ?? result.error?.code ?? 'remote-failure')
  error.code = result.error?.code
  throw error
}

/**
 * Run one Remote call, turning a transport rejection into the same Error shape.
 * @param {() => Promise<{ok: boolean, value?: unknown, error?: object}>} call - Remote call.
 * @returns {Promise<unknown>} resolved value.
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

/** Session request ids must be unique per accepted prompt. */
let requestCounter = 0
function nextRequestId() {
  requestCounter += 1
  return `async-ui-${Date.now().toString(36)}-${requestCounter}`
}

/**
 * Human failure text for one Remote error, localized by code family.
 * @param {unknown} error - thrown error.
 * @param {Function} t - translator.
 * @param {string} fallback - fallback key.
 * @returns {string} display text.
 */
function errorText(error, t, fallback) {
  const code = error?.code
  if (typeof code === 'string' && code.startsWith('schedule/')) return `${t(fallback)} (${code})`
  if (typeof code === 'string' && code.length > 0) return `${t(fallback)} (${code})`
  return t(fallback)
}
