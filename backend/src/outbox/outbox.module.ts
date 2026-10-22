import { Module, OnModuleInit } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxProcessor } from './outbox-processor';
import { OutboxController } from './outbox.controller';
import { ReceiptPostedHandler, ReceiptVoidedHandler } from './handlers/receipt-events.handler';

@Module({
  controllers: [OutboxController],
  providers: [OutboxService, OutboxProcessor, ReceiptPostedHandler, ReceiptVoidedHandler],
  exports: [OutboxService, OutboxProcessor, ReceiptPostedHandler, ReceiptVoidedHandler],
})
export class OutboxModule implements OnModuleInit {
  constructor(
    private readonly processor: OutboxProcessor,
    private readonly receiptPostedHandler: ReceiptPostedHandler,
    private readonly receiptVoidedHandler: ReceiptVoidedHandler,
  ) {}

  onModuleInit() {
    this.processor.registerHandler('RECEIPT_POSTED', this.receiptPostedHandler);
    this.processor.registerHandler('RECEIPT_VOIDED', this.receiptVoidedHandler);
  }
}
