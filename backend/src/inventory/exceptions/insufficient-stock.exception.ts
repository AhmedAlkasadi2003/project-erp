import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export class InsufficientStockException extends BadRequestException {
  constructor(
    itemId: string,
    warehouseId: string,
    requestedQty: Prisma.Decimal | number | string,
    availableQty: Prisma.Decimal | number | string,
  ) {
    super(
      `Insufficient stock for item '${itemId}' in warehouse '${warehouseId}'. Requested: ${requestedQty.toString()}, Available: ${availableQty.toString()}`,
    );
  }
}
