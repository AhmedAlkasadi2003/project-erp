import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { AccountNormalBalance, AccountType, PeriodStatus, Prisma } from '@prisma/client';

describe('Accounting Foundation, Chart of Accounts & Periods (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let c1AdminToken: string;
  let c1AccountantToken: string;
  let c1ClerkToken: string;
  let c2AdminToken: string;

  let company1Id: string;
  let company2Id: string;

  let account1200Id: string;
  let account2100Id: string;
  let account1000Id: string;

  let period1Id: string;

  let initialBalances: {
    itemId: string;
    warehouseId: string;
    quantityOnHand: Prisma.Decimal;
    totalValue: Prisma.Decimal;
  }[];
  let initialMovementCount: number;

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
    const c1AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-01',
      email: 'admin@acme-erp.local',
      password: 'Admin123!@#',
    });
    c1AdminToken = c1AdminLogin.body.accessToken;
    company1Id = c1AdminLogin.body.user.companyId;

    // 2. Authenticate Company 1 Accountant
    const c1AccLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-01',
      email: 'accountant@acme-erp.local',
      password: 'Accountant123!@#',
    });
    c1AccountantToken = c1AccLogin.body.accessToken;

    // 3. Authenticate Company 1 Clerk
    const c1ClerkLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-01',
      email: 'clerk@acme-erp.local',
      password: 'Clerk123!@#',
    });
    c1ClerkToken = c1ClerkLogin.body.accessToken;

    // 4. Authenticate Company 2 Admin
    const c2AdminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      companyCode: 'COMP-02',
      email: 'admin@beta-corp.local',
      password: 'BetaAdmin123!@#',
    });
    c2AdminToken = c2AdminLogin.body.accessToken;
    company2Id = c2AdminLogin.body.user.companyId;

    // 5. Query Seeded Accounts & Period for Company 1
    const acc1200 = await prisma.account.findUniqueOrThrow({
      where: { companyId_code: { companyId: company1Id, code: '1200' } },
    });
    account1200Id = acc1200.id;

    const acc2100 = await prisma.account.findUniqueOrThrow({
      where: { companyId_code: { companyId: company1Id, code: '2100' } },
    });
    account2100Id = acc2100.id;

    const acc1000 = await prisma.account.findUniqueOrThrow({
      where: { companyId_code: { companyId: company1Id, code: '1000' } },
    });
    account1000Id = acc1000.id;

    const currentYear = new Date().getFullYear();
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const period = await prisma.accountingPeriod.findUniqueOrThrow({
      where: {
        companyId_name: { companyId: company1Id, name: `FY${currentYear}-M${currentMonth}` },
      },
    });
    period1Id = period.id;

    // Clean up test entities from previous runs for idempotent execution
    await cleanupTestData();

    // Record baseline inventory state before executing Phase 06 tests
    initialBalances = await prisma.stockBalance.findMany({
      where: { companyId: company1Id },
      select: { itemId: true, warehouseId: true, quantityOnHand: true, totalValue: true },
    });
    initialMovementCount = await prisma.stockMovement.count({
      where: { companyId: company1Id },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    await prisma.receipt.updateMany({
      where: {
        journalEntry: {
          OR: [
            { sourceReference: 'REC-2026-TEST' },
            { description: 'Goods receipt standard accrual journal' },
          ],
        },
      },
      data: {
        journalEntryId: null,
      },
    });
    await prisma.journalLine.deleteMany({
      where: {
        OR: [
          { journalEntry: { sourceReference: 'REC-2026-TEST' } },
          { journalEntry: { description: 'Goods receipt standard accrual journal' } },
        ],
      },
    });
    await prisma.journalEntry.deleteMany({
      where: {
        OR: [
          { sourceReference: 'REC-2026-TEST' },
          { description: 'Goods receipt standard accrual journal' },
        ],
      },
    });
    await prisma.account.deleteMany({
      where: { code: { in: ['1210', '1220', '9999'] } },
    });
    await prisma.accountingPeriod.deleteMany({
      where: { name: { startsWith: 'FY2027' } },
    });
  }

  // ============================================================================
  // 1. Chart of Accounts Management & Hierarchy
  // ============================================================================
  describe('1. Chart of Accounts Endpoints', () => {
    let createdAccId: string;

    it('should create an account as Accountant with parent hierarchy', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          code: '1210',
          name: 'Inventory - Packaging Materials',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          description: 'Sub-inventory for packaging',
          parentId: account1000Id,
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('1210');
      expect(res.body.parent.id).toBe(account1000Id);
      createdAccId = res.body.id;
    });

    it('should reject creating duplicate account code within same company (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          code: '1210',
          name: 'Duplicate packaging account',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists for this company');
    });

    it('should allow identical account code in separate company (Company 2)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .send({
          code: '1210',
          name: 'Beta Corp Packaging',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('1210');
      expect(res.body.companyId).toBe(company2Id);
    });

    it('should reject parent account belonging to another company (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${c2AdminToken}`)
        .send({
          code: '1220',
          name: 'Beta Corp Sub',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          parentId: account1000Id, // Account 1000 belongs to Company 1!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Parent account not found in this company');
    });

    it('should reject self-parenting on update (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/accounts/${createdAccId}`)
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          parentId: createdAccId, // Target is self!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('An account cannot be its own parent');
    });

    it('should reject unauthorized user (CLERK) creating accounts (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${c1ClerkToken}`)
        .send({
          code: '9999',
          name: 'Unauthorized Account',
          type: AccountType.EXPENSE,
          normalBalance: AccountNormalBalance.DEBIT,
        });

      expect(res.status).toBe(403);
    });

    it('should list accounts with pagination and filtering', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounts?type=ASSET&page=1&limit=10')
        .set('Authorization', `Bearer ${c1ClerkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.totalItems).toBeGreaterThanOrEqual(2);
    });

    it('should reject deleting an account referenced by item master (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounts/${account1200Id}`)
        .set('Authorization', `Bearer ${c1AdminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Cannot delete account referenced by');
    });

    it('should reject deleting an account that has child accounts (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounts/${account1000Id}`)
        .set('Authorization', `Bearer ${c1AdminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('has child accounts');
    });

    it('should delete a clean, unreferenced account', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/accounts/${createdAccId}`)
        .set('Authorization', `Bearer ${c1AdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deletedAccountId).toBe(createdAccId);
    });
  });

  // ============================================================================
  // 2. Accounting Periods Management & Inclusive Boundaries
  // ============================================================================
  describe('2. Accounting Periods Endpoints', () => {
    let createdPeriodId: string;

    it('should create an accounting period as Accountant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          name: 'FY2027-M01',
          startDate: '2027-01-01T00:00:00.000Z',
          endDate: '2027-01-31T23:59:59.999Z',
          status: PeriodStatus.OPEN,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('FY2027-M01');
      expect(res.body.status).toBe(PeriodStatus.OPEN);
      createdPeriodId = res.body.id;
    });

    it('should reject period when startDate is after endDate (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          name: 'FY2027-M02-Invalid',
          startDate: '2027-02-28T00:00:00.000Z',
          endDate: '2027-02-01T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot be after endDate');
    });

    it('should reject overlapping period within the same company (409 Conflict)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          name: 'FY2027-M01-Overlap',
          startDate: '2027-01-15T00:00:00.000Z',
          endDate: '2027-02-15T00:00:00.000Z', // Overlaps with FY2027-M01!
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Period dates overlap with existing period');
    });

    it('should close an open period as Accountant', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting-periods/${createdPeriodId}/close`)
        .set('Authorization', `Bearer ${c1AccountantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(PeriodStatus.CLOSED);
    });

    it('should reject closing an already closed period (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting-periods/${createdPeriodId}/close`)
        .set('Authorization', `Bearer ${c1AccountantToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already closed');
    });

    it('should reject unauthorized user (CLERK) closing a period (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/accounting-periods/${period1Id}/close`)
        .set('Authorization', `Bearer ${c1ClerkToken}`);

      expect(res.status).toBe(403);
    });

    it('should deny Company 1 access to Company 2 period (404 Not Found / IDOR)', async () => {
      const c2Period = await prisma.accountingPeriod.findFirstOrThrow({
        where: { companyId: company2Id },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/accounting-periods/${c2Period.id}`)
        .set('Authorization', `Bearer ${c1AdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // 3. Inventory-Related Accounts Configuration
  // ============================================================================
  describe('3. Inventory Accounts Configuration Endpoints', () => {
    it('should retrieve configured GRN Clearing account for Company 1', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/accounting/inventory-accounts')
        .set('Authorization', `Bearer ${c1AdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.grnClearingAccountId).toBe(account2100Id);
      expect(res.body.grnClearingAccount.code).toBe('2100');
      expect(res.body.grnClearingAccount.type).toBe(AccountType.LIABILITY);
    });

    it('should reject updating GRN Clearing account to an ASSET account (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/accounting/inventory-accounts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          grnClearingAccountId: account1200Id, // Account 1200 is ASSET!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('must be of classification LIABILITY');
    });

    it('should reject updating GRN Clearing account to an account from another company (404 Not Found)', async () => {
      const c2Account = await prisma.account.findFirstOrThrow({
        where: { companyId: company2Id, code: '2100' },
      });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/accounting/inventory-accounts')
        .set('Authorization', `Bearer ${c1AdminToken}`)
        .send({
          grnClearingAccountId: c2Account.id,
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found in this company');
    });
  });

  // ============================================================================
  // 4. Journal Entry Validation & Double-Entry Balancing
  // ============================================================================
  describe('4. Journal Entry Validation Engine', () => {
    const today = new Date().toISOString();

    it('should validate a balanced journal preview without persisting to DB', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Inventory valuation accrual preview',
          lines: [
            { accountId: account1200Id, debit: '1250.5000', credit: '0.0000' },
            { accountId: account2100Id, debit: '0.0000', credit: '1250.5000' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.totalDebit).toBe('1250.5000');
      expect(res.body.totalCredit).toBe('1250.5000');
      expect(res.body.lineCount).toBe(2);

      // Verify no DB record was written
      const count = await prisma.journalEntry.count({
        where: { description: 'Inventory valuation accrual preview' },
      });
      expect(count).toBe(0);
    });

    it('should reject unbalanced journal entry (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Unbalanced journal',
          lines: [
            { accountId: account1200Id, debit: '100.0000', credit: '0.0000' },
            { accountId: account2100Id, debit: '0.0000', credit: '99.9999' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Journal entry is out of balance');
    });

    it('should reject journal with fewer than 2 lines (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Single leg journal',
          lines: [{ accountId: account1200Id, debit: '100.0000', credit: '0.0000' }],
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('at least 2 lines');
    });

    it('should reject line with both positive debit and credit amounts (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Dual leg line',
          lines: [
            { accountId: account1200Id, debit: '50.0000', credit: '50.0000' },
            { accountId: account2100Id, debit: '0.0000', credit: '100.0000' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot have both positive debit and credit amounts');
    });

    it('should reject line with zero debit and zero credit (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Zero leg line',
          lines: [
            { accountId: account1200Id, debit: '0.0000', credit: '0.0000' },
            { accountId: account2100Id, debit: '0.0000', credit: '0.0000' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('zero debit and zero credit');
    });

    it('should reject cross-company account reference (400 Bad Request)', async () => {
      const c2Account = await prisma.account.findFirstOrThrow({
        where: { companyId: company2Id, code: '2100' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Cross-company account test',
          lines: [
            { accountId: account1200Id, debit: '100.0000', credit: '0.0000' },
            { accountId: c2Account.id, debit: '0.0000', credit: '100.0000' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cross-company or invalid account IDs');
    });

    it('should reject journal with date falling outside open periods (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/validate')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: '2024-05-15T00:00:00.000Z', // Past year with no period!
          description: 'Historical date out of period',
          lines: [
            { accountId: account1200Id, debit: '100.0000', credit: '0.0000' },
            { accountId: account2100Id, debit: '0.0000', credit: '100.0000' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No active accounting period found');
    });
  });

  // ============================================================================
  // 5. Journal Drafts Persistence & Multi-Tenant IDOR Defense
  // ============================================================================
  describe('5. Journal Drafts Persistence & Retrieval', () => {
    let createdDraftId: string;
    const today = new Date().toISOString();

    it('should persist a balanced journal draft inside a database transaction', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/journal-entries/drafts')
        .set('Authorization', `Bearer ${c1AccountantToken}`)
        .send({
          entryDate: today,
          description: 'Goods receipt standard accrual journal',
          sourceReference: 'REC-2026-TEST',
          lines: [
            {
              accountId: account1200Id,
              debit: '500.0000',
              credit: '0.0000',
              description: 'Raw materials debit',
            },
            {
              accountId: account2100Id,
              debit: '0.0000',
              credit: '500.0000',
              description: 'GRN clearing credit',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.totalDebit).toBe('500');
      expect(res.body.totalCredit).toBe('500');
      expect(res.body.lines).toHaveLength(2);
      expect(res.body.lines[0].lineNumber).toBe(1);
      expect(res.body.lines[1].lineNumber).toBe(2);
      createdDraftId = res.body.id;
    });

    it('should retrieve journal draft by ID with account details and sequential lines', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/journal-entries/${createdDraftId}`)
        .set('Authorization', `Bearer ${c1AccountantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdDraftId);
      expect(res.body.lines[0].account.code).toBe('1200');
      expect(res.body.lines[1].account.code).toBe('2100');
    });

    it('should deny Company 2 user access to Company 1 journal draft (404 Not Found / IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/journal-entries/${createdDraftId}`)
        .set('Authorization', `Bearer ${c2AdminToken}`);

      expect(res.status).toBe(404);
    });

    it('should list journal entries with pagination and status filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/journal-entries?status=DRAFT&page=1&limit=10')
        .set('Authorization', `Bearer ${c1AccountantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeInstanceOf(Array);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.totalItems).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // 6. Strict Scope Boundary Verification
  // ============================================================================
  describe('6. Phase Boundaries & Zero Scope Leaks', () => {
    it('should confirm that creating accounts, periods, and drafts did NOT mutate StockBalance', async () => {
      const currentBalances = await prisma.stockBalance.findMany({
        where: { companyId: company1Id },
        select: { itemId: true, warehouseId: true, quantityOnHand: true, totalValue: true },
      });

      // Stock balances must remain identical to the pre-test baseline
      expect(currentBalances).toHaveLength(initialBalances.length);
      for (let i = 0; i < currentBalances.length; i++) {
        expect(currentBalances[i].quantityOnHand).toEqual(initialBalances[i].quantityOnHand);
        expect(currentBalances[i].totalValue).toEqual(initialBalances[i].totalValue);
      }
    });

    it('should confirm that zero StockMovements were created during Phase 06 operations', async () => {
      const currentMovementCount = await prisma.stockMovement.count({
        where: { companyId: company1Id },
      });

      expect(currentMovementCount).toBe(initialMovementCount);
    });
  });
});
