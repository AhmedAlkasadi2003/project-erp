import { Prisma } from '@prisma/client';
import { DecimalMath } from './decimal-math.util';
import { IsPositiveDecimalConstraint, IsNonNegativeDecimalConstraint } from './decimal-validators';

describe('DecimalMath Utility & Precision Invariants', () => {
  describe('parse()', () => {
    it('should parse numbers and strings to Prisma.Decimal', () => {
      const fromNum = DecimalMath.parse(10.5);
      const fromStr = DecimalMath.parse('15.7500');
      const fromDec = DecimalMath.parse(new Prisma.Decimal(25));

      expect(fromNum.toString()).toBe('10.5');
      expect(fromStr.toString()).toBe('15.75');
      expect(fromDec.toString()).toBe('25');
    });

    it('should throw an error for malformed or NaN inputs', () => {
      expect(() => DecimalMath.parse('not-a-number')).toThrow('Failed to parse decimal');
      expect(() => DecimalMath.parse(null as unknown as string)).toThrow(
        'Decimal value cannot be null or undefined',
      );
      expect(() => DecimalMath.parse(undefined as unknown as string)).toThrow(
        'Decimal value cannot be null or undefined',
      );
    });
  });

  describe('calculateLine()', () => {
    it('should calculate standard line subtotal and total correctly', () => {
      const line = DecimalMath.calculateLine(10, 15.5, 0);

      expect(line.quantityReceived.toFixed(4)).toBe('10.0000');
      expect(line.unitCost.toFixed(4)).toBe('15.5000');
      expect(line.subtotal.toFixed(4)).toBe('155.0000');
      expect(line.taxAmount.toFixed(4)).toBe('0.0000');
      expect(line.totalAmount.toFixed(4)).toBe('155.0000');
    });

    it('should handle fractional quantities and unit costs with correct 4-decimal rounding (HALF_UP)', () => {
      // 12.3456 * 7.8912 = 97.42159872 -> rounds to 97.4216
      const line = DecimalMath.calculateLine('12.3456', '7.8912', '5.2500');

      expect(line.quantityReceived.toFixed(4)).toBe('12.3456');
      expect(line.unitCost.toFixed(4)).toBe('7.8912');
      expect(line.subtotal.toFixed(4)).toBe('97.4216');
      expect(line.taxAmount.toFixed(4)).toBe('5.2500');
      // 97.4216 + 5.2500 = 102.6716
      expect(line.totalAmount.toFixed(4)).toBe('102.6716');
    });

    it('should handle zero unit cost correctly (warranty/samples)', () => {
      const line = DecimalMath.calculateLine(50, 0, 0);

      expect(line.subtotal.toFixed(4)).toBe('0.0000');
      expect(line.totalAmount.toFixed(4)).toBe('0.0000');
    });

    it('should support large monetary quantities without IEEE-754 precision drift', () => {
      // 1,000,000.1234 * 999.9999 = 1000000023.39998766 -> rounds to 1000000023.4000
      const line = DecimalMath.calculateLine('1000000.1234', '999.9999', '12500.5000');

      expect(line.subtotal.toFixed(4)).toBe('1000000023.4000');
      expect(line.totalAmount.toFixed(4)).toBe('1000012523.9000');
    });
  });

  describe('calculateReceiptTotals()', () => {
    it('should sum multiple line subtotals and taxes accurately', () => {
      const line1 = DecimalMath.calculateLine('10.0000', '15.5000', '1.5500');
      const line2 = DecimalMath.calculateLine('5.5000', '20.0000', '2.2000');

      const totals = DecimalMath.calculateReceiptTotals([line1, line2]);

      // line 1: subtotal 155.0000, tax 1.5500, total 156.5500
      // line 2: subtotal 110.0000, tax 2.2000, total 112.2000
      // receipt: subtotal 265.0000, tax 3.7500, total 268.7500
      expect(totals.subtotal.toFixed(4)).toBe('265.0000');
      expect(totals.taxAmount.toFixed(4)).toBe('3.7500');
      expect(totals.totalAmount.toFixed(4)).toBe('268.7500');
    });

    it('should return 0.0000 when empty array provided', () => {
      const totals = DecimalMath.calculateReceiptTotals([]);

      expect(totals.subtotal.toFixed(4)).toBe('0.0000');
      expect(totals.taxAmount.toFixed(4)).toBe('0.0000');
      expect(totals.totalAmount.toFixed(4)).toBe('0.0000');
    });
  });
});

describe('Decimal Custom Validation Constraints', () => {
  const positiveValidator = new IsPositiveDecimalConstraint();
  const nonNegativeValidator = new IsNonNegativeDecimalConstraint();

  describe('IsPositiveDecimalConstraint', () => {
    it('should accept positive numbers and decimal strings', () => {
      expect(positiveValidator.validate(1)).toBe(true);
      expect(positiveValidator.validate(0.0001)).toBe(true);
      expect(positiveValidator.validate('10.5')).toBe(true);
      expect(positiveValidator.validate('0.0001')).toBe(true);
    });

    it('should reject zero, negative values, and non-numbers', () => {
      expect(positiveValidator.validate(0)).toBe(false);
      expect(positiveValidator.validate('0')).toBe(false);
      expect(positiveValidator.validate('0.0000')).toBe(false);
      expect(positiveValidator.validate(-1)).toBe(false);
      expect(positiveValidator.validate('-0.5')).toBe(false);
      expect(positiveValidator.validate('abc')).toBe(false);
      expect(positiveValidator.validate(null)).toBe(false);
      expect(positiveValidator.validate(undefined)).toBe(false);
    });
  });

  describe('IsNonNegativeDecimalConstraint', () => {
    it('should accept zero, positive numbers, and decimal strings', () => {
      expect(nonNegativeValidator.validate(0)).toBe(true);
      expect(nonNegativeValidator.validate('0')).toBe(true);
      expect(nonNegativeValidator.validate('0.0000')).toBe(true);
      expect(nonNegativeValidator.validate(1)).toBe(true);
      expect(nonNegativeValidator.validate('15.75')).toBe(true);
    });

    it('should reject negative values and non-numbers', () => {
      expect(nonNegativeValidator.validate(-1)).toBe(false);
      expect(nonNegativeValidator.validate('-0.0001')).toBe(false);
      expect(nonNegativeValidator.validate('invalid')).toBe(false);
      expect(nonNegativeValidator.validate(null)).toBe(false);
      expect(nonNegativeValidator.validate(undefined)).toBe(false);
    });
  });
});
