CREATE TABLE `customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`postal_code` text NOT NULL,
	`street_address` text NOT NULL,
	`address_number` text NOT NULL,
	`address_complement` text DEFAULT '' NOT NULL,
	`neighborhood` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`fingerprint` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `store_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_addresses_user_idx` ON `customer_addresses` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_addresses_identity_unique` ON `customer_addresses` (`user_id`,`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_addresses_default_unique` ON `customer_addresses` (`user_id`) WHERE "customer_addresses"."is_default" = 1;