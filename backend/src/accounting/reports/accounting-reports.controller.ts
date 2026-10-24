import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountingReportsService } from './accounting-reports.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    companyId: string;
    role: UserRole;
  };
}

@ApiTags('Accounting')
@ApiBearerAuth('JWT-auth')
@Controller('accounting/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingReportsController {
  constructor(private readonly reportsService: AccountingReportsService) {}

  @Get('trial-balance')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN)
  async getTrialBalance(
    @Req() req: AuthenticatedRequest,
    @Query('asOfDate') asOfDate?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.reportsService.getTrialBalance(req.user.companyId, {
      asOfDate,
      periodId,
    });
  }

  @Get('gl-subledger-reconciliation')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN)
  async getGlSubledgerReconciliation(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getInventoryGlReconciliation(req.user.companyId);
  }
}
