# Assumptions & Open Architectural Questions

This document records the baseline assumptions, open questions, and deferred decisions established during **Phase 01 — Project Workspace Setup** for the **Inventory Receipts with Costing and GL Posting** ERP system.

---

## 1. Confirmed Architectural Assumptions

1. **Monorepo Architecture**:
   - The system is organized as a modular monorepo managed with `pnpm` workspaces.
   - The backend (NestJS) and frontend (React + Vite) are physically independent packages with isolated dependencies, build artifacts, and configuration files.

2. **Database Engine & Persistence**:
   - PostgreSQL 16 is the standard enterprise relational database engine.
   - Prisma ORM 6 manages schema definitions, migrations, and type-safe database queries.
   - Development container port is configured to host port **`5434`** (forwarding to container port `5432`) to prevent port collision with host-installed database engines.

3. **Accounting & Costing Model**:
   - Double-entry bookkeeping rule is absolute: every posted inventory receipt generates a balanced journal entry where total debits equal total credits ($\sum \text{Debits} = \sum \text{Credits}$).
   - Inventory receipts operate in a perpetual inventory accounting model:
     - **Debit**: Inventory Asset Account (increases asset balance).
     - **Credit**: Accounts Payable / Received Not Invoiced Accrual Account.
   - System assumes a single base reporting currency. Multi-currency and FX exchange adjustments are out of scope for early phases.

4. **Phase 01 Boundary Constraint**:
   - Phase 01 is strictly restricted to workspace setup, dependency management, developer tooling, health verification, and architectural documentation.
   - No business entities, receipt pages, inventory models, GL posting logic, or domain endpoints are implemented in Phase 01.

---

## 2. Unresolved Questions & Stakeholder Inputs

| #      | Question / Requirement Item          | Impact on Next Phases                                                                    | Preliminary Recommendation                                                                                                          |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Costing Valuation Method**         | Impacts Phase 02 schema & Phase 03 calculation engine.                                   | Implement Moving Weighted Average as the primary valuation policy, while leaving item-level flexibility for Standard Cost and FIFO. |
| **Q2** | **Landed Cost & Additional Charges** | Determines whether freight, customs, and handling fees are added to item inventory cost. | Support optional landed cost line items distributed proportionately by receipt line value or quantity.                              |
| **Q3** | **Warehouse & Bin Granularity**      | Determines whether receipts specify multi-warehouse locations or single default site.    | Include a `warehouseId` on receipt lines, defaulting to a primary warehouse.                                                        |
| **Q4** | **Purchase Order (PO) Association**  | Affects receipt entry workflow and line matching.                                        | Allow standalone receipts while providing an optional `purchaseOrderRef` attribute.                                                 |

---

## 3. Decisions Deferred to Later Phases

1. **Authentication & Authorization**:
   - User identity, JWT issuance, password hashing, and role-based access control (RBAC) are deferred to dedicated security milestones.
2. **Third-Party Integration**:
   - External ERP sync (SAP, NetSuite) or external accounting system export is deferred.
3. **Advanced Financial Reports**:
   - Balance sheets, profit and loss statements, and multi-period trial balance reporting are deferred to post-MVP phases.
