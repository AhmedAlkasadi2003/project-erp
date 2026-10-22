import { apiClient } from './client';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: {
      status: 'up' | 'down';
    };
  };
}

export async function fetchBackendHealth(): Promise<HealthResponse> {
  return apiClient<HealthResponse>('health');
}
