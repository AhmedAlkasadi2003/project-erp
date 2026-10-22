export type UserRole =
  'ADMIN' | 'ACCOUNTANT' | 'WAREHOUSE_MANAGER' | 'CLERK' | 'VIEWER' | 'SUPER_ADMIN';

export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED' | 'CANCELLED';

export interface User {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface Item {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description?: string | null;
  uom: string;
  valuationMethod: string;
  isActive: boolean;
  assetAccount?: {
    code: string;
    name: string;
  } | null;
}

export interface ReceiptLine {
  id: string;
  receiptId: string;
  lineNumber: number;
  itemId: string;
  quantityReceived: string;
  unitCost: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: Item;
}

export interface Receipt {
  id: string;
  companyId: string;
  warehouseId: string;
  supplierId: string;
  receiptNumber: string;
  status: ReceiptStatus;
  receiptDate: string;
  postingDate?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  notes?: string | null;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  journalEntryId?: string | null;
  postedById?: string | null;
  voidedById?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: ReceiptLine[];
  warehouse?: Warehouse;
  supplier?: Supplier;
  postedByUser?: { id: string; firstName: string; lastName: string; email: string } | null;
  voidedByUser?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ReceiptsListResponse {
  data: Receipt[];
  meta: PaginationMeta;
}

export interface CreateReceiptLineDto {
  itemId: string;
  quantityReceived: string;
  unitCost: string;
  taxAmount?: string;
  notes?: string;
}

export interface CreateReceiptDto {
  warehouseId: string;
  supplierId: string;
  receiptNumber?: string;
  receiptDate?: string;
  notes?: string;
  lines: CreateReceiptLineDto[];
}

export interface UpdateReceiptDto {
  warehouseId?: string;
  supplierId?: string;
  receiptNumber?: string;
  receiptDate?: string;
  notes?: string;
}

export interface ReplaceReceiptLinesDto {
  lines: CreateReceiptLineDto[];
}

export interface QueryReceiptsParams {
  page?: number;
  limit?: number;
  status?: ReceiptStatus;
  warehouseId?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'receiptDate' | 'receiptNumber' | 'totalAmount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface LoginCredentials {
  companyCode: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}
