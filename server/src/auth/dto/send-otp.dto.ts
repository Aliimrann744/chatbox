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

  // Device FCM token — required for phone OTP delivery so we can push the
  // code to the device via Firebase Cloud Messaging (no SMS gateway needed).
  @IsString()
  @IsOptional()
  fcmToken?: string;
}
