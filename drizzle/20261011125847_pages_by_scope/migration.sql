PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pages` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_pages_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_pages`(`id`, `scope_id`, `slug`, `title`, `content`, `status`, `created_at`, `updated_at`) SELECT `id`, (SELECT `id` FROM `scopes` WHERE `parent_id` IS NULL), COALESCE((SELECT trim(`url`, '/') FROM `menu_items` WHERE `page_id` = `pages`.`id` LIMIT 1), `id`), COALESCE((SELECT `title` FROM `menu_items` WHERE `page_id` = `pages`.`id` LIMIT 1), ''), `content`, `status`, `created_at`, `updated_at` FROM `pages`;--> statement-breakpoint
DROP TABLE `pages`;--> statement-breakpoint
ALTER TABLE `__new_pages` RENAME TO `pages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `pages_scope_slug_unique` ON `pages` (`scope_id`,`slug`);
