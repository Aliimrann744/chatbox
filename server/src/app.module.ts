import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { ContactModule } from './contact/contact.module';
import { CallModule } from './call/call.module';
import { GroupModule } from './group/group.module';
import { SettingsModule } from './settings/settings.module';
import { StatusModule } from './status/status.module';
import { NotificationModule } from './notification/notification.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { PublicApiModule } from './public-api/public-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    NotificationModule,
    AuthModule,
    UploadModule,
    ChatModule,
    ContactModule,
    CallModule,
    GroupModule,
    SettingsModule,
    StatusModule,
    TwoFactorModule,
    PublicApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})

export class AppModule {};
