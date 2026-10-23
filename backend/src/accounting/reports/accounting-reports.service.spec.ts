import { Test, TestingModule } from '@nestjs/testing';
import { AccountNormalBalance, AccountType, Prisma } from '@prisma/client';
import { AccountingReportsService } from './accounting-reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountingReportsService', () => {
  let service: AccountingReportsService;
  let prisma: PrismaService;

  const mockPrisma = {
    account: {
      findMany: jest.fn(),
    },
    journalLine: {
      findMany: jest.fn(),
    },
    stockBalance: {
      aggregate: jest.fn(),
    },
    item: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingReportsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AccountingReportsService>(AccountingReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should generate a balanced Trial Balance report', async () => {
    expect(prisma).toBeDefined();
    const companyId = 'comp-1';

    // Mock accounts
    (mockPrisma.account.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'acc-1',
        code: '1200',
        name: 'Inventory Asset',
        type: AccountType.ASSET,
        normalBalance: AccountNormalBalance.DEBIT,
      },
      {
        id: 'acc-2',
        code: '2100',
        name: 'GRN Clearing',
        type: AccountType.LIABILITY,
        normalBalance: AccountNormalBalance.CREDIT,
      },
    ]);

    // Mock journal lines from posted entries
    (mockPrisma.journalLine.findMany as jest.Mock).mockResolvedValue([
      { accountId: 'acc-1', debit: new Prisma.Decimal('500.0000'), credit: new Prisma.Decimal('0.0000') },
      { accountId: 'acc-2', debit: new Prisma.Decimal('0.0000'), credit: new Prisma.Decimal('500.0000') },
    ]);

    const result = await service.getTrialBalance(companyId, { asOfDate: '2026-12-31' });

    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe('500.0000');
    expect(result.totalCredit).toBe('500.0000');
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0].netDebit).toBe('500.0000');
    expect(result.accounts[1].netCredit).toBe('500.0000');
  });

  it('should reconcile inventory sub-ledger with general ledger', async () => {
    const companyId = 'comp-1';

    // Mock stock balance sum
    (mockPrisma.stockBalance.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalValue: new Prisma.Decimal('1250.0000') },
    });

    // Mock items linking to asset accounts
    (mockPrisma.item.findMany as jest.Mock).mockResolvedValue([
      { assetAccountId: 'acc-1' },
    ]);

    // Mock asset accounts
    (mockPrisma.account.findMany as jest.Mock).mockResolvedValue([
      { id: 'acc-1', code: '1200', name: 'Inventory Asset' },
    ]);

    // Mock posted journal lines
    (mockPrisma.journalLine.findMany as jest.Mock).mockResolvedValue([
      { accountId: 'acc-1', debit: new Prisma.Decimal('1250.0000'), credit: new Prisma.Decimal('0.0000') },
    ]);

    const result = await service.getInventoryGlReconciliation(companyId);

    expect(result.isReconciled).toBe(true);
    expect(result.subledgerTotalValue).toBe('1250.0000');
    expect(result.glInventoryAssetTotal).toBe('1250.0000');
    expect(result.delta).toBe('0.0000');
  });
});
