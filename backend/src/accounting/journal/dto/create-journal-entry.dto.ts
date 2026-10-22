import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalSourceType } from '@prisma/client';
import { CreateJournalLineDto } from './create-journal-line.dto';

export class CreateJournalEntryDto {
  @IsDateString(
    {},
    { message: 'entryDate must be a valid ISO 8601 date string (e.g. 2026-10-22T00:00:00.000Z)' },
  )
  @IsNotEmpty()
  entryDate!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  description!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  entryNumber?: string;

  @IsEnum(JournalSourceType)
  @IsOptional()
  sourceType?: JournalSourceType = JournalSourceType.MANUAL;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  sourceReference?: string;

  @IsArray()
  @ArrayMinSize(2, {
    message: 'A journal entry must contain at least 2 lines (double-entry requirement)',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
