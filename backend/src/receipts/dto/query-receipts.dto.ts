import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptStatus } from '@prisma/client';

export class QueryReceiptsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be greater than or equal to 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be greater than or equal to 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit: number = 20;

  @IsOptional()
  @IsEnum(ReceiptStatus, {
    message: `status must be one of: ${Object.values(ReceiptStatus).join(', ')}`,
  })
  status?: ReceiptStatus;

  @IsOptional()
  @IsUUID('4', { message: 'warehouseId must be a valid UUID' })
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'supplierId must be a valid UUID' })
  supplierId?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search query cannot exceed 100 characters' })
  search?: string;

  @IsOptional()
  @IsIn(['receiptDate', 'createdAt', 'receiptNumber', 'totalAmount'], {
    message: 'sortBy must be one of: receiptDate, createdAt, receiptNumber, totalAmount',
  })
  sortBy: 'receiptDate' | 'createdAt' | 'receiptNumber' | 'totalAmount' = 'receiptDate';

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'sortOrder must be either asc or desc',
  })
  sortOrder: 'asc' | 'desc' = 'desc';
}
