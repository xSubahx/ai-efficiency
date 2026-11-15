# Async — design record

Status: **v1 implemented** as the `dsh-plugin-async` bundle, installed in the
`web` profile. `docs/DETAIL.md` is the shipped description; this file keeps the
reasoning and the decisions that shaped it.

## The gap

Five mechanisms already produce work the user does not watch — schedule tasks,
running agent sessions (including subagents and scheduled deliveries), background
jobs, agent-team tasks, and goals — and each one lives on its own surface with
its own vocabulary. Nothing answers "what did my Harness do while I was away,
what is it doing now, and what is it about to do".

## Decisions (agreed before building)

| Question | Decision |
|---|---|
| Sources in v1 | Schedules, running sessions/agents, background jobs, **and team tasks** |
| "Local agents" | **Model routes**: local DGX Spark routes versus DeepSeek API routes, chosen per item |
| Placement | A **panel in the global panel list**, next to Schedules |
| Kanban × gantt | **Time-placed kanban plus a Timeline toggle**, one panel |

## Shape

```
UPCOMING            RUNNING              NEEDS YOU            SETTLED
(future occurrence) (live agent or job) (waiting on you)     (done/paused/ended)
```

Every card carries the same things: a source glyph, a title, badges (route,
child session, team, paused/ended/failed, new), the one sentence that says when
it happens, and a **time ribbon**. The ribbon uses one window per column so the
now marker sits at the same fraction on every card — that is what makes a column
read as a schedule rather than a list.

The **Timeline** view is the same projection as gantt rows: grouped lanes,
6h/24h/7d/30d windows, solid marks for saved deliveries and finished spans,
hollow marks for projected occurrences, open bars for work in progress, and a
now line. Selection is shared between the views.

Creation covers **Run now**, **Once at**, and **Repeat** (every N minutes, daily,
weekly, cron), with a model route and a workspace. A chosen route gets a worker
session created, named after the task, and selected onto that route, so periodic
work keeps its model.

## Why it is client-only

Everything the view needs is already reachable from a browser plugin through
existing services and Remote namespaces:

| Need | API |
|---|---|
| roster with titles, workspaces, subagent lineage, projections | `ctx.sessions.list` |
| live status and pending interactions | `ctx.uiSession.sessionStatus` |
| jobs per session | `ctx.jobs` |
| all schedules, deliveries, create/edit/run | `ctx.remote.schedule.*` |
| create / rename / select model / prompt / cancel sessions | `ctx.remote.session.*` |
| executor routes | `ctx.remote.session.modelCatalog()` |
| workspace names | `ctx.remote.workspace.follow` |
| invalidation | `ctx.remote.$on('schedule/changed')` |

So the bundle is one no-op Host row plus a browser module. No new Host service,
no new Remote namespace, no build step, nothing that can destabilise the Host.

Cordis refuses reading a namespace off the `remote` proxy unless it is declared
in the plugin's `inject` list, so the module declares `remote.session`,
`remote.schedule` and `remote.workspace` alongside the services it reads
(`sessions`, `uiSession`, `uiWorkspace`, `jobs`, `layout`). The first live boot
caught exactly this (`cannot get property "remote.session" without inject`); the
offline harnesses now mirror that guard in a transparent proxy, so a missing
declaration fails there instead of only in a live boot.

## Honest limitations

- Agent elapsed time is observed from this page, not the session's recorded start.
- `cron`/`rrule` project only the Host-committed next occurrence.
- Team tasks depend on the owning session's projection being loaded.
- Settled rows decay (10 minutes for jobs, 2 hours for observed runs, a week for
  ended one-shots).
- No drag between columns (state is derived), no goals/workflows/terminals yet.

## Verification

- `tests/bundle.mjs` checks what the Loader and the client module registry read
  before any plugin code runs: manifest exports, the `dsh.bundle` patch row, the
  `dsh.client` declaration, the artifact's module id, the icon and detail
  document limits, and that the *installed profile* resolves both halves back to
  this directory.
- `tests/smoke.mjs` loads the built module with a stub loader, applies it against
  a fake client context, renders the board, timeline and creation form with
  server rendering, and asserts the wire shape of every operation (pause, resume,
  run, delete, stop, kill, open, dismiss, run-now creation, scheduled creation
  with a worker session, one-time target with a workspace, recurring target).
- `tests/dom.mjs` mounts the real panel in jsdom with React DOM and drives it:
  effects read the catalog and workspace baseline, the view switches to the
  timeline and back, the timeline reads delivery history, the composer opens with
  its route options, a card action pauses a schedule, and the ticking clock
  re-renders without remounting. This tier found the composer's workspace-list
  defect the other two could not see.
- Static previews (`PREVIEW=1 node tests/smoke.mjs`) render the panel with the
  real theme stylesheet and the panel's own CSS, screenshotted with headless
  Chromium while the panel is not yet live.
- **Live verification** ran against an isolated Harness instance — its own
  `DSH_HOME`, its own port, the shipped `web` profile plus this bundle, driven
  through Chrome DevTools Protocol with headless Chromium. The same bundle that is
  installed in the `web` profile was exercised end to end: the panel registered
  and mounted, a one-time task was composed and created through the UI, the
  schedule survived a page reload, Pause moved it to Settled and Resume moved it
  back, a local model route (`dgx-spark` / `spark-dual`) appeared in the executor
  picker and produced a repeating task with the worker session and the `Local`
  badge, and both views rendered in the dark theme. Screenshots are in
  `tests/screenshots/*-live.png`.
- The user's own Harness instance needs its restart to compose the new bundle;
  that is a deployment step, not an unverified code path.
