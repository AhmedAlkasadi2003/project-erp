import { apiClient } from './client';
import { Item, Supplier, Warehouse } from '../types';

export async function getCompanyWarehouses(companyId: string): Promise<Warehouse[]> {
  return apiClient<Warehouse[]>(`companies/${companyId}/warehouses`);
}

export async function getCompanyItems(companyId: string): Promise<Item[]> {
  return apiClient<Item[]>(`companies/${companyId}/items`);
}

export async function getCompanySuppliers(companyId: string): Promise<Supplier[]> {
  return apiClient<Supplier[]>(`companies/${companyId}/suppliers`);
}
