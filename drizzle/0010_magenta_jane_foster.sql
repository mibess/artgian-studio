CREATE TABLE `local_business_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`business_name` text NOT NULL,
	`niche` text NOT NULL,
	`location` text NOT NULL,
	`address` text,
	`phone` text,
	`google_maps_url` text NOT NULL,
	`website_url` text,
	`instagram_username` text,
	`status` text DEFAULT 'website_opportunity' NOT NULL,
	`notes` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_business_opportunities_campaign_maps_unique` ON `local_business_opportunities` (`campaign_id`,`google_maps_url`);--> statement-breakpoint
CREATE INDEX `local_business_opportunities_status_idx` ON `local_business_opportunities` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_strategy` text DEFAULT 'instagram_search' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_base_profiles` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_minimum_base_followers` integer DEFAULT 500000 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_local_niche` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `discovery_local_location` text;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD `website_opportunities_created` integer DEFAULT 0 NOT NULL;