---
name: ai-efficiency
description: Analyse how the user actually uses Claude (from local Claude Code transcripts), recommend the daily 5-hour window cycle that gives their work the most usable windows, and, with their approval, install a small keeper that sends a Haiku wake-up after each reset so the cycle holds. If the DeepSeek Harness is present, also recommend its Async board and Off-peak model-menu switch. Use when the user asks to analyse or optimise their Claude usage, limits, 5-hour windows, session resets, "window cycle", "wake-ups", or types /ai-efficiency.
---

# AI Efficiency

A Claude subscription window opens with the first message and resets five hours later.
Left alone, windows start wherever the first prompt of a stretch happens to land, so a
heavy afternoon can be spent waiting on a window that opened late in the morning. This
skill finds the cycle that fits the user's real rhythm and keeps it running.

It never raises a limit. It changes *when* windows start, so more of the user's working
hours sit inside a fresh window. The weekly limit is untouched and still applies.

## 1. Analyse

Run the analyser. It reads only timestamps, models and token counts from
`~/.claude/projects`, and nothing leaves the machine. It takes about half a minute.

```sh
python3 "<skill dir>/scripts/analyze.py"            # readable report
python3 "<skill dir>/scripts/analyze.py" --json     # the same, for you to reason over
```

Options: `--days 31` (history to replay), `--root DIR` (repeatable, e.g. transcripts
copied from a second machine), `--step 30` (minutes between candidate start times).

If it reports fewer than five active days, say so and stop: there is not enough history
for a schedule worth trusting.

## 2. Recommend

Tell the user, in plain words and in this order:

1. **When they work** - the two or three busiest stretches from the hourly profile.
2. **The recommended cycle** - the wake-up times and the quiet stretch
   (`recommended.pings`, `recommended.quiet`).
3. **What it buys** - windows their work touched today versus with the cycle
   (`baseline.windows_with_work` -> `recommended.windows_with_work`, `gain_pct`). When
   `budget_known` is true, add hours stopped at the limit and blocked work, and say the
   limit size is an estimate from their own limit notices.
4. **Alternatives** - other equally good start times, and the 3-windows-a-day option if
   it scores within one window of the best (fewer wake-ups for nearly the same gain).

Be straight about the edges:

- The replay only sees Claude Code on this machine. Use from the phone, claude.ai or
  another computer is invisible to it unless its transcripts are passed with `--root`.
- If the user regularly reaches the **weekly** limit, more 5-hour windows will not help;
  say so rather than installing anything.
- A gain of a window or two over a month is noise. Recommend the keeper only when the
  gain is clear (roughly 10 % or more), or when the user wants predictable reset times.

## 3. Put it into action (ask first)

Installing the keeper starts a background service that sends a small request on the
user's subscription several times a day. **Always get an explicit yes**, and confirm
which machine should run it: one always-on machine per account, because the window
belongs to the account, not the device. Check for an existing keeper first
(`claude-window-keeper status`, `systemctl --user status claude-window-keeper`).

```sh
"<skill dir>/scripts/install-keeper.sh" --anchor 06:30 --until 01:30
```

Use the `anchor` and `until` the analyser printed. The script copies
`claude-window-keeper` to `~/.local/bin`, writes `~/.config/claude-window/config.json`,
and on a systemd machine enables a user service. Elsewhere it prints a crontab line.

Then verify and show the user:

```sh
claude-window-keeper next      # the next 24 hours of wake-ups
claude-window-keeper status    # current window, weekly use, recent pings
```

Day-to-day control: `pause`, `resume`, `set --all --anchor HH:MM --until HH:MM`,
`set --date YYYY-MM-DD --off` (skip a day), `set --date D --days 7 --anchor … --until …`.

How the wake-up works, in case the user asks:

- It is the official `claude` CLI in print mode with Haiku, no tools, no MCP servers and
  an empty working directory: a few hundred tokens per ping.
- It must use the **subscription login**. The keeper removes `ANTHROPIC_API_KEY` from its
  environment and warns if the CLI reports another auth source. Never add `--bare`: that
  mode uses an API key only and would not touch the plan's window.
- The next ping is timed from the reset time Claude Code itself reports, 75 seconds
  after it, so a window opened from any other device is followed correctly.
- If the weekly limit is exhausted, it waits for the weekly reset instead of retrying.

Re-run the analysis every month or two, or when the user's routine changes.

## 4. DeepSeek Harness users

When the analyser reports `deepseek_harness.detected`, read
[references/deepseek.md](references/deepseek.md) and recommend the two plugins it
describes that are not installed yet:

- **Async** - one board for everything running, scheduled or waiting on the user.
- **Off-peak** - a switch in the model menu that queues a prompt for the next off-peak
  window instead of running it at peak.

Install only with the user's go-ahead.
