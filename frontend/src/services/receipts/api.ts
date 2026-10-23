import { apiClient } from '../client';
import {
  CreateReceiptDto,
  CreateReceiptLineDto,
  QueryReceiptsParams,
  Receipt,
  ReceiptsListResponse,
  UpdateReceiptDto,
} from './types';

export async function getReceipts(params: QueryReceiptsParams = {}): Promise<ReceiptsListResponse> {
  const query = new URLSearchParams();

  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.warehouseId) query.set('warehouseId', params.warehouseId);
  if (params.supplierId) query.set('supplierId', params.supplierId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const queryString = query.toString();
  const endpoint = queryString ? `receipts?${queryString}` : 'receipts';

  return apiClient<ReceiptsListResponse>(endpoint);
}

export async function getReceiptById(id: string): Promise<Receipt> {
  return apiClient<Receipt>(`receipts/${id}`);
}

export async function createReceipt(data: CreateReceiptDto): Promise<Receipt> {
  return apiClient<Receipt>('receipts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateReceiptHeader(id: string, data: UpdateReceiptDto): Promise<Receipt> {
  return apiClient<Receipt>(`receipts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function replaceReceiptLines(
  id: string,
  lines: CreateReceiptLineDto[],
): Promise<Receipt> {
  return apiClient<Receipt>(`receipts/${id}/lines`, {
    method: 'PUT',
    body: JSON.stringify({ lines }),
  });
}

export async function deleteReceipt(id: string): Promise<void> {
  return apiClient<void>(`receipts/${id}`, {
    method: 'DELETE',
  });
}

export async function postReceipt(id: string, idempotencyKey?: string): Promise<Receipt> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  return apiClient<Receipt>(`receipts/${id}/post`, {
    method: 'POST',
    headers,
  });
}

export async function voidReceipt(id: string, voidReason: string): Promise<Receipt> {
  return apiClient<Receipt>(`receipts/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ voidReason }),
  });
}
