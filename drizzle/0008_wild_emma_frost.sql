CREATE TABLE `discovery_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`job_id` text,
	`status` text DEFAULT 'running' NOT NULL,
	`queries_scanned` integer DEFAULT 0 NOT NULL,
	`profiles_inspected` integer DEFAULT 0 NOT NULL,
	`profiles_qualified` integer DEFAULT 0 NOT NULL,
	`profiles_created` integer DEFAULT 0 NOT NULL,
	`skipped_duplicates` integer DEFAULT 0 NOT NULL,
	`skipped_blocked` integer DEFAULT 0 NOT NULL,
	`skipped_low_score` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `discovery_runs_campaign_idx` ON `discovery_runs` (`campaign_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `discovery_runs_status_idx` ON `discovery_runs` (`status`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_keywords` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_hashtags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_locations` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_daily_limit` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_minimum_score` integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_interval_hours` integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `last_discovery_at` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `discovery_source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `discovery_query` text;