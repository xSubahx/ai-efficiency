---
description: "Queue a prompt for the next off-peak window when it would otherwise run during peak hours, with a per-chat switch in the model menu and a default in Settings."
---

# Off-peak only

Sending a prompt during peak hours starts a model request immediately. This
plugin lets a chat *wait* instead: when the prompt would land inside a peak
window, it is queued as a one-time durable task that is delivered into the same
chat at the next off-peak start. Off-peak, nothing is held back.

## Peak windows

Peak is **Monday–Friday, 04:00–07:00 and 09:00–13:00, Asia/Riyadh**. Everything
else is off-peak, including the whole weekend. The windows are ordinary
constants in the bundle (`PEAK_WINDOWS` and `ZONE` in
`src/sections/01-preamble.js`); editing them and rebuilding is the way to change
the calendar.

## The model-menu switch

The chat's model and reasoning menu gains a row:

```
Off-peak only                                   [switch]
Peak now — sends can wait until 07:00
```

- **On** — the composer offers the deferred send (below) while the calendar is in
  a peak window.
- **Off** — sends go immediately, whatever the time.
- The row reports the calendar: peak (with the next off-peak time), off-peak, or
  off.
- The switch is per chat. It is stored in this browser (`dsh.offpeak.v1`), like
  keyboard bindings, so it survives reloads on the same device and never
  surprises another browser.

## The composer control

While the chat is off-peak-only and the calendar is at peak, a control appears
immediately before **Send**:

```
☾ Send at 07:00
```

It takes the current draft, clears the composer, and creates a one-time task that
delivers that prompt into the same chat at the next off-peak start. The control
confirms with **Queued for 07:00** and retires the confirmation when you start
the next draft, or after six seconds.

It is disabled, with a reason in its tooltip, when:

- the draft is empty,
- the draft is a `/` command (commands run immediately),
- a send is already in flight,
- the draft carries attachments — a durable task delivers text only, so an
  attachment cannot survive the wait,
- the chat is a delegated subagent session (the task store refuses a delegated
  child as a delivery target),
- the peak window ends within a minute — sending now is effectively the same
  thing.

A failed queue keeps the draft in the composer and reports the failure on the
control.

## The Settings default

**Settings → General** gains an **Off-peak only** row that owns the default for
chats without their own choice. It ships **on**, states the peak windows, and
shows whether it is peak right now. The row's switch changes the default; a chat
that has already chosen keeps its choice.

## Where a queued prompt appears

A queued prompt is a real Harness task, so it shows up wherever tasks are
visible: the session header's task catalog, the Schedules panel, and — if the
**Async** plugin is installed — as an *Upcoming* card with a delivery time.

## Limits

- The wait is a durable task: it survives a Harness restart. The prompt does not
  appear in the conversation until it is delivered.
- Deferred prompts are text only; attachments cannot be queued.
- The calendar is fixed in the bundle (no settings editor for the windows yet),
  and one zone applies to all chats.
- Nothing intercepts a normal Send: DSH does not expose a prompt-submission hook
  to plugins, so the deferral is the explicit composer control rather than an
  invisible rewrite of Enter.
