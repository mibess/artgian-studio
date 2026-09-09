CREATE TABLE `discovery_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`instagram_username` text NOT NULL,
	`last_query_kind` text NOT NULL,
	`last_query` text NOT NULL,
	`last_outcome` text NOT NULL,
	`inspection_count` integer DEFAULT 1 NOT NULL,
	`last_inspected_at` text NOT NULL,
	`revisit_after` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_candidates_campaign_username_unique` ON `discovery_candidates` (`campaign_id`,`instagram_username`);--> statement-breakpoint
CREATE INDEX `discovery_candidates_revisit_idx` ON `discovery_candidates` (`campaign_id`,`revisit_after`);--> statement-breakpoint
CREATE TABLE `discovery_query_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`query_kind` text NOT NULL,
	`query` text NOT NULL,
	`searches` integer DEFAULT 0 NOT NULL,
	`profiles_inspected` integer DEFAULT 0 NOT NULL,
	`profiles_qualified` integer DEFAULT 0 NOT NULL,
	`profiles_created` integer DEFAULT 0 NOT NULL,
	`skipped_duplicates` integer DEFAULT 0 NOT NULL,
	`skipped_blocked` integer DEFAULT 0 NOT NULL,
	`skipped_low_score` integer DEFAULT 0 NOT NULL,
	`last_searched_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_query_stats_campaign_query_unique` ON `discovery_query_stats` (`campaign_id`,`query_kind`,`query`);--> statement-breakpoint
CREATE INDEX `discovery_query_stats_campaign_idx` ON `discovery_query_stats` (`campaign_id`,`last_searched_at`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_cursor` integer DEFAULT 0 NOT NULL;