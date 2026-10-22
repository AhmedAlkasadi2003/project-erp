import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReceiptStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { CreateReceiptLineDto } from './dto/create-receipt-line.dto';
import { UpdateReceiptLineDto } from './dto/update-receipt-line.dto';
import { ReplaceReceiptLinesDto } from './dto/replace-receipt-lines.dto';
import { QueryReceiptsDto } from './dto/query-receipts.dto';
import { DecimalMath } from './utils/decimal-math.util';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new draft receipt with one or more lines in an atomic transaction.
   */
  async createReceipt(companyId: string, userId: string, dto: CreateReceiptDto) {
    // 1. Validate warehouse within authorized company
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, isActive: true },
    });
    if (!warehouse) {
      throw new BadRequestException(
        `Warehouse '${dto.warehouseId}' was not found or is inactive for this company`,
      );
    }

    // 2. Validate supplier within authorized company
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, companyId, isActive: true },
    });
    if (!supplier) {
      throw new BadRequestException(
        `Supplier '${dto.supplierId}' was not found or is inactive for this company`,
      );
    }

    // 3. Validate line items within authorized company
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A receipt must contain at least one line item');
    }

    const uniqueItemIds = [...new Set(dto.lines.map((l) => l.itemId))];
    const items = await this.prisma.item.findMany({
      where: {
        id: { in: uniqueItemIds },
        companyId,
        isActive: true,
      },
    });

    if (items.length !== uniqueItemIds.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missingIds = uniqueItemIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `One or more items are invalid, inactive, or not found in this company: ${missingIds.join(', ')}`,
      );
    }

    // 4. Determine receipt number
    let receiptNumber = dto.receiptNumber?.trim();
    if (receiptNumber) {
      const existing = await this.prisma.receipt.findFirst({
        where: { companyId, receiptNumber },
      });
      if (existing) {
        throw new ConflictException(
          `Receipt number '${receiptNumber}' already exists for this company`,
        );
      }
    } else {
      // Auto-generate a deterministic prefix with unique suffix
      const datePart = (dto.receiptDate ? new Date(dto.receiptDate) : new Date())
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      const count = await this.prisma.receipt.count({ where: { companyId } });
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      receiptNumber = `REC-${datePart}-${String(count + 1).padStart(4, '0')}-${randomSuffix}`;
    }

    // 5. Calculate line totals and header totals using exact Decimal arithmetic
    const calculatedLines = dto.lines.map((line, index) => {
      const calc = DecimalMath.calculateLine(
        line.quantityReceived,
        line.unitCost,
        line.taxAmount ?? 0,
      );
      return {
        itemId: line.itemId,
        lineNumber: index + 1,
        quantityReceived: calc.quantityReceived,
        unitCost: calc.unitCost,
        subtotal: calc.subtotal,
        taxAmount: calc.taxAmount,
        totalAmount: calc.totalAmount,
        notes: line.notes?.trim() || null,
      };
    });

    const totals = DecimalMath.calculateReceiptTotals(calculatedLines);

    // 6. Execute atomic creation in database transaction
    return this.prisma.$transaction(async (tx) => {
      return tx.receipt.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          receiptNumber: receiptNumber!,
          status: ReceiptStatus.DRAFT,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : new Date(),
          receivedByUserId: userId,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          notes: dto.notes?.trim() || null,
          version: 1,
          lines: {
            create: calculatedLines.map((l) => ({
              itemId: l.itemId,
              lineNumber: l.lineNumber,
              quantityReceived: l.quantityReceived,
              unitCost: l.unitCost,
              subtotal: l.subtotal,
              taxAmount: l.taxAmount,
              totalAmount: l.totalAmount,
              notes: l.notes,
            })),
          },
        },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, sku: true, name: true, uom: true },
              },
            },
            orderBy: { lineNumber: 'asc' },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          receivedByUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  /**
   * Retrieve a single receipt by ID with lines and related entity metadata.
   */
  async getReceiptById(companyId: string, userRole: UserRole, id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, uom: true },
            },
          },
          orderBy: { lineNumber: 'asc' },
        },
        warehouse: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        receivedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID '${id}' was not found`);
    }

    if (receipt.companyId !== companyId && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Cross-company access denied: you cannot access receipts belonging to another company',
      );
    }

    return receipt;
  }

  /**
   * List receipts with pagination, filtering, sorting, and summary projection.
   */
  async listReceipts(companyId: string, userRole: UserRole, query: QueryReceiptsDto) {
    const where: Prisma.ReceiptWhereInput = {
      companyId: userRole === UserRole.SUPER_ADMIN ? undefined : companyId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.startDate || query.endDate) {
      where.receiptDate = {};
      if (query.startDate) {
        where.receiptDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.receiptDate.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalItems = await this.prisma.receipt.count({ where });
    const page = query.page;
    const limit = query.limit;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const skip = (page - 1) * limit;

    const data = await this.prisma.receipt.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      select: {
        id: true,
        companyId: true,
        receiptNumber: true,
        status: true,
        receiptDate: true,
        postingDate: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        notes: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        warehouse: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        receivedByUser: { select: { id: true, name: true, email: true } },
        _count: { select: { lines: true } },
      },
    });

    return {
      data: data.map((item) => ({
        ...item,
        lineCount: item._count.lines,
      })),
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Update header fields of a draft receipt.
   */
  async updateReceipt(companyId: string, userRole: UserRole, id: string, dto: UpdateReceiptDto) {
    const receipt = await this.getReceiptById(companyId, userRole, id);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    // Validate warehouse if provided
    if (dto.warehouseId && dto.warehouseId !== receipt.warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, companyId: receipt.companyId, isActive: true },
      });
      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse '${dto.warehouseId}' was not found or is inactive for this company`,
        );
      }
    }

    // Validate supplier if provided
    if (dto.supplierId && dto.supplierId !== receipt.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, companyId: receipt.companyId, isActive: true },
      });
      if (!supplier) {
        throw new BadRequestException(
          `Supplier '${dto.supplierId}' was not found or is inactive for this company`,
        );
      }
    }

    // Validate receiptNumber uniqueness if changed
    if (dto.receiptNumber && dto.receiptNumber !== receipt.receiptNumber) {
      const existing = await this.prisma.receipt.findFirst({
        where: {
          companyId: receipt.companyId,
          receiptNumber: dto.receiptNumber,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Receipt number '${dto.receiptNumber}' already exists for this company`,
        );
      }
    }

    return this.prisma.receipt.update({
      where: { id },
      data: {
        warehouseId: dto.warehouseId,
        supplierId: dto.supplierId,
        receiptNumber: dto.receiptNumber?.trim(),
        receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
        version: { increment: 1 },
      },
      include: {
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, uom: true },
            },
          },
          orderBy: { lineNumber: 'asc' },
        },
        warehouse: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        receivedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Replace or reconcile all receipt lines atomically in a transaction.
   */
  async replaceReceiptLines(
    companyId: string,
    userRole: UserRole,
    id: string,
    dto: ReplaceReceiptLinesDto,
  ) {
    const receipt = await this.getReceiptById(companyId, userRole, id);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot modify lines for receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A receipt must contain at least one line item');
    }

    // Validate all items in batch
    const uniqueItemIds = [...new Set(dto.lines.map((l) => l.itemId))];
    const items = await this.prisma.item.findMany({
      where: {
        id: { in: uniqueItemIds },
        companyId: receipt.companyId,
        isActive: true,
      },
    });

    if (items.length !== uniqueItemIds.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missingIds = uniqueItemIds.filter((itemId) => !foundIds.has(itemId));
      throw new BadRequestException(
        `One or more items are invalid, inactive, or not found in this company: ${missingIds.join(', ')}`,
      );
    }

    // Calculate line and header totals
    const calculatedLines = dto.lines.map((line, index) => {
      const calc = DecimalMath.calculateLine(
        line.quantityReceived,
        line.unitCost,
        line.taxAmount ?? 0,
      );
      return {
        id: line.id,
        itemId: line.itemId,
        lineNumber: index + 1,
        quantityReceived: calc.quantityReceived,
        unitCost: calc.unitCost,
        subtotal: calc.subtotal,
        taxAmount: calc.taxAmount,
        totalAmount: calc.totalAmount,
        notes: line.notes?.trim() || null,
      };
    });

    const totals = DecimalMath.calculateReceiptTotals(calculatedLines);

    return this.prisma.$transaction(async (tx) => {
      // Delete existing lines
      await tx.receiptLine.deleteMany({
        where: { receiptId: id },
      });

      // Insert new lines
      for (const line of calculatedLines) {
        await tx.receiptLine.create({
          data: {
            id: line.id,
            receiptId: id,
            itemId: line.itemId,
            lineNumber: line.lineNumber,
            quantityReceived: line.quantityReceived,
            unitCost: line.unitCost,
            subtotal: line.subtotal,
            taxAmount: line.taxAmount,
            totalAmount: line.totalAmount,
            notes: line.notes,
          },
        });
      }

      // Update header totals and bump version
      return tx.receipt.update({
        where: { id },
        data: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          version: { increment: 1 },
        },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, sku: true, name: true, uom: true },
              },
            },
            orderBy: { lineNumber: 'asc' },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          receivedByUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  /**
   * Add a single line item to an existing draft receipt.
   */
  async addLine(
    companyId: string,
    userRole: UserRole,
    receiptId: string,
    dto: CreateReceiptLineDto,
  ) {
    const receipt = await this.getReceiptById(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot add line to receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, companyId: receipt.companyId, isActive: true },
    });
    if (!item) {
      throw new BadRequestException(
        `Item '${dto.itemId}' was not found or is inactive for this company`,
      );
    }

    const calc = DecimalMath.calculateLine(dto.quantityReceived, dto.unitCost, dto.taxAmount ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const maxLine = await tx.receiptLine.findFirst({
        where: { receiptId },
        orderBy: { lineNumber: 'desc' },
      });
      const nextLineNumber = (maxLine?.lineNumber ?? 0) + 1;

      await tx.receiptLine.create({
        data: {
          receiptId,
          itemId: dto.itemId,
          lineNumber: nextLineNumber,
          quantityReceived: calc.quantityReceived,
          unitCost: calc.unitCost,
          subtotal: calc.subtotal,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
          notes: dto.notes?.trim() || null,
        },
      });

      const allLines = await tx.receiptLine.findMany({ where: { receiptId } });
      const totals = DecimalMath.calculateReceiptTotals(allLines);

      return tx.receipt.update({
        where: { id: receiptId },
        data: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          version: { increment: 1 },
        },
        include: {
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true, uom: true } },
            },
            orderBy: { lineNumber: 'asc' },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          receivedByUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  /**
   * Update a single line item within a draft receipt.
   */
  async updateLine(
    companyId: string,
    userRole: UserRole,
    receiptId: string,
    lineId: string,
    dto: UpdateReceiptLineDto,
  ) {
    const receipt = await this.getReceiptById(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update line on receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    const existingLine = await this.prisma.receiptLine.findFirst({
      where: { id: lineId, receiptId },
    });
    if (!existingLine) {
      throw new NotFoundException(`Receipt line with ID '${lineId}' was not found on this receipt`);
    }

    const qty =
      dto.quantityReceived !== undefined ? dto.quantityReceived : existingLine.quantityReceived;
    const unitCost = dto.unitCost !== undefined ? dto.unitCost : existingLine.unitCost;
    const taxAmount = dto.taxAmount !== undefined ? dto.taxAmount : existingLine.taxAmount;

    const calc = DecimalMath.calculateLine(qty, unitCost, taxAmount);

    return this.prisma.$transaction(async (tx) => {
      await tx.receiptLine.update({
        where: { id: lineId },
        data: {
          quantityReceived: calc.quantityReceived,
          unitCost: calc.unitCost,
          subtotal: calc.subtotal,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined,
        },
      });

      const allLines = await tx.receiptLine.findMany({ where: { receiptId } });
      const totals = DecimalMath.calculateReceiptTotals(allLines);

      return tx.receipt.update({
        where: { id: receiptId },
        data: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          version: { increment: 1 },
        },
        include: {
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true, uom: true } },
            },
            orderBy: { lineNumber: 'asc' },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          receivedByUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  /**
   * Delete a single line from a draft receipt. Re-indexes line numbers sequentially.
   * Throws if attempting to delete the only remaining line.
   */
  async removeLine(companyId: string, userRole: UserRole, receiptId: string, lineId: string) {
    const receipt = await this.getReceiptById(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot remove line from receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    const allLines = await this.prisma.receiptLine.findMany({
      where: { receiptId },
      orderBy: { lineNumber: 'asc' },
    });

    const targetLineIndex = allLines.findIndex((l) => l.id === lineId);
    if (targetLineIndex === -1) {
      throw new NotFoundException(`Receipt line with ID '${lineId}' was not found on this receipt`);
    }

    if (allLines.length <= 1) {
      throw new BadRequestException(
        'Cannot remove the only remaining line; a receipt must contain at least one line item. Delete the entire draft receipt instead if you wish to remove it.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete target line
      await tx.receiptLine.delete({
        where: { id: lineId },
      });

      // Fetch remaining lines and re-index line numbers sequentially (1, 2, 3...)
      const remainingLines = await tx.receiptLine.findMany({
        where: { receiptId },
        orderBy: { lineNumber: 'asc' },
      });

      for (let i = 0; i < remainingLines.length; i++) {
        const line = remainingLines[i];
        const newNumber = i + 1;
        if (line.lineNumber !== newNumber) {
          await tx.receiptLine.update({
            where: { id: line.id },
            data: { lineNumber: newNumber },
          });
        }
      }

      // Recalculate totals
      const totals = DecimalMath.calculateReceiptTotals(remainingLines);

      return tx.receipt.update({
        where: { id: receiptId },
        data: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          version: { increment: 1 },
        },
        include: {
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true, uom: true } },
            },
            orderBy: { lineNumber: 'asc' },
          },
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          receivedByUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  /**
   * Delete a draft receipt.
   * Strictly enforces deletion policy: only DRAFT receipts can be deleted.
   */
  async deleteReceipt(companyId: string, userRole: UserRole, id: string) {
    const receipt = await this.getReceiptById(companyId, userRole, id);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new ConflictException(
        `Cannot delete receipt '${receipt.receiptNumber}' with status '${receipt.status}'. Only DRAFT receipts can be deleted.`,
      );
    }

    await this.prisma.receipt.delete({
      where: { id },
    });

    return {
      success: true,
      message: `Draft receipt '${receipt.receiptNumber}' was successfully deleted`,
    };
  }
}
