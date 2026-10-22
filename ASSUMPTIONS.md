# Assumptions & Open Architectural Questions

This document records the confirmed assumptions, resolved technical decisions, and open questions across development phases for the **Inventory Receipts with Costing and GL Posting** ERP system.

---

## 1. Confirmed Architectural Decisions (Phases 01, 02, 03, 04, 05 & 06)

1. **Monorepo Architecture**:
   - The system is organized as a modular monorepo managed with `pnpm` workspaces (`backend` and `frontend`).
   - Packages maintain independent `package.json` manifests and TypeScript compilation contexts.

2. **Database Engine & Persistence (Phase 02)**:
   - PostgreSQL 16 is the standard database engine running via Docker Compose on host port **`5434`** (forwarded to container port `5432`).
   - Prisma ORM 6.19+ manages schema definitions, migration SQL generation, and type-safe query execution.
   - Initial migration `20261022084335_init_database_foundation` successfully applies 17 relational tables, 11 enums, and foreign key constraints.
   - Secondary migration `20261022090116_add_auth_credentials_and_super_admin` adds `SUPER_ADMIN` to `UserRole` and `passwordHash` to `User`.

3. **Decimal Precision & Monetary Invariants**:
   - Monetary amounts (`totalAmount`, `debit`, `credit`, `taxAmount`, `subtotal`) are typed as **`DECIMAL(19, 4)`**.
   - Unit costs (`unitCost`, `averageCost`, `standardCost`) are typed as **`DECIMAL(19, 4)`** to prevent fractional rounding drift during moving average calculations.
   - Quantities (`quantityReceived`, `quantityOnHand`, `quantity`) are typed as **`DECIMAL(18, 4)`** to support fractional units of measure (e.g. KG, Liters, Meters).
   - Floating-point arithmetic (`FLOAT`/`DOUBLE PRECISION`) is strictly forbidden.
   - Server calculation is enforced via `DecimalMath` using `Prisma.Decimal` and `ROUND_HALF_UP` to 4 decimal places.

4. **Multi-Tenancy & Referential Integrity**:
   - `companyId` is mandatory across all domain records.
   - Intra-tenant uniqueness is enforced via compound unique indexes:
     - `@@unique([companyId, code])`
     - `@@unique([companyId, sku])`
     - `@@unique([companyId, email])`
     - `@@unique([companyId, receiptNumber])`
     - `@@unique([companyId, entryNumber])`
     - `@@unique([companyId, warehouseId, itemId])`
   - Master entities (`Account`, `Item`, `Warehouse`, `Supplier`, `Company`) enforce `onDelete: Restrict` to preserve transaction history and financial audit trails.

5. **Security, Authentication & Authorization (Phase 03)**:
   - **Password Hashing**: Argon2id via `@node-rs/argon2` is the standard cryptographic hash algorithm.
   - **Tenant-Scoped Credentials**: Because user email is unique per company, login requires `{ companyCode, email, password }` to resolve tenant context unambiguously.
   - **Enumeration Protection**: Generic authentication failure response (`HTTP 401: Invalid company, email, or password`) protects against user or tenant enumeration.
   - **Token Expiry**: Default JWT access token expiration is 3600 seconds (1 hour).
   - **Active State Revalidation**: Every authenticated request verifies active flags (`user.isActive` and `company.isActive`) against live database state.
   - **Multi-Tenant Guarding**: `CompanyAccessGuard` strictly enforces that routes requesting resources under `/api/v1/companies/:companyId/...` match `req.user.companyId` unless the user carries `SUPER_ADMIN` privileges.
   - **HTTP Hardening**: Helmet middleware sets HTTP security headers; correlation IDs (`X-Correlation-ID`) are injected/propagated on all requests.

6. **Receipt Draft Management & Business Rules (Phase 04)**:
   - Newly created receipts always start in `DRAFT` status.
   - A receipt must contain at least 1 line item upon creation and during line updates. Deletion of the last remaining line is blocked.
   - Line numbers are maintained sequentially ($1, 2, \dots, n$) without gaps.
   - Quantities must be strictly positive ($>0$).
   - Unit costs must be non-negative ($\ge 0$). Zero cost is supported for samples or warranty replacements.
   - All referenced entities (warehouse, supplier, line items) must belong to the authenticated company and be active.
   - Non-draft receipts (`POSTED`, `CANCELLED`) cannot be modified or deleted.
   - Draft receipts can be deleted, cascading line items cleanly in PostgreSQL.
   - Status transitions to `POSTED` or `CANCELLED` cannot be forged through draft management endpoints.
   - Atomic line reconciliation is supported via `PUT/PATCH /api/v1/receipts/:id/lines`.

7. **Inventory Costing Policy, Stock Balances & Ledger Invariants (Phase 05)**:
   - **Costing Valuation Model**: Moving Weighted-Average Costing per **`[companyId, warehouseId, itemId]`**. Each warehouse maintains distinct inventory balances and independent moving averages for each SKU.
   - **Inbound Movement Valuation**:
     $$\text{New Qty} = Q_{\text{prev}} + Q_{\text{in}}$$
     $$\text{Incoming Value} = \text{round}_4(Q_{\text{in}} \times C_{\text{in}})$$
     $$\text{New Value} = V_{\text{prev}} + \text{Incoming Value}$$
     $$\text{New Avg Cost} = \begin{cases} C_{\text{in}}, & \text{if } Q_{\text{prev}} = 0 \\ \text{round}_4\left(\frac{\text{New Value}}{\text{New Qty}}\right), & \text{if } Q_{\text{prev}} > 0 \end{cases}$$
   - **Zero-Cost Inbound Movements**: Supported for promotional samples or warranty intake. $C_{\text{in}} = 0$, incoming value = \$0, new total value remains $V_{\text{prev}}$, and unit cost is diluted: $\frac{V_{\text{prev}}}{Q_{\text{prev}} + Q_{\text{in}}}$.
   - **Outbound Movement Valuation**: Always relieved at current moving average cost:
     $$\text{Deducted Value} = \text{round}_4(Q_{\text{out}} \times C_{\text{current}})$$
     $$\text{New Qty} = Q_{\text{prev}} - Q_{\text{out}}$$
     $$\text{New Value} = V_{\text{prev}} - \text{Deducted Value}$$
     $$\text{New Avg Cost} = C_{\text{current}}$$
   - **Depletion to Zero Invariant**: When an outbound movement reduces quantity to exactly zero ($Q_{\text{out}} = Q_{\text{prev}}$), $\text{totalValue}$ and $\text{averageCost}$ are strictly set to $0$ to guarantee that zero stock never retains residual rounding drift on the balance sheet.
   - **Negative Stock & Insufficient Stock Policy**: Negative stock is strictly forbidden. Outbound requests where $Q_{\text{out}} > Q_{\text{prev}}$ are immediately rejected with `InsufficientStockException` (`HTTP 400`).
   - **Backdated Movements**: In a perpetual moving average system, movements are evaluated against the live balance at transaction commitment. Retroactive re-costing is not supported without complex ledger replay.
   - **Immutability & Reversals**: `StockMovement` records are strictly append-only. Correction is achieved through linked compensating movements (`referenceType = 'STOCK_MOVEMENT_REVERSAL'`). Duplicate reversals of the same movement are blocked.
   - **Concurrency Control**: Concurrency is managed via explicit PostgreSQL row locking (`SELECT ... FOR UPDATE`) within Prisma transactions. To eliminate initial-balance race conditions, zero-balance rows are upserted via `INSERT ... ON CONFLICT DO NOTHING` prior to acquiring locks. Transient serialization/deadlock errors are retried with bounded exponential jittered backoff. Multi-row transactions order lock acquisitions deterministically by `itemId: asc`.

8. **Accounting Foundation, Chart of Accounts & Period Rules (Phase 06)**:
   - **Chart of Accounts Hierarchy**: Accounts support self-referencing tree structures via `parentId String?` (`parent` / `children` relations with `onDelete: Restrict`).
   - **Account Tree Integrity**: Cycle detection algorithm prevents recursive parentage, and self-parenting (`id === parentId`) is explicitly rejected. Deletion is blocked (`HTTP 409`) if an account has child accounts, transaction lines, items referencing it as an asset account, or is configured as the company GRN clearing account.
   - **Accounting Periods**: Enforce `startDate <= endDate` with inclusive calendar date boundaries. Overlapping periods within the same company are strictly prohibited (`HTTP 409`). Closed periods cannot be reopened if audit controls are violated. Transaction posting requires an active `OPEN` period covering the transaction date.
   - **Inventory Accounts Mapping**:
     - **GRN Clearing Account (Accrued Inventory)**: Configured at the company level via `Company.grnClearingAccountId`. Must belong to the same tenant, be active, and have type `LIABILITY`.
     - **Inventory Asset Account**: Configured per SKU via `Item.assetAccountId`. Must belong to the same tenant, be active, and have type `ASSET`.
     - Reusable resolver `resolveReceiptAccounts(companyId, itemIds, tx)` provides single-query resolution and validation of accounts for receipt posting workflows.
   - **Pure Double-Entry Validation Engine (`JournalValidatorService`)**:
     - Minimum 2 lines required per journal entry.
     - Exact mathematical balance: $\sum \text{Debit} = \sum \text{Credit}$ evaluated using `Prisma.Decimal` with 4-decimal precision (`ROUND_HALF_UP`). Any imbalance is rejected with `HTTP 400 Unprocessable Entity`.
     - Single-leg rule: each line must have either `debit > 0, credit = 0` OR `credit > 0, debit = 0`. Negative amounts and dual-sided lines are strictly disallowed.
     - Zero-value lines (`debit = 0, credit = 0`) are rejected.
     - All referenced accounts must belong to the same tenant and be active.
     - Transaction date must fall within an open accounting period for the tenant.

---

## 2. Unresolved Questions & Technical Recommendations

| #      | Question / Requirement Item                     | Impact on Phase 07          | Architectural Recommendation                                                                                                                                                       |
| ------ | ----------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Receipt Posting Atomic Orchestration**        | Phase 07 Receipt Posting    | Wrap receipt status transition (`DRAFT -> POSTED`), inventory ledger movements, stock balance locks, and GL journal entry generation in a single atomic PostgreSQL transaction.    |
| **Q2** | **Receipt Cancellation & Reversals**            | Phase 07 Posting Reversals  | A posted receipt cannot be deleted. Cancellation must atomically generate compensating stock movements and an offsetting reversing journal entry within an open accounting period. |
| **Q3** | **Landed Cost Allocation**                      | Phase 07 Costing Engine     | Landed freight/customs costs can be prorated across receipt lines based on quantity or value, adjusting both inventory valuation and GRN clearing or freight absorption accounts.  |
| **Q4** | **Sub-ledger to General Ledger Reconciliation** | Phase 07/08 Audit & Reports | Periodic integrity verification job comparing sum of `StockBalance.totalValue` per company against the General Ledger Inventory Asset account balance.                             |

---

## 3. Decisions Deferred to Later Phases

1. **Receipt Posting & GL Posting Workflow (Phase 07)**:
   - Endpoint `POST /api/v1/receipts/:id/post` orchestrating stock movement creation, moving weighted average updates, and journal entry generation.
   - Endpoint `POST /api/v1/receipts/:id/cancel` orchestrating reversals.
2. **Frontend UI Pages (Phase 08)**:
   - Warehouse receipt entry UI, line reconciliation, receipt posting dialogs, stock balance inquiry, and journal entry audit views.
3. **Advanced Financial Reporting (Phase 09)**:
   - Trial Balance, Balance Sheet, Income Statement, and GL-to-Subledger reconciliation reports.
