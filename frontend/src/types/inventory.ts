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

export interface StockMovementRow {
  id: string;
  movementDate: string;
  createdAt: string;
  movementType: 'INBOUND' | 'OUTBOUND' | 'REVERSAL' | 'ADJUSTMENT';
  referenceType: string;
  referenceId: string;
  receiptId?: string | null;
  receiptLineId?: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  runningQuantity: string;
  runningAverageCost: string;
  performedBy?: { id: string; name?: string; email: string } | null;
}

export interface StockCardResponse {
  item: {
    id: string;
    sku: string;
    name: string;
    description?: string | null;
    uom: string;
    valuationMethod: string;
  };
  period: {
    from?: string;
    to?: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  openingBalance: {
    quantity: string;
    averageCost: string;
    totalValue: string;
  };
  movements: StockMovementRow[];
  closingBalance: {
    quantity: string;
    averageCost: string;
    totalValue: string;
  };
  currentBalances: Array<{
    warehouseId: string;
    warehouse: { id: string; code: string; name: string };
    onHandQuantity: string;
    allocatedQuantity: string;
    availableQuantity: string;
    averageCost: string;
    totalValue: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}
