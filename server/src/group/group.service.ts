import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatType, MemberRole } from '@prisma/client';

@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}

  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
    description?: string,
    avatar?: string,
  ) {
    // Ensure creator is included
    const allMembers = [...new Set([creatorId, ...memberIds])];

    if (allMembers.length < 2) {
      throw new BadRequestException('Group must have at least 2 members');
    }

    // Verify all members exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: allMembers } },
    });

    if (users.length !== allMembers.length) {
      throw new BadRequestException('One or more users not found');
    }

    // Create group
    const group = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        name,
        description,
        avatar,
        creatorId,
        members: {
          create: allMembers.map((memberId) => ({
            userId: memberId,
            role: memberId === creatorId ? MemberRole.ADMIN : MemberRole.MEMBER,
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
                isOnline: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return group;
  }

  async getGroup(groupId: string, userId: string) {
    const group = await this.prisma.chat.findUnique({
      where: { id: groupId, type: ChatType.GROUP },
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
        creator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is a member
    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return group;
  }

  async updateGroup(
    groupId: string,
    userId: string,
    data: { name?: string; description?: string; avatar?: string },
  ) {
    // Check if user is admin
    await this.ensureAdmin(groupId, userId);

    return this.prisma.chat.update({
      where: { id: groupId },
      data: {
        name: data.name,
        description: data.description,
        avatar: data.avatar,
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
              },
            },
          },
        },
      },
    });
  }

  async addMembers(groupId: string, adminId: string, memberIds: string[]) {
    // Check if user is admin
    await this.ensureAdmin(groupId, adminId);

    // Verify all new members exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
    });

    if (users.length !== memberIds.length) {
      throw new BadRequestException('One or more users not found');
    }

    // Add members
    const addedMembers = [];
    for (const memberId of memberIds) {
      // Check if already a member
      const existing = await this.prisma.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId: groupId,
            userId: memberId,
          },
        },
      });

      if (existing && !existing.leftAt) {
        continue; // Already a member
      }

      if (existing) {
        // Rejoin
        await this.prisma.chatMember.update({
          where: { id: existing.id },
          data: { leftAt: null, joinedAt: new Date() },
        });
      } else {
        // New member
        await this.prisma.chatMember.create({
          data: {
            chatId: groupId,
            userId: memberId,
            role: MemberRole.MEMBER,
          },
        });
      }

      addedMembers.push(memberId);
    }

    return { success: true, addedMembers };
  }

  async removeMember(groupId: string, adminId: string, memberId: string) {
    // Check if user is admin (unless removing self)
    if (adminId !== memberId) {
      await this.ensureAdmin(groupId, adminId);
    }

    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: groupId,
          userId: memberId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new NotFoundException('Member not found in group');
    }

    // Cannot remove creator
    const group = await this.prisma.chat.findUnique({
      where: { id: groupId },
    });

    if (group?.creatorId === memberId && adminId !== memberId) {
      throw new ForbiddenException('Cannot remove group creator');
    }

    // Mark as left
    await this.prisma.chatMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    return { success: true };
  }

  async leaveGroup(groupId: string, userId: string) {
    return this.removeMember(groupId, userId, userId);
  }

  async makeAdmin(groupId: string, adminId: string, memberId: string) {
    await this.ensureAdmin(groupId, adminId);

    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: groupId,
          userId: memberId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new NotFoundException('Member not found in group');
    }

    await this.prisma.chatMember.update({
      where: { id: membership.id },
      data: { role: MemberRole.ADMIN },
    });

    return { success: true };
  }

  async removeAdmin(groupId: string, adminId: string, memberId: string) {
    await this.ensureAdmin(groupId, adminId);

    // Cannot remove creator's admin status
    const group = await this.prisma.chat.findUnique({
      where: { id: groupId },
    });

    if (group?.creatorId === memberId) {
      throw new ForbiddenException('Cannot remove admin status from group creator');
    }

    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: groupId,
          userId: memberId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new NotFoundException('Member not found in group');
    }

    await this.prisma.chatMember.update({
      where: { id: membership.id },
      data: { role: MemberRole.MEMBER },
    });

    return { success: true };
  }

  async deleteGroup(groupId: string, userId: string) {
    const group = await this.prisma.chat.findUnique({
      where: { id: groupId, type: ChatType.GROUP },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.creatorId !== userId) {
      throw new ForbiddenException('Only group creator can delete the group');
    }

    await this.prisma.chat.delete({
      where: { id: groupId },
    });

    return { success: true };
  }

  private async ensureAdmin(groupId: string, userId: string) {
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: groupId,
          userId,
        },
      },
    });

    if (!membership || membership.leftAt) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (membership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only admins can perform this action');
    }
  }
}
