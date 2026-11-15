# Off-peak only — design record

Status: **v1 implemented** as the `dsh-plugin-offpeak` bundle. `docs/DETAIL.md`
is the shipped description; this file keeps the reasoning.

## The ask

Add the ability to the model selector to press *off-peak*: a prompt sent during
peak hours is not actioned immediately but at the nearest off-peak time, while an
off-peak send is actioned immediately. Default **on** in settings; a chat can
switch it off to act during peak.

## Decisions

| Question | Decision |
|---|---|
| Peak definition | Mon–Fri **04:00–07:00** and **09:00–13:00**, `Asia/Riyadh`; everything else off-peak |
| Deferral mechanism | **Queue the draft to off-peak from the composer** (a control beside Send) |
| Toggle scope | **Per-session override, default from settings**, persisted |

## Why the deferral is a control, not an interception

The literal version — press Enter and have the send silently wait — needs a hook
on prompt submission. I checked the seams that exist:

- No Host event gates prompt admission (`session/prompt` goes straight to the
  session controller; there is no `prompt/admit` waterfall).
- `agent/pre-step` is a waterfall, but it runs *inside* an open turn: holding
  there would show the session as running for hours and losing the process would
  lose the wait.
- The client composer's submit path is explicitly package-internal:
  `ComposerKeyboard` is documented as "package-internal, never across a plugin
  boundary", and the default sink lives in the input hub with no registry.
- The input service exposes `submit()` and `setDraft()` but no way to veto or
  transform an ordinary send.

So the plugin does the next best supported thing: a control that takes the draft
and turns it into the object the Harness already uses for "do this later" — a
one-time durable task targeting the session. That is restart-safe and shows up in
every task surface instead of inventing a second waiting state.

## Shape

- `conversation.input.model.options` — the per-chat switch, with the calendar
  state as its subtitle (the slot the model menu already appends session options
  to).
- `conversation.input.right` — the composer control before Send.
- `settings.general.item` — the default switch and the calendar state in Settings
  → General.

Client-only: the browser module registers three slots and writes through the
already-mounted `schedule` Remote namespace, which it declares in `inject`
(`remote.schedule`) because cordis refuses undeclared namespace reads. The Host
row is a no-op inventory entry.

## State

`dsh.offpeak.v1` in origin-local storage:
`{ defaultEnabled: boolean, overrides: { [sessionId]: boolean } }`. Defaults to
`defaultEnabled: true`. Reading tolerates absent storage, malformed JSON, and
unknown fields; writing failures leave the in-memory value authoritative. This
mirrors how keyboard bindings are stored per browser, and keeps a per-chat UI
choice out of the session log, which only holds conversation truth.

## Verification

- `tests/window.mjs` — the calendar itself: every window boundary, both daily
  windows, Friday-into-weekend, weekend days, boundary computation, labels, and
  preference resolution/persistence. Fixed instants, no clock dependence.
- `tests/smoke.mjs` — applies the module against a fake client, asserts the three
  registrations and the inject contract, server-renders the menu row (on/off,
  peak/off-peak states), the composer control (boundary label, empty draft,
  attachments, command, off-peak hidden, mode-off hidden), and the Settings row,
  then asserts the exact `schedule.create` request — date, wall-clock time, zone,
  prompt, title, and session target — plus the near-boundary and off-peak
  refusals and a Host failure.
- `tests/dom.mjs` — mounts the real components in jsdom, queues a draft, checks
  the composer cleared and the confirmation shown, checks a failure keeps the
  draft, and flips both switches.
- `tests/bundle.mjs` — manifest, patch, artifact, icon, locale and detail
  document, and resolution through the installed profile.
- Live: driven in a running Harness (isolated profile on its own port) with the
  page clock pinned to a peak instant, so the control, the menu row and a real
  task can be observed end to end.
