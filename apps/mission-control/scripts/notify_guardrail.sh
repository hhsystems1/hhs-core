#!/usr/bin/env bash
set -euo pipefail

# Intended use: call this before sending a chat update.
# It keeps updates brief and skips redundant noise.

STATE_FILE="/Users/turtleclaw/.openclaw/workspace/mission-control/.notify_state"
NOW=$(date +%s)
LAST=0
if [[ -f "$STATE_FILE" ]]; then
  LAST=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
fi

# 10-minute quiet window unless there's a real change, blocker, or completion.
if (( NOW - LAST < 600 )); then
  echo "quiet"
else
  echo "$NOW" > "$STATE_FILE"
  echo "ok"
fi