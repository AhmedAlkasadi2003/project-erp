import { BadRequestException } from '@nestjs/common';
import { CostingEngineService } from './costing-engine.service';
import { InsufficientStockException } from '../exceptions/insufficient-stock.exception';

describe('CostingEngineService (Unit)', () => {
  let service: CostingEngineService;

  beforeEach(() => {
    service = new CostingEngineService();
  });

  describe('Inbound Weighted-Average Costing', () => {
    it('should calculate initial stock correctly when previous quantity is zero', () => {
      const res = service.calculateInbound(0, 0, 0, 10, '15.5000');

      expect(res.newQuantity.toFixed(4)).toBe('10.0000');
      expect(res.incomingValue.toFixed(4)).toBe('155.0000');
      expect(res.newTotalValue.toFixed(4)).toBe('155.0000');
      expect(res.newAverageCost.toFixed(4)).toBe('15.5000');
    });

    it('should calculate weighted-average correctly on subsequent receipts', () => {
      // Previous: 10 units @ $15.5000 = $155.0000
      // Incoming: 5 units @ $20.0000 = $100.0000
      // Total Qty: 15.0000
      // Total Value: $255.0000
      // Expected Avg Cost: 255 / 15 = $17.0000
      const res = service.calculateInbound('10.0000', '155.0000', '15.5000', '5.0000', '20.0000');

      expect(res.newQuantity.toFixed(4)).toBe('15.0000');
      expect(res.incomingValue.toFixed(4)).toBe('100.0000');
      expect(res.newTotalValue.toFixed(4)).toBe('255.0000');
      expect(res.newAverageCost.toFixed(4)).toBe('17.0000');
    });

    it('should handle fractional quantities and unit costs with correct 4-decimal half-up rounding', () => {
      // Previous: 10.0000 units @ $15.0000 = $150.0000
      // Incoming: 12.3456 units @ $7.8912 = 97.42159872 -> rounds to 97.4216
      // Total Qty: 10.0000 + 12.3456 = 22.3456
      // Total Value: 150.0000 + 97.4216 = 247.4216
      // Average Cost: 247.4216 / 22.3456 = 11.07249749 -> rounds to 11.0725
      const res = service.calculateInbound('10.0000', '150.0000', '15.0000', '12.3456', '7.8912');

      expect(res.newQuantity.toFixed(4)).toBe('22.3456');
      expect(res.incomingValue.toFixed(4)).toBe('97.4216');
      expect(res.newTotalValue.toFixed(4)).toBe('247.4216');
      expect(res.newAverageCost.toFixed(4)).toBe('11.0725');
    });

    it('should dilute unit cost on zero-cost inbound receipts (samples/warranty)', () => {
      // Previous: 10 units @ $10.0000 = $100.0000
      // Incoming: 10 units @ $0.0000 = $0.0000
      // Total Qty: 20.0000
      // Total Value: $100.0000
      // Expected Avg Cost: 100 / 20 = $5.0000
      const res = service.calculateInbound('10.0000', '100.0000', '10.0000', '10.0000', '0.0000');

      expect(res.newQuantity.toFixed(4)).toBe('20.0000');
      expect(res.incomingValue.toFixed(4)).toBe('0.0000');
      expect(res.newTotalValue.toFixed(4)).toBe('100.0000');
      expect(res.newAverageCost.toFixed(4)).toBe('5.0000');
    });

    it('should reject zero or negative incoming quantity', () => {
      expect(() => service.calculateInbound(0, 0, 0, 0, 10)).toThrow(BadRequestException);
      expect(() => service.calculateInbound(0, 0, 0, -5, 10)).toThrow(BadRequestException);
    });

    it('should reject negative incoming unit cost', () => {
      expect(() => service.calculateInbound(0, 0, 0, 10, -1)).toThrow(BadRequestException);
    });
  });

  describe('Outbound Stock Valuation & Deductions', () => {
    it('should calculate partial stock issue at current average cost without altering unit cost', () => {
      // Previous: 15 units @ $17.0000 = $255.0000
      // Outgoing: 5 units
      // Deducted Value: 5 * 17 = $85.0000
      // New Qty: 10.0000
      // New Value: 255 - 85 = $170.0000
      // New Avg Cost: $17.0000 (unchanged)
      const res = service.calculateOutbound(
        '15.0000',
        '255.0000',
        '17.0000',
        '5.0000',
        'item-1',
        'wh-1',
      );

      expect(res.newQuantity.toFixed(4)).toBe('10.0000');
      expect(res.unitCost.toFixed(4)).toBe('17.0000');
      expect(res.deductedValue.toFixed(4)).toBe('85.0000');
      expect(res.newTotalValue.toFixed(4)).toBe('170.0000');
      expect(res.newAverageCost.toFixed(4)).toBe('17.0000');
    });

    it('should completely clear total value and average cost to zero when stock is fully depleted', () => {
      // Depleting the entire 10 units
      const res = service.calculateOutbound(
        '10.0000',
        '170.0000',
        '17.0000',
        '10.0000',
        'item-1',
        'wh-1',
      );

      expect(res.newQuantity.toFixed(4)).toBe('0.0000');
      expect(res.deductedValue.toFixed(4)).toBe('170.0000');
      expect(res.newTotalValue.toFixed(4)).toBe('0.0000');
      expect(res.newAverageCost.toFixed(4)).toBe('0.0000');
    });

    it('should throw InsufficientStockException when requested issue exceeds on-hand quantity', () => {
      expect(() =>
        service.calculateOutbound('10.0000', '100.0000', '10.0000', '10.0001', 'item-1', 'wh-1'),
      ).toThrow(InsufficientStockException);
    });

    it('should reject zero or negative outgoing quantity', () => {
      expect(() =>
        service.calculateOutbound('10.0000', '100.0000', '10.0000', '0.0000', 'item-1', 'wh-1'),
      ).toThrow(BadRequestException);

      expect(() =>
        service.calculateOutbound('10.0000', '100.0000', '10.0000', '-5.0000', 'item-1', 'wh-1'),
      ).toThrow(BadRequestException);
    });
  });
});
