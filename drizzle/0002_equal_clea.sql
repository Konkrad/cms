CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_slug_unique` ON `groups` (`slug`);--> statement-breakpoint
CREATE TABLE `group_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_memberships_user_id_group_id_unique` ON `group_memberships` (`user_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `group_representatives` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`promoted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`promoted_by` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`promoted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_representatives_user_id_group_id_unique` ON `group_representatives` (`user_id`,`group_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `group_id` text REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `events` ADD `visibility` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `deleted_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `posts` ADD `group_id` text REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `posts` ADD `visibility` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `deleted_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tickets` DROP COLUMN `is_free`;