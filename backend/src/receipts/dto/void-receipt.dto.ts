import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidReceiptDto {
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason cannot exceed 500 characters' })
  reason?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'voidDate must be a valid ISO 8601 date string' })
  voidDate?: string;
}
