import type { PaginationMeta } from '../../types/pagination';
import type { Item } from '../stock-card/types';
import type { Warehouse, Supplier } from '../references/types';

export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED' | 'CANCELLED';

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

export interface FormLineState {
  id?: string;
  itemId: string;
  quantityReceived: string;
  unitCost: string;
  taxAmount: string;
  notes: string;
}
