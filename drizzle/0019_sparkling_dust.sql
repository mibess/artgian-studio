CREATE TABLE `payment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`provider_payment_id` text,
	`request_payload` text,
	`device_id` text,
	`result` text,
	`provider_updated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_attempts_order_idx` ON `payment_attempts` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_provider_unique` ON `payment_attempts` (`provider_payment_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `checkout_mode` text DEFAULT 'redirect' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_expires_at` text;