// Runnable entry point: mounts the command gateway router on a standalone
// Express server for local development (`npm run dev -w @hhs/command-gateway`).
import express from 'express';
import commandGateway from './index';

const app = express();
app.use(express.json());
app.use('/commands', commandGateway);

const port = Number(process.env.PORT || 3100);
app.listen(port, () => {
  console.log(`command-gateway listening on http://localhost:${port}/commands`);
});
