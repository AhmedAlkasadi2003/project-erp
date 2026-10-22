# Implementation Plan — Inventory Receipts with Costing & GL Posting

This document outlines the phased development roadmap for the **Inventory Receipts with Costing and GL Posting** ERP solution.

---

## Phase Overview

```mermaid
flowchart LR
  P1[Phase 01: Workspace Setup] --> P2[Phase 02: Database & Data Model]
  P2 --> P3[Phase 03: Security & Multi-Tenancy]
  P3 --> P4[Phase 04: Receipts Drafts API]
  P4 --> P5[Phase 05: Inventory Ledger & Costing Engine]
  P5 --> P6[Phase 06: Accounting Foundation & Chart of Accounts]
  P6 --> P7[Phase 07: Posting Engine & GL Posting]
  P7 --> P8[Phase 08: Audit Trail & Transactional Outbox]
  P8 --> P9[Phase 09: Concurrency & Reliability Hardening]
  P9 --> P10[Phase 10: Frontend UI & Workflows]

  style P1 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P2 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P3 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P4 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P5 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P6 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P7 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P8 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P9 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
  style P10 fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
```

---

## Phase 01: Professional Project Workspace Setup (COMPLETED)

- **Objective**: Establish monorepo workspace, environment validation, Dockerized PostgreSQL, Prisma baseline, quality gates, and project documentation.
- **Deliverables**: Root workspace, `backend/` NestJS workspace, `frontend/` React/Vite workspace, `docker-compose.yml`, CI workflow, and technical health probe.
- **Exit Status**: 100% verified across linters, strict type checks, unit tests, E2E tests, and production builds.

---

## Phase 02: Database Foundation & Prisma Data Model (COMPLETED)

- **Objective**: Implement the relational database foundation, Prisma schema, migration workflow, and deterministic development seed.
- **Implemented Entities**:
  - `Company`: Multi-tenant organization boundary.
  - `User`: Enterprise user identity and role-based permissions (`ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`, `CLERK`).
  - `Warehouse`: Multi-site inventory locations.
  - `Supplier`: Procurement counterparties with tax ID and payment terms.
  - `Account`: Chart of Accounts (`ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`).
  - `AccountingPeriod`: Fiscal period governance (`OPEN`, `CLOSED`).
  - `Item`: Product master with valuation method and links to asset, COGS, and expense accounts.
  - `StockBalance`: Real-time on-hand quantity, total value, and average cost with optimistic concurrency versioning.
  - `Receipt` & `ReceiptLine`: Inventory receipt documents and line items with `Decimal(19, 4)` and `Decimal(18, 4)` precision.
  - `StockMovement`: Append-only inventory transaction ledger.
  - `JournalEntry` & `JournalLine`: Balanced double-entry financial accounting records.
  - Supporting Infrastructure: `AuditEvent`, `IdempotencyRecord`, `OutboxEvent`.
- **Migration & Seed**:
  - Applied migration `20261022084335_init_database_foundation`.
  - Created idempotent seed script (`backend/prisma/seed.ts` via `pnpm db:seed`).
- **Exit Status**: Fully verified in PostgreSQL 16 container on port 5434; zero business workflows leaked into this phase.

---

## Phase 03: Senior Backend Engineering, Security & Multi-Tenancy (COMPLETED)

- **Objective**: Implement authentication, authorization (RBAC), multi-tenant data isolation, security headers, correlation tracking, and centralized exception sanitization.
- **Implemented Features**:
  - **Argon2id Hashing**: Cryptographically robust password hashing via `@node-rs/argon2`.
  - **Auth Feature Module**: `POST /api/v1/auth/login` (tenant-scoped credentials, generic failure message) and `GET /api/v1/auth/me`.
  - **Token Management**: JWT access tokens signed with HMAC-SHA256 (`@nestjs/jwt@^11.0.0`), revalidating active user and company status on every request.
  - **RBAC Authorization**: `@Roles()` decorator + `RolesGuard` supporting `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, `CLERK`, and `VIEWER`.
  - **Multi-Tenant Guarding**: `CompanyAccessGuard` intercepting `:companyId` route parameters and preventing cross-tenant data access (HTTP 403).
  - **Companies Feature Module**: Tenant-scoped endpoints for current company details, warehouses, and catalog items.
  - **Operational Hardening**: Helmet HTTP security headers, CORS origin verification, global `ValidationPipe`, correlation IDs (`X-Correlation-ID`), and production-safe `AllExceptionsFilter`.
  - **Automated Test Coverage**: 4 unit test suites (22/22 passing) and 2 real PostgreSQL E2E test suites (17/17 passing).
- **Exit Status**: 100% verified against live PostgreSQL container. Zero receipt workflows or frontend pages leaked into this phase.

---

## Phase 04: Inventory Receipts Drafts & Management API (COMPLETED)

- **Objective**: Implement complete backend API for creating, reading, listing, updating, and managing draft inventory receipts and lines.
- **Implemented Features**:
  - **Draft Receipt Creation**: `POST /api/v1/receipts` creating header and 1+ lines atomically in a database transaction (`$transaction`), server-calculated totals, auto-generated or custom validated receipt number.
  - **List Receipts & Pagination**: `GET /api/v1/receipts` supporting `page`, `limit`, `status`, `warehouseId`, `supplierId`, `startDate`, `endDate`, `search`, deterministic tie-breaker sorting, and pagination metadata.
  - **Get Receipt by ID**: `GET /api/v1/receipts/:id` retrieving full document, sequential lines, item master details, and relation summaries.
  - **Update Draft Header**: `PATCH /api/v1/receipts/:id` updating warehouse, supplier, date, receipt number, notes on draft receipts only.
  - **Atomic Lines Reconciliation**: `PUT/PATCH /api/v1/receipts/:id/lines` replacing/reconciling all lines atomically, re-indexing lines sequentially, and recalculating totals.
  - **Fine-Grained Line Endpoints**: `POST /:id/lines`, `PATCH /:id/lines/:lineId`, and `DELETE /:id/lines/:lineId`.
  - **Financial Decimal Precision**: Implemented `DecimalMath` using `Prisma.Decimal` and `ROUND_HALF_UP` to 4 decimal places for quantities, unit costs, and monetary lines.
  - **Strict Validation Rules**: `@IsPositiveDecimal()` for quantities ($>0$), `@IsNonNegativeDecimal()` for unit costs ($\ge 0$), minimum 1 line requirement, no deletion of the only line.
  - **Status & Ownership Invariants**: Updates and deletions prohibited for non-draft receipts (`POSTED`, `CANCELLED`); mass-assignment of status or company ownership blocked.
  - **Multi-Tenant Security & IDOR Defense**: Strict company boundary validation across warehouse, supplier, items, and receipts (HTTP 403 on cross-tenant access).
  - **Automated Test Coverage**: 6 unit test suites (49/49 passing) and 3 real PostgreSQL E2E test suites (37/37 passing).
- **Exit Status**: 100% verified against live PostgreSQL container. Zero costing or GL posting logic leaked into this phase.

---

## Phase 05: Inventory Ledger, Stock Balances & Weighted Average Costing (COMPLETED)

- **Objective**: Implement pure domain business logic, moving weighted-average costing engine, concurrency-safe stock balance mutations, and append-only inventory ledger.
- **Implemented Features**:
  - `CostingEngineService`:
    - Pure domain service calculating inbound moving weighted-average costs with `Prisma.Decimal` and `ROUND_HALF_UP` to 4 decimal places.
    - Zero-stock / initial intake assigns incoming unit cost directly without division-by-zero.
    - Inbound receipts at `0.0000` unit cost dilute moving average cost correctly.
    - Outbound stock issues relieved strictly at current moving average cost.
    - Zero residual penny invariant: full stock depletion ($Q_{\text{out}} = Q_{\text{onhand}}$) strictly resets `totalValue` and `averageCost` to `0.0000`.
  - `StockBalanceService`:
    - PostgreSQL atomic upsert `INSERT ... ON CONFLICT ("companyId", "warehouseId", "itemId") DO NOTHING` eliminates initial-balance race condition.
    - Explicit row-level lock `SELECT ... FOR UPDATE` prevents lost updates and concurrency anomalies.
    - Read-only balance reconciliation audit comparing balance snapshot against aggregated ledger movements (`reconcileBalance`).
  - `InventoryLedgerService`:
    - Append-only transactional ledger recording all movements (`StockMovement`) with balance snapshot (`quantityAfter`, `totalValueAfter`).
    - Negative stock prevention via `InsufficientStockException` (HTTP 400 Bad Request).
    - Compensating movement reversal workflow (`reverseMovement`) with duplicate prevention.
    - Concurrency retry wrapper (`withRetry`) with bounded exponential backoff and jitter for transient serialization (`40001`), deadlock (`40P01`), and write conflict (`P2034`) errors.
    - Deterministic multi-row lock ordering by `itemId: 'asc'` to prevent circular wait deadlocks.
  - `InventoryController`:
    - `GET /api/v1/inventory/balances` with pagination, sorting, search, warehouse, and item filters.
    - `GET /api/v1/inventory/balances/:warehouseId/:itemId` single balance lookup.
    - `GET /api/v1/inventory/movements` queryable audit log with date ranges and movement types.
    - `GET /api/v1/inventory/reconcile/:warehouseId/:itemId` read-only synchronization verification.
  - **Automated Test Coverage**:
    - 3 new unit test suites: `costing-engine.service.spec.ts` (10/10), `stock-balance.service.spec.ts` (5/5), `inventory-ledger.service.spec.ts` (7/7).
    - 1 new integration E2E suite: `test/inventory-ledger-and-costing.e2e-spec.ts` (15/15 tests passing on real PostgreSQL container, including concurrent parallel race tests).
- **Exit Status**: 100% verified against live PostgreSQL container. Zero GL postings or receipt post transitions leaked into this phase.

---

## Phase 06: Accounting Foundation, Chart of Accounts & Accounting Periods (COMPLETED)

- **Objective**: Establish the accounting foundation, chart of accounts tree hierarchy, accounting period controls, inventory account configuration, and strict double-entry validation engine.
- **Implemented Features**:
  - **Prisma Schema Enhancements**:
    - `Account.parentId String?` with self-referencing tree relation (`parent` / `children` with `onDelete: Restrict`).
    - `Company.grnClearingAccountId String?` referencing `Account` (`onDelete: Restrict`).
    - Migration `20261022123745_add_account_hierarchy_and_company_clearing_account` generated and applied.
  - **Chart of Accounts Service & Controller** (`/api/v1/accounts`):
    - Multi-tenant CRUD operations for accounts with unique code per tenant (`@@unique([companyId, code])`).
    - Tree integrity validation: parent existence check, tenant boundary check, self-parenting prevention, cycle detection algorithm.
    - Safe deletion rules: blocked with HTTP 409 if referenced by child accounts, journal lines, item asset accounts, or company clearing config.
  - **Accounting Periods Service & Controller** (`/api/v1/accounting-periods`):
    - Period creation and management with strict calendar boundaries (`startDate <= endDate`).
    - Non-overlapping invariant: tenant-scoped overlap query blocks date range collisions with HTTP 409 Conflict.
    - Period lifecycle: open/close state transitions.
    - Reusable validation helpers: `getEligibleOpenPeriod(companyId, date, tx)` and `isDateInOpenPeriod`.
  - **Inventory Accounts Service & Controller** (`/api/v1/accounting/inventory-accounts`):
    - Company-level configuration for Goods Receipt Note (GRN) Clearing Account (`LIABILITY` classification, active, same tenant).
    - Reusable resolver `resolveReceiptAccounts(companyId, itemIds, tx)` resolving GRN clearing and item asset accounts (`ASSET` classification) in preparation for receipt posting.
  - **Pure Double-Entry Validation Engine** (`JournalValidatorService`):
    - Enforces minimum 2 lines per journal entry.
    - Exact mathematical balancing: $\sum \text{Debit} = \sum \text{Credit}$ calculated at 4 decimal places (`ROUND_HALF_UP`).
    - Enforces single-leg lines: each line must have either `debit > 0, credit = 0` OR `credit > 0, debit = 0`.
    - Zero-value lines (`debit = 0, credit = 0`) and negative values rejected with HTTP 400.
    - Active account check and open period check.
  - **Journal Entries Service & Controller** (`/api/v1/journal-entries`):
    - Draft creation endpoint (`POST /api/v1/journal-entries`) persisting validated draft entries with sequential line numbering.
    - Validate-only endpoint (`POST /api/v1/journal-entries/validate`) testing journal lines without database mutation.
    - Retrieval and query endpoints with tenant isolation and date/period filters.
  - **Automated Test Coverage**:
    - 5 unit test suites (40 tests passing): `accounts.service.spec.ts` (10/10), `accounting-periods.service.spec.ts` (6/6), `inventory-accounts.service.spec.ts` (7/7), `journal-validator.service.spec.ts` (14/14), `journal-entries.service.spec.ts` (3/3).
    - 1 new integration E2E suite: `test/accounting-foundation.e2e-spec.ts` (33/33 tests passing on live PostgreSQL container).
    - Total codebase test count: **202 automated tests passing with 100% green**.
- **Exit Status**: Fully verified in live PostgreSQL container; zero receipt posting orchestration or frontend UI leaked into this phase.

---

## Phase 07: Atomic Receipt Posting, Inventory Integration & Safe Void Workflow (COMPLETED)

- **Objective**: Implement atomic receipt posting orchestration (`DRAFT` $\to$ `POSTED`), automated double-entry GL journal generation, stock balance and costing updates, and safe void reversal workflows.
- **Implemented Features**:
  - **Prisma Schema Enhancements**:
    - Added `VOIDED` to `ReceiptStatus` enum.
    - Added `postedById`, `voidedById`, `voidedAt`, and `voidReason` to `Receipt`.
    - Added relations `postedByUser` and `voidedByUser` on `Receipt`.
    - Added indexes on `receiptId` and `receiptLineId` on `StockMovement`.
    - Applied migration `20261022131957_add_receipt_posting_void_and_indexes`.
  - **Atomic Posting Service & Controller** (`POST /api/v1/receipts/:id/post`):
    - Atomic PostgreSQL transaction boundary coordinating receipt state, inventory movements, stock balance mutations, moving average updates, double-entry GL journal creation, and audit trail.
    - Exclusive row lock `SELECT ... FOR UPDATE` on receipt row prevents double posting and races.
    - Deterministic lock order on stock balances (`itemId: 'asc'`) eliminates circular wait deadlocks across concurrent multi-SKU receipts.
    - Bounded exponential backoff with jitter retry wrapper for transient PostgreSQL serialization/deadlock conflicts.
    - Double-entry General Ledger balancing: Debit SKU Inventory Asset (`Item.assetAccountId`), Credit GRN Clearing (`Company.grnClearingAccountId`), enforcing $\sum \text{Debit} = \sum \text{Credit}$.
    - Idempotency support via `Idempotency-Key` header with server-managed `IdempotencyRecord`.
  - **Safe Void Workflow** (`POST /api/v1/receipts/:id/void`):
    - Enforces critical stock consumption defense: checks on-hand stock $\ge$ received quantity. If stock has been issued ($Q_{\text{onhand}} < Q_{\text{received}}$), voiding is rejected with HTTP 409 Conflict.
    - Enforces open accounting period for the void date.
    - Creates compensating reversing movements (`referenceType = 'STOCK_MOVEMENT_REVERSAL'`) and deducts stock at moving average cost.
    - Creates balanced reversing General Ledger journal entry (Debit GRN Clearing, Credit Inventory Asset).
    - Transitions original journal entry status to `VOIDED`.
    - Transitions receipt status to `VOIDED` with `voidedAt`, `voidedById`, and `voidReason`.
  - **Automated Test Coverage**:
    - 1 new unit test suite: `receipt-posting.service.spec.ts` (10/10 tests passing).
    - 1 new integration E2E suite: `test/receipt-posting-and-void.e2e-spec.ts` (14/14 tests passing on live PostgreSQL container, including concurrency races and stock depletion defense).
    - Total codebase test count: **226 automated tests passing with 100% green**.
- **Exit Status**: 100% verified against live PostgreSQL container. Zero frontend UI leaked into this phase.

---

## Phase 08: Audit Trail & Transactional Outbox (COMPLETED)

- **Objective**: Implement tamper-evident, append-only tenant audit logging, correlation ID propagation, and a reliable Transactional Outbox pattern with asynchronous delivery and worker resilience.
- **Implemented Features**:
  - **Prisma Schema Enhancements**:
    - Added `correlationId String?` and index `@@index([companyId, createdAt])` to `AuditEvent`.
    - Added `PROCESSING` and `DEAD_LETTER` statuses to `OutboxStatus` enum.
    - Added `eventVersion Int @default(1)`, `nextRetryAt DateTime?`, `lockedAt DateTime?`, `lockedBy String?`, `lastError String?`, and `updatedAt DateTime` to `OutboxEvent`.
    - Added indexes `@@index([status, nextRetryAt, createdAt])` and `@@index([lockedAt])` to `OutboxEvent`.
    - Applied migration `20261022140751_enhance_audit_and_outbox_infrastructure`.
  - **Audit Trail Module** (`src/audit/`):
    - `AuditService`: Append-only recording with support for transaction clients (`tx`).
    - Recursive credential sanitization: automatically scrubs passwords, tokens, API keys, and authorization secrets.
    - Read-only querying endpoints (`GET /api/v1/audit-events`, `GET /api/v1/audit-events/:id`) protected by RBAC (`ADMIN`, `ACCOUNTANT`, `WAREHOUSE_MANAGER`).
  - **Transactional Outbox Engine** (`src/outbox/`):
    - Atomic persistence: `OutboxService.recordEvent` guarantees that `OutboxEvent` records are written in the exact same ACID database transaction as receipt posting and voiding.
    - `OutboxProcessor`: Asynchronous background processor using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` to claim event batches without worker collisions.
    - Automatic stale lease recovery: Recovers events locked by crashed workers after lease timeout (5 minutes).
    - Bounded exponential backoff with random jitter up to maximum retries (default 5).
    - Permanent failure handling: Events exceeding maximum retries transition to `DEAD_LETTER` status.
    - Domain event handlers: Idempotent handlers for `RECEIPT_POSTED` and `RECEIPT_VOIDED`.
    - Administrative metrics & replay endpoints: `GET /api/v1/outbox/metrics` and `POST /api/v1/outbox/:id/replay`.
  - **Automated Test Coverage**:
    - 3 new unit test suites: `audit.service.spec.ts` (7 tests), `outbox.service.spec.ts` (4 tests), `outbox-processor.spec.ts` (10 tests).
    - 1 new E2E suite: `test/audit-and-outbox.e2e-spec.ts` (13 tests passing on live PostgreSQL container).
- **Exit Status**: 100% verified against live PostgreSQL container. Zero dual-write vulnerabilities.

---

## Phase 09: Backend Integration Testing, Concurrency & Reliability Hardening (COMPLETED)

- **Objective**: Conduct comprehensive stress testing and concurrency validation against live PostgreSQL database to guarantee strict data integrity, financial correctness, and zero race conditions under load.
- **Verification Suites & Scenarios**:
  - **Scenario A (Double Posting Pessimistic Locking)**: Two concurrent requests attempting to post the same draft receipt serialize cleanly via `SELECT ... FOR UPDATE`. Exactly one succeeds (HTTP 200), and the competing request receives HTTP 409 Conflict with zero duplicate stock movements or GL entries.
  - **Scenario B (Concurrent Moving Average Costing)**: Competing receipts for the same SKU update stock balances and moving average costs simultaneously with correct cumulative quantities and valuations.
  - **Scenario C (Initial Stock Balance Creation Race)**: Concurrent receipt postings for newly introduced SKUs execute atomic `INSERT ... ON CONFLICT DO NOTHING`, eliminating unique constraint violations.
  - **Scenario D (Safe Void Defense Under Stock Consumption)**: Attempting to void a posted receipt after inventory has been consumed is strictly blocked with HTTP 409 Conflict, preserving positive on-hand inventory balances.
  - **Scenario E (Disjoint Outbox Worker Batches)**: Multiple concurrent outbox processors claim disjoint batches via `SKIP LOCKED` without duplicate emissions or deadlocks.
  - **Scenario F (Multi-Tenant Security Boundaries)**: Cross-tenant attempts to query, mutate, void, or audit entities belonging to other tenants are strictly rejected (HTTP 403 / HTTP 404).
- **Test Metrics & Quality Gates**:
  - Total automated tests passing: **264 / 264 (100% green)**.
    - Backend Unit Tests: 18 suites, 143 tests passing.
    - Frontend Unit Tests: 1 suite, 2 tests passing.
    - Backend E2E Tests: 8 suites, 119 tests passing.
  - Code Quality: 0 TypeScript errors, 0 ESLint warnings, 100% Prettier formatting.
- **Exit Status**: Production-grade verification complete. Concurrency invariants fully proven.

---

## Phase 10: Frontend User Interface & Enterprise Workflows (NEXT PHASE)

- **Objective**: Deliver a clean, professional React UI for warehouse clerks and accountants.
- **Key Modules**:
  - Receipt Entry Form: Dynamic line-item grid, auto-calculating totals, vendor selection.
  - Posting Confirmation Modal: Summary preview showing expected debits and credits before committing.
  - Void Reason Modal: Reversal confirmation dialog with audit reason capture.
  - Audit Trail View: Drill-down from receipt to corresponding general ledger journal entry.
  - Inventory Overview: Real-time stock valuation and unit cost display.
