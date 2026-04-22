import { Module } from '@nestjs/common';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from '../auth/mail.service';

@Module({
  imports: [PrismaModule],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, MailService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
