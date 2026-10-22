import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { PeriodStatus, Prisma, ReceiptStatus, StockMovementType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { OutboxProcessor } from '../src/outbox/outbox-processor';
import { InventoryLedgerService } from '../src/inventory/inventory-ledger.service';

describe('Concurrency, Multi-Tenancy & Reliability Hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outboxProcessor: OutboxProcessor;
  let inventoryLedger: InventoryLedgerService;

  let c1AdminToken: string;
  let c2AdminToken: string;

  let company1Id: string;

  let warehouse1Id: string;
  let supplier1Id: string;
  let item1Id: string;
  let item2Id: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://erp_user:erp_password_local_dev@localhost:5434/inventory_erp_dev?schema=public';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'super_secret_erp_jwt_key_for_development_min_32_chars!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    outboxProcessor = app.get<OutboxProcessor>(OutboxProcessor);
    inventoryLedger = app.get<InventoryLedgerService>(InventoryLedgerService);

    // 1. Authenticate C1 Admin
    const c1AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-01',
      email: 'admin@acme-erp.local',
      password: 'Admin123!@#',
    });
    c1AdminToken = c1AdminLogin.body.accessToken;
    company1Id = c1AdminLogin.body.user.companyId;

    // 2. Authenticate C2 Admin
    const c2AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-02',
      email: 'admin@beta-corp.local',
      password: 'BetaAdmin123!@#',
    });
    c2AdminToken = c2AdminLogin.body.accessToken;

    // 3. Resolve masters for C1
    const wh1 = await prisma.warehouse.findFirstOrThrow({
      where: { companyId: company1Id, isActive: true },
    });
    warehouse1Id = wh1.id;

    const supp1 = await prisma.supplier.findFirstOrThrow({
      where: { companyId: company1Id, isActive: true },
    });
    supplier1Id = supp1.id;

    const items = await prisma.item.findMany({
      where: { companyId: company1Id, isActive: true },
      take: 2,
    });
    item1Id = items[0].id;
    item2Id = items[1].id;

    // Ensure GRN Clearing Account exists
    const grnAccount = await prisma.account.findUniqueOrThrow({
      where: { companyId_code: { companyId: company1Id, code: '2100' } },
    });
    await prisma.company.update({
      where: { id: company1Id },
      data: { grnClearingAccountId: grnAccount.id },
    });

    // Ensure open period for 2026
    let openPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        companyId: company1Id,
        status: PeriodStatus.OPEN,
        startDate: { lte: new Date('2026-08-01') },
        endDate: { gte: new Date('2026-08-01') },
      },
    });
    if (!openPeriod) {
      openPeriod = await prisma.accountingPeriod.create({
        data: {
          companyId: company1Id,
          name: 'FY2026-CONCURRENCY',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: PeriodStatus.OPEN,
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario A: Double Posting Race Condition (Pessimistic Locking)', () => {
    it('should allow exactly one posting transition and reject the concurrent second request with 409 Conflict', async () => {
      // Create single draft receipt
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-DOUBLE-POST-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '10.0000',
              unitCost: '50.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      // Fire two concurrent post requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${receiptId}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`)
          .send({ postingDate: '2026-08-01T00:00:00.000Z' }),
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${receiptId}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`)
          .send({ postingDate: '2026-08-01T00:00:00.000Z' }),
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Invariants: Exactly one 200 OK, and exactly one 409 Conflict
      expect(statuses).toEqual([200, 409]);

      // Check database state
      const receipt = await prisma.receipt.findUniqueOrThrow({
        where: { id: receiptId },
      });
      expect(receipt.status).toBe(ReceiptStatus.POSTED);

      // Verify only 1 stock movement was generated for this receipt
      const movements = await prisma.stockMovement.findMany({
        where: { receiptId },
      });
      expect(movements).toHaveLength(1);

      // Verify only 1 journal entry exists
      expect(receipt.journalEntryId).toBeDefined();
      const journalEntry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: receipt.journalEntryId! },
      });
      expect(journalEntry.sourceReference).toBe(receipt.receiptNumber);

      // Verify only 1 outbox event exists for this posting
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: receiptId, eventType: 'RECEIPT_POSTED' },
      });
      expect(outboxEvents).toHaveLength(1);
    });
  });

  describe('Scenario B: Competing Receipts Affecting the Same Stock Balance', () => {
    it('should safely post two overlapping receipts concurrently without lost updates or balance corruption', async () => {
      // Record initial on-hand stock and average cost
      const initialBalance = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item2Id,
          },
        },
      });

      const initialQty = initialBalance
        ? new Prisma.Decimal(initialBalance.quantityOnHand)
        : new Prisma.Decimal(0);
      const initialVal = initialBalance
        ? new Prisma.Decimal(initialBalance.quantityOnHand).mul(initialBalance.averageCost)
        : new Prisma.Decimal(0);

      // Create Receipt 1: 10 units @ 100.00
      const rec1Res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-COMP-1-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: item2Id,
              quantityReceived: '10.0000',
              unitCost: '100.0000',
            },
          ],
        })
        .expect(201);

      // Create Receipt 2: 20 units @ 130.00
      const rec2Res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-COMP-2-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: item2Id,
              quantityReceived: '20.0000',
              unitCost: '130.0000',
            },
          ],
        })
        .expect(201);

      // Post both concurrently
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${rec1Res.body.id}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`)
          .send({ postingDate: '2026-08-01T00:00:00.000Z' }),
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${rec2Res.body.id}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`)
          .send({ postingDate: '2026-08-01T00:00:00.000Z' }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Verify final stock balance: Q_final = Q_initial + 10 + 20
      const finalBalance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item2Id,
          },
        },
      });

      const expectedTotalQty = initialQty.add(30);
      expect(new Prisma.Decimal(finalBalance.quantityOnHand).toString()).toBe(
        expectedTotalQty.toString(),
      );

      // Verify mathematically weighted cost
      const totalInboundValue = new Prisma.Decimal('10')
        .mul('100')
        .add(new Prisma.Decimal('20').mul('130'));
      const expectedTotalVal = initialVal.add(totalInboundValue);
      const expectedAvgCost = expectedTotalVal.div(expectedTotalQty);

      expect(new Prisma.Decimal(finalBalance.averageCost).toDecimalPlaces(2).toString()).toBe(
        expectedAvgCost.toDecimalPlaces(2).toString(),
      );
    });
  });

  describe('Scenario C: First-Time Stock Balance Creation Race', () => {
    it('should safely initialize stock balance under concurrent receipt postings for a brand-new SKU', async () => {
      const cogsAcc = await prisma.account.findUniqueOrThrow({
        where: { companyId_code: { companyId: company1Id, code: '5000' } },
      });

      // 1. Create a brand new item with NO existing stock balance
      const newSku = `SKU-RACE-${Date.now()}`;
      const newItem = await prisma.item.create({
        data: {
          companyId: company1Id,
          sku: newSku,
          name: 'Concurrent Race Item',
          uom: 'PCS',
          valuationMethod: 'MOVING_AVERAGE',
          assetAccountId: (
            await prisma.account.findUniqueOrThrow({
              where: { companyId_code: { companyId: company1Id, code: '1200' } },
            })
          ).id,
          cogsAccountId: cogsAcc.id,
        },
      });

      // Verify no balance exists yet
      const preBalance = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: newItem.id,
          },
        },
      });
      expect(preBalance).toBeNull();

      // Create Receipt A: 5 units @ 40.00
      const recA = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-NEW-A-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: newItem.id,
              quantityReceived: '5.0000',
              unitCost: '40.0000',
            },
          ],
        })
        .expect(201);

      // Create Receipt B: 15 units @ 60.00
      const recB = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-NEW-B-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: newItem.id,
              quantityReceived: '15.0000',
              unitCost: '60.0000',
            },
          ],
        })
        .expect(201);

      // Post both concurrently to trigger race on initial balance creation
      const [postA, postB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${recA.body.id}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`)
          .send({ postingDate: '2026-08-01T00:00:00.000Z' }),
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${recB.body.id}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`)
          .send({ postingDate: '2026-08-01T00:00:00.000Z' }),
      ]);

      expect(postA.status).toBe(200);
      expect(postB.status).toBe(200);

      // Verify exactly ONE balance record was created, with quantity = 20
      const balance = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: newItem.id,
          },
        },
      });

      expect(new Prisma.Decimal(balance.quantityOnHand).toNumber()).toBe(20);
      // Weighted average: (5*40 + 15*60) / 20 = (200 + 900) / 20 = 1100 / 20 = 55.00
      expect(new Prisma.Decimal(balance.averageCost).toNumber()).toBe(55);
    });
  });

  describe('Scenario D: Void Versus Subsequent Stock Consumption', () => {
    it('should reject voiding with 409 Conflict when on-hand stock has been partially issued/consumed', async () => {
      const cogsAcc = await prisma.account.findUniqueOrThrow({
        where: { companyId_code: { companyId: company1Id, code: '5000' } },
      });

      // 1. Create a fresh item
      const item = await prisma.item.create({
        data: {
          companyId: company1Id,
          sku: `SKU-DEFENSE-${Date.now()}`,
          name: 'Stock Defense Item',
          uom: 'PCS',
          valuationMethod: 'MOVING_AVERAGE',
          assetAccountId: (
            await prisma.account.findUniqueOrThrow({
              where: { companyId_code: { companyId: company1Id, code: '1200' } },
            })
          ).id,
          cogsAccountId: cogsAcc.id,
        },
      });

      // 2. Post receipt for 10 units
      const receiptRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-CONSUME-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: item.id,
              quantityReceived: '10.0000',
              unitCost: '100.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = receiptRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ postingDate: '2026-08-01T00:00:00.000Z' })
        .expect(200);

      // 3. Simulate issue / consumption of 6 units using InventoryLedgerService
      await inventoryLedger.recordOutboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: item.id,
        movementType: StockMovementType.ISSUE,
        quantity: new Prisma.Decimal('6.0000'),
        referenceType: 'SALES_ISSUE',
        referenceId: `SO-CONSUME-${Date.now()}`,
        userId: (await prisma.user.findFirstOrThrow({ where: { companyId: company1Id } })).id,
      });

      // Stock is now: 10 - 6 = 4 units on-hand.
      // 4. Attempt to void the receipt of 10 units. It MUST be rejected because 4 < 10.
      const voidRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          voidReason: 'Cannot void because stock was consumed',
          voidDate: '2026-08-01T00:00:00.000Z',
        });

      expect(voidRes.status).toBe(409);
      expect(voidRes.body.message).toContain('Insufficient on-hand stock');

      // Verify receipt remains POSTED, not VOIDED
      const receiptAfter = await prisma.receipt.findUniqueOrThrow({
        where: { id: receiptId },
      });
      expect(receiptAfter.status).toBe(ReceiptStatus.POSTED);
    });
  });

  describe('Scenario E: Outbox Worker Concurrency (SKIP LOCKED)', () => {
    it('should ensure two concurrent workers claim disjoint sets of events with zero overlap', async () => {
      // 1. Insert 10 pending outbox events
      const batchIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ev = await prisma.outboxEvent.create({
          data: {
            companyId: company1Id,
            aggregateType: 'Receipt',
            aggregateId: `worker-race-${i}-${Date.now()}`,
            eventType: 'RECEIPT_POSTED',
            payload: { index: i },
            status: 'PENDING',
          },
        });
        batchIds.push(ev.id);
      }

      // 2. Execute claimBatch concurrently on two simulated worker instances
      const workerA = 'worker-node-alpha';
      const workerB = 'worker-node-beta';

      const [claimedA, claimedB] = await Promise.all([
        outboxProcessor.claimBatch(workerA, 5),
        outboxProcessor.claimBatch(workerB, 5),
      ]);

      const idsA = claimedA.map((e) => e.id);
      const idsB = claimedB.map((e) => e.id);

      // Verify that NO event was claimed by both workers (disjoint intersection)
      const intersection = idsA.filter((id) => idsB.includes(id));
      expect(intersection).toHaveLength(0);

      // Verify lockedBy in database corresponds to worker that claimed it
      for (const id of idsA) {
        const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
        expect(ev.lockedBy).toBe(workerA);
        expect(ev.status).toBe('PROCESSING');
      }

      for (const id of idsB) {
        const ev = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
        expect(ev.lockedBy).toBe(workerB);
        expect(ev.status).toBe('PROCESSING');
      }
    });
  });

  describe('Scenario F: Multi-Tenant Security Boundary Hardening', () => {
    it('should reject posting of Company 1 receipt when requested by Company 2 Admin', async () => {
      const rec = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-TENANT-SEC-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '2.0000',
              unitCost: '10.0000',
            },
          ],
        })
        .expect(201);

      // Attempt to post as Company 2 Admin
      const crossPost = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${rec.body.id}/post`)
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .send({ postingDate: '2026-08-01T00:00:00.000Z' });

      // Company isolation rejects cross-company receipt (403 Forbidden or 404 Not Found to prevent enumeration)
      expect([403, 404]).toContain(crossPost.status);
    });

    it('should reject voiding of Company 1 receipt when requested by Company 2 Admin', async () => {
      const rec = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-TENANT-VOID-SEC-${Date.now()}`,
          receiptDate: '2026-08-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '2.0000',
              unitCost: '10.0000',
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${rec.body.id}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ postingDate: '2026-08-01T00:00:00.000Z' })
        .expect(200);

      // Attempt to void as Company 2 Admin
      const crossVoid = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${rec.body.id}/void`)
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .send({
          voidReason: 'Cross tenant attack',
          voidDate: '2026-08-01T00:00:00.000Z',
        });

      // Company isolation rejects cross-company void
      expect([403, 404]).toContain(crossVoid.status);
    });
  });
});
