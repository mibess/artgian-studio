CREATE TABLE `integration_states` (
	`key` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`encrypted_access_token` text,
	`token_expires_at` text,
	`last_token_refresh_at` text,
	`last_health_check_at` text,
	`last_successful_sync_at` text,
	`last_run_started_at` text,
	`lock_until` text,
	`last_error` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
