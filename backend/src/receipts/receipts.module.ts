import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { ReceiptPostingService } from './posting/receipt-posting.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [PrismaModule, InventoryModule, AccountingModule, AuditModule, OutboxModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptPostingService],
  exports: [ReceiptsService, ReceiptPostingService],
})
export class ReceiptsModule {}
