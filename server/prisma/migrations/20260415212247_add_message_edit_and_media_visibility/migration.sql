-- AlterTable
ALTER TABLE `chat_members` ADD COLUMN `mediaVisibility` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `messages` ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `isEdited` BOOLEAN NOT NULL DEFAULT false;
