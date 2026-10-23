import { apiClient } from './client';
import { StockCardResponse } from '../types';

export interface GetStockCardParams {
  from?: string;
  to?: string;
  warehouseId?: string;
  page?: number;
  limit?: number;
}

export async function getItemStockCard(
  itemId: string,
  params?: GetStockCardParams,
): Promise<StockCardResponse> {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const endpoint = qs ? `items/${itemId}/stock-card?${qs}` : `items/${itemId}/stock-card`;
  return apiClient<StockCardResponse>(endpoint);
}
