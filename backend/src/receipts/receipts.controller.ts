import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { ReceiptPostingService } from './posting/receipt-posting.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { CreateReceiptLineDto } from './dto/create-receipt-line.dto';
import { UpdateReceiptLineDto } from './dto/update-receipt-line.dto';
import { ReplaceReceiptLinesDto } from './dto/replace-receipt-lines.dto';
import { QueryReceiptsDto } from './dto/query-receipts.dto';
import { PostReceiptDto } from './dto/post-receipt.dto';
import { VoidReceiptDto } from './dto/void-receipt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('receipts')
@UseGuards(JwtAuthGuard, CompanyAccessGuard, RolesGuard)
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly receiptPostingService: ReceiptPostingService,
  ) {}

  /**
   * Create a new draft receipt with lines.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async createReceipt(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReceiptDto) {
    return this.receiptsService.createReceipt(user.companyId, user.id, dto);
  }

  /**
   * List receipts with pagination, filtering, and sorting.
   */
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async listReceipts(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryReceiptsDto) {
    return this.receiptsService.listReceipts(user.companyId, user.role, query);
  }

  /**
   * Retrieve a specific receipt by ID.
   */
  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async getReceiptById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptsService.getReceiptById(user.companyId, user.role, id);
  }

  /**
   * Update header fields of a draft receipt.
   */
  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async updateReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.receiptsService.updateReceipt(user.companyId, user.role, id, dto);
  }

  /**
   * Replace or reconcile draft lines atomically.
   */
  @Put(':id/lines')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async replaceReceiptLines(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceReceiptLinesDto,
  ) {
    return this.receiptsService.replaceReceiptLines(user.companyId, user.role, id, dto);
  }

  /**
   * Alias for PATCH :id/lines for flexible REST client compatibility.
   */
  @Patch(':id/lines')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async patchReceiptLines(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceReceiptLinesDto,
  ) {
    return this.receiptsService.replaceReceiptLines(user.companyId, user.role, id, dto);
  }

  /**
   * Add a single line to a draft receipt.
   */
  @Post(':id/lines')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async addLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReceiptLineDto,
  ) {
    return this.receiptsService.addLine(user.companyId, user.role, id, dto);
  }

  /**
   * Update a specific line in a draft receipt.
   */
  @Patch(':id/lines/:lineId')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async updateLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateReceiptLineDto,
  ) {
    return this.receiptsService.updateLine(user.companyId, user.role, id, lineId, dto);
  }

  /**
   * Remove a single line from a draft receipt.
   */
  @Delete(':id/lines/:lineId')
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async removeLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.receiptsService.removeLine(user.companyId, user.role, id, lineId);
  }

  /**
   * Delete a draft receipt.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async deleteReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptsService.deleteReceipt(user.companyId, user.role, id);
  }

  /**
   * Atomically post a draft receipt to inventory and General Ledger.
   */
  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.CLERK,
    UserRole.ACCOUNTANT,
    UserRole.SUPER_ADMIN,
  )
  async postReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: PostReceiptDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.receiptPostingService.postReceipt(
      user.companyId,
      user.id,
      id,
      dto,
      idempotencyKey,
      correlationId,
    );
  }

  /**
   * Safely void a posted receipt, reverting stock and General Ledger postings.
   */
  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN)
  async voidReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: VoidReceiptDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.receiptPostingService.voidReceipt(
      user.companyId,
      user.id,
      id,
      dto,
      idempotencyKey,
      correlationId,
    );
  }

  /**
   * REST Alias for cancel / void.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN)
  async cancelReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto?: VoidReceiptDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.receiptPostingService.voidReceipt(
      user.companyId,
      user.id,
      id,
      dto,
      idempotencyKey,
      correlationId,
    );
  }
}
