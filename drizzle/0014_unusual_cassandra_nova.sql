CREATE TABLE `store_account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `store_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `store_account_user_idx` ON `store_account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_account_provider_idx` ON `store_account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `store_rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_rate_limit_key_unique` ON `store_rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `store_session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `store_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_session_token_unique` ON `store_session` (`token`);--> statement-breakpoint
CREATE INDEX `store_session_user_idx` ON `store_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `store_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_user_email_unique` ON `store_user` (`email`);--> statement-breakpoint
CREATE TABLE `store_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `store_verification_identifier_idx` ON `store_verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `orders` ADD `user_id` text REFERENCES store_user(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);