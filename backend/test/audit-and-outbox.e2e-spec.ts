import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { OutboxStatus, PeriodStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { OutboxProcessor } from '../src/outbox/outbox-processor';
import { ReceiptPostedHandler } from '../src/outbox/handlers/receipt-events.handler';

describe('Audit Trail & Transactional Outbox (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outboxProcessor: OutboxProcessor;
  let receiptPostedHandler: ReceiptPostedHandler;

  let c1AdminToken: string;
  let c1ClerkToken: string;
  let c2AdminToken: string;

  let company1Id: string;
  let company2Id: string;

  let warehouse1Id: string;
  let supplier1Id: string;
  let item1Id: string;

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
    receiptPostedHandler = app.get<ReceiptPostedHandler>(ReceiptPostedHandler);

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

    // 3. Authenticate C2 Admin
    const c2AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-02',
      email: 'admin@beta-corp.local',
      password: 'BetaAdmin123!@#',
    });
    c2AdminToken = c2AdminLogin.body.accessToken;
    company2Id = c2AdminLogin.body.user.companyId;

    // 4. Resolve masters for C1
    const wh1 = await prisma.warehouse.findFirstOrThrow({
      where: { companyId: company1Id, isActive: true },
    });
    warehouse1Id = wh1.id;

    const supp1 = await prisma.supplier.findFirstOrThrow({
      where: { companyId: company1Id, isActive: true },
    });
    supplier1Id = supp1.id;

    const it1 = await prisma.item.findFirstOrThrow({
      where: { companyId: company1Id, isActive: true },
    });
    item1Id = it1.id;

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
        startDate: { lte: new Date('2026-07-01') },
        endDate: { gte: new Date('2026-07-01') },
      },
    });
    if (!openPeriod) {
      openPeriod = await prisma.accountingPeriod.create({
        data: {
          companyId: company1Id,
          name: 'FY2026-OUTBOX',
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

  describe('1. Audit Trail on Receipt Lifecycle', () => {
    it('should record an audit event with correlation ID on receipt posting', async () => {
      // Create draft receipt
      const receiptRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-AUDIT-${Date.now()}`,
          receiptDate: '2026-07-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '5.0000',
              unitCost: '20.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = receiptRes.body.id;
      const testCorrelationId = `corr-test-${Date.now()}`;

      // Post receipt with custom correlation ID header
      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .set('x-correlation-id', testCorrelationId)
        .send({ postingDate: '2026-07-01T00:00:00.000Z' })
        .expect(200);

      // Verify audit event persisted in database
      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          companyId: company1Id,
          entityId: receiptId,
          action: 'RECEIPT_POSTED',
        },
      });

      expect(auditEvent).toBeDefined();
      expect(auditEvent?.entityType).toBe('Receipt');
      expect(auditEvent?.correlationId).toBe(testCorrelationId);
      expect(auditEvent?.changes).toMatchObject({
        previousStatus: 'DRAFT',
        newStatus: 'POSTED',
      });
    });

    it('should record an audit event on receipt voiding', async () => {
      const receiptRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-VOID-AUDIT-${Date.now()}`,
          receiptDate: '2026-07-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '2.0000',
              unitCost: '15.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = receiptRes.body.id;

      // Post
      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ postingDate: '2026-07-01T00:00:00.000Z' })
        .expect(200);

      const voidCorrelationId = `corr-void-${Date.now()}`;

      // Void
      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .set('x-correlation-id', voidCorrelationId)
        .send({
          voidReason: 'Goods damaged during transport',
          voidDate: '2026-07-01T00:00:00.000Z',
        })
        .expect(200);

      // Verify audit event
      const voidAudit = await prisma.auditEvent.findFirst({
        where: {
          companyId: company1Id,
          entityId: receiptId,
          action: 'RECEIPT_VOIDED',
        },
      });

      expect(voidAudit).toBeDefined();
      expect(voidAudit?.correlationId).toBe(voidCorrelationId);
      expect(voidAudit?.changes).toMatchObject({
        previousStatus: 'POSTED',
        newStatus: 'VOIDED',
        voidReason: 'Goods damaged during transport',
      });
    });

    it('should enforce tenant isolation on audit queries (Company 2 cannot see Company 1 audit events)', async () => {
      const c2AuditRes = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .expect(200);

      expect(c2AuditRes.body.data).toBeDefined();
      // Ensure all returned events belong strictly to company 2
      for (const ev of c2AuditRes.body.data) {
        expect(ev.companyId).toBe(company2Id);
        expect(ev.companyId).not.toBe(company1Id);
      }
    });

    it('should reject audit queries from unauthorized users (CLERK role)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .expect(403);
    });
  });

  describe('2. Transactional Outbox Event Generation', () => {
    it('should create an outbox event in the same transaction when receipt is posted', async () => {
      const receiptRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-OUTBOX-${Date.now()}`,
          receiptDate: '2026-07-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '4.0000',
              unitCost: '25.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = receiptRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ postingDate: '2026-07-01T00:00:00.000Z' })
        .expect(200);

      // Verify outbox record created with status PENDING
      const outboxRecord = await prisma.outboxEvent.findFirst({
        where: {
          companyId: company1Id,
          aggregateId: receiptId,
          eventType: 'RECEIPT_POSTED',
        },
      });

      expect(outboxRecord).toBeDefined();
      expect(outboxRecord?.status).toBe(OutboxStatus.PENDING);
      expect(outboxRecord?.eventVersion).toBe(1);
      expect(outboxRecord?.payload).toMatchObject({
        receiptId,
        companyId: company1Id,
      });
    });

    it('should create an outbox event in the same transaction when receipt is voided', async () => {
      const receiptRes = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          warehouseId: warehouse1Id,
          supplierId: supplier1Id,
          receiptNumber: `REC-OUTBOX-VOID-${Date.now()}`,
          receiptDate: '2026-07-01T00:00:00.000Z',
          lines: [
            {
              itemId: item1Id,
              quantityReceived: '1.0000',
              unitCost: '30.0000',
            },
          ],
        })
        .expect(201);

      const receiptId = receiptRes.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/post`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({ postingDate: '2026-07-01T00:00:00.000Z' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/receipts/${receiptId}/void`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          voidReason: 'Supplier recall',
          voidDate: '2026-07-01T00:00:00.000Z',
        })
        .expect(200);

      const outboxVoid = await prisma.outboxEvent.findFirst({
        where: {
          companyId: company1Id,
          aggregateId: receiptId,
          eventType: 'RECEIPT_VOIDED',
        },
      });

      expect(outboxVoid).toBeDefined();
      expect(outboxVoid?.status).toBe(OutboxStatus.PENDING);
      expect(outboxVoid?.payload).toMatchObject({
        receiptId,
        voidReason: 'Supplier recall',
      });
    });
  });

  describe('3. Outbox Processor Execution & Resilience', () => {
    beforeEach(async () => {
      // Clean outbox events before each processor test for absolute queue determinism
      await prisma.outboxEvent.deleteMany({});
    });

    it('should process pending outbox events using SKIP LOCKED and mark them PROCESSED', async () => {
      // Insert a dedicated pending event
      const created = await prisma.outboxEvent.create({
        data: {
          companyId: company1Id,
          aggregateType: 'Receipt',
          aggregateId: `test-proc-${Date.now()}`,
          eventType: 'RECEIPT_POSTED',
          eventVersion: 1,
          payload: { testFact: 'verified' },
          status: OutboxStatus.PENDING,
        },
      });

      // Process batch
      const processedCount = await outboxProcessor.processPendingBatch(10);
      expect(processedCount).toBeGreaterThan(0);

      // Verify status in DB updated to PROCESSED
      const updated = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: created.id },
      });

      expect(updated.status).toBe(OutboxStatus.PROCESSED);
      expect(updated.processedAt).toBeDefined();
      expect(updated.lockedAt).toBeNull();
      expect(updated.lockedBy).toBeNull();
      expect(receiptPostedHandler.isProcessed(created.id)).toBe(true);
    });

    it('should recover stale leases when a worker crashes or abandons a PROCESSING event', async () => {
      // Simulate an abandoned event stuck in PROCESSING with old lockedAt
      const staleEvent = await prisma.outboxEvent.create({
        data: {
          companyId: company1Id,
          aggregateType: 'Receipt',
          aggregateId: `test-stale-${Date.now()}`,
          eventType: 'RECEIPT_POSTED',
          eventVersion: 1,
          payload: { mock: 'crash' },
          status: OutboxStatus.PROCESSING,
          lockedAt: new Date(Date.now() - 120000), // 2 minutes ago (stale)
          lockedBy: 'dead-worker-pid-999',
        },
      });

      // Run recovery
      const recoveredCount = await outboxProcessor.recoverStaleLeases(60000);
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      const recovered = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: staleEvent.id },
      });

      expect(recovered.status).toBe(OutboxStatus.PENDING);
      expect(recovered.lockedAt).toBeNull();
      expect(recovered.lockedBy).toBeNull();
    });

    it('should schedule retries with exponential backoff on transient failure', async () => {
      // Register temporary failing handler for a custom event type
      const failingType = `TRANSIENT_TEST_${Date.now()}`;
      outboxProcessor.registerHandler(failingType, {
        handle: async () => {
          throw new Error('Temporary gateway timeout 504');
        },
      });

      const event = await prisma.outboxEvent.create({
        data: {
          companyId: company1Id,
          aggregateType: 'TestAggregate',
          aggregateId: 'test-agg-1',
          eventType: failingType,
          payload: {},
          status: OutboxStatus.PENDING,
          retryCount: 0,
        },
      });

      await outboxProcessor.processPendingBatch(5);

      const afterAttempt = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: event.id },
      });

      expect(afterAttempt.status).toBe(OutboxStatus.PENDING);
      expect(afterAttempt.retryCount).toBe(1);
      expect(afterAttempt.nextRetryAt).toBeDefined();
      expect(afterAttempt.lastError).toContain('Temporary gateway timeout 504');
    });

    it('should mark event FAILED when maximum retry attempts are exceeded', async () => {
      const permanentType = `PERMANENT_TEST_${Date.now()}`;
      outboxProcessor.registerHandler(permanentType, {
        handle: async () => {
          throw new Error('Permanent deserialization failure');
        },
      });

      const event = await prisma.outboxEvent.create({
        data: {
          companyId: company1Id,
          aggregateType: 'TestAggregate',
          aggregateId: 'test-agg-2',
          eventType: permanentType,
          payload: {},
          status: OutboxStatus.PENDING,
          retryCount: 4, // 5th attempt will fail permanently
        },
      });

      await outboxProcessor.processPendingBatch(5);

      const afterMax = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: event.id },
      });

      expect(afterMax.status).toBe(OutboxStatus.FAILED);
      expect(afterMax.retryCount).toBe(5);
      expect(afterMax.lastError).toContain('Permanent deserialization failure');
    });
  });

  describe('4. Operational Outbox Metrics & Replay API', () => {
    it('should return company-scoped outbox metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/outbox/metrics')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('pendingCount');
      expect(res.body).toHaveProperty('processingCount');
      expect(res.body).toHaveProperty('processedCount');
      expect(res.body).toHaveProperty('failedCount');
    });

    it('should allow Admin to replay a FAILED event', async () => {
      // Create a failed event in Company 1
      const failed = await prisma.outboxEvent.create({
        data: {
          companyId: company1Id,
          aggregateType: 'Receipt',
          aggregateId: 'replay-test-1',
          eventType: 'RECEIPT_POSTED',
          payload: {},
          status: OutboxStatus.FAILED,
          retryCount: 5,
          lastError: 'Fatal broker connection error',
        },
      });

      const replayRes = await request(app.getHttpServer())
        .post(`/api/v1/outbox/${failed.id}/replay`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .expect(200);

      expect(replayRes.body.event.status).toBe(OutboxStatus.PENDING);
      expect(replayRes.body.event.retryCount).toBe(0);
      expect(replayRes.body.event.nextRetryAt).toBeNull();
      expect(replayRes.body.event.lastError).toBeNull();
    });

    it('should reject replay across company boundaries (tenant isolation)', async () => {
      // Create failed event in Company 1
      const failed = await prisma.outboxEvent.create({
        data: {
          companyId: company1Id,
          aggregateType: 'Receipt',
          aggregateId: 'replay-cross-test',
          eventType: 'RECEIPT_POSTED',
          payload: {},
          status: OutboxStatus.FAILED,
          retryCount: 5,
        },
      });

      // Attempt replay as Company 2 Admin
      await request(app.getHttpServer())
        .post(`/api/v1/outbox/${failed.id}/replay`)
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .expect(404);
    });
  });
});
