---
description: "One board for asynchronous agent work: what is running now, what is scheduled, and what needs you, as kanban columns over a shared time axis plus a full timeline view."
---

# Async

Async gives asynchronous work one home in the Harness. It is a full-area panel,
opened from the **Async** icon in the global panel list beside **Schedules**.

## What it shows

Every card is one unit of asynchronous work, whichever mechanism produced it:

| Source | Card content |
|---|---|
| **Schedule** (`schedule_create`, the Schedules panel, scheduled deliveries) | name, timing rule, countdown to the next run, last delivery, pause/resume |
| **Agent session** — a prompt running while you look elsewhere, a scheduled delivery, a subagent | display title, workspace, model route (native or local), team tasks in flight |
| **Background job** (`bash` run in the background) | command label, live progress line, elapsed time, stop |
| **Team task** (agent-team board) | nested under the session that owns it, with pending / in-progress state |

The board has four columns: **Upcoming** (next occurrence in the future),
**Running** (a live agent or job), **Needs you** (an agent is waiting for an
approval or an answer) and **Settled** (finished, failed, paused or ended).

## Kanban × gantt

The two views are the same projection seen sideways:

- **Board** — lifecycle columns, chronological order inside each column, and a
  time ribbon on every card. The ribbon shares one window per column, so the
  "now" marker lands in the same place on every card: past deliveries and
  observed runs are solid, expected occurrences are hollow, and a run in
  progress draws an open bar.
- **Timeline** — the same items as gantt rows, grouped by source, executor or
  workspace, over a 6h / 24h / 7d / 30d window. Saved deliveries are solid
  marks, projected occurrences are hollow marks, jobs and observed agent runs
  are real spans, and a now line crosses every lane.

Selecting a card or a timeline row highlights the same item in both views.

## Creating work

**New async work** asks for one instruction and one of three timings:

- **Run now** — creates a session, names it after the task, selects the chosen
  model, and prompts it. The card appears in Running immediately.
- **Once at** — a one-time durable task, delivered to a reserved session or to a
  freshly created one when no session runs it.
- **Repeat** — every N minutes, daily, weekly or a five-field cron expression,
  delivered to one worker session (serialized, so a slow run never overlaps
  itself) or to a fresh session per occurrence.

**Run with** chooses the model route per item: the Harness default, a DeepSeek
route (native), or a local route such as the DGX Spark models. When a route is
chosen the plugin creates a worker session, names it after the task, selects the
route, and targets the task at that session — so periodic work keeps its model.

**Workspace** chooses where a created session lives; the default is the Host
project directory.

## Actions

Open session · Run now · Pause · Resume · Delete · Stop a running agent · Stop a
background job · Dismiss a settled row. Destructive actions take a second press
within three seconds. Failures appear in the panel's notice strip.

## Limits worth knowing

- Agent elapsed time is **observed**: it starts when this page first sees the
  session running. It is not the session's recorded start time, because the
  Harness does not publish one.
- `cron` and `rrule` schedules project only the Host-committed next occurrence;
  the view does not re-implement their evaluator. `every`, `daily` and `weekly`
  project occurrences arithmetically.
- Team tasks appear when the owning session's projection is loaded; the panel
  reads the projection rather than subscribing to every lead session.
- Settled rows decay: finished jobs leave after ten minutes, observed runs after
  two hours, ended one-shot tasks after a week. Dismiss is a page-local hide.
- The board is a projection of existing Harness state. It stores nothing, and it
  cannot recover history the Harness no longer has (a job's ring, a schedule's
  saved deliveries).
- No drag-and-drop between columns: state is derived, so dragging would lie.
- Goals, workflows and terminal sessions are not yet sources.

## Where it lives

The bundle's Host half is a no-op row; every contribution is the browser module
`client.js`, which registers the `async` panel (`main` key `async`), its sidebar
icon, and its dictionaries. It reads `ctx.sessions`, `ctx.uiSession`, `ctx.jobs`,
and the mounted `session`, `schedule` and `workspace` Remote namespaces, and
writes only through those namespaces.
