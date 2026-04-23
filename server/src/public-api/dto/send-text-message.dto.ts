import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTextMessageDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  content: string;

  // Optional external correlation id — echoed back in the response so
  // callers can reconcile async deliveries with their own records.
  @IsString()
  @IsOptional()
  @MaxLength(128)
  externalId?: string;
}
