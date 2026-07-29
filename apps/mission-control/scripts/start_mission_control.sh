#!/usr/bin/env bash
# Mission Control Startup Script
# Ensures Mission Control services are running via PM2

set -euo pipefail

echo "=== Mission Control Startup ==="
echo "Checking PM2 processes..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "ERROR: PM2 not installed. Run: npm install -g pm2"
    exit 1
fi

# Check PostgreSQL is running
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    echo "WARNING: PostgreSQL not responding on 5432"
    echo "Mission Control requires PostgreSQL to be running."
fi

# Check for existing PM2 processes
PM2_STATUS=$(pm2 jlist 2>/dev/null)
API_RUNNING=$(echo "$PM2_STATUS" | grep -c 'mission-control-api.*online' || echo "0")
DASH_RUNNING=$(echo "$PM2_STATUS" | grep -c 'mission-control-dashboard.*online' || echo "0")

if [ "$API_RUNNING" -eq 1 ] && [ "$DASH_RUNNING" -eq 1 ]; then
    echo "✓ Mission Control API running"
    echo "✓ Mission Control Dashboard running"
else
    echo "Starting Mission Control services..."
    pm2 start /Users/turtleclaw/.openclaw/workspace/mission-control/ecosystem.config.cjs
    pm2 save
fi

# Verify services
echo ""
echo "Verifying services..."
sleep 2

API_HEALTH=$(curl -s http://localhost:3001/health 2>/dev/null || echo '{"ok":false}')
if echo "$API_HEALTH" | grep -q '"ok":true'; then
    echo "✓ API healthy: http://localhost:3001"
else
    echo "✗ API not healthy"
fi

DASH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null)
if [ "$DASH_RESPONSE" = "200" ]; then
    echo "✓ Dashboard running: http://localhost:5173"
else
    echo "✗ Dashboard not responding"
fi

# Tailscale info
echo ""
echo "=== Tailscale Access ==="
TS_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
echo "Tailscale IP: $TS_IP"
echo "API:          http://${TS_IP}:3001"
echo "Dashboard:    http://${TS_IP}:5173"

echo ""
echo "=== PM2 Commands ==="
echo "View logs:    pm2 logs"
echo "Restart:      pm2 restart all"
echo "Stop:         pm2 stop all"
echo "Status:       pm2 list"