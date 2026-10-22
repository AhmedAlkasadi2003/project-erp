export interface CreateOutboxParams {
  companyId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventVersion?: number;
  payload: Record<string, unknown>;
}

export interface OutboxMetrics {
  pendingCount: number;
  processingCount: number;
  processedCount: number;
  failedCount: number;
  deadLetterCount: number;
  oldestPendingAgeMs: number | null;
}

export interface IOutboxHandler {
  handle(event: {
    id: string;
    companyId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    eventVersion: number;
    payload: Record<string, unknown>;
    createdAt: Date;
  }): Promise<void>;
}
