import type { Item } from '../stock-card/types';

export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address?: string | null;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  companyId: string;
  code: string;
  name: string;
  taxId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
}

export type { Item };
