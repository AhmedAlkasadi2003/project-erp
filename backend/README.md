# Backend Workspace — Inventory Receipts ERP

## Overview

The `backend` workspace provides the server-side API foundation for the **Inventory Receipts with Costing and GL Posting** system. It is built with **NestJS**, **TypeScript (Strict Mode)**, and **Prisma ORM** connecting to **PostgreSQL**.

> **Phase 01 Notice**: In accordance with Phase 01 scope, this workspace provides only the core infrastructure (bootstrap, environment validation, Prisma client setup, health check endpoint, and testing infrastructure). Domain modules (inventory, receipts, general ledger, authentication) and database business tables are strictly deferred to Phase 02 and later phases.

---

## Technology Stack

- **Framework**: NestJS 11
- **Language**: TypeScript 5.7+ (strict mode enabled)
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6.4+
- **Validation**: `class-validator` & `class-transformer`
- **Testing**: Jest 29 & Supertest (unit and e2e)
- **Linting & Formatting**: ESLint 9 (flat config) & Prettier

---

## Directory Layout

```
backend/
├── prisma/
│   └── schema.prisma           # Prisma configuration & PostgreSQL datasource
├── src/
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
│   └── main.ts                 # Bootstrap with CORS, validation, and /api/v1 prefix
├── test/
│   ├── app.e2e-spec.ts         # E2E health check test suite
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

| Variable       | Description                                                   | Default                                                                                       |
| -------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PORT`         | HTTP port for the backend server                              | `4000`                                                                                        |
| `NODE_ENV`     | Application environment (`development`, `test`, `production`) | `development`                                                                                 |
| `DATABASE_URL` | PostgreSQL connection string                                  | `postgresql://erp_user:erp_password_local_dev@localhost:5434/inventory_erp_dev?schema=public` |
| `CORS_ORIGIN`  | Allowed CORS origin for frontend client                       | `http://localhost:5173`                                                                       |

---

## Available Scripts

From the repository root:

```bash
# Run typechecking
pnpm --filter @inventory-erp/backend typecheck

# Run linter
pnpm --filter @inventory-erp/backend lint

# Run unit tests
pnpm --filter @inventory-erp/backend test

# Run e2e tests
pnpm --filter @inventory-erp/backend test:e2e

# Validate Prisma schema
pnpm --filter @inventory-erp/backend prisma:validate

# Build for production
pnpm --filter @inventory-erp/backend build

# Start in development watch mode
pnpm --filter @inventory-erp/backend start:dev
```

---

## Infrastructure Health Check

The service exposes a health check endpoint:

```http
GET /api/v1/health
```

Example response:

```json
{
  "status": "ok",
  "timestamp": "2026-10-22T07:35:00.000Z",
  "uptime": 12.34,
  "environment": "development",
  "version": "0.1.0",
  "services": {
    "database": {
      "status": "up"
    }
  }
}
```
