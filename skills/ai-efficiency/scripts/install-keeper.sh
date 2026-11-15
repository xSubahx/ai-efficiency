#!/usr/bin/env bash
# Install claude-window-keeper for this user and set its daily cycle.
#   install-keeper.sh --anchor 06:30 --until 01:30 [--no-service]
# Run it on ONE always-on machine per Claude account.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
anchor="" until="" service=1
while [ $# -gt 0 ]; do
  case "$1" in
    --anchor) anchor="$2"; shift 2 ;;
    --until) until="$2"; shift 2 ;;
    --no-service) service=0; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
[ -n "$anchor" ] && [ -n "$until" ] || { echo "usage: install-keeper.sh --anchor HH:MM --until HH:MM [--no-service]" >&2; exit 2; }
command -v claude >/dev/null || { echo "Claude Code CLI not found on PATH. Install it and sign in with your subscription first." >&2; exit 1; }

mkdir -p "$HOME/.local/bin"
install -m 0755 "$here/claude-window-keeper" "$HOME/.local/bin/claude-window-keeper"
"$HOME/.local/bin/claude-window-keeper" set --all --anchor "$anchor" --until "$until" >/dev/null
echo "Installed ~/.local/bin/claude-window-keeper with the cycle $anchor -> $until."

if [ "$service" = 1 ] && command -v systemctl >/dev/null && systemctl --user show-environment >/dev/null 2>&1; then
  mkdir -p "$HOME/.config/systemd/user"
  install -m 0644 "$here/claude-window-keeper.service" "$HOME/.config/systemd/user/claude-window-keeper.service"
  systemctl --user daemon-reload
  systemctl --user enable --now claude-window-keeper.service
  echo "Service started. To keep it running while you are logged out: loginctl enable-linger $USER"
else
  echo "No systemd user session here. Keep it running with any supervisor, for example a crontab line:"
  echo "  @reboot $HOME/.local/bin/claude-window-keeper run >> $HOME/.local/state/claude-window/keeper.log 2>&1"
fi
echo
"$HOME/.local/bin/claude-window-keeper" next
