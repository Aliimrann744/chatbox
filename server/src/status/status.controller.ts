import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { StatusService } from './status.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Post()
  async createStatus(@CurrentUser() user: any, @Body() dto: CreateStatusDto) {
    return this.statusService.createStatus(user.id, dto);
  }

  @Get('me')
  async getMyStatuses(@CurrentUser() user: any) {
    return this.statusService.getMyStatuses(user.id);
  }

  @Get('contacts')
  async getContactStatuses(@CurrentUser() user: any) {
    return this.statusService.getContactStatuses(user.id);
  }

  @Post(':id/view')
  async viewStatus(@CurrentUser() user: any, @Param('id') statusId: string) {
    return this.statusService.viewStatus(statusId, user.id);
  }

  @Delete(':id')
  async deleteStatus(@CurrentUser() user: any, @Param('id') statusId: string) {
    return this.statusService.deleteStatus(statusId, user.id);
  }
}
