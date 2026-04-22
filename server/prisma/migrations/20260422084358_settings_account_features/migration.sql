-- AlterTable
ALTER TABLE `users` ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    ADD COLUMN `pendingEmail` VARCHAR(191) NULL,
    ADD COLUMN `pendingEmailOtp` VARCHAR(191) NULL,
    ADD COLUMN `pendingEmailOtpExpiry` DATETIME(3) NULL,
    ADD COLUMN `scheduledDeletionAt` DATETIME(3) NULL,
    ADD COLUMN `securityNotificationsEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `twoFactorBackupCodes` TEXT NULL,
    ADD COLUMN `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `twoFactorMethod` ENUM('NONE', 'EMAIL', 'TOTP') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `twoFactorSecret` TEXT NULL;

-- CreateTable
CREATE TABLE `login_events` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `device` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `isNewDevice` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_events_userId_idx`(`userId`),
    INDEX `login_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_scheduledDeletionAt_idx` ON `users`(`scheduledDeletionAt`);

-- AddForeignKey
ALTER TABLE `login_events` ADD CONSTRAINT `login_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
