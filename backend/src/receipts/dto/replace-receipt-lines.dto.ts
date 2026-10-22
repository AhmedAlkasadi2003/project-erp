import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsNonNegativeDecimal, IsPositiveDecimal } from '../utils/decimal-validators';

export class ReconcileReceiptLineDto {
  @IsOptional()
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id?: string;

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

export class ReplaceReceiptLinesDto {
  @IsArray({ message: 'lines must be an array' })
  @ArrayMinSize(1, { message: 'A receipt must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => ReconcileReceiptLineDto)
  lines!: ReconcileReceiptLineDto[];
}
