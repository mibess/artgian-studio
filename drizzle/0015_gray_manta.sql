CREATE TABLE `coupon_issuances` (
	`request_key` text PRIMARY KEY NOT NULL,
	`completion_hash` text NOT NULL,
	`player_hash` text NOT NULL,
	`coupon_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_completion_unique` ON `coupon_issuances` (`completion_hash`);--> statement-breakpoint
CREATE TABLE `coupon_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`resets_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`starts_at` text,
	`expires_at` text,
	`max_uses` integer,
	`allocated_uses` integer DEFAULT 0 NOT NULL,
	`min_subtotal_cents` integer DEFAULT 0 NOT NULL,
	`max_discount_cents` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `coupons_expiration_idx` ON `coupons` (`source`,`expires_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_kind` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_value` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_redeemed_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `checkout_url` text;--> statement-breakpoint
CREATE INDEX `orders_coupon_idx` ON `orders` (`coupon_id`);