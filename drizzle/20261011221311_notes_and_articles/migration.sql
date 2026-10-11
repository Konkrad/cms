-- Notes and articles (spec 4.4) replace posts: two core types. A post with a non-empty title
-- becomes an article (keeping its featured image), any other post a note. Soft-deleted posts
-- are dropped; user_id becomes author_id and created_at published_at. Stored references to
-- posts (`core:post:<id>`, in menu items, page-builder content and rich text) become
-- `core:article:<id>` / `core:note:<id>`, and the page-builder "Posts List" block is the
-- "Stream" block now. Hand-edited after `drizzle-kit generate`: the data-moving statements
-- between the indexes and DROP TABLE `posts`.
CREATE TABLE `articles` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`title` text NOT NULL,
	`featured_image` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`author_id` text NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_articles_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_articles_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`author_id` text NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_notes_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_notes_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `articles_subject_idx` ON `articles` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `articles_published_at_idx` ON `articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `notes_subject_idx` ON `notes` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `notes_published_at_idx` ON `notes` (`published_at`);--> statement-breakpoint
INSERT INTO `articles` (`id`, `scope_id`, `title`, `featured_image`, `body`, `visibility`, `author_id`, `published_at`, `updated_at`)
SELECT `id`, `scope_id`, TRIM(`title`), NULLIF(TRIM(`featured_image`), ''), `body`, `visibility`, `user_id`, `created_at`, `updated_at`
FROM `posts` WHERE `deleted_at` IS NULL AND TRIM(`title`) <> '';--> statement-breakpoint
INSERT INTO `notes` (`id`, `scope_id`, `body`, `visibility`, `author_id`, `published_at`, `updated_at`)
SELECT `id`, `scope_id`, `body`, `visibility`, `user_id`, `created_at`, `updated_at`
FROM `posts` WHERE `deleted_at` IS NULL AND TRIM(COALESCE(`title`, '')) = '';--> statement-breakpoint
WITH RECURSIVE
	`post_refs`(`old_ref`, `new_ref`) AS (
		SELECT 'core:post:' || `id`,
			CASE WHEN TRIM(`title`) <> '' THEN 'core:article:' ELSE 'core:note:' END || `id`
		FROM `posts` WHERE `deleted_at` IS NULL
	),
	`hits`(`rid`, `k`, `old_ref`, `new_ref`) AS (
		SELECT `t`.`rowid`, row_number() OVER (PARTITION BY `t`.`rowid` ORDER BY `r`.`old_ref`), `r`.`old_ref`, `r`.`new_ref`
		FROM `articles` AS `t` JOIN `post_refs` AS `r` ON instr(`t`.`body`, `r`.`old_ref`) > 0
	),
	`walk`(`rid`, `k`, `txt`) AS (
		SELECT `rowid`, 0, `body` FROM `articles` WHERE `rowid` IN (SELECT `rid` FROM `hits`)
		UNION ALL
		SELECT `w`.`rid`, `w`.`k` + 1, REPLACE(`w`.`txt`, `h`.`old_ref`, `h`.`new_ref`)
		FROM `walk` AS `w` JOIN `hits` AS `h` ON `h`.`rid` = `w`.`rid` AND `h`.`k` = `w`.`k` + 1
	)
UPDATE `articles` SET `body` = (SELECT `txt` FROM `walk` WHERE `walk`.`rid` = `articles`.`rowid` ORDER BY `k` DESC LIMIT 1)
WHERE `rowid` IN (SELECT `rid` FROM `hits`);--> statement-breakpoint
WITH RECURSIVE
	`post_refs`(`old_ref`, `new_ref`) AS (
		SELECT 'core:post:' || `id`,
			CASE WHEN TRIM(`title`) <> '' THEN 'core:article:' ELSE 'core:note:' END || `id`
		FROM `posts` WHERE `deleted_at` IS NULL
	),
	`hits`(`rid`, `k`, `old_ref`, `new_ref`) AS (
		SELECT `t`.`rowid`, row_number() OVER (PARTITION BY `t`.`rowid` ORDER BY `r`.`old_ref`), `r`.`old_ref`, `r`.`new_ref`
		FROM `notes` AS `t` JOIN `post_refs` AS `r` ON instr(`t`.`body`, `r`.`old_ref`) > 0
	),
	`walk`(`rid`, `k`, `txt`) AS (
		SELECT `rowid`, 0, `body` FROM `notes` WHERE `rowid` IN (SELECT `rid` FROM `hits`)
		UNION ALL
		SELECT `w`.`rid`, `w`.`k` + 1, REPLACE(`w`.`txt`, `h`.`old_ref`, `h`.`new_ref`)
		FROM `walk` AS `w` JOIN `hits` AS `h` ON `h`.`rid` = `w`.`rid` AND `h`.`k` = `w`.`k` + 1
	)
UPDATE `notes` SET `body` = (SELECT `txt` FROM `walk` WHERE `walk`.`rid` = `notes`.`rowid` ORDER BY `k` DESC LIMIT 1)
WHERE `rowid` IN (SELECT `rid` FROM `hits`);--> statement-breakpoint
WITH RECURSIVE
	`post_refs`(`old_ref`, `new_ref`) AS (
		SELECT 'core:post:' || `id`,
			CASE WHEN TRIM(`title`) <> '' THEN 'core:article:' ELSE 'core:note:' END || `id`
		FROM `posts` WHERE `deleted_at` IS NULL
	),
	`hits`(`rid`, `k`, `old_ref`, `new_ref`) AS (
		SELECT `t`.`rowid`, row_number() OVER (PARTITION BY `t`.`rowid` ORDER BY `r`.`old_ref`), `r`.`old_ref`, `r`.`new_ref`
		FROM `pages` AS `t` JOIN `post_refs` AS `r` ON instr(`t`.`content`, `r`.`old_ref`) > 0
	),
	`walk`(`rid`, `k`, `txt`) AS (
		SELECT `rowid`, 0, `content` FROM `pages` WHERE `rowid` IN (SELECT `rid` FROM `hits`)
		UNION ALL
		SELECT `w`.`rid`, `w`.`k` + 1, REPLACE(`w`.`txt`, `h`.`old_ref`, `h`.`new_ref`)
		FROM `walk` AS `w` JOIN `hits` AS `h` ON `h`.`rid` = `w`.`rid` AND `h`.`k` = `w`.`k` + 1
	)
UPDATE `pages` SET `content` = (SELECT `txt` FROM `walk` WHERE `walk`.`rid` = `pages`.`rowid` ORDER BY `k` DESC LIMIT 1)
WHERE `rowid` IN (SELECT `rid` FROM `hits`);--> statement-breakpoint
WITH RECURSIVE
	`post_refs`(`old_ref`, `new_ref`) AS (
		SELECT 'core:post:' || `id`,
			CASE WHEN TRIM(`title`) <> '' THEN 'core:article:' ELSE 'core:note:' END || `id`
		FROM `posts` WHERE `deleted_at` IS NULL
	),
	`hits`(`rid`, `k`, `old_ref`, `new_ref`) AS (
		SELECT `t`.`rowid`, row_number() OVER (PARTITION BY `t`.`rowid` ORDER BY `r`.`old_ref`), `r`.`old_ref`, `r`.`new_ref`
		FROM `menu_items` AS `t` JOIN `post_refs` AS `r` ON instr(`t`.`url`, `r`.`old_ref`) > 0
	),
	`walk`(`rid`, `k`, `txt`) AS (
		SELECT `rowid`, 0, `url` FROM `menu_items` WHERE `rowid` IN (SELECT `rid` FROM `hits`)
		UNION ALL
		SELECT `w`.`rid`, `w`.`k` + 1, REPLACE(`w`.`txt`, `h`.`old_ref`, `h`.`new_ref`)
		FROM `walk` AS `w` JOIN `hits` AS `h` ON `h`.`rid` = `w`.`rid` AND `h`.`k` = `w`.`k` + 1
	)
UPDATE `menu_items` SET `url` = (SELECT `txt` FROM `walk` WHERE `walk`.`rid` = `menu_items`.`rowid` ORDER BY `k` DESC LIMIT 1)
WHERE `rowid` IN (SELECT `rid` FROM `hits`);--> statement-breakpoint
WITH RECURSIVE
	`post_refs`(`old_ref`, `new_ref`) AS (
		SELECT 'core:post:' || `id`,
			CASE WHEN TRIM(`title`) <> '' THEN 'core:article:' ELSE 'core:note:' END || `id`
		FROM `posts` WHERE `deleted_at` IS NULL
	),
	`hits`(`rid`, `k`, `old_ref`, `new_ref`) AS (
		SELECT `t`.`rowid`, row_number() OVER (PARTITION BY `t`.`rowid` ORDER BY `r`.`old_ref`), `r`.`old_ref`, `r`.`new_ref`
		FROM `jobs` AS `t` JOIN `post_refs` AS `r` ON instr(`t`.`body`, `r`.`old_ref`) > 0
	),
	`walk`(`rid`, `k`, `txt`) AS (
		SELECT `rowid`, 0, `body` FROM `jobs` WHERE `rowid` IN (SELECT `rid` FROM `hits`)
		UNION ALL
		SELECT `w`.`rid`, `w`.`k` + 1, REPLACE(`w`.`txt`, `h`.`old_ref`, `h`.`new_ref`)
		FROM `walk` AS `w` JOIN `hits` AS `h` ON `h`.`rid` = `w`.`rid` AND `h`.`k` = `w`.`k` + 1
	)
UPDATE `jobs` SET `body` = (SELECT `txt` FROM `walk` WHERE `walk`.`rid` = `jobs`.`rowid` ORDER BY `k` DESC LIMIT 1)
WHERE `rowid` IN (SELECT `rid` FROM `hits`);--> statement-breakpoint
UPDATE `pages` SET `content` = REPLACE(`content`, '"PostsListBlock"', '"StreamBlock"')
WHERE `content` LIKE '%"PostsListBlock"%';--> statement-breakpoint
DROP TABLE `posts`;