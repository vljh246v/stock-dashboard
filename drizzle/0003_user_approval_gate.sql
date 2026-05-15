ALTER TABLE `users` ADD `approvedAt` timestamp;
UPDATE `users`
SET `approvedAt` = COALESCE(`lastSignedIn`, `createdAt`, NOW())
WHERE `approvedAt` IS NULL;
