CREATE TABLE `redirects` (
	`from_path` text PRIMARY KEY,
	`to_path` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `redirects` (`from_path`, `to_path`) SELECT '/groups/' || `slug`, rtrim(`path`, '/') FROM `scopes` WHERE `parent_id` IS NOT NULL AND `slug` IN (SELECT `slug` FROM `scopes` WHERE `parent_id` IS NOT NULL GROUP BY `slug` HAVING COUNT(*) = 1);
