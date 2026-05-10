-- CreateTable
CREATE TABLE `public_api_message_logs` (
    `id` VARCHAR(191) NOT NULL,
    `apiKeyId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NULL,
    `recipientPhone` VARCHAR(191) NOT NULL,
    `type` ENUM('TEXT', 'VOICE') NOT NULL,
    `status` ENUM('SUCCESS', 'FAILED') NOT NULL,
    `errorReason` TEXT NULL,
    `externalId` VARCHAR(191) NULL,
    `contentPreview` VARCHAR(280) NULL,
    `fileSize` INTEGER NULL,
    `mediaDurationMs` INTEGER NULL,
    `requestDurationMs` INTEGER NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `public_api_message_logs_apiKeyId_createdAt_idx` (`apiKeyId`, `createdAt`),
    INDEX `public_api_message_logs_ownerId_createdAt_idx` (`ownerId`, `createdAt`),
    INDEX `public_api_message_logs_createdAt_idx` (`createdAt`),
    INDEX `public_api_message_logs_status_createdAt_idx` (`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `public_api_message_logs` ADD CONSTRAINT `public_api_message_logs_apiKeyId_fkey` FOREIGN KEY (`apiKeyId`) REFERENCES `public_api_keys`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `admin_login_events` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_login_events_createdAt_idx` (`createdAt`),
    INDEX `admin_login_events_username_idx` (`username`),
    INDEX `admin_login_events_success_createdAt_idx` (`success`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
