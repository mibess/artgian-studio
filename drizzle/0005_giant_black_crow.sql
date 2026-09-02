CREATE TABLE `outbound_prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`lead_id` text,
	`instagram_username` text NOT NULL,
	`name` text,
	`source_url` text,
	`qualification_reason` text NOT NULL,
	`contact_policy` text DEFAULT 'manual_only' NOT NULL,
	`status` text DEFAULT 'identified' NOT NULL,
	`draft_body` text,
	`reviewed_at` text,
	`contacted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbound_prospects_campaign_username_unique` ON `outbound_prospects` (`campaign_id`,`instagram_username`);--> statement-breakpoint
CREATE INDEX `outbound_prospects_status_idx` ON `outbound_prospects` (`status`);--> statement-breakpoint
CREATE INDEX `outbound_prospects_lead_idx` ON `outbound_prospects` (`lead_id`);