import {
  AccountNormalBalance,
  AccountType,
  PeriodStatus,
  PrismaClient,
  UserRole,
  ValuationMethod,
} from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting deterministic development seed with authentication credentials...');

  // 1. Seed Tenant Company 1 (COMP-01)
  const company1 = await prisma.company.upsert({
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
  console.log(`✓ Company 1 seeded: ${company1.name} (${company1.code})`);

  // 2. Hash standard test passwords with Argon2id
  const adminPasswordHash = await hash('Admin123!@#');
  const clerkPasswordHash = await hash('Clerk123!@#');
  const accountantPasswordHash = await hash('Accountant123!@#');
  const superAdminPasswordHash = await hash('SuperAdmin123!@#');
  const betaAdminPasswordHash = await hash('BetaAdmin123!@#');

  // 3. Seed Users for Company 1
  const adminUser = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company1.id,
        email: 'admin@acme-erp.local',
      },
    },
    update: { passwordHash: adminPasswordHash },
    create: {
      companyId: company1.id,
      email: 'admin@acme-erp.local',
      name: 'System Administrator',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const clerkUser = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company1.id,
        email: 'clerk@acme-erp.local',
      },
    },
    update: { passwordHash: clerkPasswordHash },
    create: {
      companyId: company1.id,
      email: 'clerk@acme-erp.local',
      name: 'Receiving Clerk',
      passwordHash: clerkPasswordHash,
      role: UserRole.CLERK,
      isActive: true,
    },
  });

  const accountantUser = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company1.id,
        email: 'accountant@acme-erp.local',
      },
    },
    update: { passwordHash: accountantPasswordHash },
    create: {
      companyId: company1.id,
      email: 'accountant@acme-erp.local',
      name: 'Chief Accountant',
      passwordHash: accountantPasswordHash,
      role: UserRole.ACCOUNTANT,
      isActive: true,
    },
  });

  const superAdminUser = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company1.id,
        email: 'superadmin@acme-erp.local',
      },
    },
    update: { passwordHash: superAdminPasswordHash },
    create: {
      companyId: company1.id,
      email: 'superadmin@acme-erp.local',
      name: 'Platform Super Admin',
      passwordHash: superAdminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✓ Company 1 users seeded: Admin, Clerk, Accountant, SuperAdmin`);

  // 4. Seed Primary Warehouse for Company 1
  const warehouse1 = await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: company1.id,
        code: 'WH-MAIN',
      },
    },
    update: {},
    create: {
      companyId: company1.id,
      code: 'WH-MAIN',
      name: 'Central Distribution Warehouse',
      address: 'Industrial District Plot 42, Sector B',
      isActive: true,
    },
  });
  console.log(`✓ Warehouse seeded: ${warehouse1.name} (${warehouse1.code})`);

  // 5. Seed Standard Supplier for Company 1
  const supplier1 = await prisma.supplier.upsert({
    where: {
      companyId_code: {
        companyId: company1.id,
        code: 'SUP-001',
      },
    },
    update: {},
    create: {
      companyId: company1.id,
      code: 'SUP-001',
      name: 'Apex Raw Materials Corp',
      taxId: 'US-TAX-8849201',
      contactEmail: 'orders@apexrawmaterials.com',
      paymentTerms: 'Net 30',
      isActive: true,
    },
  });
  console.log(`✓ Supplier seeded: ${supplier1.name} (${supplier1.code})`);

  // 6. Seed Core Chart of Accounts for Company 1
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
          companyId: company1.id,
          code: acc.code,
        },
      },
      update: {},
      create: {
        companyId: company1.id,
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

  // 7. Seed Accounting Period for Company 1
  const currentYear = new Date().getFullYear();
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const periodName = `FY${currentYear}-M${currentMonth}`;
  const startDate = new Date(currentYear, new Date().getMonth(), 1);
  const endDate = new Date(currentYear, new Date().getMonth() + 1, 0, 23, 59, 59);

  const period = await prisma.accountingPeriod.upsert({
    where: {
      companyId_name: {
        companyId: company1.id,
        name: periodName,
      },
    },
    update: {},
    create: {
      companyId: company1.id,
      name: periodName,
      startDate,
      endDate,
      status: PeriodStatus.OPEN,
    },
  });
  console.log(`✓ Accounting period seeded: ${period.name} (Status: ${period.status})`);

  // 8. Seed Item Master for Company 1
  const itemSteel = await prisma.item.upsert({
    where: {
      companyId_sku: {
        companyId: company1.id,
        sku: 'SKU-STEEL-10',
      },
    },
    update: {},
    create: {
      companyId: company1.id,
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
        companyId: company1.id,
        sku: 'SKU-BOLT-M12',
      },
    },
    update: {},
    create: {
      companyId: company1.id,
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
  console.log(`✓ Items seeded: ${itemSteel.sku}, ${itemBolt.sku}`);

  // 9. Seed Initial Zero Stock Balances for Company 1
  for (const item of [itemSteel, itemBolt]) {
    await prisma.stockBalance.upsert({
      where: {
        companyId_warehouseId_itemId: {
          companyId: company1.id,
          warehouseId: warehouse1.id,
          itemId: item.id,
        },
      },
      update: {},
      create: {
        companyId: company1.id,
        warehouseId: warehouse1.id,
        itemId: item.id,
        quantityOnHand: 0,
        totalValue: 0,
        averageCost: 0,
        version: 1,
      },
    });
  }

  // 10. Seed Tenant Company 2 (COMP-02) for Cross-Tenant Multi-Tenancy Testing
  const company2 = await prisma.company.upsert({
    where: { code: 'COMP-02' },
    update: {},
    create: {
      code: 'COMP-02',
      name: 'Beta Manufacturing Corp',
      currency: 'USD',
      fiscalYearStart: 1,
      isActive: true,
    },
  });

  const betaAdminUser = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company2.id,
        email: 'admin@beta-corp.local',
      },
    },
    update: { passwordHash: betaAdminPasswordHash },
    create: {
      companyId: company2.id,
      email: 'admin@beta-corp.local',
      name: 'Beta Admin User',
      passwordHash: betaAdminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const warehouse2 = await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: company2.id,
        code: 'WH-BETA',
      },
    },
    update: {},
    create: {
      companyId: company2.id,
      code: 'WH-BETA',
      name: 'Beta North Facility',
      address: 'Route 101, Northern Industrial Zone',
      isActive: true,
    },
  });

  const supplier2 = await prisma.supplier.upsert({
    where: {
      companyId_code: {
        companyId: company2.id,
        code: 'SUP-BETA-01',
      },
    },
    update: {},
    create: {
      companyId: company2.id,
      code: 'SUP-BETA-01',
      name: 'Beta Global Components Inc',
      taxId: 'US-TAX-9988112',
      contactEmail: 'sales@betaglobal.com',
      paymentTerms: 'Net 60',
      isActive: true,
    },
  });

  const account2Asset = await prisma.account.upsert({
    where: {
      companyId_code: {
        companyId: company2.id,
        code: '1200',
      },
    },
    update: {},
    create: {
      companyId: company2.id,
      code: '1200',
      name: 'Inventory - Raw Materials',
      type: AccountType.ASSET,
      normalBalance: AccountNormalBalance.DEBIT,
      description: 'Asset account for Beta Corp inventory',
    },
  });

  const account2Cogs = await prisma.account.upsert({
    where: {
      companyId_code: {
        companyId: company2.id,
        code: '5000',
      },
    },
    update: {},
    create: {
      companyId: company2.id,
      code: '5000',
      name: 'Cost of Goods Sold (COGS)',
      type: AccountType.EXPENSE,
      normalBalance: AccountNormalBalance.DEBIT,
      description: 'COGS account for Beta Corp',
    },
  });

  const itemBeta = await prisma.item.upsert({
    where: {
      companyId_sku: {
        companyId: company2.id,
        sku: 'SKU-BETA-COMP',
      },
    },
    update: {},
    create: {
      companyId: company2.id,
      sku: 'SKU-BETA-COMP',
      name: 'Beta High-Precision Sensor',
      uom: 'PCS',
      valuationMethod: ValuationMethod.MOVING_AVERAGE,
      assetAccountId: account2Asset.id,
      cogsAccountId: account2Cogs.id,
      isActive: true,
    },
  });

  console.log(
    `✓ Company 2 seeded for multi-tenancy verification: ${company2.name} (${company2.code}) with warehouse ${warehouse2.code}, supplier ${supplier2.code}, and item ${itemBeta.sku}`,
  );

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
