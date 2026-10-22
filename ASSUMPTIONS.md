# Assumptions & Open Architectural Questions

This document records the confirmed assumptions, resolved technical decisions, and open questions across development phases for the **Inventory Receipts with Costing and GL Posting** ERP system.

---

## 1. Confirmed Architectural Decisions (Phases 01 & 02)

1. **Monorepo Architecture**:
   - The system is organized as a modular monorepo managed with `pnpm` workspaces (`backend` and `frontend`).
   - Packages maintain independent `package.json` manifests and TypeScript compilation contexts.

2. **Database Engine & Persistence (Phase 02)**:
   - PostgreSQL 16 is the standard database engine running via Docker Compose on host port **`5434`** (forwarded to container port `5432`).
   - Prisma ORM 6.19+ manages schema definitions, migration SQL generation, and type-safe query execution.
   - Initial migration `20261022084335_init_database_foundation` successfully applies 17 relational tables, 11 enums, and foreign key constraints.

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
     - `@@unique([companyId, receiptNumber])`
     - `@@unique([companyId, entryNumber])`
     - `@@unique([companyId, warehouseId, itemId])`
   - Master entities (`Account`, `Item`, `Warehouse`, `Supplier`, `Company`) enforce `onDelete: Restrict` to preserve transaction history and financial audit trails.

5. **Accounting & Costing Model**:
   - Double-entry balance rule is non-negotiable:
     $$\sum \text{Debit} = \sum \text{Credit}$$
   - Inventory receipts operate in a perpetual inventory model:
     - **Debit**: Inventory Asset Account (`1200`)
     - **Credit**: Inventory Received Not Invoiced Accrual (`2100`)
   - Stock movements are strictly append-only in `StockMovement`.
   - Optimistic concurrency control is enabled on `StockBalance` and `Receipt` via an integer `version` field.

---

## 2. Unresolved Questions & Technical Recommendations

| #      | Question / Requirement Item          | Impact on Phase 03       | Architectural Recommendation                                                                                                                                                    |
| ------ | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Costing Method Priority**          | Phase 03 Costing Engine  | Focus primarily on **Moving Weighted Average** as the core active calculation algorithm, with a clean interface for **Standard Cost** fallback and future FIFO layer expansion. |
| **Q2** | **Zero / Negative Stock Handling**   | Phase 03 Stock Ledger    | Inventory receipts always increment stock ($\ge 0$). In the event an item has zero current on-hand quantity, the new unit cost is set directly to the received unit cost.       |
| **Q3** | **Landed Cost Distribution**         | Phase 03 & 04            | In Phase 03, support direct unit cost per receipt line. Advanced proportional freight allocation can be added as a secondary service.                                           |
| **Q4** | **Reversal & Cancellation Workflow** | Phase 03 Posting Service | A posted receipt cannot be deleted. Cancellation must create an offsetting reversing receipt and matching reversing journal entry.                                              |

---

## 3. Decisions Deferred to Later Phases

1. **Authentication & Authorization**:
   - JWT tokens, password hashing (Argon2/Bcrypt), and RBAC route guards are deferred to Phase 04 API development.
2. **Advanced Reporting UI**:
   - Balance sheets, trial balance exports, and analytics dashboard components are deferred to Phase 05/06.
