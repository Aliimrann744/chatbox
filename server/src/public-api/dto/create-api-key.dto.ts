import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  label?: string;

  @IsBoolean()
  @IsOptional()
  canSendText?: boolean;

  @IsBoolean()
  @IsOptional()
  canSendVoice?: boolean;
}
