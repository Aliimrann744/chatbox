import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { DeletionCleanupService } from './deletion-cleanup.service';
import { DataExportWorker } from './data-export.worker';
import { PrismaModule } from '../prisma/prisma.module';
import { MailService } from '../auth/mail.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService, MailService, DeletionCleanupService, DataExportWorker],
  exports: [SettingsService],
})
export class SettingsModule {}
