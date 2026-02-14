import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { SyncContactsDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ==================== CONTACT SYNC ====================

  @Post('sync')
  async syncContacts(@CurrentUser() user: any, @Body() dto: SyncContactsDto) {
    return this.contactService.syncContacts(user.id, dto.phoneNumbers, dto.contacts);
  }

  // ==================== CONTACT MANAGEMENT ====================

  @Get()
  async getContacts(@CurrentUser() user: any) {
    return this.contactService.getContacts(user.id);
  }

  @Post()
  async addContact(
    @CurrentUser() user: any,
    @Body() body: { contactId: string; nickname?: string },
  ) {
    return this.contactService.addContact(user.id, body.contactId, body.nickname);
  }

  @Patch(':contactId')
  async updateContact(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Body() body: { nickname: string | null },
  ) {
    return this.contactService.updateContact(user.id, contactId, body.nickname);
  }

  @Delete(':contactId')
  async removeContact(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
  ) {
    return this.contactService.removeContact(user.id, contactId);
  }

  // ==================== BLOCKING ====================

  @Post('block')
  async blockUser(
    @CurrentUser() user: any,
    @Body() body: { userId: string },
  ) {
    return this.contactService.blockUser(user.id, body.userId);
  }

  @Delete('block/:userId')
  async unblockUser(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.contactService.unblockUser(user.id, userId);
  }

  @Get('blocked')
  async getBlockedUsers(@CurrentUser() user: any) {
    return this.contactService.getBlockedUsers(user.id);
  }

  // ==================== SEARCH ====================

  @Get('search')
  async searchUsers(
    @CurrentUser() user: any,
    @Query('q') query: string,
  ) {
    return this.contactService.searchUsers(user.id, query || '');
  }
}
