import {
  AccountNormalBalance,
  AccountType,
  PeriodStatus,
  PrismaClient,
  UserRole,
  ValuationMethod,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting deterministic development seed...');

  // 1. Seed Tenant Company
  const company = await prisma.company.upsert({
    where: { code: 'COMP-01' },
    update: {},
    create: {
      code: 'COMP-01',
      name: 'Acme Industrial Systems Ltd',
      currency: 'USD',
      fiscalYearStart: 1,
      isActive: true,
    },
  });
  console.log(`✓ Company seeded: ${company.name} (${company.code})`);

  // 2. Seed Administrator User
  const adminUser = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: 'admin@acme-erp.local',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@acme-erp.local',
      name: 'System Administrator',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log(`✓ Administrator user seeded: ${adminUser.email}`);

  // 3. Seed Primary Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'WH-MAIN',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: 'WH-MAIN',
      name: 'Central Distribution Warehouse',
      address: 'Industrial District Plot 42, Sector B',
      isActive: true,
    },
  });
  console.log(`✓ Warehouse seeded: ${warehouse.name} (${warehouse.code})`);

  // 4. Seed Standard Supplier
  const supplier = await prisma.supplier.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'SUP-001',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: 'SUP-001',
      name: 'Apex Raw Materials Corp',
      taxId: 'US-TAX-8849201',
      contactEmail: 'orders@apexrawmaterials.com',
      paymentTerms: 'Net 30',
      isActive: true,
    },
  });
  console.log(`✓ Supplier seeded: ${supplier.name} (${supplier.code})`);

  // 5. Seed Core Chart of Accounts (COA)
  const accountsData = [
    {
      code: '1200',
      name: 'Inventory - Raw Materials',
      type: AccountType.ASSET,
      normalBalance: AccountNormalBalance.DEBIT,
      description:
        'Asset account tracking raw material inventory valuation at standard/average cost',
    },
    {
      code: '2000',
      name: 'Accounts Payable',
      type: AccountType.LIABILITY,
      normalBalance: AccountNormalBalance.CREDIT,
      description: 'Vendor liability for billed purchases',
    },
    {
      code: '2100',
      name: 'Inventory Received Not Invoiced (Accrual)',
      type: AccountType.LIABILITY,
      normalBalance: AccountNormalBalance.CREDIT,
      description: 'Clearing account for unbilled goods receipts (GR/IR accrual)',
    },
    {
      code: '5000',
      name: 'Cost of Goods Sold (COGS)',
      type: AccountType.EXPENSE,
      normalBalance: AccountNormalBalance.DEBIT,
      description: 'Expense recognized upon issuance/sale of inventory items',
    },
    {
      code: '5100',
      name: 'Inventory Adjustments / Variance',
      type: AccountType.EXPENSE,
      normalBalance: AccountNormalBalance.DEBIT,
      description: 'Reconciliation differences and stock shrinkage expense account',
    },
  ];

  const accounts: Record<string, string> = {};
  for (const acc of accountsData) {
    const createdAccount = await prisma.account.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: acc.code,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        description: acc.description,
        isActive: true,
      },
    });
    accounts[acc.code] = createdAccount.id;
  }
  console.log(`✓ Chart of accounts seeded: ${accountsData.length} accounts`);

  // 6. Seed Accounting Period (Current Active Month)
  const currentYear = new Date().getFullYear();
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const periodName = `FY${currentYear}-M${currentMonth}`;

  const startDate = new Date(currentYear, new Date().getMonth(), 1);
  const endDate = new Date(currentYear, new Date().getMonth() + 1, 0, 23, 59, 59);

  const period = await prisma.accountingPeriod.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: periodName,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: periodName,
      startDate,
      endDate,
      status: PeriodStatus.OPEN,
    },
  });
  console.log(`✓ Accounting period seeded: ${period.name} (Status: ${period.status})`);

  // 7. Seed Item Master (Inventory Items)
  const itemSteel = await prisma.item.upsert({
    where: {
      companyId_sku: {
        companyId: company.id,
        sku: 'SKU-STEEL-10',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      sku: 'SKU-STEEL-10',
      name: 'Cold-Rolled Steel Sheet 10mm',
      description: 'Heavy gauge steel sheet for industrial fabrication',
      uom: 'KG',
      valuationMethod: ValuationMethod.MOVING_AVERAGE,
      standardCost: 15.5,
      assetAccountId: accounts['1200'],
      cogsAccountId: accounts['5000'],
      expenseAccountId: accounts['5100'],
      isActive: true,
    },
  });

  const itemBolt = await prisma.item.upsert({
    where: {
      companyId_sku: {
        companyId: company.id,
        sku: 'SKU-BOLT-M12',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      sku: 'SKU-BOLT-M12',
      name: 'Industrial Hex Bolt M12x50',
      description: 'High tensile zinc-plated fastener',
      uom: 'PCS',
      valuationMethod: ValuationMethod.STANDARD_COST,
      standardCost: 2.25,
      assetAccountId: accounts['1200'],
      cogsAccountId: accounts['5000'],
      expenseAccountId: accounts['5100'],
      isActive: true,
    },
  });
  console.log(`✓ Items seeded: ${itemSteel.sku} (Moving Avg), ${itemBolt.sku} (Standard Cost)`);

  // 8. Seed Initial Zero Stock Balances
  for (const item of [itemSteel, itemBolt]) {
    await prisma.stockBalance.upsert({
      where: {
        companyId_warehouseId_itemId: {
          companyId: company.id,
          warehouseId: warehouse.id,
          itemId: item.id,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        warehouseId: warehouse.id,
        itemId: item.id,
        quantityOnHand: 0,
        totalValue: 0,
        averageCost: 0,
        version: 1,
      },
    });
  }
  console.log('✓ Initial zero stock balance records seeded for warehouse items');
  console.log('✅ Development database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error executing database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
