import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PublicApiKeysService } from './public-api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * JWT-authenticated management endpoints for the signed-in user's own
 * public API keys. The global JwtAuthGuard covers these by default, so a
 * valid access token is required for every call.
 */
@Controller('public-api-keys')
export class PublicApiKeysController {
  constructor(private readonly keysService: PublicApiKeysService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateApiKeyDto) {
    return this.keysService.createKey(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.keysService.listKeys(user.id);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: any, @Param('id') id: string) {
    return this.keysService.revokeKey(user.id, id);
  }
}
