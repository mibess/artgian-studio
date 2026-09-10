CREATE TABLE `hashtag_discovery_posts` (
	`campaign_id` text NOT NULL,
	`hashtag` text NOT NULL,
	`post_key` text NOT NULL,
	`post_url` text NOT NULL,
	`instagram_username` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`revisit_after` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hashtag_discovery_posts_identity` ON `hashtag_discovery_posts` (`campaign_id`,`hashtag`,`post_key`);--> statement-breakpoint
CREATE INDEX `hashtag_discovery_posts_author` ON `hashtag_discovery_posts` (`campaign_id`,`instagram_username`);--> statement-breakpoint
CREATE INDEX `hashtag_discovery_posts_pending` ON `hashtag_discovery_posts` (`campaign_id`,`hashtag`,`status`);