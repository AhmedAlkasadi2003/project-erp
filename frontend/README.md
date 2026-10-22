# Frontend Workspace — Inventory Receipts ERP

## Overview

The `frontend` workspace provides the client-side user interface foundation for the **Inventory Receipts with Costing and GL Posting** system. It is built with **React**, **TypeScript (Strict Mode)**, and bundled with **Vite**.

> **Phase 01 Notice**: In accordance with Phase 01 scope, this workspace contains only the application shell and a technical connection-status verification component. No business pages, receipt forms, inventory screens, or accounting ledger dashboards are included. Those features belong to subsequent development phases.

---

## Technology Stack

- **Library**: React 19
- **Bundler & Dev Server**: Vite 6
- **Language**: TypeScript 5.7+ (strict mode enabled)
- **Testing**: Vitest 3 & React Testing Library
- **Linting & Formatting**: ESLint 9 (flat config) & Prettier

---

## Directory Layout

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts       # Typed fetch API client with error handling
│   │   └── health.ts       # Health endpoint client function
│   ├── test/
│   │   ├── App.test.tsx    # Technical connection view unit tests
│   │   └── setup.ts        # Testing setup (@testing-library/jest-dom)
│   ├── App.css             # Component-level styling for status shell
│   ├── App.tsx             # Application shell & connection-status view
│   ├── index.css           # Global typography and base CSS
│   ├── main.tsx            # React application bootstrap
│   └── vite-env.d.ts       # Vite client types & environment variable types
├── .env.example            # Example frontend environment variables
├── .gitignore              # Frontend-specific ignore rules
├── .prettierrc             # Code formatting rules
├── eslint.config.js        # ESLint 9 flat configuration
├── index.html              # HTML entry point
├── package.json            # Dependencies and npm/pnpm scripts
├── tsconfig.app.json       # Browser TypeScript compiler options
├── tsconfig.json           # Composite TypeScript configuration
├── tsconfig.node.json      # Node/Vite build TypeScript compiler options
└── vite.config.ts          # Vite configuration with Vitest setup
```

---

## Configuration

Copy `.env.example` to `.env` before running the development server:

```bash
cp .env.example .env
```

| Variable            | Description                       | Default                        |
| ------------------- | --------------------------------- | ------------------------------ |
| `VITE_PORT`         | Local development port            | `5173`                         |
| `VITE_API_BASE_URL` | Base URL for backend API requests | `http://localhost:4000/api/v1` |

> **Security Note**: Never expose database credentials, secret keys, or backend passwords in `frontend/.env`. Variables prefixed with `VITE_` are publicly embedded in client-side bundles.

---

## Available Scripts

From the repository root:

```bash
# Run typechecking
pnpm --filter @inventory-erp/frontend typecheck

# Run linter
pnpm --filter @inventory-erp/frontend lint

# Run unit tests
pnpm --filter @inventory-erp/frontend test

# Build for production
pnpm --filter @inventory-erp/frontend build

# Start local development server
pnpm --filter @inventory-erp/frontend dev
```
