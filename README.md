# Inventory Receipts with Costing and GL Posting — ERP Workspace

[![CI Quality Gate](https://github.com/organization/inventory-receipts-erp/actions/workflows/ci.yml/badge.svg)](https://github.com/organization/inventory-receipts-erp/actions)
![Node Version](https://img.shields.io/badge/node-v24.20.0-blue.svg)
![pnpm Version](https://img.shields.io/badge/pnpm-v11.25.0-orange.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-16--alpine-336791.svg)
![Prisma](https://img.shields.io/badge/prisma-6.19.3-2d3748.svg)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6.svg)

An enterprise-grade ERP system for handling **Inventory Receipts**, calculating real-time **Inventory Valuation & Costing**, and executing immediate **General Ledger (GL) Double-Entry Journal Postings**.

---

## 1. Project Purpose & Current Phase Status

- **Phase 01 — Project Workspace Setup**: ✅ **COMPLETED** (Monorepo architecture, Docker Compose, NestJS 11, React 19, strict quality gates).
- **Phase 02 — Database Foundation & Prisma**: ✅ **COMPLETED** (PostgreSQL 16 relational data model, Prisma ORM 6, migrations, deterministic seed, strict Decimal precision).
- **Phase 03 — Senior Backend Engineering, Security & Multi-Tenancy**: ✅ **COMPLETED** (Argon2id password hashing, JWT authentication, RBAC authorization, multi-tenant boundary guards, Helmet, correlation IDs, 100% passing unit & E2E tests).
- **Phase 04 — Inventory Receipts Drafts & Management API**: ✅ **COMPLETED** (Complete backend API for creating, listing, retrieving, updating headers, reconciling lines, and deleting draft receipts, with server-side Decimal precision, status guards, and multi-tenant isolation).
- **Phase 05 — Inventory Ledger, Stock Balances & Weighted Average Costing**: ✅ **COMPLETED** (Moving weighted-average costing engine, PostgreSQL row-level concurrency locking, initial-balance race prevention, zero residual penny depletion, append-only stock movements, compensating reversals, balance queries and reconciliation API).
- **Phase 06 — Accounting Foundation, Chart of Accounts & Accounting Periods**: ✅ **COMPLETED** (Chart of Accounts with tree hierarchy, cycle detection, accounting periods with boundary/overlap validation, company GRN clearing configuration, double-entry validation engine, draft journal entry management, 202/202 passing automated tests).
- **Phase 07 — Atomic Receipt Posting, Inventory Integration & Safe Void Workflow**: ✅ **COMPLETED** (Atomic PostgreSQL transaction boundary, row-level locks, stock balance mutations, moving weighted-average cost updates, double-entry GL journal generation, idempotency key support, safe void reversal workflow with stock depletion defense, 226/226 passing automated tests).
- **Phase 08 — Frontend User Interface & Enterprise Workflows**: ⏳ **NEXT UP** (React 19 UI, receipt entry forms, posting confirmation modal, void reason dialog, real-time stock and journal drill-downs).

---

## 2. Technology Stack

- **Backend**: [NestJS 11](https://nestjs.com/) + [TypeScript 5.7+](https://www.typescriptlang.org/) (Strict Mode)
- **Database**: [PostgreSQL 16 Alpine](https://www.postgresql.org/)
- **ORM**: [Prisma ORM 6.19+](https://www.prisma.io/)
- **Security & Auth**: `@node-rs/argon2`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `helmet`
- **Frontend**: [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/) + [TypeScript 5.7+](https://www.typescriptlang.org/)
- **Package Manager & Monorepo**: [pnpm 11](https://pnpm.io/) Workspaces
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose
- **Quality Gates**: ESLint 9 (Flat Config), Prettier 3, Jest 29, Vitest 3, React Testing Library

---

## 3. Database Architecture & Data Model

The database foundation is fully implemented in PostgreSQL via Prisma migrations:

- `20261022084335_init_database_foundation`: Core business entities, relational constraints, enums, and indexes.
- `20261022090116_add_auth_credentials_and_super_admin`: Added `SUPER_ADMIN` to `UserRole` and `passwordHash` to `User`.

### 3.1 Core Entity Map

- **Tenant Root**: `Company` (currency, fiscal year boundary, multi-tenant isolation).
- **Organization & Masters**: `User`, `Warehouse`, `Supplier`, `Item` (with links to asset, COGS, and expense accounts).
- **Inventory Documents**: `Receipt`, `ReceiptLine` (procurement intake and lines).
- **Inventory Ledger**: `StockBalance` (real-time on-hand quantity, total value, average cost, version) and `StockMovement` (append-only audit ledger).
- **General Ledger**: `Account` (Chart of Accounts), `AccountingPeriod` (fiscal window controls), `JournalEntry`, `JournalLine` (double-entry balancing).
- **Enterprise Infrastructure**: `AuditEvent`, `IdempotencyRecord`, `OutboxEvent`.

### 3.2 Precision Standards

- **Monetary & Financial Values**: `DECIMAL(19, 4)` (15 integer digits, 4 fractional digits).
- **Unit Costs**: `DECIMAL(19, 4)` (prevents intermediate rounding drift in moving average calculations).
- **Quantities**: `DECIMAL(18, 4)` (supports fractional units of measure: KG, Liters, Meters).

---

## 4. Seeded Test Accounts

The deterministic seed (`pnpm db:seed`) provides test credentials hashed with **Argon2id**:

| Company Code | Company Name                | Email                       | Password           | Role          |
| :----------- | :-------------------------- | :-------------------------- | :----------------- | :------------ |
| `COMP-01`    | Acme Industrial Systems Ltd | `admin@acme-erp.local`      | `Admin123!@#`      | `ADMIN`       |
| `COMP-01`    | Acme Industrial Systems Ltd | `clerk@acme-erp.local`      | `Clerk123!@#`      | `CLERK`       |
| `COMP-01`    | Acme Industrial Systems Ltd | `accountant@acme-erp.local` | `Accountant123!@#` | `ACCOUNTANT`  |
| `COMP-01`    | Acme Industrial Systems Ltd | `superadmin@acme-erp.local` | `SuperAdmin123!@#` | `SUPER_ADMIN` |
| `COMP-02`    | Beta Manufacturing Corp     | `admin@beta-corp.local`     | `BetaAdmin123!@#`  | `ADMIN`       |

---

## 5. API Endpoints Overview

All endpoints are served under the `/api/v1` global prefix.

### 5.1 Authentication & Profile

- `POST /api/v1/auth/login`: Authenticate with `{ companyCode, email, password }`. Returns `{ accessToken, tokenType, expiresIn, user }`.
- `GET /api/v1/auth/me`: Retrieve current user profile, role, and company details (requires Bearer token).

### 5.2 Tenant-Scoped Company Endpoints

- `GET /api/v1/companies/current`: Returns the authenticated user's company profile.
- `GET /api/v1/companies/:companyId`: Guarded company details.
- `GET /api/v1/companies/:companyId/warehouses`: Tenant's active warehouse list.
- `GET /api/v1/companies/:companyId/items`: Tenant's catalog item list with account mappings.

### 5.3 Inventory Receipts Management (Phase 04)

- `POST /api/v1/receipts`: Create draft receipt with 1+ lines. Server computes line and receipt totals.
- `GET /api/v1/receipts`: List receipts with pagination (`page`, `limit`), filtering (`status`, `warehouseId`, `supplierId`, `startDate`, `endDate`, `search`), and sorting (`sortBy`, `sortOrder`).
- `GET /api/v1/receipts/:id`: Retrieve complete receipt document with sequential lines and relations.
- `PATCH /api/v1/receipts/:id`: Update draft header fields (`warehouseId`, `supplierId`, `receiptDate`, `receiptNumber`, `notes`).
- `PUT /api/v1/receipts/:id/lines` or `PATCH /api/v1/receipts/:id/lines`: Atomically reconcile/replace draft lines.
- `POST /api/v1/receipts/:id/lines`: Add a single line item to a draft receipt.
- `PATCH /api/v1/receipts/:id/lines/:lineId`: Update a specific line item in a draft receipt.
- `DELETE /api/v1/receipts/:id/lines/:lineId`: Remove a specific line item (guarantees at least 1 line remains).
- `DELETE /api/v1/receipts/:id`: Delete a draft receipt (cascading its draft lines). Deletion of `POSTED` or `CANCELLED` receipts is blocked.
- `POST /api/v1/receipts/:id/post`: Atomically post a draft receipt to inventory and General Ledger with row-level locks, moving average updates, balanced double-entry journal generation, and optional `Idempotency-Key` header.
- `POST /api/v1/receipts/:id/void`: Safely void a posted receipt, verifying on-hand inventory has not been consumed, creating compensating reversing stock movements, posting reversing journal entry, and updating status to `VOIDED`.
- `POST /api/v1/receipts/:id/cancel`: REST alias for voiding a posted receipt.

#### Sample Create Draft Receipt Request:

```bash
curl -X POST http://localhost:4000/api/v1/receipts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouseId": "<WAREHOUSE_UUID>",
    "supplierId": "<SUPPLIER_UUID>",
    "receiptNumber": "REC-2026-001",
    "notes": "Steel shipment bay 4",
    "lines": [
      {
        "itemId": "<ITEM_UUID_1>",
        "quantityReceived": "12.5000",
        "unitCost": "15.0000",
        "taxAmount": "0.0000",
        "notes": "Sheet steel"
      },
      {
        "itemId": "<ITEM_UUID_2>",
        "quantityReceived": "100.0000",
        "unitCost": "2.2500",
        "taxAmount": "0.0000"
      }
    ]
  }'
```

### 5.4 Inventory Ledger & Balances (Phase 05)

- `GET /api/v1/inventory/balances`: List tenant stock balances with pagination (`page`, `limit`), sorting (`sortBy`, `sortOrder`), search (`search`), warehouse (`warehouseId`), and item (`itemId`) filters.
- `GET /api/v1/inventory/balances/:warehouseId/:itemId`: Retrieve real-time stock balance snapshot (`quantityOnHand`, `totalValue`, `averageCost`, `version`).
- `GET /api/v1/inventory/movements`: Query append-only stock movement ledger with pagination, type filter (`movementType`), warehouse filter, item filter, and date ranges.
- `GET /api/v1/inventory/reconcile/:warehouseId/:itemId`: Real-time read-only audit comparing live materialized balance snapshot against total aggregated ledger movements. Returns `{ inSync: true/false, deltaQuantity, deltaTotalValue }`.

### 5.5 Accounting & General Ledger (Phase 06)

- `GET /api/v1/accounts`: List accounts with parent-child hierarchy, classification filter, and active status filter.
- `POST /api/v1/accounts`: Create an account with unique code per tenant, parent hierarchy, classification, and normal balance.
- `GET /api/v1/accounts/:id`: Get account details including child sub-accounts.
- `PATCH /api/v1/accounts/:id`: Update account name, parent, or status with cycle detection.
- `DELETE /api/v1/accounts/:id`: Safe account deletion (blocked if referenced by child accounts, journal lines, items, or company clearing config).
- `GET /api/v1/accounting-periods`: List accounting periods with date filtering and status filters.
- `POST /api/v1/accounting-periods`: Create an accounting period with date boundary validation and overlap prevention.
- `PATCH /api/v1/accounting-periods/:id`: Update period name or date range.
- `POST /api/v1/accounting-periods/:id/close`: Close an accounting period.
- `POST /api/v1/accounting-periods/:id/reopen`: Reopen an accounting period.
- `GET /api/v1/accounting/inventory-accounts/config`: Retrieve company GRN clearing account configuration.
- `PATCH /api/v1/accounting/inventory-accounts/config`: Set company GRN clearing account (validates `LIABILITY` classification, active state, and tenant ownership).
- `GET /api/v1/journal-entries`: List journal entries with period, status, and date filters.
- `POST /api/v1/journal-entries`: Create a validated draft journal entry (validates accounts, active status, open period, line count $\ge 2$, single legs, and exact $\sum \text{Debit} = \sum \text{Credit}$).
- `POST /api/v1/journal-entries/validate`: Pure validation endpoint testing double-entry balancing and business rules without persisting.
- `GET /api/v1/journal-entries/:id`: Retrieve journal entry document with sequential lines.

---

## 6. Installation & Setup

```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Configure environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start PostgreSQL container in background (port 5434)
pnpm docker:up

# 4. Apply Prisma database migrations
pnpm db:migrate

# 5. Seed development master data (idempotent)
pnpm db:seed
```

---

## 7. Running the System

```bash
# Start Backend API in development watch mode (port 4000)
pnpm dev:backend

# Start Frontend Client in development server (port 5173)
pnpm dev:frontend
```

- **Frontend Client Shell**: `http://localhost:5173`
- **Backend Health Check**: `http://localhost:4000/api/v1/health`
- **PostgreSQL Connection String**: `postgresql://erp_user:erp_password_local_dev@localhost:5434/inventory_erp_dev?schema=public`

---

## 8. Quality Gates & Validation Commands

Execute all validation checks across the entire monorepo from the root:

```bash
# 1. Check code formatting with Prettier
pnpm format:check

# 2. Run ESLint across backend and frontend
pnpm lint

# 3. Run strict TypeScript typecheck
pnpm typecheck

# 4. Validate Prisma database schema
pnpm --filter @inventory-erp/backend prisma:validate

# 5. Run all unit test suites (Jest backend + Vitest frontend)
pnpm test

# 6. Run backend e2e tests against real PostgreSQL container
pnpm --filter @inventory-erp/backend test:e2e

# 7. Build both applications for production
pnpm build
```

---

## 9. Next Phase: Phase 08

**Phase 08 — Frontend User Interface & Enterprise Workflows**:

- Implementing the React 19 + Vite web client interface.
- Warehouse receipt entry UI with dynamic line editing and auto-calculated totals.
- Posting confirmation dialog showing live preview of debits, credits, and account codes.
- Safe void workflow dialog capturing the business reason for audit records.
- Real-time stock balance inquiry and General Ledger journal entry drill-down views.
