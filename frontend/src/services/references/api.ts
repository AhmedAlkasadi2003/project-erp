import { apiClient } from '../client';
import { Item, Supplier, Warehouse } from './types';

export async function getCompanyWarehouses(companyId?: string): Promise<Warehouse[]> {
  const endpoint = companyId ? `companies/${companyId}/warehouses` : 'warehouses';
  return apiClient<Warehouse[]>(endpoint);
}

export async function getCompanySuppliers(companyId?: string): Promise<Supplier[]> {
  const endpoint = companyId ? `companies/${companyId}/suppliers` : 'suppliers';
  return apiClient<Supplier[]>(endpoint);
}

export async function getCompanyItems(companyId?: string): Promise<Item[]> {
  const endpoint = companyId ? `companies/${companyId}/items` : 'items';
  return apiClient<Item[]>(endpoint);
}
