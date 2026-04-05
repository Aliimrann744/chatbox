-- AlterTable: Add isDeletedForEveryone column to messages
ALTER TABLE `messages` ADD COLUMN `isDeletedForEveryone` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: DeletedMessageForUser (per-user "delete for me" tracking)
CREATE TABLE `deleted_messages_for_user` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `deleted_messages_for_user_userId_idx`(`userId`),
    INDEX `deleted_messages_for_user_messageId_idx`(`messageId`),
    UNIQUE INDEX `deleted_messages_for_user_messageId_userId_key`(`messageId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `deleted_messages_for_user` ADD CONSTRAINT `deleted_messages_for_user_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deleted_messages_for_user` ADD CONSTRAINT `deleted_messages_for_user_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
