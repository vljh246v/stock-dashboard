ALTER TABLE `users` ADD `approvedAt` timestamp;
--> statement-breakpoint
UPDATE `users`
SET `approvedAt` = COALESCE(`lastSignedIn`, `createdAt`, NOW())
WHERE `approvedAt` IS NULL;
