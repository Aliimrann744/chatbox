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
import { MessageStatus, ChatType } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // A user may have several live app sessions (multiple devices or a socket
  // reconnect overlapping the old disconnect callback). Presence changes only
  // when the first socket connects or the final socket disconnects.
  private connectedUsers = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private chatService: ChatService,
    private notificationService: NotificationService,
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

      const sockets = this.connectedUsers.get(userId) ?? new Set<string>();
      const wasOffline = sockets.size === 0;
      sockets.add(client.id);
      this.connectedUsers.set(userId, sockets);
      client.data.userId = userId;

      // Join user's personal room
      client.join(`user_${userId}`);

      if (wasOffline) {
        await this.chatService.setUserOnline(userId, true);
        await this.broadcastOnlineStatus(userId);
      }
      console.log(`User ${userId} connected with socket ${client.id}`);
      client.emit('connected', { userId, socketId: client.id });

      // Deliver pending messages (SENT → DELIVERED) and notify senders
      try {
        const delivered = await this.chatService.deliverPendingMessages(userId);
        for (const msg of delivered) {
          const senderSocketId = this.getSocketId(msg.senderId);
          if (senderSocketId) {
            this.server.to(senderSocketId).emit('message_status', {
              messageId: msg.messageId,
              status: 'DELIVERED',
            });
          }
        }
        if (delivered.length > 0) {
          console.log(`Delivered ${delivered.length} pending messages for user ${userId}`);
        }
      } catch (err) {
        console.error('Failed to deliver pending messages:', err.message);
      }
    } catch (error) {
      console.log('Connection error:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      const sockets = this.connectedUsers.get(userId);
      sockets?.delete(client.id);
      if (sockets && sockets.size > 0) return;
      this.connectedUsers.delete(userId);

      try {
        await this.chatService.setUserOnline(userId, false);
        await this.broadcastOnlineStatus(userId);
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

      // Get chat details for group notification context
      const chat = await this.chatService.getChatBasicInfo(data.chatId);
      const sender = await this.notificationService.getUserWithDetails(senderId);
      const senderName = sender?.name || 'Someone';
      const messagePreview = this.notificationService.getMessagePreview(
        data.type || 'TEXT',
        data.content,
      );

      // Broadcast to the chat room FIRST — anyone currently subscribed to
      // this chat (via join_chat) receives it regardless of whether our
      // connectedUsers map is up to date. `client.broadcast.to(...)` skips
      // the sender; the sender already got `message_sent` above.
      client.broadcast.to(`chat_${data.chatId}`).emit('new_message', message);

      // Also direct-emit to each member's personal user_<id> room as a
      // backup — covers members who are connected but haven't called
      // join_chat yet (e.g. they're on the chat list). And for anyone
      // offline, fall back to FCM push.
      for (const member of members) {
        if (member.userId === senderId) continue;
        const recipientSocketId = this.getSocketId(member.userId);
        if (recipientSocketId) {
          this.server.to(`user_${member.userId}`).emit('new_message', message);
        } else {
          this.notificationService.sendMessageNotification(
            member.userId,
            senderName,
            messagePreview,
            data.chatId,
            senderId,
            chat?.type === ChatType.GROUP ? 'GROUP' : 'PRIVATE',
            chat?.name || undefined,
          ).catch((err) =>
            console.error('Push notification failed:', err.message),
          );
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
      const senderSocketId = this.getSocketId(message.senderId);
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
        const senderSocketId = this.getSocketId(senderId);
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
        const socketId = this.getSocketId(member.userId);
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
        const socketId = this.getSocketId(member.userId);
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

  private async broadcastOnlineStatus(userId: string) {
    const recipientIds = await this.chatService.getPresenceRecipientIds(userId);
    for (const recipientId of recipientIds) {
      if (!this.connectedUsers.has(recipientId)) continue;
      const presence = await this.chatService.getPresenceForViewer(recipientId, userId);
      if (presence) this.server.to(`user_${recipientId}`).emit('online_status', presence);
    }
  }

  @SubscribeMessage('get_online_status')
  async handleGetOnlineStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userIds: string[] },
  ) {
    const viewerId = client.data.userId;
    const onlineStatuses = (await Promise.all(
      data.userIds.map((userId) => this.chatService.getPresenceForViewer(viewerId, userId)),
    )).filter(Boolean);

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

  // ==================== DELETE & STAR MESSAGES ====================

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; forEveryone: boolean },
  ) {
    const userId = client.data.userId;

    try {
      if (data.forEveryone) {
        const result = await this.chatService.deleteMessageForEveryone(userId, data.messageId);

        // Notify all chat members about the "deleted for everyone" placeholder
        for (const memberUserId of result.memberUserIds) {
          const socketId = this.getSocketId(memberUserId);
          if (socketId) {
            this.server.to(socketId).emit('message_deleted_for_everyone', {
              messageId: result.messageId,
              chatId: result.chatId,
              senderId: result.senderId,
            });
          }
        }

        return { success: true };
      } else {
        await this.chatService.deleteMessagesForMe(userId, [data.messageId]);
        // Only notify the requesting user
        client.emit('message_deleted', {
          messageId: data.messageId,
        });
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('delete_messages')
  async handleDeleteMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageIds: string[]; forEveryone: boolean },
  ) {
    const userId = client.data.userId;

    try {
      if (data.forEveryone) {
        for (const messageId of data.messageIds) {
          try {
            const result = await this.chatService.deleteMessageForEveryone(userId, messageId);
            for (const memberUserId of result.memberUserIds) {
              const socketId = this.getSocketId(memberUserId);
              if (socketId) {
                this.server.to(socketId).emit('message_deleted_for_everyone', {
                  messageId: result.messageId,
                  chatId: result.chatId,
                  senderId: result.senderId,
                });
              }
            }
          } catch {}
        }
        return { success: true };
      } else {
        await this.chatService.deleteMessagesForMe(userId, data.messageIds);
        for (const messageId of data.messageIds) {
          client.emit('message_deleted', { messageId });
        }
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('mark_all_read')
  async handleMarkAllRead(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    try {
      const { affected } = await this.chatService.markAllChatsAsRead(userId);

      // Group affected messages by sender so each sender receives a single
      // `messages_read` event per chat with the IDs that are now READ.
      const bySenderChat = new Map<string, Map<string, string[]>>();
      for (const item of affected) {
        if (!bySenderChat.has(item.senderId)) {
          bySenderChat.set(item.senderId, new Map());
        }
        const chatMap = bySenderChat.get(item.senderId)!;
        if (!chatMap.has(item.chatId)) chatMap.set(item.chatId, []);
        chatMap.get(item.chatId)!.push(item.messageId);
      }

      for (const [senderId, chatMap] of bySenderChat) {
        const senderSocketId = this.getSocketId(senderId);
        if (!senderSocketId) continue;
        for (const [chatId, messageIds] of chatMap) {
          this.server.to(senderSocketId).emit('messages_read', {
            chatId,
            messageIds,
            readBy: userId,
          });
        }
      }

      return { success: true, count: affected.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const userId = client.data.userId;
    try {
      const result = await this.chatService.editMessage(userId, data.messageId, data.content);
      for (const memberUserId of result.memberUserIds) {
        const socketId = this.getSocketId(memberUserId);
        if (socketId) {
          this.server.to(socketId).emit('message_edited', {
            messageId: result.messageId,
            chatId: result.chatId,
            senderId: result.senderId,
            content: result.content,
            editedAt: result.editedAt,
          });
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('star_message')
  async handleStarMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; starred: boolean },
  ) {
    const userId = client.data.userId;

    try {
      if (data.starred) {
        await this.chatService.starMessage(userId, data.messageId);
      } else {
        await this.chatService.unstarMessage(userId, data.messageId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== UTILITY METHODS ====================

  // Get socket ID for a user (useful for other services)
  getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId)?.values().next().value;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Send event to specific user
  sendToUser(userId: string, event: string, data: any) {
    if (this.connectedUsers.has(userId)) this.server.to(`user_${userId}`).emit(event, data);
  }
}
