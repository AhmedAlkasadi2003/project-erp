import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InventoryAccountsService } from './inventory-accounts.service';
import { UpdateInventoryAccountsConfigDto } from './dto/update-inventory-accounts-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('accounting/inventory-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryAccountsController {
  constructor(private readonly inventoryAccountsService: InventoryAccountsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.CLERK)
  async getInventoryAccountsConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.inventoryAccountsService.getInventoryAccountsConfig(user.companyId);
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  async updateInventoryAccountsConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInventoryAccountsConfigDto,
  ) {
    return this.inventoryAccountsService.updateInventoryAccountsConfig(user.companyId, dto);
  }
}
