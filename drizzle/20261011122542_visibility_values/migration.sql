PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`editor_state` text,
	`user_id` text NOT NULL,
	`scope_id` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`featured_image` text,
	`show_author` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`deleted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_posts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_posts_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_posts_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_posts`(`id`, `title`, `body`, `editor_state`, `user_id`, `scope_id`, `visibility`, `featured_image`, `show_author`, `deleted_at`, `deleted_by`, `created_at`, `updated_at`) SELECT `id`, `title`, `body`, `editor_state`, `user_id`, `scope_id`, `visibility`, `featured_image`, `show_author`, `deleted_at`, `deleted_by`, `created_at`, `updated_at` FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`location_type` text NOT NULL,
	`address` text,
	`city` text,
	`country` text,
	`longitude` text,
	`latitude` text,
	`online_url` text,
	`user_id` text NOT NULL,
	`scope_id` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`image1` text,
	`image2` text,
	`deleted_at` text,
	`deleted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_events_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_events_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_events`(`id`, `title`, `body`, `start_date`, `end_date`, `location_type`, `address`, `city`, `country`, `longitude`, `latitude`, `online_url`, `user_id`, `scope_id`, `visibility`, `image1`, `image2`, `deleted_at`, `deleted_by`, `created_at`, `updated_at`) SELECT `id`, `title`, `body`, `start_date`, `end_date`, `location_type`, `address`, `city`, `country`, `longitude`, `latitude`, `online_url`, `user_id`, `scope_id`, `visibility`, `image1`, `image2`, `deleted_at`, `deleted_by`, `created_at`, `updated_at` FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `posts` SET `visibility` = CASE `visibility` WHEN 'global' THEN 'public' WHEN 'group-only' THEN 'members' ELSE `visibility` END;--> statement-breakpoint
UPDATE `events` SET `visibility` = CASE `visibility` WHEN 'global' THEN 'public' WHEN 'group-only' THEN 'members' ELSE `visibility` END;
