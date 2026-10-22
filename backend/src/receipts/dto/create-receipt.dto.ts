import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateReceiptLineDto } from './create-receipt-line.dto';

export class CreateReceiptDto {
  @IsNotEmpty({ message: 'warehouseId is required' })
  @IsUUID('4', { message: 'warehouseId must be a valid UUID' })
  warehouseId!: string;

  @IsNotEmpty({ message: 'supplierId is required' })
  @IsUUID('4', { message: 'supplierId must be a valid UUID' })
  supplierId!: string;

  @IsOptional()
  @IsString({ message: 'receiptNumber must be a string' })
  @MaxLength(50, { message: 'receiptNumber cannot exceed 50 characters' })
  @Matches(/^[A-Za-z0-9\-_]+$/, {
    message: 'receiptNumber may only contain alphanumeric characters, hyphens, and underscores',
  })
  receiptNumber?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'receiptDate must be a valid ISO 8601 date string' })
  receiptDate?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(1000, { message: 'notes cannot exceed 1000 characters' })
  notes?: string;

  @IsArray({ message: 'lines must be an array of receipt lines' })
  @ArrayMinSize(1, { message: 'A receipt must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptLineDto)
  lines!: CreateReceiptLineDto[];
}
