import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeletionCleanupService {
  private readonly logger = new Logger(DeletionCleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredDeletions() {
    const now = new Date();
    const expired = await this.prisma.user.findMany({
      where: {
        scheduledDeletionAt: { not: null, lte: now },
      },
      select: { id: true },
    });

    if (expired.length === 0) return;

    this.logger.log(`Purging ${expired.length} account(s) past their deletion window`);

    for (const { id } of expired) {
      try {
        await this.prisma.user.delete({ where: { id } });
      } catch (err: any) {
        this.logger.error(`Failed to delete user ${id}: ${err.message}`);
      }
    }
  }
}
