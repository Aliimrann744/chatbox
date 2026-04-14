-- AlterTable: Add social login columns to users
ALTER TABLE `users` ADD COLUMN `googleId` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `facebookId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_googleId_key` ON `users`(`googleId`);
CREATE UNIQUE INDEX `users_facebookId_key` ON `users`(`facebookId`);
