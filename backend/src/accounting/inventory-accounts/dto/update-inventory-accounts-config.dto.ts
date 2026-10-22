import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateInventoryAccountsConfigDto {
  @IsUUID('4', { message: 'grnClearingAccountId must be a valid UUID' })
  @IsNotEmpty()
  grnClearingAccountId!: string;
}
