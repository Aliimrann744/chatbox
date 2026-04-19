import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Deletes accounts that were auto-created by the phone-OTP flow but were
 * never completed — i.e. the user verified their phone but never added a
 * name or email within 24 hours. Runs once per hour so stale rows leave
 * the DB promptly, without being so aggressive that we kill people who
 * are still mid-setup.
 *
 * Deletion criteria (all must match):
 *   • phone is set
 *   • email is NULL
 *   • googleId is NULL (not a social-linked account)
 *   • facebookId is NULL
 *   • name is empty string (the schema default — never edited)
 *   • createdAt is more than 24 hours ago
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'cleanupIncompletePhoneSignups' })
  async cleanupIncompletePhoneSignups() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const result = await this.prisma.user.deleteMany({
        where: {
          phone: { not: null },
          email: null,
          googleId: null,
          facebookId: null,
          name: '',
          createdAt: { lt: cutoff },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Cleaned up ${result.count} incomplete phone-only signup(s) older than 24h`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to clean up incomplete signups: ${err?.message || err}`,
      );
    }
  }
}
