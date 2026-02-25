import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class SendOtpDto {
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsString()
  @IsOptional()
  countryCode?: string;

  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsNotEmpty()
  email?: string;
}
