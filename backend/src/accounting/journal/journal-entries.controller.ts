import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JournalEntriesService } from './journal-entries.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { QueryJournalEntriesDto } from './dto/query-journal-entries.dto';
import { ValidateJournalDto } from './dto/validate-journal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Accounting')
@ApiBearerAuth('JWT-auth')
@Controller('journal-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalEntriesController {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  @Post('drafts')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  async createDraft(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJournalEntryDto) {
    return this.journalEntriesService.createDraft(user.companyId, user.id, dto);
  }

  @Post('validate')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.CLERK)
  @HttpCode(HttpStatus.OK)
  async validateDraft(@CurrentUser() user: AuthenticatedUser, @Body() dto: ValidateJournalDto) {
    return this.journalEntriesService.validateDraft(user.companyId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.CLERK)
  async listEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryJournalEntriesDto,
  ) {
    return this.journalEntriesService.listEntries(user.companyId, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.CLERK)
  async getEntryById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.journalEntriesService.getEntryById(user.companyId, id);
  }
}
