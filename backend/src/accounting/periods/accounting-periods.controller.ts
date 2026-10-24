import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AccountingPeriodsService } from './accounting-periods.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { UpdateAccountingPeriodDto } from './dto/update-accounting-period.dto';
import { QueryAccountingPeriodsDto } from './dto/query-accounting-periods.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Accounting')
@ApiBearerAuth('JWT-auth')
@Controller('accounting-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingPeriodsController {
  constructor(private readonly periodsService: AccountingPeriodsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  async createPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountingPeriodDto,
  ) {
    return this.periodsService.createPeriod(user.companyId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.CLERK)
  async listPeriods(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAccountingPeriodsDto,
  ) {
    return this.periodsService.listPeriods(user.companyId, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.CLERK)
  async getPeriodById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.periodsService.getPeriodById(user.companyId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  async updatePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountingPeriodDto,
  ) {
    return this.periodsService.updatePeriod(user.companyId, id, dto);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  async closePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.periodsService.closePeriod(user.companyId, id);
  }
}
