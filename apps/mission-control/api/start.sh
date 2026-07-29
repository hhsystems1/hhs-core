#!/bin/bash
set -euo pipefail

cd /Users/turtleclaw/.openclaw/workspace/mission-control/api

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${PGPASSWORD:?PGPASSWORD must be provided in api/.env or environment}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-hhs}"
export PGDATABASE="${PGDATABASE:-mission_control}"
export PORT="${PORT:-3001}"

node index.js
