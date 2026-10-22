# Project Structure & Architecture Guide

## Monorepo Architecture

This repository adopts a modular monorepo pattern managed by **pnpm workspaces**. It hosts two independent applications within a single source control tree while maintaining strict physical and dependency separation.

```
inventory-receipts-erp/
├── backend/                  # NestJS server-side application workspace
├── frontend/                 # React + Vite client-side application workspace
├── docs/                     # Architectural, audit, and planning documentation
├── .github/
│   └── workflows/
│       └── ci.yml            # CI Quality Gate pipeline
├── .editorconfig             # Universal cross-editor formatting rules
├── .env.example              # Centralized environment variable template
├── .gitattributes            # Git text normalization and LF enforcement
├── .gitignore                # Global ignore rules for build artifacts and secrets
├── .prettierignore           # Prettier ignore definitions
├── .prettierrc               # Prettier code formatting standards
├── docker-compose.yml        # Development PostgreSQL container orchestration
├── package.json              # Monorepo root manifest and workflow scripts
├── pnpm-workspace.yaml       # pnpm workspace definition linking backend & frontend
├── README.md                 # Project entry point and quickstart instructions
├── DESIGN.md                 # System architecture and architectural boundaries
├── ASSUMPTIONS.md            # Confirmed assumptions, open questions, and deferred items
└── AI_USAGE.md               # Transparency log of AI assistance
```

---

## Workspace Responsibilities

### 1. Root Directory (`/`)

- **Shared Infrastructure**: Manages Docker Compose for local PostgreSQL containerization.
- **Unified Quality Gates**: Provides root-level commands (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`) that orchestrate verification across all packages.
- **Repository Standards**: Enforces code style, editor configurations, and git behaviors uniformly.
- **Security Boundary**: Enforces strict `.gitignore` rules to prevent any `.env` or credential leakage.

### 2. Backend Workspace (`/backend`)

- **Responsibility**: Server-side API, database access layer, domain business rules, transaction orchestration, and integration endpoints.
- **Technology**: NestJS 11, TypeScript (strict mode), Prisma ORM 6, PostgreSQL 16, Jest.
- **Internal Structure**:
  - `src/config/`: Environment loading, strict schema typing, and startup validation.
  - `src/prisma/`: Database client lifecycle and connection management.
  - `src/health/`: System heartbeat and database probe endpoint (`GET /api/v1/health`).
  - `prisma/`: Prisma schema, migrations, and database generators.
  - `test/`: End-to-end integration test suites.
- **Isolation**: Has its own `package.json`, `tsconfig.json`, `eslint.config.mjs`, and `.env.example`. It does not share dependencies with the frontend.

### 3. Frontend Workspace (`/frontend`)

- **Responsibility**: Client-side single-page application (SPA), user interaction, and data presentation.
- **Technology**: React 19, TypeScript (strict mode), Vite 6, Vitest 3, React Testing Library.
- **Internal Structure**:
  - `src/api/`: Typed HTTP client abstraction and backend service bindings.
  - `src/test/`: Vitest and Testing Library test specs and setup files.
  - `src/App.tsx`: Technical application shell and real-time backend/database connection probe.
- **Isolation**: Has its own `package.json`, `tsconfig.json`, `eslint.config.js`, and `.env.example`. No server secrets or database access credentials are ever placed in this workspace.

### 4. Documentation Directory (`/docs`)

- **`INITIAL_ENVIRONMENT_AUDIT.md`**: Telemetry and baseline audit of the development host environment, detected tool versions, port availability, and initial design choices.
- **`IMPLEMENTATION_PLAN.md`**: Forward-looking roadmap defining subsequent development phases (Phase 02 through Phase 06) and architectural milestones.
- **`PROJECT_STRUCTURE.md`**: This guide detailing folder responsibilities and structural invariants.
