import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminPanelController } from './admin-panel.controller';
import { AdminPanelApiController } from './admin-panel-api.controller';
import { AdminImpersonationController } from './admin-impersonation.controller';
import { AdminPanelService } from './admin-panel.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminImpersonationService } from './admin-impersonation.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { DEFAULT_ADMIN_SESSION_SECRET } from './admin-panel.constants';
import { PublicApiModule } from '../public-api/public-api.module';

@Module({
  imports: [
    ConfigModule,
    PublicApiModule, // for PublicApiKeysService
    // Dedicated JwtModule instance — separate from the user-auth JwtModule so
    // rotating ADMIN_SESSION_SECRET does not invalidate user sessions and
    // vice versa. The same instance is reused to mint user-impersonation
    // JWTs; we always pass `secret` per-call so the right key is used.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('ADMIN_SESSION_SECRET') ??
          DEFAULT_ADMIN_SESSION_SECRET,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AdminPanelController,
    AdminPanelApiController,
    AdminImpersonationController,
  ],
  providers: [
    AdminPanelService,
    AdminAuthService,
    AdminImpersonationService,
    AdminAuthGuard,
  ],
})
export class AdminPanelModule {}
