import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Previously this service ran an hourly cron that hard-deleted phone-only
 * accounts whose owner verified their OTP but never set a name within 24 h.
 *
 * The cron was the underlying reason a user who left the app idle for a day
 * could come back and find themselves "logged out" — their User row was gone,
 * so the JWT subject no longer resolved and every API call 401'd. We never
 * want that behaviour: once a user is in the database they should stay there
 * until they explicitly delete their account.
 *
 * The class is kept (rather than removed) so the DI graph in AuthModule does
 * not need to change, but the @Cron decorator and the deleteMany call have
 * been removed. Re-enable by restoring those lines if you ever need a real
 * cleanup policy again.
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}
}
