CREATE TABLE `notify_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`type` text NOT NULL,
	`correlation_id` text NOT NULL,
	`target_origin` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`cycle_attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`lease_token` text,
	`lease_expires_at` text,
	`last_error` text,
	`notify_event_id` text,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_attempt_at` text,
	`accepted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notify_outbox_key_unique` ON `notify_outbox` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `notify_outbox_pending_idx` ON `notify_outbox` (`target_origin`,`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `notify_outbox_lease_idx` ON `notify_outbox` (`status`,`lease_expires_at`);
--> statement-breakpoint
CREATE TRIGGER `notify_outbox_immutable`
BEFORE UPDATE OF id, idempotency_key, type, correlation_id, target_origin, payload, occurred_at, created_at ON notify_outbox
WHEN NEW.id IS NOT OLD.id OR NEW.idempotency_key IS NOT OLD.idempotency_key
  OR NEW.type IS NOT OLD.type OR NEW.correlation_id IS NOT OLD.correlation_id
  OR NEW.target_origin IS NOT OLD.target_origin OR NEW.payload IS NOT OLD.payload
  OR NEW.occurred_at IS NOT OLD.occurred_at OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'notify_outbox immutable event');
END;
