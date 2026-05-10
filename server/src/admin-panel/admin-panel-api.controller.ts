import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminPanelService } from './admin-panel.service';

/**
 * JSON endpoints powering the admin panel UI. Same /admin-panel/* tree, so
 * also excluded from the /api prefix and gated by AdminAuthGuard.
 */
@Controller('admin-panel/api')
@Public() // bypass global JwtAuthGuard
@UseGuards(AdminAuthGuard)
export class AdminPanelApiController {
  constructor(private readonly service: AdminPanelService) {}

  @Get('overview')
  overview() {
    return this.service.getOverview();
  }

  @Get('timeseries')
  timeseries(@Query('days') days?: string) {
    return this.service.getMessagesTimeseries(parseInt(days ?? '30', 10) || 30);
  }

  @Get('top-keys')
  topKeys(@Query('limit') limit?: string) {
    return this.service.getTopKeys(parseInt(limit ?? '10', 10) || 10);
  }

  @Get('active')
  active() {
    return this.service.listActiveKeys();
  }

  @Get('api-keys')
  apiKeys(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: 'all' | 'active' | 'revoked',
    @Query('search') search?: string,
  ) {
    return this.service.listApiKeys({
      page: parseInt(page ?? '1', 10) || 1,
      pageSize: parseInt(pageSize ?? '25', 10) || 25,
      status: status ?? 'all',
      search,
    });
  }

  @Get('api-keys/:id')
  async apiKey(@Param('id') id: string) {
    const key = await this.service.getApiKey(id);
    if (!key) throw new NotFoundException('API key not found');
    return key;
  }

  @Get('users')
  users(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listUsers({
      page: parseInt(page ?? '1', 10) || 1,
      pageSize: parseInt(pageSize ?? '25', 10) || 25,
      search,
    });
  }

  @Get('users/:id')
  async user(@Param('id') id: string) {
    const u = await this.service.getUser(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  @Get('messages')
  messages(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('apiKeyId') apiKeyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: 'all' | 'SUCCESS' | 'FAILED',
    @Query('type') type?: 'all' | 'TEXT' | 'VOICE',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listMessages({
      page: parseInt(page ?? '1', 10) || 1,
      pageSize: parseInt(pageSize ?? '50', 10) || 50,
      apiKeyId,
      ownerId,
      status,
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('audit')
  audit(@Query('limit') limit?: string) {
    return this.service.listLoginEvents(parseInt(limit ?? '50', 10) || 50);
  }
}
