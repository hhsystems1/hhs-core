#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/turtleclaw/.openclaw/workspace/mission-control"
PM2FILE="$ROOT/ecosystem.config.cjs"

pm2 start "$PM2FILE"
pm2 save

LINE="*/5 * * * * /Users/turtleclaw/.openclaw/workspace/mission-control/scripts/health_check.sh"
TMP=$(mktemp)
(crontab -l 2>/dev/null | grep -v "health_check.sh"; echo "$LINE") > "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Guardrails installed"
