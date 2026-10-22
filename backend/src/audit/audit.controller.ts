import { Controller, Get, Param, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service';
import { QueryAuditEventsDto } from './dto/query-audit-events.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('audit-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryAuditEventsDto,
  ) {
    return this.auditService.queryEvents(user.companyId, query);
  }

  @Get(':id')
  async getAuditEventById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.auditService.getEventById(user.companyId, id);
  }
}
