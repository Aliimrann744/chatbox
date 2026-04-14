-- AlterTable: Add chat management columns to chat_members
ALTER TABLE `chat_members` ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `chat_members` ADD COLUMN `isFavorite` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `chat_members` ADD COLUMN `isMarkedUnread` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `chat_members` ADD COLUMN `isHidden` BOOLEAN NOT NULL DEFAULT false;
