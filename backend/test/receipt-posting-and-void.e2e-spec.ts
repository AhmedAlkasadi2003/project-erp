import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PeriodStatus, Prisma, ReceiptStatus } from '@prisma/client';

describe('Atomic Receipt Posting & Safe Void Workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let c1AdminToken: string;
  let c1ClerkToken: string;
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

    // 1. Authenticate C1 Admin
    const c1AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-01',
      email: 'admin@acme-erp.local',
      password: 'Admin123!@#',
    });
    c1AdminToken = c1AdminLogin.body.accessToken;
    company1Id = c1AdminLogin.body.user.companyId;

    // 2. Authenticate C1 Clerk
    const c1ClerkLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-01',
      email: 'clerk@acme-erp.local',
      password: 'Clerk123!@#',
    });
    c1ClerkToken = c1ClerkLogin.body.accessToken;

    // 4. Authenticate C2 Admin
    const c2AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-02',
      email: 'admin@beta-corp.local',
      password: 'BetaAdmin123!@#',
    });
    c2AdminToken = c2AdminLogin.body.accessToken;

    // 5. Look up C1 Warehouse, Supplier, Items
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

    // 6. Ensure Company 1 has an active GRN Clearing Account configured (Account 2100)
    const grnAccount = await prisma.account.findUniqueOrThrow({
      where: { companyId_code: { companyId: company1Id, code: '2100' } },
    });
    await prisma.company.update({
      where: { id: company1Id },
      data: { grnClearingAccountId: grnAccount.id },
    });

    // 7. Ensure Company 1 has an OPEN period for 2026
    let openPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        companyId: company1Id,
        status: PeriodStatus.OPEN,
        startDate: { lte: new Date('2026-06-15') },
        endDate: { gte: new Date('2026-06-15') },
      },
    });
    if (!openPeriod) {
      openPeriod = await prisma.accountingPeriod.create({
        data: {
          companyId: company1Id,
          name: 'FY2026-ALL',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: PeriodStatus.OPEN,
        },
      });
    }

    // 8. Create a CLOSED period for testing closed-period rejections (2025)
    const closedPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        companyId: company1Id,
        status: PeriodStatus.CLOSED,
      },
    });
    if (!closedPeriod) {
      await prisma.accountingPeriod.create({
        data: {
          companyId: company1Id,
          name: 'FY2025-CLOSED',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          status: PeriodStatus.CLOSED,
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Successful Atomic Receipt Posting', () => {
    it('should successfully post a single-line draft receipt and update stock + GL atomically', async () => {
      // Create a draft receipt
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-POST-SINGLE-${Date.now()}`,
          receiptDate: '2026-06-15T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '10.0000',
              unitCost: '25.0000',
              taxAmount: '0.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;
      expect(createRes.body.status).toBe(ReceiptStatus.DRAFT);

      // Snapshot balance before posting
      const balanceBefore = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item1Id,
          },
        },
      });
      const qtyBefore = balanceBefore?.quantityOnHand || new Prisma.Decimal(0);
      const valBefore = balanceBefore?.totalValue || new Prisma.Decimal(0);

      // Post the receipt
      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .expect(200);

      expect(postRes.body.message).toContain('posted successfully');
      expect(postRes.body.journalEntryId).toBeDefined();
      expect(postRes.body.journalEntryNumber).toBeDefined();
      expect(postRes.body.movementsCreated).toBe(1);

      // Verify Receipt in DB
      const receiptInDb = await prisma.receipt.findUniqueOrThrow({
        where: { id: receiptId },
        include: { journalEntry: { include: { lines: true } }, stockMovements: true },
      });
      expect(receiptInDb.status).toBe(ReceiptStatus.POSTED);
      expect(receiptInDb.postingDate).toBeDefined();
      expect(receiptInDb.postedById).toBeDefined();
      expect(receiptInDb.journalEntryId).toBe(postRes.body.journalEntryId);

      // Verify Stock Movements
      expect(receiptInDb.stockMovements.length).toBe(1);
      const movement = receiptInDb.stockMovements[0];
      expect(movement.movementType).toBe('RECEIPT');
      expect(movement.referenceType).toBe('RECEIPT');
      expect(movement.referenceId).toBe(receiptId);
      expect(new Prisma.Decimal(movement.quantity).toFixed(4)).toBe('10.0000');
      expect(new Prisma.Decimal(movement.unitCost).toFixed(4)).toBe('25.0000');
      expect(new Prisma.Decimal(movement.totalCost).toFixed(4)).toBe('250.0000');

      // Verify Stock Balance
      const balanceAfter = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item1Id,
          },
        },
      });
      const expectedQty = qtyBefore.add(new Prisma.Decimal('10.0000'));
      const expectedVal = valBefore.add(new Prisma.Decimal('250.0000'));
      expect(balanceAfter.quantityOnHand.toFixed(4)).toBe(expectedQty.toFixed(4));
      expect(balanceAfter.totalValue.toFixed(4)).toBe(expectedVal.toFixed(4));

      // Verify Journal Entry
      const je = receiptInDb.journalEntry!;
      expect(je.status).toBe('POSTED');
      expect(je.sourceType).toBe('RECEIPT');
      expect(je.sourceReference).toBe(receiptInDb.receiptNumber);
      expect(new Prisma.Decimal(je.totalDebit).toFixed(4)).toBe('250.0000');
      expect(new Prisma.Decimal(je.totalCredit).toFixed(4)).toBe('250.0000');

      // Verify Journal Lines: 1 debit (Asset), 1 credit (Clearing)
      expect(je.lines.length).toBe(2);
      const debitLeg = je.lines.find((l) => new Prisma.Decimal(l.debit).gt(0))!;
      const creditLeg = je.lines.find((l) => new Prisma.Decimal(l.credit).gt(0))!;
      expect(new Prisma.Decimal(debitLeg.debit).toFixed(4)).toBe('250.0000');
      expect(new Prisma.Decimal(creditLeg.credit).toFixed(4)).toBe('250.0000');

      // Verify Audit Event
      const auditEvent = await prisma.auditEvent.findFirst({
        where: { entityType: 'Receipt', entityId: receiptId, action: 'RECEIPT_POSTED' },
      });
      expect(auditEvent).toBeDefined();
    });

    it('should successfully post a multi-line receipt with multiple items and exact double-entry balance', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-POST-MULTI-${Date.now()}`,
          receiptDate: '2026-06-16T12:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '20.0000',
              unitCost: '15.0000',
              taxAmount: '0.0000',
            },
            {
              itemId: item2Id,
              quantityReceived: '5.0000',
              unitCost: '40.0000',
              taxAmount: '0.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;
      // Line 1: 20 * 15 = 300
      // Line 2: 5 * 40 = 200
      // Total = 500

      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      expect(postRes.body.movementsCreated).toBe(2);

      const receipt = await prisma.receipt.findUniqueOrThrow({
        where: { id: receiptId },
        include: { journalEntry: { include: { lines: true } }, stockMovements: true },
      });

      expect(receipt.status).toBe(ReceiptStatus.POSTED);
      expect(receipt.stockMovements.length).toBe(2);

      const je = receipt.journalEntry!;
      expect(new Prisma.Decimal(je.totalDebit).toFixed(4)).toBe('500.0000');
      expect(new Prisma.Decimal(je.totalCredit).toFixed(4)).toBe('500.0000');
      expect(je.lines.length).toBe(3); // 2 debits (one per item) + 1 credit (Clearing)
    });
  });

  describe('2. Failure & Rollback Invariants', () => {
    it('should reject posting a receipt that does not exist (404)', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${nonExistentId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(404);
    });

    it('should reject cross-company posting attempt (Company 2 cannot post Company 1 receipt)', async () => {
      // Create draft in Company 1
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-CROSS-CO-${Date.now()}`,
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '5.0000',
              unitCost: '10.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      // Attempt posting by Company 2 Admin -> rejected 404/403
      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .expect(404);

      // Verify receipt is still DRAFT in Company 1
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
      expect(receipt.status).toBe(ReceiptStatus.DRAFT);
      expect(receipt.journalEntryId).toBeNull();
    });

    it('should reject posting and leave no partial changes if posting date is in a CLOSED period', async () => {
      // Create draft with date in 2025 (closed period)
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-CLOSED-PER-${Date.now()}`,
          receiptDate: '2025-05-10T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '12.0000',
              unitCost: '30.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      const movementCountBefore = await prisma.stockMovement.count({
        where: { receiptId },
      });

      // Post should fail with 400
      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .expect(400);

      expect(postRes.body.message).toContain('closed accounting period');

      // Verify zero partial mutations occurred
      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
      expect(receipt.status).toBe(ReceiptStatus.DRAFT);
      expect(receipt.journalEntryId).toBeNull();

      const movementCountAfter = await prisma.stockMovement.count({
        where: { receiptId },
      });
      expect(movementCountAfter).toBe(movementCountBefore);
    });

    it('should reject posting and leave no partial changes if posting date has NO accounting period', async () => {
      // Create draft in year 2045 (no period defined)
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-NO-PER-${Date.now()}`,
          receiptDate: '2045-05-10T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '10.0000',
              unitCost: '20.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      const postRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .expect(400);

      expect(postRes.body.message).toContain('No active accounting period found');

      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
      expect(receipt.status).toBe(ReceiptStatus.DRAFT);
      expect(receipt.journalEntryId).toBeNull();
    });
  });

  describe('3. Concurrency Control and Idempotency', () => {
    it('should reject repeating the same posting request without idempotency key with 409 Conflict', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-REPEAT-${Date.now()}`,
          receiptDate: '2026-06-18T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '4.0000',
              unitCost: '15.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      // First posting succeeds
      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      // Second identical call without idempotency key -> 409 Conflict
      const secondRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(409);

      expect(secondRes.body.message).toContain('has already been posted');
    });

    it('should return cached response when repeating with the same Idempotency-Key header', async () => {
      const idempotencyKey = `idem-key-${Date.now()}`;

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-IDEM-${Date.now()}`,
          receiptDate: '2026-06-19T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '8.0000',
              unitCost: '12.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      // First call with Idempotency-Key
      const firstRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .set('idempotency-key', idempotencyKey)
        .expect(200);

      expect(firstRes.body.journalEntryId).toBeDefined();

      // Second call with same Idempotency-Key -> returns cached response (200)
      const secondRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .set('idempotency-key', idempotencyKey)
        .expect(200);

      expect(secondRes.body.journalEntryId).toBe(firstRes.body.journalEntryId);
      expect(secondRes.body.receipt.id).toBe(firstRes.body.receipt.id);

      // Verify only 1 journal entry exists for this receipt
      const jeCount = await prisma.journalEntry.count({
        where: { sourceReference: createRes.body.receiptNumber },
      });
      expect(jeCount).toBe(1);
    });

    it('should handle two genuinely concurrent posting requests for the same receipt safely (exactly one succeeds)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-RACE-SAME-${Date.now()}`,
          receiptDate: '2026-06-20T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '15.0000',
              unitCost: '18.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      // Dispatch two simultaneous post requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${receiptId}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`),
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${receiptId}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must be 200, the other 409
      expect(statuses).toEqual([200, 409]);

      // Verify in DB that only 1 movement and 1 journal entry were committed
      const movements = await prisma.stockMovement.findMany({ where: { receiptId } });
      expect(movements.length).toBe(1);

      const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
      expect(receipt.status).toBe(ReceiptStatus.POSTED);
    });

    it('should handle concurrent posting of two different receipts affecting the same SKU without lost updates', async () => {
      // Receipt A
      const createA = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-CONCUR-A-${Date.now()}`,
          receiptDate: '2026-06-21T10:00:00Z',
          lines: [
            {
              itemId: item2Id,
              quantityReceived: '10.0000',
              unitCost: '20.0000',
            },
          ],
        })
        .expect(201);

      // Receipt B
      const createB = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-CONCUR-B-${Date.now()}`,
          receiptDate: '2026-06-21T10:00:00Z',
          lines: [
            {
              itemId: item2Id,
              quantityReceived: '20.0000',
              unitCost: '35.0000',
            },
          ],
        })
        .expect(201);

      // Snapshot balance before
      const balanceBefore = await prisma.stockBalance.findUnique({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item2Id,
          },
        },
      });
      const qtyBefore = balanceBefore?.quantityOnHand || new Prisma.Decimal(0);
      const valBefore = balanceBefore?.totalValue || new Prisma.Decimal(0);

      // Post both concurrently
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${createA.body.id}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`),
        request(app.getHttpServer())
          .post(`/api/v1/receipts/${createB.body.id}/post`)
          .set('Authorization', `Bearer ${c1AdminToken}`),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Verify no lost updates: Final stock = before + 10 + 20 = before + 30
      // Final value = before + (10*20) + (20*35) = before + 200 + 700 = before + 900
      const balanceAfter = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item2Id,
          },
        },
      });

      const expectedQty = qtyBefore.add(new Prisma.Decimal('30.0000'));
      const expectedVal = valBefore.add(new Prisma.Decimal('900.0000'));
      expect(balanceAfter.quantityOnHand.toFixed(4)).toBe(expectedQty.toFixed(4));
      expect(balanceAfter.totalValue.toFixed(4)).toBe(expectedVal.toFixed(4));
    });
  });

  describe('4. Safe Void Workflow', () => {
    it('should successfully void a posted receipt when stock is intact', async () => {
      // 1. Create and post a receipt
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-VOID-SAFE-${Date.now()}`,
          receiptDate: '2026-06-22T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '14.0000',
              unitCost: '50.0000', // 14 * 50 = 700
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      // 2. Void the receipt
      const voidRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ reason: 'Defective goods arrived from vendor' })
        .expect(200);

      expect(voidRes.body.message).toContain('successfully voided and reversed');
      expect(voidRes.body.reversingJournalEntryId).toBeDefined();
      expect(voidRes.body.movementsReversed).toBe(1);

      // 3. Verify receipt in DB
      const receiptInDb = await prisma.receipt.findUniqueOrThrow({
        where: { id: receiptId },
        include: { journalEntry: true },
      });
      expect(receiptInDb.status).toBe(ReceiptStatus.VOIDED);
      expect(receiptInDb.voidedAt).toBeDefined();
      expect(receiptInDb.voidReason).toBe('Defective goods arrived from vendor');

      // 4. Verify original journal entry is now VOIDED
      expect(receiptInDb.journalEntry!.status).toBe('VOIDED');

      // 5. Verify reversing journal entry exists and is POSTED
      const reversingJe = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: voidRes.body.reversingJournalEntryId },
        include: { lines: true },
      });
      expect(reversingJe.status).toBe('POSTED');
      expect(reversingJe.sourceReference).toBe(`VOID-${receiptInDb.receiptNumber}`);
      expect(new Prisma.Decimal(reversingJe.totalDebit).toFixed(4)).toBe('700.0000');
      expect(new Prisma.Decimal(reversingJe.totalCredit).toFixed(4)).toBe('700.0000');

      // Reversing lines: Debit GRN Clearing (700), Credit Item Asset (700)
      const debitClearing = reversingJe.lines.find((l) => new Prisma.Decimal(l.debit).gt(0))!;
      const creditAsset = reversingJe.lines.find((l) => new Prisma.Decimal(l.credit).gt(0))!;
      expect(new Prisma.Decimal(debitClearing.debit).toFixed(4)).toBe('700.0000');
      expect(new Prisma.Decimal(creditAsset.credit).toFixed(4)).toBe('700.0000');

      // 6. Verify compensating stock movement exists
      const reversalMovement = await prisma.stockMovement.findFirst({
        where: {
          receiptId,
          referenceType: 'STOCK_MOVEMENT_REVERSAL',
        },
      });
      expect(reversalMovement).toBeDefined();
      expect(new Prisma.Decimal(reversalMovement!.quantity).toFixed(4)).toBe('14.0000');
    });

    it('should reject voiding a receipt if subsequent issues make on-hand stock insufficient (409 Conflict)', async () => {
      // 1. Create and post receipt with 10 units
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-VOID-DEPLETED-${Date.now()}`,
          receiptDate: '2026-06-23T10:00:00Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '10.0000',
              unitCost: '30.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      // 2. Issue stock out so on-hand stock drops below 10 (simulate sales / consumption)
      const balanceBefore = await prisma.stockBalance.findUniqueOrThrow({
        where: {
          companyId_warehouseId_itemId: {
            companyId: company1Id,
            warehouseId: warehouse1Id,
            itemId: item1Id,
          },
        },
      });

      // Reduce stock so on-hand is only 3
      const reduceQty = balanceBefore.quantityOnHand.minus(new Prisma.Decimal('3.0000'));
      if (reduceQty.gt(0)) {
        await prisma.stockBalance.update({
          where: { id: balanceBefore.id },
          data: {
            quantityOnHand: new Prisma.Decimal('3.0000'),
            totalValue: new Prisma.Decimal('90.0000'),
          },
        });
      }

      // 3. Attempt void -> Must be rejected with 409 Conflict because 3 < 10
      const voidRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ reason: 'Attempting invalid void' })
        .expect(409);

      expect(voidRes.body.message).toContain('Insufficient on-hand stock');
      expect(voidRes.body.message).toContain('Goods have already been issued or consumed');

      // Verify receipt is still POSTED, NOT voided
      const receiptInDb = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
      expect(receiptInDb.status).toBe(ReceiptStatus.POSTED);
      expect(receiptInDb.voidedAt).toBeNull();
    });

    it('should reject attempting to void a DRAFT receipt (400 Bad Request)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-VOID-DRAFT-${Date.now()}`,
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '5.0000',
              unitCost: '10.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      const voidRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(400);

      expect(voidRes.body.message).toContain('because it is in DRAFT status');
    });

    it('should reject repeating a void on an already VOIDED receipt (409 Conflict)', async () => {
      // Create, post, and void a receipt
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-REPEAT-VOID-${Date.now()}`,
          receiptDate: '2026-06-24T10:00:00Z',
          lines: [
            {
              itemId: item2Id,
              quantityReceived: '2.0000',
              unitCost: '20.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = createRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      // Repeat void call -> 409 Conflict
      const secondVoidRes = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(409);

      expect(secondVoidRes.body.message).toContain('already been voided/cancelled');
    });
  });
});
