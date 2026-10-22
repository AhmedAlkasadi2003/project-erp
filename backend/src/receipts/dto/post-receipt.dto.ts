import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class PostReceiptDto {
  @IsOptional()
  @IsISO8601({}, { message: 'postingDate must be a valid ISO 8601 date string' })
  postingDate?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes cannot exceed 500 characters' })
  notes?: string;
}
