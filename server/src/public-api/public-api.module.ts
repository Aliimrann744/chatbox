import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from '../chat/chat.module';
import { UploadModule } from '../upload/upload.module';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { PublicApiKeysController } from './public-api-keys.controller';
import { PublicApiKeysService } from './public-api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PublicApiMessageLogInterceptor } from './interceptors/public-api-message-log.interceptor';

@Module({
  imports: [ConfigModule, ChatModule, UploadModule],
  controllers: [PublicApiController, PublicApiKeysController],
  providers: [
    PublicApiService,
    PublicApiKeysService,
    ApiKeyGuard,
    PublicApiMessageLogInterceptor,
  ],
  // PublicApiKeysService is exported so the admin-panel impersonation flow
  // can mint keys via the same code path users hit — guarantees the keys
  // are byte-identical (hash, prefix, audit fields) to user-created ones.
  exports: [PublicApiKeysService],
})
export class PublicApiModule {}
