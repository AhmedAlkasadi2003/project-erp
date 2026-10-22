import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNonNegativeDecimal, IsPositiveDecimal } from '../utils/decimal-validators';

export class UpdateReceiptLineDto {
  @IsOptional()
  @IsPositiveDecimal({
    message: 'quantityReceived must be a strictly positive decimal number (greater than 0)',
  })
  quantityReceived?: number | string;

  @IsOptional()
  @IsNonNegativeDecimal({
    message: 'unitCost must be a non-negative decimal number (0 or greater)',
  })
  unitCost?: number | string;

  @IsOptional()
  @IsNonNegativeDecimal({
    message: 'taxAmount must be a non-negative decimal number (0 or greater)',
  })
  taxAmount?: number | string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes cannot exceed 500 characters' })
  notes?: string;
}
