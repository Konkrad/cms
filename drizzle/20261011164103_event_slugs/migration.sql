-- Events get a URL slug, unique per scope. Existing events get their id as slug, so their
-- old /events/<id> URLs stay canonical for root events; new events get one from the title.
ALTER TABLE `events` ADD `slug` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `events` SET `slug` = `id`;--> statement-breakpoint
CREATE UNIQUE INDEX `events_scope_slug_unique` ON `events` (`scope_id`,`slug`);
