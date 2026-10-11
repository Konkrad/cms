-- Internal links are stored as references (spec 4.3), so renaming or moving a scope or page
-- never breaks them. Existing stored URLs that resolve become references; others stay.

-- Menu items linked to a CMS page.
UPDATE `menu_items` SET `url` = 'ref:core:page:' || `page_id`
WHERE `page_id` IS NOT NULL AND `page_id` IN (SELECT `id` FROM `pages`);--> statement-breakpoint

-- Menu items pointing at a scope's home page (/germany/berlin).
UPDATE `menu_items`
SET `url` = 'ref:scope:' || (SELECT `id` FROM `scopes` WHERE `scopes`.`path` = rtrim(`menu_items`.`url`, '/') || '/')
WHERE `url` LIKE '/_%'
	AND EXISTS (SELECT 1 FROM `scopes` WHERE `scopes`.`path` = rtrim(`menu_items`.`url`, '/') || '/');--> statement-breakpoint

-- Menu items pointing at a root CMS page (/about) without the page link.
UPDATE `menu_items`
SET `url` = 'ref:core:page:' || (
	SELECT `pages`.`id` FROM `pages` JOIN `scopes` ON `scopes`.`id` = `pages`.`scope_id`
	WHERE `scopes`.`parent_id` IS NULL AND '/' || `pages`.`slug` = rtrim(`menu_items`.`url`, '/')
)
WHERE `url` LIKE '/_%' AND `url` NOT LIKE '%/%/%' AND EXISTS (
	SELECT 1 FROM `pages` JOIN `scopes` ON `scopes`.`id` = `pages`.`scope_id`
	WHERE `scopes`.`parent_id` IS NULL AND '/' || `pages`.`slug` = rtrim(`menu_items`.`url`, '/')
);--> statement-breakpoint

-- Menu items pointing at an item page by id (/events/<id>, /posts/<id>, …).
UPDATE `menu_items` SET `url` = 'ref:events:event:' || substr(`url`, 9)
WHERE `url` LIKE '/events/%' AND substr(`url`, 9) IN (SELECT `id` FROM `events`);--> statement-breakpoint
UPDATE `menu_items` SET `url` = 'ref:core:post:' || substr(`url`, 8)
WHERE `url` LIKE '/posts/%' AND substr(`url`, 8) IN (SELECT `id` FROM `posts`);--> statement-breakpoint
UPDATE `menu_items` SET `url` = 'ref:jobs:job:' || substr(`url`, 7)
WHERE `url` LIKE '/jobs/%' AND substr(`url`, 7) IN (SELECT `id` FROM `jobs`);--> statement-breakpoint
UPDATE `menu_items` SET `url` = 'ref:deals:deal:' || substr(`url`, 8)
WHERE `url` LIKE '/deals/%' AND substr(`url`, 8) IN (SELECT `id` FROM `deals`);--> statement-breakpoint
UPDATE `menu_items` SET `url` = 'ref:elections:cycle:' || substr(`url`, 12)
WHERE `url` LIKE '/elections/%' AND substr(`url`, 12) IN (SELECT `id` FROM `election_cycles`);--> statement-breakpoint

-- Page-builder link fields (the action button's `href`) pointing at a scope or a root page.
UPDATE `pages`
SET `content` = (
	SELECT json_group_array(
		CASE
			WHEN json_type(`b`.`value`, '$.data.href') = 'text' AND EXISTS (
				SELECT 1 FROM `scopes` WHERE `scopes`.`path` = rtrim(json_extract(`b`.`value`, '$.data.href'), '/') || '/'
			) THEN json_set(`b`.`value`, '$.data.href', 'ref:scope:' || (
				SELECT `id` FROM `scopes` WHERE `scopes`.`path` = rtrim(json_extract(`b`.`value`, '$.data.href'), '/') || '/'
			))
			WHEN json_type(`b`.`value`, '$.data.href') = 'text' AND EXISTS (
				SELECT 1 FROM `pages` AS `p` JOIN `scopes` ON `scopes`.`id` = `p`.`scope_id`
				WHERE `scopes`.`parent_id` IS NULL AND `p`.`slug` != '' AND '/' || `p`.`slug` = rtrim(json_extract(`b`.`value`, '$.data.href'), '/')
			) THEN json_set(`b`.`value`, '$.data.href', 'ref:core:page:' || (
				SELECT `p`.`id` FROM `pages` AS `p` JOIN `scopes` ON `scopes`.`id` = `p`.`scope_id`
				WHERE `scopes`.`parent_id` IS NULL AND `p`.`slug` != '' AND '/' || `p`.`slug` = rtrim(json_extract(`b`.`value`, '$.data.href'), '/')
			))
			ELSE json(`b`.`value`)
		END
	)
	FROM (SELECT `value` FROM json_each(`pages`.`content`) ORDER BY `key`) AS `b`
)
WHERE json_valid(`content`) AND `content` LIKE '%"href"%';
