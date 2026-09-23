CREATE TABLE `order_fulfillment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`tracking_code` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_fulfillment_events_order_idx` ON `order_fulfillment_events` (`order_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_status` text DEFAULT 'preparing' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_note` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_updated_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_revision` integer DEFAULT 0 NOT NULL;