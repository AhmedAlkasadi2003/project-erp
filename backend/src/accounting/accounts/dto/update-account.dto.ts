import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AccountNormalBalance, AccountType } from '@prisma/client';

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @IsEnum(AccountNormalBalance)
  @IsOptional()
  normalBalance?: AccountNormalBalance;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('4', { message: 'parentId must be a valid UUID or null' })
  @IsOptional()
  parentId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
