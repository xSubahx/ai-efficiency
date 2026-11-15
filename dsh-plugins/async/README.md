# dsh-plugin-async

One board for asynchronous agent work in the DeepSeek Harness: what is running
now, what is scheduled, and what needs you — kanban lifecycle columns over a
shared time axis, plus a full timeline view.

- **Sources**: schedule tasks, agent sessions (including subagents and scheduled
  deliveries), background jobs, and agent-team tasks.
- **Views**: board (Upcoming · Running · Needs you · Settled) and timeline
  (grouped gantt lanes, 6h/24h/7d/30d).
- **Creation**: run now, once at, or repeat (every N minutes / daily / weekly /
  cron), with a per-item model route — DeepSeek native or a local route such as
  the DGX Spark models — and a workspace.
- **Actions**: open, run now, pause, resume, delete, stop, kill, dismiss.

The panel appears as an **Async** entry in the sidebar's global panel list, next
to **Schedules**.

## Layout

| Path | Role |
|---|---|
| `package.json`, `cordis.patch.yml`, `index.js` | bundle manifest, loader row, no-op Host half |
| `client.js` | the browser module (generated — do not edit) |
| `src/sections/*.js` | the module's source, concatenated in file order |
| `build.mjs` | `node build.mjs` regenerates `client.js` |
| `tests/bundle.mjs` | manifest, patch, artifact, icon, detail-document and installed-resolution contract |
| `tests/smoke.mjs` | applies the module against a fake client, renders board/timeline/form, asserts every Remote call shape |
| `tests/dom.mjs` | mounts the real panel in jsdom with React DOM: effects, data entry, view switching, card actions, the ticking clock |
| `locale/*.json`, `icon.svg` | Plugin Manager display metadata and artwork |
| `docs/DETAIL.md` | the plugin's detail page |
| `docs/DESIGN.md` | design record and decisions |

## Develop

```sh
node build.mjs          # regenerate client.js from src/sections
node --check client.js  # syntax
node tests/bundle.mjs   # bundle and install contract
node tests/smoke.mjs    # render + operation-wire assertions
node tests/dom.mjs      # mounted-panel interactions
PREVIEW=1 node tests/smoke.mjs   # also writes static preview pages for a screenshot
```

The bundle is installed in the `web` profile as a linked directory, so edits to
`client.js` take effect on the next page load (the client bundle is served from
this directory); Host-side changes need a DSH restart.
