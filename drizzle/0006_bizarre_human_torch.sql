CREATE TABLE `outbound_events` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`lead_id` text,
	`type` text NOT NULL,
	`variant` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `outbound_prospects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `outbound_events_prospect_idx` ON `outbound_events` (`prospect_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `outbound_events_campaign_idx` ON `outbound_events` (`campaign_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `outbound_events_type_idx` ON `outbound_events` (`type`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `funnel_type` text DEFAULT 'consumer' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `daily_limit` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `operating_hours` text DEFAULT '09:00-18:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `operating_timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `channel_owner` text DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `handed_off_at` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `last_inbound_at` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `profile_category` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `profile_bio` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `profile_location` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `public_signal` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `funnel_type` text DEFAULT 'consumer' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `pipeline_stage` text DEFAULT 'discovered' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `icp_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `experiment_id` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `experiment_variant` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `browser_job_id` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `last_error` text;--> statement-breakpoint
ALTER TABLE `outbound_prospects` ADD `last_attempt_at` text;