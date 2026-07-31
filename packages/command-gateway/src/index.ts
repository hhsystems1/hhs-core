import { Router } from 'express';
import { z } from 'zod';
import { commandSchema } from './validation';
import { submitCommandToAgent } from './orchestrator';

const router = Router();

router.post(
  '/',
  async (req, res) => {
    try {
      // Validate incoming command
      const result = await validateSchema(commandSchema, req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid command payload', details: result.error });
      }

      const command = result.data;

      // Check approval requirement
      if (command.approvalRequired) {
        // Store pending approval and return 202 Accepted
        await storePendingApproval(command);
        return res.status(202).json({ message: 'Approval required', commandId: command.id });
      }

      // For non-approval commands, submit directly
      const jobResult = await submitCommandToAgent(command);
      return res.status(201).json({ jobId: jobResult.id });
    } catch (err: any) {
      console.error('CommandGateway error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
) as any;

export default router;