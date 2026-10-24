import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StockBalanceService } from './stock-balance.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { QueryStockBalancesDto } from './dto/query-stock-balances.dto';
import { QueryStockMovementsDto } from './dto/query-stock-movements.dto';
import { QueryStockCardDto } from './dto/query-stock-card.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('Inventory')
@ApiBearerAuth('JWT-auth')
@Controller('inventory')
@UseGuards(JwtAuthGuard, CompanyAccessGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly stockBalanceService: StockBalanceService,
    private readonly inventoryLedgerService: InventoryLedgerService,
  ) {}

  /**
   * List current stock balances across warehouses with pagination and sorting.
   */
  @Get('balances')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async listBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryStockBalancesDto,
  ) {
    return this.stockBalanceService.listBalances(user.companyId, query);
  }

  /**
   * Retrieve stock balance for a specific item in a specific warehouse.
   */
  @Get('balances/:warehouseId/:itemId')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async getBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.stockBalanceService.getBalance(user.companyId, warehouseId, itemId);
  }

  /**
   * List historical stock movements (stock card ledger) with filtering and pagination.
   */
  @Get('movements')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryStockMovementsDto,
  ) {
    return this.inventoryLedgerService.getMovements(user.companyId, query);
  }

  /**
   * Read-only reconciliation report verifying stock balance against movement ledger aggregates.
   */
  @Get('reconcile/:warehouseId/:itemId')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN)
  async reconcileBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.stockBalanceService.reconcileBalance(user.companyId, warehouseId, itemId);
  }

  /**
   * GET /api/v1/inventory/items/:id/stock-card?from&to&warehouseId
   * Alias for item stock card under inventory namespace.
   */
  @Get('items/:id/stock-card')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async getItemStockCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Query() query: QueryStockCardDto,
  ) {
    return this.inventoryLedgerService.getStockCard(user.companyId, itemId, query);
  }
}
