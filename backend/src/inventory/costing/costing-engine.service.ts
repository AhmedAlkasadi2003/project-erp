import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InsufficientStockException } from '../exceptions/insufficient-stock.exception';

export interface InboundCostingResult {
  newQuantity: Prisma.Decimal;
  incomingValue: Prisma.Decimal;
  newTotalValue: Prisma.Decimal;
  newAverageCost: Prisma.Decimal;
}

export interface OutboundCostingResult {
  newQuantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  deductedValue: Prisma.Decimal;
  newTotalValue: Prisma.Decimal;
  newAverageCost: Prisma.Decimal;
}

@Injectable()
export class CostingEngineService {
  static readonly SCALE = 4;
  static readonly ROUNDING = Prisma.Decimal.ROUND_HALF_UP;

  /**
   * Helper to round a monetary or quantity decimal to 4 decimal places with ROUND_HALF_UP.
   */
  static round(val: Prisma.Decimal): Prisma.Decimal {
    return val.toDecimalPlaces(this.SCALE, this.ROUNDING);
  }

  /**
   * Safe parser for input decimal types.
   */
  static toDecimal(val: Prisma.Decimal | number | string): Prisma.Decimal {
    if (val === null || val === undefined) {
      throw new BadRequestException('Decimal value cannot be null or undefined');
    }
    const dec = new Prisma.Decimal(val);
    if (dec.isNaN()) {
      throw new BadRequestException(`Invalid decimal value: '${val}'`);
    }
    return dec;
  }

  /**
   * Calculates moving weighted-average cost and balance for an inbound stock intake.
   *
   * Formula:
   *   New Qty = Previous Qty + Incoming Qty
   *   Incoming Value = round(Incoming Qty * Incoming Unit Cost)
   *   New Total Value = Previous Total Value + Incoming Value
   *   New Average Cost:
   *     - If Previous Qty == 0: Incoming Unit Cost
   *     - If Previous Qty > 0: round(New Total Value / New Qty)
   */
  calculateInbound(
    rawPrevQty: Prisma.Decimal | number | string,
    rawPrevValue: Prisma.Decimal | number | string,
    rawPrevAvgCost: Prisma.Decimal | number | string,
    rawInQty: Prisma.Decimal | number | string,
    rawInCost: Prisma.Decimal | number | string,
  ): InboundCostingResult {
    const previousQty = CostingEngineService.round(CostingEngineService.toDecimal(rawPrevQty));
    const previousTotalValue = CostingEngineService.round(
      CostingEngineService.toDecimal(rawPrevValue),
    );
    const incomingQty = CostingEngineService.round(CostingEngineService.toDecimal(rawInQty));
    const incomingUnitCost = CostingEngineService.round(CostingEngineService.toDecimal(rawInCost));

    if (incomingQty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Incoming stock quantity must be strictly positive');
    }

    if (incomingUnitCost.lessThan(0)) {
      throw new BadRequestException('Incoming unit cost must be non-negative (0 or greater)');
    }

    const incomingValue = CostingEngineService.round(incomingQty.mul(incomingUnitCost));
    const newQuantity = CostingEngineService.round(previousQty.add(incomingQty));
    const newTotalValue = CostingEngineService.round(previousTotalValue.add(incomingValue));

    let newAverageCost: Prisma.Decimal;
    if (previousQty.isZero()) {
      // First intake or previous stock was 0: unit cost is directly incomingUnitCost
      newAverageCost = incomingUnitCost;
    } else {
      // Weighted-average formula: Total Value / Total Quantity
      newAverageCost = CostingEngineService.round(newTotalValue.div(newQuantity));
    }

    return {
      newQuantity,
      incomingValue,
      newTotalValue,
      newAverageCost,
    };
  }

  /**
   * Calculates inventory deduction and balance for an outbound stock issue.
   *
   * Rule:
   *   Outbound is relieved at the current moving average cost.
   *   If outgoing quantity equals on-hand quantity, total value and average cost
   *   are explicitly reset to 0 to prevent residual penny drift on zero stock.
   */
  calculateOutbound(
    rawPrevQty: Prisma.Decimal | number | string,
    rawPrevValue: Prisma.Decimal | number | string,
    rawPrevAvgCost: Prisma.Decimal | number | string,
    rawOutQty: Prisma.Decimal | number | string,
    itemId: string = 'UNKNOWN',
    warehouseId: string = 'UNKNOWN',
  ): OutboundCostingResult {
    const previousQty = CostingEngineService.round(CostingEngineService.toDecimal(rawPrevQty));
    const previousTotalValue = CostingEngineService.round(
      CostingEngineService.toDecimal(rawPrevValue),
    );
    const previousAvgCost = CostingEngineService.round(
      CostingEngineService.toDecimal(rawPrevAvgCost),
    );
    const outgoingQty = CostingEngineService.round(CostingEngineService.toDecimal(rawOutQty));

    if (outgoingQty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Outgoing stock quantity must be strictly positive');
    }

    if (outgoingQty.greaterThan(previousQty)) {
      throw new InsufficientStockException(itemId, warehouseId, outgoingQty, previousQty);
    }

    // Complete depletion to zero stock
    if (outgoingQty.equals(previousQty)) {
      return {
        newQuantity: new Prisma.Decimal(0),
        unitCost: previousAvgCost,
        deductedValue: previousTotalValue,
        newTotalValue: new Prisma.Decimal(0),
        newAverageCost: new Prisma.Decimal(0),
      };
    }

    // Partial deduction
    const unitCost = previousAvgCost;
    const deductedValue = CostingEngineService.round(outgoingQty.mul(previousAvgCost));
    const newQuantity = CostingEngineService.round(previousQty.sub(outgoingQty));
    const newTotalValue = CostingEngineService.round(previousTotalValue.sub(deductedValue));

    return {
      newQuantity,
      unitCost,
      deductedValue,
      newTotalValue,
      newAverageCost: previousAvgCost, // Moving average cost does not change on issue
    };
  }
}
