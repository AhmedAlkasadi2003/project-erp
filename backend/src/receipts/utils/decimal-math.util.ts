import { Prisma } from '@prisma/client';

export interface CalculatedLine {
  quantityReceived: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export interface CalculatedReceiptTotals {
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export class DecimalMath {
  static readonly MONEY_DECIMAL_PLACES = 4;
  static readonly QTY_DECIMAL_PLACES = 4;
  static readonly ROUNDING_MODE = Prisma.Decimal.ROUND_HALF_UP;

  /**
   * Safely parse a number, string, or Prisma.Decimal into a Decimal.
   * Throws Error if value cannot be parsed or is NaN.
   */
  static parse(value: number | string | Prisma.Decimal): Prisma.Decimal {
    if (value === null || value === undefined) {
      throw new Error('Decimal value cannot be null or undefined');
    }

    try {
      const dec = new Prisma.Decimal(value);
      if (dec.isNaN()) {
        throw new Error(`Invalid decimal representation: '${value}'`);
      }
      return dec;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse decimal '${value}': ${message}`);
    }
  }

  /**
   * Rounds a monetary decimal to 4 decimal places using ROUND_HALF_UP.
   */
  static roundMoney(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(this.MONEY_DECIMAL_PLACES, this.ROUNDING_MODE);
  }

  /**
   * Rounds a quantity decimal to 4 decimal places using ROUND_HALF_UP.
   */
  static roundQty(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(this.QTY_DECIMAL_PLACES, this.ROUNDING_MODE);
  }

  /**
   * Calculates subtotal, taxAmount, and totalAmount for a single receipt line.
   * Invariants:
   *  - subtotal = round(qty * unitCost)
   *  - taxAmount = round(tax)
   *  - totalAmount = subtotal + taxAmount
   */
  static calculateLine(
    rawQty: number | string | Prisma.Decimal,
    rawUnitCost: number | string | Prisma.Decimal,
    rawTaxAmount: number | string | Prisma.Decimal = 0,
  ): CalculatedLine {
    const qty = this.roundQty(this.parse(rawQty));
    const unitCost = this.roundMoney(this.parse(rawUnitCost));
    const tax = this.roundMoney(this.parse(rawTaxAmount));

    const subtotal = this.roundMoney(qty.mul(unitCost));
    const totalAmount = this.roundMoney(subtotal.add(tax));

    return {
      quantityReceived: qty,
      unitCost,
      subtotal,
      taxAmount: tax,
      totalAmount,
    };
  }

  /**
   * Calculates header totals (subtotal, taxAmount, totalAmount) across an array of calculated lines.
   */
  static calculateReceiptTotals(
    lines: Array<{ subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal }>,
  ): CalculatedReceiptTotals {
    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);

    for (const line of lines) {
      subtotal = subtotal.add(line.subtotal);
      taxAmount = taxAmount.add(line.taxAmount);
    }

    subtotal = this.roundMoney(subtotal);
    taxAmount = this.roundMoney(taxAmount);
    const totalAmount = this.roundMoney(subtotal.add(taxAmount));

    return {
      subtotal,
      taxAmount,
      totalAmount,
    };
  }
}
