import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OutboxProcessor } from './outbox-processor';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('outbox')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutboxController {
  constructor(private readonly outboxProcessor: OutboxProcessor) {}

  @Get('metrics')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.ACCOUNTANT)
  async getMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.outboxProcessor.getMetrics(user.companyId);
  }

  @Post(':id/replay')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async replayEvent(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const replayed = await this.outboxProcessor.replayEvent(user.companyId, id);
    return {
      message: 'Outbox event queued for replay',
      event: replayed,
    };
  }
}
