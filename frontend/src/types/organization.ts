export interface Company {
  id: string;
  code: string;
  name: string;
  currency: string;
  fiscalYearStart?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

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
