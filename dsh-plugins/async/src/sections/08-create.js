/**
 * Async — the creation form: an agent run now, or a durable one-time /
 * recurring task, optionally on a chosen model route.
 * Fragment of the bundle's client module; concatenated by build.mjs.
 */

/** Default `datetime-local` value: fifteen minutes from now. */
function defaultAtValue() {
  return `${fmtDateInput(Date.now() + 15 * MS.m)}T${fmtTimeInput(Date.now() + 15 * MS.m)}`
}

/** New form state. */
function emptyForm() {
  return {
    prompt: '',
    name: '',
    when: 'now',
    at: defaultAtValue(),
    repeat: 'every',
    minutes: '30',
    time: '09:00',
    weekday: '1',
    cron: '0 9 * * *',
    executor: '',
    workspace: '',
  }
}

/**
 * Default task name from the instruction's first line.
 * @param {string} prompt - instruction.
 * @returns {string} trimmed name.
 */
function titleFromPrompt(prompt) {
  const first = String(prompt).split('\n').map((line) => line.trim()).find((line) => line.length > 0) ?? ''
  return first.length > 80 ? `${first.slice(0, 77)}…` : first
}

/** Parse `provider|model` into a selection. */
function parseRoute(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const index = value.indexOf('|')
  if (index <= 0) return undefined
  return { provider: value.slice(0, index), model: value.slice(index + 1) }
}

/**
 * The creation form.
 * @param {object} props - injected actions, catalog data, and copy.
 * @returns {object} form element.
 */
function CreateForm({ actions, data, t, onClose }) {
  const [form, setForm] = React.useState(emptyForm)
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState(null)
  const set = (field) => (event) => {
    const { value } = event.target
    setForm((current) => ({ ...current, [field]: value }))
  }
  const zone = browserZone()
  const groups = data.groups ?? []
  const workspaces = data.workspaces?.items ?? []
  const route = parseRoute(form.executor)

  const submit = async () => {
    const prompt = form.prompt.trim()
    if (prompt.length === 0) { setProblem(t('create.needPrompt')); return }
    let timing
    if (form.when === 'later') {
      const [date, clock] = form.at.split('T')
      if (date === undefined || clock === undefined) { setProblem(t('create.needTime')); return }
      timing = { kind: 'at', at: { date, time: `${clock}:00`, time_zone: zone } }
    } else if (form.when === 'repeat') {
      if (form.repeat === 'every') {
        const minutes = Number(form.minutes)
        if (!Number.isFinite(minutes) || minutes < 1) { setProblem(t('create.needMinutes')); return }
        timing = { kind: 'every', every_seconds: Math.round(minutes * 60) }
      } else if (form.repeat === 'daily') {
        timing = { kind: 'daily', daily: { time: `${form.time}:00`, time_zone: zone } }
      } else if (form.repeat === 'weekly') {
        timing = { kind: 'weekly', weekly: { time: `${form.time}:00`, time_zone: zone, weekdays: [Number(form.weekday)] } }
      } else {
        if (form.cron.trim().length === 0) { setProblem(t('create.needCron')); return }
        timing = { kind: 'cron', cron: { expression: form.cron.trim(), time_zone: zone } }
      }
    }
    setProblem(null)
    setBusy(true)
    try {
      const outcome = await actions.create({
        title: form.name.trim().length > 0 ? form.name.trim() : titleFromPrompt(prompt),
        prompt,
        mode: form.when === 'now' ? 'now' : 'schedule',
        timing,
        route,
        workspaceId: form.workspace.length > 0 ? form.workspace : undefined,
      })
      if (!outcome.ok) { setProblem(outcome.message); return }
      setForm((current) => ({ ...emptyForm(), executor: current.executor, workspace: current.workspace }))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const repeatBody = form.when !== 'repeat' ? null : h('div', { className: 'asx-field', 'data-span': '2' },
    h('div', { className: 'asx-row' },
      h('select', { className: 'asx-select', value: form.repeat, onChange: set('repeat'), 'aria-label': t('create.repeat') },
        h('option', { value: 'every' }, t('create.repeat.every')),
        h('option', { value: 'daily' }, t('create.repeat.daily')),
        h('option', { value: 'weekly' }, t('create.repeat.weekly')),
        h('option', { value: 'cron' }, t('create.repeat.cron')),
      ),
      form.repeat === 'every'
        ? h('input', {
          className: 'asx-input', style: { width: '90px' }, type: 'number', min: '1', step: '1',
          value: form.minutes, onChange: set('minutes'), 'aria-label': t('create.minutes'), title: t('create.minutes'),
        })
        : null,
      form.repeat === 'weekly'
        ? h('select', { className: 'asx-select', style: { width: '120px' }, value: form.weekday, onChange: set('weekday'), 'aria-label': t('create.weekday') },
          ['1', '2', '3', '4', '5', '6', '7'].map((day) => h('option', { key: day, value: day }, t(`weekday.${day}`))))
        : null,
      form.repeat === 'daily' || form.repeat === 'weekly'
        ? h('input', { className: 'asx-input', style: { width: '110px' }, type: 'time', value: form.time, onChange: set('time'), 'aria-label': t('create.time') })
        : null,
      form.repeat === 'cron'
        ? h('input', { className: 'asx-input', style: { flex: '1 1 140px' }, value: form.cron, onChange: set('cron'), 'aria-label': t('create.cronExpr'), placeholder: '0 9 * * *' })
        : null,
    ),
  )

  return h('div', { className: 'asx-create' },
    h('div', { className: 'asx-createHead' },
      h(Glyph, { name: 'plus', size: 13 }),
      h('span', { className: 'asx-titleText' }, t('create.title')),
      h('span', { className: 'asx-spacer' }),
      h('button', { type: 'button', className: 'asx-btn asx-btnGhost', onClick: onClose, 'aria-label': t('create.cancel') },
        h(Glyph, { name: 'close', size: 12 })),
    ),
    h('div', { className: 'asx-createGrid' },
      h(Field, { label: t('create.prompt'), span: 3 },
        h('textarea', {
          className: 'asx-textarea', value: form.prompt, onChange: set('prompt'),
          placeholder: t('create.promptPlaceholder'), rows: 2,
        })),
      h(Field, { label: t('create.name'), span: 1 },
        h('input', { className: 'asx-input', value: form.name, onChange: set('name'), placeholder: t('create.namePlaceholder') })),
      h(Field, { label: t('create.when'), span: 2 },
        h('div', { className: 'asx-row' },
          h('div', { className: 'asx-seg' }, [
            ['now', t('create.mode.now')],
            ['later', t('create.mode.later')],
            ['repeat', t('create.mode.repeat')],
          ].map(([id, label]) => h('button', {
            key: id,
            type: 'button',
            className: 'asx-segBtn',
            'data-on': form.when === id ? 'true' : 'false',
            onClick: () => { setForm((current) => ({ ...current, when: id })) },
          }, label))),
          form.when === 'later'
            ? h('input', { className: 'asx-input', style: { flex: '1 1 190px' }, type: 'datetime-local', value: form.at, onChange: set('at'), 'aria-label': t('create.laterLabel') })
            : null,
        ),
      ),
      repeatBody,
      h(Field, { label: t('create.executor'), span: 2 },
        h('select', { className: 'asx-select', value: form.executor, onChange: set('executor') },
          h('option', { value: '' }, t('create.executorDefault')),
          groups.map((group) => h('optgroup', { key: group.id, label: group.name },
            (group.models ?? []).map((model) => h('option', { key: model.id, value: `${group.id}|${model.id}` }, model.name)))),
        )),
      h(Field, { label: t('create.workspace'), span: 1 },
        h('select', { className: 'asx-select', value: form.workspace, onChange: set('workspace') },
          h('option', { value: '' }, t('create.workspaceDefault')),
          workspaces.map((workspace) => h('option', { key: workspace.workspaceId, value: workspace.workspaceId }, workspace.title)),
        )),
    ),
    problem === null ? null : h('div', { className: 'asx-note', style: { color: 'var(--dsw-alias-state-error-primary)', marginTop: '6px' } }, problem),
    route !== undefined && form.when !== 'now'
      ? h('div', { className: 'asx-note', style: { marginTop: '6px' } }, t('create.workerNote'))
      : null,
    h('div', { className: 'asx-createFoot' },
      h('button', {
        type: 'button',
        className: 'asx-btn asx-btnPrimary',
        disabled: busy || form.prompt.trim().length === 0,
        onClick: () => { submit() },
      }, form.when === 'now' ? t('create.submitNow') : t('create.submitSchedule')),
      h('button', { type: 'button', className: 'asx-btn', disabled: busy, onClick: onClose }, t('create.cancel')),
      h('span', { className: 'asx-spacer' }),
      h('span', { className: 'asx-note', title: t('create.zone', { zone }) }, zone),
      h('span', { className: 'asx-dotSep' }),
      h('span', { className: 'asx-note' }, form.when === 'now' ? t('create.willOnce') : t('create.willRepeat')),
    ),
  )
}
