import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReceiptStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiptLineDto } from './dto/create-receipt-line.dto';
import { UpdateReceiptLineDto } from './dto/update-receipt-line.dto';
import { ReplaceReceiptLinesDto } from './dto/replace-receipt-lines.dto';
import { DecimalMath } from './utils/decimal-math.util';

@Injectable()
export class ReceiptLinesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getReceipt(companyId: string, userRole: UserRole, id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, uom: true, valuationMethod: true },
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
   * Replace or reconcile all receipt lines atomically in a transaction.
   */
  async replaceReceiptLines(
    companyId: string,
    userRole: UserRole,
    receiptId: string,
    dto: ReplaceReceiptLinesDto,
  ) {
    const receipt = await this.getReceipt(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot modify lines for receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A receipt must contain at least one line item');
    }

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
      await tx.receiptLine.deleteMany({
        where: { receiptId },
      });

      for (const line of calculatedLines) {
        await tx.receiptLine.create({
          data: {
            id: line.id,
            receiptId,
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
              item: {
                select: { id: true, sku: true, name: true, uom: true, valuationMethod: true },
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
  async addReceiptLine(
    companyId: string,
    userRole: UserRole,
    receiptId: string,
    dto: CreateReceiptLineDto,
  ) {
    const receipt = await this.getReceipt(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot add lines to receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, companyId: receipt.companyId, isActive: true },
    });

    if (!item) {
      throw new BadRequestException(
        `Item '${dto.itemId}' is invalid, inactive, or not found in this company`,
      );
    }

    const calc = DecimalMath.calculateLine(dto.quantityReceived, dto.unitCost, dto.taxAmount ?? 0);
    const nextLineNumber = receipt.lines.length > 0 ? receipt.lines[receipt.lines.length - 1].lineNumber + 1 : 1;

    return this.prisma.$transaction(async (tx) => {
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

      const updatedLines = await tx.receiptLine.findMany({
        where: { receiptId },
        orderBy: { lineNumber: 'asc' },
      });

      const totals = DecimalMath.calculateReceiptTotals(
        updatedLines.map((l) => ({
          subtotal: l.subtotal,
          taxAmount: l.taxAmount,
          totalAmount: l.totalAmount,
        })),
      );

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
              item: { select: { id: true, sku: true, name: true, uom: true, valuationMethod: true } },
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
   * Update an existing line item in a draft receipt.
   */
  async updateReceiptLine(
    companyId: string,
    userRole: UserRole,
    receiptId: string,
    lineId: string,
    dto: UpdateReceiptLineDto,
  ) {
    const receipt = await this.getReceipt(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update line for receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
      );
    }

    const line = await this.prisma.receiptLine.findFirst({
      where: { id: lineId, receiptId },
    });

    if (!line) {
      throw new NotFoundException(
        `Receipt line with ID '${lineId}' was not found on receipt '${receiptId}'`,
      );
    }

    const calc = DecimalMath.calculateLine(
      dto.quantityReceived ?? line.quantityReceived,
      dto.unitCost ?? line.unitCost,
      dto.taxAmount !== undefined ? dto.taxAmount : line.taxAmount,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.receiptLine.update({
        where: { id: lineId },
        data: {
          quantityReceived: calc.quantityReceived,
          unitCost: calc.unitCost,
          subtotal: calc.subtotal,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
          notes: dto.notes !== undefined ? dto.notes?.trim() || null : line.notes,
        },
      });

      const updatedLines = await tx.receiptLine.findMany({
        where: { receiptId },
        orderBy: { lineNumber: 'asc' },
      });

      const totals = DecimalMath.calculateReceiptTotals(
        updatedLines.map((l) => ({
          subtotal: l.subtotal,
          taxAmount: l.taxAmount,
          totalAmount: l.totalAmount,
        })),
      );

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
              item: { select: { id: true, sku: true, name: true, uom: true, valuationMethod: true } },
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
   * Delete a single line from a draft receipt.
   * Business invariant: A receipt must have at least 1 line item.
   */
  async removeReceiptLine(
    companyId: string,
    userRole: UserRole,
    receiptId: string,
    lineId: string,
  ) {
    const receipt = await this.getReceipt(companyId, userRole, receiptId);

    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot delete line from receipt with status '${receipt.status}'. Only DRAFT receipts can be modified.`,
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
      await tx.receiptLine.delete({
        where: { id: lineId },
      });

      const remainingLines = await tx.receiptLine.findMany({
        where: { receiptId },
        orderBy: { lineNumber: 'asc' },
      });

      // Sequential re-indexing
      for (let i = 0; i < remainingLines.length; i++) {
        const expectedNumber = i + 1;
        if (remainingLines[i].lineNumber !== expectedNumber) {
          await tx.receiptLine.update({
            where: { id: remainingLines[i].id },
            data: { lineNumber: expectedNumber },
          });
          remainingLines[i].lineNumber = expectedNumber;
        }
      }

      const totals = DecimalMath.calculateReceiptTotals(
        remainingLines.map((l) => ({
          subtotal: l.subtotal,
          taxAmount: l.taxAmount,
          totalAmount: l.totalAmount,
        })),
      );

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
              item: { select: { id: true, sku: true, name: true, uom: true, valuationMethod: true } },
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
}
