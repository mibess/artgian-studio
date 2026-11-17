CREATE TABLE `mcp_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`secret_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mcp_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `mcp_clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mcp_credentials` (
	`hash` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`connection_id` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `mcp_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mcp_credentials_expiry_idx` ON `mcp_credentials` (`expires_at`);--> statement-breakpoint
CREATE TABLE `mcp_product_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`product_id` text NOT NULL,
	`response` text NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `mcp_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_product_operations_key_unique` ON `mcp_product_operations` (`connection_id`,`key`);--> statement-breakpoint
CREATE TABLE `mcp_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`content_hash` text NOT NULL,
	`data` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_owner_hash_unique` ON `product_images` (`owner`,`content_hash`);