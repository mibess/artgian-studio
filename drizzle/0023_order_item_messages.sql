CREATE TABLE `order_item_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_item_id` integer NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`client_id` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_item_messages_thread_idx` ON `order_item_messages` (`order_item_id`,`id`);--> statement-breakpoint
CREATE INDEX `order_item_messages_unread_idx` ON `order_item_messages` (`order_item_id`,`sender`,`read_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_item_messages_client_unique` ON `order_item_messages` (`order_item_id`,`sender`,`client_id`);