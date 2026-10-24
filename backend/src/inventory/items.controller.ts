import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InventoryLedgerService } from './inventory-ledger.service';
import { QueryStockCardDto } from './dto/query-stock-card.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('Inventory')
@ApiBearerAuth('JWT-auth')
@Controller('items')
@UseGuards(JwtAuthGuard, CompanyAccessGuard, RolesGuard)
export class ItemsController {
  constructor(private readonly inventoryLedgerService: InventoryLedgerService) {}

  /**
   * GET /api/v1/items/:id/stock-card?from&to&warehouseId
   * Returns item movement ledger card with chronological history, running quantity,
   * running weighted-average cost, opening balance, and closing balance.
   */
  @Get(':id/stock-card')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async getStockCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Query() query: QueryStockCardDto,
  ) {
    return this.inventoryLedgerService.getStockCard(user.companyId, itemId, query);
  }
}
