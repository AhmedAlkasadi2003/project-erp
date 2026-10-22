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
- **Phase 05 — Core Domain Services & Costing Engine**: ⏳ **NEXT UP** (Moving average costing calculation, double-entry GL posting rules, atomic state transitions).

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

## 9. Next Phase: Phase 05

**Phase 05 — Core Domain Services, Costing & GL Posting Engine**:

- Implementing `CostingEngineService` (moving weighted-average formula & standard cost fallback).
- Implementing `PostingEngineService` (generating balanced General Ledger debit/credit entries).
- Implementing `ReceiptPostingService` (atomic PostgreSQL ACID transaction updating stock, ledger, and status from `DRAFT` to `POSTED`).
