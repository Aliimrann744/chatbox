import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from '../chat/chat.module';
import { UploadModule } from '../upload/upload.module';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { PublicApiKeysController } from './public-api-keys.controller';
import { PublicApiKeysService } from './public-api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [ConfigModule, ChatModule, UploadModule],
  controllers: [PublicApiController, PublicApiKeysController],
  providers: [PublicApiService, PublicApiKeysService, ApiKeyGuard],
})
export class PublicApiModule {}
