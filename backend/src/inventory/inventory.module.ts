import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CostingEngineService } from './costing/costing-engine.service';
import { StockBalanceService } from './stock-balance.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryController } from './inventory.controller';
import { ItemsController } from './items.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, ItemsController],
  providers: [CostingEngineService, StockBalanceService, InventoryLedgerService],
  exports: [CostingEngineService, StockBalanceService, InventoryLedgerService],
})
export class InventoryModule {}
