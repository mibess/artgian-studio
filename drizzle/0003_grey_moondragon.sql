CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_usd_micros` integer DEFAULT 0 NOT NULL,
	`lead_id` text,
	`conversation_id` text,
	`purpose` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_created_at` ON `ai_usage` (`created_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `briefings` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`product_interest` text,
	`product_category` text,
	`occasion` text,
	`recipient` text,
	`reference_description` text,
	`reference_url` text,
	`customization_text` text,
	`preferred_colors` text,
	`preferred_size` text,
	`quantity` integer,
	`desired_deadline` text,
	`city` text,
	`state` text,
	`shipping_required` integer,
	`budget_range` text,
	`additional_notes` text,
	`needs_quote` integer DEFAULT true NOT NULL,
	`needs_production_review` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'collecting' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefings_lead_id_unique` ON `briefings` (`lead_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`segment` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`outbound_enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`images` text DEFAULT '[]' NOT NULL,
	`base_price_cents` integer,
	`price_from_cents` integer,
	`pricing_type` text DEFAULT 'quote' NOT NULL,
	`materials` text DEFAULT '[]' NOT NULL,
	`available_colors` text DEFAULT '[]' NOT NULL,
	`available_sizes` text DEFAULT '[]' NOT NULL,
	`customization_options` text DEFAULT '[]' NOT NULL,
	`production_time` text,
	`minimum_quantity` integer,
	`maximum_quantity` integer,
	`active` integer DEFAULT true NOT NULL,
	`notes` text,
	`verified_claims` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_products_name_unique` ON `catalog_products` (`name`);--> statement-breakpoint
CREATE TABLE `commercial_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`quote_request_id` text,
	`source` text NOT NULL,
	`product_category` text,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`confirmed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`quote_request_id`) REFERENCES `quote_requests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_commercial_orders_lead_id` ON `commercial_orders` (`lead_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`channel` text DEFAULT 'instagram' NOT NULL,
	`external_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_message_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_channel_external_id_unique` ON `conversations` (`channel`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_lead_id` ON `conversations` (`lead_id`);--> statement-breakpoint
CREATE TABLE `exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text,
	`type` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_exceptions_status` ON `exceptions` (`status`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`hypothesis` text NOT NULL,
	`variant` text NOT NULL,
	`control` text NOT NULL,
	`sample_size` integer DEFAULT 0 NOT NULL,
	`minimum_sample_size` integer DEFAULT 30 NOT NULL,
	`started_at` text,
	`ended_at` text,
	`primary_metric` text NOT NULL,
	`secondary_metrics` text DEFAULT '[]' NOT NULL,
	`result` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`response` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`scheduled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`finished_at` text,
	`last_error` text,
	`idempotency_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_key_unique` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status_scheduled` ON `jobs` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`instagram_username` text NOT NULL,
	`name` text,
	`lead_type` text DEFAULT 'consumer' NOT NULL,
	`source` text NOT NULL,
	`segment` text,
	`product_interest` text,
	`occasion` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`intent_score` integer DEFAULT 0 NOT NULL,
	`icp_score` integer DEFAULT 0 NOT NULL,
	`engagement_score` integer DEFAULT 0 NOT NULL,
	`commercial_potential_score` integer DEFAULT 0 NOT NULL,
	`urgency_score` integer DEFAULT 0 NOT NULL,
	`pipeline_stage` text DEFAULT 'discovered' NOT NULL,
	`channel_state` text DEFAULT 'waiting_inbound_reply' NOT NULL,
	`last_contact_at` text,
	`next_action_at` text,
	`whatsapp_handoff_at` text,
	`quote_status` text DEFAULT 'none' NOT NULL,
	`order_status` text DEFAULT 'none' NOT NULL,
	`estimated_order_value_cents` integer,
	`confirmed_order_value_cents` integer,
	`do_not_contact` integer DEFAULT false NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_instagram_username_unique` ON `leads` (`instagram_username`);--> statement-breakpoint
CREATE INDEX `idx_leads_pipeline_stage` ON `leads` (`pipeline_stage`);--> statement-breakpoint
CREATE INDEX `idx_leads_next_action_at` ON `leads` (`next_action_at`);--> statement-breakpoint
CREATE INDEX `idx_leads_source` ON `leads` (`source`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`external_id` text,
	`direction` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`intent` text,
	`action` text,
	`status` text DEFAULT 'received' NOT NULL,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_external_id_unique` ON `messages` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_conversation_sent_at` ON `messages` (`conversation_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `quote_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`briefing_id` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`amount_cents` integer,
	`valid_until` text,
	`notes` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`briefing_id`) REFERENCES `briefings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_quote_requests_lead_id` ON `quote_requests` (`lead_id`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_by` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_timeline_events_lead_created` ON `timeline_events` (`lead_id`,`created_at`);