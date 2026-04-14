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
      return this.chatService.createPrivateChat(user.id, dto.participantId);
    } else if (dto.participantIds && dto.participantIds.length > 0) {
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

  // ==================== STATIC MESSAGE ROUTES (must be before :id routes) ====================

  @Delete('messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: any,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.deleteMessage(messageId, user.id);
  }

  @Post('messages/delete-for-me')
  async deleteMessagesForMe(
    @CurrentUser() user: any,
    @Body('messageIds') messageIds: string[],
  ) {
    return this.chatService.deleteMessagesForMe(user.id, messageIds);
  }

  @Post('messages/delete-for-everyone')
  async deleteMessageForEveryone(@CurrentUser() user: any, @Body('messageId') messageId: string) {
    return this.chatService.deleteMessageForEveryone(user.id, messageId);
  }

  // Get every starred (shared) message across the user's chats.
  // Used by the Shared screen in the menu. Returns enriched chat info.
  @Get('starred/all')
  async getAllStarredMessages(@CurrentUser() user: any) {
    const messages = await this.chatService.getAllStarredMessages(user.id);
    return { messages };
  }

  // Mark every unread message in every chat as read.
  // Used by the "Read all" menu entry.
  @Post('mark-all-read')
  async markAllChatsAsRead(@CurrentUser() user: any) {
    return this.chatService.markAllChatsAsRead(user.id);
  }

  // ==================== PARAM ROUTES (:id) ====================

  @Get(':id/starred')
  async getStarredMessages(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
  ) {
    const messages = await this.chatService.getStarredMessages(user.id, chatId);
    return { messages };
  }

  @Get(':id/media')
  async getSharedMedia(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getSharedMedia(
      chatId,
      user.id,
      type,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
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

  @Patch(':id/archive')
  async archiveChat(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Body('isArchived') isArchived: boolean,
  ) {
    return this.chatService.archiveChat(chatId, user.id, isArchived);
  }

  @Patch(':id/favorite')
  async favoriteChat(
    @CurrentUser() user: any,
    @Param('id') chatId: string,
    @Body('isFavorite') isFavorite: boolean,
  ) {
    return this.chatService.favoriteChat(chatId, user.id, isFavorite);
  }

  @Patch(':id/mark-unread')
  async markChatUnread(@CurrentUser() user: any, @Param('id') chatId: string) {
    return this.chatService.markChatUnread(chatId, user.id);
  }

  @Delete(':id')
  async deleteChat(@CurrentUser() user: any, @Param('id') chatId: string) {
    return this.chatService.hideChat(chatId, user.id);
  }

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

  // Mark all SENT messages in a chat as DELIVERED (called from background FCM handler)
  @Post(':id/deliver')
  async markAsDelivered(@CurrentUser() user: any, @Param('id') chatId: string) {
    return this.chatService.markChatMessagesDelivered(chatId, user.id);
  }

  @Delete(':id/clear')
  async clearChat(@CurrentUser() user: any, @Param('id') chatId: string) {
    return this.chatService.clearChat(chatId, user.id);
  }
}
