/**
 * Off-peak — registration, persistence wiring, and the schedule write.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/**
 * Register the model-menu row, the composer control, and the settings row.
 * @param {object} ctx - the browser Cordis context.
 * @returns {void}
 */
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'offpeak: dictionaries')

  const scheduleApi = ctx.remote.schedule
  const store = createStore(loadPreferences())
  const persist = () => { savePreferences(store.getSnapshot()) }

  const actions = {
    /** Change the default for chats without their own choice. */
    setDefault(enabled) {
      store.patch({ defaultEnabled: enabled === true })
      persist()
    },
    /** Flip one chat's choice away from its current effective value. */
    toggleSession(sessionId) {
      const current = effectiveEnabled(store.getSnapshot(), sessionId)
      store.patch({ overrides: { ...store.getSnapshot().overrides, [sessionId]: !current } })
      persist()
    },
    /**
     * Queue one draft for the next off-peak start by creating a one-time
     * durable task that delivers into this session.
     * @param {{sessionId: string, text: string}} request - target chat and prompt.
     * @returns {Promise<{ok: true, at: number} | {ok: false, message: string}>} outcome.
     */
    async queue({ sessionId, text }) {
      const at = nextOffPeakStart(Date.now())
      if (at === null || at - Date.now() < MIN_DELAY_MS) return { ok: false, message: 'off-peak-now' }
      try {
        await callRemote(() => scheduleApi.create({
          title: titleOf(text),
          prompt: text,
          timing: {
            kind: 'at',
            at: { date: fmtZoneDate(at), time: fmtZoneTime(at), time_zone: ZONE },
          },
          target: { kind: 'session', sessionId },
        }))
        return { ok: true, at }
      } catch (error) {
        return { ok: false, message: error?.code ?? String(error?.message ?? error) }
      }
    },
  }

  const inject = () => ({ hooks: { offpeak: store }, actions })

  ctx.slots.inject('conversation.input.model.options', () => ctx.slots.register({
    name: 'conversation.input.model.options',
    id: 'offpeak',
    order: 20,
    locale: NS,
    inject,
  }, OffpeakMenuRow))

  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'offpeak-send',
    // Sits immediately before the composer's Send action.
    order: -5,
    locale: NS,
    inject,
  }, OffpeakSendControl))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'offpeak',
    order: 21,
    locale: NS,
    inject,
  }, OffpeakSettingsRow))
}

/**
 * Required client services. The schedule Remote namespace is mandatory: without
 * it the plugin cannot defer anything, so it stays inactive rather than
 * offering a control that cannot work.
 */
const inject = ['slots', 'locale', 'remote', 'remote.schedule']

return { inject, apply }
