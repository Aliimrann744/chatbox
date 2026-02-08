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
import { ChatService } from './chat.service';
import { CreateChatDto, SendMessageDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ==================== CHAT ENDPOINTS ====================

  @Get()
  async getChats(@CurrentUser() user: any) {
    return this.chatService.getUserChats(user.id);
  }

  @Post()
  async createChat(@CurrentUser() user: any, @Body() dto: CreateChatDto) {
    if (dto.participantId) {
      // Create private chat
      return this.chatService.createPrivateChat(user.id, dto.participantId);
    } else if (dto.participantIds && dto.participantIds.length > 0) {
      // Create group chat
      return this.chatService.createGroupChat(
        user.id,
        dto.name || 'New Group',
        dto.participantIds,
        dto.description,
        dto.avatar,
      );
    } else {
      throw new Error('Either participantId or participantIds is required');
    }
  }

  @Get(':id')
  async getChat(@CurrentUser() user: any, @Param('id') chatId: string) {
    return this.chatService.getChatById(chatId, user.id);
  }

  @Patch(':id/pin')
  async pinChat(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Body('isPinned') isPinned: boolean,
  ) {
    return this.chatService.pinChat(chatId, user.id, isPinned);
  }

  @Patch(':id/mute')
  async muteChat(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Body() body: { isMuted: boolean; muteUntil?: string },
  ) {
    return this.chatService.muteChat(
      chatId,
      user.id,
      body.isMuted,
      body.muteUntil ? new Date(body.muteUntil) : undefined,
    );
  }

  // ==================== MESSAGE ENDPOINTS ====================

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getChatMessages(
      chatId,
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Body() dto: Omit<SendMessageDto, 'chatId'>,
  ) {
    return this.chatService.createMessage(user.id, { ...dto, chatId });
  }

  @Post(':id/read')
  async markAsRead(@CurrentUser() user: any, @Param('id') chatId: string) {
    return this.chatService.markMessagesAsRead(chatId, user.id);
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.deleteMessage(messageId, user.id);
  }
}
