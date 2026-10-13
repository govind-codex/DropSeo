CREATE TABLE `plan_entitlements` (
	`subscription_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_timestamp` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plan_entitlements_owner` ON `plan_entitlements` (`user_id`,`event_timestamp`);--> statement-breakpoint
CREATE TABLE `plan_sync` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_usage` (
	`user_id` text NOT NULL,
	`period` text NOT NULL,
	`email` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `period`)
);
