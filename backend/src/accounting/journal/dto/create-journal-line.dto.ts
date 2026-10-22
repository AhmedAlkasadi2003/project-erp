import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsNonNegativeDecimal } from '../../../receipts/utils/decimal-validators';

export class CreateJournalLineDto {
  @IsUUID('4', { message: 'accountId must be a valid UUID' })
  @IsNotEmpty()
  accountId!: string;

  @IsNonNegativeDecimal({ message: 'debit must be a non-negative decimal (0 or greater)' })
  @IsOptional()
  debit?: string | number = '0.0000';

  @IsNonNegativeDecimal({ message: 'credit must be a non-negative decimal (0 or greater)' })
  @IsOptional()
  credit?: string | number = '0.0000';

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
