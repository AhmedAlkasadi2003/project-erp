import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PeriodStatus } from '@prisma/client';

export class CreateAccountingPeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsDateString(
    {},
    { message: 'startDate must be a valid ISO 8601 date string (e.g. 2026-11-01T00:00:00.000Z)' },
  )
  @IsNotEmpty()
  startDate!: string;

  @IsDateString(
    {},
    { message: 'endDate must be a valid ISO 8601 date string (e.g. 2026-11-30T23:59:59.999Z)' },
  )
  @IsNotEmpty()
  endDate!: string;

  @IsEnum(PeriodStatus)
  @IsOptional()
  status?: PeriodStatus = PeriodStatus.OPEN;
}
