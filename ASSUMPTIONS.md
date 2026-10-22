# Assumptions & Open Architectural Questions

This document records the confirmed assumptions, resolved technical decisions, and open questions across development phases for the **Inventory Receipts with Costing and GL Posting** ERP system.

---

## 1. Confirmed Architectural Decisions (Phases 01, 02, 03 & 04)

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
   - Server calculation is enforced via `DecimalMath` using `Prisma.Decimal` and `ROUND_HALF_UP` to 4 decimal places.

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

6. **Receipt Draft Management & Business Rules (Phase 04)**:
   - Newly created receipts always start in `DRAFT` status.
   - A receipt must contain at least 1 line item upon creation and during line updates. Deletion of the last remaining line is blocked.
   - Line numbers are maintained sequentially ($1, 2, \dots, n$) without gaps.
   - Quantities must be strictly positive ($>0$).
   - Unit costs must be non-negative ($\ge 0$). Zero cost is supported for samples or warranty replacements.
   - All referenced entities (warehouse, supplier, line items) must belong to the authenticated company and be active.
   - Non-draft receipts (`POSTED`, `CANCELLED`) cannot be modified or deleted.
   - Draft receipts can be deleted, cascading line items cleanly in PostgreSQL.
   - Status transitions to `POSTED` or `CANCELLED` cannot be forged through draft management endpoints.
   - Atomic line reconciliation is supported via `PUT/PATCH /api/v1/receipts/:id/lines`.

7. **Inventory Costing Policy, Stock Balances & Ledger Invariants (Phase 05)**:
   - **Costing Valuation Model**: Moving Weighted-Average Costing per **`[companyId, warehouseId, itemId]`**. Each warehouse maintains distinct inventory balances and independent moving averages for each SKU.
   - **Inbound Movement Valuation**:
     $$\text{New Qty} = Q_{\text{prev}} + Q_{\text{in}}$$
     $$\text{Incoming Value} = \text{round}_4(Q_{\text{in}} \times C_{\text{in}})$$
     $$\text{New Value} = V_{\text{prev}} + \text{Incoming Value}$$
     $$\text{New Avg Cost} = \begin{cases} C_{\text{in}}, & \text{if } Q_{\text{prev}} = 0 \\ \text{round}_4\left(\frac{\text{New Value}}{\text{New Qty}}\right), & \text{if } Q_{\text{prev}} > 0 \end{cases}$$
   - **Zero-Cost Inbound Movements**: Supported for promotional samples or warranty intake. $C_{\text{in}} = 0$, incoming value = \$0, new total value remains $V_{\text{prev}}$, and unit cost is diluted: $\frac{V_{\text{prev}}}{Q_{\text{prev}} + Q_{\text{in}}}$.
   - **Outbound Movement Valuation**: Always relieved at current moving average cost:
     $$\text{Deducted Value} = \text{round}_4(Q_{\text{out}} \times C_{\text{current}})$$
     $$\text{New Qty} = Q_{\text{prev}} - Q_{\text{out}}$$
     $$\text{New Value} = V_{\text{prev}} - \text{Deducted Value}$$
     $$\text{New Avg Cost} = C_{\text{current}}$$
   - **Depletion to Zero Invariant**: When an outbound movement reduces quantity to exactly zero ($Q_{\text{out}} = Q_{\text{prev}}$), $\text{totalValue}$ and $\text{averageCost}$ are strictly set to $0$ to guarantee that zero stock never retains residual rounding drift on the balance sheet.
   - **Negative Stock & Insufficient Stock Policy**: Negative stock is strictly forbidden. Outbound requests where $Q_{\text{out}} > Q_{\text{prev}}$ are immediately rejected with `InsufficientStockException` (`HTTP 400`).
   - **Backdated Movements**: In a perpetual moving average system, movements are evaluated against the live balance at transaction commitment. Retroactive re-costing is not supported without complex ledger replay.
   - **Immutability & Reversals**: `StockMovement` records are strictly append-only. Correction is achieved through linked compensating movements (`referenceType = 'STOCK_MOVEMENT_REVERSAL'`). Duplicate reversals of the same movement are blocked.
   - **Concurrency Control**: Concurrency is managed via explicit PostgreSQL row locking (`SELECT ... FOR UPDATE`) within Prisma transactions. To eliminate initial-balance race conditions, zero-balance rows are upserted via `INSERT ... ON CONFLICT DO NOTHING` prior to acquiring locks. Transient serialization/deadlock errors are retried with bounded exponential jittered backoff. Multi-row transactions order lock acquisitions deterministically by `itemId: asc`.

---

## 2. Unresolved Questions & Technical Recommendations

| #      | Question / Requirement Item          | Impact on Phase 05       | Architectural Recommendation                                                                                                                                                    |
| ------ | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Costing Method Priority**          | Phase 05 Costing Engine  | Focus primarily on **Moving Weighted Average** as the core active calculation algorithm, with a clean interface for **Standard Cost** fallback and future FIFO layer expansion. |
| **Q2** | **Zero / Negative Stock Handling**   | Phase 05 Stock Ledger    | Inventory receipts always increment stock ($\ge 0$). In the event an item has zero current on-hand quantity, the new unit cost is set directly to the received unit cost.       |
| **Q3** | **Landed Cost Distribution**         | Phase 05                 | In Phase 05, support direct unit cost per receipt line. Advanced proportional freight allocation can be added as a secondary service.                                           |
| **Q4** | **Reversal & Cancellation Workflow** | Phase 05 Posting Service | A posted receipt cannot be deleted. Cancellation must create an offsetting reversing receipt and matching reversing journal entry.                                              |

---

## 3. Decisions Deferred to Later Phases

1. **Receipts Posting Endpoint**:
   - `POST /api/v1/receipts/:id/post` is deferred to Phase 05.
2. **Frontend UI Pages**:
   - Warehouse receipt entry, postings modal, and accounting inquiry views are deferred to Phase 06.
3. **Advanced Reporting UI**:
   - Balance sheets, trial balance exports, and analytics dashboard components are deferred to Phase 06/07.
