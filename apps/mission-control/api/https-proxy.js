import https from 'https';
import fs from 'fs';
import httpProxy from 'http-proxy';

const CERT = process.env.TS_CERT || '/tmp/ts.crt';
const KEY = process.env.TS_KEY || '/tmp/ts.key';
const TARGET = process.env.TARGET || 'http://127.0.0.1:3001';
const PORT = Number(process.env.HTTPS_PORT || 8443);

const proxy = httpProxy.createProxyServer({ target: TARGET, changeOrigin: true });

const server = https.createServer({
  cert: fs.readFileSync(CERT),
  key: fs.readFileSync(KEY),
}, (req, res) => {
  proxy.web(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS proxy listening on ${PORT} -> ${TARGET}`);
});
