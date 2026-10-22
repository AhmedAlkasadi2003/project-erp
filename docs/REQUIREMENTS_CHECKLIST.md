# Requirements Verification & Compliance Checklist

**Project**: Inventory Receipts with Costing and GL Posting  
**Current Phase**: Phase 09 — Backend Integration Testing, Concurrency & Reliability Hardening  
**Status**: 100% Verified & Passing (264/264 Tests Green)

---

## 1. Phase 01: Workspace Setup (Completed)

| Requirement            | Implementation Details                                               | Status   | Verification Evidence                              |
| ---------------------- | -------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| **Monorepo Structure** | `pnpm` workspaces with independent `backend` and `frontend` packages | **PASS** | `pnpm-workspace.yaml`, zero hoisting errors        |
| **Backend Workspace**  | NestJS 11 + TypeScript strict + `@nestjs/config` + `class-validator` | **PASS** | `pnpm --filter @inventory-erp/backend build`       |
| **Frontend Workspace** | React 19 + TypeScript + Vite 6 + Vitest                              | **PASS** | `pnpm --filter @inventory-erp/frontend build`      |
| **Docker PostgreSQL**  | PostgreSQL 16 Alpine containerized on port `5434` with health check  | **PASS** | `docker compose ps` -> `Up (healthy)`              |
| **Code Quality**       | ESLint 9 (Flat Config), Prettier 3, strict TypeScript flags          | **PASS** | `pnpm format:check`, `pnpm lint`, `pnpm typecheck` |
| **Health Probes**      | `GET /api/v1/health` verifying uptime & DB connectivity probe        | **PASS** | Unit spec + E2E spec + live curl test              |
| **Zero Scope Leak**    | No business UI, receipt forms, domain models, or accounting logic    | **PASS** | Audited git commit `7c379ed`                       |

---

## 2. Phase 02: Database Foundation & Prisma (Completed)

| Requirement               | Implementation Details                                                                         | Status   | Verification Evidence                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| **Prisma Configuration**  | Pinned Prisma `6.19.3` with PostgreSQL datasource and client generator                         | **PASS** | `prisma validate` succeeded                                      |
| **Company Model**         | Multi-tenant root entity with unique code, name, currency, fiscal start                        | **PASS** | PostgreSQL table `companies` exists                              |
| **User Model**            | Tenant-scoped user with `UserRole` enum (`ADMIN`, `ACCOUNTANT`, `CLERK`)                       | **PASS** | PostgreSQL table `users` with `@@unique([companyId, email])`     |
| **Warehouse Model**       | Multi-warehouse support with code, name, and address                                           | **PASS** | PostgreSQL table `warehouses` with `@@unique([companyId, code])` |
| **Supplier Model**        | Vendor records with tax ID, contact email, and payment terms                                   | **PASS** | PostgreSQL table `suppliers` with `@@unique([companyId, code])`  |
| **Item Master Model**     | SKU, UOM, valuation method, links to asset, COGS, and expense accounts                         | **PASS** | PostgreSQL table `items` with FKs to `accounts`                  |
| **StockBalance Model**    | On-hand quantity, total value, average cost, version for optimistic locking                    | **PASS** | PostgreSQL table `stock_balances`                                |
| **Receipt & ReceiptLine** | Header with status (`DRAFT`, `POSTED`, `CANCELLED`), lines with decimal quantities and costs   | **PASS** | PostgreSQL tables `receipts` and `receipt_lines`                 |
| **StockMovement Model**   | Immutable inventory ledger tracking quantity, unit cost, balance after, reference ID           | **PASS** | PostgreSQL table `stock_movements`                               |
| **Chart of Accounts**     | Account codes, classifications (`ASSET`, `LIABILITY`, etc.), normal balance (`DEBIT`/`CREDIT`) | **PASS** | PostgreSQL table `accounts` with `@@unique([companyId, code])`   |
| **Accounting Period**     | Fiscal periods (`OPEN`/`CLOSED`) with date ranges                                              | **PASS** | PostgreSQL table `accounting_periods`                            |
| **JournalEntry & Line**   | Balanced double-entry financial journal headers and lines with debit/credit                    | **PASS** | PostgreSQL tables `journal_entries` and `journal_lines`          |
| **Supporting Entities**   | `AuditEvent`, `IdempotencyRecord`, `OutboxEvent` implemented                                   | **PASS** | PostgreSQL tables present with indexes                           |
| **Decimal Precision**     | `Decimal(19, 4)` for monetary & cost, `Decimal(18, 4)` for quantities                          | **PASS** | Verified in `migration.sql` and database metadata                |
| **Migrations**            | Applied migration `20261022084335_init_database_foundation`                                    | **PASS** | Applied to PostgreSQL without errors                             |
| **Prisma Client Gen**     | Strongly-typed client generated to `node_modules`                                              | **PASS** | Generated in 935ms                                               |
| **Deterministic Seed**    | Seeded Company, Admin, Warehouse, Supplier, Accounts, Period, Items                            | **PASS** | `pnpm db:seed` idempotent run verified                           |
| **Referential Integrity** | `onDelete: Restrict` on master records, cascading only on draft child lines                    | **PASS** | Foreign key constraints present in SQL DDL                       |
| **Zero Secrets**          | All credentials in `.env` (git-ignored); `.env.example` safe                                   | **PASS** | Audited git status                                               |

---

## 3. Phase 03: Senior Backend Engineering, Security & Multi-Tenancy (Completed)

| Requirement                   | Implementation Details                                                                                                                   | Status   | Verification Evidence                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| **Pre-Implementation Audit**  | Inspected Prisma schema, models, migrations, and database engine; preserved all Phase 02 work                                            | **PASS** | Non-destructive audit completed without data loss                                  |
| **Schema Migration**          | Added `SUPER_ADMIN` to `UserRole` enum and `passwordHash` to `User` model; applied migration `20261022090116`                            | **PASS** | `prisma migrate status` confirms clean state                                       |
| **Password Hashing**          | Enterprise-grade Argon2id hashing via `@node-rs/argon2`                                                                                  | **PASS** | Verified in seed and `auth.service.spec.ts`                                        |
| **Tenant-Aware Login**        | `POST /api/v1/auth/login` requiring `{ companyCode, email, password }` with generic error messages preventing user enumeration           | **PASS** | Verified via unit tests and E2E test suite                                         |
| **JWT Access Tokens**         | Signed with HMAC-SHA256 (`@nestjs/jwt@^11.0.0`), configurable expiration, payload containing `sub`, `email`, `role`, and `companyId`     | **PASS** | Verified via Passport JWT strategy and E2E suite                                   |
| **Active Status Enforcement** | JWT strategy revalidates user existence, `isActive: true`, and `company.isActive: true` on every request                                 | **PASS** | E2E test verifies inactive users receive HTTP 401                                  |
| **RBAC Authorization**        | `@Roles()` decorator + `RolesGuard` enforcing `ADMIN`, `ACCOUNTANT`, `CLERK`, `VIEWER` with fail-closed default and `SUPER_ADMIN` bypass | **PASS** | `roles.guard.spec.ts` (9 tests passing) and E2E RBAC tests                         |
| **Multi-Tenant Guarding**     | `CompanyAccessGuard` strictly enforces route `:companyId` matches `req.user.companyId`; prevents cross-company data access               | **PASS** | `company-access.guard.spec.ts` (7 tests passing) and E2E cross-company tests       |
| **Companies Module**          | Tenant-scoped data endpoints: `/api/v1/companies/current`, `/:companyId`, `/:companyId/warehouses`, `/:companyId/items`                  | **PASS** | Verified in `auth-and-multi-tenancy.e2e-spec.ts` (HTTP 403 on cross-tenant access) |
| **Operational Security**      | Helmet middleware for HTTP security headers, CORS protection, and body validation filters                                                | **PASS** | Verified via HTTP headers inspection in E2E tests                                  |
| **Correlation Tracking**      | `CorrelationIdMiddleware` assigns or echoes `X-Correlation-ID` header on all requests                                                    | **PASS** | Verified in E2E tests (asserts `x-correlation-id` header presence)                 |
| **Centralized Error Filter**  | `AllExceptionsFilter` standardizes error responses and masks internal database/stack traces in production                                | **PASS** | Verified via exception filter test specs                                           |
| **Deterministic Seed (Auth)** | Seeded 5 users across 2 tenant companies with Argon2id hashed passwords                                                                  | **PASS** | `pnpm db:seed` executes cleanly and idempotently                                   |
| **Automated Test Coverage**   | 4 unit test suites (22/22 passing) and 2 real PostgreSQL E2E suites (17/17 passing)                                                      | **PASS** | `pnpm test` and `pnpm test:e2e` 100% green                                         |
| **Scope Enforcement**         | Zero receipt workflows, stock costing, journal posting, or frontend UI implemented in this phase                                         | **PASS** | Codebase audit confirms strict phase boundary compliance                           |

---

## 4. Phase 04: Inventory Receipts Drafts & Management API (Completed)

| Requirement                     | Implementation Details                                                                                                                                           | Status   | Verification Evidence                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| **Draft Creation Endpoint**     | `POST /api/v1/receipts` creates draft with 1+ lines, server-calculated totals, auto/custom receipt number                                                        | **PASS** | Verified in `receipts.service.spec.ts` and `receipts.e2e-spec.ts`             |
| **List Receipts & Pagination**  | `GET /api/v1/receipts` with `page`, `limit`, `status`, `warehouseId`, `supplierId`, `startDate`, `endDate`, `search`, deterministic sorting, and pagination meta | **PASS** | Verified in `receipts.service.spec.ts` and `receipts.e2e-spec.ts`             |
| **Get Receipt By ID**           | `GET /api/v1/receipts/:id` retrieves complete document, line items, item master attributes, warehouse, and supplier details                                      | **PASS** | Verified in `receipts.service.spec.ts` and `receipts.e2e-spec.ts`             |
| **Update Draft Header**         | `PATCH /api/v1/receipts/:id` updates warehouse, supplier, receiptDate, receiptNumber, and notes on drafts only                                                   | **PASS** | Verified in `receipts.e2e-spec.ts`                                            |
| **Atomic Lines Reconciliation** | `PUT/PATCH /api/v1/receipts/:id/lines` replaces/reconciles all lines atomically, re-indexes line numbers sequentially, and recalculates totals                   | **PASS** | Verified in `receipts.e2e-spec.ts`                                            |
| **Dedicated Line Endpoints**    | `POST /:id/lines`, `PATCH /:id/lines/:lineId`, and `DELETE /:id/lines/:lineId` for fine-grained line mutations                                                   | **PASS** | Verified in `receipts.e2e-spec.ts`                                            |
| **Draft Deletion Policy**       | `DELETE /api/v1/receipts/:id` cleanly cascades lines for DRAFT receipts; blocks deletion on POSTED/CANCELLED receipts with HTTP 409 Conflict                     | **PASS** | Verified in `receipts.e2e-spec.ts`                                            |
| **Non-Draft Mutation Guard**    | Reject any update or deletion if receipt status is `POSTED` or `CANCELLED` (HTTP 400 / 409)                                                                      | **PASS** | Verified in `receipts.e2e-spec.ts` (tested with mocked POSTED receipt)        |
| **Status Forgery Prevention**   | Clients cannot forge `status` (e.g. POSTED) or `companyId` via DTOs (`whitelist: true`, `forbidNonWhitelisted: true`)                                            | **PASS** | Verified in `receipts.e2e-spec.ts` (HTTP 400 rejected on status/companyId)    |
| **Financial Decimal Precision** | `DecimalMath` handles calculations using `Prisma.Decimal` and `ROUND_HALF_UP` at 4 decimal places; tested with fractional quantities/costs, zero cost, and max   | **PASS** | `decimal-math.util.spec.ts` (12 tests) and `receipts.e2e-spec.ts`             |
| **Strict Positive Quantities**  | `@IsPositiveDecimal()` rejects 0, negative, non-number strings                                                                                                   | **PASS** | Verified in validator unit specs and e2e payload rejects                      |
| **Non-Negative Unit Costs**     | `@IsNonNegativeDecimal()` accepts 0 (samples/warranty), rejects negative values                                                                                  | **PASS** | Verified in validator unit specs and e2e payload rejects                      |
| **Minimum 1 Line Policy**       | Reject receipt creation or updates with 0 lines; reject deleting the only remaining line item                                                                    | **PASS** | Verified in e2e tests (HTTP 400 on empty lines array & last line removal)     |
| **Tenant Isolation & IDOR**     | Company 1 user cannot read, update, or delete Company 2 receipts (HTTP 403 Forbidden); related entities must belong to user company                              | **PASS** | Verified in `receipts.e2e-spec.ts` (cross-tenant warehouse/item/receipt test) |
| **Transactional Atomicity**     | `$transaction` guarantees receipt + lines creation or line reconciliation roll back completely on validation failure                                             | **PASS** | Verified via rollback checks and atomicity tests                              |
| **Strict Boundaries Preserved** | Zero stock movements, stock balance mutations, costing, GL postings, or UI created in this phase                                                                 | **PASS** | Audited codebase and Git status                                               |

---

## 5. Phase 05: Inventory Ledger, Stock Balances & Weighted Average Costing (Completed)

| Requirement                       | Implementation Details                                                                                                                                              | Status   | Verification Evidence                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| **Valuation Policy Specs**        | Moving weighted-average costing policy documented per `[companyId, warehouseId, itemId]` in `ASSUMPTIONS.md`                                                        | **PASS** | `ASSUMPTIONS.md` updated with exact rounding and edge case rules                     |
| **Costing Engine**                | Pure domain service `CostingEngineService` implementing moving weighted average with `Prisma.Decimal` and `ROUND_HALF_UP` to 4 decimal places                       | **PASS** | `costing-engine.service.spec.ts` (10/10 tests passing)                               |
| **Initial Intake / Zero Stock**   | Inbound intake on zero on-hand quantity directly assigns incoming unit cost without division by zero                                                                | **PASS** | Verified in unit and E2E tests                                                       |
| **Zero-Cost Inbound Goods**       | Receipts at `0.0000` unit cost (e.g. promotional samples or warranty intake) dilute moving average unit cost correctly                                              | **PASS** | Verified in unit and E2E tests                                                       |
| **Outbound Relieving Cost**       | Outbound issues strictly relieved at current moving average cost, reducing `totalValue` proportionally                                                              | **PASS** | Verified in unit and E2E tests                                                       |
| **Depletion & Residual Drift**    | Full depletion ($Q_{\text{out}} = Q_{\text{onhand}}$) strictly resets `totalValue` and `averageCost` to `0.0000` to prevent residual penny drift                    | **PASS** | Verified in unit test `should zero out totalValue and averageCost on full depletion` |
| **Negative Stock Prevention**     | Throws `InsufficientStockException` (HTTP 400 Bad Request) with structured payload if outgoing quantity exceeds available on-hand balance                           | **PASS** | `insufficient-stock.exception.ts` verified in unit and E2E tests                     |
| **Atomic Balance Row Creation**   | PostgreSQL atomic `INSERT ... ON CONFLICT ("companyId", "warehouseId", "itemId") DO NOTHING` ensures row exists before row-lock, eliminating initial race condition | **PASS** | Verified in `test/inventory-ledger-and-costing.e2e-spec.ts` under parallel promises  |
| **Row-Level Concurrency Lock**    | `SELECT ... FOR UPDATE` acquires exclusive row lock inside transaction, preventing lost updates and race condition drifts under concurrent writes                   | **PASS** | Verified in parallel stress test in `inventory-ledger-and-costing.e2e-spec.ts`       |
| **Deadlock Prevention Ordering**  | Multiple items locked in deterministic order sorted by `itemId: 'asc'` to prevent circular wait deadlocks                                                           | **PASS** | Verified in multi-item transaction logic                                             |
| **Append-Only Stock Ledger**      | Every intake or issue writes an immutable `StockMovement` recording quantities, unit cost, value, and balance snapshot (`quantityAfter`, `totalValueAfter`)         | **PASS** | Verified in `inventory-ledger.service.spec.ts` and E2E tests                         |
| **Movement Reversal Workflow**    | `reverseMovement` writes a compensating movement (`STOCK_MOVEMENT_REVERSAL`), blocks duplicate reversals, and validates remaining stock on inbound reversals        | **PASS** | Verified in unit test and E2E test suite                                             |
| **Transient Retry Wrapper**       | `withRetry` with bounded exponential backoff & jitter handles PostgreSQL serialization (`40001`), deadlock (`40P01`), and Prisma write conflict (`P2034`)           | **PASS** | Verified in `inventory-ledger.service.ts`                                            |
| **Stock Balances Query API**      | `GET /api/v1/inventory/balances` with tenant filtering, pagination, sorting, search, warehouse, and item filters                                                    | **PASS** | Guarded by `JwtAuthGuard` & `RolesGuard`; verified in E2E tests                      |
| **Balance Reconciliation API**    | `GET /api/v1/inventory/reconcile/:warehouseId/:itemId` read-only audit comparing live snapshot against ledger movement sums                                         | **PASS** | Returns `{ inSync, deltaQuantity, deltaTotalValue }`; verified in E2E tests          |
| **Strict Multi-Tenant Isolation** | Cross-company balance and ledger queries strictly return HTTP 403 or empty sets; tenant boundaries fully enforced                                                   | **PASS** | Verified in `inventory-ledger-and-costing.e2e-spec.ts`                               |
| **Boundary Preservation**         | Zero receipt posting orchestration (`DRAFT` $\to$ `POSTED`), zero General Ledger entries, and zero UI created in Phase 05                                           | **PASS** | Verified in Phase 04 draft isolation test and git inspection                         |

---

## 6. Phase 06: Accounting Foundation, Chart of Accounts & Accounting Periods (Completed)

| Requirement                     | Implementation Details                                                                                                                               | Status   | Verification Evidence                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| **Account Hierarchy & Schema**  | Added `parentId String?` with self-referencing tree relation (`parent`/`children`, `onDelete: Restrict`) and `Company.grnClearingAccountId`          | **PASS** | Migration `20261022123745_add_account_hierarchy_and_company_clearing_account` applied  |
| **Intra-Tenant Account Code**   | Accounts enforce unique code per tenant (`@@unique([companyId, code])`), name, classification, and normal balance                                    | **PASS** | Verified in `accounts.service.spec.ts` & `accounting-foundation.e2e-spec.ts`           |
| **Account Tree Integrity**      | Parent existence, tenant matching, cycle detection algorithm, and self-parenting prevention                                                          | **PASS** | Verified in `accounts.service.spec.ts` & `accounting-foundation.e2e-spec.ts`           |
| **Account Safe Deletion**       | Deletion blocked with HTTP 409 if referenced by child accounts, journal lines, item asset accounts, or company GRN clearing config                   | **PASS** | Verified in `accounts.service.spec.ts` & `accounting-foundation.e2e-spec.ts`           |
| **Accounting Periods API**      | CRUD for periods (`name`, `startDate`, `endDate`, `status`), with inclusive boundary enforcement and chronological sorting                           | **PASS** | Verified in `accounting-periods.service.spec.ts` & E2E suite                           |
| **Period Overlap Prevention**   | Query checks for any overlapping date intervals within the same tenant; rejects collisions with HTTP 409 Conflict                                    | **PASS** | Verified in `accounting-periods.service.spec.ts` & E2E suite                           |
| **Period Closure Lifecycle**    | Endpoints to close or reopen fiscal periods with tenant checks                                                                                       | **PASS** | Verified in `accounting-periods.service.spec.ts` & E2E suite                           |
| **Transaction Date Validation** | `getEligibleOpenPeriod(companyId, date, tx)` and `isDateInOpenPeriod` ensure transactions only occur in open periods                                 | **PASS** | Verified in `accounting-periods.service.spec.ts` & `journal-validator.service.spec.ts` |
| **GRN Clearing Configuration**  | Company-level clearing account configuration (`/api/v1/accounting/inventory-accounts/config`); validates tenant, active state, and `LIABILITY` type  | **PASS** | Verified in `inventory-accounts.service.spec.ts` & E2E suite                           |
| **Receipt Accounts Resolver**   | Reusable `resolveReceiptAccounts(companyId, itemIds, tx)` resolving GRN clearing and item asset accounts (`ASSET` type) for posting preparation      | **PASS** | Verified in `inventory-accounts.service.spec.ts` (7 unit tests passing)                |
| **Double-Entry Validation**     | `JournalValidatorService` enforcing min 2 lines, exact balance $\sum \text{Debit} = \sum \text{Credit}$ at 4 decimals (`ROUND_HALF_UP`)              | **PASS** | `journal-validator.service.spec.ts` (14 unit tests passing)                            |
| **Single-Leg Line Invariant**   | Each journal line must have either `debit > 0, credit = 0` OR `credit > 0, debit = 0`; dual or negative values rejected with HTTP 400                | **PASS** | Verified in validator unit tests and E2E tests                                         |
| **Zero-Value Line Rejection**   | Lines with `debit = 0, credit = 0` rejected with HTTP 400                                                                                            | **PASS** | Verified in validator unit tests and E2E tests                                         |
| **Journal Draft Creation**      | `POST /api/v1/journal-entries` validates accounts & period, generates sequential line numbers, assigns entry number, and persists DRAFT entry        | **PASS** | Verified in `journal-entries.service.spec.ts` & E2E suite                              |
| **Validate-Only Endpoint**      | `POST /api/v1/journal-entries/validate` runs complete domain validation without persisting records, returning validation errors or `{ valid: true }` | **PASS** | Verified in `journal-entries.service.spec.ts` & E2E suite                              |
| **Journal List & Query API**    | `GET /api/v1/journal-entries` and `GET /api/v1/journal-entries/:id` with tenant isolation, status, period, and date filtering                        | **PASS** | Verified in `journal-entries.service.spec.ts` & E2E suite                              |
| **Multi-Tenant Security**       | Strict multi-tenant isolation across all accounting endpoints; cross-tenant references rejected with HTTP 403 or HTTP 404                            | **PASS** | Verified in `test/accounting-foundation.e2e-spec.ts` (33 E2E tests passing)            |
| **Strict Scope Enforcement**    | Zero receipt posting orchestration, zero stock movements created from receipts, zero frontend UI in Phase 06                                         | **PASS** | Audited codebase and Git status                                                        |

---

## 7. Phase 07: Atomic Receipt Posting, Inventory Integration & Safe Void Workflow (Completed)

| Requirement                      | Implementation Details                                                                                                                                      | Status   | Verification Evidence                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| **Schema Migration**             | Added `VOIDED` to `ReceiptStatus` enum, added `postedById`, `voidedById`, `voidedAt`, and `voidReason` to `Receipt`, indexed movements on receipt/line      | **PASS** | Migration `20261022131957_add_receipt_posting_void_and_indexes` applied cleanly        |
| **Atomic Posting Endpoint**      | `POST /api/v1/receipts/:id/post` coordinates receipt state, inventory ledger, stock balances, moving average costs, GL journal, and audit in single Tx      | **PASS** | Verified in `receipt-posting.service.spec.ts` & `receipt-posting-and-void.e2e-spec.ts` |
| **Single & Multi-line Posting**  | Processes 1 or multiple receipt lines, updating each item's stock balance, moving average cost, and debiting respective inventory asset accounts            | **PASS** | Verified in E2E tests with exact mathematical asset & clearing sums                    |
| **Double-Entry Balance**         | Reusable `JournalValidatorService` enforces exact balance $\sum \text{Debit} = \sum \text{Credit}$ at 4 decimals (`ROUND_HALF_UP`) before persisting        | **PASS** | Verified in unit and E2E test suites (zero imbalance allowed)                          |
| **Open Period Validation**       | Enforces transaction date falls within active `OPEN` accounting period; rejects postings to closed periods or missing periods with HTTP 400 Bad Request     | **PASS** | Verified in E2E test `should reject posting and leave no partial changes` (closed/no)  |
| **Accounts Resolution**          | `resolveReceiptAccounts` validates company GRN clearing account (`LIABILITY`) and item asset accounts (`ASSET`), rejecting missing or inactive accounts     | **PASS** | Verified in unit and E2E test suites                                                   |
| **Row-Level Concurrency Lock**   | `SELECT ... FOR UPDATE` on receipt row inside transaction prevents concurrent double postings or races between post and void                                | **PASS** | Parallel stress test verified in `receipt-posting-and-void.e2e-spec.ts` (1 won, 1 409) |
| **Deterministic Lock Order**     | Lines sorted by `itemId: 'asc'` before balance lock acquisition eliminates circular wait deadlocks across concurrent multi-SKU receipts                     | **PASS** | Verified in concurrent multi-receipt parallel test                                     |
| **Transient Retry Policy**       | Bounded exponential backoff with random jitter handles PostgreSQL serialization conflicts (`40001`), deadlocks (`40P01`), and write conflicts (`P2034`)     | **PASS** | `withRetry` implemented and tested in `receipt-posting.service.ts`                     |
| **Idempotency Protection**       | Supports `Idempotency-Key` header via `IdempotencyRecord`; returns cached response on completion, prevents duplicate stock movements or journals            | **PASS** | Verified in unit tests and E2E tests                                                   |
| **Safe Void Endpoint**           | `POST /api/v1/receipts/:id/void` verifies on-hand stock $\ge$ received quantity, reverses movements, balances, journals, and updates status to `VOIDED`     | **PASS** | Verified in `receipt-posting-and-void.e2e-spec.ts`                                     |
| **Stock Depletion Defense**      | If on-hand stock is insufficient ($Q_{\text{onhand}} < Q_{\text{received}}$), void is rejected with HTTP 409 Conflict; prevents negative stock/corrupted GL | **PASS** | Verified in E2E test `should reject voiding if subsequent issues make stock insuff`    |
| **Reversing Journal Posting**    | Creates balanced reversing journal entry (Debit GRN Clearing, Credit Inventory Asset) and marks original journal status as `VOIDED`                         | **PASS** | Verified in E2E test suite                                                             |
| **Compensating Stock Movements** | Creates linked `StockMovement` with `referenceType = 'STOCK_MOVEMENT_REVERSAL'`, updates stock balance, resets value to 0 if fully depleted                 | **PASS** | Verified in E2E test suite                                                             |
| **Zero Partial Mutations**       | All failures trigger full PostgreSQL transaction rollback; receipt remains `DRAFT`, inventory and accounting untouched                                      | **PASS** | Verified across all failure test scenarios                                             |
| **Audit Trail Preservation**     | Records `RECEIPT_POSTED` and `RECEIPT_VOIDED` events in `audit_events` with detailed actor, timestamp, and changes payload                                  | **PASS** | Verified in unit and E2E test suites                                                   |

---

## 8. Phase 08: Audit Trail & Transactional Outbox (Completed)

| Requirement                 | Implementation Details                                                                                                                             | Status   | Verification Evidence                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| **Prisma Schema Update**    | Added `correlationId` to `AuditEvent`; updated `OutboxStatus` with `PROCESSING` & `DEAD_LETTER`; added lock/retry tracking fields to `OutboxEvent` | **PASS** | Migration `20261022140751_enhance_audit_and_outbox_infrastructure` applied cleanly |
| **Append-Only Audit Trail** | `AuditService` logs immutable user/system operations; updates/deletions forbidden; tenant-isolated via `companyId`                                 | **PASS** | `audit.service.spec.ts` & `audit-and-outbox.e2e-spec.ts`                           |
| **Credential Sanitization** | Automatic redaction of passwords, tokens, API keys, and authorization secrets from `oldValues`/`newValues` JSON payloads                           | **PASS** | `audit.service.spec.ts` (tested with deep nested credentials)                      |
| **Correlation ID Flow**     | `CorrelationIdMiddleware` extracts or generates `X-Correlation-ID`; propagated to audit records and outbox events                                  | **PASS** | Verified in `audit-and-outbox.e2e-spec.ts`                                         |
| **Transactional Outbox**    | `OutboxService.recordEvent` guarantees `OutboxEvent` persists within the exact same database transaction as receipt posting/voiding                | **PASS** | Verified in `receipt-posting.service.spec.ts` and E2E tests                        |
| **Pessimistic Claiming**    | Outbox processor claims batches using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` without lock contention or worker collisions                  | **PASS** | `outbox-processor.spec.ts` and E2E stress test                                     |
| **Exponential Backoff**     | Retries failed event delivery with bounded exponential backoff ($2^{\text{retry}} \times 1\text{s}$) and jitter up to `maxRetries` (5)             | **PASS** | `outbox-processor.spec.ts` (10 unit tests) & E2E tests                             |
| **Dead-Letter Handling**    | Events exceeding max retries transition to `DEAD_LETTER` status with `lastError` recorded                                                          | **PASS** | Verified in `audit-and-outbox.e2e-spec.ts`                                         |
| **Stale Lease Recovery**    | Worker automatically recovers abandoned claims (`lockedAt < NOW() - 5m`) for re-processing                                                         | **PASS** | Verified in `outbox-processor.spec.ts` & E2E tests                                 |
| **Admin Metrics & Replay**  | `GET /api/v1/outbox/metrics` exposes queue state; `POST /api/v1/outbox/:id/replay` re-queues failed/dead-letter events                             | **PASS** | Guarded by `ADMIN` role; verified in E2E tests                                     |

---

## 9. Phase 09: Backend Integration Testing, Concurrency & Reliability Hardening (Completed)

| Scenario / Verification Area         | Implementation & Hardening Details                                                                                                        | Status   | Verification Evidence                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| **Scenario A: Double Post Race**     | Two concurrent posting requests for the same receipt serialize via row-lock; exactly one succeeds (200), other rejected with HTTP 409     | **PASS** | Verified in `test/concurrency-and-reliability.e2e-spec.ts` (Scenario A) |
| **Scenario B: Concurrent Costing**   | Competing receipts for the same SKU update stock balance cleanly via row locking with correct cumulative moving average cost              | **PASS** | Verified in `test/concurrency-and-reliability.e2e-spec.ts` (Scenario B) |
| **Scenario C: Initial Balance Race** | Concurrent receipts for a newly introduced SKU execute atomic `INSERT ... ON CONFLICT DO NOTHING`, eliminating unique violation errors    | **PASS** | Verified in `test/concurrency-and-reliability.e2e-spec.ts` (Scenario C) |
| **Scenario D: Safe Void Defense**    | Attempt to void a posted receipt after inventory has been partially consumed is strictly blocked (HTTP 409 Conflict)                      | **PASS** | Verified in `test/concurrency-and-reliability.e2e-spec.ts` (Scenario D) |
| **Scenario E: Disjoint Outbox**      | Multiple concurrent outbox processors claim disjoint event batches via `SKIP LOCKED` without processing collisions or duplicate emissions | **PASS** | Verified in `test/concurrency-and-reliability.e2e-spec.ts` (Scenario E) |
| **Scenario F: Multi-Tenant IDOR**    | Cross-tenant requests to query, post, void, or audit entities of another tenant strictly return HTTP 403 / 404                            | **PASS** | Verified in `test/concurrency-and-reliability.e2e-spec.ts` (Scenario F) |
| **Complete Test Suite Pass Rate**    | 18 backend unit suites (143 tests), 1 frontend unit suite (2 tests), 8 backend E2E suites (119 tests) against live PostgreSQL             | **PASS** | **264 / 264 automated tests passing (100% green)**                      |

---

## 10. Forward Phases Roadmap (Scope Enforcement)

| Phase                         | Description                                                                                     | Status in Phase 09  | Target Phase |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------- | ------------ |
| **Frontend UI Foundation**    | Receipt management, line entry, warehouse selection, and status badges                          | **NOT IMPLEMENTED** | Phase 10     |
| **Posting UI & GL Inquiries** | Receipt posting confirmation modal, stock balance inquiry, void reason dialog, and journal view | **NOT IMPLEMENTED** | Phase 10     |
| **Financial Reporting**       | Trial balance reports, GL-to-subledger balance audits, and full lifecycle E2E suite             | **NOT IMPLEMENTED** | Phase 11     |
