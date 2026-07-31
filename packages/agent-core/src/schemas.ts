import { z } from 'zod';

export const AgentJobStatusSchema = z.enum(['queued', 'running', 'needs_approval', 'completed', 'failed']);

export const AgentArtifactSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['file', 'url', 'log', 'screenshot']),
  path: z.string(),
  description: z.string(),
  created_at: z.string().datetime(),
});

export const AgentJobSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().min(1),
  capability: z.string().min(1),
  status: AgentJobStatusSchema,
  approvalRequired: z.boolean(),
  input: z.any(),
  result: z.any().optional(),
  artifacts: z.array(AgentArtifactSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AgentCommandSchema = z.object({
  tenantId: z.string().uuid(),
  command: z.string().min(1),
  actor: z.string().min(1),
  approvalRequired: z.boolean().default(false),
  payload: z.any(),
});

export type AgentJob = z.infer<typeof AgentJobSchema>;
export type AgentCommand = z.infer<typeof AgentCommandSchema>;
export type AgentJobStatus = z.infer<typeof AgentJobStatusSchema>;
export type AgentArtifact = z.infer<typeof AgentArtifactSchema>;
