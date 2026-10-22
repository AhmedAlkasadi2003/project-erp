# Assumptions & Open Architectural Questions

This document records the confirmed assumptions, resolved technical decisions, and open questions across development phases for the **Inventory Receipts with Costing and GL Posting** ERP system.

---

## 1. Confirmed Architectural Decisions (Phases 01, 02 & 03)

1. **Monorepo Architecture**:
   - The system is organized as a modular monorepo managed with `pnpm` workspaces (`backend` and `frontend`).
   - Packages maintain independent `package.json` manifests and TypeScript compilation contexts.

2. **Database Engine & Persistence (Phase 02)**:
   - PostgreSQL 16 is the standard database engine running via Docker Compose on host port **`5434`** (forwarded to container port `5432`).
   - Prisma ORM 6.19+ manages schema definitions, migration SQL generation, and type-safe query execution.
   - Initial migration `20261022084335_init_database_foundation` successfully applies 17 relational tables, 11 enums, and foreign key constraints.
   - Secondary migration `20261022090116_add_auth_credentials_and_super_admin` adds `SUPER_ADMIN` to `UserRole` and `passwordHash` to `User`.

3. **Decimal Precision & Monetary Invariants**:
   - Monetary amounts (`totalAmount`, `debit`, `credit`, `taxAmount`, `subtotal`) are typed as **`DECIMAL(19, 4)`**.
   - Unit costs (`unitCost`, `averageCost`, `standardCost`) are typed as **`DECIMAL(19, 4)`** to prevent fractional rounding drift during moving average calculations.
   - Quantities (`quantityReceived`, `quantityOnHand`, `quantity`) are typed as **`DECIMAL(18, 4)`** to support fractional units of measure (e.g. KG, Liters, Meters).
   - Floating-point arithmetic (`FLOAT`/`DOUBLE PRECISION`) is strictly forbidden.

4. **Multi-Tenancy & Referential Integrity**:
   - `companyId` is mandatory across all domain records.
   - Intra-tenant uniqueness is enforced via compound unique indexes:
     - `@@unique([companyId, code])`
     - `@@unique([companyId, sku])`
     - `@@unique([companyId, email])`
     - `@@unique([companyId, receiptNumber])`
     - `@@unique([companyId, entryNumber])`
     - `@@unique([companyId, warehouseId, itemId])`
   - Master entities (`Account`, `Item`, `Warehouse`, `Supplier`, `Company`) enforce `onDelete: Restrict` to preserve transaction history and financial audit trails.

5. **Security, Authentication & Authorization (Phase 03)**:
   - **Password Hashing**: Argon2id via `@node-rs/argon2` is the standard cryptographic hash algorithm.
   - **Tenant-Scoped Credentials**: Because user email is unique per company, login requires `{ companyCode, email, password }` to resolve tenant context unambiguously.
   - **Enumeration Protection**: Generic authentication failure response (`HTTP 401: Invalid company, email, or password`) protects against user or tenant enumeration.
   - **Token Expiry**: Default JWT access token expiration is 3600 seconds (1 hour).
   - **Active State Revalidation**: Every authenticated request verifies active flags (`user.isActive` and `company.isActive`) against live database state.
   - **Multi-Tenant Guarding**: `CompanyAccessGuard` strictly enforces that routes requesting resources under `/api/v1/companies/:companyId/...` match `req.user.companyId` unless the user carries `SUPER_ADMIN` privileges.
   - **HTTP Hardening**: Helmet middleware sets HTTP security headers; correlation IDs (`X-Correlation-ID`) are injected/propagated on all requests.

6. **Accounting & Costing Model**:
   - Double-entry balance rule is non-negotiable:
     $$\sum \text{Debit} = \sum \text{Credit}$$
   - Inventory receipts operate in a perpetual inventory model:
     - **Debit**: Inventory Asset Account (`1200`)
     - **Credit**: Inventory Received Not Invoiced Accrual (`2100`)
   - Stock movements are strictly append-only in `StockMovement`.
   - Optimistic concurrency control is enabled on `StockBalance` and `Receipt` via an integer `version` field.

---

## 2. Unresolved Questions & Technical Recommendations

| #      | Question / Requirement Item          | Impact on Phase 04       | Architectural Recommendation                                                                                                                                                    |
| ------ | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Costing Method Priority**          | Phase 04 Costing Engine  | Focus primarily on **Moving Weighted Average** as the core active calculation algorithm, with a clean interface for **Standard Cost** fallback and future FIFO layer expansion. |
| **Q2** | **Zero / Negative Stock Handling**   | Phase 04 Stock Ledger    | Inventory receipts always increment stock ($\ge 0$). In the event an item has zero current on-hand quantity, the new unit cost is set directly to the received unit cost.       |
| **Q3** | **Landed Cost Distribution**         | Phase 04 & 05            | In Phase 04, support direct unit cost per receipt line. Advanced proportional freight allocation can be added as a secondary service.                                           |
| **Q4** | **Reversal & Cancellation Workflow** | Phase 04 Posting Service | A posted receipt cannot be deleted. Cancellation must create an offsetting reversing receipt and matching reversing journal entry.                                              |

---

## 3. Decisions Deferred to Later Phases

1. **Receipts REST Controllers & DTOs**:
   - `POST /api/v1/receipts` and posting triggers are deferred to Phase 05.
2. **Frontend UI Pages**:
   - Warehouse receipt entry, postings modal, and accounting inquiry views are deferred to Phase 06.
3. **Advanced Reporting UI**:
   - Balance sheets, trial balance exports, and analytics dashboard components are deferred to Phase 06/07.
