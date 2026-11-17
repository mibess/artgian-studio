ALTER TABLE `orders` ADD `whatsapp_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `whatsapp_opt_in_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `whatsapp_opt_in_source` text;