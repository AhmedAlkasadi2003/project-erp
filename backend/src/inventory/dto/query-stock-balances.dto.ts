import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryStockBalancesDto {
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
  @IsIn(['quantityOnHand', 'totalValue', 'averageCost', 'updatedAt'], {
    message: 'sortBy must be one of: quantityOnHand, totalValue, averageCost, updatedAt',
  })
  sortBy: 'quantityOnHand' | 'totalValue' | 'averageCost' | 'updatedAt' = 'quantityOnHand';

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'sortOrder must be either asc or desc',
  })
  sortOrder: 'asc' | 'desc' = 'desc';
}
