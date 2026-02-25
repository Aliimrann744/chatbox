import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class VerifyOtpDto {
  @ValidateIf((o) => !o.email)
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp: string;
}
