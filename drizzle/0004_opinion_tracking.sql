CREATE TABLE `opinion_tracking_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotId` int NOT NULL,
	`horizon` varchar(10) NOT NULL,
	`targetDate` timestamp NOT NULL,
	`observedDate` timestamp,
	`observedPrice` double,
	`returnPct` double,
	`alignment` varchar(30) NOT NULL,
	`status` varchar(20) NOT NULL,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opinion_tracking_outcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `opinion_tracking_outcome_unique` UNIQUE(`snapshotId`,`horizon`)
);
--> statement-breakpoint
CREATE TABLE `opinion_tracking_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`opinionCreatedAt` timestamp NOT NULL,
	`opinionVersion` varchar(80) NOT NULL,
	`finalSignal` varchar(20) NOT NULL,
	`finalConfidence` varchar(20) NOT NULL,
	`startObservedDate` timestamp,
	`startPrice` double,
	`opinionPayload` json,
	`sourceSummary` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opinion_tracking_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `opinion_tracking_snapshot_unique` UNIQUE(`symbol`,`opinionVersion`,`opinionCreatedAt`)
);
