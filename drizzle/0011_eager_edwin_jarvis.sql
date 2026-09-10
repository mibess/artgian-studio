CREATE TABLE `local_discovery_queue` (
	`campaign_id` text NOT NULL,
	`query_key` text NOT NULL,
	`business_key` text NOT NULL,
	`google_maps_url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_discovery_queue_identity` ON `local_discovery_queue` (`campaign_id`,`query_key`,`business_key`);--> statement-breakpoint
CREATE INDEX `local_discovery_queue_pending` ON `local_discovery_queue` (`campaign_id`,`query_key`,`status`);--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD `stop_reason` text;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD `local_search_progress` text;