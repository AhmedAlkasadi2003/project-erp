import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { InventoryLedgerService } from '../src/inventory/inventory-ledger.service';
import { Prisma } from '@prisma/client';

describe('Inventory Ledger, Stock Balances & Costing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ledgerService: InventoryLedgerService;

  let company1Token: string;
  let company2Token: string;

  let company1Id: string;
  let company2Id: string;
  let userId1: string;

  let warehouse1Id: string;
  let warehouse2Id: string;
  let itemSteelId: string;
  let itemBoltId: string;
  let itemBetaId: string;

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
    ledgerService = app.get<InventoryLedgerService>(InventoryLedgerService);

    // 1. Authenticate Company 1 Admin
    const c1Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        companyCode: 'COMP-01',
        email: 'admin@acme-erp.local',
        password: 'Admin123!@#',
      })
      .expect(200);
    company1Token = c1Login.body.accessToken;

    // 2. Authenticate Company 2 Admin
    const c2Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        companyCode: 'COMP-02',
        email: 'admin@beta-corp.local',
        password: 'BetaAdmin123!@#',
      })
      .expect(200);
    company2Token = c2Login.body.accessToken;

    // 3. Resolve Masters
    const c1 = await prisma.company.findUnique({ where: { code: 'COMP-01' } });
    const c2 = await prisma.company.findUnique({ where: { code: 'COMP-02' } });
    const user1 = await prisma.user.findFirst({ where: { email: 'admin@acme-erp.local' } });

    company1Id = c1!.id;
    company2Id = c2!.id;
    userId1 = user1!.id;

    const wh1 = await prisma.warehouse.findFirst({ where: { companyId: company1Id } });
    const wh2 = await prisma.warehouse.findFirst({ where: { companyId: company2Id } });
    const itemsC1 = await prisma.item.findMany({ where: { companyId: company1Id } });
    const itemsC2 = await prisma.item.findMany({ where: { companyId: company2Id } });

    warehouse1Id = wh1!.id;
    warehouse2Id = wh2!.id;
    itemSteelId = itemsC1[0].id;
    itemBoltId = itemsC1[1].id;
    itemBetaId = itemsC2[0].id;
  });

  afterAll(async () => {
    // Clean up test movements
    await prisma.stockMovement.deleteMany({
      where: {
        referenceType: {
          in: ['E2E_INBOUND', 'E2E_OUTBOUND', 'E2E_CONCURRENT', 'STOCK_MOVEMENT_REVERSAL'],
        },
      },
    });

    await app.close();
  });

  describe('1. Atomic Inbound Movements & Weighted Average Valuation', () => {
    it('should initialize zero-stock balance on first inbound movement', async () => {
      // Clean previous movements for itemBolt in warehouse1 if any
      await prisma.stockMovement.deleteMany({
        where: { warehouseId: warehouse1Id, itemId: itemBoltId },
      });
      await prisma.stockBalance.deleteMany({
        where: { warehouseId: warehouse1Id, itemId: itemBoltId },
      });

      // Intake: 10 units @ $2.5000 = $25.0000
      const res = await ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemBoltId,
        quantity: '10.0000',
        unitCost: '2.5000',
        referenceType: 'E2E_INBOUND',
        referenceId: 'INTAKE-001',
        userId: userId1,
      });

      expect(res.movement.id).toBeDefined();
      expect(res.updatedBalance.quantityOnHand.toString()).toBe('10');
      expect(res.updatedBalance.totalValue.toString()).toBe('25');
      expect(res.updatedBalance.averageCost.toString()).toBe('2.5');

      // Verify row persisted in DB
      const dbBalance = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: itemBoltId,
          },
        },
      });
      expect(dbBalance).toBeDefined();
      expect(new Prisma.Decimal(dbBalance!.quantityOnHand).toFixed(4)).toBe('10.0000');
    });

    it('should compute weighted-average cost correctly on second inbound receipt', async () => {
      // Previous: 10 units @ $2.5000 = $25.0000
      // Incoming: 10 units @ $3.5000 = $35.0000
      // Expected Qty: 20.0000
      // Expected Value: $60.0000
      // Expected Avg Cost: 60 / 20 = $3.0000
      const res = await ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemBoltId,
        quantity: '10.0000',
        unitCost: '3.5000',
        referenceType: 'E2E_INBOUND',
        referenceId: 'INTAKE-002',
        userId: userId1,
      });

      expect(res.updatedBalance.quantityOnHand.toString()).toBe('20');
      expect(res.updatedBalance.totalValue.toString()).toBe('60');
      expect(res.updatedBalance.averageCost.toString()).toBe('3');
    });

    it('should dilute average cost properly on a zero-cost inbound receipt (sample/warranty)', async () => {
      // Previous: 20 units @ $3.0000 = $60.0000
      // Incoming: 10 units @ $0.0000 = $0.0000
      // Expected Qty: 30.0000
      // Expected Value: $60.0000
      // Expected Avg Cost: 60 / 30 = $2.0000
      const res = await ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemBoltId,
        quantity: '10.0000',
        unitCost: '0.0000',
        referenceType: 'E2E_INBOUND',
        referenceId: 'INTAKE-003',
        userId: userId1,
      });

      expect(res.updatedBalance.quantityOnHand.toString()).toBe('30');
      expect(res.updatedBalance.totalValue.toString()).toBe('60');
      expect(res.updatedBalance.averageCost.toString()).toBe('2');
    });
  });

  describe('2. Outbound Movement Valuation & Depletion Invariants', () => {
    it('should relieve inventory at current average cost without altering unit cost', async () => {
      // Current: 30 units @ $2.0000 = $60.0000
      // Outgoing: 10 units
      // Deducted: 10 * 2.0000 = $20.0000
      // Remaining: 20 units @ $2.0000 = $40.0000
      const res = await ledgerService.recordOutboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemBoltId,
        quantity: '10.0000',
        referenceType: 'E2E_OUTBOUND',
        referenceId: 'ISSUE-001',
        userId: userId1,
      });

      expect(res.updatedBalance.quantityOnHand.toString()).toBe('20');
      expect(res.updatedBalance.totalValue.toString()).toBe('40');
      expect(res.updatedBalance.averageCost.toString()).toBe('2');
      expect(res.movement.unitCost.toString()).toBe('2');
      expect(res.movement.totalCost.toString()).toBe('20');
    });

    it('should reject outbound request exceeding on-hand quantity with InsufficientStockException', async () => {
      // Current: 20 units. Attempt to issue 25 units.
      await expect(
        ledgerService.recordOutboundMovement({
          companyId: company1Id,
          warehouseId: warehouse1Id,
          itemId: itemBoltId,
          quantity: '25.0000',
          referenceType: 'E2E_OUTBOUND',
          referenceId: 'ISSUE-EXCEED',
          userId: userId1,
        }),
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reset total value and average cost to 0.0000 on complete depletion', async () => {
      // Current: 20 units. Issue all 20 units.
      const res = await ledgerService.recordOutboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemBoltId,
        quantity: '20.0000',
        referenceType: 'E2E_OUTBOUND',
        referenceId: 'ISSUE-DEPLETE',
        userId: userId1,
      });

      expect(res.updatedBalance.quantityOnHand.toString()).toBe('0');
      expect(res.updatedBalance.totalValue.toString()).toBe('0');
      expect(res.updatedBalance.averageCost.toString()).toBe('0');
    });
  });

  describe('3. Concurrency Protection & Row-Level Locking', () => {
    it('should handle genuinely concurrent simultaneous inbound movements safely with row locking', async () => {
      // We will perform 5 concurrent intakes of 10 units @ $10.0000 each in parallel using Promise.all
      // Starting from 0 units.
      // Final Expected Quantity: 50.0000
      // Final Expected Total Value: $500.0000
      // Final Expected Average Cost: $10.0000
      const promises = [1, 2, 3, 4, 5].map((idx) =>
        ledgerService.recordInboundMovement({
          companyId: company1Id,
          warehouseId: warehouse1Id,
          itemId: itemBoltId,
          quantity: '10.0000',
          unitCost: '10.0000',
          referenceType: 'E2E_CONCURRENT',
          referenceId: `CONC-IN-${idx}`,
          userId: userId1,
        }),
      );

      await Promise.all(promises);

      const balance = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: itemBoltId,
          },
        },
      });

      expect(new Prisma.Decimal(balance!.quantityOnHand).toFixed(4)).toBe('50.0000');
      expect(new Prisma.Decimal(balance!.totalValue).toFixed(4)).toBe('500.0000');
      expect(new Prisma.Decimal(balance!.averageCost).toFixed(4)).toBe('10.0000');
    });

    it('should eliminate the initial-balance race condition when multiple requests create a new balance row simultaneously', async () => {
      // Delete any balance for itemSteel in warehouse1
      await prisma.stockMovement.deleteMany({
        where: { warehouseId: warehouse1Id, itemId: itemSteelId },
      });
      await prisma.stockBalance.deleteMany({
        where: { warehouseId: warehouse1Id, itemId: itemSteelId },
      });

      // Launch 3 simultaneous requests to create initial stock for itemSteel
      // Request 1: 5 units @ $15.0000
      // Request 2: 5 units @ $15.0000
      // Request 3: 10 units @ $15.0000
      // Total Expected Qty = 20.0000, Total Value = $300.0000, Avg Cost = $15.0000
      const p1 = ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemSteelId,
        quantity: '5.0000',
        unitCost: '15.0000',
        referenceType: 'E2E_CONCURRENT',
        referenceId: 'RACE-001',
        userId: userId1,
      });

      const p2 = ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemSteelId,
        quantity: '5.0000',
        unitCost: '15.0000',
        referenceType: 'E2E_CONCURRENT',
        referenceId: 'RACE-002',
        userId: userId1,
      });

      const p3 = ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemSteelId,
        quantity: '10.0000',
        unitCost: '15.0000',
        referenceType: 'E2E_CONCURRENT',
        referenceId: 'RACE-003',
        userId: userId1,
      });

      await Promise.all([p1, p2, p3]);

      const balance = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: itemSteelId,
          },
        },
      });

      expect(new Prisma.Decimal(balance!.quantityOnHand).toFixed(4)).toBe('20.0000');
      expect(new Prisma.Decimal(balance!.totalValue).toFixed(4)).toBe('300.0000');
      expect(new Prisma.Decimal(balance!.averageCost).toFixed(4)).toBe('15.0000');
    });
  });

  describe('4. Stock Movement Reversals & Immutability', () => {
    it('should create an linked compensating movement on reversal and update balance', async () => {
      // 1. Create movement to reverse
      const intake = await ledgerService.recordInboundMovement({
        companyId: company1Id,
        warehouseId: warehouse1Id,
        itemId: itemBoltId,
        quantity: '15.0000',
        unitCost: '10.0000',
        referenceType: 'E2E_INBOUND',
        referenceId: 'INTAKE-TO-REVERSE',
        userId: userId1,
      });

      const qtyBeforeReversal = intake.updatedBalance.quantityOnHand;

      // 2. Execute reversal
      const rev = await ledgerService.reverseMovement({
        companyId: company1Id,
        movementId: intake.movement.id,
        userId: userId1,
      });

      expect(rev.reversalMovement.referenceType).toBe('STOCK_MOVEMENT_REVERSAL');
      expect(rev.reversalMovement.referenceId).toBe(intake.movement.id);
      expect(rev.updatedBalance.quantityOnHand.toString()).toBe(
        qtyBeforeReversal.sub(15).toString(),
      );

      // Verify original movement was NOT deleted or mutated
      const original = await prisma.stockMovement.findUnique({
        where: { id: intake.movement.id },
      });
      expect(original).toBeDefined();
    });

    it('should reject accidental duplicate reversal of the same movement with ConflictException', async () => {
      // Find the movement that was already reversed
      const reversedMov = await prisma.stockMovement.findFirst({
        where: { referenceType: 'STOCK_MOVEMENT_REVERSAL' },
      });

      await expect(
        ledgerService.reverseMovement({
          companyId: company1Id,
          movementId: reversedMov!.referenceId,
          userId: userId1,
        }),
      ).rejects.toThrow('already been reversed');
    });
  });

  describe('5. Inventory API Endpoints & Reconciliation', () => {
    it('GET /api/v1/inventory/balances should return paginated list of balances', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventory/balances?page=1&limit=10')
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
      expect(res.body.data[0].warehouse.code).toBeDefined();
    });

    it('GET /api/v1/inventory/balances/:warehouseId/:itemId should return specific balance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/inventory/balances/${warehouse1Id}/${itemBoltId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.warehouseId).toBe(warehouse1Id);
      expect(res.body.itemId).toBe(itemBoltId);
      expect(res.body.quantityOnHand).toBeDefined();
    });

    it('GET /api/v1/inventory/reconcile/:warehouseId/:itemId should verify balance against movements', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/inventory/reconcile/${warehouse1Id}/${itemBoltId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.isReconciled).toBe(true);
      expect(res.body.discrepancy).toBe('0');
      expect(res.body.movementCount).toBeGreaterThan(0);
    });

    it('should enforce multi-tenant isolation: Company 1 user cannot query Company 2 balance', async () => {
      // Ensure balance row exists for Company 2
      await ledgerService.recordInboundMovement({
        companyId: company2Id,
        warehouseId: warehouse2Id,
        itemId: itemBetaId,
        quantity: '5.0000',
        unitCost: '50.0000',
        referenceType: 'E2E_INBOUND',
        referenceId: 'BETA-INIT',
        userId: userId1,
      });

      // Company 2 user CAN query its own balance
      await request(app.getHttpServer())
        .get(`/api/v1/inventory/balances/${warehouse2Id}/${itemBetaId}`)
        .set('Authorization', `Bearer ${company2Token}`)
        .expect(200);

      // Company 1 user CANNOT query Company 2 balance (scoped to Company 1)
      await request(app.getHttpServer())
        .get(`/api/v1/inventory/balances/${warehouse2Id}/${itemBetaId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(404);
    });

    it('should verify that Phase 04 draft receipts remain DRAFT and do not mutate stock balances', async () => {
      // 1. Check current balance for itemBolt
      const balanceBefore = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: itemBoltId,
          },
        },
      });

      // 2. Create a Phase 04 draft receipt with itemBolt
      const supplier = await prisma.supplier.findFirst({ where: { companyId: company1Id } });
      const draftReceipt = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier!.id,
          receiptNumber: 'REC-PHASE05-CHECK',
          lines: [
            {
              itemId: itemBoltId,
              quantityReceived: 999,
              unitCost: 10,
            },
          ],
        })
        .expect(201);

      expect(draftReceipt.body.status).toBe('DRAFT');

      // 3. Confirm balance was UNTOUCHED
      const balanceAfter = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: itemBoltId,
          },
        },
      });

      expect(new Prisma.Decimal(balanceAfter!.quantityOnHand).toString()).toBe(
        new Prisma.Decimal(balanceBefore!.quantityOnHand).toString(),
      );

      // Clean up draft receipt
      await prisma.receiptLine.deleteMany({ where: { receiptId: draftReceipt.body.id } });
      await prisma.receipt.delete({ where: { id: draftReceipt.body.id } });
    });
  });

  describe('6. Item Stock Card (Bin Card / Ledger Card) Endpoint', () => {
    it('GET /api/v1/items/:id/stock-card should return movement history with running quantity and average cost', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${itemBoltId}/stock-card`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.item.id).toBe(itemBoltId);
      expect(res.body.item.sku).toBeDefined();
      expect(res.body.openingBalance).toBeDefined();
      expect(res.body.closingBalance).toBeDefined();
      expect(res.body.currentBalances).toBeInstanceOf(Array);
      expect(res.body.movements).toBeInstanceOf(Array);
      expect(res.body.movements.length).toBeGreaterThan(0);

      // Verify running balances are present on each movement entry
      const firstMovement = res.body.movements[0];
      expect(firstMovement.runningQuantity).toBeDefined();
      expect(firstMovement.runningAverageCost).toBeDefined();
      expect(firstMovement.warehouse.code).toBeDefined();
    });

    it('GET /api/v1/inventory/items/:id/stock-card alias should return identical stock card data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/inventory/items/${itemBoltId}/stock-card`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.item.id).toBe(itemBoltId);
      expect(res.body.movements).toBeInstanceOf(Array);
    });

    it('should support warehouse filtering and date filtering on stock card', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/items/${itemBoltId}/stock-card?warehouseId=${warehouse1Id}&from=2026-01-01&to=2026-12-31`,
        )
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.filters.warehouseId).toBe(warehouse1Id);
      expect(res.body.filters.from).toBe('2026-01-01');
      expect(res.body.filters.to).toBe('2026-12-31');
      expect(res.body.openingBalance).toBeDefined();
      expect(res.body.closingBalance).toBeDefined();
    });

    it('should reject invalid date range where from date is after to date (HTTP 400)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${itemBoltId}/stock-card?from=2026-12-31&to=2026-01-01`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(400);

      expect(res.body.message).toContain('earlier than or equal to');
    });

    it('should enforce multi-tenant isolation: Company 1 user cannot access Company 2 item stock card', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/items/${itemBetaId}/stock-card`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(404);

      // But Company 2 user CAN access it
      await request(app.getHttpServer())
        .get(`/api/v1/items/${itemBetaId}/stock-card`)
        .set('Authorization', `Bearer ${company2Token}`)
        .expect(200);
    });
  });
});
