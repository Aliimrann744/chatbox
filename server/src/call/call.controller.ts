import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { CallService } from './call.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('calls')
export class CallController {
  constructor(private readonly callService: CallService) {}

  @Get()
  async getCallHistory(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.callService.getCallHistory(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get(':id')
  async getCall(@Param('id') callId: string) {
    return this.callService.getCall(callId);
  }

  @Delete(':id')
  async deleteCall(@CurrentUser() user: any, @Param('id') callId: string) {
    return this.callService.deleteCallHistory(user.id, callId);
  }
}
