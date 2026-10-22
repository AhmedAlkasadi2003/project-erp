# Initial Environment Audit & Host Baseline

**Date**: 2026-10-22  
**Auditor**: Senior Software Engineer & Software Architect  
**Project**: Inventory Receipts with Costing and GL Posting

---

## 1. Host Telemetry & Detected Tools

An initial inspection of the development host environment was conducted prior to making any configuration modifications:

| Component           | Detected Version               | Target Requirement              | Status / Decision                                                            |
| ------------------- | ------------------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| **OS**              | Linux (x86_64)                 | Linux / POSIX                   | Compatible                                                                   |
| **Node.js**         | `v24.20.0`                     | `>= 20.0.0` (LTS or current)    | Fully compatible; strict ES2022+ support                                     |
| **Package Manager** | `pnpm 11.25.0` (npm `11.19.0`) | Modern monorepo package manager | Selected `pnpm` workspaces for native monorepo isolation and symlink caching |
| **Git**             | `2.53.0`                       | `>= 2.30.0`                     | Compatible                                                                   |
| **Docker Engine**   | `29.8.1, build 4a63305`        | Docker Engine 24+               | Daemon active and accessible                                                 |
| **Docker Compose**  | `v5.5.1`                       | Compose V2+                     | Fully compatible with Compose Specification                                  |

---

## 2. Pre-existing Repository Artifacts

Before commencing work, the working directory (`/home/ahmed-al-kasadi/Ahmed 2026/project-erp`) was audited:

- **Git Status**: Initialized repository on `main` branch with no prior commits.
- **Pre-existing files detected**:
  - `.editorconfig`: Verified standard spacing (2 spaces, UTF-8, LF). Preserved.
  - `.gitattributes`: Verified LF normalization and binary rules. Preserved.
  - `.gitignore`: Audited ignore rules for node_modules, build outputs, and `.env` variations. Enhanced and preserved.
  - `.github/workflows/ci.yml`: Detected standard CI quality gate referencing `pnpm` and port `5434`. Preserved and aligned.
  - `.env.example`: Root orchestration template specifying `POSTGRES_PORT=5434`. Preserved.

---

## 3. Network & Port Allocation Inspection

Network port analysis was performed on the host machine:

- **Port 5432**: Detected active listener on `127.0.0.1:5432` (host PostgreSQL service).
- **Architectural Decision**: To avoid port conflicts with host database services, the development PostgreSQL container is mapped to host port **`5434`** (forwarded internally to standard PostgreSQL container port `5432`).
- **Port 4000**: Verified free for Backend NestJS API.
- **Port 5173**: Verified free for Frontend Vite development server.

---

## 4. Architectural Compatibility & Package Decisions

1. **Monorepo Strategy**: `pnpm` workspaces configured via `pnpm-workspace.yaml`. Both applications (`backend` and `frontend`) maintain independent package manifests and dependency trees while supporting unified verification commands from the root.
2. **Backend Framework**: NestJS 11 with Express 5 platform, TypeScript 5.7+ with strict checking, and Prisma ORM 6.4+.
3. **Frontend Framework**: React 19 bundled with Vite 6 and tested with Vitest 3.
4. **Prisma Version**: Pinned to Prisma `^6.4.1` for PostgreSQL compatibility.
5. **Quality Gates**: ESLint 9 (flat config) and Prettier 3 configured uniformly across backend, frontend, and root.
