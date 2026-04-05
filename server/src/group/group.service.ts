import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChatType,
  MemberRole,
  MessageType,
  GroupPermissionRole,
  MessageStatus,
} from '@prisma/client';
import { ChatGateway } from '../chat/chat.gateway';

// Shape of permissions that can be provided to create/update a group.
export interface GroupPermissionsInput {
  editInfoRole?: GroupPermissionRole;
  sendMessagesRole?: GroupPermissionRole;
  addMembersRole?: GroupPermissionRole;
  approveMembersRole?: GroupPermissionRole;
}

// Full group include used for returning rich group objects to clients.
const groupInclude = {
  members: {
    where: { leftAt: null },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          countryCode: true,
          avatar: true,
          about: true,
          isOnline: true,
          lastSeen: true,
        },
      },
    },
  },
  creator: {
    select: { id: true, name: true, avatar: true },
  },
} as const;

@Injectable()
export class GroupService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
  ) {}

  // ==================== CREATE ====================

  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
    description?: string,
    avatar?: string,
    permissions?: GroupPermissionsInput,
  ) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Group name is required');
    }

    // Ensure creator is included (and deduped)
    const allMembers = [...new Set([creatorId, ...(memberIds || [])])];

    if (allMembers.length < 2) {
      throw new BadRequestException('Group must have at least 2 members');
    }

    // Verify all members exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: allMembers } },
      select: { id: true },
    });

    if (users.length !== allMembers.length) {
      throw new BadRequestException('One or more users not found');
    }

    const group = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name: name.trim(),
        description,
        avatar,
        creatorId,
        editInfoRole:
          permissions?.editInfoRole ?? GroupPermissionRole.ALL_MEMBERS,
        sendMessagesRole:
          permissions?.sendMessagesRole ?? GroupPermissionRole.ALL_MEMBERS,
        addMembersRole:
          permissions?.addMembersRole ?? GroupPermissionRole.ALL_MEMBERS,
        approveMembersRole:
          permissions?.approveMembersRole ?? GroupPermissionRole.ADMINS,
        members: {
          create: allMembers.map((memberId) => ({
            userId: memberId,
            role:
              memberId === creatorId ? MemberRole.ADMIN : MemberRole.MEMBER,
          })),
        },
      },
      include: groupInclude,
    });

    // System message: group created
    await this.emitSystemMessage(
      group.id,
      `${this.displayName(group.creator)} created group "${group.name}"`,
      allMembers,
    );

    return group;
  }

  // ==================== READ ====================

  async getGroup(groupId: string, userId: string) {
    const group = await this.prisma.chat.findUnique({
      where: { id: groupId },
      include: groupInclude,
    });

    if (!group || group.type !== ChatType.GROUP) {
      throw new NotFoundException('Group not found');
    }

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return group;
  }

  // ==================== UPDATE GROUP INFO ====================

  async updateGroup(
    groupId: string,
    userId: string,
    data: { name?: string; description?: string; avatar?: string },
  ) {
    const group = await this.ensureGroup(groupId);
    await this.ensureCanEditInfo(group, userId);

    const patch: Record<string, any> = {};
    const changes: string[] = [];

    if (data.name !== undefined && data.name.trim() !== group.name) {
      if (!data.name.trim()) {
        throw new BadRequestException('Group name cannot be empty');
      }
      patch.name = data.name.trim();
      changes.push(`changed the group name to "${patch.name}"`);
    }
    if (data.description !== undefined && data.description !== group.description) {
      patch.description = data.description;
      changes.push('updated the group description');
    }
    if (data.avatar !== undefined && data.avatar !== group.avatar) {
      patch.avatar = data.avatar;
      changes.push('changed the group icon');
    }

    if (Object.keys(patch).length === 0) {
      return this.prisma.chat.findUnique({ where: { id: groupId }, include: groupInclude });
    }

    const updated = await this.prisma.chat.update({
      where: { id: groupId },
      data: patch,
      include: groupInclude,
    });

    // Emit system message(s) and broadcast
    const actorName = await this.getUserDisplayName(userId);
    for (const change of changes) {
      await this.emitSystemMessage(
        groupId,
        `${actorName} ${change}`,
        updated.members.map((m) => m.userId),
      );
    }

    this.broadcastGroupUpdated(updated);
    return updated;
  }

  // ==================== UPDATE PERMISSIONS ====================

  async updatePermissions(
    groupId: string,
    userId: string,
    permissions: GroupPermissionsInput,
  ) {
    const group = await this.ensureGroup(groupId);
    // Permission changes are always admin-only regardless of editInfoRole
    await this.ensureAdmin(groupId, userId);

    const patch: Record<string, any> = {};
    if (permissions.editInfoRole !== undefined)
      patch.editInfoRole = permissions.editInfoRole;
    if (permissions.sendMessagesRole !== undefined)
      patch.sendMessagesRole = permissions.sendMessagesRole;
    if (permissions.addMembersRole !== undefined)
      patch.addMembersRole = permissions.addMembersRole;
    if (permissions.approveMembersRole !== undefined)
      patch.approveMembersRole = permissions.approveMembersRole;

    if (Object.keys(patch).length === 0) {
      return group;
    }

    const updated = await this.prisma.chat.update({
      where: { id: groupId },
      data: patch,
      include: groupInclude,
    });

    const actorName = await this.getUserDisplayName(userId);
    await this.emitSystemMessage(
      groupId,
      `${actorName} changed the group settings`,
      updated.members.map((m) => m.userId),
    );

    this.broadcastGroupUpdated(updated);
    return updated;
  }

  // ==================== MEMBER MANAGEMENT ====================

  async addMembers(groupId: string, actorId: string, memberIds: string[]) {
    const group = await this.ensureGroup(groupId);
    await this.ensureCanAddMembers(group, actorId);

    if (!memberIds || memberIds.length === 0) {
      throw new BadRequestException('No members provided');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, phone: true, countryCode: true },
    });

    if (users.length !== memberIds.length) {
      throw new BadRequestException('One or more users not found');
    }

    const addedUsers: { id: string; name: string; phone: string | null; countryCode: string }[] = [];

    for (const user of users) {
      const existing = await this.prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: groupId, userId: user.id } },
      });

      if (existing && !existing.leftAt) {
        continue; // Already an active member
      }

      if (existing) {
        await this.prisma.chatMember.update({
          where: { id: existing.id },
          data: { leftAt: null, joinedAt: new Date(), role: MemberRole.MEMBER },
        });
      } else {
        await this.prisma.chatMember.create({
          data: {
            chatId: groupId,
            userId: user.id,
            role: MemberRole.MEMBER,
          },
        });
      }

      addedUsers.push(user);
    }

    if (addedUsers.length === 0) {
      return { success: true, addedMembers: [] };
    }

    const actorName = await this.getUserDisplayName(actorId);
    const memberUserIds = await this.getActiveMemberIds(groupId);

    for (const u of addedUsers) {
      const display = u.name?.trim() ? u.name : `${u.countryCode}${u.phone ?? ''}`;
      await this.emitSystemMessage(
        groupId,
        `${actorName} added ${display}`,
        memberUserIds,
      );
    }

    const updated = await this.prisma.chat.findUnique({
      where: { id: groupId },
      include: groupInclude,
    });
    if (updated) this.broadcastGroupUpdated(updated);

    return { success: true, addedMembers: addedUsers.map((u) => u.id) };
  }

  async removeMember(groupId: string, actorId: string, memberId: string) {
    const group = await this.ensureGroup(groupId);

    // Self-removal = leave (always allowed, except creator can't "leave" without transfer)
    if (actorId !== memberId) {
      // Only admins can remove others. (editInfoRole also controls "remove members"
      // per spec, but removing users is treated as an admin-only action by default
      // to prevent abuse in ALL_MEMBERS groups.)
      await this.ensureAdmin(groupId, actorId);
    }

    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: groupId, userId: memberId } },
      include: {
        user: { select: { id: true, name: true, phone: true, countryCode: true } },
      },
    });

    if (!membership || membership.leftAt) {
      throw new NotFoundException('Member not found in group');
    }

    if (group.creatorId === memberId && actorId !== memberId) {
      throw new ForbiddenException('Cannot remove group creator');
    }

    await this.prisma.chatMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    const actorName = await this.getUserDisplayName(actorId);
    const targetName = membership.user.name?.trim()
      ? membership.user.name
      : `${membership.user.countryCode}${membership.user.phone ?? ''}`;

    const memberUserIds = await this.getActiveMemberIds(groupId);
    // Include the removed user so their client receives the event too.
    const notifyIds = Array.from(new Set([...memberUserIds, memberId]));

    const text =
      actorId === memberId
        ? `${targetName} left`
        : `${actorName} removed ${targetName}`;
    await this.emitSystemMessage(groupId, text, notifyIds);

    // Notify the removed user explicitly so their UI can drop the chat.
    this.chatGateway.sendToUser(memberId, 'group_member_removed', {
      chatId: groupId,
      userId: memberId,
    });

    const updated = await this.prisma.chat.findUnique({
      where: { id: groupId },
      include: groupInclude,
    });
    if (updated) this.broadcastGroupUpdated(updated);

    return { success: true };
  }

  async leaveGroup(groupId: string, userId: string) {
    return this.removeMember(groupId, userId, userId);
  }

  // ==================== ADMIN MANAGEMENT ====================

  async makeAdmin(groupId: string, actorId: string, memberId: string) {
    await this.ensureGroup(groupId);
    await this.ensureAdmin(groupId, actorId);

    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: groupId, userId: memberId } },
      include: { user: { select: { name: true, phone: true, countryCode: true } } },
    });

    if (!membership || membership.leftAt) {
      throw new NotFoundException('Member not found in group');
    }

    if (membership.role === MemberRole.ADMIN) {
      return { success: true };
    }

    await this.prisma.chatMember.update({
      where: { id: membership.id },
      data: { role: MemberRole.ADMIN },
    });

    const actorName = await this.getUserDisplayName(actorId);
    const targetName = membership.user.name?.trim()
      ? membership.user.name
      : `${membership.user.countryCode}${membership.user.phone ?? ''}`;

    const memberUserIds = await this.getActiveMemberIds(groupId);
    await this.emitSystemMessage(
      groupId,
      `${actorName} made ${targetName} an admin`,
      memberUserIds,
    );

    const updated = await this.prisma.chat.findUnique({
      where: { id: groupId },
      include: groupInclude,
    });
    if (updated) this.broadcastGroupUpdated(updated);

    return { success: true };
  }

  async removeAdmin(groupId: string, actorId: string, memberId: string) {
    const group = await this.ensureGroup(groupId);
    await this.ensureAdmin(groupId, actorId);

    if (group.creatorId === memberId) {
      throw new ForbiddenException(
        'Cannot remove admin status from group creator',
      );
    }

    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: groupId, userId: memberId } },
      include: { user: { select: { name: true, phone: true, countryCode: true } } },
    });

    if (!membership || membership.leftAt) {
      throw new NotFoundException('Member not found in group');
    }

    if (membership.role === MemberRole.MEMBER) {
      return { success: true };
    }

    await this.prisma.chatMember.update({
      where: { id: membership.id },
      data: { role: MemberRole.MEMBER },
    });

    const actorName = await this.getUserDisplayName(actorId);
    const targetName = membership.user.name?.trim()
      ? membership.user.name
      : `${membership.user.countryCode}${membership.user.phone ?? ''}`;

    const memberUserIds = await this.getActiveMemberIds(groupId);
    await this.emitSystemMessage(
      groupId,
      `${actorName} dismissed ${targetName} as admin`,
      memberUserIds,
    );

    const updated = await this.prisma.chat.findUnique({
      where: { id: groupId },
      include: groupInclude,
    });
    if (updated) this.broadcastGroupUpdated(updated);

    return { success: true };
  }

  // ==================== DELETE ====================

  async deleteGroup(groupId: string, userId: string) {
    const group = await this.ensureGroup(groupId);

    if (group.creatorId !== userId) {
      throw new ForbiddenException('Only group creator can delete the group');
    }

    const memberIds = await this.getActiveMemberIds(groupId);

    await this.prisma.chat.delete({ where: { id: groupId } });

    for (const uid of memberIds) {
      this.chatGateway.sendToUser(uid, 'group_deleted', { chatId: groupId });
    }

    return { success: true };
  }

  // ==================== PERMISSION CHECKS (PUBLIC) ====================

  /**
   * Throws if the user is not allowed to send messages in this group.
   * Called from ChatService.createMessage for GROUP chats.
   */
  async ensureCanSendMessage(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { type: true, sendMessagesRole: true },
    });
    if (!chat || chat.type !== ChatType.GROUP) return;

    if (chat.sendMessagesRole === GroupPermissionRole.ADMINS) {
      const membership = await this.prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (!membership || membership.leftAt) {
        throw new ForbiddenException('You are not a member of this group');
      }
      if (membership.role !== MemberRole.ADMIN) {
        throw new ForbiddenException(
          'Only admins can send messages in this group',
        );
      }
    }
  }

  // ==================== HELPERS ====================

  private async ensureGroup(groupId: string) {
    const group = await this.prisma.chat.findUnique({
      where: { id: groupId },
    });
    if (!group || group.type !== ChatType.GROUP) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  private async ensureAdmin(groupId: string, userId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: groupId, userId } },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (membership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }
  }

  private async ensureActiveMember(groupId: string, userId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: groupId, userId } },
    });
    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this group');
    }
    return membership;
  }

  private async ensureCanEditInfo(
    group: { id: string; editInfoRole: GroupPermissionRole },
    userId: string,
  ) {
    const membership = await this.ensureActiveMember(group.id, userId);
    if (
      group.editInfoRole === GroupPermissionRole.ADMINS &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only admins can edit group info in this group',
      );
    }
  }

  private async ensureCanAddMembers(
    group: { id: string; addMembersRole: GroupPermissionRole },
    userId: string,
  ) {
    const membership = await this.ensureActiveMember(group.id, userId);
    if (
      group.addMembersRole === GroupPermissionRole.ADMINS &&
      membership.role !== MemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only admins can add new members to this group',
      );
    }
  }

  private async getActiveMemberIds(groupId: string): Promise<string[]> {
    const members = await this.prisma.chatMember.findMany({
      where: { chatId: groupId, leftAt: null },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async getUserDisplayName(userId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true, countryCode: true },
    });
    if (!u) return 'Someone';
    if (u.name?.trim()) return u.name;
    return `${u.countryCode}${u.phone ?? ''}`;
  }

  private displayName(
    u?: { name?: string | null; avatar?: string | null; id?: string } | null,
  ): string {
    if (!u) return 'Someone';
    return u.name?.trim() ? u.name : 'Someone';
  }

  /**
   * Create a SYSTEM message (group event) and broadcast to all recipients.
   * System messages store pre-rendered human-readable text only — never raw JSON.
   */
  private async emitSystemMessage(
    chatId: string,
    text: string,
    recipientUserIds: string[],
  ) {
    // System messages have no sender in the traditional sense, but our Message
    // schema requires a senderId. We reuse the group creator as the sender to
    // satisfy the FK without exposing them as the "author" (clients filter on
    // type === 'SYSTEM' and render centered).
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { creatorId: true },
    });
    const senderId = chat?.creatorId;
    if (!senderId) return;

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        type: MessageType.SYSTEM,
        content: text,
        status: MessageStatus.SENT,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    for (const uid of recipientUserIds) {
      this.chatGateway.sendToUser(uid, 'new_message', message);
    }
  }

  private broadcastGroupUpdated(group: { id: string; members: { userId: string }[] }) {
    for (const m of group.members) {
      this.chatGateway.sendToUser(m.userId, 'group_updated', { chatId: group.id });
    }
  }
}
