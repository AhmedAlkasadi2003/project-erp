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
import { StockMovementType } from '@prisma/client';

export class QueryStockMovementsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit: number = 20;

  @IsOptional()
  @IsUUID('4', { message: 'warehouseId must be a valid UUID' })
  warehouseId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'itemId must be a valid UUID' })
  itemId?: string;

  @IsOptional()
  @IsEnum(StockMovementType, {
    message: `movementType must be one of: ${Object.values(StockMovementType).join(', ')}`,
  })
  movementType?: StockMovementType;

  @IsOptional()
  @IsString({ message: 'referenceType must be a string' })
  @MaxLength(50, { message: 'referenceType cannot exceed 50 characters' })
  referenceType?: string;

  @IsOptional()
  @IsString({ message: 'referenceId must be a string' })
  @MaxLength(100, { message: 'referenceId cannot exceed 100 characters' })
  referenceId?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'startDate must be a valid ISO 8601 date string' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate must be a valid ISO 8601 date string' })
  endDate?: string;

  @IsOptional()
  @IsIn(['movementDate', 'createdAt', 'quantity', 'totalCost'], {
    message: 'sortBy must be one of: movementDate, createdAt, quantity, totalCost',
  })
  sortBy: 'movementDate' | 'createdAt' | 'quantity' | 'totalCost' = 'movementDate';

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'sortOrder must be either asc or desc',
  })
  sortOrder: 'asc' | 'desc' = 'desc';
}
