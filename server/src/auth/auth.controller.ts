import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService, RequestContext } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { FacebookLoginDto } from './dto/facebook-login.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

function buildContext(req: any): RequestContext {
  return {
    ipAddress: (req.headers?.['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || undefined,
    userAgent: req.headers?.['user-agent']?.toString(),
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Req() req: any) {
    return this.authService.verifyOtp(verifyOtpDto, buildContext(req));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(
    @Body() body: { challengeToken: string; code: string; method: 'totp' | 'email' | 'backup' },
    @Req() req: any,
  ) {
    return this.authService.completeTwoFactor(body.challengeToken, body.code, body.method, buildContext(req));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('2fa/resend-email')
  @HttpCode(HttpStatus.OK)
  async resendTwoFactorEmail(@Body() body: { challengeToken: string }) {
    return this.authService.resendTwoFactorEmail(body.challengeToken);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto, @Req() req: any) {
    return this.authService.googleLogin(googleLoginDto, buildContext(req));
  }

  @Public()
  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  async facebookLogin(@Body() facebookLoginDto: FacebookLoginDto, @Req() req: any) {
    return this.authService.facebookLogin(facebookLoginDto, buildContext(req));
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update-profile')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new BadRequestException('Only JPEG, PNG, and WebP images are allowed'), false);
        }
      },
    }),
  )
  async updateProfile(
    @Request() req,
    @Body() body: { name?: string; about?: string; phone?: string; countryCode?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.updateProfile(req.user.id, body, file);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('avatar')
  @HttpCode(HttpStatus.OK)
  async removeAvatar(@Request() req) {
    return this.authService.removeAvatar(req.user.id);
  }
}
