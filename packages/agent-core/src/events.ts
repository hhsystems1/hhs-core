export type SystemEvent = 
  | { type: 'job.created'; payload: { jobId: string; tenantId: string } }
  | { type: 'job.running'; payload: { jobId: string; status: string; timestamp: string } }
  | { type: 'job.completed'; payload: { jobId: string; status: string; result: any; timestamp: string } }
  | { type: 'job.failed'; payload: { jobId: string; status: string; error: any; timestamp: string } }
  | { type: 'tenant.updated'; payload: { tenantId: string; changes: any } }
  | { type: 'crm.contact_updated'; payload: { contactId: string; tenantId: string; changes: any } };

export type EventBusPayload = SystemEvent['payload'];
