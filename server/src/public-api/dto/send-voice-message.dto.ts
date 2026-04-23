import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendVoiceMessageDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  // Multipart fields arrive as strings; coerce "42" → 42 before validation.
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  duration?: number;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  externalId?: string;
}
