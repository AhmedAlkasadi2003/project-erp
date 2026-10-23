import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CostingEngineService } from './costing/costing-engine.service';
import { StockBalanceService } from './stock-balance.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { StockBalanceRepository } from './repositories/stock-balance.repository';
import { InventoryController } from './inventory.controller';
import { ItemsController } from './items.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, ItemsController],
  providers: [
    StockBalanceRepository,
    CostingEngineService,
    StockBalanceService,
    InventoryLedgerService,
  ],
  exports: [
    StockBalanceRepository,
    CostingEngineService,
    StockBalanceService,
    InventoryLedgerService,
  ],
})
export class InventoryModule {}
