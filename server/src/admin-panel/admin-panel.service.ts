import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PublicApiMessageStatus,
  PublicApiMessageType,
} from '@prisma/client';
import { ADMIN_ACTIVE_WINDOW_MINUTES } from './admin-panel.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AdminPanelService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── overview cards ─────────────────────────

  async getOverview() {
    const now = new Date();
    const todayStart = startOfDayUtc(now);
    const last24h = new Date(now.getTime() - DAY_MS);
    const activeWindow = new Date(
      now.getTime() - ADMIN_ACTIVE_WINDOW_MINUTES * 60 * 1000,
    );

    const [
      totalKeys,
      activeKeys,
      revokedKeys,
      totalMessages,
      messagesToday,
      messagesLast24h,
      messagesFailedToday,
      activeNow,
      uniqueOwners,
    ] = await this.prisma.$transaction([
      this.prisma.publicApiKey.count(),
      this.prisma.publicApiKey.count({ where: { revokedAt: null } }),
      this.prisma.publicApiKey.count({ where: { revokedAt: { not: null } } }),
      this.prisma.publicApiMessageLog.count(),
      this.prisma.publicApiMessageLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.publicApiMessageLog.count({
        where: { createdAt: { gte: last24h } },
      }),
      this.prisma.publicApiMessageLog.count({
        where: {
          status: PublicApiMessageStatus.FAILED,
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.publicApiKey.count({
        where: { revokedAt: null, lastUsedAt: { gte: activeWindow } },
      }),
      this.prisma.publicApiKey.findMany({
        select: { ownerId: true },
        distinct: ['ownerId'],
      }),
    ]);

    return {
      totalKeys,
      activeKeys,
      revokedKeys,
      totalMessages,
      messagesToday,
      messagesLast24h,
      messagesFailedToday,
      activeNow,
      activeWindowMinutes: ADMIN_ACTIVE_WINDOW_MINUTES,
      uniqueOwners: uniqueOwners.length,
    };
  }

  // ───────────────────── messages-per-day timeseries ─────────────────────

  async getMessagesTimeseries(days: number) {
    const safeDays = Math.min(Math.max(days || 30, 1), 90);
    const since = startOfDayUtc(
      new Date(Date.now() - (safeDays - 1) * DAY_MS),
    );

    // GROUP BY day in MySQL — Prisma's groupBy doesn't bucket by day, so use
    // raw SQL. Returns one row per (day, status).
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ day: string; status: string; count: bigint }>
    >(
      `SELECT DATE_FORMAT(\`createdAt\`, '%Y-%m-%d') AS day,
              \`status\` AS status,
              COUNT(*) AS count
         FROM \`public_api_message_logs\`
        WHERE \`createdAt\` >= ?
        GROUP BY day, status
        ORDER BY day ASC`,
      since,
    );

    const buckets = new Map<string, { success: number; failed: number }>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(since.getTime() + i * DAY_MS);
      buckets.set(isoDay(d), { success: 0, failed: 0 });
    }
    for (const r of rows) {
      const bucket = buckets.get(r.day);
      if (!bucket) continue;
      const n = Number(r.count);
      if (r.status === PublicApiMessageStatus.SUCCESS) bucket.success = n;
      else if (r.status === PublicApiMessageStatus.FAILED) bucket.failed = n;
    }

    return {
      days: safeDays,
      points: Array.from(buckets.entries()).map(([day, v]) => ({
        day,
        success: v.success,
        failed: v.failed,
        total: v.success + v.failed,
      })),
    };
  }

  // ─────────────────── api-keys list (paginated/filtered) ───────────────────

  async listApiKeys(params: {
    page: number;
    pageSize: number;
    status?: 'all' | 'active' | 'revoked';
    search?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 25), 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.status === 'active') where.revokedAt = null;
    if (params.status === 'revoked') where.revokedAt = { not: null };
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { label: { contains: q } },
        { keyPrefix: { contains: q } },
        { owner: { name: { contains: q } } },
        { owner: { phone: { contains: q } } },
        { owner: { email: { contains: q } } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.publicApiKey.count({ where }),
      this.prisma.publicApiKey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          label: true,
          keyPrefix: true,
          canSendText: true,
          canSendVoice: true,
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              countryCode: true,
              avatar: true,
            },
          },
          _count: { select: { messageLogs: true } },
        },
      }),
    ]);

    // Per-key success/failure counts in one go.
    const ids = rows.map((r) => r.id);
    const grouped = ids.length
      ? await this.prisma.publicApiMessageLog.groupBy({
          by: ['apiKeyId', 'status'],
          where: { apiKeyId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const counts = new Map<string, { success: number; failed: number }>();
    for (const g of grouped) {
      const c = counts.get(g.apiKeyId) ?? { success: 0, failed: 0 };
      if (g.status === PublicApiMessageStatus.SUCCESS) c.success = g._count._all;
      else c.failed = g._count._all;
      counts.set(g.apiKeyId, c);
    }

    const activeWindow = new Date(
      Date.now() - ADMIN_ACTIVE_WINDOW_MINUTES * 60 * 1000,
    );

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: rows.map((r) => ({
        id: r.id,
        label: r.label,
        keyPrefix: r.keyPrefix,
        canSendText: r.canSendText,
        canSendVoice: r.canSendVoice,
        lastUsedAt: r.lastUsedAt,
        revokedAt: r.revokedAt,
        createdAt: r.createdAt,
        isActiveNow:
          !r.revokedAt && !!r.lastUsedAt && r.lastUsedAt >= activeWindow,
        owner: r.owner,
        totalMessages: r._count.messageLogs,
        successCount: counts.get(r.id)?.success ?? 0,
        failedCount: counts.get(r.id)?.failed ?? 0,
      })),
    };
  }

  // ───────────────────────── single api-key detail ─────────────────────────

  async getApiKey(id: string) {
    const key = await this.prisma.publicApiKey.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        canSendText: true,
        canSendVoice: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            countryCode: true,
            avatar: true,
            about: true,
            createdAt: true,
            isOnline: true,
            lastSeen: true,
          },
        },
        _count: { select: { messageLogs: true } },
      },
    });

    if (!key) return null;

    // Read-only aggregates — Prisma's groupBy types don't compose cleanly
    // inside $transaction tuples, and we don't need atomicity for stats.
    const [statusBreakdown, typeBreakdown, recent] = await Promise.all([
      this.prisma.publicApiMessageLog.groupBy({
        by: ['status'],
        where: { apiKeyId: id },
        _count: { _all: true },
      }),
      this.prisma.publicApiMessageLog.groupBy({
        by: ['type'],
        where: { apiKeyId: id },
        _count: { _all: true },
      }),
      this.prisma.publicApiMessageLog.findMany({
        where: { apiKeyId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          status: true,
          recipientPhone: true,
          recipientUserId: true,
          externalId: true,
          contentPreview: true,
          errorReason: true,
          requestDurationMs: true,
          createdAt: true,
        },
      }),
    ]);

    const activeWindow = new Date(
      Date.now() - ADMIN_ACTIVE_WINDOW_MINUTES * 60 * 1000,
    );

    return {
      ...key,
      isActiveNow:
        !key.revokedAt && !!key.lastUsedAt && key.lastUsedAt >= activeWindow,
      stats: {
        total: key._count.messageLogs,
        success:
          statusBreakdown.find(
            (s) => s.status === PublicApiMessageStatus.SUCCESS,
          )?._count._all ?? 0,
        failed:
          statusBreakdown.find(
            (s) => s.status === PublicApiMessageStatus.FAILED,
          )?._count._all ?? 0,
        text:
          typeBreakdown.find((t) => t.type === PublicApiMessageType.TEXT)
            ?._count._all ?? 0,
        voice:
          typeBreakdown.find((t) => t.type === PublicApiMessageType.VOICE)
            ?._count._all ?? 0,
      },
      recentMessages: recent,
    };
  }

  // ─────────────────────────── active-now keys ───────────────────────────

  async listActiveKeys() {
    const activeWindow = new Date(
      Date.now() - ADMIN_ACTIVE_WINDOW_MINUTES * 60 * 1000,
    );
    const keys = await this.prisma.publicApiKey.findMany({
      where: {
        revokedAt: null,
        lastUsedAt: { gte: activeWindow },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        lastUsedAt: true,
        owner: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
    });

    if (keys.length === 0) return { windowMinutes: ADMIN_ACTIVE_WINDOW_MINUTES, items: [] };

    const ids = keys.map((k) => k.id);
    const recent = await this.prisma.publicApiMessageLog.groupBy({
      by: ['apiKeyId'],
      where: { apiKeyId: { in: ids }, createdAt: { gte: activeWindow } },
      _count: { _all: true },
    });
    const recentMap = new Map(recent.map((r) => [r.apiKeyId, r._count._all]));

    return {
      windowMinutes: ADMIN_ACTIVE_WINDOW_MINUTES,
      items: keys.map((k) => ({
        ...k,
        recentMessages: recentMap.get(k.id) ?? 0,
      })),
    };
  }

  // ─────────────────────── users (key owners) listing ───────────────────────

  async listUsers(params: { page: number; pageSize: number; search?: string }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 25), 100);
    const skip = (page - 1) * pageSize;

    // Aggregate per owner from public_api_keys, then enrich.
    const where: any = { publicApiKeys: { some: {} } };
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          countryCode: true,
          avatar: true,
          isOnline: true,
          lastSeen: true,
          createdAt: true,
          _count: { select: { publicApiKeys: true } },
        },
      }),
    ]);

    const ids = users.map((u) => u.id);
    const messageCounts = ids.length
      ? await this.prisma.publicApiMessageLog.groupBy({
          by: ['ownerId', 'status'],
          where: { ownerId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const map = new Map<string, { success: number; failed: number }>();
    for (const r of messageCounts) {
      const c = map.get(r.ownerId) ?? { success: 0, failed: 0 };
      if (r.status === PublicApiMessageStatus.SUCCESS) c.success = r._count._all;
      else c.failed = r._count._all;
      map.set(r.ownerId, c);
    }

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: users.map((u) => ({
        ...u,
        keyCount: u._count.publicApiKeys,
        successCount: map.get(u.id)?.success ?? 0,
        failedCount: map.get(u.id)?.failed ?? 0,
      })),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        countryCode: true,
        avatar: true,
        about: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        publicApiKeys: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            label: true,
            keyPrefix: true,
            canSendText: true,
            canSendVoice: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
            _count: { select: { messageLogs: true } },
          },
        },
      },
    });
    if (!user) return null;

    const totals = await this.prisma.publicApiMessageLog.groupBy({
      by: ['status'],
      where: { ownerId: id },
      _count: { _all: true },
    });

    return {
      ...user,
      stats: {
        total: totals.reduce((acc, t) => acc + t._count._all, 0),
        success:
          totals.find((t) => t.status === PublicApiMessageStatus.SUCCESS)?._count
            ._all ?? 0,
        failed:
          totals.find((t) => t.status === PublicApiMessageStatus.FAILED)?._count
            ._all ?? 0,
      },
    };
  }

  // ───────────────────────── messages log (filterable) ─────────────────────

  async listMessages(params: {
    page: number;
    pageSize: number;
    apiKeyId?: string;
    ownerId?: string;
    status?: 'all' | 'SUCCESS' | 'FAILED';
    type?: 'all' | 'TEXT' | 'VOICE';
    from?: Date;
    to?: Date;
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 50), 200);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (params.apiKeyId) where.apiKeyId = params.apiKeyId;
    if (params.ownerId) where.ownerId = params.ownerId;
    if (params.status && params.status !== 'all') where.status = params.status;
    if (params.type && params.type !== 'all') where.type = params.type;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.publicApiMessageLog.count({ where }),
      this.prisma.publicApiMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          type: true,
          status: true,
          recipientPhone: true,
          externalId: true,
          contentPreview: true,
          errorReason: true,
          requestDurationMs: true,
          ipAddress: true,
          createdAt: true,
          apiKey: {
            select: {
              id: true,
              label: true,
              keyPrefix: true,
              owner: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items,
    };
  }

  // ───────────────────────── top keys (for bar chart) ─────────────────────

  async getTopKeys(limit: number) {
    const safeLimit = Math.min(Math.max(1, limit || 10), 25);
    const groups = await this.prisma.publicApiMessageLog.groupBy({
      by: ['apiKeyId'],
      _count: { _all: true },
      orderBy: { _count: { apiKeyId: 'desc' } },
      take: safeLimit,
    });
    if (groups.length === 0) return [];

    const ids = groups.map((g) => g.apiKeyId);
    const keys = await this.prisma.publicApiKey.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        owner: { select: { id: true, name: true } },
      },
    });
    const keyMap = new Map(keys.map((k) => [k.id, k]));

    return groups.map((g) => ({
      apiKeyId: g.apiKeyId,
      total: g._count._all,
      label: keyMap.get(g.apiKeyId)?.label ?? '(deleted)',
      keyPrefix: keyMap.get(g.apiKeyId)?.keyPrefix ?? '',
      ownerName: keyMap.get(g.apiKeyId)?.owner?.name ?? '(unknown)',
      ownerId: keyMap.get(g.apiKeyId)?.owner?.id ?? null,
    }));
  }

  // ─────────────────── admin login audit (write + read) ───────────────────

  async recordLogin(args: {
    username: string;
    success: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string | null;
  }) {
    try {
      await this.prisma.adminLoginEvent.create({
        data: {
          username: args.username.slice(0, 191),
          success: args.success,
          ipAddress: args.ipAddress?.slice(0, 64) ?? null,
          userAgent: args.userAgent?.slice(0, 500) ?? null,
          reason: args.reason ?? null,
        },
      });
    } catch {
      // Audit logging must not block login flow.
    }
  }

  async listLoginEvents(limit = 50) {
    return this.prisma.adminLoginEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
    });
  }
}
