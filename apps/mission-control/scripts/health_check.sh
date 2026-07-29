#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="/Users/turtleclaw/.openclaw/workspace/mission-control/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/health_check.log"

log(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }

if ! pm2 describe mission-control-api >/dev/null 2>&1; then
  log "API missing, starting stack"
  pm2 start /Users/turtleclaw/.openclaw/workspace/mission-control/ecosystem.config.cjs >> "$LOG_FILE" 2>&1
  pm2 save >> "$LOG_FILE" 2>&1
  exit 0
fi

if ! curl -fsS http://localhost:3001/health >/dev/null 2>&1; then
  log "API unhealthy, restarting"
  pm2 restart mission-control-api >> "$LOG_FILE" 2>&1
fi

if ! curl -fsS http://localhost:5173/ >/dev/null 2>&1; then
  log "Dashboard unhealthy, restarting"
  pm2 restart mission-control-dashboard >> "$LOG_FILE" 2>&1
fi
