import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatusService {
  constructor(private prisma: PrismaService) {}

  async createStatus(userId: string, data: { type: 'IMAGE' | 'VIDEO'; mediaUrl: string; thumbnail?: string; caption?: string }) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return this.prisma.status.create({
      data: {
        userId,
        type: data.type,
        mediaUrl: data.mediaUrl,
        thumbnail: data.thumbnail,
        caption: data.caption,
        expiresAt,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        _count: { select: { views: true } },
      },
    });
  }

  async getMyStatuses(userId: string) {
    const statuses = await this.prisma.status.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        views: {
          include: {
            viewer: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { viewedAt: 'desc' },
        },
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return statuses.map((s) => ({
      ...s,
      viewCount: s._count.views,
      _count: undefined,
    }));
  }

  async getContactStatuses(userId: string) {
    // Get users I added as contacts — show their statuses to me
    const contacts = await this.prisma.contact.findMany({
      where: { userId: userId }, select: { contactId: true },
    });

    const contactIds = contacts.map((c) => c.contactId);
    if (contactIds.length === 0) return [];

    // Get non-expired statuses from contacts
    const statuses = await this.prisma.status.findMany({
      where: {
        userId: { in: contactIds },
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        views: {
          where: { viewerId: userId },
          select: { id: true },
        },
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by user
    const groupMap = new Map<
      string,
      {
        user: { id: string; name: string; avatar: string | null };
        statuses: any[];
        hasUnviewed: boolean;
        latestAt: string;
      }
    >();

    for (const status of statuses) {
      const uid = status.userId;
      const viewed = status.views.length > 0;

      if (!groupMap.has(uid)) {
        groupMap.set(uid, {
          user: status.user,
          statuses: [],
          hasUnviewed: false,
          latestAt: status.createdAt.toISOString(),
        });
      }

      const group = groupMap.get(uid)!;
      group.statuses.push({
        ...status,
        viewCount: status._count.views,
        isViewed: viewed,
        views: undefined,
        _count: undefined,
      });

      if (!viewed) group.hasUnviewed = true;
      if (status.createdAt.toISOString() > group.latestAt) {
        group.latestAt = status.createdAt.toISOString();
      }
    }

    // Sort: unviewed first, then by latest status time desc
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });
  }

  async viewStatus(statusId: string, viewerId: string) {
    const status = await this.prisma.status.findUnique({
      where: { id: statusId },
    });

    if (!status) throw new NotFoundException('Status not found');

    // Don't record self-views
    if (status.userId === viewerId) {
      const count = await this.prisma.statusView.count({
        where: { statusId },
      });
      return { viewCount: count };
    }

    await this.prisma.statusView.upsert({
      where: {
        statusId_viewerId: { statusId, viewerId },
      },
      create: { statusId, viewerId },
      update: { viewedAt: new Date() },
    });

    const viewCount = await this.prisma.statusView.count({
      where: { statusId },
    });

    return { viewCount };
  }

  async deleteStatus(statusId: string, userId: string) {
    const status = await this.prisma.status.findUnique({
      where: { id: statusId },
    });

    if (!status) throw new NotFoundException('Status not found');
    if (status.userId !== userId) throw new ForbiddenException('Not your status');

    await this.prisma.status.delete({ where: { id: statusId } });
    return { message: 'Status deleted' };
  }

  @Cron('0 */6 * * *')
  async cleanupExpiredStatuses() {
    const result = await this.prisma.status.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} expired statuses`);
    }
  }
}
