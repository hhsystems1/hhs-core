import { Router } from 'express';
import { validateCommand } from './validation';
import { storePendingApproval, submitCommandToAgent } from './orchestrator';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const result = await validateCommand(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid command payload', details: result.error });
    }

    const command = result.data;

    if (command.approvalRequired) {
      const commandId = storePendingApproval(command);
      return res.status(202).json({ message: 'Approval required', commandId });
    }

    const jobResult = await submitCommandToAgent(command);
    return res.status(201).json({ jobId: jobResult.id });
  } catch (err: any) {
    console.error('CommandGateway error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
