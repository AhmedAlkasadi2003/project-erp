# Architecture & System Design Document

**System**: Inventory Receipts with Costing and General Ledger Posting  
**Scope**: Final Production Architecture, Concurrency, Scaling & Domain Invariants (Phases 01–12)  
**Length**: Compact Design Specification (Strict 2-Page Constraint)

---

## 1. Data Model Rationale: Dual Ledger & Materialized Balance Snapshot

The inventory domain employs a dual-model architecture: an **immutable, append-only transaction ledger (`StockMovement`)** paired with a **mutable materialized snapshot (`StockBalance`)** per `[companyId, warehouseId, itemId]`.

- **Auditability & Forensics**: In financial accounting, inventory balances cannot be overwritten destructively. The append-only ledger records every intake, outbound issue, and reversal with cryptographic actor attribution, timestamp, reference document, and running balance snapshots (`balanceAfter`, `averageCostAfter`).
- **High-Throughput Operational Performance**: Calculating running stock by summing millions of ledger rows on every inquiry or receipt posting would degrade from $O(1)$ to $O(N)$, causing severe latency and lock contention. The `StockBalance` table maintains pre-aggregated on-hand quantity, total value, and moving average cost for sub-millisecond lookups and atomic row-level locks.
- **Reconciliation Invariant**: The materialized snapshot can be mathematically reconstructed at any time by replaying historical movements: $\text{Current Balance} = \sum \text{Ledger Inflows} - \sum \text{Ledger Outflows}$. Discrepancies are surfaced via `/api/v1/inventory/reconcile/:warehouseId/:itemId`.

---

## 2. Concurrency Strategy & Failure Modes

All mutations modifying stock or financial state execute inside single PostgreSQL ACID transactions managed via Prisma.

- **Pessimistic Row-Level Locking**: Concurrent operations on the same SKU acquire exclusive row locks using `SELECT ... FOR UPDATE` on `StockBalance`. Competing transactions serialize cleanly, preventing lost updates and race conditions during weighted-average revaluation.
- **Initial-Balance Race Elimination**: To prevent `INSERT` collisions when multiple concurrent receipts introduce a new SKU, the engine executes an atomic `INSERT ... ON CONFLICT ("companyId", "warehouseId", "itemId") DO NOTHING` before acquiring the lock.
- **Deterministic Lock Ordering**: When a receipt contains multiple SKUs, row locks are acquired in sorted order (`itemId: 'asc'`). This guarantees that circular wait conditions cannot occur across concurrent multi-item receipts.
- **Transient Conflict Retry**: Transient database errors (`40001` Serialization Failure, `40P01` Deadlock, `P2034` Prisma Write Conflict) are automatically caught and retried using exponential backoff with random jitter.
- **What Could Break These Guarantees?**:
  1. _Bypassing the ORM/Service Layer_: Direct SQL updates outside the application that modify `stock_balances` without taking row locks or appending to `stock_movements`.
  2. _Distributed Multi-Master Database Topologies_: Active-active replication setups without synchronous consensus could cause split-brain balance drifts.
  3. _Long-Running External Calls Inside Transactions_: Invoking external HTTP APIs inside the database transaction boundary would hold row locks open, exhausting PostgreSQL connection pools.

---

## 3. Backdated-Receipt Policy & Rejected Alternatives

- **Current Implementation Policy**: In our perpetual moving weighted-average costing engine, all receipt postings and voids are evaluated against the **live materialized balance at the exact moment of transaction commitment**. The transaction date must fall within an active `OPEN` accounting period. Historical movements are immutable; corrections require explicit compensating reversal transactions (`STOCK_MOVEMENT_REVERSAL`).
- **Rejected Alternative 1: Full Historical Ledger Recalculation (Cascade Replay)**:
  - _Why Rejected_: Inserting a backdated receipt into historical timeline and recalculating moving average costs for all subsequent movements rewrites historical cost of goods sold (COGS) and inventory valuation. In regulated accounting, previously closed accounting periods and published financial statements cannot be silently mutated without formal restatement.
- **Rejected Alternative 2: Allowing Negative Stock Relieving**:
  - _Why Rejected_: Allowing backdated issues or receipts that create temporary negative stock invalidates moving average formulas (causing negative unit costs or division-by-zero anomalies). The engine strictly rejects any transaction that would result in $Q_{\text{onhand}} < 0$.

---

## 4. Scaling Toward 50 Million Stock Movements

As the inventory ledger grows toward $50,000,000+$ rows, the following architectural scaling path is designed:

1. **Table Partitioning**: Range-partition `stock_movements` by calendar quarter or month on `movementDate`. Historical partitions are placed on read-only tablespaces, while write operations hit active partitions, maintaining small B-Tree index depths.
2. **Composite Covering Indexes**: Current indexes (`@@index([companyId, itemId, warehouseId, movementDate])`) allow $O(\log N)$ stock card queries. Covering indexes including `balanceAfter` and `averageCostAfter` eliminate heap lookups.
3. **Point-in-Time Snapshot Archival**: Introduce monthly balance snapshot tables (`monthly_stock_balances`). To rebuild an item's balance or audit a historical stock card, the engine starts from the latest monthly snapshot rather than replaying from inception.
4. **Read/Write Replica Splitting**: Route analytical reports, trial balances, and stock card lookups (`GET /items/:id/stock-card`) to PostgreSQL streaming read replicas using connection pooling (PgBouncer), reserving the primary node for ACID receipt postings.

---

## 5. Service Separation & Bounded Contexts

If decomposed into distributed microservices, the system splits into three autonomous domains:

```
[ Procurement / Receiving Service ] ──(Events: ReceiptPosted, ReceiptVoided)──> [ Event Broker / Kafka ]
                                                                                      │
                                                               ┌──────────────────────┴──────────────────────┐
                                                               ▼                                             ▼
                                                [ Inventory Ledger Service ]                   [ General Ledger Accounting Service ]
                                                - Stock balances & costing                     - Chart of Accounts & journal lines
                                                - StockMovement append-only                    - Accounting period validations
```

- **Data Ownership**: Receiving Service owns `Receipts`; Inventory Service owns `StockBalances` and `StockMovements`; Accounting Service owns `Accounts`, `Periods`, and `JournalEntries`.
- **Asynchronous Event Choreography**: The Transactional Outbox pattern guarantees that `ReceiptPosted` events are published reliably to Kafka/RabbitMQ without dual-write inconsistencies.
- **Synchronous vs. Asynchronous Interaction**: Posting validation (verifying open period and valid asset accounts) occurs via lightweight synchronous gRPC contracts prior to event commit, while audit logging and external notifications consume asynchronous outbox streams.

---

## 6. Migration from Legacy Floating-Point Costs

Systems migrating from legacy IEEE-754 floating-point databases (`FLOAT`, `DOUBLE PRECISION`) face catastrophic penny-rounding drift.

- **Migration Pipeline**:
  1. _Dual-Column Schema Expansion_: Add temporary `new_unit_cost DECIMAL(19, 4)` and `new_total_value DECIMAL(19, 4)` columns alongside legacy float fields.
  2. _Deterministic Conversion Script_: Read legacy floating-point values and convert to exact strings via fixed-point truncation and `ROUND_HALF_UP` to 4 decimal places: `new Prisma.Decimal(legacyValue.toFixed(4))`.
  3. _Penny Variance Ledger Reconciliation_: Calculate the cumulative floating-point delta per SKU: $\Delta = V_{\text{legacy}} - \sum (Q_i \times C_i)$. Post a single adjusting journal entry (Debit/Credit Inventory Revaluation Variance) to align the General Ledger with the sub-ledger.
  4. _Enforce Database Constraints_: Drop legacy float columns, enforce `DECIMAL(19, 4)` with `NOT NULL` constraints, and reject unvalidated floats at the API boundary.

---

## 7. Deliberately Omitted Scope & Top Three Production Risks

### Deliberately Omitted Scope

1. **Landed Freight & Customs Proration**: Inbound freight and duties currently hit separate expense/clearing accounts rather than being dynamically prorated across receipt line costs.
2. **Serial & Batch Expiry Tracking**: Physical lot allocation and expiration date rotation (FEFO) are deferred to warehouse management extensions.
3. **Automated Period Year-End Closeout**: Net income transfer to Retained Earnings upon closing fiscal periods is handled via manual journal entries rather than automated batch jobs.

### Three Largest Production Risks & Mitigations

| Risk                                                   | Description                                                                                                                       | Implemented Mitigation                                                                                                                                                                               |
| :----------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Database Lock Contention Under High Concurrency** | Thousands of simultaneous receipts posting the same SKU can cause PostgreSQL connection pool exhaustion and transaction timeouts. | Deterministic sort order on SKU lock acquisition (`itemId: 'asc'`), bounded jittered retries, and keeping non-database tasks outside the transaction boundary.                                       |
| **2. Downstream Outbox Consumer Lag / Poison Pills**   | A malformed external consumer could repeatedly fail on specific outbox payloads, blocking subsequent event processing.            | Outbox worker uses `SKIP LOCKED` for parallel batching, exponential backoff, dead-letter queuing (`DEAD_LETTER`), and administrative replay endpoints.                                               |
| **3. Accidental Stock Depletion Void Collisions**      | A user attempts to void a receipt while an automated fulfillment worker is concurrently issuing goods for customer dispatch.      | Atomic row locking on stock balances during void workflow validates $Q_{\text{onhand}} \ge Q_{\text{received}}$ inside the transaction, rejecting void with HTTP 409 Conflict if stock was consumed. |
