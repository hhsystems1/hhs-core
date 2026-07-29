const fs = require('node:fs');
const path = require('node:path');

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv(path.join(__dirname, 'api/.env'));

function requiredEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is required for Mission Control PM2 startup`);
  return process.env[name];
}

module.exports = {
  apps: [
    {
      name: 'mission-control-api',
      cwd: '/Users/turtleclaw/.openclaw/workspace/mission-control/api',
      script: 'index.js',
      interpreter: 'node',
      env: {
        PGHOST: process.env.PGHOST || '127.0.0.1',
        PGPORT: process.env.PGPORT || '5432',
        PGUSER: process.env.PGUSER || 'hhs',
        PGPASSWORD: requiredEnv('PGPASSWORD'),
        PGDATABASE: process.env.PGDATABASE || 'mission_control',
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || '3001'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: '/Users/turtleclaw/.openclaw/workspace/mission-control/api/logs/error.log',
      out_file: '/Users/turtleclaw/.openclaw/workspace/mission-control/api/logs/out.log',
      time: true
    },
    {
      name: 'mission-control-dashboard',
      cwd: '/Users/turtleclaw/.openclaw/workspace/mission-control/dashboard',
      script: 'node_modules/.bin/vite',
      args: '--host 0.0.0.0 --port 5173',
      interpreter: 'none',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: '/Users/turtleclaw/.openclaw/workspace/mission-control/dashboard/logs/error.log',
      out_file: '/Users/turtleclaw/.openclaw/workspace/mission-control/dashboard/logs/out.log',
      time: true
    }
  ]
};
