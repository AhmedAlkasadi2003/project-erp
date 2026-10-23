export interface AuditEvent {
  id: string;
  companyId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}
