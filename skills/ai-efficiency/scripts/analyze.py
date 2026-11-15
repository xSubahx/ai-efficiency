#!/usr/bin/env python3
"""analyze.py - find the 5-hour window cycle that fits how you actually use Claude.

Reads Claude Code transcripts on this machine (~/.claude/projects/**/*.jsonl), builds a
per-minute picture of your demand, replays it against candidate wake-up schedules and
recommends the one that gives your work the most separate 5-hour windows.

Nothing leaves the machine: the script only reads timestamps, model names and token
counts, never message text (apart from spotting "you hit your limit" notices).

Usage: analyze.py [--root DIR ...] [--days 31] [--step 30] [--json]
"""
import argparse
import glob
import json
import os
import re
import statistics
import sys
import time
from datetime import datetime, timedelta

WINDOW_S = 5 * 3600
STEP_S = 60
DELAY_S = 75          # the keeper pings this long after a reset

# Relative weight of a token by model family: (input, output, cache read), cache writes
# count 1.25 x input. Only the ratios matter - they make one heavy Opus turn count for
# more than a Haiku one. Edit to taste; unknown models (local, other vendors) are skipped.
WEIGHTS = {"fable": (10.0, 50.0, 0.25), "mythos": (10.0, 50.0, 0.25), "opus": (4.0, 20.0, 0.20),
           "sonnet": (2.0, 10.0, 0.20), "haiku": (0.10, 0.50, 0.01)}
_HIT = re.compile(r"hit your (session |5-hour |weekly )?limit|usage limit reached", re.I)


def _weight(model):
    m = (model or "").lower()
    for k, w in WEIGHTS.items():
        if k in m:
            return w
    return None


# ------------------------------------------------------------------ reading transcripts
def extract(roots, days):
    """Per-minute weighted demand and the times Claude Code reported a hit limit."""
    cut = time.time() - days * 86400
    seen, minutes, hits = set(), {}, set()
    for root in roots:
        for f in glob.glob(os.path.join(os.path.expanduser(root), "**/*.jsonl"), recursive=True):
            try:
                if os.path.getmtime(f) < cut:
                    continue
                fh = open(f, errors="ignore")
            except OSError:
                continue
            with fh:
                for line in fh:
                    if '"assistant"' not in line:
                        continue
                    usage = '"usage"' in line
                    if not usage and "limit" not in line:
                        continue
                    try:
                        o = json.loads(line)
                    except ValueError:
                        continue
                    ts, m = o.get("timestamp"), o.get("message")
                    if o.get("type") != "assistant" or not ts or not isinstance(m, dict):
                        continue
                    try:
                        t = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
                    except ValueError:
                        continue
                    if t < cut:
                        continue
                    if not usage or m.get("model") == "<synthetic>":
                        if _HIT.search(json.dumps(m.get("content", ""))):
                            hits.add(int(t))
                        continue
                    mid, u, w = m.get("id"), m.get("usage") or {}, _weight(m.get("model", ""))
                    if not w or not mid or mid in seen:
                        continue
                    seen.add(mid)
                    win, wout, wread = w
                    v = (win * (u.get("input_tokens") or 0)
                         + 1.25 * win * (u.get("cache_creation_input_tokens") or 0)
                         + wread * (u.get("cache_read_input_tokens") or 0)
                         + wout * (u.get("output_tokens") or 0)) / 1e6
                    if v > 0:
                        k = int(t // STEP_S * STEP_S)
                        minutes[k] = minutes.get(k, 0.0) + v
    return sorted(minutes.items()), sorted(hits), len(seen)


# ------------------------------------------------------------------ schedule rules
def hm(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def fmt_hm(minutes):
    minutes %= 1440
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def span_for(day, anchor, until):
    a, u = hm(anchor), hm(until)
    d0 = day.replace(hour=0, minute=0, second=0, microsecond=0)
    start = d0 + timedelta(minutes=a)
    end = d0 + timedelta(minutes=u) + (timedelta(days=1) if u <= a else timedelta())
    return start.timestamp(), end.timestamp()


def daily_rule(anchor, until):
    """allowed(ts): may the keeper start a window at ts?"""
    def ok(ts):
        d = datetime.fromtimestamp(ts)
        for k in (0, -1):
            s, e = span_for(d + timedelta(days=k), anchor, until)
            if s <= ts <= e:
                return True
        return False
    return ok


def until_for(anchor_min, n):
    """Last moment a window may start so that exactly n windows chain from the anchor."""
    return fmt_hm(anchor_min + (n - 1) * 300 + 240)


# ------------------------------------------------------------------ replay
def natural_windows(events):
    out, s, e, acc = [], None, None, 0.0
    for t, v in events:
        if e is None or t >= e:
            if e is not None:
                out.append((s, e, acc))
            s, e, acc = t, t + WINDOW_S, 0.0
        acc += v
    if e is not None:
        out.append((s, e, acc))
    return out


def budget_from_hits(events, hits):
    """Work one window holds, estimated from the windows where a limit notice appeared."""
    obs = []
    wins = natural_windows(events)
    for h in hits:
        for s, e, _ in wins:
            if s <= h < e:
                done = sum(v for t, v in events if s <= t <= h)
                if done > 0:
                    obs.append(done)
    return (statistics.median(obs), len(obs)) if obs else (None, 0)


def simulate(events, budget, allowed=None):
    """Replay the demand minute by minute.

    allowed=None  no keeper: a window opens at the first request after the last one ended.
    allowed(ts)   the keeper opens one DELAY_S after each reset whenever allowed(ts).
    """
    out = {"windows_with_work": 0, "windows": 0, "blocked": 0.0, "demand": 0.0, "lockout_s": 0.0}
    if not events:
        return out
    t0, t1 = events[0][0] - 6 * 3600, events[-1][0] + 3600
    i, n = 0, len(events)
    end, next_ping, acc, had_work, capped_at = None, t0, 0.0, False, None

    def close():
        out["windows_with_work"] += had_work
        if capped_at is not None:
            out["lockout_s"] += end - capped_at

    t = t0
    while t <= t1:
        if end is not None and t >= end:
            close()
            next_ping, end = end + DELAY_S, None
        if end is None and allowed is not None and t >= next_ping and allowed(t):
            end, acc, had_work, capped_at = t + WINDOW_S, 0.0, False, None
            out["windows"] += 1
        while i < n and events[i][0] < t + STEP_S:
            v = events[i][1]
            if end is None:
                end, acc, had_work, capped_at = events[i][0] + WINDOW_S, 0.0, False, None
                out["windows"] += 1
            out["demand"] += v
            if budget:
                room = max(0.0, budget - acc)
                if v > room:
                    out["blocked"] += v - room
                    if capped_at is None:
                        capped_at = events[i][0]
            acc += v
            had_work = True
            i += 1
        t += STEP_S
    if end is not None:
        close()
    return out


def hourly_profile(events):
    h = [0.0] * 24
    for t, v in events:
        h[datetime.fromtimestamp(t).hour] += v
    tot = sum(h) or 1.0
    return [x / tot for x in h]


# ------------------------------------------------------------------ DeepSeek Harness
def detect_dsh():
    home = os.path.expanduser("~/.dsh")
    if not os.path.isdir(home):
        return {"detected": False}
    installed = set()
    for pj in glob.glob(os.path.join(home, "profiles", "*", "package.json")):
        try:
            deps = json.load(open(pj)).get("dependencies", {})
        except (OSError, ValueError):
            continue
        installed |= {k for k in deps if k in ("dsh-plugin-async", "dsh-plugin-offpeak")}
    return {"detected": True, "async_installed": "dsh-plugin-async" in installed,
            "offpeak_installed": "dsh-plugin-offpeak" in installed}


# ------------------------------------------------------------------ the analysis
def analyse(roots, days, step):
    print("Reading transcripts and replaying schedules (about half a minute)...", file=sys.stderr)
    events, hits, messages = extract(roots, days)
    res = {"days": days, "messages": messages, "active_days": 0, "deepseek_harness": detect_dsh()}
    if events:
        res["active_days"] = len({datetime.fromtimestamp(t).date() for t, _ in events})
    if res["active_days"] < 5:
        res["error"] = (f"Only {res['active_days']} day(s) of Claude Code activity in the last {days} days. "
                        "Five or more are needed for a schedule worth trusting.")
        return res
    budget, n_hits = budget_from_hits(events, hits)
    base = simulate(events, budget)
    rows = [{"name": "no keeper (today)", "anchor": None, "until": None, "per_day": None, **base},
            {"name": "chain all day and night", "anchor": "00:00", "until": "00:00", "per_day": 4.8,
             **simulate(events, budget, lambda ts: True)}]
    for a in range(0, 1440, step):
        for n in (2, 3, 4):
            anchor, until = fmt_hm(a), until_for(a, n)
            rows.append({"name": f"{anchor} x{n}", "anchor": anchor, "until": until, "per_day": n,
                         **simulate(events, budget, daily_rule(anchor, until))})
    cands = [r for r in rows if r["per_day"] in (2, 3, 4)]
    # Share of your demand that falls in each schedule's quiet stretch: among schedules that
    # score the same, the one that rests while you rest is the one to keep.
    by_min = [0.0] * 1440
    for t, v in events:
        d = datetime.fromtimestamp(t)
        by_min[d.hour * 60 + d.minute] += v
    total = sum(by_min) or 1.0
    for r in cands:
        q0 = hm(r["anchor"]) + r["per_day"] * 300
        r["quiet_share"] = round(sum(by_min[m % 1440] for m in range(q0, hm(r["anchor"]) + 1440)) / total, 4)
    # Most windows your work touched; then the quietest quiet stretch; then least blocked work; then fewest pings.
    rank = lambda r: (r["windows_with_work"], -r["quiet_share"], -r["blocked"], -r["per_day"])
    best = max(cands, key=rank)
    ties = sorted({r["anchor"] for r in cands
                   if r["windows_with_work"] == best["windows_with_work"] and r["per_day"] == best["per_day"]})
    a = hm(best["anchor"])
    res.update({
        "hourly_share": [round(x, 4) for x in hourly_profile(events)],
        "limit_notices": len(hits),
        "budget_known": budget is not None, "budget_from_windows": n_hits,
        "baseline": base, "chain": rows[1],
        "recommended": {**best, "pings": [fmt_hm(a + k * 300 + k) for k in range(best["per_day"])],
                        "quiet": f"{fmt_hm(a + best['per_day'] * 300)}-{best['anchor']}",
                        "gain_pct": round(100 * (best["windows_with_work"] / max(1, base["windows_with_work"]) - 1)),
                        "equally_good_anchors": ties},
        "top": sorted(cands, key=rank, reverse=True)[:5],
    })
    return res


def report(r):
    if r.get("error"):
        print(r["error"])
        return
    p = r["hourly_share"]
    top = max(p) or 1
    print(f"Claude Code activity, last {r['days']} days: {r['messages']} replies on {r['active_days']} active days\n")
    print("When you work (share of demand by local hour)")
    for h in range(24):
        print(f"  {h:02d}  {'#' * round(40 * p[h] / top):<40} {100 * p[h]:4.1f}%")
    b, rec = r["baseline"], r["recommended"]
    print(f"\nToday, with no keeper : your work touched {b['windows_with_work']} separate 5-hour windows")
    print(f"Recommended cycle     : wake-ups at {', '.join(rec['pings'])}  (quiet {rec['quiet']})")
    print(f"                        -> {rec['windows_with_work']} windows with work ({rec['gain_pct']:+d}%)")
    if r["budget_known"]:
        hrs = lambda x: f"{x['lockout_s'] / 3600:.1f} h"
        pct = lambda x: f"{100 * x['blocked'] / max(x['demand'], 1e-9):.1f}%"
        print(f"Stopped at the limit  : {hrs(b)} -> {hrs(rec)}   blocked work: {pct(b)} -> {pct(rec)}")
        print(f"                        (limit size estimated from {r['budget_from_windows']} window(s) with a limit notice)")
    else:
        print("Stopped at the limit  : no limit notices in your transcripts, so blocked time is not estimated")
    if len(rec["equally_good_anchors"]) > 1:
        print(f"Equally good starts   : {', '.join(rec['equally_good_anchors'])}")
    print("\nBest five schedules")
    for x in r["top"]:
        print(f"  start {x['anchor']}, {x['per_day']} windows/day (until {x['until']})  ->  {x['windows_with_work']} windows with work")
    c = r["chain"]
    print(f"  chain all day and night              ->  {c['windows_with_work']} windows with work")
    print(f"\nKeeper settings: --anchor {rec['anchor']} --until {rec['until']}")
    d = r["deepseek_harness"]
    if d["detected"]:
        need = [n for n, k in (("Async board", "async_installed"), ("Off-peak switch", "offpeak_installed")) if not d[k]]
        print("\nDeepSeek Harness found: " + ("Async and Off-peak plugins already installed." if not need
                                             else "recommended plugins not installed yet: " + ", ".join(need) + "."))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--root", action="append", help="transcript folder (repeatable); default ~/.claude/projects")
    ap.add_argument("--days", type=float, default=31)
    ap.add_argument("--step", type=int, default=30, help="minutes between candidate start times")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    r = analyse(a.root or ["~/.claude/projects"], a.days, max(5, a.step))
    if a.json:
        json.dump(r, sys.stdout, indent=1)
        print()
    else:
        report(r)
    return 1 if r.get("error") else 0


if __name__ == "__main__":
    sys.exit(main())
