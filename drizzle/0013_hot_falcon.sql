CREATE TABLE `follower_discovery_queue` (
	`campaign_id` text NOT NULL,
	`base_username` text NOT NULL,
	`instagram_username` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follower_discovery_queue_identity` ON `follower_discovery_queue` (`campaign_id`,`base_username`,`instagram_username`);--> statement-breakpoint
CREATE INDEX `follower_discovery_queue_pending` ON `follower_discovery_queue` (`campaign_id`,`base_username`,`status`);--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD `follower_search_progress` text;