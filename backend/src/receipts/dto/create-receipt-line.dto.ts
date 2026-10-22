import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsNonNegativeDecimal, IsPositiveDecimal } from '../utils/decimal-validators';

export class CreateReceiptLineDto {
  @IsNotEmpty({ message: 'itemId is required' })
  @IsUUID('4', { message: 'itemId must be a valid UUID' })
  itemId!: string;

  @IsNotEmpty({ message: 'quantityReceived is required' })
  @IsPositiveDecimal({
    message: 'quantityReceived must be a strictly positive decimal number (greater than 0)',
  })
  quantityReceived!: number | string;

  @IsNotEmpty({ message: 'unitCost is required' })
  @IsNonNegativeDecimal({
    message: 'unitCost must be a non-negative decimal number (0 or greater)',
  })
  unitCost!: number | string;

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
