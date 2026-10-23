import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { ReceiptLinesService } from './receipt-lines.service';
import { ReceiptPostingService } from './posting/receipt-posting.service';
import { ReceiptJournalBuilderService } from './posting/receipt-journal-builder.service';
import { ReceiptVoidWorkflowService } from './posting/receipt-void-workflow.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [PrismaModule, InventoryModule, AccountingModule, AuditModule, OutboxModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ReceiptLinesService,
    ReceiptPostingService,
    ReceiptJournalBuilderService,
    ReceiptVoidWorkflowService,
  ],
  exports: [
    ReceiptsService,
    ReceiptLinesService,
    ReceiptPostingService,
    ReceiptJournalBuilderService,
    ReceiptVoidWorkflowService,
  ],
})
export class ReceiptsModule {}
