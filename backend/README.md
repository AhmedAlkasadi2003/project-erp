# Backend Workspace — Inventory Receipts ERP

## Overview

The `backend` workspace provides the server-side API foundation for the **Inventory Receipts with Costing and GL Posting** system. It is built with **NestJS 11**, **TypeScript (Strict Mode)**, and **Prisma ORM 6** connecting to **PostgreSQL 16**.

> **Phase 05 Notice**: The backend implements the core infrastructure, PostgreSQL database models, enterprise security perimeter, Argon2id authentication, JWT verification, RBAC authorization, multi-tenant isolation guarding, complete draft receipts management API, and **inventory ledger & moving average costing engine** (`CostingEngineService`, `StockBalanceService`, `InventoryLedgerService`, `InventoryController`). Receipt posting orchestration and GL posting will be implemented in Phase 06.

---

## Technology Stack

- **Framework**: NestJS 11 (Express 5 adapter)
- **Language**: TypeScript 5.7+ (strict mode enabled)
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6.19+
- **Security & Cryptography**: `@node-rs/argon2`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `helmet`
- **Validation**: `class-validator` & `class-transformer`
- **Testing**: Jest 29 & Supertest (unit and e2e against real PostgreSQL database)
- **Linting & Formatting**: ESLint 9 (flat config) & Prettier

---

## Directory Layout

```
backend/
├── prisma/
│   ├── migrations/             # Applied SQL migrations
│   │   ├── 20261022084335_init_database_foundation/
│   │   └── 20261022090116_add_auth_credentials_and_super_admin/
│   ├── schema.prisma           # Complete relational schema (17 models, 11 enums)
│   └── seed.ts                 # Idempotent development seed (companies, users, accounts, items)
├── src/
│   ├── auth/                   # Authentication & Session Module
│   │   ├── dto/                # LoginDto with class-validator
│   │   ├── interfaces/         # JwtPayload
│   │   ├── strategies/         # JwtStrategy (revalidates DB active flags)
│   │   ├── auth.controller.ts  # /api/v1/auth/login and /auth/me
│   │   ├── auth.module.ts      # JwtModule configuration
│   │   ├── auth.service.ts     # Argon2id verification and token signing
│   │   └── auth.service.spec.ts
│   ├── common/                 # Enterprise Shared Cross-Cutting Concerns
│   │   ├── decorators/         # @CurrentUser, @Roles, @Public
│   │   ├── filters/            # AllExceptionsFilter (masks internal traces in prod)
│   │   ├── guards/             # JwtAuthGuard, RolesGuard, CompanyAccessGuard
│   │   ├── interfaces/         # AuthenticatedUser interface
│   │   └── middleware/         # CorrelationIdMiddleware (X-Correlation-ID)
│   ├── companies/              # Tenant Management Module
│   │   ├── companies.controller.ts # Guarded tenant endpoints
│   │   ├── companies.module.ts
│   │   └── companies.service.ts    # Tenant-scoped queries
│   ├── inventory/              # Inventory Ledger, Balances & Costing (Phase 05)
│   │   ├── costing/            # Moving weighted-average costing engine
│   │   │   ├── costing-engine.service.ts
│   │   │   └── costing-engine.service.spec.ts
│   │   ├── dto/                # QueryStockBalancesDto, QueryStockMovementsDto
│   │   ├── exceptions/         # InsufficientStockException
│   │   ├── inventory.controller.ts # /api/v1/inventory/balances, /movements, /reconcile
│   │   ├── inventory.module.ts
│   │   ├── inventory-ledger.service.ts # Append-only ledger & compensating reversals
│   │   ├── inventory-ledger.service.spec.ts
│   │   ├── stock-balance.service.ts    # Atomic upsert, SELECT FOR UPDATE locking & audit
│   │   └── stock-balance.service.spec.ts
│   ├── receipts/               # Inventory Receipts Draft Management (Phase 04)
│   │   ├── dto/                # Create, Update, ReplaceLines, and Query DTOs
│   │   ├── utils/              # DecimalMath utility and custom decimal validators
│   │   ├── receipts.controller.ts
│   │   ├── receipts.module.ts
│   │   ├── receipts.service.ts # Transactional draft management & line reconciliation
│   │   └── receipts.service.spec.ts
│   ├── config/
│   │   └── env.validation.ts   # Strict environment schema and validator
│   ├── health/
│   │   ├── health.controller.spec.ts
│   │   ├── health.controller.ts
│   │   ├── health.module.ts
│   │   └── health.service.ts   # System uptime & PostgreSQL connectivity probe
│   ├── prisma/
│   │   ├── prisma.module.ts    # Global database module
│   │   └── prisma.service.ts   # Prisma client lifecycle management
│   ├── app.module.ts           # Root application module
│   └── main.ts                 # Bootstrap with Helmet, CORS, Validation, and Prefix
├── test/
│   ├── app.e2e-spec.ts         # Health check E2E suite
│   ├── auth-and-multi-tenancy.e2e-spec.ts # Full security & tenant boundary E2E suite
│   ├── receipts.e2e-spec.ts    # Full draft lifecycle, validation, and precision E2E suite
│   ├── inventory-ledger-and-costing.e2e-spec.ts # Ledger, concurrency lock, and costing E2E suite
│   └── jest-e2e.json           # Jest E2E test runner configuration
├── .env.example                # Example environment variables
├── .gitignore                  # Backend-specific ignore rules
├── .prettierrc                 # Code formatting configuration
├── eslint.config.mjs           # ESLint 9 configuration
├── nest-cli.json               # NestJS CLI configuration
├── package.json                # Dependencies and npm/pnpm scripts
├── tsconfig.json               # Strict TypeScript compiler options
└── tsconfig.build.json         # Production build TypeScript configuration
```

---

## Configuration

Copy `.env.example` to `.env` before running the backend:

```bash
cp .env.example .env
```

| Variable         | Description                                                   | Default                                                                                       |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PORT`           | HTTP port for the backend server                              | `4000`                                                                                        |
| `NODE_ENV`       | Application environment (`development`, `test`, `production`) | `development`                                                                                 |
| `DATABASE_URL`   | PostgreSQL connection string                                  | `postgresql://erp_user:erp_password_local_dev@localhost:5434/inventory_erp_dev?schema=public` |
| `CORS_ORIGIN`    | Allowed CORS origin for frontend client                       | `http://localhost:5173`                                                                       |
| `JWT_SECRET`     | Secret key for signing and verifying JWT tokens               | `super-secret-dev-jwt-key-replace-in-production-min-32-chars-long`                            |
| `JWT_EXPIRES_IN` | Token time-to-live string (e.g. `1h`, `3600s`)                | `3600s`                                                                                       |

---

## Available Scripts

From the repository root:

```bash
# Run strict TypeScript typecheck
pnpm --filter @inventory-erp/backend typecheck

# Run linter
pnpm --filter @inventory-erp/backend lint

# Run unit tests
pnpm --filter @inventory-erp/backend test

# Run e2e tests against real PostgreSQL database
pnpm --filter @inventory-erp/backend test:e2e

# Validate Prisma schema
pnpm --filter @inventory-erp/backend prisma:validate

# Build for production
pnpm --filter @inventory-erp/backend build

# Start in development watch mode
pnpm --filter @inventory-erp/backend start:dev
```
