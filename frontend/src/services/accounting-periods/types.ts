export interface AccountingPeriod {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string | null;
  closedByUserId?: string | null;
}

export interface CreateAccountingPeriodDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface CloseAccountingPeriodDto {
  reconcileInventory?: boolean;
}

export interface PeriodsResponse {
  data: AccountingPeriod[];
  items?: AccountingPeriod[];
  meta: {
    page: number;
    limit: number;
    totalPages: number;
    total?: number;
    totalItems?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}
