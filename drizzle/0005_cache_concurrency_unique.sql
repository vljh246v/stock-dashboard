DELETE w1 FROM `watchlist` w1
INNER JOIN `watchlist` w2
  ON w1.`userId` = w2.`userId`
  AND w1.`symbol` = w2.`symbol`
  AND w1.`id` > w2.`id`;
--> statement-breakpoint
DELETE c1 FROM `stock_analysis_cache` c1
INNER JOIN `stock_analysis_cache` c2
  ON c1.`symbol` = c2.`symbol`
  AND c1.`dataType` = c2.`dataType`
  AND (
    c1.`expiresAt` < c2.`expiresAt`
    OR (c1.`expiresAt` = c2.`expiresAt` AND c1.`id` < c2.`id`)
  );
--> statement-breakpoint
ALTER TABLE `watchlist` ADD CONSTRAINT `watchlist_user_symbol_unique` UNIQUE(`userId`,`symbol`);
--> statement-breakpoint
ALTER TABLE `stock_analysis_cache` ADD CONSTRAINT `stock_analysis_cache_symbol_type_unique` UNIQUE(`symbol`,`dataType`);
