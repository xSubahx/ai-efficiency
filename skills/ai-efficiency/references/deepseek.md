# DeepSeek Harness: Async and Off-peak

The same idea as the Claude cycle, applied to DeepSeek: do the work when capacity is
cheapest and least contended, and keep everything that runs without you in one view.
Both plugins live in this repository under `dsh-plugins/` and are client-side bundles
for the DeepSeek Harness (DSH) web UI. They were built and tested against DSH 0.2.2.

## When to recommend what

| The user... | Recommend |
|---|---|
| schedules prompts, runs agents in the background, or uses agent teams | **Async** |
| sends work during peak hours that does not need an answer right now | **Off-peak** |
| does both | both: a prompt queued by Off-peak shows on the Async board as an *Upcoming* card |

## Async (`dsh-plugins/async`)

A full-area panel beside **Schedules**. Schedules, agent sessions, background jobs and
team tasks appear as cards in four columns - Upcoming, Running, Needs you, Settled - and
again as rows on a 6 h / 24 h / 7 d / 30 d timeline. New work can run now, once at a set
time, or on a repeat, each with its own model route. Details: `dsh-plugins/async/docs/DETAIL.md`.

## Off-peak (`dsh-plugins/offpeak`)

Adds an **Off-peak only** row to the chat's model menu, a default in Settings → General,
and a `Send at HH:MM` control beside Send. While the switch is on and the clock is inside
a peak window, the control turns the draft into a one-time durable task delivered to the
same chat when the peak window ends. Off-peak, nothing is held back.

The peak calendar is two constants, `PEAK_WINDOWS` and `ZONE`, in
`dsh-plugins/offpeak/src/sections/01-preamble.js`. They ship as Monday–Friday
04:00–07:00 and 09:00–13:00, Asia/Riyadh. **Ask the user which hours and zone are peak
for them**, edit the constants, and rebuild with `node build.mjs` before installing.
Details: `dsh-plugins/offpeak/docs/DETAIL.md`.

## Install

`dsh plugin` forwards to pnpm inside the profile, so a local folder installs as a link:

```sh
dsh plugin --profile web add /absolute/path/to/ai-efficiency/dsh-plugins/async
dsh plugin --profile web add /absolute/path/to/ai-efficiency/dsh-plugins/offpeak
```

Check that both names are in `dsh.profile.bundles` in the profile's `package.json`
(`~/.dsh/profiles/web/package.json`); add them if the command did not. Reload the web UI.
The bundles are client-only, so no Harness restart is needed.

Verify: an **Async** entry appears in the sidebar's panel list, and the model menu shows
**Off-peak only**.

## Tests

Each plugin carries its own tests. They need a built DSH checkout for React and the
theme files:

```sh
cd dsh-plugins/offpeak
DSH_REPO=/path/to/deepseek-harness node tests/window.mjs   # the peak calendar
DSH_REPO=/path/to/deepseek-harness node tests/smoke.mjs
DSH_REPO=/path/to/deepseek-harness node tests/dom.mjs
```

`tests/bundle.mjs` also checks that the installed profile resolves to this folder, so it
passes only after the install step above.
