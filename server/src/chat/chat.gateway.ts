import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto';
import { MessageStatus } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Store connected users: Map<userId, socketId>
  private connectedUsers = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private chatService: ChatService,
  ) {}

  // ==================== CONNECTION HANDLING ====================

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('No token provided, disconnecting client');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;

      // Store connection
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;

      // Join user's personal room
      client.join(`user_${userId}`);

      // Update online status in database
      await this.chatService.setUserOnline(userId, true);

      // Notify contacts that user is online
      await this.broadcastOnlineStatus(userId, true);
      console.log(`User ${userId} connected with socket ${client.id}`);
      client.emit('connected', { userId, socketId: client.id });
    } catch (error) {
      console.log('Connection error:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      this.connectedUsers.delete(userId);

      try {
        await this.chatService.setUserOnline(userId, false);
        await this.broadcastOnlineStatus(userId, false);
      } catch (error) {
        console.log(`Cleanup failed for user ${userId}:`, error.message);
      }

      console.log(`User ${userId} disconnected`);
    }
  }

  // ==================== MESSAGING ====================

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto & { tempId?: string },
  ) {
    const senderId = client.data.userId;

    try {
      // Save message to database
      const message = await this.chatService.createMessage(senderId, data);

      // Send confirmation to sender (single tick)
      client.emit('message_sent', {
        tempId: data.tempId,
        message,
      });

      // Get chat members
      const members = await this.chatService.getChatMembers(data.chatId);

      // Send message to all other members
      for (const member of members) {
        if (member.userId !== senderId) {
          const recipientSocketId = this.connectedUsers.get(member.userId);

          if (recipientSocketId) {
            // User is online - send via WebSocket
            this.server.to(recipientSocketId).emit('new_message', message);
          }
          // TODO: Send push notification if offline
        }
      }

      return { success: true, message };
    } catch (error) {
      client.emit('message_error', {
        tempId: data.tempId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = client.data.userId;

    try {
      // Update message status
      const message = await this.chatService.updateMessageStatus(
        data.messageId,
        MessageStatus.DELIVERED,
      );

      // Notify sender
      const senderSocketId = this.connectedUsers.get(message.senderId);
      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message_status', {
          messageId: data.messageId,
          status: MessageStatus.DELIVERED,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;

    try {
      // Mark all messages as read
      const readMessages = await this.chatService.markMessagesAsRead(data.chatId, userId);

      // Notify senders about read status
      const senderIds: any = [...new Set(readMessages.map((m: { id: string; senderId: string }) => m.senderId))];

      for (const senderId of senderIds) {
        const senderSocketId = this.connectedUsers.get(senderId);
        if (senderSocketId) {
          const senderMessages = readMessages.filter((m) => m.senderId === senderId).map((m) => m.id);

          this.server.to(senderSocketId).emit('messages_read', {
            chatId: data.chatId, messageIds: senderMessages, readBy: userId,
          });
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== TYPING INDICATOR ====================

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;

    // Get chat members and notify them
    const members = await this.chatService.getChatMembers(data.chatId);

    for (const member of members) {
      if (member.userId !== userId) {
        const socketId = this.connectedUsers.get(member.userId);
        if (socketId) {
          this.server.to(socketId).emit('user_typing', {
            chatId: data.chatId,
            userId,
            isTyping: true,
          });
        }
      }
    }
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;

    const members = await this.chatService.getChatMembers(data.chatId);

    for (const member of members) {
      if (member.userId !== userId) {
        const socketId = this.connectedUsers.get(member.userId);
        if (socketId) {
          this.server.to(socketId).emit('user_typing', {
            chatId: data.chatId,
            userId,
            isTyping: false,
          });
        }
      }
    }
  }

  // ==================== ONLINE STATUS ====================

  private async broadcastOnlineStatus(userId: string, isOnline: boolean) {
    // Get user's contacts
    const contacts = await this.chatService.getUserContacts(userId);

    for (const contact of contacts) {
      const socketId = this.connectedUsers.get(contact.contactId);
      if (socketId) {
        this.server.to(socketId).emit('online_status', {
          userId,
          isOnline,
          lastSeen: isOnline ? null : new Date(),
        });
      }
    }
  }

  @SubscribeMessage('get_online_status')
  async handleGetOnlineStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userIds: string[] },
  ) {
    const onlineStatuses = data.userIds.map((userId) => ({
      userId,
      isOnline: this.connectedUsers.has(userId),
    }));

    return { statuses: onlineStatuses };
  }

  // ==================== CHAT ROOMS ====================

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    client.join(`chat_${data.chatId}`);
    return { success: true };
  }

  @SubscribeMessage('leave_chat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    client.leave(`chat_${data.chatId}`);
    return { success: true };
  }

  // ==================== UTILITY METHODS ====================

  // Get socket ID for a user (useful for other services)
  getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Send event to specific user
  sendToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }
}
