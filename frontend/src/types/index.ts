// Global application types
export * from './routes';
export * from './pagination';
export * from './i18n';

// Page-specific types from services
export type {
  User,
  UserRole,
  LoginCredentials,
  AuthResponse,
  AuthContextType,
  Company,
} from '../services/auth/types';

export type {
  Receipt,
  ReceiptLine,
  ReceiptStatus,
  CreateReceiptDto,
  CreateReceiptLineDto,
  UpdateReceiptDto,
  ReplaceReceiptLinesDto,
  QueryReceiptsParams,
  FormLineState,
  ReceiptsListResponse,
} from '../services/receipts/types';

export type {
  Item,
  StockMovementRow,
  StockCardResponse,
  GetStockCardParams,
} from '../services/stock-card/types';

export type {
  Account,
  AccountType,
  AccountNormalBalance,
  InventoryAccountsConfig,
  CreateAccountDto,
  UpdateAccountDto,
  UpdateInventoryAccountsConfigDto,
  AccountsResponse,
} from '../services/chart-of-accounts/types';

export type {
  AccountingPeriod,
  CreateAccountingPeriodDto,
  CloseAccountingPeriodDto,
  PeriodsResponse,
} from '../services/accounting-periods/types';

export type {
  TrialBalanceResult,
  TrialBalanceAccountRow,
  InventoryGlReconciliationResult,
} from '../services/trial-balance/types';

export type {
  AuditEvent,
  QueryAuditEventsParams,
  AuditEventsResponse,
} from '../services/audit-trail/types';

export type {
  Warehouse,
  Supplier,
} from '../services/references/types';
