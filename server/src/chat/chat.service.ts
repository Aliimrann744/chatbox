import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatDto, SendMessageDto } from './dto';
import {
  ChatType,
  MessageStatus,
  MessageType,
  MemberRole,
  GroupPermissionRole,
} from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ==================== CHAT OPERATIONS ====================

  async createPrivateChat(userId: string, participantId: string) {
    // Prevent chatting with yourself
    if (userId === participantId) {
      throw new BadRequestException('Cannot create a chat with yourself');
    }

    // Check if chat already exists between these users
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.PRIVATE,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: participantId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    if (existingChat) {
      return existingChat;
    }

    // Check if participant exists
    const participant = await this.prisma.user.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException('User not found');
    }

    // Check if blocked
    const isBlocked = await this.isBlocked(userId, participantId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot create chat with this user');
    }

    // Create new chat
    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.PRIVATE,
        members: {
          create: [
            { userId, role: MemberRole.MEMBER },
            { userId: participantId, role: MemberRole.MEMBER },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    return chat;
  }

  async createGroupChat(
    userId: string,
    name: string,
    participantIds: string[],
    description?: string,
    avatar?: string,
  ) {
    // Ensure creator is included
    const allMembers = [...new Set([userId, ...participantIds])];

    // Verify all participants exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: allMembers } },
    });

    if (users.length !== allMembers.length) {
      throw new BadRequestException('One or more users not found');
    }

    // Create group chat
    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name,
        description,
        avatar,
        creatorId: userId,
        members: {
          create: allMembers.map((memberId) => ({
            userId: memberId,
            role: memberId === userId ? MemberRole.ADMIN : MemberRole.MEMBER,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    return chat;
  }

  async getUserChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId,
            leftAt: null,
            isHidden: false,
          },
        },
      },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Format response with last message and unread count
    return Promise.all(
      chats.map(async (chat) => {
        const currentMember = chat.members.find((m) => m.userId === userId);
        const otherMembers = chat.members.filter((m) => m.userId !== userId);

        // Get last message excluding per-user deleted messages
        const lastMessages = await this.prisma.message.findMany({
          where: {
            chatId: chat.id,
            deletedAt: null,
            NOT: {
              deletedForUsers: {
                some: { userId },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, name: true },
            },
          },
        });

        const lastMessage = lastMessages[0] || null;

        // For private chats, use the other user's info as chat info
        // For private chats, use the other user's info.
        // If the other member was deleted (cascade removed their row),
        // otherMembers will be empty — show "Deleted Account" placeholder.
        const chatInfo =
          chat.type === ChatType.PRIVATE
            ? otherMembers.length > 0
              ? {
                  name: otherMembers[0].user.name,
                  avatar: otherMembers[0].user.avatar,
                  isOnline: otherMembers[0].user.isOnline,
                  lastSeen: otherMembers[0].user.lastSeen,
                }
              : {
                  name: 'Deleted Account',
                  avatar: null,
                  isOnline: false,
                  lastSeen: null,
                }
            : {
                name: chat.name,
                avatar: chat.avatar,
              };

        return {
          id: chat.id,
          type: chat.type,
          ...chatInfo,
          description: chat.description,
          lastMessage,
          unreadCount: currentMember?.unreadCount || 0,
          isPinned: currentMember?.isPinned || false,
          isMuted: currentMember?.isMuted || false,
          isArchived: currentMember?.isArchived || false,
          isFavorite: currentMember?.isFavorite || false,
          isMarkedUnread: currentMember?.isMarkedUnread || false,
          members: chat.members,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      }),
    );
  }

  async getChatById(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                about: true,
                isOnline: true,
                lastSeen: true,
                phone: true,
                countryCode: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const currentMember = chat.members.find((m) => m.userId === userId);
    if (!currentMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    return {
      ...chat,
      isPinned: currentMember.isPinned,
      isMuted: currentMember.isMuted,
      isArchived: currentMember.isArchived,
      isFavorite: currentMember.isFavorite,
      mediaVisibility: currentMember.mediaVisibility,
    };
  }

  // ==================== MESSAGE OPERATIONS ====================

  async createMessage(senderId: string, dto: SendMessageDto) {
    // Verify user is a member of the chat
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: dto.chatId,
          userId: senderId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Enforce group send-messages permission
    const chat = await this.prisma.chat.findUnique({
      where: { id: dto.chatId },
      select: { type: true, sendMessagesRole: true },
    });
    if (
      chat?.type === ChatType.GROUP &&
      chat.sendMessagesRole === GroupPermissionRole.ADMINS &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only admins can send messages in this group',
      );
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        chatId: dto.chatId,
        senderId,
        type: dto.type,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
        mediaDuration: dto.mediaDuration,
        thumbnail: dto.thumbnail,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationName: dto.locationName,
        replyToId: dto.replyToId,
        isForwarded: dto.isForwarded || false,
        status: MessageStatus.SENT,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Update chat's updatedAt
    await this.prisma.chat.update({
      where: { id: dto.chatId },
      data: { updatedAt: new Date() },
    });

    // Increment unread count for other members and unhide the chat
    // so deleted chats reappear when a new message arrives.
    await this.prisma.chatMember.updateMany({
      where: {
        chatId: dto.chatId,
        userId: { not: senderId },
        leftAt: null,
      },
      data: {
        unreadCount: { increment: 1 },
        isHidden: false,
      },
    });

    return message;
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    // Verify user is a member
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          chatId,
          deletedAt: null,
          // Exclude messages the current user has "deleted for me"
          NOT: {
            deletedForUsers: {
              some: { userId },
            },
          },
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          readReceipts: {
            select: {
              userId: true,
              readAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: {
          chatId,
          deletedAt: null,
          NOT: {
            deletedForUsers: {
              some: { userId },
            },
          },
        },
      }),
    ]);

    return {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    };
  }

  async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    userId?: string,
  ) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });

    // If read, create read receipt
    if (status === MessageStatus.READ && userId) {
      await this.prisma.messageReadReceipt.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
        create: {
          messageId,
          userId,
        },
        update: {
          readAt: new Date(),
        },
      });
    }

    return message;
  }

  async markMessagesAsRead(chatId: string, userId: string) {
    // Get all unread messages in this chat not sent by user
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        chatId,
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
      select: { id: true, senderId: true },
    });

    if (unreadMessages.length === 0) return [];

    // Update message statuses
    await this.prisma.message.updateMany({
      where: {
        id: { in: unreadMessages.map((m) => m.id) },
      },
      data: { status: MessageStatus.READ },
    });

    // Create read receipts
    await this.prisma.messageReadReceipt.createMany({
      data: unreadMessages.map((m) => ({
        messageId: m.id,
        userId,
      })),
      skipDuplicates: true,
    });

    // Reset unread count and clear manual unread marker
    await this.prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: { unreadCount: 0, lastReadAt: new Date(), isMarkedUnread: false },
    });

    return unreadMessages;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // Soft delete
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  // ==================== MESSAGE DELIVERY (REST) ====================

  /**
   * Mark all SENT messages in a specific chat as DELIVERED for a user.
   * Called via REST API from background FCM handler.
   */
  async markChatMessagesDelivered(chatId: string, userId: string) {
    const result = await this.prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        status: MessageStatus.SENT,
        isDeletedForEveryone: false,
      },
      data: { status: MessageStatus.DELIVERED },
    });

    return { updated: result.count };
  }

  // ==================== PENDING MESSAGE DELIVERY ====================

  /**
   * Find all messages in the user's chats that are still SENT (not delivered).
   * Called when a user reconnects — marks them DELIVERED and returns them
   * so the gateway can notify senders about the status change.
   */
  async deliverPendingMessages(userId: string): Promise<
    { messageId: string; senderId: string; chatId: string }[]
  > {
    // Get all chats this user is a member of
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      select: { chatId: true },
    });

    const chatIds = memberships.map((m) => m.chatId);
    if (chatIds.length === 0) return [];

    // Find all SENT messages in these chats that are NOT from this user
    const pendingMessages = await this.prisma.message.findMany({
      where: {
        chatId: { in: chatIds },
        senderId: { not: userId },
        status: MessageStatus.SENT,
        isDeletedForEveryone: false,
      },
      select: { id: true, senderId: true, chatId: true },
    });

    if (pendingMessages.length === 0) return [];

    // Batch update all to DELIVERED
    await this.prisma.message.updateMany({
      where: {
        id: { in: pendingMessages.map((m) => m.id) },
        status: MessageStatus.SENT,
      },
      data: { status: MessageStatus.DELIVERED },
    });

    console.log(
      `Marked ${pendingMessages.length} messages as DELIVERED for user ${userId}`,
    );

    return pendingMessages.map((m) => ({
      messageId: m.id,
      senderId: m.senderId,
      chatId: m.chatId,
    }));
  }

  // ==================== HELPER METHODS ====================

  async getChatBasicInfo(chatId: string) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, type: true, name: true },
    });
  }

  async getChatMembers(chatId: string) {
    return this.prisma.chatMember.findMany({
      where: {
        chatId,
        leftAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            fcmToken: true,
          },
        },
      },
    });
  }

  async setUserOnline(userId: string, isOnline: boolean) {
    // updateMany() silently matches 0 rows if the user was deleted while their
    // socket was still connected, avoiding a noisy "No record was found" throw.
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: {
        isOnline,
        lastSeen: isOnline ? undefined : new Date(),
      },
    });
  }

  async getUserContacts(userId: string) {
    return this.prisma.contact.findMany({
      where: { userId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            avatar: true,
            isOnline: true,
            lastSeen: true,
          },
        },
      },
    });
  }

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const blocked = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      },
    });
    return !!blocked;
  }

  async getMessage(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async pinChat(chatId: string, userId: string, isPinned: boolean) {
    if (isPinned) {
      const pinnedCount = await this.prisma.chatMember.count({
        where: { userId, isPinned: true },
      });
      if (pinnedCount >= 3) {
        throw new BadRequestException('You can only pin up to 3 chats. Please unpin one first.');
      }
    }

    await this.prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: { isPinned },
    });
    return { success: true };
  }

  async muteChat(
    chatId: string,
    userId: string,
    isMuted: boolean,
    muteUntil?: Date,
  ) {
    await this.prisma.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: { isMuted, muteUntil },
    });
    return { success: true };
  }

  // Star a message
  async starMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.starredMessage.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: {},
    });
  }

  // Unstar a message
  async unstarMessage(userId: string, messageId: string) {
    await this.prisma.starredMessage.deleteMany({
      where: { messageId, userId },
    });
    return { success: true };
  }

  // Get starred messages for a user in a chat
  async getStarredMessages(userId: string, chatId: string) {
    const starredMessages = await this.prisma.starredMessage.findMany({
      where: {
        userId,
        message: { chatId },
      },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return starredMessages.map(s => s.message);
  }

  // Get all starred messages across every chat the user participates in.
  // Used by the Shared screen — returns each message enriched with chat
  // info (name/avatar/type) so the UI can render a global list.
  async getAllStarredMessages(userId: string) {
    const starred = await this.prisma.starredMessage.findMany({
      where: { userId },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, name: true, avatar: true },
            },
            chat: {
              include: {
                members: {
                  where: { leftAt: null },
                  include: {
                    user: {
                      select: { id: true, name: true, avatar: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return starred
      // Skip messages the current user deleted for themselves, as well as
      // any "deleted for everyone" rows — they have no content left.
      .filter((s) => !!s.message && !s.message.isDeletedForEveryone)
      .map((s) => {
        const message = s.message;
        const chat = message.chat;
        const otherMember =
          chat.type === ChatType.PRIVATE
            ? chat.members.find((m) => m.userId !== userId)
            : null;

        const chatInfo =
          chat.type === ChatType.PRIVATE && otherMember
            ? {
                id: chat.id,
                type: chat.type,
                name: otherMember.user.name,
                avatar: otherMember.user.avatar,
              }
            : {
                id: chat.id,
                type: chat.type,
                name: chat.name,
                avatar: chat.avatar,
              };

        // Strip chat.members to keep the response small.
        const { chat: _chat, ...messageRest } = message as any;
        return {
          ...messageRest,
          starredAt: s.createdAt,
          chat: chatInfo,
        };
      });
  }

  // ==================== MARK ALL CHATS AS READ ====================
  // Used by the "Read all" menu entry. Marks every unread incoming message
  // across every chat the user participates in as READ and resets each
  // chat's unread counter. Returns the affected messages grouped by sender
  // so the gateway can emit read receipts to the right sockets.
  async markAllChatsAsRead(userId: string) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      select: { chatId: true },
    });

    const chatIds = memberships.map((m) => m.chatId);
    if (chatIds.length === 0) {
      return { affected: [] as { messageId: string; senderId: string; chatId: string }[] };
    }

    const unreadMessages = await this.prisma.message.findMany({
      where: {
        chatId: { in: chatIds },
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
        isDeletedForEveryone: false,
      },
      select: { id: true, senderId: true, chatId: true },
    });

    if (unreadMessages.length > 0) {
      await this.prisma.message.updateMany({
        where: { id: { in: unreadMessages.map((m) => m.id) } },
        data: { status: MessageStatus.READ },
      });

      await this.prisma.messageReadReceipt.createMany({
        data: unreadMessages.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }

    // Reset unread counters for every chat the user belongs to.
    await this.prisma.chatMember.updateMany({
      where: { userId, leftAt: null },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });

    return {
      affected: unreadMessages.map((m) => ({
        messageId: m.id,
        senderId: m.senderId,
        chatId: m.chatId,
      })),
    };
  }

  // Edit a message (only sender, only TEXT, within 15 minutes)
  async editMessage(userId: string, messageId: string, content: string) {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { members: true } } },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (message.isDeletedForEveryone) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    if (message.type !== MessageType.TEXT) {
      throw new BadRequestException('Only text messages can be edited');
    }

    const minutesSinceSent = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60);
    if (minutesSinceSent > 15) {
      throw new BadRequestException('You can only edit messages within 15 minutes of sending');
    }

    const editedAt = new Date();
    await this.prisma.message.update({
      where: { id: messageId },
      data: { content: trimmed, isEdited: true, editedAt },
    });

    return {
      messageId,
      chatId: message.chatId,
      senderId: message.senderId,
      content: trimmed,
      editedAt: editedAt.toISOString(),
      memberUserIds: message.chat.members.map((m) => m.userId),
    };
  }

  // Set media visibility for a chat member (controls auto-save of incoming media)
  async setMediaVisibility(chatId: string, userId: string, mediaVisibility: boolean) {
    await this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { mediaVisibility },
    });
    return { success: true, mediaVisibility };
  }

  // Delete message for everyone
  async deleteMessageForEveryone(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: { include: { members: true } } },
    });

    if (!message) throw new NotFoundException('Message not found');

    // Only the sender can delete for everyone
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages for everyone');
    }

    // Time limit: 24 hours
    const hoursSinceSent = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSent > 24) {
      throw new BadRequestException('You can only delete messages for everyone within 24 hours of sending');
    }

    // Mark as deleted for everyone (keep the message row, just flag it)
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeletedForEveryone: true,
        content: null,
        mediaUrl: null,
        thumbnail: null,
        fileName: null,
      },
    });

    return {
      messageId,
      chatId: message.chatId,
      senderId: message.senderId,
      memberUserIds: message.chat.members.map(m => m.userId),
    };
  }

  // Delete messages only for the current user (per-user tracking)
  async deleteMessagesForMe(userId: string, messageIds: string[]) {
    for (const messageId of messageIds) {
      // Verify message exists
      const message = await this.prisma.message.findUnique({ where: { id: messageId } });
      if (!message) continue;

      // Create per-user deletion record (upsert to avoid duplicates)
      await this.prisma.deletedMessageForUser.upsert({
        where: { messageId_userId: { messageId, userId } },
        create: { messageId, userId },
        update: {},
      });
    }
    return { success: true, messageIds };
  }

  // Clear all messages in a chat for the current user only (per-user, like WhatsApp)
  async clearChat(chatId: string, userId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    // Get all message IDs in this chat that haven't already been deleted for this user
    const messages = await this.prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        NOT: {
          deletedForUsers: {
            some: { userId },
          },
        },
      },
      select: { id: true },
    });

    // Create per-user deletion records in bulk (only affects requesting user)
    if (messages.length > 0) {
      await this.prisma.deletedMessageForUser.createMany({
        data: messages.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }

    // Reset unread count
    await this.prisma.chatMember.update({
      where: {
        chatId_userId: { chatId, userId },
      },
      data: { unreadCount: 0 },
    });

    return { success: true };
  }

  // Archive/unarchive a chat
  async archiveChat(chatId: string, userId: string, isArchived: boolean) {
    await this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { isArchived },
    });
    return { success: true };
  }

  // Favorite/unfavorite a chat
  async favoriteChat(chatId: string, userId: string, isFavorite: boolean) {
    await this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { isFavorite },
    });
    return { success: true };
  }

  // Mark chat as unread
  async markChatUnread(chatId: string, userId: string) {
    await this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { isMarkedUnread: true },
    });
    return { success: true };
  }

  // Delete (hide) a chat from the user's list.
  // The chat reappears automatically when a new message arrives
  // (createMessage unsets isHidden for all members).
  async hideChat(chatId: string, userId: string) {
    await this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { isHidden: true, unreadCount: 0 },
    });
    return { success: true };
  }

  // Get shared media from a chat
  async getSharedMedia(chatId: string, userId: string, type?: string, page: number = 1, limit: number = 50) {
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: { chatId, userId },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const mediaTypes = type
      ? [type]
      : ['IMAGE', 'VIDEO', 'DOCUMENT'];

    const skip = (page - 1) * limit;

    const mediaWhere = {
      chatId,
      type: { in: mediaTypes as any },
      deletedAt: null,
      isDeletedForEveryone: false,
      mediaUrl: { not: null },
      NOT: {
        deletedForUsers: {
          some: { userId },
        },
      },
    };

    const [media, total] = await Promise.all([
      this.prisma.message.findMany({
        where: mediaWhere,
        select: {
          id: true,
          type: true,
          mediaUrl: true,
          mediaType: true,
          thumbnail: true,
          fileName: true,
          fileSize: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: mediaWhere,
      }),
    ]);

    return {
      media,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + media.length < total,
      },
    };
  }

  async createCallLogMessage(
    callerId: string,
    receiverId: string,
    callType: 'VOICE' | 'VIDEO',
    callStatus: string,
    duration: number | null,
  ) {
    // Find existing private chat between caller and receiver
    let chat = await this.prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { members: { some: { userId: callerId } } },
          { members: { some: { userId: receiverId } } },
        ],
      },
    });

    // If no chat exists, create one
    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          type: 'PRIVATE',
          members: {
            create: [
              { userId: callerId, role: 'MEMBER' },
              { userId: receiverId, role: 'MEMBER' },
            ],
          },
        },
      });
    }

    // Build call log content as JSON string
    const callInfo = JSON.stringify({
      callType,
      callStatus,
      duration,
    });

    // Create the call log message (sent by the caller)
    const message = await this.prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: callerId,
        type: 'CALL',
        content: callInfo,
        status: 'SENT',
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Touch chat's updatedAt so it sorts to top
    await this.prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    return message;
  }
}
