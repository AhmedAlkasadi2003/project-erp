import { apiClient } from './client';
import { HealthResponse } from '../types';

export type { HealthResponse };

export async function fetchBackendHealth(): Promise<HealthResponse> {
  return apiClient<HealthResponse>('health');
}
