#!/usr/bin/env bash
# Copy the ai-efficiency skill into Claude Code's personal skills folder.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/ai-efficiency"
mkdir -p "$dest"
cp -R "$here/skills/ai-efficiency/." "$dest/"
echo "Installed to $dest"
echo "Open Claude Code and ask: \"analyse my Claude usage and recommend a 5-hour cycle\" (or type /ai-efficiency)."
