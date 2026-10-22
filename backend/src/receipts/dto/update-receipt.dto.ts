import { IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateReceiptDto {
  @IsOptional()
  @IsUUID('4', { message: 'warehouseId must be a valid UUID' })
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'supplierId must be a valid UUID' })
  supplierId?: string;

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
}
