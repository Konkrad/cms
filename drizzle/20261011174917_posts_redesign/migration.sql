-- Posts redesign (spec 4.4): one type with an optional title (untitled = note, titled =
-- article), an optional subject reference (subject_type `<module>:<type>` + subject_id),
-- author_id and published_at. Existing posts keep their author and creation time (as
-- published_at); an empty title becomes NULL. Soft-deleted posts are dropped, and the
-- editor_state, featured_image, show_author and deleted_by columns go: the body is the
-- stored HTML, images live in the body.
ALTER TABLE `posts` RENAME COLUMN `user_id` TO `author_id`;--> statement-breakpoint
ALTER TABLE `posts` RENAME COLUMN `created_at` TO `published_at`;--> statement-breakpoint
ALTER TABLE `posts` ADD `subject_type` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `subject_id` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`title` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`author_id` text NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_posts_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_posts_user_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_posts`(`id`, `title`, `body`, `author_id`, `scope_id`, `visibility`, `published_at`, `updated_at`) SELECT `id`, NULLIF(TRIM(`title`), ''), `body`, `author_id`, `scope_id`, `visibility`, `published_at`, `updated_at` FROM `posts` WHERE `deleted_at` IS NULL;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `posts_subject_idx` ON `posts` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);