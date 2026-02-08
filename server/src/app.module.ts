import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UploadModule,
    ChatModule,
    ContactModule,
    CallModule,
    GroupModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {};