import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccountNormalBalance, AccountType } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9\-_.]+$/, {
    message: 'code must only contain alphanumeric characters, hyphens, underscores, or periods',
  })
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(AccountType, {
    message: 'type must be a valid AccountType (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)',
  })
  type!: AccountType;

  @IsEnum(AccountNormalBalance, {
    message: 'normalBalance must be a valid AccountNormalBalance (DEBIT, CREDIT)',
  })
  normalBalance!: AccountNormalBalance;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  @IsOptional()
  parentId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
