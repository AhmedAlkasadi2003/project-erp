import { Module } from '@nestjs/common';
import { AccountsController } from './accounts/accounts.controller';
import { AccountsService } from './accounts/accounts.service';
import { AccountingPeriodsController } from './periods/accounting-periods.controller';
import { AccountingPeriodsService } from './periods/accounting-periods.service';
import { InventoryAccountsController } from './inventory-accounts/inventory-accounts.controller';
import { InventoryAccountsService } from './inventory-accounts/inventory-accounts.service';
import { JournalEntriesController } from './journal/journal-entries.controller';
import { JournalEntriesService } from './journal/journal-entries.service';
import { JournalValidatorService } from './journal/journal-validator.service';
import { AccountingReportsController } from './reports/accounting-reports.controller';
import { AccountingReportsService } from './reports/accounting-reports.service';

@Module({
  controllers: [
    AccountsController,
    AccountingPeriodsController,
    InventoryAccountsController,
    JournalEntriesController,
    AccountingReportsController,
  ],
  providers: [
    AccountsService,
    AccountingPeriodsService,
    InventoryAccountsService,
    JournalValidatorService,
    JournalEntriesService,
    AccountingReportsService,
  ],
  exports: [
    AccountsService,
    AccountingPeriodsService,
    InventoryAccountsService,
    JournalValidatorService,
    JournalEntriesService,
    AccountingReportsService,
  ],
})
export class AccountingModule {}
