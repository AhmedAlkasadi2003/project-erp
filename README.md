# Inventory Receipts with Costing and GL Posting — ERP Workspace

[![CI Quality Gate](https://github.com/organization/inventory-receipts-erp/actions/workflows/ci.yml/badge.svg)](https://github.com/organization/inventory-receipts-erp/actions)
![Node Version](https://img.shields.io/badge/node-v24.20.0-blue.svg)
![pnpm Version](https://img.shields.io/badge/pnpm-v11.25.0-orange.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-16--alpine-336791.svg)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178c6.svg)

An enterprise-grade ERP system for handling **Inventory Receipts**, calculating real-time **Inventory Valuation & Costing**, and executing immediate **General Ledger (GL) Double-Entry Journal Postings**.

---

## 1. Project Purpose & Scope

This repository provides the multi-package development workspace for the Inventory Receipts ERP solution.

> **Phase 01 Constraint**: This phase is strictly limited to establishing a robust, production-minded monorepo development environment, quality gates, database orchestration, health probes, and architectural documentation. No business pages, receipt workflows, costing algorithms, or domain models are implemented in Phase 01.

---

## 2. Technology Stack

- **Backend**: [NestJS 11](https://nestjs.com/) + [TypeScript 5.7+](https://www.typescriptlang.org/) (Strict Mode)
- **Database**: [PostgreSQL 16 Alpine](https://www.postgresql.org/)
- **ORM**: [Prisma ORM 6.4+](https://www.prisma.io/)
- **Frontend**: [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/) + [TypeScript 5.7+](https://www.typescriptlang.org/)
- **Package Manager & Monorepo**: [pnpm 11](https://pnpm.io/) Workspaces
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose
- **Quality Gates**: ESLint 9 (Flat Config), Prettier 3, Jest 29, Vitest 3, React Testing Library

---

## 3. Repository Structure

```
inventory-receipts-erp/
├── backend/                  # NestJS server application workspace
├── frontend/                 # React client application workspace
├── docs/                     # Architectural guides, audits, and planning
│   ├── INITIAL_ENVIRONMENT_AUDIT.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── PROJECT_STRUCTURE.md
├── .github/
│   └── workflows/
│       └── ci.yml            # Automated CI verification workflow
├── .editorconfig             # Universal editor layout configuration
├── .env.example              # Docker Compose environment template
├── .gitattributes            # Line-ending and binary tracking rules
├── .gitignore                # Global ignore rules
├── .prettierignore           # Prettier ignore list
├── .prettierrc               # Prettier style guide
├── docker-compose.yml        # PostgreSQL 16 container definition
├── package.json              # Monorepo root scripts & dev tools
├── pnpm-lock.yaml            # Pinned dependency lockfile
├── pnpm-workspace.yaml       # Workspace packages and build permissions
├── README.md                 # Primary project documentation
├── DESIGN.md                 # System architecture and domain boundary design
├── ASSUMPTIONS.md            # Confirmed assumptions and open questions
└── AI_USAGE.md               # AI assistance disclosure and audit log
```

---

## 4. Prerequisites

Ensure your system meets the following prerequisites:

| Requirement        | Minimum / Tested Version           | Installation Guide                                           |
| ------------------ | ---------------------------------- | ------------------------------------------------------------ |
| **Node.js**        | `>= 20.0.0` (Tested on `v24.20.0`) | [nodejs.org](https://nodejs.org/)                            |
| **pnpm**           | `>= 9.0.0` (Tested on `11.25.0`)   | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Docker Engine**  | `>= 24.0.0` (Tested on `29.8.1`)   | [docker.com](https://docs.docker.com/get-docker/)            |
| **Docker Compose** | `>= 2.20.0` (Tested on `v5.5.1`)   | Bundled with Docker Desktop / Compose plugin                 |
| **Git**            | `>= 2.30.0` (Tested on `2.53.0`)   | [git-scm.com](https://git-scm.com/)                          |

---

## 5. Installation & Setup

### 5.1 Clone & Install Dependencies

Clone the repository and install all workspace dependencies from the root:

```bash
git clone <repository-url>
cd project-erp

# Install all monorepo dependencies
pnpm install
```

### 5.2 Environment Configuration

Copy the template configuration files:

```bash
# Root Docker Compose orchestration template
cp .env.example .env

# Backend environment template
cp backend/.env.example backend/.env

# Frontend environment template
cp frontend/.env.example frontend/.env
```

---

## 6. Running the System

### 6.1 Start PostgreSQL via Docker Compose

To avoid port conflicts with local PostgreSQL instances running on default port `5432`, the container maps to host port **`5434`**:

```bash
# Start PostgreSQL container in background
pnpm docker:up

# Check container health status
docker compose ps

# View database logs
pnpm docker:logs

# Stop database container when needed
pnpm docker:down
```

### 6.2 Start Backend Service (NestJS)

In a separate terminal:

```bash
# Start backend in development watch mode
pnpm --filter @inventory-erp/backend start:dev
```

- API Base: `http://localhost:4000/api/v1`
- Health Endpoint: `http://localhost:4000/api/v1/health`

### 6.3 Start Frontend Service (React + Vite)

In a separate terminal:

```bash
# Start frontend development server
pnpm --filter @inventory-erp/frontend dev
```

- Client Application Shell: `http://localhost:5173`

---

## 7. Quality Gates & Validation Commands

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

# 5. Run all test suites (Jest unit/e2e + Vitest)
pnpm test

# 6. Run backend e2e tests
pnpm --filter @inventory-erp/backend test:e2e

# 7. Build both applications for production
pnpm build
```

---

## 8. Troubleshooting Guide

### Port `5434` or `5432` Conflict

- The default development port for PostgreSQL is `5434`. If this port is occupied, update `POSTGRES_PORT` in `.env` and `DATABASE_URL` in `backend/.env`.

### Database Health Probe Degraded

- When PostgreSQL is not running, `GET /api/v1/health` returns status `degraded` and reports `services.database.status: down`. Start the database using `pnpm docker:up`.

### pnpm Ignored Build Scripts (`allowBuilds`)

- In pnpm 11, package lifecycle scripts are restricted by default. Allowed dependencies (`@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`) are declared in `pnpm-workspace.yaml`. If you add new packages requiring native compilation, run `pnpm approve-builds`.

---

## 9. Next Phase: Phase 02

The foundation is prepared for **Phase 02 — Database Schema and Prisma Data Model**:

- Designing relational tables for Items, Inventory Receipts, Chart of Accounts, and GL Journal Entries.
- Applying PostgreSQL foreign key constraints, balancing checks, and Prisma migrations.
