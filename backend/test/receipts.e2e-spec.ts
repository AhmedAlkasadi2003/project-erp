import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ReceiptStatus } from '@prisma/client';

describe('Receipts API & Draft Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let company1Token: string;
  let company2Token: string;

  let comp1WarehouseId: string;
  let comp1SupplierId: string;
  let comp1ItemId1: string;
  let comp1ItemId2: string;

  let comp2WarehouseId: string;
  let comp2SupplierId: string;
  let comp2ItemId: string;

  let createdReceiptId: string;
  let comp2ReceiptId: string;

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

    // 3. Resolve Company 1 Masters
    const c1Wh = await prisma.warehouse.findFirst({
      where: { company: { code: 'COMP-01' } },
    });
    const c1Sup = await prisma.supplier.findFirst({
      where: { company: { code: 'COMP-01' } },
    });
    const c1Items = await prisma.item.findMany({
      where: { company: { code: 'COMP-01' } },
    });

    comp1WarehouseId = c1Wh!.id;
    comp1SupplierId = c1Sup!.id;
    comp1ItemId1 = c1Items[0].id;
    comp1ItemId2 = c1Items[1].id;

    // 4. Resolve Company 2 Masters
    const c2Wh = await prisma.warehouse.findFirst({
      where: { company: { code: 'COMP-02' } },
    });
    const c2Sup = await prisma.supplier.findFirst({
      where: { company: { code: 'COMP-02' } },
    });
    const c2Items = await prisma.item.findMany({
      where: { company: { code: 'COMP-02' } },
    });

    comp2WarehouseId = c2Wh!.id;
    comp2SupplierId = c2Sup!.id;
    comp2ItemId = c2Items[0].id;

    // 5. Seed a receipt in Company 2 for cross-tenant testing
    const c2Receipt = await request(app.getHttpServer())
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${company2Token}`)
      .send({
        warehouseId: comp2WarehouseId,
        supplierId: comp2SupplierId,
        receiptNumber: 'REC-COMP2-SEED',
        lines: [
          {
            itemId: comp2ItemId,
            quantityReceived: 10,
            unitCost: 25.0,
          },
        ],
      })
      .expect(201);
    comp2ReceiptId = c2Receipt.body.id;
  });

  afterAll(async () => {
    // Clean up test receipts created during e2e run
    await prisma.receiptLine.deleteMany({
      where: {
        receipt: {
          receiptNumber: { in: ['REC-E2E-001', 'REC-COMP2-SEED', 'REC-POSTED-TEST'] },
        },
      },
    });
    await prisma.receipt.deleteMany({
      where: {
        receiptNumber: { in: ['REC-E2E-001', 'REC-COMP2-SEED', 'REC-POSTED-TEST'] },
      },
    });

    await app.close();
  });

  describe('1. Receipt Draft Creation & Validation', () => {
    it('should successfully create a valid draft receipt with multiple lines and correct Decimal calculations', async () => {
      const payload = {
        warehouseId: comp1WarehouseId,
        supplierId: comp1SupplierId,
        receiptNumber: 'REC-E2E-001',
        notes: 'Initial delivery of raw steel sheets and bolts',
        lines: [
          {
            itemId: comp1ItemId1,
            quantityReceived: '12.3456',
            unitCost: '15.5000',
            taxAmount: '1.2500',
            notes: 'High grade steel',
          },
          {
            itemId: comp1ItemId2,
            quantityReceived: '50.0000',
            unitCost: '2.2500',
            taxAmount: '0.0000',
          },
          {
            itemId: comp1ItemId1,
            quantityReceived: '5.0000',
            unitCost: '0.0000', // zero cost warranty sample
            taxAmount: '0.0000',
            notes: 'Warranty sample item',
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send(payload)
        .expect(201);

      createdReceiptId = res.body.id;

      expect(res.body.id).toBeDefined();
      expect(res.body.receiptNumber).toBe('REC-E2E-001');
      expect(res.body.status).toBe(ReceiptStatus.DRAFT);
      expect(res.body.version).toBe(1);
      expect(res.body.warehouse.id).toBe(comp1WarehouseId);
      expect(res.body.supplier.id).toBe(comp1SupplierId);
      expect(res.body.lines).toHaveLength(3);

      // Verify line 1: 12.3456 * 15.5000 = 191.3568, tax 1.2500, total 192.6068
      const line1 = res.body.lines[0];
      expect(line1.lineNumber).toBe(1);
      expect(line1.quantityReceived).toBe('12.3456');
      expect(line1.unitCost).toBe('15.5');
      expect(line1.subtotal).toBe('191.3568');
      expect(line1.taxAmount).toBe('1.25');
      expect(line1.totalAmount).toBe('192.6068');

      // Verify line 2: 50 * 2.25 = 112.5000, tax 0, total 112.5000
      const line2 = res.body.lines[1];
      expect(line2.lineNumber).toBe(2);
      expect(line2.subtotal).toBe('112.5');
      expect(line2.totalAmount).toBe('112.5');

      // Verify line 3 (zero cost): 5 * 0 = 0.0000
      const line3 = res.body.lines[2];
      expect(line3.lineNumber).toBe(3);
      expect(line3.subtotal).toBe('0');
      expect(line3.totalAmount).toBe('0');

      // Verify header totals:
      // Subtotal = 191.3568 + 112.5000 + 0 = 303.8568
      // Tax = 1.2500
      // TotalAmount = 303.8568 + 1.2500 = 305.1068
      expect(res.body.subtotal).toBe('303.8568');
      expect(res.body.taxAmount).toBe('1.25');
      expect(res.body.totalAmount).toBe('305.1068');
      expect(res.headers['x-correlation-id']).toBeDefined();
    });

    it('should reject receipt creation when lines array is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          lines: [],
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('at least one line item')]),
      );
    });

    it('should reject receipt creation when quantity is zero or negative', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          lines: [
            {
              itemId: comp1ItemId1,
              quantityReceived: 0,
              unitCost: 10,
            },
          ],
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          lines: [
            {
              itemId: comp1ItemId1,
              quantityReceived: -5,
              unitCost: 10,
            },
          ],
        })
        .expect(400);
    });

    it('should reject receipt creation when unit cost is negative', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          lines: [
            {
              itemId: comp1ItemId1,
              quantityReceived: 5,
              unitCost: -1.5,
            },
          ],
        })
        .expect(400);
    });

    it('should reject receipt creation referencing cross-company warehouse', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp2WarehouseId, // Belongs to Company 2!
          supplierId: comp1SupplierId,
          lines: [
            {
              itemId: comp1ItemId1,
              quantityReceived: 5,
              unitCost: 10,
            },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('was not found or is inactive for this company');
    });

    it('should reject receipt creation referencing cross-company item', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          lines: [
            {
              itemId: comp2ItemId, // Belongs to Company 2!
              quantityReceived: 5,
              unitCost: 10,
            },
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('One or more items are invalid, inactive, or not found');
    });

    it('should reject client attempts to set status or companyId in body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/receipts')
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          status: 'POSTED', // Forbidden mass-assignment
          companyId: 'hacked-company',
          lines: [{ itemId: comp1ItemId1, quantityReceived: 1, unitCost: 1 }],
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('property status should not exist')]),
      );
    });
  });

  describe('2. Receipt Read & List Endpoints', () => {
    it('should retrieve a receipt by ID with complete lines and relations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.id).toBe(createdReceiptId);
      expect(res.body.receiptNumber).toBe('REC-E2E-001');
      expect(res.body.lines).toHaveLength(3);
      expect(res.body.lines[0].item.sku).toBeDefined();
    });

    it('should list receipts with pagination metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/receipts?page=1&limit=10')
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 10,
          totalItems: expect.any(Number),
          totalPages: expect.any(Number),
          hasNextPage: expect.any(Boolean),
          hasPreviousPage: expect.any(Boolean),
        }),
      );
      expect(res.body.data[0].lineCount).toBeDefined();
    });

    it('should filter receipts by status and search query', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/receipts?status=DRAFT&search=REC-E2E-001')
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].receiptNumber).toBe('REC-E2E-001');
    });
  });

  describe('3. Receipt Header & Line Mutation Endpoints', () => {
    it('should update draft receipt header fields', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          notes: 'Updated receiving instructions: dock bay 4',
        })
        .expect(200);

      expect(res.body.notes).toBe('Updated receiving instructions: dock bay 4');
      expect(res.body.version).toBe(2);
    });

    it('should add a single line to the draft receipt and recalculate totals', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/receipts/${createdReceiptId}/lines`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          itemId: comp1ItemId2,
          quantityReceived: 100,
          unitCost: 1.5,
          taxAmount: 0,
          notes: 'Additional bulk bolts',
        })
        .expect(201);

      expect(res.body.lines).toHaveLength(4);
      expect(res.body.lines[3].lineNumber).toBe(4);
      expect(res.body.lines[3].subtotal).toBe('150');
      expect(res.body.version).toBe(3);
    });

    it('should update a specific line in the draft receipt', async () => {
      const receipt = await request(app.getHttpServer())
        .get(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      const targetLine = receipt.body.lines[0];

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/receipts/${createdReceiptId}/lines/${targetLine.id}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          quantityReceived: 20,
          unitCost: 10,
        })
        .expect(200);

      const updatedLine = res.body.lines.find(
        (l: { id: string; quantityReceived: string; unitCost: string; subtotal: string }) =>
          l.id === targetLine.id,
      );
      expect(updatedLine.quantityReceived).toBe('20');
      expect(updatedLine.unitCost).toBe('10');
      expect(updatedLine.subtotal).toBe('200');
    });

    it('should remove a line from the draft and re-index remaining lines sequentially', async () => {
      const receipt = await request(app.getHttpServer())
        .get(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      const lineToRemove = receipt.body.lines[1]; // Remove 2nd line

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/receipts/${createdReceiptId}/lines/${lineToRemove.id}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.lines).toHaveLength(3);
      // Verify line numbers are sequential: 1, 2, 3
      expect(res.body.lines[0].lineNumber).toBe(1);
      expect(res.body.lines[1].lineNumber).toBe(2);
      expect(res.body.lines[2].lineNumber).toBe(3);
    });

    it('should atomically replace/reconcile all draft lines via PUT /:id/lines', async () => {
      const replacePayload = {
        lines: [
          {
            itemId: comp1ItemId1,
            quantityReceived: '10.0000',
            unitCost: '100.0000',
            taxAmount: '10.0000',
            notes: 'Replaced line 1',
          },
          {
            itemId: comp1ItemId2,
            quantityReceived: '20.0000',
            unitCost: '5.0000',
            taxAmount: '0.0000',
            notes: 'Replaced line 2',
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/api/v1/receipts/${createdReceiptId}/lines`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send(replacePayload)
        .expect(200);

      expect(res.body.lines).toHaveLength(2);
      // line 1: 10 * 100 = 1000, tax 10, total 1010
      // line 2: 20 * 5 = 100, tax 0, total 100
      // receipt: subtotal 1100, tax 10, total 1110
      expect(res.body.subtotal).toBe('1100');
      expect(res.body.taxAmount).toBe('10');
      expect(res.body.totalAmount).toBe('1110');
    });

    it('should reject deleting the only remaining line item on a draft', async () => {
      // Replace with exactly 1 line
      await request(app.getHttpServer())
        .put(`/api/v1/receipts/${createdReceiptId}/lines`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send({
          lines: [{ itemId: comp1ItemId1, quantityReceived: 1, unitCost: 10 }],
        })
        .expect(200);

      const receipt = await request(app.getHttpServer())
        .get(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      const singleLineId = receipt.body.lines[0].id;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/receipts/${createdReceiptId}/lines/${singleLineId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(400);

      expect(res.body.message).toContain('Cannot remove the only remaining line');
    });
  });

  describe('4. Deletion & Status Invariants', () => {
    it('should reject updating or deleting a receipt that is in POSTED status', async () => {
      // 1. Create a receipt and update its status directly to POSTED in DB
      const postedReceipt = await prisma.receipt.create({
        data: {
          companyId: (await prisma.company.findUnique({ where: { code: 'COMP-01' } }))!.id,
          warehouseId: comp1WarehouseId,
          supplierId: comp1SupplierId,
          receiptNumber: 'REC-POSTED-TEST',
          status: ReceiptStatus.POSTED,
          receivedByUserId: (await prisma.user.findFirst({
            where: { email: 'admin@acme-erp.local' },
          }))!.id,
          subtotal: 100,
          totalAmount: 100,
          lines: {
            create: [
              {
                itemId: comp1ItemId1,
                lineNumber: 1,
                quantityReceived: 10,
                unitCost: 10,
                subtotal: 100,
                totalAmount: 100,
              },
            ],
          },
        },
      });

      // Attempt PATCH on posted receipt
      await request(app.getHttpServer())
        .patch(`/api/v1/receipts/${postedReceipt.id}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send({ notes: 'Trying to update posted' })
        .expect(400);

      // Attempt DELETE on posted receipt
      await request(app.getHttpServer())
        .delete(`/api/v1/receipts/${postedReceipt.id}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(409);
    });

    it('should delete a valid draft receipt and cleanly cascade its lines', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify receipt is no longer found
      await request(app.getHttpServer())
        .get(`/api/v1/receipts/${createdReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(404);

      // Verify lines were cascaded
      const remainingLines = await prisma.receiptLine.findMany({
        where: { receiptId: createdReceiptId },
      });
      expect(remainingLines).toHaveLength(0);
    });
  });

  describe('5. Multi-Tenant Isolation & IDOR Defense', () => {
    it('should deny Company 1 user access to Company 2 receipt with 403 Forbidden', async () => {
      // Company 1 user attempting GET on Company 2 receipt
      await request(app.getHttpServer())
        .get(`/api/v1/receipts/${comp2ReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(403);

      // Company 1 user attempting PATCH on Company 2 receipt
      await request(app.getHttpServer())
        .patch(`/api/v1/receipts/${comp2ReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .send({ notes: 'Cross-tenant breach attempt' })
        .expect(403);

      // Company 1 user attempting DELETE on Company 2 receipt
      await request(app.getHttpServer())
        .delete(`/api/v1/receipts/${comp2ReceiptId}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(403);
    });

    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/api/v1/receipts').expect(401);
      await request(app.getHttpServer()).post('/api/v1/receipts').send({}).expect(401);
    });
  });
});
